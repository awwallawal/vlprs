import { describe, it, expect } from 'vitest';
import { hashToken } from './tokenHash';

describe('tokenHash', () => {
  it('returns a 64-character hex string (SHA-256)', () => {
    const hash = hashToken('test-token');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('is deterministic — same input produces same hash', () => {
    const hash1 = hashToken('same-input');
    const hash2 = hashToken('same-input');
    expect(hash1).toBe(hash2);
  });

  it('produces different hashes for different inputs', () => {
    const hash1 = hashToken('token-a');
    const hash2 = hashToken('token-b');
    expect(hash1).not.toBe(hash2);
  });
});
