import { Router, type Request, type Response } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requirePasswordChange } from '../middleware/requirePasswordChange';
import { authorise } from '../middleware/authorise';
import { scopeToMda } from '../middleware/scopeToMda';
import { validate } from '../middleware/validate';
import { auditLog } from '../middleware/auditLog';
import { ROLES, ALL_ROLES, VOCABULARY, createLoanSchema, searchLoansQuerySchema } from '@vlprs/shared';
import { AppError } from '../lib/appError';
import * as loanService from '../services/loanService';
import { param } from '../lib/params';

const router = Router();

// Middleware stacks
const adminAuth = [
  authenticate,
  requirePasswordChange,
  authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN),
  scopeToMda,
];

const allAuth = [
  authenticate,
  requirePasswordChange,
  authorise(...ALL_ROLES),
  scopeToMda,
];

// POST /api/loans — Create loan (dept_admin + super_admin only)
router.post(
  '/loans',
  ...adminAuth,
  validate(createLoanSchema),
  auditLog,
  async (req: Request, res: Response) => {
    const loan = await loanService.createLoan(
      { userId: req.user!.userId, role: req.user!.role, mdaId: req.user!.mdaId ?? null },
      req.body,
    );
    res.status(201).json({ success: true, data: loan });
  },
);

// GET /api/loans — Search loans with pagination (all authenticated, MDA-scoped)
router.get(
  '/loans',
  ...allAuth,
  auditLog,
  async (req: Request, res: Response) => {
    const parsed = searchLoansQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_FAILED', VOCABULARY.VALIDATION_FAILED);
    }
    const result = await loanService.searchLoans(req.mdaScope, parsed.data);
    res.json({ success: true, data: result.data, pagination: result.pagination });
  },
);

// GET /api/loans/:id — Enriched loan detail (all authenticated, MDA-scoped)
router.get(
  '/loans/:id',
  ...allAuth,
  auditLog,
  async (req: Request, res: Response) => {
    const detail = await loanService.getLoanDetail(param(req.params.id), req.mdaScope);
    res.json({ success: true, data: detail });
  },
);

export default router;
