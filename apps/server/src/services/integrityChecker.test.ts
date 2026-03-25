import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getIntegrityResults, getBusinessHealthResults, resetCache, runCheckOnce, startIntegrityChecker } from './integrityChecker';
import { db } from '../db/index.js';

// Mock the database
vi.mock('../db/index.js', () => ({
  db: {
    execute: vi.fn().mockResolvedValue({ rows: [{ count: 0, total_active: 10, covered_count: 7 }] }),
  },
}));

// Mock env to be 'test'
vi.mock('../config/env.js', () => ({
  env: { NODE_ENV: 'test' },
}));

describe('integrityChecker', () => {
  beforeEach(() => {
    resetCache();
    vi.mocked(db.execute).mockResolvedValue({ rows: [{ count: 0, total_active: 10, covered_count: 7 }] });
  });

  describe('getIntegrityResults', () => {
    it('returns null results when no check has run', () => {
      const { results, lastChecked } = getIntegrityResults();
      expect(results).toBeNull();
      expect(lastChecked).toBeNull();
    });

    it('returns cached results after runCheckOnce', async () => {
      await runCheckOnce();
      const { results, lastChecked } = getIntegrityResults();
      expect(results).not.toBeNull();
      expect(lastChecked).toBeInstanceOf(Date);

      // Ledger immutability is always green (structural assertion)
      expect(results!.ledgerImmutability.count).toBe(0);
      expect(results!.ledgerImmutability.status).toBe('green');
      expect(results!.ledgerImmutability.details).toContain('Append-only');

      // Migration and observation counts come from mocked DB (returns 0)
      expect(results!.migrationRecordIntegrity.count).toBe(0);
      expect(results!.pendingObservations.count).toBe(0);
    });
  });

  describe('getBusinessHealthResults', () => {
    it('returns null results when no check has run', () => {
      const { results } = getBusinessHealthResults();
      expect(results).toBeNull();
    });

    it('returns cached business health after runCheckOnce', async () => {
      await runCheckOnce();
      const { results } = getBusinessHealthResults();
      expect(results).not.toBeNull();

      // Coverage comes from mocked DB
      expect(results!.mdaSubmissionCoverage).toBeDefined();
      expect(typeof results!.mdaSubmissionCoverage.percent).toBe('number');

      expect(results!.unresolvedExceptions).toBeDefined();
      expect(typeof results!.unresolvedExceptions.count).toBe('number');

      expect(results!.staleMdas).toBeDefined();
      expect(typeof results!.staleMdas.count).toBe('number');
    });
  });

  describe('startIntegrityChecker', () => {
    it('does not start in test mode', () => {
      // Should be a no-op in test mode
      startIntegrityChecker();
      const { results } = getIntegrityResults();
      expect(results).toBeNull(); // No immediate run
    });
  });

  describe('computed metric values', () => {
    it('maps distinct DB results to correct fields', async () => {
      vi.mocked(db.execute)
        .mockResolvedValueOnce({ rows: [{ count: 3 }] })                              // migration records
        .mockResolvedValueOnce({ rows: [{ count: 12 }] })                             // pending observations
        .mockResolvedValueOnce({ rows: [{ total_active: 20, covered_count: 8 }] })    // coverage
        .mockResolvedValueOnce({ rows: [{ count: 5 }] })                              // unresolved exceptions
        .mockResolvedValueOnce({ rows: [{ count: 2 }] });                             // stale MDAs

      await runCheckOnce();

      const { results: integrity } = getIntegrityResults();
      expect(integrity!.migrationRecordIntegrity.count).toBe(3);
      expect(integrity!.pendingObservations.count).toBe(12);

      const { results: business } = getBusinessHealthResults();
      expect(business!.mdaSubmissionCoverage.percent).toBe(40); // 8/20 × 100
      expect(business!.mdaSubmissionCoverage.coveredCount).toBe(8);
      expect(business!.mdaSubmissionCoverage.totalActive).toBe(20);
      expect(business!.unresolvedExceptions.count).toBe(5);
      expect(business!.staleMdas.count).toBe(2);
    });

    it('handles zero active MDAs without division error', async () => {
      vi.mocked(db.execute)
        .mockResolvedValueOnce({ rows: [{ count: 0 }] })
        .mockResolvedValueOnce({ rows: [{ count: 0 }] })
        .mockResolvedValueOnce({ rows: [{ total_active: 0, covered_count: 0 }] })
        .mockResolvedValueOnce({ rows: [{ count: 0 }] })
        .mockResolvedValueOnce({ rows: [{ count: 0 }] });

      await runCheckOnce();

      const { results: business } = getBusinessHealthResults();
      expect(business!.mdaSubmissionCoverage.percent).toBe(0);
      expect(business!.mdaSubmissionCoverage.totalActive).toBe(0);
    });
  });

  describe('resetCache', () => {
    it('clears cached results', async () => {
      await runCheckOnce();
      expect(getIntegrityResults().results).not.toBeNull();

      resetCache();
      expect(getIntegrityResults().results).toBeNull();
    });
  });
});
