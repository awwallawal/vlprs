import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/authenticate';
import { requirePasswordChange } from '../middleware/requirePasswordChange';
import { authorise } from '../middleware/authorise';
import { auditLog } from '../middleware/auditLog';
import { ROLES, createBatchSchema, confirmUploadSchema, processRetireeSchema, threeVectorValidateSchema, matchClassifySchema } from '@vlprs/shared';
import { validate } from '../middleware/validate';
import { AppError } from '../lib/appError';
import { param } from '../lib/params';
import * as committeeListService from '../services/committeeListService';

const router = Router();

const committeeUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (allowed.includes(file.mimetype) || file.originalname.endsWith('.xlsx') || file.originalname.endsWith('.xls')) {
      cb(null, true);
    } else {
      cb(new AppError(400, 'INVALID_FILE_TYPE', 'Only Excel files (.xlsx, .xls) are accepted'));
    }
  },
});

const adminAuth = [
  authenticate,
  requirePasswordChange,
  authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN),
  auditLog,
];

// POST /api/committee-lists/upload — parse uploaded file, return preview
router.post(
  '/committee-lists/upload',
  authenticate,
  requirePasswordChange,
  authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN),
  committeeUpload.single('file'),
  auditLog,
  async (req: Request, res: Response) => {
    if (!req.file) {
      throw new AppError(400, 'NO_FILE', 'No file uploaded');
    }

    const preview = await committeeListService.parseCommitteeFile(
      req.file.buffer,
      req.file.originalname,
    );

    res.json({ success: true, data: preview });
  },
);

// POST /api/committee-lists/confirm — confirm parsed data + MDA mappings, create records
router.post(
  '/committee-lists/confirm',
  ...adminAuth,
  validate(confirmUploadSchema),
  async (req: Request, res: Response) => {
    const { records, mdaMappings, batchId } = req.body as {
      records: committeeListService.ParsedRecord[];
      mdaMappings: Record<string, string>;
      batchId: string;
    };

    const result = await committeeListService.confirmUpload(records, mdaMappings, batchId);

    res.json({ success: true, data: result });
  },
);

// POST /api/committee-lists/batches — create new batch
router.post(
  '/committee-lists/batches',
  ...adminAuth,
  validate(createBatchSchema),
  async (req: Request, res: Response) => {
    const { label, listType, year, notes } = req.body as {
      label: string;
      listType: string;
      year?: number;
      notes?: string;
    };

    const userId = req.user!.userId;
    const batch = await committeeListService.createBatch(label, listType, userId, year, notes);

    res.status(201).json({ success: true, data: batch });
  },
);

// GET /api/committee-lists/batches — list all batches
router.get(
  '/committee-lists/batches',
  ...adminAuth,
  async (_req: Request, res: Response) => {
    const batches = await committeeListService.listBatches();
    res.json({ success: true, data: batches });
  },
);

// GET /api/committee-lists/batches/:batchId — batch detail with beneficiary list
router.get(
  '/committee-lists/batches/:batchId',
  ...adminAuth,
  async (req: Request, res: Response) => {
    const batchId = param(req.params.batchId);
    const detail = await committeeListService.getBatchDetail(batchId);
    res.json({ success: true, data: detail });
  },
);

// ─── Track 2: Three-Vector Validation (Step 3) ───────────────────────

// POST /api/committee-lists/validate — run three-vector validation on retiree records
router.post(
  '/committee-lists/validate',
  ...adminAuth,
  validate(threeVectorValidateSchema),
  async (req: Request, res: Response) => {
    const { records } = req.body as {
      records: committeeListService.ParsedRecord[];
    };

    const results = committeeListService.threeVectorValidation(records);
    res.json({ success: true, data: { results } });
  },
);

// ─── Track 2: Match & Classify (Step 4) ──────────────────────────────

// POST /api/committee-lists/match — run matching stub on retiree records
router.post(
  '/committee-lists/match',
  ...adminAuth,
  validate(matchClassifySchema),
  async (req: Request, res: Response) => {
    const { records, mdaMappings } = req.body as {
      records: committeeListService.ParsedRecord[];
      mdaMappings: Record<string, string>;
    };

    const results = await committeeListService.matchAndClassify(records, mdaMappings);
    res.json({ success: true, data: { results } });
  },
);

// ─── Track 2: Process Retiree Records (Step 5) ──────────────────────

// POST /api/committee-lists/process — process retiree/deceased records with per-record transactions
router.post(
  '/committee-lists/process',
  ...adminAuth,
  validate(processRetireeSchema),
  async (req: Request, res: Response) => {
    const { records, mdaMappings, batchId, uploadReference } = req.body as {
      records: committeeListService.ParsedRecord[];
      mdaMappings: Record<string, string>;
      batchId: string;
      uploadReference?: string;
    };

    const result = await committeeListService.processRetireeRecords(
      records,
      mdaMappings,
      batchId,
      uploadReference,
    );
    res.json({ success: true, data: result });
  },
);

export default router;
