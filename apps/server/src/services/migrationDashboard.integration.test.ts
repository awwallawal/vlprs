import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import Decimal from 'decimal.js';
import app from '../app';
import { resetDb } from '../test/resetDb';
import { db } from '../db/index';
import {
  users,
  mdas,
  loans,
  ledgerEntries,
  migrationUploads,
  migrationRecords,
  personMatches,
} from '../db/schema';
import { signAccessToken } from '../lib/jwt';
import { generateUuidv7 } from '../lib/uuidv7';
import { hashPassword } from '../lib/password';
import { resetRateLimiters } from '../middleware/rateLimiter';

/**
 * Story 3.5: Migration Dashboard & Master Beneficiary Ledger
 *
 * Integration tests covering AC 6, AC 7, AC 8 requirements:
 * - Dashboard API (all MDAs, stage derivation)
 * - Beneficiary list (aggregation, pagination, search, sort, filter)
 * - CSV export (columns, data)
 * - MDA-scoped access
 */

// ─── Fixtures ─────────────────────────────────────────────────────────

let adminToken: string;
let officerToken: string;

const adminUserId = generateUuidv7();
const officerUserId = generateUuidv7();

const mda1Id = generateUuidv7();
const mda2Id = generateUuidv7();
const mda3Id = generateUuidv7(); // MDA with no uploads (pending)

const upload1Id = generateUuidv7();
const upload2Id = generateUuidv7();

const loan1Id = generateUuidv7();
const loan2Id = generateUuidv7();
const loan3Id = generateUuidv7();
const loan4Id = generateUuidv7();

const now = new Date();

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

  // Create admin user
  const hashed = await hashPassword('Password1!');
  await db.insert(users).values({
    id: adminUserId,
    email: 'admin-dash-test@vlprs.test',
    hashedPassword: hashed,
    role: 'super_admin',
    firstName: 'Admin',
    lastName: 'Test',
    mustChangePassword: false,
    isActive: true,
  });

  // Create MDA officer (scoped to mda1)
  await db.insert(users).values({
    id: officerUserId,
    email: 'officer-dash-test@vlprs.test',
    hashedPassword: hashed,
    role: 'mda_officer',
    firstName: 'Officer',
    lastName: 'Test',
    mdaId: mda1Id,
    mustChangePassword: false,
    isActive: true,
  });

  adminToken = signAccessToken({
    userId: adminUserId,
    email: 'admin-dash-test@vlprs.test',
    role: 'super_admin',
    mdaId: null,
    mustChangePassword: false,
  });

  officerToken = signAccessToken({
    userId: officerUserId,
    email: 'officer-dash-test@vlprs.test',
    role: 'mda_officer',
    mdaId: mda1Id,
    mustChangePassword: false,
  });

  // Create migration uploads (mda1: validated, mda2: completed, mda3: no uploads)
  await db.insert(migrationUploads).values([
    {
      id: upload1Id,
      mdaId: mda1Id,
      filename: 'edu-data.xlsx',
      fileSizeBytes: 5000,
      uploadedBy: adminUserId,
      status: 'validated',
    },
    {
      id: upload2Id,
      mdaId: mda2Id,
      filename: 'hea-data.xlsx',
      fileSizeBytes: 4000,
      uploadedBy: adminUserId,
      status: 'completed',
    },
  ]);

  // Create migration loans (must be before migration_records due to FK)
  await db.insert(loans).values([
    {
      id: loan1Id,
      mdaId: mda1Id,
      staffName: 'Adeyemi Oluwaseun',
      staffId: 'OY/EDU/0001',
      gradeLevel: 'GL-10',
      loanReference: 'VLC-MIG-2026-T00001',
      principalAmount: '100000.00',
      interestRate: '13.330',
      tenureMonths: 36,
      monthlyDeductionAmount: '3148.15',
      approvalDate: now,
      firstDeductionDate: now,
      status: 'ACTIVE',
      limitedComputation: false,
    },
    {
      id: loan2Id,
      mdaId: mda1Id,
      staffName: 'Adeyemi Oluwaseun',
      staffId: 'OY/EDU/0001',
      gradeLevel: 'GL-10',
      loanReference: 'VLC-MIG-2026-T00002',
      principalAmount: '60000.00',
      interestRate: '13.330',
      tenureMonths: 24,
      monthlyDeductionAmount: '2832.50',
      approvalDate: now,
      firstDeductionDate: now,
      status: 'ACTIVE',
      limitedComputation: false,
    },
    {
      id: loan3Id,
      mdaId: mda2Id,
      staffName: 'Bakare Ibrahim',
      staffId: 'OY/HEA/0001',
      gradeLevel: 'GL-08',
      loanReference: 'VLC-MIG-2026-T00003',
      principalAmount: '150000.00',
      interestRate: '13.330',
      tenureMonths: 48,
      monthlyDeductionAmount: '3541.88',
      approvalDate: now,
      firstDeductionDate: now,
      status: 'ACTIVE',
      limitedComputation: false,
    },
    {
      id: loan4Id,
      mdaId: mda1Id,
      staffName: 'Chukwu Ngozi',
      staffId: 'MIG-0001',
      gradeLevel: 'GL-07',
      loanReference: 'VLC-MIG-2026-T00004',
      principalAmount: '0.00',
      interestRate: '13.330',
      tenureMonths: 36,
      monthlyDeductionAmount: '0.00',
      approvalDate: now,
      firstDeductionDate: now,
      status: 'ACTIVE',
      limitedComputation: true,
    },
  ]);

  // Create migration records (after loans, due to loanId FK)
  await db.insert(migrationRecords).values([
    {
      id: generateUuidv7(),
      uploadId: upload1Id,
      mdaId: mda1Id,
      sheetName: 'Sheet1',
      rowNumber: 1,
      era: 2024,
      sourceFile: 'edu-data.xlsx',
      sourceSheet: 'Sheet1',
      sourceRow: 1,
      staffName: 'Adeyemi Oluwaseun',
      outstandingBalance: '50000.00',
      varianceCategory: 'clean',
      isBaselineCreated: true,
      loanId: loan1Id,
    },
    {
      id: generateUuidv7(),
      uploadId: upload1Id,
      mdaId: mda1Id,
      sheetName: 'Sheet1',
      rowNumber: 2,
      era: 2024,
      sourceFile: 'edu-data.xlsx',
      sourceSheet: 'Sheet1',
      sourceRow: 2,
      staffName: 'Adeyemi Oluwaseun',
      outstandingBalance: '30000.00',
      varianceCategory: 'minor_variance',
      isBaselineCreated: true,
      loanId: loan2Id,
    },
    {
      id: generateUuidv7(),
      uploadId: upload2Id,
      mdaId: mda2Id,
      sheetName: 'Sheet1',
      rowNumber: 1,
      era: 2024,
      sourceFile: 'hea-data.xlsx',
      sourceSheet: 'Sheet1',
      sourceRow: 1,
      staffName: 'Bakare Ibrahim',
      outstandingBalance: '75000.00',
      varianceCategory: 'significant_variance',
      isBaselineCreated: true,
      loanId: loan3Id,
    },
    {
      id: generateUuidv7(),
      uploadId: upload1Id,
      mdaId: mda1Id,
      sheetName: 'Sheet1',
      rowNumber: 3,
      era: 2024,
      sourceFile: 'edu-data.xlsx',
      sourceSheet: 'Sheet1',
      sourceRow: 3,
      staffName: 'Chukwu Ngozi',
      outstandingBalance: '20000.00',
      varianceCategory: 'clean',
      isBaselineCreated: true,
      loanId: loan4Id,
    },
  ]);

  // Create baseline ledger entries
  // Loan 1: totalLoan = 100000 * 1.1333 = 113330, outstanding = 50000, baselineAmount = 63330
  await db.insert(ledgerEntries).values({
    id: generateUuidv7(),
    loanId: loan1Id,
    staffId: 'OY/EDU/0001',
    mdaId: mda1Id,
    entryType: 'MIGRATION_BASELINE',
    amount: '63330.00',
    principalComponent: '55890.00',
    interestComponent: '7440.00',
    periodMonth: 3,
    periodYear: 2026,
    postedBy: adminUserId,
  });

  // Loan 2: totalLoan = 60000 * 1.1333 = 67998, outstanding = 30000, baselineAmount = 37998
  await db.insert(ledgerEntries).values({
    id: generateUuidv7(),
    loanId: loan2Id,
    staffId: 'OY/EDU/0001',
    mdaId: mda1Id,
    entryType: 'MIGRATION_BASELINE',
    amount: '37998.00',
    principalComponent: '33531.00',
    interestComponent: '4467.00',
    periodMonth: 3,
    periodYear: 2026,
    postedBy: adminUserId,
  });

  // Loan 3: totalLoan = 150000 * 1.1333 = 169995, outstanding = 75000, baselineAmount = 94995
  await db.insert(ledgerEntries).values({
    id: generateUuidv7(),
    loanId: loan3Id,
    staffId: 'OY/HEA/0001',
    mdaId: mda2Id,
    entryType: 'MIGRATION_BASELINE',
    amount: '94995.00',
    principalComponent: '83824.00',
    interestComponent: '11171.00',
    periodMonth: 3,
    periodYear: 2026,
    postedBy: adminUserId,
  });

  // Loan 4: limitedComputation — totalLoan = 0, outstanding = 20000, baselineAmount = -20000
  await db.insert(ledgerEntries).values({
    id: generateUuidv7(),
    loanId: loan4Id,
    staffId: 'MIG-0001',
    mdaId: mda1Id,
    entryType: 'MIGRATION_BASELINE',
    amount: '-20000.00',
    principalComponent: '-20000.00',
    interestComponent: '0.00',
    periodMonth: 3,
    periodYear: 2026,
    postedBy: adminUserId,
  });

  // Create person match for multi-MDA testing
  await db.insert(personMatches).values({
    id: generateUuidv7(),
    personAName: 'Adeyemi Oluwaseun',
    personAMdaId: mda1Id,
    personBName: 'Adeyemi Oluwaseun',
    personBMdaId: mda2Id,
    matchType: 'exact_name',
    confidence: '1.00',
    status: 'auto_confirmed',
  });
});

beforeEach(() => {
  resetRateLimiters();
});

afterAll(async () => {
  await resetDb();
});

// ─── Dashboard API Tests (AC 6, 8) ──────────────────────────────────

describe('GET /api/migrations/dashboard', () => {
  it('returns all MDAs with correct stage derivation', async () => {
    const res = await request(app)
      .get('/api/migrations/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.length).toBe(3);

    const edu = res.body.data.find((m: { mdaName: string }) => m.mdaName === 'Education');
    const hea = res.body.data.find((m: { mdaName: string }) => m.mdaName === 'Health');
    const agr = res.body.data.find((m: { mdaName: string }) => m.mdaName === 'Agriculture');

    expect(edu.stage).toBe('validated');
    expect(hea.stage).toBe('imported'); // 'completed' maps to 'imported'
    expect(agr.stage).toBe('pending');  // no uploads
  });

  it('returns MDAs without uploads as stage "pending"', async () => {
    const res = await request(app)
      .get('/api/migrations/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);

    const agr = res.body.data.find((m: { mdaName: string }) => m.mdaName === 'Agriculture');
    expect(agr.stage).toBe('pending');
    expect(agr.recordCounts).toEqual({ clean: 0, minor: 0, significant: 0, structural: 0, anomalous: 0 });
    expect(agr.baselineCompletion).toEqual({ done: 0, total: 0 });
  });

  it('returns record counts per variance category', async () => {
    const res = await request(app)
      .get('/api/migrations/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);

    const edu = res.body.data.find((m: { mdaName: string }) => m.mdaName === 'Education');
    expect(edu.recordCounts.clean).toBe(2); // 2 clean records
    expect(edu.recordCounts.minor).toBe(1); // 1 minor_variance record
  });

  it('returns baseline completion counts', async () => {
    const res = await request(app)
      .get('/api/migrations/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);

    const edu = res.body.data.find((m: { mdaName: string }) => m.mdaName === 'Education');
    expect(edu.baselineCompletion.done).toBe(3);
    expect(edu.baselineCompletion.total).toBe(3);
  });
});

// ─── Beneficiary API Tests (AC 7, 8) ────────────────────────────────

describe('GET /api/migrations/beneficiaries', () => {
  it('aggregates loans per person correctly (count and exposure)', async () => {
    const res = await request(app)
      .get('/api/migrations/beneficiaries?sortBy=staffName&sortOrder=asc')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const { data } = res.body.data;

    // Adeyemi has 2 loans, Bakare has 1, Chukwu has 1
    expect(data.length).toBe(3);

    const adeyemi = data.find((d: { staffName: string }) => d.staffName === 'Adeyemi Oluwaseun');
    expect(adeyemi.loanCount).toBe(2);
    // Exposure: loan1 outstanding 50000 + loan2 outstanding 30000 = 80000
    expect(adeyemi.totalExposure).toBe('80000.00');
  });

  it('reflects multi-MDA indicator from person_matches', async () => {
    const res = await request(app)
      .get('/api/migrations/beneficiaries')
      .set('Authorization', `Bearer ${adminToken}`);

    const adeyemi = res.body.data.data.find((d: { staffName: string }) => d.staffName === 'Adeyemi Oluwaseun');
    expect(adeyemi.isMultiMda).toBe(true);

    const bakare = res.body.data.data.find((d: { staffName: string }) => d.staffName === 'Bakare Ibrahim');
    expect(bakare.isMultiMda).toBe(false);
  });

  it('returns correct pagination', async () => {
    const res = await request(app)
      .get('/api/migrations/beneficiaries?page=1&pageSize=2')
      .set('Authorization', `Bearer ${adminToken}`);

    const { pagination } = res.body.data;
    expect(pagination.page).toBe(1);
    expect(pagination.pageSize).toBe(2);
    expect(pagination.totalItems).toBe(3);
    expect(pagination.totalPages).toBe(2);
    expect(res.body.data.data.length).toBe(2);
  });

  it('filters by MDA', async () => {
    const res = await request(app)
      .get(`/api/migrations/beneficiaries?mdaId=${mda2Id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const { data } = res.body.data;
    expect(data.length).toBe(1);
    expect(data[0].staffName).toBe('Bakare Ibrahim');
  });

  it('searches by name', async () => {
    const res = await request(app)
      .get('/api/migrations/beneficiaries?search=Adeyemi')
      .set('Authorization', `Bearer ${adminToken}`);

    const { data } = res.body.data;
    expect(data.length).toBe(1);
    expect(data[0].staffName).toBe('Adeyemi Oluwaseun');
  });

  it('searches by staffId', async () => {
    const res = await request(app)
      .get('/api/migrations/beneficiaries?search=MIG-0001')
      .set('Authorization', `Bearer ${adminToken}`);

    const { data } = res.body.data;
    expect(data.length).toBe(1);
    expect(data[0].staffName).toBe('Chukwu Ngozi');
  });

  it('sorts by totalExposure descending', async () => {
    const res = await request(app)
      .get('/api/migrations/beneficiaries?sortBy=totalExposure&sortOrder=desc')
      .set('Authorization', `Bearer ${adminToken}`);

    const { data } = res.body.data;
    // Adeyemi: 80000, Bakare: 75000, Chukwu: 20000
    expect(data[0].staffName).toBe('Adeyemi Oluwaseun');
    expect(data[1].staffName).toBe('Bakare Ibrahim');
    expect(data[2].staffName).toBe('Chukwu Ngozi');
  });

  it('returns correct exposure for limitedComputation loan (negative baseline entry)', async () => {
    const res = await request(app)
      .get('/api/migrations/beneficiaries?search=Chukwu')
      .set('Authorization', `Bearer ${adminToken}`);

    const chukwu = res.body.data.data[0];
    // limitedComputation: principal = 0, baseline = -20000
    // balance = max(0, 0 - (-20000)) = 20000
    expect(chukwu.totalExposure).toBe('20000.00');
  });
});

// ─── CSV Export Tests (AC 5, 8) ──────────────────────────────────────

describe('GET /api/migrations/beneficiaries/export', () => {
  it('returns CSV with all expected columns including varianceCategory', async () => {
    const res = await request(app)
      .get('/api/migrations/beneficiaries/export')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('vlprs-beneficiary-ledger-');

    const lines = res.text.trim().split('\n');
    const headers = lines[0].split(',');

    expect(headers).toContain('Staff Name');
    expect(headers).toContain('Staff ID');
    expect(headers).toContain('MDA');
    expect(headers).toContain('Loan Reference');
    expect(headers).toContain('Principal Amount');
    expect(headers).toContain('Interest Rate');
    expect(headers).toContain('Tenure Months');
    expect(headers).toContain('Monthly Deduction');
    expect(headers).toContain('Outstanding Balance');
    expect(headers).toContain('Variance Category');
    expect(headers).toContain('Multi-MDA');
    expect(headers).toContain('Last Activity');

    // Should have header + 4 data rows (4 loans)
    expect(lines.length).toBe(5);
  });

  it('includes variance category values in CSV data rows', async () => {
    const res = await request(app)
      .get('/api/migrations/beneficiaries/export')
      .set('Authorization', `Bearer ${adminToken}`);

    const lines = res.text.trim().split('\n');
    const headers = lines[0].split(',');
    const vcIndex = headers.indexOf('Variance Category');

    // Check that at least one row has a non-empty variance category
    const dataRows = lines.slice(1);
    const categories = dataRows.map(row => row.split(',')[vcIndex]);
    expect(categories).toContain('clean');
    expect(categories).toContain('minor_variance');
  });
});

// ─── MDA-Scoped Access Tests (AC 7, 8) ──────────────────────────────

describe('MDA-scoped access', () => {
  it('MDA officer sees only their MDA staff in beneficiary list', async () => {
    const res = await request(app)
      .get('/api/migrations/beneficiaries')
      .set('Authorization', `Bearer ${officerToken}`);

    expect(res.status).toBe(200);
    const { data } = res.body.data;
    // Officer is scoped to mda1 (Education) — should see Adeyemi and Chukwu, NOT Bakare (Health)
    const names = data.map((d: { staffName: string }) => d.staffName);
    expect(names).toContain('Adeyemi Oluwaseun');
    expect(names).toContain('Chukwu Ngozi');
    expect(names).not.toContain('Bakare Ibrahim');
  });

  it('MDA officer dashboard is scoped to their MDA', async () => {
    const res = await request(app)
      .get('/api/migrations/dashboard')
      .set('Authorization', `Bearer ${officerToken}`);

    expect(res.status).toBe(200);
    // Officer should only see their MDA
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].mdaName).toBe('Education');
  });
});

// ─── Dashboard Metrics Tests ─────────────────────────────────────────

describe('GET /api/migrations/dashboard/metrics', () => {
  it('returns aggregate hero metrics', async () => {
    const res = await request(app)
      .get('/api/migrations/dashboard/metrics')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const { data } = res.body;

    expect(data.totalStaffMigrated).toBe(3); // 3 distinct staff names
    expect(data.mdasComplete).toBe(0); // no MDAs at reconciled/certified
    expect(data.baselinesEstablished).toBe(4); // 4 records with isBaselineCreated = true
    // Total exposure = 50000 + 30000 + 75000 + 20000 = 175000
    expect(new Decimal(data.totalExposure).toFixed(2)).toBe('175000.00');
  });
});
