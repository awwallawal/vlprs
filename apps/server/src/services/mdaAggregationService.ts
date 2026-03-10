import Decimal from 'decimal.js';
import { db } from '../db';
import { loans, ledgerEntries } from '../db/schema';
import { eq, and, sql, count } from 'drizzle-orm';
import { computeBalanceFromEntries } from './computationEngine';
import { classifyAllLoans, LoanClassification } from './loanClassificationService';
import { withMdaScope } from '../lib/mdaScope';

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
 * TODO(Stories 4.2-4.4): Refactor to batch queries before exposing via API.
 * Current implementation has N+1 pattern: classifyAllLoans + ledger queries per MDA.
 * For 50+ MDAs this will generate hundreds of DB queries. Needs batch classification
 * with groupBy MDA, or a single classifyAllLoans() call with post-hoc MDA grouping.
 */
export async function getMdaBreakdown(
  mdaScope?: string | null,
): Promise<MdaHealthResult[]> {
  // Get all MDAs with active loans
  const conditions = [];
  const scopeCondition = withMdaScope(loans.mdaId, mdaScope);
  if (scopeCondition) conditions.push(scopeCondition);

  const mdaLoanCounts = await db
    .select({
      mdaId: loans.mdaId,
      count: count(),
    })
    .from(loans)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(loans.mdaId);

  const results: MdaHealthResult[] = [];

  for (const { mdaId } of mdaLoanCounts) {
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

    const { score, band } = computeHealthScore(distribution);

    // Active loans count
    const activeConditions = [eq(loans.status, 'ACTIVE'), eq(loans.mdaId, mdaId)];
    const [activeResult] = await db
      .select({ value: count() })
      .from(loans)
      .where(and(...activeConditions));

    // Total exposure (outstanding balances of active loans)
    const activeLoanRows = await db
      .select({
        id: loans.id,
        principalAmount: loans.principalAmount,
        interestRate: loans.interestRate,
        tenureMonths: loans.tenureMonths,
      })
      .from(loans)
      .where(and(eq(loans.status, 'ACTIVE'), eq(loans.mdaId, mdaId)));

    let totalExposure = new Decimal('0');
    for (const loan of activeLoanRows) {
      const entries = await db
        .select({
          amount: ledgerEntries.amount,
          principalComponent: ledgerEntries.principalComponent,
          interestComponent: ledgerEntries.interestComponent,
          entryType: ledgerEntries.entryType,
        })
        .from(ledgerEntries)
        .where(eq(ledgerEntries.loanId, loan.id));

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

    // Monthly recovery (last period for this MDA)
    const [recoveryResult] = await db
      .select({
        total: sql<string>`COALESCE(SUM(${ledgerEntries.amount}), '0.00')`,
      })
      .from(ledgerEntries)
      .where(
        and(
          eq(ledgerEntries.entryType, 'PAYROLL'),
          eq(ledgerEntries.mdaId, mdaId),
        ),
      )
      .groupBy(ledgerEntries.periodMonth, ledgerEntries.periodYear)
      .orderBy(
        sql`${ledgerEntries.periodYear} DESC`,
        sql`${ledgerEntries.periodMonth} DESC`,
      )
      .limit(1);

    results.push({
      mdaId,
      healthScore: score,
      healthBand: band,
      activeLoans: activeResult?.value ?? 0,
      totalExposure: totalExposure.toFixed(2),
      monthlyRecovery: new Decimal(recoveryResult?.total ?? '0').toFixed(2),
      statusDistribution: distribution,
    });
  }

  return results;
}
