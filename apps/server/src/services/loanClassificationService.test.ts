import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import {
  classifyLoan,
  LoanClassification,
  STALL_TOLERANCE,
} from './loanClassificationService';
import type { LedgerEntryForBalance } from '@vlprs/shared';

// ─── Test Helpers ─────────────────────────────────────────────────
function makeLoan(overrides: Partial<{
  status: string;
  principalAmount: string;
  interestRate: string;
  tenureMonths: number;
  moratoriumMonths: number;
  firstDeductionDate: string;
}> = {}) {
  return {
    status: overrides.status ?? 'ACTIVE',
    principalAmount: overrides.principalAmount ?? '250000.00',
    interestRate: overrides.interestRate ?? '13.330',
    tenureMonths: overrides.tenureMonths ?? 60,
    moratoriumMonths: overrides.moratoriumMonths ?? 0,
    firstDeductionDate: overrides.firstDeductionDate ?? '2024-01-01',
  };
}

function makeEntry(amount: string, principal: string, interest: string, type = 'PAYROLL'): LedgerEntryForBalance {
  return {
    amount,
    principalComponent: principal,
    interestComponent: interest,
    entryType: type,
  };
}

// Helper to create ledger entries with period info for stall detection
function makeEntryWithPeriod(
  amount: string,
  principal: string,
  interest: string,
  periodMonth: number,
  periodYear: number,
  type = 'PAYROLL',
) {
  return {
    amount,
    principalComponent: principal,
    interestComponent: interest,
    entryType: type,
    periodMonth,
    periodYear,
  };
}

describe('loanClassificationService', () => {
  describe('STALL_TOLERANCE constant', () => {
    it('matches FR26 Clean threshold (₦1)', () => {
      expect(STALL_TOLERANCE.eq(new Decimal('1'))).toBe(true);
    });
  });

  describe('classifyLoan', () => {
    it('returns COMPLETED for loans with status COMPLETED', () => {
      const loan = makeLoan({ status: 'COMPLETED' });
      const result = classifyLoan(loan, []);
      expect(result).toBe(LoanClassification.COMPLETED);
    });

    it('returns ON_TRACK for active loan with decreasing balance within window', () => {
      // Active loan, started Jan 2024, 60 months tenure
      // Window of 60 months from first deduction → accountability deadline = Jan 2034
      // Current date (2026-03-10) is well within the window
      const loan = makeLoan({ firstDeductionDate: '2024-01-01' });
      const entries: LedgerEntryForBalance[] = [
        makeEntry('4722.09', '4166.67', '555.42'),
        makeEntry('4722.09', '4166.67', '555.42'),
        makeEntry('4722.09', '4166.67', '555.42'),
      ];
      const result = classifyLoan(loan, entries);
      expect(result).toBe(LoanClassification.ON_TRACK);
    });

    it('returns OVER_DEDUCTED when balance is negative', () => {
      // Loan where total paid exceeds total loan amount
      const loan = makeLoan({
        principalAmount: '10000.00',
        interestRate: '13.330',
        tenureMonths: 12,
      });
      // Total loan = 10000 + 1333 = 11333.00
      // Pay 12000 → balance goes negative
      const entries: LedgerEntryForBalance[] = [
        makeEntry('12000.00', '10000.00', '2000.00'),
      ];
      const result = classifyLoan(loan, entries);
      expect(result).toBe(LoanClassification.OVER_DEDUCTED);
    });

    it('returns OVERDUE when past accountability deadline with positive balance', () => {
      // Loan started 15 years ago, 12 month tenure, windowMonths = 60
      // expectedCompletion = 2011-01-01 + 12 months = 2012-01-01
      // accountabilityDeadline = 2012-01-01 + 60 months = 2017-01-01
      // Now (2026-03-10) is past deadline
      const loan = makeLoan({
        firstDeductionDate: '2011-01-01',
        tenureMonths: 12,
        principalAmount: '100000.00',
        interestRate: '13.330',
      });
      // Only partial payment — still has balance
      const entries: LedgerEntryForBalance[] = [
        makeEntry('5000.00', '4000.00', '1000.00'),
      ];
      const result = classifyLoan(loan, entries);
      expect(result).toBe(LoanClassification.OVERDUE);
    });

    it('returns STALLED when 2+ consecutive months have < ₦1 balance movement', () => {
      // Loan with entries that show near-identical running balances
      const loan = makeLoan({
        principalAmount: '100000.00',
        interestRate: '13.330',
        tenureMonths: 60,
        firstDeductionDate: '2024-01-01',
      });
      // Total loan = 100000 + 13330 = 113330
      // First real payment, then sub-kobo amounts (stall)
      const entries = [
        makeEntryWithPeriod('5000.00', '4000.00', '1000.00', 1, 2024),  // Real payment
        makeEntryWithPeriod('0.50', '0.30', '0.20', 2, 2024),           // Sub-kobo noise
        makeEntryWithPeriod('0.40', '0.25', '0.15', 3, 2024),           // Sub-kobo noise
        makeEntryWithPeriod('0.30', '0.20', '0.10', 4, 2024),           // Sub-kobo noise (3rd consecutive < ₦1)
      ];
      const result = classifyLoan(loan, entries);
      expect(result).toBe(LoanClassification.STALLED);
    });

    it('does NOT classify as STALLED when balance movement ≥ ₦1', () => {
      const loan = makeLoan({
        principalAmount: '100000.00',
        interestRate: '13.330',
        tenureMonths: 60,
        firstDeductionDate: '2024-01-01',
      });
      // All payments are ≥ ₦1 — real movement
      const entries = [
        makeEntryWithPeriod('5000.00', '4000.00', '1000.00', 1, 2024),
        makeEntryWithPeriod('1.00', '0.60', '0.40', 2, 2024),   // Exactly ₦1 — real movement
        makeEntryWithPeriod('2.00', '1.50', '0.50', 3, 2024),   // ₦2 — real movement
      ];
      const result = classifyLoan(loan, entries);
      expect(result).toBe(LoanClassification.ON_TRACK);
    });

    it('does NOT classify as STALLED with only 1 consecutive sub-₦1 movement', () => {
      const loan = makeLoan({
        principalAmount: '100000.00',
        interestRate: '13.330',
        tenureMonths: 60,
        firstDeductionDate: '2024-01-01',
      });
      // Only 1 sub-kobo entry, then real payment — not 2+ consecutive
      const entries = [
        makeEntryWithPeriod('5000.00', '4000.00', '1000.00', 1, 2024),
        makeEntryWithPeriod('0.50', '0.30', '0.20', 2, 2024),   // Sub-kobo
        makeEntryWithPeriod('5000.00', '4000.00', '1000.00', 3, 2024), // Real movement resets
      ];
      const result = classifyLoan(loan, entries);
      expect(result).toBe(LoanClassification.ON_TRACK);
    });

    it('classifies COMPLETED before checking other conditions', () => {
      // Even if loan is past deadline, COMPLETED status takes precedence
      const loan = makeLoan({
        status: 'COMPLETED',
        firstDeductionDate: '2010-01-01',
        tenureMonths: 12,
      });
      const result = classifyLoan(loan, []);
      expect(result).toBe(LoanClassification.COMPLETED);
    });

    it('classifies OVER_DEDUCTED before OVERDUE (priority order)', () => {
      // Past deadline but balance < 0 — OVER_DEDUCTED takes precedence
      const loan = makeLoan({
        firstDeductionDate: '2010-01-01',
        tenureMonths: 12,
        principalAmount: '10000.00',
        interestRate: '13.330',
      });
      // Total loan ~11333; pay 15000 → negative balance
      const entries: LedgerEntryForBalance[] = [
        makeEntry('15000.00', '12000.00', '3000.00'),
      ];
      const result = classifyLoan(loan, entries);
      expect(result).toBe(LoanClassification.OVER_DEDUCTED);
    });

    it('handles zero ledger entries (active loan, no payments yet)', () => {
      const loan = makeLoan({ firstDeductionDate: '2024-01-01' });
      const result = classifyLoan(loan, []);
      // No stall (needs 2+ periods), within window, balance > 0 → ON_TRACK
      expect(result).toBe(LoanClassification.ON_TRACK);
    });

    it('uses custom windowMonths parameter', () => {
      // With windowMonths = 1 (very short), this loan should be OVERDUE
      // Loan: started 2023-01-01, 12 month tenure
      // expectedCompletion = 2024-01-01
      // accountabilityDeadline = 2024-01-01 + 1 month = 2024-02-01
      // Now (2026-03-10) is past that deadline
      const loan = makeLoan({
        firstDeductionDate: '2023-01-01',
        tenureMonths: 12,
        principalAmount: '100000.00',
        interestRate: '13.330',
      });
      const entries: LedgerEntryForBalance[] = [
        makeEntry('5000.00', '4000.00', '1000.00'),
      ];
      const result = classifyLoan(loan, entries, 1);
      expect(result).toBe(LoanClassification.OVERDUE);
    });

    it('handles non-ACTIVE statuses that are not COMPLETED (e.g., APPLIED)', () => {
      // APPLIED loans should be classified based on their data, not status
      const loan = makeLoan({
        status: 'APPLIED',
        firstDeductionDate: '2024-01-01',
      });
      const result = classifyLoan(loan, []);
      expect(result).toBe(LoanClassification.ON_TRACK);
    });
  });
});
