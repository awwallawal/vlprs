import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { sql, eq } from 'drizzle-orm';
import app from '../app';
import { db } from '../db/index';
import { users, mdas, schemeConfig } from '../db/schema';
import { hashPassword } from '../lib/password';
import { signAccessToken } from '../lib/jwt';
import { generateUuidv7 } from '../lib/uuidv7';
import { resetRateLimiters } from '../middleware/rateLimiter';

let testMdaId: string;
let adminToken: string;
let adminUserId: string;
let officerToken: string;

beforeAll(async () => {
  await db.execute(sql`TRUNCATE audit_log, ledger_entries, loan_state_transitions, loans, scheme_config, refresh_tokens, users, mdas CASCADE`);

  testMdaId = generateUuidv7();
  await db.insert(mdas).values({ id: testMdaId, name: 'Dashboard Test MDA', code: 'DSHT', abbreviation: 'Dashboard Test' });

  adminUserId = generateUuidv7();
  const hashed = await hashPassword('Password1');
  await db.insert(users).values({
    id: adminUserId,
    email: 'admin@test.com',
    hashedPassword: hashed,
    firstName: 'Admin',
    lastName: 'User',
    role: 'super_admin',
    isActive: true,
  });

  adminToken = signAccessToken({ userId: adminUserId, email: 'admin@test.com', role: 'super_admin', mdaId: null });

  // Create mda_officer user for RBAC rejection test
  const officerUserId = generateUuidv7();
  await db.insert(users).values({
    id: officerUserId,
    email: 'officer@test.com',
    hashedPassword: hashed,
    firstName: 'Officer',
    lastName: 'User',
    role: 'mda_officer',
    mdaId: testMdaId,
    isActive: true,
  });
  officerToken = signAccessToken({ userId: officerUserId, email: 'officer@test.com', role: 'mda_officer', mdaId: testMdaId });
});

beforeEach(() => {
  resetRateLimiters();
});

afterAll(async () => {
  await db.execute(sql`TRUNCATE audit_log, ledger_entries, loan_state_transitions, loans, scheme_config, refresh_tokens, users, mdas CASCADE`);
});

describe('GET /api/dashboard/metrics', () => {
  it('returns 401 without authentication', async () => {
    const res = await request(app).get('/api/dashboard/metrics');
    expect(res.status).toBe(401);
  });

  it('returns 403 for mda_officer role (requires super_admin or dept_admin)', async () => {
    const res = await request(app)
      .get('/api/dashboard/metrics')
      .set('Authorization', `Bearer ${officerToken}`);
    expect(res.status).toBe(403);
  });

  it('returns dashboard metrics with success envelope', async () => {
    const res = await request(app)
      .get('/api/dashboard/metrics')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();

    const data = res.body.data;
    // Primary hero row
    expect(typeof data.activeLoans).toBe('number');
    expect(typeof data.totalExposure).toBe('string');
    expect(typeof data.fundConfigured).toBe('boolean');
    expect(typeof data.monthlyRecovery).toBe('string');
    expect(typeof data.recoveryPeriod).toBe('string');

    // Analytics row
    expect(typeof data.loansInWindow).toBe('number');
    expect(typeof data.totalOutstandingReceivables).toBe('string');
    expect(typeof data.monthlyCollectionPotential).toBe('string');
    expect(typeof data.atRiskAmount).toBe('string');
    expect(typeof data.loanCompletionRate).toBe('number');
    expect(typeof data.loanCompletionRateLifetime).toBe('number');

    // Secondary metrics
    expect(typeof data.gratuityReceivableExposure).toBe('string');
    expect(data.staffIdCoverage).toEqual({ covered: 0, total: 0 });
  });

  it('returns fundConfigured: false and fundAvailable: null when scheme_fund_total not configured', async () => {
    // Ensure no scheme config exists
    await db.delete(schemeConfig).where(eq(schemeConfig.key, 'scheme_fund_total'));

    const res = await request(app)
      .get('/api/dashboard/metrics')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.fundConfigured).toBe(false);
    expect(res.body.data.fundAvailable).toBeNull();
  });

  it('returns fundConfigured: true with computed fundAvailable when scheme_fund_total configured', async () => {
    // Set scheme fund total
    await db.insert(schemeConfig).values({
      key: 'scheme_fund_total',
      value: '5000000000.00',
      updatedBy: adminUserId,
    }).onConflictDoUpdate({
      target: schemeConfig.key,
      set: { value: '5000000000.00', updatedBy: adminUserId },
    });

    const res = await request(app)
      .get('/api/dashboard/metrics')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.fundConfigured).toBe(true);
    expect(res.body.data.fundAvailable).not.toBeNull();
    expect(typeof res.body.data.fundAvailable).toBe('string');

    // Clean up
    await db.delete(schemeConfig).where(eq(schemeConfig.key, 'scheme_fund_total'));
  });

  it('returns zero counts when no loans exist', async () => {
    const res = await request(app)
      .get('/api/dashboard/metrics')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.activeLoans).toBe(0);
    expect(res.body.data.loansInWindow).toBe(0);
    expect(res.body.data.loanCompletionRate).toBe(0);
    expect(res.body.data.loanCompletionRateLifetime).toBe(0);
  });

  it('response payload is compact (< 2KB)', async () => {
    const res = await request(app)
      .get('/api/dashboard/metrics')
      .set('Authorization', `Bearer ${adminToken}`);

    const payloadSize = Buffer.byteLength(JSON.stringify(res.body.data), 'utf-8');
    expect(payloadSize).toBeLessThan(2048);
  });
});
