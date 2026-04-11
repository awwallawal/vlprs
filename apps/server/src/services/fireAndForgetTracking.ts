/**
 * Fire-and-Forget Write Tracking Registry
 *
 * Test-isolation infrastructure: tracks in-flight fire-and-forget DB writes
 * so integration test reset helpers can drain them before TRUNCATE.
 *
 * Background — see `_bmad-output/implementation-artifacts/test-isolation-flake-finding-2026-04-08.md`
 *
 * Server code paths that fire DB writes as fire-and-forget:
 *   1. `auditService.logAuthEvent` — called from auth flows as `void logAuthEvent(...)`
 *   2. `middleware/auditLog` — called from `res.on('finish')` after every authed request
 *   3. `baselineService` — `generateObservations()` after baseline commit
 *   4. `mdaReviewService` — `generateObservations()` after admin-verify baseline
 *   5. `autoStopService` — `generateCertificate()` after loan completion
 *   6. `autoStopCertificateService` — `sendAutoStopNotifications()` after cert generation
 *   7. `migrationValidationService` — `detectCrossFileDuplicates()` after validation
 *
 * Without coordination, those in-flight writes can race with `resetDb()`'s
 * `TRUNCATE ... CASCADE` between integration test cases — the write loses,
 * its FK fails, and the connection pool ends up in an inconsistent state.
 *
 * Both `resetDb()` (beforeAll/afterAll) and individual `beforeEach` hooks
 * that do custom TRUNCATEs must call `drainFireAndForgetWrites()` first.
 *
 * Production impact: zero. The registry is a `Set` with O(1) add/delete;
 * nobody reads it except test reset helpers. Caller-facing `void` semantics
 * are preserved — production code does not await these writes.
 */

const inflight = new Set<Promise<unknown>>();

/**
 * Register an in-flight fire-and-forget write so it can be awaited by `drainFireAndForgetWrites()`.
 *
 * Returns the same promise unchanged so call sites can stay terse:
 *
 *   void trackFireAndForget(someService.doWork().catch(...));
 */
export function trackFireAndForget<T>(p: Promise<T>): Promise<T> {
  inflight.add(p);
  const cleanup = (): void => {
    inflight.delete(p);
  };
  p.then(cleanup, cleanup);
  return p;
}

/**
 * Wait for every currently-tracked fire-and-forget write to settle.
 *
 * Loops because settling one write can synchronously schedule another.
 * Continues until the registry is empty.
 *
 * Always settles — never throws — because individual writes wrap their
 * own errors and the caller's intent here is "wait for quiescence".
 *
 * Intended for test reset helpers (`resetDb`, `beforeEach` hooks).
 */
export async function drainFireAndForgetWrites(): Promise<void> {
  for (let i = 0; i < 100 && inflight.size > 0; i++) {
    await Promise.allSettled(Array.from(inflight));
  }
}

/**
 * Test-only: number of currently in-flight writes.
 */
export function pendingFireAndForgetCount(): number {
  return inflight.size;
}

// ─── Backward-compatible aliases (existing consumers) ──────────────
export const trackAuditWrite = trackFireAndForget;
export const drainPendingAuditWrites = drainFireAndForgetWrites;
export const pendingAuditWriteCount = pendingFireAndForgetCount;
