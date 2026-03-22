import { z } from 'zod';

export const EVENT_FLAG_VALUES = [
  'NONE', 'RETIREMENT', 'DEATH', 'SUSPENSION', 'TRANSFER_OUT',
  'TRANSFER_IN', 'LEAVE_WITHOUT_PAY', 'REINSTATEMENT',
  'ABSCONDED', 'SERVICE_EXTENSION', 'DISMISSAL',
] as const;

const YYYY_MM_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Validates a single CSV submission row (8 fields).
 * Conditional refinements:
 * - Event Date required when Event Flag != NONE
 * - Cessation Reason required when Amount = 0 AND Event Flag = NONE
 */
export const submissionRowSchema = z.object({
  staffId: z.string().min(1, 'Staff ID is required'),
  month: z.string().regex(YYYY_MM_REGEX, 'Month must be in YYYY-MM format'),
  amountDeducted: z.string().refine((val) => {
    const cleaned = val.replace(/,/g, '');
    const num = Number(cleaned);
    return !isNaN(num) && num >= 0;
  }, 'Amount must be a valid number >= 0'),
  payrollBatchReference: z.string().min(1, 'Payroll Batch Reference is required'),
  mdaCode: z.string().min(1, 'MDA Code is required'),
  eventFlag: z.enum(EVENT_FLAG_VALUES),
  eventDate: z.string().nullable().refine((val) => {
    if (val === null || val === '') return true;
    const d = new Date(val);
    return !isNaN(d.getTime());
  }, 'Event Date must be a valid date (YYYY-MM-DD)'),
  cessationReason: z.string().nullable(),
}).superRefine((data, ctx) => {
  // Event Date required when Event Flag != NONE
  if (data.eventFlag !== 'NONE' && (!data.eventDate || data.eventDate.trim() === '')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Event Date is required when Event Flag is not NONE',
      path: ['eventDate'],
    });
  }

  // Cessation Reason required when Amount = 0 AND Event Flag = NONE
  const cleanedAmount = data.amountDeducted.replace(/,/g, '');
  const numAmount = Number(cleanedAmount);
  if (numAmount === 0 && data.eventFlag === 'NONE' && (!data.cessationReason || data.cessationReason.trim() === '')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Cessation Reason is required when Amount is 0 and Event Flag is NONE',
      path: ['cessationReason'],
    });
  }
});

export const submissionUploadQuerySchema = z.object({
  mdaId: z.string().uuid().optional(),
});

export const submissionListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  period: z.string().regex(YYYY_MM_REGEX).optional(),
  mdaId: z.string().uuid().optional(),
});

/** Manual entry request body — array of 1-50 rows using the same row schema as CSV. */
export const manualSubmissionBodySchema = z.object({
  rows: z.array(submissionRowSchema).min(1).max(50),
});

export type ManualSubmissionBody = z.infer<typeof manualSubmissionBodySchema>;

// Comparison schemas (Story 5.4)
const comparisonCategorySchema = z.enum(['aligned', 'minor_variance', 'variance']);

export const comparisonRowSchema = z.object({
  staffId: z.string(),
  declaredAmount: z.string(),
  expectedAmount: z.string(),
  difference: z.string(),
  category: comparisonCategorySchema,
  explanation: z.string(),
});

export const comparisonSummarySchema = z.object({
  alignedCount: z.number().int().min(0),
  minorVarianceCount: z.number().int().min(0),
  varianceCount: z.number().int().min(0),
  totalRecords: z.number().int().min(0),
  rows: z.array(comparisonRowSchema),
});

export const submissionComparisonResponseSchema = z.object({
  submissionId: z.string().uuid(),
  referenceNumber: z.string(),
  summary: comparisonSummarySchema,
});

// ─── Response Schemas (Story 7.0b) ──────────────────────────────────

const submissionRecordStatusSchema = z.enum(['processing', 'confirmed', 'rejected']);

export const submissionUploadResponseSchema = z.object({
  id: z.string(),
  referenceNumber: z.string(),
  recordCount: z.number().int().min(0),
  submissionDate: z.string(),
  status: submissionRecordStatusSchema,
  alignedCount: z.number().int().min(0),
  varianceCount: z.number().int().min(0),
});

export const submissionListResponseSchema = z.object({
  items: z.array(z.object({
    id: z.string(),
    referenceNumber: z.string(),
    submissionDate: z.string(),
    recordCount: z.number().int().min(0),
    status: z.string(),
    period: z.string(),
    alignedCount: z.number().int().min(0),
    varianceCount: z.number().int().min(0),
  })),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
});

const submissionRowResponseSchema = z.object({
  staffId: z.string(),
  month: z.string(),
  amountDeducted: z.string(),
  payrollBatchReference: z.string(),
  mdaCode: z.string(),
  eventFlag: z.enum(EVENT_FLAG_VALUES),
  eventDate: z.string().nullable(),
  cessationReason: z.string().nullable(),
});

export const submissionDetailResponseSchema = z.object({
  id: z.string(),
  mdaId: z.string(),
  mdaName: z.string(),
  period: z.string(),
  referenceNumber: z.string(),
  status: submissionRecordStatusSchema,
  recordCount: z.number().int().min(0),
  source: z.enum(['csv', 'manual', 'historical', 'payroll']),
  filename: z.string().nullable(),
  fileSizeBytes: z.number().nullable(),
  createdAt: z.string(),
  rows: z.array(submissionRowResponseSchema),
});
