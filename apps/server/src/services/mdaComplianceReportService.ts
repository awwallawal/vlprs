/**
 * mdaComplianceReportService — Composition layer for MDA Compliance Report (Story 6.1, FR38).
 *
 * Composes per-MDA compliance data from:
 *   mdas table, mdaAggregationService, submissionCoverageService,
 *   observationService, and mdaSubmissions table.
 */

import Decimal from 'decimal.js';
import { db } from '../db';
import { mdas, mdaSubmissions } from '../db/schema';
import { eq, and, desc, isNull } from 'drizzle-orm';
import { withMdaScope } from '../lib/mdaScope';
import * as mdaAggregationService from './mdaAggregationService';
import * as submissionCoverageService from './submissionCoverageService';
import * as observationService from './observationService';
import type {
  MdaComplianceReportData,
  MdaComplianceReportRow,
  MdaComplianceReportSummary,
} from '@vlprs/shared';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// ─── Options ────────────────────────────────────────────────────

interface ComplianceReportOptions {
  mdaId?: string;
  periodYear?: number;
  periodMonth?: number;
  mdaScope?: string | null;
}

// ─── Main Report Generator ──────────────────────────────────────

export async function generateMdaComplianceReport(
  options: ComplianceReportOptions,
): Promise<MdaComplianceReportData> {
  const { mdaId, mdaScope } = options;

  // Default to current period if not specified
  const now = new Date();
  const periodYear = options.periodYear ?? now.getFullYear();
  const periodMonth = options.periodMonth ?? now.getMonth() + 1;
  const periodStr = `${periodYear}-${String(periodMonth).padStart(2, '0')}`;

  // Run all independent queries in parallel
  const [
    allMdas,
    healthResults,
    coverageData,
    observationCountsByMda,
    submissionData,
  ] = await Promise.all([
    fetchMdas(mdaId, mdaScope),
    mdaAggregationService.getMdaBreakdown(mdaScope),
    submissionCoverageService.getSubmissionCoverage(mdaId),
    observationService.getObservationCountsByMda(mdaScope),
    fetchSubmissionDataByMda(periodStr, mdaId, mdaScope),
  ]);

  // Build lookup maps
  const healthMap = new Map(healthResults.map(r => [r.mdaId, r]));
  const coverageMap = new Map(coverageData.map(c => [c.mdaId, c]));

  // Build compliance rows
  const rows: MdaComplianceReportRow[] = allMdas.map(mda => {
    const health = healthMap.get(mda.id);
    const coverage = coverageMap.get(mda.id);
    const submission = submissionData.get(mda.id);
    const obsCount = observationCountsByMda.get(mda.id) ?? 0;

    const healthScore = health?.healthScore ?? 0;
    const healthBand = health?.healthBand ?? 'for-review';

    // Submission status: 'Submitted' if there's a confirmed submission for this period, else 'Pending'
    const submissionStatus = submission ? 'Submitted' : 'Pending';
    const lastSubmissionDate = submission?.submissionDate ?? null;
    const recordCount = submission?.recordCount ?? 0;

    // Compliance percentage: ratio of aligned records to total (if submission exists)
    const compliancePercent = submission && submission.recordCount > 0
      ? Number(new Decimal(submission.alignedCount).div(submission.recordCount).mul(100).toDecimalPlaces(1).toNumber())
      : 0;

    return {
      mdaId: mda.id,
      mdaName: mda.name,
      mdaCode: mda.code,
      submissionStatus,
      lastSubmissionDate,
      recordCount,
      compliancePercent,
      healthScore,
      healthBand,
      coveragePercent: coverage?.coveragePercent ?? null,
      totalOutstanding: health?.totalExposure ?? '0.00',
      unresolvedObservationCount: obsCount,
    };
  });

  // Filter by mdaId if specified (and MDA wasn't already filtered above)
  const filteredRows = mdaId
    ? rows.filter(r => r.mdaId === mdaId)
    : rows;

  // Build summary
  const summary = buildSummary(filteredRows);

  return {
    rows: filteredRows,
    summary,
    periodYear,
    periodMonth,
    generatedAt: new Date().toISOString(),
  };
}

// ─── Helpers ────────────────────────────────────────────────────

async function fetchMdas(
  mdaId?: string,
  mdaScope?: string | null,
) {
  const conditions = [isNull(mdas.deletedAt), eq(mdas.isActive, true)];
  if (mdaId) conditions.push(eq(mdas.id, mdaId));
  const scopeCondition = withMdaScope(mdas.id, mdaScope);
  if (scopeCondition) conditions.push(scopeCondition);

  return db
    .select({ id: mdas.id, name: mdas.name, code: mdas.code })
    .from(mdas)
    .where(and(...conditions));
}

async function fetchSubmissionDataByMda(
  period: string,
  mdaId?: string,
  mdaScope?: string | null,
): Promise<Map<string, { submissionDate: string; recordCount: number; alignedCount: number }>> {
  const conditions = [eq(mdaSubmissions.period, period)];
  if (mdaId) conditions.push(eq(mdaSubmissions.mdaId, mdaId));
  const scopeCondition = withMdaScope(mdaSubmissions.mdaId, mdaScope);
  if (scopeCondition) conditions.push(scopeCondition);

  const rows = await db
    .select({
      mdaId: mdaSubmissions.mdaId,
      createdAt: mdaSubmissions.createdAt,
      recordCount: mdaSubmissions.recordCount,
      alignedCount: mdaSubmissions.alignedCount,
    })
    .from(mdaSubmissions)
    .where(and(...conditions))
    .orderBy(desc(mdaSubmissions.createdAt));

  // Take the latest submission per MDA
  const result = new Map<string, { submissionDate: string; recordCount: number; alignedCount: number }>();
  for (const row of rows) {
    if (!result.has(row.mdaId)) {
      result.set(row.mdaId, {
        submissionDate: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
        recordCount: row.recordCount,
        alignedCount: row.alignedCount,
      });
    }
  }

  return result;
}

function buildSummary(rows: MdaComplianceReportRow[]): MdaComplianceReportSummary {
  const totalMdas = rows.length;

  const averageHealthScore = totalMdas > 0
    ? Number(new Decimal(rows.reduce((sum, r) => sum + r.healthScore, 0)).div(totalMdas).toDecimalPlaces(1).toNumber())
    : 0;

  let totalOutstanding = new Decimal('0');
  let totalObservations = 0;

  for (const row of rows) {
    totalOutstanding = totalOutstanding.plus(new Decimal(row.totalOutstanding));
    totalObservations += row.unresolvedObservationCount;
  }

  return {
    totalMdas,
    averageHealthScore,
    totalOutstanding: totalOutstanding.toFixed(2),
    totalObservations,
  };
}
