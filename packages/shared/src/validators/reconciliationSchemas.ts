import { z } from 'zod';

/** Zod schema for ReconciliationCounts (stored as JSONB on mda_submissions). */
export const reconciliationCountsSchema = z.object({
  matched: z.number().int().min(0),
  dateDiscrepancy: z.number().int().min(0),
  unconfirmed: z.number().int().min(0),
  newCsvEvent: z.number().int().min(0),
});

/** Zod schema for a single reconciliation detail row. */
export const reconciliationDetailSchema = z.object({
  staffId: z.string(),
  staffName: z.string(),
  eventType: z.string(),
  csvEventDate: z.string().nullable(),
  employmentEventDate: z.string().nullable(),
  reconciliationStatus: z.enum([
    'matched',
    'date_discrepancy',
    'unconfirmed_event',
    'new_csv_event',
  ]),
  daysDifference: z.number().nullable(),
  employmentEventId: z.string().nullable(),
});

/** Zod schema for the full ReconciliationSummary response. */
export const reconciliationSummarySchema = z.object({
  counts: reconciliationCountsSchema,
  details: z.array(reconciliationDetailSchema),
});

/** Zod schema for the PATCH resolve discrepancy request body. */
export const resolveDiscrepancySchema = z.object({
  status: z.enum(['MATCHED', 'UNCONFIRMED']),
  reason: z.string().min(10, 'Reason must be at least 10 characters'),
});

/** Zod schema for the PATCH resolve discrepancy response data (Story 7.0b). */
export const resolveDiscrepancyResponseSchema = z.object({
  id: z.string(),
  reconciliationStatus: z.string(),
});
