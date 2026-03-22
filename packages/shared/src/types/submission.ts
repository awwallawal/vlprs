export type EventFlagType =
  | 'NONE'
  | 'RETIREMENT'
  | 'DEATH'
  | 'SUSPENSION'
  | 'TRANSFER_OUT'
  | 'TRANSFER_IN'
  | 'LEAVE_WITHOUT_PAY'
  | 'REINSTATEMENT'
  | 'ABSCONDED'
  | 'SERVICE_EXTENSION'
  | 'DISMISSAL';

/**
 * Active event flag types — semantically excludes deprecated TERMINATION.
 * Use this type in all business logic signatures.
 *
 * NOTE: Currently equivalent to EventFlagType because the TypeScript union
 * intentionally omits TERMINATION (it only exists in the PostgreSQL enum for
 * backward compatibility — see schema.ts eventFlagTypeEnum). The Exclude<>
 * is retained as semantic documentation so that if EventFlagType is ever
 * derived from the DB enum, TERMINATION is automatically excluded here.
 */
export type ActiveEventFlagType = Exclude<EventFlagType, 'TERMINATION'>;

export type SubmissionRecordStatus = 'processing' | 'confirmed' | 'rejected';

export interface SubmissionRow {
  staffId: string;
  month: string;
  amountDeducted: string;
  payrollBatchReference: string;
  mdaCode: string;
  eventFlag: EventFlagType;
  eventDate: string | null;
  cessationReason: string | null;
}

export interface SubmissionRecord {
  id: string;
  referenceNumber: string;
  submissionDate: string;
  recordCount: number;
  alignedCount: number;
  varianceCount: number;
  status: SubmissionRecordStatus;
}

export interface SubmissionUploadResponse {
  id: string;
  referenceNumber: string;
  recordCount: number;
  submissionDate: string;
  status: SubmissionRecordStatus;
  alignedCount: number;
  varianceCount: number;
}

export interface SubmissionDetail {
  id: string;
  mdaId: string;
  mdaName: string;
  period: string;
  referenceNumber: string;
  status: SubmissionRecordStatus;
  recordCount: number;
  source: 'csv' | 'manual' | 'historical' | 'payroll';
  filename: string | null;
  fileSizeBytes: number | null;
  createdAt: string;
  rows: SubmissionRow[];
}

export interface SubmissionValidationError {
  row: number;
  field: string;
  message: string;
}

// Comparison types (Story 5.4)
export type ComparisonCategory = 'aligned' | 'minor_variance' | 'variance';

export interface ComparisonRow {
  staffId: string;
  declaredAmount: string;
  expectedAmount: string;
  difference: string;
  category: ComparisonCategory;
  explanation: string;
}

export interface ComparisonSummary {
  alignedCount: number;
  minorVarianceCount: number;
  varianceCount: number;
  totalRecords: number;
  rows: ComparisonRow[];
}

export interface SubmissionComparisonResponse {
  submissionId: string;
  referenceNumber: string;
  summary: ComparisonSummary;
}
