import { z } from 'zod/v4';

export const mdaQuerySchema = z.object({
  isActive: z.enum(['true', 'false']).optional(),
  search: z.string().max(255).optional(),
});

export const createMdaAliasSchema = z.object({
  alias: z.string().min(1).max(255).trim(),
  mdaId: z.string().uuid(),
});

export const batchResolveMdaSchema = z.object({
  strings: z.array(z.string().min(1).max(255)).min(1).max(500),
});
