import { eq, and, inArray, sql } from 'drizzle-orm';
import { differenceInDays, parseISO } from 'date-fns';
import { db } from '../db/index';
import { employmentEvents, submissionRows, mdaSubmissions, loans } from '../db/schema';
import { AppError } from '../lib/appError';
import { logger } from '../lib/logger';
import { EVENT_FLAG_TO_EMPLOYMENT_EVENT_MAP, VOCABULARY } from '@vlprs/shared';
import type { TxHandle } from './loanTransitionService';
import { getEffectiveEventFlags } from './effectiveEventFlagHelper';
import type {
  ReconciliationSummary,
  ReconciliationCounts,
  ReconciliationDetail,
  ReconciliationOutcome,
  EmploymentEventType,
  EventFlagType,
} from '@vlprs/shared';

const DATE_TOLERANCE_DAYS = 7;

// Row shape shared by _reconcile and getReconciliationSummary event row arrays
type EventRow = { id: string; staffId: string; eventFlag: EventFlagType; eventDate: Date | null };

/**
 * Find submission rows whose original eventFlag is NONE but have been corrected
 * to an event flag. These rows were excluded by the initial WHERE eventFlag != 'NONE'
 * but should now be included after correction.
 */
async function getCorrectedNoneToEventRows(
  submissionId: string,
  executor: { execute: typeof db.execute } = db,
): Promise<EventRow[]> {
  const result = await executor.execute(sql`
    SELECT DISTINCT ON (lefc.submission_row_id)
      sr.id, sr.staff_id, lefc.new_event_flag, sr.event_date
    FROM loan_event_flag_corrections lefc
    JOIN submission_rows sr ON lefc.submission_row_id = sr.id
    WHERE sr.submission_id = ${submissionId}
      AND sr.event_flag = 'NONE'
      AND lefc.new_event_flag != 'NONE'
    ORDER BY lefc.submission_row_id, lefc.created_at DESC
  `);

  return (result.rows as Array<{
    id: string; staff_id: string; new_event_flag: string; event_date: string | null;
  }>).map(r => ({
    id: r.id,
    staffId: r.staff_id,
    eventFlag: r.new_event_flag as EventFlagType,
    eventDate: r.event_date ? new Date(r.event_date) : null,
  }));
}

// ─── reconcileSubmission ─────────────────────────────────────────────

/**
 * Reconcile mid-cycle employment events against submission rows.
 * Must be called INSIDE the submission transaction for atomicity (AC 6).
 *
 * @param submissionId - UUID of the submission being processed
 * @param mdaId - UUID of the MDA (for isolation, AC 5)
 * @param tx - Optional Drizzle transaction handle. If not provided, creates its own.
 * @returns ReconciliationSummary with counts and detail array
 */
export async function reconcileSubmission(
  submissionId: string,
  mdaId: string,
  tx?: TxHandle,
): Promise<ReconciliationSummary> {
  const executor = tx ?? db;
  return _reconcile(submissionId, mdaId, executor);
}

async function _reconcile(
  submissionId: string,
  mdaId: string,
  executor: TxHandle | typeof db,
): Promise<ReconciliationSummary> {
  // 1. Query submission rows WHERE event_flag != 'NONE'
  const csvEventRows = await executor
    .select({
      id: submissionRows.id,
      staffId: submissionRows.staffId,
      eventFlag: submissionRows.eventFlag,
      eventDate: submissionRows.eventDate,
    })
    .from(submissionRows)
    .where(
      and(
        eq(submissionRows.submissionId, submissionId),
        sql`${submissionRows.eventFlag} != 'NONE'`,
      ),
    );

  // Story 8.0i: Apply event flag corrections for bidirectional accuracy
  const eventRowIds = csvEventRows.map(r => r.id);
  const correctionMap = eventRowIds.length > 0
    ? await getEffectiveEventFlags(eventRowIds)
    : new Map<string, EventFlagType>();

  // Apply corrections: update flags and remove rows corrected to NONE
  const correctedEventRows = csvEventRows
    .map(row => ({
      ...row,
      eventFlag: (correctionMap.get(row.id) ?? row.eventFlag) as typeof row.eventFlag,
    }))
    .filter(row => row.eventFlag !== 'NONE');

  // Supplementary: find submission rows originally NONE, corrected to event flag
  const supplementaryRows = await getCorrectedNoneToEventRows(submissionId, executor);
  const allEventRows: typeof csvEventRows = [...correctedEventRows, ...supplementaryRows];

  // Early return if no event-flagged rows (after corrections)
  if (allEventRows.length === 0) {
    const emptyCounts: ReconciliationCounts = {
      matched: 0,
      dateDiscrepancy: 0,
      unconfirmed: 0,
      newCsvEvent: 0,
    };
    return { counts: emptyCounts, details: [] };
  }

  // 2. Collect unique staff IDs from event rows
  const staffIds = [...new Set(allEventRows.map((r) => r.staffId))];

  // 3. Batch query employment events — UNCONFIRMED only, same MDA (AC 5, 9)
  const unconfirmedEvents = await executor
    .select({
      id: employmentEvents.id,
      staffId: employmentEvents.staffId,
      eventType: employmentEvents.eventType,
      effectiveDate: employmentEvents.effectiveDate,
      loanId: employmentEvents.loanId,
    })
    .from(employmentEvents)
    .where(
      and(
        eq(employmentEvents.mdaId, mdaId),
        eq(employmentEvents.reconciliationStatus, 'UNCONFIRMED'),
        inArray(employmentEvents.staffId, staffIds),
      ),
    );

  // 4. Build lookup map: staffId::eventType -> EmploymentEvent[] (array for duplicates)
  const eventMap = new Map<string, typeof unconfirmedEvents>();
  for (const evt of unconfirmedEvents) {
    const key = `${evt.staffId}::${evt.eventType}`;
    const arr = eventMap.get(key) ?? [];
    arr.push(evt);
    eventMap.set(key, arr);
  }
  // Sort each array by created_at is not available here, but we have the data order
  // which is sufficient for deterministic matching

  // 5. Query staff names for detail output
  const staffNameMap = new Map<string, string>();
  if (staffIds.length > 0) {
    const loanRows = await executor
      .select({
        staffId: loans.staffId,
        staffName: loans.staffName,
      })
      .from(loans)
      .where(inArray(loans.staffId, staffIds));
    for (const row of loanRows) {
      if (!staffNameMap.has(row.staffId)) {
        staffNameMap.set(row.staffId, row.staffName);
      }
    }
  }

  // 6. Process each CSV event row
  const matchedIds: string[] = [];
  const discrepancyIds: string[] = [];
  const details: ReconciliationDetail[] = [];
  let newCsvEventCount = 0;

  for (const csvRow of allEventRows) {
    const mapping = EVENT_FLAG_TO_EMPLOYMENT_EVENT_MAP[csvRow.eventFlag as EventFlagType];
    if (mapping === null) continue; // NONE — skip

    const mappedTypes: EmploymentEventType[] = Array.isArray(mapping) ? mapping : [mapping];
    const staffName = staffNameMap.get(csvRow.staffId) ?? 'Unknown';

    // Try each mapped type (for LEAVE_WITHOUT_PAY: LWOP_START first, then LWOP_END)
    let found = false;
    for (const mappedType of mappedTypes) {
      const key = `${csvRow.staffId}::${mappedType}`;
      const events = eventMap.get(key);
      if (!events || events.length === 0) continue;

      // Evaluate ALL duplicates independently
      for (const evt of events) {
        const csvDate = csvRow.eventDate;
        const evtDate = evt.effectiveDate;

        let daysDiff: number | null = null;
        let outcome: 'matched' | 'date_discrepancy';

        if (csvDate === null) {
          // Null CSV event_date with non-NONE flag → DATE_DISCREPANCY
          outcome = 'date_discrepancy';
          daysDiff = null;
        } else {
          const csvDateParsed = csvDate instanceof Date ? csvDate : parseISO(String(csvDate));
          const evtDateParsed = evtDate instanceof Date ? evtDate : parseISO(String(evtDate));
          daysDiff = Math.abs(differenceInDays(csvDateParsed, evtDateParsed));
          outcome = daysDiff <= DATE_TOLERANCE_DAYS ? 'matched' : 'date_discrepancy';
        }

        if (outcome === 'matched') {
          matchedIds.push(evt.id);
        } else {
          discrepancyIds.push(evt.id);
        }

        details.push({
          staffId: csvRow.staffId,
          staffName,
          eventType: mappedType,
          csvEventDate: csvDate ? (csvDate instanceof Date ? csvDate.toISOString().split('T')[0] : String(csvDate)) : null,
          employmentEventDate: evtDate ? (evtDate instanceof Date ? evtDate.toISOString().split('T')[0] : String(evtDate)) : null,
          reconciliationStatus: outcome as ReconciliationOutcome,
          daysDifference: daysDiff,
          employmentEventId: evt.id,
        });
      }

      // Remove key from map to prevent re-matching
      eventMap.delete(key);
      found = true;
      break; // Found a matching type, stop trying alternatives
    }

    if (!found) {
      // New CSV event — no matching employment event
      newCsvEventCount++;
      details.push({
        staffId: csvRow.staffId,
        staffName,
        eventType: Array.isArray(mapping) ? mapping[0] : mapping,
        csvEventDate: csvRow.eventDate
          ? (csvRow.eventDate instanceof Date ? csvRow.eventDate.toISOString().split('T')[0] : String(csvRow.eventDate))
          : null,
        employmentEventDate: null,
        reconciliationStatus: 'new_csv_event',
        daysDifference: null,
        employmentEventId: null,
      });
    }
  }

  // 7. Remaining events in map are unconfirmed (no CSV match)
  let unconfirmedCount = 0;
  for (const [, events] of eventMap) {
    for (const evt of events) {
      unconfirmedCount++;
      const staffName = staffNameMap.get(evt.staffId) ?? 'Unknown';
      details.push({
        staffId: evt.staffId,
        staffName,
        eventType: evt.eventType,
        csvEventDate: null,
        employmentEventDate: evt.effectiveDate
          ? (evt.effectiveDate instanceof Date ? evt.effectiveDate.toISOString().split('T')[0] : String(evt.effectiveDate))
          : null,
        reconciliationStatus: 'unconfirmed_event',
        daysDifference: null,
        employmentEventId: evt.id,
      });
    }
  }

  // 8. Batch UPDATEs — minimize DB round-trips (AC 7)
  if (matchedIds.length > 0) {
    await executor
      .update(employmentEvents)
      .set({ reconciliationStatus: 'MATCHED', updatedAt: new Date() })
      .where(inArray(employmentEvents.id, matchedIds));
  }

  if (discrepancyIds.length > 0) {
    await executor
      .update(employmentEvents)
      .set({ reconciliationStatus: 'DATE_DISCREPANCY', updatedAt: new Date() })
      .where(inArray(employmentEvents.id, discrepancyIds));
  }

  // 9. Build summary counts
  const counts: ReconciliationCounts = {
    matched: matchedIds.length,
    dateDiscrepancy: discrepancyIds.length,
    unconfirmed: unconfirmedCount,
    newCsvEvent: newCsvEventCount,
  };

  return { counts, details };
}

// ─── getReconciliationSummary ────────────────────────────────────────

/**
 * Read-only reconciliation summary for Department Admin view (AC 4).
 * Summary counts from stored JSONB; detail array from live query.
 */
export async function getReconciliationSummary(
  submissionId: string,
  mdaScope: string | null,
): Promise<ReconciliationSummary> {
  // Load submission header
  const submission = await db
    .select({
      id: mdaSubmissions.id,
      mdaId: mdaSubmissions.mdaId,
      reconciliationSummary: mdaSubmissions.reconciliationSummary,
    })
    .from(mdaSubmissions)
    .where(eq(mdaSubmissions.id, submissionId))
    .limit(1);

  if (submission.length === 0) {
    throw new AppError(404, 'SUBMISSION_NOT_FOUND', 'Submission not found');
  }

  const sub = submission[0];

  // MDA isolation check
  if (mdaScope !== null && mdaScope !== undefined && sub.mdaId !== mdaScope) {
    throw new AppError(403, 'MDA_ACCESS_DENIED', VOCABULARY.MDA_ACCESS_DENIED);
  }

  // Summary counts from stored JSONB (immutable post-submission)
  const storedCounts = sub.reconciliationSummary as ReconciliationCounts | null;
  const counts: ReconciliationCounts = storedCounts ?? {
    matched: 0,
    dateDiscrepancy: 0,
    unconfirmed: 0,
    newCsvEvent: 0,
  };

  // Detail array: live query from employment_events + submission_rows
  // This reflects any subsequent discrepancy resolutions
  const csvEventRowsRaw = await db
    .select({
      id: submissionRows.id,
      staffId: submissionRows.staffId,
      eventFlag: submissionRows.eventFlag,
      eventDate: submissionRows.eventDate,
    })
    .from(submissionRows)
    .where(
      and(
        eq(submissionRows.submissionId, submissionId),
        sql`${submissionRows.eventFlag} != 'NONE'`,
      ),
    );

  // Story 8.0i: Apply event flag corrections for bidirectional accuracy
  const summaryRowIds = csvEventRowsRaw.map(r => r.id);
  const summaryCorrectionMap = summaryRowIds.length > 0
    ? await getEffectiveEventFlags(summaryRowIds)
    : new Map<string, EventFlagType>();

  const correctedSummaryRows = csvEventRowsRaw
    .map(row => ({
      ...row,
      eventFlag: (summaryCorrectionMap.get(row.id) ?? row.eventFlag) as typeof row.eventFlag,
    }))
    .filter(row => row.eventFlag !== 'NONE');

  // Supplementary: find submission rows originally NONE, corrected to event flag
  const summarySupplementaryRows = await getCorrectedNoneToEventRows(submissionId);
  const allSummaryEventRows: typeof csvEventRowsRaw = [...correctedSummaryRows, ...summarySupplementaryRows];

  if (allSummaryEventRows.length === 0) {
    return { counts, details: [] };
  }

  const staffIds = [...new Set(allSummaryEventRows.map((r) => r.staffId))];

  // Query reconciled employment events (MATCHED/DATE_DISCREPANCY) for this MDA + staff IDs
  const reconciledEvents = await db
    .select({
      id: employmentEvents.id,
      staffId: employmentEvents.staffId,
      eventType: employmentEvents.eventType,
      effectiveDate: employmentEvents.effectiveDate,
      reconciliationStatus: employmentEvents.reconciliationStatus,
    })
    .from(employmentEvents)
    .where(
      and(
        eq(employmentEvents.mdaId, sub.mdaId),
        inArray(employmentEvents.staffId, staffIds),
        sql`${employmentEvents.reconciliationStatus} != 'UNCONFIRMED'`,
      ),
    );

  // H2 fix: Also query UNCONFIRMED events that existed at submission time
  // These are events the reconciliation found no CSV match for
  const unconfirmedEvents = await db
    .select({
      id: employmentEvents.id,
      staffId: employmentEvents.staffId,
      eventType: employmentEvents.eventType,
      effectiveDate: employmentEvents.effectiveDate,
      reconciliationStatus: employmentEvents.reconciliationStatus,
    })
    .from(employmentEvents)
    .where(
      and(
        eq(employmentEvents.mdaId, sub.mdaId),
        inArray(employmentEvents.staffId, staffIds),
        eq(employmentEvents.reconciliationStatus, 'UNCONFIRMED'),
      ),
    );

  // Staff name lookup
  const staffNameMap = new Map<string, string>();
  if (staffIds.length > 0) {
    const loanRows = await db
      .select({ staffId: loans.staffId, staffName: loans.staffName })
      .from(loans)
      .where(inArray(loans.staffId, staffIds));
    for (const row of loanRows) {
      if (!staffNameMap.has(row.staffId)) {
        staffNameMap.set(row.staffId, row.staffName);
      }
    }
  }

  // Build detail array from reconciled events
  const details: ReconciliationDetail[] = [];
  const eventMap = new Map<string, typeof reconciledEvents>();
  for (const evt of reconciledEvents) {
    const key = `${evt.staffId}::${evt.eventType}`;
    const arr = eventMap.get(key) ?? [];
    arr.push(evt);
    eventMap.set(key, arr);
  }

  for (const csvRow of allSummaryEventRows) {
    const mapping = EVENT_FLAG_TO_EMPLOYMENT_EVENT_MAP[csvRow.eventFlag as EventFlagType];
    if (mapping === null) continue;

    const mappedTypes: EmploymentEventType[] = Array.isArray(mapping) ? mapping : [mapping];
    const staffName = staffNameMap.get(csvRow.staffId) ?? 'Unknown';

    let found = false;
    for (const mappedType of mappedTypes) {
      const key = `${csvRow.staffId}::${mappedType}`;
      const events = eventMap.get(key);
      if (!events || events.length === 0) continue;

      for (const evt of events) {
        const csvDate = csvRow.eventDate;
        const evtDate = evt.effectiveDate;
        let daysDiff: number | null = null;

        if (csvDate && evtDate) {
          const csvDateParsed = csvDate instanceof Date ? csvDate : parseISO(String(csvDate));
          const evtDateParsed = evtDate instanceof Date ? evtDate : parseISO(String(evtDate));
          daysDiff = Math.abs(differenceInDays(csvDateParsed, evtDateParsed));
        }

        // Map DB reconciliation_status to detail outcome
        let outcome: ReconciliationOutcome;
        if (evt.reconciliationStatus === 'MATCHED') {
          outcome = 'matched';
        } else if (evt.reconciliationStatus === 'DATE_DISCREPANCY') {
          outcome = 'date_discrepancy';
        } else {
          outcome = 'unconfirmed_event';
        }

        details.push({
          staffId: csvRow.staffId,
          staffName,
          eventType: mappedType,
          csvEventDate: csvDate ? (csvDate instanceof Date ? csvDate.toISOString().split('T')[0] : String(csvDate)) : null,
          employmentEventDate: evtDate ? (evtDate instanceof Date ? evtDate.toISOString().split('T')[0] : String(evtDate)) : null,
          reconciliationStatus: outcome,
          daysDifference: daysDiff,
          employmentEventId: evt.id,
        });
      }

      eventMap.delete(key);
      found = true;
      break;
    }

    if (!found) {
      details.push({
        staffId: csvRow.staffId,
        staffName,
        eventType: Array.isArray(mapping) ? mapping[0] : mapping,
        csvEventDate: csvRow.eventDate
          ? (csvRow.eventDate instanceof Date ? csvRow.eventDate.toISOString().split('T')[0] : String(csvRow.eventDate))
          : null,
        employmentEventDate: null,
        reconciliationStatus: 'new_csv_event',
        daysDifference: null,
        employmentEventId: null,
      });
    }
  }

  // H2 fix: Add unconfirmed events to detail array
  // These are employment events with no CSV match — they stayed UNCONFIRMED
  for (const evt of unconfirmedEvents) {
    const staffName = staffNameMap.get(evt.staffId) ?? 'Unknown';
    details.push({
      staffId: evt.staffId,
      staffName,
      eventType: evt.eventType,
      csvEventDate: null,
      employmentEventDate: evt.effectiveDate
        ? (evt.effectiveDate instanceof Date ? evt.effectiveDate.toISOString().split('T')[0] : String(evt.effectiveDate))
        : null,
      reconciliationStatus: 'unconfirmed_event',
      daysDifference: null,
      employmentEventId: evt.id,
    });
  }

  return { counts, details };
}

// ─── resolveDiscrepancy ──────────────────────────────────────────────

/**
 * Resolve a DATE_DISCREPANCY for an employment event (AC 8).
 * Only DEPT_ADMIN / SUPER_ADMIN may call this.
 */
export async function resolveDiscrepancy(
  eventId: string,
  newStatus: 'MATCHED' | 'UNCONFIRMED',
  reason: string,
  userId: string,
): Promise<{ id: string; reconciliationStatus: string }> {
  // Load the employment event
  const events = await db
    .select({
      id: employmentEvents.id,
      reconciliationStatus: employmentEvents.reconciliationStatus,
    })
    .from(employmentEvents)
    .where(eq(employmentEvents.id, eventId))
    .limit(1);

  if (events.length === 0) {
    throw new AppError(404, 'EMPLOYMENT_EVENT_NOT_FOUND', 'Employment event not found');
  }

  const event = events[0];

  // Guard: only DATE_DISCREPANCY can be resolved
  if (event.reconciliationStatus !== 'DATE_DISCREPANCY') {
    throw new AppError(
      422,
      'INVALID_RECONCILIATION_STATUS',
      'Only events with DATE_DISCREPANCY status can be resolved',
    );
  }

  // Update status
  await db
    .update(employmentEvents)
    .set({
      reconciliationStatus: newStatus,
      updatedAt: new Date(),
    })
    .where(eq(employmentEvents.id, eventId));

  // Audit log is handled by the auditLog middleware — the resolution details
  // (previous status, new status, reason) are captured in the request body
  logger.info(
    { eventId, previousStatus: 'DATE_DISCREPANCY', newStatus, reason, userId },
    'Reconciliation discrepancy resolved',
  );

  return { id: eventId, reconciliationStatus: newStatus };
}
