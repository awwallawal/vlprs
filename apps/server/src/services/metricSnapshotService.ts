import Decimal from 'decimal.js';
import { eq, and, count } from 'drizzle-orm';
import { db } from '../db';
import { loans, metricSnapshots } from '../db/schema';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import * as revenueProjectionService from './revenueProjectionService';
import * as loanClassificationService from './loanClassificationService';

// ─── Snapshot Capture ───────────────────────────────────────────────

export async function captureMonthlySnapshot(): Promise<void> {
  const now = new Date();
  const snapshotYear = now.getFullYear();
  const snapshotMonth = now.getMonth() + 1;

  // Compute all 4 metrics in parallel (system-wide, no MDA scope)
  const [activeLoansCount, totalExposure, recovery, completionRate] = await Promise.all([
    // Active Loans: count of loans with status ACTIVE
    // See also: executiveSummaryReportService.countActiveLoans() for MDA-scoped variant
    (async () => {
      const [result] = await db
        .select({ value: count() })
        .from(loans)
        .where(eq(loans.status, 'ACTIVE'));
      return result?.value ?? 0;
    })(),

    // Total Exposure: outstanding receivables
    revenueProjectionService.getTotalOutstandingReceivables(null),

    // Monthly Recovery: current period PAYROLL ledger total
    revenueProjectionService.getActualMonthlyRecovery(null),

    // Completion Rate: lifetime completed / total
    loanClassificationService.getLoanCompletionRateLifetime(null),
  ]);

  // Upsert: prevents duplicate if scheduler runs more than once in a month
  await db
    .insert(metricSnapshots)
    .values({
      snapshotYear,
      snapshotMonth,
      activeLoans: activeLoansCount,
      totalExposure: new Decimal(totalExposure).toFixed(2),
      monthlyRecovery: new Decimal(recovery.amount).toFixed(2),
      completionRate: new Decimal(completionRate).toFixed(2),
    })
    .onConflictDoUpdate({
      target: [metricSnapshots.snapshotYear, metricSnapshots.snapshotMonth],
      set: {
        activeLoans: activeLoansCount,
        totalExposure: new Decimal(totalExposure).toFixed(2),
        monthlyRecovery: new Decimal(recovery.amount).toFixed(2),
        completionRate: new Decimal(completionRate).toFixed(2),
        createdAt: new Date(),
      },
    });

  logger.info(
    { snapshotYear, snapshotMonth, activeLoans: activeLoansCount, totalExposure, monthlyRecovery: recovery.amount, completionRate },
    'Monthly metric snapshot captured',
  );
}

// ─── Snapshot Query ─────────────────────────────────────────────────

export async function getPreviousMonthSnapshot(
  year: number,
  month: number,
): Promise<{
  activeLoans: number;
  totalExposure: string;
  monthlyRecovery: string;
  completionRate: string;
} | null> {
  // Calculate previous month
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;

  const [result] = await db
    .select({
      activeLoans: metricSnapshots.activeLoans,
      totalExposure: metricSnapshots.totalExposure,
      monthlyRecovery: metricSnapshots.monthlyRecovery,
      completionRate: metricSnapshots.completionRate,
    })
    .from(metricSnapshots)
    .where(
      and(
        eq(metricSnapshots.snapshotYear, prevYear),
        eq(metricSnapshots.snapshotMonth, prevMonth),
      ),
    );

  return result ?? null;
}

// ─── Background Scheduler ───────────────────────────────────────────

const SCHEDULER_INTERVAL_MS = 24 * 60 * 60 * 1000; // Daily check
const SCHEDULER_STARTUP_DELAY_MS = 5 * 60 * 1000;   // 5 min after boot

let intervalRef: ReturnType<typeof setInterval> | null = null;
let timeoutRef: ReturnType<typeof setTimeout> | null = null;

export function startMetricSnapshotScheduler(): void {
  if (env.NODE_ENV === 'test') return;
  if (intervalRef || timeoutRef) return;

  timeoutRef = setTimeout(() => {
    timeoutRef = null;
    runSnapshotCheck();
    intervalRef = setInterval(runSnapshotCheck, SCHEDULER_INTERVAL_MS);
  }, SCHEDULER_STARTUP_DELAY_MS);
}

export function stopMetricSnapshotScheduler(): void {
  if (timeoutRef) {
    clearTimeout(timeoutRef);
    timeoutRef = null;
  }
  if (intervalRef) {
    clearInterval(intervalRef);
    intervalRef = null;
  }
}

// Exported for testing — called by scheduler on each daily tick
export async function runSnapshotCheck(): Promise<void> {
  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // Check if snapshot already exists for this month
    const [existing] = await db
      .select({ id: metricSnapshots.id })
      .from(metricSnapshots)
      .where(
        and(
          eq(metricSnapshots.snapshotYear, currentYear),
          eq(metricSnapshots.snapshotMonth, currentMonth),
        ),
      );

    if (existing) {
      logger.debug({ year: currentYear, month: currentMonth }, 'Metric snapshot already exists for this month — skipping');
      return;
    }

    // First-run backfill: if no snapshots exist at all, capture baseline immediately
    const [anySnapshot] = await db
      .select({ id: metricSnapshots.id })
      .from(metricSnapshots)
      .limit(1);

    if (!anySnapshot) {
      logger.info('No metric snapshots found — capturing baseline snapshot');
    }

    await captureMonthlySnapshot();
  } catch (err) {
    logger.error({ err }, 'Metric snapshot capture failed');
  }
}
