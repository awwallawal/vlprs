import { Router, type Request, type Response } from 'express';
import Decimal from 'decimal.js';
import { authenticate } from '../middleware/authenticate';
import { requirePasswordChange } from '../middleware/requirePasswordChange';
import { authorise } from '../middleware/authorise';
import { scopeToMda } from '../middleware/scopeToMda';
import { readLimiter } from '../middleware/rateLimiter';
import { auditLog } from '../middleware/auditLog';
import { ROLES } from '@vlprs/shared';
import { db } from '../db';
import { loans, ledgerEntries } from '../db/schema';
import { eq, and, sql, count, inArray } from 'drizzle-orm';
import { withMdaScope } from '../lib/mdaScope';
import { computeBalanceFromEntries } from '../services/computationEngine';
import * as loanClassificationService from '../services/loanClassificationService';
import { LoanClassification } from '../services/loanClassificationService';
import * as revenueProjectionService from '../services/revenueProjectionService';
import * as schemeConfigService from '../services/schemeConfigService';
import * as gratuityProjectionService from '../services/gratuityProjectionService';
import type { LedgerEntryForBalance } from '@vlprs/shared';

const router = Router();

const dashboardAuth = [
  authenticate,
  requirePasswordChange,
  authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN),
  scopeToMda,
  readLimiter,
  auditLog,
];

/**
 * Batch-compute sum of outstanding balances for a set of loan IDs.
 * Returns '0.00' if no IDs provided.
 */
async function computeBalanceSumForIds(loanIds: string[]): Promise<string> {
  if (loanIds.length === 0) return '0.00';

  const loanRows = await db
    .select({
      id: loans.id,
      principalAmount: loans.principalAmount,
      interestRate: loans.interestRate,
      tenureMonths: loans.tenureMonths,
    })
    .from(loans)
    .where(inArray(loans.id, loanIds));

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

// GET /api/dashboard/metrics — Executive dashboard hero metrics + analytics
router.get(
  '/dashboard/metrics',
  ...dashboardAuth,
  async (req: Request, res: Response) => {
    const mdaScope = req.mdaScope;
    const scopeCondition = withMdaScope(loans.mdaId, mdaScope);

    // Phase 1: Run ALL independent queries in parallel (no sequential phases)
    const [
      activeLoansResult,
      classifications,
      totalExposureResult,
      monthlyCollectionPotential,
      actualRecovery,
      schemeFundTotal,
      gratuityExposure,
      loansInWindow,
      completionRateLifetime,
    ] = await Promise.all([
      // Active loans count
      (async () => {
        const conditions = [eq(loans.status, 'ACTIVE')];
        if (scopeCondition) conditions.push(scopeCondition);
        const [result] = await db.select({ value: count() }).from(loans).where(and(...conditions));
        return result?.value ?? 0;
      })(),

      // Classifications (reused for: completion rate, at-risk, outstanding receivables)
      loanClassificationService.classifyAllLoans(mdaScope),

      // Total exposure (outstanding balances of ACTIVE loans) — batch SQL approximation
      (async () => {
        const conditions = [eq(loans.status, 'ACTIVE')];
        if (scopeCondition) conditions.push(scopeCondition);

        const [loanTotals] = await db
          .select({
            totalPrincipal: sql<string>`COALESCE(SUM(${loans.principalAmount}), '0')`,
            totalInterest: sql<string>`COALESCE(SUM(${loans.principalAmount} * ${loans.interestRate} / 100), '0')`,
          })
          .from(loans)
          .where(and(...conditions));

        const activeLoanIds = await db
          .select({ id: loans.id })
          .from(loans)
          .where(and(...conditions));

        let totalPaid = new Decimal('0');
        if (activeLoanIds.length > 0) {
          const ids = activeLoanIds.map((l) => l.id);
          const [paidResult] = await db
            .select({
              total: sql<string>`COALESCE(SUM(${ledgerEntries.amount}), '0')`,
            })
            .from(ledgerEntries)
            .where(inArray(ledgerEntries.loanId, ids));
          totalPaid = new Decimal(paidResult?.total ?? '0');
        }

        return new Decimal(loanTotals?.totalPrincipal ?? '0')
          .plus(new Decimal(loanTotals?.totalInterest ?? '0'))
          .minus(totalPaid);
      })(),

      // Monthly collection potential
      revenueProjectionService.getMonthlyCollectionPotential(mdaScope),

      // Actual monthly recovery
      revenueProjectionService.getActualMonthlyRecovery(mdaScope),

      // Scheme fund total config
      schemeConfigService.getSchemeConfig('scheme_fund_total'),

      // Gratuity exposure (deferred from Story 10.3)
      gratuityProjectionService.getAggregateGratuityExposure(mdaScope),

      // Loans in window
      loanClassificationService.getLoansInWindow(mdaScope),

      // Completion rate lifetime
      loanClassificationService.getLoanCompletionRateLifetime(mdaScope),
    ]);

    // Phase 2: Derive metrics from already-fetched classifications (no extra DB calls)

    // Completion rate, at-risk IDs, and receivable IDs — single pass over classifications
    let completedInWindow = 0;
    const totalInWindow = classifications.size;
    const atRiskIds: string[] = [];
    const receivableIds: string[] = []; // ON_TRACK + OVERDUE + STALLED

    for (const [loanId, classification] of classifications) {
      if (classification === LoanClassification.COMPLETED) completedInWindow++;
      if (
        classification === LoanClassification.OVERDUE ||
        classification === LoanClassification.STALLED
      ) {
        atRiskIds.push(loanId);
        receivableIds.push(loanId);
      }
      if (classification === LoanClassification.ON_TRACK) {
        receivableIds.push(loanId);
      }
    }

    const loanCompletionRate = totalInWindow > 0
      ? Number(new Decimal(completedInWindow).div(totalInWindow).mul(100).toDecimalPlaces(1).toNumber())
      : 0;

    // Also include ACTIVE loans outside the 60-month classification window for receivables
    const activeConditions = [eq(loans.status, 'ACTIVE')];
    if (scopeCondition) activeConditions.push(scopeCondition);
    const activeLoans = await db
      .select({ id: loans.id })
      .from(loans)
      .where(and(...activeConditions));

    for (const loan of activeLoans) {
      if (!receivableIds.includes(loan.id)) {
        receivableIds.push(loan.id);
      }
    }

    // Batch-compute balances for at-risk and receivable loan sets in parallel
    const [atRiskAmount, totalOutstandingReceivables] = await Promise.all([
      computeBalanceSumForIds(atRiskIds),
      computeBalanceSumForIds(receivableIds),
    ]);

    // Compute fund available
    let fundAvailable: string | null = null;
    let fundConfigured = false;
    if (schemeFundTotal !== null) {
      fundConfigured = true;
      const disbursedConditions = [
        sql`${loans.status} IN ('ACTIVE', 'COMPLETED')`,
      ];
      if (scopeCondition) disbursedConditions.push(scopeCondition);

      const [disbursedResult] = await db
        .select({
          total: sql<string>`COALESCE(SUM(${loans.principalAmount}), '0')`,
        })
        .from(loans)
        .where(and(...disbursedConditions));

      fundAvailable = new Decimal(schemeFundTotal)
        .minus(new Decimal(disbursedResult?.total ?? '0'))
        .toFixed(2);
    }

    // Format recovery period
    const recoveryPeriod = actualRecovery.periodYear > 0
      ? `${actualRecovery.periodYear}-${String(actualRecovery.periodMonth).padStart(2, '0')}`
      : '';

    // Assemble response — all numeric aggregates, no arrays
    const metrics = {
      // Primary Hero Row
      activeLoans: activeLoansResult,
      totalExposure: totalExposureResult.toFixed(2),
      fundAvailable,
      fundConfigured,
      monthlyRecovery: actualRecovery.amount,
      recoveryPeriod,

      // Analytics Row
      loansInWindow,
      totalOutstandingReceivables,
      monthlyCollectionPotential,
      atRiskAmount,
      loanCompletionRate,
      loanCompletionRateLifetime: completionRateLifetime,

      // Secondary metrics
      pendingEarlyExits: 0,
      earlyExitRecoveryAmount: '0.00',
      gratuityReceivableExposure: gratuityExposure,
      staffIdCoverage: { covered: 0, total: 0 },
    };

    res.json({ success: true, data: metrics });
  },
);

export default router;
