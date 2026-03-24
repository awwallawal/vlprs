/**
 * exceptionService — Manual exception flagging, queue listing, detail, resolution, and counts.
 *
 * Two exception creation paths:
 *   A) Manual Flag (this service): LoanDetailPage → flag dialog → flagLoanAsException()
 *   B) Auto-Promote (observationService): Observation engine → promoteToException()
 *
 * Both produce an exception row; the queue treats them identically.
 */

import { eq, and, sql, desc, count, aliasedTable } from 'drizzle-orm';
import { db } from '../db/index';
import { exceptions, observations, loans, mdas, users, auditLog } from '../db/schema';
import { withMdaScope } from '../lib/mdaScope';
import { withTransaction } from '../lib/transaction';
import { AppError } from '../lib/appError';
import { VOCABULARY } from '@vlprs/shared';
import type { ExceptionListItem, ExceptionDetail, ExceptionCounts } from '@vlprs/shared';
import { getOutstandingBalance } from './balanceService';

// ─── Flag Loan as Exception (AC 1) ─────────────────────────────────

export async function flagLoanAsException(
  loanId: string,
  userId: string,
  mdaScope: string | null,
  input: { priority: 'high' | 'medium' | 'low'; category: string; notes: string },
): Promise<{ exceptionId: string; observationId: string }> {
  // Validate loan exists
  const [loan] = await db
    .select({
      id: loans.id,
      staffName: loans.staffName,
      staffId: loans.staffId,
      mdaId: loans.mdaId,
    })
    .from(loans)
    .where(eq(loans.id, loanId))
    .limit(1);

  if (!loan) {
    throw new AppError(404, 'LOAN_NOT_FOUND', 'The specified loan could not be found');
  }

  // Enforce MDA scoping
  if (mdaScope && loan.mdaId !== mdaScope) {
    throw new AppError(403, 'MDA_SCOPE_VIOLATION', 'You can only flag exceptions for loans in your assigned MDA');
  }

  return withTransaction(async (tx) => {
    // Create observation (manual_exception, promoted)
    const [obs] = await tx
      .insert(observations)
      .values({
        type: 'manual_exception',
        staffName: loan.staffName,
        staffId: loan.staffId,
        loanId: loan.id,
        mdaId: loan.mdaId,
        description: input.notes,
        context: { possibleExplanations: [], suggestedAction: 'Manual review required', dataCompleteness: 100, completenessNote: 'Manually flagged — no automated analysis performed.', dataPoints: {} },
        sourceReference: null,
        status: 'promoted',
      })
      .returning({ id: observations.id });

    // Create exception linked to observation and loan
    const [exception] = await tx
      .insert(exceptions)
      .values({
        observationId: obs.id,
        staffName: loan.staffName,
        staffId: loan.staffId,
        mdaId: loan.mdaId,
        category: input.category,
        description: input.notes,
        priority: input.priority,
        promotedBy: userId,
        loanId: loan.id,
        flagNotes: input.notes,
      })
      .returning({ id: exceptions.id });

    // Link observation back to exception
    await tx
      .update(observations)
      .set({ promotedExceptionId: exception.id, updatedAt: new Date() })
      .where(eq(observations.id, obs.id));

    return { exceptionId: exception.id, observationId: obs.id };
  });
}

// ─── List Exceptions (AC 2, 3, 6) ──────────────────────────────────

interface ExceptionFilters {
  category?: string;
  mdaId?: string;
  priority?: 'high' | 'medium' | 'low';
  status?: 'open' | 'resolved';
  loanId?: string;
  page?: number;
  limit?: number;
}

export async function listExceptions(
  filters: ExceptionFilters,
  mdaScope: string | null,
): Promise<{ data: ExceptionListItem[]; total: number; page: number }> {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 25;
  const offset = (page - 1) * limit;

  const conditions: (ReturnType<typeof eq> | undefined)[] = [];

  // MDA scoping
  const scopeCondition = withMdaScope(exceptions.mdaId, mdaScope);
  if (scopeCondition) conditions.push(scopeCondition);

  // Filters
  if (filters.category) conditions.push(eq(exceptions.category, filters.category));
  if (filters.mdaId) conditions.push(eq(exceptions.mdaId, filters.mdaId));
  if (filters.priority) conditions.push(eq(exceptions.priority, filters.priority));
  if (filters.status) conditions.push(eq(exceptions.status, filters.status));
  if (filters.loanId) conditions.push(eq(exceptions.loanId, filters.loanId));

  const whereClause = conditions.length > 0
    ? and(...conditions.filter(Boolean))
    : undefined;

  // Count total
  const [{ total }] = await db
    .select({ total: count() })
    .from(exceptions)
    .where(whereClause);

  // Query with sort: open first (priority H→M→L, then createdAt DESC), then resolved (resolvedAt DESC)
  const rows = await db
    .select({
      id: exceptions.id,
      priority: exceptions.priority,
      category: exceptions.category,
      staffId: exceptions.staffId,
      staffName: exceptions.staffName,
      mdaId: exceptions.mdaId,
      mdaName: mdas.name,
      description: exceptions.description,
      createdAt: exceptions.createdAt,
      status: exceptions.status,
      resolvedAt: exceptions.resolvedAt,
      loanId: exceptions.loanId,
      observationId: exceptions.observationId,
      flagNotes: exceptions.flagNotes,
    })
    .from(exceptions)
    .leftJoin(mdas, eq(exceptions.mdaId, mdas.id))
    .where(whereClause)
    .orderBy(
      // Open first, resolved last
      sql`CASE WHEN ${exceptions.status} = 'open' THEN 0 ELSE 1 END`,
      // Within open: priority order
      sql`CASE ${exceptions.priority} WHEN 'high' THEN 0 WHEN 'medium' THEN 1 WHEN 'low' THEN 2 END`,
      desc(exceptions.createdAt),
    )
    .limit(limit)
    .offset(offset);

  const data: ExceptionListItem[] = rows.map((r) => ({
    id: r.id,
    priority: r.priority,
    category: r.category,
    staffId: r.staffId,
    staffName: r.staffName,
    mdaId: r.mdaId,
    mdaName: r.mdaName ?? '',
    description: r.description,
    createdAt: r.createdAt.toISOString(),
    status: r.status,
    resolvedAt: r.resolvedAt?.toISOString() ?? null,
    loanId: r.loanId,
    observationId: r.observationId,
    flagNotes: r.flagNotes,
  }));

  return { data, total, page };
}

// ─── Exception Detail (AC 4) ───────────────────────────────────────

export async function getExceptionDetail(
  exceptionId: string,
  mdaScope: string | null,
): Promise<ExceptionDetail> {
  // Alias users table for promoter and resolver joins (M2: consolidate queries)
  const promoterUser = aliasedTable(users, 'promoter_user');
  const resolverUser = aliasedTable(users, 'resolver_user');

  const [row] = await db
    .select({
      id: exceptions.id,
      priority: exceptions.priority,
      category: exceptions.category,
      description: exceptions.description,
      status: exceptions.status,
      flagNotes: exceptions.flagNotes,
      promotedBy: exceptions.promotedBy,
      createdAt: exceptions.createdAt,
      resolvedBy: exceptions.resolvedBy,
      resolvedAt: exceptions.resolvedAt,
      resolutionNote: exceptions.resolutionNote,
      actionTaken: exceptions.actionTaken,
      loanId: exceptions.loanId,
      observationId: exceptions.observationId,
      staffName: exceptions.staffName,
      staffId: exceptions.staffId,
      mdaId: exceptions.mdaId,
      mdaName: mdas.name,
      // Joined user names — eliminates 2 separate queries
      promoterEmail: promoterUser.email,
      resolverEmail: resolverUser.email,
      // Joined observation — eliminates 1 separate query
      obsId: observations.id,
      obsType: observations.type,
      obsDescription: observations.description,
      obsStatus: observations.status,
      obsContext: observations.context,
      obsCreatedAt: observations.createdAt,
    })
    .from(exceptions)
    .leftJoin(mdas, eq(exceptions.mdaId, mdas.id))
    .leftJoin(promoterUser, eq(exceptions.promotedBy, promoterUser.id))
    .leftJoin(resolverUser, eq(exceptions.resolvedBy, resolverUser.id))
    .leftJoin(observations, eq(exceptions.observationId, observations.id))
    .where(eq(exceptions.id, exceptionId))
    .limit(1);

  if (!row) {
    throw new AppError(404, 'EXCEPTION_NOT_FOUND', VOCABULARY.EXCEPTION_NOT_FOUND);
  }

  // Enforce MDA scoping
  if (mdaScope && row.mdaId !== mdaScope) {
    throw new AppError(403, 'MDA_SCOPE_VIOLATION', 'You do not have access to this exception');
  }

  // Load linked loan (if exists) — still separate due to balance computation
  let loanData: ExceptionDetail['loan'] = null;
  if (row.loanId) {
    const [loanRow] = await db
      .select({
        id: loans.id,
        staffName: loans.staffName,
        staffId: loans.staffId,
        loanReference: loans.loanReference,
        principal: loans.principalAmount,
        status: loans.status,
        mdaName: mdas.name,
      })
      .from(loans)
      .leftJoin(mdas, eq(loans.mdaId, mdas.id))
      .where(eq(loans.id, row.loanId))
      .limit(1);

    if (loanRow) {
      let balance = '0.00';
      try {
        const balResult = await getOutstandingBalance(loanRow.id);
        balance = balResult.computedBalance;
      } catch {
        // Balance unavailable — use default
      }
      loanData = {
        id: loanRow.id,
        staffName: loanRow.staffName,
        staffId: loanRow.staffId,
        mdaName: loanRow.mdaName ?? '',
        loanReference: loanRow.loanReference,
        principal: loanRow.principal,
        outstandingBalance: balance,
        status: loanRow.status,
      };
    }
  }

  // Load audit trail entries — exact resource match instead of LIKE scan (M3)
  const resourcePath = `/api/exceptions/${exceptionId}`;
  const auditEntries = await db
    .select({
      action: auditLog.action,
      userId: auditLog.userId,
      email: auditLog.email,
      timestamp: auditLog.createdAt,
      resource: auditLog.resource,
    })
    .from(auditLog)
    .where(
      and(
        sql`${auditLog.action} IN ('EXCEPTION_FLAGGED', 'EXCEPTION_RESOLVED', 'EXCEPTION_VIEWED')`,
        sql`(${auditLog.resource} = ${resourcePath} OR ${auditLog.resource} = ${resourcePath + '/resolve'})`,
      ),
    )
    .orderBy(desc(auditLog.createdAt))
    .limit(50);

  return {
    id: row.id,
    priority: row.priority,
    category: row.category,
    description: row.description,
    status: row.status,
    flagNotes: row.flagNotes,
    promotedBy: row.promotedBy,
    promotedByName: row.promoterEmail ?? 'Unknown',
    createdAt: row.createdAt.toISOString(),
    resolvedBy: row.resolvedBy,
    resolvedByName: row.resolverEmail ?? null,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    resolutionNote: row.resolutionNote,
    actionTaken: row.actionTaken as ExceptionDetail['actionTaken'],
    loanId: row.loanId,
    loan: loanData,
    observationId: row.observationId,
    observation: row.obsId
      ? {
          id: row.obsId,
          type: row.obsType!,
          description: row.obsDescription ?? '',
          status: row.obsStatus!,
          context: row.obsContext as Record<string, unknown>,
          createdAt: row.obsCreatedAt!.toISOString(),
        }
      : { id: row.observationId, type: 'unknown', description: '', status: 'promoted', context: {}, createdAt: '' },
    staffName: row.staffName,
    staffId: row.staffId,
    mdaId: row.mdaId,
    mdaName: row.mdaName ?? '',
    auditTrail: auditEntries.map((a) => ({
      action: a.action,
      userId: a.userId ?? '',
      userName: a.email ?? 'System',
      timestamp: a.timestamp.toISOString(),
      details: a.resource,
    })),
  };
}

// ─── Resolve Exception (AC 5) ──────────────────────────────────────

export async function resolveException(
  exceptionId: string,
  userId: string,
  mdaScope: string | null,
  input: { resolutionNote: string; actionTaken: string },
): Promise<{ id: string; status: string }> {
  const [exc] = await db
    .select({
      id: exceptions.id,
      status: exceptions.status,
      mdaId: exceptions.mdaId,
      observationId: exceptions.observationId,
    })
    .from(exceptions)
    .where(eq(exceptions.id, exceptionId))
    .limit(1);

  if (!exc) {
    throw new AppError(404, 'EXCEPTION_NOT_FOUND', VOCABULARY.EXCEPTION_NOT_FOUND);
  }

  if (exc.status === 'resolved') {
    throw new AppError(400, 'EXCEPTION_ALREADY_RESOLVED', VOCABULARY.EXCEPTION_ALREADY_RESOLVED);
  }

  // Enforce MDA scoping
  if (mdaScope && exc.mdaId !== mdaScope) {
    throw new AppError(403, 'MDA_SCOPE_VIOLATION', 'You do not have access to this exception');
  }

  return withTransaction(async (tx) => {
    const now = new Date();

    // Update exception
    await tx
      .update(exceptions)
      .set({
        status: 'resolved',
        resolvedBy: userId,
        resolvedAt: now,
        resolutionNote: input.resolutionNote,
        actionTaken: input.actionTaken,
        updatedAt: now,
      })
      .where(eq(exceptions.id, exceptionId));

    // Also resolve the linked observation
    await tx
      .update(observations)
      .set({
        status: 'resolved',
        resolvedBy: userId,
        resolvedAt: now,
        resolutionNote: input.resolutionNote,
        updatedAt: now,
      })
      .where(eq(observations.id, exc.observationId));

    return { id: exceptionId, status: 'resolved' };
  });
}

// ─── Exception Counts (AC 7) ───────────────────────────────────────

export async function getExceptionCounts(
  mdaScope: string | null,
): Promise<ExceptionCounts> {
  const conditions: (ReturnType<typeof eq> | undefined)[] = [
    eq(exceptions.status, 'open'),
  ];

  const scopeCondition = withMdaScope(exceptions.mdaId, mdaScope);
  if (scopeCondition) conditions.push(scopeCondition);

  const whereClause = and(...conditions.filter(Boolean));

  const rows = await db
    .select({
      priority: exceptions.priority,
      cnt: count(),
    })
    .from(exceptions)
    .where(whereClause)
    .groupBy(exceptions.priority);

  const result: ExceptionCounts = { high: 0, medium: 0, low: 0, total: 0 };
  for (const row of rows) {
    const key = row.priority as keyof Omit<ExceptionCounts, 'total'>;
    result[key] = row.cnt;
    result.total += row.cnt;
  }

  return result;
}
