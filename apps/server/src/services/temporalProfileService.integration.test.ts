import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import app from '../app';
import { db } from '../db/index';
import { mdas, users, loans, temporalCorrections } from '../db/schema';
import { hashPassword } from '../lib/password';
import { generateUuidv7 } from '../lib/uuidv7';
import * as authService from '../services/authService';

let testMdaId: string;
let secondMdaId: string;
let superAdminToken: string;
let adminToken: string;
let officerToken: string;
let adminUserId: string;
let superAdminUserId: string;
let officerUserId: string;

const testPassword = 'SecurePass1';

beforeAll(async () => {
  await db.execute(sql`TRUNCATE audit_log, refresh_tokens, temporal_corrections, loan_state_transitions, ledger_entries, loans, users, mdas CASCADE`);

  testMdaId = generateUuidv7();
  secondMdaId = generateUuidv7();

  await db.insert(mdas).values([
    { id: testMdaId, name: 'Temporal Test MDA', code: 'TMP_TEST', abbreviation: 'TmpTest' },
    { id: secondMdaId, name: 'Other MDA', code: 'TMP_OTHER', abbreviation: 'TmpOther' },
  ]);

  const hashedPassword = await hashPassword(testPassword);

  // Create super_admin
  superAdminUserId = generateUuidv7();
  await db.insert(users).values({
    id: superAdminUserId,
    email: 'temporal.superadmin@test.com',
    hashedPassword,
    firstName: 'Super',
    lastName: 'Admin',
    role: 'super_admin',
  });

  // Create dept_admin
  adminUserId = generateUuidv7();
  await db.insert(users).values({
    id: adminUserId,
    email: 'temporal.admin@test.com',
    hashedPassword,
    firstName: 'Dept',
    lastName: 'Admin',
    role: 'dept_admin',
  });

  // Create MDA officer (scoped to testMdaId)
  officerUserId = generateUuidv7();
  await db.insert(users).values({
    id: officerUserId,
    email: 'temporal.officer@test.com',
    hashedPassword,
    firstName: 'MDA',
    lastName: 'Officer',
    role: 'mda_officer',
    mdaId: testMdaId,
  });

  // Get tokens
  const superLogin = await authService.login({ email: 'temporal.superadmin@test.com', password: testPassword });
  superAdminToken = superLogin.accessToken;

  const adminLogin = await authService.login({ email: 'temporal.admin@test.com', password: testPassword });
  adminToken = adminLogin.accessToken;

  const officerLogin = await authService.login({ email: 'temporal.officer@test.com', password: testPassword });
  officerToken = officerLogin.accessToken;
});

beforeEach(async () => {
  await db.execute(sql`TRUNCATE temporal_corrections, loan_state_transitions, ledger_entries, loans CASCADE`);
});

afterAll(async () => {
  await db.execute(sql`TRUNCATE audit_log, refresh_tokens, temporal_corrections, loan_state_transitions, ledger_entries, loans, users, mdas CASCADE`);
});

/** Helper: create a loan directly in DB */
async function seedLoan(overrides: Partial<typeof loans.$inferInsert> = {}): Promise<string> {
  const id = generateUuidv7();
  await db.insert(loans).values({
    id,
    staffId: 'OY/TMP/0001',
    staffName: 'Temporal Test User',
    gradeLevel: 'GL 10',
    mdaId: testMdaId,
    principalAmount: '300000.00',
    interestRate: '6.000',
    tenureMonths: 24,
    moratoriumMonths: 0,
    monthlyDeductionAmount: '13250.00',
    approvalDate: new Date('2024-01-15'),
    firstDeductionDate: new Date('2024-02-01'),
    loanReference: `VLC-2024-${id.slice(-4)}`,
    status: 'ACTIVE',
    ...overrides,
  });
  return id;
}

// ─── 9.3: Incomplete temporal profile on loan detail ────────────────

describe('GET /api/loans/:id — temporal profile (incomplete)', () => {
  it('returns incomplete temporal profile when dates are missing', async () => {
    const loanId = await seedLoan();

    const res = await request(app)
      .get(`/api/loans/${loanId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.temporalProfile).toEqual({
      dateOfBirth: null,
      dateOfFirstAppointment: null,
      computedRetirementDate: null,
      computationMethod: null,
      profileStatus: 'incomplete',
      remainingServiceMonths: null,
      profileIncompleteReason: 'Profile Incomplete — DOB/appointment date required',
      hasServiceExtension: false,
      originalComputedRetirementDate: null,
      latestExtensionReference: null,
    });
  });
});

// ─── 9.4: PATCH temporal-profile with both dates ─────────────────────

describe('PATCH /api/loans/:loanId/temporal-profile — update with both dates', () => {
  it('computes retirement date and returns complete temporal profile', async () => {
    const loanId = await seedLoan();

    const res = await request(app)
      .patch(`/api/loans/${loanId}/temporal-profile`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        dateOfBirth: '1970-01-15',
        dateOfFirstAppointment: '1995-06-01',
        reason: 'Initial temporal data entry',
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    const tp = res.body.data.temporalProfile;
    expect(tp.profileStatus).toBe('complete');
    expect(tp.dateOfBirth).toBe('1970-01-15');
    expect(tp.dateOfFirstAppointment).toBe('1995-06-01');
    // DOB+60 = 2030-01-15, appt+35 = 2030-06-01 → DOB wins
    expect(tp.computedRetirementDate).toBe('2030-01-15');
    expect(tp.computationMethod).toBe('dob_60');
    expect(tp.remainingServiceMonths).toBeTypeOf('number');
    expect(tp.profileIncompleteReason).toBeNull();
  });
});

// ─── 9.5: PATCH updating DOB only → recompute + correction record ──

describe('PATCH /api/loans/:loanId/temporal-profile — DOB correction', () => {
  it('recomputes retirement date and creates correction record', async () => {
    const loanId = await seedLoan({
      dateOfBirth: new Date('1970-01-15'),
      dateOfFirstAppointment: new Date('1995-06-01'),
      computedRetirementDate: new Date('2030-01-15'),
    });

    const res = await request(app)
      .patch(`/api/loans/${loanId}/temporal-profile`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        dateOfBirth: '1975-06-15',
        reason: 'DOB correction after document review',
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    const tp = res.body.data.temporalProfile;
    // DOB+60 = 2035-06-15, appt+35 = 2030-06-01 → appt wins
    expect(tp.computedRetirementDate).toBe('2030-06-01');
    expect(tp.computationMethod).toBe('appt_35');

    // Verify correction record exists
    const corrections = await db.select().from(temporalCorrections).where(sql`loan_id = ${loanId}`);
    expect(corrections).toHaveLength(1);
    expect(corrections[0].fieldName).toBe('date_of_birth');
    expect(corrections[0].reason).toBe('DOB correction after document review');
  });
});

// ─── 9.6: GET temporal-corrections → chronological list ─────────────

describe('GET /api/loans/:loanId/temporal-corrections', () => {
  it('returns corrections in chronological order with user name', async () => {
    const loanId = await seedLoan({
      dateOfBirth: new Date('1970-01-15'),
      dateOfFirstAppointment: new Date('1995-06-01'),
      computedRetirementDate: new Date('2030-01-15'),
    });

    // Make two corrections
    await request(app)
      .patch(`/api/loans/${loanId}/temporal-profile`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ dateOfBirth: '1972-03-20', reason: 'First correction' })
      .expect(200);

    await request(app)
      .patch(`/api/loans/${loanId}/temporal-profile`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ dateOfFirstAppointment: '1997-01-01', reason: 'Second correction' })
      .expect(200);

    const res = await request(app)
      .get(`/api/loans/${loanId}/temporal-corrections`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);

    const [first, second] = res.body.data;
    expect(first.fieldName).toBe('date_of_birth');
    expect(first.correctedByName).toBe('Dept Admin');
    expect(first.reason).toBe('First correction');

    expect(second.fieldName).toBe('date_of_first_appointment');
    expect(second.reason).toBe('Second correction');

    // Chronological order
    expect(new Date(first.createdAt).getTime()).toBeLessThanOrEqual(new Date(second.createdAt).getTime());
  });
});

// ─── 9.7: MDA scoping — officer can GET own MDA, 403 for other ─────

describe('MDA scoping for temporal profile', () => {
  it('mda_officer can GET loan detail with temporal profile for their MDA', async () => {
    const loanId = await seedLoan({ mdaId: testMdaId });

    const res = await request(app)
      .get(`/api/loans/${loanId}`)
      .set('Authorization', `Bearer ${officerToken}`)
      .expect(200);

    expect(res.body.data.temporalProfile.profileStatus).toBe('incomplete');
  });

  it('mda_officer gets 403 for loan outside their MDA', async () => {
    const loanId = await seedLoan({ mdaId: secondMdaId });

    await request(app)
      .get(`/api/loans/${loanId}`)
      .set('Authorization', `Bearer ${officerToken}`)
      .expect(403);
  });
});

// ─── 9.8: MDA officer cannot PATCH temporal-profile ──────────────────

describe('PATCH /api/loans/:loanId/temporal-profile — role enforcement', () => {
  it('mda_officer cannot PATCH temporal-profile (403)', async () => {
    const loanId = await seedLoan({ mdaId: testMdaId });

    await request(app)
      .patch(`/api/loans/${loanId}/temporal-profile`)
      .set('Authorization', `Bearer ${officerToken}`)
      .send({
        dateOfBirth: '1970-01-15',
        reason: 'Officer should not be able to do this',
      })
      .expect(403);
  });
});

// ─── 9.9: PATCH with neither date field → 400 ───────────────────────

describe('PATCH /api/loans/:loanId/temporal-profile — validation', () => {
  it('rejects request with neither date field (Zod refine)', async () => {
    const loanId = await seedLoan();

    const res = await request(app)
      .patch(`/api/loans/${loanId}/temporal-profile`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'No dates provided' })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });
});

// ─── 9.10: PATCH with future DOB → 422 ─────────────────────────────

describe('PATCH /api/loans/:loanId/temporal-profile — business logic rejection', () => {
  it('rejects future DOB with 422', async () => {
    const loanId = await seedLoan();
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    const futureDateStr = futureDate.toISOString().split('T')[0];

    const res = await request(app)
      .patch(`/api/loans/${loanId}/temporal-profile`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        dateOfBirth: futureDateStr,
        reason: 'Future DOB test',
      })
      .expect(422);

    expect(res.body.error.code).toBe('TEMPORAL_DOB_FUTURE');
  });

  // ─── 9.11: PATCH with appointment before DOB → 422 ─────────────────

  it('rejects appointment date before DOB with 422', async () => {
    const loanId = await seedLoan();

    const res = await request(app)
      .patch(`/api/loans/${loanId}/temporal-profile`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        dateOfBirth: '1980-01-01',
        dateOfFirstAppointment: '1975-06-15',
        reason: 'Appointment before DOB test',
      })
      .expect(422);

    expect(res.body.error.code).toBe('TEMPORAL_APPT_BEFORE_DOB');
  });
});

// ─── 9.12: Immutability — temporal_corrections ────────────────────────

describe('temporal_corrections immutability', () => {
  it('rejects UPDATE on temporal correction records (DB trigger)', async () => {
    const loanId = await seedLoan({
      dateOfBirth: new Date('1970-01-15'),
      dateOfFirstAppointment: new Date('1995-06-01'),
      computedRetirementDate: new Date('2030-01-15'),
    });

    // Create a correction
    await request(app)
      .patch(`/api/loans/${loanId}/temporal-profile`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ dateOfBirth: '1972-03-20', reason: 'Will try to tamper' })
      .expect(200);

    // Attempt direct UPDATE — trigger rejects
    await expect(
      db.execute(sql`UPDATE temporal_corrections SET reason = 'Tampered' WHERE loan_id = ${loanId}`),
    ).rejects.toThrow();
  });

  it('rejects DELETE on temporal correction records (DB trigger)', async () => {
    const loanId = await seedLoan({
      dateOfBirth: new Date('1970-01-15'),
      dateOfFirstAppointment: new Date('1995-06-01'),
      computedRetirementDate: new Date('2030-01-15'),
    });

    // Create a correction
    await request(app)
      .patch(`/api/loans/${loanId}/temporal-profile`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ dateOfBirth: '1972-03-20', reason: 'Will try to delete' })
      .expect(200);

    // Attempt direct DELETE — trigger rejects
    await expect(
      db.execute(sql`DELETE FROM temporal_corrections WHERE loan_id = ${loanId}`),
    ).rejects.toThrow();
  });
});

// ─── 9.13: Create loan with temporal dates → retirement date set ─────

describe('POST /api/loans — temporal date handling on creation', () => {
  it('computes retirement date when both temporal dates are provided', async () => {
    const res = await request(app)
      .post('/api/loans')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        staffId: 'OY/TMP/0099',
        staffName: 'Temporal Create Test',
        gradeLevel: 'GL 10',
        mdaId: testMdaId,
        principalAmount: '300000.00',
        interestRate: '6.000',
        tenureMonths: 24,
        moratoriumMonths: 0,
        monthlyDeductionAmount: '13250.00',
        approvalDate: '2024-01-15',
        firstDeductionDate: '2024-02-01',
        dateOfBirth: '1970-01-15',
        dateOfFirstAppointment: '1995-06-01',
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    const tp = res.body.data.temporalProfile;
    expect(tp.profileStatus).toBe('complete');
    expect(tp.computedRetirementDate).toBe('2030-01-15');
    expect(tp.computationMethod).toBe('dob_60');
  });
});

// ─── 9.14: Create loan without temporal dates → incomplete ──────────

describe('POST /api/loans — no temporal dates', () => {
  it('returns incomplete profile when temporal dates are omitted', async () => {
    const res = await request(app)
      .post('/api/loans')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        staffId: 'OY/TMP/0098',
        staffName: 'No Temporal Create',
        gradeLevel: 'GL 10',
        mdaId: testMdaId,
        principalAmount: '300000.00',
        interestRate: '6.000',
        tenureMonths: 24,
        moratoriumMonths: 0,
        monthlyDeductionAmount: '13250.00',
        approvalDate: '2024-01-15',
        firstDeductionDate: '2024-02-01',
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    const tp = res.body.data.temporalProfile;
    expect(tp.profileStatus).toBe('incomplete');
    expect(tp.computedRetirementDate).toBeNull();
  });
});

// ─── M3: Create loan with invalid temporal dates → 422 ──────────────

describe('POST /api/loans — temporal date validation on creation', () => {
  it('rejects future DOB with 422', async () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    const futureDateStr = futureDate.toISOString().split('T')[0];

    const res = await request(app)
      .post('/api/loans')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        staffId: 'OY/TMP/0097',
        staffName: 'Future DOB Create Test',
        gradeLevel: 'GL 10',
        mdaId: testMdaId,
        principalAmount: '300000.00',
        interestRate: '6.000',
        tenureMonths: 24,
        moratoriumMonths: 0,
        monthlyDeductionAmount: '13250.00',
        approvalDate: '2024-01-15',
        firstDeductionDate: '2024-02-01',
        dateOfBirth: futureDateStr,
        dateOfFirstAppointment: '1995-06-01',
      })
      .expect(422);

    expect(res.body.error.code).toBe('TEMPORAL_DOB_FUTURE');
  });

  it('rejects appointment before DOB with 422', async () => {
    const res = await request(app)
      .post('/api/loans')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        staffId: 'OY/TMP/0096',
        staffName: 'Appt Before DOB Create Test',
        gradeLevel: 'GL 10',
        mdaId: testMdaId,
        principalAmount: '300000.00',
        interestRate: '6.000',
        tenureMonths: 24,
        moratoriumMonths: 0,
        monthlyDeductionAmount: '13250.00',
        approvalDate: '2024-01-15',
        firstDeductionDate: '2024-02-01',
        dateOfBirth: '1980-01-01',
        dateOfFirstAppointment: '1975-06-15',
      })
      .expect(422);

    expect(res.body.error.code).toBe('TEMPORAL_APPT_BEFORE_DOB');
  });
});

// ─── L2: MDA officer can GET temporal-corrections for their MDA ─────

describe('GET /api/loans/:loanId/temporal-corrections — MDA officer access', () => {
  it('mda_officer can GET temporal-corrections for their MDA loan', async () => {
    const loanId = await seedLoan({
      mdaId: testMdaId,
      dateOfBirth: new Date('1970-01-15'),
      dateOfFirstAppointment: new Date('1995-06-01'),
      computedRetirementDate: new Date('2030-01-15'),
    });

    // Create a correction as admin
    await request(app)
      .patch(`/api/loans/${loanId}/temporal-profile`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ dateOfBirth: '1972-03-20', reason: 'Officer read test' })
      .expect(200);

    // Officer can read corrections for their MDA's loan
    const res = await request(app)
      .get(`/api/loans/${loanId}/temporal-corrections`)
      .set('Authorization', `Bearer ${officerToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
  });

  it('mda_officer gets 403 for temporal-corrections of other MDA loan', async () => {
    const loanId = await seedLoan({
      mdaId: secondMdaId,
      dateOfBirth: new Date('1970-01-15'),
      dateOfFirstAppointment: new Date('1995-06-01'),
      computedRetirementDate: new Date('2030-01-15'),
    });

    // Create a correction as super_admin (who has no MDA scope)
    await request(app)
      .patch(`/api/loans/${loanId}/temporal-profile`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ dateOfBirth: '1972-03-20', reason: 'Cross-MDA test' })
      .expect(200);

    // Officer cannot read corrections for other MDA's loan
    await request(app)
      .get(`/api/loans/${loanId}/temporal-corrections`)
      .set('Authorization', `Bearer ${officerToken}`)
      .expect(403);
  });
});

// ─── 9.15: Atomicity — failed correction → no loan update ──────────

describe('Temporal profile atomicity', () => {
  it('does not update loan dates when business logic rejects', async () => {
    const loanId = await seedLoan();

    // Attempt PATCH with future DOB (will be rejected)
    await request(app)
      .patch(`/api/loans/${loanId}/temporal-profile`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        dateOfBirth: '2090-01-01',
        reason: 'Future DOB should fail',
      })
      .expect(422);

    // Verify loan dates unchanged (still null)
    const [loan] = await db.select({
      dateOfBirth: loans.dateOfBirth,
      dateOfFirstAppointment: loans.dateOfFirstAppointment,
      computedRetirementDate: loans.computedRetirementDate,
    }).from(loans).where(sql`id = ${loanId}`);

    expect(loan.dateOfBirth).toBeNull();
    expect(loan.dateOfFirstAppointment).toBeNull();
    expect(loan.computedRetirementDate).toBeNull();

    // Verify no correction records
    const corrections = await db.select().from(temporalCorrections).where(sql`loan_id = ${loanId}`);
    expect(corrections).toHaveLength(0);
  });
});
