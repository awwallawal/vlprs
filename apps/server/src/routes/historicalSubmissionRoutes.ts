import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import path from 'path';
import { authenticate } from '../middleware/authenticate';
import { requirePasswordChange } from '../middleware/requirePasswordChange';
import { authorise } from '../middleware/authorise';
import { scopeToMda } from '../middleware/scopeToMda';
import { validate } from '../middleware/validate';
import { auditLog } from '../middleware/auditLog';
import { writeLimiter, readLimiter } from '../middleware/rateLimiter';
import { ROLES, flagDiscrepancySchema, VOCABULARY } from '@vlprs/shared';
import { AppError } from '../lib/appError';
import { param } from '../lib/params';
import * as historicalService from '../services/historicalSubmissionService';

const router = Router();

// CSV upload middleware — same config as Story 5.1
const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.csv') {
      cb(null, true);
    } else {
      cb(new AppError(400, 'INVALID_FILE_TYPE', VOCABULARY.SUBMISSION_FILE_TYPE));
    }
  },
});

// Write auth: DEPT_ADMIN + MDA_OFFICER
const writeAuth = [
  authenticate,
  requirePasswordChange,
  authorise(ROLES.DEPT_ADMIN, ROLES.MDA_OFFICER),
  scopeToMda,
];

// Read auth: all roles
const readAuth = [
  authenticate,
  requirePasswordChange,
  authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN, ROLES.MDA_OFFICER),
  scopeToMda,
];

// Flag auth: SUPER_ADMIN + DEPT_ADMIN + MDA_OFFICER (Task 3.7)
const flagAuth = [
  authenticate,
  requirePasswordChange,
  authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN, ROLES.MDA_OFFICER),
  scopeToMda,
];

// POST /submissions/historical — Upload historical CSV
router.post(
  '/submissions/historical',
  ...writeAuth,
  writeLimiter,
  csvUpload.single('file'),
  auditLog,
  async (req: Request, res: Response) => {
    req.auditAction = 'HISTORICAL_UPLOAD_PROCESSED';
    if (!req.file) {
      throw new AppError(400, 'MISSING_FILE', 'No file uploaded');
    }

    const result = await historicalService.processHistoricalUpload(
      req.file.buffer,
      (req as Request & { mdaScope?: string | null }).mdaScope ?? null,
      req.user!.userId,
      { filename: req.file.originalname, fileSizeBytes: req.file.size },
    );

    res.status(201).json({
      success: true,
      data: result,
    });
  },
);

// GET /submissions/:submissionId/historical-reconciliation — Reconciliation view
router.get(
  '/submissions/:submissionId/historical-reconciliation',
  ...readAuth,
  readLimiter,
  auditLog,
  async (req: Request, res: Response) => {
    req.auditAction = 'HISTORICAL_RECONCILIATION_VIEWED';
    const submissionId = param(req.params.submissionId);
    const mdaScope = (req as Request & { mdaScope?: string | null }).mdaScope ?? null;

    const result = await historicalService.getHistoricalReconciliation(submissionId, mdaScope);

    res.json({
      success: true,
      data: result,
    });
  },
);

// PATCH /submissions/:submissionId/historical-reconciliation/flag — Flag discrepancy
router.patch(
  '/submissions/:submissionId/historical-reconciliation/flag',
  ...flagAuth,
  writeLimiter,
  validate(flagDiscrepancySchema),
  auditLog,
  async (req: Request, res: Response) => {
    req.auditAction = 'HISTORICAL_DISCREPANCY_FLAGGED';
    const submissionId = param(req.params.submissionId);
    const mdaScope = (req as Request & { mdaScope?: string | null }).mdaScope ?? null;
    const { staffId, reason } = req.body as { staffId: string; reason: string };

    await historicalService.flagDiscrepancy(
      submissionId,
      staffId,
      reason,
      req.user!.userId,
      mdaScope,
    );

    res.json({
      success: true,
      data: { message: VOCABULARY.HISTORICAL_DISCREPANCY_FLAGGED },
    });
  },
);

export default router;
