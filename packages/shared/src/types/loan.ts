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
  temporalProfile: TemporalProfile;
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
  dateOfBirth?: string;
  dateOfFirstAppointment?: string;
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

export interface TemporalProfile {
  dateOfBirth: string | null;
  dateOfFirstAppointment: string | null;
  computedRetirementDate: string | null;
  computationMethod: 'dob_60' | 'appt_35' | null;
  profileStatus: 'complete' | 'incomplete';
  remainingServiceMonths: number | null;
  profileIncompleteReason: string | null;
  hasServiceExtension: boolean;
  originalComputedRetirementDate: string | null;
  latestExtensionReference: string | null;
}

export interface TemporalCorrection {
  id: string;
  loanId: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string;
  oldRetirementDate: string | null;
  newRetirementDate: string | null;
  correctedBy: string;
  correctedByName: string;
  reason: string;
  createdAt: string;
}

export interface ServiceExtension {
  id: string;
  loanId: string;
  originalComputedDate: string;
  newRetirementDate: string;
  approvingAuthorityReference: string;
  notes: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

export interface CreateServiceExtensionRequest {
  newRetirementDate: string;
  approvingAuthorityReference: string;
  notes: string;
}

export interface UpdateTemporalProfileRequest {
  dateOfBirth?: string;
  dateOfFirstAppointment?: string;
  reason: string;
}

export interface GratuityProjectionResult {
  hasGratuityExposure: boolean;
  payrollDeductionMonths: number;
  gratuityReceivableMonths: number;
  projectedGratuityReceivableAmount: string;  // 2 decimal places, Decimal.js
  projectedMonthlyGratuityAmount: string;     // 2 decimal places, Decimal.js — total / gratuityReceivableMonths (0.00 when no exposure)
  remainingInstallments: number;
  remainingServiceMonths: number;
  loanMaturityDate: string;                   // ISO date
  computedRetirementDate: string;             // effective date (may include extension)
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
  /** Temporal profile from Story 10.1 */
  temporalProfile: TemporalProfile;
  /** Gratuity projection from Story 10.3 — null if temporal profile incomplete */
  gratuityProjection: GratuityProjectionResult | null;
}
