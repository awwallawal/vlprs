import Decimal from 'decimal.js';
import { db } from '../db';
import { loans, ledgerEntries, mdas } from '../db/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { computeBalanceFromEntries } from './computationEngine';
import { classifyAllLoans, LoanClassification } from './loanClassificationService';
import type { MdaBreakdownRow as SharedMdaBreakdownRow } from '@vlprs/shared';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// ─── Interfaces ────────────────────────────────────────────────────

export type HealthBand = 'healthy' | 'attention' | 'for-review';

export interface MdaHealthResult {
  mdaId: string;
  healthScore: number;
  healthBand: HealthBand;
  activeLoans: number;
  totalExposure: string;
  monthlyRecovery: string;
  statusDistribution: Record<LoanClassification, number>;
}

// ─── Health Score Formula (FR36) ────────────────────────────────────

/**
 * Compute MDA health score.
 * Formula: base(40) + completionRate×40 + onTrackRate×20
 *   - Penalty: stalled loans present → -20
 *   - Penalty: overdue loans present → -20
 *   - Penalty: over-deducted loans present → -20
 *   - Clamp to [0, 100]
 */
export function computeHealthScore(
  statusDistribution: Record<LoanClassification, number>,
): { score: number; band: HealthBand } {
  const total =
    statusDistribution[LoanClassification.COMPLETED] +
    statusDistribution[LoanClassification.ON_TRACK] +
    statusDistribution[LoanClassification.OVERDUE] +
    statusDistribution[LoanClassification.STALLED] +
    statusDistribution[LoanClassification.OVER_DEDUCTED];

  if (total === 0) return { score: 0, band: 'for-review' };

  const completionRate = statusDistribution[LoanClassification.COMPLETED] / total;
  const onTrackRate = statusDistribution[LoanClassification.ON_TRACK] / total;

  let score = 40 + completionRate * 40 + onTrackRate * 20;

  if (statusDistribution[LoanClassification.STALLED] > 0) score -= 20;
  if (statusDistribution[LoanClassification.OVERDUE] > 0) score -= 20;
  if (statusDistribution[LoanClassification.OVER_DEDUCTED] > 0) score -= 20;

  score = Math.max(0, Math.min(100, score));
  score = Number(new Decimal(score).toDecimalPlaces(1, Decimal.ROUND_HALF_UP).toNumber());

  const band: HealthBand = score >= 70 ? 'healthy' : score >= 40 ? 'attention' : 'for-review';

  return { score, band };
}

/**
 * Get per-MDA health score for a specific MDA.
 */
export async function getMdaHealthScore(
  mdaId: string,
): Promise<{ score: number; band: HealthBand }> {
  const classifications = await classifyAllLoans(mdaId);

  const distribution: Record<LoanClassification, number> = {
    [LoanClassification.COMPLETED]: 0,
    [LoanClassification.ON_TRACK]: 0,
    [LoanClassification.OVERDUE]: 0,
    [LoanClassification.STALLED]: 0,
    [LoanClassification.OVER_DEDUCTED]: 0,
  };

  for (const classification of classifications.values()) {
    distribution[classification]++;
  }

  return computeHealthScore(distribution);
}

/**
 * Get per-MDA breakdown of metrics.
 *
 * Batched implementation: single classifyAllLoans call + grouped SQL queries.
 * Reduces from O(N_MDAs × M_queries) to ~4 total queries.
 */
export async function getMdaBreakdown(
  mdaScope?: string | null,
): Promise<MdaHealthResult[]> {
  // 1. Single classification call for all loans (respects mdaScope)
  const classifications = await classifyAllLoans(mdaScope);
  if (classifications.size === 0) return [];

  const classifiedLoanIds = Array.from(classifications.keys());

  // 2. Batch fetch loan data for all classified loans
  const loanRows = await db
    .select({
      id: loans.id,
      mdaId: loans.mdaId,
      status: loans.status,
      principalAmount: loans.principalAmount,
      interestRate: loans.interestRate,
      tenureMonths: loans.tenureMonths,
    })
    .from(loans)
    .where(inArray(loans.id, classifiedLoanIds));

  // Group loans by MDA
  const mdaLoanMap = new Map<string, typeof loanRows>();
  for (const loan of loanRows) {
    const arr = mdaLoanMap.get(loan.mdaId) ?? [];
    arr.push(loan);
    mdaLoanMap.set(loan.mdaId, arr);
  }

  // 3. Batch fetch ALL ledger entries for classified loans
  const allEntries = await db
    .select({
      loanId: ledgerEntries.loanId,
      amount: ledgerEntries.amount,
      principalComponent: ledgerEntries.principalComponent,
      interestComponent: ledgerEntries.interestComponent,
      entryType: ledgerEntries.entryType,
    })
    .from(ledgerEntries)
    .where(inArray(ledgerEntries.loanId, classifiedLoanIds));

  // Group entries by loan ID
  const entryMap = new Map<string, typeof allEntries>();
  for (const entry of allEntries) {
    const arr = entryMap.get(entry.loanId) ?? [];
    arr.push(entry);
    entryMap.set(entry.loanId, arr);
  }

  // 4. Batch fetch recovery per MDA (latest period per MDA)
  const mdaIds = Array.from(mdaLoanMap.keys());
  const recoveryData = mdaIds.length > 0
    ? await db
        .select({
          mdaId: ledgerEntries.mdaId,
          total: sql<string>`SUM(${ledgerEntries.amount})`,
          periodMonth: ledgerEntries.periodMonth,
          periodYear: ledgerEntries.periodYear,
        })
        .from(ledgerEntries)
        .where(and(
          eq(ledgerEntries.entryType, 'PAYROLL'),
          inArray(ledgerEntries.mdaId, mdaIds),
        ))
        .groupBy(ledgerEntries.mdaId, ledgerEntries.periodMonth, ledgerEntries.periodYear)
        .orderBy(sql`${ledgerEntries.periodYear} DESC`, sql`${ledgerEntries.periodMonth} DESC`)
    : [];

  // Latest period recovery per MDA (first row per MDA due to ordering)
  const recoveryMap = new Map<string, string>();
  for (const row of recoveryData) {
    if (!recoveryMap.has(row.mdaId)) {
      recoveryMap.set(row.mdaId, row.total ?? '0');
    }
  }

  // 5. Build results per MDA in memory
  const results: MdaHealthResult[] = [];
  for (const [mdaId, mdaLoans] of mdaLoanMap) {
    const distribution: Record<LoanClassification, number> = {
      [LoanClassification.COMPLETED]: 0,
      [LoanClassification.ON_TRACK]: 0,
      [LoanClassification.OVERDUE]: 0,
      [LoanClassification.STALLED]: 0,
      [LoanClassification.OVER_DEDUCTED]: 0,
    };

    for (const loan of mdaLoans) {
      const cls = classifications.get(loan.id);
      if (cls) distribution[cls]++;
    }

    const { score, band } = computeHealthScore(distribution);

    // Active loans and exposure (computed from already-fetched entries)
    const activeLoanRows = mdaLoans.filter(l => l.status === 'ACTIVE');
    let totalExposure = new Decimal('0');
    for (const loan of activeLoanRows) {
      const entries = entryMap.get(loan.id) ?? [];
      const balance = computeBalanceFromEntries(
        loan.principalAmount,
        loan.interestRate,
        loan.tenureMonths,
        entries,
        null,
      );
      const bal = new Decimal(balance.computedBalance);
      if (bal.gt(0)) totalExposure = totalExposure.plus(bal);
    }

    results.push({
      mdaId,
      healthScore: score,
      healthBand: band,
      activeLoans: activeLoanRows.length,
      totalExposure: totalExposure.toFixed(2),
      monthlyRecovery: new Decimal(recoveryMap.get(mdaId) ?? '0').toFixed(2),
      statusDistribution: distribution,
    });
  }

  return results;
}

/**
 * Enriched per-MDA breakdown for drill-down API (Story 4.3).
 * Extends getMdaBreakdown with MDA name/code, expected monthly deduction, and variance.
 * Uses batched queries for MDA details and expected deductions.
 */
export async function getEnrichedMdaBreakdown(
  mdaScope?: string | null,
): Promise<SharedMdaBreakdownRow[]> {
  const baseResults = await getMdaBreakdown(mdaScope);
  if (baseResults.length === 0) return [];

  const mdaIds = baseResults.map((r) => r.mdaId);

  // Batch-fetch MDA details and expected deductions in parallel
  const [mdaRows, expectedRows] = await Promise.all([
    db
      .select({ id: mdas.id, name: mdas.name, code: mdas.code })
      .from(mdas)
      .where(sql`${mdas.id} IN (${sql.join(mdaIds.map(id => sql`${id}`), sql`, `)})`),
    db
      .select({
        mdaId: loans.mdaId,
        total: sql<string>`COALESCE(SUM(${loans.monthlyDeductionAmount}), '0.00')`,
      })
      .from(loans)
      .where(and(
        eq(loans.status, 'ACTIVE'),
        sql`${loans.mdaId} IN (${sql.join(mdaIds.map(id => sql`${id}`), sql`, `)})`,
      ))
      .groupBy(loans.mdaId),
  ]);

  const mdaMap = new Map(mdaRows.map((m) => [m.id, m]));
  const expectedMap = new Map(expectedRows.map((e) => [e.mdaId, e.total]));

  return baseResults.map((result) => {
    const mda = mdaMap.get(result.mdaId);
    const expected = new Decimal(expectedMap.get(result.mdaId) ?? '0');
    const actual = new Decimal(result.monthlyRecovery);
    const variancePercent = expected.gt(0)
      ? Number(actual.minus(expected).div(expected).mul(100).toDecimalPlaces(1, Decimal.ROUND_HALF_UP).toNumber())
      : null;

    return {
      mdaId: result.mdaId,
      mdaName: mda?.name ?? result.mdaId,
      mdaCode: mda?.code ?? '',
      contributionCount: result.activeLoans,
      contributionAmount: result.totalExposure,
      expectedMonthlyDeduction: expected.toFixed(2),
      actualMonthlyRecovery: result.monthlyRecovery,
      variancePercent,
      submissionStatus: null, // Stub until Epic 5
      healthScore: result.healthScore,
      healthBand: result.healthBand,
      statusDistribution: {
        completed: result.statusDistribution[LoanClassification.COMPLETED],
        onTrack: result.statusDistribution[LoanClassification.ON_TRACK],
        overdue: result.statusDistribution[LoanClassification.OVERDUE],
        stalled: result.statusDistribution[LoanClassification.STALLED],
        overDeducted: result.statusDistribution[LoanClassification.OVER_DEDUCTED],
      },
    };
  });
}
