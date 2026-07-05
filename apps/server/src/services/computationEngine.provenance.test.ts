import { describe, it, expect } from 'vitest';
import { computeBalanceFromEntries, computeBalanceForLoan, deriveProvenance } from './computationEngine';
import type { LedgerEntryForBalance } from '@vlprs/shared';

const baselineEntry = (over: Partial<LedgerEntryForBalance> = {}): LedgerEntryForBalance => ({
  amount: '10000.00',
  principalComponent: '9000.00',
  interestComponent: '1000.00',
  entryType: 'MIGRATION_BASELINE',
  periodMonth: 1,
  periodYear: 2026,
  ...over,
});

describe('balance provenance (Story 17f.2)', () => {
  it('reports baseline basis with the latest period when only migration entries exist', () => {
    const result = computeBalanceFromEntries('500000', '13.33', 60, [
      baselineEntry({ periodMonth: 11, periodYear: 2025 }),
      baselineEntry({ periodMonth: 1, periodYear: 2026 }),
      baselineEntry({ entryType: 'ADJUSTMENT', periodMonth: 12, periodYear: 2025 }),
    ], null);
    expect(result.provenance).toEqual({ basis: 'baseline', latestEntryPeriod: '2026-01' });
  });

  it('reports live basis once any PAYROLL entry contributes', () => {
    const result = computeBalanceFromEntries('500000', '13.33', 60, [
      baselineEntry({ periodMonth: 1, periodYear: 2026 }),
      baselineEntry({ entryType: 'PAYROLL', periodMonth: 6, periodYear: 2026 }),
    ], null);
    expect(result.provenance).toEqual({ basis: 'live', latestEntryPeriod: '2026-06' });
  });

  it('reports none when no entries exist', () => {
    const result = computeBalanceFromEntries('500000', '13.33', 60, [], null);
    expect(result.provenance).toEqual({ basis: 'none', latestEntryPeriod: null });
  });

  it('omits the period (null) when entries carry no valid period fields', () => {
    const result = computeBalanceFromEntries('500000', '13.33', 60, [
      baselineEntry({ periodMonth: undefined, periodYear: undefined }),
    ], null);
    expect(result.provenance).toEqual({ basis: 'baseline', latestEntryPeriod: null });
  });

  it('ignores out-of-range month values (month-0 sentinel class) when picking the latest period', () => {
    const result = computeBalanceFromEntries('500000', '13.33', 60, [
      baselineEntry({ periodMonth: 0, periodYear: 2026 }),
      baselineEntry({ periodMonth: 11, periodYear: 2025 }),
    ], null);
    expect(result.provenance).toEqual({ basis: 'baseline', latestEntryPeriod: '2025-11' });
  });

  it('reports unknown on the aggregated totalPaid path — never guesses a basis', () => {
    const result = computeBalanceForLoan({
      limitedComputation: false,
      principalAmount: '500000',
      interestRate: '13.33',
      tenureMonths: 60,
      totalPaid: '120000.00',
    });
    expect(result.provenance).toEqual({ basis: 'unknown', latestEntryPeriod: null });
  });

  it('derives exact provenance on the limitedComputation path when entries are provided', () => {
    const result = computeBalanceForLoan({
      limitedComputation: true,
      principalAmount: '500000',
      interestRate: '13.33',
      tenureMonths: 60,
      asOfDate: null,
      entries: [baselineEntry({ periodMonth: 3, periodYear: 2026 })],
    });
    expect(result.provenance).toEqual({ basis: 'baseline', latestEntryPeriod: '2026-03' });
  });

  // Review fix: deriveProvenance is exported so subset aggregations
  // (at-risk / receivables sums) derive their OWN figure's basis — a
  // portfolio-wide 'live' must never caption a baseline-frozen subset.
  describe('deriveProvenance (exported, subset semantics)', () => {
    it('a baseline-only subset stays baseline regardless of what the wider portfolio contains', () => {
      const subsetEntries = [
        baselineEntry({ periodMonth: 12, periodYear: 2025 }),
        baselineEntry({ periodMonth: 1, periodYear: 2026 }),
      ];
      expect(deriveProvenance(subsetEntries)).toEqual({ basis: 'baseline', latestEntryPeriod: '2026-01' });
    });

    it('an empty subset reports none, not the portfolio basis', () => {
      expect(deriveProvenance([])).toEqual({ basis: 'none', latestEntryPeriod: null });
    });
  });
});
