import { Router, type Request, type Response } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requirePasswordChange } from '../middleware/requirePasswordChange';
import { authorise } from '../middleware/authorise';
import { scopeToMda } from '../middleware/scopeToMda';
import { validate, validateQuery } from '../middleware/validate';
import { auditLog } from '../middleware/auditLog';
import { writeLimiter, readLimiter } from '../middleware/rateLimiter';
import {
  ROLES,
  flagExceptionSchema,
  resolveExceptionSchema,
  exceptionListQuerySchema,
} from '@vlprs/shared';
import { param } from '../lib/params';
import * as exceptionService from '../services/exceptionService';

const router = Router();

const writeAuth = [
  authenticate,
  requirePasswordChange,
  authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN),
  scopeToMda,
  writeLimiter,
];

const readAuth = [
  authenticate,
  requirePasswordChange,
  authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN),
  scopeToMda,
  readLimiter,
];

// POST /api/exceptions/flag — Flag a loan as exception (AC 1)
router.post(
  '/exceptions/flag',
  ...writeAuth,
  validate(flagExceptionSchema),
  auditLog,
  async (req: Request, res: Response) => {
    const result = await exceptionService.flagLoanAsException(
      req.body.loanId,
      req.user!.userId,
      req.mdaScope ?? null,
      {
        priority: req.body.priority,
        category: req.body.category,
        notes: req.body.notes,
      },
    );
    res.status(201).json({ success: true, data: result, message: 'Exception flagged for review' });
  },
);

// GET /api/exceptions — List exceptions with filters (AC 2, 3, 6)
router.get(
  '/exceptions',
  ...readAuth,
  validateQuery(exceptionListQuerySchema),
  auditLog,
  async (req: Request, res: Response) => {
    const filters = {
      category: req.query.category as string | undefined,
      mdaId: req.query.mdaId as string | undefined,
      priority: req.query.priority as 'high' | 'medium' | 'low' | undefined,
      status: req.query.status as 'open' | 'resolved' | undefined,
      loanId: req.query.loanId as string | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    };
    const data = await exceptionService.listExceptions(filters, req.mdaScope ?? null);
    res.json({ success: true, data });
  },
);

// GET /api/exceptions/counts — Open exception counts by priority (AC 7)
router.get(
  '/exceptions/counts',
  ...readAuth,
  auditLog,
  async (req: Request, res: Response) => {
    const data = await exceptionService.getExceptionCounts(req.mdaScope ?? null);
    res.json({ success: true, data });
  },
);

// GET /api/exceptions/:id — Exception detail with loan + observation context (AC 4)
router.get(
  '/exceptions/:id',
  ...readAuth,
  auditLog,
  async (req: Request, res: Response) => {
    const data = await exceptionService.getExceptionDetail(
      param(req.params.id),
      req.mdaScope ?? null,
    );
    res.json({ success: true, data });
  },
);

// PATCH /api/exceptions/:id/resolve — Resolve exception (AC 5)
router.patch(
  '/exceptions/:id/resolve',
  ...writeAuth,
  validate(resolveExceptionSchema),
  auditLog,
  async (req: Request, res: Response) => {
    const result = await exceptionService.resolveException(
      param(req.params.id),
      req.user!.userId,
      req.mdaScope ?? null,
      {
        resolutionNote: req.body.resolutionNote,
        actionTaken: req.body.actionTaken,
      },
    );
    res.json({ success: true, data: result, message: 'Exception resolved' });
  },
);

export default router;
