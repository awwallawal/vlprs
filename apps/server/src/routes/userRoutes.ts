import { Router, type Request, type Response } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorise } from '../middleware/authorise';
import { requirePasswordChange } from '../middleware/requirePasswordChange';
import { validate } from '../middleware/validate';
import { auditLog } from '../middleware/auditLog';
import {
  ROLES,
  VOCABULARY,
  createUserSchema,
  updateUserSchema,
  deactivateUserSchema,
  deleteUserSchema,
  type Role,
} from '@vlprs/shared';
import * as userAdminService from '../services/userAdminService';
import { param } from '../lib/params';

const router = Router();

// Shared middleware stack for admin routes
const adminAuth = [
  authenticate,
  requirePasswordChange,
  authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN),
];

// GET /api/users — List users (admin only)
router.get(
  '/users',
  ...adminAuth,
  auditLog,
  async (req: Request, res: Response) => {
    const result = await userAdminService.listUsers(req.user!, {
      role: (req.query.role as Role | undefined),
      mdaId: req.query.mdaId as string | undefined,
      status: req.query.status as 'active' | 'inactive' | undefined,
      search: req.query.search as string | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : undefined,
    });
    res.json({ success: true, data: result.data, pagination: result.pagination });
  },
);

// POST /api/users — Create user (admin only)
router.post(
  '/users',
  ...adminAuth,
  validate(createUserSchema),
  auditLog,
  async (req: Request, res: Response) => {
    const user = await userAdminService.createUser(req.user!, req.body);
    res.status(201).json({ success: true, data: user, message: VOCABULARY.INVITATION_SENT });
  },
);

// POST /api/users/:id/deactivate — Deactivate user
router.post(
  '/users/:id/deactivate',
  ...adminAuth,
  validate(deactivateUserSchema),
  auditLog,
  async (req: Request, res: Response) => {
    const user = await userAdminService.deactivateUser(req.user!, param(req.params.id), req.body.reason);
    res.json({ success: true, data: user });
  },
);

// POST /api/users/:id/reactivate — Reactivate user
router.post(
  '/users/:id/reactivate',
  ...adminAuth,
  auditLog,
  async (req: Request, res: Response) => {
    const user = await userAdminService.reactivateUser(req.user!, param(req.params.id));
    res.json({ success: true, data: user });
  },
);

// DELETE /api/users/:id — Soft-delete user
router.delete(
  '/users/:id',
  ...adminAuth,
  validate(deleteUserSchema),
  auditLog,
  async (req: Request, res: Response) => {
    await userAdminService.softDeleteUser(req.user!, param(req.params.id), req.body.confirmEmail);
    res.json({ success: true, data: null });
  },
);

// PATCH /api/users/:id — Reassign MDA
router.patch(
  '/users/:id',
  ...adminAuth,
  validate(updateUserSchema),
  auditLog,
  async (req: Request, res: Response) => {
    const user = await userAdminService.reassignMda(req.user!, param(req.params.id), req.body.mdaId);
    res.json({ success: true, data: user });
  },
);

// POST /api/users/:id/reset-password — Admin password reset
router.post(
  '/users/:id/reset-password',
  ...adminAuth,
  auditLog,
  async (req: Request, res: Response) => {
    await userAdminService.resetPassword(req.user!, param(req.params.id));
    res.json({ success: true, data: null, message: VOCABULARY.PASSWORD_RESET_SENT });
  },
);

export default router;
