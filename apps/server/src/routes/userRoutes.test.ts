import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import { sql, eq } from 'drizzle-orm';
import app from '../app';
import { db } from '../db/index';
import { users, mdas, refreshTokens } from '../db/schema';
import { hashPassword } from '../lib/password';
import { signAccessToken } from '../lib/jwt';
import { generateUuidv7 } from '../lib/uuidv7';

vi.mock('../lib/email', () => ({
  sendWelcomeEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}));

let testMdaId: string;

beforeAll(async () => {
  await db.execute(sql`TRUNCATE audit_log, refresh_tokens, users, mdas CASCADE`);

  testMdaId = generateUuidv7();
  await db.insert(mdas).values({ id: testMdaId, name: 'Test MDA', code: 'RBAC' });
});

beforeEach(async () => {
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

// ─── POST /api/users ─────────────────────────────────────────────────

describe('POST /api/users', () => {
  it('super_admin creates dept_admin → 201', async () => {
    const admin = await createTestUser({ email: 'admin@test.com', role: 'super_admin' });
    const token = tokenFor(admin.id, admin.email, 'super_admin');

    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'newdept@test.com',
        firstName: 'New',
        lastName: 'DeptAdmin',
        role: 'dept_admin',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe('newdept@test.com');
    expect(res.body.data.role).toBe('dept_admin');
    expect(res.body.data.mustChangePassword).toBe(true);
  });

  it('super_admin creates mda_officer with mdaId → 201', async () => {
    const admin = await createTestUser({ email: 'admin@test.com', role: 'super_admin' });
    const token = tokenFor(admin.id, admin.email, 'super_admin');

    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'newofficer@test.com',
        firstName: 'New',
        lastName: 'Officer',
        role: 'mda_officer',
        mdaId: testMdaId,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe('newofficer@test.com');
    expect(res.body.data.role).toBe('mda_officer');
    expect(res.body.data.mdaId).toBe(testMdaId);
  });

  it('dept_admin creates mda_officer → 201', async () => {
    const deptAdmin = await createTestUser({ email: 'dept@test.com', role: 'dept_admin' });
    const token = tokenFor(deptAdmin.id, deptAdmin.email, 'dept_admin');

    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'officer2@test.com',
        firstName: 'Another',
        lastName: 'Officer',
        role: 'mda_officer',
        mdaId: testMdaId,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.role).toBe('mda_officer');
  });

  it('dept_admin creating dept_admin → 403 (hierarchy)', async () => {
    const deptAdmin = await createTestUser({ email: 'dept@test.com', role: 'dept_admin' });
    const token = tokenFor(deptAdmin.id, deptAdmin.email, 'dept_admin');

    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'another-dept@test.com',
        firstName: 'Dept',
        lastName: 'Two',
        role: 'dept_admin',
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('HIERARCHY_INSUFFICIENT');
  });

  it('mda_officer creating anyone → 403', async () => {
    const officer = await createTestUser({
      email: 'officer@test.com',
      role: 'mda_officer',
      mdaId: testMdaId,
    });
    const token = tokenFor(officer.id, officer.email, 'mda_officer', testMdaId);

    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'forbidden@test.com',
        firstName: 'No',
        lastName: 'Way',
        role: 'mda_officer',
        mdaId: testMdaId,
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
  });

  it('creating super_admin via API → 403', async () => {
    const admin = await createTestUser({ email: 'admin@test.com', role: 'super_admin' });
    const token = tokenFor(admin.id, admin.email, 'super_admin');

    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'newsuper@test.com',
        firstName: 'Super',
        lastName: 'Two',
        role: 'super_admin',
      });

    // The Zod schema only allows dept_admin | mda_officer, so this will be 400 validation error
    // OR if it somehow passes validation, the service rejects with 403
    expect([400, 403]).toContain(res.status);
    expect(res.body.success).toBe(false);
  });

  it('duplicate email → 409', async () => {
    const admin = await createTestUser({ email: 'admin@test.com', role: 'super_admin' });
    await createTestUser({ email: 'existing@test.com', role: 'dept_admin' });
    const token = tokenFor(admin.id, admin.email, 'super_admin');

    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'existing@test.com',
        firstName: 'Dup',
        lastName: 'User',
        role: 'dept_admin',
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('mda_officer without mdaId → 422', async () => {
    const admin = await createTestUser({ email: 'admin@test.com', role: 'super_admin' });
    const token = tokenFor(admin.id, admin.email, 'super_admin');

    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'nommda@test.com',
        firstName: 'No',
        lastName: 'Mda',
        role: 'mda_officer',
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('MDA_REQUIRED_FOR_OFFICER');
  });

  it('non-existent mdaId → 422', async () => {
    const admin = await createTestUser({ email: 'admin@test.com', role: 'super_admin' });
    const token = tokenFor(admin.id, admin.email, 'super_admin');
    const fakeMdaId = generateUuidv7();

    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'badmda@test.com',
        firstName: 'Bad',
        lastName: 'Mda',
        role: 'mda_officer',
        mdaId: fakeMdaId,
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('MDA_NOT_FOUND');
  });
});

// ─── POST /api/users/:id/deactivate ──────────────────────────────────

describe('POST /api/users/:id/deactivate', () => {
  it('super_admin deactivates dept_admin → 200', async () => {
    const admin = await createTestUser({ email: 'admin@test.com', role: 'super_admin' });
    const target = await createTestUser({ email: 'dept@test.com', role: 'dept_admin' });
    const token = tokenFor(admin.id, admin.email, 'super_admin');

    const res = await request(app)
      .post(`/api/users/${target.id}/deactivate`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Testing deactivation' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.isActive).toBe(false);
  });

  it('super_admin deactivates mda_officer → 200', async () => {
    const admin = await createTestUser({ email: 'admin@test.com', role: 'super_admin' });
    const target = await createTestUser({
      email: 'officer@test.com',
      role: 'mda_officer',
      mdaId: testMdaId,
    });
    const token = tokenFor(admin.id, admin.email, 'super_admin');

    const res = await request(app)
      .post(`/api/users/${target.id}/deactivate`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.isActive).toBe(false);
  });

  it('deactivate revokes tokens (user cannot use token after deactivation)', async () => {
    const admin = await createTestUser({ email: 'admin@test.com', role: 'super_admin' });
    const target = await createTestUser({ email: 'dept@test.com', role: 'dept_admin' });

    // Insert a refresh token for the target user
    const tokenHash = 'fake-token-hash-for-test';
    await db.insert(refreshTokens).values({
      id: generateUuidv7(),
      userId: target.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 86400000),
    });

    const adminToken = tokenFor(admin.id, admin.email, 'super_admin');

    // Deactivate the target
    const res = await request(app)
      .post(`/api/users/${target.id}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(res.status).toBe(200);

    // Verify the refresh token was revoked in the database
    const [revokedToken] = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.userId, target.id));

    expect(revokedToken.revokedAt).not.toBeNull();
  });

  it('dept_admin deactivating dept_admin → 403', async () => {
    const deptAdmin = await createTestUser({ email: 'dept1@test.com', role: 'dept_admin' });
    const otherDept = await createTestUser({ email: 'dept2@test.com', role: 'dept_admin' });
    const token = tokenFor(deptAdmin.id, deptAdmin.email, 'dept_admin');

    const res = await request(app)
      .post(`/api/users/${otherDept.id}/deactivate`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('HIERARCHY_INSUFFICIENT');
  });

  it('self-deactivation → 403', async () => {
    const admin = await createTestUser({ email: 'admin@test.com', role: 'super_admin' });
    const token = tokenFor(admin.id, admin.email, 'super_admin');

    const res = await request(app)
      .post(`/api/users/${admin.id}/deactivate`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('SELF_MANAGEMENT_DENIED');
  });
});

// ─── POST /api/users/:id/reactivate ──────────────────────────────────

describe('POST /api/users/:id/reactivate', () => {
  it('super_admin reactivates deactivated dept_admin → 200', async () => {
    const admin = await createTestUser({ email: 'admin@test.com', role: 'super_admin' });
    const target = await createTestUser({
      email: 'dept@test.com',
      role: 'dept_admin',
      isActive: false,
    });
    const token = tokenFor(admin.id, admin.email, 'super_admin');

    const res = await request(app)
      .post(`/api/users/${target.id}/reactivate`)
      .set('Authorization', `Bearer ${token}`)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.isActive).toBe(true);
  });

  it('reactivation of soft-deleted account → 422', async () => {
    const admin = await createTestUser({ email: 'admin@test.com', role: 'super_admin' });
    const target = await createTestUser({
      email: 'deleted@test.com',
      role: 'dept_admin',
      isActive: false,
      deletedAt: new Date(),
    });
    const token = tokenFor(admin.id, admin.email, 'super_admin');

    const res = await request(app)
      .post(`/api/users/${target.id}/reactivate`)
      .set('Authorization', `Bearer ${token}`)
      .send();

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('DELETED_CANNOT_REACTIVATE');
  });
});

// ─── DELETE /api/users/:id (soft delete) ──────────────────────────────

describe('DELETE /api/users/:id', () => {
  it('soft delete with correct email confirmation → 200', async () => {
    const admin = await createTestUser({ email: 'admin@test.com', role: 'super_admin' });
    const target = await createTestUser({ email: 'victim@test.com', role: 'dept_admin' });
    const token = tokenFor(admin.id, admin.email, 'super_admin');

    const res = await request(app)
      .delete(`/api/users/${target.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ confirmEmail: 'victim@test.com' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeNull();

    // Verify user is soft-deleted in DB
    const [deleted] = await db
      .select()
      .from(users)
      .where(eq(users.id, target.id));

    expect(deleted.deletedAt).not.toBeNull();
    expect(deleted.isActive).toBe(false);
  });

  it('soft delete with wrong email → 422', async () => {
    const admin = await createTestUser({ email: 'admin@test.com', role: 'super_admin' });
    const target = await createTestUser({ email: 'victim@test.com', role: 'dept_admin' });
    const token = tokenFor(admin.id, admin.email, 'super_admin');

    const res = await request(app)
      .delete(`/api/users/${target.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ confirmEmail: 'wrong@test.com' });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('DELETE_CONFIRM_MISMATCH');
  });

  it('deleted user excluded from listings', async () => {
    const admin = await createTestUser({ email: 'admin@test.com', role: 'super_admin' });
    const target = await createTestUser({ email: 'victim@test.com', role: 'dept_admin' });
    const token = tokenFor(admin.id, admin.email, 'super_admin');

    // First soft-delete the user
    await request(app)
      .delete(`/api/users/${target.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ confirmEmail: 'victim@test.com' });

    // Now list users and verify deleted user is excluded
    const listRes = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    const emails = listRes.body.data.map((u: { email: string }) => u.email);
    expect(emails).not.toContain('victim@test.com');
    expect(emails).toContain('admin@test.com');
  });
});

// ─── PATCH /api/users/:id (MDA reassignment) ─────────────────────────

describe('PATCH /api/users/:id', () => {
  it('reassign mda_officer to different MDA → 200', async () => {
    const admin = await createTestUser({ email: 'admin@test.com', role: 'super_admin' });
    const officer = await createTestUser({
      email: 'officer@test.com',
      role: 'mda_officer',
      mdaId: testMdaId,
    });
    const token = tokenFor(admin.id, admin.email, 'super_admin');

    // Create a second MDA for reassignment
    const secondMdaId = generateUuidv7();
    await db.insert(mdas).values({ id: secondMdaId, name: 'Second MDA', code: 'MDA2' });

    const res = await request(app)
      .patch(`/api/users/${officer.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ mdaId: secondMdaId });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.mdaId).toBe(secondMdaId);
  });

  it('reassign non-mda_officer → 422', async () => {
    const admin = await createTestUser({ email: 'admin@test.com', role: 'super_admin' });
    const deptAdmin = await createTestUser({ email: 'dept@test.com', role: 'dept_admin' });
    const token = tokenFor(admin.id, admin.email, 'super_admin');

    const res = await request(app)
      .patch(`/api/users/${deptAdmin.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ mdaId: testMdaId });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('MDA_ONLY_FOR_OFFICER');
  });

  it('reassign to non-existent MDA → 422', async () => {
    const admin = await createTestUser({ email: 'admin@test.com', role: 'super_admin' });
    const officer = await createTestUser({
      email: 'officer@test.com',
      role: 'mda_officer',
      mdaId: testMdaId,
    });
    const token = tokenFor(admin.id, admin.email, 'super_admin');
    const fakeMdaId = generateUuidv7();

    const res = await request(app)
      .patch(`/api/users/${officer.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ mdaId: fakeMdaId });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('MDA_NOT_FOUND');
  });
});

// ─── POST /api/users/:id/reset-password ──────────────────────────────

describe('POST /api/users/:id/reset-password', () => {
  it('super_admin resets dept_admin password → 200', async () => {
    const admin = await createTestUser({ email: 'admin@test.com', role: 'super_admin' });
    const target = await createTestUser({ email: 'dept@test.com', role: 'dept_admin' });
    const token = tokenFor(admin.id, admin.email, 'super_admin');

    const res = await request(app)
      .post(`/api/users/${target.id}/reset-password`)
      .set('Authorization', `Bearer ${token}`)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('reset sets mustChangePassword flag', async () => {
    const admin = await createTestUser({ email: 'admin@test.com', role: 'super_admin' });
    const target = await createTestUser({
      email: 'dept@test.com',
      role: 'dept_admin',
      mustChangePassword: false,
    });
    const token = tokenFor(admin.id, admin.email, 'super_admin');

    await request(app)
      .post(`/api/users/${target.id}/reset-password`)
      .set('Authorization', `Bearer ${token}`)
      .send();

    // Verify in DB that mustChangePassword is now true
    const [updated] = await db
      .select()
      .from(users)
      .where(eq(users.id, target.id));

    expect(updated.mustChangePassword).toBe(true);
  });
});
