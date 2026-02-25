export type LedgerEntryType = 'PAYROLL' | 'ADJUSTMENT' | 'MIGRATION_BASELINE' | 'WRITE_OFF';

export interface LedgerEntry {
  id: string;
  loanId: string;
  staffId: string;
  mdaId: string;
  entryType: LedgerEntryType;
  amount: string;           // NUMERIC(15,2) → string, NEVER number
  principalComponent: string;
  interestComponent: string;
  periodMonth: number;
  periodYear: number;
  payrollBatchReference: string | null;
  source: string | null;
  postedBy: string;
  createdAt: string;        // ISO 8601 timestamp
}
