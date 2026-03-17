/**
 * Pre-Submission Checkpoint routes (Story 11.1).
 * GET /pre-submission/:mdaId — returns checkpoint data for the given MDA.
 */
import { Router, type Request, type Response } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requirePasswordChange } from '../middleware/requirePasswordChange';
import { authorise } from '../middleware/authorise';
import { scopeToMda } from '../middleware/scopeToMda';
import { readLimiter } from '../middleware/rateLimiter';
import { auditLog } from '../middleware/auditLog';
import { AppError } from '../lib/appError';
import { param } from '../lib/params';
import { ROLES, VOCABULARY } from '@vlprs/shared';
import * as preSubmissionService from '../services/preSubmissionService';

const router = Router();

// UUID v4/v7 regex for param validation
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Auth chain: all three roles can read checkpoint (scoping handled by scopeToMda)
const readAuth = [
  authenticate,
  requirePasswordChange,
  authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN, ROLES.MDA_OFFICER),
  scopeToMda,
];

// GET /pre-submission/:mdaId — Pre-submission checkpoint data
router.get(
  '/pre-submission/:mdaId',
  ...readAuth,
  readLimiter,
  auditLog,
  async (req: Request, res: Response) => {
    const mdaId = param(req.params.mdaId);

    // Validate UUID format
    if (!UUID_RE.test(mdaId)) {
      throw new AppError(422, 'INVALID_MDA_ID', 'MDA ID must be a valid UUID');
    }

    // Enforce MDA scope: mda_officer can only query their own MDA
    const mdaScope = req.mdaScope;
    if (mdaScope !== null && mdaScope !== undefined && mdaScope !== mdaId) {
      throw new AppError(403, 'MDA_ACCESS_DENIED', VOCABULARY.MDA_ACCESS_DENIED);
    }

    // Set custom audit action
    req.auditAction = 'CHECKPOINT_RETRIEVED';

    const data = await preSubmissionService.getCheckpointData(mdaId);

    res.json({
      success: true,
      data,
    });
  },
);

export default router;
