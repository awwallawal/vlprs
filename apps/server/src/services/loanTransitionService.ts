import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db/index';
import { loans, loanStateTransitions, users } from '../db/schema';
import { withMdaScope } from '../lib/mdaScope';
import { AppError } from '../lib/appError';
import { VOCABULARY, isValidTransition, VALID_TRANSITIONS } from '@vlprs/shared';
import type { LoanStatus, LoanStateTransition } from '@vlprs/shared';

// ─── transitionLoan ────────────────────────────────────────────────

export async function transitionLoan(
  userId: string,
  loanId: string,
  toStatus: LoanStatus,
  reason: string,
  mdaScope: string | null | undefined,
): Promise<LoanStateTransition> {
  return db.transaction(async (tx) => {
    // 1. Read current loan (with row lock) and acting user name concurrently
    const conditions = [eq(loans.id, loanId)];
    const scopeCondition = withMdaScope(loans.mdaId, mdaScope);
    if (scopeCondition) conditions.push(scopeCondition);

    const [loanRows, userRows] = await Promise.all([
      tx.select().from(loans).where(and(...conditions)).for('update'),
      tx.select({ firstName: users.firstName, lastName: users.lastName }).from(users).where(eq(users.id, userId)),
    ]);
    const [loan] = loanRows;
    const [user] = userRows;

    if (!loan) {
      // Distinguish 404 vs 403: check if loan exists at all
      if (mdaScope) {
        const [exists] = await tx.select({ id: loans.id }).from(loans).where(eq(loans.id, loanId));
        if (exists) {
          throw new AppError(403, 'MDA_ACCESS_DENIED', VOCABULARY.MDA_ACCESS_DENIED);
        }
      }
      throw new AppError(404, 'LOAN_NOT_FOUND', VOCABULARY.LOAN_NOT_FOUND);
    }

    // 3a. Self-transition guard
    if (loan.status === toStatus) {
      throw new AppError(400, 'LOAN_ALREADY_IN_STATUS', VOCABULARY.LOAN_ALREADY_IN_STATUS);
    }

    // 3b. Validate transition
    if (!isValidTransition(loan.status, toStatus)) {
      const allowed = VALID_TRANSITIONS[loan.status];
      const msg = allowed.length === 0
        ? VOCABULARY.TERMINAL_STATUS
        : VOCABULARY.INVALID_TRANSITION.replace('{allowed}', allowed.join(', '));
      throw new AppError(400, 'INVALID_TRANSITION', msg);
    }

    // 4. Update loan status
    await tx.update(loans)
      .set({ status: toStatus, updatedAt: new Date() })
      .where(eq(loans.id, loanId));

    // 5. Insert transition record
    const [record] = await tx.insert(loanStateTransitions).values({
      loanId,
      fromStatus: loan.status,
      toStatus,
      transitionedBy: userId,
      reason,
    }).returning();

    return {
      id: record.id,
      loanId: record.loanId,
      fromStatus: record.fromStatus,
      toStatus: record.toStatus,
      transitionedBy: record.transitionedBy,
      transitionedByName: user ? `${user.firstName} ${user.lastName}` : '',
      reason: record.reason,
      createdAt: record.createdAt.toISOString(),
    };
  });
}

// ─── getTransitionHistory ──────────────────────────────────────────

export async function getTransitionHistory(
  loanId: string,
  mdaScope: string | null | undefined,
): Promise<LoanStateTransition[]> {
  // Verify loan exists + MDA scope
  const conditions = [eq(loans.id, loanId)];
  const scopeCondition = withMdaScope(loans.mdaId, mdaScope);
  if (scopeCondition) conditions.push(scopeCondition);

  const [loan] = await db.select({ id: loans.id, mdaId: loans.mdaId })
    .from(loans)
    .where(and(...conditions));

  if (!loan) {
    if (mdaScope) {
      const [exists] = await db.select({ id: loans.id }).from(loans).where(eq(loans.id, loanId));
      if (exists) {
        throw new AppError(403, 'MDA_ACCESS_DENIED', VOCABULARY.MDA_ACCESS_DENIED);
      }
    }
    throw new AppError(404, 'LOAN_NOT_FOUND', VOCABULARY.LOAN_NOT_FOUND);
  }

  // Fetch transitions with user name JOIN
  const transitions = await db
    .select({
      id: loanStateTransitions.id,
      loanId: loanStateTransitions.loanId,
      fromStatus: loanStateTransitions.fromStatus,
      toStatus: loanStateTransitions.toStatus,
      transitionedBy: loanStateTransitions.transitionedBy,
      transitionedByName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
      reason: loanStateTransitions.reason,
      createdAt: loanStateTransitions.createdAt,
    })
    .from(loanStateTransitions)
    .innerJoin(users, eq(loanStateTransitions.transitionedBy, users.id))
    .where(eq(loanStateTransitions.loanId, loanId))
    .orderBy(loanStateTransitions.createdAt);

  return transitions.map((t) => ({
    id: t.id,
    loanId: t.loanId,
    fromStatus: t.fromStatus,
    toStatus: t.toStatus,
    transitionedBy: t.transitionedBy,
    transitionedByName: t.transitionedByName,
    reason: t.reason,
    createdAt: t.createdAt.toISOString(),
  }));
}
