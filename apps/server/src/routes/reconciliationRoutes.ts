/**
 * Reconciliation routes (Story 11.3).
 * GET   /submissions/:submissionId/reconciliation     — view reconciliation summary
 * PATCH /employment-events/:id/reconciliation-status  — resolve DATE_DISCREPANCY
 */
import { Router, type Request, type Response } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requirePasswordChange } from '../middleware/requirePasswordChange';
import { authorise } from '../middleware/authorise';
import { scopeToMda } from '../middleware/scopeToMda';
import { validate } from '../middleware/validate';
import { auditLog } from '../middleware/auditLog';
import { writeLimiter, readLimiter } from '../middleware/rateLimiter';
import { ROLES, resolveDiscrepancySchema } from '@vlprs/shared';
import * as reconciliationEngine from '../services/reconciliationEngine';

const router = Router();

// ─── GET /submissions/:submissionId/reconciliation ───────────────────

router.get(
  '/submissions/:submissionId/reconciliation',
  authenticate,
  requirePasswordChange,
  authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN, ROLES.MDA_OFFICER),
  scopeToMda,
  readLimiter,
  auditLog,
  async (req: Request, res: Response) => {
    req.auditAction = 'RECONCILIATION_VIEWED';
    const { submissionId } = req.params;
    const mdaScope = (req as unknown as { mdaScope: string | null }).mdaScope;
    const data = await reconciliationEngine.getReconciliationSummary(submissionId, mdaScope);
    res.json({ success: true, data });
  },
);

// ─── PATCH /employment-events/:id/reconciliation-status ──────────────

router.patch(
  '/employment-events/:id/reconciliation-status',
  authenticate,
  requirePasswordChange,
  authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN),
  writeLimiter,
  validate(resolveDiscrepancySchema),
  auditLog,
  async (req: Request, res: Response) => {
    req.auditAction = 'RECONCILIATION_DISCREPANCY_RESOLVED';
    const { id } = req.params;
    const { status, reason } = req.body;
    const userId = (req as unknown as { user: { userId: string } }).user.userId;
    const data = await reconciliationEngine.resolveDiscrepancy(id, status, reason, userId);
    res.json({ success: true, data });
  },
);

export default router;
