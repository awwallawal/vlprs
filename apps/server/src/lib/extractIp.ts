import type { Request } from 'express';

/**
 * Extracts the client IP address from an Express request.
 * When trust proxy is configured, req.ip is the resolved client IP.
 * Normalizes IPv6-mapped IPv4 addresses.
 */
export function extractClientIp(req: Request): string {
  let ip = req.ip;

  if (!ip) {
    ip = req.socket.remoteAddress ?? 'unknown';
  }

  // Normalize ::ffff:127.0.0.1 → 127.0.0.1
  if (ip?.startsWith('::ffff:')) {
    ip = ip.slice(7);
  }

  return ip;
}
