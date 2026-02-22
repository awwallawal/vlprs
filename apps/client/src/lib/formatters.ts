import { format, parseISO } from 'date-fns';

/**
 * Formats a string amount as Nigerian Naira with thousands separators and 2 decimal places.
 * @example formatNaira("1840000.00") → "₦1,840,000.00"
 */
export function formatNaira(amount: string | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') {
    return '₦0.00';
  }

  const num = parseFloat(amount);
  if (isNaN(num)) {
    return '₦0.00';
  }

  const isNegative = num < 0;
  const abs = Math.abs(num);
  const formatted = abs.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return isNegative ? `-₦${formatted}` : `₦${formatted}`;
}

/**
 * Formats a string amount as compact Naira: ₦1.84B, ₦126M, ₦48.3K.
 * @example formatCompactNaira("2418350000") → "₦2.42B"
 */
export function formatCompactNaira(amount: string): string {
  if (!amount) return '₦0';

  const num = parseFloat(amount);
  if (isNaN(num)) return '₦0';

  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';

  if (abs >= 1_000_000_000) {
    const val = abs / 1_000_000_000;
    return `${sign}₦${val % 1 === 0 ? val.toFixed(0) : val.toFixed(2).replace(/0+$/, '')}B`;
  }
  if (abs >= 1_000_000) {
    const val = abs / 1_000_000;
    return `${sign}₦${val % 1 === 0 ? val.toFixed(0) : val.toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (abs >= 1_000) {
    const val = abs / 1_000;
    return `${sign}₦${val % 1 === 0 ? val.toFixed(0) : val.toFixed(1).replace(/\.0$/, '')}K`;
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
