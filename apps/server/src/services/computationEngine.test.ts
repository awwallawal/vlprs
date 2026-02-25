import { describe, it, expect, beforeAll } from 'vitest';
import Decimal from 'decimal.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { computeRepaymentSchedule } from './computationEngine';
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

    // Last month
    const last = result.schedule[59];
    expect(last.monthNumber).toBe(60);
    expect(last.isMoratorium).toBe(false);

    // Final running balance should be small residual (< ₦1.00)
    const residual = Math.abs(parseFloat(last.runningBalance));
    expect(residual).toBeLessThan(1.0);
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

    // Final running balance should be small residual (< ₦1.00)
    const last = result.schedule[59];
    const residual = Math.abs(parseFloat(last.runningBalance));
    expect(residual).toBeLessThan(1.0);
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

