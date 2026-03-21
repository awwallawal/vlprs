import { z } from 'zod/v4';

/**
 * Wraps a data schema in the standard API response envelope.
 * Shape: { success: true, data: T }
 */
export function apiResponseSchema<T extends z.ZodType>(dataSchema: T) {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
  });
}
