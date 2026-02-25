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

    const schedule = computeRepaymentSchedule({
      principalAmount: loan.principalAmount,
      interestRate: loan.interestRate,
      tenureMonths: loan.tenureMonths,
      moratoriumMonths: loan.moratoriumMonths,
    });

    res.json({ success: true, data: schedule });
  },
);

export default router;
