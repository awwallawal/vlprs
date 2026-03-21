import { describe, it, expect } from 'vitest';
import { VALID_TRANSITIONS, TERMINAL_STATUSES, isValidTransition } from './loanTransitions';
import { LOAN_STATUS_VALUES } from './loanStatuses';
import type { LoanStatus } from '../types/loan';

const ALL_STATUSES: LoanStatus[] = [...LOAN_STATUS_VALUES];

describe('VALID_TRANSITIONS', () => {
  it('defines transitions for every LoanStatus', () => {
    for (const status of ALL_STATUSES) {
      expect(VALID_TRANSITIONS).toHaveProperty(status);
      expect(Array.isArray(VALID_TRANSITIONS[status])).toBe(true);
    }
  });

  it('APPLIED can only transition to APPROVED', () => {
    expect(VALID_TRANSITIONS.APPLIED).toEqual(['APPROVED']);
  });

  it('APPROVED can only transition to ACTIVE', () => {
    expect(VALID_TRANSITIONS.APPROVED).toEqual(['ACTIVE']);
  });

  it('ACTIVE can transition to COMPLETED, TRANSFERRED, WRITTEN_OFF, TRANSFER_PENDING, RETIRED, DECEASED, SUSPENDED, or LWOP', () => {
    expect(VALID_TRANSITIONS.ACTIVE).toEqual([
      'COMPLETED', 'TRANSFERRED', 'WRITTEN_OFF', 'TRANSFER_PENDING',
      'RETIRED', 'DECEASED', 'SUSPENDED', 'LWOP',
    ]);
  });

  it('TRANSFER_PENDING can only transition to ACTIVE', () => {
    expect(VALID_TRANSITIONS.TRANSFER_PENDING).toEqual(['ACTIVE']);
  });

  it('SUSPENDED can transition to ACTIVE, WRITTEN_OFF, or RETIRED', () => {
    expect(VALID_TRANSITIONS.SUSPENDED).toEqual(['ACTIVE', 'WRITTEN_OFF', 'RETIRED']);
  });

  it('LWOP can only transition to ACTIVE', () => {
    expect(VALID_TRANSITIONS.LWOP).toEqual(['ACTIVE']);
  });

  it('COMPLETED has no outgoing transitions', () => {
    expect(VALID_TRANSITIONS.COMPLETED).toEqual([]);
  });

  it('TRANSFERRED has no outgoing transitions', () => {
    expect(VALID_TRANSITIONS.TRANSFERRED).toEqual([]);
  });

  it('WRITTEN_OFF has no outgoing transitions', () => {
    expect(VALID_TRANSITIONS.WRITTEN_OFF).toEqual([]);
  });

  it('RETIRED has no outgoing transitions', () => {
    expect(VALID_TRANSITIONS.RETIRED).toEqual([]);
  });

  it('DECEASED has no outgoing transitions', () => {
    expect(VALID_TRANSITIONS.DECEASED).toEqual([]);
  });
});

describe('TERMINAL_STATUSES', () => {
  it('contains COMPLETED, TRANSFERRED, WRITTEN_OFF, RETIRED, DECEASED', () => {
    expect(TERMINAL_STATUSES.has('COMPLETED')).toBe(true);
    expect(TERMINAL_STATUSES.has('TRANSFERRED')).toBe(true);
    expect(TERMINAL_STATUSES.has('WRITTEN_OFF')).toBe(true);
    expect(TERMINAL_STATUSES.has('RETIRED')).toBe(true);
    expect(TERMINAL_STATUSES.has('DECEASED')).toBe(true);
  });

  it('does not contain non-terminal statuses', () => {
    expect(TERMINAL_STATUSES.has('APPLIED')).toBe(false);
    expect(TERMINAL_STATUSES.has('APPROVED')).toBe(false);
    expect(TERMINAL_STATUSES.has('ACTIVE')).toBe(false);
    expect(TERMINAL_STATUSES.has('SUSPENDED')).toBe(false);
    expect(TERMINAL_STATUSES.has('LWOP')).toBe(false);
    expect(TERMINAL_STATUSES.has('TRANSFER_PENDING')).toBe(false);
  });

  it('has exactly 5 entries', () => {
    expect(TERMINAL_STATUSES.size).toBe(5);
  });
});

describe('isValidTransition — exhaustive matrix', () => {
  // Valid transitions (should return true)
  const validPairs: [LoanStatus, LoanStatus][] = [
    ['APPLIED', 'APPROVED'],
    ['APPROVED', 'ACTIVE'],
    ['ACTIVE', 'COMPLETED'],
    ['ACTIVE', 'TRANSFERRED'],
    ['ACTIVE', 'WRITTEN_OFF'],
    ['ACTIVE', 'TRANSFER_PENDING'],
    ['ACTIVE', 'RETIRED'],
    ['ACTIVE', 'DECEASED'],
    ['ACTIVE', 'SUSPENDED'],
    ['ACTIVE', 'LWOP'],
    ['TRANSFER_PENDING', 'ACTIVE'],
    ['SUSPENDED', 'ACTIVE'],
    ['SUSPENDED', 'WRITTEN_OFF'],
    ['SUSPENDED', 'RETIRED'],
    ['LWOP', 'ACTIVE'],
  ];

  for (const [from, to] of validPairs) {
    it(`${from} → ${to} is valid`, () => {
      expect(isValidTransition(from, to)).toBe(true);
    });
  }

  // All invalid pairs
  const invalidPairs: [LoanStatus, LoanStatus][] = [];
  for (const from of ALL_STATUSES) {
    for (const to of ALL_STATUSES) {
      const isValid = validPairs.some(([f, t]) => f === from && t === to);
      if (!isValid) {
        invalidPairs.push([from, to]);
      }
    }
  }

  // 11*11 = 121 total - 15 valid = 106 invalid
  it(`has exactly ${121 - validPairs.length} invalid pairs`, () => {
    expect(invalidPairs).toHaveLength(121 - validPairs.length);
  });

  for (const [from, to] of invalidPairs) {
    it(`${from} → ${to} is invalid`, () => {
      expect(isValidTransition(from, to)).toBe(false);
    });
  }
});

describe('isValidTransition — self-transitions', () => {
  for (const status of ALL_STATUSES) {
    it(`${status} → ${status} (self-transition) is invalid`, () => {
      expect(isValidTransition(status, status)).toBe(false);
    });
  }
});

describe('isValidTransition — terminal statuses have zero outgoing transitions', () => {
  const terminalStatuses: LoanStatus[] = ['COMPLETED', 'TRANSFERRED', 'WRITTEN_OFF', 'RETIRED', 'DECEASED'];

  for (const terminal of terminalStatuses) {
    for (const target of ALL_STATUSES) {
      it(`${terminal} → ${target} is invalid (terminal status)`, () => {
        expect(isValidTransition(terminal, target)).toBe(false);
      });
    }
  }
});

describe('isValidTransition — Story 11.2 employment event transitions', () => {
  it('ACTIVE → RETIRED (retirement event)', () => {
    expect(isValidTransition('ACTIVE', 'RETIRED')).toBe(true);
  });

  it('ACTIVE → DECEASED (death event)', () => {
    expect(isValidTransition('ACTIVE', 'DECEASED')).toBe(true);
  });

  it('ACTIVE → SUSPENDED (suspension event)', () => {
    expect(isValidTransition('ACTIVE', 'SUSPENDED')).toBe(true);
  });

  it('ACTIVE → LWOP (LWOP Start event)', () => {
    expect(isValidTransition('ACTIVE', 'LWOP')).toBe(true);
  });

  it('ACTIVE → TRANSFER_PENDING (Transfer Out event)', () => {
    expect(isValidTransition('ACTIVE', 'TRANSFER_PENDING')).toBe(true);
  });

  it('TRANSFER_PENDING → ACTIVE (transfer completed — loan moves MDA)', () => {
    expect(isValidTransition('TRANSFER_PENDING', 'ACTIVE')).toBe(true);
  });

  it('SUSPENDED → ACTIVE (reinstated after disciplinary clearance)', () => {
    expect(isValidTransition('SUSPENDED', 'ACTIVE')).toBe(true);
  });

  it('SUSPENDED → WRITTEN_OFF (dismissed after disciplinary)', () => {
    expect(isValidTransition('SUSPENDED', 'WRITTEN_OFF')).toBe(true);
  });

  it('SUSPENDED → RETIRED (retirement while suspended)', () => {
    expect(isValidTransition('SUSPENDED', 'RETIRED')).toBe(true);
  });

  it('LWOP → ACTIVE (LWOP End — return from voluntary leave)', () => {
    expect(isValidTransition('LWOP', 'ACTIVE')).toBe(true);
  });
});
