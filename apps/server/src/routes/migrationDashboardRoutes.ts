import { Router, type Request, type Response } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requirePasswordChange } from '../middleware/requirePasswordChange';
import { authorise } from '../middleware/authorise';
import { scopeToMda } from '../middleware/scopeToMda';
import { validateQuery } from '../middleware/validate';
import { auditLog } from '../middleware/auditLog';
import { ROLES, beneficiaryQuerySchema, coverageQuerySchema } from '@vlprs/shared';
import * as migrationDashboardService from '../services/migrationDashboardService';
import * as beneficiaryLedgerService from '../services/beneficiaryLedgerService';

const router = Router();

const dashboardAuth = [
  authenticate,
  requirePasswordChange,
  authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN, ROLES.MDA_OFFICER),
  scopeToMda,
];

// GET /api/migrations/dashboard — Migration dashboard data (all MDAs with status)
router.get(
  '/migrations/dashboard',
  ...dashboardAuth,
  auditLog,
  async (req: Request, res: Response) => {
    const data = await migrationDashboardService.getMigrationDashboard(req.mdaScope);
    res.json({ success: true, data });
  },
);

// GET /api/migrations/dashboard/metrics — Aggregate hero metrics
router.get(
  '/migrations/dashboard/metrics',
  ...dashboardAuth,
  auditLog,
  async (req: Request, res: Response) => {
    const data = await migrationDashboardService.getDashboardMetrics(req.mdaScope);
    res.json({ success: true, data });
  },
);

// GET /api/migrations/coverage — Coverage tracker matrix (Story 11.0b)
router.get(
  '/migrations/coverage',
  ...dashboardAuth,
  validateQuery(coverageQuerySchema),
  auditLog,
  async (req: Request, res: Response) => {
    const extended = req.query.extended === 'true';
    const data = await migrationDashboardService.getMigrationCoverage(req.mdaScope, extended);
    res.json({ success: true, data });
  },
);

// GET /api/migrations/beneficiaries — Paginated beneficiary ledger
router.get(
  '/migrations/beneficiaries',
  ...dashboardAuth,
  validateQuery(beneficiaryQuerySchema),
  auditLog,
  async (req: Request, res: Response) => {
    const filters = {
      search: req.query.search as string | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : undefined,
      mdaId: req.query.mdaId as string | undefined,
      sortBy: req.query.sortBy as 'staffName' | 'totalExposure' | 'loanCount' | 'lastActivityDate' | undefined,
      sortOrder: req.query.sortOrder as 'asc' | 'desc' | undefined,
    };
    const data = await beneficiaryLedgerService.listBeneficiaries(filters, req.mdaScope);
    res.json({ success: true, data });
  },
);

// GET /api/migrations/beneficiaries/metrics — Beneficiary aggregate metrics
router.get(
  '/migrations/beneficiaries/metrics',
  ...dashboardAuth,
  auditLog,
  async (req: Request, res: Response) => {
    const data = await beneficiaryLedgerService.getBeneficiaryMetrics(req.mdaScope);
    res.json({ success: true, data });
  },
);

// GET /api/migrations/beneficiaries/export — CSV export
router.get(
  '/migrations/beneficiaries/export',
  ...dashboardAuth,
  validateQuery(beneficiaryQuerySchema),
  auditLog,
  async (req: Request, res: Response) => {
    const filters = {
      search: req.query.search as string | undefined,
      mdaId: req.query.mdaId as string | undefined,
      sortBy: req.query.sortBy as 'staffName' | 'totalExposure' | 'loanCount' | 'lastActivityDate' | undefined,
      sortOrder: req.query.sortOrder as 'asc' | 'desc' | undefined,
    };
    const csv = await beneficiaryLedgerService.exportBeneficiariesCsv(filters, req.mdaScope);
    const date = new Date().toISOString().slice(0, 10);
    const filterDesc = filters.mdaId ? `mda-${filters.mdaId.slice(0, 8)}` : 'all';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="vlprs-beneficiary-ledger-${date}-${filterDesc}.csv"`);
    res.send(csv);
  },
);

export default router;
