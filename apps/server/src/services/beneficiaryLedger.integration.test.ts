import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { db } from '../db/index';
import { users, mdas, loans, loanCompletions, autoStopCertificates, transfers, observations } from '../db/schema';
import { signAccessToken } from '../lib/jwt';
import { generateUuidv7 } from '../lib/uuidv7';
import { resetRateLimiters } from '../middleware/rateLimiter';
import { resetDb } from '../test/resetDb';

// ─── Test fixture IDs ────────────────────────────────────────────────
let testMdaId: string;
let destMdaId: string;
let adminUserId: string;
let adminToken: string;

// Loan IDs
let activeLoanId: string;
let completedLoanId: string;
let transferredLoanId: string;

beforeAll(async () => {
  resetRateLimiters();
  await resetDb();

  testMdaId = generateUuidv7();
  destMdaId = generateUuidv7();
  await db.insert(mdas).values([
    { id: testMdaId, name: 'Beneficiary Test MDA', code: 'BENE', abbreviation: 'Ben Test' },
    { id: destMdaId, name: 'Destination MDA', code: 'DEST', abbreviation: 'Dest' },
  ]);

  adminUserId = generateUuidv7();
  await db.insert(users).values({
    id: adminUserId,
    email: 'beneficiary-admin@test.com',
    hashedPassword: 'hashed',
    firstName: 'Ben',
    lastName: 'Admin',
    role: 'super_admin',
  });

  adminToken = signAccessToken({
    userId: adminUserId,
    email: 'beneficiary-admin@test.com',
    role: 'super_admin',
    mdaId: null,
    mustChangePassword: false,
  });

  const baseLoan = {
    staffId: '',
    staffName: '',
    gradeLevel: 'GL-10',
    mdaId: testMdaId,
    principalAmount: '500000.00',
    interestRate: '13.330',
    tenureMonths: 60,
    monthlyDeductionAmount: '9444.17',
    approvalDate: new Date('2023-01-01'),
    firstDeductionDate: new Date('2023-02-01'),
    status: 'ACTIVE' as const,
  };

  // 1. Active loan
  activeLoanId = generateUuidv7();
  await db.insert(loans).values({
    ...baseLoan,
    id: activeLoanId,
    staffId: 'EMP-ACTIVE-001',
    staffName: 'Active Staff Person',
    loanReference: 'VLC-MIG-ACTIVE-001',
    status: 'ACTIVE',
  });

  // 2. Completed loan (with certificate)
  completedLoanId = generateUuidv7();
  await db.insert(loans).values({
    ...baseLoan,
    id: completedLoanId,
    staffId: 'EMP-COMP-001',
    staffName: 'Completed Staff Person',
    loanReference: 'VLC-MIG-COMP-001',
    status: 'COMPLETED',
  });

  await db.insert(loanCompletions).values({
    id: generateUuidv7(),
    loanId: completedLoanId,
    completionDate: new Date('2025-06-15'),
    finalBalance: '0.00',
    totalPaid: '566650.00',
    totalPrincipalPaid: '500000.00',
    totalInterestPaid: '66650.00',
    triggerSource: 'background_scan',
  });

  await db.insert(autoStopCertificates).values({
    id: generateUuidv7(),
    loanId: completedLoanId,
    certificateId: 'CERT-TEST-001',
    verificationToken: 'tok-' + generateUuidv7(),
    beneficiaryName: 'Completed Staff Person',
    staffId: 'EMP-COMP-001',
    mdaId: testMdaId,
    mdaName: 'Beneficiary Test MDA',
    loanReference: 'VLC-MIG-COMP-001',
    originalPrincipal: '500000.00',
    totalPaid: '566650.00',
    totalInterestPaid: '66650.00',
    completionDate: new Date('2025-06-15'),
  });

  // 3. Transferred loan
  transferredLoanId = generateUuidv7();
  await db.insert(loans).values({
    ...baseLoan,
    id: transferredLoanId,
    staffId: 'EMP-TRANS-001',
    staffName: 'Transferred Staff Person',
    loanReference: 'VLC-MIG-TRANS-001',
    status: 'TRANSFERRED',
  });

  await db.insert(transfers).values({
    id: generateUuidv7(),
    staffId: 'EMP-TRANS-001',
    loanId: transferredLoanId,
    outgoingMdaId: testMdaId,
    incomingMdaId: destMdaId,
    status: 'COMPLETED',
  });

  // 4. Add a consecutive_loan observation for the active staff
  await db.insert(observations).values({
    id: generateUuidv7(),
    type: 'consecutive_loan',
    staffName: 'Active Staff Person',
    staffId: 'EMP-ACTIVE-001',
    loanId: activeLoanId,
    mdaId: testMdaId,
    description: 'Consecutive loan detected',
    context: JSON.stringify({ reason: 'test' }),
    status: 'unreviewed',
  });
});

afterAll(async () => {
  await resetDb();
});

describe('Beneficiary Lifecycle Fields (Story 15.0k)', () => {
  describe('GET /api/migrations/beneficiaries — lifecycle data', () => {
    it('returns lifecycle fields for all beneficiaries', async () => {
      const res = await request(app)
        .get('/api/migrations/beneficiaries')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const items = res.body.data.data;
      expect(items.length).toBe(3);

      // Active person
      const active = items.find((i: any) => i.staffName === 'Active Staff Person');
      expect(active).toBeDefined();
      expect(active.loanStatus).toBe('ACTIVE');
      expect(active.completionDate).toBeNull();
      expect(active.certificateStatus).toBeNull();
      expect(active.transferredToMdaName).toBeNull();
      expect(active.hasConsecutiveLoan).toBe(true);

      // Completed person
      const completed = items.find((i: any) => i.staffName === 'Completed Staff Person');
      expect(completed).toBeDefined();
      expect(completed.loanStatus).toBe('COMPLETED');
      expect(completed.completionDate).toBe('2025-06-15');
      expect(completed.certificateStatus).toBe('issued');
      expect(completed.hasConsecutiveLoan).toBe(false);

      // Transferred person
      const transferred = items.find((i: any) => i.staffName === 'Transferred Staff Person');
      expect(transferred).toBeDefined();
      expect(transferred.loanStatus).toBe('TRANSFERRED');
      expect(transferred.transferredToMdaName).toBe('Destination MDA');
      expect(transferred.transferStatus).toBe('COMPLETED');
      expect(transferred.transferredOutDate).toBeDefined();
    });

    it('filters by loanStatus=ACTIVE', async () => {
      const res = await request(app)
        .get('/api/migrations/beneficiaries')
        .query({ loanStatus: 'ACTIVE' })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const items = res.body.data.data;
      expect(items.length).toBe(1);
      expect(items[0].staffName).toBe('Active Staff Person');
      expect(items[0].loanStatus).toBe('ACTIVE');
    });

    it('filters by loanStatus=COMPLETED', async () => {
      const res = await request(app)
        .get('/api/migrations/beneficiaries')
        .query({ loanStatus: 'COMPLETED' })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const items = res.body.data.data;
      expect(items.length).toBe(1);
      expect(items[0].staffName).toBe('Completed Staff Person');
    });

    it('filters by loanStatus=TRANSFERRED', async () => {
      const res = await request(app)
        .get('/api/migrations/beneficiaries')
        .query({ loanStatus: 'TRANSFERRED' })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const items = res.body.data.data;
      expect(items.length).toBe(1);
      expect(items[0].staffName).toBe('Transferred Staff Person');
    });

    it('returns all with loanStatus=ALL', async () => {
      const res = await request(app)
        .get('/api/migrations/beneficiaries')
        .query({ loanStatus: 'ALL' })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.data.length).toBe(3);
    });
  });
});
