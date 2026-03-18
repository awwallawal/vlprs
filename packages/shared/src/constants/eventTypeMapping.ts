import type { EmploymentEventType } from '../types/employmentEvent.js';
import type { EventFlagType } from '../types/submission.js';

/**
 * Maps CSV event flags (eventFlagTypeEnum) to mid-cycle employment event types (employmentEventTypeEnum).
 *
 * - NONE -> null (skip, no reconciliation needed)
 * - LEAVE_WITHOUT_PAY -> [LWOP_START, LWOP_END] (try first, fallback to second)
 * - All others are 1:1 mappings
 *
 * Complete mapping: 11 real event types + NONE = 12 entries, zero skips.
 */
export const EVENT_FLAG_TO_EMPLOYMENT_EVENT_MAP: Record<
  EventFlagType,
  EmploymentEventType | EmploymentEventType[] | null
> = {
  NONE: null,
  RETIREMENT: 'RETIRED',
  DEATH: 'DECEASED',
  SUSPENSION: 'SUSPENDED',
  ABSCONDED: 'ABSCONDED',
  TRANSFER_OUT: 'TRANSFERRED_OUT',
  TRANSFER_IN: 'TRANSFERRED_IN',
  LEAVE_WITHOUT_PAY: ['LWOP_START', 'LWOP_END'],
  REINSTATEMENT: 'REINSTATED',
  DISMISSAL: 'DISMISSED',
  SERVICE_EXTENSION: 'SERVICE_EXTENSION',
};
