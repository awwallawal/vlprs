import { Router, type Request, type Response } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requirePasswordChange } from '../middleware/requirePasswordChange';
import { authorise } from '../middleware/authorise';
import { scopeToMda } from '../middleware/scopeToMda';
import { validate } from '../middleware/validate';
import { auditLog } from '../middleware/auditLog';
import { writeLimiter, readLimiter } from '../middleware/rateLimiter';
import { ROLES, addAnnotationSchema, correctEventFlagSchema } from '@vlprs/shared';
import { param } from '../lib/params';
import * as annotationService from '../services/annotationService';
import * as eventFlagCorrectionService from '../services/eventFlagCorrectionService';

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
  authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN, ROLES.MDA_OFFICER),
  scopeToMda,
  readLimiter,
];

// POST /api/loans/:loanId/annotations — Add annotation (AC 1)
router.post(
  '/loans/:loanId/annotations',
  ...writeAuth,
  validate(addAnnotationSchema),
  auditLog,
  async (req: Request, res: Response) => {
    const loanId = param(req.params.loanId);
    const result = await annotationService.addAnnotation(
      loanId,
      req.body.content,
      req.user!.userId,
      req.mdaScope ?? null,
    );
    res.status(201).json({ success: true, data: result });
  },
);

// GET /api/loans/:loanId/annotations — List annotations (AC 2)
router.get(
  '/loans/:loanId/annotations',
  ...readAuth,
  async (req: Request, res: Response) => {
    const loanId = param(req.params.loanId);
    const data = await annotationService.getAnnotations(
      loanId,
      req.mdaScope ?? null,
    );
    res.json({ success: true, data });
  },
);

// POST /api/loans/:loanId/event-flag-corrections — Create correction (AC 3)
router.post(
  '/loans/:loanId/event-flag-corrections',
  ...writeAuth,
  validate(correctEventFlagSchema),
  auditLog,
  async (req: Request, res: Response) => {
    const loanId = param(req.params.loanId);
    const result = await eventFlagCorrectionService.correctEventFlag(
      loanId,
      {
        originalEventFlag: req.body.originalEventFlag,
        newEventFlag: req.body.newEventFlag,
        correctionReason: req.body.correctionReason,
        submissionRowId: req.body.submissionRowId,
      },
      req.user!.userId,
      req.mdaScope ?? null,
    );
    res.status(201).json({ success: true, data: result });
  },
);

// GET /api/loans/:loanId/event-flag-corrections — List corrections (AC 5)
router.get(
  '/loans/:loanId/event-flag-corrections',
  ...readAuth,
  async (req: Request, res: Response) => {
    const loanId = param(req.params.loanId);
    const data = await eventFlagCorrectionService.getCorrections(
      loanId,
      req.mdaScope ?? null,
    );
    res.json({ success: true, data });
  },
);

export default router;
