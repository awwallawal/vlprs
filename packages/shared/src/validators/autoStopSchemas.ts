import { z } from 'zod/v4';

// ─── Certificate List Query Schema (Story 15.0i) ────────────────────

export const certificateListQuerySchema = z.object({
  mdaId: z.string().uuid().optional(),
  notificationStatus: z.enum(['pending', 'notified', 'partial']).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
  sortBy: z.enum(['generatedAt', 'completionDate']).optional().default('generatedAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type CertificateListQuery = z.infer<typeof certificateListQuerySchema>;
