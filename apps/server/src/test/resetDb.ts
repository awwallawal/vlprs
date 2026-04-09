import { sql } from 'drizzle-orm';
import { db } from '../db';
import { drainPendingAuditWrites } from '../services/auditTracking';

/**
 * Truncate ALL application tables in a single statement.
 * Uses CASCADE to handle FK dependencies transitively.
 *
 * Call in beforeAll / afterAll of every integration test file
 * so that each file starts and finishes with a clean database.
 *
 * Drains any in-flight audit-log writes BEFORE truncating, so a fire-and-forget
 * audit INSERT from a previous test cannot race with the TRUNCATE and poison
 * the connection pool — see
 * _bmad-output/implementation-artifacts/test-isolation-flake-finding-2026-04-08.md
 *
 * -- All application tables listed explicitly. Keep this in sync with schema.ts when adding new tables.
 */
export async function resetDb(): Promise<void> {
  await drainPendingAuditWrites();
  await db.execute(sql`TRUNCATE
    auto_stop_certificates,
    loan_completions,
    metric_snapshots,
    loan_annotations,
    loan_event_flag_corrections,
    baseline_annotations,
    submission_rows,
    mda_submissions,
    employment_events,
    transfers,
    exceptions,
    observations,
    deduplication_candidates,
    person_matches,
    migration_extra_fields,
    migration_records,
    migration_uploads,
    temporal_corrections,
    service_extensions,
    loan_state_transitions,
    ledger_entries,
    loans,
    scheme_config,
    refresh_tokens,
    audit_log,
    users,
    mda_aliases,
    mdas
  CASCADE`);
}
