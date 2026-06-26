/**
 * loan-model.ts — the Oyo State car-loan computation model (VENDORED knowledge).
 *
 * SOURCE OF TRUTH: scripts/legacy-report/WAKEUP.md §"Loan Computation Model"
 * (mirrors the app's 8-0a scheme formula). Snapshotted here so the station is severable.
 *
 * PARITY NOTE: this is the ONE place the station encodes the formula. If WAKEUP.md's loan
 * model changes, `pnpm sync:parent` flags the SHA drift — review and update these constants
 * deliberately. NEVER let this silently fork: an auditor-station computation that disagrees
 * with the app/engine on interest is poison for a government scheme.
 *
 *   One rate. One base. All tenures.
 *     Standard Interest = Principal × 13.33%
 *     Monthly Interest  = Standard Interest ÷ 60        ← ALWAYS ÷ 60, NEVER ÷ tenure
 *     Monthly Principal = Principal ÷ Tenure
 *     Monthly Deduction = Monthly Principal + Monthly Interest
 *     Total Interest    = Monthly Interest × Tenure   (= Principal × 0.1333 × Tenure/60)
 *     Total Loan        = Principal + Total Interest
 *   Rate check: Expected Interest = Principal × 0.1333 × (InstallmentCount / 60). Tolerance ₦50.
 */

/** Flat standard interest rate applied to principal. */
export const STANDARD_RATE = 0.1333;

/** Base period in months — the interest divisor is ALWAYS 60, regardless of chosen tenure. */
export const BASE_MONTHS = 60;

/** Verification tolerance in Naira for the rate check. */
export const TOLERANCE_NAIRA = 50;

/** Expected total interest for a principal over a given tenure (installment count). */
export function expectedInterest(principal: number, installmentCount: number): number {
  return principal * STANDARD_RATE * (installmentCount / BASE_MONTHS);
}

/** Expected monthly deduction = principal/tenure + (principal×rate)/60. */
export function expectedMonthlyDeduction(principal: number, installmentCount: number): number {
  const monthlyPrincipal = principal / installmentCount;
  const monthlyInterest = (principal * STANDARD_RATE) / BASE_MONTHS;
  return monthlyPrincipal + monthlyInterest;
}

/** Reference tenure table from WAKEUP.md (apparent rate is interest/principal). */
export const TENURE_TABLE = [
  { tenure: 60, apparentRate: "13.33%" },
  { tenure: 50, apparentRate: "11.11%" },
  { tenure: 48, apparentRate: "10.66%" },
  { tenure: 40, apparentRate: "8.89%" },
  { tenure: 36, apparentRate: "8.00%" },
  { tenure: 30, apparentRate: "6.67%" },
  { tenure: 24, apparentRate: "5.33%" },
] as const;

/** The four settlement pathways (for narration context; not a computation input). */
export const SETTLEMENT_PATHWAYS = [
  { id: 1, name: "Standard Payroll Completion", note: "50/60 months, full tenure deductions" },
  { id: 2, name: "Accelerated", note: "shorter tenure (24-48 months), less total interest" },
  { id: 3, name: "Early Exit / Lump Sum", note: "pay off remaining principal in cash, interest waived" },
  { id: 4, name: "Gratuity Deduction", note: "retired staff, balance deducted from retirement gratuity" },
] as const;

/** Human-reviewed file→MDA overrides (from WAKEUP.md). Reference for narration/explanation. */
export const MDA_OVERRIDES = [
  { filePattern: "OYSGPP CARLOAN", correctMda: "PRINTING PRESS", note: "Not OYSAA" },
  { filePattern: "auditor_general_LG", correctMda: "LOCAL GOVERNMENT AUDIT", note: "Not Auditor General (State)" },
  { filePattern: "Ministry Budget", correctMda: "BUDGET AND PLANNING", note: "SPC column is sub-code" },
  { filePattern: "LANDS", correctMda: "LANDS AND HOUSING", note: "BPP&DC column is sub-code" },
  { filePattern: "JUSTICE CAR LOAN 2023", correctMda: "NURSING AND MIDWIFERY", note: "Misfiled" },
  { filePattern: "SECRETARIAT", correctMda: "CCA", note: "Customary Court of Appeal" },
] as const;
