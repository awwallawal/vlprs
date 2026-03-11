import { Router, type Request, type Response } from 'express';
import Decimal from 'decimal.js';
import { authenticate } from '../middleware/authenticate';
import { requirePasswordChange } from '../middleware/requirePasswordChange';
import { authorise } from '../middleware/authorise';
import { scopeToMda } from '../middleware/scopeToMda';
import { readLimiter } from '../middleware/rateLimiter';
import { auditLog } from '../middleware/auditLog';
import { ROLES, breakdownQuerySchema } from '@vlprs/shared';
import { db } from '../db';
import { loans, ledgerEntries } from '../db/schema';
import { eq, and, sql, count, inArray } from 'drizzle-orm';
import { withMdaScope } from '../lib/mdaScope';
import * as loanClassificationService from '../services/loanClassificationService';
import { LoanClassification } from '../services/loanClassificationService';
import * as revenueProjectionService from '../services/revenueProjectionService';
import * as schemeConfigService from '../services/schemeConfigService';
import * as gratuityProjectionService from '../services/gratuityProjectionService';
import * as attentionItemService from '../services/attentionItemService';
import { computeBalanceSumForIds } from '../services/attentionItemService';
import * as mdaAggregationService from '../services/mdaAggregationService';

const router = Router();

const dashboardAuth = [
  authenticate,
  requirePasswordChange,
  authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN),
  scopeToMda,
  readLimiter,
  auditLog,
];

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

// Breakdown + attention middleware — all three roles (MDA_OFFICER scoped via scopeToMda)
const drillDownAuth = [
  authenticate,
  requirePasswordChange,
  authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN, ROLES.MDA_OFFICER),
  scopeToMda,
  readLimiter,
  auditLog,
];

// GET /api/dashboard/breakdown — MDA breakdown for a given metric (Story 4.3)
router.get(
  '/dashboard/breakdown',
  ...drillDownAuth,
  async (req: Request, res: Response) => {
    const parsed = breakdownQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'Invalid metric parameter' });
      return;
    }

    const mdaScope = req.mdaScope;
    const breakdown = await mdaAggregationService.getEnrichedMdaBreakdown(mdaScope);

    const metric = parsed.data.metric;

    // Sort: monthlyRecovery by variancePercent ascending (worst first), others by contributionAmount descending
    if (metric === 'monthlyRecovery') {
      breakdown.sort((a, b) => {
        if (a.variancePercent === null && b.variancePercent === null) return 0;
        if (a.variancePercent === null) return 1;
        if (b.variancePercent === null) return -1;
        return a.variancePercent - b.variancePercent;
      });
    } else {
      breakdown.sort((a, b) => {
        const aVal = new Decimal(a.contributionAmount);
        const bVal = new Decimal(b.contributionAmount);
        return bVal.minus(aVal).toNumber();
      });
    }

    res.json({ success: true, data: breakdown });
  },
);

// Attention items middleware — same role set as drill-down
const attentionAuth = drillDownAuth;

// GET /api/dashboard/attention — Attention items for dashboard
router.get(
  '/dashboard/attention',
  ...attentionAuth,
  async (req: Request, res: Response) => {
    const mdaScope = req.mdaScope ?? null;
    const items = await attentionItemService.getAttentionItems(mdaScope);
    res.json({
      success: true,
      data: { items: items.slice(0, 10), totalCount: items.length },
    });
  },
);

export default router;
