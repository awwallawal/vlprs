/**
 * parseUtils.ts — Financial number parsing for legacy CD Excel data.
 * Ported from scripts/legacy-report/utils/number-parse.ts (SQ-1).
 *
 * Returns string-based values for financial precision (no floating-point).
 */

import Decimal from 'decimal.js';

interface ParsedFinancial {
  cleanedString: string;
  decimal: Decimal;
}

function parseFinancialRaw(raw: unknown): ParsedFinancial | null {
  if (raw === null || raw === undefined) return null;

  if (typeof raw === 'number') {
    if (!isFinite(raw)) return null;
    return { cleanedString: raw.toString(), decimal: new Decimal(raw) };
  }

  if (typeof raw !== 'string') return null;

  let s = raw.trim();
  if (s === '' || s === '-' || s === '–' || s === '—' || s === 'N/A' || s === 'NIL') {
    return { cleanedString: '0', decimal: new Decimal(0) };
  }

  let negative = false;
  if (s.startsWith('(') && s.endsWith(')')) {
    negative = true;
    s = s.slice(1, -1).trim();
  }

  s = s.replace(/[₦$,]|NGN/g, '').trim();
  s = s.replace(/\s/g, '');

  // Reject scientific notation — legacy Excel data should never contain it
  if (/[eE]/.test(s)) return null;

  try {
    const d = new Decimal(s);
    const finalDecimal = negative ? d.neg() : d;
    const finalString = negative ? '-' + s : s;
    return { cleanedString: finalString, decimal: finalDecimal };
  } catch {
    return null;
  }
}

export function parseFinancialNumberToDecimal(raw: unknown): Decimal | null {
  const result = parseFinancialRaw(raw);
  return result ? result.decimal : null;
}

export function parseFinancialNumber(raw: unknown): string | null {
  const result = parseFinancialRaw(raw);
  return result ? result.cleanedString : null;
}

export function isSummaryRowMarker(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  const s = String(value).trim().toUpperCase();
  return (
    s === 'TOTAL' ||
    s === 'GRAND TOTAL' ||
    s === 'SUB TOTAL' ||
    s === 'SUB-TOTAL' ||
    s === 'SUBTOTAL' ||
    s.startsWith('TOTAL ') ||
    s.startsWith('GRAND TOTAL') ||
    s.startsWith('SUB TOTAL') ||
    s.startsWith('SUB-TOTAL')
  );
}
