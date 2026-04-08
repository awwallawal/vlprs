/**
 * Audit Write Tracking Registry
 *
 * Test-isolation infrastructure: tracks in-flight fire-and-forget audit writes
 * so the integration test reset helper can drain them before TRUNCATE.
 *
 * Background — see `_bmad-output/implementation-artifacts/test-isolation-flake-finding-2026-04-08.md`
 *
 * Two server code paths fire audit-log INSERTs as fire-and-forget:
 *   1. `auditService.logAuthEvent` — called from auth flows as `void logAuthEvent(...)`
 *   2. `middleware/auditLog` — called from `res.on('finish')` after every authed request
 *
 * Without coordination, those in-flight INSERTs can race with `resetDb()`'s
 * `TRUNCATE users CASCADE` between integration test cases — the INSERT loses,
 * its FK fails, and the connection pool ends up in an inconsistent state that
 * makes the next test's own inserts fail with bewildering "user just inserted
 * but FK says user doesn't exist" errors.
 *
 * This module provides the coordination point. Both code paths wrap their
 * fire-and-forget body in `trackAuditWrite(...)`, and `resetDb()` calls
 * `drainPendingAuditWrites()` before any TRUNCATE.
 *
 * Production impact: zero. The registry is a `Set` with O(1) add/delete; nobody
 * reads it except the test reset helper. Caller-facing `void` semantics are
 * preserved — production code does not await audit writes.
 */

const inflight = new Set<Promise<unknown>>();

/**
 * Register an in-flight audit write so it can be awaited by `drainPendingAuditWrites()`.
 *
 * Returns the same promise unchanged so call sites can stay terse:
 *
 *   void trackAuditWrite(db.insert(auditLog).values({...}).catch(...));
 */
export function trackAuditWrite<T>(p: Promise<T>): Promise<T> {
  inflight.add(p);
  // Use .then with explicit fulfilled AND rejected handlers (NOT .finally)
  // so the cleanup chain handles both branches itself. With .finally the
  // returned promise re-raises any rejection of `p`, and discarding it via
  // `void` would leave that rejection unhandled. The original promise `p`
  // is returned unchanged so the caller's error semantics are preserved —
  // they remain responsible for handling rejections of `p` itself.
  const cleanup = (): void => {
    inflight.delete(p);
  };
  p.then(cleanup, cleanup);
  return p;
}

/**
 * Wait for every currently-tracked audit write to settle.
 *
 * Loops because settling one write can synchronously schedule another (e.g.
 * the cleanup `.finally` may not have run yet by the time `Promise.allSettled`
 * resolves). Continues until the registry is empty.
 *
 * Always settles — never throws — because individual audit writes wrap their
 * own errors and the caller's intent here is "wait for quiescence", not
 * "fail if any write failed".
 *
 * Intended for test reset helpers (`resetDb`). Calling this in production
 * code would defeat the fire-and-forget design.
 */
export async function drainPendingAuditWrites(): Promise<void> {
  // Bound the loop to defend against pathological cases where new writes
  // are added in a hot loop. 100 iterations is far more than any realistic
  // test case can produce.
  for (let i = 0; i < 100 && inflight.size > 0; i++) {
    await Promise.allSettled(Array.from(inflight));
  }
}

/**
 * Test-only: number of currently in-flight audit writes. Useful for asserting
 * registry state in unit tests.
 */
export function pendingAuditWriteCount(): number {
  return inflight.size;
}
