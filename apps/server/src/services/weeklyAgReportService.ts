/**
 * weeklyAgReportService — Composition layer for Weekly AG Report (Story 6.3, FR41).
 *
 * Orchestrates existing services into a time-windowed report response.
 * New queries: compliance status, exceptions resolved, observation activity (date-range).
 * Reuses: attentionItemService, loanClassificationService, revenueProjectionService,
 *         schemeConfigService, computeBalanceForLoan.
 */

import Decimal from 'decimal.js';
import { subDays } from 'date-fns';
import { db } from '../db';
import { loans, ledgerEntries, mdas, mdaSubmissions, observations } from '../db/schema';
import { eq, and, sql, inArray, gte, lte } from 'drizzle-orm';
import { computeBalanceForLoan } from './computationEngine';
import { withMdaScope } from '../lib/mdaScope';
import * as loanClassificationService from './loanClassificationService';
import { LoanClassification } from './loanClassificationService';
import * as revenueProjectionService from './revenueProjectionService';
import * as schemeConfigService from './schemeConfigService';
import * as attentionItemService from './attentionItemService';
import type {
  WeeklyAgReportData,
  WeeklyExecutiveSummary,
  WeeklyComplianceStatus,
  WeeklyResolvedException,
  QuickRecoveryRow,
  ObservationActivitySummary,
  PortfolioSnapshotRow,
} from '@vlprs/shared';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// ─── Non-Punitive Classification Labels ─────────────────────────

const CLASSIFICATION_LABELS: Record<LoanClassification, string> = {
  [LoanClassification.COMPLETED]: 'Completed',
  [LoanClassification.ON_TRACK]: 'On Track',
  [LoanClassification.OVERDUE]: 'Past Expected Completion',
  [LoanClassification.STALLED]: 'Balance Unchanged',
  [LoanClassification.OVER_DEDUCTED]: 'Balance Below Zero',
};

// ─── Main Report Generator ──────────────────────────────────────

export async function generateWeeklyAgReport(
  mdaScope: string | null,
  asOfDate?: Date,
): Promise<WeeklyAgReportData> {
  const generatedAt = new Date().toISOString();
  const periodEnd = asOfDate ?? new Date();
  const periodStart = subDays(periodEnd, 7);

  // Pre-fetch classifications once — used by executiveSummary, portfolioSnapshot,
  // and getTotalOutstandingReceivables (avoids 3 redundant heavy calls)
  const classifications = await loanClassificationService.classifyAllLoans(mdaScope);

  // Run all section queries in parallel
  const [
    executiveSummary,
    complianceStatus,
    exceptionsResolved,
    outstandingAttentionItems,
    quickRecoveryOpportunities,
    observationActivity,
    portfolioSnapshot,
  ] = await Promise.all([
    buildExecutiveSummary(mdaScope, classifications),
    buildComplianceStatus(mdaScope, periodStart, periodEnd),
    buildExceptionsResolved(mdaScope, periodStart, periodEnd),
    attentionItemService.getAttentionItems(mdaScope),
    buildQuickRecoveryOpportunities(mdaScope),
    buildObservationActivity(mdaScope, periodStart, periodEnd),
    buildPortfolioSnapshot(classifications),
  ]);

  return {
    generatedAt,
    periodStart: periodStart.toISOString().slice(0, 10),
    periodEnd: periodEnd.toISOString().slice(0, 10),
    executiveSummary,
    complianceStatus,
    exceptionsResolved,
    outstandingAttentionItems,
    quickRecoveryOpportunities,
    observationActivity,
    portfolioSnapshot,
  };
}

// ─── Executive Summary ──────────────────────────────────────────

async function buildExecutiveSummary(
  mdaScope: string | null,
  classifications: Map<string, LoanClassification>,
): Promise<WeeklyExecutiveSummary> {
  const [totalExposure, schemeFundTotal, actualRecovery] =
    await Promise.all([
      revenueProjectionService.getTotalOutstandingReceivables(mdaScope, classifications),
      schemeConfigService.getSchemeConfig('scheme_fund_total'),
      revenueProjectionService.getActualMonthlyRecovery(mdaScope),
    ]);

  let activeLoans = 0;
  for (const cls of classifications.values()) {
    if (
      cls === LoanClassification.ON_TRACK ||
      cls === LoanClassification.OVERDUE ||
      cls === LoanClassification.STALLED
    ) {
      activeLoans++;
    }
  }

  return {
    activeLoans,
    totalExposure,
    fundAvailable: schemeFundTotal,
    monthlyRecoveryRate: actualRecovery.amount,
  };
}

// ─── Compliance Status (time-windowed) ──────────────────────────

async function buildComplianceStatus(
  mdaScope: string | null,
  periodStart: Date,
  periodEnd: Date,
): Promise<WeeklyComplianceStatus> {
  const conditions = [
    gte(mdaSubmissions.createdAt, periodStart),
    lte(mdaSubmissions.createdAt, periodEnd),
  ];
  const scopeCondition = withMdaScope(mdaSubmissions.mdaId, mdaScope);
  if (scopeCondition) conditions.push(scopeCondition);

  const rows = await db
    .select({
      mdaName: mdas.name,
      mdaCode: mdas.code,
      submissionDate: mdaSubmissions.createdAt,
      recordCount: mdaSubmissions.recordCount,
      status: mdaSubmissions.status,
    })
    .from(mdaSubmissions)
    .innerJoin(mdas, eq(mdaSubmissions.mdaId, mdas.id))
    .where(and(...conditions))
    .orderBy(mdaSubmissions.createdAt);

  return {
    submissionsThisWeek: rows.map((r) => ({
      mdaName: r.mdaName,
      mdaCode: r.mdaCode,
      submissionDate: (r.submissionDate as Date).toISOString(),
      recordCount: r.recordCount ?? 0,
      status: r.status ?? 'processing',
    })),
    totalSubmissions: rows.length,
  };
}

// ─── Exceptions Resolved (time-windowed) ────────────────────────

async function buildExceptionsResolved(
  mdaScope: string | null,
  periodStart: Date,
  periodEnd: Date,
): Promise<WeeklyResolvedException[]> {
  const conditions = [
    gte(observations.resolvedAt, periodStart),
    lte(observations.resolvedAt, periodEnd),
    eq(observations.status, 'resolved'),
  ];
  const scopeCondition = withMdaScope(observations.mdaId, mdaScope);
  if (scopeCondition) conditions.push(scopeCondition);

  const rows = await db
    .select({
      staffName: observations.staffName,
      type: observations.type,
      resolutionNote: observations.resolutionNote,
      resolvedAt: observations.resolvedAt,
      mdaName: mdas.name,
    })
    .from(observations)
    .innerJoin(mdas, eq(observations.mdaId, mdas.id))
    .where(and(...conditions))
    .orderBy(sql`${observations.resolvedAt} DESC`);

  return rows.map((r) => ({
    staffName: r.staffName,
    type: r.type,
    resolutionNote: r.resolutionNote ?? null,
    resolvedAt: (r.resolvedAt as Date).toISOString(),
    mdaName: r.mdaName,
  }));
}

// ─── Quick Recovery Opportunities ───────────────────────────────

async function buildQuickRecoveryOpportunities(
  mdaScope: string | null,
): Promise<QuickRecoveryRow[]> {
  const conditions = [eq(loans.status, 'ACTIVE')];
  const scopeCondition = withMdaScope(loans.mdaId, mdaScope);
  if (scopeCondition) conditions.push(scopeCondition);

  const activeLoanRows = await db
    .select({
      id: loans.id,
      staffName: loans.staffName,
      staffId: loans.staffId,
      mdaId: loans.mdaId,
      principalAmount: loans.principalAmount,
      interestRate: loans.interestRate,
      tenureMonths: loans.tenureMonths,
      monthlyDeductionAmount: loans.monthlyDeductionAmount,
      limitedComputation: loans.limitedComputation,
    })
    .from(loans)
    .where(and(...conditions));

  if (activeLoanRows.length === 0) return [];

  // Batch-fetch ledger entries
  const loanIds = activeLoanRows.map((l) => l.id);
  const allEntries = await db
    .select({
      loanId: ledgerEntries.loanId,
      amount: ledgerEntries.amount,
      principalComponent: ledgerEntries.principalComponent,
      interestComponent: ledgerEntries.interestComponent,
      entryType: ledgerEntries.entryType,
    })
    .from(ledgerEntries)
    .where(inArray(ledgerEntries.loanId, loanIds));

  const entriesMap = new Map<string, typeof allEntries>();
  for (const entry of allEntries) {
    const existing = entriesMap.get(entry.loanId) ?? [];
    existing.push(entry);
    entriesMap.set(entry.loanId, existing);
  }

  // Fetch MDA names
  const mdaIds = [...new Set(activeLoanRows.map((l) => l.mdaId))];
  const mdaRows = await db
    .select({ id: mdas.id, name: mdas.name })
    .from(mdas)
    .where(inArray(mdas.id, mdaIds));
  const mdaLookup = new Map(mdaRows.map((m) => [m.id, m.name]));

  const results: QuickRecoveryRow[] = [];

  for (const loan of activeLoanRows) {
    const entries = entriesMap.get(loan.id) ?? [];
    const balance = computeBalanceForLoan({
      limitedComputation: loan.limitedComputation,
      principalAmount: loan.principalAmount,
      interestRate: loan.interestRate,
      tenureMonths: loan.tenureMonths,
      entries,
      asOfDate: null,
    });
    const outstandingBalance = new Decimal(balance.computedBalance);
    const monthlyDeduction = new Decimal(loan.monthlyDeductionAmount);

    if (outstandingBalance.gt(0) && monthlyDeduction.gt(0)) {
      const remainingInstallments = outstandingBalance
        .div(monthlyDeduction)
        .ceil()
        .toNumber();

      if (remainingInstallments <= 3) {
        results.push({
          staffName: loan.staffName,
          staffId: loan.staffId,
          mdaName: mdaLookup.get(loan.mdaId) ?? loan.mdaId,
          outstandingBalance: outstandingBalance.toFixed(2),
          estimatedRemainingInstallments: remainingInstallments,
        });
      }
    }
  }

  // Sort by outstandingBalance ASC (lowest-effort first)
  results.sort((a, b) =>
    new Decimal(a.outstandingBalance).minus(new Decimal(b.outstandingBalance)).toNumber(),
  );

  return results;
}

// ─── Observation Activity (time-windowed) ───────────────────────

async function buildObservationActivity(
  mdaScope: string | null,
  periodStart: Date,
  periodEnd: Date,
): Promise<ObservationActivitySummary> {
  const scopeCondition = withMdaScope(observations.mdaId, mdaScope);

  const buildCountQuery = (dateCol: Parameters<typeof gte>[0]) => {
    const conds = [gte(dateCol, periodStart), lte(dateCol, periodEnd)];
    if (scopeCondition) conds.push(scopeCondition);
    return db
      .select({ value: sql<number>`COUNT(*)` })
      .from(observations)
      .where(and(...conds));
  };

  const [newResult, reviewedResult, resolvedResult] = await Promise.all([
    buildCountQuery(observations.createdAt),
    buildCountQuery(observations.reviewedAt),
    buildCountQuery(observations.resolvedAt),
  ]);

  return {
    newCount: Number(newResult[0]?.value ?? 0),
    reviewedCount: Number(reviewedResult[0]?.value ?? 0),
    resolvedCount: Number(resolvedResult[0]?.value ?? 0),
  };
}

// ─── Portfolio Snapshot ─────────────────────────────────────────

async function buildPortfolioSnapshot(
  classifications: Map<string, LoanClassification>,
): Promise<PortfolioSnapshotRow[]> {
  const counts: Record<LoanClassification, number> = {
    [LoanClassification.COMPLETED]: 0,
    [LoanClassification.ON_TRACK]: 0,
    [LoanClassification.OVERDUE]: 0,
    [LoanClassification.STALLED]: 0,
    [LoanClassification.OVER_DEDUCTED]: 0,
  };

  for (const cls of classifications.values()) {
    counts[cls]++;
  }

  const total = classifications.size;

  return Object.entries(counts).map(([key, count]) => ({
    classification: CLASSIFICATION_LABELS[key as LoanClassification],
    count,
    percentage:
      total > 0
        ? new Decimal(count).div(total).mul(100).toDecimalPlaces(1).toNumber()
        : 0,
  }));
}
