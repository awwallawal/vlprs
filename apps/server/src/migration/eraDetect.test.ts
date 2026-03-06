import { describe, it, expect } from 'vitest';
import { detectEra } from './eraDetect';

describe('detectEra', () => {
  it('Era 1: <=12 columns, no MDA column', () => {
    expect(detectEra(12, false, false, false)).toBe(1);
    expect(detectEra(10, false, false, false)).toBe(1);
  });

  it('Era 2: 13-16 columns with Employee No', () => {
    expect(detectEra(16, false, true, true)).toBe(2);
    expect(detectEra(14, false, false, true)).toBe(2);
  });

  it('Era 3: >=17 columns, no start date', () => {
    expect(detectEra(18, false, true, true)).toBe(3);
    expect(detectEra(17, false, true, false)).toBe(3);
  });

  it('Era 4: has start date', () => {
    expect(detectEra(19, true, true, true)).toBe(4);
    expect(detectEra(17, true, false, false)).toBe(4);
  });

  it('13 cols without employeeNo defaults to Era 2 (matches SQ-1)', () => {
    // 13-16 cols without specific fields falls through to second 13-16 check
    expect(detectEra(13, false, false, false)).toBe(2);
  });
});
