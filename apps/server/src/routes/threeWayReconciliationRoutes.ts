/**
 * Three-Way Reconciliation Routes (Story 7.0i).
 *
 * GET /reconciliation/three-way         — MDA+period detail (scoped)
 * GET /reconciliation/three-way/dashboard — Dashboard metrics (SUPER_ADMIN / DEPT_ADMIN)
 */
import { Router, type Request, type Response } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requirePasswordChange } from '../middleware/requirePasswordChange';
import { authorise } from '../middleware/authorise';
import { scopeToMda } from '../middleware/scopeToMda';
import { readLimiter } from '../middleware/rateLimiter';
import { auditLog } from '../middleware/auditLog';
import { ROLES } from '@vlprs/shared';
import { getThreeWayReconciliation, getThreeWayDashboardMetrics } from '../services/threeWayReconciliationService';

const router = Router();

// ─── Auth Middleware ──────────────────────────────────────────────
const readAuth = [
  authenticate,
  requirePasswordChange,
  authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN, ROLES.MDA_OFFICER),
  scopeToMda,
  readLimiter,
  auditLog,
];

// ─── GET /reconciliation/three-way/dashboard — Dashboard metrics ──
// Must be registered BEFORE the parameterised route

router.get(
  '/reconciliation/three-way/dashboard',
  ...readAuth,
  async (req: Request, res: Response) => {
    req.auditAction = 'THREE_WAY_DASHBOARD_VIEWED';

    const mdaScope = req.mdaScope ?? null;
    const metrics = await getThreeWayDashboardMetrics(mdaScope);

    res.json({
      success: true,
      data: metrics,
    });
  },
);

// ─── GET /reconciliation/three-way — MDA+period reconciliation detail ─

router.get(
  '/reconciliation/three-way',
  ...readAuth,
  async (req: Request, res: Response) => {
    req.auditAction = 'THREE_WAY_RECONCILIATION_VIEWED';

    const { mdaId, period } = req.query as { mdaId?: string; period?: string };

    if (!mdaId || !period) {
      res.status(400).json({
        success: false,
        error: { code: 'MISSING_PARAMS', message: 'Both mdaId and period are required' },
      });
      return;
    }

    const mdaScope = req.mdaScope ?? null;
    const summary = await getThreeWayReconciliation(mdaId, period, mdaScope);

    res.json({
      success: true,
      data: summary,
    });
  },
);

export default router;
