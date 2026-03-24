/**
 * inactiveLoanDetector — Detects loans with no deduction for 60+ consecutive days,
 * creates observations, and auto-promotes to exceptions.
 *
 * Two modes:
 *   A) Background scheduler: every 6 hours, all MDAs (system user)
 *   B) On-demand: POST /api/exceptions/detect-inactive (user-scoped)
 *
 * Follows observation-first pattern: create observation → promoteToException()
 */

import { eq, and, sql, inArray } from 'drizzle-orm';
import { db } from '../db/index';
import { observations, users } from '../db/schema';
import { promoteToException } from './observationService';
import { logger } from '../lib/logger';
import { env } from '../config/env';

// ─── Constants ───────────────────────────────────────────────────────

/** FR57: loans with no deduction for this many consecutive days are flagged */
const INACTIVITY_THRESHOLD_DAYS = 60;

/** Employment events within this window explain inactivity */
const EVENT_LOOKBACK_DAYS = 90;

/** Background scheduler interval: 6 hours */
const SCHEDULER_INTERVAL_MS = 6 * 60 * 60 * 1000; // 21,600,000 ms

/** Startup delay before first scheduled run */
const SCHEDULER_STARTUP_DELAY_MS = 5 * 60 * 1000; // 300,000 ms

/** Employment event types that explain a deduction gap */
const EXPECTED_INACTIVITY_EVENTS = [
  'LWOP_START',
  'SUSPENDED',
  'ABSCONDED',
  'TRANSFERRED_OUT',
] as const;

// ─── Result Types ────────────────────────────────────────────────────

export interface DetectionResult {
  detected: number;
  excluded: number;
  newExceptions: number;
  alreadyFlagged: number;
}

interface InactiveLoanCandidate {
  loanId: string;
  staffId: string;
  staffName: string;
  mdaId: string;
  mdaName: string;
  lastDeductionDate: string | null;
  daysSinceDeduction: number;
}

// ─── Core Detection ──────────────────────────────────────────────────

export async function detectInactiveLoans(
  mdaScope?: string | null,
  userId?: string,
): Promise<DetectionResult> {
  // Step 1: Find all ACTIVE loans with no deduction for 60+ days
  const mdaFilter = mdaScope ? sql`AND l.mda_id = ${mdaScope}` : sql``;

  const inactiveResult = await db.execute(sql`
    SELECT l.id AS loan_id, l.staff_id, l.staff_name, l.mda_id, m.name AS mda_name,
           MAX(le.created_at)::date::text AS last_deduction_date,
           COALESCE(EXTRACT(DAY FROM NOW() - MAX(le.created_at))::int, 9999) AS days_since
    FROM loans l
    JOIN mdas m ON l.mda_id = m.id
    LEFT JOIN ledger_entries le ON l.id = le.loan_id
    WHERE l.status = 'ACTIVE'
      ${mdaFilter}
    GROUP BY l.id, l.staff_id, l.staff_name, l.mda_id, m.name
    HAVING MAX(le.created_at) < NOW() - INTERVAL '${sql.raw(String(INACTIVITY_THRESHOLD_DAYS))} days'
       OR MAX(le.created_at) IS NULL
  `);

  const candidates: InactiveLoanCandidate[] = (inactiveResult.rows as Array<{
    loan_id: string; staff_id: string; staff_name: string;
    mda_id: string; mda_name: string; last_deduction_date: string | null; days_since: number;
  }>).map(r => ({
    loanId: r.loan_id,
    staffId: r.staff_id,
    staffName: r.staff_name,
    mdaId: r.mda_id,
    mdaName: r.mda_name,
    lastDeductionDate: r.last_deduction_date,
    daysSinceDeduction: Number(r.days_since),
  }));

  if (candidates.length === 0) {
    return { detected: 0, excluded: 0, newExceptions: 0, alreadyFlagged: 0 };
  }

  const candidateLoanIds = candidates.map(c => c.loanId);

  // Step 2: Exclude loans with expected-inactivity employment events
  const eventExclusionResult = await db.execute(sql`
    SELECT DISTINCT loan_id
    FROM employment_events
    WHERE loan_id IN (${sql.join(candidateLoanIds.map(id => sql`${id}`), sql`, `)})
      AND event_type IN (${sql.join(EXPECTED_INACTIVITY_EVENTS.map(e => sql`${e}`), sql`, `)})
      AND effective_date > NOW() - INTERVAL '${sql.raw(String(EVENT_LOOKBACK_DAYS))} days'
  `);

  const excludedLoanIds = new Set(
    (eventExclusionResult.rows as Array<{ loan_id: string }>).map(r => r.loan_id),
  );

  const afterExclusion = candidates.filter(c => !excludedLoanIds.has(c.loanId));
  const excludedCount = candidates.length - afterExclusion.length;

  if (afterExclusion.length === 0) {
    return { detected: candidates.length, excluded: excludedCount, newExceptions: 0, alreadyFlagged: 0 };
  }

  // Step 3: Idempotency check — skip loans that already have an open inactive observation
  const remainingLoanIds = afterExclusion.map(c => c.loanId);

  const existingInactive = await db
    .select({ loanId: observations.loanId })
    .from(observations)
    .where(and(
      eq(observations.type, 'inactive_loan'),
      inArray(observations.loanId, remainingLoanIds),
      inArray(observations.status, ['promoted', 'unreviewed']),
    ));

  const alreadyFlagged = new Set(existingInactive.map(o => o.loanId));
  const newCandidates = afterExclusion.filter(c => !alreadyFlagged.has(c.loanId));
  const alreadyFlaggedCount = afterExclusion.length - newCandidates.length;

  if (newCandidates.length === 0) {
    return { detected: candidates.length, excluded: excludedCount, newExceptions: 0, alreadyFlagged: alreadyFlaggedCount };
  }

  // Step 4: Submission cross-reference for description enrichment
  const submissionContext = await getSubmissionContext(newCandidates);

  // Step 5: Resolve the user ID (for promotedBy)
  const promoterId = userId ?? await getSystemUserId();
  if (!promoterId) {
    logger.error('No user ID available for inactive loan detection — skipping creation');
    return { detected: candidates.length, excluded: excludedCount, newExceptions: 0, alreadyFlagged: alreadyFlaggedCount };
  }

  // Step 6: Batch-insert observations, then promote each to exception
  const observationValues = newCandidates.map(candidate => {
    const submissionInfo = submissionContext.get(candidate.loanId);
    const description = buildDescription(candidate, submissionInfo);
    return {
      type: 'inactive_loan' as const,
      staffName: candidate.staffName,
      staffId: candidate.staffId,
      loanId: candidate.loanId,
      mdaId: candidate.mdaId,
      description,
      context: {
        possibleExplanations: ['Payroll processing delay', 'Undeclared employment event', 'Administrative oversight'],
        suggestedAction: 'Review loan status and contact MDA for clarification',
        dataCompleteness: submissionInfo ? 80 : 50,
        dataPoints: {
          lastDeductionDate: candidate.lastDeductionDate,
          daysSinceDeduction: candidate.daysSinceDeduction,
          hasSubmissionData: !!submissionInfo,
          submissionEventFlag: submissionInfo?.eventFlag ?? null,
        },
      },
      sourceReference: null,
      status: 'unreviewed' as const,
    };
  });

  const insertedObs = await db
    .insert(observations)
    .values(observationValues)
    .returning({ id: observations.id });

  // Promote each observation to exception (sequential to respect DB constraints)
  for (const obs of insertedObs) {
    await promoteToException(obs.id, promoterId, 'medium');
  }

  const newExceptionCount = insertedObs.length;

  return {
    detected: candidates.length,
    excluded: excludedCount,
    newExceptions: newExceptionCount,
    alreadyFlagged: alreadyFlaggedCount,
  };
}

// ─── Submission Cross-Reference ──────────────────────────────────────

interface SubmissionInfo {
  eventFlag: string;
  amountDeducted: string;
}

async function getSubmissionContext(
  candidates: InactiveLoanCandidate[],
): Promise<Map<string, SubmissionInfo>> {
  const result = new Map<string, SubmissionInfo>();
  if (candidates.length === 0) return result;

  // For each candidate, check the MDA's latest confirmed submission for matching staffId
  const mdaIds = [...new Set(candidates.map(c => c.mdaId))];
  const staffIds = [...new Set(candidates.map(c => c.staffId))];

  // Get latest confirmed submission per MDA
  const submissionResult = await db.execute(sql`
    SELECT sr.staff_id, sr.event_flag, sr.amount_deducted, ms.mda_id
    FROM submission_rows sr
    JOIN mda_submissions ms ON sr.submission_id = ms.id
    WHERE ms.status = 'confirmed'
      AND ms.mda_id IN (${sql.join(mdaIds.map(id => sql`${id}`), sql`, `)})
      AND sr.staff_id IN (${sql.join(staffIds.map(id => sql`${id}`), sql`, `)})
      AND ms.created_at = (
        SELECT MAX(ms2.created_at)
        FROM mda_submissions ms2
        WHERE ms2.mda_id = ms.mda_id AND ms2.status = 'confirmed'
      )
  `);

  const submissionMap = new Map<string, { eventFlag: string; amountDeducted: string; mdaId: string }>();
  for (const row of submissionResult.rows as Array<{ staff_id: string; event_flag: string; amount_deducted: string; mda_id: string }>) {
    submissionMap.set(`${row.mda_id}:${row.staff_id}`, {
      eventFlag: row.event_flag,
      amountDeducted: row.amount_deducted,
      mdaId: row.mda_id,
    });
  }

  for (const candidate of candidates) {
    const key = `${candidate.mdaId}:${candidate.staffId}`;
    const sub = submissionMap.get(key);
    if (sub) {
      result.set(candidate.loanId, { eventFlag: sub.eventFlag, amountDeducted: sub.amountDeducted });
    }
  }

  return result;
}

// ─── Description Builder ─────────────────────────────────────────────

function buildDescription(
  candidate: InactiveLoanCandidate,
  submissionInfo?: SubmissionInfo,
): string {
  const lastDate = candidate.lastDeductionDate ?? 'never';
  const base = `No deduction recorded for ${candidate.daysSinceDeduction} days. Last deduction: ${lastDate}.`;

  if (!submissionInfo) {
    return `${base} No MDA submission data available for cross-reference.`;
  }

  if (submissionInfo.eventFlag === 'NONE' && submissionInfo.amountDeducted === '0.00') {
    return `${base} MDA submitted ₦0 with no event flag — potential payroll error or undeclared separation.`;
  }

  if (submissionInfo.eventFlag !== 'NONE') {
    return `${base} MDA declared event flag: ${submissionInfo.eventFlag} — verify event processing status.`;
  }

  return `${base} MDA submitted ₦${submissionInfo.amountDeducted} with no event flag — deduction reported but not recorded in ledger.`;
}

// ─── System User Lookup ──────────────────────────────────────────────

let cachedSystemUserId: string | null = null;

async function getSystemUserId(): Promise<string | null> {
  if (cachedSystemUserId) return cachedSystemUserId;

  // Try to find a system user by email
  const [systemUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, 'system@vlprs.local'))
    .limit(1);

  if (systemUser) {
    cachedSystemUserId = systemUser.id;
    return cachedSystemUserId;
  }

  // Fallback: first SUPER_ADMIN user
  const [admin] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, 'super_admin'))
    .limit(1);

  if (admin) {
    cachedSystemUserId = admin.id;
    return cachedSystemUserId;
  }

  return null;
}

// ─── Background Scheduler ────────────────────────────────────────────

let intervalRef: ReturnType<typeof setInterval> | null = null;
let timeoutRef: ReturnType<typeof setTimeout> | null = null;

export function startInactiveLoanScheduler(): void {
  if (env.NODE_ENV === 'test') return;
  if (intervalRef || timeoutRef) return; // Already running

  // First run after 5-minute delay to avoid startup load spike
  timeoutRef = setTimeout(() => {
    timeoutRef = null;
    runDetection();
    intervalRef = setInterval(runDetection, SCHEDULER_INTERVAL_MS);
  }, SCHEDULER_STARTUP_DELAY_MS);
}

export function stopInactiveLoanScheduler(): void {
  if (timeoutRef) {
    clearTimeout(timeoutRef);
    timeoutRef = null;
  }
  if (intervalRef) {
    clearInterval(intervalRef);
    intervalRef = null;
  }
}

async function runDetection(): Promise<void> {
  try {
    const result = await detectInactiveLoans(null);
    logger.info(
      { detected: result.detected, excluded: result.excluded, newExceptions: result.newExceptions, alreadyFlagged: result.alreadyFlagged },
      'Inactive loan detection completed',
    );
  } catch (err) {
    logger.error({ err }, 'Inactive loan detection failed');
  }
}

/** Visible for testing — reset cached system user ID */
export function resetSystemUserCache(): void {
  cachedSystemUserId = null;
}
