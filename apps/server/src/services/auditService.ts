import { db } from '../db';
import { auditLog } from '../db/schema';
import { logger } from '../lib/logger';
import { trackAuditWrite } from './auditTracking';

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
 *
 * The inner DB write is registered with `trackAuditWrite` so integration test
 * resets can drain in-flight audit writes before TRUNCATE — see
 * `_bmad-output/implementation-artifacts/test-isolation-flake-finding-2026-04-08.md`.
 * This does not change production semantics: callers still treat the returned
 * promise as fire-and-forget (`void logAuthEvent(...)`).
 */
export async function logAuthEvent(event: AuthEventInput): Promise<void> {
  await trackAuditWrite(
    (async () => {
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
    })(),
  );
}
