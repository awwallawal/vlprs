import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { sql, eq } from 'drizzle-orm';
import app from '../app';
import { db } from '../db/index';
import { users, mdas, migrationUploads, migrationRecords } from '../db/schema';
import { signAccessToken } from '../lib/jwt';
import { generateUuidv7 } from '../lib/uuidv7';
import { resetRateLimiters } from '../middleware/rateLimiter';
import { resetDb } from '../test/resetDb';

let testMdaId: string;
let testUserId: string;
let deptAdminId: string;
let adminToken: string;
let deptAdminToken: string;
let uploadId: string;

beforeAll(async () => {
  await resetDb();

  // Create test MDA
  testMdaId = generateUuidv7();
  await db.insert(mdas).values({
    id: testMdaId,
    name: 'Migration Validation Test MDA',
    code: 'MVT',
    abbreviation: 'MV Test',
  });

  // Create super_admin user
  testUserId = generateUuidv7();
  await db.insert(users).values({
    id: testUserId,
    email: 'mv-admin@test.com',
    hashedPassword: 'hashed',
    firstName: 'MV',
    lastName: 'Admin',
    role: 'super_admin',
  });

  // Create dept_admin user scoped to MDA
  deptAdminId = generateUuidv7();
  await db.insert(users).values({
    id: deptAdminId,
    email: 'mv-dept@test.com',
    hashedPassword: 'hashed',
    firstName: 'MV',
    lastName: 'DeptAdmin',
    role: 'dept_admin',
    mdaId: testMdaId,
  });

  adminToken = signAccessToken({
    userId: testUserId,
    email: 'mv-admin@test.com',
    role: 'super_admin',
    mdaId: null,
    mustChangePassword: false,
  });

  deptAdminToken = signAccessToken({
    userId: deptAdminId,
    email: 'mv-dept@test.com',
    role: 'dept_admin',
    mdaId: testMdaId,
    mustChangePassword: false,
  });
});

beforeEach(async () => {
  resetRateLimiters();
  await db.execute(sql`TRUNCATE migration_records, migration_extra_fields, migration_uploads, audit_log CASCADE`);

  // Create a completed upload with test records
  uploadId = generateUuidv7();
  await db.insert(migrationUploads).values({
    id: uploadId,
    mdaId: testMdaId,
    uploadedBy: testUserId,
    filename: 'test-validation.xlsx',
    fileSizeBytes: 1024,
    sheetCount: 1,
    totalRecords: 3,
    status: 'completed',
  });

  // Record 1: Clean — 250K / 13.33% / 60mo
  await db.insert(migrationRecords).values({
    id: generateUuidv7(),
    uploadId,
    mdaId: testMdaId,
    sheetName: 'Sheet1',
    rowNumber: 2,
    era: 3,
    staffName: 'CLEAN RECORD',
    principal: '250000.00',
    totalLoan: '283325.00',
    monthlyDeduction: '4722.09',
    installmentCount: 60,
    sourceFile: 'test-validation.xlsx',
    sourceSheet: 'Sheet1',
    sourceRow: 2,
  });

  // Record 2: Rate variance — 8% rate (known tier)
  await db.insert(migrationRecords).values({
    id: generateUuidv7(),
    uploadId,
    mdaId: testMdaId,
    sheetName: 'Sheet1',
    rowNumber: 3,
    era: 3,
    staffName: 'RATE VARIANCE RECORD',
    principal: '450000.00',
    totalLoan: '486000.00',
    monthlyDeduction: '8100.00',
    installmentCount: 60,
    sourceFile: 'test-validation.xlsx',
    sourceSheet: 'Sheet1',
    sourceRow: 3,
  });

  // Record 3: No financial data — anomalous
  await db.insert(migrationRecords).values({
    id: generateUuidv7(),
    uploadId,
    mdaId: testMdaId,
    sheetName: 'Sheet1',
    rowNumber: 4,
    era: 1,
    staffName: 'ANOMALOUS RECORD',
    sourceFile: 'test-validation.xlsx',
    sourceSheet: 'Sheet1',
    sourceRow: 4,
  });
});

afterAll(async () => {
  await resetDb();
});

describe('Migration Validation Integration Tests', () => {
  describe('POST /api/migrations/:id/validate', () => {
    it('validates an upload and returns summary with correct totals', async () => {
      const res = await request(app)
        .post(`/api/migrations/${uploadId}/validate`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const summary = res.body.data;
      expect(summary).toHaveProperty('clean');
      expect(summary).toHaveProperty('minorVariance');
      expect(summary).toHaveProperty('significantVariance');
      expect(summary).toHaveProperty('structuralError');
      expect(summary).toHaveProperty('anomalous');
      expect(summary).toHaveProperty('rateVarianceCount');

      // Total should equal our 3 test records
      const total = summary.clean + summary.minorVariance + summary.significantVariance
        + summary.structuralError + summary.anomalous;
      expect(total).toBe(3);

      // At least 1 anomalous (no-data record)
      expect(summary.anomalous).toBeGreaterThanOrEqual(1);

      // Rate variance record should be counted
      expect(summary.rateVarianceCount).toBeGreaterThanOrEqual(1);
    });

    it('advances upload status to validated', async () => {
      await request(app)
        .post(`/api/migrations/${uploadId}/validate`)
        .set('Authorization', `Bearer ${adminToken}`);

      const [upload] = await db
        .select()
        .from(migrationUploads)
        .where(eq(migrationUploads.id, uploadId));

      expect(upload.status).toBe('validated');
      expect(upload.validationSummary).toBeTruthy();
    });

    it('rejects validation for already-validated upload', async () => {
      await request(app)
        .post(`/api/migrations/${uploadId}/validate`)
        .set('Authorization', `Bearer ${adminToken}`);

      const res = await request(app)
        .post(`/api/migrations/${uploadId}/validate`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });

    it('rejects validation for non-completed upload', async () => {
      const pendingUploadId = generateUuidv7();
      await db.insert(migrationUploads).values({
        id: pendingUploadId,
        mdaId: testMdaId,
        uploadedBy: testUserId,
        filename: 'pending.xlsx',
        fileSizeBytes: 1024,
        sheetCount: 1,
        totalRecords: 0,
        status: 'uploaded',
      });

      const res = await request(app)
        .post(`/api/migrations/${pendingUploadId}/validate`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });

    it('returns 401 without authentication', async () => {
      const res = await request(app)
        .post(`/api/migrations/${uploadId}/validate`);

      expect(res.status).toBe(401);
    });

    it('allows dept_admin access with MDA scope', async () => {
      const res = await request(app)
        .post(`/api/migrations/${uploadId}/validate`)
        .set('Authorization', `Bearer ${deptAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/migrations/:id/validation', () => {
    it('returns validation results with summary, records, multiMda, and pagination', async () => {
      await request(app)
        .post(`/api/migrations/${uploadId}/validate`)
        .set('Authorization', `Bearer ${adminToken}`);

      const res = await request(app)
        .get(`/api/migrations/${uploadId}/validation`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const data = res.body.data;
      expect(data.summary).toBeTruthy();
      expect(data.records).toBeInstanceOf(Array);
      expect(data.records.length).toBe(3);
      expect(data.multiMda).toBeTruthy();
      expect(data.pagination).toBeTruthy();
      expect(data.pagination.total).toBe(3);
    });

    it('returns record details with declared and computed values', async () => {
      await request(app)
        .post(`/api/migrations/${uploadId}/validate`)
        .set('Authorization', `Bearer ${adminToken}`);

      const res = await request(app)
        .get(`/api/migrations/${uploadId}/validation?sortBy=source_row&sortOrder=asc`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      for (const record of res.body.data.records) {
        expect(record).toHaveProperty('recordId');
        expect(record).toHaveProperty('staffName');
        expect(record).toHaveProperty('varianceCategory');
        expect(record).toHaveProperty('declaredValues');
        expect(record).toHaveProperty('computedValues');
      }
    });

    it('supports filtering by category', async () => {
      await request(app)
        .post(`/api/migrations/${uploadId}/validate`)
        .set('Authorization', `Bearer ${adminToken}`);

      const res = await request(app)
        .get(`/api/migrations/${uploadId}/validation?category=anomalous`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.records.length).toBeGreaterThanOrEqual(1);
      for (const record of res.body.data.records) {
        expect(record.varianceCategory).toBe('anomalous');
      }
    });

    it('supports pagination', async () => {
      await request(app)
        .post(`/api/migrations/${uploadId}/validate`)
        .set('Authorization', `Bearer ${adminToken}`);

      const res = await request(app)
        .get(`/api/migrations/${uploadId}/validation?limit=2&page=1`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.records.length).toBeLessThanOrEqual(2);
      expect(res.body.data.pagination.limit).toBe(2);
      expect(res.body.data.pagination.totalPages).toBe(2);
    });

    it('validates query schema — rejects limit > 100', async () => {
      const res = await request(app)
        .get(`/api/migrations/${uploadId}/validation?limit=999`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });

    it('returns 401 without authentication', async () => {
      const res = await request(app)
        .get(`/api/migrations/${uploadId}/validation`);

      expect(res.status).toBe(401);
    });
  });
});
