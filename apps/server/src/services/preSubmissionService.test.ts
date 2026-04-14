/**
 * Pre-Submission Service unit tests — Story 8.0i correction-aware flag reading.
 * Tests that event flag corrections propagate to zero-deduction alerts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/index', () => ({
  // db.execute is used by getPendingEvents (UAT #24/#25) — default to zero-count rows
  db: {
    select: vi.fn(),
    execute: vi.fn().mockResolvedValue({ rows: [{ count: 0 }] }),
  },
}));

// Story 8.0i: Mock the effective event flag helper
const mockGetEffectiveEventFlags = vi.fn().mockResolvedValue(new Map());
vi.mock('./effectiveEventFlagHelper', () => ({
  getEffectiveEventFlags: (...args: unknown[]) => mockGetEffectiveEventFlags(...args),
}));

import { db } from '../db/index';
import { getCheckpointData } from './preSubmissionService';

// Helper to build thenable mock query chain
function mockQueryChain(result: unknown[]) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.from = vi.fn(self);
  chain.where = vi.fn(self);
  chain.limit = vi.fn(self);
  chain.orderBy = vi.fn(self);
  chain.innerJoin = vi.fn(self);
  chain.groupBy = vi.fn(self);
  chain.then = (resolve: (v: unknown) => void) => Promise.resolve(result).then(resolve);
  return chain;
}

describe('preSubmissionService — correction-aware zero-deduction alerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Mock sequence for getCheckpointData:
   *  1. getApproachingRetirement → loans query
   *  2. getZeroDeductionAlerts:
   *     a. zeroNoneRows (eventFlag = NONE, amount = 0)
   *     b. zeroEventRows (eventFlag != NONE, amount = 0) — supplementary
   *     c. missingRows (loans NOT IN submission_rows)
   *     d. deductionRows (last non-zero deduction) — only if zeroStaffIds > 0
   *  3. getLastSubmissionDate → mdaSubmissions query
   *  4. getPendingEvents → returns [] (no DB call)
   */
  function setupMocks(options: {
    zeroNoneRows?: Array<{ id: string; staffId: string; staffName: string; month: string; eventFlag: string }>;
    zeroEventRows?: Array<{ id: string; staffId: string; staffName: string; month: string; eventFlag: string }>;
  }) {
    const { zeroNoneRows = [], zeroEventRows = [] } = options;
    const hasZeroStaff = zeroNoneRows.length > 0 || zeroEventRows.length > 0;

    let callCount = 0;
    (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // getApproachingRetirement → empty
        return mockQueryChain([]);
      } else if (callCount === 2) {
        // zeroNoneRows
        return mockQueryChain(zeroNoneRows);
      } else if (callCount === 3) {
        // zeroEventRows (supplementary)
        return mockQueryChain(zeroEventRows);
      } else if (callCount === 4) {
        // missingRows → empty
        return mockQueryChain([]);
      } else if (callCount === 5 && hasZeroStaff) {
        // deductionRows (last non-zero deduction lookup) → empty
        return mockQueryChain([]);
      } else {
        // getLastSubmissionDate → null (empty result)
        return mockQueryChain([]);
      }
    });
  }

  it('correction NONE→RETIREMENT removes staff from zero-deduction list (AC 4)', async () => {
    // Staff has NONE flag + zero deduction, but correction changes it to RETIREMENT
    mockGetEffectiveEventFlags.mockResolvedValueOnce(
      new Map([['sr-1', 'RETIREMENT']]),
    );

    setupMocks({
      zeroNoneRows: [
        { id: 'sr-1', staffId: 'STF001', staffName: 'Ayo Balogun', month: '2026-03', eventFlag: 'NONE' },
      ],
    });

    const result = await getCheckpointData('mda-1');

    // Staff should be REMOVED from zero-deduction list (has effective event flag)
    expect(result.zeroDeduction).toHaveLength(0);
  });

  it('no corrections → behavior unchanged (AC 6)', async () => {
    // No corrections → staff with NONE flag + zero deduction appears in list
    mockGetEffectiveEventFlags.mockResolvedValueOnce(new Map());

    setupMocks({
      zeroNoneRows: [
        { id: 'sr-2', staffId: 'STF002', staffName: 'Bola Taiwo', month: '2026-03', eventFlag: 'NONE' },
      ],
    });

    const result = await getCheckpointData('mda-1');

    // Staff should remain in zero-deduction list
    expect(result.zeroDeduction).toHaveLength(1);
    expect(result.zeroDeduction[0].staffId).toBe('STF002');
  });
});
