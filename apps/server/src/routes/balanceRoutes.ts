import { Router, type Request, type Response } from 'express';
import { z } from 'zod/v4';
import { authenticate } from '../middleware/authenticate';
import { requirePasswordChange } from '../middleware/requirePasswordChange';
import { authorise } from '../middleware/authorise';
import { scopeToMda } from '../middleware/scopeToMda';
import { auditLog } from '../middleware/auditLog';
import { ROLES, VOCABULARY } from '@vlprs/shared';
import { AppError } from '../lib/appError';
import { param } from '../lib/params';
import * as balanceService from '../services/balanceService';

const asOfSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const router = Router();

// GET /api/loans/:loanId/balance — Compute outstanding balance from ledger entries
router.get(
  '/loans/:loanId/balance',
  authenticate,
  requirePasswordChange,
  authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN, ROLES.MDA_OFFICER),
  scopeToMda,
  auditLog,
  async (req: Request, res: Response) => {
    const loanId = param(req.params.loanId);

    // Parse optional asOf query param with Zod validation (YYYY-MM-DD)
    let asOf: Date | undefined;
    if (req.query.asOf) {
      const parseResult = asOfSchema.safeParse(req.query.asOf);
      if (!parseResult.success) {
        throw new AppError(400, 'VALIDATION_FAILED', VOCABULARY.INVALID_AS_OF_DATE);
      }
      // Set to end of day UTC to include all entries on that date
      asOf = new Date(parseResult.data + 'T23:59:59.999Z');
    }

    const result = await balanceService.getOutstandingBalance(loanId, asOf, req.mdaScope);
    res.json({ success: true, data: result });
  },
);

export default router;
