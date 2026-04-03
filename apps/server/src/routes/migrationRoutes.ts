import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import path from 'path';
import { authenticate } from '../middleware/authenticate';
import { requirePasswordChange } from '../middleware/requirePasswordChange';
import { authorise } from '../middleware/authorise';
import { scopeToMda } from '../middleware/scopeToMda';
import { validate, validateQuery } from '../middleware/validate';
import { auditLog } from '../middleware/auditLog';
import { ROLES, migrationUploadQuerySchema, confirmMappingBodySchema, validationResultQuerySchema, createBaselineBodySchema, correctMigrationRecordSchema, supersedeSchema, checkOverlapBodySchema } from '@vlprs/shared';
import type { VarianceCategory } from '@vlprs/shared';
import { AppError } from '../lib/appError';
import { param } from '../lib/params';
import * as migrationService from '../services/migrationService';
import * as migrationValidationService from '../services/migrationValidationService';
import * as baselineService from '../services/baselineService';
import * as supersedeService from '../services/supersedeService';

const router = Router();

// File upload middleware
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.xlsx', '.csv', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new AppError(400, 'INVALID_FILE_TYPE', 'Only .xlsx, .csv, and .xls files are accepted.'));
    }
  },
});

// Middleware stack: super_admin + dept_admin only
const adminAuth = [
  authenticate,
  requirePasswordChange,
  authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN),
  scopeToMda,
];

// POST /api/migrations/upload — Upload file and get preview with auto-detected mappings
router.post(
  '/migrations/upload',
  ...adminAuth,
  upload.single('file'),
  auditLog,
  async (req: Request, res: Response) => {
    if (!req.file) {
      throw new AppError(400, 'FILE_REQUIRED', 'Please select a file to upload.');
    }

    const mdaId = req.body.mdaId;
    if (!mdaId) {
      throw new AppError(400, 'MDA_REQUIRED', 'Please select an MDA for this upload.');
    }

    const preview = await migrationService.previewUpload(
      req.file.buffer,
      req.file.originalname,
      req.file.size,
      mdaId,
      req.user!.userId,
    );

    res.status(201).json({ success: true, data: preview });
  },
);

// POST /api/migrations/:id/confirm — Confirm column mapping and extract records
router.post(
  '/migrations/:id/confirm',
  ...adminAuth,
  upload.single('file'),
  validate(confirmMappingBodySchema),
  auditLog,
  async (req: Request, res: Response) => {
    const uploadId = param(req.params.id);

    if (!req.file) {
      throw new AppError(400, 'FILE_REQUIRED', 'Please re-upload the file to confirm mapping.');
    }

    const result = await migrationService.confirmMapping(
      uploadId,
      req.body.sheets,
      req.file.buffer,
    );

    res.json({ success: true, data: result });
  },
);

// POST /api/migrations/:id/confirm-overlap — Explicitly confirm proceeding despite period overlap
router.post(
  '/migrations/:id/confirm-overlap',
  ...adminAuth,
  auditLog,
  async (req: Request, res: Response) => {
    const uploadId = param(req.params.id);
    const result = await migrationService.confirmOverlap(uploadId);
    res.json({ success: true, data: result });
  },
);

// POST /api/migrations/:id/check-overlap — Check if upload overlaps existing period+MDA data (Story 8.0d: multi-sheet)
router.post(
  '/migrations/:id/check-overlap',
  ...adminAuth,
  validate(checkOverlapBodySchema),
  async (req: Request, res: Response) => {
    const uploadId = param(req.params.id);
    const { sheetPeriods } = req.body;
    const result = await migrationService.checkMultiSheetOverlap(uploadId, sheetPeriods);
    res.json({ success: true, data: result });
  },
);

// PATCH /api/migrations/:id/discard — Discard an incomplete upload (Story 8.0c)
router.patch(
  '/migrations/:id/discard',
  ...adminAuth,
  auditLog,
  async (req: Request, res: Response) => {
    const uploadId = param(req.params.id);
    const result = await migrationService.discardUpload(uploadId, req.mdaScope);
    res.json({ success: true, data: result });
  },
);

// GET /api/migrations — List uploads for MDA with pagination
router.get(
  '/migrations',
  ...adminAuth,
  validateQuery(migrationUploadQuerySchema),
  async (req: Request, res: Response) => {
    const filters = {
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
      status: req.query.status as string | undefined,
    };

    const result = await migrationService.listUploads(filters, req.mdaScope);
    res.json({ success: true, data: result.data, pagination: result.pagination });
  },
);

// GET /api/migrations/:id — Get upload detail with record summary
router.get(
  '/migrations/:id',
  ...adminAuth,
  async (req: Request, res: Response) => {
    const uploadId = param(req.params.id);
    const upload = await migrationService.getUpload(uploadId, req.mdaScope);
    res.json({ success: true, data: upload });
  },
);

// POST /api/migrations/:id/validate — Trigger validation for an upload
router.post(
  '/migrations/:id/validate',
  ...adminAuth,
  auditLog,
  async (req: Request, res: Response) => {
    const uploadId = param(req.params.id);
    const summary = await migrationValidationService.validateUpload(uploadId, req.mdaScope);
    res.json({ success: true, data: summary });
  },
);

// GET /api/migrations/:id/validation — Get validation results
router.get(
  '/migrations/:id/validation',
  ...adminAuth,
  validateQuery(validationResultQuerySchema),
  async (req: Request, res: Response) => {
    const uploadId = param(req.params.id);
    const params = {
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 50,
      category: req.query.category as VarianceCategory | undefined,
      sortBy: (req.query.sortBy as string) || 'variance_amount',
      sortOrder: (req.query.sortOrder as string) || 'desc',
    };

    const result = await migrationValidationService.getValidationResults(uploadId, params, req.mdaScope);
    res.json({ success: true, data: result });
  },
);

// GET /api/migrations/:uploadId/records/:recordId — Record detail (Story 8.0b)
router.get(
  '/migrations/:uploadId/records/:recordId',
  ...adminAuth,
  async (req: Request, res: Response) => {
    const uploadId = param(req.params.uploadId);
    const recordId = param(req.params.recordId);

    const detail = await migrationValidationService.getRecordDetail(recordId, uploadId, req.mdaScope);

    res.json({ success: true, data: detail });
  },
);

// PATCH /api/migrations/:uploadId/records/:recordId/correct — Apply correction (Story 8.0b)
router.patch(
  '/migrations/:uploadId/records/:recordId/correct',
  ...adminAuth,
  validate(correctMigrationRecordSchema),
  auditLog,
  async (req: Request, res: Response) => {
    const uploadId = param(req.params.uploadId);
    const recordId = param(req.params.recordId);

    const detail = await migrationValidationService.correctRecord(
      recordId,
      uploadId,
      req.body,
      req.user!.userId,
      req.mdaScope,
    );

    res.json({ success: true, data: detail });
  },
);

// POST /api/migrations/:uploadId/records/:recordId/baseline — Single record baseline
router.post(
  '/migrations/:uploadId/records/:recordId/baseline',
  ...adminAuth,
  validate(createBaselineBodySchema),
  auditLog,
  async (req: Request, res: Response) => {
    const uploadId = param(req.params.uploadId);
    const recordId = param(req.params.recordId);

    const result = await baselineService.createBaseline(
      { userId: req.user!.userId, role: req.user!.role, mdaId: req.user!.mdaId ?? null },
      uploadId,
      recordId,
      req.mdaScope,
    );

    res.status(201).json({ success: true, data: result });
  },
);

// POST /api/migrations/:uploadId/baseline — Batch baseline for all records in upload
router.post(
  '/migrations/:uploadId/baseline',
  ...adminAuth,
  validate(createBaselineBodySchema),
  auditLog,
  async (req: Request, res: Response) => {
    const uploadId = param(req.params.uploadId);

    const result = await baselineService.createBatchBaseline(
      { userId: req.user!.userId, role: req.user!.role, mdaId: req.user!.mdaId ?? null },
      uploadId,
      req.mdaScope,
    );

    res.status(201).json({ success: true, data: result });
  },
);

// GET /api/migrations/:uploadId/baseline-summary — Get baseline creation summary
router.get(
  '/migrations/:uploadId/baseline-summary',
  ...adminAuth,
  async (req: Request, res: Response) => {
    const uploadId = param(req.params.uploadId);

    const summary = await baselineService.getBaselineSummary(uploadId, req.mdaScope);

    res.json({ success: true, data: summary });
  },
);

// POST /api/migrations/:uploadId/supersede — Supersede an upload with a replacement
router.post(
  '/migrations/:uploadId/supersede',
  ...adminAuth,
  validate(supersedeSchema),
  auditLog,
  async (req: Request, res: Response) => {
    const uploadId = param(req.params.uploadId);
    req.auditAction = 'MIGRATION_SUPERSEDE';

    const result = await supersedeService.supersedeUpload(
      uploadId,
      req.body.replacementUploadId,
      req.body.reason,
      req.user!.userId,
    );

    res.json({ success: true, data: result });
  },
);

export default router;
