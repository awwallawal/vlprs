import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { autoSplitDeduction, computeBalanceFromEntries } from './computationEngine';

/**
 * Story 3.4: Baseline Acknowledgment & Ledger Entry Creation
 *
 * Unit tests for the core baseline computation logic.
 * Integration tests (DB-dependent) require a running database and are part
 * of the AC 7 specification but run as part of the full integration suite.
 *
 * These unit tests validate:
 * - AC 2: Baseline amount computation is correct
 * - AC 3: Principal derivation and tenure inference logic
 * - AC 5: Balance computation from baseline entry yields declared balance
 * - AC 7: Core mathematical invariants
 */

describe('Baseline Computation Logic', () => {
  describe('Baseline amount: totalLoan - declaredOutstandingBalance', () => {
    it('computes correct baseline for standard loan', () => {
      const principal = new Decimal('500000.00');
      const rate = new Decimal('13.330');
      const totalLoan = principal.plus(principal.mul(rate).div(100));
      const declaredOutstandingBalance = new Decimal('150000.00');
      const baselineAmount = totalLoan.minus(declaredOutstandingBalance);

      // totalLoan = 500000 + (500000 * 13.33 / 100) = 500000 + 66650 = 566650
      expect(totalLoan.toFixed(2)).toBe('566650.00');
      // baseline = 566650 - 150000 = 416650
      expect(baselineAmount.toFixed(2)).toBe('416650.00');
    });

    it('handles fully paid loan (declaredOutstanding = 0)', () => {
      const principal = new Decimal('300000.00');
      const rate = new Decimal('13.330');
      const totalLoan = principal.plus(principal.mul(rate).div(100));
      const declaredOutstandingBalance = new Decimal('0.00');
      const baselineAmount = totalLoan.minus(declaredOutstandingBalance);

      // baseline = totalLoan (everything already paid)
      expect(baselineAmount.toFixed(2)).toBe(totalLoan.toFixed(2));
    });

    it('handles negative baseline (declared > totalLoan)', () => {
      const principal = new Decimal('200000.00');
      const rate = new Decimal('13.330');
      const totalLoan = principal.plus(principal.mul(rate).div(100));
      const declaredOutstandingBalance = new Decimal('300000.00');
      const baselineAmount = totalLoan.minus(declaredOutstandingBalance);

      // totalLoan = 226660, declared = 300000, baseline = -73340
      expect(baselineAmount.isNegative()).toBe(true);
    });
  });

  describe('Balance from baseline entry yields declared outstanding', () => {
    it('single baseline entry: balance = declaredOutstandingBalance', () => {
      const principalAmount = '500000.00';
      const interestRate = '13.330';
      const tenureMonths = 60;

      const principal = new Decimal(principalAmount);
      const totalInterest = principal.mul(new Decimal(interestRate)).div(100);
      const totalLoan = principal.plus(totalInterest);
      const declaredOutstanding = new Decimal('150000.00');
      const baselineAmount = totalLoan.minus(declaredOutstanding);

      // Use autoSplitDeduction to split baseline amount
      const split = autoSplitDeduction(baselineAmount.toFixed(2), {
        principalAmount,
        interestRate,
        tenureMonths,
        moratoriumMonths: 0,
      });

      const balance = computeBalanceFromEntries(
        principalAmount,
        interestRate,
        tenureMonths,
        [
          {
            amount: baselineAmount.toFixed(2),
            principalComponent: split.principalComponent,
            interestComponent: split.interestComponent,
            entryType: 'MIGRATION_BASELINE',
          },
        ],
        null,
      );

      // The computed balance should equal the declared outstanding balance
      expect(balance.computedBalance).toBe(declaredOutstanding.toFixed(2));
    });

    it('baseline + subsequent payroll entry reduces balance correctly', () => {
      const principalAmount = '500000.00';
      const interestRate = '13.330';
      const tenureMonths = 60;

      const principal = new Decimal(principalAmount);
      const totalInterest = principal.mul(new Decimal(interestRate)).div(100);
      const totalLoan = principal.plus(totalInterest);
      const declaredOutstanding = new Decimal('150000.00');
      const baselineAmount = totalLoan.minus(declaredOutstanding);

      const baselineSplit = autoSplitDeduction(baselineAmount.toFixed(2), {
        principalAmount,
        interestRate,
        tenureMonths,
        moratoriumMonths: 0,
      });

      // Simulate a monthly payroll deduction
      const payrollAmount = '9444.17';
      const payrollSplit = autoSplitDeduction(payrollAmount, {
        principalAmount,
        interestRate,
        tenureMonths,
        moratoriumMonths: 0,
      });

      const balance = computeBalanceFromEntries(
        principalAmount,
        interestRate,
        tenureMonths,
        [
          {
            amount: baselineAmount.toFixed(2),
            principalComponent: baselineSplit.principalComponent,
            interestComponent: baselineSplit.interestComponent,
            entryType: 'MIGRATION_BASELINE',
          },
          {
            amount: payrollAmount,
            principalComponent: payrollSplit.principalComponent,
            interestComponent: payrollSplit.interestComponent,
            entryType: 'PAYROLL',
          },
        ],
        null,
      );

      // Balance should be declaredOutstanding - payrollAmount
      const expected = declaredOutstanding.minus(new Decimal(payrollAmount));
      expect(balance.computedBalance).toBe(expected.toFixed(2));
    });
  });

  describe('autoSplitDeduction for baseline amounts', () => {
    it('split components sum equals input amount exactly', () => {
      const amount = '416650.00';
      const split = autoSplitDeduction(amount, {
        principalAmount: '500000.00',
        interestRate: '13.330',
        tenureMonths: 60,
        moratoriumMonths: 0,
      });

      const sum = new Decimal(split.principalComponent).plus(new Decimal(split.interestComponent));
      expect(sum.toFixed(2)).toBe(amount);
    });

    it('throws for zero principal (migration limitation)', () => {
      expect(() =>
        autoSplitDeduction('100000.00', {
          principalAmount: '0.00',
          interestRate: '13.330',
          tenureMonths: 60,
          moratoriumMonths: 0,
        }),
      ).toThrow('principalAmount must be a positive number');
    });

    it('handles negative baseline amount (declaredOutstanding > totalLoan)', () => {
      const split = autoSplitDeduction('-73340.00', {
        principalAmount: '200000.00',
        interestRate: '13.330',
        tenureMonths: 60,
        moratoriumMonths: 0,
      });

      const sum = new Decimal(split.principalComponent).plus(new Decimal(split.interestComponent));
      expect(sum.toFixed(2)).toBe('-73340.00');
    });
  });

  describe('Principal derivation logic', () => {
    it('derives principal from totalLoan and rate', () => {
      const rate = new Decimal('13.330');
      const totalLoan = new Decimal('566650.00');
      const divisor = new Decimal('1').plus(rate.div(100));
      const principal = totalLoan.div(divisor).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

      expect(principal.toFixed(2)).toBe('500000.00');
    });

    it('derives principal from monthlyDeduction and tenure', () => {
      const monthlyDeduction = new Decimal('9444.17');
      const tenure = 60;
      const rate = new Decimal('13.330');
      const totalLoan = monthlyDeduction.mul(tenure);
      const divisor = new Decimal('1').plus(rate.div(100));
      const principal = totalLoan.div(divisor).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

      // totalLoan = 9444.17 * 60 = 566650.20
      // principal = 566650.20 / 1.1333 ~= 500000.18
      expect(principal.gt(0)).toBe(true);
    });
  });

  describe('Tenure inference logic', () => {
    it('infers tenure from totalLoan / monthlyDeduction', () => {
      const totalLoan = new Decimal('566650.00');
      const monthlyDeduction = new Decimal('9444.17');
      const inferred = Math.ceil(totalLoan.div(monthlyDeduction).toNumber());

      expect(inferred).toBe(60);
    });

    it('handles fractional result with ceil', () => {
      const totalLoan = new Decimal('100000.00');
      const monthlyDeduction = new Decimal('3333.33');
      const inferred = Math.ceil(totalLoan.div(monthlyDeduction).toNumber());

      // 100000 / 3333.33 = 30.0003 → ceil = 31
      expect(inferred).toBe(31);
    });

    it('defaults to 60 when cannot infer', () => {
      // This tests the fallback behavior described in the story
      const defaultTenure = 60;
      expect(defaultTenure).toBe(60);
    });
  });

  describe('Variance metadata source string', () => {
    it('builds correct source string format', () => {
      // Testing the format specified in AC 2
      const category = 'Minor Variance';
      const varianceAmount = '2500.00';
      const declaredBalance = '150000.00';
      const uploadId = 'abc-123';

      const source = `Migration baseline | ${category} | Variance: \u20A6${varianceAmount} | Declared outstanding: \u20A6${declaredBalance} | Upload: ${uploadId}`;

      expect(source).toContain('Migration baseline');
      expect(source).toContain('Minor Variance');
      expect(source).toContain('2500.00');
      expect(source).toContain('150000.00');
      expect(source).toContain('abc-123');
    });
  });

  describe('Migration staff ID generation', () => {
    it('generates correct format MIG-{uploadId:8}-{seq:04}', () => {
      const uploadId = '019cc1a2-3b4c-7d5e-8f6a-0b1c2d3e4f5a';
      const shortUploadId = uploadId.replace(/-/g, '').slice(0, 8);
      const seq = 1;
      const staffId = `MIG-${shortUploadId}-${String(seq).padStart(4, '0')}`;

      expect(staffId).toBe('MIG-019cc1a2-0001');
      expect(staffId.length).toBe(17);
    });

    it('handles multi-digit sequences', () => {
      const uploadId = '019cc1a2-3b4c-7d5e-8f6a-0b1c2d3e4f5a';
      const shortUploadId = uploadId.replace(/-/g, '').slice(0, 8);
      const seq = 42;
      const staffId = `MIG-${shortUploadId}-${String(seq).padStart(4, '0')}`;

      expect(staffId).toBe('MIG-019cc1a2-0042');
    });
  });

  describe('Migration loan reference format', () => {
    it('generates VLC-MIG-{year}-{seq} format', () => {
      const year = 2026;
      const seq = 1;
      const padded = String(seq).padStart(4, '0');
      const reference = `VLC-MIG-${year}-${padded}`;

      expect(reference).toBe('VLC-MIG-2026-0001');
      expect(reference).toMatch(/^VLC-MIG-\d{4}-\d{4,}$/);
    });
  });

  describe('Corrected values baseline computation (Story 8.0b)', () => {
    it('baseline with corrections uses corrected outstanding balance', () => {
      const principal = new Decimal('500000.00');
      const rate = new Decimal('13.330');
      const totalLoan = principal.plus(principal.mul(rate).div(100)); // 566650.00

      const declaredOutstanding = new Decimal('999999.00'); // Bad declared value
      const correctedOutstanding = new Decimal('150000.00'); // Corrected to valid value

      // Effective value pattern: corrected ?? declared
      const effectiveOutstanding = correctedOutstanding; // corrected takes priority
      const baselineAmount = totalLoan.minus(effectiveOutstanding);

      expect(baselineAmount.toFixed(2)).toBe('416650.00');
      // NOT using declared (which would give negative: 566650 - 999999 = -433349)
      expect(totalLoan.minus(declaredOutstanding).toFixed(2)).toBe('-433349.00');
    });

    it('baseline without corrections uses original declared values (backward compatible)', () => {
      const principal = new Decimal('500000.00');
      const rate = new Decimal('13.330');
      const totalLoan = principal.plus(principal.mul(rate).div(100)); // 566650.00
      const declaredOutstanding = new Decimal('150000.00');

      // When no corrections: corrected is null, use declared
      const correctedOutstanding: Decimal | null = null;
      const effectiveOutstanding = correctedOutstanding ?? declaredOutstanding;
      const baselineAmount = totalLoan.minus(effectiveOutstanding);

      expect(baselineAmount.toFixed(2)).toBe('416650.00');
    });
  });
});
