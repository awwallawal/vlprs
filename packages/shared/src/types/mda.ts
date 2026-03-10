import type { SubmissionRecord } from './submission.js';

export type SubmissionStatus = 'submitted' | 'pending' | 'overdue';
export type MigrationStage = 'pending' | 'received' | 'imported' | 'validated' | 'reconciled' | 'certified';

export interface Mda {
  id: string;
  code: string;
  name: string;
  abbreviation: string;
  parentMdaId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface MdaListItem {
  id: string;
  code: string;
  name: string;
  abbreviation: string;
  isActive: boolean;
  parentMdaId: string | null;
  parentMdaCode: string | null;
}

export interface MdaAlias {
  id: string;
  mdaId: string;
  alias: string;
  createdAt: string;
}

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
  recordCounts: { clean: number; minor: number; significant: number; structural: number; anomalous: number };
  lastActivity: string | null;
  baselineCompletion?: { done: number; total: number };
  observationCount?: number;
}

export interface MigrationDashboardMetrics {
  totalStaffMigrated: number;
  totalExposure: string;
  mdasComplete: number;
  baselinesEstablished: number;
  pendingDuplicates: number;
}

export interface BeneficiaryListItem {
  staffName: string;
  staffId: string;
  primaryMdaCode: string;
  primaryMdaName: string;
  primaryMdaId: string;
  loanCount: number;
  totalExposure: string;
  observationCount: number;
  isMultiMda: boolean;
  lastActivityDate: string | null;
}

export interface BeneficiaryListMetrics {
  totalStaff: number;
  totalLoans: number;
  totalObservationsUnreviewed: number;
  totalExposure: string;
}

export interface PaginatedBeneficiaries {
  data: BeneficiaryListItem[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
  metrics: BeneficiaryListMetrics;
}
