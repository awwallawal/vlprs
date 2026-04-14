import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import app from '../app';
import { db } from '../db/index';
import { users, mdas, mdaAliases, migrationUploads, migrationRecords } from '../db/schema';
import { hashPassword } from '../lib/password';
import { signAccessToken } from '../lib/jwt';
import { generateUuidv7 } from '../lib/uuidv7';
import { resetRateLimiters } from '../middleware/rateLimiter';
import * as mdaService from '../services/mdaService';
import * as fileDelineationService from '../services/fileDelineationService';

let healthMdaId: string;
let agricultureMdaId: string;
let accosMdaId: string;
let adminToken: string;
let deptAdminToken: string;

beforeAll(async () => {
  await db.execute(sql`TRUNCATE loan_state_transitions, ledger_entries, loans, scheme_config, refresh_tokens, audit_log, users, mdas CASCADE`);

  healthMdaId = generateUuidv7();
  agricultureMdaId = generateUuidv7();
  accosMdaId = generateUuidv7();

  await db.insert(mdas).values([
    { id: healthMdaId, name: 'Ministry of Health', code: 'HEALTH', abbreviation: 'Health' },
    { id: agricultureMdaId, name: 'Ministry of Agriculture', code: 'AGRICULTURE', abbreviation: 'Agriculture' },
    { id: accosMdaId, name: 'Agricultural Credit Corporation of Oyo State', code: 'ACCOS', abbreviation: 'ACCOS' },
  ]);

  // Seed an existing alias for duplicate testing
  await db.insert(mdaAliases).values({
    id: generateUuidv7(),
    mdaId: healthMdaId,
    alias: 'HLT',
  });

  const hashed = await hashPassword('Password1');

  const adminUserId = generateUuidv7();
  await db.insert(users).values({
    id: adminUserId,
    email: 'admin-alias@test.com',
    hashedPassword: hashed,
    firstName: 'Admin',
    lastName: 'User',
    role: 'super_admin',
    isActive: true,
  });
  adminToken = signAccessToken({ userId: adminUserId, email: 'admin-alias@test.com', role: 'super_admin', mdaId: null });

  const deptAdminUserId = generateUuidv7();
  await db.insert(users).values({
    id: deptAdminUserId,
    email: 'dept-admin-alias@test.com',
    hashedPassword: hashed,
    firstName: 'Dept',
    lastName: 'Admin',
    role: 'dept_admin',
    isActive: true,
  });
  deptAdminToken = signAccessToken({ userId: deptAdminUserId, email: 'dept-admin-alias@test.com', role: 'dept_admin', mdaId: null });
});

beforeEach(() => {
  resetRateLimiters();
});

afterAll(async () => {
  await db.execute(sql`TRUNCATE loan_state_transitions, ledger_entries, loans, scheme_config, refresh_tokens, audit_log, users, mdas CASCADE`);
});

describe('POST /api/mdas/aliases — create alias (Task A2)', () => {
  it('creates alias and resolves in subsequent resolveMdaByName calls (A2.5)', async () => {
    // Verify "MYHEALTH" doesn't resolve before
    const before = await mdaService.resolveMdaByName('MYHEALTH');
    expect(before).toBeNull();

    // Create alias
    const res = await request(app)
      .post('/api/mdas/aliases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ alias: 'MYHEALTH', mdaId: healthMdaId });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.alias).toBe('MYHEALTH');
    expect(res.body.data.mdaId).toBe(healthMdaId);

    // Now it should resolve
    const after = await mdaService.resolveMdaByName('MYHEALTH');
    expect(after).not.toBeNull();
    expect(after!.code).toBe('HEALTH');
  });

  it('duplicate alias (case-insensitive) returns 409 (A2.6)', async () => {
    const res = await request(app)
      .post('/api/mdas/aliases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ alias: 'hlt', mdaId: agricultureMdaId }); // 'HLT' already exists

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALIAS_EXISTS');
  });

  it('rejects alias matching existing MDA code', async () => {
    const res = await request(app)
      .post('/api/mdas/aliases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ alias: 'HEALTH', mdaId: agricultureMdaId });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('ALIAS_CONFLICTS_WITH_CODE');
  });

  it('dept_admin can create alias', async () => {
    const res = await request(app)
      .post('/api/mdas/aliases')
      .set('Authorization', `Bearer ${deptAdminToken}`)
      .send({ alias: 'AGRI', mdaId: agricultureMdaId });

    expect(res.status).toBe(201);
  });
});

describe('GET /api/mdas/aliases — list aliases', () => {
  it('returns aliases with MDA names joined', async () => {
    const res = await request(app)
      .get('/api/mdas/aliases')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    const first = res.body.data[0];
    expect(first).toHaveProperty('alias');
    expect(first).toHaveProperty('mdaName');
    expect(first).toHaveProperty('mdaCode');
  });
});

describe('DELETE /api/mdas/aliases/:id — remove alias', () => {
  it('super_admin can delete alias', async () => {
    // Create one to delete
    const createRes = await request(app)
      .post('/api/mdas/aliases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ alias: 'TODELETE', mdaId: healthMdaId });

    const aliasId = createRes.body.data.id;

    const res = await request(app)
      .delete(`/api/mdas/aliases/${aliasId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
  });

  it('returns 404 for non-existent alias', async () => {
    const res = await request(app)
      .delete(`/api/mdas/aliases/${generateUuidv7()}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });
});

describe('POST /api/mdas/resolve — batch resolution (Task A3)', () => {
  it('returns mix of auto-matched, needs_review, and unknown (A3.5)', async () => {
    const res = await request(app)
      .post('/api/mdas/resolve')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ strings: ['HEALTH', 'AGRIC', 'COMPLETELY_UNKNOWN_XYZ'] });

    expect(res.status).toBe(200);
    const { results } = res.body.data;
    expect(results.length).toBe(3);

    const health = results.find((r: { input: string }) => r.input === 'HEALTH');
    expect(health.status).toBe('auto_matched');
    expect(health.resolved).not.toBeNull();

    const agric = results.find((r: { input: string }) => r.input === 'AGRIC');
    expect(agric.status).toBe('needs_review');
    expect(agric.candidates.length).toBeGreaterThan(0);

    const unknown = results.find((r: { input: string }) => r.input === 'COMPLETELY_UNKNOWN_XYZ');
    expect(unknown.status).toBe('unknown');
  });

  it('deduplicates input strings (case-insensitive)', async () => {
    const res = await request(app)
      .post('/api/mdas/resolve')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ strings: ['HEALTH', 'health', 'Health'] });

    expect(res.status).toBe(200);
    expect(res.body.data.results.length).toBe(1);
  });
});

describe('confirmBoundaries alias learning (Task A4)', () => {
  let uploadId: string;
  let adminUserId: string;

  beforeAll(async () => {
    // Look up the admin user ID from the already-seeded admin user
    const [adminUser] = await db.select({ id: users.id }).from(users).where(sql`email = 'admin-alias@test.com'`);
    adminUserId = adminUser.id;

    // Create a migration upload with an ambiguous delineation result
    uploadId = generateUuidv7();
    await db.insert(migrationUploads).values({
      id: uploadId,
      mdaId: healthMdaId,
      uploadedBy: adminUserId,
      filename: 'test-delineation.xlsx',
      fileSizeBytes: 1024,
      sheetCount: 1,
      totalRecords: 2,
      status: 'completed',
      delineationResult: {
        uploadId,
        targetMdaId: healthMdaId,
        targetMdaName: 'Ministry of Health',
        delineated: true,
        totalRecords: 2,
        sections: [
          {
            sectionIndex: 0,
            sheetName: 'Sheet1',
            mdaId: healthMdaId,
            mdaCode: 'HEALTH',
            mdaName: 'HLTH DEPT',  // raw text that doesn't resolve
            resolvedMdaName: null,
            startRow: 2,
            endRow: 3,
            recordCount: 2,
            confidence: 'ambiguous',  // this triggers alias learning
          },
        ],
      },
    });

    // Create migration records for the section
    await db.insert(migrationRecords).values([
      { id: generateUuidv7(), uploadId, staffName: 'Test Worker 1', rowNumber: 2, era: 3, sheetName: 'Sheet1', mdaId: healthMdaId, sourceRow: 2, sourceFile: 'test.xlsx', sourceSheet: 'Sheet1' },
      { id: generateUuidv7(), uploadId, staffName: 'Test Worker 2', rowNumber: 3, era: 3, sheetName: 'Sheet1', mdaId: healthMdaId, sourceRow: 3, sourceFile: 'test.xlsx', sourceSheet: 'Sheet1' },
    ]);
  });

  it('A4.3: confirm ambiguous section → alias created → future resolveMdaByName resolves (A4.3)', async () => {
    // Verify "HLTH DEPT" doesn't resolve before confirmation
    const before = await mdaService.resolveMdaByName('HLTH DEPT');
    expect(before).toBeNull();

    // Confirm the ambiguous section with the correct MDA
    await fileDelineationService.confirmBoundaries(
      uploadId,
      [{ sectionIndex: 0, mdaId: healthMdaId }],
      adminUserId,
    );

    // Now "HLTH DEPT" should resolve via the newly created alias
    const after = await mdaService.resolveMdaByName('HLTH DEPT');
    expect(after).not.toBeNull();
    expect(after!.code).toBe('HEALTH');
  });
});
