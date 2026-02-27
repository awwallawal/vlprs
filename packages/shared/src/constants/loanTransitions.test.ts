import { describe, it, expect } from 'vitest';
import { VALID_TRANSITIONS, TERMINAL_STATUSES, isValidTransition } from './loanTransitions';
import type { LoanStatus } from '../types/loan';

const ALL_STATUSES: LoanStatus[] = ['APPLIED', 'APPROVED', 'ACTIVE', 'COMPLETED', 'TRANSFERRED', 'WRITTEN_OFF'];

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

  it('ACTIVE can transition to COMPLETED, TRANSFERRED, or WRITTEN_OFF', () => {
    expect(VALID_TRANSITIONS.ACTIVE).toEqual(['COMPLETED', 'TRANSFERRED', 'WRITTEN_OFF']);
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
});

describe('TERMINAL_STATUSES', () => {
  it('contains COMPLETED, TRANSFERRED, WRITTEN_OFF', () => {
    expect(TERMINAL_STATUSES.has('COMPLETED')).toBe(true);
    expect(TERMINAL_STATUSES.has('TRANSFERRED')).toBe(true);
    expect(TERMINAL_STATUSES.has('WRITTEN_OFF')).toBe(true);
  });

  it('does not contain non-terminal statuses', () => {
    expect(TERMINAL_STATUSES.has('APPLIED')).toBe(false);
    expect(TERMINAL_STATUSES.has('APPROVED')).toBe(false);
    expect(TERMINAL_STATUSES.has('ACTIVE')).toBe(false);
  });

  it('has exactly 3 entries', () => {
    expect(TERMINAL_STATUSES.size).toBe(3);
  });
});

describe('isValidTransition — exhaustive 36-pair matrix', () => {
  // Valid transitions (should return true)
  const validPairs: [LoanStatus, LoanStatus][] = [
    ['APPLIED', 'APPROVED'],
    ['APPROVED', 'ACTIVE'],
    ['ACTIVE', 'COMPLETED'],
    ['ACTIVE', 'TRANSFERRED'],
    ['ACTIVE', 'WRITTEN_OFF'],
  ];

  for (const [from, to] of validPairs) {
    it(`${from} → ${to} is valid`, () => {
      expect(isValidTransition(from, to)).toBe(true);
    });
  }

  // All invalid pairs (31 remaining from 36 total minus 5 valid)
  const invalidPairs: [LoanStatus, LoanStatus][] = [];
  for (const from of ALL_STATUSES) {
    for (const to of ALL_STATUSES) {
      const isValid = validPairs.some(([f, t]) => f === from && t === to);
      if (!isValid) {
        invalidPairs.push([from, to]);
      }
    }
  }

  // Verify we have exactly 31 invalid pairs (36 total - 5 valid)
  it('has exactly 31 invalid pairs', () => {
    expect(invalidPairs).toHaveLength(31);
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
  const terminalStatuses: LoanStatus[] = ['COMPLETED', 'TRANSFERRED', 'WRITTEN_OFF'];

  for (const terminal of terminalStatuses) {
    for (const target of ALL_STATUSES) {
      it(`${terminal} → ${target} is invalid (terminal status)`, () => {
        expect(isValidTransition(terminal, target)).toBe(false);
      });
    }
  }
});
