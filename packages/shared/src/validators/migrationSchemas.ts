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
  status: z.enum(['uploaded', 'mapped', 'processing', 'completed', 'pending_verification', 'validated', 'reconciled', 'failed', 'rejected']).optional(),
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

// ─── Delineation & Deduplication (Story 3.8) ─────────────────────────

export const confirmDelineationSchema = z.object({
  sections: z.array(z.object({
    sectionIndex: z.number().int().min(0),
    mdaId: z.string().uuid(),
  })).min(1),
});

export const resolveDuplicateSchema = z.object({
  resolution: z.enum(['confirmed_multi_mda', 'reassigned', 'flagged']),
  note: z.string().max(1000).optional(),
});

export const duplicateListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  parentMdaId: z.string().uuid().optional(),
  childMdaId: z.string().uuid().optional(),
  status: z.enum(['pending', 'confirmed_multi_mda', 'reassigned', 'flagged']).optional(),
  staffName: z.string().min(2).optional(),
});

// ─── Baseline Acknowledgment (Story 3.4) ────────────────────────────
export const createBaselineBodySchema = z.object({
  confirm: z.literal(true),
});

// ─── Record Correction (Story 8.0b) ─────────────────────────────────
export const correctMigrationRecordSchema = z.object({
  outstandingBalance: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid decimal amount').optional(),
  totalLoan: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid decimal amount').optional(),
  monthlyDeduction: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid decimal amount').optional(),
  installmentCount: z.number().int().min(1).max(120).optional(),
  installmentsPaid: z.number().int().min(0).max(120).optional(),
  installmentsOutstanding: z.number().int().min(0).max(120).optional(),
}).refine(
  (data) => Object.values(data).some((v) => v !== undefined),
  { message: 'At least one field must be provided for correction' },
);

// ─── Multi-Sheet Overlap Check (Story 8.0d) ────────────────────────
export const checkOverlapBodySchema = z.object({
  sheetPeriods: z.array(z.object({
    sheetName: z.string(),
    periodYear: z.number().int().min(2000).max(2100),
    periodMonth: z.number().int().min(1).max(12),
  })).min(1),
});

// ─── Coverage Tracker Query (Story 11.0b) ────────────────────────────
export const coverageQuerySchema = z.object({
  extended: z.enum(['true', 'false']).optional().default('false'),
});

// ─── Coverage Records Drill-Down (Story 8.0f) ──────────────────────
export const coverageRecordsQuerySchema = z.object({
  mdaId: z.string().uuid(),
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  sortBy: z.enum(['staffName', 'employeeNo', 'principal', 'totalLoan', 'monthlyDeduction', 'outstandingBalance', 'varianceCategory', 'isBaselineCreated']).optional().default('staffName'),
  sortDir: z.enum(['asc', 'desc']).optional().default('asc'),
});

export const coverageRecordsExportSchema = z.object({
  mdaId: z.string().uuid(),
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  format: z.enum(['csv', 'xlsx']),
});

// ─── MDA Review Schemas (Story 8.0j) ───────────────────────────────

export const submitReviewSchema = z.object({
  outstandingBalance: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid decimal amount').optional(),
  totalLoan: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid decimal amount').optional(),
  monthlyDeduction: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid decimal amount').optional(),
  installmentCount: z.number().int().min(1).max(120).optional(),
  installmentsPaid: z.number().int().min(0).max(120).optional(),
  installmentsOutstanding: z.number().int().min(0).max(120).optional(),
  correctionReason: z.string().min(10, 'Correction reason must be at least 10 characters'),
});

export const markReviewedSchema = z.object({
  correctionReason: z.string().min(10, 'Explanation must be at least 10 characters'),
});

export const extendWindowSchema = z.object({
  mdaId: z.string().uuid(),
});

export const flaggedRecordsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  status: z.enum(['pending', 'reviewed', 'all']).optional().default('all'),
});

export const worksheetApplySchema = z.object({
  readyToApply: z.number().int().min(0),
  reviewedNoCorrection: z.number().int().min(0),
  skipped: z.number().int().min(0),
  alreadyBaselined: z.number().int().min(0),
  conflicts: z.number().int().min(0),
  records: z.array(z.object({
    recordId: z.string(),
    staffName: z.string(),
    category: z.enum(['ready', 'reviewed', 'skipped', 'baselined', 'conflict']),
    corrections: z.record(z.string(), z.union([z.string(), z.number(), z.null()])).optional(),
    reason: z.string().optional(),
    conflictDetail: z.string().optional(),
  })),
});

// ─── Federated Upload Approve/Reject (Story 15.0f) ─────────────────
export const rejectUploadSchema = z.object({
  reason: z.string().min(10, 'Rejection reason must be at least 10 characters'),
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
