/**
 * Pre-Submission Checkpoint Service (Story 11.1).
 * Assembles checkpoint data for MDA officers before monthly submission.
 */
import { eq, and, sql, desc, lte, gt, isNotNull, inArray, ne } from 'drizzle-orm';
import { db } from '../db/index';
import { loans, mdaSubmissions, submissionRows } from '../db/schema';
import { getEffectiveEventFlags } from './effectiveEventFlagHelper';
import { differenceInDays, addMonths, endOfMonth, subMonths, format } from 'date-fns';
import type { PreSubmissionCheckpoint, RetirementItem, ZeroDeductionItem, PendingEventItem } from '@vlprs/shared';

/**
 * Fetches the complete pre-submission checkpoint data for an MDA.
 * Three sections: approaching retirement, zero deduction alerts, pending events.
 */
export async function getCheckpointData(mdaId: string): Promise<PreSubmissionCheckpoint> {
  const now = new Date();
  const currentPeriod = format(now, 'yyyy-MM');

  // Sequential to keep query order deterministic (same DB pool, negligible difference)
  const retirement = await getApproachingRetirement(mdaId, now);
  const zeroDeduction = await getZeroDeductionAlerts(mdaId, now);
  const lastSubmissionDate = await getLastSubmissionDate(mdaId);
  const pendingEvents = await getPendingEvents(mdaId, lastSubmissionDate);

  return {
    approachingRetirement: retirement,
    zeroDeduction,
    pendingEvents,
    lastSubmissionDate,
    submissionPeriod: currentPeriod,
  };
}

/**
 * AC 1 Section 1: Staff with retirement date within 12 months from today.
 * Only includes ACTIVE loans with a computed retirement date.
 */
async function getApproachingRetirement(mdaId: string, now: Date): Promise<RetirementItem[]> {
  const twelveMonthsFromNow = addMonths(now, 12);

  const rows = await db.select({
    staffName: loans.staffName,
    staffId: loans.staffId,
    retirementDate: loans.computedRetirementDate,
  })
    .from(loans)
    .where(
      and(
        eq(loans.mdaId, mdaId),
        eq(loans.status, 'ACTIVE'),
        isNotNull(loans.computedRetirementDate),
        gt(loans.computedRetirementDate, sql`CURRENT_DATE`),
        lte(loans.computedRetirementDate, sql`${twelveMonthsFromNow.toISOString().split('T')[0]}::date`),
      ),
    );

  return rows
    .filter((row): row is typeof row & { retirementDate: Date } => row.retirementDate !== null)
    .map((row) => ({
      staffName: row.staffName,
      staffId: row.staffId,
      retirementDate: row.retirementDate.toISOString().split('T')[0],
      daysUntilRetirement: differenceInDays(row.retirementDate, now),
    }));
}

/**
 * AC 1 Section 2: Staff with zero deduction in previous month and no employment event filed.
 *
 * Uses submission_rows from the previous month's submission for this MDA.
 * Identifies staff where amount_deducted = 0 and event_flag = 'NONE'.
 * Also includes active loan staff who have no submission row at all for the previous month.
 */
async function getZeroDeductionAlerts(mdaId: string, now: Date): Promise<ZeroDeductionItem[]> {
  const prevMonth = subMonths(now, 1);
  const prevPeriod = format(prevMonth, 'yyyy-MM');

  // Find staff with zero deduction in previous month's submission (event_flag = 'NONE')
  const zeroNoneRows = await db.select({
    id: submissionRows.id,
    staffId: submissionRows.staffId,
    staffName: loans.staffName,
    month: submissionRows.month,
    eventFlag: submissionRows.eventFlag,
  })
    .from(submissionRows)
    .innerJoin(mdaSubmissions, eq(submissionRows.submissionId, mdaSubmissions.id))
    .innerJoin(loans, and(
      eq(submissionRows.staffId, loans.staffId),
      eq(loans.mdaId, mdaId),
      eq(loans.status, 'ACTIVE'),
    ))
    .where(
      and(
        eq(mdaSubmissions.mdaId, mdaId),
        eq(submissionRows.month, prevPeriod),
        eq(submissionRows.amountDeducted, '0.00'),
        eq(submissionRows.eventFlag, 'NONE'),
      ),
    );

  // Story 8.0i: Supplementary ��� rows with non-NONE flag + zero amount, corrected to NONE
  const zeroEventRows = await db.select({
    id: submissionRows.id,
    staffId: submissionRows.staffId,
    staffName: loans.staffName,
    month: submissionRows.month,
    eventFlag: submissionRows.eventFlag,
  })
    .from(submissionRows)
    .innerJoin(mdaSubmissions, eq(submissionRows.submissionId, mdaSubmissions.id))
    .innerJoin(loans, and(
      eq(submissionRows.staffId, loans.staffId),
      eq(loans.mdaId, mdaId),
      eq(loans.status, 'ACTIVE'),
    ))
    .where(
      and(
        eq(mdaSubmissions.mdaId, mdaId),
        eq(submissionRows.month, prevPeriod),
        eq(submissionRows.amountDeducted, '0.00'),
        sql`${submissionRows.eventFlag} != 'NONE'`,
      ),
    );

  // Story 8.0i: Apply event flag corrections — single bulk lookup
  const allZeroRows = [...zeroNoneRows, ...zeroEventRows];
  const allZeroRowIds = allZeroRows.map(r => r.id);
  const correctionMap = allZeroRowIds.length > 0
    ? await getEffectiveEventFlags(allZeroRowIds)
    : new Map<string, string>();

  // Keep only rows where effective flag is NONE
  const zeroRows = allZeroRows.filter(row => {
    const effectiveFlag = correctionMap.get(row.id) ?? row.eventFlag;
    return effectiveFlag === 'NONE';
  });

  // Find active loan staff who have NO submission row at all for the previous month
  const missingRows = await db.select({
    staffId: loans.staffId,
    staffName: loans.staffName,
  })
    .from(loans)
    .where(
      and(
        eq(loans.mdaId, mdaId),
        eq(loans.status, 'ACTIVE'),
        sql`${loans.staffId} NOT IN (
          SELECT sr.staff_id FROM submission_rows sr
          INNER JOIN mda_submissions ms ON sr.submission_id = ms.id
          WHERE ms.mda_id = ${mdaId} AND sr.month = ${prevPeriod}
        )`,
      ),
    );

  // Batch: find actual last non-zero deduction date for zero-amount staff
  const zeroStaffIds = [...new Set(zeroRows.map((r) => r.staffId))];
  const lastDeductionDates = new Map<string, string>();

  if (zeroStaffIds.length > 0) {
    const deductionRows = await db.select({
      staffId: submissionRows.staffId,
      lastMonth: sql<string>`MAX(${submissionRows.month})`.as('last_month'),
    })
      .from(submissionRows)
      .innerJoin(mdaSubmissions, eq(submissionRows.submissionId, mdaSubmissions.id))
      .where(
        and(
          eq(mdaSubmissions.mdaId, mdaId),
          inArray(submissionRows.staffId, zeroStaffIds),
          ne(submissionRows.amountDeducted, '0.00'),
        ),
      )
      .groupBy(submissionRows.staffId);

    for (const row of deductionRows) {
      const [y, m] = row.lastMonth.split('-').map(Number);
      const eom = endOfMonth(new Date(y, m - 1, 1));
      lastDeductionDates.set(row.staffId, eom.toISOString().split('T')[0]);
    }
  }

  // Combine and deduplicate by staffId
  const seen = new Set<string>();
  const results: ZeroDeductionItem[] = [];

  for (const row of zeroRows) {
    if (seen.has(row.staffId)) continue;
    seen.add(row.staffId);
    const lastDate = lastDeductionDates.get(row.staffId);
    results.push({
      staffName: row.staffName,
      staffId: row.staffId,
      lastDeductionDate: lastDate ?? 'N/A',
      daysSinceLastDeduction: lastDate ? differenceInDays(now, new Date(lastDate)) : null,
    });
  }

  for (const row of missingRows) {
    if (seen.has(row.staffId)) continue;
    seen.add(row.staffId);
    results.push({
      staffName: row.staffName,
      staffId: row.staffId,
      lastDeductionDate: 'N/A',
      daysSinceLastDeduction: null,
    });
  }

  return results;
}

/**
 * Derives the last submission date for an MDA.
 * Uses the most recent approved/processed submission period end date.
 * Skips rejected submissions.
 * Returns null (epoch equivalent) if MDA has never submitted.
 */
async function getLastSubmissionDate(mdaId: string): Promise<string | null> {
  const [latestSubmission] = await db.select({
    period: mdaSubmissions.period,
    createdAt: mdaSubmissions.createdAt,
  })
    .from(mdaSubmissions)
    .where(
      and(
        eq(mdaSubmissions.mdaId, mdaId),
        sql`${mdaSubmissions.status} IN ('confirmed', 'processing')`,
      ),
    )
    .orderBy(desc(mdaSubmissions.period))
    .limit(1);

  if (!latestSubmission) return null;

  // Convert period (YYYY-MM) to end of month date
  const [year, month] = latestSubmission.period.split('-').map(Number);
  const periodEnd = endOfMonth(new Date(year, month - 1, 1));
  return periodEnd.toISOString().split('T')[0];
}

/**
 * AC 1 Section 3: Pending employment events since last submission.
 *
 * NOTE: The employment_events table is created by Story 11.2.
 * Until that story is complete, this returns an empty array.
 * This matches the story's design: "If no events exist yet, the section
 * will correctly show empty state."
 */
async function getPendingEvents(_mdaId: string, _lastSubmissionDate: string | null): Promise<PendingEventItem[]> {
  // employment_events table does not exist yet (Story 11.2).
  // Return empty array — the frontend renders "No items require attention".
  return [];
}
