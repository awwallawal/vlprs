import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import {
  computeEffectiveRate,
  matchesKnownTier,
  isStandardRate,
  validateRecord,
  KNOWN_RATE_TIERS,
} from './migrationValidationService';

// ─── computeEffectiveRate ────────────────────────────────────────────

describe('computeEffectiveRate', () => {
  it('computes standard rate: (283325 - 250000) / 250000 × 100 = 13.33%', () => {
    const rate = computeEffectiveRate('250000', '283325');
    expect(rate).toBe('13.33');
  });

  it('computes 8.0% rate from OLANIYAN case: (485991 - 450000) / 450000', () => {
    const rate = computeEffectiveRate('450000', '485991');
    // (485991 - 450000) / 450000 × 100 = 7.998
    expect(rate).toBe('7.998');
  });

  it('computes 8.0% rate exact: (486000 - 450000) / 450000', () => {
    const rate = computeEffectiveRate('450000', '486000');
    expect(rate).toBe('8');
  });

  it('returns null for missing principal', () => {
    expect(computeEffectiveRate(null, '283325')).toBeNull();
  });

  it('returns null for missing totalLoan', () => {
    expect(computeEffectiveRate('250000', null)).toBeNull();
  });

  it('returns null for zero principal', () => {
    expect(computeEffectiveRate('0', '283325')).toBeNull();
  });

  it('returns null for empty strings', () => {
    expect(computeEffectiveRate('', '')).toBeNull();
  });

  it('returns null for invalid numeric strings', () => {
    expect(computeEffectiveRate('abc', '283325')).toBeNull();
  });
});

// ─── Rate Tier Matching ──────────────────────────────────────────────

describe('matchesKnownTier', () => {
  it('matches standard rate 13.33', () => {
    expect(matchesKnownTier('13.33')).toBe(true);
  });

  it('matches 8.0% tier within tolerance', () => {
    expect(matchesKnownTier('7.998')).toBe(true); // OLANIYAN case
  });

  it('matches each known tier exactly', () => {
    for (const tier of KNOWN_RATE_TIERS) {
      expect(matchesKnownTier(String(tier))).toBe(true);
    }
  });

  it('matches tiers within tolerance', () => {
    expect(matchesKnownTier('13.5')).toBe(true); // 13.33 + 0.17
    expect(matchesKnownTier('12.9')).toBe(true); // 13.33 - 0.43
  });

  it('does not match rates outside any tier', () => {
    expect(matchesKnownTier('5.0')).toBe(false);
    expect(matchesKnownTier('15.0')).toBe(false);
    expect(matchesKnownTier('9.5')).toBe(false); // between 8.89 and 10.66
  });
});

describe('isStandardRate', () => {
  it('identifies standard rate', () => {
    expect(isStandardRate('13.33')).toBe(true);
    expect(isStandardRate('13.330')).toBe(true);
  });

  it('identifies within tolerance', () => {
    expect(isStandardRate('13.5')).toBe(true);
    expect(isStandardRate('12.9')).toBe(true);
  });

  it('rejects non-standard rates', () => {
    expect(isStandardRate('8.0')).toBe(false);
    expect(isStandardRate('11.11')).toBe(false);
  });
});

// ─── validateRecord ──────────────────────────────────────────────────

describe('validateRecord', () => {
  it('categorises clean record with matching values (250K, 13.33%, 60mo)', () => {
    // Hand-computed: 250000 × 13.33% = 33325 total interest → 283325 total loan
    // Monthly: 283325 / 60 = 4722.08333 → 4722.08 (but engine rounds differently)
    const result = validateRecord({
      id: 'test-1',
      principal: '250000.00',
      totalLoan: '283325.00',
      monthlyDeduction: '4722.09', // engine computes 4166.67 + 555.42 = 4722.09
      outstandingBalance: null,
      installmentCount: 60,
      installmentsPaid: null,
      installmentsOutstanding: null,
      interestTotal: '33325.00',
    });

    expect(result.varianceCategory).toBe('clean');
    expect(result.hasRateVariance).toBe(false);
    expect(result.computedRate).toBe('13.33');
  });

  it('categorises minor variance (small difference)', () => {
    // Introduce a small difference in totalLoan (Δ₦100)
    const result = validateRecord({
      id: 'test-2',
      principal: '250000.00',
      totalLoan: '283425.00', // 100 more than computed 283325
      monthlyDeduction: '4722.09',
      outstandingBalance: null,
      installmentCount: 60,
      installmentsPaid: null,
      installmentsOutstanding: null,
      interestTotal: null,
    });

    // Rate: (283425 - 250000) / 250000 × 100 = 13.37 → still within standard tolerance
    expect(result.varianceCategory).toBe('minor_variance');
    expect(new Decimal(result.varianceAmount).gte(1)).toBe(true);
    expect(new Decimal(result.varianceAmount).lt(500)).toBe(true);
  });

  it('categorises significant variance (large difference >= 500)', () => {
    // Introduce a large difference
    const result = validateRecord({
      id: 'test-3',
      principal: '250000.00',
      totalLoan: '284000.00', // 675 more than computed 283325
      monthlyDeduction: '4722.09',
      outstandingBalance: null,
      installmentCount: 60,
      installmentsPaid: null,
      installmentsOutstanding: null,
      interestTotal: null,
    });

    expect(result.varianceCategory).toBe('significant_variance');
    expect(new Decimal(result.varianceAmount).gte(500)).toBe(true);
  });

  it('detects rate variance for 8.0% tier', () => {
    // OLANIYAN case: 450K principal, 8.0% rate
    const result = validateRecord({
      id: 'test-olaniyan',
      principal: '450000.00',
      totalLoan: '486000.00', // 450000 × 1.08 = 486000
      monthlyDeduction: '8100.00', // 486000 / 60
      outstandingBalance: null,
      installmentCount: 60,
      installmentsPaid: null,
      installmentsOutstanding: null,
      interestTotal: null,
    });

    expect(result.hasRateVariance).toBe(true);
    expect(result.computedRate).toBe('8');
    // Rate matches known tier, so should compute with 8.0% rate
    expect(result.varianceCategory).not.toBe('structural_error');
  });

  it('categorises structural error for unknown rate', () => {
    // Fake rate that doesn't match any tier: 5.0%
    const result = validateRecord({
      id: 'test-unknown-rate',
      principal: '200000.00',
      totalLoan: '210000.00', // 200000 × 1.05 = 210000 → 5.0% (not in any tier)
      monthlyDeduction: null,
      outstandingBalance: null,
      installmentCount: null,
      installmentsPaid: null,
      installmentsOutstanding: null,
      interestTotal: null,
    });

    expect(result.varianceCategory).toBe('structural_error');
    expect(result.hasRateVariance).toBe(true);
    // Structural errors now still compute values for admin comparison
    expect(result.computedTotalLoan).not.toBeNull();
  });

  it('categorises anomalous when no financial data present', () => {
    const result = validateRecord({
      id: 'test-empty',
      principal: null,
      totalLoan: null,
      monthlyDeduction: null,
      outstandingBalance: null,
      installmentCount: null,
      installmentsPaid: null,
      installmentsOutstanding: null,
      interestTotal: null,
    });

    expect(result.varianceCategory).toBe('anomalous');
  });

  it('handles missing principal gracefully (cannot compute rate)', () => {
    const result = validateRecord({
      id: 'test-no-principal',
      principal: null,
      totalLoan: '283325.00',
      monthlyDeduction: '4722.09',
      outstandingBalance: null,
      installmentCount: null,
      installmentsPaid: null,
      installmentsOutstanding: null,
      interestTotal: null,
    });

    // Can't compute rate or full schedule without principal
    expect(result.computedRate).toBeNull();
    expect(result.varianceCategory).toBe('anomalous');
  });

  it('handles missing totalLoan — validates with principal only', () => {
    // Has principal but no totalLoan, computation engine uses default rate
    const result = validateRecord({
      id: 'test-no-total',
      principal: '250000.00',
      totalLoan: null,
      monthlyDeduction: '4722.09',
      outstandingBalance: null,
      installmentCount: 60,
      installmentsPaid: null,
      installmentsOutstanding: null,
      interestTotal: null,
    });

    // Rate cannot be computed (no totalLoan), but schedule can be computed
    expect(result.computedRate).toBeNull();
    // Should still compute using standard rate and compare monthlyDeduction
    expect(result.varianceCategory).not.toBe('anomalous');
  });

  it('infers tenure from monthlyDeduction and totalLoan when installmentCount missing', () => {
    // totalLoan: 283325, monthlyDeduction: 4722.09 → tenure = ceil(283325 / 4722.09) = 60
    const result = validateRecord({
      id: 'test-infer-tenure',
      principal: '250000.00',
      totalLoan: '283325.00',
      monthlyDeduction: '4722.09',
      outstandingBalance: null,
      installmentCount: null,
      installmentsPaid: null,
      installmentsOutstanding: null,
      interestTotal: null,
    });

    expect(result.varianceCategory).toBe('clean');
    expect(result.computedRate).toBe('13.33');
  });

  it('uses default 60-month tenure when no data to infer', () => {
    const result = validateRecord({
      id: 'test-default-tenure',
      principal: '250000.00',
      totalLoan: '283325.00',
      monthlyDeduction: null,
      outstandingBalance: null,
      installmentCount: null,
      installmentsPaid: null,
      installmentsOutstanding: null,
      interestTotal: null,
    });

    // With 60mo default and 13.33% rate, computed totalLoan matches declared
    expect(result.varianceCategory).toBe('clean');
  });

  it('computes outstanding balance when installmentsPaid is present', () => {
    const result = validateRecord({
      id: 'test-balance',
      principal: '250000.00',
      totalLoan: '283325.00',
      monthlyDeduction: '4722.09',
      outstandingBalance: '278602.91', // after 1 payment
      installmentCount: 60,
      installmentsPaid: 1,
      installmentsOutstanding: 59,
      interestTotal: '33325.00',
    });

    expect(result.varianceCategory).toBe('clean');
    expect(result.computedOutstandingBalance).toBe('278602.91');
  });
});
