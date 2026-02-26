import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import app from '../app';
import { db } from '../db/index';
import { users, mdas, loans, ledgerEntries } from '../db/schema';
import { signAccessToken } from '../lib/jwt';
import { generateUuidv7 } from '../lib/uuidv7';
import { resetRateLimiters } from '../middleware/rateLimiter';

let testMdaId: string;
let testMda2Id: string;
let testUserId: string;
let testOfficerUserId: string;
let testOfficer2UserId: string;
let testLoanId: string;
let emptyLoanId: string;
let adminToken: string;
let officerToken: string;
let officer2Token: string;

beforeAll(async () => {
  await db.execute(sql`TRUNCATE ledger_entries, loans, audit_log, refresh_tokens, users, mdas CASCADE`);

  // Create test MDAs
  testMdaId = generateUuidv7();
  await db.insert(mdas).values({
    id: testMdaId,
    name: 'Balance Test MDA',
    code: 'BALT',
    abbreviation: 'Bal Test',
  });

  testMda2Id = generateUuidv7();
  await db.insert(mdas).values({
    id: testMda2Id,
    name: 'Other MDA',
    code: 'OTHR',
    abbreviation: 'Other',
  });

  // Create test users
  testUserId = generateUuidv7();
  await db.insert(users).values({
    id: testUserId,
    email: 'balance-admin@test.com',
    hashedPassword: 'hashed',
    firstName: 'Balance',
    lastName: 'Admin',
    role: 'super_admin',
  });

  testOfficerUserId = generateUuidv7();
  await db.insert(users).values({
    id: testOfficerUserId,
    email: 'balance-officer@test.com',
    hashedPassword: 'hashed',
    firstName: 'Balance',
    lastName: 'Officer',
    role: 'mda_officer',
    mdaId: testMdaId,
  });

  // Officer for second MDA (for scoping test)
  testOfficer2UserId = generateUuidv7();
  await db.insert(users).values({
    id: testOfficer2UserId,
    email: 'balance-officer2@test.com',
    hashedPassword: 'hashed',
    firstName: 'Other',
    lastName: 'Officer',
    role: 'mda_officer',
    mdaId: testMda2Id,
  });

  // Create test loan: 250K, 13.33%, 60 months → totalLoan = 283325.00
  testLoanId = generateUuidv7();
  await db.insert(loans).values({
    id: testLoanId,
    staffId: 'STAFF-BAL-001',
    staffName: 'Balance Staff',
    gradeLevel: 'GL-07',
    mdaId: testMdaId,
    principalAmount: '250000.00',
    interestRate: '13.330',
    tenureMonths: 60,
    monthlyDeductionAmount: '4722.09',
    approvalDate: new Date('2025-01-01'),
    firstDeductionDate: new Date('2025-02-01'),
    loanReference: 'VLC-2026-BAL1',
    status: 'ACTIVE',
  });

  // Create loan with no entries for empty-balance test
  emptyLoanId = generateUuidv7();
  await db.insert(loans).values({
    id: emptyLoanId,
    staffId: 'STAFF-BAL-002',
    staffName: 'Empty Staff',
    gradeLevel: 'GL-10',
    mdaId: testMdaId,
    principalAmount: '450000.00',
    interestRate: '13.330',
    tenureMonths: 60,
    monthlyDeductionAmount: '8499.75',
    approvalDate: new Date('2025-01-01'),
    firstDeductionDate: new Date('2025-02-01'),
    loanReference: 'VLC-2026-BAL2',
    status: 'ACTIVE',
  });

  // Generate JWT tokens
  adminToken = signAccessToken({
    userId: testUserId,
    email: 'balance-admin@test.com',
    role: 'super_admin',
    mdaId: null,
    mustChangePassword: false,
  });

  officerToken = signAccessToken({
    userId: testOfficerUserId,
    email: 'balance-officer@test.com',
    role: 'mda_officer',
    mdaId: testMdaId,
    mustChangePassword: false,
  });

  officer2Token = signAccessToken({
    userId: testOfficer2UserId,
    email: 'balance-officer2@test.com',
    role: 'mda_officer',
    mdaId: testMda2Id,
    mustChangePassword: false,
  });
});

beforeEach(async () => {
  resetRateLimiters();
  await db.execute(sql`TRUNCATE ledger_entries, audit_log CASCADE`);
});

afterAll(async () => {
  await db.execute(sql`TRUNCATE ledger_entries, loans, audit_log, refresh_tokens, users, mdas CASCADE`);
});

describe('Balance Integration Tests (Story 2.5)', () => {
  // Task 7.2: GET /api/loans/:loanId/balance with seeded entries returns correct computed balance
  describe('GET /api/loans/:loanId/balance — Current balance (AC 1)', () => {
    it('returns correct computed balance with seeded entries', async () => {
      // Seed 30 PAYROLL entries (half of 60-month tenure)
      // monthlyDeduction = 4722.09, monthlyPrincipal = 4166.67, monthlyInterest = 555.42
      for (let i = 0; i < 30; i++) {
        await db.insert(ledgerEntries).values({
          loanId: testLoanId,
          staffId: 'STAFF-BAL-001',
          mdaId: testMdaId,
          entryType: 'PAYROLL',
          amount: '4722.09',
          principalComponent: '4166.67',
          interestComponent: '555.42',
          periodMonth: ((i % 12) + 1),
          periodYear: 2025 + Math.floor(i / 12),
          postedBy: testUserId,
          createdAt: new Date(2025, i % 12, 15),
        });
      }

      const res = await request(app)
        .get(`/api/loans/${testLoanId}/balance`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const data = res.body.data;
      // totalLoan = 283325.00, totalAmountPaid = 30 × 4722.09 = 141662.70
      // computedBalance = 283325.00 - 141662.70 = 141662.30
      expect(data.computedBalance).toBe('141662.30');
      expect(data.totalAmountPaid).toBe('141662.70');
      expect(data.totalPrincipalPaid).toBe('125000.10');  // 30 × 4166.67
      expect(data.totalInterestPaid).toBe('16662.60');    // 30 × 555.42
      expect(data.installmentsCompleted).toBe(30);
      expect(data.installmentsRemaining).toBe(30);
      expect(data.entryCount).toBe(30);
      expect(data.asOfDate).toBeNull();

      // Derivation chain for audit traceability (AC 3)
      expect(data.derivation).toBeDefined();
      expect(data.derivation.formula).toBe('totalLoan - sum(entries.amount)');
      expect(data.derivation.totalLoan).toBe('283325.00');
      expect(data.derivation.entriesSum).toBe('141662.70');
    });

    it('returns { success: true, data: BalanceResult } envelope', async () => {
      const res = await request(app)
        .get(`/api/loans/${testLoanId}/balance`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('computedBalance');
      expect(res.body.data).toHaveProperty('derivation');
    });
  });

  // Task 7.5: loan with no entries returns totalLoan as balance
  describe('No entries — balance = totalLoan (AC 1)', () => {
    it('returns totalLoan as balance when no entries exist', async () => {
      const res = await request(app)
        .get(`/api/loans/${emptyLoanId}/balance`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const data = res.body.data;
      // 450000 + (450000 × 13.33 / 100) = 450000 + 59985 = 509985.00
      expect(data.computedBalance).toBe('509985.00');
      expect(data.totalAmountPaid).toBe('0.00');
      expect(data.installmentsCompleted).toBe(0);
      expect(data.installmentsRemaining).toBe(60);
      expect(data.entryCount).toBe(0);
    });
  });

  // Task 7.3: GET /api/loans/:loanId/balance?asOf= returns historical balance (AC 2)
  describe('GET /api/loans/:loanId/balance?asOf= — Historical balance (AC 2)', () => {
    it('returns balance using only entries up to the asOf date', async () => {
      // Seed entries with spread dates:
      // 10 entries in Jan-Oct 2025 (createdAt = 15th of each month)
      for (let i = 0; i < 10; i++) {
        await db.insert(ledgerEntries).values({
          loanId: testLoanId,
          staffId: 'STAFF-BAL-001',
          mdaId: testMdaId,
          entryType: 'PAYROLL',
          amount: '4722.09',
          principalComponent: '4166.67',
          interestComponent: '555.42',
          periodMonth: i + 1,
          periodYear: 2025,
          postedBy: testUserId,
          createdAt: new Date(Date.UTC(2025, i, 15)),  // Jan 15 through Oct 15
        });
      }

      // Query as of June 30, 2025 → should include entries from Jan-Jun (6 entries)
      const res = await request(app)
        .get(`/api/loans/${testLoanId}/balance?asOf=2025-06-30`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const data = res.body.data;
      // 6 entries × 4722.09 = 28332.54
      expect(data.totalAmountPaid).toBe('28332.54');
      // 283325.00 - 28332.54 = 254992.46
      expect(data.computedBalance).toBe('254992.46');
      expect(data.installmentsCompleted).toBe(6);
      expect(data.entryCount).toBe(6);
      expect(data.asOfDate).toBe('2025-06-30');
    });

    it('returns 400 for invalid asOf date', async () => {
      const res = await request(app)
        .get(`/api/loans/${testLoanId}/balance?asOf=not-a-date`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });
  });

  // Task 7.4: MDA-scoped user cannot access balance for loans in another MDA (AC 1)
  describe('MDA scoping (AC 1)', () => {
    it('MDA officer can access balance for loans in their MDA', async () => {
      const res = await request(app)
        .get(`/api/loans/${testLoanId}/balance`)
        .set('Authorization', `Bearer ${officerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.computedBalance).toBeDefined();
    });

    it('MDA officer cannot access balance for loans in another MDA', async () => {
      // officer2 is scoped to testMda2Id, but testLoanId belongs to testMdaId
      // Uses loanService.getLoanById with MDA scoping — returns 404 (consistent with schedule/loan routes)
      const res = await request(app)
        .get(`/api/loans/${testLoanId}/balance`)
        .set('Authorization', `Bearer ${officer2Token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('LOAN_NOT_FOUND');
    });
  });

  describe('Error handling', () => {
    it('returns 404 for non-existent loan', async () => {
      const res = await request(app)
        .get(`/api/loans/${generateUuidv7()}/balance`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('LOAN_NOT_FOUND');
    });

    it('returns 401 without auth token', async () => {
      const res = await request(app)
        .get(`/api/loans/${testLoanId}/balance`);

      expect(res.status).toBe(401);
    });
  });
});
