/**
 * Payroll Upload Routes (Story 7.0h).
 * SUPER_ADMIN only — AG uploads consolidated monthly payroll extracts.
 *
 * POST /payroll/upload   — preview (delineation summary)
 * POST /payroll/confirm  — confirm and persist
 * GET  /payroll          — list payroll uploads
 * GET  /payroll/:id      — payroll upload detail with per-MDA breakdown
 */
import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import path from 'path';
import { authenticate } from '../middleware/authenticate';
import { requirePasswordChange } from '../middleware/requirePasswordChange';
import { authorise } from '../middleware/authorise';
import { validate, validateQuery } from '../middleware/validate';
import { auditLog } from '../middleware/auditLog';
import { writeLimiter, readLimiter } from '../middleware/rateLimiter';
import { param } from '../lib/params';
import { AppError } from '../lib/appError';
import { ROLES, VOCABULARY, payrollConfirmSchema, payrollListQuerySchema } from '@vlprs/shared';
import * as payrollService from '../services/payrollUploadService';

const router = Router();

// ─── File Upload Middleware ──────────────────────────────────────────

const payrollUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per AC 2
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.csv' || ext === '.xlsx' || ext === '.xls') {
      cb(null, true);
    } else {
      cb(new AppError(400, 'PAYROLL_INVALID_FILE_TYPE', VOCABULARY.PAYROLL_INVALID_FILE_TYPE));
    }
  },
});

// ─── Auth Middleware ─────────────────────────────────────────────────
// SUPER_ADMIN only — no scopeToMda (AG sees all MDAs)

const writeAuth = [
  authenticate,
  requirePasswordChange,
  authorise(ROLES.SUPER_ADMIN),
];

const readAuth = [
  authenticate,
  requirePasswordChange,
  authorise(ROLES.SUPER_ADMIN),
];

// ─── POST /payroll/upload — Preview (delineation summary) ────────────

router.post(
  '/payroll/upload',
  ...writeAuth,
  writeLimiter,
  payrollUpload.single('file'),
  auditLog,
  async (req: Request, res: Response) => {
    req.auditAction = 'PAYROLL_UPLOAD_PROCESSED';

    if (!req.file) {
      throw new AppError(400, 'PAYROLL_MISSING_FILE', VOCABULARY.PAYROLL_MISSING_FILE);
    }

    const summary = await payrollService.previewPayrollUpload(
      req.file.buffer,
      req.file.originalname,
      req.file.size,
      req.user!.userId,
    );

    res.status(200).json({
      success: true,
      data: summary,
    });
  },
);

// ─── POST /payroll/confirm — Confirm and persist ─────────────────────

router.post(
  '/payroll/confirm',
  ...writeAuth,
  writeLimiter,
  validate(payrollConfirmSchema),
  auditLog,
  async (req: Request, res: Response) => {
    req.auditAction = 'PAYROLL_UPLOAD_CONFIRMED';

    const { period } = req.body as { period: string };

    const result = await payrollService.confirmPayrollUpload(
      period,
      req.user!.userId,
    );

    res.status(201).json({
      success: true,
      data: result,
    });
  },
);

// ─── GET /payroll — List payroll uploads ─────────────────────────────

router.get(
  '/payroll',
  ...readAuth,
  readLimiter,
  validateQuery(payrollListQuerySchema),
  auditLog,
  async (req: Request, res: Response) => {
    req.auditAction = 'PAYROLL_LIST_VIEWED';

    const { period } = req.query as { period?: string };

    const items = await payrollService.listPayrollUploads({ period });

    res.json({
      success: true,
      data: items,
    });
  },
);

// ─── GET /payroll/:id — Payroll upload detail ────────────────────────

router.get(
  '/payroll/:id',
  ...readAuth,
  readLimiter,
  auditLog,
  async (req: Request, res: Response) => {
    req.auditAction = 'PAYROLL_DETAIL_VIEWED';

    const id = param(req.params.id);

    const detail = await payrollService.getPayrollUploadDetail(id);

    res.json({
      success: true,
      data: detail,
    });
  },
);

export default router;
