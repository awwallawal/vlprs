/**
 * observationEngine — Detection algorithms + template rendering for migration observations.
 *
 * Ports SQ-1 crossref.ts detection patterns into production observation records.
 * Template rendering is server-side to enforce vocabulary compliance at source.
 */

import { eq, and, inArray, isNull, sql } from 'drizzle-orm';
import Decimal from 'decimal.js';
import { db } from '../db/index';
import {
  observations,
  migrationRecords,
  migrationUploads,
  personMatches,
  mdas,
  mdaSubmissions,
  submissionRows,
  loans,
} from '../db/schema';
import { buildTimelines } from './staffProfileService';
import { RATE_TOLERANCE } from './migrationValidationService';
import { getTierForGradeLevel } from '@vlprs/shared';
import type { ObservationType } from '@vlprs/shared';
import { normalizeName } from '../migration/nameMatch';

// Accelerated rate-to-tenure mapping (derived from KNOWN_RATE_TIERS minus 13.33% standard)
// Formula: rate = 13.33% × tenure / 60
const ACCELERATED_RATES: Record<number, number> = {
  6.67: 30,
  8.0: 36,
  8.89: 40,
  10.66: 48,
  11.11: 50,
};

// ─── Types ──────────────────────────────────────────────────────────

interface ObservationInsert {
  type: ObservationType;
  staffName: string;
  staffId: string | null;
  loanId: string | null;
  mdaId: string;
  migrationRecordId: string | null;
  uploadId: string;
  description: string;
  context: {
    possibleExplanations: string[];
    suggestedAction: string;
    dataCompleteness: number;
    completenessNote: string;
    dataPoints: Record<string, unknown>;
  };
  sourceReference: { file: string; sheet: string; row: number } | null;
}

// ─── Main Entry Point ───────────────────────────────────────────────

/**
 * Generate all observation types for a given upload.
 * Idempotent: running again for the same upload does not create duplicates.
 */
export async function generateObservations(
  uploadId: string,
  _userId: string,
): Promise<{ generated: number; skipped: number; byType: Record<string, number> }> {
  // Verify upload exists
  const [upload] = await db
    .select({ id: migrationUploads.id, mdaId: migrationUploads.mdaId })
    .from(migrationUploads)
    .where(eq(migrationUploads.id, uploadId))
    .limit(1);

  if (!upload) {
    throw new Error('Upload not found');
  }

  // Load all migration records for this upload
  const records = await db
    .select({
      id: migrationRecords.id,
      uploadId: migrationRecords.uploadId,
      mdaId: migrationRecords.mdaId,
      staffName: migrationRecords.staffName,
      principal: migrationRecords.principal,
      totalLoan: migrationRecords.totalLoan,
      monthlyDeduction: migrationRecords.monthlyDeduction,
      outstandingBalance: migrationRecords.outstandingBalance,
      hasRateVariance: migrationRecords.hasRateVariance,
      computedRate: migrationRecords.computedRate,
      loanId: migrationRecords.loanId,
      periodYear: migrationRecords.periodYear,
      periodMonth: migrationRecords.periodMonth,
      sourceFile: migrationRecords.sourceFile,
      sourceSheet: migrationRecords.sourceSheet,
      sourceRow: migrationRecords.sourceRow,
      installmentCount: migrationRecords.installmentCount,
      employeeNo: migrationRecords.employeeNo,
      gradeLevel: migrationRecords.gradeLevel,
    })
    .from(migrationRecords)
    .where(eq(migrationRecords.uploadId, uploadId));

  if (records.length === 0) {
    return { generated: 0, skipped: 0, byType: {} };
  }

  // Load MDA names for template rendering
  const mdaIds = [...new Set(records.map((r) => r.mdaId))];
  const mdaRows = await db
    .select({ id: mdas.id, name: mdas.name, code: mdas.code })
    .from(mdas)
    .where(inArray(mdas.id, mdaIds));
  const mdaMap = new Map(mdaRows.map((m) => [m.id, m]));

  // Run all detectors
  const allObservations: ObservationInsert[] = [];

  const rateVarianceObs = detectRateVariance(records, mdaMap, uploadId);
  allObservations.push(...rateVarianceObs);

  const negativeBalanceObs = detectNegativeBalance(records, mdaMap, uploadId);
  allObservations.push(...negativeBalanceObs);

  // Timeline-based detectors
  const mdaCodeMap = new Map(mdaRows.map((m) => [m.id, m.code]));
  const timelineRecords = records
    .filter((r) => r.periodYear !== null && r.periodMonth !== null)
    .map((r) => ({
      staffName: r.staffName,
      mdaCode: mdaCodeMap.get(r.mdaId) ?? r.mdaId,
      periodYear: r.periodYear,
      periodMonth: r.periodMonth,
      outstandingBalance: r.outstandingBalance,
      monthlyDeduction: r.monthlyDeduction,
      principal: r.principal,
      totalLoan: r.totalLoan,
      sourceFile: r.sourceFile,
    }));

  const timelines = buildTimelines(timelineRecords);

  // Map MDA codes back to IDs for observation creation
  const codeToIdMap = new Map(mdaRows.map((m) => [m.code, m.id]));

  const stalledObs = detectStalledBalance(timelines, codeToIdMap, mdaMap, uploadId);
  allObservations.push(...stalledObs);

  const consecutiveObs = detectConsecutiveLoan(timelines, codeToIdMap, mdaMap, uploadId);
  allObservations.push(...consecutiveObs);

  // Multi-MDA detection from person_matches
  const multiMdaObs = await detectMultiMda(uploadId, records, mdaMap);
  allObservations.push(...multiMdaObs);

  // No Approval Match: cross-reference migration staff against live submission data
  const noApprovalObs = await detectNoApprovalMatch(records, mdaMap, uploadId);
  allObservations.push(...noApprovalObs);

  // Period Overlap: detect when multiple uploads cover the same period+MDA
  const periodOverlapObs = await detectPeriodOverlap(uploadId, records, mdaMap);
  allObservations.push(...periodOverlapObs);

  // Grade-Tier Mismatch: cross-validate grade level against principal amount limits
  const gradeTierObs = detectGradeTierMismatch(records, mdaMap, uploadId);
  allObservations.push(...gradeTierObs);

  // Within-File Duplicate: same staff + period appearing more than once in a single upload
  const withinFileDupObs = detectWithinFileDuplicates(records, mdaMap, uploadId);
  allObservations.push(...withinFileDupObs);

  // Batch insert with idempotency guard
  const { generated, skipped, byType } = await batchInsertObservations(allObservations, uploadId);

  return { generated, skipped, byType };
}

/**
 * Lightweight pre-baseline helper (Story 15.0m, finding M1).
 *
 * Runs ONLY the within-file duplicate detector against an upload and inserts
 * any resulting observations. Called fire-and-forget from validation so the
 * Observations tab surfaces same-person-same-period conflicts BEFORE the
 * user clicks Baseline — otherwise the baseline guard's 422 is the user's
 * only signal and they have nowhere to drill into.
 *
 * Idempotent: the `(type, migration_record_id)` unique index dedupes reruns.
 */
export async function generateWithinFileDuplicateObservations(
  uploadId: string,
): Promise<{ generated: number; skipped: number }> {
  const [upload] = await db
    .select({ id: migrationUploads.id })
    .from(migrationUploads)
    .where(eq(migrationUploads.id, uploadId))
    .limit(1);
  if (!upload) return { generated: 0, skipped: 0 };

  const records = await db
    .select({
      id: migrationRecords.id,
      staffName: migrationRecords.staffName,
      mdaId: migrationRecords.mdaId,
      periodYear: migrationRecords.periodYear,
      periodMonth: migrationRecords.periodMonth,
      employeeNo: migrationRecords.employeeNo,
      sourceFile: migrationRecords.sourceFile,
      sourceSheet: migrationRecords.sourceSheet,
      sourceRow: migrationRecords.sourceRow,
    })
    .from(migrationRecords)
    .where(eq(migrationRecords.uploadId, uploadId));

  if (records.length === 0) return { generated: 0, skipped: 0 };

  const mdaIds = [...new Set(records.map((r) => r.mdaId))];
  const mdaRows = await db
    .select({ id: mdas.id, name: mdas.name, code: mdas.code })
    .from(mdas)
    .where(inArray(mdas.id, mdaIds));
  const mdaMap = new Map(mdaRows.map((m) => [m.id, m]));

  const withinFileDupObs = detectWithinFileDuplicates(records, mdaMap, uploadId);
  const { generated, skipped } = await batchInsertObservations(withinFileDupObs, uploadId);
  return { generated, skipped };
}

// ─── Rate Variance Detector ─────────────────────────────────────────

export function detectRateVariance(
  records: Array<{
    id: string;
    staffName: string;
    mdaId: string;
    loanId: string | null;
    hasRateVariance: boolean;
    computedRate: string | null;
    principal: string | null;
    totalLoan: string | null;
    monthlyDeduction: string | null;
    installmentCount: number | null;
    employeeNo: string | null;
    sourceFile: string;
    sourceSheet: string;
    sourceRow: number;
  }>,
  mdaMap: Map<string, { id: string; name: string; code: string }>,
  uploadId: string,
): ObservationInsert[] {
  const result: ObservationInsert[] = [];

  for (const r of records) {
    if (!r.hasRateVariance || r.computedRate === null) continue;

    const rate = r.computedRate;
    const principal = r.principal ?? 'N/A';
    const totalLoan = r.totalLoan ?? 'N/A';
    const tenure = r.installmentCount ?? 'unknown';
    const mdaName = mdaMap.get(r.mdaId)?.name ?? 'Unknown MDA';

    // Interest amount: totalLoan - principal
    let interestAmount = 'N/A';
    if (r.totalLoan && r.principal) {
      interestAmount = new Decimal(r.totalLoan).minus(new Decimal(r.principal)).toFixed(2);
    }

    // Data completeness
    let completeness = 100;
    if (!r.principal) completeness -= 25;
    if (!r.totalLoan) completeness -= 25;
    if (!r.monthlyDeduction) completeness -= 25;
    if (!r.installmentCount) completeness -= 25;

    // Classify rate: accelerated, non-standard, or generic variance
    const rateDecimal = new Decimal(rate);
    let description: string;
    let possibleExplanations: string[];
    const dataPoints: Record<string, unknown> = {
      rate,
      interestAmount,
      principal,
      totalLoan,
      tenure,
      standardRate: '13.33',
    };

    // Check against accelerated rate tiers — find the closest match within tolerance
    const matchedAccelerated = Object.entries(ACCELERATED_RATES)
      .map(([tierRate, tenure]) => ({
        tierRate,
        tenure,
        distance: rateDecimal.minus(Number(tierRate)).abs(),
      }))
      .filter((m) => m.distance.lte(RATE_TOLERANCE))
      .sort((a, b) => a.distance.comparedTo(b.distance))[0] ?? null;

    if (matchedAccelerated) {
      const { tierRate: matchedRate, tenure: matchedTenure } = matchedAccelerated;
      description = `Accelerated Repayment Detected — ${matchedTenure}-month tenure. The standard 13.33% annual rate applied to a ${matchedTenure}-month repayment period produces an effective ${matchedRate}% total interest. This is a recognized accelerated repayment pathway.`;
      possibleExplanations = [
        `Staff opted for a ${matchedTenure}-month accelerated repayment plan`,
        'Approved shorter tenure to reduce total interest',
      ];
      dataPoints.matchedTenure = matchedTenure;
      dataPoints.matchedRate = matchedRate;
    } else {
      // Compute theoretical tenure for non-standard rates
      const computedTenure = Math.round(rateDecimal.div(new Decimal('13.33')).mul(60).toNumber());
      dataPoints.computedTenure = computedTenure;

      description = `Non-Standard Rate — effective rate ${rate}% (equivalent to ~${computedTenure}-month tenure) does not correspond to any recognized repayment pathway. This may indicate: partial repayment arrangement, administrative adjustment, or data entry variance. Requires manual verification against original loan approval records.`;
      possibleExplanations = [
        'Partial repayment arrangement outside standard tenures',
        'Administrative adjustment to loan terms',
        'Data entry variance in principal or total loan amount',
      ];
      dataPoints.knownNonStandard = true;
    }

    result.push({
      type: 'rate_variance',
      staffName: r.staffName,
      staffId: r.employeeNo,
      loanId: r.loanId,
      mdaId: r.mdaId,
      migrationRecordId: r.id,
      uploadId,
      description,
      context: {
        possibleExplanations,
        suggestedAction: `Verify against loan application records for ${r.staffName} at ${mdaName}.`,
        dataCompleteness: completeness,
        completenessNote: [
          'Loan terms and ledger entries reviewed',
          !r.principal ? 'Principal amount not available' : null,
          !r.totalLoan ? 'Total loan amount not available' : null,
          !r.monthlyDeduction ? 'Monthly deduction not available' : null,
          !r.installmentCount ? 'Installment count not available' : null,
        ].filter(Boolean).join('. ') + '.',
        dataPoints,
      },
      sourceReference: {
        file: r.sourceFile,
        sheet: r.sourceSheet,
        row: r.sourceRow,
      },
    });
  }

  return result;
}

// ─── Negative Balance Detector ──────────────────────────────────────

export function detectNegativeBalance(
  records: Array<{
    id: string;
    staffName: string;
    mdaId: string;
    loanId: string | null;
    outstandingBalance: string | null;
    monthlyDeduction: string | null;
    periodYear: number | null;
    periodMonth: number | null;
    employeeNo: string | null;
    sourceFile: string;
    sourceSheet: string;
    sourceRow: number;
  }>,
  mdaMap: Map<string, { id: string; name: string; code: string }>,
  uploadId: string,
): ObservationInsert[] {
  // Group by person+MDA, keep most negative per group (SQ-1 pattern)
  const worstByPerson = new Map<string, typeof records[number]>();

  for (const r of records) {
    if (r.outstandingBalance === null) continue;
    const balance = new Decimal(r.outstandingBalance);
    if (balance.gte(0)) continue;

    const key = `${r.staffName}::${r.mdaId}`;
    const existing = worstByPerson.get(key);
    if (!existing) {
      worstByPerson.set(key, r);
    } else {
      const existingBal = new Decimal(existing.outstandingBalance!);
      if (balance.lt(existingBal)) {
        worstByPerson.set(key, r);
      }
    }
  }

  const result: ObservationInsert[] = [];

  for (const r of worstByPerson.values()) {
    const balance = new Decimal(r.outstandingBalance!);
    const overAmount = balance.abs().toFixed(2);
    const period = r.periodYear && r.periodMonth
      ? `${r.periodYear}-${String(r.periodMonth).padStart(2, '0')}`
      : 'unknown period';
    const mdaName = mdaMap.get(r.mdaId)?.name ?? 'Unknown MDA';

    // Estimate months of over-deduction
    let estimatedMonths = 'unknown';
    if (r.monthlyDeduction) {
      const deduction = new Decimal(r.monthlyDeduction);
      if (deduction.gt(0)) {
        estimatedMonths = String(Math.ceil(balance.abs().div(deduction).toNumber()));
      }
    }

    let completeness = 100;
    if (!r.monthlyDeduction) completeness = 50;

    result.push({
      type: 'negative_balance',
      staffName: r.staffName,
      staffId: r.employeeNo,
      loanId: r.loanId,
      mdaId: r.mdaId,
      migrationRecordId: r.id,
      uploadId,
      description: `Balance reached ${r.outstandingBalance} (below zero) in ${period}, suggesting deductions continued after loan completion. An estimated ${overAmount} may be due for refund. Possible explanations: delayed stop-deduction processing, timing difference between payroll and loan records. Verify deduction stop date.`,
      context: {
        possibleExplanations: [
          'Delayed stop-deduction processing after loan completion',
          'Timing difference between payroll cut-off and loan records',
          'Data entry lag in recording loan completion',
        ],
        suggestedAction: `Verify deduction stop date for ${r.staffName} at ${mdaName}. Confirm if refund of ${overAmount} is warranted.`,
        dataCompleteness: completeness,
        completenessNote: r.monthlyDeduction
          ? 'Outstanding balance, monthly deduction, and period data reviewed.'
          : 'Outstanding balance and period data reviewed. Monthly deduction not available for over-deduction estimate.',
        dataPoints: {
          amount: r.outstandingBalance,
          overAmount,
          period,
          monthlyDeduction: r.monthlyDeduction,
          estimatedMonths,
        },
      },
      sourceReference: {
        file: r.sourceFile,
        sheet: r.sourceSheet,
        row: r.sourceRow,
      },
    });
  }

  return result;
}

// ─── Stalled Balance Detector ───────────────────────────────────────

interface TimelineData {
  name: string;
  mdaCode: string;
  months: Array<{
    year: number;
    month: number;
    outstandingBalance: string | null;
    monthlyDeduction: string | null;
    principal: string | null;
    totalLoan: string | null;
    sourceFile: string;
  }>;
  totalMonthsPresent: number;
}

export function detectStalledBalance(
  timelines: TimelineData[],
  codeToIdMap: Map<string, string>,
  mdaMap: Map<string, { id: string; name: string; code: string }>,
  uploadId: string,
): ObservationInsert[] {
  const result: ObservationInsert[] = [];

  for (const tl of timelines) {
    if (tl.months.length < 3) continue;

    const mdaId = codeToIdMap.get(tl.mdaCode);
    if (!mdaId) continue;

    // Find longest streak of identical non-null balances
    let bestStreak = 1;
    let bestStartIdx = 0;
    let currentStreak = 1;
    let streakStartIdx = 0;

    for (let i = 1; i < tl.months.length; i++) {
      const curr = tl.months[i].outstandingBalance;
      const prev = tl.months[i - 1].outstandingBalance;

      if (curr !== null && prev !== null && curr === prev) {
        currentStreak++;
        if (currentStreak > bestStreak) {
          bestStreak = currentStreak;
          bestStartIdx = streakStartIdx;
        }
      } else {
        currentStreak = 1;
        streakStartIdx = i;
      }
    }

    if (bestStreak < 3) continue;

    const startMonth = tl.months[bestStartIdx];
    const endMonth = tl.months[bestStartIdx + bestStreak - 1];
    const amount = startMonth.outstandingBalance!;

    const formatPeriod = (m: { year: number; month: number }) =>
      `${m.year}-${String(m.month).padStart(2, '0')}`;

    // Data completeness based on timeline coverage
    const spanMonths = tl.months.length > 0
      ? (tl.months[tl.months.length - 1].year * 12 + tl.months[tl.months.length - 1].month) -
        (tl.months[0].year * 12 + tl.months[0].month) + 1
      : 0;
    let completeness: number;
    if (tl.totalMonthsPresent >= 6) completeness = 100;
    else if (tl.totalMonthsPresent >= 4) completeness = 75;
    else completeness = 50;

    const mdaName = mdaMap.get(mdaId)?.name ?? 'Unknown MDA';

    result.push({
      type: 'stalled_balance',
      staffName: tl.name,
      staffId: null,
      loanId: null,
      mdaId,
      migrationRecordId: null,
      uploadId,
      description: `Outstanding balance has remained at ${amount} for ${bestStreak} consecutive months (${formatPeriod(startMonth)}–${formatPeriod(endMonth)}). Possible explanations: salary deduction suspension, administrative hold, data entry lag. Confirm with MDA payroll records.`,
      context: {
        possibleExplanations: [
          'Salary deduction temporarily suspended',
          'Administrative hold on loan repayment',
          'Data entry lag — deductions processed but not yet recorded',
        ],
        suggestedAction: `Confirm with ${mdaName} payroll records whether deductions continued during ${formatPeriod(startMonth)}–${formatPeriod(endMonth)}.`,
        dataCompleteness: completeness,
        completenessNote: `Timeline data spans ${tl.totalMonthsPresent} months across a ${spanMonths}-month observation window.`,
        dataPoints: {
          amount,
          count: bestStreak,
          startMonth: formatPeriod(startMonth),
          endMonth: formatPeriod(endMonth),
          totalMonthsPresent: tl.totalMonthsPresent,
          monthSpan: spanMonths,
        },
      },
      sourceReference: {
        file: startMonth.sourceFile,
        sheet: '',
        row: 0,
      },
    });
  }

  return result;
}

// ─── Multi-MDA Detector ─────────────────────────────────────────────

async function detectMultiMda(
  uploadId: string,
  records: Array<{
    id: string;
    staffName: string;
    mdaId: string;
    employeeNo: string | null;
  }>,
  mdaMap: Map<string, { id: string; name: string; code: string }>,
): Promise<ObservationInsert[]> {
  // Get confirmed person_matches
  const matches = await db
    .select({
      id: personMatches.id,
      personAName: personMatches.personAName,
      personAMdaId: personMatches.personAMdaId,
      personBName: personMatches.personBName,
      personBMdaId: personMatches.personBMdaId,
      status: personMatches.status,
    })
    .from(personMatches)
    .where(inArray(personMatches.status, ['auto_confirmed', 'confirmed']));

  if (matches.length === 0) return [];

  // Group by person to find unique multi-MDA persons
  // Use person A name as the canonical name (matches always have A as reference)
  const personMdaSet = new Map<string, Set<string>>();

  for (const m of matches) {
    const key = m.personAName.toLowerCase().trim();
    if (!personMdaSet.has(key)) {
      personMdaSet.set(key, new Set());
    }
    const set = personMdaSet.get(key)!;
    set.add(m.personAMdaId);
    set.add(m.personBMdaId);
  }

  const result: ObservationInsert[] = [];

  // Find which persons from this upload are multi-MDA
  const uploadStaff = new Map<string, typeof records[number]>();
  for (const r of records) {
    const key = r.staffName.toLowerCase().trim();
    if (!uploadStaff.has(key)) {
      uploadStaff.set(key, r);
    }
  }

  for (const [personKey, mdaIds] of personMdaSet) {
    if (mdaIds.size < 2) continue;

    const record = uploadStaff.get(personKey);
    if (!record) continue; // Person not in this upload

    const mdaNames = [...mdaIds]
      .map((id) => mdaMap.get(id)?.name ?? 'Unknown')
      .join(', ');

    result.push({
      type: 'multi_mda',
      staffName: record.staffName,
      staffId: record.employeeNo,
      loanId: null,
      mdaId: record.mdaId,
      migrationRecordId: null,
      uploadId,
      description: `This staff member has loan records across ${mdaIds.size} MDAs (${mdaNames}). This typically indicates an inter-MDA transfer. Verify transfer documentation and confirm loan continuity.`,
      context: {
        possibleExplanations: [
          'Inter-MDA transfer with loan carried over',
          'Concurrent service across multiple MDAs',
          'Name match across distinct individuals — verify identity',
        ],
        suggestedAction: 'Verify transfer documentation and confirm loan continuity across MDAs.',
        dataCompleteness: 100,
        completenessNote: 'Cross-MDA person match data and migration records reviewed.',
        dataPoints: {
          count: mdaIds.size,
          mdaList: mdaNames,
          mdaIds: [...mdaIds],
        },
      },
      sourceReference: null,
    });
  }

  return result;
}

// ─── Consecutive Loan Without Clearance Detector ────────────────────

export function detectConsecutiveLoan(
  timelines: TimelineData[],
  codeToIdMap: Map<string, string>,
  mdaMap: Map<string, { id: string; name: string; code: string }>,
  uploadId: string,
): ObservationInsert[] {
  const result: ObservationInsert[] = [];

  for (const tl of timelines) {
    if (tl.months.length < 2) continue;

    const mdaId = codeToIdMap.get(tl.mdaCode);
    if (!mdaId) continue;

    let prevPrincipal: string | null = null;
    let prevBalance: string | null = null;

    for (const m of tl.months) {
      if (
        m.principal !== null &&
        prevPrincipal !== null &&
        m.principal !== prevPrincipal &&
        m.principal !== '0' &&
        m.principal !== '0.00' &&
        prevBalance !== null
      ) {
        const priorBal = new Decimal(prevBalance);
        if (priorBal.gt(0)) {
          const formatPeriod = (mo: { year: number; month: number }) =>
            `${mo.year}-${String(mo.month).padStart(2, '0')}`;

          const mdaName = mdaMap.get(mdaId)?.name ?? 'Unknown MDA';

          // Determine data completeness
          let completeness = 100;
          if (!m.principal) completeness -= 25;
          if (!prevBalance) completeness -= 25;

          result.push({
            type: 'consecutive_loan',
            staffName: tl.name,
            staffId: null,
            loanId: null,
            mdaId,
            migrationRecordId: null,
            uploadId,
            description: `A new loan (${m.principal}) commenced in ${formatPeriod(m)} while the prior loan still shows an outstanding balance of ${prevBalance} in the previous period. This may indicate: approved loan renewal, balance transfer to new terms, or data entry timing difference. Verify loan renewal documentation.`,
            context: {
              possibleExplanations: [
                'Approved loan renewal with outstanding balance rolled over',
                'Balance transfer to new loan terms',
                'Data entry timing difference between old and new loan records',
              ],
              suggestedAction: `Verify loan renewal documentation for ${tl.name} at ${mdaName}.`,
              dataCompleteness: completeness,
              completenessNote: [
                'Prior and current loan principal amounts reviewed',
                !m.principal ? 'Current principal not available' : null,
                !prevBalance ? 'Prior period balance not available' : null,
              ].filter(Boolean).join('. ') + '.',
              dataPoints: {
                newPrincipal: m.principal,
                newStartPeriod: formatPeriod(m),
                priorBalance: prevBalance,
                priorPrincipal: prevPrincipal,
              },
            },
            sourceReference: {
              file: m.sourceFile,
              sheet: '',
              row: 0,
            },
          });

          // Only report first occurrence per person+MDA
          break;
        }
      }

      if (m.principal !== null) prevPrincipal = m.principal;
      if (m.outstandingBalance !== null) prevBalance = m.outstandingBalance;
    }
  }

  return result;
}

// ─── No Approval Match Detector ─────────────────────────────────────

/**
 * Cross-reference migration staff against confirmed submission data.
 * Staff appearing in migration but NOT in any confirmed submission for the same MDA
 * may warrant attention.
 *
 * Guard: Only runs if the MDA has ≥1 confirmed (non-historical) submission.
 * Data completeness: 100% if ≥3 submissions, 50% if 1-2 submissions.
 */
async function detectNoApprovalMatch(
  records: Array<{
    id: string;
    staffName: string;
    mdaId: string;
    loanId: string | null;
    employeeNo: string | null;
    sourceFile: string;
    sourceSheet: string;
    sourceRow: number;
  }>,
  mdaMap: Map<string, { id: string; name: string; code: string }>,
  uploadId: string,
): Promise<ObservationInsert[]> {
  // Group migration records by MDA
  const recordsByMda = new Map<string, typeof records>();
  for (const r of records) {
    const existing = recordsByMda.get(r.mdaId) ?? [];
    existing.push(r);
    recordsByMda.set(r.mdaId, existing);
  }

  const result: ObservationInsert[] = [];

  // Batch query: count confirmed (non-historical) submissions per MDA (single query for all MDAs)
  const allMdaIds = [...recordsByMda.keys()];
  const submissionCounts = await db
    .select({
      mdaId: mdaSubmissions.mdaId,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(mdaSubmissions)
    .where(
      and(
        inArray(mdaSubmissions.mdaId, allMdaIds),
        eq(mdaSubmissions.status, 'confirmed'),
        sql`${mdaSubmissions.source} != 'historical'`,
      ),
    )
    .groupBy(mdaSubmissions.mdaId);

  const submissionCountMap = new Map(submissionCounts.map((r) => [r.mdaId, r.count]));

  // Filter to MDAs that have at least 1 confirmed submission
  const eligibleMdaIds = allMdaIds.filter((id) => (submissionCountMap.get(id) ?? 0) > 0);
  if (eligibleMdaIds.length === 0) return result;

  // Batch query: get all distinct staffIds from confirmed submission rows for eligible MDAs
  const submissionStaffRows = await db
    .select({ mdaId: mdaSubmissions.mdaId, staffId: submissionRows.staffId })
    .from(submissionRows)
    .innerJoin(mdaSubmissions, eq(submissionRows.submissionId, mdaSubmissions.id))
    .where(
      and(
        inArray(mdaSubmissions.mdaId, eligibleMdaIds),
        eq(mdaSubmissions.status, 'confirmed'),
        sql`${mdaSubmissions.source} != 'historical'`,
      ),
    );

  // Group submission staff by MDA
  const submissionStaffByMda = new Map<string, Set<string>>();
  for (const r of submissionStaffRows) {
    const existing = submissionStaffByMda.get(r.mdaId) ?? new Set<string>();
    existing.add(r.staffId.toLowerCase().trim());
    submissionStaffByMda.set(r.mdaId, existing);
  }

  // Batch query: get loan staffIds for ALL baselined records across all MDAs
  const allBaselinedLoanIds = [...recordsByMda.values()]
    .flat()
    .filter((r) => r.loanId !== null)
    .map((r) => r.loanId!);

  const loanStaffMap = new Map<string, string>(); // loanId → staffId
  if (allBaselinedLoanIds.length > 0) {
    const loanRows = await db
      .select({ id: loans.id, staffId: loans.staffId })
      .from(loans)
      .where(inArray(loans.id, allBaselinedLoanIds));
    for (const l of loanRows) {
      loanStaffMap.set(l.id, l.staffId.toLowerCase().trim());
    }
  }

  for (const [mdaId, mdaRecords] of recordsByMda) {
    const mdaSubCount = submissionCountMap.get(mdaId) ?? 0;
    // Skip MDA entirely if no confirmed submissions (no reference data)
    if (mdaSubCount === 0) continue;

    const completeness = mdaSubCount >= 3 ? 100 : 50;
    const submissionStaffIds = submissionStaffByMda.get(mdaId) ?? new Set<string>();

    // Deduplicate: one observation per unique staff per MDA
    const seenStaff = new Set<string>();
    const mdaName = mdaMap.get(mdaId)?.name ?? 'Unknown MDA';

    for (const r of mdaRecords) {
      const staffKey = r.staffName.toLowerCase().trim();
      if (seenStaff.has(staffKey)) continue;

      // Determine staff's submission identity
      let matched = false;

      // Path 1: Baselined record → use loan staffId
      if (r.loanId && loanStaffMap.has(r.loanId)) {
        const loanStaffId = loanStaffMap.get(r.loanId)!;
        if (submissionStaffIds.has(loanStaffId)) {
          matched = true;
        }
      }

      // Path 2: Non-baselined with employeeNo → try direct staffId match
      if (!matched && r.employeeNo) {
        if (submissionStaffIds.has(r.employeeNo.toLowerCase().trim())) {
          matched = true;
        }
      }

      if (!matched) {
        seenStaff.add(staffKey);
        result.push({
          type: 'no_approval_match',
          staffName: r.staffName,
          staffId: r.employeeNo,
          loanId: r.loanId,
          mdaId,
          migrationRecordId: null, // Person-level observation
          uploadId,
          description: `This staff member has migration baseline records but no confirmed deduction submission has been received for their MDA. Possible explanations: MDA has not yet submitted monthly deduction data, staff records are from a period before current reporting, name or ID variance between systems. Cross-check with MDA submission history.`,
          context: {
            possibleExplanations: [
              'MDA has not yet submitted monthly deduction data for this staff member',
              'Staff records are from a period before the current reporting cycle',
              'Name or ID variance between migration records and submission data',
            ],
            suggestedAction: `Cross-check with ${mdaName} submission history. Verify whether this staff member appears under a different identifier.`,
            dataCompleteness: completeness,
            completenessNote: mdaSubCount >= 3
              ? `Migration records and ${mdaSubCount} confirmed submissions reviewed.`
              : `Migration records reviewed. Only ${mdaSubCount} confirmed submission(s) available for cross-reference.`,
            dataPoints: {
              mdaSubmissionCount: mdaSubCount,
              submissionStaffCount: submissionStaffIds.size,
            },
          },
          sourceReference: {
            file: r.sourceFile,
            sheet: r.sourceSheet,
            row: r.sourceRow,
          },
        });
      } else {
        seenStaff.add(staffKey);
      }
    }
  }

  return result;
}

// ─── Period Overlap Detector ────────────────────────────────────────

/**
 * Detect when multiple uploads cover the same period+MDA.
 * Creates one observation per overlap per upload.
 * Idempotency: composite key (type, uploadId, mdaId).
 */
async function detectPeriodOverlap(
  uploadId: string,
  records: Array<{
    id: string;
    mdaId: string;
    periodYear: number | null;
    periodMonth: number | null;
  }>,
  mdaMap: Map<string, { id: string; name: string; code: string }>,
): Promise<ObservationInsert[]> {
  // Group records by period+MDA
  const periodMdaGroups = new Map<string, { mdaId: string; periodYear: number; periodMonth: number; count: number }>();
  for (const r of records) {
    if (r.periodYear === null || r.periodMonth === null) continue;
    const key = `${r.periodYear}-${r.periodMonth}-${r.mdaId}`;
    if (!periodMdaGroups.has(key)) {
      periodMdaGroups.set(key, { mdaId: r.mdaId, periodYear: r.periodYear, periodMonth: r.periodMonth, count: 0 });
    }
    periodMdaGroups.get(key)!.count++;
  }

  const result: ObservationInsert[] = [];

  for (const [, group] of periodMdaGroups) {
    // Find OTHER uploads with records for the same period+MDA
    const overlappingUploads = await db
      .select({
        uploadId: migrationRecords.uploadId,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(migrationRecords)
      .innerJoin(migrationUploads, eq(migrationRecords.uploadId, migrationUploads.id))
      .where(
        and(
          eq(migrationRecords.mdaId, group.mdaId),
          eq(migrationRecords.periodYear, group.periodYear),
          eq(migrationRecords.periodMonth, group.periodMonth),
          sql`${migrationRecords.uploadId} != ${uploadId}`,
          eq(migrationUploads.status, 'completed'),
          isNull(migrationRecords.deletedAt),
        ),
      )
      .groupBy(migrationRecords.uploadId);

    if (overlappingUploads.length === 0) continue;

    const period = `${group.periodYear}-${String(group.periodMonth).padStart(2, '0')}`;
    const mdaName = mdaMap.get(group.mdaId)?.name ?? 'Unknown MDA';

    for (const overlap of overlappingUploads) {
      // System-level observation — no real staff. Synthetic staffName for display/filtering
      result.push({
        type: 'period_overlap',
        staffName: `Period overlap: ${period}`,
        staffId: null,
        loanId: null,
        mdaId: group.mdaId,
        migrationRecordId: null,
        uploadId,
        description: `Upload for ${period} to ${mdaName} overlaps with existing upload ${overlap.uploadId.slice(0, 8)}. Previous upload: ${overlap.count} records. Current upload: ${group.count} records. Review both uploads to determine which should be superseded.`,
        context: {
          possibleExplanations: [
            'Updated data uploaded to replace an earlier version',
            'Duplicate upload of the same period data',
            'Corrected records uploaded alongside original submission',
          ],
          suggestedAction: `Review both uploads for ${period} at ${mdaName}. Determine which upload should be the canonical source and consider superseding the other.`,
          dataCompleteness: 100,
          completenessNote: 'Both uploads for the overlapping period fully available for comparison.',
          dataPoints: {
            period,
            existingUploadId: overlap.uploadId,
            existingRecordCount: overlap.count,
            currentRecordCount: group.count,
          },
        },
        sourceReference: null,
      });
    }
  }

  return result;
}

// ─── Grade-Tier Mismatch Detector ───────────────────────────────────

/**
 * Detect when a migration record's principal exceeds the maximum eligible
 * amount for the staff's grade-level tier.
 */
export function detectGradeTierMismatch(
  records: Array<{
    id: string;
    staffName: string;
    mdaId: string;
    loanId: string | null;
    principal: string | null;
    gradeLevel: string | null;
    employeeNo: string | null;
    sourceFile: string;
    sourceSheet: string;
    sourceRow: number;
  }>,
  mdaMap: Map<string, { id: string; name: string; code: string }>,
  uploadId: string,
): ObservationInsert[] {
  const result: ObservationInsert[] = [];

  for (const r of records) {
    if (!r.gradeLevel || !r.principal) continue;

    // Parse numeric grade from string (e.g., "GL 10" → 10, "LEVEL 07" → 7, "10" → 10)
    const gradeMatch = r.gradeLevel.match(/(\d+)/);
    if (!gradeMatch) continue;

    const gradeNum = parseInt(gradeMatch[1], 10);
    if (isNaN(gradeNum)) continue;

    const tier = getTierForGradeLevel(gradeNum);
    // GL 11 has no tier — skip (not an observation)
    if (!tier) continue;

    const principalDecimal = new Decimal(r.principal);
    const maxPrincipal = new Decimal(tier.maxPrincipal);

    if (principalDecimal.lte(maxPrincipal)) continue;

    const mdaName = mdaMap.get(r.mdaId)?.name ?? 'Unknown MDA';

    result.push({
      type: 'grade_tier_mismatch',
      staffName: r.staffName,
      staffId: r.employeeNo,
      loanId: r.loanId,
      mdaId: r.mdaId,
      migrationRecordId: r.id,
      uploadId,
      description: `Staff at GL ${gradeNum} has principal ₦${principalDecimal.toFixed(2)}, which exceeds the maximum eligible amount of ₦${maxPrincipal.toFixed(2)} for Tier ${tier.tier} (${tier.gradeLevels}). Possible explanations: approved exception, incorrect grade level in records, loan predating current tier structure. Verify against loan application.`,
      context: {
        possibleExplanations: [
          'Approved exception to standard tier limits',
          'Incorrect grade level in migration records',
          'Loan predating current tier structure',
        ],
        suggestedAction: `Verify grade level and loan approval records for ${r.staffName} at ${mdaName}.`,
        dataCompleteness: 100,
        completenessNote: 'Grade level, principal amount, and tier configuration reviewed.',
        dataPoints: {
          gradeLevel: gradeNum,
          principal: r.principal,
          maxPrincipal: tier.maxPrincipal,
          tier: tier.tier,
          tierGradeLevels: tier.gradeLevels,
        },
      },
      sourceReference: {
        file: r.sourceFile,
        sheet: r.sourceSheet,
        row: r.sourceRow,
      },
    });
  }

  return result;
}

// ─── Within-File Duplicate Detector (Story 15.0m) ───────────────────

/**
 * A group of records sharing a normalised name + period within one upload.
 * `isDistinctByEmployeeNo` is true when every record has a non-null
 * `employeeNo` AND those IDs are all distinct — that's a confident signal of
 * distinct individuals with similar names, and the group is skipped.
 */
type WithinFileDuplicateRecord = {
  id: string;
  staffName: string;
  mdaId: string;
  periodYear: number | null;
  periodMonth: number | null;
  employeeNo: string | null;
  sourceFile: string;
  sourceSheet: string;
  sourceRow: number;
};

export interface WithinFileDuplicateGroup {
  staffName: string;
  period: string;
  count: number;
  recordIds: string[];
  mdaId: string;
}

/**
 * Group upload records by (normalised staff name + period). Returns only
 * groups with size ≥ 2 that aren't explained away by distinct employeeNos.
 *
 * Name normalisation is delegated to `normalizeName()` (same helper used by
 * the cross-MDA dedup engine), so honorifics (MRS, DR, CHIEF, ALHAJI…),
 * parenthetical suffixes `(LATE)`, interior whitespace, and trailing
 * punctuation are all collapsed before comparison.
 *
 * Records without a resolvable period are excluded (cannot be duplicates of
 * an unknown period).
 */
export function findWithinFileDuplicateGroups(
  records: ReadonlyArray<WithinFileDuplicateRecord>,
): Array<{ group: WithinFileDuplicateRecord[]; period: string }> {
  const groups = new Map<string, WithinFileDuplicateRecord[]>();
  for (const record of records) {
    if (record.periodYear === null || record.periodMonth === null) continue;
    const nameKey = normalizeName(record.staffName);
    if (!nameKey) continue;
    const key = `${nameKey}::${record.periodYear}-${String(record.periodMonth).padStart(2, '0')}`;
    const existing = groups.get(key);
    if (existing) {
      existing.push(record);
    } else {
      groups.set(key, [record]);
    }
  }

  const result: Array<{ group: WithinFileDuplicateRecord[]; period: string }> = [];
  for (const [key, group] of groups) {
    if (group.length < 2) continue;

    // Escape hatch: if every record has a non-null employeeNo AND all those
    // IDs are distinct, they are almost certainly distinct staff members who
    // happen to share a common Nigerian name. Don't flag.
    const empNos = group.map((r) => r.employeeNo);
    const allHaveId = empNos.every((e) => e !== null && e.trim() !== '');
    if (allHaveId) {
      const distinctIds = new Set(empNos);
      if (distinctIds.size === group.length) continue;
    }

    const period = key.split('::')[1];
    result.push({ group, period });
  }
  return result;
}

/**
 * Detect when the same staff member appears multiple times in the same upload
 * for the same reporting period. Pre-baseline data integrity check — silently
 * creating two loans for one person is worse than flagging and asking.
 */
export function detectWithinFileDuplicates(
  records: Array<WithinFileDuplicateRecord>,
  mdaMap: Map<string, { id: string; name: string; code: string }>,
  uploadId: string,
): ObservationInsert[] {
  const duplicateGroups = findWithinFileDuplicateGroups(records);

  const result: ObservationInsert[] = [];
  for (const { group, period } of duplicateGroups) {
    const first = group[0];
    const mdaName = mdaMap.get(first.mdaId)?.name ?? 'Unknown MDA';
    const rowNumbers = group.map((r) => r.sourceRow).filter((n) => n > 0);

    result.push({
      type: 'within_file_duplicate',
      staffName: first.staffName,
      staffId: first.employeeNo,
      loanId: null,
      mdaId: first.mdaId,
      migrationRecordId: first.id,
      uploadId,
      description: `${first.staffName} appears ${group.length} times in this upload for ${period}. Review to determine if entries should be merged or removed before baseline creation.`,
      context: {
        possibleExplanations: [
          'Data entry variance — the same person entered more than once in the source file',
          'Duplicate row carried over from the source spreadsheet',
          'Same person with multiple loans in the same period, requiring manual review',
          'Distinct individuals with similar names after normalisation',
        ],
        suggestedAction: `Review all ${group.length} entries for ${first.staffName} in ${period} at ${mdaName}. Remove duplicates or confirm as distinct before baseline creation.`,
        dataCompleteness: 100,
        completenessNote: `All ${group.length} matching records for this staff member and period reviewed from the same upload.`,
        dataPoints: {
          staffName: first.staffName,
          period,
          duplicateCount: group.length,
          recordIds: group.map((r) => r.id),
          rowNumbers,
          mdaName,
        },
      },
      sourceReference: {
        file: first.sourceFile,
        sheet: first.sourceSheet,
        row: first.sourceRow,
      },
    });
  }

  return result;
}

// ─── Batch Insert with Idempotency Guard ────────────────────────────

async function batchInsertObservations(
  allObservations: ObservationInsert[],
  uploadId: string,
): Promise<{ generated: number; skipped: number; byType: Record<string, number> }> {
  if (allObservations.length === 0) {
    return { generated: 0, skipped: 0, byType: {} };
  }

  let generated = 0;
  let skipped = 0;
  const byType: Record<string, number> = {};

  // Split into record-level (has migrationRecordId) and person-level (null)
  const recordLevel = allObservations.filter((o) => o.migrationRecordId !== null);
  const personLevel = allObservations.filter((o) => o.migrationRecordId === null);

  // Record-level: batch INSERT with ON CONFLICT DO NOTHING (DB unique constraint)
  if (recordLevel.length > 0) {
    const inserted = await db
      .insert(observations)
      .values(recordLevel)
      .onConflictDoNothing()
      .returning({ id: observations.id, type: observations.type });

    for (const row of inserted) {
      generated++;
      byType[row.type] = (byType[row.type] ?? 0) + 1;
    }
    skipped += recordLevel.length - inserted.length;
  }

  // Person-level: batch check existing, then batch insert new
  if (personLevel.length > 0) {
    const existingPersonObs = await db
      .select({
        type: observations.type,
        staffName: observations.staffName,
        mdaId: observations.mdaId,
      })
      .from(observations)
      .where(eq(observations.uploadId, uploadId));

    const existingKeys = new Set(
      existingPersonObs.map((o) => `${o.type}::${o.staffName}::${o.mdaId}`),
    );

    const newPersonObs = personLevel.filter(
      (o) => !existingKeys.has(`${o.type}::${o.staffName}::${o.mdaId}`),
    );

    if (newPersonObs.length > 0) {
      await db.insert(observations).values(newPersonObs);
      for (const obs of newPersonObs) {
        generated++;
        byType[obs.type] = (byType[obs.type] ?? 0) + 1;
      }
    }
    skipped += personLevel.length - newPersonObs.length;
  }

  return { generated, skipped, byType };
}
