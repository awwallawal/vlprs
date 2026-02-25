import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import app from '../app';
import { db } from '../db/index';
import { mdas, users } from '../db/schema';
import { hashPassword } from '../lib/password';
import { generateUuidv7 } from '../lib/uuidv7';
import * as authService from '../services/authService';

let testMdaId: string;
let secondMdaId: string;
let adminToken: string;
let officerToken: string;

const testPassword = 'SecurePass1';

beforeAll(async () => {
  await db.execute(sql`TRUNCATE audit_log, refresh_tokens, users, mdas CASCADE`);

  testMdaId = generateUuidv7();
  secondMdaId = generateUuidv7();

  await db.insert(mdas).values([
    { id: testMdaId, name: 'Test Health MDA', code: 'INT_HEALTH', abbreviation: 'Health' },
    { id: secondMdaId, name: 'Test Education MDA', code: 'INT_EDU', abbreviation: 'Education' },
  ]);

  const hashedPassword = await hashPassword(testPassword);

  // Create admin user
  await db.insert(users).values({
    id: generateUuidv7(),
    email: 'loan.admin@test.com',
    hashedPassword,
    firstName: 'Loan',
    lastName: 'Admin',
    role: 'dept_admin',
  });

  // Create MDA officer (scoped to testMdaId)
  await db.insert(users).values({
    id: generateUuidv7(),
    email: 'loan.officer@test.com',
    hashedPassword,
    firstName: 'Loan',
    lastName: 'Officer',
    role: 'mda_officer',
    mdaId: testMdaId,
  });

  // Get tokens
  const adminLogin = await authService.login({ email: 'loan.admin@test.com', password: testPassword });
  adminToken = adminLogin.accessToken;

  const officerLogin = await authService.login({ email: 'loan.officer@test.com', password: testPassword });
  officerToken = officerLogin.accessToken;
});

beforeEach(async () => {
  await db.execute(sql`TRUNCATE loans CASCADE`);
});

afterAll(async () => {
  await db.execute(sql`TRUNCATE audit_log, refresh_tokens, users, mdas CASCADE`);
});

const validLoanBody = () => ({
  staffId: 'OY/TST/0001',
  staffName: 'Integration Test User',
  gradeLevel: 'GL 12',
  mdaId: testMdaId,
  principalAmount: '500000.00',
  interestRate: '6.000',
  tenureMonths: 36,
  moratoriumMonths: 0,
  monthlyDeductionAmount: '15278.00',
  approvalDate: '2024-03-15',
  firstDeductionDate: '2024-04-01',
});

describe('POST /api/loans', () => {
  it('creates loan and returns 201 with complete data', async () => {
    const res = await request(app)
      .post('/api/loans')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validLoanBody())
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.staffId).toBe('OY/TST/0001');
    expect(res.body.data.staffName).toBe('Integration Test User');
    expect(res.body.data.principalAmount).toBe('500000.00');
    expect(res.body.data.loanReference).toMatch(/^VLC-\d{4}-\d{4,}$/);
    expect(res.body.data.status).toBe('APPLIED');
    expect(res.body.data.id).toBeTruthy();
  });

  it('returns money as strings in JSON', async () => {
    const res = await request(app)
      .post('/api/loans')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validLoanBody())
      .expect(201);

    expect(typeof res.body.data.principalAmount).toBe('string');
    expect(typeof res.body.data.interestRate).toBe('string');
    expect(typeof res.body.data.monthlyDeductionAmount).toBe('string');
  });

  it('rejects unauthenticated request', async () => {
    await request(app)
      .post('/api/loans')
      .send(validLoanBody())
      .expect(401);
  });

  it('rejects mda_officer (insufficient permissions)', async () => {
    await request(app)
      .post('/api/loans')
      .set('Authorization', `Bearer ${officerToken}`)
      .send(validLoanBody())
      .expect(403);
  });

  it('rejects invalid body', async () => {
    const res = await request(app)
      .post('/api/loans')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ staffId: '' })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });
});

describe('GET /api/loans/:id', () => {
  it('returns loan by ID', async () => {
    const createRes = await request(app)
      .post('/api/loans')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validLoanBody())
      .expect(201);

    const loanId = createRes.body.data.id;

    const res = await request(app)
      .get(`/api/loans/${loanId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(loanId);
    expect(res.body.data.principalAmount).toBe('500000.00');
  });

  it('returns 404 for non-existent loan', async () => {
    await request(app)
      .get(`/api/loans/${generateUuidv7()}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });

  it('MDA officer can see own MDA loans', async () => {
    const createRes = await request(app)
      .post('/api/loans')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validLoanBody())
      .expect(201);

    const loanId = createRes.body.data.id;

    await request(app)
      .get(`/api/loans/${loanId}`)
      .set('Authorization', `Bearer ${officerToken}`)
      .expect(200);
  });

  it('MDA officer cannot see other MDA loans', async () => {
    // Create loan in secondMda
    const createRes = await request(app)
      .post('/api/loans')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...validLoanBody(), mdaId: secondMdaId })
      .expect(201);

    const loanId = createRes.body.data.id;

    // Officer scoped to testMdaId should not see this
    await request(app)
      .get(`/api/loans/${loanId}`)
      .set('Authorization', `Bearer ${officerToken}`)
      .expect(404);
  });
});

describe('GET /api/mdas', () => {
  it('returns MDAs for authenticated user', async () => {
    const res = await request(app)
      .get('/api/mdas')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });

  it('MDA officer sees only their MDA', async () => {
    const res = await request(app)
      .get('/api/mdas')
      .set('Authorization', `Bearer ${officerToken}`)
      .expect(200);

    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].id).toBe(testMdaId);
  });

  it('rejects unauthenticated request', async () => {
    await request(app)
      .get('/api/mdas')
      .expect(401);
  });
});
