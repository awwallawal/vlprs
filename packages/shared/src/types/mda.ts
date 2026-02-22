import type { SubmissionRecord } from './submission.js';

export type SubmissionStatus = 'submitted' | 'pending' | 'overdue';
export type MigrationStage = 'pending' | 'received' | 'imported' | 'validated' | 'reconciled' | 'certified';

export interface MdaComplianceRow {
  mdaId: string;
  mdaCode: string;
  mdaName: string;
  status: SubmissionStatus;
  lastSubmission: string | null;
  recordCount: number;
  alignedCount: number;
  varianceCount: number;
}

export interface MdaSummary {
  mdaId: string;
  name: string;
  code: string;
  officerName: string;
  loanCount: number;
  totalExposure: string;
  monthlyRecovery: string;
  submissionHistory: SubmissionRecord[];
}

export interface MigrationMdaStatus {
  mdaId: string;
  mdaName: string;
  mdaCode: string;
  stage: MigrationStage;
  recordCounts: { clean: number; minor: number; significant: number; structural: number };
  lastActivity: string | null;
}
