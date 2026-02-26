import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import app from '../app';
import { db } from '../db/index';
import { mdas, users } from '../db/schema';
import { hashPassword } from '../lib/password';
import { generateUuidv7 } from '../lib/uuidv7';
import * as authService from '../services/authService';

let testMdaId: string;
let adminToken: string;
let testLoanId: string;

const testPassword = 'SecurePass1';

beforeAll(async () => {
  await db.execute(sql`TRUNCATE audit_log, refresh_tokens, loans, users, mdas CASCADE`);

  testMdaId = generateUuidv7();
  await db.insert(mdas).values({
    id: testMdaId,
    name: 'Schedule Test MDA',
    code: 'SCHED_TEST',
    abbreviation: 'SchedTest',
  });

  const hashedPassword = await hashPassword(testPassword);
  await db.insert(users).values({
    id: generateUuidv7(),
    email: 'sched.admin@test.com',
    hashedPassword,
    firstName: 'Schedule',
    lastName: 'Admin',
    role: 'dept_admin',
  });

  const login = await authService.login({ email: 'sched.admin@test.com', password: testPassword });
  adminToken = login.accessToken;

  // Create a test loan
  const res = await request(app)
    .post('/api/loans')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      staffId: 'OY/SCH/0001',
      staffName: 'Schedule Test User',
      gradeLevel: 'GL 10',
      mdaId: testMdaId,
      principalAmount: '250000.00',
      interestRate: '13.330',
      tenureMonths: 60,
      moratoriumMonths: 0,
      monthlyDeductionAmount: '4722.09',
      approvalDate: '2024-03-15',
      firstDeductionDate: '2024-04-01',
    })
    .expect(201);

  testLoanId = res.body.data.id;
});

afterAll(async () => {
  await db.execute(sql`TRUNCATE audit_log, refresh_tokens, loans, users, mdas CASCADE`);
});

describe('GET /api/loans/:loanId/schedule', () => {
  it('returns computed schedule for loan', async () => {
    const res = await request(app)
      .get(`/api/loans/${testLoanId}/schedule`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.totalInterest).toBe('33325.00');
    expect(res.body.data.totalLoan).toBe('283325.00');
    expect(res.body.data.schedule).toHaveLength(60);
    expect(res.body.data.isWhatIf).toBe(false);
    expect(res.body.data.originalTenureMonths).toBe(60);
    expect(res.body.data.effectiveTenureMonths).toBe(60);
  });

  it('returns what-if schedule with ?tenureMonths override', async () => {
    const res = await request(app)
      .get(`/api/loans/${testLoanId}/schedule?tenureMonths=45`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.isWhatIf).toBe(true);
    expect(res.body.data.originalTenureMonths).toBe(60);
    expect(res.body.data.effectiveTenureMonths).toBe(45);
    expect(res.body.data.schedule).toHaveLength(45);
    // Total interest unchanged (flat-rate)
    expect(res.body.data.totalInterest).toBe('33325.00');
    // Last row closes at ₦0.00
    const last = res.body.data.schedule[44];
    expect(last.runningBalance).toBe('0.00');
  });

  it('returns 400 for invalid tenureMonths (non-integer)', async () => {
    const res = await request(app)
      .get(`/api/loans/${testLoanId}/schedule?tenureMonths=abc`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/tenureMonths/);
  });

  it('returns 400 for tenureMonths=0', async () => {
    const res = await request(app)
      .get(`/api/loans/${testLoanId}/schedule?tenureMonths=0`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);

    expect(res.body.success).toBe(false);
  });

  it('returns 400 for negative tenureMonths', async () => {
    const res = await request(app)
      .get(`/api/loans/${testLoanId}/schedule?tenureMonths=-5`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);

    expect(res.body.success).toBe(false);
  });

  it('rejects unauthenticated request', async () => {
    await request(app)
      .get(`/api/loans/${testLoanId}/schedule`)
      .expect(401);
  });

  it('returns 404 for non-existent loan', async () => {
    await request(app)
      .get(`/api/loans/${generateUuidv7()}/schedule`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });
});
