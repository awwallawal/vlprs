import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import app from '../app';
import { db } from '../db/index';
import { mdas, users, ledgerEntries } from '../db/schema';
import { hashPassword } from '../lib/password';
import { generateUuidv7 } from '../lib/uuidv7';
import * as authService from '../services/authService';
import { autoSplitDeduction } from '../services/computationEngine';

let testMdaId: string;
let secondMdaId: string;
let adminToken: string;
let officerToken: string;
let adminUserId: string;

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
  adminUserId = generateUuidv7();
  await db.insert(users).values({
    id: adminUserId,
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

/** Helper: create a loan via API and return its ID */
async function createLoanViaApi(body = validLoanBody()): Promise<string> {
  const res = await request(app)
    .post('/api/loans')
    .set('Authorization', `Bearer ${adminToken}`)
    .send(body)
    .expect(201);
  return res.body.data.id;
}

/** Helper: seed ledger entries for a loan */
async function seedLedgerEntries(loanId: string, staffId: string, mdaId: string, count: number, params: { principalAmount: string; interestRate: string }) {
  const split = autoSplitDeduction('15278.00', {
    principalAmount: params.principalAmount,
    interestRate: params.interestRate,
    tenureMonths: 36,
    moratoriumMonths: 0,
  });

  for (let i = 0; i < count; i++) {
    await db.insert(ledgerEntries).values({
      id: generateUuidv7(),
      loanId,
      staffId,
      mdaId,
      entryType: 'PAYROLL',
      amount: '15278.00',
      principalComponent: split.principalComponent,
      interestComponent: split.interestComponent,
      periodMonth: ((i % 12) + 1),
      periodYear: 2024 + Math.floor(i / 12),
      postedBy: adminUserId,
    });
  }
}

// ─── Existing Story 2.1 Tests ──────────────────────────────────────

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

// ─── Story 2.6: Search Endpoint (AC 1, 3) ──────────────────────────

describe('GET /api/loans (search)', () => {
  it('returns paginated results with balance data', async () => {
    const loanId = await createLoanViaApi();
    await seedLedgerEntries(loanId, 'OY/TST/0001', testMdaId, 3, {
      principalAmount: '500000.00',
      interestRate: '6.000',
    });

    const res = await request(app)
      .get('/api/loans')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination).toMatchObject({
      page: 1,
      pageSize: 25,
      totalItems: 1,
      totalPages: 1,
    });

    const loan = res.body.data[0];
    expect(loan.loanId).toBe(loanId);
    expect(loan.staffName).toBe('Integration Test User');
    expect(loan.staffId).toBe('OY/TST/0001');
    expect(loan.mdaName).toBe('Test Health MDA');
    expect(loan.status).toBe('APPLIED');
    expect(loan.installmentsPaid).toBe(3);
    expect(loan.installmentsRemaining).toBe(33);
    expect(typeof loan.outstandingBalance).toBe('string');
    expect(typeof loan.principalAmount).toBe('string');
  });

  it('searches by staffId partial match', async () => {
    await createLoanViaApi();
    await createLoanViaApi({ ...validLoanBody(), staffId: 'OY/EDU/0002', staffName: 'Another User' });

    const res = await request(app)
      .get('/api/loans?search=EDU')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].staffId).toBe('OY/EDU/0002');
  });

  it('searches by borrower name', async () => {
    await createLoanViaApi({ ...validLoanBody(), staffName: 'Mustapha Ibrahim' });
    await createLoanViaApi({ ...validLoanBody(), staffId: 'OY/TST/0002', staffName: 'John Doe' });

    const res = await request(app)
      .get('/api/loans?search=Mustapha')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].staffName).toBe('Mustapha Ibrahim');
  });

  it('searches by loan reference', async () => {
    const loanId = await createLoanViaApi();

    // Get the loan reference
    const detailRes = await request(app)
      .get(`/api/loans/${loanId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const loanRef = detailRes.body.data.loanReference;

    const res = await request(app)
      .get(`/api/loans?search=${loanRef}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].loanReference).toBe(loanRef);
  });

  it('searches by MDA code', async () => {
    await createLoanViaApi();

    const res = await request(app)
      .get('/api/loans?search=INT_HEALTH')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].mdaName).toBe('Test Health MDA');
  });

  it('handles pagination correctly', async () => {
    // Create 3 loans
    for (let i = 1; i <= 3; i++) {
      await createLoanViaApi({ ...validLoanBody(), staffId: `OY/TST/000${i}`, staffName: `User ${i}` });
    }

    // Page 1, pageSize 2
    const page1 = await request(app)
      .get('/api/loans?pageSize=2&page=1')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(page1.body.data).toHaveLength(2);
    expect(page1.body.pagination).toMatchObject({
      page: 1,
      pageSize: 2,
      totalItems: 3,
      totalPages: 2,
    });

    // Page 2, pageSize 2
    const page2 = await request(app)
      .get('/api/loans?pageSize=2&page=2')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(page2.body.data).toHaveLength(1);
    expect(page2.body.pagination.page).toBe(2);
  });

  it('filters by status', async () => {
    await createLoanViaApi(); // default status: APPLIED

    const res = await request(app)
      .get('/api/loans?status=ACTIVE')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data).toHaveLength(0);
    expect(res.body.pagination.totalItems).toBe(0);

    const applied = await request(app)
      .get('/api/loans?status=APPLIED')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(applied.body.data).toHaveLength(1);
  });

  it('MDA officer only sees own MDA loans', async () => {
    // Create loan in testMda (officer's MDA)
    await createLoanViaApi();
    // Create loan in secondMda (not officer's)
    await createLoanViaApi({ ...validLoanBody(), staffId: 'OY/EDU/0002', staffName: 'Edu User', mdaId: secondMdaId });

    const res = await request(app)
      .get('/api/loans')
      .set('Authorization', `Bearer ${officerToken}`)
      .expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].mdaName).toBe('Test Health MDA');
  });

  it('super_admin/dept_admin sees all MDA loans', async () => {
    await createLoanViaApi();
    await createLoanViaApi({ ...validLoanBody(), staffId: 'OY/EDU/0002', staffName: 'Edu User', mdaId: secondMdaId });

    const res = await request(app)
      .get('/api/loans')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data).toHaveLength(2);
  });

  it('returns empty results for no-match search', async () => {
    await createLoanViaApi();

    const res = await request(app)
      .get('/api/loans?search=ZZZZNOTFOUND')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data).toHaveLength(0);
    expect(res.body.pagination.totalItems).toBe(0);
  });

  it('rejects search term shorter than 2 characters', async () => {
    const res = await request(app)
      .get('/api/loans?search=X')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('escapes SQL LIKE wildcards in search term', async () => {
    await createLoanViaApi();

    // '__' without escaping would match any 2 chars (LIKE wildcard)
    // With proper escaping, it should match literal '__' only — no results
    const res = await request(app)
      .get('/api/loans?search=__')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data).toHaveLength(0);
  });
});

// ─── Story 2.6: Detail Endpoint (AC 2) ─────────────────────────────

describe('GET /api/loans/:id (enriched detail)', () => {
  it('returns enriched loan detail with computed balance and schedule', async () => {
    const loanId = await createLoanViaApi();
    await seedLedgerEntries(loanId, 'OY/TST/0001', testMdaId, 5, {
      principalAmount: '500000.00',
      interestRate: '6.000',
    });

    const res = await request(app)
      .get(`/api/loans/${loanId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    const detail = res.body.data;

    // Loan master data
    expect(detail.id).toBe(loanId);
    expect(detail.staffId).toBe('OY/TST/0001');
    expect(detail.staffName).toBe('Integration Test User');
    expect(detail.mdaName).toBe('Test Health MDA');
    expect(detail.mdaCode).toBe('INT_HEALTH');
    expect(detail.principalAmount).toBe('500000.00');
    expect(detail.status).toBe('APPLIED');

    // Computed balance
    expect(detail.balance).toBeDefined();
    expect(typeof detail.balance.computedBalance).toBe('string');
    expect(detail.balance.installmentsCompleted).toBe(5);
    expect(detail.balance.installmentsRemaining).toBe(31);
    expect(typeof detail.balance.totalPrincipalPaid).toBe('string');
    expect(typeof detail.balance.totalInterestPaid).toBe('string');

    // Repayment schedule
    expect(detail.schedule).toBeDefined();
    expect(detail.schedule.params.principalAmount).toBe('500000.00');
    expect(detail.schedule.schedule).toHaveLength(36);

    // Ledger entry count
    expect(detail.ledgerEntryCount).toBe(5);
  });

  it('returns 404 for non-existent loan', async () => {
    const res = await request(app)
      .get(`/api/loans/${generateUuidv7()}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);

    expect(res.body.error.code).toBe('LOAN_NOT_FOUND');
  });

  it('MDA officer can see own MDA loan detail', async () => {
    const loanId = await createLoanViaApi();

    await request(app)
      .get(`/api/loans/${loanId}`)
      .set('Authorization', `Bearer ${officerToken}`)
      .expect(200);
  });

  it('MDA officer gets 403 for other MDA loan (AC 3)', async () => {
    const loanId = await createLoanViaApi({
      ...validLoanBody(),
      mdaId: secondMdaId,
    });

    const res = await request(app)
      .get(`/api/loans/${loanId}`)
      .set('Authorization', `Bearer ${officerToken}`)
      .expect(403);

    expect(res.body.error.code).toBe('MDA_ACCESS_DENIED');
  });

  it('returns zero balance for loan with no ledger entries', async () => {
    const loanId = await createLoanViaApi();

    const res = await request(app)
      .get(`/api/loans/${loanId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    // With 0 entries, balance should equal totalLoan (principal + interest)
    expect(res.body.data.balance.installmentsCompleted).toBe(0);
    expect(res.body.data.balance.totalAmountPaid).toBe('0.00');
    expect(res.body.data.ledgerEntryCount).toBe(0);
  });

  it('returns money fields as strings throughout', async () => {
    const loanId = await createLoanViaApi();

    const res = await request(app)
      .get(`/api/loans/${loanId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const detail = res.body.data;
    expect(typeof detail.principalAmount).toBe('string');
    expect(typeof detail.interestRate).toBe('string');
    expect(typeof detail.monthlyDeductionAmount).toBe('string');
    expect(typeof detail.balance.computedBalance).toBe('string');
  });
});

// ─── Existing MDA Tests ────────────────────────────────────────────

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
