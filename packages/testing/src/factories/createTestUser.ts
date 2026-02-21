/**
 * Test factory for creating user objects.
 * Returns a minimal user shape for testing purposes.
 * Aligned with Story 1.2 User type.
 */
export interface TestUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'super_admin' | 'dept_admin' | 'mda_officer';
  mdaId: string | null;
  isActive: boolean;
  createdAt: string;
}

export function createTestUser(overrides: Partial<TestUser> = {}): TestUser {
  const uid = crypto.randomUUID().slice(0, 8);
  return {
    id: `test-user-${uid}`,
    email: `user-${uid}@test.vlprs.gov.ng`,
    firstName: `Test`,
    lastName: `User-${uid}`,
    role: 'mda_officer',
    mdaId: null,
    isActive: true,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function createTestJwt(overrides: Partial<{ userId: string; email: string; role: string; mdaId: string | null }> = {}) {
  const uid = crypto.randomUUID().slice(0, 8);
  return {
    userId: `test-user-${uid}`,
    email: `user-${uid}@test.vlprs.gov.ng`,
    role: 'super_admin',
    mdaId: null,
    ...overrides,
  };
}
