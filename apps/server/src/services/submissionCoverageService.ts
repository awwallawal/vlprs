import { listMdas } from './mdaService';
import type { MdaHeatmapRow } from '@vlprs/shared';

// ─── Types ───────────────────────────────────────────────────────────

export interface MdaSubmissionCoverage {
  mdaId: string;
  coveragePercent: number | null;
  isDark: boolean;
  stalenessMonths: number | null;
  lastSubmissionDate: string | null;
}

// ─── Service Functions ──────────────────────────────────────────────

// TODO: Wire in Epic 5 when mda_submissions table exists

/**
 * Get submission coverage data for MDAs.
 * Returns per-MDA coverage percentage, dark MDA flag, staleness, and last submission date.
 *
 * Pre-Epic 5 stub: returns default values (no submission data available yet).
 */
export async function getSubmissionCoverage(
  mdaId?: string,
): Promise<MdaSubmissionCoverage[]> {
  const allMdas = await listMdas(undefined, undefined);

  const mdaList = mdaId
    ? allMdas.filter((m) => m.id === mdaId)
    : allMdas;

  // TODO: Wire in Epic 5 — query mda_submissions table for actual coverage data
  return mdaList.map((mda) => ({
    mdaId: mda.id,
    coveragePercent: null,
    isDark: false,
    stalenessMonths: null,
    lastSubmissionDate: null,
  }));
}

/**
 * Get submission heatmap data: per-MDA month-by-month submission timeliness for last 12 months.
 *
 * Pre-Epic 5 stub: returns empty cells array for each MDA (no history to show).
 */
export async function getSubmissionHeatmap(
  mdaScope?: string | null,
): Promise<MdaHeatmapRow[]> {
  const allMdas = await listMdas(undefined, undefined);

  const mdaList = mdaScope
    ? allMdas.filter((m) => m.id === mdaScope)
    : allMdas;

  // TODO: Wire in Epic 5 — query mda_submissions table for month-by-month timeliness
  return mdaList.map((mda) => ({
    mdaId: mda.id,
    mdaName: mda.name,
    mdaCode: mda.code,
    complianceRate: 0,
    cells: [],
  }));
}
