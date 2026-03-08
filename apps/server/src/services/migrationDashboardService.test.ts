import { describe, it, expect } from 'vitest';
import { deriveStage } from './migrationDashboardService';

/**
 * Story 3.5: Migration Dashboard & Master Beneficiary Ledger
 *
 * Unit tests for stage derivation logic.
 * Integration tests (DB-dependent) are in the route test file.
 */

describe('Migration Dashboard — Stage Derivation', () => {
  it('returns "pending" for null (no uploads)', () => {
    expect(deriveStage(null)).toBe('pending');
  });

  it('returns "pending" for unknown status', () => {
    expect(deriveStage('garbage')).toBe('pending');
  });

  it('maps "uploaded" to "received"', () => {
    expect(deriveStage('uploaded')).toBe('received');
  });

  it('maps "mapped" to "imported"', () => {
    expect(deriveStage('mapped')).toBe('imported');
  });

  it('maps "processing" to "imported"', () => {
    expect(deriveStage('processing')).toBe('imported');
  });

  it('maps "completed" to "imported"', () => {
    expect(deriveStage('completed')).toBe('imported');
  });

  it('maps "validated" to "validated"', () => {
    expect(deriveStage('validated')).toBe('validated');
  });

  it('maps "reconciled" to "reconciled"', () => {
    expect(deriveStage('reconciled')).toBe('reconciled');
  });

  it('returns "pending" for empty string', () => {
    expect(deriveStage('')).toBe('pending');
  });

  it('maps "certified" to "certified"', () => {
    expect(deriveStage('certified')).toBe('certified');
  });

  it('maps "failed" to "pending" (failed is not a progression status)', () => {
    expect(deriveStage('failed')).toBe('pending');
  });
});
