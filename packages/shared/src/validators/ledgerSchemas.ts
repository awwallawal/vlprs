import { z } from 'zod/v4';

export const createLedgerEntrySchema = z.object({
  loanId: z.string().uuid(),
  entryType: z.enum(['PAYROLL', 'ADJUSTMENT', 'MIGRATION_BASELINE', 'WRITE_OFF']),
  amount: z.string().regex(/^\d{1,13}\.\d{2}$/, 'Amount must be a decimal string with exactly 2 decimal places'),
  principalComponent: z.string().regex(/^\d{1,13}\.\d{2}$/, 'Must be a decimal string with exactly 2 decimal places'),
  interestComponent: z.string().regex(/^\d{1,13}\.\d{2}$/, 'Must be a decimal string with exactly 2 decimal places'),
  periodMonth: z.number().int().min(1).max(12),
  periodYear: z.number().int().min(2000).max(2100),
  payrollBatchReference: z.string().max(100).optional(),
  source: z.string().max(255).optional(),
});

export type CreateLedgerEntryInput = z.infer<typeof createLedgerEntrySchema>;
