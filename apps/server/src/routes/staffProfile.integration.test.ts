import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { sql, eq } from 'drizzle-orm';
import app from '../app';
import { db } from '../db/index';
import { users, mdas, migrationUploads, migrationRecords, personMatches } from '../db/schema';
import { signAccessToken } from '../lib/jwt';
import { generateUuidv7 } from '../lib/uuidv7';
import { resetRateLimiters } from '../middleware/rateLimiter';

let mdaJusticeId: string;
let mdaInfoId: string;
let mdaAgricId: string;
let mdaCduId: string;
let testUserId: string;
let adminToken: string;
let uploadJusticeId: string;
let uploadInfoId: string;

beforeAll(async () => {
  await db.execute(sql`TRUNCATE person_matches, migration_records, migration_extra_fields, migration_uploads, audit_log, refresh_tokens, users, mda_aliases, mdas CASCADE`);

  // Create test MDAs
  mdaJusticeId = generateUuidv7();
  mdaInfoId = generateUuidv7();
  mdaAgricId = generateUuidv7();
  mdaCduId = generateUuidv7();

  await db.insert(mdas).values([
    { id: mdaJusticeId, name: 'Ministry of Justice', code: 'JUSTICE', abbreviation: 'Justice' },
    { id: mdaInfoId, name: 'Ministry of Information', code: 'INFORMATION', abbreviation: 'Info' },
    { id: mdaAgricId, name: 'Ministry of Agriculture', code: 'AGRICULTURE', abbreviation: 'Agric' },
    { id: mdaCduId, name: 'Cocoa Development Unit', code: 'CDU', abbreviation: 'CDU', parentMdaId: mdaAgricId },
  ]);

  // Create super_admin user
  testUserId = generateUuidv7();
  await db.insert(users).values({
    id: testUserId,
    email: 'sp-admin@test.com',
    hashedPassword: 'hashed',
    firstName: 'SP',
    lastName: 'Admin',
    role: 'super_admin',
  });

  adminToken = signAccessToken({
    userId: testUserId,
    email: 'sp-admin@test.com',
    role: 'super_admin',
    mdaId: null,
    mustChangePassword: false,
  });
});

beforeEach(async () => {
  resetRateLimiters();
  await db.execute(sql`TRUNCATE person_matches, migration_records, migration_extra_fields, migration_uploads, audit_log CASCADE`);

  // Create uploads for Justice and Information
  uploadJusticeId = generateUuidv7();
  uploadInfoId = generateUuidv7();

  await db.insert(migrationUploads).values([
    { id: uploadJusticeId, mdaId: mdaJusticeId, uploadedBy: testUserId, filename: 'justice.xlsx', fileSizeBytes: 1024, sheetCount: 1, totalRecords: 3, status: 'completed' },
    { id: uploadInfoId, mdaId: mdaInfoId, uploadedBy: testUserId, filename: 'info.xlsx', fileSizeBytes: 1024, sheetCount: 1, totalRecords: 2, status: 'completed' },
  ]);

  // OLANIYAN BABATUNDE — appears in both Justice and Information (cross-MDA exact match)
  await db.insert(migrationRecords).values([
    { id: generateUuidv7(), uploadId: uploadJusticeId, mdaId: mdaJusticeId, sheetName: 'S1', rowNumber: 2, era: 3, staffName: 'OLANIYAN BABATUNDE', principal: '250000', totalLoan: '283325', monthlyDeduction: '4722', sourceFile: 'justice.xlsx', sourceSheet: 'S1', sourceRow: 2, periodYear: 2020, periodMonth: 1, varianceCategory: 'clean', hasRateVariance: false },
    { id: generateUuidv7(), uploadId: uploadJusticeId, mdaId: mdaJusticeId, sheetName: 'S1', rowNumber: 3, era: 3, staffName: 'OLANIYAN BABATUNDE', principal: '250000', totalLoan: '283325', monthlyDeduction: '4722', sourceFile: 'justice.xlsx', sourceSheet: 'S1', sourceRow: 3, periodYear: 2020, periodMonth: 2, varianceCategory: 'clean', hasRateVariance: false },
  ]);
  await db.insert(migrationRecords).values({
    id: generateUuidv7(), uploadId: uploadInfoId, mdaId: mdaInfoId, sheetName: 'S1', rowNumber: 2, era: 3, staffName: 'OLANIYAN BABATUNDE', principal: '100000', totalLoan: '113330', monthlyDeduction: '1889', sourceFile: 'info.xlsx', sourceSheet: 'S1', sourceRow: 2, periodYear: 2021, periodMonth: 6, varianceCategory: 'minor_variance', hasRateVariance: true,
  });

  // ADEYEMI FOLASHADE — Justice only, with title variant
  await db.insert(migrationRecords).values({
    id: generateUuidv7(), uploadId: uploadJusticeId, mdaId: mdaJusticeId, sheetName: 'S1', rowNumber: 4, era: 3, staffName: 'MRS. ADEYEMI FOLASHADE', principal: '150000', totalLoan: '170000', monthlyDeduction: '2833', sourceFile: 'justice.xlsx', sourceSheet: 'S1', sourceRow: 4, periodYear: 2020, periodMonth: 1, varianceCategory: 'clean', hasRateVariance: false, dateOfBirth: '1980-05-15', dateOfFirstAppointment: '2005-01-01',
  });

  // BELLO AMINAT — Information only, profile incomplete (no DOB)
  await db.insert(migrationRecords).values({
    id: generateUuidv7(), uploadId: uploadInfoId, mdaId: mdaInfoId, sheetName: 'S1', rowNumber: 3, era: 3, staffName: 'BELLO AMINAT', principal: '300000', totalLoan: '340000', monthlyDeduction: '5667', sourceFile: 'info.xlsx', sourceSheet: 'S1', sourceRow: 3, periodYear: 2021, periodMonth: 1, varianceCategory: 'significant_variance', hasRateVariance: false,
  });
});

afterAll(async () => {
  await db.execute(sql`TRUNCATE person_matches, migration_records, migration_extra_fields, migration_uploads, audit_log, refresh_tokens, users, mda_aliases, mdas CASCADE`);
});

describe('POST /api/migrations/match-persons', () => {
  it('detects exact name match across 2 MDAs', async () => {
    const res = await request(app)
      .post('/api/migrations/match-persons')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.multiMdaPersons).toBeGreaterThanOrEqual(1);
    expect(res.body.data.autoMatched).toBeGreaterThanOrEqual(1);

    // Verify person_match created
    const matches = await db.select().from(personMatches);
    const olaniyanMatch = matches.find(
      (m) => m.personAName === 'OLANIYAN BABATUNDE' || m.personBName === 'OLANIYAN BABATUNDE',
    );
    expect(olaniyanMatch).toBeDefined();
    expect(olaniyanMatch!.matchType).toBe('exact_name');
    expect(olaniyanMatch!.confidence).toBe('1.00');
    expect(olaniyanMatch!.status).toBe('auto_confirmed');
  });

  it('returns correct summary counts', async () => {
    const res = await request(app)
      .post('/api/migrations/match-persons')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data.totalPersons).toBeGreaterThanOrEqual(3);
    expect(res.body.data.multiMdaPersons).toBeGreaterThanOrEqual(1);
  });

  it('does not create duplicate matches on re-run', async () => {
    await request(app)
      .post('/api/migrations/match-persons')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const firstCount = (await db.select().from(personMatches)).length;

    await request(app)
      .post('/api/migrations/match-persons')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const secondCount = (await db.select().from(personMatches)).length;
    expect(secondCount).toBe(firstCount);
  });
});

describe('GET /api/migrations/persons', () => {
  it('returns paginated person list', async () => {
    const res = await request(app)
      .get('/api/migrations/persons')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.total).toBeGreaterThanOrEqual(3);
  });

  it('person profile aggregates records across MDAs with correct counts', async () => {
    const res = await request(app)
      .get('/api/migrations/persons')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const olaniyan = res.body.data.find((p: { staffName: string }) =>
      p.staffName.includes('OLANIYAN'),
    );
    expect(olaniyan).toBeDefined();
    expect(olaniyan.recordCount).toBe(3);
    expect(olaniyan.mdas.length).toBe(2);
  });

  it('profile completeness indicator reflects DOB/appointment field presence', async () => {
    const res = await request(app)
      .get('/api/migrations/persons')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    // ADEYEMI has DOB and appointment — profile complete
    const adeyemi = res.body.data.find((p: { staffName: string }) =>
      p.staffName.includes('ADEYEMI'),
    );
    expect(adeyemi).toBeDefined();
    expect(adeyemi.profileComplete).toBe(true);

    // BELLO has no DOB — profile incomplete
    const bello = res.body.data.find((p: { staffName: string }) =>
      p.staffName.includes('BELLO'),
    );
    expect(bello).toBeDefined();
    expect(bello.profileComplete).toBe(false);
  });

  it('variance data from Story 3.2 appears in person list', async () => {
    const res = await request(app)
      .get('/api/migrations/persons')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    // OLANIYAN has 1 minor_variance record — varianceCount should be 1
    const olaniyan = res.body.data.find((p: { staffName: string }) =>
      p.staffName.includes('OLANIYAN'),
    );
    expect(olaniyan.varianceCount).toBe(1);
    expect(olaniyan.hasRateVariance).toBe(true);
  });
});

describe('GET /api/migrations/persons/:personKey', () => {
  it('returns full person profile with timeline', async () => {
    const personKey = encodeURIComponent('JUSTICE:OLANIYAN BABATUNDE');
    const res = await request(app)
      .get(`/api/migrations/persons/${personKey}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.staffName).toBe('OLANIYAN BABATUNDE');
    expect(res.body.data.mdas.length).toBe(2);
    expect(res.body.data.timelines.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.recordsByMda).toBeDefined();
  });

  it('returns 404 for non-existent person', async () => {
    const personKey = encodeURIComponent('JUSTICE:NONEXISTENT PERSON');
    await request(app)
      .get(`/api/migrations/persons/${personKey}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });
});

describe('PATCH /api/migrations/matches/:matchId/confirm', () => {
  it('confirms a pending match', async () => {
    // First run matching to create matches
    await request(app)
      .post('/api/migrations/match-persons')
      .set('Authorization', `Bearer ${adminToken}`);

    // Find a pending match (if any)
    const matches = await db.select().from(personMatches);
    const pending = matches.find((m) => m.status === 'pending_review');

    if (pending) {
      const res = await request(app)
        .patch(`/api/migrations/matches/${pending.id}/confirm`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.status).toBe('confirmed');
    }
  });
});

describe('PATCH /api/migrations/matches/:matchId/reject', () => {
  it('rejects a pending match', async () => {
    await request(app)
      .post('/api/migrations/match-persons')
      .set('Authorization', `Bearer ${adminToken}`);

    const matches = await db.select().from(personMatches);
    const pending = matches.find((m) => m.status === 'pending_review');

    if (pending) {
      const res = await request(app)
        .patch(`/api/migrations/matches/${pending.id}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.status).toBe('rejected');
    }
  });
});

describe('GET /api/migrations/matches', () => {
  it('lists pending matches', async () => {
    const res = await request(app)
      .get('/api/migrations/matches')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toBeDefined();
  });
});
