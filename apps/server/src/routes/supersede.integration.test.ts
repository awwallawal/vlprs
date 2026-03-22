/**
 * Integration tests for POST /api/migrations/:uploadId/supersede
 *
 * Story 7.0g — Task 11.2
 * Tests the full HTTP path: auth → validation → service → DB cascade → response.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { sql, eq } from 'drizzle-orm';
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

beforeAll(async () => {
  await resetDb();

  // Create two MDAs
  testMdaId = generateUuidv7();
  otherMdaId = generateUuidv7();
  await db.insert(mdas).values([
    { id: testMdaId, name: 'Supersede Test MDA', code: 'STMDA', abbreviation: 'ST MDA' },
    { id: otherMdaId, name: 'Other MDA', code: 'OTMDA', abbreviation: 'Other' },
  ]);

  // Create users
  superAdminId = generateUuidv7();
  deptAdminId = generateUuidv7();
  mdaOfficerId = generateUuidv7();
  await db.insert(users).values([
    {
      id: superAdminId,
      email: 'ss-admin@test.com',
      hashedPassword: 'hashed',
      firstName: 'SS',
      lastName: 'Admin',
      role: 'super_admin',
    },
    {
      id: deptAdminId,
      email: 'ss-dept@test.com',
      hashedPassword: 'hashed',
      firstName: 'SS',
      lastName: 'DeptAdmin',
      role: 'dept_admin',
      mdaId: testMdaId,
    },
    {
      id: mdaOfficerId,
      email: 'ss-officer@test.com',
      hashedPassword: 'hashed',
      firstName: 'SS',
      lastName: 'Officer',
      role: 'mda_officer',
      mdaId: testMdaId,
    },
  ]);

  superAdminToken = signAccessToken({
    userId: superAdminId,
    email: 'ss-admin@test.com',
    role: 'super_admin',
    mdaId: null,
    mustChangePassword: false,
  });

  deptAdminToken = signAccessToken({
    userId: deptAdminId,
    email: 'ss-dept@test.com',
    role: 'dept_admin',
    mdaId: testMdaId,
    mustChangePassword: false,
  });

  officerToken = signAccessToken({
    userId: mdaOfficerId,
    email: 'ss-officer@test.com',
    role: 'mda_officer',
    mdaId: testMdaId,
    mustChangePassword: false,
  });
});

beforeEach(async () => {
  resetRateLimiters();
  // Clean up uploads, records, annotations, audit log between tests
  await db.execute(
    sql`TRUNCATE baseline_annotations, migration_records, migration_extra_fields, migration_uploads, observations, audit_log CASCADE`,
  );

  // Create old upload (to be superseded)
  oldUploadId = generateUuidv7();
  await db.insert(migrationUploads).values({
    id: oldUploadId,
    mdaId: testMdaId,
    uploadedBy: superAdminId,
    filename: 'old-data-2025.xlsx',
    fileSizeBytes: 2048,
    sheetCount: 1,
    totalRecords: 2,
    status: 'completed',
  });

  // Create new (replacement) upload
  newUploadId = generateUuidv7();
  await db.insert(migrationUploads).values({
    id: newUploadId,
    mdaId: testMdaId,
    uploadedBy: superAdminId,
    filename: 'corrected-data-2025.xlsx',
    fileSizeBytes: 3072,
    sheetCount: 1,
    totalRecords: 3,
    status: 'completed',
  });

  // Create migration records for the old upload
  await db.insert(migrationRecords).values([
    {
      id: generateUuidv7(),
      uploadId: oldUploadId,
      mdaId: testMdaId,
      sheetName: 'Sheet1',
      rowNumber: 2,
      era: 3,
      staffName: 'STAFF A',
      sourceFile: 'old-data-2025.xlsx',
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
      staffName: 'STAFF B',
      sourceFile: 'old-data-2025.xlsx',
      sourceSheet: 'Sheet1',
      sourceRow: 3,
    },
  ]);
});

afterAll(async () => {
  await resetDb();
});

describe('POST /api/migrations/:uploadId/supersede', () => {
  it('supersedes an upload and cascades record status (200)', async () => {
    const res = await request(app)
      .post(`/api/migrations/${oldUploadId}/supersede`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        replacementUploadId: newUploadId,
        reason: 'MDA sent corrected file with updated records',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    expect(data.supersededUploadId).toBe(oldUploadId);
    expect(data.replacementUploadId).toBe(newUploadId);
    expect(data.recordsSuperseded).toBe(2);
    expect(data.baselinesAnnotated).toBe(0); // no baselines created yet

    // Verify upload is marked superseded in DB
    const [upload] = await db
      .select({
        supersededBy: migrationUploads.supersededBy,
        supersededReason: migrationUploads.supersededReason,
      })
      .from(migrationUploads)
      .where(eq(migrationUploads.id, oldUploadId));

    expect(upload.supersededBy).toBe(newUploadId);
    expect(upload.supersededReason).toBe('MDA sent corrected file with updated records');

    // Verify records are marked superseded
    const records = await db
      .select({ recordStatus: migrationRecords.recordStatus })
      .from(migrationRecords)
      .where(eq(migrationRecords.uploadId, oldUploadId));

    expect(records).toHaveLength(2);
    for (const r of records) {
      expect(r.recordStatus).toBe('superseded');
    }
  });

  it('dept_admin can supersede uploads within their MDA scope (200)', async () => {
    const res = await request(app)
      .post(`/api/migrations/${oldUploadId}/supersede`)
      .set('Authorization', `Bearer ${deptAdminToken}`)
      .send({
        replacementUploadId: newUploadId,
        reason: 'Re-uploading with corrections from MDA officer',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.recordsSuperseded).toBe(2);
  });

  it('rejects mda_officer role with 403', async () => {
    const res = await request(app)
      .post(`/api/migrations/${oldUploadId}/supersede`)
      .set('Authorization', `Bearer ${officerToken}`)
      .send({
        replacementUploadId: newUploadId,
        reason: 'Officer should not be able to supersede',
      });

    expect(res.status).toBe(403);
  });

  it('rejects unauthenticated request with 401', async () => {
    const res = await request(app)
      .post(`/api/migrations/${oldUploadId}/supersede`)
      .send({
        replacementUploadId: newUploadId,
        reason: 'No auth token provided',
      });

    expect(res.status).toBe(401);
  });

  it('rejects reason shorter than 10 chars with 400', async () => {
    const res = await request(app)
      .post(`/api/migrations/${oldUploadId}/supersede`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        replacementUploadId: newUploadId,
        reason: 'short',
      });

    expect(res.status).toBe(400);
  });

  it('rejects already-superseded upload with 400', async () => {
    // First supersede succeeds
    await request(app)
      .post(`/api/migrations/${oldUploadId}/supersede`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        replacementUploadId: newUploadId,
        reason: 'First supersede — this should succeed fine',
      });

    // Second attempt on same upload should fail
    const thirdUploadId = generateUuidv7();
    await db.insert(migrationUploads).values({
      id: thirdUploadId,
      mdaId: testMdaId,
      uploadedBy: superAdminId,
      filename: 'third-upload.xlsx',
      fileSizeBytes: 1024,
      sheetCount: 1,
      totalRecords: 1,
      status: 'completed',
    });

    const res = await request(app)
      .post(`/api/migrations/${oldUploadId}/supersede`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        replacementUploadId: thirdUploadId,
        reason: 'Trying to supersede an already-superseded upload',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('ALREADY_SUPERSEDED');
  });

  it('rejects MDA mismatch with 400', async () => {
    // Create upload in a different MDA
    const otherUploadId = generateUuidv7();
    await db.insert(migrationUploads).values({
      id: otherUploadId,
      mdaId: otherMdaId,
      uploadedBy: superAdminId,
      filename: 'other-mda-upload.xlsx',
      fileSizeBytes: 1024,
      sheetCount: 1,
      totalRecords: 1,
      status: 'completed',
    });

    const res = await request(app)
      .post(`/api/migrations/${oldUploadId}/supersede`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        replacementUploadId: otherUploadId,
        reason: 'Mismatched MDA — should be rejected by service',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MDA_MISMATCH');
  });

  it('rejects non-existent upload with 404', async () => {
    const fakeId = generateUuidv7();
    const res = await request(app)
      .post(`/api/migrations/${fakeId}/supersede`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        replacementUploadId: newUploadId,
        reason: 'This upload does not exist in the database',
      });

    expect(res.status).toBe(404);
  });
});
