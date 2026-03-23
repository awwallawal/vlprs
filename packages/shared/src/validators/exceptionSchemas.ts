import { z } from 'zod/v4';

export const flagExceptionSchema = z.object({
  loanId: z.string().uuid(),
  priority: z.enum(['high', 'medium', 'low']),
  category: z.string().min(3, 'Category must be at least 3 characters'),
  notes: z.string().min(10, 'Notes must be at least 10 characters'),
});

export const resolveExceptionSchema = z.object({
  resolutionNote: z.string().min(10, 'Resolution note must be at least 10 characters'),
  actionTaken: z.enum(['verified_correct', 'adjusted_record', 'referred_to_mda', 'no_action_required']),
});

export const exceptionListQuerySchema = z.object({
  category: z.string().optional(),
  mdaId: z.string().uuid().optional(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
  status: z.enum(['open', 'resolved']).optional(),
  loanId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
});
