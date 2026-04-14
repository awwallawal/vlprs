import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import XLSX from 'xlsx';

const FIXTURE_DIR = path.resolve(__dirname, '../../../../tests/fixtures/legacy-migration');
const CATALOG_PATH = path.resolve(__dirname, '../../../../docs/legacy_cd/output/catalog.json');

const EXPECTED_FIXTURES = [
  'MANR LOAN DEDUCTION JAN-DEC, 2018  CORRECTED.xlsx',
  'APRIL 2021 SEC CAR SOFTCOPY.xlsx',
  '2020 CDU OYSG MDAs CAR LOAN DEDUCTION TEMPLATE.xlsx',
  'AUDIT SERVICE COMMISSION Car Loan Returns - from March - December.xlsx',
  'agric_VEHINCLE LOAN DEDUCTION JANUARY- JULY, 2024.xlsx',
  'APRIL 2020 sec car loan.xlsx',
  'EDUCATION VEHICLE LOAN RETURNS TO AG.xlsx',
];

const REQUIRED_ENTRY_FIELDS = ['filename', 'mda', 'sheets'] as const;
const REQUIRED_MDA_FIELDS = ['code', 'name', 'confidence', 'source', 'rawInput'] as const;
const REQUIRED_SHEET_FIELDS = [
  'sheet',
  'period',
  'era',
  'headerConfidence',
  'columnCount',
  'unrecognizedColumns',
  'recordCount',
  'records',
] as const;
const REQUIRED_RECORD_FIELDS = ['sourceFile', 'sheet', 'rowNumber', 'period', 'mda', 'fields'] as const;

interface FixtureRecord { sourceFile: string; sheet: string; rowNumber: number; period: string; mda: string; fields: { staffName: string; [k: string]: unknown } }
interface FixtureSheet { sheet: string; period: string; era: number; headerConfidence: number; columnCount: number; unrecognizedColumns: string[]; recordCount: number; records: FixtureRecord[] }
interface FixtureData { filename: string; mda: { code: string; name: string; confidence: string; source: string; rawInput: string }; sheets: FixtureSheet[] }

// Cache parsed JSON to avoid redundant reads of large files (Education = 13.5MB)
const jsonCache = new Map<string, FixtureData>();
function loadExpectedJson(fixture: string): FixtureData {
  if (!jsonCache.has(fixture)) {
    const raw = fs.readFileSync(path.join(FIXTURE_DIR, `${fixture}.expected.json`), 'utf8');
    jsonCache.set(fixture, JSON.parse(raw));
  }
  return jsonCache.get(fixture)!;
}

describe('Legacy Migration Regression Fixtures', () => {
  it('fixture directory exists', () => {
    expect(fs.existsSync(FIXTURE_DIR)).toBe(true);
  });

  it('all 7 fixture Excel files exist', () => {
    for (const fixture of EXPECTED_FIXTURES) {
      const filePath = path.join(FIXTURE_DIR, fixture);
      expect(fs.existsSync(filePath), `Missing fixture: ${fixture}`).toBe(true);
    }
  });

  it('all 7 expected JSON files exist', () => {
    for (const fixture of EXPECTED_FIXTURES) {
      const jsonPath = path.join(FIXTURE_DIR, `${fixture}.expected.json`);
      expect(fs.existsSync(jsonPath), `Missing expected output: ${fixture}.expected.json`).toBe(true);
    }
  });

  it('README.md exists', () => {
    expect(fs.existsSync(path.join(FIXTURE_DIR, 'README.md'))).toBe(true);
  });

  describe.each(EXPECTED_FIXTURES)('%s', (fixture) => {
    it('opens with xlsx library', { timeout: 60_000 }, () => {
      const wb = XLSX.readFile(path.join(FIXTURE_DIR, fixture));
      expect(wb.SheetNames.length).toBeGreaterThan(0);
    });

    it('expected JSON parses and has valid schema', () => {
      const data = loadExpectedJson(fixture);

      for (const field of REQUIRED_ENTRY_FIELDS) {
        expect(data).toHaveProperty(field);
      }
      expect(data.filename).toBe(fixture);

      for (const field of REQUIRED_MDA_FIELDS) {
        expect(data.mda).toHaveProperty(field);
      }
      expect(['exact', 'alias', 'fuzzy', 'unresolved']).toContain(data.mda.confidence);

      expect(Array.isArray(data.sheets)).toBe(true);
      expect(data.sheets.length).toBeGreaterThan(0);

      for (const sheet of data.sheets) {
        for (const field of REQUIRED_SHEET_FIELDS) {
          expect(sheet).toHaveProperty(field);
        }
        expect(typeof sheet.era).toBe('number');
        expect(sheet.era).toBeGreaterThanOrEqual(1);
        expect(sheet.era).toBeLessThanOrEqual(4);
        expect(Array.isArray(sheet.records)).toBe(true);
        expect(sheet.recordCount).toBe(sheet.records.length);
      }
    });

    it('records have valid field structure', () => {
      const data = loadExpectedJson(fixture);

      for (const sheet of data.sheets) {
        for (const record of sheet.records) {
          for (const field of REQUIRED_RECORD_FIELDS) {
            expect(record).toHaveProperty(field);
          }
          expect(record.sourceFile).toBe(fixture);
          expect(record.fields).toHaveProperty('staffName');
        }
      }
    });
  });

  it('covers all 4 format eras', () => {
    const eras = new Set<number>();
    for (const fixture of EXPECTED_FIXTURES) {
      const data = loadExpectedJson(fixture);
      for (const sheet of data.sheets) {
        eras.add(sheet.era);
      }
    }
    expect(eras.has(1)).toBe(true);
    expect(eras.has(2)).toBe(true);
    expect(eras.has(3)).toBe(true);
    expect(eras.has(4)).toBe(true);
  });

  it('covers at least 2 distinct MDAs', () => {
    const mdas = new Set<string>();
    for (const fixture of EXPECTED_FIXTURES) {
      const data = loadExpectedJson(fixture);
      mdas.add(data.mda.code);
    }
    expect(mdas.size).toBeGreaterThanOrEqual(2);
  });

  it('multi-MDA fixture contains CDU embedding marker in Excel', () => {
    const wb = XLSX.readFile(
      path.join(FIXTURE_DIR, 'agric_VEHINCLE LOAN DEDUCTION JANUARY- JULY, 2024.xlsx'),
    );
    const allText = wb.SheetNames.flatMap((name: string) => {
      const rows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[name], { header: 1 });
      return rows.flat().filter((v: unknown): v is string => typeof v === 'string');
    });
    const hasCdu = allText.some((text: string) => /cocoa\s*development\s*unit/i.test(text));
    expect(hasCdu, 'Agriculture fixture should contain "COCOA DEVELOPMENT UNIT" marker').toBe(true);
  });

  // Conditional: verify expected JSONs are exact subsets of catalog.json when available
  const catalogExists = fs.existsSync(CATALOG_PATH);
  it.skipIf(!catalogExists)('expected outputs are exact subsets of catalog.json', () => {
    const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
    for (const fixture of EXPECTED_FIXTURES) {
      const expected = loadExpectedJson(fixture);
      const catalogEntry = catalog.find((e: Record<string, unknown>) => e.filename === fixture);
      expect(catalogEntry, `${fixture} not found in catalog.json`).toBeDefined();
      expect(JSON.stringify(expected)).toBe(JSON.stringify(catalogEntry));
    }
  });
});
