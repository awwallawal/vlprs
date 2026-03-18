import { z } from 'zod';

/**
 * Flag discrepancy schema — for MDA officers to flag a variance row
 * for Department Admin review.
 */
export const flagDiscrepancySchema = z.object({
  staffId: z.string().min(1, 'Staff ID is required'),
  reason: z.string().min(10, 'Reason must be at least 10 characters'),
});

export type FlagDiscrepancyBody = z.infer<typeof flagDiscrepancySchema>;
