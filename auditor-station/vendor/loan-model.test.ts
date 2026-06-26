import { describe, expect, it } from "vitest";
import {
  BASE_MONTHS,
  expectedInterest,
  expectedMonthlyDeduction,
  STANDARD_RATE,
  TOLERANCE_NAIRA,
} from "./loan-model.js";

// Locks the vendored loan model to WAKEUP.md §"Loan Computation Model". A drift here
// (caught by `pnpm sync:parent`) means the formula changed — these must be re-verified.
describe("loan model", () => {
  it("uses the canonical rate and base", () => {
    expect(STANDARD_RATE).toBe(0.1333);
    expect(BASE_MONTHS).toBe(60);
  });

  // ₦750,000 worked examples from the WAKEUP tenure table (within ₦50 tolerance).
  const cases = [
    { tenure: 60, interest: 99975, deduction: 14166.25 },
    { tenure: 50, interest: 83313, deduction: 16666.25 },
    { tenure: 48, interest: 79980, deduction: 17291.25 },
    { tenure: 40, interest: 66650, deduction: 20416.25 },
    { tenure: 36, interest: 59985, deduction: 22499.58 },
    { tenure: 30, interest: 49988, deduction: 26666.25 },
    { tenure: 24, interest: 39990, deduction: 32916.25 },
  ];

  for (const c of cases) {
    it(`₦750,000 over ${c.tenure} months matches the table within ₦${TOLERANCE_NAIRA}`, () => {
      expect(Math.abs(expectedInterest(750000, c.tenure) - c.interest)).toBeLessThanOrEqual(TOLERANCE_NAIRA);
      expect(Math.abs(expectedMonthlyDeduction(750000, c.tenure) - c.deduction)).toBeLessThanOrEqual(1);
    });
  }
});
