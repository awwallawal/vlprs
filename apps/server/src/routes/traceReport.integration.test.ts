/**
 * Trace report integration tests — API routes, authentication, data assembly.
 *
 * Covers AC 8 test requirements:
 * - Simple case: 1 loan, 1 MDA
 * - Multi-MDA person: cross-MDA timeline
 * - Authentication required with correct role
 * - Person not found returns 404
 * - JSON endpoint returns structured report data
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import app from '../app';
import { db } from '../db/index';
import { users, mdas, migrationUploads, migrationRecords } from '../db/schema';
import { signAccessToken } from '../lib/jwt';
import { generateUuidv7 } from '../lib/uuidv7';
import { resetRateLimiters } from '../middleware/rateLimiter';
import { resetSequenceCounter } from '../services/traceReportService';
import { resetDb } from '../test/resetDb';

let mdaJusticeId: string;
let mdaInfoId: string;
let testUserId: string;
let adminToken: string;
let uploadJusticeId: string;
let uploadInfoId: string;

beforeAll(async () => {
  await resetDb();

  mdaJusticeId = generateUuidv7();
  mdaInfoId = generateUuidv7();

  await db.insert(mdas).values([
    { id: mdaJusticeId, name: 'Ministry of Justice', code: 'JUSTICE', abbreviation: 'Justice' },
    { id: mdaInfoId, name: 'Ministry of Information', code: 'INFORMATION', abbreviation: 'Info' },
  ]);

  testUserId = generateUuidv7();
  await db.insert(users).values({
    id: testUserId,
    email: 'trace-admin@test.com',
    hashedPassword: 'hashed',
    firstName: 'Trace',
    lastName: 'Admin',
    role: 'super_admin',
  });

  adminToken = signAccessToken({
    userId: testUserId,
    email: 'trace-admin@test.com',
    role: 'super_admin',
    mdaId: null,
    mustChangePassword: false,
  });

  // Dept admin token available if needed for scoped tests
});

beforeEach(async () => {
  resetRateLimiters();
  resetSequenceCounter();
  await db.execute(sql`TRUNCATE person_matches, migration_records, migration_extra_fields, migration_uploads, audit_log CASCADE`);

  uploadJusticeId = generateUuidv7();
  uploadInfoId = generateUuidv7();

  await db.insert(migrationUploads).values([
    { id: uploadJusticeId, mdaId: mdaJusticeId, uploadedBy: testUserId, filename: 'justice.xlsx', fileSizeBytes: 1024, sheetCount: 1, totalRecords: 2, status: 'completed' },
    { id: uploadInfoId, mdaId: mdaInfoId, uploadedBy: testUserId, filename: 'info.xlsx', fileSizeBytes: 1024, sheetCount: 1, totalRecords: 1, status: 'completed' },
  ]);
});

afterAll(async () => {
  await resetDb();
});

describe('GET /api/staff/:personKey/trace', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/staff/JUSTICE:TEST/trace');
    expect(res.status).toBe(401);
  });

  it('returns 404 for person not found', async () => {
    const res = await request(app)
      .get(`/api/staff/${encodeURIComponent('JUSTICE:NONEXISTENT')}/trace`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  it('assembles trace for a single-MDA person', async () => {
    // Insert ADEYEMI records (Justice only)
    await db.insert(migrationRecords).values([
      {
        id: generateUuidv7(), uploadId: uploadJusticeId, mdaId: mdaJusticeId,
        sheetName: 'S1', rowNumber: 2, era: 3, staffName: 'ADEYEMI FOLASHADE',
        principal: '250000', totalLoan: '283325', monthlyDeduction: '4722',
        outstandingBalance: '250000',
        sourceFile: 'justice.xlsx', sourceSheet: 'S1', sourceRow: 2,
        periodYear: 2020, periodMonth: 1,
        varianceCategory: 'clean', hasRateVariance: false,
      },
      {
        id: generateUuidv7(), uploadId: uploadJusticeId, mdaId: mdaJusticeId,
        sheetName: 'S1', rowNumber: 3, era: 3, staffName: 'ADEYEMI FOLASHADE',
        principal: '250000', totalLoan: '283325', monthlyDeduction: '4722',
        outstandingBalance: '245278',
        sourceFile: 'justice.xlsx', sourceSheet: 'S1', sourceRow: 3,
        periodYear: 2020, periodMonth: 2,
        varianceCategory: 'clean', hasRateVariance: false,
      },
    ]);

    const personKey = 'JUSTICE:ADEYEMI FOLASHADE';
    const res = await request(app)
      .get(`/api/staff/${encodeURIComponent(personKey)}/trace`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const report = res.body.data;
    expect(report.summary.staffName).toBe('ADEYEMI FOLASHADE');
    expect(report.summary.totalLoanCycles).toBeGreaterThanOrEqual(1);
    expect(report.metadata.referenceNumber).toMatch(/^VLPRS-TRACE-\d{4}-[A-F0-9]{8}$/);
    expect(report.metadata.dataSourceNote).toBe('Generated from legacy data migration records');
    expect(report.loanCycles.length).toBeGreaterThanOrEqual(1);
    expect(report.rateAnalyses.length).toBeGreaterThanOrEqual(1);
    expect(report.dataCompleteness.overallPercent).toBeGreaterThan(0);
  });

  it('assembles trace for a multi-MDA person', async () => {
    // OLANIYAN in both Justice and Information
    await db.insert(migrationRecords).values([
      {
        id: generateUuidv7(), uploadId: uploadJusticeId, mdaId: mdaJusticeId,
        sheetName: 'S1', rowNumber: 2, era: 3, staffName: 'OLANIYAN BABATUNDE',
        principal: '300000', totalLoan: '339990', monthlyDeduction: '5666',
        outstandingBalance: '300000',
        sourceFile: 'justice.xlsx', sourceSheet: 'S1', sourceRow: 2,
        periodYear: 2019, periodMonth: 6,
        varianceCategory: 'clean', hasRateVariance: false,
      },
    ]);
    await db.insert(migrationRecords).values([
      {
        id: generateUuidv7(), uploadId: uploadInfoId, mdaId: mdaInfoId,
        sheetName: 'S1', rowNumber: 2, era: 3, staffName: 'OLANIYAN BABATUNDE',
        principal: '500000', totalLoan: '566650', monthlyDeduction: '9444',
        outstandingBalance: '500000',
        sourceFile: 'info.xlsx', sourceSheet: 'S1', sourceRow: 2,
        periodYear: 2021, periodMonth: 1,
        varianceCategory: 'clean', hasRateVariance: false,
      },
    ]);

    const personKey = 'JUSTICE:OLANIYAN BABATUNDE';
    const res = await request(app)
      .get(`/api/staff/${encodeURIComponent(personKey)}/trace`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const report = res.body.data;

    // Should show cross-MDA data
    expect(report.crossMdaTimeline.length).toBeGreaterThanOrEqual(2);
    expect(report.summary.mdas.length).toBeGreaterThanOrEqual(2);
  });

  it('reference number is unique per generation', async () => {
    // Insert a person
    await db.insert(migrationRecords).values({
      id: generateUuidv7(), uploadId: uploadJusticeId, mdaId: mdaJusticeId,
      sheetName: 'S1', rowNumber: 2, era: 3, staffName: 'UNIQUE TEST',
      principal: '100000', totalLoan: '113330', monthlyDeduction: '1889',
      outstandingBalance: '100000',
      sourceFile: 'test.xlsx', sourceSheet: 'S1', sourceRow: 2,
      periodYear: 2020, periodMonth: 1,
      varianceCategory: 'clean', hasRateVariance: false,
    });

    const personKey = 'JUSTICE:UNIQUE TEST';
    const res1 = await request(app)
      .get(`/api/staff/${encodeURIComponent(personKey)}/trace`)
      .set('Authorization', `Bearer ${adminToken}`);
    const res2 = await request(app)
      .get(`/api/staff/${encodeURIComponent(personKey)}/trace`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res1.body.data.metadata.referenceNumber).not.toBe(res2.body.data.metadata.referenceNumber);
  });

  it('includes observations from observation engine in trace data', async () => {
    // Insert person with records
    await db.insert(migrationRecords).values({
      id: generateUuidv7(), uploadId: uploadJusticeId, mdaId: mdaJusticeId,
      sheetName: 'S1', rowNumber: 2, era: 3, staffName: 'OBS TEST PERSON',
      principal: '500000', totalLoan: '566650', monthlyDeduction: '9444',
      outstandingBalance: '500000',
      sourceFile: 'justice.xlsx', sourceSheet: 'S1', sourceRow: 2,
      periodYear: 2020, periodMonth: 1,
      varianceCategory: 'clean', hasRateVariance: false,
    });

    const personKey = 'JUSTICE:OBS TEST PERSON';
    const res = await request(app)
      .get(`/api/staff/${encodeURIComponent(personKey)}/trace`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    // observations array should exist (may be empty if none generated, but field must be present)
    expect(Array.isArray(res.body.data.observations)).toBe(true);
  });

  it('rejects mda_officer role (requires SUPER_ADMIN or DEPT_ADMIN)', async () => {
    const officerUserId = generateUuidv7();
    await db.insert(users).values({
      id: officerUserId,
      email: 'officer@test.com',
      hashedPassword: 'hashed',
      firstName: 'MDA',
      lastName: 'Officer',
      role: 'mda_officer',
      mdaId: mdaJusticeId,
    });

    const officerToken = signAccessToken({
      userId: officerUserId,
      email: 'officer@test.com',
      role: 'mda_officer',
      mdaId: mdaJusticeId,
      mustChangePassword: false,
    });

    const res = await request(app)
      .get(`/api/staff/${encodeURIComponent('JUSTICE:ANYONE')}/trace`)
      .set('Authorization', `Bearer ${officerToken}`);

    expect(res.status).toBe(403);
  });

  it('PDF endpoint returns application/pdf with correct filename', async () => {
    await db.insert(migrationRecords).values({
      id: generateUuidv7(), uploadId: uploadJusticeId, mdaId: mdaJusticeId,
      sheetName: 'S1', rowNumber: 2, era: 3, staffName: 'PDF TEST',
      principal: '200000', totalLoan: '226660', monthlyDeduction: '3778',
      outstandingBalance: '200000',
      sourceFile: 'justice.xlsx', sourceSheet: 'S1', sourceRow: 2,
      periodYear: 2020, periodMonth: 1,
      varianceCategory: 'clean', hasRateVariance: false,
    });

    const personKey = 'JUSTICE:PDF TEST';
    const res = await request(app)
      .get(`/api/staff/${encodeURIComponent(personKey)}/trace/pdf`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="vlprs-trace-pdf-test-.*\.pdf"/);
  });

  it('generatedBy shows user name not email (H2 code review fix)', async () => {
    await db.insert(migrationRecords).values({
      id: generateUuidv7(), uploadId: uploadJusticeId, mdaId: mdaJusticeId,
      sheetName: 'S1', rowNumber: 2, era: 3, staffName: 'NAME CHECK',
      principal: '100000', totalLoan: '113330', monthlyDeduction: '1889',
      outstandingBalance: '100000',
      sourceFile: 'test.xlsx', sourceSheet: 'S1', sourceRow: 2,
      periodYear: 2020, periodMonth: 1,
      varianceCategory: 'clean', hasRateVariance: false,
    });

    const personKey = 'JUSTICE:NAME CHECK';
    const res = await request(app)
      .get(`/api/staff/${encodeURIComponent(personKey)}/trace`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    // Should show the user's actual name from DB, not the email
    expect(res.body.data.metadata.generatedBy.name).toBe('Trace Admin');
    expect(res.body.data.metadata.generatedBy.role).toBe('super_admin');
  });
});
