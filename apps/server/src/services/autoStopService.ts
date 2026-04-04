/**
 * Auto-Stop Detection Service (Story 8.1)
 *
 * Two complementary mechanisms detect loan completion:
 * 1. Inline trigger — called after each ledger entry insertion
 * 2. Background scan — runs every 6 hours for batch/catch-up detection
 *
 * Transaction scope: the inline trigger runs OUTSIDE the ledger entry transaction
 * (the entry must be committed before balance is checked).
 */

import Decimal from 'decimal.js';
import { db } from '../db';
import { loans, ledgerEntries, loanCompletions, observations, submissionRows, users } from '../db/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { ledgerDb } from '../db/immutable';
import { computeBalanceForLoan } from './computationEngine';
import { transitionLoan } from './loanTransitionService';
import { generateUuidv7 } from '../lib/uuidv7';
import { logger } from '../lib/logger';
import { env } from '../config/env';
import type { BalanceResult } from '@vlprs/shared';

// ─── Types ──────────────────────────────────────────────────────────

export interface AutoStopResult {
  loanId: string;
  staffName: string;
  staffId: string;
  mdaId: string;
  completionDate: string;
  finalBalance: string;
  totalPaid: string;
  totalPrincipalPaid: string;
  totalInterestPaid: string;
  triggerSource: 'ledger_entry' | 'background_scan' | 'manual';
}

// ─── System User Lookup (same pattern as inactiveLoanDetector) ──────

let cachedSystemUserId: string | null = null;

async function getSystemUserId(): Promise<string | null> {
  if (cachedSystemUserId) return cachedSystemUserId;

  // Try to find a system user by email
  const [systemUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, 'system@vlprs.local'))
    .limit(1);

  if (systemUser) {
    cachedSystemUserId = systemUser.id;
    return cachedSystemUserId;
  }

  // Fallback: first SUPER_ADMIN user
  const [admin] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, 'super_admin'))
    .limit(1);

  if (admin) {
    cachedSystemUserId = admin.id;
    return cachedSystemUserId;
  }

  return null;
}

// ─── Core Detection: Batch Scan (Task 2) ────────────────────────────

/**
 * Detect active loans with zero or negative balance and trigger auto-stop.
 * Uses a fast SQL pre-filter, then verifies each candidate with computeBalanceForLoan().
 */
export async function detectAndTriggerAutoStop(
  options?: { triggerSource?: 'ledger_entry' | 'background_scan' | 'manual' },
): Promise<AutoStopResult[]> {
  const triggerSource = options?.triggerSource ?? 'background_scan';

  const systemUserId = await getSystemUserId();
  if (!systemUserId) {
    logger.warn('Auto-stop: no system user available — skipping detection');
    return [];
  }

  // Fast SQL pre-filter: find ACTIVE loans where sum(ledger) >= totalLoan
  // Excludes limitedComputation loans (AC: 7)
  const candidates = await db
    .select({
      id: loans.id,
      staffName: loans.staffName,
      staffId: loans.staffId,
      mdaId: loans.mdaId,
      principalAmount: loans.principalAmount,
      interestRate: loans.interestRate,
      tenureMonths: loans.tenureMonths,
      limitedComputation: loans.limitedComputation,
      totalPaid: sql<string>`COALESCE(SUM(${ledgerEntries.amount}), '0')`,
    })
    .from(loans)
    .leftJoin(ledgerEntries, eq(ledgerEntries.loanId, loans.id))
    .where(
      and(
        eq(loans.status, 'ACTIVE'),
        eq(loans.limitedComputation, false),
      ),
    )
    .groupBy(loans.id)
    .having(
      sql`(${loans.principalAmount} + ${loans.principalAmount} * ${loans.interestRate} / 100) - COALESCE(SUM(${ledgerEntries.amount}), 0) <= 0`,
    );

  if (candidates.length === 0) return [];

  const results: AutoStopResult[] = [];

  for (const candidate of candidates) {
    try {
      // Verify with computeBalanceForLoan() for precision (handles edge cases)
      const entries = await ledgerDb.selectByLoan(candidate.id);
      const balance: BalanceResult = computeBalanceForLoan({
        limitedComputation: false,
        principalAmount: candidate.principalAmount,
        interestRate: candidate.interestRate,
        tenureMonths: candidate.tenureMonths,
        entries,
        asOfDate: null,
      });

      // computeBalanceFromEntries does NOT clamp — balance can be negative
      if (new Decimal(balance.computedBalance).lte(0)) {
        const now = new Date();
        const reason = triggerSource === 'background_scan'
          ? 'Auto-stop: zero balance detected (background scan)'
          : `Auto-stop: zero balance detected (${triggerSource})`;

        // Transition loan to COMPLETED
        await transitionLoan(systemUserId, candidate.id, 'COMPLETED', reason, null);

        // Insert loan_completions record
        await db.insert(loanCompletions).values({
          id: generateUuidv7(),
          loanId: candidate.id,
          completionDate: now,
          finalBalance: balance.computedBalance,
          totalPaid: balance.totalAmountPaid,
          totalPrincipalPaid: balance.totalPrincipalPaid,
          totalInterestPaid: balance.totalInterestPaid,
          triggerSource,
        });

        logger.info(
          { loanId: candidate.id, staffName: candidate.staffName, finalBalance: balance.computedBalance, totalPaid: balance.totalAmountPaid },
          'Auto-stop triggered',
        );

        results.push({
          loanId: candidate.id,
          staffName: candidate.staffName,
          staffId: candidate.staffId,
          mdaId: candidate.mdaId,
          completionDate: now.toISOString(),
          finalBalance: balance.computedBalance,
          totalPaid: balance.totalAmountPaid,
          totalPrincipalPaid: balance.totalPrincipalPaid,
          totalInterestPaid: balance.totalInterestPaid,
          triggerSource,
        });
      }
    } catch (err) {
      // AC: 2.5 — if transitionLoan fails (e.g., loan already completed by concurrent process),
      // catch and log, don't fail the batch
      logger.error({ err, loanId: candidate.id }, 'Auto-stop: failed to process candidate');
    }
  }

  return results;
}

// ─── Inline Trigger: Single Loan Check (Task 3) ────────────────────

/**
 * Check a single loan for zero-balance and trigger auto-stop if applicable.
 * Called AFTER the ledger entry transaction commits (NOT inside the tx).
 */
export async function checkAndTriggerAutoStop(
  loanId: string,
  triggerLedgerEntryId?: string,
): Promise<{ triggered: boolean; completionRecord?: AutoStopResult }> {
  try {
    // Fetch loan (verify status = ACTIVE, limitedComputation = false)
    const [loan] = await db
      .select({
        id: loans.id,
        staffName: loans.staffName,
        staffId: loans.staffId,
        mdaId: loans.mdaId,
        status: loans.status,
        principalAmount: loans.principalAmount,
        interestRate: loans.interestRate,
        tenureMonths: loans.tenureMonths,
        limitedComputation: loans.limitedComputation,
      })
      .from(loans)
      .where(eq(loans.id, loanId));

    if (!loan || loan.status !== 'ACTIVE' || loan.limitedComputation) {
      return { triggered: false };
    }

    const systemUserId = await getSystemUserId();
    if (!systemUserId) {
      logger.warn({ loanId }, 'Auto-stop inline: no system user available');
      return { triggered: false };
    }

    // Compute balance with full entry set
    const entries = await ledgerDb.selectByLoan(loanId);
    const balance = computeBalanceForLoan({
      limitedComputation: false,
      principalAmount: loan.principalAmount,
      interestRate: loan.interestRate,
      tenureMonths: loan.tenureMonths,
      entries,
      asOfDate: null,
    });

    if (new Decimal(balance.computedBalance).lte(0)) {
      const now = new Date();
      const reason = triggerLedgerEntryId
        ? `Auto-stop: zero balance detected (ledger entry ${triggerLedgerEntryId})`
        : 'Auto-stop: zero balance detected (ledger entry)';

      await transitionLoan(systemUserId, loanId, 'COMPLETED', reason, null);

      await db.insert(loanCompletions).values({
        id: generateUuidv7(),
        loanId,
        completionDate: now,
        finalBalance: balance.computedBalance,
        totalPaid: balance.totalAmountPaid,
        totalPrincipalPaid: balance.totalPrincipalPaid,
        totalInterestPaid: balance.totalInterestPaid,
        triggerSource: 'ledger_entry',
        triggerLedgerEntryId: triggerLedgerEntryId ?? null,
      });

      logger.info(
        { loanId, staffName: loan.staffName, finalBalance: balance.computedBalance, triggerLedgerEntryId },
        'Auto-stop triggered (inline)',
      );

      return {
        triggered: true,
        completionRecord: {
          loanId,
          staffName: loan.staffName,
          staffId: loan.staffId,
          mdaId: loan.mdaId,
          completionDate: now.toISOString(),
          finalBalance: balance.computedBalance,
          totalPaid: balance.totalAmountPaid,
          totalPrincipalPaid: balance.totalPrincipalPaid,
          totalInterestPaid: balance.totalInterestPaid,
          triggerSource: 'ledger_entry',
        },
      };
    }

    return { triggered: false };
  } catch (err) {
    // Never fail the caller — auto-stop is best-effort for inline triggers
    logger.error({ err, loanId }, 'Auto-stop inline check failed');
    return { triggered: false };
  }
}

// ─── Post-Completion Deduction Detection (Task 5) ──────────────────

/**
 * Detect deductions declared for staff whose loans are already COMPLETED.
 * Creates observations of type 'post_completion_deduction'.
 * Fire-and-forget from submission processing.
 */
export async function detectPostCompletionDeductions(
  submissionId: string,
): Promise<{ created: number }> {
  // Find submission rows where the matched loan (by staffId) is COMPLETED and amount > 0
  const rows = await db
    .select({
      rowId: submissionRows.id,
      staffId: submissionRows.staffId,
      month: submissionRows.month,
      amountDeducted: submissionRows.amountDeducted,
      loanId: loans.id,
      loanStatus: loans.status,
      staffName: loans.staffName,
      mdaId: loans.mdaId,
      loanReference: loans.loanReference,
      completionDate: loanCompletions.completionDate,
    })
    .from(submissionRows)
    .innerJoin(loans, eq(loans.staffId, submissionRows.staffId))
    .leftJoin(loanCompletions, eq(loanCompletions.loanId, loans.id))
    .where(
      and(
        eq(submissionRows.submissionId, submissionId),
        eq(loans.status, 'COMPLETED'),
        sql`${submissionRows.amountDeducted} > 0`,
      ),
    );

  if (rows.length === 0) return { created: 0 };

  // Deduplicate: one observation per (staffId, month) — avoids cartesian with multi-loan staff
  const seen = new Set<string>();
  const uniqueRows = rows.filter((row) => {
    const key = `${row.staffId}:${row.month}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Check for existing post-completion observations to prevent duplicates on reprocessing
  const staffIds = [...new Set(uniqueRows.map(r => r.staffId).filter(Boolean))] as string[];
  const existingObs = staffIds.length > 0 ? await db
    .select({ staffId: observations.staffId, context: observations.context })
    .from(observations)
    .where(
      and(
        eq(observations.type, 'post_completion_deduction'),
        inArray(observations.staffId, staffIds),
      ),
    ) : [];

  const existingKeys = new Set(
    existingObs.map(o => {
      const ctx = o.context as Record<string, Record<string, unknown>>;
      return `${o.staffId}:${ctx?.dataPoints?.period ?? ''}`;
    }),
  );

  const observationValues = uniqueRows
    .filter((row) => !existingKeys.has(`${row.staffId}:${row.month}`))
    .map((row) => ({
      id: generateUuidv7(),
      type: 'post_completion_deduction' as const,
      staffName: row.staffName,
      staffId: row.staffId,
      loanId: row.loanId,
      mdaId: row.mdaId,
      description: `Deduction of ₦${new Decimal(row.amountDeducted).toFixed(2)} declared for ${row.staffName} in ${row.month}, but loan was completed${row.completionDate ? ' on ' + row.completionDate.toISOString().split('T')[0] : ''}. This deduction should cease.`,
      context: {
        possibleExplanations: [
          'MDA may not have received the auto-stop notification yet',
          'Payroll deduction schedule may not have been updated',
        ],
        suggestedAction: 'Notify the MDA to cease deductions immediately. Issue Auto-Stop Certificate if not already generated.',
        dataCompleteness: 1.0,
        completenessNote: 'Cross-reference of submission row against loan completion record.',
        dataPoints: {
          amount: row.amountDeducted,
          period: row.month,
          completionDate: row.completionDate?.toISOString().split('T')[0] ?? null,
          loanReference: row.loanReference,
        },
      },
      sourceReference: { submissionId, submissionRowId: row.rowId },
    }));

  if (observationValues.length === 0) return { created: 0 };

  let created = 0;
  for (const obs of observationValues) {
    try {
      await db.insert(observations).values(obs);
      created++;
    } catch {
      // Constraint violation — skip silently
    }
  }

  if (created > 0) {
    logger.info({ submissionId, created }, 'Post-completion deductions detected');
  }

  return { created };
}

// ─── Background Scheduler (Task 4) ─────────────────────────────────

const SCHEDULER_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const SCHEDULER_STARTUP_DELAY_MS = 3 * 60 * 1000;  // 3 minutes

let intervalRef: ReturnType<typeof setInterval> | null = null;
let timeoutRef: ReturnType<typeof setTimeout> | null = null;

export function startAutoStopScheduler(): void {
  if (env.NODE_ENV === 'test') return;
  if (intervalRef || timeoutRef) return; // Already running

  timeoutRef = setTimeout(() => {
    timeoutRef = null;
    runAutoStopDetection();
    intervalRef = setInterval(runAutoStopDetection, SCHEDULER_INTERVAL_MS);
  }, SCHEDULER_STARTUP_DELAY_MS);
}

export function stopAutoStopScheduler(): void {
  if (timeoutRef) {
    clearTimeout(timeoutRef);
    timeoutRef = null;
  }
  if (intervalRef) {
    clearInterval(intervalRef);
    intervalRef = null;
  }
}

async function runAutoStopDetection(): Promise<void> {
  try {
    const results = await detectAndTriggerAutoStop({ triggerSource: 'background_scan' });
    logger.info({ completedCount: results.length }, 'Auto-stop background scan completed');
  } catch (err) {
    logger.error({ err }, 'Auto-stop background scan failed');
  }
}
