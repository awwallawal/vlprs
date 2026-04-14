/**
 * Pre-Submission Checkpoint Service (Story 11.1).
 * Assembles checkpoint data for MDA officers before monthly submission.
 */
import { eq, and, sql, desc, lte, gt, isNotNull, inArray, ne } from 'drizzle-orm';
import { db } from '../db/index';
import { loans, mdaSubmissions, submissionRows, migrationRecords as migrationRecordsTable } from '../db/schema';
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

  // For missing rows: fall back to migration record period as "last deduction"
  // since that's the last known data point before monthly submissions begin
  const missingStaffIds = missingRows.map((r) => r.staffId).filter((id) => !seen.has(id));
  const migrationPeriodMap = new Map<string, { year: number; month: number }>();

  if (missingStaffIds.length > 0) {
    const migrationPeriods = await db.select({
      staffId: loans.staffId,
      periodYear: sql<number>`MAX(${migrationRecordsTable.periodYear})`.as('period_year'),
      periodMonth: sql<number>`MAX(${migrationRecordsTable.periodMonth})`.as('period_month'),
    })
      .from(loans)
      .innerJoin(migrationRecordsTable, eq(migrationRecordsTable.loanId, loans.id))
      .where(
        and(
          inArray(loans.staffId, missingStaffIds),
          sql`${migrationRecordsTable.deletedAt} IS NULL`,
          sql`${migrationRecordsTable.periodYear} IS NOT NULL`,
          sql`${migrationRecordsTable.periodMonth} IS NOT NULL`,
        ),
      )
      .groupBy(loans.staffId);

    for (const row of migrationPeriods) {
      if (row.periodYear && row.periodMonth) {
        migrationPeriodMap.set(row.staffId, { year: row.periodYear, month: row.periodMonth });
      }
    }
  }

  for (const row of missingRows) {
    if (seen.has(row.staffId)) continue;
    seen.add(row.staffId);
    const migPeriod = migrationPeriodMap.get(row.staffId);
    if (migPeriod) {
      const eom = endOfMonth(new Date(migPeriod.year, migPeriod.month - 1, 1));
      const lastDate = eom.toISOString().split('T')[0];
      results.push({
        staffName: row.staffName,
        staffId: row.staffId,
        lastDeductionDate: lastDate,
        daysSinceLastDeduction: differenceInDays(now, eom),
      });
    } else {
      results.push({
        staffName: row.staffName,
        staffId: row.staffId,
        lastDeductionDate: 'N/A',
        daysSinceLastDeduction: null,
      });
    }
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
 * AC 1 Section 3: Pending actions requiring MDA officer attention.
 *
 * Includes:
 * 1. Migration records flagged for review (14-day window)
 * 2. Unreconciled employment events (Story 11.2)
 * 3. Pending transfers involving this MDA
 */
async function getPendingEvents(mdaId: string, _lastSubmissionDate: string | null): Promise<PendingEventItem[]> {
  const results: PendingEventItem[] = [];
  const now = new Date();

  // 1. Flagged migration records pending review
  const flaggedRecords = await db.select({
    count: sql<number>`COUNT(*)::int`,
    deadline: sql<string>`MIN(${migrationRecordsTable.reviewWindowDeadline})`,
  })
    .from(migrationRecordsTable)
    .where(and(
      eq(migrationRecordsTable.mdaId, mdaId),
      sql`${migrationRecordsTable.flaggedForReviewAt} IS NOT NULL`,
      sql`${migrationRecordsTable.correctedAt} IS NULL`,
      sql`${migrationRecordsTable.deletedAt} IS NULL`,
    ));

  const flaggedCount = flaggedRecords[0]?.count ?? 0;
  if (flaggedCount > 0) {
    const deadline = flaggedRecords[0]?.deadline ? new Date(flaggedRecords[0].deadline) : null;
    const daysLeft = deadline ? Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
    const urgency = daysLeft !== null && daysLeft <= 3 ? ' (urgent)' : '';

    results.push({
      eventType: 'MIGRATION_REVIEW',
      staffName: `${flaggedCount} record${flaggedCount !== 1 ? 's' : ''}`,
      effectiveDate: deadline?.toISOString() ?? now.toISOString(),
      reconciliationStatus: daysLeft !== null && daysLeft < 0 ? 'OVERDUE' : 'PENDING',
      description: `${flaggedCount} migration record${flaggedCount !== 1 ? 's' : ''} flagged for review${daysLeft !== null ? ` — ${daysLeft > 0 ? `${daysLeft} days remaining` : 'overdue'}${urgency}` : ''}`,
      actionUrl: '/dashboard/migration/review',
    });
  }

  // 2. Pending transfers involving this MDA (incoming or outgoing)
  const pendingTransfers = await db.execute(sql`
    SELECT COUNT(*)::int as count FROM transfers
    WHERE status = 'PENDING'
      AND (outgoing_mda_id = ${mdaId} OR incoming_mda_id = ${mdaId})
  `);
  const transferCount = (pendingTransfers.rows[0] as { count: number })?.count ?? 0;
  if (transferCount > 0) {
    results.push({
      eventType: 'TRANSFER_PENDING',
      staffName: `${transferCount} transfer${transferCount !== 1 ? 's' : ''}`,
      effectiveDate: now.toISOString(),
      reconciliationStatus: 'PENDING',
      description: `${transferCount} pending transfer${transferCount !== 1 ? 's' : ''} awaiting confirmation`,
      actionUrl: '/dashboard/employment-events',
    });
  }

  // 3. Unreconciled employment events
  const unreconciledEvents = await db.execute(sql`
    SELECT COUNT(*)::int as count FROM employment_events
    WHERE loan_id IN (SELECT id FROM loans WHERE mda_id = ${mdaId})
      AND reconciliation_status = 'UNCONFIRMED'
  `);
  const eventCount = (unreconciledEvents.rows[0] as { count: number })?.count ?? 0;
  if (eventCount > 0) {
    results.push({
      eventType: 'UNRECONCILED_EVENT',
      staffName: `${eventCount} event${eventCount !== 1 ? 's' : ''}`,
      effectiveDate: now.toISOString(),
      reconciliationStatus: 'UNCONFIRMED',
      description: `${eventCount} employment event${eventCount !== 1 ? 's' : ''} pending reconciliation`,
      actionUrl: '/dashboard/employment-events',
    });
  }

  return results;
}
