import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Story 8.0d: Multi-Sheet Period Handling
 *
 * Unit tests for multi-sheet overlap checking logic.
 * Tests the deduplication, response shaping, and edge cases
 * by mocking the DB layer to control what checkPeriodOverlap returns.
 */

// Track which period is being queried so we can return different results.
// NOTE: This mock strategy uses positional counters (selectCallIndex, callTracker.call)
// tied to the internal query execution order of checkPeriodOverlap. If query order changes
// (e.g., MDA lookup before upload lookup), tests will break without functional regression.
// Consider refactoring to per-function mocks when migrationService is next restructured.
let selectCallIndex = 0;
let overlapScenario: Record<string, { overlap: boolean; filename?: string; count?: number }> = {};

const makeMockChain = () => {
  // Each call to checkPeriodOverlap does:
  // 1. select upload → need to return upload record
  // 2. select MDA name → need to return MDA
  // 3. select existing records → control overlap result
  const callTracker = { call: 0 };

  return {
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation(() => ({
        where: vi.fn().mockImplementation(() => {
          callTracker.call++;
          // Odd calls: upload lookup, Even calls: MDA name lookup
          if (callTracker.call % 2 === 1) {
            return Promise.resolve([{
              id: 'upload-1',
              mdaId: 'mda-1',
              metadata: null,
              fileSizeBytes: 1000,
              status: 'uploaded',
              deletedAt: null,
            }]);
          }
          // MDA name lookup
          return Promise.resolve([{ name: 'Agriculture' }]);
        }),
        innerJoin: vi.fn().mockImplementation(() => ({
          where: vi.fn().mockImplementation(() => {
            const key = `${selectCallIndex}`;
            selectCallIndex++;
            const scenario = overlapScenario[key];

            return {
              groupBy: vi.fn().mockImplementation(() => ({
                limit: vi.fn().mockImplementation(() => {
                  if (scenario?.overlap) {
                    return Promise.resolve([{
                      uploadId: 'existing-upload-1',
                      filename: scenario.filename ?? 'existing.xlsx',
                      count: scenario.count ?? 10,
                    }]);
                  }
                  return Promise.resolve([]);
                }),
              })),
            };
          }),
        })),
      })),
    })),
  };
};

let mockDb = makeMockChain();

vi.mock('../db/index', () => ({
  get db() { return mockDb; },
}));

vi.mock('../db/schema', () => ({
  migrationUploads: { id: 'id', mdaId: 'mda_id', status: 'status', deletedAt: 'deleted_at', filename: 'filename' },
  migrationRecords: { mdaId: 'mda_id', uploadId: 'upload_id', periodYear: 'period_year', periodMonth: 'period_month', deletedAt: 'deleted_at' },
  migrationExtraFields: {},
  mdas: { id: 'id', name: 'name' },
}));

vi.mock('../lib/appError', () => ({
  AppError: class AppError extends Error {
    statusCode: number;
    code: string;
    constructor(statusCode: number, code: string, message: string) {
      super(message);
      this.statusCode = statusCode;
      this.code = code;
    }
  },
}));

vi.mock('../lib/mdaScope', () => ({ withMdaScope: vi.fn() }));

vi.mock('@vlprs/shared', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@vlprs/shared');
  return { ...actual, VOCABULARY: {} };
});

vi.mock('../migration/headerDetect', () => ({ detectHeaderRow: vi.fn() }));
vi.mock('../migration/columnMap', () => ({ mapColumns: vi.fn(), extractRecord: vi.fn() }));
vi.mock('../migration/eraDetect', () => ({ detectEra: vi.fn() }));
vi.mock('../migration/periodExtract', () => ({ extractPeriod: vi.fn() }));
vi.mock('../migration/parseUtils', () => ({ parseFinancialNumber: vi.fn(), isSummaryRowMarker: vi.fn() }));
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => args),
  and: vi.fn((...args: unknown[]) => args),
  isNull: vi.fn((col: unknown) => col),
  desc: vi.fn((col: unknown) => col),
  sql: vi.fn((...args: unknown[]) => args),
}));

import type { SheetOverlapResult } from '@vlprs/shared';
import { checkMultiSheetOverlap } from './migrationService';

describe('checkMultiSheetOverlap — Story 8.0d', () => {
  beforeEach(() => {
    selectCallIndex = 0;
    overlapScenario = {};
    mockDb = makeMockChain();
  });

  it('3-sheet upload (Aug/Sep/Oct): only Sep overlaps → Sep conflicting, Aug+Oct clean', async () => {
    // Call 0 = Aug (no overlap), Call 1 = Sep (overlap), Call 2 = Oct (no overlap)
    overlapScenario = {
      '0': { overlap: false },
      '1': { overlap: true, filename: 'BIR CAR LOAN SEPT 2024.xlsx', count: 45 },
      '2': { overlap: false },
    };

    const result = await checkMultiSheetOverlap('upload-1', [
      { sheetName: 'AUG 2024', periodYear: 2024, periodMonth: 8 },
      { sheetName: 'SEP 2024', periodYear: 2024, periodMonth: 9 },
      { sheetName: 'OCT 2024', periodYear: 2024, periodMonth: 10 },
    ]);

    expect(result.hasOverlap).toBe(true);
    expect(result.results).toHaveLength(3);

    // Aug — clean
    const augResult = result.results.find((r: SheetOverlapResult) => r.periodMonth === 8)!;
    expect(augResult.overlap).toBe(false);
    expect(augResult.sheetNames).toEqual(['AUG 2024']);
    expect(augResult.periodLabel).toBe('August 2024');

    // Sep — conflicting
    const sepResult = result.results.find((r: SheetOverlapResult) => r.periodMonth === 9)!;
    expect(sepResult.overlap).toBe(true);
    expect(sepResult.existingFilename).toBe('BIR CAR LOAN SEPT 2024.xlsx');
    expect(sepResult.existingRecordCount).toBe(45);
    expect(sepResult.periodLabel).toBe('September 2024');

    // Oct — clean
    const octResult = result.results.find((r: SheetOverlapResult) => r.periodMonth === 10)!;
    expect(octResult.overlap).toBe(false);
    expect(octResult.periodLabel).toBe('October 2024');

    expect(result.skippedSheets).toHaveLength(0);
  });

  it('2-sheet upload with same period (Aug/Aug) → deduplicated to single overlap check', async () => {
    overlapScenario = {
      '0': { overlap: true, filename: 'AUG DATA.xlsx', count: 30 },
    };

    const result = await checkMultiSheetOverlap('upload-1', [
      { sheetName: 'Sheet1', periodYear: 2024, periodMonth: 8 },
      { sheetName: 'Sheet2', periodYear: 2024, periodMonth: 8 },
    ]);

    expect(result.hasOverlap).toBe(true);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].sheetNames).toEqual(['Sheet1', 'Sheet2']);
    expect(result.results[0].periodYear).toBe(2024);
    expect(result.results[0].periodMonth).toBe(8);
    expect(result.results[0].overlap).toBe(true);
    // Deduplication: only one call to the DB for overlap
    expect(selectCallIndex).toBe(1);
  });

  it('no overlap when all periods are clean', async () => {
    overlapScenario = {
      '0': { overlap: false },
      '1': { overlap: false },
    };

    const result = await checkMultiSheetOverlap('upload-1', [
      { sheetName: 'JAN 2024', periodYear: 2024, periodMonth: 1 },
      { sheetName: 'FEB 2024', periodYear: 2024, periodMonth: 2 },
    ]);

    expect(result.hasOverlap).toBe(false);
    expect(result.results).toHaveLength(2);
    expect(result.results.every((r: SheetOverlapResult) => !r.overlap)).toBe(true);
  });

  it('skippedSheets is empty for the POST endpoint (filtering done by caller)', async () => {
    overlapScenario = {
      '0': { overlap: false },
    };

    const result = await checkMultiSheetOverlap('upload-1', [
      { sheetName: 'AUG 2024', periodYear: 2024, periodMonth: 8 },
    ]);

    expect(result.skippedSheets).toEqual([]);
  });

  it('period labels are formatted correctly', async () => {
    overlapScenario = {
      '0': { overlap: false },
      '1': { overlap: false },
    };

    const result = await checkMultiSheetOverlap('upload-1', [
      { sheetName: 'Sheet1', periodYear: 2024, periodMonth: 1 },
      { sheetName: 'Sheet2', periodYear: 2025, periodMonth: 12 },
    ]);

    expect(result.results[0].periodLabel).toBe('January 2024');
    expect(result.results[1].periodLabel).toBe('December 2025');
  });
});
