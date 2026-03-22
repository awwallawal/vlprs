/**
 * Payroll Extract Upload types (Story 7.0h).
 * AG uploads consolidated monthly payroll deduction extracts
 * that are automatically split by MDA.
 */

/** Per-MDA breakdown within a payroll delineation summary. */
export interface PayrollMdaBreakdown {
  mdaCode: string;
  mdaName: string;
  recordCount: number;
  totalDeduction: string; // Decimal-formatted ₦ amount
}

/** Returned by POST /api/payroll/upload (preview step). */
export interface PayrollDelineationSummary {
  period: string;
  totalRecords: number;
  mdaBreakdown: PayrollMdaBreakdown[];
  unmatchedCodes: string[];
}

/** Returned by POST /api/payroll/confirm (persist step). */
export interface PayrollUploadResponse {
  referenceNumbers: string[];
  totalRecords: number;
  mdaCount: number;
  period: string;
}

/** Request body for POST /api/payroll/confirm. */
export interface PayrollConfirmRequest {
  period: string;
}

/** Payroll upload list item for GET /api/payroll. */
export interface PayrollUploadListItem {
  id: string;
  period: string;
  totalRecords: number;
  mdaCount: number;
  referenceNumbers: string[];
  createdAt: string;
}

/** Payroll upload detail for GET /api/payroll/:id. */
export interface PayrollUploadDetail {
  id: string;
  period: string;
  totalRecords: number;
  mdaCount: number;
  referenceNumbers: string[];
  createdAt: string;
  mdaBreakdown: PayrollMdaBreakdown[];
}
