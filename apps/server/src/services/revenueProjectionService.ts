import Decimal from 'decimal.js';
import { db } from '../db';
import { loans, ledgerEntries } from '../db/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { computeBalanceFromEntries } from './computationEngine';
import { withMdaScope } from '../lib/mdaScope';
import { classifyAllLoans, LoanClassification } from './loanClassificationService';
import type { LedgerEntryForBalance } from '@vlprs/shared';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/**
 * Sum of monthlyDeductionAmount for all ACTIVE loans.
 * This is the theoretical expected monthly if all MDAs submit correctly.
 */
export async function getMonthlyCollectionPotential(
  mdaScope?: string | null,
): Promise<string> {
  const conditions = [eq(loans.status, 'ACTIVE')];
  const scopeCondition = withMdaScope(loans.mdaId, mdaScope);
  if (scopeCondition) conditions.push(scopeCondition);

  const [result] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${loans.monthlyDeductionAmount}), '0.00')`,
    })
    .from(loans)
    .where(and(...conditions));

  return new Decimal(result?.total ?? '0').toFixed(2);
}

/**
 * Sum of outstanding balances across ACTIVE + OVERDUE + STALLED loans.
 * Uses loan classification service to identify qualifying loans,
 * then batch-computes balances via computeBalanceFromEntries.
 */
export async function getTotalOutstandingReceivables(
  mdaScope?: string | null,
): Promise<string> {
  const classifications = await classifyAllLoans(mdaScope);
  const qualifyingIds: string[] = [];

  for (const [loanId, classification] of classifications) {
    if (
      classification === LoanClassification.ON_TRACK ||
      classification === LoanClassification.OVERDUE ||
      classification === LoanClassification.STALLED
    ) {
      qualifyingIds.push(loanId);
    }
  }

  // Also include ACTIVE loans not in the classification window
  const scopeCondition = withMdaScope(loans.mdaId, mdaScope);
  const activeConditions = [eq(loans.status, 'ACTIVE')];
  if (scopeCondition) activeConditions.push(scopeCondition);

  const activeLoans = await db
    .select({ id: loans.id })
    .from(loans)
    .where(and(...activeConditions));

  for (const loan of activeLoans) {
    if (!qualifyingIds.includes(loan.id)) {
      qualifyingIds.push(loan.id);
    }
  }

  if (qualifyingIds.length === 0) return '0.00';

  // Batch-fetch loans and entries
  const loanRows = await db
    .select({
      id: loans.id,
      principalAmount: loans.principalAmount,
      interestRate: loans.interestRate,
      tenureMonths: loans.tenureMonths,
    })
    .from(loans)
    .where(inArray(loans.id, qualifyingIds));

  const allEntries = await db
    .select({
      loanId: ledgerEntries.loanId,
      amount: ledgerEntries.amount,
      principalComponent: ledgerEntries.principalComponent,
      interestComponent: ledgerEntries.interestComponent,
      entryType: ledgerEntries.entryType,
    })
    .from(ledgerEntries)
    .where(inArray(ledgerEntries.loanId, qualifyingIds));

  const entriesMap = new Map<string, LedgerEntryForBalance[]>();
  for (const entry of allEntries) {
    const existing = entriesMap.get(entry.loanId) ?? [];
    existing.push(entry);
    entriesMap.set(entry.loanId, existing);
  }

  let total = new Decimal('0');
  for (const loan of loanRows) {
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
 * Sum of actual deduction amounts from ledger_entries for the last completed submission period.
 * Returns the most recent PAYROLL period with its amount.
 */
export async function getActualMonthlyRecovery(
  mdaScope?: string | null,
): Promise<{ amount: string; periodMonth: number; periodYear: number }> {
  const conditions = [eq(ledgerEntries.entryType, 'PAYROLL')];
  const scopeCondition = withMdaScope(ledgerEntries.mdaId, mdaScope);
  if (scopeCondition) conditions.push(scopeCondition);

  const [result] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${ledgerEntries.amount}), '0.00')`,
      periodMonth: ledgerEntries.periodMonth,
      periodYear: ledgerEntries.periodYear,
    })
    .from(ledgerEntries)
    .where(and(...conditions))
    .groupBy(ledgerEntries.periodMonth, ledgerEntries.periodYear)
    .orderBy(
      sql`${ledgerEntries.periodYear} DESC`,
      sql`${ledgerEntries.periodMonth} DESC`,
    )
    .limit(1);

  return {
    amount: new Decimal(result?.total ?? '0').toFixed(2),
    periodMonth: result?.periodMonth ?? 0,
    periodYear: result?.periodYear ?? 0,
  };
}
