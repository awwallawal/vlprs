import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Decimal from 'decimal.js';
import { sql } from 'drizzle-orm';
import { db } from '../db/index';
import { users, mdas, loans, ledgerEntries } from '../db/schema';
import { generateUuidv7 } from '../lib/uuidv7';
import { hashPassword } from '../lib/password';
import {
  getMonthlyCollectionPotential,
  getTotalOutstandingReceivables,
  getActualMonthlyRecovery,
} from './revenueProjectionService';

let testMdaId: string;
let testUserId: string;
let activeLoanId1: string;
let activeLoanId2: string;
let completedLoanId: string;

beforeAll(async () => {
  await db.execute(sql`TRUNCATE loan_state_transitions, ledger_entries, loans, scheme_config, refresh_tokens, audit_log, users, mdas CASCADE`);

  testMdaId = generateUuidv7();
  await db.insert(mdas).values({
    id: testMdaId,
    name: 'Revenue Test MDA',
    code: 'RVTST',
    abbreviation: 'Revenue Test',
  });

  testUserId = generateUuidv7();
  const hashed = await hashPassword('Password1');
  await db.insert(users).values({
    id: testUserId,
    email: 'revenue-test@test.com',
    hashedPassword: hashed,
    firstName: 'Test',
    lastName: 'User',
    role: 'super_admin',
    isActive: true,
  });

  // Create 2 active loans with different monthly deductions
  activeLoanId1 = generateUuidv7();
  activeLoanId2 = generateUuidv7();
  completedLoanId = generateUuidv7();

  const baseLoan = {
    mdaId: testMdaId,
    interestRate: '13.330',
    moratoriumMonths: 0,
    staffName: 'Test Staff',
    gradeLevel: 'GL-08',
    approvalDate: new Date('2024-12-01'),
  };

  await db.insert(loans).values([
    {
      ...baseLoan,
      id: activeLoanId1,
      staffId: 'STAFF001',
      principalAmount: '500000.00',
      tenureMonths: 60,
      monthlyDeductionAmount: '11110.83',
      firstDeductionDate: new Date('2025-01-01'),
      status: 'ACTIVE',
      loanReference: 'REV-TEST-001',
    },
    {
      ...baseLoan,
      id: activeLoanId2,
      staffId: 'STAFF002',
      principalAmount: '250000.00',
      tenureMonths: 60,
      monthlyDeductionAmount: '5555.42',
      firstDeductionDate: new Date('2025-01-01'),
      status: 'ACTIVE',
      loanReference: 'REV-TEST-002',
    },
    {
      ...baseLoan,
      id: completedLoanId,
      staffId: 'STAFF003',
      principalAmount: '100000.00',
      tenureMonths: 12,
      monthlyDeductionAmount: '9444.17',
      firstDeductionDate: new Date('2024-01-01'),
      status: 'COMPLETED',
      loanReference: 'REV-TEST-003',
    },
  ]);

  // Create PAYROLL ledger entries for two periods
  await db.insert(ledgerEntries).values([
    // Feb 2026 — most recent period
    {
      loanId: activeLoanId1,
      staffId: 'STAFF001',
      mdaId: testMdaId,
      entryType: 'PAYROLL',
      amount: '11110.83',
      principalComponent: '9999.75',
      interestComponent: '1111.08',
      periodMonth: 2,
      periodYear: 2026,
      source: 'test',
      postedBy: testUserId,
    },
    {
      loanId: activeLoanId2,
      staffId: 'STAFF002',
      mdaId: testMdaId,
      entryType: 'PAYROLL',
      amount: '5555.42',
      principalComponent: '4999.88',
      interestComponent: '555.54',
      periodMonth: 2,
      periodYear: 2026,
      source: 'test',
      postedBy: testUserId,
    },
    // Jan 2026 — older period
    {
      loanId: activeLoanId1,
      staffId: 'STAFF001',
      mdaId: testMdaId,
      entryType: 'PAYROLL',
      amount: '11110.83',
      principalComponent: '9999.75',
      interestComponent: '1111.08',
      periodMonth: 1,
      periodYear: 2026,
      source: 'test',
      postedBy: testUserId,
    },
    {
      loanId: activeLoanId2,
      staffId: 'STAFF002',
      mdaId: testMdaId,
      entryType: 'PAYROLL',
      amount: '5555.42',
      principalComponent: '4999.88',
      interestComponent: '555.54',
      periodMonth: 1,
      periodYear: 2026,
      source: 'test',
      postedBy: testUserId,
    },
  ]);
});

afterAll(async () => {
  await db.execute(sql`TRUNCATE loan_state_transitions, ledger_entries, loans, scheme_config, refresh_tokens, audit_log, users, mdas CASCADE`);
});

describe('revenueProjectionService', () => {
  describe('getMonthlyCollectionPotential', () => {
    it('returns sum of monthlyDeductionAmount for ACTIVE loans', async () => {
      const result = await getMonthlyCollectionPotential();
      // 11110.83 + 5555.42 = 16666.25
      expect(result).toBe('16666.25');
    });

    it('excludes COMPLETED loans from collection potential', async () => {
      // completedLoanId has monthlyDeductionAmount 9444.17 but status COMPLETED
      const result = await getMonthlyCollectionPotential();
      const total = new Decimal(result);
      // Should NOT include 9444.17 from the completed loan
      expect(total.lt(new Decimal('20000'))).toBe(true);
    });

    it('returns 0.00 when no active loans exist for scoped MDA', async () => {
      const nonExistentMdaId = generateUuidv7();
      const result = await getMonthlyCollectionPotential(nonExistentMdaId);
      expect(result).toBe('0.00');
    });
  });

  describe('getActualMonthlyRecovery', () => {
    it('returns the most recent PAYROLL period sum', async () => {
      const result = await getActualMonthlyRecovery();
      // Feb 2026: 11110.83 + 5555.42 = 16666.25
      expect(result.amount).toBe('16666.25');
      expect(result.periodMonth).toBe(2);
      expect(result.periodYear).toBe(2026);
    });

    it('returns zero with period 0 when no entries exist for scoped MDA', async () => {
      const nonExistentMdaId = generateUuidv7();
      const result = await getActualMonthlyRecovery(nonExistentMdaId);
      expect(result.amount).toBe('0.00');
      expect(result.periodMonth).toBe(0);
      expect(result.periodYear).toBe(0);
    });
  });

  describe('getTotalOutstandingReceivables', () => {
    it('returns a positive decimal string for outstanding balances', async () => {
      const result = await getTotalOutstandingReceivables();
      const total = new Decimal(result);
      // Both active loans have outstanding balance (only 2 months of payments)
      expect(total.gt(0)).toBe(true);
    });

    it('returns 0.00 when no qualifying loans exist for scoped MDA', async () => {
      const nonExistentMdaId = generateUuidv7();
      const result = await getTotalOutstandingReceivables(nonExistentMdaId);
      expect(result).toBe('0.00');
    });

    it('result format is a valid 2-decimal-place string', async () => {
      const result = await getTotalOutstandingReceivables();
      expect(result).toMatch(/^\d+\.\d{2}$/);
    });
  });
});
