import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import { addMonths } from 'date-fns';
import app from '../app';
import { db } from '../db/index';
import { mdas, users, loans, ledgerEntries } from '../db/schema';
import { hashPassword } from '../lib/password';
import { generateUuidv7 } from '../lib/uuidv7';
import * as authService from '../services/authService';
import { autoSplitDeduction } from '../services/computationEngine';
import * as gratuityProjectionService from '../services/gratuityProjectionService';

// ─── Test Setup ────────────────────────────────────────────────────────────────

let testMdaId: string;
let secondMdaId: string;
let adminToken: string;
let officerToken: string;
let adminUserId: string;

// Loan IDs for the 4 test scenarios
let loanAId: string; // Complete profile, has gratuity exposure
let loanBId: string; // Complete profile, no exposure (retires well after loan ends)
let loanCId: string; // Incomplete profile (no DOB → no retirement date)
let loanDId: string; // Complete profile, retirement already passed (full exposure)

const testPassword = 'SecurePass1';

// Simple loan params: principal 120K, rate 10%, tenure 12, monthly 11000
// totalInterest = 12000, totalLoan = 132000
const simpleLoanParams = {
  principalAmount: '120000.00',
  interestRate: '10.000',
  tenureMonths: 12,
  moratoriumMonths: 0,
  monthlyDeductionAmount: '11000.00',
  gradeLevel: 'GL 10',
  status: 'ACTIVE' as const,
};

beforeAll(async () => {
  await db.execute(sql`TRUNCATE audit_log, refresh_tokens, ledger_entries, loan_state_transitions, temporal_corrections, service_extensions, loans, users, mdas CASCADE`);

  testMdaId = generateUuidv7();
  secondMdaId = generateUuidv7();

  await db.insert(mdas).values([
    { id: testMdaId, name: 'Gratuity Test MDA', code: 'GRAT_TEST', abbreviation: 'GratTest' },
    { id: secondMdaId, name: 'Gratuity Second MDA', code: 'GRAT_SEC', abbreviation: 'GratSec' },
  ]);

  const hashedPassword = await hashPassword(testPassword);

  // Super admin (no MDA scope)
  adminUserId = generateUuidv7();
  await db.insert(users).values({
    id: adminUserId,
    email: 'grat.admin@test.com',
    hashedPassword,
    firstName: 'Gratuity',
    lastName: 'Admin',
    role: 'super_admin',
  });

  // MDA officer scoped to testMdaId
  const officerId = generateUuidv7();
  await db.insert(users).values({
    id: officerId,
    email: 'grat.officer@test.com',
    hashedPassword,
    firstName: 'Gratuity',
    lastName: 'Officer',
    role: 'mda_officer',
    mdaId: testMdaId,
  });

  // Get tokens
  const adminLogin = await authService.login({ email: 'grat.admin@test.com', password: testPassword });
  adminToken = adminLogin.accessToken;

  const officerLogin = await authService.login({ email: 'grat.officer@test.com', password: testPassword });
  officerToken = officerLogin.accessToken;
});

beforeEach(async () => {
  // Clear loan-related data before each test group
  await db.execute(sql`TRUNCATE ledger_entries, loan_state_transitions, temporal_corrections, service_extensions, loans CASCADE`);

  const now = new Date();

  // Loan A: Complete profile, retirement in ~6 months → has exposure (tenure=12, remaining=12, service≈6)
  loanAId = generateUuidv7();
  await db.insert(loans).values({
    id: loanAId,
    staffId: 'OY/GRAT/0001',
    staffName: 'Staff A Exposure',
    mdaId: testMdaId,
    approvalDate: now,
    firstDeductionDate: now,
    loanReference: `VLC-GRAT-A-${loanAId.slice(-4)}`,
    dateOfBirth: new Date('1966-01-01'), // DOB+60 = 2026-01-01 (close to now)
    dateOfFirstAppointment: new Date('1990-01-01'), // appt+35 = 2025-01-01
    computedRetirementDate: addMonths(now, 6), // ~6 months from now
    ...simpleLoanParams,
  });

  // Loan B: Complete profile, retirement far in future → no exposure
  loanBId = generateUuidv7();
  await db.insert(loans).values({
    id: loanBId,
    staffId: 'OY/GRAT/0002',
    staffName: 'Staff B No Exposure',
    mdaId: testMdaId,
    approvalDate: now,
    firstDeductionDate: now,
    loanReference: `VLC-GRAT-B-${loanBId.slice(-4)}`,
    dateOfBirth: new Date('1980-01-01'),
    dateOfFirstAppointment: new Date('2005-01-01'),
    computedRetirementDate: addMonths(now, 120), // 10 years away, loan is only 12 months
    ...simpleLoanParams,
  });

  // Loan C: Incomplete temporal profile (no DOB, no appointment, no retirement date)
  loanCId = generateUuidv7();
  await db.insert(loans).values({
    id: loanCId,
    staffId: 'OY/GRAT/0003',
    staffName: 'Staff C Incomplete',
    mdaId: testMdaId,
    approvalDate: now,
    firstDeductionDate: now,
    loanReference: `VLC-GRAT-C-${loanCId.slice(-4)}`,
    // No dateOfBirth, no dateOfFirstAppointment, no computedRetirementDate
    ...simpleLoanParams,
  });

  // Loan D: Complete profile, retirement already passed → full exposure
  loanDId = generateUuidv7();
  await db.insert(loans).values({
    id: loanDId,
    staffId: 'OY/GRAT/0004',
    staffName: 'Staff D Full Exposure',
    mdaId: testMdaId,
    approvalDate: now,
    firstDeductionDate: now,
    loanReference: `VLC-GRAT-D-${loanDId.slice(-4)}`,
    dateOfBirth: new Date('1960-01-01'),
    dateOfFirstAppointment: new Date('1985-01-01'),
    computedRetirementDate: addMonths(now, -12), // 1 year ago — already retired
    ...simpleLoanParams,
  });
});

afterAll(async () => {
  await db.execute(sql`TRUNCATE audit_log, refresh_tokens, ledger_entries, loan_state_transitions, temporal_corrections, service_extensions, loans, users, mdas CASCADE`);
});

/** Helper: seed PAYROLL ledger entries for a loan */
async function seedEntries(loanId: string, staffId: string, mdaId: string, count: number) {
  const split = autoSplitDeduction('11000.00', {
    principalAmount: '120000.00',
    interestRate: '10.000',
    tenureMonths: 12,
    moratoriumMonths: 0,
  });

  for (let i = 0; i < count; i++) {
    await db.insert(ledgerEntries).values({
      id: generateUuidv7(),
      loanId,
      staffId,
      mdaId,
      entryType: 'PAYROLL',
      amount: '11000.00',
      principalComponent: split.principalComponent,
      interestComponent: split.interestComponent,
      periodMonth: ((i % 12) + 1),
      periodYear: 2025 + Math.floor(i / 12),
      postedBy: adminUserId,
    });
  }
}

// ─── 7.3: Loan A — has gratuity exposure ────────────────────────────────────

describe('GET /api/loans/:id — gratuity projection on loan detail', () => {
  it('returns gratuityProjection with hasGratuityExposure: true for Loan A (AC 1, AC 3)', async () => {
    const res = await request(app)
      .get(`/api/loans/${loanAId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const detail = res.body.data;
    expect(detail.gratuityProjection).not.toBeNull();
    expect(detail.gratuityProjection.hasGratuityExposure).toBe(true);
    expect(detail.gratuityProjection.gratuityReceivableMonths).toBeGreaterThan(0);
    expect(detail.gratuityProjection.payrollDeductionMonths).toBeGreaterThan(0);
    // Money fields are strings
    expect(typeof detail.gratuityProjection.projectedGratuityReceivableAmount).toBe('string');
    expect(typeof detail.gratuityProjection.projectedMonthlyGratuityAmount).toBe('string');
    // Decimal precision
    expect(detail.gratuityProjection.projectedGratuityReceivableAmount).toMatch(/^\d+\.\d{2}$/);
    expect(detail.gratuityProjection.projectedMonthlyGratuityAmount).toMatch(/^\d+\.\d{2}$/);
    // Date fields
    expect(detail.gratuityProjection.loanMaturityDate).toBeTruthy();
    expect(detail.gratuityProjection.computedRetirementDate).toBeTruthy();
    // payrollDeductionMonths + gratuityReceivableMonths = remainingInstallments
    expect(detail.gratuityProjection.payrollDeductionMonths + detail.gratuityProjection.gratuityReceivableMonths)
      .toBe(detail.gratuityProjection.remainingInstallments);
  });

  // 7.4: Loan B — no exposure
  it('returns gratuityProjection with hasGratuityExposure: false for Loan B (AC 2)', async () => {
    const res = await request(app)
      .get(`/api/loans/${loanBId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const detail = res.body.data;
    expect(detail.gratuityProjection).not.toBeNull();
    expect(detail.gratuityProjection.hasGratuityExposure).toBe(false);
    expect(detail.gratuityProjection.gratuityReceivableMonths).toBe(0);
    expect(detail.gratuityProjection.projectedGratuityReceivableAmount).toBe('0.00');
    expect(detail.gratuityProjection.projectedMonthlyGratuityAmount).toBe('0.00');
  });

  // 7.5: Loan C — incomplete profile → null
  it('returns gratuityProjection: null for Loan C with incomplete temporal profile (AC 6)', async () => {
    const res = await request(app)
      .get(`/api/loans/${loanCId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const detail = res.body.data;
    expect(detail.gratuityProjection).toBeNull();
    expect(detail.temporalProfile.profileStatus).toBe('incomplete');
  });

  // Loan D — retirement already passed → full exposure
  it('returns full exposure for Loan D with retirement already passed', async () => {
    const res = await request(app)
      .get(`/api/loans/${loanDId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const detail = res.body.data;
    expect(detail.gratuityProjection).not.toBeNull();
    expect(detail.gratuityProjection.hasGratuityExposure).toBe(true);
    expect(detail.gratuityProjection.payrollDeductionMonths).toBe(0);
    expect(detail.gratuityProjection.gratuityReceivableMonths).toBe(12); // full tenure
    // Entire loan balance is gratuity receivable (no payments deducted via payroll)
    expect(detail.gratuityProjection.projectedGratuityReceivableAmount).toBe('132000.00');
  });

  // 7.7: Projection updates after a ledger entry is posted (AC 5)
  it('returns recalculated projection after ledger entry posting (AC 5)', async () => {
    // Get initial projection for Loan A
    const resBefore = await request(app)
      .get(`/api/loans/${loanAId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const before = resBefore.body.data.gratuityProjection;
    expect(before.hasGratuityExposure).toBe(true);
    const amountBefore = parseFloat(before.projectedGratuityReceivableAmount);

    // Post 2 ledger entries (simulating 2 monthly deductions)
    await seedEntries(loanAId, 'OY/GRAT/0001', testMdaId, 2);

    // Get updated projection
    const resAfter = await request(app)
      .get(`/api/loans/${loanAId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const after = resAfter.body.data.gratuityProjection;
    const amountAfter = parseFloat(after.projectedGratuityReceivableAmount);

    // After payments, exposure should decrease (less balance remaining at retirement)
    expect(amountAfter).toBeLessThan(amountBefore);
    // installmentsCompleted should reflect the new entries
    expect(after.remainingInstallments).toBe(10); // 12 - 2 = 10
  });

  // 7.8: MDA scoping — officer sees gratuity projection for their MDA loan
  it('MDA officer sees gratuity projection for their MDA loan (AC 3)', async () => {
    const res = await request(app)
      .get(`/api/loans/${loanAId}`)
      .set('Authorization', `Bearer ${officerToken}`)
      .expect(200);

    expect(res.body.data.gratuityProjection).not.toBeNull();
    expect(res.body.data.gratuityProjection.hasGratuityExposure).toBe(true);
  });

  it('MDA officer gets 403 for loan in other MDA', async () => {
    // Create a loan in the second MDA
    const otherMdaLoanId = generateUuidv7();
    await db.insert(loans).values({
      id: otherMdaLoanId,
      staffId: 'OY/GRAT/9999',
      staffName: 'Other MDA Staff',
      mdaId: secondMdaId,
      approvalDate: new Date(),
      firstDeductionDate: new Date(),
      loanReference: `VLC-GRAT-X-${otherMdaLoanId.slice(-4)}`,
      dateOfBirth: new Date('1970-01-01'),
      dateOfFirstAppointment: new Date('1995-01-01'),
      computedRetirementDate: addMonths(new Date(), 6),
      ...simpleLoanParams,
    });

    await request(app)
      .get(`/api/loans/${otherMdaLoanId}`)
      .set('Authorization', `Bearer ${officerToken}`)
      .expect(403);
  });
});

// ─── 7.6: Dashboard aggregate metric ────────────────────────────────────────

describe('getAggregateGratuityExposure (service-level)', () => {
  it('returns SUM of gratuity exposure for Loan A + D, excludes B and C (AC 4)', async () => {
    const aggregate = await gratuityProjectionService.getAggregateGratuityExposure();

    // Should be > 0 (at least Loan A + Loan D contribute)
    const totalExposure = parseFloat(aggregate);
    expect(totalExposure).toBeGreaterThan(0);

    // Get individual projections to verify sum
    const projA = await gratuityProjectionService.getGratuityProjection(loanAId);
    const projD = await gratuityProjectionService.getGratuityProjection(loanDId);

    expect(projA?.hasGratuityExposure).toBe(true);
    expect(projD?.hasGratuityExposure).toBe(true);

    const expectedSum = parseFloat(projA!.projectedGratuityReceivableAmount)
      + parseFloat(projD!.projectedGratuityReceivableAmount);
    expect(totalExposure).toBeCloseTo(expectedSum, 2);
  });

  it('excludes loans with no exposure from aggregate', async () => {
    const projB = await gratuityProjectionService.getGratuityProjection(loanBId);
    expect(projB?.hasGratuityExposure).toBe(false);

    // Loan C has no temporal profile → null projection
    const projC = await gratuityProjectionService.getGratuityProjection(loanCId);
    expect(projC).toBeNull();
  });

  it('respects MDA scope in aggregate', async () => {
    // Create a loan in second MDA with exposure
    const secondMdaLoanId = generateUuidv7();
    await db.insert(loans).values({
      id: secondMdaLoanId,
      staffId: 'OY/GRAT/9998',
      staffName: 'Second MDA Staff',
      mdaId: secondMdaId,
      approvalDate: new Date(),
      firstDeductionDate: new Date(),
      loanReference: `VLC-GRAT-S-${secondMdaLoanId.slice(-4)}`,
      dateOfBirth: new Date('1960-01-01'),
      dateOfFirstAppointment: new Date('1985-01-01'),
      computedRetirementDate: addMonths(new Date(), -12),
      ...simpleLoanParams,
    });

    // Aggregate for testMdaId should NOT include secondMdaId loan
    const testMdaAggregate = await gratuityProjectionService.getAggregateGratuityExposure(testMdaId);
    const allAggregate = await gratuityProjectionService.getAggregateGratuityExposure();

    const testMdaAmount = parseFloat(testMdaAggregate);
    const allAmount = parseFloat(allAggregate);

    // All MDAs aggregate should be >= test MDA aggregate (includes second MDA loan)
    expect(allAmount).toBeGreaterThan(testMdaAmount);
  });

  it('returns "0.00" when no active loans with exposure exist', async () => {
    // Clear all loans
    await db.execute(sql`TRUNCATE ledger_entries, loan_state_transitions, temporal_corrections, service_extensions, loans CASCADE`);

    const aggregate = await gratuityProjectionService.getAggregateGratuityExposure();
    expect(aggregate).toBe('0.00');
  });
});
