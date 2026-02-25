/** Input parameters for schedule computation */
export interface ComputationParams {
  principalAmount: string; // NUMERIC(15,2) as string, e.g. "250000.00"
  interestRate: string; // NUMERIC(5,3) as string, e.g. "13.330" (percentage)
  tenureMonths: number; // Active repayment months (e.g., 60)
  moratoriumMonths: number; // Grace period months (e.g., 2), default 0
}

/** One row in the repayment schedule */
export interface ScheduleRow {
  monthNumber: number; // 1-based (includes moratorium months)
  principalComponent: string; // NUMERIC(15,2) as string
  interestComponent: string; // NUMERIC(15,2) as string
  totalDeduction: string; // NUMERIC(15,2) as string
  runningBalance: string; // Remaining total loan amount as string
  isMoratorium: boolean; // true for grace period months
}

/** Complete repayment schedule output */
export interface RepaymentSchedule {
  params: ComputationParams;
  totalInterest: string; // Principal × rate / 100
  totalLoan: string; // Principal + totalInterest
  monthlyPrincipal: string; // Principal / tenureMonths (uniform)
  monthlyInterest: string; // totalInterest / tenureMonths (uniform)
  monthlyDeduction: string; // monthlyPrincipal + monthlyInterest
  totalMonths: number; // moratoriumMonths + tenureMonths
  schedule: ScheduleRow[]; // One row per month
}
