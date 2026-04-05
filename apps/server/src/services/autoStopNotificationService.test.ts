/**
 * Auto-Stop Notification Service — Unit Tests (Story 8.3)
 *
 * Tests notification orchestration: MDA officers, beneficiary email,
 * missing email handling, and multi-officer scenarios.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
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
import { generateCertificate } from './autoStopCertificateService';
import { sendAutoStopNotifications } from './autoStopNotificationService';

// Mock the email module
vi.mock('../lib/email', () => ({
  sendAutoStopMdaNotification: vi.fn().mockResolvedValue(undefined),
  sendAutoStopBeneficiaryNotification: vi.fn().mockResolvedValue(undefined),
  isEmailConfigured: vi.fn().mockReturnValue(true),
}));

// Mock the PDF generator to avoid react-pdf overhead
vi.mock('./autoStopCertificatePdf', () => ({
  generateAutoStopCertificatePdf: vi.fn().mockResolvedValue(Buffer.from('mock-pdf')),
}));

// Mock QR code generator
vi.mock('./autoStopCertificateQr', () => ({
  generateQrCodeDataUrl: vi.fn().mockResolvedValue('data:image/png;base64,mock'),
}));

import { sendAutoStopMdaNotification, sendAutoStopBeneficiaryNotification } from '../lib/email';

// ─── Test Fixtures ──────────────────────────────────────────────────

let testMdaId: string;
let testMdaNoOfficersId: string;
let testAdminUserId: string;
let testOfficer1Id: string;
let testOfficer2Id: string;
let testOfficer3Id: string;
let testLoanWithEmail: string;
let testLoanNoEmail: string;
let testLoanNoOfficers: string;
let certWithEmailId: string;
let certNoEmailId: string;
let certNoOfficersId: string;

const PRINCIPAL = '100000.00';
const RATE = '13.330';
const TENURE = 36;

beforeAll(async () => {
  await resetDb();

  // MDA with officers
  testMdaId = generateUuidv7();
  await db.insert(mdas).values({
    id: testMdaId,
    name: 'Notification Test MDA',
    code: 'NTST',
    abbreviation: 'NotifTest',
  });

  // MDA with no officers
  testMdaNoOfficersId = generateUuidv7();
  await db.insert(mdas).values({
    id: testMdaNoOfficersId,
    name: 'No Officers MDA',
    code: 'NOOFF',
    abbreviation: 'NoOff',
  });

  // Admin user (not an mda_officer)
  testAdminUserId = generateUuidv7();
  await db.insert(users).values({
    id: testAdminUserId,
    email: 'notif-admin@test.com',
    hashedPassword: 'hashed',
    firstName: 'Admin',
    lastName: 'User',
    role: 'super_admin',
  });

  // 3 MDA officers for testMdaId
  testOfficer1Id = generateUuidv7();
  testOfficer2Id = generateUuidv7();
  testOfficer3Id = generateUuidv7();
  await db.insert(users).values([
    {
      id: testOfficer1Id,
      email: 'officer1@mda.test',
      hashedPassword: 'hashed',
      firstName: 'Fatimah',
      lastName: 'Adeyemi',
      role: 'mda_officer',
      mdaId: testMdaId,
      isActive: true,
    },
    {
      id: testOfficer2Id,
      email: 'officer2@mda.test',
      hashedPassword: 'hashed',
      firstName: 'Bola',
      lastName: 'Ogunleye',
      role: 'mda_officer',
      mdaId: testMdaId,
      isActive: true,
    },
    {
      id: testOfficer3Id,
      email: 'officer3@mda.test',
      hashedPassword: 'hashed',
      firstName: 'Inactive',
      lastName: 'Officer',
      role: 'mda_officer',
      mdaId: testMdaId,
      isActive: false, // inactive — should NOT receive email
    },
  ]);

  // ─── Loan with beneficiary email ───────────────────────────────

  testLoanWithEmail = generateUuidv7();
  await db.insert(loans).values({
    id: testLoanWithEmail,
    staffId: 'NOTIF-001',
    staffName: 'ALATISE BOSEDE SUSAINAH',
    gradeLevel: 'GL-10',
    mdaId: testMdaId,
    principalAmount: PRINCIPAL,
    interestRate: RATE,
    tenureMonths: TENURE,
    monthlyDeductionAmount: '3148.06',
    approvalDate: new Date('2024-01-01'),
    firstDeductionDate: new Date('2024-02-01'),
    loanReference: 'VL-2026-NTST-0001',
    status: 'COMPLETED',
    limitedComputation: false,
    beneficiaryEmail: 'beneficiary@personal.test',
  });

  await db.insert(loanStateTransitions).values([
    { id: generateUuidv7(), loanId: testLoanWithEmail, fromStatus: 'APPLIED', toStatus: 'ACTIVE', transitionedBy: testAdminUserId, reason: 'Baseline' },
    { id: generateUuidv7(), loanId: testLoanWithEmail, fromStatus: 'ACTIVE', toStatus: 'COMPLETED', transitionedBy: testAdminUserId, reason: 'Auto-stop' },
  ]);

  await db.insert(loanCompletions).values({
    id: generateUuidv7(),
    loanId: testLoanWithEmail,
    completionDate: new Date('2026-04-01'),
    finalBalance: '0.00',
    totalPaid: '113330.00',
    totalPrincipalPaid: PRINCIPAL,
    totalInterestPaid: '13330.00',
    triggerSource: 'background_scan',
  });

  // ─── Loan without beneficiary email ────────────────────────────

  testLoanNoEmail = generateUuidv7();
  await db.insert(loans).values({
    id: testLoanNoEmail,
    staffId: 'NOTIF-002',
    staffName: 'ADEOYE JAMES OPEYEMI',
    gradeLevel: 'GL-12',
    mdaId: testMdaId,
    principalAmount: PRINCIPAL,
    interestRate: RATE,
    tenureMonths: TENURE,
    monthlyDeductionAmount: '3148.06',
    approvalDate: new Date('2024-01-01'),
    firstDeductionDate: new Date('2024-02-01'),
    loanReference: 'VL-2026-NTST-0002',
    status: 'COMPLETED',
    limitedComputation: false,
    // beneficiaryEmail: null (default)
  });

  await db.insert(loanStateTransitions).values([
    { id: generateUuidv7(), loanId: testLoanNoEmail, fromStatus: 'APPLIED', toStatus: 'ACTIVE', transitionedBy: testAdminUserId, reason: 'Baseline' },
    { id: generateUuidv7(), loanId: testLoanNoEmail, fromStatus: 'ACTIVE', toStatus: 'COMPLETED', transitionedBy: testAdminUserId, reason: 'Auto-stop' },
  ]);

  await db.insert(loanCompletions).values({
    id: generateUuidv7(),
    loanId: testLoanNoEmail,
    completionDate: new Date('2026-04-02'),
    finalBalance: '0.00',
    totalPaid: '113330.00',
    totalPrincipalPaid: PRINCIPAL,
    totalInterestPaid: '13330.00',
    triggerSource: 'background_scan',
  });

  // ─── Loan in MDA with no officers ──────────────────────────────

  testLoanNoOfficers = generateUuidv7();
  await db.insert(loans).values({
    id: testLoanNoOfficers,
    staffId: 'NOTIF-003',
    staffName: 'OKAFOR NNEKA',
    gradeLevel: 'GL-08',
    mdaId: testMdaNoOfficersId,
    principalAmount: PRINCIPAL,
    interestRate: RATE,
    tenureMonths: TENURE,
    monthlyDeductionAmount: '3148.06',
    approvalDate: new Date('2024-01-01'),
    firstDeductionDate: new Date('2024-02-01'),
    loanReference: 'VL-2026-NOOFF-0001',
    status: 'COMPLETED',
    limitedComputation: false,
  });

  await db.insert(loanStateTransitions).values([
    { id: generateUuidv7(), loanId: testLoanNoOfficers, fromStatus: 'APPLIED', toStatus: 'ACTIVE', transitionedBy: testAdminUserId, reason: 'Baseline' },
    { id: generateUuidv7(), loanId: testLoanNoOfficers, fromStatus: 'ACTIVE', toStatus: 'COMPLETED', transitionedBy: testAdminUserId, reason: 'Auto-stop' },
  ]);

  await db.insert(loanCompletions).values({
    id: generateUuidv7(),
    loanId: testLoanNoOfficers,
    completionDate: new Date('2026-04-03'),
    finalBalance: '0.00',
    totalPaid: '113330.00',
    totalPrincipalPaid: PRINCIPAL,
    totalInterestPaid: '13330.00',
    triggerSource: 'background_scan',
  });

  // Generate certificates for all three loans
  const certWithEmail = await generateCertificate(testLoanWithEmail);
  certWithEmailId = certWithEmail.id;

  const certNoEmail = await generateCertificate(testLoanNoEmail);
  certNoEmailId = certNoEmail.id;

  const certNoOfficers = await generateCertificate(testLoanNoOfficers);
  certNoOfficersId = certNoOfficers.id;
});

afterAll(async () => {
  await resetDb();
});

// ─── Tests ──────────────────────────────────────────────────────────

describe('sendAutoStopNotifications', () => {
  it('sends to both MDA officers and beneficiary when email is available (AC: 1, 2)', async () => {
    vi.mocked(sendAutoStopMdaNotification).mockClear();
    vi.mocked(sendAutoStopBeneficiaryNotification).mockClear();

    const result = await sendAutoStopNotifications(certWithEmailId);

    // 2 active officers (3rd is inactive)
    expect(result.mdaOfficersNotified).toBe(2);
    expect(result.beneficiaryNotified).toBe(true);
    expect(result.notes).not.toContain('beneficiary: no_email_on_file');

    // Verify MDA notification calls
    expect(sendAutoStopMdaNotification).toHaveBeenCalledTimes(2);
    const firstCall = vi.mocked(sendAutoStopMdaNotification).mock.calls[0][0];
    expect(firstCall.to).toBe('officer1@mda.test');
    expect(firstCall.staffId).toBe('NOTIF-001');
    expect(firstCall.pdfBuffer).toBeInstanceOf(Buffer);

    // Verify beneficiary notification call
    expect(sendAutoStopBeneficiaryNotification).toHaveBeenCalledTimes(1);
    const benCall = vi.mocked(sendAutoStopBeneficiaryNotification).mock.calls[0][0];
    expect(benCall.to).toBe('beneficiary@personal.test');
    expect(benCall.certificateId).toBeTruthy();

    // Verify certificate record updated with timestamps
    const [updatedCert] = await db
      .select()
      .from(autoStopCertificates)
      .where(eq(autoStopCertificates.id, certWithEmailId))
      .limit(1);
    expect(updatedCert.notifiedMdaAt).toBeTruthy();
    expect(updatedCert.notifiedBeneficiaryAt).toBeTruthy();
  });

  it('sends MDA notification but skips beneficiary when no email on file (AC: 3)', async () => {
    vi.mocked(sendAutoStopMdaNotification).mockClear();
    vi.mocked(sendAutoStopBeneficiaryNotification).mockClear();

    const result = await sendAutoStopNotifications(certNoEmailId);

    expect(result.mdaOfficersNotified).toBe(2);
    expect(result.beneficiaryNotified).toBe(false);
    expect(result.notes).toContain('beneficiary: no_email_on_file');

    // MDA still notified
    expect(sendAutoStopMdaNotification).toHaveBeenCalledTimes(2);
    // Beneficiary NOT notified
    expect(sendAutoStopBeneficiaryNotification).not.toHaveBeenCalled();

    // Verify certificate record
    const [updatedCert] = await db
      .select()
      .from(autoStopCertificates)
      .where(eq(autoStopCertificates.id, certNoEmailId))
      .limit(1);
    expect(updatedCert.notifiedMdaAt).toBeTruthy();
    expect(updatedCert.notifiedBeneficiaryAt).toBeNull();
    expect(updatedCert.notificationNotes).toContain('no_email_on_file');
  });

  it('sends to ALL active MDA officers — 3 registered, 2 active (AC: 7)', async () => {
    vi.mocked(sendAutoStopMdaNotification).mockClear();

    const result = await sendAutoStopNotifications(certWithEmailId);

    // Only 2 of 3 officers are active
    expect(result.mdaOfficersNotified).toBe(2);
    expect(sendAutoStopMdaNotification).toHaveBeenCalledTimes(2);

    // Verify distinct emails
    const emails = vi.mocked(sendAutoStopMdaNotification).mock.calls.map(c => c[0].to);
    expect(emails).toContain('officer1@mda.test');
    expect(emails).toContain('officer2@mda.test');
    expect(emails).not.toContain('officer3@mda.test'); // inactive
  });

  it('logs warning when MDA has no active officers', async () => {
    vi.mocked(sendAutoStopMdaNotification).mockClear();
    vi.mocked(sendAutoStopBeneficiaryNotification).mockClear();

    const result = await sendAutoStopNotifications(certNoOfficersId);

    expect(result.mdaOfficersNotified).toBe(0);
    expect(result.notes).toContain('no_active_mda_officers');
    expect(sendAutoStopMdaNotification).not.toHaveBeenCalled();
  });
});
