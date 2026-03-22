import { z } from 'zod';

const YYYY_MM_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

// Note: Payroll row validation reuses submissionRowSchema (from submissionSchemas.ts)
// with pre-processing in payrollUploadService.ts that defaults empty eventFlag to 'NONE'.
// A separate payrollRowSchema was intentionally omitted to avoid dead code — the shared
// validation pipeline already handles payroll rows after the pre-processing step.

/** Confirmation request body for POST /api/payroll/confirm. */
export const payrollConfirmSchema = z.object({
  period: z.string().regex(YYYY_MM_REGEX, 'Period must be in YYYY-MM format'),
});

/** Query schema for GET /api/payroll (list). */
export const payrollListQuerySchema = z.object({
  period: z.string().regex(YYYY_MM_REGEX).optional(),
});
