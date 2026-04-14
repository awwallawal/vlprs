import { Router, type Request, type Response } from 'express';
import Decimal from 'decimal.js';
import { authenticate } from '../middleware/authenticate';
import { requirePasswordChange } from '../middleware/requirePasswordChange';
import { authorise } from '../middleware/authorise';
import { scopeToMda } from '../middleware/scopeToMda';
import { readLimiter } from '../middleware/rateLimiter';
import { validate, validateQuery } from '../middleware/validate';
import { auditLog } from '../middleware/auditLog';
import { ALL_ROLES, ROLES, mdaQuerySchema, createMdaAliasSchema, batchResolveMdaSchema } from '@vlprs/shared';
import { db } from '../db';
import { loans, ledgerEntries, migrationRecords, migrationUploads } from '../db/schema';
import { eq, and, sql, count, inArray, isNull, desc } from 'drizzle-orm';
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

    const declaredRecovery = new Decimal(expectedResult?.total ?? '0');
    const actual = new Decimal(recoveryResult?.total ?? '0');

    // Collection Potential — SUM of scheme-expected monthly deduction for baselined records
    const [collectionPotentialResult] = await db
      .select({
        total: sql<string>`COALESCE(SUM(${migrationRecords.schemeExpectedMonthlyDeduction}), '0.00')`,
      })
      .from(migrationRecords)
      .where(and(
        eq(migrationRecords.mdaId, mdaId),
        eq(migrationRecords.isBaselineCreated, true),
        sql`${migrationRecords.deletedAt} IS NULL`,
      ));

    const collectionPotential = new Decimal(collectionPotentialResult?.total ?? '0');
    const recoveryVarianceAmount = collectionPotential.gt(0)
      ? declaredRecovery.minus(collectionPotential).toFixed(2)
      : null;
    const recoveryVariancePercent = collectionPotential.gt(0)
      ? Number(declaredRecovery.minus(collectionPotential).div(collectionPotential).mul(100).toDecimalPlaces(1, Decimal.ROUND_HALF_UP).toNumber())
      : null;

    // Legacy variance (actual PAYROLL vs declared)
    const variancePercent = declaredRecovery.gt(0)
      ? Number(actual.minus(declaredRecovery).div(declaredRecovery).mul(100).toDecimalPlaces(1, Decimal.ROUND_HALF_UP).toNumber())
      : null;

    // Migration uploads for this MDA (submission history)
    const mdaMigrationUploads = await db
      .select({
        id: migrationUploads.id,
        filename: migrationUploads.filename,
        status: migrationUploads.status,
        totalRecords: migrationUploads.totalRecords,
        createdAt: migrationUploads.createdAt,
      })
      .from(migrationUploads)
      .where(and(
        eq(migrationUploads.mdaId, mdaId),
        isNull(migrationUploads.deletedAt),
      ))
      .orderBy(desc(migrationUploads.createdAt))
      .limit(10);

    const summary = {
      mdaId: mda.id,
      name: mda.name,
      code: mda.code,
      officerName: '', // Not stored in MDA table; future enhancement
      loanCount: loanCountResult?.value ?? 0,
      totalExposure: totalExposure.toFixed(2),
      monthlyRecovery: actual.toFixed(2),
      submissionHistory: [], // MDA monthly submissions (Epic 5)
      migrationUploads: mdaMigrationUploads.map((u) => ({
        id: u.id,
        filename: u.filename,
        status: u.status,
        totalRecords: u.totalRecords,
        createdAt: u.createdAt.toISOString(),
      })),
      healthScore: score,
      healthBand: band,
      statusDistribution,
      expectedMonthlyDeduction: declaredRecovery.toFixed(2),
      actualMonthlyRecovery: actual.toFixed(2),
      variancePercent,
      // New: Declared Recovery vs Collection Potential (UAT 2026-04-12 Finding #7)
      declaredRecovery: declaredRecovery.toFixed(2),
      collectionPotential: collectionPotential.toFixed(2),
      recoveryVarianceAmount,
      recoveryVariancePercent,
    };

    res.json({ success: true, data: summary });
  },
);

// ─── Alias CRUD (Story 15.1, Task A2) ──────────────────────────────

// POST /api/mdas/aliases — create alias (SUPER_ADMIN, DEPT_ADMIN)
router.post(
  '/mdas/aliases',
  authenticate,
  requirePasswordChange,
  authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN),
  validate(createMdaAliasSchema),
  auditLog,
  async (req: Request, res: Response) => {
    const { alias, mdaId } = req.body as { alias: string; mdaId: string };
    const created = await mdaService.createAlias(alias, mdaId);
    res.status(201).json({ success: true, data: created });
  },
);

// GET /api/mdas/aliases — list all aliases with MDA names joined
router.get(
  '/mdas/aliases',
  ...allAuth,
  auditLog,
  async (_req: Request, res: Response) => {
    const aliases = await mdaService.listAliases();
    res.json({ success: true, data: aliases });
  },
);

// DELETE /api/mdas/aliases/:id — remove alias (SUPER_ADMIN only)
router.delete(
  '/mdas/aliases/:id',
  authenticate,
  requirePasswordChange,
  authorise(ROLES.SUPER_ADMIN),
  auditLog,
  async (req: Request, res: Response) => {
    await mdaService.deleteAlias(param(req.params.id));
    res.json({ success: true });
  },
);

// ─── Batch Resolve (Story 15.1, Task A3) ───────────────────────────

// POST /api/mdas/resolve — batch MDA string resolution
router.post(
  '/mdas/resolve',
  authenticate,
  requirePasswordChange,
  authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN),
  validate(batchResolveMdaSchema),
  auditLog,
  async (req: Request, res: Response) => {
    const { strings } = req.body as { strings: string[] };

    // Deduplicate input strings (case-insensitive)
    const seen = new Map<string, string>();
    for (const s of strings) {
      const key = s.toLowerCase();
      if (!seen.has(key)) seen.set(key, s);
    }

    const results = await Promise.all(
      [...seen.values()].map(async (input) => {
        const { resolved, candidates } = await mdaService.resolveMdaWithCandidates(input);
        let status: 'auto_matched' | 'needs_review' | 'unknown';
        if (resolved) {
          status = 'auto_matched';
        } else if (candidates.length > 0) {
          status = 'needs_review';
        } else {
          status = 'unknown';
        }
        return { input, status, resolved, candidates };
      }),
    );

    res.json({ success: true, data: { results } });
  },
);

export default router;
