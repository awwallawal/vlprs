import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import app from '../app';
import { db } from '../db/index';
import { users, mdas } from '../db/schema';
import { hashPassword } from '../lib/password';
import { signAccessToken } from '../lib/jwt';
import { generateUuidv7 } from '../lib/uuidv7';
import { resetRateLimiters } from '../middleware/rateLimiter';

let testMdaId: string;
let adminToken: string;
let deptAdminToken: string;
let officerToken: string;

beforeAll(async () => {
  await db.execute(sql`TRUNCATE audit_log, refresh_tokens, users, mdas CASCADE`);

  testMdaId = generateUuidv7();
  await db.insert(mdas).values({ id: testMdaId, name: 'Health Test MDA', code: 'HLTH', abbreviation: 'Health Test' });

  const hashed = await hashPassword('Password1');

  // SUPER_ADMIN
  const adminUserId = generateUuidv7();
  await db.insert(users).values({
    id: adminUserId, email: 'admin-health@test.com', hashedPassword: hashed,
    firstName: 'Admin', lastName: 'Health', role: 'super_admin', isActive: true,
  });
  adminToken = signAccessToken({ userId: adminUserId, email: 'admin-health@test.com', role: 'super_admin', mdaId: null });

  // DEPT_ADMIN
  const deptAdminUserId = generateUuidv7();
  await db.insert(users).values({
    id: deptAdminUserId, email: 'dept-health@test.com', hashedPassword: hashed,
    firstName: 'Dept', lastName: 'Health', role: 'dept_admin', isActive: true,
  });
  deptAdminToken = signAccessToken({ userId: deptAdminUserId, email: 'dept-health@test.com', role: 'dept_admin', mdaId: null });

  // MDA_OFFICER
  const officerUserId = generateUuidv7();
  await db.insert(users).values({
    id: officerUserId, email: 'officer-health@test.com', hashedPassword: hashed,
    firstName: 'Officer', lastName: 'Health', role: 'mda_officer', mdaId: testMdaId, isActive: true,
  });
  officerToken = signAccessToken({ userId: officerUserId, email: 'officer-health@test.com', role: 'mda_officer', mdaId: testMdaId });
});

beforeEach(() => {
  resetRateLimiters();
});

afterAll(async () => {
  await db.execute(sql`TRUNCATE audit_log, refresh_tokens, users, mdas CASCADE`);
});

describe('GET /api/system-health', () => {
  it('returns 401 without authentication', async () => {
    const res = await request(app).get('/api/system-health');
    expect(res.status).toBe(401);
  });

  it('returns 403 for MDA_OFFICER', async () => {
    const res = await request(app)
      .get('/api/system-health')
      .set('Authorization', `Bearer ${officerToken}`);
    expect(res.status).toBe(403);
  });

  it('returns 15 metrics for SUPER_ADMIN across 4 groups', async () => {
    const res = await request(app)
      .get('/api/system-health')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    expect(data.groups).toHaveLength(4);

    const groupNames = data.groups.map((g: { name: string }) => g.name);
    expect(groupNames).toContain('Infrastructure');
    expect(groupNames).toContain('API Performance');
    expect(groupNames).toContain('Data Integrity');
    expect(groupNames).toContain('Business Health');

    // Count total metrics across all groups
    const totalMetrics = data.groups.reduce(
      (sum: number, g: { metrics: unknown[] }) => sum + g.metrics.length,
      0,
    );
    expect(totalMetrics).toBe(15);

    // Verify response shape
    expect(data.lastIntegrityCheck).toBeDefined();
    expect(data.serverUptime).toBeDefined();
  });

  it('returns 8 metrics for DEPT_ADMIN (no Infrastructure)', async () => {
    const res = await request(app)
      .get('/api/system-health')
      .set('Authorization', `Bearer ${deptAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    expect(data.groups).toHaveLength(3);

    const groupNames = data.groups.map((g: { name: string }) => g.name);
    expect(groupNames).not.toContain('Infrastructure');
    expect(groupNames).toContain('API Performance');
    expect(groupNames).toContain('Data Integrity');
    expect(groupNames).toContain('Business Health');

    // DEPT_ADMIN gets 2 API Performance + 3 Data Integrity + 3 Business Health = 8
    const totalMetrics = data.groups.reduce(
      (sum: number, g: { metrics: unknown[] }) => sum + g.metrics.length,
      0,
    );
    expect(totalMetrics).toBe(8);
  });

  it('each metric has required fields', async () => {
    const res = await request(app)
      .get('/api/system-health')
      .set('Authorization', `Bearer ${adminToken}`);

    for (const group of res.body.data.groups) {
      for (const metric of group.metrics) {
        expect(metric.name).toBeDefined();
        expect(metric.value).toBeDefined();
        expect(['green', 'amber', 'grey']).toContain(metric.status);
      }
    }
  });
});
