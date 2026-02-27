import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import app from '../app';
import { db } from '../db/index';
import { mdas, users, loans, loanStateTransitions } from '../db/schema';
import { hashPassword } from '../lib/password';
import { generateUuidv7 } from '../lib/uuidv7';
import * as authService from '../services/authService';

let testMdaId: string;
let secondMdaId: string;
let superAdminToken: string;
let adminToken: string;
let officerToken: string;
let adminUserId: string;
let superAdminUserId: string;
let officerUserId: string;

const testPassword = 'SecurePass1';

beforeAll(async () => {
  await db.execute(sql`TRUNCATE audit_log, refresh_tokens, loan_state_transitions, loans, users, mdas CASCADE`);

  testMdaId = generateUuidv7();
  secondMdaId = generateUuidv7();

  await db.insert(mdas).values([
    { id: testMdaId, name: 'Transition Test MDA', code: 'TRN_TEST', abbreviation: 'TrnTest' },
    { id: secondMdaId, name: 'Other MDA', code: 'TRN_OTHER', abbreviation: 'TrnOther' },
  ]);

  const hashedPassword = await hashPassword(testPassword);

  // Create super_admin
  superAdminUserId = generateUuidv7();
  await db.insert(users).values({
    id: superAdminUserId,
    email: 'transition.superadmin@test.com',
    hashedPassword,
    firstName: 'Super',
    lastName: 'Admin',
    role: 'super_admin',
  });

  // Create dept_admin
  adminUserId = generateUuidv7();
  await db.insert(users).values({
    id: adminUserId,
    email: 'transition.admin@test.com',
    hashedPassword,
    firstName: 'Dept',
    lastName: 'Admin',
    role: 'dept_admin',
  });

  // Create MDA officer (scoped to testMdaId)
  officerUserId = generateUuidv7();
  await db.insert(users).values({
    id: officerUserId,
    email: 'transition.officer@test.com',
    hashedPassword,
    firstName: 'MDA',
    lastName: 'Officer',
    role: 'mda_officer',
    mdaId: testMdaId,
  });

  // Get tokens
  const superLogin = await authService.login({ email: 'transition.superadmin@test.com', password: testPassword });
  superAdminToken = superLogin.accessToken;

  const adminLogin = await authService.login({ email: 'transition.admin@test.com', password: testPassword });
  adminToken = adminLogin.accessToken;

  const officerLogin = await authService.login({ email: 'transition.officer@test.com', password: testPassword });
  officerToken = officerLogin.accessToken;
});

beforeEach(async () => {
  await db.execute(sql`TRUNCATE loan_state_transitions, loans CASCADE`);
});

afterAll(async () => {
  await db.execute(sql`TRUNCATE audit_log, refresh_tokens, loan_state_transitions, loans, users, mdas CASCADE`);
});

/** Helper: create a loan directly in DB with given status */
async function seedLoan(overrides: Partial<typeof loans.$inferInsert> = {}): Promise<string> {
  const id = generateUuidv7();
  await db.insert(loans).values({
    id,
    staffId: 'OY/TST/0001',
    staffName: 'Transition Test User',
    gradeLevel: 'GL 10',
    mdaId: testMdaId,
    principalAmount: '300000.00',
    interestRate: '6.000',
    tenureMonths: 24,
    moratoriumMonths: 0,
    monthlyDeductionAmount: '13250.00',
    approvalDate: new Date('2024-01-15'),
    firstDeductionDate: new Date('2024-02-01'),
    loanReference: `VLC-2024-${id.slice(-4)}`,
    status: 'APPLIED',
    ...overrides,
  });
  return id;
}

// ─── Task 6.3: Valid transition chain ────────────────────────────────

describe('POST /api/loans/:loanId/transition — valid transitions', () => {
  it('transitions APPLIED → APPROVED → ACTIVE → COMPLETED (full lifecycle)', async () => {
    const loanId = await seedLoan({ status: 'APPLIED' });

    // APPLIED → APPROVED
    const res1 = await request(app)
      .post(`/api/loans/${loanId}/transition`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ toStatus: 'APPROVED', reason: 'Application reviewed and approved' })
      .expect(201);

    expect(res1.body.success).toBe(true);
    expect(res1.body.data.loanId).toBe(loanId);
    expect(res1.body.data.fromStatus).toBe('APPLIED');
    expect(res1.body.data.toStatus).toBe('APPROVED');
    expect(res1.body.data.reason).toBe('Application reviewed and approved');
    expect(res1.body.data.transitionedByName).toBe('Dept Admin');
    expect(res1.body.data.id).toBeTruthy();
    expect(res1.body.data.createdAt).toBeTruthy();

    // APPROVED → ACTIVE
    const res2 = await request(app)
      .post(`/api/loans/${loanId}/transition`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ toStatus: 'ACTIVE', reason: 'Disbursement confirmed' })
      .expect(201);

    expect(res2.body.data.fromStatus).toBe('APPROVED');
    expect(res2.body.data.toStatus).toBe('ACTIVE');

    // ACTIVE → COMPLETED
    const res3 = await request(app)
      .post(`/api/loans/${loanId}/transition`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ toStatus: 'COMPLETED', reason: 'All repayments received' })
      .expect(201);

    expect(res3.body.data.fromStatus).toBe('ACTIVE');
    expect(res3.body.data.toStatus).toBe('COMPLETED');
  });

  it('super_admin can also transition loans', async () => {
    const loanId = await seedLoan({ status: 'APPLIED' });

    const res = await request(app)
      .post(`/api/loans/${loanId}/transition`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ toStatus: 'APPROVED', reason: 'Super admin approved' })
      .expect(201);

    expect(res.body.data.transitionedByName).toBe('Super Admin');
  });

  it('ACTIVE → TRANSFERRED is valid', async () => {
    const loanId = await seedLoan({ status: 'ACTIVE' });

    const res = await request(app)
      .post(`/api/loans/${loanId}/transition`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ toStatus: 'TRANSFERRED', reason: 'Staff transferred to new MDA' })
      .expect(201);

    expect(res.body.data.fromStatus).toBe('ACTIVE');
    expect(res.body.data.toStatus).toBe('TRANSFERRED');
  });

  it('ACTIVE → WRITTEN_OFF is valid', async () => {
    const loanId = await seedLoan({ status: 'ACTIVE' });

    const res = await request(app)
      .post(`/api/loans/${loanId}/transition`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ toStatus: 'WRITTEN_OFF', reason: 'Loan written off per policy' })
      .expect(201);

    expect(res.body.data.fromStatus).toBe('ACTIVE');
    expect(res.body.data.toStatus).toBe('WRITTEN_OFF');
  });
});

// ─── Task 6.4: Invalid transitions ──────────────────────────────────

describe('POST /api/loans/:loanId/transition — invalid transitions', () => {
  it('rejects APPLIED → ACTIVE (skip APPROVED)', async () => {
    const loanId = await seedLoan({ status: 'APPLIED' });

    const res = await request(app)
      .post(`/api/loans/${loanId}/transition`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ toStatus: 'ACTIVE', reason: 'Trying to skip' })
      .expect(400);

    expect(res.body.error.code).toBe('INVALID_TRANSITION');
    expect(res.body.error.message).toContain('APPROVED');
  });

  it('rejects COMPLETED → APPLIED (terminal status)', async () => {
    const loanId = await seedLoan({ status: 'COMPLETED' });

    const res = await request(app)
      .post(`/api/loans/${loanId}/transition`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ toStatus: 'APPLIED', reason: 'Trying to reopen' })
      .expect(400);

    expect(res.body.error.code).toBe('INVALID_TRANSITION');
    expect(res.body.error.message).toContain('No further status changes');
  });

  it('rejects ACTIVE → ACTIVE (same-status transition)', async () => {
    const loanId = await seedLoan({ status: 'ACTIVE' });

    const res = await request(app)
      .post(`/api/loans/${loanId}/transition`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ toStatus: 'ACTIVE', reason: 'Same status' })
      .expect(400);

    expect(res.body.error.code).toBe('LOAN_ALREADY_IN_STATUS');
    expect(res.body.error.message).toContain('already in the requested status');
  });

  it('does not modify loan status on invalid transition', async () => {
    const loanId = await seedLoan({ status: 'APPLIED' });

    await request(app)
      .post(`/api/loans/${loanId}/transition`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ toStatus: 'ACTIVE', reason: 'Invalid' })
      .expect(400);

    // Verify loan status unchanged
    const [loan] = await db.select({ status: loans.status }).from(loans).where(sql`id = ${loanId}`);
    expect(loan.status).toBe('APPLIED');

    // Verify no transition record created
    const transitions = await db.select().from(loanStateTransitions).where(sql`loan_id = ${loanId}`);
    expect(transitions).toHaveLength(0);
  });
});

// ─── Task 6.5: MDA scoping for GET transitions ─────────────────────

describe('GET /api/loans/:loanId/transitions — MDA scoping', () => {
  it('mda_officer can view transitions for loan in their MDA', async () => {
    const loanId = await seedLoan({ mdaId: testMdaId, status: 'APPLIED' });

    // Create a transition first
    await request(app)
      .post(`/api/loans/${loanId}/transition`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ toStatus: 'APPROVED', reason: 'Approved' })
      .expect(201);

    const res = await request(app)
      .get(`/api/loans/${loanId}/transitions`)
      .set('Authorization', `Bearer ${officerToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
  });

  it('mda_officer gets 403 for loan outside their MDA', async () => {
    const loanId = await seedLoan({ mdaId: secondMdaId, status: 'APPLIED' });

    const res = await request(app)
      .get(`/api/loans/${loanId}/transitions`)
      .set('Authorization', `Bearer ${officerToken}`)
      .expect(403);

    expect(res.body.error.code).toBe('MDA_ACCESS_DENIED');
  });
});

// ─── Task 6.6: mda_officer cannot POST transition ───────────────────

describe('POST /api/loans/:loanId/transition — role enforcement', () => {
  it('mda_officer cannot POST transition (403)', async () => {
    const loanId = await seedLoan({ status: 'APPLIED' });

    await request(app)
      .post(`/api/loans/${loanId}/transition`)
      .set('Authorization', `Bearer ${officerToken}`)
      .send({ toStatus: 'APPROVED', reason: 'Officer trying to approve' })
      .expect(403);
  });

  it('unauthenticated request is rejected (401)', async () => {
    const loanId = await seedLoan({ status: 'APPLIED' });

    await request(app)
      .post(`/api/loans/${loanId}/transition`)
      .send({ toStatus: 'APPROVED', reason: 'No auth' })
      .expect(401);
  });
});

// ─── Task 6.7: Transition history chronological order ────────────────

describe('GET /api/loans/:loanId/transitions — history', () => {
  it('returns transitions in chronological order with user names', async () => {
    const loanId = await seedLoan({ status: 'APPLIED' });

    // Perform multiple transitions
    await request(app)
      .post(`/api/loans/${loanId}/transition`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ toStatus: 'APPROVED', reason: 'Step 1' })
      .expect(201);

    await request(app)
      .post(`/api/loans/${loanId}/transition`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ toStatus: 'ACTIVE', reason: 'Step 2' })
      .expect(201);

    const res = await request(app)
      .get(`/api/loans/${loanId}/transitions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);

    // Chronological order (oldest first)
    const [first, second] = res.body.data;
    expect(first.fromStatus).toBe('APPLIED');
    expect(first.toStatus).toBe('APPROVED');
    expect(first.transitionedByName).toBe('Dept Admin');
    expect(first.reason).toBe('Step 1');

    expect(second.fromStatus).toBe('APPROVED');
    expect(second.toStatus).toBe('ACTIVE');
    expect(second.transitionedByName).toBe('Super Admin');
    expect(second.reason).toBe('Step 2');

    // Verify chronological order
    expect(new Date(first.createdAt).getTime()).toBeLessThanOrEqual(new Date(second.createdAt).getTime());
  });

  it('returns empty array for loan with no transitions', async () => {
    const loanId = await seedLoan({ status: 'APPLIED' });

    const res = await request(app)
      .get(`/api/loans/${loanId}/transitions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data).toEqual([]);
  });
});

// ─── Task 6.8: Atomicity ─────────────────────────────────────────────

describe('Transition atomicity', () => {
  it('loan status and transition record are created atomically on success', async () => {
    const loanId = await seedLoan({ status: 'APPLIED' });

    await request(app)
      .post(`/api/loans/${loanId}/transition`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ toStatus: 'APPROVED', reason: 'Atomic test' })
      .expect(201);

    // Verify loan status updated
    const [loan] = await db.select({ status: loans.status }).from(loans).where(sql`id = ${loanId}`);
    expect(loan.status).toBe('APPROVED');

    // Verify transition record exists
    const transitions = await db.select().from(loanStateTransitions).where(sql`loan_id = ${loanId}`);
    expect(transitions).toHaveLength(1);
    expect(transitions[0].fromStatus).toBe('APPLIED');
    expect(transitions[0].toStatus).toBe('APPROVED');
  });

  it('neither loan status nor transition record changes on validation failure', async () => {
    const loanId = await seedLoan({ status: 'APPLIED' });

    // Attempt invalid transition
    await request(app)
      .post(`/api/loans/${loanId}/transition`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ toStatus: 'COMPLETED', reason: 'Skip to completed' })
      .expect(400);

    // Verify loan status unchanged
    const [loan] = await db.select({ status: loans.status }).from(loans).where(sql`id = ${loanId}`);
    expect(loan.status).toBe('APPLIED');

    // Verify no transition record
    const transitions = await db.select().from(loanStateTransitions).where(sql`loan_id = ${loanId}`);
    expect(transitions).toHaveLength(0);
  });
});

// ─── Task 6.9: Immutability ──────────────────────────────────────────

describe('loan_state_transitions immutability', () => {
  it('rejects UPDATE on transition records (DB trigger)', async () => {
    const loanId = await seedLoan({ status: 'APPLIED' });

    await request(app)
      .post(`/api/loans/${loanId}/transition`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ toStatus: 'APPROVED', reason: 'Original reason' })
      .expect(201);

    // Attempt direct UPDATE via SQL — trigger rejects with restrict_violation
    await expect(
      db.execute(sql`UPDATE loan_state_transitions SET reason = 'Tampered' WHERE loan_id = ${loanId}`),
    ).rejects.toThrow();
  });

  it('rejects DELETE on transition records (DB trigger)', async () => {
    const loanId = await seedLoan({ status: 'APPLIED' });

    await request(app)
      .post(`/api/loans/${loanId}/transition`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ toStatus: 'APPROVED', reason: 'Will try to delete' })
      .expect(201);

    // Attempt direct DELETE via SQL — trigger rejects with restrict_violation
    await expect(
      db.execute(sql`DELETE FROM loan_state_transitions WHERE loan_id = ${loanId}`),
    ).rejects.toThrow();
  });
});

// ─── Task 6.10: 404 for non-existent loan ────────────────────────────

describe('Transition for non-existent loan', () => {
  it('POST transition returns 404 for non-existent loanId', async () => {
    const fakeLoanId = generateUuidv7();

    const res = await request(app)
      .post(`/api/loans/${fakeLoanId}/transition`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ toStatus: 'APPROVED', reason: 'Loan does not exist' })
      .expect(404);

    expect(res.body.error.code).toBe('LOAN_NOT_FOUND');
  });

  it('GET transitions returns 404 for non-existent loanId', async () => {
    const fakeLoanId = generateUuidv7();

    const res = await request(app)
      .get(`/api/loans/${fakeLoanId}/transitions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);

    expect(res.body.error.code).toBe('LOAN_NOT_FOUND');
  });
});

// ─── Validation ──────────────────────────────────────────────────────

describe('Transition input validation', () => {
  it('rejects missing reason', async () => {
    const loanId = await seedLoan({ status: 'APPLIED' });

    await request(app)
      .post(`/api/loans/${loanId}/transition`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ toStatus: 'APPROVED' })
      .expect(400);
  });

  it('rejects empty reason', async () => {
    const loanId = await seedLoan({ status: 'APPLIED' });

    await request(app)
      .post(`/api/loans/${loanId}/transition`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ toStatus: 'APPROVED', reason: '' })
      .expect(400);
  });

  it('rejects invalid toStatus value', async () => {
    const loanId = await seedLoan({ status: 'APPLIED' });

    await request(app)
      .post(`/api/loans/${loanId}/transition`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ toStatus: 'INVALID_STATUS', reason: 'Bad status' })
      .expect(400);
  });

  it('rejects reason exceeding 500 characters', async () => {
    const loanId = await seedLoan({ status: 'APPLIED' });

    await request(app)
      .post(`/api/loans/${loanId}/transition`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ toStatus: 'APPROVED', reason: 'x'.repeat(501) })
      .expect(400);
  });
});
