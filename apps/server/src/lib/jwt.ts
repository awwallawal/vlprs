import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import type { JwtPayload } from '@vlprs/shared';

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign({ ...payload }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRY as jwt.SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}
