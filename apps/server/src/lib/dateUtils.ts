/**
 * Format a Date as YYYY-MM-DD (date-only, no time component).
 * Overloaded to preserve non-null guarantees at call sites.
 */
export function toDateString(d: Date): string;
export function toDateString(d: Date | null): string | null;
export function toDateString(d: Date | null): string | null {
  if (!d) return null;
  return d.toISOString().split('T')[0];
}
