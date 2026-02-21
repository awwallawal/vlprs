import { doubleCsrf } from 'csrf-csrf';
import type { Request } from 'express';
import { env } from '../config/env';

export const CSRF_COOKIE_NAME = '__csrf';

const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({
  getSecret: () => env.CSRF_SECRET,
  getSessionIdentifier: (req: Request) => req.cookies?.refreshToken ?? '',
  cookieName: CSRF_COOKIE_NAME,
  cookieOptions: {
    httpOnly: false,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  },
  size: 64,
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  getCsrfTokenFromRequest: (req: Request) => req.headers['x-csrf-token'] as string,
});

export { doubleCsrfProtection, generateCsrfToken };
