import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import app from '../app';
import { db } from '../db/index';
import { mdas, users, loans, serviceExtensions, temporalCorrections } from '../db/schema';
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
  await db.execute(sql`TRUNCATE audit_log, refresh_tokens, temporal_corrections, loan_state_transitions, ledger_entries, service_extensions, loans, users, mdas CASCADE`);

  testMdaId = generateUuidv7();
  secondMdaId = generateUuidv7();

  await db.insert(mdas).values([
    { id: testMdaId, name: 'Extension Test MDA', code: 'EXT_TEST', abbreviation: 'ExtTest' },
    { id: secondMdaId, name: 'Other MDA', code: 'EXT_OTHER', abbreviation: 'ExtOther' },
  ]);

  const hashedPassword = await hashPassword(testPassword);

  // Create super_admin
  superAdminUserId = generateUuidv7();
  await db.insert(users).values({
    id: superAdminUserId,
    email: 'ext.superadmin@test.com',
    hashedPassword,
    firstName: 'Super',
    lastName: 'Admin',
    role: 'super_admin',
  });

  // Create dept_admin
  adminUserId = generateUuidv7();
  await db.insert(users).values({
    id: adminUserId,
    email: 'ext.admin@test.com',
    hashedPassword,
    firstName: 'Dept',
    lastName: 'Admin',
    role: 'dept_admin',
  });

  // Create MDA officer (scoped to testMdaId)
  officerUserId = generateUuidv7();
  await db.insert(users).values({
    id: officerUserId,
    email: 'ext.officer@test.com',
    hashedPassword,
    firstName: 'MDA',
    lastName: 'Officer',
    role: 'mda_officer',
    mdaId: testMdaId,
  });

  // Get tokens
  const superLogin = await authService.login({ email: 'ext.superadmin@test.com', password: testPassword });
  superAdminToken = superLogin.accessToken;

  const adminLogin = await authService.login({ email: 'ext.admin@test.com', password: testPassword });
  adminToken = adminLogin.accessToken;

  const officerLogin = await authService.login({ email: 'ext.officer@test.com', password: testPassword });
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
    staffId: 'OY/EXT/0001',
    staffName: 'Extension Test User',
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

/** Helper: seed a loan with complete temporal profile */
async function seedLoanWithTemporalProfile(overrides: Partial<typeof loans.$inferInsert> = {}): Promise<string> {
  return seedLoan({
    dateOfBirth: new Date('1970-01-15'),
    dateOfFirstAppointment: new Date('1995-06-01'),
    computedRetirementDate: new Date('2030-01-15'), // DOB+60=2030-01-15, appt+35=2030-06-01 → DOB wins
    ...overrides,
  });
}

// ─── 7.3: POST service-extensions with valid data → 201 ─────────────

describe('POST /api/loans/:loanId/service-extensions — valid extension', () => {
  it('creates extension record and updates loan retirement date', async () => {
    const loanId = await seedLoanWithTemporalProfile();

    const res = await request(app)
      .post(`/api/loans/${loanId}/service-extensions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        newRetirementDate: '2033-06-15',
        approvingAuthorityReference: 'PSC/EXT/2026/0042',
        notes: 'Approved 2-year extension per PSC directive',
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    const ext = res.body.data;
    expect(ext.loanId).toBe(loanId);
    expect(ext.originalComputedDate).toBe('2030-01-15');
    expect(ext.newRetirementDate).toBe('2033-06-15');
    expect(ext.approvingAuthorityReference).toBe('PSC/EXT/2026/0042');
    expect(ext.notes).toBe('Approved 2-year extension per PSC directive');
    expect(ext.createdByName).toBe('Dept Admin');
    expect(ext.id).toBeTruthy();
    expect(ext.createdAt).toBeTruthy();

    // Verify loan's computed_retirement_date is updated
    const [loan] = await db.select({ computedRetirementDate: loans.computedRetirementDate })
      .from(loans).where(sql`id = ${loanId}`);
    expect(loan.computedRetirementDate!.toISOString().split('T')[0]).toBe('2033-06-15');
  });
});

// ─── 7.4: Incomplete temporal profile → 422 ──────────────────────────

describe('POST /api/loans/:loanId/service-extensions — incomplete profile', () => {
  it('rejects extension on loan with incomplete temporal profile', async () => {
    const loanId = await seedLoan(); // no DOB/appointment/retirement

    const res = await request(app)
      .post(`/api/loans/${loanId}/service-extensions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        newRetirementDate: '2033-06-15',
        approvingAuthorityReference: 'PSC/EXT/2026/0043',
        notes: 'Should be rejected',
      })
      .expect(422);

    expect(res.body.error.code).toBe('SERVICE_EXTENSION_INCOMPLETE_PROFILE');
    expect(res.body.error.message).toContain('temporal profile is incomplete');
  });
});

// ─── 7.5: Extension date before current retirement → 422 ─────────────

describe('POST /api/loans/:loanId/service-extensions — date before current', () => {
  it('rejects extension date before current retirement date', async () => {
    const loanId = await seedLoanWithTemporalProfile();

    const res = await request(app)
      .post(`/api/loans/${loanId}/service-extensions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        newRetirementDate: '2029-01-01',
        approvingAuthorityReference: 'PSC/EXT/2026/0044',
        notes: 'Date is before retirement',
      })
      .expect(422);

    expect(res.body.error.code).toBe('SERVICE_EXTENSION_DATE_NOT_AFTER');
    expect(res.body.error.message).toContain('2030-01-15');
  });
});

// ─── 7.6: Extension date equal to current retirement → 422 ──────────

describe('POST /api/loans/:loanId/service-extensions — date equal to current', () => {
  it('rejects extension date equal to current retirement date (must be strictly after)', async () => {
    const loanId = await seedLoanWithTemporalProfile();

    const res = await request(app)
      .post(`/api/loans/${loanId}/service-extensions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        newRetirementDate: '2030-01-15',
        approvingAuthorityReference: 'PSC/EXT/2026/0045',
        notes: 'Same date as retirement',
      })
      .expect(422);

    expect(res.body.error.code).toBe('SERVICE_EXTENSION_DATE_NOT_AFTER');
  });
});

// ─── 7.7: Extension more than 10 years beyond → 422 ──────────────────

describe('POST /api/loans/:loanId/service-extensions — max exceeded', () => {
  it('rejects extension more than 10 years beyond current retirement date', async () => {
    const loanId = await seedLoanWithTemporalProfile();

    const res = await request(app)
      .post(`/api/loans/${loanId}/service-extensions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        newRetirementDate: '2041-01-16', // >10 years from 2030-01-15
        approvingAuthorityReference: 'PSC/EXT/2026/0046',
        notes: 'Too far',
      })
      .expect(422);

    expect(res.body.error.code).toBe('SERVICE_EXTENSION_MAX_EXCEEDED');
  });

  it('accepts extension exactly 10 years beyond current retirement date (boundary)', async () => {
    const loanId = await seedLoanWithTemporalProfile();

    const res = await request(app)
      .post(`/api/loans/${loanId}/service-extensions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        newRetirementDate: '2040-01-15', // exactly 10 years from 2030-01-15
        approvingAuthorityReference: 'PSC/EXT/2026/BOUNDARY',
        notes: 'Boundary test — exactly 10 years',
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.newRetirementDate).toBe('2040-01-15');
  });
});

// ─── 7.8: Multiple extensions — superseding chain ─────────────────────

describe('POST /api/loans/:loanId/service-extensions — multiple extensions', () => {
  it('second extension captures first extension date as originalComputedDate', async () => {
    const loanId = await seedLoanWithTemporalProfile();

    // First extension
    await request(app)
      .post(`/api/loans/${loanId}/service-extensions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        newRetirementDate: '2032-06-15',
        approvingAuthorityReference: 'PSC/EXT/2026/0047',
        notes: 'First extension',
      })
      .expect(201);

    // Second extension
    const res = await request(app)
      .post(`/api/loans/${loanId}/service-extensions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        newRetirementDate: '2034-01-01',
        approvingAuthorityReference: 'PSC/EXT/2026/0048',
        notes: 'Second extension',
      })
      .expect(201);

    // Second extension's originalComputedDate should be first extension's newRetirementDate
    expect(res.body.data.originalComputedDate).toBe('2032-06-15');
    expect(res.body.data.newRetirementDate).toBe('2034-01-01');

    // Loan's retirement date should be the latest extension
    const [loan] = await db.select({ computedRetirementDate: loans.computedRetirementDate })
      .from(loans).where(sql`id = ${loanId}`);
    expect(loan.computedRetirementDate!.toISOString().split('T')[0]).toBe('2034-01-01');
  });
});

// ─── 7.9: GET service-extensions → chronological list ──────────────────

describe('GET /api/loans/:loanId/service-extensions', () => {
  it('returns extension history in chronological order with createdByName', async () => {
    const loanId = await seedLoanWithTemporalProfile();

    // Create two extensions
    await request(app)
      .post(`/api/loans/${loanId}/service-extensions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        newRetirementDate: '2032-06-15',
        approvingAuthorityReference: 'PSC/EXT/2026/0049',
        notes: 'First extension',
      })
      .expect(201);

    await request(app)
      .post(`/api/loans/${loanId}/service-extensions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        newRetirementDate: '2034-01-01',
        approvingAuthorityReference: 'PSC/EXT/2026/0050',
        notes: 'Second extension',
      })
      .expect(201);

    const res = await request(app)
      .get(`/api/loans/${loanId}/service-extensions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);

    const [first, second] = res.body.data;
    expect(first.originalComputedDate).toBe('2030-01-15');
    expect(first.newRetirementDate).toBe('2032-06-15');
    expect(first.createdByName).toBe('Dept Admin');

    expect(second.originalComputedDate).toBe('2032-06-15');
    expect(second.newRetirementDate).toBe('2034-01-01');

    // Chronological order
    expect(new Date(first.createdAt).getTime()).toBeLessThanOrEqual(new Date(second.createdAt).getTime());
  });
});

// ─── 7.10: GET loan detail → temporalProfile reflects extension ───────

describe('GET /api/loans/:id — temporal profile with service extension', () => {
  it('shows extension data in temporal profile', async () => {
    const loanId = await seedLoanWithTemporalProfile();

    // Record an extension
    await request(app)
      .post(`/api/loans/${loanId}/service-extensions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        newRetirementDate: '2033-06-15',
        approvingAuthorityReference: 'PSC/EXT/2026/0051',
        notes: 'Extension for temporal profile test',
      })
      .expect(201);

    const res = await request(app)
      .get(`/api/loans/${loanId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    const tp = res.body.data.temporalProfile;
    expect(tp.hasServiceExtension).toBe(true);
    expect(tp.originalComputedRetirementDate).toBe('2030-01-15');
    expect(tp.latestExtensionReference).toBe('PSC/EXT/2026/0051');
    expect(tp.computedRetirementDate).toBe('2033-06-15');
    expect(tp.profileStatus).toBe('complete');
  });
});

// ─── 7.11: MDA scoping ──────────────────────────────────────────────

describe('MDA scoping for service extensions', () => {
  it('mda_officer can GET extensions for their MDA loan', async () => {
    const loanId = await seedLoanWithTemporalProfile({ mdaId: testMdaId });

    // Admin creates extension
    await request(app)
      .post(`/api/loans/${loanId}/service-extensions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        newRetirementDate: '2033-06-15',
        approvingAuthorityReference: 'PSC/EXT/2026/0052',
        notes: 'MDA scope test',
      })
      .expect(201);

    // Officer can GET for their MDA
    const res = await request(app)
      .get(`/api/loans/${loanId}/service-extensions`)
      .set('Authorization', `Bearer ${officerToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
  });

  it('mda_officer gets 403 for extensions of other MDA loan', async () => {
    const loanId = await seedLoanWithTemporalProfile({ mdaId: secondMdaId });

    // Super admin creates extension
    await request(app)
      .post(`/api/loans/${loanId}/service-extensions`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        newRetirementDate: '2033-06-15',
        approvingAuthorityReference: 'PSC/EXT/2026/0053',
        notes: 'Cross-MDA test',
      })
      .expect(201);

    // Officer gets 403 for other MDA
    await request(app)
      .get(`/api/loans/${loanId}/service-extensions`)
      .set('Authorization', `Bearer ${officerToken}`)
      .expect(403);
  });
});

// ─── 7.12: MDA officer cannot POST service-extensions → 403 ──────────

describe('POST /api/loans/:loanId/service-extensions — role enforcement', () => {
  it('mda_officer cannot POST service-extensions (only SUPER_ADMIN / DEPT_ADMIN)', async () => {
    const loanId = await seedLoanWithTemporalProfile({ mdaId: testMdaId });

    await request(app)
      .post(`/api/loans/${loanId}/service-extensions`)
      .set('Authorization', `Bearer ${officerToken}`)
      .send({
        newRetirementDate: '2033-06-15',
        approvingAuthorityReference: 'PSC/EXT/2026/0054',
        notes: 'Officer should not be able to do this',
      })
      .expect(403);
  });
});

// ─── 7.13: Immutability — UPDATE/DELETE on service_extensions ─────────

describe('service_extensions immutability', () => {
  it('rejects UPDATE on service extension records (DB trigger)', async () => {
    const loanId = await seedLoanWithTemporalProfile();

    await request(app)
      .post(`/api/loans/${loanId}/service-extensions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        newRetirementDate: '2033-06-15',
        approvingAuthorityReference: 'PSC/EXT/2026/0055',
        notes: 'Will try to tamper',
      })
      .expect(201);

    await expect(
      db.execute(sql`UPDATE service_extensions SET notes = 'Tampered' WHERE loan_id = ${loanId}`),
    ).rejects.toThrow();
  });

  it('rejects DELETE on service extension records (DB trigger)', async () => {
    const loanId = await seedLoanWithTemporalProfile();

    await request(app)
      .post(`/api/loans/${loanId}/service-extensions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        newRetirementDate: '2033-06-15',
        approvingAuthorityReference: 'PSC/EXT/2026/0056',
        notes: 'Will try to delete',
      })
      .expect(201);

    await expect(
      db.execute(sql`DELETE FROM service_extensions WHERE loan_id = ${loanId}`),
    ).rejects.toThrow();
  });
});

// ─── 7.14: Atomicity — failed extension → no loan update ──────────────

describe('Service extension atomicity', () => {
  it('does not update loan retirement date when validation rejects', async () => {
    const loanId = await seedLoanWithTemporalProfile();

    // Attempt extension with date before current retirement (will be rejected)
    await request(app)
      .post(`/api/loans/${loanId}/service-extensions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        newRetirementDate: '2029-01-01',
        approvingAuthorityReference: 'PSC/EXT/2026/0057',
        notes: 'Should fail and not update loan',
      })
      .expect(422);

    // Verify loan's retirement date unchanged
    const [loan] = await db.select({ computedRetirementDate: loans.computedRetirementDate })
      .from(loans).where(sql`id = ${loanId}`);
    expect(loan.computedRetirementDate!.toISOString().split('T')[0]).toBe('2030-01-15');

    // Verify no extension records
    const extensions = await db.select().from(serviceExtensions).where(sql`loan_id = ${loanId}`);
    expect(extensions).toHaveLength(0);
  });
});

// ─── 7.15: Zod validation ─────────────────────────────────────────────

describe('POST /api/loans/:loanId/service-extensions — Zod validation', () => {
  it('rejects missing approvingAuthorityReference → 400', async () => {
    const loanId = await seedLoanWithTemporalProfile();

    await request(app)
      .post(`/api/loans/${loanId}/service-extensions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        newRetirementDate: '2033-06-15',
        notes: 'Missing reference',
      })
      .expect(400);
  });

  it('rejects missing notes → 400', async () => {
    const loanId = await seedLoanWithTemporalProfile();

    await request(app)
      .post(`/api/loans/${loanId}/service-extensions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        newRetirementDate: '2033-06-15',
        approvingAuthorityReference: 'PSC/EXT/2026/0058',
      })
      .expect(400);
  });

  it('rejects invalid date format → 400', async () => {
    const loanId = await seedLoanWithTemporalProfile();

    await request(app)
      .post(`/api/loans/${loanId}/service-extensions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        newRetirementDate: 'not-a-date',
        approvingAuthorityReference: 'PSC/EXT/2026/0059',
        notes: 'Invalid date',
      })
      .expect(400);
  });
});

// ─── 7.16: Extension-aware temporal correction ─────────────────────────

describe('PATCH /api/loans/:loanId/temporal-profile — with active extension', () => {
  it('keeps extension date when DOB is corrected on a loan with active extension', async () => {
    const loanId = await seedLoanWithTemporalProfile();

    // Record a service extension
    await request(app)
      .post(`/api/loans/${loanId}/service-extensions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        newRetirementDate: '2033-06-15',
        approvingAuthorityReference: 'PSC/EXT/2026/0060',
        notes: 'Extension before DOB correction',
      })
      .expect(201);

    // Now correct DOB — formula date would change but extension should override
    const res = await request(app)
      .patch(`/api/loans/${loanId}/temporal-profile`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        dateOfBirth: '1975-06-15',
        reason: 'DOB correction after extension',
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    const tp = res.body.data.temporalProfile;

    // Retirement date should still be the extension date (not the recomputed formula date)
    expect(tp.computedRetirementDate).toBe('2033-06-15');
    expect(tp.hasServiceExtension).toBe(true);
    expect(tp.originalComputedRetirementDate).toBe('2030-01-15');

    // Verify the temporal correction record captures the new formula date (audit accuracy)
    const corrections = await db.select().from(temporalCorrections).where(sql`loan_id = ${loanId}`);
    expect(corrections).toHaveLength(1);
    expect(corrections[0].fieldName).toBe('date_of_birth');
    // Formula date: DOB(1975-06-15)+60 = 2035-06-15, appt(1995-06-01)+35 = 2030-06-01 → appt wins = 2030-06-01
    expect(corrections[0].newRetirementDate!.toISOString().split('T')[0]).toBe('2030-06-01');
  });
});
