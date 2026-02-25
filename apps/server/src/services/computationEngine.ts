import Decimal from 'decimal.js';
import type { ComputationParams, ScheduleRow, RepaymentSchedule } from '@vlprs/shared';

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

  // Build schedule
  const totalMonths = moratorium + tenure;
  const schedule: ScheduleRow[] = [];
  let balance = totalLoan;

  for (let month = 1; month <= totalMonths; month++) {
    const isMoratorium = month <= moratorium;

    if (isMoratorium) {
      schedule.push({
        monthNumber: month,
        principalComponent: '0.00',
        interestComponent: '0.00',
        totalDeduction: '0.00',
        runningBalance: balance.toFixed(2),
        isMoratorium: true,
      });
    } else {
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
