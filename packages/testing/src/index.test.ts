import { describe, it, expect } from 'vitest';
import { createTestUser } from './index';

describe('createTestUser', () => {
  it('returns a user with expected shape', () => {
    const user = createTestUser();
    expect(user.id).toBeDefined();
    expect(user.email).toContain('@test.vlprs.gov.ng');
    expect(user.firstName).toBeDefined();
    expect(user.lastName).toBeDefined();
    expect(user.role).toBe('mda_officer');
  });

  it('accepts overrides', () => {
    const user = createTestUser({ role: 'super_admin', firstName: 'Admin' });
    expect(user.role).toBe('super_admin');
    expect(user.firstName).toBe('Admin');
  });
});
