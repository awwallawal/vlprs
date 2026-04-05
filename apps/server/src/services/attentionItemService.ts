import Decimal from 'decimal.js';
import { db } from '../db';
import { loans, ledgerEntries, mdas, mdaSubmissions, loanCompletions, observations, autoStopCertificates } from '../db/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { withMdaScope } from '../lib/mdaScope';
import { generateUuidv7 } from '../lib/uuidv7';
import { computeBalanceForLoan } from './computationEngine';
import * as loanClassificationService from './loanClassificationService';
import { LoanClassification } from './loanClassificationService';
import type { AttentionItem } from '@vlprs/shared';
import type { LedgerEntryForBalance } from '@vlprs/shared';

// ─── Orchestrator ────────────────────────────────────────────────

export async function getAttentionItems(
  mdaScope?: string | null,
): Promise<AttentionItem[]> {
  // Pre-fetch loan classifications once (used by overdue + stalled detectors)
  const classifications = await loanClassificationService.classifyAllLoans(mdaScope);

  const results = await Promise.all([
    detectZeroDeductionLoans(mdaScope),
    detectPostRetirementActive(mdaScope),
    detectMissingStaffId(mdaScope),
    detectOverdueLoans(mdaScope, classifications),
    detectStalledLoans(mdaScope, classifications),
    detectQuickWinLoans(mdaScope),
    detectSubmissionVariance(mdaScope),
    detectOverdueSubmissions(mdaScope),
    detectPendingAutoStop(mdaScope),
    detectPostCompletionDeductionItems(mdaScope),
    detectPendingEarlyExit(mdaScope),
    detectDarkMdas(mdaScope),
    detectOnboardingLag(mdaScope),
  ]);

  return results.flat().sort((a, b) => a.priority - b.priority);
}

// ─── Per-MDA Detectors ───────────────────────────────────────────

/**
 * (c) Loans with zero deduction for 60+ consecutive days.
 * Per-MDA detector: returns max 3 MDA items + "and N more" if applicable.
 */
async function detectZeroDeductionLoans(
  mdaScope?: string | null,
): Promise<AttentionItem[]> {
  const scopeCondition = withMdaScope(loans.mdaId, mdaScope);

  // Find ACTIVE loans whose most recent ledger entry is >60 days ago (or have none)
  const result = await db.execute(sql`
    SELECT m.id AS mda_id, m.name AS mda_name, COUNT(l.id)::int AS affected_count
    FROM loans l
    JOIN mdas m ON l.mda_id = m.id
    LEFT JOIN LATERAL (
      SELECT MAX(le.created_at) AS latest_entry
      FROM ledger_entries le
      WHERE le.loan_id = l.id
    ) latest ON TRUE
    WHERE l.status = 'ACTIVE'
      ${scopeCondition ? sql`AND l.mda_id = ${mdaScope}` : sql``}
      AND (latest.latest_entry < NOW() - INTERVAL '60 days' OR latest.latest_entry IS NULL)
    GROUP BY m.id, m.name
    ORDER BY affected_count DESC
  `);

  const rows = result.rows as Array<{ mda_id: string; mda_name: string; affected_count: number }>;
  if (rows.length === 0) return [];

  // Query inactive exception counts per MDA for description enrichment (Story 7.2 AC 7)
  const exceptionCountResult = await db.execute(sql`
    SELECT mda_id, count(*) FILTER (WHERE status = 'open')::int AS open_count
    FROM exceptions
    WHERE category = 'inactive_loan'
    GROUP BY mda_id
  `);
  const exceptionsByMda = new Map(
    (exceptionCountResult.rows as Array<{ mda_id: string; open_count: number }>).map(r => [r.mda_id, r.open_count]),
  );
  const hasAnyExceptions = exceptionsByMda.size > 0;

  return buildPerMdaItems(
    rows,
    'zero_deduction',
    'review',
    10,
    (row) => {
      const base = `${row.affected_count} loan${row.affected_count === 1 ? '' : 's'} with no deduction for 60+ days`;
      const mdaExceptions = exceptionsByMda.get(row.mda_id) ?? 0;
      if (mdaExceptions > 0) {
        return `${base} — ${mdaExceptions} flagged as exceptions, ${row.affected_count - mdaExceptions} pending review`;
      }
      return base;
    },
    (row) => (exceptionsByMda.get(row.mda_id) ?? 0) > 0 ? `/dashboard/exceptions?category=inactive_loan` : `/dashboard/loans?filter=zero-deduction&mda=${row.mda_id}`,
    hasAnyExceptions ? '/dashboard/exceptions?category=inactive_loan' : '/dashboard/loans?filter=zero-deduction',
  );
}

/**
 * (e) Staff with active deductions past computed retirement date.
 * Per-MDA detector: returns max 3 MDA items + "and N more" if applicable.
 */
async function detectPostRetirementActive(
  mdaScope?: string | null,
): Promise<AttentionItem[]> {
  const scopeCondition = withMdaScope(loans.mdaId, mdaScope);

  const conditions = [
    eq(loans.status, 'ACTIVE'),
    sql`${loans.computedRetirementDate} IS NOT NULL`,
    sql`${loans.computedRetirementDate} < CURRENT_DATE`,
  ];
  if (scopeCondition) conditions.push(scopeCondition);

  const result = await db
    .select({
      mdaId: mdas.id,
      mdaName: mdas.name,
      affectedCount: sql<number>`COUNT(*)::int`,
    })
    .from(loans)
    .innerJoin(mdas, eq(loans.mdaId, mdas.id))
    .where(and(...conditions))
    .groupBy(mdas.id, mdas.name)
    .orderBy(sql`COUNT(*) DESC`);

  if (result.length === 0) return [];

  return buildPerMdaItems(
    result.map((r) => ({ mda_id: r.mdaId, mda_name: r.mdaName, affected_count: r.affectedCount })),
    'post_retirement_active',
    'review',
    20,
    (row) => `${row.affected_count} active loan${row.affected_count === 1 ? '' : 's'} past retirement date`,
    (row) => `/dashboard/loans?filter=post-retirement&mda=${row.mda_id}`,
    '/dashboard/loans?filter=post-retirement',
  );
}

// ─── Aggregate Detectors ─────────────────────────────────────────

/**
 * (g) Records missing Staff ID with percentage-complete metric.
 * Aggregate (scheme-wide) item.
 */
async function detectMissingStaffId(
  mdaScope?: string | null,
): Promise<AttentionItem[]> {
  const scopeCondition = withMdaScope(loans.mdaId, mdaScope);
  const conditions: ReturnType<typeof eq>[] = [];
  if (scopeCondition) conditions.push(scopeCondition);

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [totals] = await db
    .select({
      total: sql<number>`COUNT(*)::int`,
      missing: sql<number>`COUNT(*) FILTER (WHERE ${loans.staffId} = '' OR ${loans.staffId} IS NULL)::int`,
    })
    .from(loans)
    .where(whereClause);

  const total = totals?.total ?? 0;
  const missing = totals?.missing ?? 0;

  if (missing === 0) return [];

  const covered = total - missing;
  const coveragePercent = total > 0
    ? new Decimal(covered).div(total).mul(100).toDecimalPlaces(1).toNumber()
    : 0;

  return [{
    id: generateUuidv7(),
    type: 'missing_staff_id',
    description: `${coveragePercent}% of records have Staff ID \u2014 ${missing} record${missing === 1 ? '' : 's'} missing`,
    mdaName: 'Scheme-wide',
    category: 'info',
    priority: 50,
    count: missing,
    drillDownUrl: '/dashboard/loans?filter=missing-staff-id',
    timestamp: new Date().toISOString(),
  }];
}

/**
 * (h) Overdue loans via Loan Classification Service.
 * Aggregate (scheme-wide) item.
 */
async function detectOverdueLoans(
  mdaScope?: string | null,
  preloadedClassifications?: Map<string, LoanClassification>,
): Promise<AttentionItem[]> {
  const classifications = preloadedClassifications ?? await loanClassificationService.classifyAllLoans(mdaScope);

  const overdueIds: string[] = [];
  for (const [loanId, classification] of classifications) {
    if (classification === LoanClassification.OVERDUE) {
      overdueIds.push(loanId);
    }
  }

  if (overdueIds.length === 0) return [];

  const totalOutstanding = await computeBalanceSumForIds(overdueIds);

  return [{
    id: generateUuidv7(),
    type: 'overdue_loans',
    description: `${overdueIds.length} overdue loan${overdueIds.length === 1 ? '' : 's'} \u2014 \u20A6${formatAmount(totalOutstanding)} at risk`,
    mdaName: 'Scheme-wide',
    category: 'review',
    priority: 15,
    count: overdueIds.length,
    amount: totalOutstanding,
    drillDownUrl: '/dashboard/loans?filter=overdue',
    timestamp: new Date().toISOString(),
  }];
}

/**
 * (i) Stalled deductions via Loan Classification Service.
 * Aggregate (scheme-wide) item. Drill-down links to observation list.
 */
async function detectStalledLoans(
  mdaScope?: string | null,
  preloadedClassifications?: Map<string, LoanClassification>,
): Promise<AttentionItem[]> {
  const classifications = preloadedClassifications ?? await loanClassificationService.classifyAllLoans(mdaScope);

  const stalledIds: string[] = [];
  for (const [loanId, classification] of classifications) {
    if (classification === LoanClassification.STALLED) {
      stalledIds.push(loanId);
    }
  }

  if (stalledIds.length === 0) return [];

  const totalOutstanding = await computeBalanceSumForIds(stalledIds);

  return [{
    id: generateUuidv7(),
    type: 'stalled_deductions',
    description: `${stalledIds.length} stalled deduction${stalledIds.length === 1 ? '' : 's'} \u2014 \u20A6${formatAmount(totalOutstanding)} at risk`,
    mdaName: 'Scheme-wide',
    category: 'info',
    priority: 30,
    count: stalledIds.length,
    amount: totalOutstanding,
    drillDownUrl: '/dashboard/observations?type=stalled_balance',
    timestamp: new Date().toISOString(),
  }];
}

/**
 * (j) Quick-win opportunities: loans with ≤3 installments remaining.
 * Aggregate (scheme-wide) item.
 *
 * Performance note: fetches all active loans + their entries for balance
 * computation. At scale (1000s of loans), consider a SQL-only approach
 * or caching layer if this becomes a bottleneck.
 */
async function detectQuickWinLoans(
  mdaScope?: string | null,
): Promise<AttentionItem[]> {
  const scopeCondition = withMdaScope(loans.mdaId, mdaScope);

  const conditions = [eq(loans.status, 'ACTIVE')];
  if (scopeCondition) conditions.push(scopeCondition);

  const activeLoanRows = await db
    .select({
      id: loans.id,
      principalAmount: loans.principalAmount,
      interestRate: loans.interestRate,
      tenureMonths: loans.tenureMonths,
      monthlyDeductionAmount: loans.monthlyDeductionAmount,
      limitedComputation: loans.limitedComputation,
    })
    .from(loans)
    .where(and(...conditions));

  if (activeLoanRows.length === 0) return [];

  // Batch-fetch all ledger entries for active loans
  const loanIds = activeLoanRows.map((l) => l.id);
  const allEntries = await db
    .select({
      loanId: ledgerEntries.loanId,
      amount: ledgerEntries.amount,
      principalComponent: ledgerEntries.principalComponent,
      interestComponent: ledgerEntries.interestComponent,
      entryType: ledgerEntries.entryType,
    })
    .from(ledgerEntries)
    .where(inArray(ledgerEntries.loanId, loanIds));

  const entriesMap = new Map<string, LedgerEntryForBalance[]>();
  for (const entry of allEntries) {
    const existing = entriesMap.get(entry.loanId) ?? [];
    existing.push(entry);
    entriesMap.set(entry.loanId, existing);
  }

  let quickWinCount = 0;
  let totalRecoverable = new Decimal('0');

  for (const loan of activeLoanRows) {
    const entries = entriesMap.get(loan.id) ?? [];
    const balance = computeBalanceForLoan({
      limitedComputation: loan.limitedComputation,
      principalAmount: loan.principalAmount,
      interestRate: loan.interestRate,
      tenureMonths: loan.tenureMonths,
      entries,
      asOfDate: null,
    });
    const outstandingBalance = new Decimal(balance.computedBalance);
    const monthlyDeduction = new Decimal(loan.monthlyDeductionAmount);

    if (outstandingBalance.gt(0) && monthlyDeduction.gt(0)) {
      const remainingInstallments = Math.ceil(
        outstandingBalance.div(monthlyDeduction).toNumber(),
      );
      if (remainingInstallments <= 3) {
        quickWinCount++;
        totalRecoverable = totalRecoverable.plus(outstandingBalance);
      }
    }
  }

  if (quickWinCount === 0) return [];

  const recoverableStr = totalRecoverable.toFixed(2);

  return [{
    id: generateUuidv7(),
    type: 'quick_win',
    description: `${quickWinCount} loan${quickWinCount === 1 ? '' : 's'} within 3 installments of completion \u2014 \u20A6${formatAmount(recoverableStr)} recoverable`,
    mdaName: 'Scheme-wide',
    category: 'info',
    priority: 40,
    count: quickWinCount,
    amount: recoverableStr,
    drillDownUrl: '/dashboard/loans?filter=quick-win&sort=outstanding-asc',
    timestamp: new Date().toISOString(),
  }];
}

// ─── Stub Detectors (future epics) ──────────────────────────────

// Story 7.0i: Detect three-way reconciliation variances across MDAs
async function detectSubmissionVariance(mdaScope?: string | null): Promise<AttentionItem[]> {
  const conditions = [
    sql`${mdaSubmissions.threeWayReconciliation} IS NOT NULL`,
    eq(mdaSubmissions.status, 'confirmed'),
  ];
  const scopeCondition = withMdaScope(mdaSubmissions.mdaId, mdaScope);
  if (scopeCondition) conditions.push(scopeCondition);

  const results = await db.select({
    mdaId: mdaSubmissions.mdaId,
    threeWayReconciliation: mdaSubmissions.threeWayReconciliation,
  })
    .from(mdaSubmissions)
    .where(and(...conditions));

  let totalVarianceStaff = 0;
  const mdaSet = new Set<string>();
  for (const row of results) {
    const summary = row.threeWayReconciliation as { fullVarianceCount?: number; mdaId?: string } | null;
    if (summary && typeof summary.fullVarianceCount === 'number' && summary.fullVarianceCount > 0) {
      totalVarianceStaff += summary.fullVarianceCount;
      mdaSet.add(row.mdaId);
    }
  }

  if (totalVarianceStaff === 0) return [];

  return [{
    id: generateUuidv7(),
    type: 'submission_variance',
    description: `Payroll Variance — ${totalVarianceStaff} staff across ${mdaSet.size} MDAs show declared ≠ actual`,
    mdaName: 'Scheme-wide',
    category: 'review',
    priority: 10,
    count: totalVarianceStaff,
    drillDownUrl: '/dashboard/reconciliation/three-way',
    timestamp: new Date().toISOString(),
  }];
}

// Story 7.0i: Detect MDAs with payroll data but no MDA submission for current period
async function detectOverdueSubmissions(mdaScope?: string | null): Promise<AttentionItem[]> {
  // Find payroll submissions where no csv/manual submission exists for same MDA+period
  const payrollConditions = [
    eq(mdaSubmissions.source, 'payroll'),
    eq(mdaSubmissions.status, 'confirmed'),
  ];
  const scopeCondition = withMdaScope(mdaSubmissions.mdaId, mdaScope);
  if (scopeCondition) payrollConditions.push(scopeCondition);

  const payrollSubs = await db.select({
    mdaId: mdaSubmissions.mdaId,
    period: mdaSubmissions.period,
  })
    .from(mdaSubmissions)
    .where(and(...payrollConditions));

  if (payrollSubs.length === 0) return [];

  // Deduplicate MDA+period pairs, then batch-check for declared submissions
  const uniquePairs = new Map<string, { mdaId: string; period: string }>();
  for (const ps of payrollSubs) {
    const key = `${ps.mdaId}:${ps.period}`;
    if (!uniquePairs.has(key)) uniquePairs.set(key, ps);
  }

  // Single query: all confirmed csv/manual submissions for relevant MDA+period combos
  const declaredSubs = await db.select({
    mdaId: mdaSubmissions.mdaId,
    period: mdaSubmissions.period,
  })
    .from(mdaSubmissions)
    .where(and(
      eq(mdaSubmissions.status, 'confirmed'),
      sql`${mdaSubmissions.source} IN ('csv', 'manual')`,
    ));

  const declaredSet = new Set(declaredSubs.map((s) => `${s.mdaId}:${s.period}`));

  let pendingCount = 0;
  const pendingPeriods = new Set<string>();

  for (const [key, ps] of uniquePairs) {
    if (!declaredSet.has(key)) {
      pendingCount++;
      pendingPeriods.add(ps.period);
    }
  }

  if (pendingCount === 0) return [];

  const periodsStr = [...pendingPeriods].sort().join(', ');
  return [{
    id: generateUuidv7(),
    type: 'overdue_submission',
    description: `${pendingCount} MDAs have payroll data but no submission for ${periodsStr}`,
    mdaName: 'Scheme-wide',
    category: 'review',
    priority: 10,
    count: pendingCount,
    drillDownUrl: '/dashboard/reconciliation/three-way',
    timestamp: new Date().toISOString(),
  }];
}

async function detectPendingAutoStop(mdaScope?: string | null): Promise<AttentionItem[]> {
  // Query completed loans — join with certificates to show notification status
  const scopeCondition = withMdaScope(loans.mdaId, mdaScope);
  const conditions = [eq(loans.status, 'COMPLETED')];
  if (scopeCondition) conditions.push(scopeCondition);

  const rows = await db
    .select({
      mda_id: mdas.id,
      mda_name: mdas.name,
      affected_count: sql<number>`COUNT(*)::int`,
      notified_count: sql<number>`COUNT(${autoStopCertificates.notifiedMdaAt})::int`,
      certified_count: sql<number>`COUNT(${autoStopCertificates.id})::int`,
      staff_name: sql<string | null>`CASE WHEN COUNT(*)::int = 1 THEN MIN(${loans.staffName}) ELSE NULL END`,
    })
    .from(loans)
    .innerJoin(loanCompletions, eq(loanCompletions.loanId, loans.id))
    .innerJoin(mdas, eq(mdas.id, loans.mdaId))
    .leftJoin(autoStopCertificates, eq(autoStopCertificates.loanId, loans.id))
    .where(and(...conditions))
    .groupBy(mdas.id, mdas.name)
    .orderBy(sql`COUNT(*) DESC`);

  if (rows.length === 0) return [];

  const items: AttentionItem[] = [];
  const maxItems = 3;
  const now = new Date().toISOString();

  for (let i = 0; i < Math.min(rows.length, maxItems); i++) {
    const row = rows[i];
    const isLast = i === maxItems - 1;
    const remaining = rows.length - maxItems;

    // Determine description based on notification status
    // AC 6: use staff name when a single loan, count when multiple
    const nameOrCount = row.staff_name ?? `${row.affected_count} loan${row.affected_count === 1 ? '' : 's'}`;
    let description: string;
    if (row.notified_count === row.affected_count && row.notified_count > 0) {
      // All certificates issued and MDA notified
      description = `Auto-Stop Certificate issued — ${nameOrCount}, ${row.mda_name}. MDA notified.`;
    } else if (row.certified_count > 0 && row.notified_count < row.certified_count) {
      description = `Auto-Stop Certificate issued — ${nameOrCount}, ${row.mda_name}. Notification pending.`;
    } else {
      description = `Auto-Stop: ${nameOrCount} completed — certificate${row.affected_count === 1 ? '' : 's'} pending`;
    }

    if (isLast && remaining > 0) {
      description = `${description}, and ${remaining} more MDA${remaining === 1 ? '' : 's'}`;
    }

    items.push({
      id: generateUuidv7(),
      type: 'pending_auto_stop',
      description,
      mdaName: row.mda_name,
      category: 'complete',
      priority: 5,
      count: row.affected_count,
      drillDownUrl: isLast && remaining > 0
        ? '/dashboard/loans?status=COMPLETED'
        : `/dashboard/loans?status=COMPLETED&mdaId=${row.mda_id}`,
      timestamp: now,
      ...(isLast && remaining > 0 ? { hasMore: remaining } : {}),
    });
  }

  return items;
}

async function detectPostCompletionDeductionItems(mdaScope?: string | null): Promise<AttentionItem[]> {
  const scopeCondition = withMdaScope(observations.mdaId, mdaScope);
  const conditions = [
    eq(observations.type, 'post_completion_deduction'),
    eq(observations.status, 'unreviewed'),
  ];
  if (scopeCondition) conditions.push(scopeCondition);

  const rows = await db
    .select({
      mda_id: mdas.id,
      mda_name: mdas.name,
      affected_count: sql<number>`COUNT(*)::int`,
    })
    .from(observations)
    .innerJoin(mdas, eq(mdas.id, observations.mdaId))
    .where(and(...conditions))
    .groupBy(mdas.id, mdas.name)
    .orderBy(sql`COUNT(*) DESC`);

  if (rows.length === 0) return [];

  return buildPerMdaItems(
    rows,
    'post_completion_deduction',
    'review',
    8,
    (row) => `${row.affected_count} staff ${row.affected_count === 1 ? 'has' : 'have'} deductions declared after loan completion`,
    (row) => `/dashboard/observations?type=post_completion_deduction&mdaId=${row.mda_id}`,
    '/dashboard/observations?type=post_completion_deduction',
  );
}

// TODO: Wire in Epic 12 when early exit processing exists
async function detectPendingEarlyExit(_mdaScope?: string | null): Promise<AttentionItem[]> {
  return [];
}

// TODO: Wire in Epic 5 when Submission Coverage Service exists
async function detectDarkMdas(_mdaScope?: string | null): Promise<AttentionItem[]> {
  return [];
}

// TODO: Wire in Epic 5 when Beneficiary Pipeline Service exists
async function detectOnboardingLag(_mdaScope?: string | null): Promise<AttentionItem[]> {
  return [];
}

// ─── Helpers ─────────────────────────────────────────────────────

interface MdaRow {
  mda_id: string;
  mda_name: string;
  affected_count: number;
}

/**
 * Build per-MDA attention items (max 3, with "and N more" on last if truncated).
 */
export function buildPerMdaItems(
  rows: MdaRow[],
  type: AttentionItem['type'],
  category: AttentionItem['category'],
  priority: number,
  descriptionFn: (row: MdaRow) => string,
  drillDownFn: (row: MdaRow) => string,
  allMdasDrillDown: string,
): AttentionItem[] {
  const items: AttentionItem[] = [];
  const maxItems = 3;
  const now = new Date().toISOString();

  for (let i = 0; i < Math.min(rows.length, maxItems); i++) {
    const row = rows[i];
    const isLast = i === maxItems - 1;
    const remaining = rows.length - maxItems;

    if (isLast && remaining > 0) {
      items.push({
        id: generateUuidv7(),
        type,
        description: `${descriptionFn(row)}, and ${remaining} more MDA${remaining === 1 ? '' : 's'}`,
        mdaName: row.mda_name,
        category,
        priority,
        count: row.affected_count,
        hasMore: remaining,
        drillDownUrl: allMdasDrillDown,
        timestamp: now,
      });
    } else {
      items.push({
        id: generateUuidv7(),
        type,
        description: descriptionFn(row),
        mdaName: row.mda_name,
        category,
        priority,
        count: row.affected_count,
        drillDownUrl: drillDownFn(row),
        timestamp: now,
      });
    }
  }

  return items;
}

/**
 * Batch-compute sum of outstanding balances for a set of loan IDs.
 */
export async function computeBalanceSumForIds(loanIds: string[]): Promise<string> {
  if (loanIds.length === 0) return '0.00';

  const loanRows = await db
    .select({
      id: loans.id,
      principalAmount: loans.principalAmount,
      interestRate: loans.interestRate,
      tenureMonths: loans.tenureMonths,
      limitedComputation: loans.limitedComputation,
    })
    .from(loans)
    .where(inArray(loans.id, loanIds));

  const allEntries = await db
    .select({
      loanId: ledgerEntries.loanId,
      amount: ledgerEntries.amount,
      principalComponent: ledgerEntries.principalComponent,
      interestComponent: ledgerEntries.interestComponent,
      entryType: ledgerEntries.entryType,
    })
    .from(ledgerEntries)
    .where(inArray(ledgerEntries.loanId, loanIds));

  const entriesMap = new Map<string, LedgerEntryForBalance[]>();
  for (const entry of allEntries) {
    const existing = entriesMap.get(entry.loanId) ?? [];
    existing.push(entry);
    entriesMap.set(entry.loanId, existing);
  }

  let total = new Decimal('0');
  for (const loan of loanRows) {
    const entries = entriesMap.get(loan.id) ?? [];
    const balance = computeBalanceForLoan({
      limitedComputation: loan.limitedComputation,
      principalAmount: loan.principalAmount,
      interestRate: loan.interestRate,
      tenureMonths: loan.tenureMonths,
      entries,
      asOfDate: null,
    });
    const bal = new Decimal(balance.computedBalance);
    if (bal.gt(0)) total = total.plus(bal);
  }

  return total.toFixed(2);
}

/**
 * Format a numeric string with commas for display in descriptions.
 */
export function formatAmount(amount: string): string {
  try {
    const d = new Decimal(amount);
    if (d.isNaN()) return amount;
    const fixed = d.toFixed(2);
    const [intPart, decPart] = fixed.split('.');
    const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `${withCommas}.${decPart}`;
  } catch {
    return amount;
  }
}
