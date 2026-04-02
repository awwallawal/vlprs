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

    it('returns all three vectors with scheme expected values computed from authoritative formula', async () => {
      await request(app)
        .post(`/api/migrations/${uploadId}/validate`)
        .set('Authorization', `Bearer ${adminToken}`);

      const res = await request(app)
        .get(`/api/migrations/${uploadId}/validation?sortBy=source_row&sortOrder=asc`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const records = res.body.data.records;
      expect(records.length).toBe(3);

      // Every record must have all three vector objects + apparentRate
      for (const record of records) {
        expect(record).toHaveProperty('declaredValues');
        expect(record).toHaveProperty('computedValues');
        expect(record).toHaveProperty('schemeExpectedValues');
        expect(record).toHaveProperty('apparentRate');
        // Shape check: keys exist (values may be null for anomalous records)
        expect(record.schemeExpectedValues).toHaveProperty('totalLoan');
        expect(record.schemeExpectedValues).toHaveProperty('monthlyDeduction');
        expect(record.schemeExpectedValues).toHaveProperty('totalInterest');
      }

      // Record 1 (CLEAN): 250K / 60mo → scheme expected via installmentCount
      // P × 13.33% ÷ 60: monthlyInterest = 555.42, totalInterest = 33325.20, totalLoan = 283325.20
      const clean = records.find((r: any) => r.staffName === 'CLEAN RECORD');
      expect(clean.schemeExpectedValues.totalLoan).toBe('283325.20');
      expect(clean.schemeExpectedValues.totalInterest).toBe('33325.20');
      expect(clean.schemeExpectedValues.monthlyDeduction).toBe('4722.09');
      // apparentRate: 13.33% computed rate → 60mo tier → 13.33
      expect(clean.apparentRate).toBe('13.33');

      // Record 2 (RATE VARIANCE): 450K / 60mo (installmentCount) → scheme expected with tenure 60
      // monthlyInterest = 999.75, totalInterest = 59985.00, totalLoan = 509985.00
      const rateVar = records.find((r: any) => r.staffName === 'RATE VARIANCE RECORD');
      expect(rateVar.schemeExpectedValues.totalLoan).toBe('509985.00');
      expect(rateVar.schemeExpectedValues.totalInterest).toBe('59985.00');
      // apparentRate: 8.00% computed rate → 36mo tier → 8.00
      expect(rateVar.apparentRate).toBe('8.00');

      // Record 3 (ANOMALOUS): no principal → scheme expected all null, apparentRate null
      const anomalous = records.find((r: any) => r.staffName === 'ANOMALOUS RECORD');
      expect(anomalous.schemeExpectedValues.totalLoan).toBeNull();
      expect(anomalous.schemeExpectedValues.monthlyDeduction).toBeNull();
      expect(anomalous.schemeExpectedValues.totalInterest).toBeNull();
      expect(anomalous.apparentRate).toBeNull();
    });

    it('populates schemeExpectedValues via rate-inferred tenure when installmentCount is absent', async () => {
      // Insert record with NO installmentCount but a known 36-month rate (≈8%)
      await db.insert(migrationRecords).values({
        id: generateUuidv7(),
        uploadId,
        mdaId: testMdaId,
        sheetName: 'Sheet1',
        rowNumber: 5,
        era: 3,
        staffName: 'RATE INFERRED RECORD',
        principal: '300000.00',
        totalLoan: '324000.00', // interest = 24000, rate = 8.00% → 36mo tier
        monthlyDeduction: '9000.00',
        sourceFile: 'test-validation.xlsx',
        sourceSheet: 'Sheet1',
        sourceRow: 5,
      });

      await request(app)
        .post(`/api/migrations/${uploadId}/validate`)
        .set('Authorization', `Bearer ${adminToken}`);

      const res = await request(app)
        .get(`/api/migrations/${uploadId}/validation?sortBy=source_row&sortOrder=asc`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const record = res.body.data.records.find((r: any) => r.staffName === 'RATE INFERRED RECORD');
      expect(record).toBeTruthy();

      // Scheme expected computed via rate-inferred tenure (36mo):
      // monthlyInterest = 300000 × 0.1333 / 60 = 666.50
      // totalInterest = 666.50 × 36 = 23994.00
      // totalLoan = 300000 + 23994.00 = 323994.00
      expect(record.schemeExpectedValues.totalLoan).toBe('323994.00');
      expect(record.schemeExpectedValues.totalInterest).toBe('23994.00');
      expect(record.schemeExpectedValues.monthlyDeduction).not.toBeNull();
      expect(record.apparentRate).toBe('8.00');
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

  describe('GET /api/migrations/:uploadId/records/:recordId — Record Detail (Story 8.0b)', () => {
    it('returns full record detail with all three vectors', async () => {
      // Validate first to populate computed fields
      await request(app)
        .post(`/api/migrations/${uploadId}/validate`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Get a record ID from validation results
      const valRes = await request(app)
        .get(`/api/migrations/${uploadId}/validation?sortBy=source_row&sortOrder=asc`)
        .set('Authorization', `Bearer ${adminToken}`);

      const cleanRecord = valRes.body.data.records.find((r: any) => r.staffName === 'CLEAN RECORD');
      expect(cleanRecord).toBeTruthy();

      // GET record detail
      const res = await request(app)
        .get(`/api/migrations/${uploadId}/records/${cleanRecord.recordId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const detail = res.body.data;

      // Personnel info
      expect(detail.recordId).toBe(cleanRecord.recordId);
      expect(detail.uploadId).toBe(uploadId);
      expect(detail.staffName).toBe('CLEAN RECORD');
      expect(detail.sheetName).toBe('Sheet1');
      expect(detail.sourceRow).toBe(2);
      expect(detail.era).toBe(3);

      // Variance metadata
      expect(detail.varianceCategory).toBeTruthy();
      expect(detail).toHaveProperty('varianceAmount');
      expect(detail).toHaveProperty('computedRate');
      expect(detail).toHaveProperty('apparentRate');
      expect(detail).toHaveProperty('hasRateVariance');

      // Three-vector financial comparison
      expect(detail.declaredValues).toEqual({
        principal: '250000.00',
        totalLoan: '283325.00',
        monthlyDeduction: '4722.09',
        outstandingBalance: null,
        interestTotal: null,
        installmentCount: 60,
        installmentsPaid: null,
        installmentsOutstanding: null,
      });

      expect(detail.computedValues).toHaveProperty('totalLoan');
      expect(detail.computedValues).toHaveProperty('monthlyDeduction');
      expect(detail.computedValues).toHaveProperty('outstandingBalance');

      // Scheme expected values (250K / 60mo)
      expect(detail.schemeExpectedValues.totalLoan).toBe('283325.20');
      expect(detail.schemeExpectedValues.monthlyDeduction).toBe('4722.09');
      expect(detail.schemeExpectedValues.totalInterest).toBe('33325.20');

      // Apparent rate
      expect(detail.apparentRate).toBe('13.33');

      // Baseline status
      expect(detail.isBaselineCreated).toBe(false);
      expect(detail.loanId).toBeNull();

      // Correction fields (null before correction columns added)
      expect(detail.correctedValues).toBeNull();
      expect(detail.originalValuesSnapshot).toBeNull();
      expect(detail.correctedBy).toBeNull();
      expect(detail.correctedAt).toBeNull();
    });

    it('returns 404 for non-existent record', async () => {
      const fakeRecordId = generateUuidv7();
      const res = await request(app)
        .get(`/api/migrations/${uploadId}/records/${fakeRecordId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('returns 404 for non-existent upload', async () => {
      const fakeUploadId = generateUuidv7();
      const fakeRecordId = generateUuidv7();
      const res = await request(app)
        .get(`/api/migrations/${fakeUploadId}/records/${fakeRecordId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('respects MDA scope for dept_admin', async () => {
      await request(app)
        .post(`/api/migrations/${uploadId}/validate`)
        .set('Authorization', `Bearer ${adminToken}`);

      const valRes = await request(app)
        .get(`/api/migrations/${uploadId}/validation?sortBy=source_row&sortOrder=asc`)
        .set('Authorization', `Bearer ${deptAdminToken}`);

      const record = valRes.body.data.records[0];

      // dept_admin scoped to the same MDA should have access
      const res = await request(app)
        .get(`/api/migrations/${uploadId}/records/${record.recordId}`)
        .set('Authorization', `Bearer ${deptAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.staffName).toBeTruthy();
    });

    it('returns 401 without authentication', async () => {
      const res = await request(app)
        .get(`/api/migrations/${uploadId}/records/${generateUuidv7()}`);

      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /api/migrations/:uploadId/records/:recordId/correct — Record Correction (Story 8.0b)', () => {
    async function validateAndGetRecord(staffName: string) {
      await request(app)
        .post(`/api/migrations/${uploadId}/validate`)
        .set('Authorization', `Bearer ${adminToken}`);

      const valRes = await request(app)
        .get(`/api/migrations/${uploadId}/validation?sortBy=source_row&sortOrder=asc`)
        .set('Authorization', `Bearer ${adminToken}`);

      return valRes.body.data.records.find((r: any) => r.staffName === staffName);
    }

    it('persists correction and preserves original snapshot on first correction', async () => {
      const record = await validateAndGetRecord('CLEAN RECORD');

      const res = await request(app)
        .patch(`/api/migrations/${uploadId}/records/${record.recordId}/correct`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ outstandingBalance: '150000.00' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const detail = res.body.data;
      expect(detail.correctedValues).not.toBeNull();
      expect(detail.correctedValues.outstandingBalance).toBe('150000.00');
      expect(detail.correctedBy).toBe(testUserId);
      expect(detail.correctedAt).toBeTruthy();

      // Original snapshot should be preserved
      expect(detail.originalValuesSnapshot).not.toBeNull();
      expect(detail.originalValuesSnapshot.outstandingBalance).toBeNull(); // was null before correction
      expect(detail.originalValuesSnapshot).toHaveProperty('varianceCategory');
      expect(detail.originalValuesSnapshot).toHaveProperty('varianceAmount');
    });

    it('rejects correction on already-baselined record (409 Conflict)', async () => {
      // Insert a record WITH outstandingBalance so baseline can succeed
      const baselinableRecordId = generateUuidv7();
      await db.insert(migrationRecords).values({
        id: baselinableRecordId,
        uploadId,
        mdaId: testMdaId,
        sheetName: 'Sheet1',
        rowNumber: 10,
        era: 3,
        staffName: 'BASELINABLE RECORD',
        principal: '250000.00',
        totalLoan: '283325.00',
        monthlyDeduction: '4722.09',
        outstandingBalance: '150000.00',
        installmentCount: 60,
        sourceFile: 'test-validation.xlsx',
        sourceSheet: 'Sheet1',
        sourceRow: 10,
      });

      // Validate to populate computed fields
      await request(app)
        .post(`/api/migrations/${uploadId}/validate`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Establish baseline
      const baselineRes = await request(app)
        .post(`/api/migrations/${uploadId}/records/${baselinableRecordId}/baseline`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ confirm: true });

      expect(baselineRes.status).toBe(201);

      // Try to correct after baseline — should be rejected
      const res = await request(app)
        .patch(`/api/migrations/${uploadId}/records/${baselinableRecordId}/correct`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ outstandingBalance: '100000.00' });

      expect(res.status).toBe(409);
    });

    it('re-correction updates corrected values but does NOT overwrite original snapshot', async () => {
      const record = await validateAndGetRecord('CLEAN RECORD');

      // First correction
      await request(app)
        .patch(`/api/migrations/${uploadId}/records/${record.recordId}/correct`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ outstandingBalance: '150000.00' });

      // Get snapshot from first correction
      const first = await request(app)
        .get(`/api/migrations/${uploadId}/records/${record.recordId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      const firstSnapshot = first.body.data.originalValuesSnapshot;

      // Second correction
      const res = await request(app)
        .patch(`/api/migrations/${uploadId}/records/${record.recordId}/correct`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ outstandingBalance: '200000.00' });

      expect(res.status).toBe(200);
      expect(res.body.data.correctedValues.outstandingBalance).toBe('200000.00');

      // Original snapshot should NOT change
      expect(res.body.data.originalValuesSnapshot).toEqual(firstSnapshot);
    });

    it('correcting installmentCount triggers scheme expected recomputation', async () => {
      const record = await validateAndGetRecord('CLEAN RECORD');

      // Original scheme expected computed with installmentCount=60
      const beforeRes = await request(app)
        .get(`/api/migrations/${uploadId}/records/${record.recordId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      const originalScheme = beforeRes.body.data.schemeExpectedValues;
      expect(originalScheme.totalLoan).toBe('283325.20'); // 250K / 60mo

      // Correct installmentCount to 36
      const res = await request(app)
        .patch(`/api/migrations/${uploadId}/records/${record.recordId}/correct`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ installmentCount: 36 });

      expect(res.status).toBe(200);

      // Scheme expected should be recomputed for 36 months
      // 250K / 36mo: monthlyInterest = (250000 × 0.1333) / 60 = 555.42
      // totalInterest = 555.42 × 36 = 19995.12 (actually: 19995.00 due to rounding)
      // totalLoan = 250000 + 19995.00 = 269995.00
      const newScheme = res.body.data.schemeExpectedValues;
      expect(newScheme.totalLoan).not.toBe(originalScheme.totalLoan);
      expect(newScheme.totalLoan).toBeTruthy();
    });

    it('rejects correction with empty body', async () => {
      const record = await validateAndGetRecord('CLEAN RECORD');

      const res = await request(app)
        .patch(`/api/migrations/${uploadId}/records/${record.recordId}/correct`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('returns 401 without authentication', async () => {
      const res = await request(app)
        .patch(`/api/migrations/${uploadId}/records/${generateUuidv7()}/correct`)
        .send({ outstandingBalance: '100000.00' });

      expect(res.status).toBe(401);
    });
  });
});
