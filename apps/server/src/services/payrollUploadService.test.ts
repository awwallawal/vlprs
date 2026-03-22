import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Hoisted mock state ──────────────────────────────────────────────

const {
  selectCallIdx, selectResults, mockTransaction, mockQueryChain,
} = vi.hoisted(() => {
  const state = { selectCallIdx: 0 };
  const selectResults: unknown[][] = [];

  function mockQueryChain(result: unknown) {
    const promise = Promise.resolve(result);
    const self = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => promise.then(resolve, reject),
      catch: (reject: (e: unknown) => unknown) => promise.catch(reject),
    };
    return self;
  }

  const mockTxInsert = vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
  const mockTxSelect = vi.fn().mockImplementation(() => mockQueryChain([]));
  const mockTxUpdate = vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  });
  const mockTransaction = vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
    return fn({
      insert: mockTxInsert,
      select: mockTxSelect,
      update: mockTxUpdate,
    });
  });

  return { selectCallIdx: state, selectResults, mockTransaction, mockQueryChain };
});

vi.mock('../db/index', () => ({
  db: {
    select: vi.fn().mockImplementation(() => {
      const result = selectResults[selectCallIdx.selectCallIdx] ?? [];
      selectCallIdx.selectCallIdx++;
      return mockQueryChain(result);
    }),
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
    transaction: mockTransaction,
  },
}));

vi.mock('../lib/uuidv7', () => ({
  generateUuidv7: vi.fn().mockReturnValue('mock-uuid-v7'),
}));

vi.mock('../lib/fileParser', () => ({
  parseSubmissionFile: vi.fn(),
  parseCsvRows: vi.fn(),
}));

vi.mock('./submissionService', () => ({
  validateSubmissionRows: vi.fn().mockReturnValue({ validRows: [], errors: [] }),
}));

vi.mock('./mdaService', () => ({
  resolveMdaByName: vi.fn(),
}));

import {
  previewPayrollUpload,
  confirmPayrollUpload,
  _testHelpers,
} from './payrollUploadService';
import { parseSubmissionFile } from '../lib/fileParser';
import { resolveMdaByName } from './mdaService';
import type { ParsedCsvRow } from '../lib/fileParser';

// ─── Helpers ─────────────────────────────────────────────────────────

function makePayrollRow(overrides: Partial<ParsedCsvRow> = {}): ParsedCsvRow {
  return {
    rowNumber: 2,
    staffId: 'OYO-001',
    month: '2026-03',
    amountDeducted: '15000.00',
    payrollBatchReference: 'PB-2026-03',
    mdaCode: 'MOF',
    eventFlag: 'NONE',
    eventDate: null,
    cessationReason: null,
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────

describe('payrollUploadService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectCallIdx.selectCallIdx = 0;
    selectResults.length = 0;
    _testHelpers.clearPendingUploads();

    // Default mock: resolveMdaByName resolves to a known MDA
    vi.mocked(resolveMdaByName).mockResolvedValue({
      id: 'mda-mof-id',
      name: 'Ministry of Finance',
      code: 'MOF',
      abbreviation: 'MOF',
      isActive: true,
      parentMdaId: null,
      parentMdaCode: null,
    });
  });

  afterEach(() => {
    _testHelpers.clearPendingUploads();
  });

  // ─── Preview ────────────────────────────────────────────────────────

  describe('previewPayrollUpload', () => {
    it('parses CSV file and returns delineation summary with MDA breakdown', async () => {
      vi.mocked(parseSubmissionFile).mockReturnValue([
        makePayrollRow({ staffId: 'OYO-001', mdaCode: 'MOF', amountDeducted: '15000.00' }),
        makePayrollRow({ staffId: 'OYO-002', mdaCode: 'MOF', amountDeducted: '20000.00' }),
        makePayrollRow({ staffId: 'OYO-003', mdaCode: 'MOH', amountDeducted: '10000.00' }),
      ]);

      vi.mocked(resolveMdaByName)
        .mockResolvedValueOnce({ id: 'mda-mof', name: 'Ministry of Finance', code: 'MOF', abbreviation: 'MOF', isActive: true, parentMdaId: null, parentMdaCode: null })
        .mockResolvedValueOnce({ id: 'mda-moh', name: 'Ministry of Health', code: 'MOH', abbreviation: 'MOH', isActive: true, parentMdaId: null, parentMdaCode: null });

      const summary = await previewPayrollUpload(
        Buffer.from('test'), 'payroll.csv', 1000, 'user-1',
      );

      expect(summary.period).toBe('2026-03');
      expect(summary.totalRecords).toBe(3);
      expect(summary.mdaBreakdown).toHaveLength(2);
      expect(summary.unmatchedCodes).toHaveLength(0);

      // MOF: 2 records, total ₦35,000
      const mof = summary.mdaBreakdown.find((b) => b.mdaCode === 'MOF');
      expect(mof?.recordCount).toBe(2);
      expect(mof?.totalDeduction).toBe('35000.00');

      // MOH: 1 record, total ₦10,000
      const moh = summary.mdaBreakdown.find((b) => b.mdaCode === 'MOH');
      expect(moh?.recordCount).toBe(1);
      expect(moh?.totalDeduction).toBe('10000.00');
    });

    it('rejects mixed-period files (AC 9)', async () => {
      vi.mocked(parseSubmissionFile).mockReturnValue([
        makePayrollRow({ month: '2026-03' }),
        makePayrollRow({ month: '2026-04' }),
      ]);

      await expect(
        previewPayrollUpload(Buffer.from('test'), 'payroll.csv', 1000, 'user-1'),
      ).rejects.toThrow(/mixed-period/i);
    });

    it('flags unmatched MDA codes in summary', async () => {
      vi.mocked(parseSubmissionFile).mockReturnValue([
        makePayrollRow({ mdaCode: 'UNKNOWN' }),
      ]);
      vi.mocked(resolveMdaByName).mockResolvedValue(null);

      const summary = await previewPayrollUpload(
        Buffer.from('test'), 'payroll.csv', 1000, 'user-1',
      );

      expect(summary.unmatchedCodes).toContain('UNKNOWN');
      expect(summary.mdaBreakdown[0].mdaName).toContain('Unmatched');
    });

    it('rejects files with more than 500 rows', async () => {
      const rows = Array.from({ length: 501 }, (_, i) =>
        makePayrollRow({ staffId: `OYO-${String(i).padStart(4, '0')}` }),
      );
      vi.mocked(parseSubmissionFile).mockReturnValue(rows);

      await expect(
        previewPayrollUpload(Buffer.from('test'), 'payroll.csv', 1000, 'user-1'),
      ).rejects.toThrow(/500/);
    });

    it('defaults empty eventFlag to NONE (relaxed payroll validation)', async () => {
      vi.mocked(parseSubmissionFile).mockReturnValue([
        makePayrollRow({ eventFlag: '' }),
      ]);

      const summary = await previewPayrollUpload(
        Buffer.from('test'), 'payroll.csv', 1000, 'user-1',
      );

      // Should not reject — eventFlag defaults to NONE
      expect(summary.totalRecords).toBe(1);
    });
  });

  // ─── Confirm ──────────────────────────────────────────────────────

  describe('confirmPayrollUpload', () => {
    it('creates separate mda_submissions per MDA with source=payroll', async () => {
      // First do a preview to populate the cache
      vi.mocked(parseSubmissionFile).mockReturnValue([
        makePayrollRow({ mdaCode: 'MOF', amountDeducted: '15000.00' }),
        makePayrollRow({ mdaCode: 'MOH', amountDeducted: '10000.00' }),
      ]);

      vi.mocked(resolveMdaByName)
        .mockResolvedValueOnce({ id: 'mda-mof', name: 'Ministry of Finance', code: 'MOF', abbreviation: 'MOF', isActive: true, parentMdaId: null, parentMdaCode: null })
        .mockResolvedValueOnce({ id: 'mda-moh', name: 'Ministry of Health', code: 'MOH', abbreviation: 'MOH', isActive: true, parentMdaId: null, parentMdaCode: null });

      await previewPayrollUpload(Buffer.from('test'), 'payroll.csv', 1000, 'user-1');

      const result = await confirmPayrollUpload('2026-03', 'user-1');

      expect(result.period).toBe('2026-03');
      expect(result.totalRecords).toBe(2);
      expect(result.mdaCount).toBe(2);
      expect(result.referenceNumbers).toHaveLength(2);
    });

    it('rejects confirm when unmatched MDA codes exist', async () => {
      vi.mocked(parseSubmissionFile).mockReturnValue([
        makePayrollRow({ mdaCode: 'UNKNOWN' }),
      ]);
      vi.mocked(resolveMdaByName).mockResolvedValue(null);

      await previewPayrollUpload(Buffer.from('test'), 'payroll.csv', 1000, 'user-1');

      await expect(
        confirmPayrollUpload('2026-03', 'user-1'),
      ).rejects.toThrow(/MDA/i);
    });

    it('rejects confirm when no pending upload exists', async () => {
      await expect(
        confirmPayrollUpload('2026-03', 'user-1'),
      ).rejects.toThrow(/pending/i);
    });

    it('clears preview cache after successful confirm', async () => {
      vi.mocked(parseSubmissionFile).mockReturnValue([
        makePayrollRow(),
      ]);

      await previewPayrollUpload(Buffer.from('test'), 'payroll.csv', 1000, 'user-1');
      await confirmPayrollUpload('2026-03', 'user-1');

      // Second confirm should fail — cache cleared
      await expect(
        confirmPayrollUpload('2026-03', 'user-1'),
      ).rejects.toThrow(/pending/i);
    });
  });

  // ─── Access Control ───────────────────────────────────────────────

  describe('access control', () => {
    it('service functions are callable (route-level auth tested in integration)', () => {
      // Access control is enforced at the route level via authorise(SUPER_ADMIN)
      // This test confirms the service functions are exported and callable
      expect(typeof previewPayrollUpload).toBe('function');
      expect(typeof confirmPayrollUpload).toBe('function');
    });
  });
});
