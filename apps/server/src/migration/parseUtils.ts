/**
 * parseUtils.ts — Financial number parsing for legacy CD Excel data.
 * Ported from scripts/legacy-report/utils/number-parse.ts (SQ-1).
 *
 * Returns string-based values for financial precision (no floating-point).
 */

export function parseFinancialNumber(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;

  if (typeof raw === 'number') {
    if (!isFinite(raw)) return null;
    return raw.toString();
  }

  if (typeof raw !== 'string') return null;

  let s = raw.trim();
  if (s === '' || s === '-' || s === '–' || s === '—' || s === 'N/A' || s === 'NIL') {
    return '0';
  }

  let negative = false;
  if (s.startsWith('(') && s.endsWith(')')) {
    negative = true;
    s = s.slice(1, -1).trim();
  }

  s = s.replace(/[₦$,]|NGN/g, '').trim();
  s = s.replace(/\s/g, '');

  if (!/^-?\d+(\.\d+)?$/.test(s)) {
    return null;
  }

  if (negative) {
    s = '-' + s;
  }

  return s;
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
