import { Router, type Request, type Response } from 'express';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { authLimiter } from '../middleware/rateLimiter';
import { loginSchema, registerSchema, ROLES, VOCABULARY } from '@vlprs/shared';
import { AppError } from '../lib/appError';
import { env } from '../config/env';
import * as authService from '../services/authService';

const router = Router();

// POST /auth/register — protected, Super Admin only
router.post(
  '/auth/register',
  authenticate,
  (req: Request, _res: Response, next) => {
    if (req.user?.role !== ROLES.SUPER_ADMIN) {
      throw new AppError(403, 'INSUFFICIENT_PERMISSIONS', VOCABULARY.INSUFFICIENT_PERMISSIONS);
    }
    next();
  },
  validate(registerSchema),
  async (req: Request, res: Response) => {
    const user = await authService.register(req.body);
    res.status(201).json({ success: true, data: user });
  },
);

// POST /auth/login — public, rate-limited
router.post(
  '/auth/login',
  authLimiter,
  validate(loginSchema),
  async (req: Request, res: Response) => {
    const result = await authService.login(req.body);

    // Set refresh token in httpOnly cookie (HTTP concern stays in route handler)
    res.cookie('refreshToken', result.refreshToken.raw, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/auth',
      maxAge: result.refreshToken.expiresMs,
    });

    res.status(200).json({
      success: true,
      data: {
        accessToken: result.accessToken,
        user: result.user,
      },
    });
  },
);

export default router;
