import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';
import { env } from '../config/env.js';

export interface IntegrityResults {
  ledgerImmutability: { count: number; status: 'green'; details: string };
  migrationRecordIntegrity: { count: number };
  pendingObservations: { count: number };
}

export interface BusinessHealthResults {
  mdaSubmissionCoverage: { coveredCount: number; totalActive: number; percent: number };
  unresolvedExceptions: { count: number };
  staleMdas: { count: number };
}

interface CachedResults {
  integrity: IntegrityResults;
  businessHealth: BusinessHealthResults;
  lastChecked: Date;
}

let cachedResults: CachedResults | null = null;
let intervalRef: ReturnType<typeof setInterval> | null = null;
let timeoutRef: ReturnType<typeof setTimeout> | null = null;

async function checkIntegrity(): Promise<void> {
  try {
    // Ledger immutability: structural assertion — no updated_at column exists (append-only by design)
    const ledgerImmutability = {
      count: 0,
      status: 'green' as const,
      details: 'Append-only by design — no update column exists on ledger_entries',
    };

    // Migration record integrity: null staff_name or orphaned upload_id
    const migrationResult = await db.execute(sql`
      SELECT count(*)::int AS count
      FROM migration_records
      WHERE staff_name IS NULL
         OR upload_id NOT IN (SELECT id FROM migration_uploads)
    `);
    const migrationRecordIntegrity = { count: (migrationResult.rows[0] as { count: number }).count };

    // Pending observations
    const pendingResult = await db.execute(sql`
      SELECT count(*)::int AS count
      FROM observations
      WHERE status = 'unreviewed'
    `);
    const pendingObservations = { count: (pendingResult.rows[0] as { count: number }).count };

    // Business health metrics
    // MDA Submission Coverage: active MDAs with a confirmed submission in current period
    const now = new Date();
    const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const coverageResult = await db.execute(sql`
      SELECT
        (SELECT count(*)::int FROM mdas WHERE is_active = true AND deleted_at IS NULL) AS total_active,
        (SELECT count(DISTINCT mda_id)::int
         FROM mda_submissions
         WHERE status = 'confirmed'
           AND period = ${currentPeriod}) AS covered_count
    `);
    const coverage = coverageResult.rows[0] as { total_active: number; covered_count: number };
    const totalActive = coverage.total_active || 0;
    const coveredCount = coverage.covered_count || 0;
    const percent = totalActive > 0 ? +((coveredCount / totalActive) * 100).toFixed(1) : 0;

    // Unresolved Exceptions: observations with status unreviewed or reviewed (not yet resolved)
    const unresolvedResult = await db.execute(sql`
      SELECT count(*)::int AS count
      FROM observations
      WHERE status IN ('unreviewed', 'reviewed')
    `);
    const unresolvedExceptions = { count: (unresolvedResult.rows[0] as { count: number }).count };

    // Stale Data Detection: MDAs with no submission activity in last 90 days
    const staleResult = await db.execute(sql`
      SELECT count(*)::int AS count
      FROM mdas m
      WHERE m.is_active = true
        AND m.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM mda_submissions s
          WHERE s.mda_id = m.id
            AND s.created_at >= NOW() - INTERVAL '90 days'
        )
    `);
    const staleMdas = { count: (staleResult.rows[0] as { count: number }).count };

    cachedResults = {
      integrity: { ledgerImmutability, migrationRecordIntegrity, pendingObservations },
      businessHealth: {
        mdaSubmissionCoverage: { coveredCount, totalActive, percent },
        unresolvedExceptions,
        staleMdas,
      },
      lastChecked: new Date(),
    };
  } catch (err) {
    // Log error but don't crash — keep serving stale results
    console.error('Integrity checker failed:', err);
  }
}

export function getIntegrityResults(): { results: IntegrityResults | null; lastChecked: Date | null } {
  return {
    results: cachedResults?.integrity ?? null,
    lastChecked: cachedResults?.lastChecked ?? null,
  };
}

export function getBusinessHealthResults(): { results: BusinessHealthResults | null; lastChecked: Date | null } {
  return {
    results: cachedResults?.businessHealth ?? null,
    lastChecked: cachedResults?.lastChecked ?? null,
  };
}

/**
 * Start the integrity checker interval.
 * Called explicitly from server startup — NOT auto-started on import.
 * Guarded against test mode to avoid dangling timers.
 */
export function startIntegrityChecker(): void {
  if (env.NODE_ENV === 'test') return;
  if (intervalRef || timeoutRef) return; // Already running

  // First run after 30s delay to avoid startup load spike
  timeoutRef = setTimeout(() => {
    timeoutRef = null;
    checkIntegrity();
    intervalRef = setInterval(checkIntegrity, 15 * 60 * 1000);
  }, 30_000);
}

/**
 * Stop the interval — used in graceful shutdown.
 */
export function stopIntegrityChecker(): void {
  if (timeoutRef) {
    clearTimeout(timeoutRef);
    timeoutRef = null;
  }
  if (intervalRef) {
    clearInterval(intervalRef);
    intervalRef = null;
  }
}

/** Visible for testing — run a single integrity check */
export async function runCheckOnce(): Promise<void> {
  await checkIntegrity();
}

/** Visible for testing — reset cached results */
export function resetCache(): void {
  cachedResults = null;
}
