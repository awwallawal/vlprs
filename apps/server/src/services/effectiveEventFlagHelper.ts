import { sql } from 'drizzle-orm';
import { db } from '../db/index';
import type { EventFlagType } from '@vlprs/shared';

/**
 * Bulk-load the latest event flag correction for each submissionRowId.
 * Returns a Map keyed by submissionRowId → corrected eventFlag.
 * If no correction exists for a row, the row won't be in the Map (caller uses original).
 *
 * Uses DISTINCT ON to efficiently pick the latest correction per submission row.
 * One query per service call — respects N+1 query budget team agreement.
 */
export async function getEffectiveEventFlags(
  submissionRowIds: string[],
): Promise<Map<string, EventFlagType>> {
  if (submissionRowIds.length === 0) return new Map();

  const result = await db.execute(sql`
    SELECT DISTINCT ON (submission_row_id) submission_row_id, new_event_flag
    FROM loan_event_flag_corrections
    WHERE submission_row_id IN (${sql.join(submissionRowIds.map(id => sql`${id}`), sql`, `)})
    ORDER BY submission_row_id, created_at DESC
  `);

  const map = new Map<string, EventFlagType>();
  for (const row of result.rows as Array<{ submission_row_id: string; new_event_flag: string }>) {
    map.set(row.submission_row_id, row.new_event_flag as EventFlagType);
  }
  return map;
}

/**
 * Single-row convenience wrapper.
 * Returns the corrected flag if a correction exists, otherwise returns originalFlag.
 */
export async function getEffectiveEventFlag(
  submissionRowId: string,
  originalFlag: EventFlagType,
): Promise<EventFlagType> {
  const map = await getEffectiveEventFlags([submissionRowId]);
  return map.get(submissionRowId) ?? originalFlag;
}

/**
 * Bulk-load the latest event flag correction for each loanId.
 * Used for corrections filed without a specific submissionRowId (submissionRowId IS NULL).
 * Returns a Map keyed by loanId → corrected eventFlag.
 *
 * NOTE: Currently unused by the 4 downstream services (reconciliation, comparison,
 * inactive loan, pre-submission) — they all use getEffectiveEventFlags() which keys
 * by submissionRowId. If corrections with null submissionRowId exist in production,
 * those services would need to also call this function as a fallback.
 */
export async function getEffectiveEventFlagsByLoan(
  loanIds: string[],
): Promise<Map<string, EventFlagType>> {
  if (loanIds.length === 0) return new Map();

  const result = await db.execute(sql`
    SELECT DISTINCT ON (loan_id) loan_id, new_event_flag
    FROM loan_event_flag_corrections
    WHERE loan_id IN (${sql.join(loanIds.map(id => sql`${id}`), sql`, `)})
      AND submission_row_id IS NULL
    ORDER BY loan_id, created_at DESC
  `);

  const map = new Map<string, EventFlagType>();
  for (const row of result.rows as Array<{ loan_id: string; new_event_flag: string }>) {
    map.set(row.loan_id, row.new_event_flag as EventFlagType);
  }
  return map;
}
