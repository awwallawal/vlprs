import type { AttentionItem } from './dashboard.js';

// ─── PDF Report Types (Story 6.4, FR53/FR54) ───────────────────

export type PdfReportType = 'executive-summary' | 'mda-compliance' | 'variance' | 'loan-snapshot' | 'weekly-ag';

export interface PdfReportMeta {
  referenceNumber: string;
  generatedAt: string;
  generatedBy: string;
  reportTitle: string;
  reportSubtitle: string;
}

export interface ShareReportRequest {
  reportType: PdfReportType;
  recipientEmail: string;
  coverMessage?: string;
  reportParams: Record<string, string>;
}

// ─── Service Status Verification ────────────────────────────────

export interface ServiceStatusVerificationRow {
  loanId: string;
  staffName: string;
  staffId: string | null;
  mdaName: string;
  mdaId: string;
  loanReference: string;
  computedRetirementDate: string;
  monthsPastRetirement: number;
  outstandingBalance: string;
  hasExpiredExtension: boolean;
  expiredExtensionReference: string | null;
  availableActions: string[];
}

export interface ServiceStatusVerificationSummary {
  totalFlagged: number;
  totalOutstandingExposure: string;
  totalWithExpiredExtensions: number;
  totalWithoutExtensions: number;
  mdaBreakdown: Array<{ mdaName: string; mdaId: string; count: number; outstandingExposure: string }>;
  message: string | null;
}

export interface ServiceStatusVerificationReport {
  data: ServiceStatusVerificationRow[];
  summary: ServiceStatusVerificationSummary;
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
}

// ─── Executive Summary Report (Story 6.1, FR37) ──────────────────

export interface SchemeOverview {
  activeLoans: number;
  totalExposure: string;
  fundAvailable: string | null;
  monthlyRecoveryRate: string;
  recoveryPeriod: string;
}

export interface PortfolioStatusRow {
  classification: string; // Non-punitive label
  count: number;
  percentage: number;
}

export interface MdaScorecardRow {
  mdaId: string;
  mdaName: string;
  mdaCode: string;
  healthScore: number;
  healthBand: 'healthy' | 'attention' | 'for-review';
  totalOutstanding: string;
  observationCount: number;
}

export interface ReceivablesRankingRow {
  mdaId: string;
  mdaName: string;
  mdaCode: string;
  totalOutstanding: string;
  activeLoans: number;
}

export type RecoveryTierKey = 'QUICK' | 'INTERVENTION' | 'EXTENDED';

export interface RecoveryTier {
  tierKey: RecoveryTierKey; // Stable identifier — use this for routing/lookups, not tierName
  tierName: string;          // Human-readable label, e.g. "Quick Recovery". Display only.
  loanCount: number;
  totalAmount: string;
  monthlyProjection: string;
}

export interface SubmissionCoverageSummary {
  activeMdas: number;
  spottyMdas: number;
  darkMdas: number;
  totalMdas: number;
}

export interface OnboardingPipelineSummary {
  approvedNotCollectingCount: number;
  revenueAtRisk: string;
}

export interface ExceptionSummary {
  openCount: number;
  resolvedCount: number;
  totalCount: number;
}

export interface TopVarianceRow {
  staffName: string;
  mdaName: string;
  declaredAmount: string;
  computedAmount: string;
  difference: string;
}

export interface TrendMetric {
  current: number;
  previous: number | null;
  changePercent: number | null;
}

export interface MonthOverMonthTrend {
  activeLoans: TrendMetric;
  totalExposure: TrendMetric;
  monthlyRecovery: TrendMetric;
  completionRate: TrendMetric;
}

export interface ExecutiveSummaryReportData {
  schemeOverview: SchemeOverview;
  portfolioStatus: PortfolioStatusRow[];
  mdaScorecard: { topHealthy: MdaScorecardRow[]; bottomForReview: MdaScorecardRow[] };
  receivablesRanking: ReceivablesRankingRow[];
  recoveryPotential: RecoveryTier[];
  submissionCoverage: SubmissionCoverageSummary;
  onboardingPipeline: OnboardingPipelineSummary;
  exceptionSummary: ExceptionSummary;
  topVariances: TopVarianceRow[];
  monthOverMonthTrend: MonthOverMonthTrend;
  generatedAt: string;
}

// ─── MDA Compliance Report (Story 6.1, FR38) ────────────────────

export interface MdaComplianceReportRow {
  mdaId: string;
  mdaName: string;
  mdaCode: string;
  submissionStatus: string;
  lastSubmissionDate: string | null;
  recordCount: number;
  compliancePercent: number;
  healthScore: number;
  healthBand: 'healthy' | 'attention' | 'for-review';
  coveragePercent: number | null;
  totalOutstanding: string;
  unresolvedObservationCount: number;
}

export interface MdaComplianceReportSummary {
  totalMdas: number;
  averageHealthScore: number;
  totalOutstanding: string;
  totalObservations: number;
}

export interface MdaComplianceReportData {
  rows: MdaComplianceReportRow[];
  summary: MdaComplianceReportSummary;
  periodYear: number;
  periodMonth: number;
  generatedAt: string;
}

// ─── Variance Report (Story 6.2, FR39) ─────────────────────────

export type ReportVarianceCategory = 'aligned' | 'minor_variance' | 'variance';

export interface VarianceReportRow {
  staffId: string;
  staffName: string;
  declaredAmount: string;
  computedAmount: string;
  difference: string;
  category: ReportVarianceCategory;
  explanation: string;
}

export interface OverdueRegisterRow {
  staffName: string;
  staffId: string;
  loanId: string;
  monthsPastExpected: number;
  outstandingBalance: string;
  severityTier: 'Mild' | 'Moderate' | 'Elevated';
}

export interface StalledRegisterRow {
  staffName: string;
  staffId: string;
  loanId: string;
  consecutiveUnchangedMonths: number;
  frozenAmount: string;
}

export interface OverDeductedRegisterRow {
  staffName: string;
  staffId: string;
  loanId: string;
  negativeAmount: string;
  estimatedOverMonths: number;
}

export interface VarianceReportData {
  summary: {
    alignedCount: number;
    minorVarianceCount: number;
    varianceCount: number;
    totalRecords: number;
  };
  rows: VarianceReportRow[];
  overdueRegister: OverdueRegisterRow[];
  stalledRegister: StalledRegisterRow[];
  overDeductedRegister: OverDeductedRegisterRow[];
  generatedAt: string;
}

// ─── Loan Snapshot Report (Story 6.2, FR40) ────────────────────

export interface LoanSnapshotRow {
  staffId: string;
  staffName: string;
  gradeLevel: string;
  principalAmount: string;
  interestRate: string;
  tenureMonths: number;
  moratoriumMonths: number;
  monthlyDeductionAmount: string;
  installmentsPaid: number;
  outstandingBalance: string;
  status: string;
  lastDeductionDate: string | null;
  nextDeductionDate: string | null;
  approvalDate: string;
  loanReference: string;
  mdaCode: string;
}

export interface LoanSnapshotReportData {
  data: LoanSnapshotRow[];
  summary: {
    totalLoans: number;
    totalOutstanding: string;
    totalMonthlyDeduction: string;
    averageInterestRate: string;
  };
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

// ─── Weekly AG Report (Story 6.3, FR41) ───────────────────────

export interface WeeklyExecutiveSummary {
  activeLoans: number;
  totalExposure: string;
  fundAvailable: string | null;
  monthlyRecoveryRate: string;
}

export interface WeeklySubmissionRow {
  mdaName: string;
  mdaCode: string;
  submissionDate: string;
  recordCount: number;
  status: string;
}

export interface WeeklyComplianceStatus {
  submissionsThisWeek: WeeklySubmissionRow[];
  totalSubmissions: number;
}

export interface WeeklyResolvedException {
  staffName: string;
  type: string;
  resolutionNote: string | null;
  resolvedAt: string;
  mdaName: string;
}

export interface QuickRecoveryRow {
  staffName: string;
  staffId: string;
  mdaName: string;
  outstandingBalance: string;
  estimatedRemainingInstallments: number;
}

export interface ObservationActivitySummary {
  newCount: number;
  reviewedCount: number;
  resolvedCount: number;
}

export interface PortfolioSnapshotRow {
  classification: string;
  count: number;
  percentage: number;
}

export interface WeeklyAgReportData {
  generatedAt: string;
  periodStart: string;
  periodEnd: string;
  executiveSummary: WeeklyExecutiveSummary;
  complianceStatus: WeeklyComplianceStatus;
  exceptionsResolved: WeeklyResolvedException[];
  outstandingAttentionItems: AttentionItem[];
  quickRecoveryOpportunities: QuickRecoveryRow[];
  observationActivity: ObservationActivitySummary;
  portfolioSnapshot: PortfolioSnapshotRow[];
}
