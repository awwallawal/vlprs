import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Hoisted mock state — accessible inside vi.mock factories
const {
  selectCallIdx, selectResults, mockTxSelect, mockTransaction, mockQueryChain,
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

  return { selectCallIdx: state, selectResults, mockTxSelect, mockTransaction, mockQueryChain };
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

vi.mock('../lib/email', () => ({
  sendHistoricalUploadConfirmation: vi.fn().mockResolvedValue(undefined),
  sendHistoricalVarianceAlert: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./submissionService', () => ({
  parseSubmissionCsv: vi.fn(),
  validateSubmissionRows: vi.fn().mockReturnValue({ validRows: [], errors: [] }),
  validateMdaCodes: vi.fn().mockResolvedValue({ mdaId: 'mda-1', errors: [] }),
  validateStaffIds: vi.fn().mockResolvedValue([]),
}));

import { validateHistoricalPeriods, crossValidateAgainstBaseline, processHistoricalUpload, flagDiscrepancy } from './historicalSubmissionService';
import { parseSubmissionCsv, validateSubmissionRows, validateStaffIds, validateMdaCodes } from './submissionService';

function makeRow(overrides: Partial<{ rowIndex: number; staffId: string; month: string; amountDeducted: string }> = {}) {
  return {
    rowIndex: overrides.rowIndex ?? 0,
    staffId: overrides.staffId ?? 'STAFF001',
    month: overrides.month ?? '2025-06',
    amountDeducted: overrides.amountDeducted ?? '15000.00',
    payrollBatchReference: 'PB001',
    mdaCode: 'MDA001',
    eventFlag: 'NONE',
    eventDate: null,
    cessationReason: null,
  };
}

describe('validateHistoricalPeriods', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectCallIdx.selectCallIdx = 0;
    selectResults.length = 0;
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('rejects rows with future period months (AC 2)', async () => {
    selectResults.push([]); // no existing confirmed submissions
    const rows = [{ rowIndex: 0, staffId: 'S001', month: '2026-05' }];
    const errors = await validateHistoricalPeriods(rows, 'mda-1');
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('future period');
  });

  it('rejects rows where current month is referenced with correct message', async () => {
    selectResults.push([]); // no existing
    const rows = [{ rowIndex: 0, staffId: 'S001', month: '2026-03' }];
    const errors = await validateHistoricalPeriods(rows, 'mda-1');
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('is the current period');
  });

  it('accepts rows for past months with no existing confirmed submission (AC 1)', async () => {
    selectResults.push([]); // no existing confirmed
    const rows = [{ rowIndex: 0, staffId: 'S001', month: '2025-06' }];
    const errors = await validateHistoricalPeriods(rows, 'mda-1');
    expect(errors).toHaveLength(0);
  });

  it('rejects rows where current-period confirmed submission exists (AC 2)', async () => {
    selectResults.push([{ staffId: 'S001', month: '2025-06' }]); // existing confirmed
    const rows = [{ rowIndex: 0, staffId: 'S001', month: '2025-06' }];
    const errors = await validateHistoricalPeriods(rows, 'mda-1');
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('current-period submission');
  });

  it('allows historical re-upload for same period (AC 3)', async () => {
    selectResults.push([]); // no confirmed non-historical
    const rows = [{ rowIndex: 0, staffId: 'S001', month: '2025-06' }];
    const errors = await validateHistoricalPeriods(rows, 'mda-1');
    expect(errors).toHaveLength(0);
  });

  it('duplicate check only considers confirmed non-historical submissions (AC 3, 6.20)', async () => {
    // Simulate: no confirmed non-historical submissions exist (historical or rejected are ignored)
    selectResults.push([]); // query returns empty — historical/rejected submissions don't block
    const rows = [{ rowIndex: 0, staffId: 'S001', month: '2025-06' }];
    const errors = await validateHistoricalPeriods(rows, 'mda-1');
    expect(errors).toHaveLength(0);
  });
});

describe('crossValidateAgainstBaseline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectCallIdx.selectCallIdx = 0;
    selectResults.length = 0;
  });

  it('returns matched when |difference| < 500 (AC 4)', async () => {
    selectResults.push([
      { staffId: 'S001', monthlyDeductionAmount: '15000.00', staff_name: 'John Doe' },
    ]);
    const rows = [{ staffId: 'S001', amountDeducted: '15200.00' }];
    const result = await crossValidateAgainstBaseline(rows, 'mda-1');
    expect(result.matchedCount).toBe(1);
    expect(result.varianceCount).toBe(0);
  });

  it('returns variance when |difference| >= 500 and tracks largest (AC 4)', async () => {
    selectResults.push([
      { staffId: 'S001', monthlyDeductionAmount: '15000.00', staff_name: 'John Doe' },
      { staffId: 'S002', monthlyDeductionAmount: '20000.00', staff_name: 'Jane Smith' },
    ]);
    const rows = [
      { staffId: 'S001', amountDeducted: '16000.00' },
      { staffId: 'S002', amountDeducted: '22000.00' },
    ];
    const result = await crossValidateAgainstBaseline(rows, 'mda-1');
    expect(result.varianceCount).toBe(2);
    expect(result.largestVarianceAmount).toBe('2000.00');
  });

  it('aligned (difference = 0) counts as matched (AC 4)', async () => {
    selectResults.push([
      { staffId: 'S001', monthlyDeductionAmount: '15000.00', staff_name: 'John' },
    ]);
    const rows = [{ staffId: 'S001', amountDeducted: '15000.00' }];
    const result = await crossValidateAgainstBaseline(rows, 'mda-1');
    expect(result.matchedCount).toBe(1);
    expect(result.varianceCount).toBe(0);
  });

  it('no baseline — returns noBaseline true with zero counts (AC 9)', async () => {
    selectResults.push([]);
    const rows = [{ staffId: 'S001', amountDeducted: '15000.00' }];
    const result = await crossValidateAgainstBaseline(rows, 'mda-1');
    expect(result.noBaseline).toBe(true);
    expect(result.matchedCount).toBe(0);
    expect(result.varianceCount).toBe(0);
    expect(result.details).toHaveLength(0);
  });

  it('boundary test: 499.99 → matched, 500.00 → variance', async () => {
    selectResults.push([
      { staffId: 'S001', monthlyDeductionAmount: '10000.00', staff_name: 'A' },
      { staffId: 'S002', monthlyDeductionAmount: '10000.00', staff_name: 'B' },
    ]);
    const rows = [
      { staffId: 'S001', amountDeducted: '10499.99' },
      { staffId: 'S002', amountDeducted: '10500.00' },
    ];
    const result = await crossValidateAgainstBaseline(rows, 'mda-1');
    expect(result.matchedCount).toBe(1);
    expect(result.varianceCount).toBe(1);
  });

  it('sums multiple loans per staff for baseline comparison', async () => {
    selectResults.push([
      { staffId: 'S001', monthlyDeductionAmount: '5000.00', staff_name: 'Multi-Loan' },
      { staffId: 'S001', monthlyDeductionAmount: '3000.00', staff_name: 'Multi-Loan' },
    ]);
    const rows = [{ staffId: 'S001', amountDeducted: '8000.00' }];
    const result = await crossValidateAgainstBaseline(rows, 'mda-1');
    expect(result.matchedCount).toBe(1);
  });
});

describe('processHistoricalUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectCallIdx.selectCallIdx = 0;
    selectResults.length = 0;
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('rejects upload with > 100 rows before processing (AC 7)', async () => {
    const rows = Array.from({ length: 101 }, (_, i) => makeRow({ rowIndex: i }));
    vi.mocked(parseSubmissionCsv).mockReturnValue(
      rows.map((r) => ({ rowNumber: r.rowIndex + 2, ...r })),
    );

    await expect(
      processHistoricalUpload(Buffer.from(''), null, 'user-1'),
    ).rejects.toThrow('100 rows');
  });

  it('rejects entire upload when any row fails validation (AC 6)', async () => {
    vi.mocked(parseSubmissionCsv).mockReturnValue([
      { rowNumber: 2, ...makeRow() },
    ]);
    vi.mocked(validateSubmissionRows).mockReturnValue({
      validRows: [],
      errors: [{ row: 0, field: 'staffId', message: 'Staff ID is required' }],
    });

    await expect(
      processHistoricalUpload(Buffer.from(''), null, 'user-1'),
    ).rejects.toThrow();
  });

  it('rejects staff not found in MDA loan portfolio (AC 8)', async () => {
    vi.mocked(parseSubmissionCsv).mockReturnValue([
      { rowNumber: 2, ...makeRow({ month: '2025-06' }) },
    ]);
    vi.mocked(validateSubmissionRows).mockReturnValue({ validRows: [], errors: [] });
    vi.mocked(validateStaffIds).mockResolvedValue([
      { row: 0, field: 'staffId', message: 'Staff ID STAFF001 not found in MDA loan portfolio' },
    ]);

    selectResults.push([]); // validateHistoricalPeriods: no existing

    await expect(
      processHistoricalUpload(Buffer.from(''), null, 'user-1'),
    ).rejects.toThrow();
  });

  it('rejects conditional field validation errors (AC 1 — Event Date when flag != NONE)', async () => {
    vi.mocked(parseSubmissionCsv).mockReturnValue([
      { rowNumber: 2, ...makeRow() },
    ]);
    vi.mocked(validateSubmissionRows).mockReturnValue({
      validRows: [],
      errors: [{ row: 0, field: 'eventDate', message: 'Event Date is required when Event Flag is not NONE' }],
    });

    await expect(
      processHistoricalUpload(Buffer.from(''), null, 'user-1'),
    ).rejects.toThrow();
  });

  it('forwards mdaScope to validateMdaCodes for MDA isolation (AC 8)', async () => {
    vi.mocked(parseSubmissionCsv).mockReturnValue([
      { rowNumber: 2, ...makeRow({ month: '2025-06' }) },
    ]);
    vi.mocked(validateSubmissionRows).mockReturnValue({ validRows: [], errors: [] });
    vi.mocked(validateMdaCodes).mockResolvedValue({ mdaId: 'mda-1', errors: [] });
    vi.mocked(validateStaffIds).mockResolvedValue([]);

    selectResults.push([]); // validateHistoricalPeriods
    selectResults.push([
      { staffId: 'STAFF001', monthlyDeductionAmount: '15000.00', staff_name: 'Test' },
    ]);
    mockTxSelect.mockImplementation(() => mockQueryChain([]));

    await processHistoricalUpload(Buffer.from(''), 'mda-scope-123', 'user-1');
    expect(vi.mocked(validateMdaCodes)).toHaveBeenCalledWith(
      expect.any(Array),
      'mda-scope-123',
    );
  });

  it('rejects mixed-period upload', async () => {
    vi.mocked(parseSubmissionCsv).mockReturnValue([
      { rowNumber: 2, ...makeRow({ month: '2025-06' }) },
      { rowNumber: 3, ...makeRow({ rowIndex: 1, month: '2025-07' }) },
    ]);
    vi.mocked(validateSubmissionRows).mockReturnValue({ validRows: [], errors: [] });

    await expect(
      processHistoricalUpload(Buffer.from(''), null, 'user-1'),
    ).rejects.toThrow();
  });

  it('generates reference number in BIR-YYYY-MM-NNNN format', async () => {
    vi.mocked(parseSubmissionCsv).mockReturnValue([
      { rowNumber: 2, ...makeRow({ month: '2025-06' }) },
    ]);
    vi.mocked(validateSubmissionRows).mockReturnValue({ validRows: [], errors: [] });
    vi.mocked(validateStaffIds).mockResolvedValue([]);

    selectResults.push([]); // validateHistoricalPeriods: no existing
    selectResults.push([
      { staffId: 'STAFF001', monthlyDeductionAmount: '15000.00', staff_name: 'Test' },
    ]);

    mockTxSelect.mockImplementation(() => mockQueryChain([]));

    const result = await processHistoricalUpload(Buffer.from(''), null, 'user-1');
    expect(result.referenceNumber).toMatch(/^BIR-2025-06-\d{4}$/);
  });

  it('returns noBaseline true when MDA has no migration data (AC 9)', async () => {
    vi.mocked(parseSubmissionCsv).mockReturnValue([
      { rowNumber: 2, ...makeRow({ month: '2025-06' }) },
    ]);
    vi.mocked(validateSubmissionRows).mockReturnValue({ validRows: [], errors: [] });
    vi.mocked(validateStaffIds).mockResolvedValue([]);

    selectResults.push([]); // period validation: clean
    selectResults.push([]); // cross-validation: no baseline

    mockTxSelect.mockImplementation(() => mockQueryChain([]));

    const result = await processHistoricalUpload(Buffer.from(''), null, 'user-1');
    expect(result.noBaseline).toBe(true);
    expect(result.matchedCount).toBe(0);
    expect(result.varianceCount).toBe(0);
  });
});

describe('flagDiscrepancy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectCallIdx.selectCallIdx = 0;
    selectResults.length = 0;
  });

  it('flags a discrepancy row and updates JSONB', async () => {
    // staffId validation check (outside transaction)
    selectResults.push([{ staffId: 'S001' }]);
    // transaction: submission lookup
    mockTxSelect.mockImplementationOnce(() => mockQueryChain([{
      id: 'sub-1',
      historicalReconciliation: {
        matchedCount: 5,
        varianceCount: 2,
        largestVarianceAmount: '1000.00',
        matchRate: 71.4,
        noBaseline: false,
        flaggedRows: [],
      },
    }]));

    await expect(
      flagDiscrepancy('sub-1', 'S001', 'Amount seems incorrect based on records', 'user-1', null),
    ).resolves.not.toThrow();
  });

  it('rejects flagging when staffId not in submission', async () => {
    // staffId validation check returns empty
    selectResults.push([]);

    await expect(
      flagDiscrepancy('sub-1', 'NONEXISTENT', 'Some reason for flagging', 'user-1', null),
    ).rejects.toThrow('not found in this submission');
  });

  it('rejects duplicate flag for same staffId (M4)', async () => {
    // staffId validation check (outside transaction)
    selectResults.push([{ staffId: 'S001' }]);
    // transaction: submission lookup — already flagged
    mockTxSelect.mockImplementationOnce(() => mockQueryChain([{
      id: 'sub-1',
      historicalReconciliation: {
        matchedCount: 5,
        varianceCount: 2,
        largestVarianceAmount: '1000.00',
        matchRate: 71.4,
        noBaseline: false,
        flaggedRows: [{ staffId: 'S001', reason: 'Already flagged', flaggedBy: 'user-2', flaggedAt: '2026-03-15T00:00:00Z' }],
      },
    }]));

    await expect(
      flagDiscrepancy('sub-1', 'S001', 'Trying to flag again', 'user-1', null),
    ).rejects.toThrow('already been flagged');
  });
});
