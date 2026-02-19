import { Router, type Request, type Response } from 'express';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { authLimiter } from '../middleware/rateLimiter';
import { doubleCsrfProtection, generateCsrfToken, CSRF_COOKIE_NAME } from '../middleware/csrf';
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

    // Set refresh token in httpOnly cookie
    res.cookie('refreshToken', result.refreshToken.raw, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/auth',
      maxAge: result.refreshToken.expiresMs,
    });

    // Bind CSRF token to the new refresh token (req.cookies won't have it yet)
    req.cookies = req.cookies ?? {};
    req.cookies.refreshToken = result.refreshToken.raw;
    generateCsrfToken(req, res, { overwrite: true });

    res.status(200).json({
      success: true,
      data: {
        accessToken: result.accessToken,
        user: result.user,
      },
    });
  },
);

// POST /auth/refresh — cookie-authenticated, CSRF-protected, rate-limited
router.post(
  '/auth/refresh',
  authLimiter,
  doubleCsrfProtection,
  async (req: Request, res: Response) => {
    const tokenFromCookie = req.cookies?.refreshToken;
    const result = await authService.refreshToken(tokenFromCookie);

    // Set new refresh token in httpOnly cookie
    res.cookie('refreshToken', result.refreshToken.raw, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/auth',
      maxAge: result.refreshToken.expiresMs,
    });

    // Bind CSRF token to the new refresh token
    req.cookies.refreshToken = result.refreshToken.raw;
    generateCsrfToken(req, res, { overwrite: true });

    res.status(200).json({
      success: true,
      data: { accessToken: result.accessToken },
    });
  },
);

// POST /auth/logout — JWT-authenticated, CSRF-protected
router.post(
  '/auth/logout',
  authenticate,
  doubleCsrfProtection,
  async (req: Request, res: Response) => {
    await authService.logout(req.user!.userId);

    // Clear refresh token cookie
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/auth',
    });

    // Clear CSRF cookie
    res.clearCookie(CSRF_COOKIE_NAME, {
      httpOnly: false,
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });

    res.status(200).json({ success: true, data: null });
  },
);

export default router;
