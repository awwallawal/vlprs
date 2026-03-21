/**
 * Canonical loan status values — single source of truth.
 * DB enum: apps/server/src/db/schema.ts (loanStatusEnum)
 * Zod validator: packages/shared/src/validators/loanSchemas.ts
 * TypeScript type: packages/shared/src/types/loan.ts (LoanStatus)
 */
export const LOAN_STATUS_VALUES = [
  'APPLIED', 'APPROVED', 'ACTIVE', 'COMPLETED', 'TRANSFERRED',
  'WRITTEN_OFF', 'RETIRED', 'DECEASED', 'SUSPENDED', 'LWOP', 'TRANSFER_PENDING',
] as const;

export type LoanStatusValue = (typeof LOAN_STATUS_VALUES)[number];
