/**
 * executiveSummaryReportService — Composition layer for Executive Summary Report (Story 6.1, FR37).
 *
 * Orchestrates existing services into a report-shaped response.
 * Does NOT create new data sources — composes from:
 *   loanClassificationService, mdaAggregationService, revenueProjectionService,
 *   submissionCoverageService, observationService, schemeConfigService.
 */

import Decimal from 'decimal.js';
import { addMonths } from 'date-fns';
import { db } from '../db';
import { loans, ledgerEntries, mdas, migrationRecords, observations } from '../db/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { computeBalanceFromEntries } from './computationEngine';
import { withMdaScope } from '../lib/mdaScope';
import * as loanClassificationService from './loanClassificationService';
import { LoanClassification } from './loanClassificationService';
import * as mdaAggregationService from './mdaAggregationService';
import * as revenueProjectionService from './revenueProjectionService';
import * as submissionCoverageService from './submissionCoverageService';
import * as observationService from './observationService';
import * as schemeConfigService from './schemeConfigService';
import type {
  ExecutiveSummaryReportData,
  RecoveryTier,
  TopVarianceRow,
  MonthOverMonthTrend,
  TrendMetric,
} from '@vlprs/shared';

interface LedgerEntryWithPeriod {
  amount: string;
  principalComponent: string;
  interestComponent: string;
  entryType: string;
  periodMonth: number | null;
  periodYear: number | null;
}

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// ─── Non-Punitive Classification Labels ─────────────────────────

const CLASSIFICATION_LABELS: Record<LoanClassification, string> = {
  [LoanClassification.COMPLETED]: 'Completed',
  [LoanClassification.ON_TRACK]: 'On Track',
  [LoanClassification.OVERDUE]: 'Past Expected Completion',
  [LoanClassification.STALLED]: 'Balance Unchanged',
  [LoanClassification.OVER_DEDUCTED]: 'Balance Below Zero',
};

// ─── Recovery Tier Thresholds ───────────────────────────────────

const RECOVERY_TIERS = {
  QUICK: { label: 'Quick Recovery', stalledMax: 4, overdueMax: 6 },
  INTERVENTION: { label: 'Requires Intervention', stalledMax: 12, overdueMax: 18 },
  EXTENDED: { label: 'Extended Follow-up' },
} as const;

// ─── Main Report Generator ──────────────────────────────────────

export async function generateExecutiveSummaryReport(
  mdaScope?: string | null,
): Promise<ExecutiveSummaryReportData> {
  // Run all independent service calls in parallel
  const [
    classifications,
    mdaBreakdown,
    actualRecovery,
    schemeFundTotal,
    coverageData,
    observationCounts,
    observationCountsByMda,
    topVariances,
  ] = await Promise.all([
    loanClassificationService.classifyAllLoans(mdaScope),
    mdaAggregationService.getMdaBreakdown(mdaScope),
    revenueProjectionService.getActualMonthlyRecovery(mdaScope),
    schemeConfigService.getSchemeConfig('scheme_fund_total'),
    submissionCoverageService.getSubmissionCoverage(),
    observationService.getObservationCounts(mdaScope),
    observationService.getObservationCountsByMda(mdaScope),
    getTopVariancesByMagnitude(mdaScope),
  ]);

  // ── Fetch MDA names once for scorecard + receivables (F3: avoid duplicate queries) ──
  const mdaLookup = await fetchMdaLookup(mdaBreakdown.map(r => r.mdaId));

  // ── Scheme Overview ──
  const activeLoansCount = countByClassification(classifications, [
    LoanClassification.ON_TRACK,
    LoanClassification.OVERDUE,
    LoanClassification.STALLED,
  ]);
  const totalExposure = await revenueProjectionService.getTotalOutstandingReceivables(mdaScope);

  const schemeOverview = {
    activeLoans: activeLoansCount,
    totalExposure,
    fundAvailable: schemeFundTotal,
    monthlyRecoveryRate: actualRecovery.amount,
    recoveryPeriod: actualRecovery.periodYear && actualRecovery.periodMonth
      ? `${actualRecovery.periodYear}-${String(actualRecovery.periodMonth).padStart(2, '0')}`
      : '',
  };

  // ── Portfolio Status ──
  const portfolioStatus = buildPortfolioStatus(classifications);

  // ── MDA Scorecard ──
  const mdaScorecard = buildMdaScorecard(mdaBreakdown, observationCountsByMda, mdaLookup);

  // ── Receivables Ranking (top 10 by exposure) ──
  const receivablesRanking = buildReceivablesRanking(mdaBreakdown, mdaLookup);

  // ── Recovery Potential ──
  const recoveryPotential = await buildRecoveryPotential(classifications, mdaScope);

  // ── Submission Coverage (F1: scope to MDA breakdown to prevent data leakage) ──
  const scopedMdaIds = new Set(mdaBreakdown.map(r => r.mdaId));
  const scopedCoverage = coverageData.filter(c => scopedMdaIds.has(c.mdaId));
  const activeMdas = scopedCoverage.filter(c => c.coveragePercent !== null && c.coveragePercent > 0).length;
  const darkMdas = scopedCoverage.filter(c => c.isDark).length;
  const spottyMdas = scopedCoverage.filter(c => !c.isDark && (c.coveragePercent === null || c.coveragePercent === 0)).length;
  const submissionCoverage = {
    activeMdas,
    spottyMdas,
    darkMdas,
    totalMdas: scopedCoverage.length,
  };

  // ── Onboarding Pipeline ──
  const onboardingPipeline = await buildOnboardingPipeline(mdaScope);

  // ── Exception Summary ──
  const openCount = observationCounts.byStatus.unreviewed + observationCounts.byStatus.reviewed;
  const resolvedCount = observationCounts.byStatus.resolved + observationCounts.byStatus.promoted;
  const exceptionSummary = {
    openCount,
    resolvedCount,
    totalCount: observationCounts.total,
  };

  // ── Month-over-Month Trend ──
  const monthOverMonthTrend = await buildMonthOverMonthTrend(mdaScope, actualRecovery);

  return {
    schemeOverview,
    portfolioStatus,
    mdaScorecard,
    receivablesRanking,
    recoveryPotential,
    submissionCoverage,
    onboardingPipeline,
    exceptionSummary,
    topVariances,
    monthOverMonthTrend,
    generatedAt: new Date().toISOString(),
  };
}

// ─── Portfolio Status Builder ───────────────────────────────────

function buildPortfolioStatus(
  classifications: Map<string, LoanClassification>,
) {
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
    percentage: total > 0 ? new Decimal(count).div(total).mul(100).toDecimalPlaces(1).toNumber() : 0,
  }));
}

// ─── MDA Name Lookup (single query shared by scorecard + receivables) ──

type MdaLookup = Map<string, { name: string; code: string }>;

async function fetchMdaLookup(mdaIds: string[]): Promise<MdaLookup> {
  if (mdaIds.length === 0) return new Map();
  const mdaRows = await db
    .select({ id: mdas.id, name: mdas.name, code: mdas.code })
    .from(mdas)
    .where(sql`${mdas.id} IN (${sql.join(mdaIds.map(id => sql`${id}`), sql`, `)})`);
  return new Map(mdaRows.map(m => [m.id, { name: m.name, code: m.code }]));
}

// ─── MDA Scorecard Builder ──────────────────────────────────────

function buildMdaScorecard(
  breakdown: mdaAggregationService.MdaHealthResult[],
  observationCountsByMda: Map<string, number>,
  mdaLookup: MdaLookup,
) {
  if (breakdown.length === 0) {
    return { topHealthy: [], bottomForReview: [] };
  }

  const rows = breakdown.map(r => {
    const mda = mdaLookup.get(r.mdaId);
    return {
      mdaId: r.mdaId,
      mdaName: mda?.name ?? r.mdaId,
      mdaCode: mda?.code ?? '',
      healthScore: r.healthScore,
      healthBand: r.healthBand,
      totalOutstanding: r.totalExposure,
      observationCount: observationCountsByMda.get(r.mdaId) ?? 0,
    };
  });

  const sorted = [...rows].sort((a, b) => b.healthScore - a.healthScore);
  const topHealthy = sorted.slice(0, 10);
  const topHealthyIds = new Set(topHealthy.map(r => r.mdaId));
  const bottomForReview = sorted
    .filter(r => !topHealthyIds.has(r.mdaId))
    .slice(-5)
    .reverse();

  return { topHealthy, bottomForReview };
}

// ─── Receivables Ranking Builder ────────────────────────────────

function buildReceivablesRanking(
  mdaBreakdown: mdaAggregationService.MdaHealthResult[],
  mdaLookup: MdaLookup,
) {
  if (mdaBreakdown.length === 0) return [];

  return mdaBreakdown
    .map(r => {
      const mda = mdaLookup.get(r.mdaId);
      return {
        mdaId: r.mdaId,
        mdaName: mda?.name ?? r.mdaId,
        mdaCode: mda?.code ?? '',
        totalOutstanding: r.totalExposure,
        activeLoans: r.activeLoans,
      };
    })
    .sort((a, b) => new Decimal(b.totalOutstanding).minus(new Decimal(a.totalOutstanding)).toNumber())
    .slice(0, 10);
}

// ─── Recovery Potential Builder ─────────────────────────────────

async function buildRecoveryPotential(
  classifications: Map<string, LoanClassification>,
  _mdaScope?: string | null,
): Promise<RecoveryTier[]> {
  // Collect OVERDUE and STALLED loan IDs
  const overdueIds: string[] = [];
  const stalledIds: string[] = [];
  for (const [loanId, cls] of classifications) {
    if (cls === LoanClassification.OVERDUE) overdueIds.push(loanId);
    if (cls === LoanClassification.STALLED) stalledIds.push(loanId);
  }

  const allAtRiskIds = [...overdueIds, ...stalledIds];
  if (allAtRiskIds.length === 0) {
    return [
      { tierName: RECOVERY_TIERS.QUICK.label, loanCount: 0, totalAmount: '0.00', monthlyProjection: '0.00' },
      { tierName: RECOVERY_TIERS.INTERVENTION.label, loanCount: 0, totalAmount: '0.00', monthlyProjection: '0.00' },
      { tierName: RECOVERY_TIERS.EXTENDED.label, loanCount: 0, totalAmount: '0.00', monthlyProjection: '0.00' },
    ];
  }

  // Batch fetch loan data
  const loanRows = await db
    .select({
      id: loans.id,
      principalAmount: loans.principalAmount,
      interestRate: loans.interestRate,
      tenureMonths: loans.tenureMonths,
      monthlyDeductionAmount: loans.monthlyDeductionAmount,
      firstDeductionDate: loans.firstDeductionDate,
    })
    .from(loans)
    .where(inArray(loans.id, allAtRiskIds));

  // Batch fetch ledger entries
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
    .where(inArray(ledgerEntries.loanId, allAtRiskIds));

  const entriesMap = new Map<string, LedgerEntryWithPeriod[]>();
  for (const entry of allEntries) {
    const arr = entriesMap.get(entry.loanId) ?? [];
    arr.push(entry);
    entriesMap.set(entry.loanId, arr);
  }

  // Initialize tiers
  const tiers = {
    quick: { count: 0, total: new Decimal('0'), projection: new Decimal('0') },
    intervention: { count: 0, total: new Decimal('0'), projection: new Decimal('0') },
    extended: { count: 0, total: new Decimal('0'), projection: new Decimal('0') },
  };

  const now = new Date();
  const overdueSet = new Set(overdueIds);

  for (const loan of loanRows) {
    const entries = entriesMap.get(loan.id) ?? [];
    const balance = computeBalanceFromEntries(
      loan.principalAmount,
      loan.interestRate,
      loan.tenureMonths,
      entries,
      null,
    );
    const outstanding = new Decimal(balance.computedBalance);
    if (outstanding.lte(0)) continue;

    const isOverdue = overdueSet.has(loan.id);
    let durationMonths: number;

    if (isOverdue) {
      // Months since expected completion
      const firstDeduction = new Date(loan.firstDeductionDate as unknown as string);
      const expectedCompletion = addMonths(firstDeduction, loan.tenureMonths);
      durationMonths = Math.max(0, monthsDiff(expectedCompletion, now));
    } else {
      // STALLED: months since last balance change — approximate via last ledger entry date
      const lastEntry = entries
        .filter(e => e.periodYear != null && e.periodMonth != null)
        .sort((a, b) => {
          if ((a.periodYear ?? 0) !== (b.periodYear ?? 0)) return (b.periodYear ?? 0) - (a.periodYear ?? 0);
          return (b.periodMonth ?? 0) - (a.periodMonth ?? 0);
        })[0];
      if (lastEntry && lastEntry.periodYear && lastEntry.periodMonth) {
        const lastPeriod = new Date(lastEntry.periodYear, lastEntry.periodMonth - 1);
        durationMonths = monthsDiff(lastPeriod, now);
      } else {
        durationMonths = 999; // No entries — extended tier
      }
    }

    // Assign to tier
    const tier = assignRecoveryTier(isOverdue, durationMonths);
    const monthlyDeduction = new Decimal(loan.monthlyDeductionAmount);

    tiers[tier].count++;
    tiers[tier].total = tiers[tier].total.plus(outstanding);
    tiers[tier].projection = tiers[tier].projection.plus(monthlyDeduction);
  }

  return [
    { tierName: RECOVERY_TIERS.QUICK.label, loanCount: tiers.quick.count, totalAmount: tiers.quick.total.toFixed(2), monthlyProjection: tiers.quick.projection.toFixed(2) },
    { tierName: RECOVERY_TIERS.INTERVENTION.label, loanCount: tiers.intervention.count, totalAmount: tiers.intervention.total.toFixed(2), monthlyProjection: tiers.intervention.projection.toFixed(2) },
    { tierName: RECOVERY_TIERS.EXTENDED.label, loanCount: tiers.extended.count, totalAmount: tiers.extended.total.toFixed(2), monthlyProjection: tiers.extended.projection.toFixed(2) },
  ];
}

function assignRecoveryTier(isOverdue: boolean, months: number): 'quick' | 'intervention' | 'extended' {
  if (isOverdue) {
    if (months <= RECOVERY_TIERS.QUICK.overdueMax) return 'quick';
    if (months <= RECOVERY_TIERS.INTERVENTION.overdueMax) return 'intervention';
    return 'extended';
  }
  // STALLED
  if (months <= RECOVERY_TIERS.QUICK.stalledMax) return 'quick';
  if (months <= RECOVERY_TIERS.INTERVENTION.stalledMax) return 'intervention';
  return 'extended';
}

function monthsDiff(start: Date, end: Date): number {
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
}

// ─── Onboarding Pipeline Builder ────────────────────────────────

async function buildOnboardingPipeline(mdaScope?: string | null) {
  // Count NO_APPROVAL_MATCH observations and sum associated loan amounts
  const conditions = [
    eq(observations.type, 'no_approval_match'),
    eq(observations.status, 'unreviewed'),
  ];
  const scopeCondition = withMdaScope(observations.mdaId, mdaScope);
  if (scopeCondition) conditions.push(scopeCondition);

  const obsRows = await db
    .select({
      id: observations.id,
      loanId: observations.loanId,
    })
    .from(observations)
    .where(and(...conditions));

  const approvedNotCollectingCount = obsRows.length;

  // Sum outstanding balances for associated loans
  const loanIds = obsRows.map(r => r.loanId).filter((id): id is string => id !== null);
  let revenueAtRisk = new Decimal('0');

  if (loanIds.length > 0) {
    const loanRows = await db
      .select({
        id: loans.id,
        principalAmount: loans.principalAmount,
        interestRate: loans.interestRate,
        tenureMonths: loans.tenureMonths,
      })
      .from(loans)
      .where(inArray(loans.id, loanIds));

    const entries = await db
      .select({
        loanId: ledgerEntries.loanId,
        amount: ledgerEntries.amount,
        principalComponent: ledgerEntries.principalComponent,
        interestComponent: ledgerEntries.interestComponent,
        entryType: ledgerEntries.entryType,
      })
      .from(ledgerEntries)
      .where(inArray(ledgerEntries.loanId, loanIds));

    const entryMap = new Map<string, typeof entries>();
    for (const entry of entries) {
      const arr = entryMap.get(entry.loanId) ?? [];
      arr.push(entry);
      entryMap.set(entry.loanId, arr);
    }

    for (const loan of loanRows) {
      const loanEntries = entryMap.get(loan.id) ?? [];
      const balance = computeBalanceFromEntries(
        loan.principalAmount,
        loan.interestRate,
        loan.tenureMonths,
        loanEntries,
        null,
      );
      const bal = new Decimal(balance.computedBalance);
      if (bal.gt(0)) revenueAtRisk = revenueAtRisk.plus(bal);
    }
  }

  return {
    approvedNotCollectingCount,
    revenueAtRisk: revenueAtRisk.toFixed(2),
  };
}

// ─── Top Variances Builder ──────────────────────────────────────

async function getTopVariancesByMagnitude(
  mdaScope?: string | null,
): Promise<TopVarianceRow[]> {
  // Query migration_records with largest absolute variance_amount, joined with MDA names
  const conditions = [
    sql`${migrationRecords.varianceAmount} IS NOT NULL`,
    sql`ABS(${migrationRecords.varianceAmount}) > 0`,
    sql`COALESCE(${migrationRecords.recordStatus}, 'active') = 'active'`,
  ];
  const scopeCondition = withMdaScope(migrationRecords.mdaId, mdaScope);
  if (scopeCondition) conditions.push(scopeCondition);

  const rows = await db
    .select({
      staffName: migrationRecords.staffName,
      mdaName: mdas.name,
      monthlyDeduction: migrationRecords.monthlyDeduction,
      computedMonthlyDeduction: migrationRecords.computedMonthlyDeduction,
      varianceAmount: migrationRecords.varianceAmount,
    })
    .from(migrationRecords)
    .innerJoin(mdas, eq(migrationRecords.mdaId, mdas.id))
    .where(and(...conditions))
    .orderBy(sql`ABS(${migrationRecords.varianceAmount}) DESC`)
    .limit(5);

  return rows.map(r => ({
    staffName: r.staffName,
    mdaName: r.mdaName,
    declaredAmount: r.monthlyDeduction ?? '0.00',
    computedAmount: r.computedMonthlyDeduction ?? '0.00',
    difference: r.varianceAmount ?? '0.00',
  }));
}

// ─── Month-over-Month Trend Builder ─────────────────────────────

async function buildMonthOverMonthTrend(
  mdaScope?: string | null,
  currentRecovery?: { amount: string; periodMonth: number; periodYear: number },
): Promise<MonthOverMonthTrend> {
  // Current period values
  const [currentActiveCount, currentExposure, currentCompletionRate] = await Promise.all([
    countActiveLoans(mdaScope),
    revenueProjectionService.getTotalOutstandingReceivables(mdaScope),
    loanClassificationService.getLoanCompletionRate(mdaScope),
  ]);

  // Previous period recovery: find the period before the current one
  const currentMonth = currentRecovery?.periodMonth ?? new Date().getMonth() + 1;
  const currentYear = currentRecovery?.periodYear ?? new Date().getFullYear();
  const prevDate = addMonths(new Date(currentYear, currentMonth - 1), -1);
  const prevMonth = prevDate.getMonth() + 1;
  const prevYear = prevDate.getFullYear();

  const prevRecovery = await getPreviousPeriodRecovery(mdaScope, prevYear, prevMonth);

  const currentRecoveryNum = new Decimal(currentRecovery?.amount ?? '0').toNumber();
  const prevRecoveryNum = new Decimal(prevRecovery).toNumber();
  const currentExposureNum = new Decimal(currentExposure).toNumber();

  // MVP: only monthlyRecovery has real previous-period data (via ledger query).
  // activeLoans, totalExposure, completionRate use current values for both
  // current and previous — historical snapshots require point-in-time queries
  // that are deferred to a future enhancement.
  return {
    activeLoans: buildTrendMetric(currentActiveCount, currentActiveCount),
    totalExposure: buildTrendMetric(currentExposureNum, currentExposureNum),
    monthlyRecovery: buildTrendMetric(currentRecoveryNum, prevRecoveryNum),
    completionRate: buildTrendMetric(currentCompletionRate, currentCompletionRate),
  };
}

function buildTrendMetric(current: number, previous: number): TrendMetric {
  const changePercent = previous > 0
    ? new Decimal(current).minus(previous).div(previous).mul(100).toDecimalPlaces(1).toNumber()
    : 0;
  return { current, previous, changePercent };
}

async function countActiveLoans(mdaScope?: string | null): Promise<number> {
  const conditions = [eq(loans.status, 'ACTIVE')];
  const scopeCondition = withMdaScope(loans.mdaId, mdaScope);
  if (scopeCondition) conditions.push(scopeCondition);

  const [result] = await db
    .select({ value: sql<number>`COUNT(*)` })
    .from(loans)
    .where(and(...conditions));

  return Number(result?.value ?? 0);
}

async function getPreviousPeriodRecovery(
  mdaScope: string | null | undefined,
  year: number,
  month: number,
): Promise<string> {
  const conditions = [
    eq(ledgerEntries.entryType, 'PAYROLL'),
    eq(ledgerEntries.periodYear, year),
    eq(ledgerEntries.periodMonth, month),
  ];
  const scopeCondition = withMdaScope(ledgerEntries.mdaId, mdaScope);
  if (scopeCondition) conditions.push(scopeCondition);

  const [result] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${ledgerEntries.amount}), '0.00')`,
    })
    .from(ledgerEntries)
    .where(and(...conditions));

  return new Decimal(result?.total ?? '0').toFixed(2);
}

// ─── Utility ────────────────────────────────────────────────────

function countByClassification(
  classifications: Map<string, LoanClassification>,
  types: LoanClassification[],
): number {
  let count = 0;
  const typeSet = new Set(types);
  for (const cls of classifications.values()) {
    if (typeSet.has(cls)) count++;
  }
  return count;
}
