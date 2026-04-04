import { Router, type Request, type Response } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requirePasswordChange } from '../middleware/requirePasswordChange';
import { authorise } from '../middleware/authorise';
import { auditLog } from '../middleware/auditLog';
import { ROLES } from '@vlprs/shared';
import { detectAndTriggerAutoStop } from '../services/autoStopService';

const router = Router();

// POST /api/auto-stop/scan — Manually trigger auto-stop detection (SUPER_ADMIN only)
router.post(
  '/auto-stop/scan',
  authenticate,
  requirePasswordChange,
  authorise(ROLES.SUPER_ADMIN),
  auditLog,
  async (_req: Request, res: Response) => {
    const results = await detectAndTriggerAutoStop({ triggerSource: 'manual' });
    res.json({
      success: true,
      data: {
        completedCount: results.length,
        completions: results,
      },
    });
  },
);

export default router;
