import { format, parseISO } from 'date-fns';
import Decimal from 'decimal.js';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/**
 * Formats a string amount as Nigerian Naira with thousands separators and 2 decimal places.
 * @example formatNaira("1840000.00") → "₦1,840,000.00"
 */
export function formatNaira(amount: string | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') {
    return '₦0.00';
  }

  let d: Decimal;
  try {
    d = new Decimal(amount);
  } catch {
    return '₦0.00';
  }

  const isNegative = d.lt(0);
  const abs = d.abs();
  const [whole, frac = '00'] = abs.toFixed(2).split('.');
  const formatted = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  return isNegative ? `-₦${formatted}.${frac}` : `₦${formatted}.${frac}`;
}

/**
 * Formats a financial amount as Naira, returning '—' for null/undefined/empty.
 * Use in UI contexts where null means "no data available" (not "zero").
 */
export function formatNairaOrDash(amount: string | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') return '—';
  return formatNaira(amount);
}

/**
 * Formats a string amount as compact Naira: ₦1.84B, ₦126M, ₦48.3K.
 * @example formatCompactNaira("2418350000") → "₦2.42B"
 */
export function formatCompactNaira(amount: string): string {
  if (!amount) return '₦0';

  let d: Decimal;
  try {
    d = new Decimal(amount);
  } catch {
    return '₦0';
  }

  const abs = d.abs();
  const sign = d.lt(0) ? '-' : '';
  const billion = new Decimal('1000000000');
  const million = new Decimal('1000000');
  const thousand = new Decimal('1000');

  if (abs.gte(billion)) {
    const val = abs.div(billion);
    return `${sign}₦${val.mod(1).eq(0) ? val.toFixed(0) : val.toFixed(2).replace(/0+$/, '')}B`;
  }
  if (abs.gte(million)) {
    const val = abs.div(million);
    return `${sign}₦${val.mod(1).eq(0) ? val.toFixed(0) : val.toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (abs.gte(thousand)) {
    const val = abs.div(thousand);
    return `${sign}₦${val.mod(1).eq(0) ? val.toFixed(0) : val.toFixed(1).replace(/\.0$/, '')}K`;
  }

  return `${sign}₦${abs.toFixed(0)}`;
}

/**
 * Formats an ISO date string as dd-MMM-yyyy.
 * @example formatDate("2026-02-19T14:30:00Z") → "19-Feb-2026"
 */
export function formatDate(isoString: string): string {
  try {
    return format(parseISO(isoString), 'dd-MMM-yyyy');
  } catch {
    return isoString || '—';
  }
}

/**
 * Formats an ISO date string as dd-MMM-yyyy, hh:mm a.
 * @example formatDateTime("2026-02-19T14:30:00Z") → "19-Feb-2026, 02:30 PM"
 */
export function formatDateTime(isoString: string): string {
  try {
    return format(parseISO(isoString), "dd-MMM-yyyy, hh:mm a");
  } catch {
    return isoString || '—';
  }
}

/**
 * Formats a number with thousands separators.
 * @example formatCount(3147) → "3,147"
 */
export function formatCount(n: number): string {
  return n.toLocaleString('en-US');
}
