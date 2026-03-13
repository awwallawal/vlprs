import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import path from 'path';
import { authenticate } from '../middleware/authenticate';
import { requirePasswordChange } from '../middleware/requirePasswordChange';
import { authorise } from '../middleware/authorise';
import { scopeToMda } from '../middleware/scopeToMda';
import { validateQuery } from '../middleware/validate';
import { auditLog } from '../middleware/auditLog';
import { writeLimiter, readLimiter } from '../middleware/rateLimiter';
import { ROLES, submissionListQuerySchema, VOCABULARY } from '@vlprs/shared';
import { AppError } from '../lib/appError';
import { param } from '../lib/params';
import * as submissionService from '../services/submissionService';

const router = Router();

// CSV upload middleware — memory storage, 5MB limit, CSV-only
const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.csv') {
      cb(null, true);
    } else {
      cb(new AppError(400, 'INVALID_FILE_TYPE', VOCABULARY.SUBMISSION_FILE_TYPE));
    }
  },
});

// Write auth: DEPT_ADMIN + MDA_OFFICER only
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

// POST /submissions/upload — Upload CSV and process atomically
router.post(
  '/submissions/upload',
  ...writeAuth,
  writeLimiter,
  csvUpload.single('file'),
  auditLog,
  async (req: Request, res: Response) => {
    if (!req.file) {
      throw new AppError(400, 'MISSING_FILE', 'No file uploaded');
    }

    const result = await submissionService.processSubmission(
      req.file,
      (req as Request & { mdaScope?: string | null }).mdaScope ?? null,
      (req as Request & { user?: { id: string } }).user!.id,
    );

    res.status(201).json({
      success: true,
      data: result,
    });
  },
);

// GET /submissions — Paginated submission list
router.get(
  '/submissions',
  ...readAuth,
  readLimiter,
  auditLog,
  validateQuery(submissionListQuerySchema),
  async (req: Request, res: Response) => {
    const { page, pageSize, period, mdaId } = req.query as {
      page?: string;
      pageSize?: string;
      period?: string;
      mdaId?: string;
    };

    const result = await submissionService.getSubmissions(
      (req as Request & { mdaScope?: string | null }).mdaScope ?? null,
      {
        page: page ? parseInt(page, 10) : 1,
        pageSize: pageSize ? parseInt(pageSize, 10) : 20,
        period,
        mdaId,
      },
    );

    res.json({
      success: true,
      data: result,
    });
  },
);

// GET /submissions/:id — Submission detail with rows
router.get(
  '/submissions/:id',
  ...readAuth,
  readLimiter,
  auditLog,
  async (req: Request, res: Response) => {
    const id = param(req.params.id);

    const result = await submissionService.getSubmissionById(
      id,
      (req as Request & { mdaScope?: string | null }).mdaScope ?? null,
    );

    res.json({
      success: true,
      data: result,
    });
  },
);

export default router;
