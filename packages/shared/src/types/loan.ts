export type LoanStatus = 'APPLIED' | 'APPROVED' | 'ACTIVE' | 'COMPLETED' | 'TRANSFERRED' | 'WRITTEN_OFF';

export interface Loan {
  id: string;
  staffId: string;
  staffName: string;
  gradeLevel: string;
  mdaId: string;
  principalAmount: string;
  interestRate: string;
  tenureMonths: number;
  moratoriumMonths: number;
  monthlyDeductionAmount: string;
  approvalDate: string;
  firstDeductionDate: string;
  loanReference: string;
  status: LoanStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLoanRequest {
  staffId: string;
  staffName: string;
  gradeLevel: string;
  mdaId: string;
  principalAmount: string;
  interestRate: string;
  tenureMonths: number;
  moratoriumMonths: number;
  monthlyDeductionAmount: string;
  approvalDate: string;
  firstDeductionDate: string;
}

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
