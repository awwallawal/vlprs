import Decimal from 'decimal.js';
import { addMonths } from 'date-fns';
import { db } from '../db';
import { loans, ledgerEntries } from '../db/schema';
import { eq, and, gte, count, inArray } from 'drizzle-orm';
import { computeBalanceFromEntries } from './computationEngine';
import { withMdaScope } from '../lib/mdaScope';
import type { LedgerEntryForBalance } from '@vlprs/shared';

// Configure decimal.js for financial precision (matches computationEngine)
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// FR26 Clean threshold: balance movement < ₦1 is sub-kobo rounding noise
export const STALL_TOLERANCE = new Decimal('1');

export enum LoanClassification {
  COMPLETED = 'COMPLETED',
  ON_TRACK = 'ON_TRACK',
  OVERDUE = 'OVERDUE',
  STALLED = 'STALLED',
  OVER_DEDUCTED = 'OVER_DEDUCTED',
}

// ─── Interfaces ────────────────────────────────────────────────────

interface LoanForClassification {
  status: string;
  principalAmount: string;
  interestRate: string;
  tenureMonths: number;
  moratoriumMonths: number;
  firstDeductionDate: string;
}

interface LedgerEntryWithPeriod extends LedgerEntryForBalance {
  periodMonth?: number;
  periodYear?: number;
}

// ─── Pure Functions (no DB, no side effects) ───────────────────────

/**
 * Detect stalled balance: 2+ consecutive periods where balance movement < ₦1.
 * Uses FR26 Clean threshold to avoid false stall classifications from
 * sub-kobo decimal arithmetic artifacts.
 */
function hasConsecutiveNearIdenticalBalances(
  entries: LedgerEntryWithPeriod[],
  requiredConsecutive: number = 2,
): boolean {
  if (entries.length < requiredConsecutive + 1) return false;

  // Sort entries by period (year, month) if available
  const sorted = [...entries].sort((a, b) => {
    const yearA = a.periodYear ?? 0;
    const yearB = b.periodYear ?? 0;
    if (yearA !== yearB) return yearA - yearB;
    return (a.periodMonth ?? 0) - (b.periodMonth ?? 0);
  });

  // Compute running balance after each entry
  let runningBalance = new Decimal('0');
  const balances: Decimal[] = [runningBalance];

  for (const entry of sorted) {
    runningBalance = runningBalance.plus(new Decimal(entry.amount));
    balances.push(runningBalance);
  }

  // Check consecutive pairs for near-identical balance movement
  let consecutiveCount = 0;
  for (let i = 2; i < balances.length; i++) {
    const movement = balances[i].minus(balances[i - 1]).abs();
    if (movement.lt(STALL_TOLERANCE)) {
      consecutiveCount++;
      if (consecutiveCount >= requiredConsecutive) return true;
    } else {
      consecutiveCount = 0;
    }
  }

  return false;
}

/**
 * Classify a single loan based on its status, ledger entries, and accountability window.
 *
 * Priority order:
 * 1. COMPLETED (status check)
 * 2. OVER_DEDUCTED (balance < 0)
 * 3. OVERDUE (past accountability deadline with positive balance)
 * 4. STALLED (2+ consecutive months with < ₦1 balance movement)
 * 5. ON_TRACK (default)
 */
export function classifyLoan(
  loan: LoanForClassification,
  ledgerEntriesData: LedgerEntryWithPeriod[],
  windowMonths: number = 60,
): LoanClassification {
  // 1. COMPLETED takes highest priority
  if (loan.status === 'COMPLETED') {
    return LoanClassification.COMPLETED;
  }

  // Compute outstanding balance
  const balanceResult = computeBalanceFromEntries(
    loan.principalAmount,
    loan.interestRate,
    loan.tenureMonths,
    ledgerEntriesData,
    null,
  );

  const outstandingBalance = new Decimal(balanceResult.computedBalance);

  // 2. OVER_DEDUCTED: balance < 0
  if (outstandingBalance.lt(0)) {
    return LoanClassification.OVER_DEDUCTED;
  }

  // 3. OVERDUE: past accountability deadline with positive balance
  const firstDeductionDate = new Date(loan.firstDeductionDate);
  const expectedCompletionDate = addMonths(firstDeductionDate, loan.tenureMonths);
  const accountabilityDeadline = addMonths(expectedCompletionDate, windowMonths);
  const now = new Date();

  if (now > accountabilityDeadline && outstandingBalance.gt(0)) {
    return LoanClassification.OVERDUE;
  }

  // 4. STALLED: 2+ consecutive months with < ₦1 balance movement
  if (hasConsecutiveNearIdenticalBalances(ledgerEntriesData, 2)) {
    return LoanClassification.STALLED;
  }

  // 5. Default: ON_TRACK
  return LoanClassification.ON_TRACK;
}

// ─── DB-Backed Functions (orchestration layer) ─────────────────────

/**
 * Bulk classify all loans with firstDeductionDate within the accountability window.
 */
export async function classifyAllLoans(
  mdaScope?: string | null,
  windowMonths: number = 60,
): Promise<Map<string, LoanClassification>> {
  const windowStart = addMonths(new Date(), -windowMonths);

  const conditions = [
    gte(loans.firstDeductionDate, windowStart),
  ];
  const scopeCondition = withMdaScope(loans.mdaId, mdaScope);
  if (scopeCondition) conditions.push(scopeCondition);

  const loanRows = await db
    .select({
      id: loans.id,
      status: loans.status,
      principalAmount: loans.principalAmount,
      interestRate: loans.interestRate,
      tenureMonths: loans.tenureMonths,
      moratoriumMonths: loans.moratoriumMonths,
      firstDeductionDate: loans.firstDeductionDate,
    })
    .from(loans)
    .where(and(...conditions));

  if (loanRows.length === 0) return new Map();

  // Batch-fetch all ledger entries for these loans
  const loanIds = loanRows.map((l) => l.id);
  const allEntries = await db
    .select({
      loanId: ledgerEntries.loanId,
      amount: ledgerEntries.amount,
      principalComponent: ledgerEntries.principalComponent,
      interestComponent: ledgerEntries.interestComponent,
      entryType: ledgerEntries.entryType,
      periodMonth: ledgerEntries.periodMonth,
      periodYear: ledgerEntries.periodYear,
    })
    .from(ledgerEntries)
    .where(inArray(ledgerEntries.loanId, loanIds));

  // Group entries by loanId
  const entriesByLoan = new Map<string, LedgerEntryWithPeriod[]>();
  for (const entry of allEntries) {
    const existing = entriesByLoan.get(entry.loanId) ?? [];
    existing.push({
      amount: entry.amount,
      principalComponent: entry.principalComponent,
      interestComponent: entry.interestComponent,
      entryType: entry.entryType,
      periodMonth: entry.periodMonth,
      periodYear: entry.periodYear,
    });
    entriesByLoan.set(entry.loanId, existing);
  }

  // Classify each loan
  const results = new Map<string, LoanClassification>();
  for (const loan of loanRows) {
    const entries = entriesByLoan.get(loan.id) ?? [];
    const classification = classifyLoan(
      {
        status: loan.status,
        principalAmount: loan.principalAmount,
        interestRate: loan.interestRate,
        tenureMonths: loan.tenureMonths,
        moratoriumMonths: loan.moratoriumMonths,
        firstDeductionDate:
          loan.firstDeductionDate instanceof Date
            ? loan.firstDeductionDate.toISOString()
            : String(loan.firstDeductionDate),
      },
      entries,
      windowMonths,
    );
    results.set(loan.id, classification);
  }

  return results;
}

/**
 * Sum outstanding balances of OVERDUE + STALLED loans.
 */
export async function getAtRiskAmount(
  mdaScope?: string | null,
): Promise<string> {
  const classifications = await classifyAllLoans(mdaScope);
  let total = new Decimal('0');

  // We need the actual balances — re-fetch loan data for at-risk loans
  const atRiskIds: string[] = [];
  for (const [loanId, classification] of classifications) {
    if (
      classification === LoanClassification.OVERDUE ||
      classification === LoanClassification.STALLED
    ) {
      atRiskIds.push(loanId);
    }
  }

  if (atRiskIds.length === 0) return '0.00';

  // Batch-compute balances for at-risk loans
  const atRiskLoans = await db
    .select({
      id: loans.id,
      principalAmount: loans.principalAmount,
      interestRate: loans.interestRate,
      tenureMonths: loans.tenureMonths,
    })
    .from(loans)
    .where(inArray(loans.id, atRiskIds));

  const atRiskEntries = await db
    .select({
      loanId: ledgerEntries.loanId,
      amount: ledgerEntries.amount,
      principalComponent: ledgerEntries.principalComponent,
      interestComponent: ledgerEntries.interestComponent,
      entryType: ledgerEntries.entryType,
    })
    .from(ledgerEntries)
    .where(inArray(ledgerEntries.loanId, atRiskIds));

  const entriesMap = new Map<string, LedgerEntryForBalance[]>();
  for (const entry of atRiskEntries) {
    const existing = entriesMap.get(entry.loanId) ?? [];
    existing.push(entry);
    entriesMap.set(entry.loanId, existing);
  }

  for (const loan of atRiskLoans) {
    const entries = entriesMap.get(loan.id) ?? [];
    const balance = computeBalanceFromEntries(
      loan.principalAmount,
      loan.interestRate,
      loan.tenureMonths,
      entries,
      null,
    );
    const bal = new Decimal(balance.computedBalance);
    if (bal.gt(0)) total = total.plus(bal);
  }

  return total.toFixed(2);
}

/**
 * Completion rate within rolling window: COMPLETED / total in window.
 */
export async function getLoanCompletionRate(
  mdaScope?: string | null,
  windowMonths: number = 60,
): Promise<number> {
  const classifications = await classifyAllLoans(mdaScope, windowMonths);
  if (classifications.size === 0) return 0;

  let completedCount = 0;
  for (const classification of classifications.values()) {
    if (classification === LoanClassification.COMPLETED) completedCount++;
  }

  return Number(
    new Decimal(completedCount)
      .div(classifications.size)
      .mul(100)
      .toDecimalPlaces(1, Decimal.ROUND_HALF_UP)
      .toNumber(),
  );
}

/**
 * All-time completion rate: COMPLETED / total loans ever created.
 */
export async function getLoanCompletionRateLifetime(
  mdaScope?: string | null,
): Promise<number> {
  const conditions = [];
  const scopeCondition = withMdaScope(loans.mdaId, mdaScope);
  if (scopeCondition) conditions.push(scopeCondition);

  const [totalResult] = await db
    .select({ value: count() })
    .from(loans)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  const completedConditions = [eq(loans.status, 'COMPLETED')];
  if (scopeCondition) completedConditions.push(scopeCondition);

  const [completedResult] = await db
    .select({ value: count() })
    .from(loans)
    .where(and(...completedConditions));

  const total = totalResult?.value ?? 0;
  if (total === 0) return 0;

  return Number(
    new Decimal(completedResult?.value ?? 0)
      .div(total)
      .mul(100)
      .toDecimalPlaces(1, Decimal.ROUND_HALF_UP)
      .toNumber(),
  );
}

/**
 * Count of all loans with firstDeductionDate within the accountability window.
 * Includes all statuses and lifecycle paths (Full Tenure, Accelerated, Lump Sum, Retirement Split).
 */
export async function getLoansInWindow(
  mdaScope?: string | null,
  windowMonths: number = 60,
): Promise<number> {
  const windowStart = addMonths(new Date(), -windowMonths);

  const conditions = [
    gte(loans.firstDeductionDate, windowStart),
  ];
  const scopeCondition = withMdaScope(loans.mdaId, mdaScope);
  if (scopeCondition) conditions.push(scopeCondition);

  const [result] = await db
    .select({ value: count() })
    .from(loans)
    .where(and(...conditions));

  return result?.value ?? 0;
}
