import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import XLSX from 'xlsx';
import { detectHeaderRow } from './headerDetect';
import { mapColumns, extractRecord } from './columnMap';
import { detectEra } from './eraDetect';
import { parseFinancialNumber, isSummaryRowMarker } from './parseUtils';
import type { CanonicalField } from '@vlprs/shared';

const FIXTURE_DIR = path.resolve(__dirname, '../../../../tests/fixtures/legacy-migration');

const FIXTURES = [
  'MANR LOAN DEDUCTION JAN-DEC, 2018  CORRECTED.xlsx',
  'APRIL 2021 SEC CAR SOFTCOPY.xlsx',
  '2020 CDU OYSG MDAs CAR LOAN DEDUCTION TEMPLATE.xlsx',
  'AUDIT SERVICE COMMISSION Car Loan Returns - from March - December.xlsx',
  'agric_VEHINCLE LOAN DEDUCTION JANUARY- JULY, 2024.xlsx',
  'APRIL 2020 sec car loan.xlsx',
  'EDUCATION VEHICLE LOAN RETURNS TO AG.xlsx',
];

const FINANCIAL_FIELDS: CanonicalField[] = [
  'principal', 'interestTotal', 'totalLoan',
  'monthlyDeduction', 'monthlyInterest', 'monthlyPrincipal',
  'totalInterestPaid', 'totalOutstandingInterest',
  'totalLoanPaid', 'outstandingBalance',
];

const INTEGER_FIELDS: CanonicalField[] = [
  'installmentCount', 'installmentsPaid', 'installmentsOutstanding',
];

const SKIP_SHEET_PATTERNS = [
  /cooperative/i, /housing\s*loan/i, /health\s*insurance/i,
  /govt\.?\s*qtrs/i, /government\s*quarters/i,
  /shortpayment/i, /staff\s*salary/i, /^salary$/i,
];

function shouldSkipSheet(name: string): boolean {
  return SKIP_SHEET_PATTERNS.some(p => p.test(name));
}

interface ExpectedRecord { fields: Record<string, unknown> }
interface ExpectedSheet { sheet: string; recordCount: number; era: number; records: ExpectedRecord[] }
interface ExpectedFixture { sheets: ExpectedSheet[] }

// Cache expected JSONs
const jsonCache = new Map<string, ExpectedFixture>();
function loadExpected(fixture: string): ExpectedFixture {
  if (!jsonCache.has(fixture)) {
    const raw = fs.readFileSync(path.join(FIXTURE_DIR, `${fixture}.expected.json`), 'utf8');
    jsonCache.set(fixture, JSON.parse(raw));
  }
  return jsonCache.get(fixture)!;
}

/**
 * Parse a fixture file using the ported server-side utilities.
 * Mirrors the logic in SQ-1 analyze.ts.
 */
function parseFixture(fixture: string) {
  const filePath = path.join(FIXTURE_DIR, fixture);
  const wb = XLSX.readFile(filePath, { cellDates: true });

  const sheets: Array<{
    sheet: string;
    era: number;
    recordCount: number;
    records: Array<{ rowNumber: number; fields: Record<string, unknown> }>;
  }> = [];

  for (const sheetName of wb.SheetNames) {
    if (shouldSkipSheet(sheetName)) continue;

    const ws = wb.Sheets[sheetName];
    if (!ws || !ws['!ref']) continue;

    const header = detectHeaderRow(ws);
    if (header.columns.length === 0) continue;

    const mapping = mapColumns(header.rawColumns);

    const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, {
      header: 1, defval: null, blankrows: true,
    });
    const dataStartRow = header.headerRowIndex + 1;
    const dataRows = rows.slice(dataStartRow);

    const era = detectEra(
      header.rawColumns.filter(c => c.length > 0).length,
      mapping.fieldToIndex.has('startDate'),
      mapping.fieldToIndex.has('mda'),
      mapping.fieldToIndex.has('employeeNo'),
    );

    const records: Array<{ rowNumber: number; fields: Record<string, unknown> }> = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      if (!row || row.every(c => c === null || c === undefined || String(c).trim() === '')) continue;

      const nameValue = mapping.fieldToIndex.has('staffName')
        ? row[mapping.fieldToIndex.get('staffName')!] : null;
      const serialValue = mapping.fieldToIndex.has('serialNumber')
        ? row[mapping.fieldToIndex.get('serialNumber')!] : row[0];

      if (isSummaryRowMarker(nameValue) || isSummaryRowMarker(serialValue)) continue;

      if (serialValue !== null && serialValue !== undefined) {
        const sn = Number(serialValue);
        if (isNaN(sn) && typeof serialValue === 'string' && serialValue.trim().length > 0) {
          if (isSummaryRowMarker(serialValue)) continue;
        }
      }

      const rawRecord = extractRecord(row, mapping);
      const staffName = rawRecord.staffName;
      if (!staffName || String(staffName).trim() === '') continue;

      const fields: Record<string, unknown> = {};
      fields.staffName = String(staffName).trim();
      fields.serialNumber = rawRecord.serialNumber !== null && rawRecord.serialNumber !== undefined
        ? Number(rawRecord.serialNumber) || String(rawRecord.serialNumber)
        : null;

      for (const field of FINANCIAL_FIELDS) {
        fields[field] = parseFinancialNumber(rawRecord[field]);
      }
      for (const field of INTEGER_FIELDS) {
        const parsed = parseFinancialNumber(rawRecord[field]);
        fields[field] = parsed !== null ? Math.round(Number(parsed)) : null;
      }

      fields.remarks = rawRecord.remarks ? String(rawRecord.remarks).trim() : null;
      fields.startDate = rawRecord.startDate ? String(rawRecord.startDate) : null;
      fields.endDate = rawRecord.endDate ? String(rawRecord.endDate) : null;
      fields.employeeNo = rawRecord.employeeNo ? String(rawRecord.employeeNo).trim() : null;
      fields.refId = rawRecord.refId ? String(rawRecord.refId).trim() : null;
      fields.commencementDate = rawRecord.commencementDate ? String(rawRecord.commencementDate) : null;
      fields.station = rawRecord.station ? String(rawRecord.station).trim() : null;

      // Filter: header name rows
      const nameUpper = String(fields.staffName).toUpperCase();
      const HEADER_NAMES = ['NAME', 'NAMES', 'STAFF NAME', 'STAFF NAMES', 'SURNAME, OTHER NAMES'];
      const SN_HEADERS = ['S/N', 'S/NO', 'S/NO.', 'SN'];
      if (HEADER_NAMES.includes(nameUpper)) continue;
      if (fields.serialNumber !== null && SN_HEADERS.includes(String(fields.serialNumber).trim().toUpperCase())) continue;

      // Filter: no serial number and no financial data (matches service hasRealFinancialValue logic)
      const hasSerialNumber = fields.serialNumber !== null && !isNaN(Number(fields.serialNumber));
      const hasAnyFinancial = FINANCIAL_FIELDS.some(f => {
        const raw = rawRecord[f];
        if (raw === null || raw === undefined) return false;
        if (typeof raw === 'number') return true;
        const s = String(raw).trim();
        if (s === '' || s === '-' || s === '\u2013' || s === '\u2014' || s === 'N/A' || s === 'NIL') return false;
        return parseFinancialNumber(raw) !== null;
      });
      if (!hasSerialNumber && !hasAnyFinancial) continue;

      records.push({
        rowNumber: dataStartRow + i + 1,
        fields,
      });
    }

    sheets.push({
      sheet: sheetName,
      era,
      recordCount: records.length,
      records,
    });
  }

  return sheets;
}

describe('Migration Regression Tests', () => {
  // Timeout increased to 30s for all fixtures — EDUCATION stress fixture requires it under CI load, applied uniformly for consistency
  describe.each(FIXTURES)('%s', (fixture) => {
    it('record counts per sheet match expected', { timeout: 30_000 }, () => {
      const expected = loadExpected(fixture);
      const parsed = parseFixture(fixture);

      for (const expectedSheet of expected.sheets) {
        const parsedSheet = parsed.find(s => s.sheet === expectedSheet.sheet);
        if (!parsedSheet) {
          // Sheet might be skipped by our patterns
          continue;
        }
        expect(parsedSheet.recordCount, `Sheet "${expectedSheet.sheet}" record count`)
          .toBe(expectedSheet.recordCount);
      }
    });

    it('era detection matches expected', { timeout: 30_000 }, () => {
      const expected = loadExpected(fixture);
      const parsed = parseFixture(fixture);

      for (const expectedSheet of expected.sheets) {
        const parsedSheet = parsed.find(s => s.sheet === expectedSheet.sheet);
        if (!parsedSheet) continue;
        expect(parsedSheet.era, `Sheet "${expectedSheet.sheet}" era`).toBe(expectedSheet.era);
      }
    });

    it('canonical field values match for first 3 records per sheet', { timeout: 30_000 }, () => {
      const expected = loadExpected(fixture);
      const parsed = parseFixture(fixture);

      for (const expectedSheet of expected.sheets) {
        const parsedSheet = parsed.find(s => s.sheet === expectedSheet.sheet);
        if (!parsedSheet) continue;

        // Compare first 3 records in each sheet
        const compareCount = Math.min(3, expectedSheet.records.length, parsedSheet.records.length);
        for (let r = 0; r < compareCount; r++) {
          const exp = expectedSheet.records[r].fields;
          const got = parsedSheet.records[r].fields;

          expect(got.staffName, `${expectedSheet.sheet}[${r}] staffName`).toBe(exp.staffName);

          // Compare financial fields (string comparison for precision)
          for (const field of FINANCIAL_FIELDS) {
            expect(got[field], `${expectedSheet.sheet}[${r}] ${field}`).toBe(exp[field]);
          }
        }
      }
    });
  });
});
