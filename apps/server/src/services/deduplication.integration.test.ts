/**
 * Deduplication integration tests — Story 15.0l
 *
 * Tests:
 * - getDuplicateRecordDetail returns parent + child records (AC 2)
 * - Auto-trigger: dedup runs after validateUpload (AC 1, 4)
 * - Manual trigger still works (AC 5)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { db } from '../db/index';
import {
  users,
  mdas,
  migrationUploads,
  migrationRecords,
  deduplicationCandidates,
} from '../db/schema';
import { signAccessToken } from '../lib/jwt';
import { generateUuidv7 } from '../lib/uuidv7';
import { resetRateLimiters } from '../middleware/rateLimiter';
import { resetDb } from '../test/resetDb';

// ─── Fixture IDs ────────────────────────────────────────────────────
let parentMdaId: string;
let childMdaId: string;
let adminUserId: string;
let adminToken: string;
let uploadId: string;
let candidateId: string;

beforeAll(async () => {
  resetRateLimiters();
  await resetDb();

  // Create parent/child MDA pair
  parentMdaId = generateUuidv7();
  childMdaId = generateUuidv7();
  await db.insert(mdas).values([
    { id: parentMdaId, name: 'Board of Internal Revenue', code: 'BIR', abbreviation: 'BIR' },
    { id: childMdaId, name: 'CDU', code: 'CDU', abbreviation: 'CDU', parentMdaId },
  ]);

  // Create admin user
  adminUserId = generateUuidv7();
  await db.insert(users).values({
    id: adminUserId,
    email: 'dedup-admin@test.com',
    hashedPassword: 'hashed',
    firstName: 'Dedup',
    lastName: 'Admin',
    role: 'super_admin',
  });

  adminToken = signAccessToken({
    userId: adminUserId,
    email: 'dedup-admin@test.com',
    role: 'super_admin',
    mdaId: null,
    mustChangePassword: false,
  });

  // Create an upload for the parent MDA
  uploadId = generateUuidv7();
  await db.insert(migrationUploads).values({
    id: uploadId,
    mdaId: parentMdaId,
    uploadedBy: adminUserId,
    filename: 'BIR-test.xlsx',
    fileSizeBytes: 1024,
    sheetCount: 1,
    totalRecords: 2,
    status: 'completed',
  });

  // Insert migration records for parent MDA (shared staff name)
  const baseRecord = {
    uploadId,
    sheetName: 'Sheet1',
    era: 4,
    sourceFile: 'BIR-test.xlsx',
    sourceSheet: 'Sheet1',
  };

  await db.insert(migrationRecords).values([
    {
      ...baseRecord,
      id: generateUuidv7(),
      mdaId: parentMdaId,
      staffName: 'ADEBAYO OLUSEGUN',
      employeeNo: 'OY/BIR/023',
      gradeLevel: 'GL 12',
      principal: '500000.00',
      monthlyDeduction: '15278.00',
      outstandingBalance: '234000.00',
      periodYear: 2024,
      periodMonth: 8,
      rowNumber: 1,
      sourceRow: 1,
    },
    {
      ...baseRecord,
      id: generateUuidv7(),
      mdaId: parentMdaId,
      staffName: 'BAKARE FUNKE',
      employeeNo: 'OY/BIR/044',
      gradeLevel: 'GL 10',
      principal: '300000.00',
      monthlyDeduction: '9444.17',
      outstandingBalance: '180000.00',
      periodYear: 2024,
      periodMonth: 8,
      rowNumber: 2,
      sourceRow: 2,
    },
  ]);

  // Insert migration records for child MDA (one shared staff — ADEBAYO OLUSEGUN with different financials)
  const childUploadId = generateUuidv7();
  await db.insert(migrationUploads).values({
    id: childUploadId,
    mdaId: childMdaId,
    uploadedBy: adminUserId,
    filename: 'CDU-test.xlsx',
    fileSizeBytes: 512,
    sheetCount: 1,
    totalRecords: 1,
    status: 'completed',
  });

  await db.insert(migrationRecords).values({
    uploadId: childUploadId,
    id: generateUuidv7(),
    mdaId: childMdaId,
    staffName: 'ADEBAYO OLUSEGUN',
    employeeNo: 'OY/CDU/023',
    gradeLevel: 'GL 12',
    principal: '500000.00',
    monthlyDeduction: '12500.00', // different from parent
    outstandingBalance: '287000.00', // different from parent
    periodYear: 2024,
    periodMonth: 8,
    sheetName: 'Sheet1',
    era: 4,
    rowNumber: 1,
    sourceFile: 'CDU-test.xlsx',
    sourceSheet: 'Sheet1',
    sourceRow: 1,
  });

  // Run deduplication to create candidate for detail test
  const { detectCrossFileDuplicates } = await import('./deduplicationService');
  await detectCrossFileDuplicates();

  // Fetch the candidate ID
  const [candidate] = await db
    .select({ id: deduplicationCandidates.id })
    .from(deduplicationCandidates)
    .limit(1);
  candidateId = candidate.id;
});

afterAll(async () => {
  await resetDb();
});

// ─── Tests ──────────────────────────────────────────────────────────

describe('GET /api/migrations/duplicates/:candidateId/records', () => {
  it('returns parent and child records for side-by-side comparison', async () => {
    const res = await request(app)
      .get(`/api/migrations/duplicates/${candidateId}/records`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);

    const { candidate, parentRecords, childRecords } = res.body.data;

    // Candidate info
    expect(candidate.staffName).toBe('ADEBAYO OLUSEGUN');
    expect(candidate.parentMdaName).toBe('Board of Internal Revenue');
    expect(candidate.childMdaName).toBe('CDU');

    // Parent has 1 matching record (ADEBAYO OLUSEGUN in BIR)
    expect(parentRecords.length).toBe(1);
    expect(parentRecords[0].staffName).toBe('ADEBAYO OLUSEGUN');
    expect(parentRecords[0].monthlyDeduction).toBe('15278.00');

    // Child has 1 record (ADEBAYO OLUSEGUN in CDU with different financials)
    expect(childRecords.length).toBe(1);
    expect(childRecords[0].staffName).toBe('ADEBAYO OLUSEGUN');
    expect(childRecords[0].monthlyDeduction).toBe('12500.00');
    expect(childRecords[0].outstandingBalance).toBe('287000.00');
  });

  it('returns 404 for non-existent candidate', async () => {
    const fakeId = generateUuidv7();
    await request(app)
      .get(`/api/migrations/duplicates/${fakeId}/records`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });
});

describe('POST /api/migrations/deduplicate (manual trigger)', () => {
  it('still works and returns detected count', async () => {
    const res = await request(app)
      .post('/api/migrations/deduplicate')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('detected');
    expect(res.body.data).toHaveProperty('pairs');
    // Already detected in beforeAll, so new detections = 0 (idempotent)
    expect(res.body.data.detected).toBe(0);
    expect(res.body.data.pairs).toBeGreaterThanOrEqual(1);
  });
});

describe('Auto-trigger: validateUpload fires detectCrossFileDuplicates (AC 1)', () => {
  it('creates dedup candidates after validation completes', async () => {
    // Clear existing candidates to prove auto-trigger creates new ones
    await db.delete(deduplicationCandidates);

    // Create a fresh upload in 'completed' status (ready for validation)
    const freshUploadId = generateUuidv7();
    await db.insert(migrationUploads).values({
      id: freshUploadId,
      mdaId: parentMdaId,
      uploadedBy: adminUserId,
      filename: 'BIR-auto-trigger.xlsx',
      fileSizeBytes: 1024,
      sheetCount: 1,
      totalRecords: 1,
      status: 'completed',
    });

    // Insert a record for the upload so validation has data to process
    await db.insert(migrationRecords).values({
      id: generateUuidv7(),
      uploadId: freshUploadId,
      mdaId: parentMdaId,
      staffName: 'ADEBAYO OLUSEGUN',
      employeeNo: 'OY/BIR/023',
      principal: '500000.00',
      totalLoan: '566500.00',
      monthlyDeduction: '9441.67',
      sheetName: 'Sheet1',
      era: 4,
      rowNumber: 1,
      sourceFile: 'BIR-auto-trigger.xlsx',
      sourceSheet: 'Sheet1',
      sourceRow: 1,
    });

    // Call validateUpload — this should fire-and-forget detectCrossFileDuplicates
    const { validateUpload } = await import('./migrationValidationService');
    await validateUpload(freshUploadId);

    // Drain fire-and-forget writes (detectCrossFileDuplicates is tracked)
    const { drainFireAndForgetWrites } = await import('./fireAndForgetTracking');
    await drainFireAndForgetWrites();

    // Verify candidates were re-created by the auto-trigger
    const candidates = await db
      .select({ id: deduplicationCandidates.id })
      .from(deduplicationCandidates);

    expect(candidates.length).toBeGreaterThanOrEqual(1);
  });
});
