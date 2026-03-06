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
  status: z.enum(['uploaded', 'mapped', 'processing', 'completed', 'failed']).optional(),
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

export const confirmMappingBodySchema = z.object({
  mdaId: z.string().uuid(),
  sheets: z.preprocess(
    (v) => (typeof v === 'string' ? JSON.parse(v) : v),
    sheetsArraySchema,
  ),
});
