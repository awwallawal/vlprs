import { describe, it, expect } from 'vitest';
import { parseFinancialNumber, isSummaryRowMarker } from './parseUtils';

describe('parseFinancialNumber', () => {
  it('returns null for null/undefined', () => {
    expect(parseFinancialNumber(null)).toBeNull();
    expect(parseFinancialNumber(undefined)).toBeNull();
  });

  it('handles number inputs', () => {
    expect(parseFinancialNumber(1759.56)).toBe('1759.56');
    expect(parseFinancialNumber(0)).toBe('0');
    expect(parseFinancialNumber(-500)).toBe('-500');
  });

  it('returns null for Infinity/NaN', () => {
    expect(parseFinancialNumber(Infinity)).toBeNull();
    expect(parseFinancialNumber(NaN)).toBeNull();
  });

  it('strips commas from string numbers', () => {
    expect(parseFinancialNumber('1,759.56')).toBe('1759.56');
    expect(parseFinancialNumber('1,000,000')).toBe('1000000');
  });

  it('handles parenthetical negatives', () => {
    expect(parseFinancialNumber('(1,759.56)')).toBe('-1759.56');
  });

  it('handles dashes as zero', () => {
    expect(parseFinancialNumber('-')).toBe('0');
    expect(parseFinancialNumber('–')).toBe('0');
    expect(parseFinancialNumber('—')).toBe('0');
  });

  it('handles N/A and NIL', () => {
    expect(parseFinancialNumber('N/A')).toBe('0');
    expect(parseFinancialNumber('NIL')).toBe('0');
  });

  it('strips currency symbols', () => {
    expect(parseFinancialNumber('₦1,500.00')).toBe('1500.00');
    expect(parseFinancialNumber('$1500')).toBe('1500');
  });

  it('returns null for non-numeric strings', () => {
    expect(parseFinancialNumber('hello')).toBeNull();
    expect(parseFinancialNumber('abc123')).toBeNull();
  });

  it('handles empty string', () => {
    expect(parseFinancialNumber('')).toBe('0');
  });
});

describe('isSummaryRowMarker', () => {
  it('detects TOTAL variants', () => {
    expect(isSummaryRowMarker('TOTAL')).toBe(true);
    expect(isSummaryRowMarker('GRAND TOTAL')).toBe(true);
    expect(isSummaryRowMarker('SUB TOTAL')).toBe(true);
    expect(isSummaryRowMarker('SUB-TOTAL')).toBe(true);
    expect(isSummaryRowMarker('SUBTOTAL')).toBe(true);
    expect(isSummaryRowMarker('Total for MDA')).toBe(true);
  });

  it('rejects non-summary values', () => {
    expect(isSummaryRowMarker('John Doe')).toBe(false);
    expect(isSummaryRowMarker(null)).toBe(false);
    expect(isSummaryRowMarker(1)).toBe(false);
  });
});
