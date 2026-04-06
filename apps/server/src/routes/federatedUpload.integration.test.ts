/**
 * Federated Upload Integration Tests (Story 15.0f)
 *
 * Tests MDA officer upload with pending_verification status,
 * admin approve/reject workflows, and MDA scope enforcement.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import app from '../app';
import { db } from '../db/index';
import { users, mdas, migrationUploads } from '../db/schema';
import { signAccessToken } from '../lib/jwt';
import { generateUuidv7 } from '../lib/uuidv7';
import { resetRateLimiters } from '../middleware/rateLimiter';
import { resetDb } from '../test/resetDb';

// ─── Test fixture IDs ────────────────────────────────────────────────
let mda1Id: string;
let mda2Id: string;
let adminUserId: string;
let officerUserId: string;
let adminToken: string;
let officerToken: string;

// Upload IDs
let pendingUploadId: string;
let pendingUploadId2: string;

beforeAll(async () => {
  resetRateLimiters();
  await resetDb();

  mda1Id = generateUuidv7();
  mda2Id = generateUuidv7();

  await db.insert(mdas).values([
    { id: mda1Id, name: 'Education', code: 'EDU', abbreviation: 'EDU' },
    { id: mda2Id, name: 'Health', code: 'HEA', abbreviation: 'HEA' },
  ]);

  adminUserId = generateUuidv7();
  officerUserId = generateUuidv7();

  await db.insert(users).values([
    {
      id: adminUserId,
      email: 'fed-admin@test.com',
      hashedPassword: 'hashed',
      firstName: 'Fed',
      lastName: 'Admin',
      role: 'super_admin',
    },
    {
      id: officerUserId,
      email: 'fed-officer@test.com',
      hashedPassword: 'hashed',
      firstName: 'Fed',
      lastName: 'Officer',
      role: 'mda_officer',
      mdaId: mda1Id,
    },
  ]);

  adminToken = signAccessToken({
    userId: adminUserId,
    email: 'fed-admin@test.com',
    role: 'super_admin',
    mdaId: null,
    mustChangePassword: false,
  });

  officerToken = signAccessToken({
    userId: officerUserId,
    email: 'fed-officer@test.com',
    role: 'mda_officer',
    mdaId: mda1Id,
    mustChangePassword: false,
  });

  // Create pending_verification uploads for approve/reject tests
  pendingUploadId = generateUuidv7();
  pendingUploadId2 = generateUuidv7();

  const baseUpload = {
    mdaId: mda1Id,
    uploadedBy: officerUserId,
    fileSizeBytes: 1024,
    sheetCount: 1,
    totalRecords: 10,
    uploadSource: 'mda_officer',
  };

  await db.insert(migrationUploads).values([
    { ...baseUpload, id: pendingUploadId, filename: 'officer-upload-1.xlsx', status: 'pending_verification' as const },
    { ...baseUpload, id: pendingUploadId2, filename: 'officer-upload-2.xlsx', status: 'pending_verification' as const },
  ]);
});

afterAll(async () => {
  await resetDb();
});

describe('Federated Upload — Story 15.0f', () => {
  // ─── Upload source attribution ─────────────────────────────────────

  describe('Upload source attribution', () => {
    it('records uploadSource as mda_officer for MDA officer uploads', async () => {
      const [upload] = await db.select()
        .from(migrationUploads)
        .where(eq(migrationUploads.id, pendingUploadId));

      expect(upload.uploadSource).toBe('mda_officer');
      expect(upload.status).toBe('pending_verification');
    });
  });

  // ─── MDA scope enforcement ─────────────────────────────────────────

  describe('MDA scope enforcement', () => {
    it('MDA officer can list uploads scoped to their MDA', async () => {
      const res = await request(app)
        .get('/api/migrations')
        .set('Authorization', `Bearer ${officerToken}`);

      expect(res.status).toBe(200);
      // All returned uploads should be for the officer's MDA
      for (const upload of res.body.data) {
        expect(upload.mdaId).toBe(mda1Id);
      }
    });

    it('MDA officer can view their own upload detail', async () => {
      const res = await request(app)
        .get(`/api/migrations/${pendingUploadId}`)
        .set('Authorization', `Bearer ${officerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(pendingUploadId);
    });
  });

  // ─── Admin approve workflow ────────────────────────────────────────

  describe('Admin approve upload', () => {
    it('admin can approve a pending_verification upload → validated', async () => {
      const res = await request(app)
        .patch(`/api/migrations/${pendingUploadId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('validated');

      // Verify in DB
      const [upload] = await db.select()
        .from(migrationUploads)
        .where(eq(migrationUploads.id, pendingUploadId));
      expect(upload.status).toBe('validated');

      const meta = upload.metadata as Record<string, unknown>;
      expect(meta.approvedBy).toBe(adminUserId);
      expect(meta.approvedAt).toBeTruthy();
    });

    it('cannot approve an already-approved upload', async () => {
      const res = await request(app)
        .patch(`/api/migrations/${pendingUploadId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_STATUS');
    });

    it('MDA officer cannot approve uploads (403)', async () => {
      const res = await request(app)
        .patch(`/api/migrations/${pendingUploadId2}/approve`)
        .set('Authorization', `Bearer ${officerToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ─── Admin reject workflow ─────────────────────────────────────────

  describe('Admin reject upload', () => {
    it('admin can reject a pending_verification upload with reason', async () => {
      const res = await request(app)
        .patch(`/api/migrations/${pendingUploadId2}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Data quality issues — many records have missing staff names. Please re-upload with corrected data.' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('rejected');
      expect(res.body.data.reason).toContain('Data quality issues');

      // Verify in DB
      const [upload] = await db.select()
        .from(migrationUploads)
        .where(eq(migrationUploads.id, pendingUploadId2));
      expect(upload.status).toBe('rejected');

      const meta = upload.metadata as Record<string, unknown>;
      expect(meta.rejectedBy).toBe(adminUserId);
      expect(meta.rejectedAt).toBeTruthy();
      expect(meta.rejectionReason).toContain('Data quality issues');
    });

    it('reject requires reason of at least 10 characters', async () => {
      // Create a fresh pending upload for this test
      const freshId = generateUuidv7();
      await db.insert(migrationUploads).values({
        id: freshId,
        mdaId: mda1Id,
        uploadedBy: officerUserId,
        filename: 'fresh.xlsx',
        fileSizeBytes: 1024,
        sheetCount: 1,
        totalRecords: 5,
        status: 'pending_verification' as const,
        uploadSource: 'mda_officer',
      });

      const res = await request(app)
        .patch(`/api/migrations/${freshId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'bad' });

      expect(res.status).toBe(400);
    });

    it('MDA officer cannot reject uploads (403)', async () => {
      const res = await request(app)
        .patch(`/api/migrations/${pendingUploadId2}/reject`)
        .set('Authorization', `Bearer ${officerToken}`)
        .send({ reason: 'This should not work for officers' });

      expect(res.status).toBe(403);
    });
  });

  // ─── Upload list includes new fields ───────────────────────────────

  describe('Upload list includes uploadSource and metadata', () => {
    it('returns uploadSource and metadata in list response', async () => {
      const res = await request(app)
        .get('/api/migrations')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const uploads = res.body.data;
      expect(uploads.length).toBeGreaterThan(0);

      // All uploads should have uploadSource field
      for (const upload of uploads) {
        expect(upload.uploadSource).toBeDefined();
        expect(['admin', 'mda_officer']).toContain(upload.uploadSource);
      }
    });
  });
});
