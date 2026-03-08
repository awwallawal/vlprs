import { z } from 'zod/v4';

const CANONICAL_FIELDS = [
  'serialNumber', 'staffName', 'mda',
  'principal', 'interestTotal', 'totalLoan',
  'installmentCount', 'monthlyDeduction', 'monthlyInterest',
  'monthlyPrincipal', 'totalInterestPaid', 'totalOutstandingInterest',
  'installmentsPaid', 'installmentsOutstanding',
  'totalLoanPaid', 'outstandingBalance',
  'remarks', 'startDate', 'endDate',
  'employeeNo', 'refId', 'commencementDate', 'station',
  'dateOfBirth', 'dateOfFirstAppointment',
] as const;

export const migrationUploadQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  status: z.enum(['uploaded', 'mapped', 'processing', 'completed', 'validated', 'reconciled', 'failed']).optional(),
});

export const validationResultQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  category: z.enum(['clean', 'minor_variance', 'significant_variance', 'structural_error', 'anomalous']).optional(),
  sortBy: z.enum(['variance_amount', 'staff_name', 'source_row']).optional().default('variance_amount'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

const sheetMappingSchema = z.object({
  sheetName: z.string().min(1),
  mappings: z.array(z.object({
    sourceIndex: z.number().int().min(0),
    canonicalField: z.enum(CANONICAL_FIELDS).nullable(),
  })),
});

const sheetsArraySchema = z.array(sheetMappingSchema).min(1).check((ctx) => {
  for (const sheet of ctx.value) {
    const fields = sheet.mappings
      .map((m: { canonicalField: string | null }) => m.canonicalField)
      .filter((f: string | null): f is string => f !== null);
    if (new Set(fields).size !== fields.length) {
      ctx.issues.push({
        code: 'custom',
        input: ctx.value,
        message: `Duplicate canonical field assignments in sheet "${sheet.sheetName}"`,
      });
    }
  }
});

export const personListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  mdaFilter: z.string().uuid().optional(),
  sortBy: z.enum(['staff_name', 'record_count', 'variance_count']).optional().default('staff_name'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
});

export const confirmMappingBodySchema = z.object({
  mdaId: z.string().uuid(),
  sheets: z.preprocess(
    (v) => (typeof v === 'string' ? JSON.parse(v) : v),
    sheetsArraySchema,
  ),
});

// ─── Baseline Acknowledgment (Story 3.4) ────────────────────────────
export const createBaselineBodySchema = z.object({
  confirm: z.literal(true),
});

// ─── Beneficiary Ledger Query (Story 3.5) ───────────────────────────
export const beneficiaryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  mdaId: z.string().uuid().optional(),
  search: z.string().min(2, 'Search term must be at least 2 characters').optional(),
  sortBy: z.enum(['staffName', 'totalExposure', 'loanCount', 'lastActivityDate']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});
