import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { db } from '../db/index';
import { users, mdas, refreshTokens } from '../db/schema';
import { hashPassword } from '../lib/password';
import { generateUuidv7 } from '../lib/uuidv7';
import * as authService from './authService';

let testMdaId: string;

beforeAll(async () => {
  // Clean up tables (truncate audit_log first — FK + immutability trigger)
  await db.execute(sql`TRUNCATE audit_log, refresh_tokens, users, mdas CASCADE`);

  // Create a test MDA
  testMdaId = generateUuidv7();
  await db.insert(mdas).values({ id: testMdaId, name: 'Test MDA', code: 'TST' });
});

beforeEach(async () => {
  await db.execute(sql`TRUNCATE audit_log, refresh_tokens, users CASCADE`);
});

afterAll(async () => {
  await db.execute(sql`TRUNCATE audit_log, refresh_tokens, users, mdas CASCADE`);
});

describe('authService.register', () => {
  it('creates user with hashed password', async () => {
    const user = await authService.register({
      email: 'newuser@test.com',
      password: 'SecurePass1',
      firstName: 'New',
      lastName: 'User',
      role: 'super_admin',
    });

    expect(user.email).toBe('newuser@test.com');
    expect(user.firstName).toBe('New');
    expect(user.role).toBe('super_admin');
    // Should not contain hashed_password
    expect(user).not.toHaveProperty('hashedPassword');
    expect(user).not.toHaveProperty('hashed_password');
  });

  it('rejects duplicate email with 409', async () => {
    await authService.register({
      email: 'duplicate@test.com',
      password: 'SecurePass1',
      firstName: 'First',
      lastName: 'User',
      role: 'super_admin',
    });

    await expect(
      authService.register({
        email: 'duplicate@test.com',
        password: 'SecurePass1',
        firstName: 'Second',
        lastName: 'User',
        role: 'super_admin',
      }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'EMAIL_ALREADY_EXISTS' });
  });

  it('enforces mda_officer requires mdaId', async () => {
    await expect(
      authService.register({
        email: 'officer@test.com',
        password: 'SecurePass1',
        firstName: 'Officer',
        lastName: 'User',
        role: 'mda_officer',
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('enforces super_admin rejects mdaId', async () => {
    await expect(
      authService.register({
        email: 'admin@test.com',
        password: 'SecurePass1',
        firstName: 'Admin',
        lastName: 'User',
        role: 'super_admin',
        mdaId: testMdaId,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('returns user without hashed_password', async () => {
    const user = await authService.register({
      email: 'clean@test.com',
      password: 'SecurePass1',
      firstName: 'Clean',
      lastName: 'User',
      role: 'dept_admin',
    });

    const keys = Object.keys(user);
    expect(keys).not.toContain('hashedPassword');
    expect(keys).toContain('id');
    expect(keys).toContain('email');
    expect(keys).toContain('firstName');
  });
});

describe('authService.login', () => {
  const testEmail = 'login@test.com';
  const testPassword = 'SecurePass1';

  beforeEach(async () => {
    const hashed = await hashPassword(testPassword);
    await db.insert(users).values({
      id: generateUuidv7(),
      email: testEmail,
      hashedPassword: hashed,
      firstName: 'Login',
      lastName: 'User',
      role: 'super_admin',
      mdaId: null,
    });
  });

  it('returns accessToken and user for valid credentials', async () => {
    const result = await authService.login({ email: testEmail, password: testPassword });

    expect(result.accessToken).toBeTruthy();
    expect(result.user.email).toBe(testEmail);
    expect(result.user.role).toBe('super_admin');
  });

  it('returns refresh token data for cookie setting', async () => {
    const result = await authService.login({ email: testEmail, password: testPassword });

    expect(result.refreshToken.raw).toBeTruthy();
    expect(result.refreshToken.raw).toHaveLength(128); // 64 bytes hex
    expect(result.refreshToken.expiresMs).toBeGreaterThan(0);
  });

  it('stores refresh token as SHA-256 hash', async () => {
    await authService.login({ email: testEmail, password: testPassword });

    const tokens = await db.select().from(refreshTokens);
    expect(tokens).toHaveLength(1);
    // SHA-256 hash is 64 hex chars
    expect(tokens[0].tokenHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('returns 401 for wrong email (same message as wrong password)', async () => {
    await expect(
      authService.login({ email: 'nonexistent@test.com', password: testPassword }),
    ).rejects.toMatchObject({ statusCode: 401, code: 'LOGIN_UNSUCCESSFUL' });
  });

  it('returns 401 for wrong password', async () => {
    await expect(
      authService.login({ email: testEmail, password: 'WrongPass1' }),
    ).rejects.toMatchObject({ statusCode: 401, code: 'LOGIN_UNSUCCESSFUL' });
  });

  it('returns 403 for inactive user', async () => {
    await db.update(users).set({ isActive: false }).where(sql`LOWER(${users.email}) = LOWER(${testEmail})`);

    await expect(
      authService.login({ email: testEmail, password: testPassword }),
    ).rejects.toMatchObject({ statusCode: 403, code: 'ACCOUNT_INACTIVE' });
  });

  it('increments failed_login_attempts on wrong password', async () => {
    try {
      await authService.login({ email: testEmail, password: 'WrongPass1' });
    } catch {
      // expected
    }

    const [user] = await db.select().from(users).where(sql`LOWER(${users.email}) = LOWER(${testEmail})`);
    expect(user.failedLoginAttempts).toBe(1);
  });

  it('locks account after 5 failed attempts', async () => {
    await db
      .update(users)
      .set({ failedLoginAttempts: 4 })
      .where(sql`LOWER(${users.email}) = LOWER(${testEmail})`);

    await expect(
      authService.login({ email: testEmail, password: 'WrongPass1' }),
    ).rejects.toMatchObject({ statusCode: 423, code: 'ACCOUNT_TEMPORARILY_LOCKED' });
  });

  it('rejects login during lockout period', async () => {
    await db
      .update(users)
      .set({
        failedLoginAttempts: 5,
        lockedUntil: new Date(Date.now() + 15 * 60 * 1000),
      })
      .where(sql`LOWER(${users.email}) = LOWER(${testEmail})`);

    await expect(
      authService.login({ email: testEmail, password: testPassword }),
    ).rejects.toMatchObject({ statusCode: 423, code: 'ACCOUNT_TEMPORARILY_LOCKED' });
  });

  it('resets failed attempts on successful login after lockout expires', async () => {
    await db
      .update(users)
      .set({
        failedLoginAttempts: 5,
        lockedUntil: new Date(Date.now() - 1000), // expired lockout
      })
      .where(sql`LOWER(${users.email}) = LOWER(${testEmail})`);

    const result = await authService.login({ email: testEmail, password: testPassword });
    expect(result.accessToken).toBeTruthy();

    const [user] = await db.select().from(users).where(sql`LOWER(${users.email}) = LOWER(${testEmail})`);
    expect(user.failedLoginAttempts).toBe(0);
  });

  it('revokes existing tokens on login (single concurrent session)', async () => {
    // First login
    const result1 = await authService.login({ email: testEmail, password: testPassword });
    expect(result1.refreshToken.raw).toBeTruthy();

    // Second login
    const result2 = await authService.login({ email: testEmail, password: testPassword });
    expect(result2.refreshToken.raw).toBeTruthy();

    // Only 1 active token should remain
    const allTokens = await db.select().from(refreshTokens);
    const active = allTokens.filter((t) => t.revokedAt === null);
    expect(active).toHaveLength(1);
  });
});
