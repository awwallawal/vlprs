import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
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

// ─── Test fixture IDs ────────────────────────────────────────────────
let testMdaId: string;
let testUserId: string;
let adminToken: string;

// Upload IDs for different status scenarios
let uploadedId: string;
let mappedId: string;
let failedId: string;
let validatedId: string;
let completedId: string;
let alreadyDiscardedId: string;

beforeAll(async () => {
  resetRateLimiters();
  await resetDb();

  // Create test MDA
  testMdaId = generateUuidv7();
  await db.insert(mdas).values({
    id: testMdaId,
    name: 'Migration Discard Test MDA',
    code: 'MDIS',
    abbreviation: 'Discard Test',
  });

  // Create test admin user
  testUserId = generateUuidv7();
  await db.insert(users).values({
    id: testUserId,
    email: 'discard-admin@test.com',
    hashedPassword: 'hashed',
    firstName: 'Discard',
    lastName: 'Admin',
    role: 'super_admin',
  });

  adminToken = signAccessToken({
    userId: testUserId,
    email: 'discard-admin@test.com',
    role: 'super_admin',
    mdaId: null,
    mustChangePassword: false,
  });

  // Create uploads in various statuses
  uploadedId = generateUuidv7();
  mappedId = generateUuidv7();
  failedId = generateUuidv7();
  validatedId = generateUuidv7();
  completedId = generateUuidv7();
  alreadyDiscardedId = generateUuidv7();

  const baseUpload = {
    mdaId: testMdaId,
    uploadedBy: testUserId,
    fileSizeBytes: 1024,
    sheetCount: 1,
    totalRecords: 0,
  };

  await db.insert(migrationUploads).values([
    { ...baseUpload, id: uploadedId, filename: 'uploaded.xlsx', status: 'uploaded' as const },
    { ...baseUpload, id: mappedId, filename: 'mapped.xlsx', status: 'mapped' as const },
    { ...baseUpload, id: failedId, filename: 'failed.xlsx', status: 'failed' as const },
    { ...baseUpload, id: validatedId, filename: 'validated.xlsx', status: 'validated' as const, totalRecords: 5 },
    { ...baseUpload, id: completedId, filename: 'completed.xlsx', status: 'completed' as const, totalRecords: 3 },
    { ...baseUpload, id: alreadyDiscardedId, filename: 'discarded.xlsx', status: 'uploaded' as const, deletedAt: new Date() },
  ]);

  // Add migration records to the 'uploaded' upload so we can verify soft delete
  await db.insert(migrationRecords).values([
    {
      uploadId: uploadedId,
      mdaId: testMdaId,
      sheetName: 'Sheet1',
      rowNumber: 2,
      era: 2023,
      staffName: 'Test Staff One',
      sourceFile: 'uploaded.xlsx',
      sourceSheet: 'Sheet1',
      sourceRow: 2,
      hasRateVariance: false,
    },
    {
      uploadId: uploadedId,
      mdaId: testMdaId,
      sheetName: 'Sheet1',
      rowNumber: 3,
      era: 2023,
      staffName: 'Test Staff Two',
      sourceFile: 'uploaded.xlsx',
      sourceSheet: 'Sheet1',
      sourceRow: 3,
      hasRateVariance: false,
    },
  ]);
});

afterAll(async () => {
  await resetDb();
});

describe('Migration Discard Integration Tests (Story 8.0c)', () => {
  describe('PATCH /api/migrations/:id/discard — Discard upload', () => {
    it('discards an uploaded-status upload, sets deleted_at on upload and records', async () => {
      const res = await request(app)
        .patch(`/api/migrations/${uploadedId}/discard`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.discarded).toBe(true);
      expect(res.body.data.recordsAffected).toBe(2);

      // Verify upload has deleted_at set
      const [upload] = await db.select()
        .from(migrationUploads)
        .where(eq(migrationUploads.id, uploadedId));
      expect(upload.deletedAt).not.toBeNull();

      // Verify migration records have deleted_at set
      const records = await db.select()
        .from(migrationRecords)
        .where(eq(migrationRecords.uploadId, uploadedId));
      for (const record of records) {
        expect(record.deletedAt).not.toBeNull();
      }
    });

    it('discarded upload is excluded from list endpoint', async () => {
      resetRateLimiters();

      const res = await request(app)
        .get('/api/migrations')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const ids = res.body.data.map((u: { id: string }) => u.id);
      expect(ids).not.toContain(uploadedId);
      expect(ids).not.toContain(alreadyDiscardedId);
    });

    it('discards a mapped-status upload', async () => {
      resetRateLimiters();

      const res = await request(app)
        .patch(`/api/migrations/${mappedId}/discard`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.discarded).toBe(true);
    });

    it('discards a failed-status upload', async () => {
      resetRateLimiters();

      const res = await request(app)
        .patch(`/api/migrations/${failedId}/discard`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.discarded).toBe(true);
    });
  });

  describe('Discard rejection for non-discardable statuses (AC 3)', () => {
    it('rejects discard for validated-status upload (409)', async () => {
      resetRateLimiters();

      const res = await request(app)
        .patch(`/api/migrations/${validatedId}/discard`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('UPLOAD_CANNOT_BE_DISCARDED');
    });

    it('rejects discard for completed-status upload (409)', async () => {
      resetRateLimiters();

      const res = await request(app)
        .patch(`/api/migrations/${completedId}/discard`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('UPLOAD_CANNOT_BE_DISCARDED');
    });
  });

  describe('Discard rejection for already-discarded upload', () => {
    it('returns 404 for already-discarded upload', async () => {
      resetRateLimiters();

      const res = await request(app)
        .patch(`/api/migrations/${alreadyDiscardedId}/discard`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('Authorization', () => {
    it('returns 401 without auth token', async () => {
      const res = await request(app)
        .patch(`/api/migrations/${validatedId}/discard`);

      expect(res.status).toBe(401);
    });

    it('returns 404 for non-existent upload', async () => {
      resetRateLimiters();

      const res = await request(app)
        .patch(`/api/migrations/${generateUuidv7()}/discard`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });
});
