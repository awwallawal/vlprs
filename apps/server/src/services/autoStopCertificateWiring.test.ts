/**
 * Auto-Stop Certificate → Notification Wiring Test (Story 8.3, L2)
 *
 * Verifies that generateCertificate() fires sendAutoStopNotifications()
 * as a fire-and-forget side effect after certificate creation.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { db } from '../db';
import {
  users,
  mdas,
  loans,
  loanStateTransitions,
  loanCompletions,
} from '../db/schema';
import { generateUuidv7 } from '../lib/uuidv7';
import { resetDb } from '../test/resetDb';

// Mock notification service — spy on wiring
vi.mock('./autoStopNotificationService', () => ({
  sendAutoStopNotifications: vi.fn().mockResolvedValue({
    mdaOfficersNotified: 0,
    beneficiaryNotified: false,
    notes: [],
  }),
}));

// Mock PDF generator to avoid react-pdf overhead
vi.mock('./autoStopCertificatePdf', () => ({
  generateAutoStopCertificatePdf: vi.fn().mockResolvedValue(Buffer.from('mock-pdf')),
}));

// Mock QR code generator
vi.mock('./autoStopCertificateQr', () => ({
  generateQrCodeDataUrl: vi.fn().mockResolvedValue('data:image/png;base64,mock'),
}));

import { sendAutoStopNotifications } from './autoStopNotificationService';
import { generateCertificate } from './autoStopCertificateService';

let testMdaId: string;
let testAdminUserId: string;
let testLoanId: string;

beforeAll(async () => {
  await resetDb();

  testMdaId = generateUuidv7();
  await db.insert(mdas).values({
    id: testMdaId,
    name: 'Wiring Test MDA',
    code: 'WIRE',
    abbreviation: 'WireTest',
  });

  testAdminUserId = generateUuidv7();
  await db.insert(users).values({
    id: testAdminUserId,
    email: 'wiring-admin@test.com',
    hashedPassword: 'hashed',
    firstName: 'Admin',
    lastName: 'Wiring',
    role: 'super_admin',
  });

  testLoanId = generateUuidv7();
  await db.insert(loans).values({
    id: testLoanId,
    staffId: 'WIRE-001',
    staffName: 'WIRING TEST STAFF',
    gradeLevel: 'GL-10',
    mdaId: testMdaId,
    principalAmount: '100000.00',
    interestRate: '13.330',
    tenureMonths: 36,
    monthlyDeductionAmount: '3148.06',
    approvalDate: new Date('2024-01-01'),
    firstDeductionDate: new Date('2024-02-01'),
    loanReference: 'VL-2026-WIRE-0001',
    status: 'COMPLETED',
    limitedComputation: false,
  });

  await db.insert(loanStateTransitions).values([
    { id: generateUuidv7(), loanId: testLoanId, fromStatus: 'APPLIED', toStatus: 'ACTIVE', transitionedBy: testAdminUserId, reason: 'Baseline' },
    { id: generateUuidv7(), loanId: testLoanId, fromStatus: 'ACTIVE', toStatus: 'COMPLETED', transitionedBy: testAdminUserId, reason: 'Auto-stop' },
  ]);

  await db.insert(loanCompletions).values({
    id: generateUuidv7(),
    loanId: testLoanId,
    completionDate: new Date('2026-04-01'),
    finalBalance: '0.00',
    totalPaid: '113330.00',
    totalPrincipalPaid: '100000.00',
    totalInterestPaid: '13330.00',
    triggerSource: 'background_scan',
  });
});

afterAll(async () => {
  await resetDb();
});

describe('generateCertificate → sendAutoStopNotifications wiring', () => {
  it('fires sendAutoStopNotifications with the new certificate ID after generation', async () => {
    vi.mocked(sendAutoStopNotifications).mockClear();

    const certificate = await generateCertificate(testLoanId);

    // Fire-and-forget runs on the microtask queue — flush it
    await new Promise((r) => setTimeout(r, 50));

    expect(sendAutoStopNotifications).toHaveBeenCalledTimes(1);
    expect(sendAutoStopNotifications).toHaveBeenCalledWith(certificate.id);
  });

  it('does not fire notifications again for idempotent certificate generation', async () => {
    vi.mocked(sendAutoStopNotifications).mockClear();

    // Second call for same loan — returns existing certificate, no notification
    await generateCertificate(testLoanId);

    await new Promise((r) => setTimeout(r, 50));

    expect(sendAutoStopNotifications).not.toHaveBeenCalled();
  });
});
