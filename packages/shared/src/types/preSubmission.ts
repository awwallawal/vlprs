/**
 * Pre-Submission Checkpoint types (Story 11.1).
 * Three-section checkpoint screen shown before MDA monthly submission.
 */

/** Staff approaching retirement within 12 months */
export interface RetirementItem {
  staffName: string;
  staffId: string;
  retirementDate: string; // ISO 8601 date
  daysUntilRetirement: number;
}

/** Staff with zero deduction last month and no employment event filed */
export interface ZeroDeductionItem {
  staffName: string;
  staffId: string;
  lastDeductionDate: string; // ISO 8601 date or 'N/A'
  daysSinceLastDeduction: number | null;
}

/** Mid-cycle employment event pending CSV confirmation */
export interface PendingEventItem {
  eventType: string;
  staffName: string;
  effectiveDate: string; // ISO 8601 date
  reconciliationStatus: string;
}

/** Complete checkpoint response from GET /api/pre-submission/:mdaId */
export interface PreSubmissionCheckpoint {
  approachingRetirement: RetirementItem[];
  zeroDeduction: ZeroDeductionItem[];
  pendingEvents: PendingEventItem[];
  lastSubmissionDate: string | null; // ISO 8601 date or null if never submitted
  submissionPeriod: string; // YYYY-MM
}
