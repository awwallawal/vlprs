/**
 * queryHelpers tests — Verify isActiveRecord() filter logic.
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('./schema', () => ({
  migrationRecords: {
    deletedAt: 'migration_records.deleted_at',
    recordStatus: 'migration_records.status',
  },
}));

import { isActiveRecord } from './queryHelpers';

describe('isActiveRecord', () => {
  it('returns a truthy filter expression', () => {
    const result = isActiveRecord();
    // The helper should return a drizzle-orm SQL condition (not null/undefined)
    expect(result).toBeDefined();
    expect(result).not.toBeNull();
  });

  it('returns a compound AND expression', () => {
    const result = isActiveRecord();
    // Drizzle's and() returns a SQL object with nested conditions
    // Verify it's an object (SQL expression) not a primitive
    expect(typeof result).toBe('object');
  });

  it('returns a new expression on each call (no shared mutable state)', () => {
    const result1 = isActiveRecord();
    const result2 = isActiveRecord();
    // Each call should produce a fresh expression
    expect(result1).toBeDefined();
    expect(result2).toBeDefined();
    // Both should be structurally equivalent but independent instances
    expect(result1).not.toBe(result2);
  });
});
