import { rateLimit } from 'express-rate-limit';
import { VOCABULARY } from '@vlprs/shared';

const isTest = process.env.NODE_ENV === 'test';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: isTest ? () => true : undefined,
  message: {
    success: false,
    error: { code: 'RATE_LIMIT_EXCEEDED', message: VOCABULARY.RATE_LIMIT_EXCEEDED },
  },
});

export const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'RATE_LIMIT_EXCEEDED', message: VOCABULARY.RATE_LIMIT_EXCEEDED },
  },
});

export const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'RATE_LIMIT_EXCEEDED', message: VOCABULARY.RATE_LIMIT_EXCEEDED },
  },
});
