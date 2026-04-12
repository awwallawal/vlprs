import { z } from 'zod/v4';

export const createBatchSchema = z.object({
  label: z.string().min(1).max(255).trim(),
  listType: z.enum(['APPROVAL', 'RETIREE']),
  year: z.number().int().min(2000).max(2100).optional(),
  notes: z.string().max(2000).optional(),
});

const parsedRecordSchema = z.object({
  sourceRow: z.number().int(),
  sourceSheet: z.string(),
  name: z.string().min(1),
  mdaRaw: z.string().nullable(),
  gradeLevel: z.string().nullable(),
  approvedAmount: z.string().nullable(),
  listType: z.enum(['APPROVAL', 'ADDENDUM', 'RETIREE', 'DECEASED']),
  principal: z.string().nullable(),
  interest: z.string().nullable(),
  totalLoan: z.string().nullable(),
  monthlyDeduction: z.string().nullable(),
  installmentsPaid: z.number().int().nullable(),
  totalPrincipalPaid: z.string().nullable(),
  totalInterestPaid: z.string().nullable(),
  totalLoanPaid: z.string().nullable(),
  outstandingPrincipal: z.string().nullable(),
  outstandingInterest: z.string().nullable(),
  outstandingBalance: z.string().nullable(),
  installmentsOutstanding: z.number().int().nullable(),
  collectionDate: z.string().nullable(),
  commencementDate: z.string().nullable(),
});

export const confirmUploadSchema = z.object({
  records: z.array(parsedRecordSchema).min(1).max(10000),
  mdaMappings: z.record(z.string(), z.string().uuid()).default({}),
  batchId: z.string().uuid(),
});

export const processRetireeSchema = z.object({
  records: z.array(parsedRecordSchema).min(1).max(10000),
  mdaMappings: z.record(z.string(), z.string().uuid()).default({}),
  batchId: z.string().uuid(),
  uploadReference: z.string().uuid().optional(),
});

export const threeVectorValidateSchema = z.object({
  records: z.array(parsedRecordSchema).min(1).max(10000),
});

export const matchClassifySchema = z.object({
  records: z.array(parsedRecordSchema).min(1).max(10000),
  mdaMappings: z.record(z.string(), z.string().uuid()).default({}),
});
