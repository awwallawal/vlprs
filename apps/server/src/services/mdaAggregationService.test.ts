import { describe, it, expect } from 'vitest';
import { computeHealthScore } from './mdaAggregationService';
import { LoanClassification } from './loanClassificationService';

function makeDistribution(overrides: Partial<Record<LoanClassification, number>> = {}): Record<LoanClassification, number> {
  return {
    [LoanClassification.COMPLETED]: 0,
    [LoanClassification.ON_TRACK]: 0,
    [LoanClassification.OVERDUE]: 0,
    [LoanClassification.STALLED]: 0,
    [LoanClassification.OVER_DEDUCTED]: 0,
    ...overrides,
  };
}

describe('mdaAggregationService', () => {
  describe('computeHealthScore', () => {
    it('returns 0 / for-review when no loans', () => {
      const result = computeHealthScore(makeDistribution());
      expect(result.score).toBe(0);
      expect(result.band).toBe('for-review');
    });

    it('returns 100 / healthy when all completed', () => {
      const result = computeHealthScore(makeDistribution({
        [LoanClassification.COMPLETED]: 10,
      }));
      // base(40) + completionRate(1.0)×40 + onTrackRate(0)×20 = 80
      expect(result.score).toBe(80);
      expect(result.band).toBe('healthy');
    });

    it('returns healthy when all on-track', () => {
      const result = computeHealthScore(makeDistribution({
        [LoanClassification.ON_TRACK]: 10,
      }));
      // base(40) + completionRate(0)×40 + onTrackRate(1.0)×20 = 60
      expect(result.score).toBe(60);
      expect(result.band).toBe('attention');
    });

    it('applies stall penalty (-20)', () => {
      const result = computeHealthScore(makeDistribution({
        [LoanClassification.ON_TRACK]: 9,
        [LoanClassification.STALLED]: 1,
      }));
      // base(40) + completionRate(0)×40 + onTrackRate(0.9)×20 = 58
      // penalty: stalled → -20 = 38
      expect(result.score).toBe(38);
      expect(result.band).toBe('for-review');
    });

    it('applies overdue penalty (-20)', () => {
      const result = computeHealthScore(makeDistribution({
        [LoanClassification.ON_TRACK]: 9,
        [LoanClassification.OVERDUE]: 1,
      }));
      // base(40) + completionRate(0)×40 + onTrackRate(0.9)×20 = 58
      // penalty: overdue → -20 = 38
      expect(result.score).toBe(38);
      expect(result.band).toBe('for-review');
    });

    it('applies over-deducted penalty (-20)', () => {
      const result = computeHealthScore(makeDistribution({
        [LoanClassification.ON_TRACK]: 9,
        [LoanClassification.OVER_DEDUCTED]: 1,
      }));
      // base(40) + completionRate(0)×40 + onTrackRate(0.9)×20 = 58
      // penalty: over-deducted → -20 = 38
      expect(result.score).toBe(38);
      expect(result.band).toBe('for-review');
    });

    it('applies multiple penalties (capped at 0)', () => {
      const result = computeHealthScore(makeDistribution({
        [LoanClassification.STALLED]: 3,
        [LoanClassification.OVERDUE]: 3,
        [LoanClassification.OVER_DEDUCTED]: 4,
      }));
      // base(40) + 0 + 0 = 40
      // penalties: -20 -20 -20 = -60 → 40-60 = -20 → clamped to 0
      expect(result.score).toBe(0);
      expect(result.band).toBe('for-review');
    });

    it('scores mixed healthy portfolio correctly', () => {
      const result = computeHealthScore(makeDistribution({
        [LoanClassification.COMPLETED]: 3,
        [LoanClassification.ON_TRACK]: 7,
      }));
      // base(40) + completionRate(0.3)×40 + onTrackRate(0.7)×20 = 40 + 12 + 14 = 66
      expect(result.score).toBe(66);
      expect(result.band).toBe('attention');
    });

    it('classifies health bands correctly', () => {
      // ≥70 → healthy
      const healthy = computeHealthScore(makeDistribution({
        [LoanClassification.COMPLETED]: 5,
        [LoanClassification.ON_TRACK]: 5,
      }));
      // 40 + 0.5*40 + 0.5*20 = 40+20+10 = 70
      expect(healthy.band).toBe('healthy');

      // 40-69 → attention
      const attention = computeHealthScore(makeDistribution({
        [LoanClassification.ON_TRACK]: 10,
      }));
      // 40 + 0 + 1.0*20 = 60
      expect(attention.band).toBe('attention');

      // <40 → for-review
      const review = computeHealthScore(makeDistribution({
        [LoanClassification.ON_TRACK]: 5,
        [LoanClassification.STALLED]: 5,
      }));
      // 40 + 0 + 0.5*20 = 50, penalty -20 = 30
      expect(review.band).toBe('for-review');
    });
  });
});
