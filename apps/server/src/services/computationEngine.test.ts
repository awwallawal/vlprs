import { describe, it, expect, beforeAll } from 'vitest';
import Decimal from 'decimal.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { computeRepaymentSchedule, autoSplitDeduction, computeBalanceFromEntries } from './computationEngine';
import type { ComputationParams } from '@vlprs/shared';

// ─── Task 4: Unit tests with hand-verified calculations ─────────────────────

describe('computeRepaymentSchedule', () => {
  // Task 4.2: Tier 1 (250K, 60 months) produces correct schedule
  it('computes correct schedule for Tier 1 (250K principal, 13.33% rate, 60 months)', () => {
    const params: ComputationParams = {
      principalAmount: '250000.00',
      interestRate: '13.330',
      tenureMonths: 60,
      moratoriumMonths: 0,
    };

    const result = computeRepaymentSchedule(params);

    // Hand-verified: 250000 × 13.33 / 100 = 33325.00
    expect(result.totalInterest).toBe('33325.00');
    // 250000 + 33325 = 283325.00
    expect(result.totalLoan).toBe('283325.00');
    // 250000 / 60 = 4166.666... → 4166.67
    expect(result.monthlyPrincipal).toBe('4166.67');
    // 33325 / 60 = 555.4166... → 555.42
    expect(result.monthlyInterest).toBe('555.42');
    // 4166.67 + 555.42 = 4722.09
    expect(result.monthlyDeduction).toBe('4722.09');
    expect(result.totalMonths).toBe(60);
    expect(result.schedule).toHaveLength(60);

    // First month
    expect(result.schedule[0]).toEqual({
      monthNumber: 1,
      principalComponent: '4166.67',
      interestComponent: '555.42',
      totalDeduction: '4722.09',
      runningBalance: '278602.91',
      isMoratorium: false,
    });

    // Last month — with last-payment adjustment, balance is exactly 0.00
    const last = result.schedule[59];
    expect(last.monthNumber).toBe(60);
    expect(last.isMoratorium).toBe(false);
    expect(last.runningBalance).toBe('0.00');
  });

  // Task 4.3: Tier 4 (750K, 60 months) produces correct schedule
  it('computes correct schedule for Tier 4 (750K principal, 13.33% rate, 60 months)', () => {
    const params: ComputationParams = {
      principalAmount: '750000.00',
      interestRate: '13.330',
      tenureMonths: 60,
      moratoriumMonths: 0,
    };

    const result = computeRepaymentSchedule(params);

    // 750000 × 13.33 / 100 = 99975.00
    expect(result.totalInterest).toBe('99975.00');
    // 750000 + 99975 = 849975.00
    expect(result.totalLoan).toBe('849975.00');
    // 750000 / 60 = 12500.00
    expect(result.monthlyPrincipal).toBe('12500.00');
    // 99975 / 60 = 1666.25
    expect(result.monthlyInterest).toBe('1666.25');
    // 12500 + 1666.25 = 14166.25
    expect(result.monthlyDeduction).toBe('14166.25');
    expect(result.totalMonths).toBe(60);
    expect(result.schedule).toHaveLength(60);

    // With last-payment adjustment, balance is exactly 0.00
    const last = result.schedule[59];
    expect(last.runningBalance).toBe('0.00');
  });

  // Task 4.4: Moratorium months show zero deduction, no interest accrual
  it('handles moratorium months correctly (2-month moratorium)', () => {
    const params: ComputationParams = {
      principalAmount: '250000.00',
      interestRate: '13.330',
      tenureMonths: 60,
      moratoriumMonths: 2,
    };

    const result = computeRepaymentSchedule(params);

    expect(result.totalMonths).toBe(62); // 2 moratorium + 60 active
    expect(result.schedule).toHaveLength(62);

    // Moratorium months (1-2): zero deduction, balance unchanged
    expect(result.schedule[0]).toEqual({
      monthNumber: 1,
      principalComponent: '0.00',
      interestComponent: '0.00',
      totalDeduction: '0.00',
      runningBalance: '283325.00',
      isMoratorium: true,
    });
    expect(result.schedule[1]).toEqual({
      monthNumber: 2,
      principalComponent: '0.00',
      interestComponent: '0.00',
      totalDeduction: '0.00',
      runningBalance: '283325.00',
      isMoratorium: true,
    });

    // Active repayment starts at month 3
    expect(result.schedule[2].monthNumber).toBe(3);
    expect(result.schedule[2].isMoratorium).toBe(false);
    expect(result.schedule[2].totalDeduction).toBe(result.monthlyDeduction);

    // Same monthly deduction as without moratorium
    const noMoratorium = computeRepaymentSchedule({ ...params, moratoriumMonths: 0 });
    expect(result.monthlyDeduction).toBe(noMoratorium.monthlyDeduction);
    expect(result.monthlyPrincipal).toBe(noMoratorium.monthlyPrincipal);
    expect(result.monthlyInterest).toBe(noMoratorium.monthlyInterest);
  });

  // Task 4.5: Determinism — call twice with same inputs, compare outputs deeply
  it('is deterministic — same inputs always produce identical outputs', () => {
    const params: ComputationParams = {
      principalAmount: '450000.00',
      interestRate: '11.110',
      tenureMonths: 50,
      moratoriumMonths: 0,
    };

    const result1 = computeRepaymentSchedule(params);
    const result2 = computeRepaymentSchedule(params);

    expect(result1).toEqual(result2);
  });

  // Task 4.6: Performance — 60-month schedule completes in < 1 second
  it('computes a 60-month schedule in < 1 second', () => {
    const params: ComputationParams = {
      principalAmount: '750000.00',
      interestRate: '13.330',
      tenureMonths: 60,
      moratoriumMonths: 2,
    };

    const start = performance.now();
    computeRepaymentSchedule(params);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(1000);
  });

  // Task 4.7: All money values are strings with exactly 2 decimal places
  it('returns all money values as strings with exactly 2 decimal places', () => {
    const params: ComputationParams = {
      principalAmount: '600000.00',
      interestRate: '13.330',
      tenureMonths: 60,
      moratoriumMonths: 2,
    };

    const result = computeRepaymentSchedule(params);
    const twoDecimalPattern = /^-?\d+\.\d{2}$/;

    // Top-level money fields
    expect(result.totalInterest).toMatch(twoDecimalPattern);
    expect(result.totalLoan).toMatch(twoDecimalPattern);
    expect(result.monthlyPrincipal).toMatch(twoDecimalPattern);
    expect(result.monthlyInterest).toMatch(twoDecimalPattern);
    expect(result.monthlyDeduction).toMatch(twoDecimalPattern);

    // Every schedule row
    for (const row of result.schedule) {
      expect(row.principalComponent).toMatch(twoDecimalPattern);
      expect(row.interestComponent).toMatch(twoDecimalPattern);
      expect(row.totalDeduction).toMatch(twoDecimalPattern);
      expect(row.runningBalance).toMatch(twoDecimalPattern);
    }
  });

  // ─── Edge case / input validation tests (Code Review: M4) ────────────────

  it('throws for tenureMonths = 0 (division by zero guard)', () => {
    expect(() =>
      computeRepaymentSchedule({
        principalAmount: '250000.00',
        interestRate: '13.330',
        tenureMonths: 0,
        moratoriumMonths: 0,
      }),
    ).toThrow('tenureMonths must be a positive integer');
  });

  it('throws for negative tenureMonths', () => {
    expect(() =>
      computeRepaymentSchedule({
        principalAmount: '250000.00',
        interestRate: '13.330',
        tenureMonths: -5,
        moratoriumMonths: 0,
      }),
    ).toThrow('tenureMonths must be a positive integer');
  });

  it('throws for invalid principalAmount string', () => {
    expect(() =>
      computeRepaymentSchedule({
        principalAmount: 'abc',
        interestRate: '13.330',
        tenureMonths: 60,
        moratoriumMonths: 0,
      }),
    ).toThrow();
  });

  it('throws for negative principalAmount', () => {
    expect(() =>
      computeRepaymentSchedule({
        principalAmount: '-100000.00',
        interestRate: '13.330',
        tenureMonths: 60,
        moratoriumMonths: 0,
      }),
    ).toThrow('principalAmount must be a positive number');
  });

  it('handles zero interest rate correctly', () => {
    const result = computeRepaymentSchedule({
      principalAmount: '250000.00',
      interestRate: '0.000',
      tenureMonths: 60,
      moratoriumMonths: 0,
    });

    expect(result.totalInterest).toBe('0.00');
    expect(result.totalLoan).toBe('250000.00');
    expect(result.monthlyInterest).toBe('0.00');
    expect(result.schedule).toHaveLength(60);
  });

  it('throws for negative moratoriumMonths', () => {
    expect(() =>
      computeRepaymentSchedule({
        principalAmount: '250000.00',
        interestRate: '13.330',
        tenureMonths: 60,
        moratoriumMonths: -1,
      }),
    ).toThrow('moratoriumMonths must be a non-negative integer');
  });
});

// ─── Task 5: Sports Council CSV validation tests ─────────────────────────────

/** Compare two money values with ₦0.01 tolerance using decimal.js (no floating-point) */
function withinOneKobo(computed: string, csv: string): boolean {
  const diff = new Decimal(computed).minus(new Decimal(csv)).abs();
  return diff.lte(new Decimal('0.01'));
}

/** Parse a CSV line handling quoted fields with commas */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current.trim());
  return fields;
}

interface CsvLoanRecord {
  sn: number;
  name: string;
  principal: string;
  totalInterest: string;
  totalLoan: string;
  tenure: number;
  monthlyInterest: string;
  monthlyDeduction: string;
  monthlyPrincipal: string;
}

function parseCsvFixture(): CsvLoanRecord[] {
  const csvPath = resolve(__dirname, '../../../../fixtures/sports-council-april-2025.csv');
  const raw = readFileSync(csvPath, 'utf-8');
  const lines = raw.split('\n');
  // Data rows start at line index 7 (row 8), skip empty/total rows
  return lines
    .slice(7)
    .filter((line) => line.trim() && /^\d/.test(line.trim()))
    .map((line) => {
      const cols = parseCSVLine(line);
      return {
        sn: parseInt(cols[0]),
        name: cols[2],
        principal: cols[3].replace(/,/g, ''),
        totalInterest: cols[4].replace(/,/g, ''),
        totalLoan: cols[5].replace(/,/g, ''),
        tenure: parseInt(cols[6]),
        monthlyInterest: cols[7].replace(/,/g, ''),
        monthlyDeduction: cols[8].replace(/,/g, ''),
        monthlyPrincipal: cols[9].replace(/,/g, ''),
      };
    })
    .filter((r) => !isNaN(r.sn));
}

describe('Sports Council CSV validation', () => {
  let csvRecords: CsvLoanRecord[];

  beforeAll(() => {
    csvRecords = parseCsvFixture();
  });

  it('parses at least 20 records from the CSV fixture', () => {
    expect(csvRecords.length).toBeGreaterThanOrEqual(20);
  });

  // Task 5.2: 5+ representative loans covering principal/tenure combos
  // Task 5.3: Validate monthly deduction, monthly principal, monthly interest match CSV to ₦0.01

  // Record #1: 250K / 60 months / 13.33%
  it('matches CSV record #1 (250K/60m) — monthly deduction, principal, interest', () => {
    const csv = csvRecords.find((r) => r.sn === 1)!;
    expect(csv).toBeDefined();

    // Derive interest rate: totalInterest / principal * 100
    // 33325 / 250000 * 100 = 13.33
    const result = computeRepaymentSchedule({
      principalAmount: '250000.00',
      interestRate: '13.330',
      tenureMonths: 60,
      moratoriumMonths: 0,
    });

    expect(result.totalInterest).toBe(new Decimal(csv.totalInterest).toFixed(2));
    expect(result.totalLoan).toBe(new Decimal(csv.totalLoan).toFixed(2));

    // CSV shows 4722.08 but computation yields 4722.09 due to rounding.
    // Records #1, #2 in CSV show 4722.08 while #10, #11 show 4722.09 for identical parameters.
    // Our engine uses consistent ROUND_HALF_UP → 4722.09. Accept ±₦0.01 tolerance.
    expect(withinOneKobo(result.monthlyDeduction, csv.monthlyDeduction)).toBe(true);
    expect(withinOneKobo(result.monthlyPrincipal, csv.monthlyPrincipal)).toBe(true);
    expect(withinOneKobo(result.monthlyInterest, csv.monthlyInterest)).toBe(true);
  });

  // Record #8: 450K / 50 months — rate derived from CSV data
  // Dev Notes shows ~11.11% but CSV totalInterest=49987.50 requires rate=11.10833...%
  // NUMERIC(5,3) cannot store this exactly; we derive rate from CSV to validate the formula.
  it('matches CSV record #8 (450K/50m) — monthly deduction, principal, interest', () => {
    const csv = csvRecords.find((r) => r.sn === 8)!;
    expect(csv).toBeDefined();

    // Derive effective rate from CSV: totalInterest / principal * 100
    // 49987.50 / 450000 * 100 = 11.10833... (repeating)
    const derivedRate = new Decimal(csv.totalInterest).div(new Decimal(csv.principal)).mul(100).toFixed(6);
    const result = computeRepaymentSchedule({
      principalAmount: '450000.00',
      interestRate: derivedRate,
      tenureMonths: 50,
      moratoriumMonths: 0,
    });

    expect(withinOneKobo(result.totalInterest, csv.totalInterest)).toBe(true);
    expect(withinOneKobo(result.monthlyDeduction, csv.monthlyDeduction)).toBe(true);
    expect(withinOneKobo(result.monthlyPrincipal, csv.monthlyPrincipal)).toBe(true);
    expect(withinOneKobo(result.monthlyInterest, csv.monthlyInterest)).toBe(true);
  });

  // Record #9: 450K / 60 months / 13.33%
  it('matches CSV record #9 (450K/60m) — monthly deduction, principal, interest', () => {
    const csv = csvRecords.find((r) => r.sn === 9)!;
    expect(csv).toBeDefined();

    // 59985 / 450000 * 100 = 13.33
    const result = computeRepaymentSchedule({
      principalAmount: '450000.00',
      interestRate: '13.330',
      tenureMonths: 60,
      moratoriumMonths: 0,
    });

    expect(result.totalInterest).toBe(new Decimal(csv.totalInterest).toFixed(2));
    expect(withinOneKobo(result.monthlyDeduction, csv.monthlyDeduction)).toBe(true);
    expect(withinOneKobo(result.monthlyPrincipal, csv.monthlyPrincipal)).toBe(true);
    expect(withinOneKobo(result.monthlyInterest, csv.monthlyInterest)).toBe(true);
  });

  // Record #18: 600K / 60 months / 13.33%
  it('matches CSV record #18 (600K/60m) — monthly deduction, principal, interest', () => {
    const csv = csvRecords.find((r) => r.sn === 18)!;
    expect(csv).toBeDefined();

    const result = computeRepaymentSchedule({
      principalAmount: '600000.00',
      interestRate: '13.330',
      tenureMonths: 60,
      moratoriumMonths: 0,
    });

    expect(result.totalInterest).toBe(new Decimal(csv.totalInterest).toFixed(2));
    expect(withinOneKobo(result.monthlyDeduction, csv.monthlyDeduction)).toBe(true);
    expect(withinOneKobo(result.monthlyPrincipal, csv.monthlyPrincipal)).toBe(true);
    expect(withinOneKobo(result.monthlyInterest, csv.monthlyInterest)).toBe(true);
  });

  // Record #3: 750K / 60 months / 13.33%
  it('matches CSV record #3 (750K/60m) — monthly deduction, principal, interest', () => {
    const csv = csvRecords.find((r) => r.sn === 3)!;
    expect(csv).toBeDefined();

    const result = computeRepaymentSchedule({
      principalAmount: '750000.00',
      interestRate: '13.330',
      tenureMonths: 60,
      moratoriumMonths: 0,
    });

    expect(result.totalInterest).toBe(new Decimal(csv.totalInterest).toFixed(2));
    expect(result.monthlyDeduction).toBe(new Decimal(csv.monthlyDeduction).toFixed(2));
    expect(result.monthlyPrincipal).toBe(new Decimal(csv.monthlyPrincipal).toFixed(2));
    expect(result.monthlyInterest).toBe(new Decimal(csv.monthlyInterest).toFixed(2));
  });

  // Record #17: 750K / 48 months / 6.664%
  it('matches CSV record #17 (750K/48m) — monthly deduction, principal, interest', () => {
    const csv = csvRecords.find((r) => r.sn === 17)!;
    expect(csv).toBeDefined();

    const result = computeRepaymentSchedule({
      principalAmount: '750000.00',
      interestRate: '6.664',
      tenureMonths: 48,
      moratoriumMonths: 0,
    });

    expect(result.totalInterest).toBe(new Decimal(csv.totalInterest).toFixed(2));
    expect(result.monthlyDeduction).toBe(new Decimal(csv.monthlyDeduction).toFixed(2));
    expect(result.monthlyPrincipal).toBe(new Decimal(csv.monthlyPrincipal).toFixed(2));
    expect(result.monthlyInterest).toBe(new Decimal(csv.monthlyInterest).toFixed(2));
  });

  // Record #20: 600K / 30 months / 6.665%
  it('matches CSV record #20 (600K/30m) — monthly deduction, principal, interest', () => {
    const csv = csvRecords.find((r) => r.sn === 20)!;
    expect(csv).toBeDefined();

    const result = computeRepaymentSchedule({
      principalAmount: '600000.00',
      interestRate: '6.665',
      tenureMonths: 30,
      moratoriumMonths: 0,
    });

    expect(result.totalInterest).toBe(new Decimal(csv.totalInterest).toFixed(2));
    expect(result.monthlyDeduction).toBe(new Decimal(csv.monthlyDeduction).toFixed(2));
    expect(result.monthlyPrincipal).toBe(new Decimal(csv.monthlyPrincipal).toFixed(2));
    expect(result.monthlyInterest).toBe(new Decimal(csv.monthlyInterest).toFixed(2));
  });

  // Task 5.4: Document CSV records with known data anomalies
  it('documents record #14 anomaly (negative principal, missing deduction)', () => {
    const record14 = csvRecords.find((r) => r.sn === 14);
    expect(record14).toBeDefined();
    // Record #14 has Monthly Principal = "-1,199.70" (negative) and empty Monthly Deduction
    // This is a data anomaly — likely a fully-paid or adjustment record
    // The computation engine cannot/should not reproduce this anomaly
    expect(new Decimal(record14!.monthlyPrincipal).isNegative()).toBe(true);
  });

  it('documents records #10/#11 rounding inconsistency vs #1/#2', () => {
    // Records #1, #2: 250K/60m/13.33% → CSV shows Monthly Deduction = 4,722.08
    // Records #10, #11: identical parameters → CSV shows Monthly Deduction = 4,722.09
    // Computation engine uses consistent ROUND_HALF_UP → produces one value
    const record1 = csvRecords.find((r) => r.sn === 1)!;
    const record10 = csvRecords.find((r) => r.sn === 10)!;

    // Same principal/tenure/interest but different CSV deductions — spreadsheet inconsistency
    expect(record1.principal).toBe(record10.principal);
    expect(record1.totalInterest).toBe(record10.totalInterest);
    expect(record1.tenure).toBe(record10.tenure);

    // The engine produces a single consistent value — both within ±₦0.01 of CSV
    const result = computeRepaymentSchedule({
      principalAmount: '250000.00',
      interestRate: '13.330',
      tenureMonths: 60,
      moratoriumMonths: 0,
    });

    expect(withinOneKobo(result.monthlyDeduction, record1.monthlyDeduction)).toBe(true);
    expect(withinOneKobo(result.monthlyDeduction, record10.monthlyDeduction)).toBe(true);
  });
});

// ─── Story 2.4 Task 4: Last-payment adjustment tests ──────────────────────────

describe('Last-payment adjustment (Story 2.4)', () => {
  // Task 4.1: All 4 tier standard schedules close at exactly ₦0.00
  const tierParams: ComputationParams[] = [
    { principalAmount: '250000.00', interestRate: '13.330', tenureMonths: 60, moratoriumMonths: 0 },
    { principalAmount: '450000.00', interestRate: '13.330', tenureMonths: 60, moratoriumMonths: 0 },
    { principalAmount: '600000.00', interestRate: '13.330', tenureMonths: 60, moratoriumMonths: 0 },
    { principalAmount: '750000.00', interestRate: '13.330', tenureMonths: 60, moratoriumMonths: 0 },
  ];

  it.each(tierParams)(
    'Tier $principalAmount/60m closes at exactly ₦0.00',
    (params) => {
      const result = computeRepaymentSchedule(params);
      const last = result.schedule[result.schedule.length - 1];
      expect(last.runningBalance).toBe('0.00');
    },
  );

  // Task 4.2: Final row's principalComponent + interestComponent = totalDeduction
  it.each(tierParams)(
    'Tier $principalAmount — final row principal + interest = totalDeduction',
    (params) => {
      const result = computeRepaymentSchedule(params);
      const last = result.schedule[result.schedule.length - 1];
      const sum = new Decimal(last.principalComponent).plus(new Decimal(last.interestComponent));
      expect(sum.toFixed(2)).toBe(last.totalDeduction);
    },
  );

  // Task 4.3: All non-final rows unchanged from Story 2.3 uniform values
  it.each(tierParams)(
    'Tier $principalAmount — non-final active rows use uniform deduction',
    (params) => {
      const result = computeRepaymentSchedule(params);
      const activeRows = result.schedule.filter((r) => !r.isMoratorium);
      // All rows except the last should have uniform values
      for (let i = 0; i < activeRows.length - 1; i++) {
        expect(activeRows[i].principalComponent).toBe(result.monthlyPrincipal);
        expect(activeRows[i].interestComponent).toBe(result.monthlyInterest);
        expect(activeRows[i].totalDeduction).toBe(result.monthlyDeduction);
      }
    },
  );

  // Task 4.4: Rounding residual verification — |finalDeduction - uniformDeduction| < ₦1.00
  it.each(tierParams)(
    'Tier $principalAmount — rounding residual < ₦1.00',
    (params) => {
      const result = computeRepaymentSchedule(params);
      const last = result.schedule[result.schedule.length - 1];
      const diff = new Decimal(last.totalDeduction).minus(new Decimal(result.monthlyDeduction)).abs();
      expect(diff.lt(new Decimal('1.00'))).toBe(true);
    },
  );

  // Moratorium + last-payment adjustment: schedule still closes at ₦0.00
  it('schedule with moratorium still closes at exactly ₦0.00', () => {
    const result = computeRepaymentSchedule({
      principalAmount: '250000.00',
      interestRate: '13.330',
      tenureMonths: 60,
      moratoriumMonths: 2,
    });
    const last = result.schedule[result.schedule.length - 1];
    expect(last.runningBalance).toBe('0.00');
    expect(last.monthNumber).toBe(62);
  });

  // L1 fix: Verify sum of all principal components = principal exactly (all 4 tiers)
  it.each(tierParams)(
    'Tier $principalAmount — sum of all principalComponents equals principal exactly',
    (params) => {
      const result = computeRepaymentSchedule(params);
      const totalPrincipal = result.schedule.reduce(
        (sum, row) => sum.plus(new Decimal(row.principalComponent)),
        new Decimal('0'),
      );
      expect(totalPrincipal.toFixed(2)).toBe(params.principalAmount);
    },
  );

  // L1 fix: Verify sum of all interest components = totalInterest exactly (all 4 tiers)
  it.each(tierParams)(
    'Tier $principalAmount — sum of all interestComponents equals totalInterest exactly',
    (params) => {
      const result = computeRepaymentSchedule(params);
      const totalInterestSum = result.schedule.reduce(
        (sum, row) => sum.plus(new Decimal(row.interestComponent)),
        new Decimal('0'),
      );
      expect(totalInterestSum.toFixed(2)).toBe(result.totalInterest);
    },
  );

  // M2 fix: tenure=1 boundary — first active month IS the last active month
  it('tenure=1 produces single payment equal to totalLoan, closing at ₦0.00', () => {
    const result = computeRepaymentSchedule({
      principalAmount: '250000.00',
      interestRate: '13.330',
      tenureMonths: 1,
      moratoriumMonths: 0,
    });
    expect(result.schedule).toHaveLength(1);
    const only = result.schedule[0];
    expect(only.runningBalance).toBe('0.00');
    expect(only.totalDeduction).toBe(result.totalLoan);
    expect(only.principalComponent).toBe('250000.00');
    expect(only.interestComponent).toBe('33325.00');
  });

  // M2 fix: tenure=1 with moratorium
  it('tenure=1 with moratorium closes at ₦0.00', () => {
    const result = computeRepaymentSchedule({
      principalAmount: '250000.00',
      interestRate: '13.330',
      tenureMonths: 1,
      moratoriumMonths: 2,
    });
    expect(result.schedule).toHaveLength(3);
    expect(result.schedule[0].isMoratorium).toBe(true);
    expect(result.schedule[1].isMoratorium).toBe(true);
    const last = result.schedule[2];
    expect(last.runningBalance).toBe('0.00');
    expect(last.totalDeduction).toBe(result.totalLoan);
  });
});

// ─── Story 2.4 Task 5: Accelerated repayment tests ────────────────────────────

describe('Accelerated repayment (Story 2.4)', () => {
  // Task 5.1: 60→45 month acceleration produces correct higher monthly payments
  it('60→45 month acceleration produces higher monthly payments', () => {
    const standard = computeRepaymentSchedule({
      principalAmount: '750000.00',
      interestRate: '13.330',
      tenureMonths: 60,
      moratoriumMonths: 0,
    });
    const accelerated = computeRepaymentSchedule({
      principalAmount: '750000.00',
      interestRate: '13.330',
      tenureMonths: 45,
      moratoriumMonths: 0,
    });

    // Higher monthly deduction for shorter tenure
    expect(new Decimal(accelerated.monthlyDeduction).gt(new Decimal(standard.monthlyDeduction))).toBe(true);
    // Correct monthly principal: 750000 / 45 = 16666.67
    expect(accelerated.monthlyPrincipal).toBe('16666.67');
    // Correct monthly interest: 99975 / 45 = 2221.67
    expect(accelerated.monthlyInterest).toBe('2221.67');
    expect(accelerated.totalMonths).toBe(45);
    expect(accelerated.schedule).toHaveLength(45);
  });

  // Task 5.2: Total interest unchanged between 60-month and 45-month schedules
  it('total interest unchanged between 60-month and 45-month schedules (flat-rate)', () => {
    const standard = computeRepaymentSchedule({
      principalAmount: '750000.00',
      interestRate: '13.330',
      tenureMonths: 60,
      moratoriumMonths: 0,
    });
    const accelerated = computeRepaymentSchedule({
      principalAmount: '750000.00',
      interestRate: '13.330',
      tenureMonths: 45,
      moratoriumMonths: 0,
    });

    // Flat-rate: interest = principal × rate / 100, independent of tenure
    expect(standard.totalInterest).toBe(accelerated.totalInterest);
    expect(standard.totalLoan).toBe(accelerated.totalLoan);
  });

  // Task 5.3: Accelerated schedule closes at exactly ₦0.00
  it('accelerated schedule (45 months) closes at exactly ₦0.00', () => {
    const result = computeRepaymentSchedule({
      principalAmount: '750000.00',
      interestRate: '13.330',
      tenureMonths: 45,
      moratoriumMonths: 0,
    });
    const last = result.schedule[result.schedule.length - 1];
    expect(last.runningBalance).toBe('0.00');
  });

  // Task 5.4: CSV fixture accelerated loans
  it('CSV record #15 (750K/50mo) — schedule closes at ₦0.00', () => {
    const result = computeRepaymentSchedule({
      principalAmount: '750000.00',
      interestRate: '11.108',
      tenureMonths: 50,
      moratoriumMonths: 0,
    });
    const last = result.schedule[result.schedule.length - 1];
    expect(last.runningBalance).toBe('0.00');
    expect(withinOneKobo(result.monthlyPrincipal, '15000.00')).toBe(true);
  });

  it('CSV record #17 (750K/48mo) — schedule closes at ₦0.00', () => {
    const result = computeRepaymentSchedule({
      principalAmount: '750000.00',
      interestRate: '6.664',
      tenureMonths: 48,
      moratoriumMonths: 0,
    });
    const last = result.schedule[result.schedule.length - 1];
    expect(last.runningBalance).toBe('0.00');
    expect(result.monthlyPrincipal).toBe('15625.00');
    expect(result.monthlyInterest).toBe('1041.25');
  });

  it('CSV record #20 (600K/30mo) — schedule closes at ₦0.00', () => {
    const result = computeRepaymentSchedule({
      principalAmount: '600000.00',
      interestRate: '6.665',
      tenureMonths: 30,
      moratoriumMonths: 0,
    });
    const last = result.schedule[result.schedule.length - 1];
    expect(last.runningBalance).toBe('0.00');
    expect(result.monthlyPrincipal).toBe('20000.00');
    expect(result.monthlyInterest).toBe('1333.00');
  });

  it('CSV record #21 (450K/40mo) — schedule closes at ₦0.00 with correct monthly values', () => {
    const result = computeRepaymentSchedule({
      principalAmount: '450000.00',
      interestRate: '8.887',
      tenureMonths: 40,
      moratoriumMonths: 0,
    });
    const last = result.schedule[result.schedule.length - 1];
    expect(last.runningBalance).toBe('0.00');
    // L2 fix: verify monthly values against CSV (450K/40 = 11250.00 principal, 39991.50/40 = 999.79 interest)
    expect(result.monthlyPrincipal).toBe('11250.00');
    expect(withinOneKobo(result.monthlyInterest, '999.79')).toBe(true);
    expect(withinOneKobo(result.monthlyDeduction, '12249.79')).toBe(true);
  });

  // CSV record #8 (450K/50mo) — use derived rate from CSV data
  it('CSV record #8 (450K/50mo) — schedule closes at ₦0.00', () => {
    // Derived rate: 49987.50 / 450000 × 100 = 11.10833...
    const derivedRate = new Decimal('49987.50').div(new Decimal('450000')).mul(100).toFixed(6);
    const result = computeRepaymentSchedule({
      principalAmount: '450000.00',
      interestRate: derivedRate,
      tenureMonths: 50,
      moratoriumMonths: 0,
    });
    const last = result.schedule[result.schedule.length - 1];
    expect(last.runningBalance).toBe('0.00');
  });

  // M4 fix: NUMERIC(5,3) precision awareness — record #8 with truncated rate
  it('CSV record #8 (450K/50mo) — NUMERIC(5,3) truncated rate (11.108) still closes at ₦0.00', () => {
    // When stored as NUMERIC(5,3), rate 11.10833... truncates to 11.108
    // This produces totalInterest = 49986.00 vs CSV's 49987.50 (₦1.50 gap)
    // The engine still closes correctly, but downstream migration validation (Story 3.2)
    // must account for this storage precision loss
    const result = computeRepaymentSchedule({
      principalAmount: '450000.00',
      interestRate: '11.108',
      tenureMonths: 50,
      moratoriumMonths: 0,
    });
    const last = result.schedule[result.schedule.length - 1];
    expect(last.runningBalance).toBe('0.00');
    // Document the precision gap for Story 3.2 awareness
    expect(result.totalInterest).toBe('49986.00'); // not 49987.50 from CSV
  });

  // Accelerated with moratorium
  it('accelerated schedule with moratorium closes at ₦0.00', () => {
    const result = computeRepaymentSchedule({
      principalAmount: '750000.00',
      interestRate: '13.330',
      tenureMonths: 45,
      moratoriumMonths: 2,
    });
    expect(result.totalMonths).toBe(47);
    const last = result.schedule[result.schedule.length - 1];
    expect(last.runningBalance).toBe('0.00');
  });
});

// ─── Story 2.4 Task 6: Auto-split tests ───────────────────────────────────────

describe('autoSplitDeduction (Story 2.4)', () => {
  const standardParams: ComputationParams = {
    principalAmount: '250000.00',
    interestRate: '13.330',
    tenureMonths: 60,
    moratoriumMonths: 0,
  };

  // Task 6.1: Standard deduction → split matches schedule's monthlyPrincipal + monthlyInterest
  it('standard deduction splits match schedule monthly values (250K)', () => {
    const schedule = computeRepaymentSchedule(standardParams);
    const split = autoSplitDeduction(schedule.monthlyDeduction, standardParams);

    expect(split.principalComponent).toBe(schedule.monthlyPrincipal);
    expect(split.interestComponent).toBe(schedule.monthlyInterest);
  });

  // Task 6.2: Non-standard deduction (₦0.01 more) → principal + interest = deduction exactly
  it('non-standard deduction (₦0.01 more) sums exactly', () => {
    const schedule = computeRepaymentSchedule(standardParams);
    const overAmount = new Decimal(schedule.monthlyDeduction).plus('0.01').toFixed(2);
    const split = autoSplitDeduction(overAmount, standardParams);

    const sum = new Decimal(split.principalComponent).plus(new Decimal(split.interestComponent));
    expect(sum.toFixed(2)).toBe(overAmount);
  });

  // Task 6.3: Non-standard deduction (₦0.01 less) → principal + interest = deduction exactly
  it('non-standard deduction (₦0.01 less) sums exactly', () => {
    const schedule = computeRepaymentSchedule(standardParams);
    const underAmount = new Decimal(schedule.monthlyDeduction).minus('0.01').toFixed(2);
    const split = autoSplitDeduction(underAmount, standardParams);

    const sum = new Decimal(split.principalComponent).plus(new Decimal(split.interestComponent));
    expect(sum.toFixed(2)).toBe(underAmount);
  });

  // Task 6.4: All 4 tiers × standard + non-standard amounts
  const allTierParams: { label: string; params: ComputationParams }[] = [
    { label: '250K/13.33%', params: { principalAmount: '250000.00', interestRate: '13.330', tenureMonths: 60, moratoriumMonths: 0 } },
    { label: '450K/13.33%', params: { principalAmount: '450000.00', interestRate: '13.330', tenureMonths: 60, moratoriumMonths: 0 } },
    { label: '600K/13.33%', params: { principalAmount: '600000.00', interestRate: '13.330', tenureMonths: 60, moratoriumMonths: 0 } },
    { label: '750K/13.33%', params: { principalAmount: '750000.00', interestRate: '13.330', tenureMonths: 60, moratoriumMonths: 0 } },
  ];

  it.each(allTierParams)(
    '$label — standard deduction split matches schedule values',
    ({ params }) => {
      const schedule = computeRepaymentSchedule(params);
      const split = autoSplitDeduction(schedule.monthlyDeduction, params);
      expect(split.principalComponent).toBe(schedule.monthlyPrincipal);
      expect(split.interestComponent).toBe(schedule.monthlyInterest);
    },
  );

  it.each(allTierParams)(
    '$label — non-standard deduction (+₦100) sums exactly',
    ({ params }) => {
      const schedule = computeRepaymentSchedule(params);
      const overAmount = new Decimal(schedule.monthlyDeduction).plus('100').toFixed(2);
      const split = autoSplitDeduction(overAmount, params);
      const sum = new Decimal(split.principalComponent).plus(new Decimal(split.interestComponent));
      expect(sum.toFixed(2)).toBe(overAmount);
    },
  );

  it.each(allTierParams)(
    '$label — non-standard deduction (-₦100) sums exactly',
    ({ params }) => {
      const schedule = computeRepaymentSchedule(params);
      const underAmount = new Decimal(schedule.monthlyDeduction).minus('100').toFixed(2);
      const split = autoSplitDeduction(underAmount, params);
      const sum = new Decimal(split.principalComponent).plus(new Decimal(split.interestComponent));
      expect(sum.toFixed(2)).toBe(underAmount);
    },
  );

  // Verify all split components are proper 2-decimal strings
  it('all split components are strings with exactly 2 decimal places', () => {
    const twoDecimalPattern = /^-?\d+\.\d{2}$/;
    const split = autoSplitDeduction('5000.00', standardParams);
    expect(split.principalComponent).toMatch(twoDecimalPattern);
    expect(split.interestComponent).toMatch(twoDecimalPattern);
  });

  // H1 fix: input validation tests
  it('throws for invalid deductionAmount string', () => {
    expect(() => autoSplitDeduction('abc', standardParams)).toThrow('deductionAmount must be a valid number');
  });

  it('throws for negative principalAmount in params', () => {
    expect(() =>
      autoSplitDeduction('5000.00', { ...standardParams, principalAmount: '-100000.00' }),
    ).toThrow('principalAmount must be a positive number');
  });

  it('throws for negative interestRate in params', () => {
    expect(() =>
      autoSplitDeduction('5000.00', { ...standardParams, interestRate: '-5.000' }),
    ).toThrow('interestRate must be a non-negative number');
  });
});

// ─── Story 2.5 Task 6: Balance computation tests ────────────────────────────

describe('computeBalanceFromEntries (Story 2.5)', () => {
  // Helper to create a PAYROLL entry
  function payrollEntry(amount: string, principal: string, interest: string) {
    return { amount, principalComponent: principal, interestComponent: interest, entryType: 'PAYROLL' };
  }

  // Task 6.2: zero entries → balance = totalLoan (no payments made)
  it('zero entries → balance equals totalLoan', () => {
    const result = computeBalanceFromEntries('250000.00', '13.330', 60, [], null);

    // totalLoan = 250000 + (250000 × 13.33 / 100) = 250000 + 33325 = 283325.00
    expect(result.computedBalance).toBe('283325.00');
    expect(result.totalAmountPaid).toBe('0.00');
    expect(result.totalPrincipalPaid).toBe('0.00');
    expect(result.totalInterestPaid).toBe('0.00');
    expect(result.principalRemaining).toBe('250000.00');
    expect(result.interestRemaining).toBe('33325.00');
    expect(result.installmentsCompleted).toBe(0);
    expect(result.installmentsRemaining).toBe(60);
    expect(result.entryCount).toBe(0);
    expect(result.asOfDate).toBeNull();
    expect(result.derivation.formula).toBe('totalLoan - sum(entries.amount)');
    expect(result.derivation.totalLoan).toBe('283325.00');
    expect(result.derivation.entriesSum).toBe('0.00');
  });

  // Task 6.3: partial entries (30 of 60) → correct remaining balance
  it('partial entries (30 of 60) → correct remaining balance', () => {
    // 250K principal, 13.33% rate, 60 months
    // monthlyPrincipal = 4166.67, monthlyInterest = 555.42, monthlyDeduction = 4722.09
    const entries = Array.from({ length: 30 }, () =>
      payrollEntry('4722.09', '4166.67', '555.42'),
    );

    const result = computeBalanceFromEntries('250000.00', '13.330', 60, entries, null);

    // totalAmountPaid = 30 × 4722.09 = 141662.70
    expect(result.totalAmountPaid).toBe('141662.70');
    // computedBalance = 283325.00 - 141662.70 = 141662.30
    expect(result.computedBalance).toBe('141662.30');
    expect(result.totalPrincipalPaid).toBe('125000.10'); // 30 × 4166.67
    expect(result.totalInterestPaid).toBe('16662.60');   // 30 × 555.42
    expect(result.installmentsCompleted).toBe(30);
    expect(result.installmentsRemaining).toBe(30);
    expect(result.entryCount).toBe(30);
  });

  // Task 6.4: all entries → balance = ₦0.00 (fully paid)
  it('all entries with last-payment adjustment → balance = 0.00', () => {
    // Use the schedule engine to get exact values including last-payment adjustment
    const schedule = computeRepaymentSchedule({
      principalAmount: '250000.00',
      interestRate: '13.330',
      tenureMonths: 60,
      moratoriumMonths: 0,
    });

    const entries = schedule.schedule.map((row) =>
      payrollEntry(row.totalDeduction, row.principalComponent, row.interestComponent),
    );

    const result = computeBalanceFromEntries('250000.00', '13.330', 60, entries, null);

    expect(result.computedBalance).toBe('0.00');
    expect(result.principalRemaining).toBe('0.00');
    expect(result.interestRemaining).toBe('0.00');
    expect(result.installmentsCompleted).toBe(60);
    expect(result.installmentsRemaining).toBe(0);
  });

  // Task 6.5: subset of entries (historical) → correct balance at that point
  it('subset of entries (historical) → correct balance at that point', () => {
    // First 10 entries out of 60
    const entries = Array.from({ length: 10 }, () =>
      payrollEntry('4722.09', '4166.67', '555.42'),
    );

    const result = computeBalanceFromEntries('250000.00', '13.330', 60, entries, '2025-06-30');

    expect(result.totalAmountPaid).toBe('47220.90');      // 10 × 4722.09
    expect(result.computedBalance).toBe('236104.10');      // 283325.00 - 47220.90
    expect(result.installmentsCompleted).toBe(10);
    expect(result.installmentsRemaining).toBe(50);
    expect(result.asOfDate).toBe('2025-06-30');
  });

  // Task 6.6: determinism — same inputs produce identical output
  it('is deterministic — same inputs produce identical output', () => {
    const entries = Array.from({ length: 5 }, () =>
      payrollEntry('4722.09', '4166.67', '555.42'),
    );

    const result1 = computeBalanceFromEntries('250000.00', '13.330', 60, entries, null);
    const result2 = computeBalanceFromEntries('250000.00', '13.330', 60, entries, null);

    expect(result1).toEqual(result2);
  });

  // Task 6.7: all money values are strings with exactly 2 decimal places
  it('all money values are strings with exactly 2 decimal places', () => {
    const entries = Array.from({ length: 15 }, () =>
      payrollEntry('4722.09', '4166.67', '555.42'),
    );

    const result = computeBalanceFromEntries('250000.00', '13.330', 60, entries, null);
    const twoDecimalPattern = /^-?\d+\.\d{2}$/;

    expect(result.computedBalance).toMatch(twoDecimalPattern);
    expect(result.totalPrincipalPaid).toMatch(twoDecimalPattern);
    expect(result.totalInterestPaid).toMatch(twoDecimalPattern);
    expect(result.totalAmountPaid).toMatch(twoDecimalPattern);
    expect(result.principalRemaining).toMatch(twoDecimalPattern);
    expect(result.interestRemaining).toMatch(twoDecimalPattern);
    expect(result.derivation.totalLoan).toMatch(twoDecimalPattern);
    expect(result.derivation.entriesSum).toMatch(twoDecimalPattern);
  });

  // Non-PAYROLL entries affect balance but not installment count
  it('ADJUSTMENT entries affect balance but not installment count', () => {
    const entries = [
      payrollEntry('4722.09', '4166.67', '555.42'),
      { amount: '1000.00', principalComponent: '800.00', interestComponent: '200.00', entryType: 'ADJUSTMENT' },
    ];

    const result = computeBalanceFromEntries('250000.00', '13.330', 60, entries, null);

    expect(result.totalAmountPaid).toBe('5722.09');
    expect(result.installmentsCompleted).toBe(1); // Only PAYROLL counts
    expect(result.installmentsRemaining).toBe(59);
    expect(result.entryCount).toBe(2);
  });

  // installmentsRemaining never goes below 0
  it('installmentsRemaining never goes below 0 for fully-paid loan', () => {
    const schedule = computeRepaymentSchedule({
      principalAmount: '250000.00',
      interestRate: '13.330',
      tenureMonths: 60,
      moratoriumMonths: 0,
    });

    const entries = schedule.schedule.map((row) =>
      payrollEntry(row.totalDeduction, row.principalComponent, row.interestComponent),
    );

    const result = computeBalanceFromEntries('250000.00', '13.330', 60, entries, null);

    expect(result.installmentsRemaining).toBe(0);
    expect(result.installmentsRemaining).toBeGreaterThanOrEqual(0);
  });

  // All 4 tiers with full schedule close at 0.00
  const tierConfigs = [
    { principal: '250000.00', rate: '13.330', tenure: 60, label: '250K/60m' },
    { principal: '450000.00', rate: '13.330', tenure: 60, label: '450K/60m' },
    { principal: '600000.00', rate: '13.330', tenure: 60, label: '600K/60m' },
    { principal: '750000.00', rate: '13.330', tenure: 60, label: '750K/60m' },
  ];

  it.each(tierConfigs)(
    '$label — fully paid balance = 0.00 using schedule entries',
    ({ principal, rate, tenure }) => {
      const schedule = computeRepaymentSchedule({
        principalAmount: principal,
        interestRate: rate,
        tenureMonths: tenure,
        moratoriumMonths: 0,
      });

      const entries = schedule.schedule.map((row) =>
        payrollEntry(row.totalDeduction, row.principalComponent, row.interestComponent),
      );

      const result = computeBalanceFromEntries(principal, rate, tenure, entries, null);
      expect(result.computedBalance).toBe('0.00');
    },
  );

  // H2 fix: input validation tests (consistent with computeRepaymentSchedule/autoSplitDeduction)
  it('throws for negative principalAmount', () => {
    expect(() => computeBalanceFromEntries('-100000.00', '13.330', 60, [], null))
      .toThrow('principalAmount must be a positive number');
  });

  it('throws for zero tenureMonths', () => {
    expect(() => computeBalanceFromEntries('250000.00', '13.330', 0, [], null))
      .toThrow('tenureMonths must be a positive integer');
  });

  it('throws for negative interestRate', () => {
    expect(() => computeBalanceFromEntries('250000.00', '-5.000', 60, [], null))
      .toThrow('interestRate must be a non-negative number');
  });

  // M3 fix: anomaly flag when entries exceed totalLoan
  it('flags isAnomaly when entries exceed totalLoan', () => {
    const entries = [payrollEntry('300000.00', '250000.00', '50000.00')];
    const result = computeBalanceFromEntries('250000.00', '13.330', 60, entries, null);

    expect(result.derivation.isAnomaly).toBe(true);
    expect(result.computedBalance).toBe('-16675.00');
  });

  it('does not flag isAnomaly for normal balance', () => {
    const result = computeBalanceFromEntries('250000.00', '13.330', 60, [], null);
    expect(result.derivation.isAnomaly).toBe(false);
  });
});

