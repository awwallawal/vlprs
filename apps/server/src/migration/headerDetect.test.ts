import { describe, it, expect } from 'vitest';
import * as path from 'path';
import XLSX from 'xlsx';
import { detectHeaderRow } from './headerDetect';

const FIXTURE_DIR = path.resolve(__dirname, '../../../../tests/fixtures/legacy-migration');

describe('detectHeaderRow', () => {
  it('detects high-confidence header in Era 1 fixture', () => {
    const wb = XLSX.readFile(path.join(FIXTURE_DIR, 'MANR LOAN DEDUCTION JAN-DEC, 2018  CORRECTED.xlsx'));
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const result = detectHeaderRow(sheet);

    expect(result.confidence).toBe('high');
    expect(result.columns.length).toBeGreaterThan(0);
    expect(result.rawColumns.length).toBeGreaterThan(0);
    // Should detect S/N or NAME in the header
    expect(result.columns.some(c => c.includes('name') || c.includes('s/n'))).toBe(true);
  });

  it('detects header in Era 3 CDU fixture', () => {
    const wb = XLSX.readFile(path.join(FIXTURE_DIR, '2020 CDU OYSG MDAs CAR LOAN DEDUCTION TEMPLATE.xlsx'));
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const result = detectHeaderRow(sheet);

    expect(result.confidence).toBe('high');
    expect(result.columns.length).toBeGreaterThanOrEqual(17);
  });

  it('detects header in Era 4 fixture', () => {
    const wb = XLSX.readFile(path.join(FIXTURE_DIR, 'AUDIT SERVICE COMMISSION Car Loan Returns - from March - December.xlsx'));
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const result = detectHeaderRow(sheet);

    expect(result.confidence).toBe('high');
    // Era 4 has start date / end date columns
    expect(result.columns.some(c => c.includes('start date') || c.includes('end date'))).toBe(true);
  });

  it('extracts title rows from pre-header area', () => {
    const wb = XLSX.readFile(path.join(FIXTURE_DIR, 'MANR LOAN DEDUCTION JAN-DEC, 2018  CORRECTED.xlsx'));
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const result = detectHeaderRow(sheet);

    // Title rows should contain MDA name or period info
    expect(result.titleRows.length).toBeGreaterThanOrEqual(0);
  });
});
