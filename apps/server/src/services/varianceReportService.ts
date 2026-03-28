/**
 * varianceReportService — Composition layer for Variance Report (Story 6.2, FR39).
 *
 * Orchestrates existing services:
 *   comparisonEngine (declared vs computed), loanClassificationService (classification enums).
 * Enhanced sections (OVERDUE, STALLED, OVER_DEDUCTED) compute duration info locally.
 */

import Decimal from 'decimal.js';
import { eq, and, inArray, desc } from 'drizzle-orm';
import { addMonths, differenceInMonths } from 'date-fns';
import { db } from '../db';
import { loans, ledgerEntries, mdaSubmissions } from '../db/schema';
import { compareSubmission } from './comparisonEngine';
import { classifyAllLoans, LoanClassification } from './loanClassificationService';
import { computeBalanceFromEntries } from './computationEngine';
import { withMdaScope } from '../lib/mdaScope';
import type {
  VarianceReportData,
  VarianceReportRow,
  OverdueRegisterRow,
  StalledRegisterRow,
  OverDeductedRegisterRow,
  LedgerEntryForBalance,
} from '@vlprs/shared';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// FR26 Clean threshold — same as loanClassificationService
const STALL_TOLERANCE = new Decimal('1');

// ─── Severity tier boundaries (AC3) ────────────────────────────

export function overdueSeverityTier(monthsPast: number): 'Mild' | 'Moderate' | 'Elevated' {
  if (monthsPast <= 6) return 'Mild';
  if (monthsPast <= 18) return 'Moderate';
  return 'Elevated';
}

// ─── Stall counting helper (AC3) ───────────────────────────────

interface LedgerEntryWithPeriod extends LedgerEntryForBalance {
  periodMonth: number;
  periodYear: number;
}

/**
 * Count consecutive unchanged months from newest period backward.
 * A month is "unchanged" if the balance movement < ₦1 (STALL_TOLERANCE).
 */
function computeConsecutiveUnchangedMonths(entries: LedgerEntryWithPeriod[]): number {
  if (entries.length < 2) return 0;

  // Sort entries by period (year, month)
  const sorted = [...entries].sort((a, b) => {
    if (a.periodYear !== b.periodYear) return a.periodYear - b.periodYear;
    return a.periodMonth - b.periodMonth;
  });

  // Compute running balance after each entry
  let runningBalance = new Decimal('0');
  const balances: Decimal[] = [runningBalance];

  for (const entry of sorted) {
    runningBalance = runningBalance.plus(new Decimal(entry.amount));
    balances.push(runningBalance);
  }

  // Count consecutive near-identical balances from the end
  let count = 0;
  for (let i = balances.length - 1; i >= 2; i--) {
    const movement = balances[i].minus(balances[i - 1]).abs();
    if (movement.lt(STALL_TOLERANCE)) {
      count++;
    } else {
      break;
    }
  }

  return count;
}

// ─── Main report generator ─────────────────────────────────────

export async function generateVarianceReport(
  mdaId: string | null,
  mdaScope: string | null,
  periodYear?: number,
  periodMonth?: number,
): Promise<VarianceReportData> {
  // 1. Find submissions for the target MDA and period
  const submissionConditions = [];
  if (mdaId) {
    submissionConditions.push(eq(mdaSubmissions.mdaId, mdaId));
  }
  const scopeCondition = withMdaScope(mdaSubmissions.mdaId, mdaScope);
  if (scopeCondition) submissionConditions.push(scopeCondition);

  if (periodYear && periodMonth) {
    const period = `${periodYear}-${String(periodMonth).padStart(2, '0')}`;
    submissionConditions.push(eq(mdaSubmissions.period, period));
  }

  submissionConditions.push(eq(mdaSubmissions.status, 'confirmed'));

  const submissions = await db
    .select({ id: mdaSubmissions.id, mdaId: mdaSubmissions.mdaId })
    .from(mdaSubmissions)
    .where(and(...submissionConditions))
    .orderBy(desc(mdaSubmissions.createdAt));

  // 2. If no period specified, use latest period with submissions
  let filteredSubmissions = submissions;
  if (!periodYear && !periodMonth && submissions.length > 0) {
    // Use the found submissions as-is (latest confirmed)
    filteredSubmissions = submissions;
  }

  // 3. Run comparison for each submission
  let totalAligned = 0;
  let totalMinorVariance = 0;
  let totalVariance = 0;
  let totalRecords = 0;
  const allRows: VarianceReportRow[] = [];

  for (const sub of filteredSubmissions) {
    const { summary } = await compareSubmission(sub.id, mdaScope);
    totalAligned += summary.alignedCount;
    totalMinorVariance += summary.minorVarianceCount;
    totalVariance += summary.varianceCount;
    totalRecords += summary.totalRecords;

    // ComparisonRow → VarianceReportRow (add staffName lookup below)
    for (const row of summary.rows) {
      allRows.push({
        staffId: row.staffId,
        staffName: '', // enriched below
        declaredAmount: row.declaredAmount,
        computedAmount: row.expectedAmount,
        difference: row.difference,
        category: row.category,
        explanation: row.explanation,
      });
    }
  }

  // 4. Enrich rows with staffName from loans table
  const uniqueStaffIds = [...new Set(allRows.map((r) => r.staffId))];
  if (uniqueStaffIds.length > 0) {
    const staffNames = await db
      .select({ staffId: loans.staffId, staffName: loans.staffName })
      .from(loans)
      .where(inArray(loans.staffId, uniqueStaffIds));

    const nameMap = new Map<string, string>();
    for (const s of staffNames) {
      if (!nameMap.has(s.staffId)) {
        nameMap.set(s.staffId, s.staffName);
      }
    }

    for (const row of allRows) {
      row.staffName = nameMap.get(row.staffId) ?? row.staffId;
    }
  }

  // 5. Enhanced classification sections
  const [overdueRegister, stalledRegister, overDeductedRegister] =
    await buildEnhancedSections(mdaId, mdaScope);

  return {
    summary: {
      alignedCount: totalAligned,
      minorVarianceCount: totalMinorVariance,
      varianceCount: totalVariance,
      totalRecords,
    },
    rows: allRows,
    overdueRegister,
    stalledRegister,
    overDeductedRegister,
    generatedAt: new Date().toISOString(),
  };
}

// ─── Enhanced sections builder ─────────────────────────────────

async function buildEnhancedSections(
  mdaId: string | null,
  mdaScope: string | null,
): Promise<[OverdueRegisterRow[], StalledRegisterRow[], OverDeductedRegisterRow[]]> {
  const classifications = await classifyAllLoans(mdaScope);

  if (classifications.size === 0) return [[], [], []];

  // Collect loan IDs by classification
  const overdueIds: string[] = [];
  const stalledIds: string[] = [];
  const overDeductedIds: string[] = [];

  for (const [loanId, classification] of classifications) {
    switch (classification) {
      case LoanClassification.OVERDUE:
        overdueIds.push(loanId);
        break;
      case LoanClassification.STALLED:
        stalledIds.push(loanId);
        break;
      case LoanClassification.OVER_DEDUCTED:
        overDeductedIds.push(loanId);
        break;
    }
  }

  const allNeededIds = [...overdueIds, ...stalledIds, ...overDeductedIds];
  if (allNeededIds.length === 0) return [[], [], []];

  // Batch-fetch loan data for all needed loans
  const loanConditions = [inArray(loans.id, allNeededIds)];
  if (mdaId) loanConditions.push(eq(loans.mdaId, mdaId));
  const mdaScopeCondition = withMdaScope(loans.mdaId, mdaScope);
  if (mdaScopeCondition) loanConditions.push(mdaScopeCondition);

  const loanRows = await db
    .select({
      id: loans.id,
      staffId: loans.staffId,
      staffName: loans.staffName,
      principalAmount: loans.principalAmount,
      interestRate: loans.interestRate,
      tenureMonths: loans.tenureMonths,
      moratoriumMonths: loans.moratoriumMonths,
      monthlyDeductionAmount: loans.monthlyDeductionAmount,
      firstDeductionDate: loans.firstDeductionDate,
      limitedComputation: loans.limitedComputation,
    })
    .from(loans)
    .where(and(...loanConditions));

  const loanMap = new Map(loanRows.map((l) => [l.id, l]));

  // Filter IDs to only those matching the MDA filter
  const filteredOverdueIds = overdueIds.filter((id) => loanMap.has(id));
  const filteredStalledIds = stalledIds.filter((id) => loanMap.has(id));
  const filteredOverDeductedIds = overDeductedIds.filter((id) => loanMap.has(id));

  const filteredAllIds = [...filteredOverdueIds, ...filteredStalledIds, ...filteredOverDeductedIds];
  if (filteredAllIds.length === 0) return [[], [], []];

  // Batch-fetch ledger entries for balance/stall computation
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
    .where(inArray(ledgerEntries.loanId, filteredAllIds));

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

  // Build OVERDUE register
  const overdueRegister: OverdueRegisterRow[] = filteredOverdueIds.map((id) => {
    const loan = loanMap.get(id)!;
    const entries = entriesByLoan.get(id) ?? [];
    const balance = computeBalanceFromEntries(
      loan.principalAmount, loan.interestRate, loan.tenureMonths, entries, null,
    );
    const expectedCompletion = addMonths(new Date(loan.firstDeductionDate), loan.tenureMonths);
    const monthsPast = Math.max(0, differenceInMonths(new Date(), expectedCompletion));
    return {
      staffName: loan.staffName,
      staffId: loan.staffId,
      loanId: id,
      monthsPastExpected: monthsPast,
      outstandingBalance: balance.computedBalance,
      severityTier: overdueSeverityTier(monthsPast),
    };
  });

  // Build STALLED register
  const stalledRegister: StalledRegisterRow[] = filteredStalledIds.map((id) => {
    const loan = loanMap.get(id)!;
    const entries = entriesByLoan.get(id) ?? [];
    const balance = computeBalanceFromEntries(
      loan.principalAmount, loan.interestRate, loan.tenureMonths, entries, null,
    );
    const unchangedMonths = computeConsecutiveUnchangedMonths(entries);
    return {
      staffName: loan.staffName,
      staffId: loan.staffId,
      loanId: id,
      consecutiveUnchangedMonths: unchangedMonths,
      frozenAmount: balance.computedBalance,
    };
  });

  // Build OVER_DEDUCTED register
  const overDeductedRegister: OverDeductedRegisterRow[] = filteredOverDeductedIds.map((id) => {
    const loan = loanMap.get(id)!;
    const entries = entriesByLoan.get(id) ?? [];
    const balance = computeBalanceFromEntries(
      loan.principalAmount, loan.interestRate, loan.tenureMonths, entries, null,
    );
    const negativeBalance = new Decimal(balance.computedBalance).abs();
    const monthlyDeduction = new Decimal(loan.monthlyDeductionAmount);
    const estimatedOverMonths = monthlyDeduction.gt(0)
      ? negativeBalance.div(monthlyDeduction).ceil().toNumber()
      : 0;
    return {
      staffName: loan.staffName,
      staffId: loan.staffId,
      loanId: id,
      negativeAmount: negativeBalance.toFixed(2),
      estimatedOverMonths,
    };
  });

  return [overdueRegister, stalledRegister, overDeductedRegister];
}
