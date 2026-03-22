import { describe, it, expect } from 'vitest';
import { parseCsvRows, parseSubmissionFile } from './fileParser';
import XLSX from 'xlsx';

// ─── Helpers ─────────────────────────────────────────────────────────

function csvBuffer(lines: string[]): Buffer {
  return Buffer.from(lines.join('\n'), 'utf-8');
}

function xlsxBuffer(rows: (string | number | null)[][]): Buffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

const HEADER_ROW = [
  'Staff ID', 'Month', 'Amount Deducted', 'Payroll Batch Reference',
  'MDA Code', 'Event Flag', 'Event Date', 'Cessation Reason',
];

const DATA_ROW_1 = ['OYO-001', '2026-03', '15000.00', 'BATCH-001', 'MOF', 'NONE', null, null];
const DATA_ROW_2 = ['OYO-002', '2026-03', '20000.50', 'BATCH-001', 'MOH', 'RETIREMENT', '2026-03-15', null];

// ─── parseCsvRows ────────────────────────────────────────────────────

describe('parseCsvRows', () => {
  it('parses CSV with header row into ParsedCsvRow[]', () => {
    const buf = csvBuffer([
      HEADER_ROW.join(','),
      'OYO-001,2026-03,15000.00,BATCH-001,MOF,NONE,,',
    ]);
    const rows = parseCsvRows(buf);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      staffId: 'OYO-001',
      month: '2026-03',
      amountDeducted: '15000.00',
      mdaCode: 'MOF',
      eventFlag: 'NONE',
      eventDate: null,
      cessationReason: null,
    });
  });

  it('throws on empty file', () => {
    expect(() => parseCsvRows(Buffer.from('', 'utf-8'))).toThrow();
  });
});

// ─── parseSubmissionFile — CSV vs XLSX identical output ──────────────

describe('parseSubmissionFile', () => {
  it('CSV and XLSX produce identical row shape for same data', () => {
    const csvBuf = csvBuffer([
      HEADER_ROW.join(','),
      'OYO-001,2026-03,15000.00,BATCH-001,MOF,NONE,,',
      'OYO-002,2026-03,20000.50,BATCH-001,MOH,RETIREMENT,2026-03-15,',
    ]);

    const xlsxBuf = xlsxBuffer([
      HEADER_ROW,
      DATA_ROW_1,
      DATA_ROW_2,
    ]);

    const csvRows = parseSubmissionFile(csvBuf, 'test.csv');
    const xlsxRows = parseSubmissionFile(xlsxBuf, 'test.xlsx');

    expect(csvRows).toHaveLength(2);
    expect(xlsxRows).toHaveLength(2);

    // Verify same structure (field names and core values match)
    expect(csvRows[0].staffId).toBe(xlsxRows[0].staffId);
    expect(csvRows[0].month).toBe(xlsxRows[0].month);
    expect(csvRows[0].mdaCode).toBe(xlsxRows[0].mdaCode);
    expect(csvRows[0].eventFlag).toBe(xlsxRows[0].eventFlag);

    expect(csvRows[1].staffId).toBe(xlsxRows[1].staffId);
    expect(csvRows[1].month).toBe(xlsxRows[1].month);
    expect(csvRows[1].mdaCode).toBe(xlsxRows[1].mdaCode);
  });

  it('rejects unsupported file types', () => {
    const buf = Buffer.from('test data', 'utf-8');
    expect(() => parseSubmissionFile(buf, 'test.pdf')).toThrow(/CSV and XLSX/i);
  });

  it('routes .csv files through CSV parser', () => {
    const buf = csvBuffer([
      HEADER_ROW.join(','),
      'OYO-001,2026-03,15000.00,BATCH-001,MOF,NONE,,',
    ]);
    const rows = parseSubmissionFile(buf, 'payroll.csv');
    expect(rows).toHaveLength(1);
    expect(rows[0].staffId).toBe('OYO-001');
  });

  it('routes .xlsx files through XLSX parser', () => {
    const buf = xlsxBuffer([HEADER_ROW, DATA_ROW_1]);
    const rows = parseSubmissionFile(buf, 'payroll.xlsx');
    expect(rows).toHaveLength(1);
    expect(rows[0].staffId).toBe('OYO-001');
  });
});
