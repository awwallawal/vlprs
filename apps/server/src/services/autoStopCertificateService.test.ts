/**
 * Auto-Stop Certificate Service — Unit Tests (Story 8.2)
 *
 * Tests certificate ID generation, verification token generation,
 * QR code generation, and certificate creation service.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import {
  users,
  mdas,
  loans,
  loanStateTransitions,
  loanCompletions,
  autoStopCertificates,
} from '../db/schema';
import { generateUuidv7 } from '../lib/uuidv7';
import { resetDb } from '../test/resetDb';
import {
  generateCertificateId,
  generateVerificationToken,
  generateCertificate,
} from './autoStopCertificateService';
import { generateQrCodeDataUrl } from './autoStopCertificateQr';

// ─── Test Fixtures ──────────────────────────────────────────────────

let testMdaId: string;
let testUserId: string;
let testLoanId: string;
let testLoanIdB: string;

const PRINCIPAL = '100000.00';
const RATE = '13.330';
const TENURE = 36;

beforeAll(async () => {
  await resetDb();

  testMdaId = generateUuidv7();
  await db.insert(mdas).values({
    id: testMdaId,
    name: 'Certificate Test MDA',
    code: 'CTST',
    abbreviation: 'CertTest',
  });

  testUserId = generateUuidv7();
  await db.insert(users).values({
    id: testUserId,
    email: 'cert-test-admin@test.com',
    hashedPassword: 'hashed',
    firstName: 'Cert',
    lastName: 'Admin',
    role: 'super_admin',
  });

  // Create a completed loan
  testLoanId = generateUuidv7();
  await db.insert(loans).values({
    id: testLoanId,
    staffId: 'CERT-001',
    staffName: 'ALATISE BOSEDE SUSAINAH',
    gradeLevel: 'GL-10',
    mdaId: testMdaId,
    principalAmount: PRINCIPAL,
    interestRate: RATE,
    tenureMonths: TENURE,
    monthlyDeductionAmount: '3148.06',
    approvalDate: new Date('2024-01-01'),
    firstDeductionDate: new Date('2024-02-01'),
    loanReference: 'VL-2026-CTST-0001',
    status: 'COMPLETED',
    limitedComputation: false,
  });

  await db.insert(loanStateTransitions).values([
    {
      id: generateUuidv7(),
      loanId: testLoanId,
      fromStatus: 'APPLIED',
      toStatus: 'ACTIVE',
      transitionedBy: testUserId,
      reason: 'Test baseline',
    },
    {
      id: generateUuidv7(),
      loanId: testLoanId,
      fromStatus: 'ACTIVE',
      toStatus: 'COMPLETED',
      transitionedBy: testUserId,
      reason: 'Auto-stop',
    },
  ]);

  await db.insert(loanCompletions).values({
    id: generateUuidv7(),
    loanId: testLoanId,
    completionDate: new Date('2026-04-02'),
    finalBalance: '0.00',
    totalPaid: '113330.00',
    totalPrincipalPaid: PRINCIPAL,
    totalInterestPaid: '13330.00',
    triggerSource: 'background_scan',
  });

  // Second completed loan for sequential ID testing
  testLoanIdB = generateUuidv7();
  await db.insert(loans).values({
    id: testLoanIdB,
    staffId: 'CERT-002',
    staffName: 'ADEOYE JAMES OPEYEMI',
    gradeLevel: 'GL-12',
    mdaId: testMdaId,
    principalAmount: '200000.00',
    interestRate: RATE,
    tenureMonths: TENURE,
    monthlyDeductionAmount: '6296.11',
    approvalDate: new Date('2024-01-01'),
    firstDeductionDate: new Date('2024-02-01'),
    loanReference: 'VL-2026-CTST-0002',
    status: 'COMPLETED',
    limitedComputation: false,
  });

  await db.insert(loanStateTransitions).values([
    {
      id: generateUuidv7(),
      loanId: testLoanIdB,
      fromStatus: 'APPLIED',
      toStatus: 'ACTIVE',
      transitionedBy: testUserId,
      reason: 'Test baseline',
    },
    {
      id: generateUuidv7(),
      loanId: testLoanIdB,
      fromStatus: 'ACTIVE',
      toStatus: 'COMPLETED',
      transitionedBy: testUserId,
      reason: 'Auto-stop',
    },
  ]);

  await db.insert(loanCompletions).values({
    id: generateUuidv7(),
    loanId: testLoanIdB,
    completionDate: new Date('2026-04-05'),
    finalBalance: '0.00',
    totalPaid: '226660.00',
    totalPrincipalPaid: '200000.00',
    totalInterestPaid: '26660.00',
    triggerSource: 'ledger_entry',
  });
});

afterAll(async () => {
  await resetDb();
});

// ─── Certificate ID Generation (Task 2) ────────────────────────────

describe('generateCertificateId', () => {
  it('generates first certificate of month as 0001', async () => {
    // Use a future month that has no certificates
    const id = await generateCertificateId(2099, 1);
    expect(id).toBe('ASC-2099-01-0001');
  });

  it('generates sequential IDs within the same month', async () => {
    // Insert a certificate to establish a sequence
    await db.insert(autoStopCertificates).values({
      id: generateUuidv7(),
      loanId: testLoanId,
      certificateId: 'ASC-2098-06-0023',
      verificationToken: 'test-token-seq-23',
      beneficiaryName: 'Test Staff',
      staffId: 'TEST-001',
      mdaId: testMdaId,
      mdaName: 'Test MDA',
      loanReference: 'VL-TEST-001',
      originalPrincipal: '100000.00',
      totalPaid: '113330.00',
      totalInterestPaid: '13330.00',
      completionDate: new Date('2098-06-01'),
    });

    const nextId = await generateCertificateId(2098, 6);
    expect(nextId).toBe('ASC-2098-06-0024');

    // Clean up
    await db.delete(autoStopCertificates).where(eq(autoStopCertificates.loanId, testLoanId));
  });

  it('resets counter for a new month', async () => {
    const id = await generateCertificateId(2099, 5);
    expect(id).toBe('ASC-2099-05-0001');
  });
});

// ─── Verification Token Generation (Task 2.2) ──────────────────────

describe('generateVerificationToken', () => {
  it('generates a 64-character hex string', () => {
    const token = generateVerificationToken();
    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('generates unique tokens', () => {
    const tokens = new Set(Array.from({ length: 10 }, () => generateVerificationToken()));
    expect(tokens.size).toBe(10);
  });
});

// ─── QR Code Generation (Task 3) ───────────────────────────────────

describe('generateQrCodeDataUrl', () => {
  it('generates a valid data URL from verification URL', async () => {
    const dataUrl = await generateQrCodeDataUrl('https://vlprs.oyostate.gov.ng/verify/ASC-2026-04-0001');
    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(dataUrl.length).toBeGreaterThan(100);
  });
});

// ─── Certificate Generation Service (Task 5) ───────────────────────

describe('generateCertificate', () => {
  it('generates a certificate with all fields populated', async () => {
    const cert = await generateCertificate(testLoanId);

    expect(cert.loanId).toBe(testLoanId);
    expect(cert.certificateId).toMatch(/^ASC-\d{4}-\d{2}-\d{4}$/);
    expect(cert.verificationToken).toHaveLength(64);
    expect(cert.beneficiaryName).toBe('ALATISE BOSEDE SUSAINAH');
    expect(cert.staffId).toBe('CERT-001');
    expect(cert.mdaName).toBe('Certificate Test MDA');
    expect(cert.loanReference).toBe('VL-2026-CTST-0001');
    expect(cert.originalPrincipal).toBe(PRINCIPAL);
    expect(cert.totalPaid).toBe('113330.00');
    expect(cert.totalInterestPaid).toBe('13330.00');
    expect(cert.completionDate).toBeTruthy();
    expect(cert.generatedAt).toBeTruthy();
  });

  it('returns existing certificate on second call (idempotent)', async () => {
    const cert1 = await generateCertificate(testLoanId);
    const cert2 = await generateCertificate(testLoanId);

    expect(cert1.id).toBe(cert2.id);
    expect(cert1.certificateId).toBe(cert2.certificateId);
    expect(cert1.verificationToken).toBe(cert2.verificationToken);
  });

  it('generates sequential certificate IDs for different loans', async () => {
    const cert1 = await generateCertificate(testLoanId);
    const cert2 = await generateCertificate(testLoanIdB);

    // Both should be in the same month, cert2 should have the next sequence number
    const seq1 = parseInt(cert1.certificateId.slice(-4), 10);
    const seq2 = parseInt(cert2.certificateId.slice(-4), 10);
    expect(seq2).toBe(seq1 + 1);
  });
});
