/**
 * Playwright global setup — seeds test accounts via API.
 *
 * Requires the server to be running with a seeded super_admin account.
 * Uses the super admin to register dept_admin and mda_officer test users.
 *
 * Environment variables (from apps/server/.env):
 *   SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD
 */

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3001/api';

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'admin@oyo.gov.ng';
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'Admin@12345';

export const TEST_USERS = {
  super_admin: {
    email: SUPER_ADMIN_EMAIL,
    password: SUPER_ADMIN_PASSWORD,
  },
  dept_admin: {
    email: 'e2e-dept-admin@oyo.gov.ng',
    password: 'E2eTest@12345',
    fullName: 'E2E Dept Admin',
  },
  mda_officer: {
    email: 'e2e-mda-officer@oyo.gov.ng',
    password: 'E2eTest@12345',
    fullName: 'E2E MDA Officer',
    mdaId: 'MDA-001',
  },
};

async function loginAsSuperAdmin(): Promise<string> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: TEST_USERS.super_admin.email,
      password: TEST_USERS.super_admin.password,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Failed to login as super_admin (${res.status}): ${body}`
    );
  }

  const { data } = await res.json();
  return data.accessToken;
}

async function registerTestUser(
  token: string,
  user: {
    email: string;
    password: string;
    fullName: string;
    role: string;
    mdaId?: string;
  }
): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(user),
  });

  // 409 = already exists, which is fine for idempotent setup
  if (!res.ok && res.status !== 409) {
    const body = await res.text();
    throw new Error(
      `Failed to register ${user.email} (${res.status}): ${body}`
    );
  }
}

export default async function globalSetup(): Promise<void> {
  try {
    const token = await loginAsSuperAdmin();

    await registerTestUser(token, {
      email: TEST_USERS.dept_admin.email,
      password: TEST_USERS.dept_admin.password,
      fullName: TEST_USERS.dept_admin.fullName,
      role: 'dept_admin',
    });

    await registerTestUser(token, {
      email: TEST_USERS.mda_officer.email,
      password: TEST_USERS.mda_officer.password,
      fullName: TEST_USERS.mda_officer.fullName,
      role: 'mda_officer',
      mdaId: TEST_USERS.mda_officer.mdaId,
    });

    console.log('E2E global setup: test accounts seeded successfully');
  } catch (error) {
    console.warn(
      'E2E global setup: could not seed test accounts (server may not be ready):',
      (error as Error).message
    );
    // Don't fail the suite — tests will fail individually if accounts are missing
  }
}
