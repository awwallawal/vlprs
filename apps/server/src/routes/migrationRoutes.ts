import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import path from 'path';
import { authenticate } from '../middleware/authenticate';
import { requirePasswordChange } from '../middleware/requirePasswordChange';
import { authorise } from '../middleware/authorise';
import { scopeToMda } from '../middleware/scopeToMda';
import { validate, validateQuery } from '../middleware/validate';
import { auditLog } from '../middleware/auditLog';
import { ROLES, migrationUploadQuerySchema, confirmMappingBodySchema, validationResultQuerySchema } from '@vlprs/shared';
import type { VarianceCategory } from '@vlprs/shared';
import { AppError } from '../lib/appError';
import { param } from '../lib/params';
import * as migrationService from '../services/migrationService';
import * as migrationValidationService from '../services/migrationValidationService';

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

export default router;
