export type { MigrationStage, MigrationMdaStatus } from './mda.js';

export type MigrationUploadStatus = 'uploaded' | 'mapped' | 'processing' | 'completed' | 'pending_verification' | 'validated' | 'reconciled' | 'failed' | 'rejected';

export type VarianceCategory = 'clean' | 'minor_variance' | 'significant_variance' | 'structural_error' | 'anomalous';

export interface ValidationSummary {
  clean: number;
  minorVariance: number;
  significantVariance: number;
  structuralError: number;
  anomalous: number;
  rateVarianceCount: number;
}

export interface MdaBoundary {
  startRow: number;
  endRow: number;
  detectedMda: string;
  recordCount: number;
  confidence: 'high' | 'medium' | 'low' | 'detected' | 'ambiguous' | 'confirmed';
}

export type CanonicalField =
  | 'serialNumber' | 'staffName' | 'mda'
  | 'principal' | 'interestTotal' | 'totalLoan'
  | 'installmentCount' | 'monthlyDeduction' | 'monthlyInterest'
  | 'monthlyPrincipal' | 'totalInterestPaid' | 'totalOutstandingInterest'
  | 'installmentsPaid' | 'installmentsOutstanding'
  | 'totalLoanPaid' | 'outstandingBalance'
  | 'remarks' | 'startDate' | 'endDate'
  | 'employeeNo' | 'refId' | 'commencementDate' | 'station'
  | 'dateOfBirth' | 'dateOfFirstAppointment'
  | 'gradeLevel';

export interface ColumnMappingSuggestion {
  sourceIndex: number;
  sourceHeader: string;
  suggestedField: CanonicalField | null;
  confidence: 'high' | 'medium' | 'low';
}

export interface SheetPreview {
  sheetName: string;
  headerRow: string[];
  columnMappings: ColumnMappingSuggestion[];
  era: number;
  period: { year: number; month: number } | null;
  dataRowCount: number;
  unmappedColumns: Array<{ index: number; name: string }>;
}

export interface SkippedSheet {
  name: string;
  reason: string;
}

export interface MigrationUploadPreview {
  uploadId: string;
  filename: string;
  sheets: SheetPreview[];
  detectedMda: string | null;
  skippedSheets: SkippedSheet[];
}

export interface MigrationUpload {
  id: string;
  mdaId: string;
  uploadedBy: string;
  filename: string;
  fileSizeBytes: number;
  sheetCount: number;
  totalRecords: number;
  status: MigrationUploadStatus;
  eraDetected: number | null;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
  // Supersession fields (Story 7.0g)
  supersededBy: string | null;
  supersededAt: string | null;
  supersededReason: string | null;
}

// ─── Supersession Types (Story 7.0g) ────────────────────────────────

export type MigrationRecordStatus = 'active' | 'superseded';

export interface SupersedeRequest {
  replacementUploadId: string;
  reason: string;
}

export interface SupersedeResponse {
  supersededUploadId: string;
  replacementUploadId: string;
  recordsSuperseded: number;
  baselinesAnnotated: number;
  observationsRegenerated: boolean;
}

// ─── Supersede Comparison (Story 15.0n) ────────────────────────────

export interface FieldChange {
  field: string;
  oldValue: string | null;
  newValue: string | null;
}

export interface ModifiedRecordDiff {
  staffName: string;
  staffId: string | null;
  changes: FieldChange[];
}

export interface SupersedeComparisonResult {
  unchanged: number;
  modified: number;
  newRecords: number;
  removed: number;
  modifiedDetails: ModifiedRecordDiff[];
  newDetails: Array<{ staffName: string; staffId: string | null }>;
  removedDetails: Array<{ staffName: string; staffId: string | null }>;
}

// ─── Multi-Sheet Overlap (Story 8.0d) ──────────────────────────────

export interface SheetOverlapResult {
  sheetNames: string[];        // sheets sharing this period
  periodYear: number;
  periodMonth: number;
  periodLabel: string;         // e.g., "August 2024"
  overlap: boolean;
  existingUploadId?: string;
  existingFilename?: string;
  existingRecordCount?: number;
}

export interface MultiSheetOverlapResponse {
  hasOverlap: boolean;                   // true if ANY sheet overlaps
  results: SheetOverlapResult[];         // one per unique period
  skippedSheets: Array<{ sheetName: string; reason: string }>;
}

export interface MigrationRecord {
  id: string;
  uploadId: string;
  mdaId: string;
  sheetName: string;
  rowNumber: number;
  era: number;
  periodYear: number | null;
  periodMonth: number | null;
  serialNumber: string | null;
  staffName: string;
  mdaText: string | null;
  principal: string | null;
  interestTotal: string | null;
  totalLoan: string | null;
  monthlyDeduction: string | null;
  monthlyInterest: string | null;
  monthlyPrincipal: string | null;
  totalInterestPaid: string | null;
  totalOutstandingInterest: string | null;
  totalLoanPaid: string | null;
  outstandingBalance: string | null;
  installmentCount: number | null;
  installmentsPaid: number | null;
  installmentsOutstanding: number | null;
  employeeNo: string | null;
  refId: string | null;
  commencementDate: string | null;
  startDate: string | null;
  endDate: string | null;
  station: string | null;
  remarks: string | null;
  dateOfBirth: string | null;
  dateOfFirstAppointment: string | null;
  sourceFile: string;
  sourceSheet: string;
  sourceRow: number;
  createdAt: string;
}

export interface MigrationExtraField {
  id: string;
  recordId: string;
  fieldName: string;
  fieldValue: string | null;
  sourceHeader: string;
  createdAt: string;
}

export interface MigrationUploadSummary {
  id: string;
  mdaId: string;
  mdaName: string;
  filename: string;
  sheetCount: number;
  totalRecords: number;
  status: MigrationUploadStatus;
  eraDetected: number | null;
  createdAt: string;
  // Supersession fields (Story 7.0g)
  supersededBy: string | null;
  supersededAt: string | null;
  supersededByFilename: string | null;
  // Federated upload fields (Story 15.0f)
  uploadSource: 'admin' | 'mda_officer';
  metadata: Record<string, unknown> | null;
}

export interface MigrationUploadDetail extends MigrationUpload {
  mdaName: string;
  recordsPerSheet: Array<{ sheetName: string; count: number; era: number; periodYear: number | null; periodMonth: number | null }>;
  skippedRows: Array<{ row: number; reason: string }>;
}

export interface ConfirmedColumnMapping {
  sheetName: string;
  mappings: Array<{
    sourceIndex: number;
    canonicalField: CanonicalField | null;
  }>;
}

export interface ValidatedMigrationRecord extends MigrationRecord {
  varianceCategory: VarianceCategory | null;
  varianceAmount: string | null;
  computedRate: string | null;
  hasRateVariance: boolean;
  computedTotalLoan: string | null;
  computedMonthlyDeduction: string | null;
  computedOutstandingBalance: string | null;
  schemeExpectedTotalLoan: string | null;
  schemeExpectedMonthlyDeduction: string | null;
  schemeExpectedTotalInterest: string | null;
}

// Scheme Expected values computed using authoritative formula (P × 13.33% ÷ 60)
export interface SchemeExpectedValues {
  totalLoan: string | null;
  monthlyDeduction: string | null;
  totalInterest: string | null;
}

export interface ValidationResultRecord {
  recordId: string;
  staffName: string;
  varianceCategory: VarianceCategory;
  varianceAmount: string | null;
  computedRate: string | null;
  apparentRate: string | null;
  declaredValues: {
    principal: string | null;
    totalLoan: string | null;
    monthlyDeduction: string | null;
    outstandingBalance: string | null;
  };
  computedValues: {
    totalLoan: string | null;
    monthlyDeduction: string | null;
    outstandingBalance: string | null;
  };
  schemeExpectedValues: SchemeExpectedValues;
}

export interface ValidationResult {
  summary: ValidationSummary;
  records: ValidationResultRecord[];
  /**
   * Multi-MDA state for this upload. The `hasMultiMda` and `boundaries` fields
   * are computed from `delineationResult` (JSONB) at query time for backward
   * compatibility — the legacy `has_multi_mda` and `multi_mda_boundaries` DB
   * columns were dropped in migration 0024 (Story 7.0b).
   */
  multiMda: {
    hasMultiMda: boolean;
    boundaries: MdaBoundary[];
  };
}

// ─── Person Matching (Story 3.3) ────────────────────────────────────

export type MatchType = 'exact_name' | 'staff_id' | 'surname_initial' | 'fuzzy_name' | 'manual';
export type MatchStatus = 'auto_confirmed' | 'pending_review' | 'confirmed' | 'rejected';

export interface PersonMatch {
  id: string;
  personAName: string;
  personAStaffId: string | null;
  personAMdaId: string;
  personBName: string;
  personBStaffId: string | null;
  personBMdaId: string;
  matchType: MatchType;
  confidence: string;
  status: MatchStatus;
  confirmedBy: string | null;
  confirmedAt: string | null;
  createdAt: string;
}

export interface PersonListItem {
  personKey: string;
  staffName: string;
  staffId: string | null;
  mdas: string[];
  recordCount: number;
  varianceCount: number;
  hasRateVariance: boolean;
  profileComplete: boolean;
}

export interface PersonTimelineEntry {
  year: number;
  month: number;
  outstandingBalance: string | null;
  monthlyDeduction: string | null;
  principal: string | null;
  totalLoan: string | null;
  sourceFile: string;
}

export interface PersonTimeline {
  name: string;
  mdaCode: string;
  months: PersonTimelineEntry[];
  firstSeen: { year: number; month: number };
  lastSeen: { year: number; month: number };
  totalMonthsPresent: number;
  gapMonths: number;
}

export interface LoanCycle {
  mdaCode: string;
  startPeriod: { year: number; month: number };
  endPeriod: { year: number; month: number };
  principal: string | null;
  rate: string | null;
  monthsPresent: number;
  gapMonths: number;
  status: 'active' | 'completed' | 'beyond_tenure';
}

export interface PersonProfile {
  staffName: string;
  staffId: string | null;
  mdas: string[];
  recordCount: number;
  varianceCount: number;
  hasRateVariance: boolean;
  profileComplete: boolean;
  recordsByMda: Record<string, ValidatedMigrationRecord[]>;
  timelines: PersonTimeline[];
  cycles: LoanCycle[];
  matches: (PersonMatch & { personAMdaCode: string; personBMdaCode: string })[];
}

// ─── File Delineation (Story 3.8) ────────────────────────────────────

export type DelineationConfidence = 'detected' | 'ambiguous' | 'confirmed';

export interface DelineationBoundaryRecord {
  sourceRow: number;
  staffName: string;
  mdaText: string | null;
  position: 'start' | 'end';
}

export interface DelineationSection {
  sectionIndex: number;
  sheetName?: string;
  mdaId: string | null;
  mdaCode: string | null;
  mdaName: string;
  resolvedMdaName: string | null;
  startRow: number;
  endRow: number;
  recordCount: number;
  confidence: DelineationConfidence;
  boundaryRecords?: DelineationBoundaryRecord[];
}

export interface DelineationResult {
  uploadId: string;
  targetMdaId: string;
  targetMdaName: string;
  delineated: boolean;
  sections: DelineationSection[];
  totalRecords: number;
}

export type DuplicateResolution = 'confirmed_multi_mda' | 'reassigned' | 'flagged';
export type DuplicateMatchType = 'exact_name' | 'surname_initial' | 'fuzzy_name' | 'staff_id';

export interface DuplicateCandidate {
  id: string;
  parentMdaId: string;
  parentMdaName: string;
  childMdaId: string;
  childMdaName: string;
  staffName: string;
  staffId: string | null;
  parentRecordCount: number;
  childRecordCount: number;
  matchConfidence: string;
  matchType: DuplicateMatchType;
  status: DuplicateResolution | 'pending';
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  createdAt: string;
}

// ─── Duplicate Record Detail (Story 15.0l) ─────────────────────────

export interface DuplicateRecord {
  id: string;
  staffName: string;
  staffId: string | null;
  gradeLevel: string | null;
  principalAmount: string | null;
  totalLoan: string | null;
  monthlyDeduction: string | null;
  outstandingBalance: string | null;
  periodMonth: number | null;
  periodYear: number | null;
  varianceCategory: string | null;
}

export interface DuplicateRecordDetail {
  candidate: DuplicateCandidate;
  parentRecords: DuplicateRecord[];
  childRecords: DuplicateRecord[];
}

// ─── Record Detail (Story 8.0b) ─────────────────────────────────────

export interface MigrationRecordDetail {
  recordId: string;
  uploadId: string;
  // Personnel info
  staffName: string;
  staffId: string | null;
  gradeLevel: string | null;
  station: string | null;
  mdaText: string | null;
  serialNumber: string | null;
  // Source info
  sheetName: string;
  sourceRow: number;
  era: number;
  periodYear: number | null;
  periodMonth: number | null;
  // Variance metadata
  varianceCategory: VarianceCategory;
  varianceAmount: string | null;
  computedRate: string | null;
  apparentRate: string | null;
  hasRateVariance: boolean;
  // Three-vector financial comparison
  declaredValues: {
    principal: string | null;
    totalLoan: string | null;
    monthlyDeduction: string | null;
    outstandingBalance: string | null;
    interestTotal: string | null;
    installmentCount: number | null;
    installmentsPaid: number | null;
    installmentsOutstanding: number | null;
  };
  computedValues: {
    totalLoan: string | null;
    monthlyDeduction: string | null;
    outstandingBalance: string | null;
  };
  schemeExpectedValues: SchemeExpectedValues;
  // Grade inference from principal amount
  inferredGrade: {
    tier: number;
    gradeLevels: string;
    maxPrincipal: string;
  } | null;
  // Baseline status
  isBaselineCreated: boolean;
  loanId: string | null;
  // Correction fields (populated after correction columns are added)
  correctedValues: {
    outstandingBalance: string | null;
    totalLoan: string | null;
    monthlyDeduction: string | null;
    installmentCount: number | null;
    installmentsPaid: number | null;
    installmentsOutstanding: number | null;
  } | null;
  originalValuesSnapshot: Record<string, unknown> | null;
  correctedBy: string | null;
  correctedAt: string | null;
  // MDA Review fields (Story 8.0j)
  correctionReason: string | null;
  flaggedForReviewAt: string | null;
  reviewWindowDeadline: string | null;
}

// ─── Baseline Acknowledgment (Story 3.4) ────────────────────────────

export interface BaselineResult {
  loanId: string;
  loanReference: string;
  ledgerEntryId: string;
  varianceCategory: VarianceCategory | null;
  baselineAmount: string;
  correctionApplied: boolean;
}

export interface BatchBaselineResult {
  totalProcessed: number;
  loansCreated: number;
  entriesCreated: number;
  byCategory: Record<string, number>;
  skippedRecords: Array<{ recordId: string; staffName: string; reason: string }>;
  processingTimeMs: number;
  // Selective baseline breakdown (Story 8.0j)
  autoBaselined: { count: number; byCategory: Record<string, number> };
  flaggedForReview: { count: number; byCategory: Record<string, number> };
}

export interface BaselineSummary {
  uploadId: string;
  totalRecords: number;
  baselinesCreated: number;
  baselinesRemaining: number;
  byCategory: Record<string, number>;
  status: 'pending' | 'partial' | 'complete';
}

// ─── MDA Review Types (Story 8.0j) ─────────────────────────────────

export type CountdownStatus = 'normal' | 'warning' | 'overdue';

export interface FlaggedRecordSummary {
  recordId: string;
  staffName: string;
  staffId: string | null;
  gradeLevel: string | null;
  mdaName: string | null;
  varianceCategory: VarianceCategory | null;
  varianceAmount: string | null;
  flaggedAt: string;
  reviewWindowDeadline: string;
  daysRemaining: number;
  countdownStatus: CountdownStatus;
  correctedBy: string | null;
  correctedAt: string | null;
  correctionReason: string | null;
}

export interface MdaReviewProgress {
  mdaId: string;
  mdaName: string;
  totalFlagged: number;
  reviewed: number;
  pending: number;
  completionPct: number;
  daysRemaining: number;
  countdownStatus: CountdownStatus;
  windowDeadline: string;
}

export interface CorrectionWorksheetPreview {
  readyToApply: number;
  reviewedNoCorrection: number;
  skipped: number;
  alreadyBaselined: number;
  conflicts: number;
  records: Array<{
    recordId: string;
    staffName: string;
    category: 'ready' | 'reviewed' | 'skipped' | 'baselined' | 'conflict';
    corrections?: Record<string, string | number | null>;
    reason?: string;
    conflictDetail?: string;
  }>;
}
