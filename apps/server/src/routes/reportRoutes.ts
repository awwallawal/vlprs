import { Router, type Request, type Response } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requirePasswordChange } from '../middleware/requirePasswordChange';
import { authorise } from '../middleware/authorise';
import { scopeToMda } from '../middleware/scopeToMda';
import { validateQuery } from '../middleware/validate';
import { auditLog } from '../middleware/auditLog';
import { ROLES, serviceStatusVerificationQuerySchema } from '@vlprs/shared';
import * as reportService from '../services/serviceStatusReportService';

const router = Router();

const reportAuth = [
  authenticate,
  requirePasswordChange,
  authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN, ROLES.MDA_OFFICER),
  scopeToMda,
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

export default router;
