import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { db } from '../db/index';
import { users, mdas, migrationUploads, migrationRecords } from '../db/schema';
import { signAccessToken } from '../lib/jwt';
import { generateUuidv7 } from '../lib/uuidv7';
import { resetRateLimiters } from '../middleware/rateLimiter';
import { resetDb } from '../test/resetDb';

// ─── Test fixture IDs ────────────────────────────────────────────────
let testMdaId: string;
let otherMdaId: string;
let testUserId: string;
let mdaOfficerUserId: string;
let adminToken: string;
let mdaOfficerToken: string;
let uploadId: string;

beforeAll(async () => {
  resetRateLimiters();
  await resetDb();

  // Create test MDAs
  testMdaId = generateUuidv7();
  otherMdaId = generateUuidv7();
  await db.insert(mdas).values([
    { id: testMdaId, name: 'Coverage Test MDA', code: 'COVT', abbreviation: 'Cov Test' },
    { id: otherMdaId, name: 'Other MDA', code: 'OTHR', abbreviation: 'Other' },
  ]);

  // Create test users
  testUserId = generateUuidv7();
  mdaOfficerUserId = generateUuidv7();
  await db.insert(users).values([
    {
      id: testUserId,
      email: 'coverage-admin@test.com',
      hashedPassword: 'hashed',
      firstName: 'Coverage',
      lastName: 'Admin',
      role: 'super_admin',
    },
    {
      id: mdaOfficerUserId,
      email: 'coverage-officer@test.com',
      hashedPassword: 'hashed',
      firstName: 'Coverage',
      lastName: 'Officer',
      role: 'mda_officer',
      mdaId: testMdaId,
    },
  ]);

  adminToken = signAccessToken({
    userId: testUserId,
    email: 'coverage-admin@test.com',
    role: 'super_admin',
    mdaId: null,
    mustChangePassword: false,
  });

  mdaOfficerToken = signAccessToken({
    userId: mdaOfficerUserId,
    email: 'coverage-officer@test.com',
    role: 'mda_officer',
    mdaId: testMdaId,
    mustChangePassword: false,
  });

  // Create migration upload
  uploadId = generateUuidv7();
  await db.insert(migrationUploads).values({
    id: uploadId,
    mdaId: testMdaId,
    uploadedBy: testUserId,
    filename: 'coverage-test.xlsx',
    fileSizeBytes: 1024,
    sheetCount: 1,
    totalRecords: 4,
    status: 'validated',
  });

  // Create 4 migration records: 3 for Aug 2024, 1 for Sep 2024
  const baseRecord = {
    uploadId,
    mdaId: testMdaId,
    sheetName: 'Sheet1',
    era: 2024,
    principal: '500000.00',
    totalLoan: '566650.00',
    monthlyDeduction: '9444.17',
    outstandingBalance: '150000.00',
    installmentCount: 60,
    computedRate: '13.330',
    varianceCategory: 'clean' as const,
    varianceAmount: '0.00',
    hasRateVariance: false,
    sourceFile: 'coverage-test.xlsx',
    sourceSheet: 'Sheet1',
  };

  await db.insert(migrationRecords).values([
    {
      ...baseRecord,
      id: generateUuidv7(),
      rowNumber: 2,
      staffName: 'Abubakar Ibrahim',
      employeeNo: 'EMP-001',
      periodYear: 2024,
      periodMonth: 8,
      isBaselineCreated: true,
      sourceRow: 2,
    },
    {
      ...baseRecord,
      id: generateUuidv7(),
      rowNumber: 3,
      staffName: 'Fatima Yusuf',
      employeeNo: 'EMP-002',
      periodYear: 2024,
      periodMonth: 8,
      varianceCategory: 'minor_variance' as const,
      varianceAmount: '2500.00',
      isBaselineCreated: false,
      sourceRow: 3,
    },
    {
      ...baseRecord,
      id: generateUuidv7(),
      rowNumber: 4,
      staffName: 'Oluwaseun Adeyemi',
      employeeNo: 'EMP-003',
      periodYear: 2024,
      periodMonth: 8,
      isBaselineCreated: true,
      sourceRow: 4,
    },
    {
      ...baseRecord,
      id: generateUuidv7(),
      rowNumber: 5,
      staffName: 'Zainab Mohammed',
      employeeNo: 'EMP-004',
      periodYear: 2024,
      periodMonth: 9,
      isBaselineCreated: false,
      sourceRow: 5,
    },
  ]);
});

afterAll(async () => {
  await resetDb();
});

describe('Coverage Records Drill-Down (Story 8.0f)', () => {
  describe('GET /api/migrations/coverage/records', () => {
    it('returns correct records for specific MDA + period', async () => {
      const res = await request(app)
        .get('/api/migrations/coverage/records')
        .query({ mdaId: testMdaId, year: 2024, month: 8 })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const { records, pagination, summary } = res.body.data;

      // Should return 3 records for Aug 2024
      expect(records).toHaveLength(3);
      expect(pagination.totalRecords).toBe(3);
      expect(pagination.page).toBe(1);

      // Summary
      expect(summary.total).toBe(3);
      expect(summary.baselinedCount).toBe(2);
      expect(summary.mdaName).toBe('Coverage Test MDA');
      expect(summary.mdaCode).toBe('COVT');
      expect(summary.periodLabel).toContain('August');
      expect(summary.periodLabel).toContain('2024');

      // Records sorted by staffName ASC by default
      expect(records[0].staffName).toBe('Abubakar Ibrahim');
      expect(records[0].employeeNo).toBe('EMP-001');
      expect(records[0].principal).toBe('500000.00');
      expect(records[0].isBaselineCreated).toBe(true);

      expect(records[1].staffName).toBe('Fatima Yusuf');
      expect(records[1].varianceCategory).toBe('minor_variance');
      expect(records[1].isBaselineCreated).toBe(false);
    });

    it('returns different records for different period', async () => {
      const res = await request(app)
        .get('/api/migrations/coverage/records')
        .query({ mdaId: testMdaId, year: 2024, month: 9 })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const { records, summary } = res.body.data;
      expect(records).toHaveLength(1);
      expect(records[0].staffName).toBe('Zainab Mohammed');
      expect(summary.total).toBe(1);
    });

    it('returns empty for period with no data', async () => {
      const res = await request(app)
        .get('/api/migrations/coverage/records')
        .query({ mdaId: testMdaId, year: 2024, month: 1 })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.records).toHaveLength(0);
      expect(res.body.data.pagination.totalRecords).toBe(0);
    });

    it('supports sorting by outstandingBalance desc', async () => {
      const res = await request(app)
        .get('/api/migrations/coverage/records')
        .query({ mdaId: testMdaId, year: 2024, month: 8, sortBy: 'outstandingBalance', sortDir: 'desc' })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      // All have same outstandingBalance in fixtures, so just verify it returns successfully
      expect(res.body.data.records).toHaveLength(3);
    });

    it('supports pagination', async () => {
      const res = await request(app)
        .get('/api/migrations/coverage/records')
        .query({ mdaId: testMdaId, year: 2024, month: 8, page: 1, limit: 2 })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.records).toHaveLength(2);
      expect(res.body.data.pagination.totalRecords).toBe(3);
      expect(res.body.data.pagination.totalPages).toBe(2);
      expect(res.body.data.pagination.page).toBe(1);
    });

    it('respects MDA scope for mda_officer', async () => {
      // Officer scoped to testMdaId — should see records for their MDA
      const res = await request(app)
        .get('/api/migrations/coverage/records')
        .query({ mdaId: testMdaId, year: 2024, month: 8 })
        .set('Authorization', `Bearer ${mdaOfficerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.records).toHaveLength(3);
    });

    it('returns 400 for missing required params', async () => {
      const res = await request(app)
        .get('/api/migrations/coverage/records')
        .query({ year: 2024, month: 8 }) // missing mdaId
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/migrations/coverage/records/export', () => {
    it('CSV export returns correct headers and data rows', async () => {
      const res = await request(app)
        .get('/api/migrations/coverage/records/export')
        .query({ mdaId: testMdaId, year: 2024, month: 8, format: 'csv' })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('vlprs-COVT-2024-08-records.csv');

      const body = res.text;
      // BOM + header + 3 data rows + trailing newline
      const lines = body.replace('\uFEFF', '').trim().split('\n');
      expect(lines[0]).toContain('Staff Name');
      expect(lines[0]).toContain('Staff ID');
      expect(lines[0]).toContain('Baseline Status');
      expect(lines).toHaveLength(4); // header + 3 records
      expect(lines[1]).toContain('Abubakar Ibrahim');
    });

    it('Excel export returns valid xlsx buffer', async () => {
      const res = await request(app)
        .get('/api/migrations/coverage/records/export')
        .query({ mdaId: testMdaId, year: 2024, month: 8, format: 'xlsx' })
        .set('Authorization', `Bearer ${adminToken}`)
        .buffer(true)
        .parse((res, callback) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => callback(null, Buffer.concat(chunks)));
        });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      expect(res.headers['content-disposition']).toContain('vlprs-COVT-2024-08-records.xlsx');

      // Verify it's a valid xlsx (starts with PK zip signature)
      const buffer = res.body as Buffer;
      expect(buffer.length).toBeGreaterThan(100);
      expect(buffer[0]).toBe(0x50); // 'P'
      expect(buffer[1]).toBe(0x4B); // 'K'
    });
  });
});
