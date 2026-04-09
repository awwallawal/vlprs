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
  // Story 4.4: Analytics enrichment
  healthScore: number;
  healthBand: 'healthy' | 'attention' | 'for-review';
  submissionCoveragePercent: number | null;
  isDark: boolean;
  stalenessMonths: number | null;
}

export interface HeatmapCell {
  month: string;
  status: 'on-time' | 'grace-period' | 'missing' | 'current-pending';
}

export interface MdaHeatmapRow {
  mdaId: string;
  mdaName: string;
  mdaCode: string;
  complianceRate: number;
  cells: HeatmapCell[];
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
  healthScore?: number;
  healthBand?: import('../types/dashboard.js').HealthBand;
  statusDistribution?: import('../types/dashboard.js').StatusDistribution;
  expectedMonthlyDeduction?: string;
  actualMonthlyRecovery?: string;
  variancePercent?: number | null;
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

// ─── Coverage Tracker (Story 11.0b) ──────────────────────────────────

export interface CoveragePeriodData {
  recordCount: number;
  baselinedCount: number;
  uploadSource?: 'admin' | 'mda_officer' | 'mixed';
}

export interface CoverageMdaRow {
  mdaId: string;
  mdaName: string;
  mdaCode: string;
  periods: Record<string, CoveragePeriodData>; // key: 'YYYY-MM'
}

export interface CoverageMatrix {
  mdas: CoverageMdaRow[];
  periodRange: { start: string; end: string };
}

// ─── Coverage Drill-Down (Story 8.0f) ──────────────────────────────

export interface CoverageRecordItem {
  id: string;
  staffName: string;
  employeeNo: string | null;
  gradeLevel: string | null;
  principal: string | null;
  totalLoan: string | null;
  monthlyDeduction: string | null;
  outstandingBalance: string | null;
  varianceCategory: string | null;
  varianceAmount: string | null;
  isBaselineCreated: boolean;
  computedRate: string | null;
  sheetName: string;
}

export interface CoverageRecordsSummary {
  total: number;
  baselinedCount: number;
  mdaName: string;
  mdaCode: string;
  periodLabel: string;
}

export interface CoverageRecordsResponse {
  records: CoverageRecordItem[];
  pagination: { page: number; limit: number; totalPages: number; totalRecords: number };
  summary: CoverageRecordsSummary;
}

export type BeneficiaryLoanStatus = 'ACTIVE' | 'COMPLETED' | 'TRANSFERRED' | 'TRANSFER_PENDING' | 'INACTIVE';
export type CertificateStatus = 'issued' | 'pending' | null;

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
  // Lifecycle fields (Story 15.0k)
  loanStatus: BeneficiaryLoanStatus;
  completionDate: string | null;
  certificateStatus: CertificateStatus;
  transferredToMdaName: string | null;
  transferredOutDate: string | null;
  transferStatus: 'PENDING' | 'COMPLETED' | null;
  hasConsecutiveLoan: boolean;
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
