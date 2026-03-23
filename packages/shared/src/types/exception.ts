export type ExceptionPriority = 'high' | 'medium' | 'low';

// Category is free-form text in DB — auto-promoted exceptions use categories like
// 'ghost_deduction', 'unreported_deduction', 'amount_mismatch', 'staff_not_in_payroll'.
// Manual flags use presets or free text. Don't narrow this to a union.
export type ExceptionCategory = string;

// Preset categories for the UI dropdown (manual flagging)
export const EXCEPTION_CATEGORY_PRESETS = [
  'over_deduction',
  'under_deduction',
  'inactive',
  'data_mismatch',
  'post_retirement',
  'duplicate_staff_id',
] as const;

export type ExceptionActionTaken =
  | 'verified_correct'
  | 'adjusted_record'
  | 'referred_to_mda'
  | 'no_action_required';

export interface ExceptionItem {
  id: string;
  priority: ExceptionPriority;
  category: ExceptionCategory;
  staffId: string | null;
  staffName: string;
  mdaName: string;
  description: string;
  createdAt: string;
  status: 'open' | 'resolved';
  resolvedAt: string | null;
}

export interface ExceptionListItem extends ExceptionItem {
  mdaId: string;
  loanId: string | null;
  observationId: string;
  flagNotes: string | null;
}

export interface ExceptionDetail {
  id: string;
  priority: ExceptionPriority;
  category: ExceptionCategory;
  description: string;
  status: 'open' | 'resolved';
  flagNotes: string | null;
  promotedBy: string;
  promotedByName: string;
  createdAt: string;
  // Resolution fields
  resolvedBy: string | null;
  resolvedByName: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  actionTaken: ExceptionActionTaken | null;
  // Linked loan
  loanId: string | null;
  loan: {
    id: string;
    staffName: string;
    staffId: string | null;
    mdaName: string;
    loanReference: string | null;
    principal: string;
    outstandingBalance: string;
    status: string;
  } | null;
  // Linked observation
  observationId: string;
  observation: {
    id: string;
    type: string;
    description: string;
    status: string;
    context: Record<string, unknown>;
    createdAt: string;
  };
  // Staff & MDA
  staffName: string;
  staffId: string | null;
  mdaId: string;
  mdaName: string;
  // Audit trail
  auditTrail: Array<{
    action: string;
    userId: string;
    userName: string;
    timestamp: string;
    details: string | null;
  }>;
}

export interface FlagExceptionRequest {
  loanId: string;
  priority: ExceptionPriority;
  category: string;
  notes: string;
}

export interface ResolveExceptionRequest {
  resolutionNote: string;
  actionTaken: ExceptionActionTaken;
}

export interface ExceptionCounts {
  high: number;
  medium: number;
  low: number;
  total: number;
}
