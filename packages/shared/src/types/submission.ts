export interface SubmissionRecord {
  id: string;
  referenceNumber: string;
  submissionDate: string;
  recordCount: number;
  alignedCount: number;
  varianceCount: number;
  status: 'confirmed' | 'processing' | 'rejected';
}
