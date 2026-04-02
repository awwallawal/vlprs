import { sql } from 'drizzle-orm';
import { db } from '../db';

/**
 * Truncate ALL application tables in a single statement.
 * Uses CASCADE to handle FK dependencies transitively.
 *
 * Call in beforeAll / afterAll of every integration test file
 * so that each file starts and finishes with a clean database.
 *
 * -- All application tables listed explicitly. Keep this in sync with schema.ts when adding new tables.
 */
export async function resetDb(): Promise<void> {
  await db.execute(sql`TRUNCATE
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
