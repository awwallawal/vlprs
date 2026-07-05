/**
 * Canonical "YYYY-MM" period formatter (Story 17f.2 review follow-up).
 * One implementation for every surface that renders a period key —
 * the engine's provenance, the dashboard data-basis, and future callers.
 */
export function formatPeriod(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}
