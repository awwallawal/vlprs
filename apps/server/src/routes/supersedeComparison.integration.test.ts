/**
 * Integration tests for GET /api/migrations/:uploadId/supersede/compare/:replacementUploadId
 *
 * Story 15.0n — Task 8
 * Read-only record-level diff between two uploads: unchanged / modified / new / removed
 * counts plus field-level diffs for modified records. Confirms the comparison uses
 * normalizeName() matching and respects MDA scope.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import app from '../app';
import { db } from '../db/index';
import {
  users,
  mdas,
  migrationUploads,
  migrationRecords,
} from '../db/schema';
import { signAccessToken } from '../lib/jwt';
import { generateUuidv7 } from '../lib/uuidv7';
import { resetRateLimiters } from '../middleware/rateLimiter';
import { resetDb } from '../test/resetDb';

let testMdaId: string;
let otherMdaId: string;
let superAdminId: string;
let deptAdminId: string;
let mdaOfficerId: string;
let superAdminToken: string;
let deptAdminToken: string;
let officerToken: string;
let oldUploadId: string;
let newUploadId: string;
let otherMdaUploadId: string;

beforeAll(async () => {
  await resetDb();

  testMdaId = generateUuidv7();
  otherMdaId = generateUuidv7();
  await db.insert(mdas).values([
    { id: testMdaId, name: 'Comparison Test MDA', code: 'CTMDA', abbreviation: 'CT MDA' },
    { id: otherMdaId, name: 'Other Comparison MDA', code: 'OCM', abbreviation: 'Other CM' },
  ]);

  superAdminId = generateUuidv7();
  deptAdminId = generateUuidv7();
  mdaOfficerId = generateUuidv7();
  await db.insert(users).values([
    {
      id: superAdminId,
      email: 'cmp-admin@test.com',
      hashedPassword: 'hashed',
      firstName: 'Cmp',
      lastName: 'Admin',
      role: 'super_admin',
    },
    {
      id: deptAdminId,
      email: 'cmp-dept@test.com',
      hashedPassword: 'hashed',
      firstName: 'Cmp',
      lastName: 'Dept',
      role: 'dept_admin',
      mdaId: testMdaId,
    },
    {
      id: mdaOfficerId,
      email: 'cmp-officer@test.com',
      hashedPassword: 'hashed',
      firstName: 'Cmp',
      lastName: 'Officer',
      role: 'mda_officer',
      mdaId: otherMdaId,
    },
  ]);

  superAdminToken = signAccessToken({
    userId: superAdminId,
    email: 'cmp-admin@test.com',
    role: 'super_admin',
    mdaId: null,
    mustChangePassword: false,
  });

  deptAdminToken = signAccessToken({
    userId: deptAdminId,
    email: 'cmp-dept@test.com',
    role: 'dept_admin',
    mdaId: testMdaId,
    mustChangePassword: false,
  });

  officerToken = signAccessToken({
    userId: mdaOfficerId,
    email: 'cmp-officer@test.com',
    role: 'mda_officer',
    mdaId: otherMdaId,
    mustChangePassword: false,
  });
});

beforeEach(async () => {
  resetRateLimiters();
  await db.execute(
    sql`TRUNCATE migration_records, migration_extra_fields, migration_uploads, audit_log CASCADE`,
  );

  oldUploadId = generateUuidv7();
  newUploadId = generateUuidv7();
  otherMdaUploadId = generateUuidv7();

  await db.insert(migrationUploads).values([
    {
      id: oldUploadId,
      mdaId: testMdaId,
      uploadedBy: superAdminId,
      filename: 'old-cmp.xlsx',
      fileSizeBytes: 2048,
      sheetCount: 1,
      totalRecords: 4,
      status: 'completed',
    },
    {
      id: newUploadId,
      mdaId: testMdaId,
      uploadedBy: superAdminId,
      filename: 'new-cmp.xlsx',
      fileSizeBytes: 2048,
      sheetCount: 1,
      totalRecords: 4,
      status: 'completed',
    },
    {
      id: otherMdaUploadId,
      mdaId: otherMdaId,
      uploadedBy: superAdminId,
      filename: 'other-mda.xlsx',
      fileSizeBytes: 1024,
      sheetCount: 1,
      totalRecords: 1,
      status: 'completed',
    },
  ]);

  // Old upload: 4 records — ALICE (unchanged), BOB (to be modified),
  // CAROL (to be removed in new), and DAVID (to be modified).
  await db.insert(migrationRecords).values([
    {
      id: generateUuidv7(),
      uploadId: oldUploadId,
      mdaId: testMdaId,
      sheetName: 'Sheet1',
      rowNumber: 2,
      era: 3,
      staffName: 'ALICE ALIU',
      employeeNo: 'EMP001',
      totalLoan: '500000.00',
      monthlyDeduction: '10000.00',
      outstandingBalance: '300000.00',
      installmentCount: 50,
      sourceFile: 'old-cmp.xlsx',
      sourceSheet: 'Sheet1',
      sourceRow: 2,
    },
    {
      id: generateUuidv7(),
      uploadId: oldUploadId,
      mdaId: testMdaId,
      sheetName: 'Sheet1',
      rowNumber: 3,
      era: 3,
      staffName: 'BOB BADMUS',
      employeeNo: 'EMP002',
      totalLoan: '400000.00',
      monthlyDeduction: '8000.00',
      outstandingBalance: '200000.00',
      sourceFile: 'old-cmp.xlsx',
      sourceSheet: 'Sheet1',
      sourceRow: 3,
    },
    {
      id: generateUuidv7(),
      uploadId: oldUploadId,
      mdaId: testMdaId,
      sheetName: 'Sheet1',
      rowNumber: 4,
      era: 3,
      staffName: 'CAROL CHUKWU',
      employeeNo: 'EMP003',
      totalLoan: '300000.00',
      monthlyDeduction: '6000.00',
      outstandingBalance: '150000.00',
      sourceFile: 'old-cmp.xlsx',
      sourceSheet: 'Sheet1',
      sourceRow: 4,
    },
    {
      id: generateUuidv7(),
      uploadId: oldUploadId,
      mdaId: testMdaId,
      sheetName: 'Sheet1',
      rowNumber: 5,
      era: 3,
      staffName: 'DAVID DADA',
      employeeNo: 'EMP004',
      totalLoan: '600000.00',
      monthlyDeduction: '12000.00',
      outstandingBalance: '480000.00',
      sourceFile: 'old-cmp.xlsx',
      sourceSheet: 'Sheet1',
      sourceRow: 5,
    },
  ]);

  // New upload: ALICE (same), BOB (new monthly deduction + balance),
  // DAVID (new balance), EDNA (brand new).
  await db.insert(migrationRecords).values([
    {
      id: generateUuidv7(),
      uploadId: newUploadId,
      mdaId: testMdaId,
      sheetName: 'Sheet1',
      rowNumber: 2,
      era: 3,
      staffName: 'ALICE ALIU',
      employeeNo: 'EMP001',
      totalLoan: '500000.00',
      monthlyDeduction: '10000.00',
      outstandingBalance: '300000.00',
      installmentCount: 50,
      sourceFile: 'new-cmp.xlsx',
      sourceSheet: 'Sheet1',
      sourceRow: 2,
    },
    {
      id: generateUuidv7(),
      uploadId: newUploadId,
      mdaId: testMdaId,
      sheetName: 'Sheet1',
      rowNumber: 3,
      era: 3,
      staffName: 'BOB BADMUS',
      employeeNo: 'EMP002',
      totalLoan: '400000.00',
      monthlyDeduction: '9500.00',
      outstandingBalance: '180000.00',
      sourceFile: 'new-cmp.xlsx',
      sourceSheet: 'Sheet1',
      sourceRow: 3,
    },
    {
      id: generateUuidv7(),
      uploadId: newUploadId,
      mdaId: testMdaId,
      sheetName: 'Sheet1',
      rowNumber: 4,
      era: 3,
      staffName: 'DAVID DADA',
      employeeNo: 'EMP004',
      totalLoan: '600000.00',
      monthlyDeduction: '12000.00',
      outstandingBalance: '450000.00',
      sourceFile: 'new-cmp.xlsx',
      sourceSheet: 'Sheet1',
      sourceRow: 4,
    },
    {
      id: generateUuidv7(),
      uploadId: newUploadId,
      mdaId: testMdaId,
      sheetName: 'Sheet1',
      rowNumber: 5,
      era: 3,
      staffName: 'EDNA EDET',
      employeeNo: 'EMP005',
      totalLoan: '700000.00',
      monthlyDeduction: '14000.00',
      outstandingBalance: '560000.00',
      sourceFile: 'new-cmp.xlsx',
      sourceSheet: 'Sheet1',
      sourceRow: 5,
    },
  ]);

  // Record in other MDA (used for scope tests)
  await db.insert(migrationRecords).values({
    id: generateUuidv7(),
    uploadId: otherMdaUploadId,
    mdaId: otherMdaId,
    sheetName: 'Sheet1',
    rowNumber: 2,
    era: 3,
    staffName: 'FRANK FOLAYAN',
    employeeNo: 'EMP099',
    sourceFile: 'other-mda.xlsx',
    sourceSheet: 'Sheet1',
    sourceRow: 2,
  });
});

afterAll(async () => {
  await resetDb();
});

describe('GET /api/migrations/:uploadId/supersede/compare/:replacementUploadId', () => {
  it('returns unchanged/modified/new/removed counts with field-level diffs (200)', async () => {
    const res = await request(app)
      .get(`/api/migrations/${oldUploadId}/supersede/compare/${newUploadId}`)
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const diff = res.body.data;
    expect(diff.unchanged).toBe(1); // ALICE
    expect(diff.modified).toBe(2);  // BOB, DAVID
    expect(diff.newRecords).toBe(1); // EDNA
    expect(diff.removed).toBe(1);   // CAROL

    // Modified details sorted alphabetically by staffName
    expect(diff.modifiedDetails).toHaveLength(2);
    const [first, second] = diff.modifiedDetails;
    expect(first.staffName).toBe('BOB BADMUS');
    expect(second.staffName).toBe('DAVID DADA');

    // New/removed detail arrays (review finding L1)
    expect(diff.newDetails).toHaveLength(1);
    expect(diff.newDetails[0].staffName).toBe('EDNA EDET');
    expect(diff.newDetails[0].staffId).toBe('EMP005');

    expect(diff.removedDetails).toHaveLength(1);
    expect(diff.removedDetails[0].staffName).toBe('CAROL CHUKWU');
    expect(diff.removedDetails[0].staffId).toBe('EMP003');

    // BOB — monthlyDeduction and outstandingBalance changed
    const bobFields = first.changes.map((c: { field: string }) => c.field).sort();
    expect(bobFields).toEqual(['monthlyDeduction', 'outstandingBalance']);
    const bobMonthly = first.changes.find((c: { field: string }) => c.field === 'monthlyDeduction');
    expect(bobMonthly.oldValue).toBe('8000.00');
    expect(bobMonthly.newValue).toBe('9500.00');

    // DAVID — only outstandingBalance changed
    const davidFields = second.changes.map((c: { field: string }) => c.field);
    expect(davidFields).toEqual(['outstandingBalance']);
    const davidBalance = second.changes[0];
    expect(davidBalance.oldValue).toBe('480000.00');
    expect(davidBalance.newValue).toBe('450000.00');
  });

  it('is read-only — record counts remain unchanged after comparison', async () => {
    await request(app)
      .get(`/api/migrations/${oldUploadId}/supersede/compare/${newUploadId}`)
      .set('Authorization', `Bearer ${superAdminToken}`);

    const oldCount = await db.execute(
      sql`SELECT COUNT(*)::int AS c FROM migration_records WHERE upload_id = ${oldUploadId}`,
    );
    const newCount = await db.execute(
      sql`SELECT COUNT(*)::int AS c FROM migration_records WHERE upload_id = ${newUploadId}`,
    );
    expect(Number((oldCount.rows[0] as { c: number }).c)).toBe(4);
    expect(Number((newCount.rows[0] as { c: number }).c)).toBe(4);
  });

  it('returns 400 when comparing the same upload against itself', async () => {
    const res = await request(app)
      .get(`/api/migrations/${oldUploadId}/supersede/compare/${oldUploadId}`)
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('SELF_COMPARE');
  });

  it('returns 404 when one of the uploads is missing', async () => {
    const ghostId = generateUuidv7();
    const res = await request(app)
      .get(`/api/migrations/${oldUploadId}/supersede/compare/${ghostId}`)
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(404);
  });

  it('rejects mda_officer role with 403', async () => {
    const res = await request(app)
      .get(`/api/migrations/${oldUploadId}/supersede/compare/${newUploadId}`)
      .set('Authorization', `Bearer ${officerToken}`);

    expect(res.status).toBe(403);
  });

  it('allows dept_admin with matching MDA scope (200)', async () => {
    const res = await request(app)
      .get(`/api/migrations/${oldUploadId}/supersede/compare/${newUploadId}`)
      .set('Authorization', `Bearer ${deptAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.unchanged).toBe(1);
  });

  it('matches records despite name casing and whitespace differences', async () => {
    // Replace new upload records with names that differ in case/whitespace
    await db.execute(
      sql`DELETE FROM migration_records WHERE upload_id = ${newUploadId}`,
    );
    await db.insert(migrationRecords).values([
      {
        id: generateUuidv7(),
        uploadId: newUploadId,
        mdaId: testMdaId,
        sheetName: 'Sheet1',
        rowNumber: 2,
        era: 3,
        staffName: '  alice  aliu  ',
        employeeNo: 'EMP001',
        totalLoan: '500000.00',
        monthlyDeduction: '10000.00',
        outstandingBalance: '300000.00',
        installmentCount: 50,
        sourceFile: 'new-cmp.xlsx',
        sourceSheet: 'Sheet1',
        sourceRow: 2,
      },
      {
        id: generateUuidv7(),
        uploadId: newUploadId,
        mdaId: testMdaId,
        sheetName: 'Sheet1',
        rowNumber: 3,
        era: 3,
        staffName: 'bob badmus',
        employeeNo: 'EMP002',
        totalLoan: '400000.00',
        monthlyDeduction: '9500.00',
        outstandingBalance: '180000.00',
        sourceFile: 'new-cmp.xlsx',
        sourceSheet: 'Sheet1',
        sourceRow: 3,
      },
    ]);

    const res = await request(app)
      .get(`/api/migrations/${oldUploadId}/supersede/compare/${newUploadId}`)
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    const diff = res.body.data;
    // ALICE matches despite extra whitespace + lowercase
    expect(diff.unchanged).toBe(1);
    // BOB matches despite lowercase — modified because monthlyDeduction changed
    expect(diff.modified).toBe(1);
    // CAROL and DAVID in old but not new → removed
    expect(diff.removed).toBe(2);
    // No new records
    expect(diff.newRecords).toBe(0);
  });

  it('rejects unauthenticated request with 401', async () => {
    const res = await request(app)
      .get(`/api/migrations/${oldUploadId}/supersede/compare/${newUploadId}`);

    expect(res.status).toBe(401);
  });
});
