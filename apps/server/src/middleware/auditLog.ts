import type { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { auditLog as auditLogTable } from '../db/schema';
import { hashBody } from '../lib/hashBody';
import { extractClientIp } from '../lib/extractIp';
import { logger } from '../lib/logger';

/**
 * Derives an action name from the request method and path.
 * If req.auditAction is set (by logAuthEvent), uses that instead.
 */
function deriveAction(req: Request): string {
  if (req.auditAction) return req.auditAction;

  const method = req.method.toUpperCase();
  const resource = req.route?.path ?? req.path;

  // Extract resource name from path: /api/users → USERS, /api/auth/login → AUTH_LOGIN
  const segments = resource.replace(/^\/api\//, '').split('/').filter(Boolean);
  const resourceName = segments
    .filter((s: string) => !s.startsWith(':'))
    .join('_')
    .toUpperCase();

  const verbMap: Record<string, string> = {
    GET: 'LIST',
    POST: 'CREATE',
    PUT: 'UPDATE',
    PATCH: 'UPDATE',
    DELETE: 'DELETE',
  };

  return resourceName ? `${resourceName}_${verbMap[method] ?? method}` : `UNKNOWN_${verbMap[method] ?? method}`;
}

/**
 * Audit log middleware — captures authenticated API calls.
 * Uses res.on('finish') to capture response status after handler completes.
 * Fire-and-forget: DB failures logged to pino, never block response.
 *
 * Position in chain: authenticate → authorise → scopeToMda → validate → auditLog → handler
 */
export function auditLog(req: Request, res: Response, next: NextFunction): void {
  const startTime = process.hrtime.bigint();

  // Capture request data now (before any mutation)
  const userId = req.user?.userId ?? null;
  const email = req.user?.email ?? null;
  const role = req.user?.role ?? null;
  const mdaId = req.user?.mdaId ?? null;
  const method = req.method;
  const resource = req.originalUrl;
  const bodyHash = hashBody(req.body);
  const ip = extractClientIp(req);
  const userAgent = req.get('user-agent') ?? null;

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startTime) / 1_000_000;

    // Fire-and-forget: async insert, catch errors silently
    db.insert(auditLogTable)
      .values({
        userId,
        email,
        role,
        mdaId,
        action: deriveAction(req),
        resource,
        method,
        requestBodyHash: bodyHash,
        responseStatus: res.statusCode,
        ipAddress: ip,
        userAgent,
        durationMs: Math.round(durationMs),
      })
      .catch((err) => {
        logger.error({ err, userId, resource, method }, 'Failed to write audit log entry');
      });
  });

  next();
}
