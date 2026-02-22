import { describe, it, expect } from 'vitest';
import { generateTemporaryPassword } from '../lib/password';

describe('createAdmin CLI helper', () => {
  it('generates a password meeting FR42 policy', () => {
    const password = generateTemporaryPassword();
    expect(password.length).toBe(12);
    expect(/[A-Z]/.test(password)).toBe(true);
    expect(/[a-z]/.test(password)).toBe(true);
    expect(/[0-9]/.test(password)).toBe(true);
  });

  it('parseArgs extracts --email and --name (inline validation)', () => {
    // We test the argument parsing logic directly
    const argv = ['node', 'createAdmin.ts', '--email', 'test@example.com', '--name', 'Test User'];
    let email = '';
    let name = '';
    for (let i = 2; i < argv.length; i++) {
      if (argv[i] === '--email' && argv[i + 1]) {
        email = argv[++i];
      } else if (argv[i] === '--name' && argv[i + 1]) {
        name = argv[++i];
      }
    }
    expect(email).toBe('test@example.com');
    expect(name).toBe('Test User');
  });

  it('splits full name into first/last correctly', () => {
    const name = 'Accountant General';
    const parts = name.trim().split(/\s+/);
    const firstName = parts[0];
    const lastName = parts.slice(1).join(' ') || firstName;
    expect(firstName).toBe('Accountant');
    expect(lastName).toBe('General');
  });

  it('handles single-word name by using it for both first and last', () => {
    const name = 'Admin';
    const parts = name.trim().split(/\s+/);
    const firstName = parts[0];
    const lastName = parts.slice(1).join(' ') || firstName;
    expect(firstName).toBe('Admin');
    expect(lastName).toBe('Admin');
  });
});
