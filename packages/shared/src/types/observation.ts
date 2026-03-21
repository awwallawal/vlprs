export type ObservationType =
  | 'rate_variance'
  | 'stalled_balance'
  | 'negative_balance'
  | 'multi_mda'
  | 'no_approval_match'
  | 'consecutive_loan'
  | 'period_overlap'
  | 'grade_tier_mismatch';

export type ObservationStatus = 'unreviewed' | 'reviewed' | 'resolved' | 'promoted';

export interface ObservationContext {
  possibleExplanations: string[];
  suggestedAction: string;
  dataCompleteness: number;
  dataPoints: Record<string, unknown>;
}

export interface SourceReference {
  file: string;
  sheet: string;
  row: number;
}

export interface Observation {
  id: string;
  type: ObservationType;
  staffName: string;
  staffId: string | null;
  loanId: string | null;
  mdaId: string;
  mdaName?: string;
  migrationRecordId: string | null;
  uploadId: string | null;
  description: string;
  context: ObservationContext;
  sourceReference: SourceReference | null;
  status: ObservationStatus;
  reviewerId: string | null;
  reviewerNote: string | null;
  reviewedAt: string | null;
  resolutionNote: string | null;
  resolvedAt: string | null;
  promotedExceptionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ObservationListItem {
  id: string;
  type: ObservationType;
  staffName: string;
  staffId: string | null;
  mdaId: string;
  mdaName: string;
  description: string;
  context: ObservationContext;
  sourceReference: SourceReference | null;
  status: ObservationStatus;
  reviewerNote: string | null;
  reviewedAt: string | null;
  resolutionNote: string | null;
  resolvedAt: string | null;
  promotedExceptionId: string | null;
  createdAt: string;
}

export interface ObservationCounts {
  total: number;
  byType: Record<ObservationType, number>;
  byStatus: Record<ObservationStatus, number>;
}

export interface PaginatedObservations {
  data: ObservationListItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  counts: ObservationCounts;
}

export interface ExceptionRecord {
  id: string;
  observationId: string;
  staffName: string;
  staffId: string | null;
  mdaId: string;
  category: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  status: 'open' | 'resolved';
  promotedBy: string;
  createdAt: string;
}
