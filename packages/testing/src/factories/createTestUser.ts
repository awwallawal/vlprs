/**
 * Test factory for creating user objects.
 * Returns a minimal user shape for testing purposes.
 * Will be expanded as the User model evolves in Story 1.2+.
 */
export interface TestUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export function createTestUser(overrides: Partial<TestUser> = {}): TestUser {
  const uid = crypto.randomUUID().slice(0, 8);
  return {
    id: `test-user-${uid}`,
    email: `user-${uid}@test.vlprs.gov.ng`,
    name: `Test User ${uid}`,
    role: 'viewer',
    ...overrides,
  };
}
