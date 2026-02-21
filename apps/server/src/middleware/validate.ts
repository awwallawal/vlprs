import type { Request, Response, NextFunction } from 'express';
import type { z } from 'zod/v4';
import { AppError } from '../lib/appError';
import { VOCABULARY } from '@vlprs/shared';

export function validate(schema: z.ZodType<any>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      throw new AppError(400, 'VALIDATION_FAILED', VOCABULARY.VALIDATION_FAILED, details);
    }
    req.body = result.data;
    next();
  };
}
