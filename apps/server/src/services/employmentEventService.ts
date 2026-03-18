import { eq, and, ne, sql, or, ilike, desc, gte, inArray } from 'drizzle-orm';
import { db } from '../db/index';
import { employmentEvents, transfers, loans, mdas, users } from '../db/schema';
import { withMdaScope } from '../lib/mdaScope';
import { AppError } from '../lib/appError';
import { VOCABULARY } from '@vlprs/shared';
import type { LoanStatus, EmploymentEventType, CreateEmploymentEventResponse, EmploymentEventListItem, TransferSearchResult } from '@vlprs/shared';
import { transitionLoan, type TxHandle } from './loanTransitionService';
import { sendEmploymentEventConfirmation, sendTransferNotification } from '../lib/email';

/** Escape SQL LIKE wildcard characters in user-supplied search input. */
function escapeLikePattern(str: string): string {
  return str.replace(/[%_\\]/g, '\\$&');
}

// ─── Event-to-Loan-Status Mapping ──────────────────────────────────

const EVENT_TO_STATUS_MAP: Record<EmploymentEventType, LoanStatus | null> = {
  RETIRED: 'RETIRED',
  DECEASED: 'DECEASED',
  SUSPENDED: 'SUSPENDED',
  ABSCONDED: 'WRITTEN_OFF',
  TRANSFERRED_OUT: 'TRANSFER_PENDING',
  TRANSFERRED_IN: null, // audit trail only — handshake logic manages status
  DISMISSED: 'WRITTEN_OFF',
  LWOP_START: 'LWOP',
  LWOP_END: 'ACTIVE',
  REINSTATED: 'ACTIVE',
  SERVICE_EXTENSION: null, // no status change — updates computed_retirement_date
};

// ─── createEmploymentEvent ─────────────────────────────────────────

export async function createEmploymentEvent(
  data: {
    staffId: string;
    eventType: EmploymentEventType;
    effectiveDate: string;
    referenceNumber?: string;
    notes?: string;
    newRetirementDate?: string;
    confirmDuplicate?: boolean;
  },
  mdaScope: string | null | undefined,
  userId: string,
  userRole: string,
): Promise<CreateEmploymentEventResponse> {
  // 1. Find the staff member's loan
  const loanConditions = [eq(loans.staffId, data.staffId)];

  // MDA officer can only file for their own MDA
  if (userRole === 'mda_officer') {
    const scopeCondition = withMdaScope(loans.mdaId, mdaScope);
    if (scopeCondition) loanConditions.push(scopeCondition);
  }

  const [loan] = await db
    .select({
      id: loans.id,
      staffId: loans.staffId,
      staffName: loans.staffName,
      mdaId: loans.mdaId,
      status: loans.status,
    })
    .from(loans)
    .where(and(...loanConditions));

  if (!loan) {
    // Check if staff exists at all (for 403 vs 404)
    if (userRole === 'mda_officer' && mdaScope) {
      const [exists] = await db
        .select({ id: loans.id })
        .from(loans)
        .where(eq(loans.staffId, data.staffId));
      if (exists) {
        throw new AppError(403, 'CROSS_MDA_DENIED', VOCABULARY.EMPLOYMENT_EVENT_CROSS_MDA_DENIED);
      }
    }
    throw new AppError(404, 'STAFF_NOT_FOUND', VOCABULARY.EMPLOYMENT_EVENT_STAFF_NOT_FOUND);
  }

  // 2. Duplicate guard (AC 10)
  if (!data.confirmDuplicate) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [duplicate] = await db
      .select({ id: employmentEvents.id })
      .from(employmentEvents)
      .where(
        and(
          eq(employmentEvents.staffId, data.staffId),
          eq(employmentEvents.eventType, data.eventType),
          eq(employmentEvents.reconciliationStatus, 'UNCONFIRMED'),
          gte(employmentEvents.createdAt, thirtyDaysAgo),
        ),
      );

    if (duplicate) {
      throw new AppError(422, 'DUPLICATE_EVENT', VOCABULARY.EMPLOYMENT_EVENT_DUPLICATE);
    }
  }

  // 3. Main transaction: insert event + transition loan
  const targetStatus = EVENT_TO_STATUS_MAP[data.eventType];
  const effectiveDateObj = new Date(data.effectiveDate);

  const result = await db.transaction(async (tx) => {
    // Insert employment event
    const [event] = await tx
      .insert(employmentEvents)
      .values({
        staffId: data.staffId,
        loanId: loan.id,
        mdaId: loan.mdaId,
        eventType: data.eventType,
        effectiveDate: effectiveDateObj,
        referenceNumber: data.referenceNumber || null,
        notes: data.notes || null,
        newRetirementDate: data.newRetirementDate ? new Date(data.newRetirementDate) : null,
        reconciliationStatus: 'UNCONFIRMED',
        filedBy: userId,
      })
      .returning();

    let newLoanStatus = loan.status;

    // Transition loan status if applicable — pass tx for atomicity (C1/C2 fix)
    if (targetStatus) {
      const transition = await transitionLoan(
        userId,
        loan.id,
        targetStatus,
        `Employment event: ${data.eventType}`,
        null, // bypass MDA scope — already validated above
        tx,   // participate in outer transaction
      );
      newLoanStatus = transition.toStatus;
    }

    // Handle Transfer Out — create transfer record
    if (data.eventType === 'TRANSFERRED_OUT') {
      await tx.insert(transfers).values({
        staffId: data.staffId,
        loanId: loan.id,
        outgoingMdaId: loan.mdaId,
        outgoingEventId: event.id,
        outgoingConfirmed: true,
        incomingConfirmed: false,
        status: 'PENDING',
      });
    }

    // Handle Service Extension — update computed_retirement_date on temporal profile
    if (data.eventType === 'SERVICE_EXTENSION' && data.newRetirementDate) {
      await tx
        .update(loans)
        .set({
          computedRetirementDate: new Date(data.newRetirementDate),
          updatedAt: new Date(),
        })
        .where(eq(loans.id, loan.id));
    }

    return { event, newLoanStatus };
  });

  // 4. Fire-and-forget email (outside transaction)
  const [filingUser] = await db
    .select({ email: users.email, firstName: users.firstName })
    .from(users)
    .where(eq(users.id, userId));

  if (filingUser) {
    sendEmploymentEventConfirmation({
      to: filingUser.email,
      firstName: filingUser.firstName,
      eventType: data.eventType,
      staffName: loan.staffName,
      staffId: data.staffId,
      effectiveDate: data.effectiveDate,
      referenceNumber: data.referenceNumber,
    });
  }

  return {
    id: result.event.id,
    staffId: loan.staffId,
    staffName: loan.staffName,
    eventType: data.eventType,
    effectiveDate: data.effectiveDate,
    newLoanStatus: result.newLoanStatus,
    reconciliationStatus: 'UNCONFIRMED',
  };
}

// ─── getTransferSearchResults ──────────────────────────────────────

export async function getTransferSearchResults(
  query: string,
  excludeMdaId: string | null,
  page: number,
  limit: number,
): Promise<{ items: TransferSearchResult[]; total: number; page: number; limit: number }> {
  const nonTerminalStatuses: LoanStatus[] = ['ACTIVE', 'TRANSFER_PENDING', 'SUSPENDED', 'LWOP'];

  const escaped = escapeLikePattern(query);
  const conditions = [
    inArray(loans.status, nonTerminalStatuses),
  ];

  if (excludeMdaId) {
    conditions.push(ne(loans.mdaId, excludeMdaId));
  }

  const searchCondition = or(
    ilike(loans.staffName, `%${escaped}%`),
    ilike(loans.staffId, `%${escaped}%`),
  );
  if (searchCondition) conditions.push(searchCondition);

  const offset = (page - 1) * limit;
  const whereClause = and(...conditions);

  // Single query with LEFT JOIN for transfer status (fixes N+1)
  const [results, countResult] = await Promise.all([
    db
      .select({
        staffId: loans.staffId,
        staffName: loans.staffName,
        mdaName: mdas.name,
        transferStatus: transfers.status,
      })
      .from(loans)
      .innerJoin(mdas, eq(loans.mdaId, mdas.id))
      .leftJoin(
        transfers,
        and(eq(transfers.staffId, loans.staffId), eq(transfers.status, 'PENDING')),
      )
      .where(whereClause)
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(loans)
      .innerJoin(mdas, eq(loans.mdaId, mdas.id))
      .where(whereClause),
  ]);

  const items: TransferSearchResult[] = results.map((r) => ({
    staffId: r.staffId,
    staffName: r.staffName,
    mdaName: r.mdaName,
    transferStatus: r.transferStatus ?? undefined,
  }));

  return {
    items,
    total: countResult[0]?.count ?? 0,
    page,
    limit,
  };
}

// ─── claimTransferIn ───────────────────────────────────────────────

export async function claimTransferIn(
  staffId: string,
  claimingMdaId: string,
  userId: string,
): Promise<{ transferId: string; status: string }> {
  // Find the staff member's loan at another MDA (non-terminal status)
  const nonTerminalStatuses: LoanStatus[] = ['ACTIVE', 'TRANSFER_PENDING', 'SUSPENDED', 'LWOP'];

  const [loan] = await db
    .select({
      id: loans.id,
      staffId: loans.staffId,
      staffName: loans.staffName,
      mdaId: loans.mdaId,
      status: loans.status,
    })
    .from(loans)
    .where(
      and(
        eq(loans.staffId, staffId),
        ne(loans.mdaId, claimingMdaId),
        sql`${loans.status} IN (${sql.join(nonTerminalStatuses.map((s) => sql`${s}`), sql`, `)})`,
      ),
    );

  if (!loan) {
    throw new AppError(404, 'TRANSFER_STAFF_NOT_FOUND', VOCABULARY.TRANSFER_STAFF_NOT_FOUND);
  }

  const result = await db.transaction(async (tx) => {
    // Insert TRANSFERRED_IN event for audit trail
    const [event] = await tx
      .insert(employmentEvents)
      .values({
        staffId,
        loanId: loan.id,
        mdaId: claimingMdaId,
        eventType: 'TRANSFERRED_IN',
        effectiveDate: new Date(),
        reconciliationStatus: 'UNCONFIRMED',
        filedBy: userId,
      })
      .returning();

    // Check for existing transfer record
    const [existingTransfer] = await tx
      .select()
      .from(transfers)
      .where(
        and(eq(transfers.staffId, staffId), eq(transfers.status, 'PENDING')),
      )
      .for('update');

    let transferId: string;
    let transferStatus = 'PENDING';

    if (existingTransfer) {
      // Update existing transfer — outgoing MDA already filed Transfer Out
      await tx
        .update(transfers)
        .set({
          incomingMdaId: claimingMdaId,
          incomingConfirmed: true,
          incomingEventId: event.id,
          updatedAt: new Date(),
        })
        .where(eq(transfers.id, existingTransfer.id));

      transferId = existingTransfer.id;

      // If both sides confirmed, complete transfer
      if (existingTransfer.outgoingConfirmed) {
        await completeTransfer(tx, existingTransfer.id, loan.id, claimingMdaId, userId);
        transferStatus = 'COMPLETED';
      }
    } else {
      // Create new transfer — incoming MDA is initiating first
      const [newTransfer] = await tx
        .insert(transfers)
        .values({
          staffId,
          loanId: loan.id,
          outgoingMdaId: loan.mdaId,
          incomingMdaId: claimingMdaId,
          incomingConfirmed: true,
          incomingEventId: event.id,
          outgoingConfirmed: false,
          status: 'PENDING',
        })
        .returning();

      transferId = newTransfer.id;
    }

    // Capture notification data inside tx (but send OUTSIDE)
    const [outgoingOfficer] = await tx
      .select({ email: users.email, firstName: users.firstName })
      .from(users)
      .where(eq(users.mdaId, loan.mdaId));

    return { transferId, status: transferStatus, outgoingOfficer: outgoingOfficer ?? null };
  });

  // Fire-and-forget email OUTSIDE transaction (M1 fix)
  if (result.outgoingOfficer) {
    sendTransferNotification({
      to: result.outgoingOfficer.email,
      firstName: result.outgoingOfficer.firstName,
      staffName: loan.staffName,
      staffId,
      direction: 'incoming_claim',
    });
  }

  return { transferId: result.transferId, status: result.status };
}

// ─── confirmTransfer ───────────────────────────────────────────────

export async function confirmTransfer(
  transferId: string,
  confirmingUserId: string,
  confirmingUserRole: string,
  confirmingUserMdaId: string | null,
  side: 'outgoing' | 'incoming',
): Promise<{ outgoingConfirmed: boolean; incomingConfirmed: boolean; status: string; loanStatus?: string }> {
  return db.transaction(async (tx) => {
    const [transfer] = await tx
      .select()
      .from(transfers)
      .where(eq(transfers.id, transferId))
      .for('update');

    if (!transfer) {
      throw new AppError(404, 'TRANSFER_NOT_FOUND', VOCABULARY.TRANSFER_NOT_FOUND);
    }

    if (transfer.status === 'COMPLETED') {
      throw new AppError(400, 'TRANSFER_ALREADY_COMPLETED', VOCABULARY.TRANSFER_ALREADY_COMPLETED);
    }

    // MDA officer can only confirm their own side
    if (confirmingUserRole === 'mda_officer') {
      if (side === 'outgoing' && confirmingUserMdaId !== transfer.outgoingMdaId) {
        throw new AppError(403, 'TRANSFER_WRONG_MDA', VOCABULARY.TRANSFER_WRONG_MDA);
      }
      if (side === 'incoming' && confirmingUserMdaId !== transfer.incomingMdaId) {
        throw new AppError(403, 'TRANSFER_WRONG_MDA', VOCABULARY.TRANSFER_WRONG_MDA);
      }
    }

    // Check if this side is already confirmed
    if (side === 'outgoing' && transfer.outgoingConfirmed) {
      throw new AppError(400, 'TRANSFER_SIDE_ALREADY_CONFIRMED', VOCABULARY.TRANSFER_SIDE_ALREADY_CONFIRMED);
    }
    if (side === 'incoming' && transfer.incomingConfirmed) {
      throw new AppError(400, 'TRANSFER_SIDE_ALREADY_CONFIRMED', VOCABULARY.TRANSFER_SIDE_ALREADY_CONFIRMED);
    }

    // Update confirmation
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (side === 'outgoing') {
      updateData.outgoingConfirmed = true;
    } else {
      updateData.incomingConfirmed = true;
    }

    // Track if dept_admin/super_admin overrode
    if (confirmingUserRole !== 'mda_officer') {
      updateData.confirmedBy = confirmingUserId;
    }

    await tx
      .update(transfers)
      .set(updateData)
      .where(eq(transfers.id, transferId));

    const outgoingConfirmed = side === 'outgoing' ? true : transfer.outgoingConfirmed;
    const incomingConfirmed = side === 'incoming' ? true : transfer.incomingConfirmed;
    let status = 'PENDING';
    let loanStatus: string | undefined;

    // If both sides confirmed, complete transfer
    if (outgoingConfirmed && incomingConfirmed && transfer.incomingMdaId) {
      await completeTransfer(tx, transferId, transfer.loanId, transfer.incomingMdaId, confirmingUserId);
      status = 'COMPLETED';
      loanStatus = 'ACTIVE';
    }

    return { outgoingConfirmed, incomingConfirmed, status, loanStatus };
  });
}

// ─── completeTransfer (internal) ───────────────────────────────────

async function completeTransfer(
  tx: TxHandle,
  transferId: string,
  loanId: string,
  incomingMdaId: string,
  userId: string,
): Promise<void> {
  // Update loan mda_id to incoming MDA
  await tx
    .update(loans)
    .set({ mdaId: incomingMdaId, updatedAt: new Date() })
    .where(eq(loans.id, loanId));

  // Transition loan from TRANSFER_PENDING to ACTIVE — pass tx to avoid deadlock (C1 fix)
  await transitionLoan(
    userId,
    loanId,
    'ACTIVE',
    'Transfer completed — loan moved to new MDA',
    null,
    tx,
  );

  // Mark transfer as completed
  await tx
    .update(transfers)
    .set({ status: 'COMPLETED', updatedAt: new Date() })
    .where(eq(transfers.id, transferId));
}

// ─── getEmploymentEvents ───────────────────────────────────────────

export async function getEmploymentEvents(
  mdaId: string,
  page: number,
  limit: number,
): Promise<{ items: EmploymentEventListItem[]; total: number; page: number; limit: number }> {
  const offset = (page - 1) * limit;

  const [results, countResult] = await Promise.all([
    db
      .select({
        id: employmentEvents.id,
        eventType: employmentEvents.eventType,
        staffName: loans.staffName,
        staffId: employmentEvents.staffId,
        effectiveDate: employmentEvents.effectiveDate,
        reconciliationStatus: employmentEvents.reconciliationStatus,
        filedByFirstName: users.firstName,
        filedByLastName: users.lastName,
        createdAt: employmentEvents.createdAt,
      })
      .from(employmentEvents)
      .leftJoin(loans, eq(employmentEvents.loanId, loans.id))
      .innerJoin(users, eq(employmentEvents.filedBy, users.id))
      .where(eq(employmentEvents.mdaId, mdaId))
      .orderBy(desc(employmentEvents.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(employmentEvents)
      .where(eq(employmentEvents.mdaId, mdaId)),
  ]);

  const items: EmploymentEventListItem[] = results.map((r) => ({
    id: r.id,
    eventType: r.eventType,
    staffName: r.staffName ?? '',
    staffId: r.staffId,
    effectiveDate: r.effectiveDate instanceof Date ? r.effectiveDate.toISOString().split('T')[0] : String(r.effectiveDate),
    reconciliationStatus: r.reconciliationStatus,
    filedByName: `${r.filedByFirstName} ${r.filedByLastName}`,
    createdAt: r.createdAt.toISOString(),
  }));

  return {
    items,
    total: countResult[0]?.count ?? 0,
    page,
    limit,
  };
}

// ─── staffLookup ───────────────────────────────────────────────────

export async function staffLookup(
  staffId: string,
  mdaScope: string | null | undefined,
  userRole: string,
): Promise<{ staffId: string; staffName: string; mdaName: string; loanStatus: string }> {
  const conditions = [eq(loans.staffId, staffId)];

  // MDA officer: scope to their MDA only
  if (userRole === 'mda_officer') {
    const scopeCondition = withMdaScope(loans.mdaId, mdaScope);
    if (scopeCondition) conditions.push(scopeCondition);
  }

  const [result] = await db
    .select({
      staffId: loans.staffId,
      staffName: loans.staffName,
      mdaName: mdas.name,
      loanStatus: loans.status,
    })
    .from(loans)
    .innerJoin(mdas, eq(loans.mdaId, mdas.id))
    .where(and(...conditions));

  if (!result) {
    throw new AppError(404, 'STAFF_NOT_FOUND', VOCABULARY.EMPLOYMENT_EVENT_STAFF_NOT_FOUND);
  }

  return result;
}
