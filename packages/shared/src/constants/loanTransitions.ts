import type { LoanStatus } from '../types/loan';

/**
 * Valid state transition map for loan lifecycle.
 * Pure constant — no DB access, no side effects.
 */
export const VALID_TRANSITIONS: Record<LoanStatus, LoanStatus[]> = {
  APPLIED: ['APPROVED'],
  APPROVED: ['ACTIVE'],
  ACTIVE: ['COMPLETED', 'TRANSFERRED', 'WRITTEN_OFF'],
  COMPLETED: [],
  TRANSFERRED: [],
  WRITTEN_OFF: [],
};

/** Terminal statuses — no outgoing transitions permitted. */
export const TERMINAL_STATUSES = new Set<LoanStatus>(['COMPLETED', 'TRANSFERRED', 'WRITTEN_OFF']);

/** Check whether a transition from one status to another is valid. */
export function isValidTransition(from: LoanStatus, to: LoanStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
