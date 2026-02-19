import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import { signAccessToken, verifyAccessToken } from './jwt';
import type { JwtPayload } from '@vlprs/shared';

const testPayload: JwtPayload = {
  userId: '01912345-6789-7abc-8def-0123456789ab',
  email: 'test@vlprs.gov.ng',
  role: 'super_admin',
  mdaId: null,
};

describe('jwt', () => {
  it('signAccessToken returns a valid JWT string', () => {
    const token = signAccessToken(testPayload);
    expect(token).toBeTruthy();
    expect(token.split('.')).toHaveLength(3);
  });

  it('verifyAccessToken decodes correct claims', () => {
    const token = signAccessToken(testPayload);
    const decoded = verifyAccessToken(token);
    expect(decoded.userId).toBe(testPayload.userId);
    expect(decoded.email).toBe(testPayload.email);
    expect(decoded.role).toBe(testPayload.role);
    expect(decoded.mdaId).toBe(testPayload.mdaId);
  });

  it('verifyAccessToken throws for invalid token', () => {
    expect(() => verifyAccessToken('invalid.token.here')).toThrow();
  });

  it('verifyAccessToken throws for expired token', () => {
    const token = jwt.sign({ ...testPayload }, process.env.JWT_SECRET || 'change-me-in-production', {
      expiresIn: '0s',
    });
    // Small delay to ensure expiration
    expect(() => verifyAccessToken(token)).toThrow();
  });

  it('token contains iat and exp claims', () => {
    const token = signAccessToken(testPayload);
    const decoded = jwt.decode(token) as Record<string, unknown>;
    expect(decoded).toHaveProperty('iat');
    expect(decoded).toHaveProperty('exp');
  });
});
