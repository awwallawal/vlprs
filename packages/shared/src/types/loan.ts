export type LoanStatus = 'active' | 'completed' | 'applied' | 'defaulted';

export interface LoanSummary {
  loanId: string;
  borrowerName: string;
  staffId: string | null;
  mdaName: string;
  loanRef: string;
  gradeLevelTier: number;
  principal: string;
  outstandingBalance: string;
  installmentsPaid: number;
  installmentsRemaining: number;
  lastDeductionDate: string | null;
  status: LoanStatus;
  retirementDate: string | null;
}

export interface LoanSearchResult {
  loanId: string;
  borrowerName: string;
  staffId: string | null;
  mdaName: string;
  loanRef: string;
  outstandingBalance: string;
}
