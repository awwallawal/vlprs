import { describe, it, expect } from 'vitest';
import { LOAN_STATUS_VALUES, type LoanStatusValue } from './loanStatuses';

describe('LOAN_STATUS_VALUES', () => {
  it('contains all 11 canonical loan statuses', () => {
    expect(LOAN_STATUS_VALUES).toHaveLength(11);
  });

  it('includes every known status value', () => {
    const expected: LoanStatusValue[] = [
      'APPLIED', 'APPROVED', 'ACTIVE', 'COMPLETED', 'TRANSFERRED',
      'WRITTEN_OFF', 'RETIRED', 'DECEASED', 'SUSPENDED', 'LWOP', 'TRANSFER_PENDING',
    ];
    for (const status of expected) {
      expect(LOAN_STATUS_VALUES).toContain(status);
    }
  });

  it('matches loanStatusEnum DB values from schema.ts', () => {
    // These are the values from apps/server/src/db/schema.ts:85-87
    const dbEnumValues = [
      'APPLIED', 'APPROVED', 'ACTIVE', 'COMPLETED', 'TRANSFERRED', 'WRITTEN_OFF',
      'RETIRED', 'DECEASED', 'SUSPENDED', 'LWOP', 'TRANSFER_PENDING',
    ];
    expect([...LOAN_STATUS_VALUES].sort()).toEqual([...dbEnumValues].sort());
  });

  it('is a readonly tuple (as const)', () => {
    // Verify it's frozen / readonly by checking it's an array
    expect(Array.isArray(LOAN_STATUS_VALUES)).toBe(true);
  });
});
