export type EventFlagType =
  | 'NONE'
  | 'RETIREMENT'
  | 'DEATH'
  | 'SUSPENSION'
  | 'TRANSFER_OUT'
  | 'TRANSFER_IN'
  | 'LEAVE_WITHOUT_PAY'
  | 'REINSTATEMENT'
  | 'TERMINATION';

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
  referenceNumber: string;
  recordCount: number;
  submissionDate: string;
  status: SubmissionRecordStatus;
}

export interface SubmissionDetail {
  id: string;
  mdaId: string;
  period: string;
  referenceNumber: string;
  status: SubmissionRecordStatus;
  recordCount: number;
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
