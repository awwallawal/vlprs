/**
 * traceReportService — Assembles individual trace reports from existing services.
 *
 * Composition layer: calls staffProfileService, observationService, personMatchingService
 * and assembles results into a printable trace report structure.
 */

import { randomUUID } from 'node:crypto';
import Decimal from 'decimal.js';
import { db } from '../db/index';
import { migrationRecords, users } from '../db/schema';
import { eq, max } from 'drizzle-orm';
import { getPersonProfile } from './staffProfileService';
import { getObservationsForStaff } from './observationService';
import { VOCABULARY } from '@vlprs/shared';
import type {
  TraceReportData,
  TraceLoanCycle,
  RateAnalysis,
  TraceReportMetadata,
  TraceReportSummary,
  DataCompletenessScore,
} from '@vlprs/shared';
import type { PersonTimeline } from './staffProfileService';

// ─── Reference Number ──────────────────────────────────────────────

export function generateReferenceNumber(): string {
  const year = new Date().getFullYear();
  // UUID-based to guarantee uniqueness across server restarts (H1 code review fix)
  const uid = randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
  return `VLPRS-TRACE-${year}-${uid}`;
}

/**
 * No-op — retained for test backward compatibility after H1 fix.
 */
export function resetSequenceCounter(): void {
  // No longer needed — reference numbers are UUID-based
}

// ─── Loan Cycle Detection ──────────────────────────────────────────

function formatPeriod(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function determineCycleStatus(
  lastBalance: string | null,
  monthsOfData: number,
): 'active' | 'liquidated' | 'cleared' | 'inferred' {
  if (lastBalance === null) return 'inferred';
  const bal = new Decimal(lastBalance);
  if (bal.isZero() || bal.isNegative()) return 'liquidated';
  if (monthsOfData <= 1) return 'inferred';
  return 'active';
}

export function detectLoanCycles(
  timelines: PersonTimeline[],
  mdaNameMap: Map<string, string>,
): TraceLoanCycle[] {
  const cycles: TraceLoanCycle[] = [];
  let globalCycleNum = 0;

  for (const tl of timelines) {
    if (tl.months.length === 0) continue;

    const mdaName = mdaNameMap.get(tl.mdaCode) ?? tl.mdaCode;
    let currentCycle: Partial<TraceLoanCycle> | null = null;
    let prevPrincipal: Decimal | null = null;
    let prevBalance: string | null = null;

    for (const month of tl.months) {
      const principal = month.principal ? new Decimal(month.principal) : null;
      const principalChanged =
        principal !== null &&
        prevPrincipal !== null &&
        !principal.equals(prevPrincipal) &&
        !principal.isZero();

      if (principal && (!prevPrincipal || principalChanged)) {
        // Close previous cycle
        if (currentCycle && currentCycle.balanceTrajectory!.length > 0) {
          const lastEntry = currentCycle.balanceTrajectory![currentCycle.balanceTrajectory!.length - 1];
          currentCycle.endPeriod = lastEntry.period;
          currentCycle.status = determineCycleStatus(
            prevBalance,
            currentCycle.monthsOfData!,
          );
          cycles.push(currentCycle as TraceLoanCycle);
        }

        // Start new cycle
        globalCycleNum++;
        currentCycle = {
          cycleNumber: globalCycleNum,
          mdaCode: tl.mdaCode,
          mdaName,
          startPeriod: formatPeriod(month.year, month.month),
          endPeriod: null,
          principal: principal.toString(),
          totalLoan: month.totalLoan ?? '0',
          interestAmount: '0',
          effectiveRate: '0',
          monthlyDeduction: month.monthlyDeduction ?? '0',
          installments: 0,
          monthsOfData: 0,
          gapMonths: 0,
          status: 'active',
          balanceTrajectory: [],
        };

        // Compute interest
        if (month.totalLoan && month.principal) {
          const tl2 = new Decimal(month.totalLoan);
          const interest = tl2.minus(principal);
          currentCycle.interestAmount = interest.toString();
          if (!principal.isZero()) {
            currentCycle.effectiveRate = interest.dividedBy(principal).times(100).toFixed(2);
          }
        }
      }

      if (currentCycle) {
        const isStalled =
          prevBalance !== null &&
          month.outstandingBalance !== null &&
          month.outstandingBalance === prevBalance;

        currentCycle.balanceTrajectory!.push({
          period: formatPeriod(month.year, month.month),
          balance: month.outstandingBalance ?? 'N/A',
          deduction: month.monthlyDeduction ?? 'N/A',
          installmentsPaid: currentCycle.balanceTrajectory!.length + 1,
          installmentsRemaining: null,
          sourceFile: month.sourceFile,
          isGap: month.outstandingBalance === null,
          isStalled,
          isNewLoan: principal !== null && prevPrincipal !== null && !principal.equals(prevPrincipal),
        });
        currentCycle.monthsOfData!++;
        currentCycle.installments = currentCycle.monthsOfData!;
        if (month.outstandingBalance === null) {
          currentCycle.gapMonths!++;
        }
      }

      prevBalance = month.outstandingBalance;
      if (principal) prevPrincipal = principal;
    }

    // Close final open cycle
    if (currentCycle && currentCycle.balanceTrajectory!.length > 0) {
      const lastEntry = currentCycle.balanceTrajectory![currentCycle.balanceTrajectory!.length - 1];
      currentCycle.endPeriod = lastEntry.period;
      currentCycle.status = determineCycleStatus(
        prevBalance,
        currentCycle.monthsOfData!,
      );
      cycles.push(currentCycle as TraceLoanCycle);
    }
  }

  return cycles;
}

// ─── Rate Analysis ─────────────────────────────────────────────────

export function buildRateAnalysis(cycle: TraceLoanCycle): RateAnalysis {
  const principal = new Decimal(cycle.principal);
  const actualTotalLoan = new Decimal(cycle.totalLoan);

  // Handle zero-value cycles — no meaningful rate analysis possible (C1 code review fix)
  if (principal.isZero() || actualTotalLoan.isZero()) {
    return {
      principal: principal.toString(),
      actualTotalLoan: actualTotalLoan.toString(),
      actualInterest: '0',
      apparentRate: '0.00',
      standardTest: { expectedInterest: '0', match: false },
      conclusion: 'Insufficient loan data for rate analysis.',
    };
  }

  const actualInterest = actualTotalLoan.minus(principal);
  const apparentRate = actualInterest.dividedBy(principal).times(100);

  // Test A: Standard 13.33% at 60 months
  const standardInterest = principal.times('0.1333');
  const standardMatch = actualInterest.equals(standardInterest);

  // Test B: Accelerated tenure
  const TENURES = [50, 48, 40, 36, 30];
  const monthlyInterest = standardInterest.dividedBy(60);
  let acceleratedMatch: { tenure: number; expected: Decimal } | null = null;

  for (const tenure of TENURES) {
    const expected = monthlyInterest.times(tenure);
    if (actualInterest.minus(expected).abs().lessThanOrEqualTo('1.00')) {
      acceleratedMatch = { tenure, expected };
      break;
    }
  }

  let conclusion: string;
  if (acceleratedMatch) {
    conclusion = `Standard 13.33% rate applied to a ${acceleratedMatch.tenure}-month accelerated tenure. Total interest reduces proportionally: ${acceleratedMatch.tenure}/60 × 13.33% = ${apparentRate.toFixed(2)}%.`;
  } else if (standardMatch) {
    conclusion = 'Standard 13.33% rate at 60-month tenure.';
  } else {
    conclusion = `Effective rate of ${apparentRate.toFixed(2)}% does not match standard tenures. Verify against loan application records.`;
  }

  return {
    principal: principal.toString(),
    actualTotalLoan: actualTotalLoan.toString(),
    actualInterest: actualInterest.toString(),
    apparentRate: apparentRate.toFixed(2),
    standardTest: {
      expectedInterest: standardInterest.toString(),
      match: standardMatch,
    },
    acceleratedTest: acceleratedMatch
      ? {
          tenure: acceleratedMatch.tenure,
          expectedInterest: acceleratedMatch.expected.toString(),
          match: true,
        }
      : undefined,
    conclusion,
  };
}

// ─── Data Completeness ─────────────────────────────────────────────

const SCORED_FIELDS = [
  'principal',
  'totalLoan',
  'monthlyDeduction',
  'outstandingBalance',
] as const;

function computeDataCompleteness(cycles: TraceLoanCycle[]): DataCompletenessScore {
  let totalFields = 0;
  let presentFields = 0;
  const perCycle: { cycleNumber: number; percent: number }[] = [];

  for (const cycle of cycles) {
    let cycleTotal = 0;
    let cyclePresent = 0;

    for (const entry of cycle.balanceTrajectory) {
      for (const field of SCORED_FIELDS) {
        cycleTotal++;
        totalFields++;
        const value = field === 'outstandingBalance'
          ? entry.balance
          : field === 'monthlyDeduction'
            ? entry.deduction
            : field === 'principal'
              ? cycle.principal
              : cycle.totalLoan;

        if (value && value !== 'N/A') {
          cyclePresent++;
          presentFields++;
        }
      }
    }

    perCycle.push({
      cycleNumber: cycle.cycleNumber,
      percent: cycleTotal > 0 ? Math.round((cyclePresent / cycleTotal) * 100) : 0,
    });
  }

  return {
    overallPercent: totalFields > 0 ? Math.round((presentFields / totalFields) * 100) : 0,
    perCycle,
  };
}

// ─── Assemble Trace Report ─────────────────────────────────────────

export async function assembleTraceReport(
  personKey: string,
  userId: string,
  userName: string,
  userRole: string,
  mdaScope?: string | null,
): Promise<TraceReportData> {
  // Resolve display name from user record (H2 code review fix — email → actual name)
  let displayName = userName;
  const [userRecord] = await db
    .select({ firstName: users.firstName, lastName: users.lastName })
    .from(users)
    .where(eq(users.id, userId));
  if (userRecord) {
    const fullName = `${userRecord.firstName} ${userRecord.lastName}`.trim();
    if (fullName) displayName = fullName;
  }

  // Load person profile (timelines, cycles, matches, records)
  const profile = await getPersonProfile(personKey, mdaScope);

  // Build MDA name map from profile records
  const mdaNameMap = new Map<string, string>();
  for (const [mdaCode, records] of Object.entries(profile.recordsByMda)) {
    const rec = (records as Array<{ mdaName?: string }>)[0];
    if (rec?.mdaName) {
      mdaNameMap.set(mdaCode, rec.mdaName);
    } else {
      mdaNameMap.set(mdaCode, mdaCode);
    }
  }

  // Detect loan cycles from timelines
  const loanCycles = detectLoanCycles(profile.timelines, mdaNameMap);

  // Build rate analysis for every cycle (1:1 mapping with loanCycles — C1 code review fix)
  const rateAnalyses = loanCycles.map((c) => buildRateAnalysis(c));

  // Load observations for this person
  const observations = await getObservationsForStaff(profile.staffName, mdaScope);

  // Build cross-MDA timeline from timelines
  const crossMdaTimeline = profile.timelines.map((tl) => ({
    mdaCode: tl.mdaCode,
    mdaName: mdaNameMap.get(tl.mdaCode) ?? tl.mdaCode,
    firstSeen: formatPeriod(tl.firstSeen.year, tl.firstSeen.month),
    lastSeen: formatPeriod(tl.lastSeen.year, tl.lastSeen.month),
  }));

  // Compute data completeness
  const dataCompleteness = computeDataCompleteness(loanCycles);

  // Compute total months across all timelines
  const totalMonths = profile.timelines.reduce((sum, tl) => sum + tl.totalMonthsPresent, 0);

  // Date range from timelines
  let minPeriod = '9999-12';
  let maxPeriod = '0000-01';
  for (const tl of profile.timelines) {
    const first = formatPeriod(tl.firstSeen.year, tl.firstSeen.month);
    const last = formatPeriod(tl.lastSeen.year, tl.lastSeen.month);
    if (first < minPeriod) minPeriod = first;
    if (last > maxPeriod) maxPeriod = last;
  }

  // Determine current status
  const lastCycle = loanCycles[loanCycles.length - 1];
  const currentStatus = lastCycle ? lastCycle.status : 'No loan data';

  // Get last migration upload date
  const [lastUpload] = await db
    .select({ latest: max(migrationRecords.createdAt) })
    .from(migrationRecords);

  const metadata: TraceReportMetadata = {
    referenceNumber: generateReferenceNumber(),
    generatedAt: new Date().toISOString(),
    generatedBy: { name: displayName, role: userRole },
    dataSourceNote: VOCABULARY.TRACE_DATA_SOURCE,
    dataFreshness: lastUpload?.latest
      ? `Migration data — last updated ${lastUpload.latest.toISOString().slice(0, 10)}`
      : 'Migration data',
  };

  const summary: TraceReportSummary = {
    staffName: profile.staffName,
    staffId: profile.staffId,
    mdas: profile.mdas.map((code) => ({
      code,
      name: mdaNameMap.get(code) ?? code,
    })),
    totalLoanCycles: loanCycles.length,
    totalMonthsOfRecords: totalMonths,
    dateRange: { from: minPeriod, to: maxPeriod },
    currentStatus,
  };

  // Beneficiary profile
  const currentMdaCode = profile.mdas[profile.mdas.length - 1] ?? profile.mdas[0];
  const previousMdas = profile.mdas
    .filter((code) => code !== currentMdaCode)
    .map((code) => {
      const tl = profile.timelines.find((t) => t.mdaCode === code);
      return {
        name: mdaNameMap.get(code) ?? code,
        code,
        lastSeen: tl ? formatPeriod(tl.lastSeen.year, tl.lastSeen.month) : '',
      };
    });

  return {
    metadata,
    summary,
    beneficiaryProfile: {
      fullName: profile.staffName,
      staffId: profile.staffId,
      currentMda: {
        name: mdaNameMap.get(currentMdaCode) ?? currentMdaCode,
        code: currentMdaCode,
      },
      previousMdas,
      approvalListEntries: [], // Approval list data not yet available in migration records
    },
    loanCycles,
    rateAnalyses,
    observations,
    crossMdaTimeline,
    dataCompleteness,
  };
}
