import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index';
import { users, mdas, refreshTokens } from '../db/schema';
import { hashPassword } from '../lib/password';
import { hashToken } from '../lib/tokenHash';
import { generateUuidv7 } from '../lib/uuidv7';
import { randomBytes } from 'node:crypto';
import * as authService from './authService';

let testUserId: string;
const testEmail = 'refresh-test@test.com';
const testPassword = 'SecurePass1';

beforeAll(async () => {
  await db.execute(sql`TRUNCATE audit_log`);
  await db.delete(refreshTokens);
  await db.delete(users);
  await db.delete(mdas);
});

beforeEach(async () => {
  await db.execute(sql`TRUNCATE audit_log`);
  await db.delete(refreshTokens);
  await db.delete(users);

  const hashed = await hashPassword(testPassword);
  testUserId = generateUuidv7();
  await db.insert(users).values({
    id: testUserId,
    email: testEmail,
    hashedPassword: hashed,
    firstName: 'Refresh',
    lastName: 'Tester',
    role: 'super_admin',
    mdaId: null,
  });
});

afterAll(async () => {
  await db.execute(sql`TRUNCATE audit_log`);
  await db.delete(refreshTokens);
  await db.delete(users);
  await db.delete(mdas);
});

async function seedRefreshToken(
  userId: string,
  overrides: {
    revokedAt?: Date | null;
    expiresAt?: Date;
    lastUsedAt?: Date;
  } = {},
) {
  const rawToken = randomBytes(64).toString('hex');
  const tokenHash = hashToken(rawToken);
  const now = new Date();

  await db.insert(refreshTokens).values({
    id: generateUuidv7(),
    userId,
    tokenHash,
    expiresAt: overrides.expiresAt ?? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
    lastUsedAt: overrides.lastUsedAt ?? now,
    revokedAt: overrides.revokedAt ?? null,
  });

  return rawToken;
}

describe('authService.refreshToken', () => {
  it('returns new accessToken for valid refresh token', async () => {
    const rawToken = await seedRefreshToken(testUserId);
    const result = await authService.refreshToken(rawToken);

    expect(result.accessToken).toBeTruthy();
    expect(typeof result.accessToken).toBe('string');
  });

  it('rotates: old token revoked, new token stored', async () => {
    const rawToken = await seedRefreshToken(testUserId);
    const result = await authService.refreshToken(rawToken);

    // Old token should be revoked
    const oldHash = hashToken(rawToken);
    const [oldRow] = await db.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, oldHash));
    expect(oldRow.revokedAt).not.toBeNull();

    // New token should exist
    const newHash = hashToken(result.refreshToken.raw);
    const [newRow] = await db.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, newHash));
    expect(newRow).toBeDefined();
    expect(newRow.revokedAt).toBeNull();
  });

  it('updates lastUsedAt on new token', async () => {
    const rawToken = await seedRefreshToken(testUserId, {
      lastUsedAt: new Date(Date.now() - 5 * 60 * 1000), // 5 min ago
    });
    const before = Date.now();
    const result = await authService.refreshToken(rawToken);

    const newHash = hashToken(result.refreshToken.raw);
    const [newRow] = await db.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, newHash));
    expect(newRow.lastUsedAt.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('returns 401 for missing/empty token', async () => {
    await expect(authService.refreshToken('')).rejects.toMatchObject({
      statusCode: 401,
      code: 'REFRESH_TOKEN_INVALID',
    });
  });

  it('returns 401 for token not found in DB', async () => {
    const bogusToken = randomBytes(64).toString('hex');
    await expect(authService.refreshToken(bogusToken)).rejects.toMatchObject({
      statusCode: 401,
      code: 'REFRESH_TOKEN_INVALID',
    });
  });

  it('returns 401 for expired token (7-day expiry)', async () => {
    const rawToken = await seedRefreshToken(testUserId, {
      expiresAt: new Date(Date.now() - 1000), // already expired
    });

    await expect(authService.refreshToken(rawToken)).rejects.toMatchObject({
      statusCode: 401,
      code: 'REFRESH_TOKEN_EXPIRED',
    });
  });

  it('returns 401 for inactive session (>30 min since last_used_at)', async () => {
    const rawToken = await seedRefreshToken(testUserId, {
      lastUsedAt: new Date(Date.now() - 31 * 60 * 1000), // 31 min ago
    });

    await expect(authService.refreshToken(rawToken)).rejects.toMatchObject({
      statusCode: 401,
      code: 'SESSION_INACTIVE',
    });
  });

  it('REUSE DETECTION: revokes ALL user tokens when revoked token is presented', async () => {
    // Create a valid active token
    await seedRefreshToken(testUserId);

    // Create a revoked token (simulating a stolen one)
    const revokedRawToken = await seedRefreshToken(testUserId, {
      revokedAt: new Date(), // already revoked
    });

    await expect(authService.refreshToken(revokedRawToken)).rejects.toMatchObject({
      statusCode: 401,
      code: 'TOKEN_REUSE_DETECTED',
    });

    // ALL tokens for this user should be revoked
    const tokens = await db.select().from(refreshTokens).where(eq(refreshTokens.userId, testUserId));
    for (const t of tokens) {
      expect(t.revokedAt).not.toBeNull();
    }
  });

  it('rejects inactive user on refresh', async () => {
    const rawToken = await seedRefreshToken(testUserId);

    // Deactivate user
    await db.update(users).set({ isActive: false }).where(eq(users.id, testUserId));

    await expect(authService.refreshToken(rawToken)).rejects.toMatchObject({
      statusCode: 401,
      code: 'ACCOUNT_INACTIVE',
    });
  });
});

describe('authService.logout', () => {
  it('revokes all user refresh tokens', async () => {
    await seedRefreshToken(testUserId);
    await seedRefreshToken(testUserId);

    await authService.logout(testUserId);

    const tokens = await db.select().from(refreshTokens).where(eq(refreshTokens.userId, testUserId));
    for (const t of tokens) {
      expect(t.revokedAt).not.toBeNull();
    }
  });
});

describe('authService.revokeAllUserTokens', () => {
  it('revokes only non-revoked tokens for specified user', async () => {
    // Create second user
    const otherUserId = generateUuidv7();
    const hashed = await hashPassword('SecurePass1');
    await db.insert(users).values({
      id: otherUserId,
      email: 'other@test.com',
      hashedPassword: hashed,
      firstName: 'Other',
      lastName: 'User',
      role: 'super_admin',
      mdaId: null,
    });

    await seedRefreshToken(testUserId);
    await seedRefreshToken(otherUserId);

    await authService.revokeAllUserTokens(testUserId);

    // Test user's tokens revoked
    const testTokens = await db.select().from(refreshTokens).where(eq(refreshTokens.userId, testUserId));
    for (const t of testTokens) {
      expect(t.revokedAt).not.toBeNull();
    }

    // Other user's tokens untouched
    const otherTokens = await db.select().from(refreshTokens).where(eq(refreshTokens.userId, otherUserId));
    for (const t of otherTokens) {
      expect(t.revokedAt).toBeNull();
    }
  });

  it('returns count of revoked tokens', async () => {
    await seedRefreshToken(testUserId);
    await seedRefreshToken(testUserId);

    const count = await authService.revokeAllUserTokens(testUserId);
    expect(count).toBe(2);
  });
});

describe('authService.changePassword', () => {
  it('updates hashed_password and revokes all tokens', async () => {
    await seedRefreshToken(testUserId);

    const newHash = await hashPassword('NewPassword1');
    await authService.changePassword(testUserId, newHash);

    // Password updated
    const [user] = await db.select().from(users).where(eq(users.id, testUserId));
    expect(user.hashedPassword).toBe(newHash);

    // Tokens revoked
    const tokens = await db.select().from(refreshTokens).where(eq(refreshTokens.userId, testUserId));
    for (const t of tokens) {
      expect(t.revokedAt).not.toBeNull();
    }
  });
});

describe('authService.login (single session enforcement)', () => {
  it('revokes existing tokens before creating new one', async () => {
    // First login
    const result1 = await authService.login({ email: testEmail, password: testPassword });
    expect(result1.refreshToken.raw).toBeTruthy();

    // Second login — should revoke first token
    const result2 = await authService.login({ email: testEmail, password: testPassword });
    expect(result2.refreshToken.raw).toBeTruthy();

    // Should have 2 total tokens: 1 revoked (from first login) + 1 active (from second login)
    const allTokens = await db.select().from(refreshTokens).where(eq(refreshTokens.userId, testUserId));
    const active = allTokens.filter((t) => t.revokedAt === null);
    const revoked = allTokens.filter((t) => t.revokedAt !== null);

    expect(active).toHaveLength(1);
    expect(revoked).toHaveLength(1);
  });
});
