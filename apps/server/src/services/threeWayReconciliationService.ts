/**
 * Three-Way Reconciliation Engine (Story 7.0i).
 *
 * Compares three data sources per staff member:
 *   Expected  — VLPRS computation (loans.monthlyDeductionAmount)
 *   Declared  — MDA submission (submission_rows where source IN ('csv','manual'))
 *   Actual    — Payroll extract (submission_rows where source = 'payroll')
 *
 * Auto-promotes declared ≠ actual variances ≥ ₦500 to the exception queue.
 */
import Decimal from 'decimal.js';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../db';
import { loans, mdaSubmissions, submissionRows, observations, exceptions, mdas } from '../db/schema';
import { withMdaScope } from '../lib/mdaScope';
import { generateUuidv7 } from '../lib/uuidv7';
import { logger } from '../lib/logger';
import type {
  ThreeWayMatchStatus,
  ThreeWayVarianceCategory,
  ThreeWayReconciliationRow,
  ThreeWayReconciliationSummary,
  ThreeWayDashboardMetrics,
} from '@vlprs/shared';

const FULL_MATCH_TOLERANCE = new Decimal('1'); // ₦1 for rounding differences
const AUTO_PROMOTE_THRESHOLD = new Decimal('500'); // ₦500 for exception auto-promotion

// ─── Core Reconciliation ─────────────────────────────────────────

export async function reconcileThreeWay(
  mdaId: string,
  period: string,
): Promise<ThreeWayReconciliationSummary> {
  // 1. Get MDA name
  const mdaResult = await db.select({ name: mdas.name }).from(mdas).where(eq(mdas.id, mdaId)).limit(1);
  const mdaName = mdaResult.length > 0 ? mdaResult[0].name : 'Unknown MDA';

  // 2. Get latest confirmed declared submission (csv/manual) for this MDA+period
  const declaredSubmission = await db.select({ id: mdaSubmissions.id })
    .from(mdaSubmissions)
    .where(and(
      eq(mdaSubmissions.mdaId, mdaId),
      eq(mdaSubmissions.period, period),
      eq(mdaSubmissions.status, 'confirmed'),
      sql`${mdaSubmissions.source} IN ('csv', 'manual')`,
    ))
    .orderBy(desc(mdaSubmissions.createdAt))
    .limit(1);

  // 3. Get latest confirmed payroll submission for this MDA+period
  const payrollSubmission = await db.select({ id: mdaSubmissions.id })
    .from(mdaSubmissions)
    .where(and(
      eq(mdaSubmissions.mdaId, mdaId),
      eq(mdaSubmissions.period, period),
      eq(mdaSubmissions.status, 'confirmed'),
      eq(mdaSubmissions.source, 'payroll'),
    ))
    .orderBy(desc(mdaSubmissions.createdAt))
    .limit(1);

  // 4. Check pending state
  const pendingMsg = buildPendingMessage(declaredSubmission.length > 0, payrollSubmission.length > 0, period);
  if (pendingMsg) {
    return {
      period,
      mdaId,
      mdaName,
      totalStaffCompared: 0,
      fullMatchCount: 0,
      fullMatchPercent: '0.00',
      partialMatchCount: 0,
      fullVarianceCount: 0,
      aggregateDeclared: '0.00',
      aggregateActual: '0.00',
      reconciliationHealth: '0.00',
      rows: [],
      pendingState: pendingMsg,
    };
  }

  // 5. Query declared rows
  const declaredRows = await db.select({
    staffId: submissionRows.staffId,
    amountDeducted: submissionRows.amountDeducted,
  })
    .from(submissionRows)
    .where(eq(submissionRows.submissionId, declaredSubmission[0].id));

  // 6. Query actual (payroll) rows
  const actualRows = await db.select({
    staffId: submissionRows.staffId,
    amountDeducted: submissionRows.amountDeducted,
  })
    .from(submissionRows)
    .where(eq(submissionRows.submissionId, payrollSubmission[0].id));

  // 7. Query expected: active loans for this MDA
  const activeLoanRows = await db.select({
    staffId: loans.staffId,
    staffName: loans.staffName,
    monthlyDeductionAmount: loans.monthlyDeductionAmount,
    limitedComputation: loans.limitedComputation,
  })
    .from(loans)
    .where(and(
      eq(loans.mdaId, mdaId),
      eq(loans.status, 'ACTIVE'),
    ));

  // 8. Build maps
  // Expected: staffId → { total, limitedComputation, staffName }
  const expectedMap = new Map<string, { total: Decimal; limited: boolean; staffName: string }>();
  for (const loan of activeLoanRows) {
    const existing = expectedMap.get(loan.staffId);
    const amount = new Decimal(loan.monthlyDeductionAmount);
    if (existing) {
      existing.total = existing.total.plus(amount);
      // If any loan for this staff is NOT limited, treat as not limited
      if (!loan.limitedComputation) existing.limited = false;
    } else {
      expectedMap.set(loan.staffId, {
        total: amount,
        limited: loan.limitedComputation,
        staffName: loan.staffName,
      });
    }
  }

  // Declared: staffId → sum of amountDeducted
  const declaredMap = new Map<string, Decimal>();
  for (const row of declaredRows) {
    const existing = declaredMap.get(row.staffId) ?? new Decimal(0);
    declaredMap.set(row.staffId, existing.plus(new Decimal(row.amountDeducted)));
  }

  // Actual: staffId → sum of amountDeducted
  const actualMap = new Map<string, Decimal>();
  for (const row of actualRows) {
    const existing = actualMap.get(row.staffId) ?? new Decimal(0);
    actualMap.set(row.staffId, existing.plus(new Decimal(row.amountDeducted)));
  }

  // 9. Build union of all staff IDs
  const allStaffIds = new Set<string>();
  for (const id of expectedMap.keys()) allStaffIds.add(id);
  for (const id of declaredMap.keys()) allStaffIds.add(id);
  for (const id of actualMap.keys()) allStaffIds.add(id);

  // 10. Compute three-way comparison per staff
  const rows: ThreeWayReconciliationRow[] = [];
  let fullMatchCount = 0;
  let partialMatchCount = 0;
  let fullVarianceCount = 0;
  let aggregateDeclared = new Decimal(0);
  let aggregateActual = new Decimal(0);

  for (const staffId of allStaffIds) {
    const expectedInfo = expectedMap.get(staffId);
    const declared = declaredMap.get(staffId) ?? new Decimal(0);
    const actual = actualMap.get(staffId) ?? new Decimal(0);

    aggregateDeclared = aggregateDeclared.plus(declared);
    aggregateActual = aggregateActual.plus(actual);

    const isLimited = expectedInfo?.limited ?? false;
    const expected = expectedInfo ? expectedInfo.total : null;
    // submissionRows has no staffName column — fall back to staffId for non-loan staff
    const staffName = expectedInfo?.staffName ?? staffId;

    // Determine match status
    let matchStatus: ThreeWayMatchStatus;
    let varianceCategory: ThreeWayVarianceCategory | undefined;
    let varianceAmount: string | undefined;
    let variancePercentage: string | undefined;

    if (isLimited && (expected === null || expected.isZero())) {
      // limitedComputation loan — expected unknown
      matchStatus = 'expected_unknown';
      // Still check declared vs actual for variance category
      varianceCategory = categorizeVariance(declared, actual, declaredMap.has(staffId), actualMap.has(staffId));
      if (varianceCategory) {
        varianceAmount = declared.minus(actual).abs().toFixed(2);
        variancePercentage = computeVariancePercentage(declared, actual);
      }
    } else {
      const expectedVal = expected ?? new Decimal(0);

      // Compute pairwise matches with ₦1 tolerance
      const expDeclMatch = expectedVal.minus(declared).abs().lte(FULL_MATCH_TOLERANCE);
      const expActMatch = expectedVal.minus(actual).abs().lte(FULL_MATCH_TOLERANCE);
      const declActMatch = declared.minus(actual).abs().lte(FULL_MATCH_TOLERANCE);

      const matchCount = [expDeclMatch, expActMatch, declActMatch].filter(Boolean).length;

      if (matchCount === 3) {
        matchStatus = 'full_match';
        fullMatchCount++;
      } else if (matchCount === 2) {
        matchStatus = 'partial_match';
        partialMatchCount++;
      } else {
        matchStatus = 'full_variance';
        fullVarianceCount++;
      }

      // Categorize variance if declared ≠ actual
      if (!declActMatch) {
        varianceCategory = categorizeVariance(declared, actual, declaredMap.has(staffId), actualMap.has(staffId));
        varianceAmount = declared.minus(actual).abs().toFixed(2);
        variancePercentage = computeVariancePercentage(declared, actual);
      }
    }

    rows.push({
      staffId,
      staffName,
      expectedAmount: isLimited && (expected === null || expected.isZero()) ? null : (expected ?? new Decimal(0)).toFixed(2),
      declaredAmount: declared.toFixed(2),
      actualAmount: actual.toFixed(2),
      matchStatus,
      varianceCategory,
      varianceAmount,
      variancePercentage,
    });
  }

  const totalStaffCompared = allStaffIds.size;
  const fullMatchPct = totalStaffCompared > 0
    ? new Decimal(fullMatchCount).div(totalStaffCompared).times(100).toFixed(2)
    : '0.00';

  return {
    period,
    mdaId,
    mdaName,
    totalStaffCompared,
    fullMatchCount,
    fullMatchPercent: fullMatchPct,
    partialMatchCount,
    fullVarianceCount,
    aggregateDeclared: aggregateDeclared.toFixed(2),
    aggregateActual: aggregateActual.toFixed(2),
    reconciliationHealth: fullMatchPct, // Same as fullMatchPercent per AC 6: "percentage of full matches"
    rows,
  };
}

// ─── Auto-Promote Variances ────────────────────────────────────────

export async function autoPromoteVariances(
  summary: ThreeWayReconciliationSummary,
  userId: string,
): Promise<number> {
  let promotedCount = 0;

  for (const row of summary.rows) {
    // Skip expected_unknown — do NOT auto-promote these (per AC / dev notes)
    if (row.matchStatus === 'expected_unknown') continue;
    if (!row.varianceCategory) continue;

    const declared = new Decimal(row.declaredAmount);
    const actual = new Decimal(row.actualAmount);
    const absDiff = declared.minus(actual).abs();

    if (absDiff.lt(AUTO_PROMOTE_THRESHOLD)) continue;

    const observationId = generateUuidv7();
    const exceptionId = generateUuidv7();

    const description = buildVarianceDescription(row);

    // Wrap observation+exception pair in transaction to prevent orphaned records
    await db.transaction(async (tx) => {
      await tx.insert(observations).values({
        id: observationId,
        type: 'three_way_variance',
        staffName: row.staffName,
        staffId: row.staffId,
        mdaId: summary.mdaId,
        description,
        context: {
          possibleExplanations: [getVarianceExplanation(row.varianceCategory!)],
          suggestedAction: 'Review the three-way reconciliation detail and verify with the relevant department',
          dataCompleteness: 1,
          dataPoints: {
            period: summary.period,
            expectedAmount: row.expectedAmount,
            declaredAmount: row.declaredAmount,
            actualAmount: row.actualAmount,
            varianceCategory: row.varianceCategory,
            varianceAmount: row.varianceAmount,
          },
        },
        sourceReference: null,
        status: 'promoted',
        promotedExceptionId: exceptionId,
      });

      await tx.insert(exceptions).values({
        id: exceptionId,
        observationId,
        staffName: row.staffName,
        staffId: row.staffId,
        mdaId: summary.mdaId,
        category: row.varianceCategory!,
        description,
        priority: 'high',
        status: 'open',
        promotedBy: userId,
      });
    });

    promotedCount++;
  }

  return promotedCount;
}

// ─── Pending State ──────────────────────────────────────────────────

export async function getPendingState(
  mdaId: string,
  period: string,
): Promise<string | null> {
  const hasDeclared = await checkDeclaredExists(mdaId, period);
  const hasPayroll = await checkPayrollExists(mdaId, period);

  return buildPendingMessage(hasDeclared, hasPayroll, period);
}

// ─── Existence Checks (exported for auto-trigger) ──────────────────

export async function checkDeclaredExists(mdaId: string, period: string): Promise<boolean> {
  const result = await db.select({ id: mdaSubmissions.id })
    .from(mdaSubmissions)
    .where(and(
      eq(mdaSubmissions.mdaId, mdaId),
      eq(mdaSubmissions.period, period),
      eq(mdaSubmissions.status, 'confirmed'),
      sql`${mdaSubmissions.source} IN ('csv', 'manual')`,
    ))
    .limit(1);
  return result.length > 0;
}

export async function checkPayrollExists(mdaId: string, period: string): Promise<boolean> {
  const result = await db.select({ id: mdaSubmissions.id })
    .from(mdaSubmissions)
    .where(and(
      eq(mdaSubmissions.mdaId, mdaId),
      eq(mdaSubmissions.period, period),
      eq(mdaSubmissions.status, 'confirmed'),
      eq(mdaSubmissions.source, 'payroll'),
    ))
    .limit(1);
  return result.length > 0;
}

// ─── Store on Triggering Submission ────────────────────────────────

export async function storeReconciliationOnSubmission(
  mdaId: string,
  period: string,
  summary: ThreeWayReconciliationSummary,
  triggerSource: 'payroll' | 'csv' | 'manual',
): Promise<void> {
  // Find the submission that triggered reconciliation
  const sourceFilter = triggerSource === 'payroll'
    ? eq(mdaSubmissions.source, 'payroll')
    : sql`${mdaSubmissions.source} IN ('csv', 'manual')`;

  const submission = await db.select({ id: mdaSubmissions.id })
    .from(mdaSubmissions)
    .where(and(
      eq(mdaSubmissions.mdaId, mdaId),
      eq(mdaSubmissions.period, period),
      eq(mdaSubmissions.status, 'confirmed'),
      sourceFilter,
    ))
    .orderBy(desc(mdaSubmissions.createdAt))
    .limit(1);

  if (submission.length > 0) {
    await db.update(mdaSubmissions)
      .set({
        threeWayReconciliation: summary,
        updatedAt: new Date(),
      })
      .where(eq(mdaSubmissions.id, submission[0].id));
  }
}

// ─── Dashboard Metrics ─────────────────────────────────────────────

export async function getThreeWayDashboardMetrics(
  mdaScope?: string | null,
): Promise<ThreeWayDashboardMetrics> {
  // Query all mda_submissions that have three-way reconciliation data
  const conditions = [
    sql`${mdaSubmissions.threeWayReconciliation} IS NOT NULL`,
    eq(mdaSubmissions.status, 'confirmed'),
  ];

  const scopeCondition = withMdaScope(mdaSubmissions.mdaId, mdaScope);
  if (scopeCondition) conditions.push(scopeCondition);

  const results = await db.select({
    mdaId: mdaSubmissions.mdaId,
    period: mdaSubmissions.period,
    threeWayReconciliation: mdaSubmissions.threeWayReconciliation,
  })
    .from(mdaSubmissions)
    .where(and(...conditions))
    .orderBy(desc(mdaSubmissions.createdAt));

  // Deduplicate: keep only the latest reconciliation per MDA+period
  const latestByMdaPeriod = new Map<string, ThreeWayReconciliationSummary>();
  for (const row of results) {
    const key = `${row.mdaId}:${row.period}`;
    const summary = row.threeWayReconciliation as ThreeWayReconciliationSummary;
    if (!latestByMdaPeriod.has(key)) {
      latestByMdaPeriod.set(key, summary);
    }
  }

  let totalStaff = 0;
  let totalFullMatch = 0;
  let totalFullVariance = 0;
  const varianceByMda = new Map<string, { mdaName: string; count: number }>();

  for (const summary of latestByMdaPeriod.values()) {
    totalStaff += summary.totalStaffCompared;
    totalFullMatch += summary.fullMatchCount;
    totalFullVariance += summary.fullVarianceCount;

    const existing = varianceByMda.get(summary.mdaId) ?? { mdaName: summary.mdaName, count: 0 };
    existing.count += summary.fullVarianceCount;
    varianceByMda.set(summary.mdaId, existing);
  }

  const overallMatchRate = totalStaff > 0
    ? new Decimal(totalFullMatch).div(totalStaff).times(100).toFixed(2)
    : '0.00';

  const topVarianceMdas = [...varianceByMda.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map(({ mdaName, count }) => ({ mdaName, varianceCount: count }));

  return {
    overallMatchRate,
    fullVarianceCount: totalFullVariance,
    topVarianceMdas,
  };
}

// ─── MDA-Scoped View ───────────────────────────────────────────────

export async function getThreeWayReconciliation(
  mdaId: string,
  period: string,
  mdaScope?: string | null,
): Promise<ThreeWayReconciliationSummary> {
  // Enforce MDA scope — defense-in-depth (scopeToMda middleware is primary guard)
  if (mdaScope && mdaScope !== mdaId) {
    logger.warn({ mdaScope, requestedMdaId: mdaId }, 'Three-way reconciliation scope mismatch — returning empty result');
    return {
      period,
      mdaId,
      mdaName: '',
      totalStaffCompared: 0,
      fullMatchCount: 0,
      fullMatchPercent: '0.00',
      partialMatchCount: 0,
      fullVarianceCount: 0,
      aggregateDeclared: '0.00',
      aggregateActual: '0.00',
      reconciliationHealth: '0.00',
      rows: [],
      pendingState: 'Access restricted',
    };
  }

  // Check pending state first
  const pending = await getPendingState(mdaId, period);
  if (pending) {
    const mdaResult = await db.select({ name: mdas.name }).from(mdas).where(eq(mdas.id, mdaId)).limit(1);
    return {
      period,
      mdaId,
      mdaName: mdaResult.length > 0 ? mdaResult[0].name : 'Unknown MDA',
      totalStaffCompared: 0,
      fullMatchCount: 0,
      fullMatchPercent: '0.00',
      partialMatchCount: 0,
      fullVarianceCount: 0,
      aggregateDeclared: '0.00',
      aggregateActual: '0.00',
      reconciliationHealth: '0.00',
      rows: [],
      pendingState: pending,
    };
  }

  // Prefer stored JSONB for performance; fall back to live recomputation
  const stored = await db.select({ threeWayReconciliation: mdaSubmissions.threeWayReconciliation })
    .from(mdaSubmissions)
    .where(and(
      eq(mdaSubmissions.mdaId, mdaId),
      sql`${mdaSubmissions.threeWayReconciliation} IS NOT NULL`,
      eq(mdaSubmissions.status, 'confirmed'),
    ))
    .orderBy(desc(mdaSubmissions.createdAt))
    .limit(1);

  if (stored.length > 0 && stored[0].threeWayReconciliation) {
    return stored[0].threeWayReconciliation as ThreeWayReconciliationSummary;
  }

  // No stored result — compute live
  return reconcileThreeWay(mdaId, period);
}

// ─── Fire-and-Forget Trigger ────────────────────────────────────────

export async function triggerThreeWayReconciliation(
  mdaId: string,
  period: string,
  userId: string,
  triggerSource: 'payroll' | 'csv' | 'manual',
): Promise<void> {
  try {
    const summary = await reconcileThreeWay(mdaId, period);
    await storeReconciliationOnSubmission(mdaId, period, summary, triggerSource);
    const promotedCount = await autoPromoteVariances(summary, userId);
    logger.info({
      mdaId,
      period,
      totalStaff: summary.totalStaffCompared,
      fullMatchCount: summary.fullMatchCount,
      varianceCount: summary.fullVarianceCount,
      promoted: promotedCount,
    }, 'Three-way reconciliation completed');
  } catch (err) {
    logger.error({ err, mdaId, period }, 'Three-way reconciliation failed');
  }
}

// ─── Helper Functions ───────────────────────────────────────────────

function buildPendingMessage(
  hasDeclared: boolean,
  hasPayroll: boolean,
  period: string,
): string | null {
  if (!hasDeclared && !hasPayroll) {
    return `No submission data available for ${period}. Both MDA submission and payroll data are pending.`;
  }
  if (!hasPayroll) {
    return `MDA submission received for ${period}. Payroll data pending. Reconciliation will run automatically upon payroll upload.`;
  }
  if (!hasDeclared) {
    return `Payroll data received for ${period}. MDA submission pending. Reconciliation will run automatically upon submission.`;
  }
  return null; // Both exist — reconciliation available
}

function categorizeVariance(
  declared: Decimal,
  actual: Decimal,
  staffInDeclared: boolean,
  staffInActual: boolean,
): ThreeWayVarianceCategory | undefined {
  if (staffInDeclared && !staffInActual) {
    return 'staff_not_in_payroll';
  }
  if (declared.gt(0) && actual.isZero()) {
    return 'ghost_deduction';
  }
  if (actual.gt(0) && declared.isZero()) {
    return 'unreported_deduction';
  }
  if (declared.gt(0) && actual.gt(0) && declared.minus(actual).abs().gt(FULL_MATCH_TOLERANCE)) {
    return 'amount_mismatch';
  }
  return undefined;
}

function computeVariancePercentage(declared: Decimal, actual: Decimal): string {
  const base = Decimal.max(declared, actual);
  if (base.isZero()) return '0.00';
  return declared.minus(actual).abs().div(base).times(100).toFixed(2);
}

function buildVarianceDescription(row: ThreeWayReconciliationRow): string {
  const labels: Record<ThreeWayVarianceCategory, string> = {
    ghost_deduction: 'Deduction reported by MDA but not found in payroll extract',
    unreported_deduction: 'Payroll deduction recorded but not reported by MDA',
    amount_mismatch: 'Declared and payroll amounts differ',
    staff_not_in_payroll: 'Staff included in MDA submission but absent from payroll extract',
  };

  const label = row.varianceCategory ? labels[row.varianceCategory] : 'Variance observed';
  return `${label} — Staff ${row.staffId}: Expected ${row.expectedAmount ?? 'Unknown'}, Declared ₦${row.declaredAmount}, Actual ₦${row.actualAmount}`;
}

function getVarianceExplanation(category: ThreeWayVarianceCategory): string {
  const explanations: Record<ThreeWayVarianceCategory, string> = {
    ghost_deduction: 'The MDA reported a deduction that does not appear in the payroll extract. This may indicate a reporting timing difference or data entry variance.',
    unreported_deduction: 'The payroll extract shows a deduction that was not included in the MDA submission. The MDA may not have been aware of this deduction.',
    amount_mismatch: 'Both the MDA and payroll report a deduction, but the amounts differ. This may be due to different calculation methods or data sources.',
    staff_not_in_payroll: 'The staff member appears in the MDA submission but not in the payroll extract. This may indicate a Staff ID formatting difference or a staffing change.',
  };
  return explanations[category];
}
