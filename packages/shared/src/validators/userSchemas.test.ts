import { describe, it, expect } from 'vitest';
import { createUserSchema, updateUserSchema, deactivateUserSchema, deleteUserSchema } from './userSchemas';

describe('createUserSchema', () => {
  const validInput = {
    email: 'officer@example.com',
    firstName: 'Jane',
    lastName: 'Doe',
    role: 'mda_officer' as const,
    mdaId: '01912345-6789-7abc-8def-0123456789ab',
  };

  it('validates correct input', () => {
    const result = createUserSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('accepts dept_admin role', () => {
    const result = createUserSchema.safeParse({ ...validInput, role: 'dept_admin', mdaId: null });
    expect(result.success).toBe(true);
  });

  it('rejects super_admin role', () => {
    const result = createUserSchema.safeParse({ ...validInput, role: 'super_admin' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid email', () => {
    const result = createUserSchema.safeParse({ ...validInput, email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('rejects empty firstName', () => {
    const result = createUserSchema.safeParse({ ...validInput, firstName: '' });
    expect(result.success).toBe(false);
  });

  it('rejects empty lastName', () => {
    const result = createUserSchema.safeParse({ ...validInput, lastName: '' });
    expect(result.success).toBe(false);
  });

  it('allows null mdaId', () => {
    const result = createUserSchema.safeParse({ ...validInput, mdaId: null });
    expect(result.success).toBe(true);
  });

  it('allows omitted mdaId', () => {
    const { mdaId: _mdaId, ...rest } = validInput;
    const result = createUserSchema.safeParse(rest);
    expect(result.success).toBe(true);
  });

  it('rejects invalid uuid for mdaId', () => {
    const result = createUserSchema.safeParse({ ...validInput, mdaId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });
});

describe('updateUserSchema', () => {
  it('validates correct uuid for mdaId', () => {
    const result = updateUserSchema.safeParse({ mdaId: '01912345-6789-7abc-8def-0123456789ab' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid uuid', () => {
    const result = updateUserSchema.safeParse({ mdaId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('rejects missing mdaId', () => {
    const result = updateUserSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('deactivateUserSchema', () => {
  it('validates with reason', () => {
    const result = deactivateUserSchema.safeParse({ reason: 'User requested deactivation' });
    expect(result.success).toBe(true);
  });

  it('validates without reason', () => {
    const result = deactivateUserSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('rejects reason longer than 500 characters', () => {
    const result = deactivateUserSchema.safeParse({ reason: 'x'.repeat(501) });
    expect(result.success).toBe(false);
  });
});

describe('deleteUserSchema', () => {
  it('validates correct email', () => {
    const result = deleteUserSchema.safeParse({ confirmEmail: 'user@example.com' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = deleteUserSchema.safeParse({ confirmEmail: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('rejects missing confirmEmail', () => {
    const result = deleteUserSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
