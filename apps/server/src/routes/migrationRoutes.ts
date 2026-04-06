import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import path from 'path';
import { authenticate } from '../middleware/authenticate';
import { requirePasswordChange } from '../middleware/requirePasswordChange';
import { authorise } from '../middleware/authorise';
import { scopeToMda } from '../middleware/scopeToMda';
import { validate, validateQuery } from '../middleware/validate';
import { auditLog } from '../middleware/auditLog';
import { ROLES, migrationUploadQuerySchema, confirmMappingBodySchema, validationResultQuerySchema, createBaselineBodySchema, correctMigrationRecordSchema, supersedeSchema, checkOverlapBodySchema, submitReviewSchema, markReviewedSchema, extendWindowSchema, flaggedRecordsQuerySchema, worksheetApplySchema, rejectUploadSchema } from '@vlprs/shared';
import type { VarianceCategory } from '@vlprs/shared';
import { AppError } from '../lib/appError';
import { param } from '../lib/params';
import * as migrationService from '../services/migrationService';
import * as migrationValidationService from '../services/migrationValidationService';
import * as baselineService from '../services/baselineService';
import * as supersedeService from '../services/supersedeService';
import * as mdaReviewService from '../services/mdaReviewService';
import * as correctionWorksheetService from '../services/correctionWorksheetService';

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

// Middleware stack: upload flow — includes MDA_OFFICER (Story 15.0f)
const uploadAuth = [
  authenticate,
  requirePasswordChange,
  authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN, ROLES.MDA_OFFICER),
  scopeToMda,
];

// POST /api/migrations/upload — Upload file and get preview with auto-detected mappings
router.post(
  '/migrations/upload',
  ...uploadAuth,
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

    // MDA officers can only upload for their assigned MDA (Story 15.0f)
    if (req.user!.role === ROLES.MDA_OFFICER && mdaId !== req.mdaScope) {
      throw new AppError(403, 'CANNOT_UPLOAD_FOR_OTHER_MDA', 'You can only upload data for your assigned MDA');
    }

    const preview = await migrationService.previewUpload(
      req.file.buffer,
      req.file.originalname,
      req.file.size,
      mdaId,
      req.user!.userId,
      req.user!.role,
    );

    res.status(201).json({ success: true, data: preview });
  },
);

// POST /api/migrations/:id/confirm — Confirm column mapping and extract records
router.post(
  '/migrations/:id/confirm',
  ...uploadAuth,
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
  ...uploadAuth,
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
  ...uploadAuth,
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
  ...uploadAuth,
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
  ...uploadAuth,
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
  ...uploadAuth,
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

// ─── Federated Upload: Admin Approve/Reject (Story 15.0f) ──────────

// PATCH /api/migrations/:uploadId/approve — Admin approves pending MDA officer upload
router.patch(
  '/migrations/:uploadId/approve',
  ...adminAuth,
  auditLog,
  async (req: Request, res: Response) => {
    const uploadId = param(req.params.uploadId);
    const result = await migrationService.approveUpload(uploadId, req.user!.userId, req.mdaScope);
    res.json({ success: true, data: result });
  },
);

// PATCH /api/migrations/:uploadId/reject — Admin rejects pending MDA officer upload
router.patch(
  '/migrations/:uploadId/reject',
  ...adminAuth,
  validate(rejectUploadSchema),
  auditLog,
  async (req: Request, res: Response) => {
    const uploadId = param(req.params.uploadId);
    const { reason } = req.body;
    const result = await migrationService.rejectUpload(uploadId, req.user!.userId, reason, req.mdaScope);
    res.json({ success: true, data: result });
  },
);

// ─── MDA Review Routes (Story 8.0j) ────────────────────────────────

// Middleware stack: includes MDA_OFFICER for review actions
const reviewAuth = [
  authenticate,
  requirePasswordChange,
  authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN, ROLES.MDA_OFFICER),
  scopeToMda,
];

// GET /api/migrations/:uploadId/review/records — Paginated flagged records (reviewAuth)
router.get(
  '/migrations/:uploadId/review/records',
  ...reviewAuth,
  validateQuery(flaggedRecordsQuerySchema),
  async (req: Request, res: Response) => {
    const uploadId = param(req.params.uploadId);
    const { page, limit, status } = req.query as unknown as { page: number; limit: number; status: 'pending' | 'reviewed' | 'all' };

    const result = await mdaReviewService.getFlaggedRecords(uploadId, req.mdaScope, { page, limit, status });

    res.json({ success: true, data: result });
  },
);

// PATCH /api/migrations/:uploadId/records/:recordId/review — Submit review with corrections + mandatory reason (reviewAuth)
router.patch(
  '/migrations/:uploadId/records/:recordId/review',
  ...reviewAuth,
  validate(submitReviewSchema),
  auditLog,
  async (req: Request, res: Response) => {
    const uploadId = param(req.params.uploadId);
    const recordId = param(req.params.recordId);
    const { correctionReason, ...corrections } = req.body;

    const result = await mdaReviewService.submitReview(
      recordId,
      uploadId,
      corrections,
      correctionReason,
      req.user!.userId,
      req.mdaScope,
    );

    res.json({ success: true, data: result });
  },
);

// PATCH /api/migrations/:uploadId/records/:recordId/mark-reviewed — Mark reviewed without corrections (reviewAuth)
router.patch(
  '/migrations/:uploadId/records/:recordId/mark-reviewed',
  ...reviewAuth,
  validate(markReviewedSchema),
  auditLog,
  async (req: Request, res: Response) => {
    const uploadId = param(req.params.uploadId);
    const recordId = param(req.params.recordId);

    const result = await mdaReviewService.markReviewedNoCorrection(
      recordId,
      uploadId,
      req.body.correctionReason,
      req.user!.userId,
      req.mdaScope,
    );

    res.json({ success: true, data: result });
  },
);

// GET /api/migrations/:uploadId/review/progress — Per-MDA progress tracker (adminAuth — DEPT_ADMIN/SUPER_ADMIN only)
router.get(
  '/migrations/:uploadId/review/progress',
  ...adminAuth,
  async (req: Request, res: Response) => {
    const uploadId = param(req.params.uploadId);

    const result = await mdaReviewService.getMdaReviewProgress(uploadId);

    res.json({ success: true, data: result });
  },
);

// POST /api/migrations/:uploadId/review/extend-window — Extend review window for specific MDA (adminAuth)
router.post(
  '/migrations/:uploadId/review/extend-window',
  ...adminAuth,
  validate(extendWindowSchema),
  auditLog,
  async (req: Request, res: Response) => {
    const uploadId = param(req.params.uploadId);

    await mdaReviewService.extendReviewWindow(uploadId, req.body.mdaId, req.user!.userId);

    res.json({ success: true, data: { message: 'Review window extended by 14 days.' } });
  },
);

// GET /api/migrations/:uploadId/review/worksheet — Download correction worksheet XLSX (reviewAuth)
router.get(
  '/migrations/:uploadId/review/worksheet',
  ...reviewAuth,
  async (req: Request, res: Response) => {
    const uploadId = param(req.params.uploadId);

    const buffer = await correctionWorksheetService.generateCorrectionWorksheet(uploadId, req.mdaScope);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="correction-worksheet-${uploadId.slice(0, 8)}.xlsx"`);
    res.send(buffer);
  },
);

// POST /api/migrations/:uploadId/review/worksheet — Upload correction worksheet + return preview (reviewAuth)
router.post(
  '/migrations/:uploadId/review/worksheet',
  ...reviewAuth,
  upload.single('file'),
  async (req: Request, res: Response) => {
    const uploadId = param(req.params.uploadId);

    if (!req.file) {
      throw new AppError(400, 'NO_FILE', 'No file was uploaded.');
    }

    const preview = await correctionWorksheetService.parseCorrectionWorksheet(
      req.file.buffer,
      uploadId,
      req.mdaScope,
    );

    res.json({ success: true, data: preview });
  },
);

// POST /api/migrations/:uploadId/review/worksheet/apply — Apply parsed worksheet corrections (reviewAuth)
router.post(
  '/migrations/:uploadId/review/worksheet/apply',
  ...reviewAuth,
  validate(worksheetApplySchema),
  auditLog,
  async (req: Request, res: Response) => {
    const uploadId = param(req.params.uploadId);
    const preview = req.body;

    const result = await correctionWorksheetService.applyCorrectionWorksheet(
      uploadId,
      preview,
      req.user!.userId,
      req.mdaScope,
    );

    res.json({ success: true, data: result });
  },
);

// POST /api/migrations/:uploadId/baseline-reviewed — Baseline all reviewed records (adminAuth — Stage 3)
router.post(
  '/migrations/:uploadId/baseline-reviewed',
  ...adminAuth,
  auditLog,
  async (req: Request, res: Response) => {
    const uploadId = param(req.params.uploadId);

    const result = await mdaReviewService.baselineReviewedRecords(
      uploadId,
      req.mdaScope,
      req.user!.userId,
      req.user!.role,
    );

    res.json({ success: true, data: result });
  },
);

export default router;
