import { Router, type Request, type Response } from 'express';
import Decimal from 'decimal.js';
import { authenticate } from '../middleware/authenticate';
import { requirePasswordChange } from '../middleware/requirePasswordChange';
import { authorise } from '../middleware/authorise';
import { scopeToMda } from '../middleware/scopeToMda';
import { readLimiter } from '../middleware/rateLimiter';
import { auditLog } from '../middleware/auditLog';
import { ROLES, breakdownQuerySchema, schemeFundBodySchema, apiResponseSchema, dashboardMetricsSchema, attentionItemsResponseSchema, complianceResponseSchema, mdaBreakdownRowSchema, schemeFundDataSchema, type MdaComplianceRow } from '@vlprs/shared';
import { z } from 'zod/v4';
import { validateResponse } from '../middleware/validateResponse';
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
import * as metricSnapshotService from '../services/metricSnapshotService';

const router = Router();

const dashboardAuth = [
  authenticate,
  requirePasswordChange,
  authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN, ROLES.MDA_OFFICER),
  scopeToMda,
  readLimiter,
  auditLog,
];

// GET /api/dashboard/metrics — Executive dashboard hero metrics + analytics
router.get(
  '/dashboard/metrics',
  ...dashboardAuth,
  validateResponse(apiResponseSchema(dashboardMetricsSchema)),
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

    // MoM trends from metric snapshots
    const now = new Date();
    const snapshot = await metricSnapshotService.getPreviousMonthSnapshot(now.getFullYear(), now.getMonth() + 1);

    function computeTrend(current: number, previous: number | null): { direction: 'up' | 'down' | 'flat'; label: string } {
      if (previous === null) return { direction: 'flat', label: '\u2014' };
      if (previous === 0) return { direction: current > 0 ? 'up' : 'flat', label: current > 0 ? 'New' : '\u2014' };
      const pct = new Decimal(current).minus(previous).div(previous).mul(100).toDecimalPlaces(1).toNumber();
      if (pct > 0) return { direction: 'up', label: `+${pct}%` };
      if (pct < 0) return { direction: 'down', label: `${pct}%` };
      return { direction: 'flat', label: '0%' };
    }

    const trends = {
      activeLoans: computeTrend(activeLoansResult, snapshot?.activeLoans ?? null),
      totalExposure: computeTrend(totalExposureResult.toNumber(), snapshot ? new Decimal(snapshot.totalExposure).toNumber() : null),
      monthlyRecovery: computeTrend(new Decimal(actualRecovery.amount).toNumber(), snapshot ? new Decimal(snapshot.monthlyRecovery).toNumber() : null),
      completionRate: computeTrend(completionRateLifetime, snapshot ? new Decimal(snapshot.completionRate).toNumber() : null),
    };

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

      // MoM trends
      trends,
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
  validateResponse(apiResponseSchema(schemeFundDataSchema)),
  async (req: Request, res: Response) => {
    const parsed = schemeFundBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'Amount must be a positive number' });
      return;
    }

    const userId = req.user!.userId;
    await schemeConfigService.setSchemeConfig('scheme_fund_total', parsed.data.amount, userId);

    res.json({ success: true, data: { fundTotal: parsed.data.amount } });
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
  validateResponse(apiResponseSchema(z.array(mdaBreakdownRowSchema))),
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
  validateResponse(apiResponseSchema(attentionItemsResponseSchema)),
  async (req: Request, res: Response) => {
    const mdaScope = req.mdaScope ?? null;
    const items = await attentionItemService.getAttentionItems(mdaScope);
    res.json({
      success: true,
      data: { items: items.slice(0, 10), totalCount: items.length },
    });
  },
);

// ─── Multi-Loan Staff (UAT 2026-04-14) ─────────────────────────────────
// GET /api/dashboard/multi-loan-staff — Staff with 2+ loans across same/different MDAs

router.get(
  '/dashboard/multi-loan-staff',
  ...drillDownAuth,
  async (req: Request, res: Response) => {
    const mdaScope = req.mdaScope ?? null;
    const { sql: sqlImport } = await import('drizzle-orm');

    const summaryResult = await db.execute(sqlImport`
      SELECT
        COUNT(*) FILTER (WHERE loan_count >= 2)::int as multi_loan_staff,
        COUNT(*) FILTER (WHERE loan_count >= 3)::int as triple_plus,
        COUNT(*) FILTER (WHERE mda_count >= 2)::int as cross_mda,
        COALESCE(SUM(total_principal::numeric) FILTER (WHERE loan_count >= 2), 0)::text as concentrated_exposure
      FROM (
        SELECT staff_name, COUNT(*)::int as loan_count, COUNT(DISTINCT mda_id)::int as mda_count, SUM(principal_amount::numeric) as total_principal
        FROM loans
        ${mdaScope ? sqlImport`WHERE mda_id = ${mdaScope}` : sqlImport``}
        GROUP BY staff_name
      ) x
    `);
    const summary = summaryResult.rows[0] as { multi_loan_staff: number; triple_plus: number; cross_mda: number; concentrated_exposure: string };

    const listResult = await db.execute(sqlImport`
      SELECT
        l.staff_name,
        COUNT(*)::int as loan_count,
        COUNT(DISTINCT l.mda_id)::int as mda_count,
        SUM(l.principal_amount::numeric)::text as total_principal,
        STRING_AGG(DISTINCT m.code, ', ') as mda_codes,
        STRING_AGG(DISTINCT m.name, ' | ') as mda_names,
        STRING_AGG(l.loan_reference, ', ' ORDER BY l.loan_reference) as loan_refs,
        (ARRAY_AGG(l.id))[1] as sample_loan_id,
        (ARRAY_AGG(l.mda_id))[1] as sample_mda_id,
        (ARRAY_AGG(m.code))[1] as sample_mda_code,
        COUNT(*) FILTER (WHERE l.status = 'ACTIVE')::int as active_count,
        COUNT(*) FILTER (WHERE l.status = 'COMPLETED')::int as completed_count
      FROM loans l
      JOIN mdas m ON l.mda_id = m.id
      ${mdaScope ? sqlImport`WHERE l.mda_id = ${mdaScope}` : sqlImport``}
      GROUP BY l.staff_name
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC, SUM(l.principal_amount::numeric) DESC
      LIMIT 1000
    `);

    res.json({
      success: true,
      data: {
        summary: {
          multiLoanStaff: summary.multi_loan_staff,
          triplePlus: summary.triple_plus,
          crossMda: summary.cross_mda,
          concentratedExposure: summary.concentrated_exposure,
        },
        staff: (listResult.rows as Array<any>).map(r => ({
          staffName: r.staff_name,
          loanCount: r.loan_count,
          mdaCount: r.mda_count,
          totalPrincipal: r.total_principal,
          mdaCodes: r.mda_codes,
          mdaNames: r.mda_names,
          loanRefs: r.loan_refs,
          sampleLoanId: r.sample_loan_id,
          sampleMdaId: r.sample_mda_id,
          sampleMdaCode: r.sample_mda_code,
          activeCount: r.active_count,
          completedCount: r.completed_count,
        })),
      },
    });
  },
);

// ─── Pending MDA Action (UAT 2026-04-14) ─────────────────────────────────
// GET /api/dashboard/pending-mda-action — Aggregated backlog of records awaiting MDA action

router.get(
  '/dashboard/pending-mda-action',
  ...drillDownAuth,
  async (req: Request, res: Response) => {
    const mdaScope = req.mdaScope ?? null;
    const { sql: sqlImport } = await import('drizzle-orm');

    // Total pending records (flagged for review or not yet baselined, across all active uploads)
    const totalResult = await db.execute(sqlImport`
      SELECT
        COUNT(*)::int as total_pending,
        COUNT(DISTINCT mda_id)::int as mda_count,
        COALESCE(SUM(total_loan::numeric), 0)::text as total_exposure
      FROM migration_records
      WHERE deleted_at IS NULL
        AND (
          flagged_for_review_at IS NOT NULL AND corrected_at IS NULL
          OR is_baseline_created = false
        )
        ${mdaScope ? sqlImport`AND mda_id = ${mdaScope}` : sqlImport``}
    `);
    const totalRow = totalResult.rows[0] as { total_pending: number; mda_count: number; total_exposure: string };

    // Per-MDA breakdown
    const perMdaResult = await db.execute(sqlImport`
      SELECT
        m.id as mda_id,
        m.code as mda_code,
        m.name as mda_name,
        COUNT(mr.*) FILTER (WHERE mr.flagged_for_review_at IS NOT NULL AND mr.corrected_at IS NULL)::int as flagged,
        COUNT(mr.*) FILTER (WHERE mr.is_baseline_created = false AND mr.flagged_for_review_at IS NULL)::int as not_baselined,
        COALESCE(SUM(mr.total_loan::numeric) FILTER (WHERE mr.flagged_for_review_at IS NOT NULL AND mr.corrected_at IS NULL), 0)::text as flagged_exposure,
        MIN(mr.flagged_for_review_at) FILTER (WHERE mr.corrected_at IS NULL) as oldest_flagged,
        MIN(mr.review_window_deadline) FILTER (WHERE mr.corrected_at IS NULL) as next_deadline
      FROM mdas m
      LEFT JOIN migration_records mr ON mr.mda_id = m.id AND mr.deleted_at IS NULL
      WHERE EXISTS (
        SELECT 1 FROM migration_records mr2
        WHERE mr2.mda_id = m.id AND mr2.deleted_at IS NULL
          AND (
            (mr2.flagged_for_review_at IS NOT NULL AND mr2.corrected_at IS NULL)
            OR mr2.is_baseline_created = false
          )
      )
      ${mdaScope ? sqlImport`AND m.id = ${mdaScope}` : sqlImport``}
      GROUP BY m.id, m.code, m.name
      ORDER BY (COUNT(mr.*) FILTER (WHERE mr.flagged_for_review_at IS NOT NULL AND mr.corrected_at IS NULL) + COUNT(mr.*) FILTER (WHERE mr.is_baseline_created = false AND mr.flagged_for_review_at IS NULL)) DESC
    `);

    // Observation counts (overdeductions, within-file duplicates)
    const obsResult = await db.execute(sqlImport`
      SELECT type, COUNT(*)::int as cnt
      FROM observations
      WHERE status = 'unreviewed'
        AND type IN ('post_completion_deduction', 'within_file_duplicate', 'negative_balance')
        ${mdaScope ? sqlImport`AND mda_id = ${mdaScope}` : sqlImport``}
      GROUP BY type
    `);

    const obsByType: Record<string, number> = {};
    for (const row of obsResult.rows as Array<{ type: string; cnt: number }>) {
      obsByType[row.type] = row.cnt;
    }

    res.json({
      success: true,
      data: {
        totalPending: totalRow.total_pending,
        mdaCount: totalRow.mda_count,
        totalExposure: totalRow.total_exposure,
        overdeductions: obsByType.post_completion_deduction ?? 0,
        withinFileDuplicates: obsByType.within_file_duplicate ?? 0,
        negativeBalances: obsByType.negative_balance ?? 0,
        perMda: (perMdaResult.rows as Array<any>).map(r => ({
          mdaId: r.mda_id,
          mdaCode: r.mda_code,
          mdaName: r.mda_name,
          flagged: r.flagged ?? 0,
          notBaselined: r.not_baselined ?? 0,
          flaggedExposure: r.flagged_exposure ?? '0.00',
          oldestFlagged: r.oldest_flagged ? new Date(r.oldest_flagged).toISOString() : null,
          nextDeadline: r.next_deadline ? new Date(r.next_deadline).toISOString() : null,
        })),
      },
    });
  },
);

// ─── Compliance Endpoint (Story 4.4) ─────────────────────────────────

// GET /api/dashboard/compliance — MDA compliance status view + heatmap
router.get(
  '/dashboard/compliance',
  ...drillDownAuth,
  validateResponse(apiResponseSchema(complianceResponseSchema)),
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
