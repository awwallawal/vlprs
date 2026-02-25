import { Router, type Request, type Response } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requirePasswordChange } from '../middleware/requirePasswordChange';
import { authorise } from '../middleware/authorise';
import { scopeToMda } from '../middleware/scopeToMda';
import { validate } from '../middleware/validate';
import { auditLog } from '../middleware/auditLog';
import { immutableRoute } from '../middleware/immutableRoute';
import { ROLES, ALL_ROLES, createLedgerEntrySchema } from '@vlprs/shared';
import * as ledgerService from '../services/ledgerService';
import { param } from '../lib/params';

const router = Router();

// Layer 3: Reject PUT/PATCH/DELETE on all /ledger routes
router.use('/ledger', immutableRoute);

// POST /api/ledger — Create ledger entry (admin only)
router.post(
  '/ledger',
  authenticate,
  requirePasswordChange,
  authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN),
  validate(createLedgerEntrySchema),
  auditLog,
  async (req: Request, res: Response) => {
    const entry = await ledgerService.createEntry(req.user!.userId, req.body);
    res.status(201).json({ success: true, data: entry });
  },
);

// GET /api/ledger/:loanId — Get ledger entries for a loan
router.get(
  '/ledger/:loanId',
  authenticate,
  requirePasswordChange,
  authorise(...ALL_ROLES),
  scopeToMda,
  auditLog,
  async (req: Request, res: Response) => {
    const loanId = param(req.params.loanId);
    const mdaId = req.mdaScope ?? undefined;
    const entries = await ledgerService.getEntriesByLoan(loanId, mdaId);
    res.json({ success: true, data: entries });
  },
);

export default router;
