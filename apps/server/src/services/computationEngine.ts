import Decimal from 'decimal.js';
import { addYears, addMonths, min, differenceInMonths } from 'date-fns';
import type { ComputationParams, ScheduleRow, RepaymentSchedule, AutoSplitResult, BalanceResult, LedgerEntryForBalance, GratuityProjectionResult, SchemeExpectedResult } from '@vlprs/shared';

// Configure decimal.js for financial precision
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export function computeRepaymentSchedule(params: ComputationParams): RepaymentSchedule {
  const principal = new Decimal(params.principalAmount);
  const rate = new Decimal(params.interestRate);
  const tenure = params.tenureMonths;
  const moratorium = params.moratoriumMonths;

  // Input validation — this pure function is called by 7+ downstream stories;
  // guard against invalid inputs that would produce NaN/Infinity money values.
  if (!Number.isInteger(tenure) || tenure <= 0) {
    throw new Error('tenureMonths must be a positive integer');
  }
  if (principal.isNaN() || !principal.isFinite() || principal.lte(0)) {
    throw new Error('principalAmount must be a positive number');
  }
  if (rate.isNaN() || !rate.isFinite() || rate.lt(0)) {
    throw new Error('interestRate must be a non-negative number');
  }
  if (!Number.isInteger(moratorium) || moratorium < 0) {
    throw new Error('moratoriumMonths must be a non-negative integer');
  }

  // Flat-rate interest calculation
  const totalInterest = principal.mul(rate).div(100);
  const totalLoan = principal.plus(totalInterest);

  // Uniform monthly splits
  const monthlyPrincipal = principal.div(tenure).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const monthlyInterest = totalInterest.div(tenure).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const monthlyDeduction = monthlyPrincipal.plus(monthlyInterest);

  // Build schedule with last-payment adjustment
  const totalMonths = moratorium + tenure;
  const schedule: ScheduleRow[] = [];
  let balance = totalLoan;
  let cumulativePrincipal = new Decimal('0');
  let cumulativeInterest = new Decimal('0');

  for (let month = 1; month <= totalMonths; month++) {
    const isMoratorium = month <= moratorium;
    const isLastActiveMonth = month === totalMonths;

    if (isMoratorium) {
      schedule.push({
        monthNumber: month,
        principalComponent: '0.00',
        interestComponent: '0.00',
        totalDeduction: '0.00',
        runningBalance: balance.toFixed(2),
        isMoratorium: true,
      });
    } else if (isLastActiveMonth) {
      // Last-payment adjustment: absorb all accumulated rounding
      const lastPrincipal = principal.minus(cumulativePrincipal);
      const lastInterest = totalInterest.minus(cumulativeInterest);
      const lastDeduction = lastPrincipal.plus(lastInterest);

      schedule.push({
        monthNumber: month,
        principalComponent: lastPrincipal.toFixed(2),
        interestComponent: lastInterest.toFixed(2),
        totalDeduction: lastDeduction.toFixed(2),
        runningBalance: '0.00',
        isMoratorium: false,
      });
      balance = new Decimal('0');
    } else {
      cumulativePrincipal = cumulativePrincipal.plus(monthlyPrincipal);
      cumulativeInterest = cumulativeInterest.plus(monthlyInterest);
      balance = balance.minus(monthlyDeduction);

      schedule.push({
        monthNumber: month,
        principalComponent: monthlyPrincipal.toFixed(2),
        interestComponent: monthlyInterest.toFixed(2),
        totalDeduction: monthlyDeduction.toFixed(2),
        runningBalance: balance.toFixed(2),
        isMoratorium: false,
      });
    }
  }

  return {
    params,
    totalInterest: totalInterest.toFixed(2),
    totalLoan: totalLoan.toFixed(2),
    monthlyPrincipal: monthlyPrincipal.toFixed(2),
    monthlyInterest: monthlyInterest.toFixed(2),
    monthlyDeduction: monthlyDeduction.toFixed(2),
    totalMonths,
    schedule,
  };
}

/**
 * Auto-split a deduction amount into principal and interest components
 * using the flat-rate ratio from the loan's schedule parameters.
 *
 * Guarantees: principalComponent + interestComponent = deductionAmount exactly.
 */
export function autoSplitDeduction(
  deductionAmount: string,
  params: ComputationParams,
): AutoSplitResult {
  let deduction: Decimal;
  try {
    deduction = new Decimal(deductionAmount);
  } catch {
    throw new Error('deductionAmount must be a valid number');
  }
  if (deduction.isNaN() || !deduction.isFinite()) {
    throw new Error('deductionAmount must be a valid number');
  }

  const principal = new Decimal(params.principalAmount);
  if (principal.isNaN() || !principal.isFinite() || principal.lte(0)) {
    throw new Error('principalAmount must be a positive number');
  }

  const rate = new Decimal(params.interestRate);
  if (rate.isNaN() || !rate.isFinite() || rate.lt(0)) {
    throw new Error('interestRate must be a non-negative number');
  }

  const totalInterest = principal.mul(rate).div(100);
  const totalLoan = principal.plus(totalInterest);

  // Interest-first rounding: interest = deduction × (totalInterest / totalLoan), rounded
  // Principal = deduction - interest (remainder to principal, guarantees exact sum)
  const interestComponent = deduction
    .mul(totalInterest)
    .div(totalLoan)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const principalComponent = deduction.minus(interestComponent);

  return {
    principalComponent: principalComponent.toFixed(2),
    interestComponent: interestComponent.toFixed(2),
  };
}

// ─── Scheme Expected Computation (Story 8.0a) ─────────────────────

/**
 * Known rate tier table: apparent rate → tenure months.
 * Apparent rate = 13.33% × tenure / 60. Tolerance ±0.05 for matching.
 */
const SCHEME_RATE_TIER_TABLE: Array<{ apparentRate: number; tenureMonths: number }> = [
  { apparentRate: 13.33, tenureMonths: 60 },
  { apparentRate: 11.11, tenureMonths: 50 },
  { apparentRate: 10.66, tenureMonths: 48 },
  { apparentRate: 8.89, tenureMonths: 40 },
  { apparentRate: 8.00, tenureMonths: 36 },
  { apparentRate: 6.67, tenureMonths: 30 },
  { apparentRate: 5.33, tenureMonths: 24 },
];

const SCHEME_RATE_TOLERANCE = new Decimal('0.05');
const SCHEME_BASE_RATE = new Decimal('0.1333');
const SCHEME_DIVISOR = new Decimal('60');

/**
 * Infer tenure from a computed rate by matching against known rate tiers.
 * Uses ±0.05 absolute tolerance (consistent with matchesKnownTier() pattern
 * in migrationValidationService) because computeEffectiveRate() returns
 * strings with rounding artefacts (e.g., "6.663" not "6.67").
 *
 * Returns null if rate doesn't match any tier.
 */
export function inferTenureFromRate(computedRate: string): number | null {
  let rate: Decimal;
  try {
    rate = new Decimal(computedRate);
  } catch {
    return null;
  }
  if (rate.isNaN() || !rate.isFinite()) return null;

  for (const tier of SCHEME_RATE_TIER_TABLE) {
    if (rate.minus(tier.apparentRate).abs().lte(SCHEME_RATE_TOLERANCE)) {
      return tier.tenureMonths;
    }
  }
  return null;
}

/**
 * Compute scheme expected values using the authoritative formula.
 *
 * Monthly Interest = (Principal × 0.1333) / 60   — ALWAYS divide by 60
 * Monthly Principal = Principal / tenure
 * Monthly Deduction = Monthly Principal + Monthly Interest
 * Total Interest = Monthly Interest × tenure
 * Total Loan = Principal + Total Interest
 * Apparent Rate = 13.33% × tenure / 60
 */
export function computeSchemeExpected(principal: string, tenureMonths: number): SchemeExpectedResult {
  const p = new Decimal(principal);
  if (p.isNaN() || !p.isFinite() || p.lte(0)) {
    throw new Error('principal must be a positive number');
  }
  if (!Number.isInteger(tenureMonths) || tenureMonths <= 0) {
    throw new Error('tenureMonths must be a positive integer');
  }

  const standardInterest = p.mul(SCHEME_BASE_RATE);
  const monthlyInterest = standardInterest.div(SCHEME_DIVISOR).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const monthlyPrincipal = p.div(tenureMonths).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const monthlyDeduction = monthlyPrincipal.plus(monthlyInterest);
  const totalInterest = monthlyInterest.mul(tenureMonths);
  const totalLoan = p.plus(totalInterest);
  const apparentRate = new Decimal('13.33').mul(tenureMonths).div(60).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  return {
    monthlyInterest: monthlyInterest.toFixed(2),
    monthlyPrincipal: monthlyPrincipal.toFixed(2),
    monthlyDeduction: monthlyDeduction.toFixed(2),
    totalInterest: totalInterest.toFixed(2),
    totalLoan: totalLoan.toFixed(2),
    apparentRate: apparentRate.toFixed(2),
  };
}

// ─── Retirement Date Computation (Story 10.1) ─────────────────────

/**
 * Compute retirement date from DOB and first appointment date.
 * Pure function — no DB access.
 * Rule: min(DOB + 60 years, appointment_date + 35 years)
 */
export function computeRetirementDate(
  dateOfBirth: Date,
  dateOfFirstAppointment: Date,
): { retirementDate: Date; computationMethod: 'dob_60' | 'appt_35' } {
  if (dateOfBirth > new Date()) {
    throw new Error('Date of birth cannot be in the future');
  }
  if (dateOfFirstAppointment < dateOfBirth) {
    throw new Error('Date of first appointment cannot precede date of birth');
  }

  const dobPlus60 = addYears(dateOfBirth, 60);
  const apptPlus35 = addYears(dateOfFirstAppointment, 35);
  const retirementDate = min([dobPlus60, apptPlus35]);

  return {
    retirementDate,
    computationMethod: retirementDate.getTime() === dobPlus60.getTime() ? 'dob_60' : 'appt_35',
  };
}

/**
 * Compute remaining service months from retirement date to a reference date.
 * Returns 0 if already past retirement. Pure function.
 */
export function computeRemainingServiceMonths(
  retirementDate: Date,
  asOfDate: Date = new Date(),
): number {
  const months = differenceInMonths(retirementDate, asOfDate);
  return Math.max(0, months);
}

/**
 * Compute outstanding balance from loan parameters and ledger entries.
 * Pure function — no DB access. All arithmetic via decimal.js.
 */
export function computeBalanceFromEntries(
  principalAmount: string,
  interestRate: string,
  tenureMonths: number,
  entries: LedgerEntryForBalance[],
  asOfDate: string | null,
): BalanceResult {
  // Input validation — consistent with computeRepaymentSchedule() and autoSplitDeduction()
  if (!Number.isInteger(tenureMonths) || tenureMonths <= 0) {
    throw new Error('tenureMonths must be a positive integer');
  }
  const principal = new Decimal(principalAmount);
  if (principal.isNaN() || !principal.isFinite() || principal.lte(0)) {
    throw new Error('principalAmount must be a positive number');
  }
  const rate = new Decimal(interestRate);
  if (rate.isNaN() || !rate.isFinite() || rate.lt(0)) {
    throw new Error('interestRate must be a non-negative number');
  }
  const totalInterest = principal.mul(rate).div(100);
  const totalLoan = principal.plus(totalInterest);

  let totalAmountPaid = new Decimal('0');
  let totalPrincipalPaid = new Decimal('0');
  let totalInterestPaid = new Decimal('0');
  let payrollCount = 0;

  for (const entry of entries) {
    totalAmountPaid = totalAmountPaid.plus(new Decimal(entry.amount));
    totalPrincipalPaid = totalPrincipalPaid.plus(new Decimal(entry.principalComponent));
    totalInterestPaid = totalInterestPaid.plus(new Decimal(entry.interestComponent));
    if (entry.entryType === 'PAYROLL') {
      payrollCount++;
    }
  }

  const computedBalance = totalLoan.minus(totalAmountPaid);
  const principalRemaining = principal.minus(totalPrincipalPaid);
  const interestRemaining = totalInterest.minus(totalInterestPaid);

  return {
    computedBalance: computedBalance.toFixed(2),
    totalPrincipalPaid: totalPrincipalPaid.toFixed(2),
    totalInterestPaid: totalInterestPaid.toFixed(2),
    totalAmountPaid: totalAmountPaid.toFixed(2),
    principalRemaining: principalRemaining.toFixed(2),
    interestRemaining: interestRemaining.toFixed(2),
    installmentsCompleted: payrollCount,
    installmentsRemaining: Math.max(0, tenureMonths - payrollCount),
    entryCount: entries.length,
    asOfDate,
    derivation: {
      formula: 'totalLoan - sum(entries.amount)',
      totalLoan: totalLoan.toFixed(2),
      entriesSum: totalAmountPaid.toFixed(2),
      isAnomaly: computedBalance.isNegative(),
    },
  };
}

// ─── Balance Wrapper for limitedComputation Loans (Story 7.0a) ──────

/**
 * Unified balance computation that handles limitedComputation loans (zero-principal).
 *
 * Accepts either individual entries OR a pre-aggregated totalPaid string.
 * - entries: full computation with principal/interest split (balanceService, attentionItemService)
 * - totalPaid: aggregated path for batch computations (beneficiaryLedgerService, migrationDashboardService)
 */
export function computeBalanceForLoan(params: {
  limitedComputation: boolean;
  principalAmount: string;
  interestRate: string;
  tenureMonths: number;
  asOfDate: string | null;
  entries: LedgerEntryForBalance[];
}): BalanceResult;
export function computeBalanceForLoan(params: {
  limitedComputation: boolean;
  principalAmount: string;
  interestRate: string;
  tenureMonths: number;
  totalPaid: string;
}): BalanceResult;
export function computeBalanceForLoan(params: {
  limitedComputation: boolean;
  principalAmount: string;
  interestRate: string;
  tenureMonths: number;
  asOfDate?: string | null;
  entries?: LedgerEntryForBalance[];
  totalPaid?: string;
}): BalanceResult {
  const { limitedComputation, principalAmount, interestRate, tenureMonths } = params;

  // Normal loans with entries: delegate to full computation
  if (!limitedComputation && params.entries) {
    return computeBalanceFromEntries(principalAmount, interestRate, tenureMonths, params.entries, params.asOfDate ?? null);
  }

  // limitedComputation OR aggregated-total path: manual Decimal arithmetic
  const principal = new Decimal(principalAmount);
  const rate = new Decimal(interestRate);
  const totalInterest = principal.mul(rate).div(100);
  const totalLoanAmount = principal.plus(totalInterest);

  let totalAmountPaid: Decimal;
  let payrollCount = 0;
  let entryCount = 0;

  if (params.entries) {
    totalAmountPaid = new Decimal('0');
    for (const entry of params.entries) {
      totalAmountPaid = totalAmountPaid.plus(new Decimal(entry.amount));
      if (entry.entryType === 'PAYROLL') payrollCount++;
    }
    entryCount = params.entries.length;
  } else {
    totalAmountPaid = new Decimal(params.totalPaid ?? '0');
  }

  const computedBalance = Decimal.max(new Decimal('0'), totalLoanAmount.minus(totalAmountPaid));

  // Note: principal/interest split fields are '0.00' for both limitedComputation loans
  // (where split is genuinely unknown) AND the aggregated totalPaid path (where the caller
  // only has a summed total, not per-entry components). Callers using this path only
  // consume computedBalance, so the zero split values are safe.
  return {
    computedBalance: computedBalance.toFixed(2),
    totalPrincipalPaid: '0.00',
    totalInterestPaid: '0.00',
    totalAmountPaid: totalAmountPaid.toFixed(2),
    principalRemaining: '0.00',
    interestRemaining: computedBalance.toFixed(2),
    installmentsCompleted: payrollCount,
    installmentsRemaining: Math.max(0, tenureMonths - payrollCount),
    entryCount,
    asOfDate: params.asOfDate ?? null,
    derivation: {
      formula: limitedComputation
        ? 'MAX(0, totalLoan - sum(entries)) [limited-computation]'
        : 'MAX(0, totalLoan - totalPaid) [aggregated]',
      totalLoan: totalLoanAmount.toFixed(2),
      entriesSum: totalAmountPaid.toFixed(2),
      isAnomaly: false,
    },
  };
}

// ─── Gratuity Projection Computation (Story 10.3) ──────────────────

/**
 * Compute gratuity receivable projection for a loan.
 * Pure function — no DB access. All arithmetic via Decimal.js.
 *
 * Determines whether a loan's tenure extends beyond the staff member's
 * remaining service (retirement date), and if so, computes the projected
 * balance that must be recovered from gratuity.
 *
 * Note: The projection uses monthlyDeductionAmount × remaining months as an
 * approximation. The actual balance at retirement may differ slightly due to
 * last-payment adjustment (Story 2.4). This approximation is acceptable for
 * projection purposes — the actual balance will be computed from ledger entries
 * when the time comes.
 */
export function computeGratuityProjection(params: {
  computedRetirementDate: Date;
  firstDeductionDate: Date;
  tenureMonths: number;
  monthlyDeductionAmount: string;
  principalAmount: string;
  interestRate: string;
  installmentsCompleted: number;
  asOfDate?: Date;
}): GratuityProjectionResult {
  // Input validation — consistent with computeRepaymentSchedule() and computeBalanceFromEntries()
  if (!Number.isInteger(params.tenureMonths) || params.tenureMonths <= 0) {
    throw new Error('tenureMonths must be a positive integer');
  }
  if (!Number.isInteger(params.installmentsCompleted) || params.installmentsCompleted < 0) {
    throw new Error('installmentsCompleted must be a non-negative integer');
  }
  const principalCheck = new Decimal(params.principalAmount);
  if (principalCheck.isNaN() || !principalCheck.isFinite() || principalCheck.lte(0)) {
    throw new Error('principalAmount must be a positive number');
  }
  const rateCheck = new Decimal(params.interestRate);
  if (rateCheck.isNaN() || !rateCheck.isFinite() || rateCheck.lt(0)) {
    throw new Error('interestRate must be a non-negative number');
  }
  const deductionCheck = new Decimal(params.monthlyDeductionAmount);
  if (deductionCheck.isNaN() || !deductionCheck.isFinite() || deductionCheck.lte(0)) {
    throw new Error('monthlyDeductionAmount must be a positive number');
  }

  const now = params.asOfDate || new Date();
  const remainingInstallments = Math.max(0, params.tenureMonths - params.installmentsCompleted);
  const remainingServiceMonths = computeRemainingServiceMonths(params.computedRetirementDate, now);

  const loanMaturityDate = addMonths(params.firstDeductionDate, params.tenureMonths);
  const loanMaturityDateStr = loanMaturityDate.toISOString().split('T')[0];
  const computedRetirementDateStr = params.computedRetirementDate.toISOString().split('T')[0];

  // No exposure: loan fully paid or finishes before/at retirement
  if (remainingInstallments <= 0 || remainingInstallments <= remainingServiceMonths) {
    return {
      hasGratuityExposure: false,
      payrollDeductionMonths: remainingInstallments,
      gratuityReceivableMonths: 0,
      projectedGratuityReceivableAmount: '0.00',
      projectedMonthlyGratuityAmount: '0.00',
      remainingInstallments,
      remainingServiceMonths,
      loanMaturityDate: loanMaturityDateStr,
      computedRetirementDate: computedRetirementDateStr,
    };
  }

  // Has exposure: loan extends past retirement
  const payrollDeductionMonths = remainingServiceMonths; // already clamped to ≥0 by computeRemainingServiceMonths
  const gratuityReceivableMonths = remainingInstallments - payrollDeductionMonths;

  // Project balance at retirement using flat-rate approximation
  const monthlyDeduction = new Decimal(params.monthlyDeductionAmount);
  const principal = new Decimal(params.principalAmount);
  const rate = new Decimal(params.interestRate);
  const totalInterest = principal.mul(rate).div(100);
  const totalLoan = principal.plus(totalInterest);

  // Current outstanding balance
  const alreadyPaid = monthlyDeduction.mul(new Decimal(params.installmentsCompleted));
  const currentOutstanding = totalLoan.minus(alreadyPaid);

  // Balance at retirement = current outstanding - payments between now and retirement
  const paymentsBeforeRetirement = monthlyDeduction.mul(new Decimal(payrollDeductionMonths));
  const balanceAtRetirement = Decimal.max(currentOutstanding.minus(paymentsBeforeRetirement), new Decimal('0'));
  const projectedAmount = balanceAtRetirement.toFixed(2);

  // Monthly gratuity amount: projected balance divided evenly across gratuity months
  const monthlyGratuity = gratuityReceivableMonths > 0
    ? balanceAtRetirement.div(new Decimal(gratuityReceivableMonths)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2)
    : '0.00';

  return {
    hasGratuityExposure: true,
    payrollDeductionMonths,
    gratuityReceivableMonths,
    projectedGratuityReceivableAmount: projectedAmount,
    projectedMonthlyGratuityAmount: monthlyGratuity,
    remainingInstallments,
    remainingServiceMonths,
    loanMaturityDate: loanMaturityDateStr,
    computedRetirementDate: computedRetirementDateStr,
  };
}
