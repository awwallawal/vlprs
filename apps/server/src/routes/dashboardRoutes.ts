import { Router, type Request, type Response } from 'express';
import Decimal from 'decimal.js';
import { authenticate } from '../middleware/authenticate';
import { requirePasswordChange } from '../middleware/requirePasswordChange';
import { authorise } from '../middleware/authorise';
import { scopeToMda } from '../middleware/scopeToMda';
import { readLimiter } from '../middleware/rateLimiter';
import { auditLog } from '../middleware/auditLog';
import { ROLES, breakdownQuerySchema, schemeFundBodySchema, type MdaComplianceRow } from '@vlprs/shared';
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
import * as submissionCoverageService from '../services/submissionCoverageService';
import { listMdas } from '../services/mdaService';

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

// PUT /api/dashboard/scheme-fund — Set/update scheme fund total (Story 11.0a, AC#2)
router.put(
  '/dashboard/scheme-fund',
  authenticate,
  requirePasswordChange,
  authorise(ROLES.SUPER_ADMIN),
  auditLog,
  async (req: Request, res: Response) => {
    const parsed = schemeFundBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'Amount must be a positive number' });
      return;
    }

    const userId = req.user!.userId;
    await schemeConfigService.setSchemeConfig('scheme_fund_total', parsed.data.amount, userId);

    res.json({ success: true, fundTotal: parsed.data.amount });
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
    const metric = parsed.data.metric;
    const breakdown = await mdaAggregationService.getEnrichedMdaBreakdown(mdaScope, metric);

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

// ─── Compliance Endpoint (Story 4.4) ─────────────────────────────────

// GET /api/dashboard/compliance — MDA compliance status view + heatmap
router.get(
  '/dashboard/compliance',
  ...drillDownAuth,
  async (req: Request, res: Response) => {
    const mdaScope = req.mdaScope ?? null;

    // Fetch all data sources in parallel
    const [allMdas, healthResults, coverageData, heatmapData] = await Promise.all([
      listMdas(undefined, mdaScope),
      mdaAggregationService.getMdaBreakdown(mdaScope),
      submissionCoverageService.getSubmissionCoverage(mdaScope ?? undefined),
      submissionCoverageService.getSubmissionHeatmap(mdaScope),
    ]);

    // Build lookup maps
    const healthMap = new Map(healthResults.map((h) => [h.mdaId, h]));
    const coverageMap = new Map(coverageData.map((c) => [c.mdaId, c]));

    // Compute deadline date: 28th of current month, or next month if past 28th
    const today = new Date();
    const currentMonth28 = new Date(today.getFullYear(), today.getMonth(), 28);
    const deadlineDate = today <= currentMonth28
      ? currentMonth28.toISOString()
      : new Date(today.getFullYear(), today.getMonth() + 1, 28).toISOString();

    // Assemble compliance rows
    const rows: MdaComplianceRow[] = allMdas.map((mda) => {
      const health = healthMap.get(mda.id);
      const coverage = coverageMap.get(mda.id);

      return {
        mdaId: mda.id,
        mdaCode: mda.code,
        mdaName: mda.name,
        status: 'pending' as const, // Pre-Epic 5: all MDAs are "pending"
        lastSubmission: coverage?.lastSubmissionDate ?? null,
        recordCount: 0,
        alignedCount: 0,
        varianceCount: 0,
        healthScore: health?.healthScore ?? 0,
        healthBand: health?.healthBand ?? 'for-review',
        submissionCoveragePercent: coverage?.coveragePercent ?? null,
        isDark: coverage?.isDark ?? false,
        stalenessMonths: coverage?.stalenessMonths ?? null,
      };
    });

    // Summary counts
    let submitted = 0;
    let pending = 0;
    let overdue = 0;
    for (const row of rows) {
      if (row.status === 'submitted') submitted++;
      else if (row.status === 'pending') pending++;
      else overdue++;
    }

    res.json({
      success: true,
      data: {
        rows,
        heatmap: heatmapData,
        summary: {
          submitted,
          pending,
          overdue,
          total: rows.length,
          deadlineDate,
          heatmapSummary: {
            onTime: 0,
            gracePeriod: 0,
            awaiting: rows.length,
          },
        },
      },
    });
  },
);

export default router;
