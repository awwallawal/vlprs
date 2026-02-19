import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../lib/jwt';
import { AppError } from '../lib/appError';
import { VOCABULARY } from '@vlprs/shared';

declare global {
  namespace Express {
    interface Request {
      user?: { userId: string; email: string; role: string; mdaId: string | null };
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError(401, 'AUTHENTICATION_REQUIRED', VOCABULARY.AUTHENTICATION_REQUIRED);
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      mdaId: payload.mdaId,
    };
    next();
  } catch {
    throw new AppError(401, 'TOKEN_EXPIRED', VOCABULARY.TOKEN_EXPIRED);
  }
}
