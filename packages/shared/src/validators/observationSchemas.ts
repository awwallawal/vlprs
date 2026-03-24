import { z } from 'zod/v4';

export const observationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(25),
  type: z.enum([
    'rate_variance', 'stalled_balance', 'negative_balance',
    'multi_mda', 'no_approval_match', 'consecutive_loan',
    'period_overlap', 'grade_tier_mismatch', 'three_way_variance',
    'manual_exception', 'inactive_loan',
  ]).optional(),
  mdaId: z.string().uuid().optional(),
  status: z.enum(['unreviewed', 'reviewed', 'resolved', 'promoted']).optional(),
  staffName: z.string().min(2).optional(),
  sortBy: z.enum(['createdAt', 'type', 'staffName', 'status']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const reviewObservationSchema = z.object({
  note: z.string().optional(),
});

export const resolveObservationSchema = z.object({
  resolutionNote: z.string().min(1, 'Resolution note is required'),
});

export const promoteObservationSchema = z.object({
  priority: z.enum(['high', 'medium', 'low']).optional().default('medium'),
});

export const generateObservationsSchema = z.object({
  uploadId: z.string().uuid(),
});
