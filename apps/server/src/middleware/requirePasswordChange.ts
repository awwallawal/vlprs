import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/appError';
import { VOCABULARY } from '@vlprs/shared';

/**
 * Blocks requests from users who must change their password.
 * Allows through: change-password and logout endpoints.
 * Must be placed AFTER authenticate middleware.
 */
export function requirePasswordChange(req: Request, _res: Response, next: NextFunction) {
  const allowedPaths = ['/api/auth/change-password', '/api/auth/logout'];
  if (allowedPaths.includes(req.path)) {
    return next();
  }

  if (req.user?.mustChangePassword) {
    throw new AppError(403, 'PASSWORD_CHANGE_REQUIRED', VOCABULARY.PASSWORD_CHANGE_REQUIRED);
  }

  next();
}
