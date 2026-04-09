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
  autoStopCertificates,
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

// ─── Certificate Endpoints (Story 8.2) ───────────────────────────────

describe('GET /api/certificates/:loanId', () => {
  let certLoanId: string;

  beforeAll(async () => {
    // Create a completed loan with certificate for these tests
    certLoanId = generateUuidv7();
    await db.insert(loans).values({
      id: certLoanId,
      staffId: 'CERT-INT-001',
      staffName: 'Certificate Test Staff',
      gradeLevel: 'GL-10',
      mdaId: testMdaId,
      principalAmount: PRINCIPAL,
      interestRate: RATE,
      tenureMonths: TENURE,
      monthlyDeductionAmount: '3148.06',
      approvalDate: new Date('2024-01-01'),
      firstDeductionDate: new Date('2024-02-01'),
      loanReference: 'VLC-CERT-INT-001',
      status: 'COMPLETED',
      limitedComputation: false,
    });

    await db.insert(loanStateTransitions).values([
      {
        id: generateUuidv7(),
        loanId: certLoanId,
        fromStatus: 'APPLIED',
        toStatus: 'ACTIVE',
        transitionedBy: testUserId,
        reason: 'Test',
      },
      {
        id: generateUuidv7(),
        loanId: certLoanId,
        fromStatus: 'ACTIVE',
        toStatus: 'COMPLETED',
        transitionedBy: testUserId,
        reason: 'Auto-stop',
      },
    ]);

    await db.insert(loanCompletions).values({
      id: generateUuidv7(),
      loanId: certLoanId,
      completionDate: new Date('2026-04-05'),
      finalBalance: '0.00',
      totalPaid: TOTAL_LOAN,
      totalPrincipalPaid: PRINCIPAL,
      totalInterestPaid: INTEREST,
      triggerSource: 'manual',
    });

    // Create certificate directly for deterministic testing
    await db.insert(autoStopCertificates).values({
      id: generateUuidv7(),
      loanId: certLoanId,
      certificateId: 'ASC-2026-04-9001',
      verificationToken: 'a'.repeat(64),
      beneficiaryName: 'Certificate Test Staff',
      staffId: 'CERT-INT-001',
      mdaId: testMdaId,
      mdaName: 'Auto-Stop Integration MDA',
      loanReference: 'VLC-CERT-INT-001',
      originalPrincipal: PRINCIPAL,
      totalPaid: TOTAL_LOAN,
      totalInterestPaid: INTEREST,
      completionDate: new Date('2026-04-05'),
    });
  });

  it('returns certificate metadata for completed loan', async () => {
    const res = await request(app)
      .get(`/api/certificates/${certLoanId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.certificateId).toBe('ASC-2026-04-9001');
    expect(res.body.data.verificationToken).toBe('a'.repeat(64));
    expect(res.body.data.beneficiaryName).toBe('Certificate Test Staff');
    expect(res.body.data.mdaName).toBe('Auto-Stop Integration MDA');
    expect(res.body.data.loanReference).toBe('VLC-CERT-INT-001');
  });

  it('returns 404 for active loan without certificate', async () => {
    const activeLoanId = generateUuidv7();
    await db.insert(loans).values({
      id: activeLoanId,
      staffId: 'CERT-NOEXIST-001',
      staffName: 'No Cert Staff',
      gradeLevel: 'GL-08',
      mdaId: testMdaId,
      principalAmount: '50000.00',
      interestRate: RATE,
      tenureMonths: TENURE,
      monthlyDeductionAmount: '0.00',
      approvalDate: new Date('2024-01-01'),
      firstDeductionDate: new Date('2024-02-01'),
      loanReference: 'VLC-CERT-INT-NOEXIST',
      status: 'ACTIVE',
      limitedComputation: false,
    });

    const res = await request(app)
      .get(`/api/certificates/${activeLoanId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });
});

describe('GET /api/certificates/:loanId/pdf', () => {
  let certLoanId: string;

  beforeAll(async () => {
    certLoanId = generateUuidv7();
    await db.insert(loans).values({
      id: certLoanId,
      staffId: 'CERT-PDF-001',
      staffName: 'PDF Test Staff',
      gradeLevel: 'GL-10',
      mdaId: testMdaId,
      principalAmount: PRINCIPAL,
      interestRate: RATE,
      tenureMonths: TENURE,
      monthlyDeductionAmount: '3148.06',
      approvalDate: new Date('2024-01-01'),
      firstDeductionDate: new Date('2024-02-01'),
      loanReference: 'VLC-CERT-PDF-001',
      status: 'COMPLETED',
      limitedComputation: false,
    });

    await db.insert(autoStopCertificates).values({
      id: generateUuidv7(),
      loanId: certLoanId,
      certificateId: 'ASC-2026-04-9002',
      verificationToken: 'b'.repeat(64),
      beneficiaryName: 'PDF Test Staff',
      staffId: 'CERT-PDF-001',
      mdaId: testMdaId,
      mdaName: 'Auto-Stop Integration MDA',
      loanReference: 'VLC-CERT-PDF-001',
      originalPrincipal: PRINCIPAL,
      totalPaid: TOTAL_LOAN,
      totalInterestPaid: INTEREST,
      completionDate: new Date('2026-04-05'),
    });
  });

  it('downloads PDF for completed loan with certificate', async () => {
    const res = await request(app)
      .get(`/api/certificates/${certLoanId}/pdf`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toContain('auto-stop-certificate-ASC-2026-04-9002.pdf');
    expect(res.body).toBeTruthy();
  }, 30000);

  it('returns 404 for loan without certificate', async () => {
    const noCertLoanId = generateUuidv7();
    await db.insert(loans).values({
      id: noCertLoanId,
      staffId: 'CERT-PDF-NONE-001',
      staffName: 'No PDF Staff',
      gradeLevel: 'GL-08',
      mdaId: testMdaId,
      principalAmount: '50000.00',
      interestRate: RATE,
      tenureMonths: TENURE,
      monthlyDeductionAmount: '0.00',
      approvalDate: new Date('2024-01-01'),
      firstDeductionDate: new Date('2024-02-01'),
      loanReference: 'VLC-CERT-PDF-NONE',
      status: 'ACTIVE',
      limitedComputation: false,
    });

    const res = await request(app)
      .get(`/api/certificates/${noCertLoanId}/pdf`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });
});

// ─── Public Verification Endpoint (Story 8.2, Task 8) ────────────────

describe('GET /api/public/verify/:certificateId', () => {
  it('verifies a valid certificate', async () => {
    const res = await request(app)
      .get('/api/public/verify/ASC-2026-04-9001');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.valid).toBe(true);
    expect(res.body.data.message).toContain('Verified');
    expect(res.body.data.message).toContain('ASC-2026-04-9001');
    expect(res.body.data.beneficiaryName).toBe('Certificate Test Staff');
    expect(res.body.data.mdaName).toBe('Auto-Stop Integration MDA');
    expect(res.body.data.completionDate).toBeTruthy();
    // AC: 4 — should NOT contain financial details
    expect(res.body.data.originalPrincipal).toBeUndefined();
    expect(res.body.data.totalPaid).toBeUndefined();
  });

  it('returns not-found for invalid certificate', async () => {
    const res = await request(app)
      .get('/api/public/verify/ASC-9999-99-9999');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.valid).toBe(false);
    expect(res.body.data.message).toBe('Certificate not found');
  });

  it('does not require authentication', async () => {
    // No Authorization header — should still succeed
    const res = await request(app)
      .get('/api/public/verify/ASC-2026-04-9001');

    expect(res.status).toBe(200);
    expect(res.body.data.valid).toBe(true);
  });
});

// ─── Certificate List Endpoint (Story 15.0i) ─────────────────────────

describe('GET /api/certificates', () => {
  // Use a dedicated MDA so this scope test is fully isolated from prior tests.
  let listMdaId: string;
  let listAdminId: string;
  let listAdminToken: string;
  let otherMdaId: string;
  let otherOfficerId: string;
  let otherOfficerToken: string;

  beforeAll(async () => {
    listMdaId = generateUuidv7();
    await db.insert(mdas).values({
      id: listMdaId,
      name: 'Cert List Primary MDA',
      code: 'CLP1',
      abbreviation: 'CLP1',
    });

    otherMdaId = generateUuidv7();
    await db.insert(mdas).values({
      id: otherMdaId,
      name: 'Cert List Other MDA',
      code: 'CLO2',
      abbreviation: 'CLO2',
    });

    // Dedicated SUPER_ADMIN for the list endpoint tests
    listAdminId = generateUuidv7();
    await db.insert(users).values({
      id: listAdminId,
      email: 'cert-list-admin@test.com',
      hashedPassword: 'hashed',
      firstName: 'List',
      lastName: 'Admin',
      role: 'super_admin',
    });
    listAdminToken = signAccessToken({
      userId: listAdminId,
      email: 'cert-list-admin@test.com',
      role: 'super_admin',
      mdaId: null,
      mustChangePassword: false,
    });

    // MDA officer scoped to "other" MDA — must NOT see primary-MDA certificates
    otherOfficerId = generateUuidv7();
    await db.insert(users).values({
      id: otherOfficerId,
      email: 'cert-list-other-officer@test.com',
      hashedPassword: 'hashed',
      firstName: 'Other',
      lastName: 'Officer',
      role: 'mda_officer',
      mdaId: otherMdaId,
    });
    otherOfficerToken = signAccessToken({
      userId: otherOfficerId,
      email: 'cert-list-other-officer@test.com',
      role: 'mda_officer',
      mdaId: otherMdaId,
      mustChangePassword: false,
    });

    // Seed three certificates for primary MDA with distinct notification states.
    // Notified (both timestamps set)
    const notifiedLoanId = generateUuidv7();
    await db.insert(loans).values({
      id: notifiedLoanId,
      staffId: 'CLP-001',
      staffName: 'Notified Beneficiary',
      gradeLevel: 'GL-10',
      mdaId: listMdaId,
      principalAmount: PRINCIPAL,
      interestRate: RATE,
      tenureMonths: TENURE,
      monthlyDeductionAmount: '3148.06',
      approvalDate: new Date('2024-01-01'),
      firstDeductionDate: new Date('2024-02-01'),
      loanReference: 'VLC-CLP-001',
      status: 'COMPLETED',
      limitedComputation: false,
    });
    await db.insert(autoStopCertificates).values({
      id: generateUuidv7(),
      loanId: notifiedLoanId,
      certificateId: 'ASC-2026-04-7001',
      verificationToken: 'n'.repeat(64),
      beneficiaryName: 'Notified Beneficiary',
      staffId: 'CLP-001',
      mdaId: listMdaId,
      mdaName: 'Cert List Primary MDA',
      loanReference: 'VLC-CLP-001',
      originalPrincipal: PRINCIPAL,
      totalPaid: TOTAL_LOAN,
      totalInterestPaid: INTEREST,
      completionDate: new Date('2026-04-01'),
      generatedAt: new Date('2026-04-02T10:00:00Z'),
      notifiedMdaAt: new Date('2026-04-02T10:05:00Z'),
      notifiedBeneficiaryAt: new Date('2026-04-02T10:06:00Z'),
    });

    // Pending (no notifications yet)
    const pendingLoanId = generateUuidv7();
    await db.insert(loans).values({
      id: pendingLoanId,
      staffId: 'CLP-002',
      staffName: 'Pending Beneficiary',
      gradeLevel: 'GL-12',
      mdaId: listMdaId,
      principalAmount: PRINCIPAL,
      interestRate: RATE,
      tenureMonths: TENURE,
      monthlyDeductionAmount: '3148.06',
      approvalDate: new Date('2024-01-01'),
      firstDeductionDate: new Date('2024-02-01'),
      loanReference: 'VLC-CLP-002',
      status: 'COMPLETED',
      limitedComputation: false,
    });
    await db.insert(autoStopCertificates).values({
      id: generateUuidv7(),
      loanId: pendingLoanId,
      certificateId: 'ASC-2026-04-7002',
      verificationToken: 'p'.repeat(64),
      beneficiaryName: 'Pending Beneficiary',
      staffId: 'CLP-002',
      mdaId: listMdaId,
      mdaName: 'Cert List Primary MDA',
      loanReference: 'VLC-CLP-002',
      originalPrincipal: PRINCIPAL,
      totalPaid: TOTAL_LOAN,
      totalInterestPaid: INTEREST,
      completionDate: new Date('2026-04-03'),
      generatedAt: new Date('2026-04-03T11:00:00Z'),
      notifiedMdaAt: null,
      notifiedBeneficiaryAt: null,
    });

    // Partial (MDA notified, beneficiary not)
    const partialLoanId = generateUuidv7();
    await db.insert(loans).values({
      id: partialLoanId,
      staffId: 'CLP-003',
      staffName: 'Partial Beneficiary',
      gradeLevel: 'GL-08',
      mdaId: listMdaId,
      principalAmount: PRINCIPAL,
      interestRate: RATE,
      tenureMonths: TENURE,
      monthlyDeductionAmount: '3148.06',
      approvalDate: new Date('2024-01-01'),
      firstDeductionDate: new Date('2024-02-01'),
      loanReference: 'VLC-CLP-003',
      status: 'COMPLETED',
      limitedComputation: false,
    });
    await db.insert(autoStopCertificates).values({
      id: generateUuidv7(),
      loanId: partialLoanId,
      certificateId: 'ASC-2026-04-7003',
      verificationToken: 'r'.repeat(64),
      beneficiaryName: 'Partial Beneficiary',
      staffId: 'CLP-003',
      mdaId: listMdaId,
      mdaName: 'Cert List Primary MDA',
      loanReference: 'VLC-CLP-003',
      originalPrincipal: PRINCIPAL,
      totalPaid: TOTAL_LOAN,
      totalInterestPaid: INTEREST,
      completionDate: new Date('2026-04-04'),
      generatedAt: new Date('2026-04-04T09:00:00Z'),
      notifiedMdaAt: new Date('2026-04-04T09:05:00Z'),
      notifiedBeneficiaryAt: null,
    });

    // One certificate for OTHER MDA — used to assert MDA scoping
    const otherLoanId = generateUuidv7();
    await db.insert(loans).values({
      id: otherLoanId,
      staffId: 'CLO-001',
      staffName: 'Other MDA Beneficiary',
      gradeLevel: 'GL-10',
      mdaId: otherMdaId,
      principalAmount: PRINCIPAL,
      interestRate: RATE,
      tenureMonths: TENURE,
      monthlyDeductionAmount: '3148.06',
      approvalDate: new Date('2024-01-01'),
      firstDeductionDate: new Date('2024-02-01'),
      loanReference: 'VLC-CLO-001',
      status: 'COMPLETED',
      limitedComputation: false,
    });
    await db.insert(autoStopCertificates).values({
      id: generateUuidv7(),
      loanId: otherLoanId,
      certificateId: 'ASC-2026-04-7004',
      verificationToken: 'o'.repeat(64),
      beneficiaryName: 'Other MDA Beneficiary',
      staffId: 'CLO-001',
      mdaId: otherMdaId,
      mdaName: 'Cert List Other MDA',
      loanReference: 'VLC-CLO-001',
      originalPrincipal: PRINCIPAL,
      totalPaid: TOTAL_LOAN,
      totalInterestPaid: INTEREST,
      completionDate: new Date('2026-04-05'),
      generatedAt: new Date('2026-04-05T08:00:00Z'),
      notifiedMdaAt: null,
      notifiedBeneficiaryAt: null,
    });
  });

  it('returns paginated certificates wrapped in success/data envelope', async () => {
    const res = await request(app)
      .get('/api/certificates')
      .set('Authorization', `Bearer ${listAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data.data)).toBe(true);
    expect(typeof res.body.data.total).toBe('number');
    expect(res.body.data.page).toBe(1);
    expect(res.body.data.pageSize).toBe(25);
    // Sensitive token must NEVER appear in list response
    for (const item of res.body.data.data) {
      expect(item.verificationToken).toBeUndefined();
    }
  });

  it('filters by mdaId — primary MDA returns its 3 certificates', async () => {
    const res = await request(app)
      .get(`/api/certificates?mdaId=${listMdaId}`)
      .set('Authorization', `Bearer ${listAdminToken}`);

    expect(res.status).toBe(200);
    const ids = res.body.data.data.map((c: { certificateId: string }) => c.certificateId);
    expect(ids).toEqual(
      expect.arrayContaining(['ASC-2026-04-7001', 'ASC-2026-04-7002', 'ASC-2026-04-7003']),
    );
    expect(ids).not.toContain('ASC-2026-04-7004');
    expect(res.body.data.total).toBe(3);
  });

  it('filters notificationStatus=notified', async () => {
    const res = await request(app)
      .get(`/api/certificates?mdaId=${listMdaId}&notificationStatus=notified`)
      .set('Authorization', `Bearer ${listAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.data[0].certificateId).toBe('ASC-2026-04-7001');
  });

  it('filters notificationStatus=pending', async () => {
    const res = await request(app)
      .get(`/api/certificates?mdaId=${listMdaId}&notificationStatus=pending`)
      .set('Authorization', `Bearer ${listAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.data[0].certificateId).toBe('ASC-2026-04-7002');
  });

  it('filters notificationStatus=partial', async () => {
    const res = await request(app)
      .get(`/api/certificates?mdaId=${listMdaId}&notificationStatus=partial`)
      .set('Authorization', `Bearer ${listAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.data[0].certificateId).toBe('ASC-2026-04-7003');
  });

  it('sorts by completionDate ascending', async () => {
    const res = await request(app)
      .get(`/api/certificates?mdaId=${listMdaId}&sortBy=completionDate&sortOrder=asc`)
      .set('Authorization', `Bearer ${listAdminToken}`);

    expect(res.status).toBe(200);
    const dates = res.body.data.data.map((c: { completionDate: string }) => c.completionDate);
    const sorted = [...dates].sort();
    expect(dates).toEqual(sorted);
  });

  it('sorts by generatedAt ascending (default-column toggle)', async () => {
    // Default sort is generatedAt DESC. Toggling to ASC must reverse the order.
    const res = await request(app)
      .get(`/api/certificates?mdaId=${listMdaId}&sortBy=generatedAt&sortOrder=asc`)
      .set('Authorization', `Bearer ${listAdminToken}`);

    expect(res.status).toBe(200);
    const generated = res.body.data.data.map((c: { generatedAt: string }) => c.generatedAt);
    const sorted = [...generated].sort();
    expect(generated).toEqual(sorted);
  });

  it('paginates with limit=2', async () => {
    const res = await request(app)
      .get(`/api/certificates?mdaId=${listMdaId}&limit=2&page=1`)
      .set('Authorization', `Bearer ${listAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.data).toHaveLength(2);
    expect(res.body.data.pageSize).toBe(2);
    expect(res.body.data.total).toBe(3);
  });

  it('MDA scoping: officer of other MDA does NOT see primary-MDA certificates', async () => {
    const res = await request(app)
      .get('/api/certificates')
      .set('Authorization', `Bearer ${otherOfficerToken}`);

    expect(res.status).toBe(200);
    const ids = res.body.data.data.map((c: { certificateId: string }) => c.certificateId);
    expect(ids).not.toContain('ASC-2026-04-7001');
    expect(ids).not.toContain('ASC-2026-04-7002');
    expect(ids).not.toContain('ASC-2026-04-7003');
    // Officer should only see their own MDA's certificate
    expect(ids).toContain('ASC-2026-04-7004');
  });

  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/certificates');
    expect(res.status).toBe(401);
  });

  it('rejects invalid notificationStatus values via Zod validation', async () => {
    const res = await request(app)
      .get('/api/certificates?notificationStatus=banana')
      .set('Authorization', `Bearer ${listAdminToken}`);

    expect(res.status).toBe(400);
  });

  it('rejects invalid sortBy values via Zod validation', async () => {
    const res = await request(app)
      .get('/api/certificates?sortBy=mango')
      .set('Authorization', `Bearer ${listAdminToken}`);

    expect(res.status).toBe(400);
  });

  it('rejects invalid sortOrder values via Zod validation', async () => {
    const res = await request(app)
      .get('/api/certificates?sortOrder=sideways')
      .set('Authorization', `Bearer ${listAdminToken}`);

    expect(res.status).toBe(400);
  });

  it('does NOT match the literal "certificates" segment as a :loanId param', async () => {
    // Regression guard: route ordering must place GET /certificates BEFORE
    // GET /certificates/:loanId, otherwise Express would try to look up a
    // loan with id="certificates" and respond 404.
    const res = await request(app)
      .get('/api/certificates')
      .set('Authorization', `Bearer ${listAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('total');
  });
});
