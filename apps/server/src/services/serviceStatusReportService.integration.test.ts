import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import app from '../app';
import { db } from '../db/index';
import { mdas, users, loans, serviceExtensions, ledgerEntries } from '../db/schema';
import { hashPassword } from '../lib/password';
import { generateUuidv7 } from '../lib/uuidv7';
import * as authService from '../services/authService';

let mda1Id: string;
let mda2Id: string;
let superAdminToken: string;
let adminToken: string;
let officerToken: string;
let superAdminUserId: string;
let adminUserId: string;
let officerUserId: string;

const testPassword = 'SecurePass1';

// Stable dates for predictable test results
const today = new Date('2026-03-01');
const sixMonthsAgo = new Date('2025-09-01');
const twelveMonthsAgo = new Date('2025-03-01');
const twoMonthsAgo = new Date('2026-01-01');
const threeMonthsAgo = new Date('2025-12-01');
const futureDate = new Date('2028-06-01');
const futureDateExtension = new Date('2027-06-01');

beforeAll(async () => {
  await db.execute(sql`TRUNCATE audit_log, refresh_tokens, temporal_corrections, loan_state_transitions, ledger_entries, service_extensions, loans, users, mdas CASCADE`);

  mda1Id = generateUuidv7();
  mda2Id = generateUuidv7();

  await db.insert(mdas).values([
    { id: mda1Id, name: 'Ministry of Works', code: 'MOW', abbreviation: 'MoW' },
    { id: mda2Id, name: 'Ministry of Education', code: 'MOE', abbreviation: 'MoE' },
  ]);

  const hashedPassword = await hashPassword(testPassword);

  superAdminUserId = generateUuidv7();
  await db.insert(users).values({
    id: superAdminUserId,
    email: 'rpt.superadmin@test.com',
    hashedPassword,
    firstName: 'Super',
    lastName: 'Admin',
    role: 'super_admin',
  });

  adminUserId = generateUuidv7();
  await db.insert(users).values({
    id: adminUserId,
    email: 'rpt.admin@test.com',
    hashedPassword,
    firstName: 'Dept',
    lastName: 'Admin',
    role: 'dept_admin',
  });

  officerUserId = generateUuidv7();
  await db.insert(users).values({
    id: officerUserId,
    email: 'rpt.officer@test.com',
    hashedPassword,
    firstName: 'MDA',
    lastName: 'Officer',
    role: 'mda_officer',
    mdaId: mda1Id,
  });

  const superLogin = await authService.login({ email: 'rpt.superadmin@test.com', password: testPassword });
  superAdminToken = superLogin.accessToken;

  const adminLogin = await authService.login({ email: 'rpt.admin@test.com', password: testPassword });
  adminToken = adminLogin.accessToken;

  const officerLogin = await authService.login({ email: 'rpt.officer@test.com', password: testPassword });
  officerToken = officerLogin.accessToken;
});

beforeEach(async () => {
  await db.execute(sql`TRUNCATE service_extensions, temporal_corrections, loan_state_transitions, ledger_entries, loans CASCADE`);
});

afterAll(async () => {
  await db.execute(sql`TRUNCATE audit_log, refresh_tokens, temporal_corrections, loan_state_transitions, ledger_entries, service_extensions, loans, users, mdas CASCADE`);
});

/** Helper: create a loan directly in DB */
async function seedLoan(overrides: Partial<typeof loans.$inferInsert> = {}): Promise<string> {
  const id = generateUuidv7();
  await db.insert(loans).values({
    id,
    staffId: 'OY/RPT/0001',
    staffName: 'Report Test User',
    gradeLevel: 'GL 10',
    mdaId: mda1Id,
    principalAmount: '300000.00',
    interestRate: '6.000',
    tenureMonths: 24,
    moratoriumMonths: 0,
    monthlyDeductionAmount: '13250.00',
    approvalDate: new Date('2024-01-15'),
    firstDeductionDate: new Date('2024-02-01'),
    loanReference: `VLC-RPT-${id.slice(-6)}`,
    status: 'ACTIVE',
    ...overrides,
  });
  return id;
}

/** Helper: seed ledger entries for a loan */
async function seedLedgerEntry(loanId: string, staffId: string, mdaId: string, amount: string): Promise<void> {
  await db.insert(ledgerEntries).values({
    loanId,
    staffId,
    mdaId,
    entryType: 'PAYROLL',
    amount,
    principalComponent: amount,
    interestComponent: '0.00',
    periodMonth: 1,
    periodYear: 2025,
    postedBy: superAdminUserId,
  });
}

describe('Service Status Verification Report', () => {
  /**
   * Seed the standard test data per story requirements:
   * - Loan A: MDA-1, ACTIVE, retirement 6mo ago, no extension → FLAGGED
   * - Loan B: MDA-1, ACTIVE, retirement 2mo ago, valid extension (future) → EXCLUDED
   * - Loan C: MDA-2, ACTIVE, retirement 12mo ago, expired extension (3mo ago) → FLAGGED
   * - Loan D: MDA-1, ACTIVE, retirement in future → EXCLUDED
   * - Loan E: MDA-1, COMPLETED, retirement 6mo ago → EXCLUDED (not ACTIVE)
   * - Loan F: MDA-2, ACTIVE, no temporal profile → EXCLUDED (no computed_retirement_date)
   */
  async function seedStandardTestData() {
    // Loan A: MDA-1, ACTIVE, retired 6 months ago, no extension
    const loanAId = await seedLoan({
      staffId: 'OY/RPT/A001',
      staffName: 'Adeola Ogunwale',
      computedRetirementDate: sixMonthsAgo,
      dateOfBirth: new Date('1965-09-01'),
      dateOfFirstAppointment: new Date('1990-01-01'),
    });
    await seedLedgerEntry(loanAId, 'OY/RPT/A001', mda1Id, '50000.00');

    // Loan B: MDA-1, ACTIVE, retired 2 months ago, VALID extension (future)
    const loanBId = await seedLoan({
      staffId: 'OY/RPT/B001',
      staffName: 'Bola Eniola',
      computedRetirementDate: twoMonthsAgo,
      dateOfBirth: new Date('1966-01-01'),
      dateOfFirstAppointment: new Date('1991-01-01'),
    });
    await db.insert(serviceExtensions).values({
      loanId: loanBId,
      originalComputedDate: twoMonthsAgo,
      newRetirementDate: futureDateExtension,
      approvingAuthorityReference: 'EXT-B-001',
      notes: 'Valid service extension',
      createdBy: superAdminUserId,
    });

    // Loan C: MDA-2, ACTIVE, retired 12 months ago, EXPIRED extension (3 months ago)
    const loanCId = await seedLoan({
      staffId: 'OY/RPT/C001',
      staffName: 'Chidi Okpala',
      mdaId: mda2Id,
      computedRetirementDate: twelveMonthsAgo,
      dateOfBirth: new Date('1965-03-01'),
      dateOfFirstAppointment: new Date('1990-01-01'),
    });
    await seedLedgerEntry(loanCId, 'OY/RPT/C001', mda2Id, '100000.00');
    await db.insert(serviceExtensions).values({
      loanId: loanCId,
      originalComputedDate: twelveMonthsAgo,
      newRetirementDate: threeMonthsAgo,
      approvingAuthorityReference: 'EXT-C-001',
      notes: 'Expired service extension',
      createdBy: superAdminUserId,
    });

    // Loan D: MDA-1, ACTIVE, retirement in future → EXCLUDED
    await seedLoan({
      staffId: 'OY/RPT/D001',
      staffName: 'Dayo Adeleke',
      computedRetirementDate: futureDate,
      dateOfBirth: new Date('1968-06-01'),
      dateOfFirstAppointment: new Date('1993-01-01'),
    });

    // Loan E: MDA-1, COMPLETED, retired 6 months ago → EXCLUDED
    await seedLoan({
      staffId: 'OY/RPT/E001',
      staffName: 'Emeka Ugwu',
      status: 'COMPLETED',
      computedRetirementDate: sixMonthsAgo,
      dateOfBirth: new Date('1965-09-01'),
      dateOfFirstAppointment: new Date('1990-01-01'),
    });

    // Loan F: MDA-2, ACTIVE, no temporal profile → EXCLUDED
    await seedLoan({
      staffId: 'OY/RPT/F001',
      staffName: 'Fatima Bello',
      mdaId: mda2Id,
    });

    return { loanAId, loanBId, loanCId };
  }

  // Test 6.3: GET report as super_admin → returns Loan A + Loan C only
  it('should return only flagged loans (post-retirement ACTIVE loans) with all required fields', async () => {
    const { loanAId, loanCId } = await seedStandardTestData();

    const res = await request(app)
      .get('/api/reports/service-status-verification')
      .query({ asOfDate: '2026-03-01' })
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);

    const loanIds = res.body.data.map((r: { loanId: string }) => r.loanId);
    expect(loanIds).toContain(loanAId);
    expect(loanIds).toContain(loanCId);

    // Verify all required fields are present on each row
    for (const row of res.body.data) {
      expect(row).toHaveProperty('loanId');
      expect(row).toHaveProperty('staffName');
      expect(row).toHaveProperty('staffId');
      expect(row).toHaveProperty('mdaName');
      expect(row).toHaveProperty('mdaId');
      expect(row).toHaveProperty('loanReference');
      expect(row).toHaveProperty('computedRetirementDate');
      expect(row.computedRetirementDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(row).toHaveProperty('monthsPastRetirement');
      expect(row).toHaveProperty('outstandingBalance');
      expect(row).toHaveProperty('hasExpiredExtension');
      expect(row).toHaveProperty('expiredExtensionReference');
      expect(row).toHaveProperty('availableActions');
    }
  });

  // Test 6.4: Sorted by monthsPastRetirement DESC → Loan C (12mo) before Loan A (6mo)
  it('should sort by monthsPastRetirement descending (worst cases first)', async () => {
    const { loanAId, loanCId } = await seedStandardTestData();

    const res = await request(app)
      .get('/api/reports/service-status-verification')
      .query({ asOfDate: '2026-03-01' })
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);

    expect(res.body.data).toHaveLength(2);
    // Loan C (12 months past retirement) should be first
    expect(res.body.data[0].loanId).toBe(loanCId);
    expect(res.body.data[0].monthsPastRetirement).toBe(12);
    // Loan A (6 months past retirement) should be second
    expect(res.body.data[1].loanId).toBe(loanAId);
    expect(res.body.data[1].monthsPastRetirement).toBe(6);
  });

  // Test 6.5: Loan C has hasExpiredExtension: true with reference populated
  it('should flag loans with expired extensions and include reference', async () => {
    const { loanCId } = await seedStandardTestData();

    const res = await request(app)
      .get('/api/reports/service-status-verification')
      .query({ asOfDate: '2026-03-01' })
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);

    const loanC = res.body.data.find((r: { loanId: string }) => r.loanId === loanCId);
    expect(loanC.hasExpiredExtension).toBe(true);
    expect(loanC.expiredExtensionReference).toBe('EXT-C-001');
  });

  // Test 6.6: Loan A has hasExpiredExtension: false
  it('should mark loans without extensions correctly', async () => {
    const { loanAId } = await seedStandardTestData();

    const res = await request(app)
      .get('/api/reports/service-status-verification')
      .query({ asOfDate: '2026-03-01' })
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);

    const loanA = res.body.data.find((r: { loanId: string }) => r.loanId === loanAId);
    expect(loanA.hasExpiredExtension).toBe(false);
    expect(loanA.expiredExtensionReference).toBeNull();
  });

  // Test 6.7: availableActions includes all three action labels
  it('should include correct availableActions for each row', async () => {
    await seedStandardTestData();

    const res = await request(app)
      .get('/api/reports/service-status-verification')
      .query({ asOfDate: '2026-03-01' })
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);

    for (const row of res.body.data) {
      expect(row.availableActions).toEqual(
        expect.arrayContaining([
          'record_service_extension',
          'file_retirement_event',
          'flag_for_investigation',
        ]),
      );
      expect(row.availableActions).toHaveLength(3);
    }
  });

  // Test 6.8: Summary metrics
  it('should return correct summary metrics', async () => {
    await seedStandardTestData();

    const res = await request(app)
      .get('/api/reports/service-status-verification')
      .query({ asOfDate: '2026-03-01' })
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);

    const { summary } = res.body;
    expect(summary.totalFlagged).toBe(2);
    expect(summary.totalWithExpiredExtensions).toBe(1);
    expect(summary.totalWithoutExtensions).toBe(1);
    expect(summary.message).toBeNull();

    // Outstanding exposure: Loan A + Loan C
    // Loan A: principal=300000, interest=6% → total=318000, paid=50000, outstanding=268000
    // Loan C: principal=300000, interest=6% → total=318000, paid=100000, outstanding=218000
    // Total: 486000.00
    expect(summary.totalOutstandingExposure).toBe('486000.00');
  });

  // Test 6.9: MDA breakdown
  it('should return correct MDA breakdown', async () => {
    await seedStandardTestData();

    const res = await request(app)
      .get('/api/reports/service-status-verification')
      .query({ asOfDate: '2026-03-01' })
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);

    const { mdaBreakdown } = res.body.summary;
    expect(mdaBreakdown).toHaveLength(2);

    const mda1Entry = mdaBreakdown.find((m: { mdaId: string }) => m.mdaId === mda1Id);
    const mda2Entry = mdaBreakdown.find((m: { mdaId: string }) => m.mdaId === mda2Id);

    // MDA-1: Loan A only (count: 1, exposure: 268000.00)
    expect(mda1Entry.count).toBe(1);
    expect(mda1Entry.outstandingExposure).toBe('268000.00');
    expect(mda1Entry.mdaName).toBe('Ministry of Works');

    // MDA-2: Loan C only (count: 1, exposure: 218000.00)
    expect(mda2Entry.count).toBe(1);
    expect(mda2Entry.outstandingExposure).toBe('218000.00');
    expect(mda2Entry.mdaName).toBe('Ministry of Education');
  });

  // Test 6.10: MDA scoping — officer sees only their MDA
  it('should scope results to officer MDA', async () => {
    const { loanAId } = await seedStandardTestData();

    const res = await request(app)
      .get('/api/reports/service-status-verification')
      .query({ asOfDate: '2026-03-01' })
      .set('Authorization', `Bearer ${officerToken}`)
      .expect(200);

    // Officer is MDA-1, so should only see Loan A (not Loan C from MDA-2)
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].loanId).toBe(loanAId);
    expect(res.body.summary.totalFlagged).toBe(1);
  });

  // Test 6.11: Filter by mdaId as super_admin
  it('should filter by mdaId query parameter', async () => {
    const { loanCId } = await seedStandardTestData();

    const res = await request(app)
      .get('/api/reports/service-status-verification')
      .query({ asOfDate: '2026-03-01', mdaId: mda2Id })
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].loanId).toBe(loanCId);
  });

  // Test 6.12: Clean state — no flagged loans
  it('should return empty data with correct message when no loans match criteria', async () => {
    // No loans seeded → clean state

    const res = await request(app)
      .get('/api/reports/service-status-verification')
      .query({ asOfDate: '2026-03-01' })
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);

    expect(res.body.data).toEqual([]);
    expect(res.body.summary.totalFlagged).toBe(0);
    expect(res.body.summary.message).toBe('No post-retirement activity detected');
    expect(res.body.summary.totalOutstandingExposure).toBe('0.00');
    expect(res.body.summary.mdaBreakdown).toEqual([]);
  });

  // Test 6.13: Pagination
  it('should paginate results correctly', async () => {
    // Seed 5 flagged loans
    for (let i = 0; i < 5; i++) {
      await seedLoan({
        staffId: `OY/RPT/PG${i}`,
        staffName: `Paginated User ${i}`,
        computedRetirementDate: new Date(`2025-0${i + 1}-01`),
        dateOfBirth: new Date('1965-01-01'),
        dateOfFirstAppointment: new Date('1990-01-01'),
      });
    }

    const res = await request(app)
      .get('/api/reports/service-status-verification')
      .query({ asOfDate: '2026-03-01', pageSize: '2', page: '1' })
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);

    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination.totalItems).toBe(5);
    expect(res.body.pagination.totalPages).toBe(3);
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.pageSize).toBe(2);
  });

  // Test 6.14: Summary aggregates cover full dataset when paginated
  it('should compute summary from full dataset regardless of pagination', async () => {
    for (let i = 0; i < 5; i++) {
      await seedLoan({
        staffId: `OY/RPT/SM${i}`,
        staffName: `Summary User ${i}`,
        computedRetirementDate: new Date(`2025-0${i + 1}-01`),
        dateOfBirth: new Date('1965-01-01'),
        dateOfFirstAppointment: new Date('1990-01-01'),
      });
    }

    const res = await request(app)
      .get('/api/reports/service-status-verification')
      .query({ asOfDate: '2026-03-01', pageSize: '2' })
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);

    // Only 2 results on page, but summary should reflect all 5
    expect(res.body.data).toHaveLength(2);
    expect(res.body.summary.totalFlagged).toBe(5);
  });

  // Test 6.15: asOfDate parameter controls which loans are included
  it('should respect asOfDate parameter for inclusion/exclusion', async () => {
    // Loan with retirement date 2026-02-01
    await seedLoan({
      staffId: 'OY/RPT/AOD1',
      staffName: 'AsOfDate Test',
      computedRetirementDate: new Date('2026-02-01'),
      dateOfBirth: new Date('1966-02-01'),
      dateOfFirstAppointment: new Date('1991-01-01'),
    });

    // asOfDate=2026-01-15 → retirement is AFTER asOfDate → EXCLUDED
    const resBefore = await request(app)
      .get('/api/reports/service-status-verification')
      .query({ asOfDate: '2026-01-15' })
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);

    expect(resBefore.body.data).toHaveLength(0);

    // asOfDate=2026-03-01 → retirement is BEFORE asOfDate → INCLUDED
    const resAfter = await request(app)
      .get('/api/reports/service-status-verification')
      .query({ asOfDate: '2026-03-01' })
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);

    expect(resAfter.body.data).toHaveLength(1);
    expect(resAfter.body.data[0].staffName).toBe('AsOfDate Test');
  });

  // Test 6.16: asOfDate default — behaves as today
  it('should default asOfDate to today when not provided', async () => {
    // Loan with retirement date far in the past — should always appear
    await seedLoan({
      staffId: 'OY/RPT/DEF1',
      staffName: 'Default Date Test',
      computedRetirementDate: new Date('2020-01-01'),
      dateOfBirth: new Date('1960-01-01'),
      dateOfFirstAppointment: new Date('1985-01-01'),
    });

    const res = await request(app)
      .get('/api/reports/service-status-verification')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].staffName).toBe('Default Date Test');
  });

  // Test 6.17: Auth — unauthenticated → 401
  it('should return 401 for unauthenticated requests', async () => {
    await request(app)
      .get('/api/reports/service-status-verification')
      .expect(401);
  });

  it('should return 200 for dept_admin (authorized role)', async () => {
    const res = await request(app)
      .get('/api/reports/service-status-verification')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
  });

  // Note: Task 6.17 specifies "insufficient role → 403", but all 3 system roles
  // (super_admin, dept_admin, mda_officer) are authorized for this endpoint.
  // No role exists that would trigger a 403 from the authorise middleware.
  // If new roles are added in future, a 403 test should be added here.

  // Test: Outstanding balance computation is correct
  it('should compute outstanding balance correctly using batch aggregation', async () => {
    const loanId = await seedLoan({
      staffId: 'OY/RPT/BAL1',
      staffName: 'Balance Test',
      principalAmount: '500000.00',
      interestRate: '10.000',
      computedRetirementDate: sixMonthsAgo,
      dateOfBirth: new Date('1965-09-01'),
      dateOfFirstAppointment: new Date('1990-01-01'),
    });

    // Seed two payments
    await seedLedgerEntry(loanId, 'OY/RPT/BAL1', mda1Id, '25000.00');
    await seedLedgerEntry(loanId, 'OY/RPT/BAL1', mda1Id, '25000.00');

    const res = await request(app)
      .get('/api/reports/service-status-verification')
      .query({ asOfDate: '2026-03-01' })
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);

    // Total loan = 500000 + (500000 * 10%) = 550000
    // Total paid = 25000 + 25000 = 50000
    // Outstanding = 550000 - 50000 = 500000.00
    const loan = res.body.data.find((r: { loanId: string }) => r.loanId === loanId);
    expect(loan.outstandingBalance).toBe('500000.00');
  });
});
