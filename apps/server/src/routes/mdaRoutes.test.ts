import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import app from '../app';
import { db } from '../db/index';
import { users, mdas, loans } from '../db/schema';
import { hashPassword } from '../lib/password';
import { signAccessToken } from '../lib/jwt';
import { generateUuidv7 } from '../lib/uuidv7';
import { resetRateLimiters } from '../middleware/rateLimiter';

let testMdaId: string;
let otherMdaId: string;
let adminToken: string;
let officerToken: string;

beforeAll(async () => {
  await db.execute(sql`TRUNCATE loan_state_transitions, ledger_entries, loans, scheme_config, refresh_tokens, audit_log, users, mdas CASCADE`);

  testMdaId = generateUuidv7();
  otherMdaId = generateUuidv7();
  await db.insert(mdas).values([
    { id: testMdaId, name: 'MDA Summary Test', code: 'MST', abbreviation: 'MST' },
    { id: otherMdaId, name: 'Other MDA', code: 'OTH', abbreviation: 'OTH' },
  ]);

  const hashed = await hashPassword('Password1');

  const adminUserId = generateUuidv7();
  await db.insert(users).values({
    id: adminUserId,
    email: 'admin-mda@test.com',
    hashedPassword: hashed,
    firstName: 'Admin',
    lastName: 'User',
    role: 'super_admin',
    isActive: true,
  });
  adminToken = signAccessToken({ userId: adminUserId, email: 'admin-mda@test.com', role: 'super_admin', mdaId: null });

  const officerUserId = generateUuidv7();
  await db.insert(users).values({
    id: officerUserId,
    email: 'officer-mda@test.com',
    hashedPassword: hashed,
    firstName: 'Officer',
    lastName: 'User',
    role: 'mda_officer',
    mdaId: testMdaId,
    isActive: true,
  });
  officerToken = signAccessToken({ userId: officerUserId, email: 'officer-mda@test.com', role: 'mda_officer', mdaId: testMdaId });

  // Seed one active loan
  await db.insert(loans).values({
    id: generateUuidv7(),
    staffId: 'STF-SUM-001',
    staffName: 'Summary Worker',
    gradeLevel: 'GL-10',
    mdaId: testMdaId,
    principalAmount: '500000.00',
    interestRate: '5.000',
    tenureMonths: 24,
    moratoriumMonths: 0,
    monthlyDeductionAmount: '21875.00',
    approvalDate: new Date('2025-06-01'),
    firstDeductionDate: new Date('2025-08-01'),
    loanReference: 'SUM-TEST-001',
    status: 'ACTIVE',
    limitedComputation: false,
  });
});

beforeEach(() => {
  resetRateLimiters();
});

afterAll(async () => {
  await db.execute(sql`TRUNCATE loan_state_transitions, ledger_entries, loans, scheme_config, refresh_tokens, audit_log, users, mdas CASCADE`);
});

describe('GET /api/mdas/:id/summary', () => {
  it('returns 401 without authentication', async () => {
    const res = await request(app).get(`/api/mdas/${testMdaId}/summary`);
    expect(res.status).toBe(401);
  });

  it('returns 404 for non-existent MDA', async () => {
    const fakeId = generateUuidv7();
    const res = await request(app)
      .get(`/api/mdas/${fakeId}/summary`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it('returns enriched MDA summary for admin', async () => {
    const res = await request(app)
      .get(`/api/mdas/${testMdaId}/summary`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    expect(data.mdaId).toBe(testMdaId);
    expect(data.name).toBe('MDA Summary Test');
    expect(data.code).toBe('MST');
    expect(typeof data.loanCount).toBe('number');
    expect(typeof data.totalExposure).toBe('string');
    expect(typeof data.monthlyRecovery).toBe('string');
    expect(typeof data.healthScore).toBe('number');
    expect(['healthy', 'attention', 'for-review']).toContain(data.healthBand);
    expect(typeof data.statusDistribution).toBe('object');
    expect(typeof data.statusDistribution.completed).toBe('number');
    expect(typeof data.statusDistribution.onTrack).toBe('number');
    expect(typeof data.statusDistribution.overdue).toBe('number');
    expect(typeof data.statusDistribution.stalled).toBe('number');
    expect(typeof data.statusDistribution.overDeducted).toBe('number');
    expect(typeof data.expectedMonthlyDeduction).toBe('string');
    expect(typeof data.actualMonthlyRecovery).toBe('string');
    expect(data.variancePercent === null || typeof data.variancePercent === 'number').toBe(true);
  });

  it('MDA_OFFICER can access their own MDA summary', async () => {
    const res = await request(app)
      .get(`/api/mdas/${testMdaId}/summary`)
      .set('Authorization', `Bearer ${officerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.mdaId).toBe(testMdaId);
  });

  it('MDA_OFFICER cannot access a different MDA summary', async () => {
    const res = await request(app)
      .get(`/api/mdas/${otherMdaId}/summary`)
      .set('Authorization', `Bearer ${officerToken}`);

    expect(res.status).toBe(403);
  });

  it('includes loan count matching actual loans', async () => {
    const res = await request(app)
      .get(`/api/mdas/${testMdaId}/summary`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.loanCount).toBeGreaterThanOrEqual(1);
  });
});
