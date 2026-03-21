/**
 * Response validation middleware.
 *
 * 3-mode behavior:
 * - Development (NODE_ENV === 'development'): Logs a warning with schema violations, still sends response
 * - Test (NODE_ENV === 'test'): Throws AppError(500, 'RESPONSE_VALIDATION_ERROR') — breaks tests if response shape drifts
 * - Production (NODE_ENV === 'production'): Passes through unchanged — safety net, not a blocker
 */
import type { Request, Response, NextFunction } from 'express';
import type { z } from 'zod/v4';
import { AppError } from '../lib/appError';

export function validateResponse<T>(schema: z.ZodType<T>) {
  return (_req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);
    res.json = function (body: unknown) {
      // Only validate success responses (2xx) — error responses have different shapes
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const result = schema.safeParse(body);
        if (!result.success) {
          if (process.env.NODE_ENV === 'test') {
            throw new AppError(500, 'RESPONSE_VALIDATION_ERROR', 'Response failed schema validation');
          }
          if (process.env.NODE_ENV === 'development') {
            console.warn('[validateResponse] Schema violation:', result.error.issues);
          }
        }
      }
      return originalJson(body);
    } as typeof res.json;
    next();
  };
}
