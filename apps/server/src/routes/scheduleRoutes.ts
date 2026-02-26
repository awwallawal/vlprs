import { Router, type Request, type Response } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requirePasswordChange } from '../middleware/requirePasswordChange';
import { authorise } from '../middleware/authorise';
import { scopeToMda } from '../middleware/scopeToMda';
import { auditLog } from '../middleware/auditLog';
import { ROLES } from '@vlprs/shared';
import * as loanService from '../services/loanService';
import { computeRepaymentSchedule } from '../services/computationEngine';
import { param } from '../lib/params';

const router = Router();

// GET /api/loans/:loanId/schedule — Compute and return repayment schedule
router.get(
  '/loans/:loanId/schedule',
  authenticate,
  requirePasswordChange,
  authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN, ROLES.MDA_OFFICER),
  scopeToMda,
  auditLog,
  async (req: Request, res: Response) => {
    const loan = await loanService.getLoanById(param(req.params.loanId), req.mdaScope);

    // Optional what-if tenure override (does not modify loan)
    const tenureOverride = req.query.tenureMonths ? parseInt(req.query.tenureMonths as string, 10) : null;
    if (tenureOverride !== null && (!Number.isInteger(tenureOverride) || tenureOverride <= 0)) {
      res.status(400).json({ success: false, error: 'tenureMonths must be a positive integer' });
      return;
    }

    const effectiveTenure = tenureOverride ?? loan.tenureMonths;

    const schedule = computeRepaymentSchedule({
      principalAmount: loan.principalAmount,
      interestRate: loan.interestRate,
      tenureMonths: effectiveTenure,
      moratoriumMonths: loan.moratoriumMonths,
    });

    res.json({
      success: true,
      data: {
        ...schedule,
        isWhatIf: tenureOverride !== null,
        originalTenureMonths: loan.tenureMonths,
        effectiveTenureMonths: effectiveTenure,
      },
    });
  },
);

export default router;
