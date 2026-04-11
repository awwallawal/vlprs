/**
 * delineationRoutes — API endpoints for file delineation and deduplication.
 *
 * Story 3.8: Multi-MDA File Delineation & Deduplication
 */

import { Router, type Request, type Response } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requirePasswordChange } from '../middleware/requirePasswordChange';
import { authorise } from '../middleware/authorise';
import { scopeToMda } from '../middleware/scopeToMda';
import { validate, validateQuery } from '../middleware/validate';
import { auditLog } from '../middleware/auditLog';
import {
  ROLES,
  confirmDelineationSchema,
  resolveDuplicateSchema,
  duplicateListQuerySchema,
} from '@vlprs/shared';
import { param } from '../lib/params';
import * as fileDelineationService from '../services/fileDelineationService';
import * as deduplicationService from '../services/deduplicationService';

const router = Router();

// Middleware stack: super_admin + dept_admin only
const adminAuth = [
  authenticate,
  requirePasswordChange,
  authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN),
  scopeToMda,
];

// ─── Delineation Endpoints ──────────────────────────────────────────

// POST /api/migrations/:uploadId/delineate — Trigger boundary detection for an upload
router.post(
  '/migrations/:uploadId/delineate',
  ...adminAuth,
  auditLog,
  async (req: Request, res: Response) => {
    const uploadId = param(req.params.uploadId);
    const result = await fileDelineationService.detectBoundaries(uploadId, req.mdaScope);
    res.json({ success: true, data: result });
  },
);

// GET /api/migrations/:uploadId/delineation — Get delineation preview
router.get(
  '/migrations/:uploadId/delineation',
  ...adminAuth,
  async (req: Request, res: Response) => {
    const uploadId = param(req.params.uploadId);
    const result = await fileDelineationService.getDelineationPreview(uploadId, req.mdaScope);
    res.json({ success: true, data: result });
  },
);

// POST /api/migrations/:uploadId/delineation/confirm — Confirm boundaries
router.post(
  '/migrations/:uploadId/delineation/confirm',
  ...adminAuth,
  validate(confirmDelineationSchema),
  auditLog,
  async (req: Request, res: Response) => {
    const uploadId = param(req.params.uploadId);
    const result = await fileDelineationService.confirmBoundaries(
      uploadId,
      req.body.sections,
      req.user!.userId,
      req.mdaScope,
    );
    res.json({ success: true, data: result });
  },
);

// ─── Deduplication Endpoints ────────────────────────────────────────

// POST /api/migrations/deduplicate — Trigger cross-file duplicate detection
router.post(
  '/migrations/deduplicate',
  ...adminAuth,
  auditLog,
  async (req: Request, res: Response) => {
    const result = await deduplicationService.detectCrossFileDuplicates(req.mdaScope);
    res.json({ success: true, data: result });
  },
);

// GET /api/migrations/duplicates — List pending duplicate candidates
router.get(
  '/migrations/duplicates',
  ...adminAuth,
  validateQuery(duplicateListQuerySchema),
  async (req: Request, res: Response) => {
    const filters = {
      page: Number(req.query.page) || 1,
      pageSize: Number(req.query.pageSize) || 20,
      parentMdaId: req.query.parentMdaId as string | undefined,
      childMdaId: req.query.childMdaId as string | undefined,
      status: req.query.status as string | undefined,
      staffName: req.query.staffName as string | undefined,
    };

    const result = await deduplicationService.listPendingDuplicates(filters, req.mdaScope);
    res.json({ success: true, data: { data: result.data, pagination: result.pagination } });
  },
);

// GET /api/migrations/duplicates/:candidateId/records — Detail records for side-by-side comparison
router.get(
  '/migrations/duplicates/:candidateId/records',
  ...adminAuth,
  async (req: Request, res: Response) => {
    const candidateId = param(req.params.candidateId);
    const result = await deduplicationService.getDuplicateRecordDetail(candidateId, req.mdaScope);
    res.json({ success: true, data: result });
  },
);

// PATCH /api/migrations/duplicates/:id/resolve — Resolve a duplicate candidate
router.patch(
  '/migrations/duplicates/:id/resolve',
  ...adminAuth,
  validate(resolveDuplicateSchema),
  auditLog,
  async (req: Request, res: Response) => {
    const candidateId = param(req.params.id);
    const result = await deduplicationService.resolveDuplicate(
      candidateId,
      req.body.resolution,
      req.user!.userId,
      req.body.note,
    );
    res.json({ success: true, data: result });
  },
);

export default router;
