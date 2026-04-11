import { sql } from 'drizzle-orm';
import { db } from '../db';
import { drainFireAndForgetWrites } from '../services/fireAndForgetTracking';

/**
 * Truncate ALL application tables in a single statement.
 * Uses CASCADE to handle FK dependencies transitively.
 *
 * Call in beforeAll / afterAll of every integration test file
 * so that each file starts and finishes with a clean database.
 *
 * Drains ALL in-flight fire-and-forget writes (audit logs, observations,
 * certificate generation, dedup detection, notifications) BEFORE truncating,
 * so no fire-and-forget INSERT can race with the TRUNCATE and poison the
 * connection pool — see
 * _bmad-output/implementation-artifacts/test-isolation-flake-finding-2026-04-08.md
 *
 * -- All application tables listed explicitly. Keep this in sync with schema.ts when adding new tables.
 */
export async function resetDb(): Promise<void> {
  await drainFireAndForgetWrites();
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
