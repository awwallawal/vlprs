import { describe, it, expect } from 'vitest';
import { EVENT_FLAG_VALUES } from '../validators/submissionSchemas';
import type { ActiveEventFlagType } from '../types/submission';

/**
 * Compile-time exhaustiveness: verifies EVENT_FLAG_VALUES covers every ActiveEventFlagType.
 * If a new value is added to ActiveEventFlagType but not EVENT_FLAG_VALUES, this won't compile.
 */
type AssertExhaustive = ActiveEventFlagType extends (typeof EVENT_FLAG_VALUES)[number] ? true : never;
type AssertReverse = (typeof EVENT_FLAG_VALUES)[number] extends ActiveEventFlagType ? true : never;
// These assignments will fail to compile if the types diverge
const _checkExhaustive: AssertExhaustive = true;
const _checkReverse: AssertReverse = true;

describe('EVENT_FLAG_VALUES exhaustiveness', () => {
  it('EVENT_FLAG_VALUES contains exactly the ActiveEventFlagType values', () => {
    // Runtime check that EVENT_FLAG_VALUES matches the expected set
    const expected: ActiveEventFlagType[] = [
      'NONE', 'RETIREMENT', 'DEATH', 'SUSPENSION', 'TRANSFER_OUT',
      'TRANSFER_IN', 'LEAVE_WITHOUT_PAY', 'REINSTATEMENT',
      'ABSCONDED', 'SERVICE_EXTENSION', 'DISMISSAL',
    ];
    expect([...EVENT_FLAG_VALUES].sort()).toEqual([...expected].sort());
  });

  it('does not include deprecated TERMINATION', () => {
    expect(EVENT_FLAG_VALUES).not.toContain('TERMINATION');
  });

  // Suppress unused variable warnings
  void _checkExhaustive;
  void _checkReverse;
});
