import { Router, type Request, type Response } from 'express';
import Decimal from 'decimal.js';
import { authenticate } from '../middleware/authenticate';
import { requirePasswordChange } from '../middleware/requirePasswordChange';
import { authorise } from '../middleware/authorise';
import { scopeToMda } from '../middleware/scopeToMda';
import { readLimiter } from '../middleware/rateLimiter';
import { validateQuery } from '../middleware/validate';
import { auditLog } from '../middleware/auditLog';
import { ALL_ROLES, ROLES, mdaQuerySchema } from '@vlprs/shared';
import { db } from '../db';
import { loans, ledgerEntries } from '../db/schema';
import { eq, and, sql, count, inArray } from 'drizzle-orm';
import { AppError } from '../lib/appError';
import { param } from '../lib/params';
import * as mdaService from '../services/mdaService';
import * as mdaAggregationService from '../services/mdaAggregationService';
import * as loanClassificationService from '../services/loanClassificationService';
import { LoanClassification } from '../services/loanClassificationService';

const router = Router();

// Shared middleware: all authenticated roles, MDA-scoped
const allAuth = [
  authenticate,
  requirePasswordChange,
  authorise(...ALL_ROLES),
  scopeToMda,
];

// Drill-down middleware with rate limiting
const summaryAuth = [
  authenticate,
  requirePasswordChange,
  authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN, ROLES.MDA_OFFICER),
  scopeToMda,
  readLimiter,
  auditLog,
];

// GET /api/mdas — List MDAs (all authenticated roles, MDA-scoped for mda_officer)
router.get(
  '/mdas',
  ...allAuth,
  validateQuery(mdaQuerySchema),
  auditLog,
  async (req: Request, res: Response) => {
    const filters = {
      isActive: req.query.isActive === 'false' ? false : req.query.isActive === 'true' ? true : undefined,
      search: req.query.search as string | undefined,
    };
    const data = await mdaService.listMdas(filters, req.mdaScope);
    res.json({ success: true, data });
  },
);

// GET /api/mdas/:id/summary — Enriched MDA detail with health score & classification (Story 4.3)
router.get(
  '/mdas/:id/summary',
  ...summaryAuth,
  async (req: Request, res: Response) => {
    const mdaId = param(req.params.id);

    // Enforce MDA_OFFICER scoping
    if (req.mdaScope && req.mdaScope !== mdaId) {
      throw new AppError(403, 'FORBIDDEN', 'You can only view your own MDA');
    }

    const mda = await mdaService.getMdaById(mdaId);

    // Get health score and status distribution
    const { score, band } = await mdaAggregationService.getMdaHealthScore(mdaId);
    const classifications = await loanClassificationService.classifyAllLoans(mdaId);

    const statusDistribution = {
      completed: 0,
      onTrack: 0,
      overdue: 0,
      stalled: 0,
      overDeducted: 0,
    };
    for (const classification of classifications.values()) {
      switch (classification) {
        case LoanClassification.COMPLETED: statusDistribution.completed++; break;
        case LoanClassification.ON_TRACK: statusDistribution.onTrack++; break;
        case LoanClassification.OVERDUE: statusDistribution.overdue++; break;
        case LoanClassification.STALLED: statusDistribution.stalled++; break;
        case LoanClassification.OVER_DEDUCTED: statusDistribution.overDeducted++; break;
      }
    }

    // Loan count (ACTIVE only — consistent with drill-down contributionCount)
    const [loanCountResult] = await db
      .select({ value: count() })
      .from(loans)
      .where(and(eq(loans.mdaId, mdaId), eq(loans.status, 'ACTIVE')));

    // Total exposure (outstanding balances of ACTIVE loans: principal + interest - paid)
    const activeIds = await db
      .select({ id: loans.id })
      .from(loans)
      .where(and(eq(loans.mdaId, mdaId), eq(loans.status, 'ACTIVE')));

    let totalExposure = new Decimal('0');
    if (activeIds.length > 0) {
      const ids = activeIds.map(l => l.id);
      const [[loanTotals], [paidResult]] = await Promise.all([
        db.select({
          totalPrincipal: sql<string>`COALESCE(SUM(${loans.principalAmount}), '0')`,
          totalInterest: sql<string>`COALESCE(SUM(${loans.principalAmount} * ${loans.interestRate} / 100), '0')`,
        }).from(loans).where(inArray(loans.id, ids)),
        db.select({
          total: sql<string>`COALESCE(SUM(${ledgerEntries.amount}), '0')`,
        }).from(ledgerEntries).where(inArray(ledgerEntries.loanId, ids)),
      ]);
      totalExposure = Decimal.max(
        new Decimal('0'),
        new Decimal(loanTotals?.totalPrincipal ?? '0')
          .plus(new Decimal(loanTotals?.totalInterest ?? '0'))
          .minus(new Decimal(paidResult?.total ?? '0')),
      );
    }

    // Expected monthly deduction
    const [expectedResult] = await db
      .select({
        total: sql<string>`COALESCE(SUM(${loans.monthlyDeductionAmount}), '0.00')`,
      })
      .from(loans)
      .where(and(eq(loans.mdaId, mdaId), eq(loans.status, 'ACTIVE')));

    // Actual monthly recovery (last period)
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

    const expected = new Decimal(expectedResult?.total ?? '0');
    const actual = new Decimal(recoveryResult?.total ?? '0');
    const variancePercent = expected.gt(0)
      ? Number(actual.minus(expected).div(expected).mul(100).toDecimalPlaces(1, Decimal.ROUND_HALF_UP).toNumber())
      : null;

    const summary = {
      mdaId: mda.id,
      name: mda.name,
      code: mda.code,
      officerName: '', // Not stored in MDA table; future enhancement
      loanCount: loanCountResult?.value ?? 0,
      totalExposure: totalExposure.toFixed(2),
      monthlyRecovery: actual.toFixed(2),
      submissionHistory: [], // Future Epic 5
      healthScore: score,
      healthBand: band,
      statusDistribution,
      expectedMonthlyDeduction: expected.toFixed(2),
      actualMonthlyRecovery: actual.toFixed(2),
      variancePercent,
    };

    res.json({ success: true, data: summary });
  },
);

export default router;
