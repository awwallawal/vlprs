import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import app from '../app';
import { db } from '../db/index';
import { users, mdas, refreshTokens } from '../db/schema';
import { hashPassword } from '../lib/password';
import { signAccessToken } from '../lib/jwt';
import { generateUuidv7 } from '../lib/uuidv7';

let testMdaId: string;

beforeAll(async () => {
  await db.execute(sql`TRUNCATE audit_log`);
  await db.delete(refreshTokens);
  await db.delete(users);
  await db.delete(mdas);

  testMdaId = generateUuidv7();
  await db.insert(mdas).values({ id: testMdaId, name: 'Test MDA', code: 'RBAC' });
});

beforeEach(async () => {
  await db.execute(sql`TRUNCATE audit_log`);
  await db.delete(refreshTokens);
  await db.delete(users);
});

afterAll(async () => {
  await db.execute(sql`TRUNCATE audit_log`);
  await db.delete(refreshTokens);
  await db.delete(users);
  await db.delete(mdas);
});

async function createTestUser(overrides: Partial<typeof users.$inferInsert> = {}) {
  const hashed = await hashPassword('Password1');
  const id = generateUuidv7();
  const defaults = {
    id,
    email: `user-${id.slice(0, 8)}@test.com`,
    hashedPassword: hashed,
    firstName: 'Test',
    lastName: 'User',
    role: 'super_admin' as const,
    mdaId: null,
    ...overrides,
  };
  await db.insert(users).values(defaults);
  return defaults;
}

function tokenFor(userId: string, email: string, role: string, mdaId: string | null = null) {
  return signAccessToken({ userId, email, role: role as 'super_admin', mdaId });
}

describe('GET /api/users', () => {
  it('returns 200 with list of users for super_admin', async () => {
    const admin = await createTestUser({ email: 'admin@test.com', role: 'super_admin' });
    await createTestUser({ email: 'other@test.com', role: 'dept_admin' });
    const token = tokenFor(admin.id, admin.email, 'super_admin');

    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(2);
  });

  it('returns 200 with list of users for dept_admin', async () => {
    const admin = await createTestUser({ email: 'dept@test.com', role: 'dept_admin' });
    const token = tokenFor(admin.id, admin.email, 'dept_admin');

    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('returns 403 INSUFFICIENT_PERMISSIONS for mda_officer', async () => {
    const officer = await createTestUser({
      email: 'officer@test.com',
      role: 'mda_officer',
      mdaId: testMdaId,
    });
    const token = tokenFor(officer.id, officer.email, 'mda_officer', testMdaId);

    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
  });

  it('returns 401 without JWT', async () => {
    const res = await request(app).get('/api/users');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('AUTHENTICATION_REQUIRED');
  });

  it('returns 401 with expired/invalid JWT', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', 'Bearer invalid-token-here');

    expect(res.status).toBe(401);
  });

  it('excludes hashed_password from response', async () => {
    const admin = await createTestUser({ email: 'nopwd@test.com', role: 'super_admin' });
    const token = tokenFor(admin.id, admin.email, 'super_admin');

    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    for (const user of res.body.data) {
      expect(user).not.toHaveProperty('hashedPassword');
      expect(user).not.toHaveProperty('hashed_password');
    }
  });

  it('excludes soft-deleted users', async () => {
    const admin = await createTestUser({ email: 'active@test.com', role: 'super_admin' });
    await createTestUser({
      email: 'deleted@test.com',
      role: 'dept_admin',
      deletedAt: new Date(),
    });
    const token = tokenFor(admin.id, admin.email, 'super_admin');

    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const emails = res.body.data.map((u: { email: string }) => u.email);
    expect(emails).toContain('active@test.com');
    expect(emails).not.toContain('deleted@test.com');
  });
});
