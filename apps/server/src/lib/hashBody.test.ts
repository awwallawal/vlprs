import { describe, it, expect } from 'vitest';
import { hashBody } from './hashBody';

describe('hashBody', () => {
  it('returns null for undefined', () => {
    expect(hashBody(undefined)).toBeNull();
  });

  it('returns null for null', () => {
    expect(hashBody(null)).toBeNull();
  });

  it('returns null for empty object', () => {
    expect(hashBody({})).toBeNull();
  });

  it('returns a 64-char hex string for a valid body', () => {
    const hash = hashBody({ email: 'a@b.com' });
    expect(hash).not.toBeNull();
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces the same hash regardless of key order (deterministic)', () => {
    const hash1 = hashBody({ b: 1, a: 2 });
    const hash2 = hashBody({ a: 2, b: 1 });
    expect(hash1).toBe(hash2);
  });

  it('produces the same hash for identical inputs (deterministic)', () => {
    const body = { email: 'test@example.com', password: 'secret123' };
    const hash1 = hashBody(body);
    const hash2 = hashBody(body);
    expect(hash1).toBe(hash2);
  });

  it('produces different hashes for different inputs', () => {
    const hash1 = hashBody({ email: 'a@b.com' });
    const hash2 = hashBody({ email: 'c@d.com' });
    expect(hash1).not.toBe(hash2);
  });

  it('produces the same hash for nested objects regardless of key order', () => {
    const hash1 = hashBody({ user: { b: 1, a: 2 }, action: 'create' });
    const hash2 = hashBody({ action: 'create', user: { a: 2, b: 1 } });
    expect(hash1).toBe(hash2);
  });

  it('preserves nested object content in hash (no silent key drops)', () => {
    const body = { user: { name: 'John' }, action: 'create' };
    const hash1 = hashBody(body);
    // If nested keys were dropped, removing nested content would produce same hash
    const bodyWithoutNested = { user: {}, action: 'create' };
    const hash2 = hashBody(bodyWithoutNested);
    expect(hash1).not.toBe(hash2);
  });
});
