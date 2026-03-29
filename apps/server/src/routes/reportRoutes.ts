import { Router, type Request, type Response } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requirePasswordChange } from '../middleware/requirePasswordChange';
import { authorise } from '../middleware/authorise';
import { scopeToMda } from '../middleware/scopeToMda';
import { validate, validateQuery } from '../middleware/validate';
import { validateResponse } from '../middleware/validateResponse';
import { readLimiter } from '../middleware/rateLimiter';
import { auditLog } from '../middleware/auditLog';
import { ROLES, serviceStatusVerificationQuerySchema, executiveSummaryQuerySchema, mdaComplianceQuerySchema, varianceReportQuerySchema, loanSnapshotQuerySchema, weeklyAgReportQuerySchema, apiResponseSchema, executiveSummaryReportSchema, mdaComplianceReportSchema, varianceReportSchema, loanSnapshotReportSchema, weeklyAgReportSchema, shareReportSchema } from '@vlprs/shared';
import type { PdfReportMeta, PdfReportType } from '@vlprs/shared';
import { generateReferenceNumber } from '../services/reportPdfComponents';
import { sendReportEmail } from '../lib/email';
import { db } from '../db';
import { mdas } from '../db/schema';
import { eq } from 'drizzle-orm';
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

// ─── PDF Export Endpoints (Story 6.4, FR53) ───────────────────────

// GET /api/reports/executive-summary/pdf
router.get(
  '/reports/executive-summary/pdf',
  ...executiveReportAuth,
  validateQuery(executiveSummaryQuerySchema),
  async (req: Request, res: Response) => {
    const report = await executiveSummaryReportService.generateExecutiveSummaryReport(
      req.mdaScope,
    );
    const { generateExecutiveSummaryPdf } = await import('../services/executiveSummaryPdf');
    const meta: PdfReportMeta = {
      referenceNumber: generateReferenceNumber('ES'),
      generatedAt: new Date().toISOString(),
      generatedBy: req.user!.email,
      reportTitle: 'Executive Summary Report',
      reportSubtitle: 'Current Period',
    };
    const pdfBuffer = await generateExecutiveSummaryPdf(report, meta);
    const dateStr = new Date().toISOString().slice(0, 10);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="vlprs-executive-summary-${dateStr}.pdf"`,
      'Content-Length': String(pdfBuffer.length),
    });
    res.send(pdfBuffer);
  },
);

// GET /api/reports/mda-compliance/pdf
router.get(
  '/reports/mda-compliance/pdf',
  ...executiveReportAuth,
  validateQuery(mdaComplianceQuerySchema),
  async (req: Request, res: Response) => {
    const report = await mdaComplianceReportService.generateMdaComplianceReport({
      mdaId: req.query.mdaId as string | undefined,
      periodYear: req.query.periodYear ? Number(req.query.periodYear) : undefined,
      periodMonth: req.query.periodMonth ? Number(req.query.periodMonth) : undefined,
      mdaScope: req.mdaScope,
    });
    const { generateMdaCompliancePdf } = await import('../services/mdaCompliancePdf');
    const meta: PdfReportMeta = {
      referenceNumber: generateReferenceNumber('MC'),
      generatedAt: new Date().toISOString(),
      generatedBy: req.user!.email,
      reportTitle: 'MDA Compliance Report',
      reportSubtitle: `Period: ${report.periodYear}-${String(report.periodMonth).padStart(2, '0')}`,
    };
    const pdfBuffer = await generateMdaCompliancePdf(report, meta);
    const dateStr = new Date().toISOString().slice(0, 10);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="vlprs-mda-compliance-${dateStr}.pdf"`,
      'Content-Length': String(pdfBuffer.length),
    });
    res.send(pdfBuffer);
  },
);

// GET /api/reports/variance/pdf
router.get(
  '/reports/variance/pdf',
  ...executiveReportAuth,
  validateQuery(varianceReportQuerySchema),
  async (req: Request, res: Response) => {
    const mdaId = req.query.mdaId as string | undefined;
    const report = await varianceReportService.generateVarianceReport(
      mdaId ?? null,
      req.mdaScope ?? null,
      req.query.periodYear ? Number(req.query.periodYear) : undefined,
      req.query.periodMonth ? Number(req.query.periodMonth) : undefined,
    );
    const { generateVariancePdf } = await import('../services/variancePdf');
    let mdaCode: string | undefined;
    if (mdaId) {
      const [mda] = await db.select({ code: mdas.code }).from(mdas).where(eq(mdas.id, mdaId)).limit(1);
      mdaCode = mda?.code;
    }
    const mdaSuffix = mdaCode ? `-${mdaCode}` : '';
    const meta: PdfReportMeta = {
      referenceNumber: generateReferenceNumber('VAR'),
      generatedAt: new Date().toISOString(),
      generatedBy: req.user!.email,
      reportTitle: 'Variance Report',
      reportSubtitle: mdaCode ? `MDA: ${mdaCode}` : 'All MDAs',
    };
    const pdfBuffer = await generateVariancePdf(report, meta);
    const dateStr = new Date().toISOString().slice(0, 10);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="vlprs-variance${mdaSuffix}-${dateStr}.pdf"`,
      'Content-Length': String(pdfBuffer.length),
    });
    res.send(pdfBuffer);
  },
);

// GET /api/reports/loan-snapshot/pdf
router.get(
  '/reports/loan-snapshot/pdf',
  ...executiveReportAuth,
  validateQuery(loanSnapshotQuerySchema),
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
    const { generateLoanSnapshotPdf } = await import('../services/loanSnapshotPdf');
    const mdaCode = report.data[0]?.mdaCode ?? (req.query.mdaId as string).slice(0, 8);
    const meta: PdfReportMeta = {
      referenceNumber: generateReferenceNumber('LS'),
      generatedAt: new Date().toISOString(),
      generatedBy: req.user!.email,
      reportTitle: 'Loan Snapshot Report',
      reportSubtitle: `MDA: ${mdaCode}`,
    };
    const pdfBuffer = await generateLoanSnapshotPdf(report, meta);
    const dateStr = new Date().toISOString().slice(0, 10);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="vlprs-loan-snapshot-${mdaCode}-${dateStr}.pdf"`,
      'Content-Length': String(pdfBuffer.length),
    });
    res.send(pdfBuffer);
  },
);

// GET /api/reports/weekly-ag/pdf
router.get(
  '/reports/weekly-ag/pdf',
  ...executiveReportAuth,
  validateQuery(weeklyAgReportQuerySchema),
  async (req: Request, res: Response) => {
    const asOfDate = req.query.asOfDate
      ? new Date(req.query.asOfDate as string)
      : undefined;
    const report = await weeklyAgReportService.generateWeeklyAgReport(
      req.mdaScope ?? null,
      asOfDate,
    );
    const { generateWeeklyAgPdf } = await import('../services/weeklyAgPdf');
    const meta: PdfReportMeta = {
      referenceNumber: generateReferenceNumber('WAG'),
      generatedAt: new Date().toISOString(),
      generatedBy: req.user!.email,
      reportTitle: 'Weekly AG Report',
      reportSubtitle: `${report.periodStart} to ${report.periodEnd}`,
    };
    const pdfBuffer = await generateWeeklyAgPdf(report, meta);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="vlprs-weekly-ag-${report.periodStart}-to-${report.periodEnd}.pdf"`,
      'Content-Length': String(pdfBuffer.length),
    });
    res.send(pdfBuffer);
  },
);

// ─── Share Endpoint (Story 6.4, FR54) ─────────────────────────────

// POST /api/reports/share
router.post(
  '/reports/share',
  authenticate,
  requirePasswordChange,
  authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN),
  scopeToMda,
  validate(shareReportSchema),
  auditLog,
  async (req: Request, res: Response) => {
    const body = req.body as { reportType: PdfReportType; recipientEmail: string; coverMessage?: string; reportParams: Record<string, string> };
    const meta: PdfReportMeta = {
      referenceNumber: generateReferenceNumber('SHR'),
      generatedAt: new Date().toISOString(),
      generatedBy: req.user!.email,
      reportTitle: '',
      reportSubtitle: '',
    };

    let pdfBuffer: Buffer;
    let pdfFilename: string;
    const dateStr = new Date().toISOString().slice(0, 10);

    switch (body.reportType) {
      case 'executive-summary': {
        const data = await executiveSummaryReportService.generateExecutiveSummaryReport(req.mdaScope);
        const { generateExecutiveSummaryPdf } = await import('../services/executiveSummaryPdf');
        meta.reportTitle = 'Executive Summary Report';
        meta.reportSubtitle = 'Current Period';
        pdfBuffer = await generateExecutiveSummaryPdf(data, meta);
        pdfFilename = `vlprs-executive-summary-${dateStr}.pdf`;
        break;
      }
      case 'mda-compliance': {
        const data = await mdaComplianceReportService.generateMdaComplianceReport({
          mdaId: body.reportParams.mdaId,
          periodYear: body.reportParams.periodYear ? Number(body.reportParams.periodYear) : undefined,
          periodMonth: body.reportParams.periodMonth ? Number(body.reportParams.periodMonth) : undefined,
          mdaScope: req.mdaScope,
        });
        const { generateMdaCompliancePdf } = await import('../services/mdaCompliancePdf');
        meta.reportTitle = 'MDA Compliance Report';
        meta.reportSubtitle = `Period: ${data.periodYear}-${String(data.periodMonth).padStart(2, '0')}`;
        pdfBuffer = await generateMdaCompliancePdf(data, meta);
        pdfFilename = `vlprs-mda-compliance-${dateStr}.pdf`;
        break;
      }
      case 'variance': {
        const data = await varianceReportService.generateVarianceReport(
          body.reportParams.mdaId ?? null,
          req.mdaScope ?? null,
          body.reportParams.periodYear ? Number(body.reportParams.periodYear) : undefined,
          body.reportParams.periodMonth ? Number(body.reportParams.periodMonth) : undefined,
        );
        const { generateVariancePdf } = await import('../services/variancePdf');
        let varMdaCode: string | undefined;
        if (body.reportParams.mdaId) {
          const [mda] = await db.select({ code: mdas.code }).from(mdas).where(eq(mdas.id, body.reportParams.mdaId)).limit(1);
          varMdaCode = mda?.code;
        }
        meta.reportTitle = 'Variance Report';
        meta.reportSubtitle = varMdaCode ? `MDA: ${varMdaCode}` : 'All MDAs';
        pdfBuffer = await generateVariancePdf(data, meta);
        pdfFilename = varMdaCode ? `vlprs-variance-${varMdaCode}-${dateStr}.pdf` : `vlprs-variance-${dateStr}.pdf`;
        break;
      }
      case 'loan-snapshot': {
        if (!body.reportParams.mdaId) {
          res.status(400).json({ success: false, error: { message: 'mdaId is required for loan-snapshot reports' } });
          return;
        }
        const data = await loanSnapshotReportService.generateLoanSnapshotReport(
          body.reportParams.mdaId,
          req.mdaScope ?? null,
          {},
        );
        const { generateLoanSnapshotPdf } = await import('../services/loanSnapshotPdf');
        const mdaCode = data.data[0]?.mdaCode ?? body.reportParams.mdaId.slice(0, 8);
        meta.reportTitle = 'Loan Snapshot Report';
        meta.reportSubtitle = `MDA: ${mdaCode}`;
        pdfBuffer = await generateLoanSnapshotPdf(data, meta);
        pdfFilename = `vlprs-loan-snapshot-${mdaCode}-${dateStr}.pdf`;
        break;
      }
      case 'weekly-ag': {
        const asOfDate = body.reportParams.asOfDate
          ? new Date(body.reportParams.asOfDate)
          : undefined;
        const data = await weeklyAgReportService.generateWeeklyAgReport(
          req.mdaScope ?? null,
          asOfDate,
        );
        const { generateWeeklyAgPdf } = await import('../services/weeklyAgPdf');
        meta.reportTitle = 'Weekly AG Report';
        meta.reportSubtitle = `${data.periodStart} to ${data.periodEnd}`;
        pdfBuffer = await generateWeeklyAgPdf(data, meta);
        pdfFilename = `vlprs-weekly-ag-${dateStr}.pdf`;
        break;
      }
      default: {
        res.status(400).json({ success: false, error: { message: `Unsupported report type: ${body.reportType as string}` } });
        return;
      }
    }

    // Fire-and-forget email — don't block response on delivery
    sendReportEmail({
      to: body.recipientEmail,
      reportTitle: meta.reportTitle,
      coverMessage: body.coverMessage,
      pdfBuffer,
      pdfFilename,
    });

    res.json({ success: true, data: { queued: true } });
  },
);

export default router;
