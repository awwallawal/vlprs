import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../db/index';
import { mdas, users, loans, mdaSubmissions, submissionRows } from '../db/schema';
import { hashPassword } from '../lib/password';
import { generateUuidv7 } from '../lib/uuidv7';
import { addMonths, subMonths, format } from 'date-fns';
import { getCheckpointData } from './preSubmissionService';
import { resetDb } from '../test/resetDb';

/**
 * Pre-Submission Service Integration Tests (Story 7.0c).
 *
 * Replaces mock-based tests with real database queries.
 * Validates WHERE/JOIN conditions, MDA scoping, and date window filtering.
 *
 * Pattern follows: submissionComparison.integration.test.ts
 */

// Test data IDs
const mda1Id = generateUuidv7();
const mda2Id = generateUuidv7();
const userId = generateUuidv7();

const now = new Date();
const prevPeriod = format(subMonths(now, 1), 'yyyy-MM');

describe('preSubmissionService.getCheckpointData — integration', () => {
  beforeAll(async () => {
    await resetDb();

    // Seed 2 MDAs
    await db.insert(mdas).values([
      { id: mda1Id, name: 'Ministry of Education', code: 'EDU', abbreviation: 'EDU' },
      { id: mda2Id, name: 'Ministry of Health', code: 'HEALTH', abbreviation: 'HEALTH' },
    ]);

    // Seed user (needed for submission uploadedBy FK)
    const hashed = await hashPassword('Password1');
    await db.insert(users).values({
      id: userId,
      email: 'test-pre-sub@vlprs.test',
      hashedPassword: hashed,
      firstName: 'Test',
      lastName: 'Officer',
      role: 'mda_officer',
      mdaId: mda1Id,
    });

    // Seed loans — MDA 1
    // Loan 1: ACTIVE, retirement in 6 months (within 12-month window)
    const retirementSoon = addMonths(now, 6);
    await db.insert(loans).values({
      staffId: 'OYO-001',
      staffName: 'Alice Approaching',
      gradeLevel: 'GL-10',
      mdaId: mda1Id,
      principalAmount: '500000.00',
      interestRate: '13.330',
      tenureMonths: 60,
      monthlyDeductionAmount: '12777.50',
      approvalDate: new Date('2024-01-15'),
      firstDeductionDate: new Date('2024-02-01'),
      loanReference: 'LR-PRESUB-001',
      status: 'ACTIVE',
      computedRetirementDate: retirementSoon,
    });

    // Loan 2: ACTIVE, retirement in 18 months (OUTSIDE 12-month window)
    const retirementFar = addMonths(now, 18);
    await db.insert(loans).values({
      staffId: 'OYO-002',
      staffName: 'Bob FarOff',
      gradeLevel: 'GL-08',
      mdaId: mda1Id,
      principalAmount: '300000.00',
      interestRate: '13.330',
      tenureMonths: 60,
      monthlyDeductionAmount: '7666.50',
      approvalDate: new Date('2024-01-15'),
      firstDeductionDate: new Date('2024-02-01'),
      loanReference: 'LR-PRESUB-002',
      status: 'ACTIVE',
      computedRetirementDate: retirementFar,
    });

    // Loan 3: COMPLETED (should be excluded from all results)
    await db.insert(loans).values({
      staffId: 'OYO-003',
      staffName: 'Charlie Completed',
      gradeLevel: 'GL-12',
      mdaId: mda1Id,
      principalAmount: '200000.00',
      interestRate: '13.330',
      tenureMonths: 60,
      monthlyDeductionAmount: '5111.00',
      approvalDate: new Date('2022-01-15'),
      firstDeductionDate: new Date('2022-02-01'),
      loanReference: 'LR-PRESUB-003',
      status: 'COMPLETED',
      computedRetirementDate: addMonths(now, 3),
    });

    // Loan 4: ACTIVE, retirement in past (should be excluded — past retirement)
    await db.insert(loans).values({
      staffId: 'OYO-004',
      staffName: 'Diana PastRetired',
      gradeLevel: 'GL-14',
      mdaId: mda1Id,
      principalAmount: '400000.00',
      interestRate: '13.330',
      tenureMonths: 60,
      monthlyDeductionAmount: '10222.00',
      approvalDate: new Date('2023-01-15'),
      firstDeductionDate: new Date('2023-02-01'),
      loanReference: 'LR-PRESUB-004',
      status: 'ACTIVE',
      computedRetirementDate: subMonths(now, 1),
    });

    // Loan 5: ACTIVE in MDA 2 — for scoping test
    await db.insert(loans).values({
      staffId: 'OYO-005',
      staffName: 'Eve OtherMDA',
      gradeLevel: 'GL-10',
      mdaId: mda2Id,
      principalAmount: '500000.00',
      interestRate: '13.330',
      tenureMonths: 60,
      monthlyDeductionAmount: '12777.50',
      approvalDate: new Date('2024-01-15'),
      firstDeductionDate: new Date('2024-02-01'),
      loanReference: 'LR-PRESUB-005',
      status: 'ACTIVE',
      computedRetirementDate: addMonths(now, 4),
    });

    // Loan 6: ACTIVE in MDA 1, no retirement date (no computedRetirementDate)
    await db.insert(loans).values({
      staffId: 'OYO-006',
      staffName: 'Frank NoRetirement',
      gradeLevel: 'GL-06',
      mdaId: mda1Id,
      principalAmount: '100000.00',
      interestRate: '13.330',
      tenureMonths: 60,
      monthlyDeductionAmount: '2555.50',
      approvalDate: new Date('2024-06-01'),
      firstDeductionDate: new Date('2024-07-01'),
      loanReference: 'LR-PRESUB-006',
      status: 'ACTIVE',
    });

    // Create a submission for MDA 1 for the previous period
    const submissionId = generateUuidv7();
    await db.insert(mdaSubmissions).values({
      id: submissionId,
      mdaId: mda1Id,
      uploadedBy: userId,
      period: prevPeriod,
      referenceNumber: `REF-PRESUB-${prevPeriod}`,
      status: 'confirmed',
      recordCount: 3,
    });

    // Submission rows for the previous period
    // OYO-001: normal deduction (₦12,777.50)
    await db.insert(submissionRows).values({
      submissionId,
      rowNumber: 1,
      staffId: 'OYO-001',
      month: prevPeriod,
      amountDeducted: '12777.50',
      payrollBatchReference: 'PB-001',
      mdaCode: 'EDU',
      eventFlag: 'NONE',
    });

    // OYO-002: zero deduction (₦0) with no event filed
    await db.insert(submissionRows).values({
      submissionId,
      rowNumber: 2,
      staffId: 'OYO-002',
      month: prevPeriod,
      amountDeducted: '0.00',
      payrollBatchReference: 'PB-001',
      mdaCode: 'EDU',
      eventFlag: 'NONE',
    });

    // OYO-004: zero deduction but has event filed (RETIREMENT) — should be excluded
    await db.insert(submissionRows).values({
      submissionId,
      rowNumber: 3,
      staffId: 'OYO-004',
      month: prevPeriod,
      amountDeducted: '0.00',
      payrollBatchReference: 'PB-001',
      mdaCode: 'EDU',
      eventFlag: 'RETIREMENT',
    });

    // Create an older submission to establish a "last non-zero deduction" for OYO-002
    const olderPeriod = format(subMonths(now, 3), 'yyyy-MM');
    const olderSubmissionId = generateUuidv7();
    await db.insert(mdaSubmissions).values({
      id: olderSubmissionId,
      mdaId: mda1Id,
      uploadedBy: userId,
      period: olderPeriod,
      referenceNumber: `REF-PRESUB-${olderPeriod}`,
      status: 'confirmed',
      recordCount: 1,
    });

    await db.insert(submissionRows).values({
      submissionId: olderSubmissionId,
      rowNumber: 1,
      staffId: 'OYO-002',
      month: olderPeriod,
      amountDeducted: '7666.50',
      payrollBatchReference: 'PB-OLDER',
      mdaCode: 'EDU',
      eventFlag: 'NONE',
    });
  }, 30000);

  afterAll(async () => {
    await resetDb();
  });

  // AC 3: Approaching retirement returns only loans within 12-month window
  it('approaching retirement returns only loans within 12-month window for requested MDA', async () => {
    const result = await getCheckpointData(mda1Id);

    // Only OYO-001 (6 months away) should appear
    // OYO-002 (18 months) is outside window
    // OYO-003 (COMPLETED) is excluded by status filter
    // OYO-004 (past retirement) is excluded by > CURRENT_DATE filter
    // OYO-006 (no retirement date) excluded by isNotNull filter
    expect(result.approachingRetirement).toHaveLength(1);
    expect(result.approachingRetirement[0].staffId).toBe('OYO-001');
    expect(result.approachingRetirement[0].staffName).toBe('Alice Approaching');
    expect(result.approachingRetirement[0].daysUntilRetirement).toBeGreaterThan(0);
    expect(result.approachingRetirement[0].daysUntilRetirement).toBeLessThanOrEqual(366);
  });

  // AC 3: Zero-deduction detection returns only staff with ₦0 submissions
  it('zero-deduction detection returns staff with ₦0 deduction and no event filed', async () => {
    const result = await getCheckpointData(mda1Id);

    // OYO-002 has ₦0 deduction with eventFlag='NONE' → should appear
    // OYO-004 has ₦0 deduction but eventFlag='RETIREMENT' → excluded
    // OYO-006 has no submission row at all → should appear (missing row detection)
    const zeroStaffIds = result.zeroDeduction.map((z) => z.staffId);
    expect(zeroStaffIds).toContain('OYO-002');
    expect(zeroStaffIds).toContain('OYO-006');
    expect(zeroStaffIds).not.toContain('OYO-001'); // had normal deduction
    expect(zeroStaffIds).not.toContain('OYO-004'); // had event filed
  });

  // AC 3: Zero-deduction shows last non-zero deduction date
  it('zero-deduction shows last non-zero deduction date for staff with prior payments', async () => {
    const result = await getCheckpointData(mda1Id);

    const oyo002 = result.zeroDeduction.find((z) => z.staffId === 'OYO-002');
    expect(oyo002).toBeDefined();
    // OYO-002 had a ₦7,666.50 deduction 3 months ago
    expect(oyo002!.lastDeductionDate).not.toBe('N/A');
    expect(oyo002!.daysSinceLastDeduction).toBeGreaterThan(0);
  });

  // AC 3: MDA scoping — data from MDA-2 does not appear in MDA-1 results
  it('MDA scoping — MDA-2 data does not appear in MDA-1 results', async () => {
    const result = await getCheckpointData(mda1Id);

    // OYO-005 belongs to MDA-2 — should not appear in any section
    const allStaffIds = [
      ...result.approachingRetirement.map((r) => r.staffId),
      ...result.zeroDeduction.map((z) => z.staffId),
    ];
    expect(allStaffIds).not.toContain('OYO-005');
  });

  // AC 3: Excludes non-ACTIVE loans (COMPLETED, TRANSFERRED, etc.)
  it('excludes non-ACTIVE loans from all sections', async () => {
    const result = await getCheckpointData(mda1Id);

    // OYO-003 is COMPLETED — should not appear anywhere
    const allStaffIds = [
      ...result.approachingRetirement.map((r) => r.staffId),
      ...result.zeroDeduction.map((z) => z.staffId),
    ];
    expect(allStaffIds).not.toContain('OYO-003');
  });

  // AC 3: MDA with no submissions — retirement data present but no submission history
  it('returns approaching retirement but null lastSubmissionDate for MDA with no submissions', async () => {
    // MDA 2 has one loan (OYO-005) but no submissions at all
    const result = await getCheckpointData(mda2Id);

    // OYO-005 has retirement in 4 months → should appear in retirement
    expect(result.approachingRetirement).toHaveLength(1);
    expect(result.approachingRetirement[0].staffId).toBe('OYO-005');

    // No submissions for MDA-2, so OYO-005 should appear as "missing row" in zero deduction
    expect(result.zeroDeduction.length).toBeGreaterThanOrEqual(1);

    // Last submission date should be null (never submitted)
    expect(result.lastSubmissionDate).toBeNull();
    expect(result.pendingEvents).toEqual([]);
  });

  // Last submission date uses most recent confirmed submission
  it('returns last submission date from most recent confirmed submission', async () => {
    const result = await getCheckpointData(mda1Id);

    // MDA 1 has a confirmed submission for prevPeriod
    expect(result.lastSubmissionDate).not.toBeNull();
    expect(result.submissionPeriod).toMatch(/^\d{4}-\d{2}$/);
  });
});
