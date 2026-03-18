/**
 * Employment Event routes (Story 11.2).
 * POST   /employment-events               — file a new event
 * GET    /employment-events                — event history for MDA
 * GET    /employment-events/transfer-search — scoped cross-MDA search
 * POST   /employment-events/claim-transfer  — claim a transfer in
 * POST   /employment-events/confirm-transfer — confirm one side of transfer
 * GET    /staff-lookup                      — staff ID lookup
 */
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
  createEmploymentEventSchema,
  staffLookupQuerySchema,
  transferSearchQuerySchema,
  confirmTransferSchema,
  claimTransferSchema,
  employmentEventListQuerySchema,
} from '@vlprs/shared';
import * as employmentEventService from '../services/employmentEventService';

const router = Router();

// Auth chains
const writeAuth = [
  authenticate,
  requirePasswordChange,
  authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN, ROLES.MDA_OFFICER),
];

const readAuthScoped = [
  authenticate,
  requirePasswordChange,
  authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN, ROLES.MDA_OFFICER),
  scopeToMda,
];

const readAuthUnscoped = [
  authenticate,
  requirePasswordChange,
  authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN, ROLES.MDA_OFFICER),
];

// GET /staff-lookup — Staff ID lookup with MDA scoping (AC 7)
router.get(
  '/staff-lookup',
  ...readAuthScoped,
  readLimiter,
  auditLog,
  validateQuery(staffLookupQuerySchema),
  async (req: Request, res: Response) => {
    req.auditAction = 'STAFF_LOOKUP';

    const { staffId } = req.query as { staffId: string };

    const data = await employmentEventService.staffLookup(
      staffId,
      req.mdaScope,
      req.user!.role,
    );

    res.json({ success: true, data });
  },
);

// GET /employment-events/transfer-search — Cross-MDA search (AC 6)
// NO scopeToMda — intentionally crosses MDA boundaries
router.get(
  '/employment-events/transfer-search',
  ...readAuthUnscoped,
  readLimiter,
  auditLog,
  validateQuery(transferSearchQuerySchema),
  async (req: Request, res: Response) => {
    req.auditAction = 'TRANSFER_SEARCH';

    const { query, page, limit } = req.query as { query: string; page: string; limit: string };

    const data = await employmentEventService.getTransferSearchResults(
      query,
      req.user!.mdaId ?? null,
      parseInt(page, 10) || 1,
      parseInt(limit, 10) || 20,
    );

    res.json({ success: true, data });
  },
);

// POST /employment-events — File a new employment event (AC 2)
router.post(
  '/employment-events',
  ...writeAuth,
  scopeToMda,
  writeLimiter,
  validate(createEmploymentEventSchema),
  auditLog,
  async (req: Request, res: Response) => {
    req.auditAction = 'EMPLOYMENT_EVENT_FILED';

    const data = await employmentEventService.createEmploymentEvent(
      req.body,
      req.mdaScope,
      req.user!.userId,
      req.user!.role,
    );

    res.status(201).json({ success: true, data });
  },
);

// POST /employment-events/claim-transfer — Claim transfer in (AC 5)
// NO scopeToMda — cross-MDA by design
router.post(
  '/employment-events/claim-transfer',
  ...writeAuth,
  writeLimiter,
  validate(claimTransferSchema),
  auditLog,
  async (req: Request, res: Response) => {
    req.auditAction = 'TRANSFER_CLAIMED';

    const { staffId } = req.body as { staffId: string };

    const data = await employmentEventService.claimTransferIn(
      staffId,
      req.user!.mdaId!,
      req.user!.userId,
    );

    res.status(201).json({ success: true, data });
  },
);

// POST /employment-events/confirm-transfer — Confirm one side (AC 9)
// NO scopeToMda — cross-MDA by design, side validation in service
router.post(
  '/employment-events/confirm-transfer',
  ...writeAuth,
  writeLimiter,
  validate(confirmTransferSchema),
  auditLog,
  async (req: Request, res: Response) => {
    req.auditAction = 'TRANSFER_CONFIRMED';

    const { transferId, side } = req.body as { transferId: string; side: 'outgoing' | 'incoming' };

    const data = await employmentEventService.confirmTransfer(
      transferId,
      req.user!.userId,
      req.user!.role,
      req.user!.mdaId ?? null,
      side,
    );

    res.json({ success: true, data });
  },
);

// GET /employment-events — Event history for MDA (AC list)
router.get(
  '/employment-events',
  ...readAuthScoped,
  readLimiter,
  auditLog,
  validateQuery(employmentEventListQuerySchema),
  async (req: Request, res: Response) => {
    req.auditAction = 'EMPLOYMENT_EVENTS_VIEWED';

    const { page, limit } = req.query as { page: string; limit: string };
    const mdaId = req.mdaScope ?? (req.query.mdaId as string);

    if (!mdaId) {
      res.json({ success: true, data: { items: [], total: 0, page: 1, limit: 20 } });
      return;
    }

    const data = await employmentEventService.getEmploymentEvents(
      mdaId,
      parseInt(page, 10) || 1,
      parseInt(limit, 10) || 20,
    );

    res.json({ success: true, data });
  },
);

export default router;
