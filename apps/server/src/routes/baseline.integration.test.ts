import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { sql, eq } from 'drizzle-orm';
import Decimal from 'decimal.js';
import app from '../app';
import { db } from '../db/index';
import {
  users,
  mdas,
  loans,
  ledgerEntries,
  loanStateTransitions,
  migrationUploads,
  migrationRecords,
} from '../db/schema';
import { signAccessToken } from '../lib/jwt';
import { generateUuidv7 } from '../lib/uuidv7';
import { resetRateLimiters } from '../middleware/rateLimiter';

// ─── Test fixture IDs ────────────────────────────────────────────────
let testMdaId: string;
let testUserId: string;
let adminToken: string;
let uploadId: string;
let record1Id: string;
let record2Id: string;
let record3Id: string;

// Financial constants for test records
const PRINCIPAL = '500000.00';
const RATE = '13.330';
const TOTAL_LOAN = new Decimal(PRINCIPAL)
  .mul(new Decimal('1').plus(new Decimal(RATE).div(100)))
  .toFixed(2); // 566650.00
const OUTSTANDING_1 = '150000.00';
const OUTSTANDING_2 = '200000.00';
const BASELINE_1 = new Decimal(TOTAL_LOAN).minus(new Decimal(OUTSTANDING_1)).toFixed(2); // 416650.00
const _BASELINE_2 = new Decimal(TOTAL_LOAN).minus(new Decimal(OUTSTANDING_2)).toFixed(2); // 366650.00

beforeAll(async () => {
  resetRateLimiters();

  // Clean all relevant tables
  await db.execute(
    sql`TRUNCATE migration_records, migration_uploads, loan_state_transitions, ledger_entries, loans, audit_log, refresh_tokens, users, mdas CASCADE`,
  );

  // Create test MDA
  testMdaId = generateUuidv7();
  await db.insert(mdas).values({
    id: testMdaId,
    name: 'Baseline Integration MDA',
    code: 'BINT',
    abbreviation: 'Baseline Int',
  });

  // Create test admin user
  testUserId = generateUuidv7();
  await db.insert(users).values({
    id: testUserId,
    email: 'baseline-admin@test.com',
    hashedPassword: 'hashed',
    firstName: 'Baseline',
    lastName: 'Admin',
    role: 'super_admin',
  });

  adminToken = signAccessToken({
    userId: testUserId,
    email: 'baseline-admin@test.com',
    role: 'super_admin',
    mdaId: null,
    mustChangePassword: false,
  });

  // Create migration upload in 'validated' status
  uploadId = generateUuidv7();
  await db.insert(migrationUploads).values({
    id: uploadId,
    mdaId: testMdaId,
    uploadedBy: testUserId,
    filename: 'baseline-test.xlsx',
    fileSizeBytes: 1024,
    sheetCount: 1,
    totalRecords: 3,
    status: 'validated',
  });

  // Create 3 migration records with financial data
  record1Id = generateUuidv7();
  record2Id = generateUuidv7();
  record3Id = generateUuidv7();

  const baseRecord = {
    uploadId,
    mdaId: testMdaId,
    sheetName: 'Sheet1',
    era: 2023,
    periodYear: 2025,
    periodMonth: 6,
    principal: PRINCIPAL,
    totalLoan: TOTAL_LOAN,
    monthlyDeduction: '9444.17',
    installmentCount: 60,
    computedRate: RATE,
    varianceCategory: 'clean' as const,
    varianceAmount: '0.00',
    hasRateVariance: false,
    sourceFile: 'baseline-test.xlsx',
    sourceSheet: 'Sheet1',
  };

  await db.insert(migrationRecords).values([
    {
      ...baseRecord,
      id: record1Id,
      rowNumber: 2,
      staffName: 'Abubakar Ibrahim',
      employeeNo: 'EMP-001',
      outstandingBalance: OUTSTANDING_1,
      sourceRow: 2,
    },
    {
      ...baseRecord,
      id: record2Id,
      rowNumber: 3,
      staffName: 'Fatima Yusuf',
      employeeNo: 'EMP-002',
      outstandingBalance: OUTSTANDING_2,
      varianceCategory: 'minor_variance' as const,
      varianceAmount: '2500.00',
      sourceRow: 3,
    },
    {
      ...baseRecord,
      id: record3Id,
      rowNumber: 4,
      staffName: 'Oluwaseun Adeyemi',
      outstandingBalance: '100000.00',
      sourceRow: 4,
    },
  ]);
});

afterAll(async () => {
  await db.execute(
    sql`TRUNCATE migration_records, migration_uploads, loan_state_transitions, ledger_entries, loans, audit_log, refresh_tokens, users, mdas CASCADE`,
  );
});

describe('Baseline Integration Tests (Story 3.4 AC 7)', () => {
  describe('POST /api/migrations/:uploadId/records/:recordId/baseline — Single record baseline', () => {
    it('creates loan + ledger entry + state transition atomically', async () => {
      const res = await request(app)
        .post(`/api/migrations/${uploadId}/records/${record1Id}/baseline`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ confirm: true });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const data = res.body.data;
      expect(data.loanId).toBeTruthy();
      expect(data.loanReference).toMatch(/^VLC-MIG-\d{4}-\d{4,}$/);
      expect(data.ledgerEntryId).toBeTruthy();
      expect(data.varianceCategory).toBe('clean');
      expect(data.baselineAmount).toBe(BASELINE_1);

      // Verify loan created in DB with correct fields
      const [loan] = await db
        .select()
        .from(loans)
        .where(eq(loans.id, data.loanId));

      expect(loan).toBeTruthy();
      expect(loan.status).toBe('ACTIVE');
      expect(loan.gradeLevel).toBe('MIGRATION');
      expect(loan.staffId).toBe('EMP-001');
      expect(loan.staffName).toBe('Abubakar Ibrahim');
      expect(loan.mdaId).toBe(testMdaId);
      expect(loan.principalAmount).toBe(PRINCIPAL);
      expect(loan.interestRate).toBe(RATE);

      // Verify ledger entry created with correct type and amount
      const [entry] = await db
        .select()
        .from(ledgerEntries)
        .where(eq(ledgerEntries.loanId, data.loanId));

      expect(entry).toBeTruthy();
      expect(entry.entryType).toBe('MIGRATION_BASELINE');
      expect(entry.amount).toBe(BASELINE_1);
      expect(entry.source).toContain('Migration baseline');
      expect(entry.source).toContain('Clean');
      expect(entry.payrollBatchReference).toBe(uploadId);
      expect(entry.postedBy).toBe(testUserId);

      // Verify state transition audit trail
      const [transition] = await db
        .select()
        .from(loanStateTransitions)
        .where(eq(loanStateTransitions.loanId, data.loanId));

      expect(transition).toBeTruthy();
      expect(transition.fromStatus).toBe('APPLIED');
      expect(transition.toStatus).toBe('ACTIVE');
      expect(transition.reason).toContain('Migration baseline');

      // Verify migration record linked to loan
      const [record] = await db
        .select()
        .from(migrationRecords)
        .where(eq(migrationRecords.id, record1Id));

      expect(record.loanId).toBe(data.loanId);
      expect(record.isBaselineCreated).toBe(true);
    });

    it('records variance metadata on ledger entry source', async () => {
      // Record 2 has minor_variance with ₦2,500 variance
      const res = await request(app)
        .post(`/api/migrations/${uploadId}/records/${record2Id}/baseline`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ confirm: true });

      expect(res.status).toBe(201);

      const [entry] = await db
        .select()
        .from(ledgerEntries)
        .where(eq(ledgerEntries.loanId, res.body.data.loanId));

      expect(entry.source).toContain('Minor Variance');
      expect(entry.source).toContain('2,500.00');
      expect(entry.source).toContain('200,000.00');
      expect(entry.source).toContain(uploadId);
    });

    it('generates staffId when employeeNo is absent', async () => {
      // Record 3 has no employeeNo
      const res = await request(app)
        .post(`/api/migrations/${uploadId}/records/${record3Id}/baseline`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ confirm: true });

      expect(res.status).toBe(201);

      const [loan] = await db
        .select()
        .from(loans)
        .where(eq(loans.id, res.body.data.loanId));

      expect(loan.staffId).toMatch(/^MIG-[a-f0-9]{8}-\d{4}$/);
    });

    it('advances upload to reconciled when all records baselined', async () => {
      // All 3 records now have baselines — upload should be reconciled
      const [upload] = await db
        .select()
        .from(migrationUploads)
        .where(eq(migrationUploads.id, uploadId));

      expect(upload.status).toBe('reconciled');
    });

    it('rejects duplicate baseline for same record (idempotency guard)', async () => {
      const res = await request(app)
        .post(`/api/migrations/${uploadId}/records/${record1Id}/baseline`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ confirm: true });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('BASELINE_ALREADY_EXISTS');
    });

    it('balance computation from baseline entry yields declared outstanding', async () => {
      // Verify the mathematical invariant: totalLoan - baselineAmount = declaredOutstanding
      const [record] = await db
        .select()
        .from(migrationRecords)
        .where(eq(migrationRecords.id, record1Id));

      const [entry] = await db
        .select()
        .from(ledgerEntries)
        .where(eq(ledgerEntries.loanId, record.loanId!));

      const [loan] = await db
        .select()
        .from(loans)
        .where(eq(loans.id, record.loanId!));

      const totalLoan = new Decimal(loan.principalAmount)
        .mul(new Decimal('1').plus(new Decimal(loan.interestRate).div(100)));

      const balance = totalLoan.minus(new Decimal(entry.amount));
      expect(balance.toFixed(2)).toBe(OUTSTANDING_1);
    });
  });

  describe('POST /api/migrations/:uploadId/baseline — Batch baseline', () => {
    let batchUploadId: string;
    let batchRecord1Id: string;
    let batchRecord2Id: string;

    beforeAll(async () => {
      resetRateLimiters();

      // Create a separate upload for batch testing
      batchUploadId = generateUuidv7();
      await db.insert(migrationUploads).values({
        id: batchUploadId,
        mdaId: testMdaId,
        uploadedBy: testUserId,
        filename: 'batch-test.xlsx',
        fileSizeBytes: 2048,
        sheetCount: 1,
        totalRecords: 2,
        status: 'validated',
      });

      batchRecord1Id = generateUuidv7();
      batchRecord2Id = generateUuidv7();

      const baseRecord = {
        uploadId: batchUploadId,
        mdaId: testMdaId,
        sheetName: 'Sheet1',
        era: 2023,
        periodYear: 2025,
        periodMonth: 6,
        principal: PRINCIPAL,
        totalLoan: TOTAL_LOAN,
        monthlyDeduction: '9444.17',
        installmentCount: 60,
        computedRate: RATE,
        varianceCategory: 'clean' as const,
        varianceAmount: '0.00',
        hasRateVariance: false,
        sourceFile: 'batch-test.xlsx',
        sourceSheet: 'Sheet1',
      };

      await db.insert(migrationRecords).values([
        {
          ...baseRecord,
          id: batchRecord1Id,
          rowNumber: 2,
          staffName: 'Batch Staff One',
          employeeNo: 'BATCH-001',
          outstandingBalance: '150000.00',
          sourceRow: 2,
        },
        {
          ...baseRecord,
          id: batchRecord2Id,
          rowNumber: 3,
          staffName: 'Batch Staff Two',
          employeeNo: 'BATCH-002',
          outstandingBalance: '200000.00',
          varianceCategory: 'significant_variance' as const,
          varianceAmount: '5000.00',
          sourceRow: 3,
        },
      ]);
    });

    it('creates all loans atomically with unique references', async () => {
      const res = await request(app)
        .post(`/api/migrations/${batchUploadId}/baseline`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ confirm: true });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const data = res.body.data;
      expect(data.totalProcessed).toBe(2);
      expect(data.loansCreated).toBe(2);
      expect(data.entriesCreated).toBe(2);
      expect(data.processingTimeMs).toBeGreaterThan(0);
      expect(data.byCategory).toEqual({
        clean: 1,
        significant_variance: 1,
      });

      // Verify both loans exist with unique references
      const batchLoans = await db
        .select()
        .from(loans)
        .where(
          sql`${loans.loanReference} LIKE 'VLC-MIG-%' AND ${loans.mdaId} = ${testMdaId} AND ${loans.staffId} IN ('BATCH-001', 'BATCH-002')`,
        );

      expect(batchLoans).toHaveLength(2);
      const refs = batchLoans.map((l) => l.loanReference);
      expect(new Set(refs).size).toBe(2); // Unique references

      // Verify both records linked
      const records = await db
        .select()
        .from(migrationRecords)
        .where(eq(migrationRecords.uploadId, batchUploadId));

      for (const rec of records) {
        expect(rec.isBaselineCreated).toBe(true);
        expect(rec.loanId).toBeTruthy();
      }
    });

    it('advances upload to reconciled after batch', async () => {
      const [upload] = await db
        .select()
        .from(migrationUploads)
        .where(eq(migrationUploads.id, batchUploadId));

      expect(upload.status).toBe('reconciled');
    });

    it('returns empty result when all records already baselined', async () => {
      resetRateLimiters();

      const res = await request(app)
        .post(`/api/migrations/${batchUploadId}/baseline`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ confirm: true });

      expect(res.status).toBe(201);
      expect(res.body.data.totalProcessed).toBe(0);
      expect(res.body.data.loansCreated).toBe(0);
    });
  });

  describe('Batch baseline rejects records missing outstanding balance', () => {
    let failUploadId: string;

    beforeAll(async () => {
      resetRateLimiters();

      failUploadId = generateUuidv7();
      await db.insert(migrationUploads).values({
        id: failUploadId,
        mdaId: testMdaId,
        uploadedBy: testUserId,
        filename: 'fail-test.xlsx',
        fileSizeBytes: 512,
        sheetCount: 1,
        totalRecords: 1,
        status: 'validated',
      });

      await db.insert(migrationRecords).values({
        id: generateUuidv7(),
        uploadId: failUploadId,
        mdaId: testMdaId,
        sheetName: 'Sheet1',
        rowNumber: 2,
        era: 2023,
        staffName: 'No Balance Staff',
        principal: PRINCIPAL,
        totalLoan: TOTAL_LOAN,
        outstandingBalance: null,
        varianceCategory: 'anomalous',
        hasRateVariance: false,
        sourceFile: 'fail-test.xlsx',
        sourceSheet: 'Sheet1',
        sourceRow: 2,
      });
    });

    it('returns 400 when record has null outstandingBalance', async () => {
      const res = await request(app)
        .post(`/api/migrations/${failUploadId}/baseline`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ confirm: true });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BASELINE_MISSING_BALANCE');
    });
  });

  describe('GET /api/migrations/:uploadId/baseline-summary', () => {
    it('returns correct baseline summary', async () => {
      resetRateLimiters();

      const res = await request(app)
        .get(`/api/migrations/${uploadId}/baseline-summary`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const summary = res.body.data;
      expect(summary.uploadId).toBe(uploadId);
      expect(summary.totalRecords).toBe(3);
      expect(summary.baselinesCreated).toBe(3);
      expect(summary.baselinesRemaining).toBe(0);
      expect(summary.status).toBe('complete');
      expect(summary.byCategory).toHaveProperty('clean');
    });
  });

  describe('Authorization and validation', () => {
    it('returns 401 without auth token', async () => {
      const res = await request(app)
        .post(`/api/migrations/${uploadId}/records/${record1Id}/baseline`)
        .send({ confirm: true });

      expect(res.status).toBe(401);
    });

    it('returns 400 without confirm: true', async () => {
      resetRateLimiters();

      const res = await request(app)
        .post(`/api/migrations/${uploadId}/records/${record1Id}/baseline`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('returns 404 for non-existent upload', async () => {
      resetRateLimiters();

      const res = await request(app)
        .post(`/api/migrations/${generateUuidv7()}/records/${record1Id}/baseline`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ confirm: true });

      expect(res.status).toBe(404);
    });
  });
});
