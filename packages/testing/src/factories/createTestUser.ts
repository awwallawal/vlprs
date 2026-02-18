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

let counter = 0;

export function createTestUser(overrides: Partial<TestUser> = {}): TestUser {
  counter++;
  return {
    id: `test-user-${counter}`,
    email: `user${counter}@test.vlprs.gov.ng`,
    name: `Test User ${counter}`,
    role: 'viewer',
    ...overrides,
  };
}
