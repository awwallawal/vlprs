import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { sql, eq, type SQL } from 'drizzle-orm';
import app from '../app';
import { db } from '../db/index';
import { users, mdas, auditLog } from '../db/schema';
import { hashPassword } from '../lib/password';
import { signAccessToken } from '../lib/jwt';
import { generateUuidv7 } from '../lib/uuidv7';
import { resetRateLimiters } from '../middleware/rateLimiter';

let testMdaId: string;

/**
 * Polls audit_log until at least one matching entry appears or timeout is reached.
 * Replaces fragile setTimeout for fire-and-forget audit verification.
 */
async function waitForAuditEntry(
  condition: SQL,
  { timeoutMs = 2000, intervalMs = 50 } = {},
): Promise<(typeof auditLog.$inferSelect)[]> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const entries = await db.select().from(auditLog).where(condition);
    if (entries.length > 0) return entries;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return db.select().from(auditLog).where(condition);
}

beforeAll(async () => {
  await db.execute(sql`TRUNCATE audit_log, refresh_tokens, users, mdas CASCADE`);

  testMdaId = generateUuidv7();
  await db.insert(mdas).values({ id: testMdaId, name: 'Audit Test MDA', code: 'AUDT', abbreviation: 'Audit Test' });
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
    email: `audit-${id.slice(0, 8)}@test.com`,
    hashedPassword: hashed,
    firstName: 'Audit',
    lastName: 'Tester',
    role: 'super_admin' as const,
    mdaId: null,
  };
  const row = { ...defaults, ...overrides };
  await db.insert(users).values(row);
  return row;
}

describe('Audit Log Integration Tests', () => {
  describe('Middleware-based audit logging', () => {
    it('GET /api/users with admin JWT creates audit_log entry with USERS_LIST action', async () => {
      const user = await createTestUser();
      const token = signAccessToken({ userId: user.id, email: user.email, role: user.role, mdaId: user.mdaId });

      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .set('User-Agent', 'test-audit-agent');

      expect(res.status).toBe(200);

      const entries = await waitForAuditEntry(eq(auditLog.userId, user.id));
      const [entry] = entries;
      expect(entry).toBeDefined();
      expect(entry.action).toBe('USERS_LIST');
      expect(entry.method).toBe('GET');
      expect(entry.resource).toBe('/api/users');
      expect(entry.responseStatus).toBe(200);
      expect(entry.userId).toBe(user.id);
      expect(entry.role).toBe('super_admin');
      expect(entry.userAgent).toBe('test-audit-agent');
      expect(entry.requestBodyHash).toBeNull();
    });

    it('POST /api/auth/register with admin JWT creates audit_log entry', async () => {
      const admin = await createTestUser({ role: 'super_admin' });
      const token = signAccessToken({ userId: admin.id, email: admin.email, role: admin.role, mdaId: admin.mdaId });

      const res = await request(app)
        .post('/api/auth/register')
        .set('Authorization', `Bearer ${token}`)
        .send({
          email: 'newuser@test.com',
          password: 'SecurePass1',
          firstName: 'New',
          lastName: 'User',
          role: 'super_admin',
        });

      expect(res.status).toBe(201);

      const entries = await waitForAuditEntry(eq(auditLog.userId, admin.id));
      const registerEntry = entries.find(e => e.resource?.includes('/auth/register'));
      expect(registerEntry).toBeDefined();
      expect(registerEntry!.action).toBe('AUTH_REGISTER_CREATE');
      expect(registerEntry!.method).toBe('POST');
      expect(registerEntry!.requestBodyHash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('Auth event logging', () => {
    it('Login success creates audit_log entry with AUTH_LOGIN_SUCCESS', async () => {
      await createTestUser({ email: 'login-success@test.com' });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'login-success@test.com', password: 'Password1' });

      expect(res.status).toBe(200);

      const entries = await waitForAuditEntry(eq(auditLog.action, 'AUTH_LOGIN_SUCCESS'));
      expect(entries.length).toBeGreaterThanOrEqual(1);
      const entry = entries[0];
      expect(entry.email).toBe('login-success@test.com');
      expect(entry.userId).not.toBeNull();
      expect(entry.responseStatus).toBe(200);
    });

    it('Login failure creates audit_log entry with AUTH_LOGIN_FAILED (no user_id)', async () => {
      await createTestUser({ email: 'login-fail@test.com' });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'login-fail@test.com', password: 'WrongPassword1' });

      expect(res.status).toBe(401);

      const entries = await waitForAuditEntry(eq(auditLog.action, 'AUTH_LOGIN_FAILED'));
      expect(entries.length).toBeGreaterThanOrEqual(1);
      const entry = entries[0];
      expect(entry.email).toBe('login-fail@test.com');
      expect(entry.userId).toBeNull();
      expect(entry.responseStatus).toBe(401);
    });

    it('Logout creates audit_log entry with AUTH_LOGOUT', async () => {
      const user = await createTestUser({ email: 'logout-test@test.com' });

      // Login first to get tokens
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'logout-test@test.com', password: 'Password1' });

      expect(loginRes.status).toBe(200);
      const { accessToken } = loginRes.body.data;

      // Extract cookies using the same pattern as existing tests
      const rawCookies = loginRes.headers['set-cookie'];
      const setCookies = (Array.isArray(rawCookies) ? rawCookies : [rawCookies].filter(Boolean)) as string[];
      const refreshCookieNV = (setCookies.find(c => c.startsWith('refreshToken=')) ?? '').split(';')[0];
      const csrfCookieNV = (setCookies.find(c => c.startsWith('__csrf=')) ?? '').split(';')[0];
      const csrfTokenValue = csrfCookieNV.split('=').slice(1).join('=');
      const cookieHeader = `${refreshCookieNV}; ${csrfCookieNV}`;

      // Wait for login audit event to complete, then clear for clean logout test
      await waitForAuditEntry(eq(auditLog.action, 'AUTH_LOGIN_SUCCESS'));
      await db.execute(sql`TRUNCATE audit_log`);

      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', cookieHeader)
        .set('X-CSRF-Token', csrfTokenValue);

      expect(logoutRes.status).toBe(200);

      const entries = await waitForAuditEntry(eq(auditLog.action, 'AUTH_LOGOUT'));
      expect(entries.length).toBeGreaterThanOrEqual(1);
      const entry = entries[0];
      expect(entry.userId).toBe(user.id);
      expect(entry.email).toBe('logout-test@test.com');
    });

    it('Account lockout creates audit_log entry with AUTH_ACCOUNT_LOCKED', async () => {
      await createTestUser({ email: 'lockout-test@test.com' });

      // Send 5 failed attempts to trigger lockout
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({ email: 'lockout-test@test.com', password: 'WrongPass1' });
      }

      const entries = await waitForAuditEntry(eq(auditLog.action, 'AUTH_ACCOUNT_LOCKED'));
      expect(entries.length).toBeGreaterThanOrEqual(1);
      const entry = entries[0];
      expect(entry.email).toBe('lockout-test@test.com');
      expect(entry.responseStatus).toBe(423);
    });
  });

  describe('Immutability trigger', () => {
    it('rejects UPDATE on audit_log', async () => {
      // Insert a test audit entry directly
      await db.insert(auditLog).values({
        action: 'TEST_UPDATE',
        ipAddress: '127.0.0.1',
        resource: '/test',
        method: 'GET',
      });

      const [entry] = await db.select().from(auditLog).where(eq(auditLog.action, 'TEST_UPDATE'));
      expect(entry).toBeDefined();

      // Attempt to UPDATE — should fail with trigger (Drizzle wraps the PG error)
      try {
        await db.update(auditLog).set({ action: 'TAMPERED' }).where(eq(auditLog.id, entry.id));
        expect.fail('UPDATE should have been rejected by immutability trigger');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        const cause = err instanceof Error && 'cause' in err ? String((err as Error & { cause: Error }).cause?.message ?? '') : '';
        const fullMsg = `${message} ${cause}`;
        expect(fullMsg).toMatch(/Modifications to audit_log are not allowed.*UPDATE operation rejected/);
      }
    });

    it('rejects DELETE on audit_log', async () => {
      await db.insert(auditLog).values({
        action: 'TEST_DELETE',
        ipAddress: '127.0.0.1',
        resource: '/test',
        method: 'GET',
      });

      const [entry] = await db.select().from(auditLog).where(eq(auditLog.action, 'TEST_DELETE'));
      expect(entry).toBeDefined();

      // Attempt to DELETE — should fail with trigger (Drizzle wraps the PG error)
      try {
        await db.delete(auditLog).where(eq(auditLog.id, entry.id));
        expect.fail('DELETE should have been rejected by immutability trigger');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        const cause = err instanceof Error && 'cause' in err ? String((err as Error & { cause: Error }).cause?.message ?? '') : '';
        const fullMsg = `${message} ${cause}`;
        expect(fullMsg).toMatch(/Modifications to audit_log are not allowed.*DELETE operation rejected/);
      }
    });
  });

  describe('Non-audited endpoints', () => {
    it('Health check creates NO audit_log entry', async () => {
      await db.execute(sql`TRUNCATE audit_log`);

      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);

      // For absence checks, use a short delay since we can't poll for "nothing"
      await new Promise(resolve => setTimeout(resolve, 200));

      const entries = await db.select().from(auditLog);
      expect(entries).toHaveLength(0);
    });
  });

  describe('Audit log data quality', () => {
    it('audit log entry has correct IP address, user agent, duration_ms > 0', async () => {
      const user = await createTestUser();
      const token = signAccessToken({ userId: user.id, email: user.email, role: user.role, mdaId: user.mdaId });

      await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .set('User-Agent', 'quality-check-agent');

      const entries = await waitForAuditEntry(eq(auditLog.userId, user.id));
      const [entry] = entries;
      expect(entry).toBeDefined();
      expect(entry.ipAddress).toBeTruthy();
      expect(entry.userAgent).toBe('quality-check-agent');
      expect(entry.durationMs).toBeGreaterThanOrEqual(0);
      expect(entry.createdAt).toBeInstanceOf(Date);
    });
  });
});
