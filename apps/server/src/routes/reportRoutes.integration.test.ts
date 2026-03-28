/**
 * Report routes integration tests — Executive Summary, MDA Compliance,
 * Variance, and Loan Snapshot endpoints.
 *
 * Tests auth, response shape, and query param validation.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { db } from '../db/index';
import { users, mdas } from '../db/schema';
import { signAccessToken } from '../lib/jwt';
import { generateUuidv7 } from '../lib/uuidv7';
import { resetRateLimiters } from '../middleware/rateLimiter';
import { resetDb } from '../test/resetDb';

let testMdaId: string;
let testUserId: string;
let superAdminToken: string;
let deptAdminToken: string;
let mdaOfficerToken: string;

beforeAll(async () => {
  await resetDb();
  resetRateLimiters();

  testMdaId = generateUuidv7();
  await db.insert(mdas).values({
    id: testMdaId,
    name: 'Ministry of Test',
    code: 'TEST',
    abbreviation: 'Test',
  });

  // Super Admin
  testUserId = generateUuidv7();
  await db.insert(users).values({
    id: testUserId,
    email: 'report-super@test.com',
    hashedPassword: 'hashed',
    firstName: 'Report',
    lastName: 'Super',
    role: 'super_admin',
  });
  superAdminToken = signAccessToken({
    userId: testUserId,
    email: 'report-super@test.com',
    role: 'super_admin',
    mdaId: null,
    mustChangePassword: false,
  });

  // Dept Admin
  const deptAdminId = generateUuidv7();
  await db.insert(users).values({
    id: deptAdminId,
    email: 'report-dept@test.com',
    hashedPassword: 'hashed',
    firstName: 'Report',
    lastName: 'Dept',
    role: 'dept_admin',
  });
  deptAdminToken = signAccessToken({
    userId: deptAdminId,
    email: 'report-dept@test.com',
    role: 'dept_admin',
    mdaId: null,
    mustChangePassword: false,
  });

  // MDA Officer
  const officerId = generateUuidv7();
  await db.insert(users).values({
    id: officerId,
    email: 'report-officer@test.com',
    hashedPassword: 'hashed',
    firstName: 'Report',
    lastName: 'Officer',
    role: 'mda_officer',
    mdaId: testMdaId,
  });
  mdaOfficerToken = signAccessToken({
    userId: officerId,
    email: 'report-officer@test.com',
    role: 'mda_officer',
    mdaId: testMdaId,
    mustChangePassword: false,
  });
});

afterAll(async () => {
  await resetDb();
});

describe('GET /api/reports/executive-summary', () => {
  it('returns 200 with report data for super_admin', async () => {
    const res = await request(app)
      .get('/api/reports/executive-summary')
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.schemeOverview).toBeDefined();
    expect(res.body.data.portfolioStatus).toBeInstanceOf(Array);
    expect(res.body.data.mdaScorecard).toBeDefined();
    expect(res.body.data.receivablesRanking).toBeInstanceOf(Array);
    expect(res.body.data.recoveryPotential).toBeInstanceOf(Array);
    expect(res.body.data.submissionCoverage).toBeDefined();
    expect(res.body.data.onboardingPipeline).toBeDefined();
    expect(res.body.data.exceptionSummary).toBeDefined();
    expect(res.body.data.topVariances).toBeInstanceOf(Array);
    expect(res.body.data.monthOverMonthTrend).toBeDefined();
    expect(res.body.data.generatedAt).toBeDefined();
  });

  it('returns 200 for dept_admin', async () => {
    const res = await request(app)
      .get('/api/reports/executive-summary')
      .set('Authorization', `Bearer ${deptAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 403 for mda_officer', async () => {
    const res = await request(app)
      .get('/api/reports/executive-summary')
      .set('Authorization', `Bearer ${mdaOfficerToken}`);

    expect(res.status).toBe(403);
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .get('/api/reports/executive-summary');

    expect(res.status).toBe(401);
  });

  it('returns report as current-period snapshot (no period params)', async () => {
    const res = await request(app)
      .get('/api/reports/executive-summary')
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.generatedAt).toBeDefined();
  });
});

describe('GET /api/reports/mda-compliance', () => {
  it('returns 200 with compliance data for super_admin', async () => {
    const res = await request(app)
      .get('/api/reports/mda-compliance')
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.rows).toBeInstanceOf(Array);
    expect(res.body.data.summary).toBeDefined();
    expect(res.body.data.periodYear).toBeGreaterThan(0);
    expect(res.body.data.periodMonth).toBeGreaterThan(0);
    expect(res.body.data.generatedAt).toBeDefined();
  });

  it('returns 200 for dept_admin', async () => {
    const res = await request(app)
      .get('/api/reports/mda-compliance')
      .set('Authorization', `Bearer ${deptAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 403 for mda_officer', async () => {
    const res = await request(app)
      .get('/api/reports/mda-compliance')
      .set('Authorization', `Bearer ${mdaOfficerToken}`);

    expect(res.status).toBe(403);
  });

  it('filters by period', async () => {
    const res = await request(app)
      .get('/api/reports/mda-compliance?periodYear=2026&periodMonth=3')
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.periodYear).toBe(2026);
    expect(res.body.data.periodMonth).toBe(3);
  });

  it('includes summary with totals', async () => {
    const res = await request(app)
      .get('/api/reports/mda-compliance')
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    const { summary } = res.body.data;
    expect(summary).toHaveProperty('totalMdas');
    expect(summary).toHaveProperty('averageHealthScore');
    expect(summary).toHaveProperty('totalOutstanding');
    expect(summary).toHaveProperty('totalObservations');
  });
});

describe('GET /api/reports/variance', () => {
  it('returns 200 with variance data for super_admin', async () => {
    const res = await request(app)
      .get('/api/reports/variance')
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.summary).toBeDefined();
    expect(res.body.data.summary).toHaveProperty('alignedCount');
    expect(res.body.data.summary).toHaveProperty('minorVarianceCount');
    expect(res.body.data.summary).toHaveProperty('varianceCount');
    expect(res.body.data.summary).toHaveProperty('totalRecords');
    expect(res.body.data.rows).toBeInstanceOf(Array);
    expect(res.body.data.overdueRegister).toBeInstanceOf(Array);
    expect(res.body.data.stalledRegister).toBeInstanceOf(Array);
    expect(res.body.data.overDeductedRegister).toBeInstanceOf(Array);
    expect(res.body.data.generatedAt).toBeDefined();
  });

  it('returns 200 for dept_admin', async () => {
    const res = await request(app)
      .get('/api/reports/variance')
      .set('Authorization', `Bearer ${deptAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 403 for mda_officer', async () => {
    const res = await request(app)
      .get('/api/reports/variance')
      .set('Authorization', `Bearer ${mdaOfficerToken}`);

    expect(res.status).toBe(403);
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .get('/api/reports/variance');

    expect(res.status).toBe(401);
  });

  it('accepts optional mdaId and period params', async () => {
    const res = await request(app)
      .get(`/api/reports/variance?mdaId=${testMdaId}&periodYear=2026&periodMonth=3`)
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('GET /api/reports/loan-snapshot', () => {
  it('returns 200 with snapshot data for super_admin', async () => {
    const res = await request(app)
      .get(`/api/reports/loan-snapshot?mdaId=${testMdaId}`)
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.data).toBeInstanceOf(Array);
    expect(res.body.data.summary).toBeDefined();
    expect(res.body.data.summary).toHaveProperty('totalLoans');
    expect(res.body.data.summary).toHaveProperty('totalOutstanding');
    expect(res.body.data.summary).toHaveProperty('totalMonthlyDeduction');
    expect(res.body.data.summary).toHaveProperty('averageInterestRate');
    expect(res.body.data.pagination).toBeDefined();
    expect(res.body.data.pagination).toHaveProperty('page');
    expect(res.body.data.pagination).toHaveProperty('pageSize');
  });

  it('returns 200 for dept_admin', async () => {
    const res = await request(app)
      .get(`/api/reports/loan-snapshot?mdaId=${testMdaId}`)
      .set('Authorization', `Bearer ${deptAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 403 for mda_officer', async () => {
    const res = await request(app)
      .get(`/api/reports/loan-snapshot?mdaId=${testMdaId}`)
      .set('Authorization', `Bearer ${mdaOfficerToken}`);

    expect(res.status).toBe(403);
  });

  it('requires mdaId parameter', async () => {
    const res = await request(app)
      .get('/api/reports/loan-snapshot')
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(400);
  });

  it('rejects invalid mdaId', async () => {
    const res = await request(app)
      .get('/api/reports/loan-snapshot?mdaId=not-a-uuid')
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(400);
  });

  it('accepts pagination and sort params', async () => {
    const res = await request(app)
      .get(`/api/reports/loan-snapshot?mdaId=${testMdaId}&page=1&pageSize=25&sortBy=staffName&sortOrder=asc`)
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.pagination.page).toBe(1);
    expect(res.body.data.pagination.pageSize).toBe(25);
  });

  it('accepts statusFilter param', async () => {
    const res = await request(app)
      .get(`/api/reports/loan-snapshot?mdaId=${testMdaId}&statusFilter=ACTIVE`)
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('GET /api/reports/weekly-ag', () => {
  it('returns 200 with report data for super_admin', async () => {
    const res = await request(app)
      .get('/api/reports/weekly-ag')
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.generatedAt).toBeDefined();
    expect(res.body.data.periodStart).toBeDefined();
    expect(res.body.data.periodEnd).toBeDefined();
    expect(res.body.data.executiveSummary).toBeDefined();
    expect(res.body.data.complianceStatus).toBeDefined();
    expect(res.body.data.complianceStatus.submissionsThisWeek).toBeInstanceOf(Array);
    expect(res.body.data.exceptionsResolved).toBeInstanceOf(Array);
    expect(res.body.data.outstandingAttentionItems).toBeInstanceOf(Array);
    expect(res.body.data.quickRecoveryOpportunities).toBeInstanceOf(Array);
    expect(res.body.data.observationActivity).toBeDefined();
    expect(res.body.data.portfolioSnapshot).toBeInstanceOf(Array);
  });

  it('returns 200 for dept_admin', async () => {
    const res = await request(app)
      .get('/api/reports/weekly-ag')
      .set('Authorization', `Bearer ${deptAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 403 for mda_officer', async () => {
    const res = await request(app)
      .get('/api/reports/weekly-ag')
      .set('Authorization', `Bearer ${mdaOfficerToken}`);

    expect(res.status).toBe(403);
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .get('/api/reports/weekly-ag');

    expect(res.status).toBe(401);
  });

  it('defaults to current date when no asOfDate provided', async () => {
    const res = await request(app)
      .get('/api/reports/weekly-ag')
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    const { periodEnd } = res.body.data;
    const today = new Date().toISOString().slice(0, 10);
    expect(periodEnd).toBe(today);
  });

  it('accepts valid asOfDate parameter', async () => {
    const res = await request(app)
      .get('/api/reports/weekly-ag?asOfDate=2026-03-15')
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.periodEnd).toBe('2026-03-15');
    expect(res.body.data.periodStart).toBe('2026-03-08');
  });

  it('returns 400 for invalid asOfDate', async () => {
    const res = await request(app)
      .get('/api/reports/weekly-ag?asOfDate=not-a-date')
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(400);
  });

  it('includes executive summary section shape', async () => {
    const res = await request(app)
      .get('/api/reports/weekly-ag')
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    const { executiveSummary } = res.body.data;
    expect(executiveSummary).toHaveProperty('activeLoans');
    expect(executiveSummary).toHaveProperty('totalExposure');
    expect(executiveSummary).toHaveProperty('fundAvailable');
    expect(executiveSummary).toHaveProperty('monthlyRecoveryRate');
  });

  it('includes observation activity section shape', async () => {
    const res = await request(app)
      .get('/api/reports/weekly-ag')
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    const { observationActivity } = res.body.data;
    expect(observationActivity).toHaveProperty('newCount');
    expect(observationActivity).toHaveProperty('reviewedCount');
    expect(observationActivity).toHaveProperty('resolvedCount');
  });

  it('generates report within 10-second performance budget (NFR-PERF-4)', async () => {
    const start = Date.now();
    const res = await request(app)
      .get('/api/reports/weekly-ag')
      .set('Authorization', `Bearer ${superAdminToken}`);

    const elapsed = Date.now() - start;
    expect(res.status).toBe(200);
    expect(elapsed).toBeLessThan(10_000);
  });
});
