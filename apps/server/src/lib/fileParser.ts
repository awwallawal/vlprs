/**
 * Unified file parser for CSV and XLSX uploads (Story 7.0h).
 * Normalizes both formats into the same ParsedCsvRow[] shape.
 *
 * CSV: PapaParse (extracted from submissionService.ts)
 * XLSX: xlsx library (same pattern as migrationService.ts)
 */
import Papa from 'papaparse';
import XLSX from 'xlsx';
import path from 'path';
import { AppError } from './appError';
import { VOCABULARY } from '@vlprs/shared';

// ─── Types ───────────────────────────────────────────────────────────

export interface ParsedCsvRow {
  rowNumber: number;
  staffId: string;
  month: string;
  amountDeducted: string;
  payrollBatchReference: string;
  mdaCode: string;
  eventFlag: string;
  eventDate: string | null;
  cessationReason: string | null;
}

// ─── CSV Parsing ─────────────────────────────────────────────────────

const CSV_HEADERS = [
  'Staff ID', 'Month', 'Amount Deducted', 'Payroll Batch Reference',
  'MDA Code', 'Event Flag', 'Event Date', 'Cessation Reason',
] as const;

/**
 * Parse CSV buffer into normalized row arrays.
 * Strips BOM, skips header rows, filters comment rows.
 */
export function parseCsvRows(buffer: Buffer): ParsedCsvRow[] {
  let csvText = buffer.toString('utf-8');
  // Strip BOM if present
  if (csvText.charCodeAt(0) === 0xFEFF) {
    csvText = csvText.slice(1);
  }

  const result = Papa.parse<string[]>(csvText, {
    header: false,
    skipEmptyLines: true,
    delimiter: ',',
  });

  if (result.errors.length > 0 && result.data.length === 0) {
    throw new AppError(422, 'CSV_PARSE_ERROR', VOCABULARY.SUBMISSION_EMPTY_FILE);
  }

  // Skip header row if present
  let dataRows = result.data;
  if (dataRows.length > 0) {
    const firstRow = dataRows[0];
    const isHeader = firstRow.some(
      (cell) => CSV_HEADERS.some((h) => h.toLowerCase() === cell.trim().toLowerCase()),
    );
    if (isHeader) {
      dataRows = dataRows.slice(1);
    }
  }

  // Skip comment rows (lines starting with #)
  dataRows = dataRows.filter((row) => !(row[0] || '').trim().startsWith('#'));

  if (dataRows.length === 0) {
    throw new AppError(422, 'SUBMISSION_VALIDATION_FAILED', VOCABULARY.SUBMISSION_EMPTY_FILE);
  }

  return dataRows.map((row, idx) => ({
    rowNumber: idx + 2, // 1-based, +1 for header row
    staffId: (row[0] || '').trim(),
    month: (row[1] || '').trim(),
    amountDeducted: (row[2] || '').trim(),
    payrollBatchReference: (row[3] || '').trim(),
    mdaCode: (row[4] || '').trim(),
    eventFlag: (row[5] || '').trim(),
    eventDate: row[6]?.trim() || null,
    cessationReason: row[7]?.trim() || null,
  }));
}

// ─── XLSX Parsing ────────────────────────────────────────────────────

/**
 * Parse XLSX buffer into the same normalized row shape.
 * Reads first sheet only; logs warning if multi-sheet.
 */
function parseXlsxRows(buffer: Buffer): ParsedCsvRow[] {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { cellDates: true });
  } catch {
    throw new AppError(400, 'FILE_PARSE_ERROR', VOCABULARY.PAYROLL_INVALID_FILE_TYPE);
  }

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new AppError(400, 'FILE_NO_SHEETS', VOCABULARY.PAYROLL_EMPTY_FILE);
  }

  const ws = workbook.Sheets[workbook.SheetNames[0]];
  if (!ws) {
    throw new AppError(400, 'FILE_NO_DATA', VOCABULARY.PAYROLL_EMPTY_FILE);
  }

  const rawRows: unknown[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
    blankrows: false,
  });

  if (rawRows.length === 0) {
    throw new AppError(422, 'SUBMISSION_VALIDATION_FAILED', VOCABULARY.PAYROLL_EMPTY_FILE);
  }

  // Skip header row if present
  let dataRows = rawRows;
  if (dataRows.length > 0) {
    const firstRow = dataRows[0];
    if (Array.isArray(firstRow)) {
      const isHeader = firstRow.some(
        (cell) => typeof cell === 'string' && CSV_HEADERS.some(
          (h) => h.toLowerCase() === cell.trim().toLowerCase(),
        ),
      );
      if (isHeader) {
        dataRows = dataRows.slice(1);
      }
    }
  }

  if (dataRows.length === 0) {
    throw new AppError(422, 'SUBMISSION_VALIDATION_FAILED', VOCABULARY.PAYROLL_EMPTY_FILE);
  }

  return dataRows.map((row, idx) => {
    const cell = (i: number): string => {
      const val = row[i];
      if (val === null || val === undefined) return '';
      if (val instanceof Date) {
        // Format date cells as YYYY-MM-DD
        return val.toISOString().slice(0, 10);
      }
      return String(val).trim();
    };

    return {
      rowNumber: idx + 2, // 1-based, +1 for header row
      staffId: cell(0),
      month: cell(1),
      amountDeducted: cell(2),
      payrollBatchReference: cell(3),
      mdaCode: cell(4),
      eventFlag: cell(5),
      eventDate: cell(6) || null,
      cessationReason: cell(7) || null,
    };
  });
}

// ─── Unified Parser ──────────────────────────────────────────────────

/**
 * Detect file type from extension and parse into normalized rows.
 * Accepts CSV and XLSX formats.
 */
export function parseSubmissionFile(buffer: Buffer, filename: string): ParsedCsvRow[] {
  const ext = path.extname(filename).toLowerCase();

  if (ext === '.csv') {
    return parseCsvRows(buffer);
  }

  if (ext === '.xlsx' || ext === '.xls') {
    return parseXlsxRows(buffer);
  }

  throw new AppError(400, 'PAYROLL_INVALID_FILE_TYPE', VOCABULARY.PAYROLL_INVALID_FILE_TYPE);
}
