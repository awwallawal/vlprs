/**
 * Backward-compatibility re-export.
 *
 * All tracking logic now lives in `fireAndForgetTracking.ts`.
 * Existing imports from this file continue to work unchanged.
 */
export {
  trackFireAndForget as trackAuditWrite,
  drainFireAndForgetWrites as drainPendingAuditWrites,
  pendingFireAndForgetCount as pendingAuditWriteCount,
} from './fireAndForgetTracking';
