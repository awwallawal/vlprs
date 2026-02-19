import { describe, it, expect } from 'vitest';
import { loginSchema, registerSchema } from './authSchemas';

describe('loginSchema', () => {
  it('validates correct input', () => {
    const result = loginSchema.safeParse({ email: 'test@example.com', password: 'mypassword' });
    expect(result.success).toBe(true);
  });

  it('rejects missing email', () => {
    const result = loginSchema.safeParse({ password: 'mypassword' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid email format', () => {
    const result = loginSchema.safeParse({ email: 'not-an-email', password: 'mypassword' });
    expect(result.success).toBe(false);
  });

  it('rejects missing password', () => {
    const result = loginSchema.safeParse({ email: 'test@example.com' });
    expect(result.success).toBe(false);
  });
});

describe('registerSchema', () => {
  const validInput = {
    email: 'test@example.com',
    password: 'SecurePass1',
    firstName: 'John',
    lastName: 'Doe',
    role: 'mda_officer' as const,
    mdaId: '01912345-6789-7abc-8def-0123456789ab',
  };

  it('validates correct input', () => {
    const result = registerSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('rejects password shorter than 8 characters', () => {
    const result = registerSchema.safeParse({ ...validInput, password: 'Short1' });
    expect(result.success).toBe(false);
  });

  it('rejects password without uppercase letter', () => {
    const result = registerSchema.safeParse({ ...validInput, password: 'lowercase1' });
    expect(result.success).toBe(false);
  });

  it('rejects password without lowercase letter', () => {
    const result = registerSchema.safeParse({ ...validInput, password: 'UPPERCASE1' });
    expect(result.success).toBe(false);
  });

  it('rejects password without digit', () => {
    const result = registerSchema.safeParse({ ...validInput, password: 'NoDigitHere' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid role enum', () => {
    const result = registerSchema.safeParse({ ...validInput, role: 'invalid_role' });
    expect(result.success).toBe(false);
  });
});
