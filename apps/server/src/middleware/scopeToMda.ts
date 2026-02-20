import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/appError';
import { ROLES, VOCABULARY } from '@vlprs/shared';

/**
 * MDA data isolation middleware.
 * Sets req.mdaScope for downstream query filtering.
 *
 * - super_admin: req.mdaScope = null (unscoped — sees all MDAs)
 * - dept_admin:  req.mdaScope = null (unscoped — sees all MDAs)
 * - mda_officer: req.mdaScope = user.mdaId (restricted to own MDA)
 *
 * MUST be placed AFTER authenticate and authorise in the chain.
 */
export function scopeToMda(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    throw new AppError(401, 'AUTHENTICATION_REQUIRED', VOCABULARY.AUTHENTICATION_REQUIRED);
  }

  const { role, mdaId } = req.user;

  if (role === ROLES.SUPER_ADMIN || role === ROLES.DEPT_ADMIN) {
    req.mdaScope = null;
  } else {
    if (!mdaId) {
      throw new AppError(403, 'MDA_NOT_ASSIGNED', VOCABULARY.MDA_NOT_ASSIGNED);
    }
    req.mdaScope = mdaId;
  }

  next();
}
