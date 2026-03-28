import { Router, type Request, type Response } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requirePasswordChange } from '../middleware/requirePasswordChange';
import { authorise } from '../middleware/authorise';
import { scopeToMda } from '../middleware/scopeToMda';
import { validateQuery } from '../middleware/validate';
import { validateResponse } from '../middleware/validateResponse';
import { readLimiter } from '../middleware/rateLimiter';
import { auditLog } from '../middleware/auditLog';
import { ROLES, serviceStatusVerificationQuerySchema, executiveSummaryQuerySchema, mdaComplianceQuerySchema, varianceReportQuerySchema, loanSnapshotQuerySchema, weeklyAgReportQuerySchema, apiResponseSchema, executiveSummaryReportSchema, mdaComplianceReportSchema, varianceReportSchema, loanSnapshotReportSchema, weeklyAgReportSchema } from '@vlprs/shared';
import * as reportService from '../services/serviceStatusReportService';
import * as executiveSummaryReportService from '../services/executiveSummaryReportService';
import * as mdaComplianceReportService from '../services/mdaComplianceReportService';
import * as varianceReportService from '../services/varianceReportService';
import * as loanSnapshotReportService from '../services/loanSnapshotReportService';
import * as weeklyAgReportService from '../services/weeklyAgReportService';

const router = Router();

const reportAuth = [
  authenticate,
  requirePasswordChange,
  authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN, ROLES.MDA_OFFICER),
  scopeToMda,
];

const executiveReportAuth = [
  authenticate,
  requirePasswordChange,
  authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN),
  scopeToMda,
  readLimiter,
  auditLog,
];

// GET /api/reports/service-status-verification — Post-retirement activity detection report (Story 10.4, FR71)
router.get(
  '/reports/service-status-verification',
  ...reportAuth,
  validateQuery(serviceStatusVerificationQuerySchema),
  auditLog,
  async (req: Request, res: Response) => {
    const report = await reportService.getServiceStatusVerificationReport(
      req.mdaScope,
      {
        mdaId: req.query.mdaId as string | undefined,
        asOfDate: req.query.asOfDate ? new Date(req.query.asOfDate as string) : undefined,
        page: req.query.page ? Number(req.query.page) : undefined,
        pageSize: req.query.pageSize ? Number(req.query.pageSize) : undefined,
      },
    );
    res.json({
      success: true,
      data: report.data,
      summary: report.summary,
      pagination: report.pagination,
    });
  },
);

// GET /api/reports/executive-summary — Executive Summary Report (Story 6.1, FR37)
router.get(
  '/reports/executive-summary',
  ...executiveReportAuth,
  validateQuery(executiveSummaryQuerySchema),
  validateResponse(apiResponseSchema(executiveSummaryReportSchema)),
  async (req: Request, res: Response) => {
    const report = await executiveSummaryReportService.generateExecutiveSummaryReport(
      req.mdaScope,
    );
    res.json({ success: true, data: report });
  },
);

// GET /api/reports/mda-compliance — MDA Compliance Report (Story 6.1, FR38)
router.get(
  '/reports/mda-compliance',
  ...executiveReportAuth,
  validateQuery(mdaComplianceQuerySchema),
  validateResponse(apiResponseSchema(mdaComplianceReportSchema)),
  async (req: Request, res: Response) => {
    const report = await mdaComplianceReportService.generateMdaComplianceReport({
      mdaId: req.query.mdaId as string | undefined,
      periodYear: req.query.periodYear ? Number(req.query.periodYear) : undefined,
      periodMonth: req.query.periodMonth ? Number(req.query.periodMonth) : undefined,
      mdaScope: req.mdaScope,
    });
    res.json({ success: true, data: report });
  },
);

// GET /api/reports/variance — Variance Report (Story 6.2, FR39)
router.get(
  '/reports/variance',
  ...executiveReportAuth,
  validateQuery(varianceReportQuerySchema),
  validateResponse(apiResponseSchema(varianceReportSchema)),
  async (req: Request, res: Response) => {
    const report = await varianceReportService.generateVarianceReport(
      (req.query.mdaId as string) ?? null,
      req.mdaScope ?? null,
      req.query.periodYear ? Number(req.query.periodYear) : undefined,
      req.query.periodMonth ? Number(req.query.periodMonth) : undefined,
    );
    res.json({ success: true, data: report });
  },
);

// GET /api/reports/loan-snapshot — Loan Snapshot Report (Story 6.2, FR40)
router.get(
  '/reports/loan-snapshot',
  ...executiveReportAuth,
  validateQuery(loanSnapshotQuerySchema),
  validateResponse(apiResponseSchema(loanSnapshotReportSchema)),
  async (req: Request, res: Response) => {
    const report = await loanSnapshotReportService.generateLoanSnapshotReport(
      req.query.mdaId as string,
      req.mdaScope ?? null,
      {
        page: req.query.page ? Number(req.query.page) : undefined,
        pageSize: req.query.pageSize ? Number(req.query.pageSize) : undefined,
        sortBy: req.query.sortBy as 'staffName' | undefined,
        sortOrder: req.query.sortOrder as 'asc' | 'desc' | undefined,
        statusFilter: req.query.statusFilter as string | undefined,
      },
    );
    res.json({ success: true, data: report });
  },
);

// GET /api/reports/weekly-ag — Weekly AG Report (Story 6.3, FR41)
router.get(
  '/reports/weekly-ag',
  ...executiveReportAuth,
  validateQuery(weeklyAgReportQuerySchema),
  validateResponse(apiResponseSchema(weeklyAgReportSchema)),
  async (req: Request, res: Response) => {
    const asOfDate = req.query.asOfDate
      ? new Date(req.query.asOfDate as string)
      : undefined;
    const report = await weeklyAgReportService.generateWeeklyAgReport(
      req.mdaScope ?? null,
      asOfDate,
    );
    res.json({ success: true, data: report });
  },
);

export default router;
