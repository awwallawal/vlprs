import { Router, type Request, type Response } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requirePasswordChange } from '../middleware/requirePasswordChange';
import { authorise } from '../middleware/authorise';
import { scopeToMda } from '../middleware/scopeToMda';
import { validateQuery } from '../middleware/validate';
import { auditLog } from '../middleware/auditLog';
import { ROLES, personListQuerySchema } from '@vlprs/shared';
import { param } from '../lib/params';
import * as personMatchingService from '../services/personMatchingService';
import * as staffProfileService from '../services/staffProfileService';

const router = Router();

const adminAuth = [
  authenticate,
  requirePasswordChange,
  authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN),
  scopeToMda,
];

// GET /api/migrations/persons — Paginated person list
router.get(
  '/migrations/persons',
  ...adminAuth,
  validateQuery(personListQuerySchema),
  async (req: Request, res: Response) => {
    const filters = {
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
      mdaFilter: typeof req.query.mdaFilter === 'string' ? req.query.mdaFilter : undefined,
      sortBy: (req.query.sortBy as string) || 'staff_name',
      sortOrder: (req.query.sortOrder as string) || 'asc',
    };

    const result = await staffProfileService.listPersons(filters, req.mdaScope);
    res.json({ success: true, data: result.data, pagination: result.pagination });
  },
);

// GET /api/migrations/persons/:personKey — Full person profile with timeline
router.get(
  '/migrations/persons/:personKey',
  ...adminAuth,
  async (req: Request, res: Response) => {
    const personKey = decodeURIComponent(param(req.params.personKey));
    const profile = await staffProfileService.getPersonProfile(personKey, req.mdaScope);
    res.json({ success: true, data: profile });
  },
);

// POST /api/migrations/match-persons — Trigger person matching
router.post(
  '/migrations/match-persons',
  ...adminAuth,
  auditLog,
  async (req: Request, res: Response) => {
    const summary = await personMatchingService.runPersonMatching(req.mdaScope);
    res.json({ success: true, data: summary });
  },
);

// PATCH /api/migrations/matches/:matchId/confirm — Confirm a pending match
router.patch(
  '/migrations/matches/:matchId/confirm',
  ...adminAuth,
  auditLog,
  async (req: Request, res: Response) => {
    const matchId = param(req.params.matchId);
    const result = await personMatchingService.confirmMatch(matchId, req.user!.userId);
    res.json({ success: true, data: result });
  },
);

// PATCH /api/migrations/matches/:matchId/reject — Reject a pending match
router.patch(
  '/migrations/matches/:matchId/reject',
  ...adminAuth,
  auditLog,
  async (req: Request, res: Response) => {
    const matchId = param(req.params.matchId);
    const result = await personMatchingService.rejectMatch(matchId, req.user!.userId);
    res.json({ success: true, data: result });
  },
);

// GET /api/migrations/matches — List pending matches for review
router.get(
  '/migrations/matches',
  ...adminAuth,
  async (req: Request, res: Response) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const result = await personMatchingService.listPendingMatches(page, limit, req.mdaScope);
    res.json({ success: true, data: result.data, pagination: result.pagination });
  },
);

export default router;
