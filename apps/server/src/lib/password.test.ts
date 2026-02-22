import { describe, it, expect } from 'vitest';
import { hashPassword, comparePassword, generateTemporaryPassword } from './password';

describe('password', () => {
  it('hashPassword returns a bcrypt hash (12 rounds)', async () => {
    const hash = await hashPassword('TestPass1');
    expect(hash).toMatch(/^\$2[aby]\$12\$/);
  });

  it('comparePassword returns true for correct password', async () => {
    const hash = await hashPassword('CorrectPass1');
    const result = await comparePassword('CorrectPass1', hash);
    expect(result).toBe(true);
  });

  it('comparePassword returns false for incorrect password', async () => {
    const hash = await hashPassword('CorrectPass1');
    const result = await comparePassword('WrongPass1', hash);
    expect(result).toBe(false);
  });

  it('produces different hashes for the same password (salt uniqueness)', async () => {
    const hash1 = await hashPassword('SamePass1');
    const hash2 = await hashPassword('SamePass1');
    expect(hash1).not.toBe(hash2);
  });
});

describe('generateTemporaryPassword', () => {
  it('returns a 12-character string', () => {
    const pwd = generateTemporaryPassword();
    expect(pwd).toHaveLength(12);
  });

  it('contains at least one uppercase letter', () => {
    const pwd = generateTemporaryPassword();
    expect(pwd).toMatch(/[A-Z]/);
  });

  it('contains at least one lowercase letter', () => {
    const pwd = generateTemporaryPassword();
    expect(pwd).toMatch(/[a-z]/);
  });

  it('contains at least one digit', () => {
    const pwd = generateTemporaryPassword();
    expect(pwd).toMatch(/[0-9]/);
  });

  it('generates unique passwords', () => {
    const passwords = new Set(Array.from({ length: 20 }, () => generateTemporaryPassword()));
    expect(passwords.size).toBe(20);
  });

  it('contains only alphanumeric characters', () => {
    const pwd = generateTemporaryPassword();
    expect(pwd).toMatch(/^[A-Za-z0-9]+$/);
  });
});
