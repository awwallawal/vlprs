export type { MigrationStage, MigrationMdaStatus } from './mda.js';

export type MigrationUploadStatus = 'uploaded' | 'mapped' | 'processing' | 'completed' | 'failed';

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
