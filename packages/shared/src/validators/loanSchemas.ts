import { z } from 'zod/v4';

const LOAN_STATUS_VALUES = ['APPLIED', 'APPROVED', 'ACTIVE', 'COMPLETED', 'TRANSFERRED', 'WRITTEN_OFF'] as const;

export const searchLoansQuerySchema = z.object({
  search: z.string().min(2, 'Search term must be at least 2 characters').optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  status: z.enum(LOAN_STATUS_VALUES).optional(),
  mdaId: z.uuid().optional(),
  sortBy: z.enum(['createdAt', 'staffName', 'loanReference', 'status']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export const transitionLoanSchema = z.object({
  toStatus: z.enum(LOAN_STATUS_VALUES),
  reason: z.string().min(1, 'Reason is required').max(500),
});

export const createLoanSchema = z.object({
  staffId: z.string().min(1, 'Staff ID is required').max(50),
  staffName: z.string().min(1, 'Staff name is required').max(255),
  gradeLevel: z.string().min(1, 'Grade level is required').max(50),
  mdaId: z.uuid('MDA ID must be a valid UUID'),
  principalAmount: z
    .string()
    .regex(/^\d+\.\d{2}$/, 'Principal amount must be a valid number with 2 decimal places'),
  interestRate: z
    .string()
    .regex(/^\d+\.\d{1,3}$/, 'Interest rate must be a valid number with up to 3 decimal places'),
  tenureMonths: z.int().positive('Tenure must be a positive number'),
  moratoriumMonths: z.int().nonnegative('Moratorium months cannot be negative'),
  monthlyDeductionAmount: z
    .string()
    .regex(/^\d+\.\d{2}$/, 'Monthly deduction must be a valid number with 2 decimal places'),
  approvalDate: z.iso.date('Approval date must be a valid ISO date (YYYY-MM-DD)'),
  firstDeductionDate: z.iso.date('First deduction date must be a valid ISO date (YYYY-MM-DD)'),
});
