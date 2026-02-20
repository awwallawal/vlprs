import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/appError';
import { VOCABULARY } from '@vlprs/shared';
import type { Role } from '@vlprs/shared';

/**
 * Authorization middleware factory.
 *
 * Usage:
 *   authorise(ROLES.SUPER_ADMIN)                       — single role
 *   authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN)     — multiple roles
 *   authorise(...ALL_ROLES)                             — any authenticated user
 *
 * MUST be placed AFTER authenticate middleware in the chain.
 * Express 5 auto-catches thrown errors — no try/catch needed.
 */
export function authorise(...allowedRoles: Role[]) {
  // Fail fast at startup if misconfigured
  if (allowedRoles.length === 0) {
    throw new Error('authorise() requires at least one role');
  }

  const roleSet = new Set<string>(allowedRoles);

  return (req: Request, _res: Response, next: NextFunction) => {
    // Defense-in-depth: should never run without authenticate
    if (!req.user) {
      throw new AppError(401, 'AUTHENTICATION_REQUIRED', VOCABULARY.AUTHENTICATION_REQUIRED);
    }

    if (!roleSet.has(req.user.role)) {
      throw new AppError(403, 'INSUFFICIENT_PERMISSIONS', VOCABULARY.INSUFFICIENT_PERMISSIONS);
    }

    next();
  };
}
