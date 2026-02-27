import type { BalanceResult } from './balance';
import type { RepaymentSchedule } from './computation';

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

export interface LoanStateTransition {
  id: string;
  loanId: string;
  fromStatus: LoanStatus;
  toStatus: LoanStatus;
  transitionedBy: string;
  transitionedByName: string;
  reason: string;
  createdAt: string;
}

export interface TransitionLoanRequest {
  toStatus: LoanStatus;
  reason: string;
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
  staffName: string;
  staffId: string | null;
  mdaName: string;
  loanReference: string;
  outstandingBalance: string;
  status: LoanStatus;
  installmentsPaid: number;
  installmentsRemaining: number;
  principalAmount: string;
  tenureMonths: number;
}

export interface LoanDetail {
  /** Full loan master data */
  id: string;
  staffId: string;
  staffName: string;
  gradeLevel: string;
  mdaId: string;
  mdaName: string;
  mdaCode: string;
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
  /** Computed balance from Story 2.5 */
  balance: BalanceResult;
  /** Repayment schedule from Story 2.3 */
  schedule: RepaymentSchedule;
  /** Total ledger entries for this loan */
  ledgerEntryCount: number;
}
