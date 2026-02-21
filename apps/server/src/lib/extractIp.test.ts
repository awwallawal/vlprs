import { describe, it, expect } from 'vitest';
import { extractClientIp } from './extractIp';
import type { Request } from 'express';

function mockReq(overrides: Partial<{ ip: string; socket: { remoteAddress?: string } }>): Request {
  return {
    ip: overrides.ip,
    socket: overrides.socket ?? { remoteAddress: undefined },
  } as unknown as Request;
}

describe('extractClientIp', () => {
  it('extracts req.ip when available', () => {
    expect(extractClientIp(mockReq({ ip: '192.168.1.1' }))).toBe('192.168.1.1');
  });

  it('falls back to req.socket.remoteAddress', () => {
    expect(extractClientIp(mockReq({ ip: undefined, socket: { remoteAddress: '10.0.0.1' } }))).toBe('10.0.0.1');
  });

  it('normalizes ::ffff:127.0.0.1 to 127.0.0.1', () => {
    expect(extractClientIp(mockReq({ ip: '::ffff:127.0.0.1' }))).toBe('127.0.0.1');
  });

  it('returns "unknown" when no IP available', () => {
    expect(extractClientIp(mockReq({ ip: undefined, socket: { remoteAddress: undefined } }))).toBe('unknown');
  });
});
