import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import app from '../app';
import { db } from '../db/index';
import { users, mdas, refreshTokens } from '../db/schema';
import { hashPassword } from '../lib/password';
import { generateUuidv7 } from '../lib/uuidv7';

beforeAll(async () => {
  await db.delete(refreshTokens);
  await db.delete(users);
  await db.delete(mdas);
});

beforeEach(async () => {
  await db.delete(refreshTokens);
  await db.delete(users);
});

afterAll(async () => {
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

/** Extract name=value from a Set-Cookie header string */
function extractCookieValue(setCookieStr: string): string {
  return setCookieStr.split(';')[0]; // e.g. "refreshToken=abc123"
}

async function loginAndGetTokens(email: string) {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password: 'Password1' });

  const rawCookies = res.headers['set-cookie'];
  const setCookies = (Array.isArray(rawCookies) ? rawCookies : [rawCookies].filter(Boolean)) as string[];
  const refreshSetCookie = setCookies?.find((c) => c.startsWith('refreshToken=')) ?? '';
  const csrfSetCookie = setCookies?.find((c) => c.startsWith('__csrf=')) ?? '';

  // Extract just name=value parts for Cookie request header
  const refreshCookieNV = extractCookieValue(refreshSetCookie);
  const csrfCookieNV = extractCookieValue(csrfSetCookie);

  // Extract CSRF token value (after "=") for X-CSRF-Token header
  const csrfTokenValue = csrfCookieNV.split('=').slice(1).join('=');

  return {
    accessToken: res.body.data.accessToken as string,
    cookieHeader: `${refreshCookieNV}; ${csrfCookieNV}`,
    csrfToken: csrfTokenValue,
    userId: res.body.data.user.id as string,
  };
}

describe('POST /api/auth/refresh', () => {
  it('returns 200 with new accessToken for valid cookie + CSRF', async () => {
    const user = await createTestUser({ email: 'refresh-ok@test.com' });
    const tokens = await loginAndGetTokens(user.email);

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', tokens.cookieHeader)
      .set('X-CSRF-Token', tokens.csrfToken);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeTruthy();

    // Should set new refresh token cookie
    const rawNew = res.headers['set-cookie'];
    const newCookies = (Array.isArray(rawNew) ? rawNew : [rawNew].filter(Boolean)) as string[];
    const newRefreshCookie = newCookies?.find((c) => c.startsWith('refreshToken='));
    expect(newRefreshCookie).toBeDefined();
  });

  it('returns 403 without any cookies (CSRF rejects first)', async () => {
    const res = await request(app)
      .post('/api/auth/refresh');

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_VALIDATION_FAILED');
  });

  it('returns 401 for expired token (manipulate DB after login)', async () => {
    const user = await createTestUser({ email: 'refresh-exp@test.com' });
    const tokens = await loginAndGetTokens(user.email);

    // Set the token's expiresAt to the past in DB (cookie stays valid for CSRF)
    await db.update(refreshTokens)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(refreshTokens.userId, user.id));

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', tokens.cookieHeader)
      .set('X-CSRF-Token', tokens.csrfToken);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('REFRESH_TOKEN_EXPIRED');
  });

  it('returns 401 for inactive session (>30 min, manipulate DB)', async () => {
    const user = await createTestUser({ email: 'refresh-idle@test.com' });
    const tokens = await loginAndGetTokens(user.email);

    // Set lastUsedAt to 31 min ago
    await db.update(refreshTokens)
      .set({ lastUsedAt: new Date(Date.now() - 31 * 60 * 1000) })
      .where(eq(refreshTokens.userId, user.id));

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', tokens.cookieHeader)
      .set('X-CSRF-Token', tokens.csrfToken);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('SESSION_INACTIVE');
  });

  it('returns 401 TOKEN_REUSE_DETECTED for revoked token (manipulate DB)', async () => {
    const user = await createTestUser({ email: 'refresh-reuse@test.com' });
    const tokens = await loginAndGetTokens(user.email);

    // Revoke the token in DB (simulating it was already rotated/used)
    await db.update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.userId, user.id));

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', tokens.cookieHeader)
      .set('X-CSRF-Token', tokens.csrfToken);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_REUSE_DETECTED');
  });

  it('returns 403 without CSRF header', async () => {
    const user = await createTestUser({ email: 'refresh-nocsrf@test.com' });
    const tokens = await loginAndGetTokens(user.email);

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', tokens.cookieHeader);
    // No X-CSRF-Token header

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_VALIDATION_FAILED');
  });
});

describe('POST /api/auth/logout', () => {
  it('returns 200 with valid auth + CSRF and clears cookies', async () => {
    const user = await createTestUser({ email: 'logout-ok@test.com' });
    const tokens = await loginAndGetTokens(user.email);

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${tokens.accessToken}`)
      .set('Cookie', tokens.cookieHeader)
      .set('X-CSRF-Token', tokens.csrfToken);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeNull();

    // All tokens should be revoked
    const remaining = await db.select().from(refreshTokens).where(eq(refreshTokens.userId, user.id));
    for (const t of remaining) {
      expect(t.revokedAt).not.toBeNull();
    }
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/auth/logout');

    expect(res.status).toBe(401);
  });

  it('returns 403 without CSRF token', async () => {
    const user = await createTestUser({ email: 'logout-nocsrf@test.com' });
    const tokens = await loginAndGetTokens(user.email);

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${tokens.accessToken}`)
      .set('Cookie', tokens.cookieHeader);
    // No X-CSRF-Token header

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_VALIDATION_FAILED');
  });
});

describe('Login single session enforcement (integration)', () => {
  it('login revokes previous session tokens', async () => {
    const user = await createTestUser({ email: 'single-session@test.com' });

    // First login
    await loginAndGetTokens(user.email);

    // Second login
    await loginAndGetTokens(user.email);

    // Should have 1 active token (from second login)
    const allTokens = await db.select().from(refreshTokens).where(eq(refreshTokens.userId, user.id));
    const active = allTokens.filter((t) => t.revokedAt === null);
    expect(active).toHaveLength(1);
  });
});
