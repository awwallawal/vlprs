import type { EmploymentEventType } from './employmentEvent.js';
import type { EventFlagType } from './submission.js';

/** Four reconciliation outcome categories (summary-level, distinct from reconciliationStatusEnum). */
export type ReconciliationOutcome =
  | 'matched'
  | 'date_discrepancy'
  | 'unconfirmed_event'
  | 'new_csv_event';

/** Per-event reconciliation detail returned in the summary response. */
export interface ReconciliationDetail {
  staffId: string;
  staffName: string;
  eventType: string;
  csvEventDate: string | null;
  employmentEventDate: string | null;
  reconciliationStatus: ReconciliationOutcome;
  daysDifference: number | null;
  employmentEventId: string | null;
}

/** Aggregate reconciliation counts stored as JSONB on mda_submissions. */
export interface ReconciliationCounts {
  matched: number;
  dateDiscrepancy: number;
  unconfirmed: number;
  newCsvEvent: number;
}

/** Full reconciliation summary returned by GET endpoint. */
export interface ReconciliationSummary {
  counts: ReconciliationCounts;
  details: ReconciliationDetail[];
}

/** Event type mapping: EventFlagType -> EmploymentEventType(s) or null for NONE. */
export type EventTypeMapping = Record<
  EventFlagType,
  EmploymentEventType | EmploymentEventType[] | null
>;

/** Request body for resolving a DATE_DISCREPANCY. */
export interface ResolveDiscrepancyRequest {
  status: 'MATCHED' | 'UNCONFIRMED';
  reason: string;
}
