import { Router, type Request, type Response } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requirePasswordChange } from '../middleware/requirePasswordChange';
import { authorise } from '../middleware/authorise';
import { scopeToMda } from '../middleware/scopeToMda';
import { auditLog } from '../middleware/auditLog';
import { ROLES } from '@vlprs/shared';
import { param } from '../lib/params';
import * as traceReportService from '../services/traceReportService';

const router = Router();

const adminAuth = [
  authenticate,
  requirePasswordChange,
  authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN),
  scopeToMda,
];

// GET /api/staff/:personKey/trace — Assemble and return trace report data (JSON)
router.get(
  '/staff/:personKey/trace',
  ...adminAuth,
  auditLog,
  async (req: Request, res: Response) => {
    const personKey = decodeURIComponent(param(req.params.personKey));
    const report = await traceReportService.assembleTraceReport(
      personKey,
      req.user!.userId,
      req.user!.email,
      req.user!.role,
      req.mdaScope,
    );
    res.json({ success: true, data: report });
  },
);

// GET /api/staff/:personKey/trace/pdf — Generate and return PDF
router.get(
  '/staff/:personKey/trace/pdf',
  ...adminAuth,
  auditLog,
  async (req: Request, res: Response) => {
    const personKey = decodeURIComponent(param(req.params.personKey));
    const report = await traceReportService.assembleTraceReport(
      personKey,
      req.user!.userId,
      req.user!.email,
      req.user!.role,
      req.mdaScope,
    );

    // Dynamically import pdfGenerator (heavy dependency, load only when needed)
    const { generateTraceReportPdf } = await import('../services/pdfGenerator');
    const pdfBuffer = await generateTraceReportPdf(report);

    const safeName = report.summary.staffName
      .replace(/[^a-zA-Z0-9 ]/g, '')
      .replace(/\s+/g, '-')
      .toLowerCase()
      .slice(0, 50);
    const dateStr = new Date().toISOString().slice(0, 10);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="vlprs-trace-${safeName}-${dateStr}.pdf"`,
      'Content-Length': String(pdfBuffer.length),
    });
    res.send(pdfBuffer);
  },
);

export default router;
