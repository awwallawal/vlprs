import { z } from 'zod/v4';

export const serviceStatusVerificationQuerySchema = z.object({
  mdaId: z.uuid().optional(),
  asOfDate: z.iso.date('asOfDate must be a valid ISO date (YYYY-MM-DD)').optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(200).optional(),
});
