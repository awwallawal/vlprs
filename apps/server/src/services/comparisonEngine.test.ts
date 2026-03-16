import { describe, it, expect, vi, beforeEach } from 'vitest';
// Mock the DB module before importing the service
vi.mock('../db/index', () => ({
  db: {
    select: vi.fn(),
  },
}));

import { db } from '../db/index';
import { compareSubmission } from './comparisonEngine';

// Helper to build a mock query chain.
// Drizzle chains are thenable — each method returns the chain,
// and the chain itself resolves when awaited.
function mockQueryChain(result: unknown[]) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.from = vi.fn(self);
  chain.where = vi.fn(self);
  chain.limit = vi.fn(self);
  chain.orderBy = vi.fn(self);
  // Make the chain thenable (awaitable)
  chain.then = (resolve: (v: unknown) => void) => Promise.resolve(result).then(resolve);
  return chain;
}

describe('compareSubmission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupMocks(options: {
    submission?: { id: string; mdaId: string; referenceNumber: string } | null;
    rows?: Array<{ staffId: string; amountDeducted: string; eventFlag: string; cessationReason: string | null }>;
    activeLoanRows?: Array<{ staffId: string; monthlyDeductionAmount: string }>;
  }) {
    const {
      submission = { id: 'sub-1', mdaId: 'mda-1', referenceNumber: 'BIR-2026-03-0001' },
      rows = [],
      activeLoanRows = [],
    } = options;

    let callCount = 0;
    (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // First call: submission header lookup
        return mockQueryChain(submission ? [submission] : []);
      } else if (callCount === 2) {
        // Second call: submission rows
        return mockQueryChain(rows);
      } else {
        // Third call: active loans lookup
        return mockQueryChain(activeLoanRows);
      }
    });
  }

  it('returns all aligned when amounts match exactly', async () => {
    setupMocks({
      rows: [
        { staffId: '3301', amountDeducted: '18333.33', eventFlag: 'NONE', cessationReason: null },
        { staffId: '3302', amountDeducted: '15000.00', eventFlag: 'NONE', cessationReason: null },
      ],
      activeLoanRows: [
        { staffId: '3301', monthlyDeductionAmount: '18333.33' },
        { staffId: '3302', monthlyDeductionAmount: '15000.00' },
      ],
    });

    const result = await compareSubmission('sub-1', null);

    expect(result.summary.alignedCount).toBe(2);
    expect(result.summary.minorVarianceCount).toBe(0);
    expect(result.summary.varianceCount).toBe(0);
    expect(result.summary.totalRecords).toBe(2);
    expect(result.summary.rows).toHaveLength(0); // Aligned rows not included in detail
  });

  it('detects minor variance (< ₦500 difference)', async () => {
    setupMocks({
      rows: [
        { staffId: '3301', amountDeducted: '18500.00', eventFlag: 'NONE', cessationReason: null },
      ],
      activeLoanRows: [
        { staffId: '3301', monthlyDeductionAmount: '18333.33' },
      ],
    });

    const result = await compareSubmission('sub-1', null);

    expect(result.summary.alignedCount).toBe(0);
    expect(result.summary.minorVarianceCount).toBe(1);
    expect(result.summary.varianceCount).toBe(0);
    expect(result.summary.rows).toHaveLength(1);
    expect(result.summary.rows[0].category).toBe('minor_variance');
    expect(result.summary.rows[0].staffId).toBe('3301');
  });

  it('detects significant variance (>= ₦500 difference)', async () => {
    setupMocks({
      rows: [
        { staffId: '3301', amountDeducted: '14166.67', eventFlag: 'NONE', cessationReason: null },
      ],
      activeLoanRows: [
        { staffId: '3301', monthlyDeductionAmount: '18333.33' },
      ],
    });

    const result = await compareSubmission('sub-1', null);

    expect(result.summary.alignedCount).toBe(0);
    expect(result.summary.minorVarianceCount).toBe(0);
    expect(result.summary.varianceCount).toBe(1);
    expect(result.summary.rows).toHaveLength(1);
    expect(result.summary.rows[0].category).toBe('variance');
    expect(result.summary.rows[0].difference).toBe('-4166.66');
    expect(result.summary.rows[0].explanation).toContain('₦14,166.67');
    expect(result.summary.rows[0].explanation).toContain('₦18,333.33');
    expect(result.summary.rows[0].explanation).toContain('₦4,166.66');
  });

  it('marks staff ID not found as variance', async () => {
    setupMocks({
      rows: [
        { staffId: 'UNKNOWN-001', amountDeducted: '10000.00', eventFlag: 'NONE', cessationReason: null },
      ],
      activeLoanRows: [], // No matching loans
    });

    const result = await compareSubmission('sub-1', null);

    expect(result.summary.varianceCount).toBe(1);
    expect(result.summary.rows).toHaveLength(1);
    expect(result.summary.rows[0].category).toBe('variance');
    expect(result.summary.rows[0].explanation).toContain('No matching loan record found');
    expect(result.summary.rows[0].explanation).toContain('UNKNOWN-001');
    expect(result.summary.rows[0].expectedAmount).toBe('0.00');
  });

  it('skips rows with event flag != NONE', async () => {
    setupMocks({
      rows: [
        { staffId: '3301', amountDeducted: '18333.33', eventFlag: 'NONE', cessationReason: null },
        { staffId: '3302', amountDeducted: '5000.00', eventFlag: 'RETIREMENT', cessationReason: null },
      ],
      activeLoanRows: [
        { staffId: '3301', monthlyDeductionAmount: '18333.33' },
      ],
    });

    const result = await compareSubmission('sub-1', null);

    // 3301 aligned + 3302 skipped (counted as aligned)
    expect(result.summary.alignedCount).toBe(2);
    expect(result.summary.totalRecords).toBe(2);
    expect(result.summary.rows).toHaveLength(0);
  });

  it('skips cessation rows (amount = ₦0 with cessation reason)', async () => {
    setupMocks({
      rows: [
        { staffId: '3301', amountDeducted: '18333.33', eventFlag: 'NONE', cessationReason: null },
        { staffId: '3302', amountDeducted: '0.00', eventFlag: 'NONE', cessationReason: 'Voluntary cessation' },
      ],
      activeLoanRows: [
        { staffId: '3301', monthlyDeductionAmount: '18333.33' },
      ],
    });

    const result = await compareSubmission('sub-1', null);

    expect(result.summary.alignedCount).toBe(2); // 1 matched + 1 skipped
    expect(result.summary.totalRecords).toBe(2);
    expect(result.summary.rows).toHaveLength(0);
  });

  it('uses decimal.js precision (no floating-point drift)', async () => {
    // 0.1 + 0.2 famously !== 0.3 in JS float arithmetic
    setupMocks({
      rows: [
        { staffId: '3301', amountDeducted: '0.30', eventFlag: 'NONE', cessationReason: null },
      ],
      activeLoanRows: [
        { staffId: '3301', monthlyDeductionAmount: '0.30' },
      ],
    });

    const result = await compareSubmission('sub-1', null);

    expect(result.summary.alignedCount).toBe(1);
    expect(result.summary.varianceCount).toBe(0);
  });

  it('formats explanation string correctly', async () => {
    setupMocks({
      rows: [
        { staffId: '3301', amountDeducted: '14166.67', eventFlag: 'NONE', cessationReason: null },
      ],
      activeLoanRows: [
        { staffId: '3301', monthlyDeductionAmount: '18333.33' },
      ],
    });

    const result = await compareSubmission('sub-1', null);
    const row = result.summary.rows[0];

    expect(row.explanation).toBe(
      'Declared ₦14,166.67 vs expected ₦18,333.33 — difference of ₦4,166.66',
    );
  });

  it('aggregates multiple active loans for same staff', async () => {
    setupMocks({
      rows: [
        { staffId: '3301', amountDeducted: '30000.00', eventFlag: 'NONE', cessationReason: null },
      ],
      activeLoanRows: [
        { staffId: '3301', monthlyDeductionAmount: '18333.33' },
        { staffId: '3301', monthlyDeductionAmount: '11666.67' },
      ],
    });

    const result = await compareSubmission('sub-1', null);

    // 18333.33 + 11666.67 = 30000.00 — exact match
    expect(result.summary.alignedCount).toBe(1);
    expect(result.summary.varianceCount).toBe(0);
    expect(result.summary.rows).toHaveLength(0);
  });

  it('throws 404 when submission not found', async () => {
    setupMocks({ submission: null });

    await expect(compareSubmission('nonexistent', null)).rejects.toThrow('Submission not found');
  });

  it('handles mixed categories correctly', async () => {
    setupMocks({
      rows: [
        { staffId: '3301', amountDeducted: '18333.33', eventFlag: 'NONE', cessationReason: null }, // aligned
        { staffId: '3302', amountDeducted: '15200.00', eventFlag: 'NONE', cessationReason: null }, // minor (200 diff)
        { staffId: '3303', amountDeducted: '10000.00', eventFlag: 'NONE', cessationReason: null }, // variance (5000 diff)
        { staffId: '3304', amountDeducted: '5000.00', eventFlag: 'TRANSFER_OUT', cessationReason: null }, // skipped
      ],
      activeLoanRows: [
        { staffId: '3301', monthlyDeductionAmount: '18333.33' },
        { staffId: '3302', monthlyDeductionAmount: '15000.00' },
        { staffId: '3303', monthlyDeductionAmount: '15000.00' },
      ],
    });

    const result = await compareSubmission('sub-1', null);

    expect(result.summary.alignedCount).toBe(2); // 1 matched + 1 skipped
    expect(result.summary.minorVarianceCount).toBe(1);
    expect(result.summary.varianceCount).toBe(1);
    expect(result.summary.totalRecords).toBe(4);
    expect(result.summary.rows).toHaveLength(2); // minor + variance rows only
  });
});
