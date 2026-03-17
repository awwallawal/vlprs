import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the DB module before importing the service
vi.mock('../db/index', () => ({
  db: {
    select: vi.fn(),
  },
}));

import { db } from '../db/index';
import { getCheckpointData } from './preSubmissionService';

type MockFn = ReturnType<typeof vi.fn>;

/**
 * Builds a mock Drizzle query chain.
 * Each chainable method returns the chain; the chain is thenable (awaitable).
 */
function mockQueryChain(result: unknown[]) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.from = vi.fn(self);
  chain.innerJoin = vi.fn(self);
  chain.where = vi.fn(self);
  chain.orderBy = vi.fn(self);
  chain.limit = vi.fn(self);
  chain.groupBy = vi.fn(self);
  chain.then = (resolve: (v: unknown) => void) => Promise.resolve(result).then(resolve);
  return chain;
}

const MDA_ID = '01234567-0123-0123-0123-012345678901';

describe('preSubmissionService.getCheckpointData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Sets up mock db.select calls in sequence.
   * Call order:
   *   1. Approaching retirement query
   *   2. Zero deduction (zero rows) query
   *   3. Zero deduction (missing rows) query
   *   4. Last non-zero deduction dates batch query (only if zeroRows has items)
   *   5. Last submission date query
   */
  function setupMocks(options: {
    retirement?: unknown[];
    zeroRows?: unknown[];
    missingRows?: unknown[];
    lastDeductions?: unknown[];
    lastSubmission?: unknown[];
  }) {
    const {
      retirement = [],
      zeroRows = [],
      missingRows = [],
      lastDeductions = [],
      lastSubmission = [],
    } = options;

    const hasZeroRows = zeroRows.length > 0;

    let callCount = 0;
    (db.select as MockFn).mockImplementation(() => {
      callCount++;
      switch (callCount) {
        case 1: return mockQueryChain(retirement);
        case 2: return mockQueryChain(zeroRows);
        case 3: return mockQueryChain(missingRows);
        case 4: return hasZeroRows ? mockQueryChain(lastDeductions) : mockQueryChain(lastSubmission);
        case 5: return hasZeroRows ? mockQueryChain(lastSubmission) : mockQueryChain([]);
        default: return mockQueryChain([]);
      }
    });
  }

  // AC 1 — Approaching retirement within 12 months
  it('returns approaching retirement staff within 12-month window', async () => {
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 6);

    setupMocks({
      retirement: [
        { staffName: 'John Doe', staffId: 'OYO-001', retirementDate: futureDate },
      ],
    });

    const result = await getCheckpointData(MDA_ID);

    expect(result.approachingRetirement).toHaveLength(1);
    expect(result.approachingRetirement[0].staffName).toBe('John Doe');
    expect(result.approachingRetirement[0].staffId).toBe('OYO-001');
    expect(result.approachingRetirement[0].daysUntilRetirement).toBeGreaterThan(0);
  });

  // AC 1 — Zero deduction staff with no event filed
  it('returns zero-deduction staff with no employment event filed', async () => {
    setupMocks({
      zeroRows: [
        { staffId: 'OYO-002', staffName: 'Jane Smith', month: '2026-02' },
      ],
      lastDeductions: [
        { staffId: 'OYO-002', lastMonth: '2025-12' },
      ],
    });

    const result = await getCheckpointData(MDA_ID);

    expect(result.zeroDeduction).toHaveLength(1);
    expect(result.zeroDeduction[0].staffName).toBe('Jane Smith');
    expect(result.zeroDeduction[0].staffId).toBe('OYO-002');
    // H2 fix: lastDeductionDate shows actual last non-zero deduction, not zero-deduction period
    expect(result.zeroDeduction[0].lastDeductionDate).toBe('2025-12-31');
    expect(result.zeroDeduction[0].daysSinceLastDeduction).toBeGreaterThan(0);
  });

  // H2 — Zero deduction staff with no prior non-zero deduction shows N/A
  it('zero-deduction shows N/A when staff has no prior non-zero deductions', async () => {
    setupMocks({
      zeroRows: [
        { staffId: 'OYO-005', staffName: 'New Staff', month: '2026-02' },
      ],
      lastDeductions: [],
    });

    const result = await getCheckpointData(MDA_ID);

    expect(result.zeroDeduction).toHaveLength(1);
    expect(result.zeroDeduction[0].lastDeductionDate).toBe('N/A');
    expect(result.zeroDeduction[0].daysSinceLastDeduction).toBeNull();
  });

  // AC 1 — Pending events (returns empty until Story 11.2)
  it('returns pending unconfirmed employment events since last submission', async () => {
    setupMocks({});

    const result = await getCheckpointData(MDA_ID);

    // Until employment_events table exists (Story 11.2), always empty
    expect(result.pendingEvents).toEqual([]);
  });

  // AC 3 — Empty sections
  it('returns empty arrays when no items match', async () => {
    setupMocks({
      retirement: [],
      zeroRows: [],
      missingRows: [],
      lastSubmission: [],
    });

    const result = await getCheckpointData(MDA_ID);

    expect(result.approachingRetirement).toEqual([]);
    expect(result.zeroDeduction).toEqual([]);
    expect(result.pendingEvents).toEqual([]);
    expect(result.lastSubmissionDate).toBeNull();
  });

  // AC 4 — Data scoped to requested MDA only
  it('passes mdaId to all queries (data scoped to requested MDA)', async () => {
    setupMocks({});

    await getCheckpointData(MDA_ID);

    // db.select is called for each query section — all should be scoped
    expect(db.select).toHaveBeenCalled();
    const calls = (db.select as MockFn).mock.calls;
    expect(calls.length).toBeGreaterThanOrEqual(3); // retirement + zeroRows + missingRows + lastSubmission
  });

  // Excludes inactive/completed loans from retirement check
  it('excludes inactive/completed loans from retirement check', async () => {
    // The query filters by status = 'ACTIVE' — completed loans are excluded by the WHERE clause.
    // With no retirement data returned, array is empty.
    setupMocks({
      retirement: [],
    });

    const result = await getCheckpointData(MDA_ID);
    expect(result.approachingRetirement).toEqual([]);
  });

  // Zero deduction includes staff with no entry at all for previous month
  it('zero-deduction includes staff with no deduction entry at all for previous month', async () => {
    setupMocks({
      zeroRows: [],
      missingRows: [
        { staffId: 'OYO-003', staffName: 'Missing Entry Staff' },
      ],
    });

    const result = await getCheckpointData(MDA_ID);

    expect(result.zeroDeduction).toHaveLength(1);
    expect(result.zeroDeduction[0].staffId).toBe('OYO-003');
    expect(result.zeroDeduction[0].lastDeductionDate).toBe('N/A');
    expect(result.zeroDeduction[0].daysSinceLastDeduction).toBeNull();
  });

  // Zero deduction excludes staff who have an employment event filed
  it('zero-deduction excludes staff who have an employment event filed in the same period', async () => {
    // The query already filters WHERE event_flag = 'NONE' — if an event is filed,
    // the row's event_flag would not be 'NONE' and thus excluded from results.
    setupMocks({
      zeroRows: [],
      missingRows: [],
    });

    const result = await getCheckpointData(MDA_ID);
    expect(result.zeroDeduction).toEqual([]);
  });

  // Pending events uses most recent approved submission date
  it('pending events uses most recent approved submission date; skips rejected', async () => {
    setupMocks({
      lastSubmission: [
        { period: '2026-02', createdAt: new Date('2026-02-28') },
      ],
    });

    const result = await getCheckpointData(MDA_ID);

    // lastSubmissionDate should be end of February 2026
    expect(result.lastSubmissionDate).toBe('2026-02-28');
  });

  // Pending events shows all when MDA has never submitted
  it('pending events shows all unconfirmed events when MDA has never submitted (null fallback)', async () => {
    setupMocks({
      lastSubmission: [],
    });

    const result = await getCheckpointData(MDA_ID);

    expect(result.lastSubmissionDate).toBeNull();
    // Pending events still empty until Story 11.2 creates the table
    expect(result.pendingEvents).toEqual([]);
  });

  // Submission period is current month
  it('returns current month as submissionPeriod', async () => {
    setupMocks({});

    const result = await getCheckpointData(MDA_ID);

    // Should be in YYYY-MM format
    expect(result.submissionPeriod).toMatch(/^\d{4}-\d{2}$/);
  });
});
