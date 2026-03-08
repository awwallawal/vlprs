import { Router, type Request, type Response } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requirePasswordChange } from '../middleware/requirePasswordChange';
import { authorise } from '../middleware/authorise';
import { scopeToMda } from '../middleware/scopeToMda';
import { validate, validateQuery } from '../middleware/validate';
import { auditLog } from '../middleware/auditLog';
import {
  ROLES,
  observationQuerySchema,
  reviewObservationSchema,
  resolveObservationSchema,
  promoteObservationSchema,
  generateObservationsSchema,
} from '@vlprs/shared';
import * as observationService from '../services/observationService';
import * as observationEngine from '../services/observationEngine';

const router = Router();

const adminAuth = [
  authenticate,
  requirePasswordChange,
  authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN),
  scopeToMda,
];

const viewAuth = [
  authenticate,
  requirePasswordChange,
  authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN, ROLES.MDA_OFFICER),
  scopeToMda,
];

// GET /api/observations — List observations with filters + pagination
router.get(
  '/observations',
  ...viewAuth,
  validateQuery(observationQuerySchema),
  auditLog,
  async (req: Request, res: Response) => {
    const filters = {
      page: req.query.page ? Number(req.query.page) : undefined,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : undefined,
      type: req.query.type as string | undefined,
      mdaId: req.query.mdaId as string | undefined,
      status: req.query.status as string | undefined,
      staffName: req.query.staffName as string | undefined,
      sortBy: req.query.sortBy as string | undefined,
      sortOrder: req.query.sortOrder as string | undefined,
    };
    const data = await observationService.listObservations(
      filters as Parameters<typeof observationService.listObservations>[0],
      req.mdaScope,
    );
    res.json({ success: true, data });
  },
);

// GET /api/observations/counts — Aggregate counts by type and status
router.get(
  '/observations/counts',
  ...viewAuth,
  auditLog,
  async (req: Request, res: Response) => {
    const data = await observationService.getObservationCounts(req.mdaScope);
    res.json({ success: true, data });
  },
);

// PATCH /api/observations/:id/review — Mark as reviewed
router.patch(
  '/observations/:id/review',
  ...adminAuth,
  validate(reviewObservationSchema),
  auditLog,
  async (req: Request, res: Response) => {
    await observationService.markAsReviewed(
      req.params.id as string,
      req.user!.userId,
      req.body.note,
    );
    res.json({ success: true, message: 'Observation marked as reviewed' });
  },
);

// PATCH /api/observations/:id/resolve — Mark as resolved
router.patch(
  '/observations/:id/resolve',
  ...adminAuth,
  validate(resolveObservationSchema),
  auditLog,
  async (req: Request, res: Response) => {
    await observationService.markAsResolved(
      req.params.id as string,
      req.user!.userId,
      req.body.resolutionNote,
    );
    res.json({ success: true, message: 'Observation resolved' });
  },
);

// POST /api/observations/:id/promote — Promote to exception
router.post(
  '/observations/:id/promote',
  ...adminAuth,
  validate(promoteObservationSchema),
  auditLog,
  async (req: Request, res: Response) => {
    const result = await observationService.promoteToException(
      req.params.id as string,
      req.user!.userId,
      req.body.priority,
    );
    res.json({ success: true, data: result, message: 'Observation promoted to exception' });
  },
);

// POST /api/observations/generate — Manually trigger observation generation
router.post(
  '/observations/generate',
  ...adminAuth,
  validate(generateObservationsSchema),
  auditLog,
  async (req: Request, res: Response) => {
    const result = await observationEngine.generateObservations(
      req.body.uploadId,
      req.user!.userId,
    );
    res.json({ success: true, data: result, message: 'Observations generated' });
  },
);

export default router;
