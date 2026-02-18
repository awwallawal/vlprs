import { describe, it, expect } from 'vitest';
import { createTestUser } from './index';

describe('createTestUser', () => {
  it('returns a user with expected shape', () => {
    const user = createTestUser();
    expect(user.id).toBeDefined();
    expect(user.email).toContain('@test.vlprs.gov.ng');
    expect(user.name).toBeDefined();
    expect(user.role).toBe('viewer');
  });

  it('accepts overrides', () => {
    const user = createTestUser({ role: 'admin', name: 'Admin User' });
    expect(user.role).toBe('admin');
    expect(user.name).toBe('Admin User');
  });
});
