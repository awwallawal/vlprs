import { Router, type Request, type Response } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorise } from '../middleware/authorise';
import { scopeToMda } from '../middleware/scopeToMda';
import { ROLES } from '@vlprs/shared';
import { listUsers } from '../services/userService';

const router = Router();

// GET /api/users — List users (admin only)
// super_admin: sees all users
// dept_admin: sees all users
// mda_officer: 403 (not in allowed roles)
router.get(
  '/users',
  authenticate,
  authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN),
  scopeToMda,
  async (req: Request, res: Response) => {
    const users = await listUsers(req.mdaScope ?? null);
    res.json({ success: true, data: users });
  },
);

export default router;
