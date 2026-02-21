import { db } from '../db';
import { auditLog } from '../db/schema';
import { logger } from '../lib/logger';

export interface AuditContext {
  ipAddress: string;
  userAgent: string | null;
}

interface AuthEventInput {
  userId?: string | null;
  email: string;
  role?: string | null;
  mdaId?: string | null;
  action: string;
  resource: string;
  method?: string;
  responseStatus?: number;
  ipAddress: string;
  userAgent?: string | null;
}

/**
 * Log an authentication event to the audit_log table.
 * Called explicitly from authService for login, logout, failed attempts, lockout.
 * Fire-and-forget: never throws, logs errors to pino.
 */
export async function logAuthEvent(event: AuthEventInput): Promise<void> {
  try {
    await db.insert(auditLog).values({
      userId: event.userId ?? null,
      email: event.email,
      role: event.role ?? null,
      mdaId: event.mdaId ?? null,
      action: event.action,
      resource: event.resource,
      method: event.method ?? 'POST',
      requestBodyHash: null, // Auth events don't hash bodies (contains passwords)
      responseStatus: event.responseStatus ?? null,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent ?? null,
      durationMs: null,
    });
  } catch (err) {
    logger.error({ err, action: event.action, email: event.email }, 'Failed to log auth event');
  }
}
