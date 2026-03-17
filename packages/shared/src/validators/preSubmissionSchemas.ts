/**
 * Zod schemas for Pre-Submission Checkpoint (Story 11.1).
 */
import { z } from 'zod';

export const retirementItemSchema = z.object({
  staffName: z.string(),
  staffId: z.string(),
  retirementDate: z.string(),
  daysUntilRetirement: z.number(),
});

export const zeroDeductionItemSchema = z.object({
  staffName: z.string(),
  staffId: z.string(),
  lastDeductionDate: z.string(),
  daysSinceLastDeduction: z.number().nullable(),
});

export const pendingEventItemSchema = z.object({
  eventType: z.string(),
  staffName: z.string(),
  effectiveDate: z.string(),
  reconciliationStatus: z.string(),
});

export const preSubmissionCheckpointSchema = z.object({
  approachingRetirement: z.array(retirementItemSchema),
  zeroDeduction: z.array(zeroDeductionItemSchema),
  pendingEvents: z.array(pendingEventItemSchema),
  lastSubmissionDate: z.string().nullable(),
  submissionPeriod: z.string(),
});

/** Confirmation request schema — just a boolean acknowledgment */
export const checkpointConfirmationSchema = z.object({
  confirmed: z.boolean(),
});
