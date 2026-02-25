import { Router, type Request, type Response } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requirePasswordChange } from '../middleware/requirePasswordChange';
import { authorise } from '../middleware/authorise';
import { scopeToMda } from '../middleware/scopeToMda';
import { validateQuery } from '../middleware/validate';
import { auditLog } from '../middleware/auditLog';
import { ALL_ROLES, mdaQuerySchema } from '@vlprs/shared';
import * as mdaService from '../services/mdaService';

const router = Router();

// Shared middleware: all authenticated roles, MDA-scoped
const allAuth = [
  authenticate,
  requirePasswordChange,
  authorise(...ALL_ROLES),
  scopeToMda,
];

// GET /api/mdas — List MDAs (all authenticated roles, MDA-scoped for mda_officer)
router.get(
  '/mdas',
  ...allAuth,
  validateQuery(mdaQuerySchema),
  auditLog,
  async (req: Request, res: Response) => {
    const filters = {
      isActive: req.query.isActive === 'false' ? false : req.query.isActive === 'true' ? true : undefined,
      search: req.query.search as string | undefined,
    };
    const data = await mdaService.listMdas(filters, req.mdaScope);
    res.json({ success: true, data });
  },
);

export default router;
