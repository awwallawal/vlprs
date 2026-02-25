import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { sql, eq } from 'drizzle-orm';
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
let testLoanId: string;
let adminToken: string;
let officerToken: string;
let testDeptAdminUserId: string;
let deptAdminToken: string;

beforeAll(async () => {
  await db.execute(sql`TRUNCATE ledger_entries, loans, audit_log, refresh_tokens, users, mdas CASCADE`);

  // Create test MDA
  testMdaId = generateUuidv7();
  await db.insert(mdas).values({
    id: testMdaId,
    name: 'Ledger Integration MDA',
    code: 'LINT',
    abbreviation: 'Ledger Int',
  });

  // Create second MDA for scoping tests
  testMda2Id = generateUuidv7();
  await db.insert(mdas).values({
    id: testMda2Id,
    name: 'Other MDA',
    code: 'OTHR',
    abbreviation: 'Other',
  });

  // Create test admin user
  testUserId = generateUuidv7();
  await db.insert(users).values({
    id: testUserId,
    email: 'ledger-admin@test.com',
    hashedPassword: 'hashed',
    firstName: 'Ledger',
    lastName: 'Admin',
    role: 'super_admin',
  });

  // Create test MDA officer (scoped to testMdaId)
  testOfficerUserId = generateUuidv7();
  await db.insert(users).values({
    id: testOfficerUserId,
    email: 'ledger-officer@test.com',
    hashedPassword: 'hashed',
    firstName: 'Ledger',
    lastName: 'Officer',
    role: 'mda_officer',
    mdaId: testMdaId,
  });

  // Create test dept_admin user
  testDeptAdminUserId = generateUuidv7();
  await db.insert(users).values({
    id: testDeptAdminUserId,
    email: 'ledger-dept-admin@test.com',
    hashedPassword: 'hashed',
    firstName: 'Ledger',
    lastName: 'DeptAdmin',
    role: 'dept_admin',
  });

  // Create test loan
  testLoanId = generateUuidv7();
  await db.insert(loans).values({
    id: testLoanId,
    staffId: 'STAFF-INT-001',
    staffName: 'Integration Staff',
    gradeLevel: 'GL-07',
    mdaId: testMdaId,
    principalAmount: '500000.00',
    interestRate: '4.000',
    tenureMonths: 48,
    monthlyDeductionAmount: '12500.00',
    approvalDate: new Date(),
    firstDeductionDate: new Date(),
    loanReference: 'VLC-2026-INT1',
    status: 'ACTIVE',
  });

  // Generate JWT tokens
  adminToken = signAccessToken({
    userId: testUserId,
    email: 'ledger-admin@test.com',
    role: 'super_admin',
    mdaId: null,
    mustChangePassword: false,
  });

  officerToken = signAccessToken({
    userId: testOfficerUserId,
    email: 'ledger-officer@test.com',
    role: 'mda_officer',
    mdaId: testMdaId,
    mustChangePassword: false,
  });

  deptAdminToken = signAccessToken({
    userId: testDeptAdminUserId,
    email: 'ledger-dept-admin@test.com',
    role: 'dept_admin',
    mdaId: null,
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

const validPayload = {
  loanId: '', // set in tests
  entryType: 'PAYROLL',
  amount: '12500.00',
  principalComponent: '10000.00',
  interestComponent: '2500.00',
  periodMonth: 3,
  periodYear: 2026,
  source: 'Monthly payroll deduction',
};

describe('Ledger Integration Tests', () => {
  describe('POST /api/ledger — Create ledger entry (AC 1)', () => {
    it('persists entry with correct fields and auto-populated staff_id/mda_id', async () => {
      const res = await request(app)
        .post('/api/ledger')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...validPayload, loanId: testLoanId });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const entry = res.body.data;
      expect(entry.id).toBeTruthy();
      expect(entry.loanId).toBe(testLoanId);
      expect(entry.staffId).toBe('STAFF-INT-001');
      expect(entry.mdaId).toBe(testMdaId);
      expect(entry.entryType).toBe('PAYROLL');
      expect(entry.amount).toBe('12500.00');
      expect(entry.principalComponent).toBe('10000.00');
      expect(entry.interestComponent).toBe('2500.00');
      expect(entry.periodMonth).toBe(3);
      expect(entry.periodYear).toBe(2026);
      expect(entry.postedBy).toBe(testUserId);
      expect(entry.source).toBe('Monthly payroll deduction');
      expect(entry.createdAt).toBeTruthy();
    });

    it('sets posted_by from authenticated user JWT', async () => {
      const res = await request(app)
        .post('/api/ledger')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...validPayload, loanId: testLoanId });

      expect(res.status).toBe(201);
      expect(res.body.data.postedBy).toBe(testUserId);
    });

    it('returns UUIDv7 primary key', async () => {
      const res = await request(app)
        .post('/api/ledger')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...validPayload, loanId: testLoanId });

      expect(res.status).toBe(201);
      expect(res.body.data.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it('returns 404 for non-existent loan', async () => {
      const res = await request(app)
        .post('/api/ledger')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...validPayload, loanId: generateUuidv7() });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('LOAN_NOT_FOUND');
    });

    it('returns 400 for invalid payload', async () => {
      const res = await request(app)
        .post('/api/ledger')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ loanId: 'not-a-uuid', entryType: 'INVALID' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('returns 401 without auth token', async () => {
      const res = await request(app)
        .post('/api/ledger')
        .send({ ...validPayload, loanId: testLoanId });

      expect(res.status).toBe(401);
    });

    it('accepts ADJUSTMENT entry type', async () => {
      const res = await request(app)
        .post('/api/ledger')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...validPayload,
          loanId: testLoanId,
          entryType: 'ADJUSTMENT',
          source: 'Manual adjustment',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.entryType).toBe('ADJUSTMENT');
    });
  });

  describe('DB trigger immutability (AC 2, Layer 1)', () => {
    it('rejects UPDATE on ledger_entries', async () => {
      // Insert directly
      const [entry] = await db.insert(ledgerEntries).values({
        loanId: testLoanId,
        staffId: 'STAFF-INT-001',
        mdaId: testMdaId,
        entryType: 'PAYROLL',
        amount: '12500.00',
        principalComponent: '10000.00',
        interestComponent: '2500.00',
        periodMonth: 3,
        periodYear: 2026,
        postedBy: testUserId,
      }).returning();

      try {
        await db
          .update(ledgerEntries)
          .set({ amount: '9999.99' })
          .where(eq(ledgerEntries.id, entry.id));
        expect.fail('UPDATE should have been rejected by immutability trigger');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        const cause =
          err instanceof Error && 'cause' in err
            ? String((err as Error & { cause: Error }).cause?.message ?? '')
            : '';
        const fullMsg = `${message} ${cause}`;
        expect(fullMsg).toMatch(
          /Modifications to ledger_entries are not allowed.*UPDATE operation rejected/,
        );
      }
    });

    it('rejects DELETE on ledger_entries', async () => {
      const [entry] = await db.insert(ledgerEntries).values({
        loanId: testLoanId,
        staffId: 'STAFF-INT-001',
        mdaId: testMdaId,
        entryType: 'PAYROLL',
        amount: '12500.00',
        principalComponent: '10000.00',
        interestComponent: '2500.00',
        periodMonth: 3,
        periodYear: 2026,
        postedBy: testUserId,
      }).returning();

      try {
        await db.delete(ledgerEntries).where(eq(ledgerEntries.id, entry.id));
        expect.fail('DELETE should have been rejected by immutability trigger');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        const cause =
          err instanceof Error && 'cause' in err
            ? String((err as Error & { cause: Error }).cause?.message ?? '')
            : '';
        const fullMsg = `${message} ${cause}`;
        expect(fullMsg).toMatch(
          /Modifications to ledger_entries are not allowed.*DELETE operation rejected/,
        );
      }
    });
  });

  describe('GET /api/ledger/:loanId — Chronological query (AC 3)', () => {
    it('returns entries in chronological order', async () => {
      // Insert two entries via API
      await request(app)
        .post('/api/ledger')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...validPayload, loanId: testLoanId, periodMonth: 1, periodYear: 2026 });

      await request(app)
        .post('/api/ledger')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...validPayload, loanId: testLoanId, periodMonth: 2, periodYear: 2026 });

      const res = await request(app)
        .get(`/api/ledger/${testLoanId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      // Chronological: first entry before second
      expect(res.body.data[0].periodMonth).toBe(1);
      expect(res.body.data[1].periodMonth).toBe(2);
    });

    it('returns standard { success: true, data: [...] } envelope', async () => {
      const res = await request(app)
        .get(`/api/ledger/${testLoanId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('returns empty array for loan with no entries', async () => {
      const res = await request(app)
        .get(`/api/ledger/${testLoanId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });

    it('dept_admin can access ledger entries', async () => {
      await request(app)
        .post('/api/ledger')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...validPayload, loanId: testLoanId });

      const res = await request(app)
        .get(`/api/ledger/${testLoanId}`)
        .set('Authorization', `Bearer ${deptAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });
  });

  describe('PUT/PATCH/DELETE on /api/ledger/* return 405 (AC 2, Layer 3)', () => {
    it('PUT /api/ledger returns 405 with Allow header', async () => {
      const res = await request(app)
        .put('/api/ledger')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(405);
      expect(res.body.error.code).toBe('METHOD_NOT_ALLOWED');
      expect(res.headers.allow).toBe('GET, POST, HEAD, OPTIONS');
    });

    it('PATCH /api/ledger/:id returns 405', async () => {
      const res = await request(app)
        .patch(`/api/ledger/${generateUuidv7()}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(405);
      expect(res.body.error.code).toBe('METHOD_NOT_ALLOWED');
    });

    it('DELETE /api/ledger/:id returns 405', async () => {
      const res = await request(app)
        .delete(`/api/ledger/${generateUuidv7()}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(405);
      expect(res.body.error.code).toBe('METHOD_NOT_ALLOWED');
    });
  });

  describe('MDA scoping (AC 3)', () => {
    it('MDA officer can access ledger entries for loans within their MDA', async () => {
      // Admin creates an entry
      await request(app)
        .post('/api/ledger')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...validPayload, loanId: testLoanId });

      // Officer queries (testLoanId belongs to testMdaId which matches officer's mdaId)
      const res = await request(app)
        .get(`/api/ledger/${testLoanId}`)
        .set('Authorization', `Bearer ${officerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].loanId).toBe(testLoanId);
    });

    it('MDA officer cannot access ledger entries for loans in another MDA', async () => {
      // Create a loan in second MDA
      const otherLoanId = generateUuidv7();
      await db.insert(loans).values({
        id: otherLoanId,
        staffId: 'STAFF-OTHER-001',
        staffName: 'Other Staff',
        gradeLevel: 'GL-10',
        mdaId: testMda2Id,
        principalAmount: '300000.00',
        interestRate: '5.000',
        tenureMonths: 36,
        monthlyDeductionAmount: '10000.00',
        approvalDate: new Date(),
        firstDeductionDate: new Date(),
        loanReference: 'VLC-2026-OTH1',
        status: 'ACTIVE',
      });

      // Admin creates entry for other MDA's loan
      await request(app)
        .post('/api/ledger')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...validPayload, loanId: otherLoanId });

      // Officer (scoped to testMdaId) queries other MDA's loan — should get empty result
      const res = await request(app)
        .get(`/api/ledger/${otherLoanId}`)
        .set('Authorization', `Bearer ${officerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });
  });
});
