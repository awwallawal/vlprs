import { describe, it, expect } from 'vitest';
import { formatNaira, formatCompactNaira, formatDate, formatDateTime, formatCount } from './formatters';

describe('formatNaira', () => {
  it('formats basic amount', () => {
    expect(formatNaira('1840000.00')).toBe('₦1,840,000.00');
  });

  it('formats zero', () => {
    expect(formatNaira('0')).toBe('₦0.00');
  });

  it('formats negative values', () => {
    expect(formatNaira('-500.50')).toBe('-₦500.50');
  });

  it('returns ₦0.00 for null', () => {
    expect(formatNaira(null)).toBe('₦0.00');
  });

  it('returns ₦0.00 for undefined', () => {
    expect(formatNaira(undefined)).toBe('₦0.00');
  });

  it('returns ₦0.00 for empty string', () => {
    expect(formatNaira('')).toBe('₦0.00');
  });

  it('returns ₦0.00 for non-numeric string', () => {
    expect(formatNaira('abc')).toBe('₦0.00');
  });

  it('formats large amounts correctly', () => {
    expect(formatNaira('2418350000.00')).toBe('₦2,418,350,000.00');
  });

  it('adds decimal places when missing', () => {
    expect(formatNaira('1000')).toBe('₦1,000.00');
  });
});

describe('formatCompactNaira', () => {
  it('formats billions', () => {
    expect(formatCompactNaira('2418350000')).toBe('₦2.42B');
  });

  it('formats exact billions', () => {
    expect(formatCompactNaira('1000000000')).toBe('₦1B');
  });

  it('formats millions', () => {
    expect(formatCompactNaira('892000000')).toBe('₦892M');
  });

  it('formats millions with decimal', () => {
    expect(formatCompactNaira('48250000')).toBe('₦48.3M');
  });

  it('formats thousands', () => {
    expect(formatCompactNaira('48250')).toBe('₦48.3K');
  });

  it('formats small amounts', () => {
    expect(formatCompactNaira('500')).toBe('₦500');
  });

  it('handles empty string', () => {
    expect(formatCompactNaira('')).toBe('₦0');
  });
});

describe('formatDate', () => {
  it('formats ISO date string', () => {
    expect(formatDate('2026-02-19T14:30:00Z')).toBe('19-Feb-2026');
  });

  it('formats date-only ISO string', () => {
    expect(formatDate('2026-01-01')).toBe('01-Jan-2026');
  });

  it('returns original string for invalid date', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });

  it('returns dash for empty string', () => {
    expect(formatDate('')).toBe('—');
  });
});

describe('formatDateTime', () => {
  it('formats ISO datetime string', () => {
    // Use a non-UTC timestamp to avoid timezone offset issues
    const result = formatDateTime('2026-02-19T14:30:00');
    expect(result).toBe('19-Feb-2026, 02:30 PM');
  });

  it('formats morning time', () => {
    const result = formatDateTime('2026-02-19T09:15:00');
    expect(result).toBe('19-Feb-2026, 09:15 AM');
  });

  it('returns original string for invalid datetime', () => {
    expect(formatDateTime('not-a-date')).toBe('not-a-date');
  });
});

describe('formatCount', () => {
  it('formats number with thousands separator', () => {
    expect(formatCount(3147)).toBe('3,147');
  });

  it('formats zero', () => {
    expect(formatCount(0)).toBe('0');
  });

  it('formats large numbers', () => {
    expect(formatCount(1000000)).toBe('1,000,000');
  });

  it('formats small numbers without separator', () => {
    expect(formatCount(42)).toBe('42');
  });
});
