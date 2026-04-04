/**
 * Auto-Stop Integration Tests (Story 8.1)
 *
 * Tests the full auto-stop flow against a real database:
 * - POST /api/auto-stop/scan endpoint (manual trigger)
 * - Post-completion deduction detection
 * - limitedComputation exclusion
 * - Role-based access control
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import Decimal from 'decimal.js';
import app from '../app';
import { db } from '../db/index';
import {
  users,
  mdas,
  loans,
  ledgerEntries,
  loanStateTransitions,
  loanCompletions,
  observations,
  mdaSubmissions,
  submissionRows,
} from '../db/schema';
import { signAccessToken } from '../lib/jwt';
import { generateUuidv7 } from '../lib/uuidv7';
import { resetRateLimiters } from '../middleware/rateLimiter';
import { resetDb } from '../test/resetDb';
import { detectPostCompletionDeductions } from '../services/autoStopService';

// ─── Test fixture IDs ──────────────────────────────────────────────
let testMdaId: string;
let testUserId: string;
let officerUserId: string;
let adminToken: string;
let officerToken: string;

const PRINCIPAL = '100000.00';
const RATE = '13.330';
const TENURE = 36;
const TOTAL_LOAN = new Decimal(PRINCIPAL)
  .mul(new Decimal('1').plus(new Decimal(RATE).div(100)))
  .toFixed(2); // 113330.00
const INTEREST = new Decimal(TOTAL_LOAN).minus(PRINCIPAL).toFixed(2);

beforeAll(async () => {
  resetRateLimiters();
  await resetDb();

  // Create test MDA
  testMdaId = generateUuidv7();
  await db.insert(mdas).values({
    id: testMdaId,
    name: 'Auto-Stop Integration MDA',
    code: 'AINT',
    abbreviation: 'AutoStopInt',
  });

  // Create SUPER_ADMIN user (also serves as system user for transitions)
  testUserId = generateUuidv7();
  await db.insert(users).values({
    id: testUserId,
    email: 'autostop-admin@test.com',
    hashedPassword: 'hashed',
    firstName: 'AutoStop',
    lastName: 'Admin',
    role: 'super_admin',
  });

  adminToken = signAccessToken({
    userId: testUserId,
    email: 'autostop-admin@test.com',
    role: 'super_admin',
    mdaId: null,
    mustChangePassword: false,
  });

  // Create MDA officer user (for 403 test)
  officerUserId = generateUuidv7();
  await db.insert(users).values({
    id: officerUserId,
    email: 'autostop-officer@test.com',
    hashedPassword: 'hashed',
    firstName: 'AutoStop',
    lastName: 'Officer',
    role: 'mda_officer',
    mdaId: testMdaId,
  });

  officerToken = signAccessToken({
    userId: officerUserId,
    email: 'autostop-officer@test.com',
    role: 'mda_officer',
    mdaId: testMdaId,
    mustChangePassword: false,
  });
});

afterAll(async () => {
  await resetDb();
});

// ─── POST /api/auto-stop/scan ──────────────────────────────────────

describe('POST /api/auto-stop/scan', () => {
  it('triggers auto-stop for active loan with zero balance', async () => {
    const loanId = generateUuidv7();
    await db.insert(loans).values({
      id: loanId,
      staffId: 'ASTOP-001',
      staffName: 'Zero Balance Staff',
      gradeLevel: 'GL-10',
      mdaId: testMdaId,
      principalAmount: PRINCIPAL,
      interestRate: RATE,
      tenureMonths: TENURE,
      monthlyDeductionAmount: '3148.06',
      approvalDate: new Date('2024-01-01'),
      firstDeductionDate: new Date('2024-02-01'),
      loanReference: 'VLC-ASTOP-INT-001',
      status: 'ACTIVE',
      limitedComputation: false,
    });

    await db.insert(loanStateTransitions).values({
      id: generateUuidv7(),
      loanId,
      fromStatus: 'APPLIED',
      toStatus: 'ACTIVE',
      transitionedBy: testUserId,
      reason: 'Test baseline',
    });

    // Ledger entry covers full loan amount → balance = 0
    await db.insert(ledgerEntries).values({
      id: generateUuidv7(),
      loanId,
      staffId: 'ASTOP-001',
      mdaId: testMdaId,
      entryType: 'MIGRATION_BASELINE',
      amount: TOTAL_LOAN,
      principalComponent: PRINCIPAL,
      interestComponent: INTEREST,
      periodMonth: 1,
      periodYear: 2024,
      source: 'migration',
      postedBy: testUserId,
    });

    const res = await request(app)
      .post('/api/auto-stop/scan')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.completedCount).toBeGreaterThanOrEqual(1);

    // Verify loan transitioned to COMPLETED
    const [loan] = await db
      .select({ status: loans.status })
      .from(loans)
      .where(eq(loans.id, loanId));
    expect(loan.status).toBe('COMPLETED');

    // Verify loan_completions record exists
    const [completion] = await db
      .select()
      .from(loanCompletions)
      .where(eq(loanCompletions.loanId, loanId));
    expect(completion).toBeDefined();
    expect(completion.triggerSource).toBe('manual');
    expect(new Decimal(completion.finalBalance).lte(0)).toBe(true);
    expect(new Decimal(completion.totalPaid).eq(TOTAL_LOAN)).toBe(true);
  });

  it('skips limitedComputation loans', async () => {
    const loanId = generateUuidv7();
    await db.insert(loans).values({
      id: loanId,
      staffId: 'ASTOP-LTD-001',
      staffName: 'Limited Comp Staff',
      gradeLevel: 'GL-08',
      mdaId: testMdaId,
      principalAmount: '50000.00',
      interestRate: RATE,
      tenureMonths: TENURE,
      monthlyDeductionAmount: '0.00',
      approvalDate: new Date('2024-01-01'),
      firstDeductionDate: new Date('2024-02-01'),
      loanReference: 'VLC-ASTOP-INT-LTD-001',
      status: 'ACTIVE',
      limitedComputation: true,
    });

    await db.insert(loanStateTransitions).values({
      id: generateUuidv7(),
      loanId,
      fromStatus: 'APPLIED',
      toStatus: 'ACTIVE',
      transitionedBy: testUserId,
      reason: 'Test limited',
    });

    const res = await request(app)
      .post('/api/auto-stop/scan')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);

    // Loan should remain ACTIVE — limitedComputation excluded
    const [loan] = await db
      .select({ status: loans.status })
      .from(loans)
      .where(eq(loans.id, loanId));
    expect(loan.status).toBe('ACTIVE');
  });

  it('requires SUPER_ADMIN role', async () => {
    const res = await request(app)
      .post('/api/auto-stop/scan')
      .set('Authorization', `Bearer ${officerToken}`);

    expect(res.status).toBe(403);
  });
});

// ─── Post-Completion Deduction Detection ───────────────────────────

describe('detectPostCompletionDeductions', () => {
  it('creates observation for deduction on completed loan', async () => {
    // Create a COMPLETED loan with completion record
    const loanId = generateUuidv7();
    await db.insert(loans).values({
      id: loanId,
      staffId: 'ASTOP-PCD-001',
      staffName: 'Completed Loan Staff',
      gradeLevel: 'GL-12',
      mdaId: testMdaId,
      principalAmount: PRINCIPAL,
      interestRate: RATE,
      tenureMonths: TENURE,
      monthlyDeductionAmount: '3148.06',
      approvalDate: new Date('2024-01-01'),
      firstDeductionDate: new Date('2024-02-01'),
      loanReference: 'VLC-ASTOP-INT-PCD-001',
      status: 'COMPLETED',
      limitedComputation: false,
    });

    await db.insert(loanStateTransitions).values([
      {
        id: generateUuidv7(),
        loanId,
        fromStatus: 'APPLIED',
        toStatus: 'ACTIVE',
        transitionedBy: testUserId,
        reason: 'Test baseline',
      },
      {
        id: generateUuidv7(),
        loanId,
        fromStatus: 'ACTIVE',
        toStatus: 'COMPLETED',
        transitionedBy: testUserId,
        reason: 'Auto-stop: zero balance detected',
      },
    ]);

    await db.insert(loanCompletions).values({
      id: generateUuidv7(),
      loanId,
      completionDate: new Date('2026-03-01'),
      finalBalance: '0.00',
      totalPaid: TOTAL_LOAN,
      totalPrincipalPaid: PRINCIPAL,
      totalInterestPaid: INTEREST,
      triggerSource: 'background_scan',
    });

    // Create a submission with deduction for the completed loan's staff
    const submissionId = generateUuidv7();
    await db.insert(mdaSubmissions).values({
      id: submissionId,
      mdaId: testMdaId,
      uploadedBy: testUserId,
      period: '2026-04',
      referenceNumber: 'ASTOP-INT-SUB-001',
      status: 'confirmed',
      recordCount: 1,
      source: 'csv',
    });

    await db.insert(submissionRows).values({
      id: generateUuidv7(),
      submissionId,
      rowNumber: 1,
      staffId: 'ASTOP-PCD-001',
      month: '2026-04',
      amountDeducted: '3148.06',
      payrollBatchReference: 'BATCH-001',
      mdaCode: 'AINT',
      eventFlag: 'NONE',
    });

    const result = await detectPostCompletionDeductions(submissionId);
    expect(result.created).toBe(1);

    // Verify observation was created with correct data
    const obs = await db
      .select()
      .from(observations)
      .where(eq(observations.type, 'post_completion_deduction'));

    const match = obs.find(o => o.staffId === 'ASTOP-PCD-001');
    expect(match).toBeDefined();
    expect(match!.description).toContain('Completed Loan Staff');
    expect(match!.description).toContain('2026-04');
    expect(match!.sourceReference).toBeTruthy();
  });

  it('does not create observation for active loan deduction', async () => {
    const loanId = generateUuidv7();
    await db.insert(loans).values({
      id: loanId,
      staffId: 'ASTOP-ACT-001',
      staffName: 'Active Loan Staff',
      gradeLevel: 'GL-10',
      mdaId: testMdaId,
      principalAmount: PRINCIPAL,
      interestRate: RATE,
      tenureMonths: TENURE,
      monthlyDeductionAmount: '3148.06',
      approvalDate: new Date('2024-01-01'),
      firstDeductionDate: new Date('2024-02-01'),
      loanReference: 'VLC-ASTOP-INT-ACT-001',
      status: 'ACTIVE',
      limitedComputation: false,
    });

    await db.insert(loanStateTransitions).values({
      id: generateUuidv7(),
      loanId,
      fromStatus: 'APPLIED',
      toStatus: 'ACTIVE',
      transitionedBy: testUserId,
      reason: 'Test',
    });

    const submissionId = generateUuidv7();
    await db.insert(mdaSubmissions).values({
      id: submissionId,
      mdaId: testMdaId,
      uploadedBy: testUserId,
      period: '2026-04',
      referenceNumber: 'ASTOP-INT-SUB-002',
      status: 'confirmed',
      recordCount: 1,
      source: 'csv',
    });

    await db.insert(submissionRows).values({
      id: generateUuidv7(),
      submissionId,
      rowNumber: 1,
      staffId: 'ASTOP-ACT-001',
      month: '2026-04',
      amountDeducted: '3148.06',
      payrollBatchReference: 'BATCH-002',
      mdaCode: 'AINT',
      eventFlag: 'NONE',
    });

    const result = await detectPostCompletionDeductions(submissionId);
    expect(result.created).toBe(0);
  });
});
