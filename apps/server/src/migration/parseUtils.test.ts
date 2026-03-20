import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import {
  parseFinancialNumber,
  parseFinancialNumberToDecimal,
  isSummaryRowMarker,
} from './parseUtils';

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

  it('rejects scientific notation strings', () => {
    expect(parseFinancialNumber('1e5')).toBeNull();
    expect(parseFinancialNumber('1E5')).toBeNull();
    expect(parseFinancialNumber('1.5e3')).toBeNull();
  });

  it('handles very large numbers with precision', () => {
    expect(parseFinancialNumber('999999999999.99')).toBe('999999999999.99');
  });

  it('preserves exact decimal precision for boundary values', () => {
    // String representations are preserved exactly as cleaned — no floating-point normalization
    expect(parseFinancialNumber('0.30')).toBe('0.30');
    expect(parseFinancialNumber('0.10')).toBe('0.10');
    expect(parseFinancialNumber('278602.72')).toBe('278602.72');
  });

  it('treats whitespace-only strings as zero', () => {
    expect(parseFinancialNumber('   ')).toBe('0');
    expect(parseFinancialNumber('\t')).toBe('0');
  });
});

describe('parseFinancialNumberToDecimal', () => {
  it('returns null for null/undefined', () => {
    expect(parseFinancialNumberToDecimal(null)).toBeNull();
    expect(parseFinancialNumberToDecimal(undefined)).toBeNull();
  });

  it('returns Decimal instance for valid number input', () => {
    const result = parseFinancialNumberToDecimal(1759.56);
    expect(result).toBeInstanceOf(Decimal);
    expect(result!.toString()).toBe('1759.56');
  });

  it('returns Decimal for valid string input', () => {
    const result = parseFinancialNumberToDecimal('₦1,500.00');
    expect(result).toBeInstanceOf(Decimal);
    expect(result!.toFixed(2)).toBe('1500.00');
  });

  it('returns Decimal(0) for dash/nil markers', () => {
    const result = parseFinancialNumberToDecimal('-');
    expect(result).toBeInstanceOf(Decimal);
    expect(result!.eq(0)).toBe(true);
  });

  it('handles parenthetical negatives', () => {
    const result = parseFinancialNumberToDecimal('(1,759.56)');
    expect(result).toBeInstanceOf(Decimal);
    expect(result!.toString()).toBe('-1759.56');
  });

  it('rejects scientific notation strings', () => {
    expect(parseFinancialNumberToDecimal('1e5')).toBeNull();
    expect(parseFinancialNumberToDecimal('1E5')).toBeNull();
  });

  it('preserves precision for very large numbers', () => {
    const result = parseFinancialNumberToDecimal('999999999999.99');
    expect(result).toBeInstanceOf(Decimal);
    expect(result!.toFixed(2)).toBe('999999999999.99');
  });

  it('returns null for non-numeric strings', () => {
    expect(parseFinancialNumberToDecimal('hello')).toBeNull();
    expect(parseFinancialNumberToDecimal('abc123')).toBeNull();
  });

  it('deterministic: same input always produces identical output', () => {
    const inputs = ['278602.72', '₦1,500.00', '(1,759.56)', '999999999999.99'];
    for (const input of inputs) {
      const r1 = parseFinancialNumberToDecimal(input);
      const r2 = parseFinancialNumberToDecimal(input);
      expect(r1!.eq(r2!)).toBe(true);
    }
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
