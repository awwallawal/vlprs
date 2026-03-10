export type { MigrationStage, MigrationMdaStatus } from './mda.js';

export type MigrationUploadStatus = 'uploaded' | 'mapped' | 'processing' | 'completed' | 'validated' | 'reconciled' | 'failed';

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
  | 'dateOfBirth' | 'dateOfFirstAppointment';

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

export interface MigrationUploadPreview {
  uploadId: string;
  filename: string;
  sheets: SheetPreview[];
  detectedMda: string | null;
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
}

export interface MigrationUploadDetail extends MigrationUpload {
  mdaName: string;
  recordsPerSheet: Array<{ sheetName: string; count: number; era: number }>;
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
}

export interface ValidationResultRecord {
  recordId: string;
  staffName: string;
  varianceCategory: VarianceCategory;
  varianceAmount: string | null;
  computedRate: string | null;
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
}

export interface ValidationResult {
  summary: ValidationSummary;
  records: ValidationResultRecord[];
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

// ─── Baseline Acknowledgment (Story 3.4) ────────────────────────────

export interface BaselineResult {
  loanId: string;
  loanReference: string;
  ledgerEntryId: string;
  varianceCategory: VarianceCategory | null;
  baselineAmount: string;
}

export interface BatchBaselineResult {
  totalProcessed: number;
  loansCreated: number;
  entriesCreated: number;
  byCategory: Record<string, number>;
  processingTimeMs: number;
}

export interface BaselineSummary {
  uploadId: string;
  totalRecords: number;
  baselinesCreated: number;
  baselinesRemaining: number;
  byCategory: Record<string, number>;
  status: 'pending' | 'partial' | 'complete';
}
