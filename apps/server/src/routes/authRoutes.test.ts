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

beforeAll(async () => {
  await db.execute(sql`TRUNCATE audit_log, refresh_tokens, users, mdas CASCADE`);

  testMdaId = generateUuidv7();
  await db.insert(mdas).values({ id: testMdaId, name: 'Test MDA', code: 'TSTI', abbreviation: 'Test MDA' });
});

beforeEach(async () => {
  resetRateLimiters();
  await db.execute(sql`TRUNCATE audit_log, refresh_tokens, users CASCADE`);
});

afterAll(async () => {
  await db.execute(sql`TRUNCATE audit_log, refresh_tokens, users, mdas CASCADE`);
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

function superAdminToken(userId: string, email: string) {
  return signAccessToken({ userId, email, role: 'super_admin', mdaId: null });
}

describe('POST /api/auth/login', () => {
  it('returns 200 with accessToken and cookie for valid credentials', async () => {
    await createTestUser({ email: 'valid@test.com' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'valid@test.com', password: 'Password1' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.user.email).toBe('valid@test.com');
    expect(res.body.data.user).not.toHaveProperty('hashedPassword');

    // Check refresh token cookie
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const cookieStr = Array.isArray(cookies) ? cookies.join(';') : cookies;
    expect(cookieStr).toContain('refreshToken');
    expect(cookieStr).toContain('HttpOnly');
  });

  it('returns 401 for wrong password', async () => {
    await createTestUser({ email: 'wrong@test.com' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'wrong@test.com', password: 'WrongPass1' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('LOGIN_UNSUCCESSFUL');
  });

  it('returns 401 for non-existent email (same response as wrong password)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nonexistent@test.com', password: 'Password1' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('LOGIN_UNSUCCESSFUL');
  });

  it('returns 403 for inactive user', async () => {
    await createTestUser({ email: 'inactive@test.com', isActive: false });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'inactive@test.com', password: 'Password1' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_INACTIVE');
  });

  it('returns 423 after 5 failed login attempts (lockout)', async () => {
    await createTestUser({ email: 'lockout@test.com', failedLoginAttempts: 4 });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'lockout@test.com', password: 'WrongPass1' });

    expect(res.status).toBe(423);
    expect(res.body.error.code).toBe('ACCOUNT_TEMPORARILY_LOCKED');
  });

  it('returns 400 for invalid body', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.details).toBeDefined();
  });
});

describe('POST /api/auth/register', () => {
  it('returns 201 with valid Super Admin JWT', async () => {
    const admin = await createTestUser({ email: 'admin@test.com', role: 'super_admin' });
    const token = superAdminToken(admin.id, admin.email);

    const res = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'newuser@test.com',
        password: 'SecurePass1',
        firstName: 'New',
        lastName: 'User',
        role: 'mda_officer',
        mdaId: testMdaId,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe('newuser@test.com');
    expect(res.body.data.role).toBe('mda_officer');
    expect(res.body.data).not.toHaveProperty('hashedPassword');
  });

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'noauth@test.com',
        password: 'SecurePass1',
        firstName: 'No',
        lastName: 'Auth',
        role: 'super_admin',
      });

    expect(res.status).toBe(401);
  });

  it('returns 403 for dept_admin (authorise middleware enforces super_admin only)', async () => {
    const deptAdmin = await createTestUser({
      email: 'deptadmin@test.com',
      role: 'dept_admin',
    });
    const token = signAccessToken({
      userId: deptAdmin.id,
      email: deptAdmin.email,
      role: 'dept_admin',
      mdaId: null,
    });

    const res = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'newreg2@test.com',
        password: 'SecurePass1',
        firstName: 'New',
        lastName: 'Reg',
        role: 'mda_officer',
        mdaId: testMdaId,
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
  });

  it('returns 403 with non-super_admin JWT', async () => {
    const officer = await createTestUser({
      email: 'officer@test.com',
      role: 'mda_officer',
      mdaId: testMdaId,
    });
    const token = signAccessToken({
      userId: officer.id,
      email: officer.email,
      role: 'mda_officer',
      mdaId: testMdaId,
    });

    const res = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'newreg@test.com',
        password: 'SecurePass1',
        firstName: 'New',
        lastName: 'Reg',
        role: 'super_admin',
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
  });

  it('returns 409 for duplicate email', async () => {
    const admin = await createTestUser({ email: 'regadmin@test.com', role: 'super_admin' });
    const token = superAdminToken(admin.id, admin.email);

    // Create user first
    await createTestUser({ email: 'exists@test.com' });

    const res = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'exists@test.com',
        password: 'SecurePass1',
        firstName: 'Dup',
        lastName: 'User',
        role: 'super_admin',
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('returns 400 with invalid body and field errors', async () => {
    const admin = await createTestUser({ email: 'valadmin@test.com', role: 'super_admin' });
    const token = superAdminToken(admin.id, admin.email);

    const res = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'not-valid',
        password: 'short',
        firstName: '',
        lastName: '',
        role: 'invalid',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.details).toBeDefined();
    expect(Array.isArray(res.body.error.details)).toBe(true);
  });
});

describe('Rate limiting on /api/auth/login', () => {
  it('returns 429 after exceeding auth rate limit', async () => {
    await createTestUser({ email: 'ratelimit@test.com' });

    // Make 5 requests (at the limit)
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/auth/login')
        .send({ email: 'ratelimit@test.com', password: 'WrongPass1' });
    }

    // 6th request should be rate limited
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ratelimit@test.com', password: 'WrongPass1' });

    expect(res.status).toBe(429);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
  });
});
