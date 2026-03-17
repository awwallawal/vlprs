import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { resetDb } from '../test/resetDb';
import { db } from '../db/index';
import {
  users,
  mdas,
  migrationUploads,
  migrationRecords,
} from '../db/schema';
import { signAccessToken } from '../lib/jwt';
import { generateUuidv7 } from '../lib/uuidv7';
import { hashPassword } from '../lib/password';
import { resetRateLimiters } from '../middleware/rateLimiter';

/**
 * Story 11.0b: Migration Coverage Tracker
 *
 * Integration tests for GET /api/migrations/coverage
 * - Returns correct matrix shape (MDA rows x month columns)
 * - ?extended=true includes 2017/2018 periods
 * - MDA_OFFICER scoping returns only own MDA
 * - DEPT_ADMIN/SUPER_ADMIN see all MDAs
 */

// ─── Fixtures ─────────────────────────────────────────────────────────

let adminToken: string;
let deptAdminToken: string;
let officerToken: string;

const adminUserId = generateUuidv7();
const deptAdminUserId = generateUuidv7();
const officerUserId = generateUuidv7();

const mda1Id = generateUuidv7(); // Education — has records in 2024-01, 2024-02, 2024-03
const mda2Id = generateUuidv7(); // Health — has records in 2024-01, 2018-06
const mda3Id = generateUuidv7(); // Agriculture — no records (gap MDA)

const upload1Id = generateUuidv7();
const upload2Id = generateUuidv7();

// ─── Setup ────────────────────────────────────────────────────────────

beforeAll(async () => {
  resetRateLimiters();
  await resetDb();

  // Create MDAs
  await db.insert(mdas).values([
    { id: mda1Id, name: 'Education', code: 'EDU', abbreviation: 'EDU', isActive: true },
    { id: mda2Id, name: 'Health', code: 'HEA', abbreviation: 'HEA', isActive: true },
    { id: mda3Id, name: 'Agriculture', code: 'AGR', abbreviation: 'AGR', isActive: true },
  ]);

  // Create users
  const hashed = await hashPassword('Password1!');
  await db.insert(users).values([
    {
      id: adminUserId,
      email: 'admin-cov-test@vlprs.test',
      hashedPassword: hashed,
      role: 'super_admin',
      firstName: 'Admin',
      lastName: 'CovTest',
      mustChangePassword: false,
      isActive: true,
    },
    {
      id: deptAdminUserId,
      email: 'deptadmin-cov-test@vlprs.test',
      hashedPassword: hashed,
      role: 'dept_admin',
      firstName: 'DeptAdmin',
      lastName: 'CovTest',
      mustChangePassword: false,
      isActive: true,
    },
    {
      id: officerUserId,
      email: 'officer-cov-test@vlprs.test',
      hashedPassword: hashed,
      role: 'mda_officer',
      firstName: 'Officer',
      lastName: 'CovTest',
      mdaId: mda1Id,
      mustChangePassword: false,
      isActive: true,
    },
  ]);

  adminToken = signAccessToken({
    userId: adminUserId,
    email: 'admin-cov-test@vlprs.test',
    role: 'super_admin',
    mdaId: null,
    mustChangePassword: false,
  });

  deptAdminToken = signAccessToken({
    userId: deptAdminUserId,
    email: 'deptadmin-cov-test@vlprs.test',
    role: 'dept_admin',
    mdaId: null,
    mustChangePassword: false,
  });

  officerToken = signAccessToken({
    userId: officerUserId,
    email: 'officer-cov-test@vlprs.test',
    role: 'mda_officer',
    mdaId: mda1Id,
    mustChangePassword: false,
  });

  // Create uploads
  await db.insert(migrationUploads).values([
    {
      id: upload1Id,
      mdaId: mda1Id,
      filename: 'edu-coverage.xlsx',
      fileSizeBytes: 5000,
      uploadedBy: adminUserId,
      status: 'validated',
    },
    {
      id: upload2Id,
      mdaId: mda2Id,
      filename: 'hea-coverage.xlsx',
      fileSizeBytes: 4000,
      uploadedBy: adminUserId,
      status: 'completed',
    },
  ]);

  // Create migration records with specific period data
  // Education: 3 records in 2024-01, 1 baselined; 2 in 2024-02, both baselined; 1 in 2024-03, not baselined
  await db.insert(migrationRecords).values([
    // Education 2024-01 (3 records, 1 baselined)
    {
      id: generateUuidv7(),
      uploadId: upload1Id,
      mdaId: mda1Id,
      sheetName: 'Sheet1',
      rowNumber: 1,
      era: 2024,
      periodYear: 2024,
      periodMonth: 1,
      sourceFile: 'edu-coverage.xlsx',
      sourceSheet: 'Sheet1',
      sourceRow: 1,
      staffName: 'Staff A',
      varianceCategory: 'clean',
      isBaselineCreated: true,
    },
    {
      id: generateUuidv7(),
      uploadId: upload1Id,
      mdaId: mda1Id,
      sheetName: 'Sheet1',
      rowNumber: 2,
      era: 2024,
      periodYear: 2024,
      periodMonth: 1,
      sourceFile: 'edu-coverage.xlsx',
      sourceSheet: 'Sheet1',
      sourceRow: 2,
      staffName: 'Staff B',
      varianceCategory: 'clean',
      isBaselineCreated: false,
    },
    {
      id: generateUuidv7(),
      uploadId: upload1Id,
      mdaId: mda1Id,
      sheetName: 'Sheet1',
      rowNumber: 3,
      era: 2024,
      periodYear: 2024,
      periodMonth: 1,
      sourceFile: 'edu-coverage.xlsx',
      sourceSheet: 'Sheet1',
      sourceRow: 3,
      staffName: 'Staff C',
      varianceCategory: 'minor_variance',
      isBaselineCreated: false,
    },
    // Education 2024-02 (2 records, both baselined)
    {
      id: generateUuidv7(),
      uploadId: upload1Id,
      mdaId: mda1Id,
      sheetName: 'Sheet1',
      rowNumber: 4,
      era: 2024,
      periodYear: 2024,
      periodMonth: 2,
      sourceFile: 'edu-coverage.xlsx',
      sourceSheet: 'Sheet1',
      sourceRow: 4,
      staffName: 'Staff A',
      varianceCategory: 'clean',
      isBaselineCreated: true,
    },
    {
      id: generateUuidv7(),
      uploadId: upload1Id,
      mdaId: mda1Id,
      sheetName: 'Sheet1',
      rowNumber: 5,
      era: 2024,
      periodYear: 2024,
      periodMonth: 2,
      sourceFile: 'edu-coverage.xlsx',
      sourceSheet: 'Sheet1',
      sourceRow: 5,
      staffName: 'Staff B',
      varianceCategory: 'clean',
      isBaselineCreated: true,
    },
    // Education 2024-03 (1 record, not baselined)
    {
      id: generateUuidv7(),
      uploadId: upload1Id,
      mdaId: mda1Id,
      sheetName: 'Sheet1',
      rowNumber: 6,
      era: 2024,
      periodYear: 2024,
      periodMonth: 3,
      sourceFile: 'edu-coverage.xlsx',
      sourceSheet: 'Sheet1',
      sourceRow: 6,
      staffName: 'Staff D',
      varianceCategory: 'clean',
      isBaselineCreated: false,
    },
    // Health 2024-01 (1 record, baselined)
    {
      id: generateUuidv7(),
      uploadId: upload2Id,
      mdaId: mda2Id,
      sheetName: 'Sheet1',
      rowNumber: 1,
      era: 2024,
      periodYear: 2024,
      periodMonth: 1,
      sourceFile: 'hea-coverage.xlsx',
      sourceSheet: 'Sheet1',
      sourceRow: 1,
      staffName: 'Staff E',
      varianceCategory: 'clean',
      isBaselineCreated: true,
    },
    // Health 2018-06 (1 record, not baselined — extended period)
    {
      id: generateUuidv7(),
      uploadId: upload2Id,
      mdaId: mda2Id,
      sheetName: 'Sheet1',
      rowNumber: 2,
      era: 2018,
      periodYear: 2018,
      periodMonth: 6,
      sourceFile: 'hea-coverage.xlsx',
      sourceSheet: 'Sheet1',
      sourceRow: 2,
      staffName: 'Staff F',
      varianceCategory: 'clean',
      isBaselineCreated: false,
    },
  ]);
});

beforeEach(() => {
  resetRateLimiters();
});

afterAll(async () => {
  await resetDb();
});

// ─── Coverage Matrix Tests (AC 1, 2) ─────────────────────────────────

describe('GET /api/migrations/coverage', () => {
  it('returns correct matrix shape with all MDAs', async () => {
    const res = await request(app)
      .get('/api/migrations/coverage')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const { mdas: mdaRows, periodRange } = res.body.data;
    expect(mdaRows).toBeInstanceOf(Array);
    expect(mdaRows.length).toBe(3); // All 3 MDAs

    // Verify period range (default 60-month window)
    expect(periodRange.start).toBeDefined();
    expect(periodRange.end).toBeDefined();
  });

  it('returns correct record counts per MDA per period', async () => {
    const res = await request(app)
      .get('/api/migrations/coverage')
      .set('Authorization', `Bearer ${adminToken}`);

    const { mdas: mdaRows } = res.body.data;
    const edu = mdaRows.find((m: { mdaCode: string }) => m.mdaCode === 'EDU');
    const hea = mdaRows.find((m: { mdaCode: string }) => m.mdaCode === 'HEA');
    const agr = mdaRows.find((m: { mdaCode: string }) => m.mdaCode === 'AGR');

    // Education: 3 records in 2024-01
    expect(edu.periods['2024-01'].recordCount).toBe(3);
    expect(edu.periods['2024-01'].baselinedCount).toBe(1);

    // Education: 2 records in 2024-02, both baselined
    expect(edu.periods['2024-02'].recordCount).toBe(2);
    expect(edu.periods['2024-02'].baselinedCount).toBe(2);

    // Education: 1 record in 2024-03, not baselined
    expect(edu.periods['2024-03'].recordCount).toBe(1);
    expect(edu.periods['2024-03'].baselinedCount).toBe(0);

    // Health: 1 record in 2024-01
    expect(hea.periods['2024-01'].recordCount).toBe(1);
    expect(hea.periods['2024-01'].baselinedCount).toBe(1);

    // Agriculture: no periods at all
    expect(Object.keys(agr.periods).length).toBe(0);
  });

  it('default view excludes extended periods (pre-60-month)', async () => {
    const res = await request(app)
      .get('/api/migrations/coverage')
      .set('Authorization', `Bearer ${adminToken}`);

    const { mdas: mdaRows } = res.body.data;
    const hea = mdaRows.find((m: { mdaCode: string }) => m.mdaCode === 'HEA');

    // 2018-06 should be excluded in default (60-month) view from 2026-03
    // 60 months back from 2026-03 = 2021-04
    expect(hea.periods['2018-06']).toBeUndefined();
  });

  it('extended=true includes 2017/2018 periods', async () => {
    const res = await request(app)
      .get('/api/migrations/coverage?extended=true')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const { mdas: mdaRows, periodRange } = res.body.data;
    const hea = mdaRows.find((m: { mdaCode: string }) => m.mdaCode === 'HEA');

    // 2018-06 should be included in extended view
    expect(hea.periods['2018-06']).toBeDefined();
    expect(hea.periods['2018-06'].recordCount).toBe(1);

    // Period range should start from 2017-01
    expect(periodRange.start).toBe('2017-01');
  });

  it('returns MDA metadata (id, name, code) for each row', async () => {
    const res = await request(app)
      .get('/api/migrations/coverage')
      .set('Authorization', `Bearer ${adminToken}`);

    const { mdas: mdaRows } = res.body.data;
    const edu = mdaRows.find((m: { mdaCode: string }) => m.mdaCode === 'EDU');

    expect(edu.mdaId).toBe(mda1Id);
    expect(edu.mdaName).toBe('Education');
    expect(edu.mdaCode).toBe('EDU');
  });
});

// ─── Role-Based Scoping Tests (AC 2) ─────────────────────────────────

describe('Coverage tracker role-based scoping', () => {
  it('SUPER_ADMIN sees all MDAs', async () => {
    const res = await request(app)
      .get('/api/migrations/coverage')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.mdas.length).toBe(3);
  });

  it('DEPT_ADMIN sees all MDAs', async () => {
    const res = await request(app)
      .get('/api/migrations/coverage')
      .set('Authorization', `Bearer ${deptAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.mdas.length).toBe(3);
  });

  it('MDA_OFFICER sees only their own MDA', async () => {
    const res = await request(app)
      .get('/api/migrations/coverage')
      .set('Authorization', `Bearer ${officerToken}`);

    expect(res.status).toBe(200);
    const { mdas: mdaRows } = res.body.data;
    expect(mdaRows.length).toBe(1);
    expect(mdaRows[0].mdaCode).toBe('EDU');
    expect(mdaRows[0].mdaId).toBe(mda1Id);
  });
});
