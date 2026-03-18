// Historical Submission types (Story 11.4)

export type HistoricalMatchStatus = 'matched' | 'variance';

export interface FlagDiscrepancyRequest {
  staffId: string;
  reason: string;
}

export interface FlaggedRow {
  staffId: string;
  reason: string;
  flaggedBy: string;
  flaggedAt: string;
}

export interface HistoricalReconciliationDetail {
  staffId: string;
  staffName: string;
  declaredAmount: string;
  baselineAmount: string;
  variance: string;
  matchStatus: HistoricalMatchStatus;
  flagged: boolean;
  flagReason: string | null;
}

export interface HistoricalReconciliationSummary {
  matchedCount: number;
  varianceCount: number;
  largestVarianceAmount: string;
  matchRate: number;
  noBaseline: boolean;
  flaggedRows: FlaggedRow[];
  details: HistoricalReconciliationDetail[];
}

export interface HistoricalUploadResponse {
  id: string;
  referenceNumber: string;
  recordCount: number;
  matchedCount: number;
  varianceCount: number;
  largestVarianceAmount: string;
  matchRate: number;
  noBaseline: boolean;
}
