import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { sql, eq } from 'drizzle-orm';
import app from '../app';
import { db } from '../db/index';
import { users, mdas, loans, mdaSubmissions, submissionRows } from '../db/schema';
import { hashPassword } from '../lib/password';
import { signAccessToken } from '../lib/jwt';
import { generateUuidv7 } from '../lib/uuidv7';
import { resetRateLimiters } from '../middleware/rateLimiter';

let testMdaId: string;
let otherMdaId: string;
let adminToken: string;
let officerToken: string;
let otherOfficerToken: string;
let submissionId: string;

beforeAll(async () => {
  await db.execute(sql`TRUNCATE submission_rows, mda_submissions, loan_state_transitions, ledger_entries, loans, refresh_tokens, audit_log, users, mda_aliases, mdas CASCADE`);

  testMdaId = generateUuidv7();
  otherMdaId = generateUuidv7();
  await db.insert(mdas).values([
    { id: testMdaId, name: 'Comparison Test MDA', code: 'COMP', abbreviation: 'Comp Test' },
    { id: otherMdaId, name: 'Other MDA', code: 'OTHR', abbreviation: 'Other' },
  ]);

  const hashed = await hashPassword('Password1');

  // Super admin
  const adminUserId = generateUuidv7();
  await db.insert(users).values({
    id: adminUserId,
    email: 'comp-admin@test.com',
    hashedPassword: hashed,
    firstName: 'Admin',
    lastName: 'User',
    role: 'super_admin',
    isActive: true,
  });
  adminToken = signAccessToken({ userId: adminUserId, email: 'comp-admin@test.com', role: 'super_admin', mdaId: null });

  // MDA officer for test MDA
  const officerUserId = generateUuidv7();
  await db.insert(users).values({
    id: officerUserId,
    email: 'comp-officer@test.com',
    hashedPassword: hashed,
    firstName: 'Officer',
    lastName: 'User',
    role: 'mda_officer',
    mdaId: testMdaId,
    isActive: true,
  });
  officerToken = signAccessToken({ userId: officerUserId, email: 'comp-officer@test.com', role: 'mda_officer', mdaId: testMdaId });

  // MDA officer for OTHER MDA (for scoping test)
  const otherOfficerUserId = generateUuidv7();
  await db.insert(users).values({
    id: otherOfficerUserId,
    email: 'comp-other@test.com',
    hashedPassword: hashed,
    firstName: 'Other',
    lastName: 'Officer',
    role: 'mda_officer',
    mdaId: otherMdaId,
    isActive: true,
  });
  otherOfficerToken = signAccessToken({ userId: otherOfficerUserId, email: 'comp-other@test.com', role: 'mda_officer', mdaId: otherMdaId });

  // Create loans for comparison
  await db.insert(loans).values([
    {
      id: generateUuidv7(),
      staffId: '3301',
      staffName: 'Test Staff 1',
      gradeLevel: 'GL-10',
      mdaId: testMdaId,
      principalAmount: '1100000.00',
      interestRate: '13.330',
      tenureMonths: 60,
      monthlyDeductionAmount: '18333.33',
      approvalDate: new Date('2025-01-01'),
      firstDeductionDate: new Date('2025-02-01'),
      loanReference: 'LRN-COMP-001',
      status: 'ACTIVE',
    },
    {
      id: generateUuidv7(),
      staffId: '3302',
      staffName: 'Test Staff 2',
      gradeLevel: 'GL-08',
      mdaId: testMdaId,
      principalAmount: '500000.00',
      interestRate: '13.330',
      tenureMonths: 60,
      monthlyDeductionAmount: '8333.33',
      approvalDate: new Date('2025-01-01'),
      firstDeductionDate: new Date('2025-02-01'),
      loanReference: 'LRN-COMP-002',
      status: 'ACTIVE',
    },
  ]);

  // Create a submission with rows
  submissionId = generateUuidv7();
  const now = new Date();
  await db.insert(mdaSubmissions).values({
    id: submissionId,
    mdaId: testMdaId,
    uploadedBy: officerUserId,
    period: '2026-03',
    referenceNumber: 'BIR-2026-03-9001',
    status: 'confirmed',
    recordCount: 3,
    source: 'csv',
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(submissionRows).values([
    {
      id: generateUuidv7(),
      submissionId,
      rowNumber: 1,
      staffId: '3301',
      month: '2026-03',
      amountDeducted: '18333.33', // exact match → aligned
      payrollBatchReference: 'BATCH-001',
      mdaCode: 'COMP',
      eventFlag: 'NONE',
      createdAt: now,
    },
    {
      id: generateUuidv7(),
      submissionId,
      rowNumber: 2,
      staffId: '3302',
      month: '2026-03',
      amountDeducted: '14166.67', // 8333.33 expected → variance ≥ 500
      payrollBatchReference: 'BATCH-001',
      mdaCode: 'COMP',
      eventFlag: 'NONE',
      createdAt: now,
    },
    {
      id: generateUuidv7(),
      submissionId,
      rowNumber: 3,
      staffId: '3301',
      month: '2026-03',
      amountDeducted: '5000.00',
      payrollBatchReference: 'BATCH-001',
      mdaCode: 'COMP',
      eventFlag: 'RETIREMENT',
      eventDate: new Date('2026-03-15'),
      createdAt: now,
    },
  ]);
});

beforeEach(() => {
  resetRateLimiters();
});

afterAll(async () => {
  await db.execute(sql`TRUNCATE submission_rows, mda_submissions, loan_state_transitions, ledger_entries, loans, refresh_tokens, audit_log, users, mda_aliases, mdas CASCADE`);
});

describe('GET /api/submissions/:id/comparison', () => {
  it('returns 401 without authentication', async () => {
    const res = await request(app).get(`/api/submissions/${submissionId}/comparison`);
    expect(res.status).toBe(401);
  });

  it('returns 404 for wrong MDA scope (officer from different MDA)', async () => {
    const res = await request(app)
      .get(`/api/submissions/${submissionId}/comparison`)
      .set('Authorization', `Bearer ${otherOfficerToken}`);
    // scopeToMda filters by MDA — submission not found for this MDA
    expect([403, 404]).toContain(res.status);
  });

  it('returns 200 with comparison data for authorized officer', async () => {
    const res = await request(app)
      .get(`/api/submissions/${submissionId}/comparison`)
      .set('Authorization', `Bearer ${officerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.submissionId).toBe(submissionId);
    expect(res.body.data.referenceNumber).toBe('BIR-2026-03-9001');

    const summary = res.body.data.summary;
    expect(summary.totalRecords).toBe(3);
    // 3301 aligned + row3 skipped (RETIREMENT event) = 2 aligned
    expect(summary.alignedCount).toBe(2);
    // 3302: 14166.67 vs 8333.33 = 5833.34 variance
    expect(summary.varianceCount).toBe(1);
    expect(summary.minorVarianceCount).toBe(0);
  });

  it('returns 200 for admin (no MDA scope filter)', async () => {
    const res = await request(app)
      .get(`/api/submissions/${submissionId}/comparison`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.summary.totalRecords).toBe(3);
  });

  it('returns 404 for nonexistent submission', async () => {
    const fakeId = generateUuidv7();
    const res = await request(app)
      .get(`/api/submissions/${fakeId}/comparison`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  it('never contains punitive vocabulary in response', async () => {
    const res = await request(app)
      .get(`/api/submissions/${submissionId}/comparison`)
      .set('Authorization', `Bearer ${officerToken}`);

    const body = JSON.stringify(res.body).toLowerCase();
    expect(body).not.toContain('"error"');
    expect(body).not.toContain('"mistake"');
    expect(body).not.toContain('"fault"');
    expect(body).not.toContain('"wrong"');
    expect(body).not.toContain('"incorrect"');
    // Note: "error" may appear in error response codes but should NOT appear in comparison data
    expect(res.body.data.summary.rows.every((row: { explanation: string }) =>
      !row.explanation.toLowerCase().includes('error') &&
      !row.explanation.toLowerCase().includes('mistake') &&
      !row.explanation.toLowerCase().includes('fault')
    )).toBe(true);
  });
});
