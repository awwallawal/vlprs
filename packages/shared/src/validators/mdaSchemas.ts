import { z } from 'zod/v4';

export const mdaQuerySchema = z.object({
  isActive: z.enum(['true', 'false']).optional(),
  search: z.string().max(255).optional(),
});
