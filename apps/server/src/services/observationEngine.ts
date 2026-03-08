/**
 * observationEngine — Detection algorithms + template rendering for migration observations.
 *
 * Ports SQ-1 crossref.ts detection patterns into production observation records.
 * Template rendering is server-side to enforce vocabulary compliance at source.
 */

import { eq, inArray } from 'drizzle-orm';
import Decimal from 'decimal.js';
import { db } from '../db/index';
import {
  observations,
  migrationRecords,
  migrationUploads,
  personMatches,
  mdas,
} from '../db/schema';
import { buildTimelines } from './staffProfileService';
import type { ObservationType } from '@vlprs/shared';

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

  // No Approval Match: skip if approved beneficiary lists not loaded
  // This will be enabled when beneficiary list data is available
  // const noApprovalObs = detectNoApprovalMatch(...);

  // Batch insert with idempotency guard
  const { generated, skipped, byType } = await batchInsertObservations(allObservations, uploadId);

  return { generated, skipped, byType };
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

    result.push({
      type: 'rate_variance',
      staffName: r.staffName,
      staffId: r.employeeNo,
      loanId: r.loanId,
      mdaId: r.mdaId,
      migrationRecordId: r.id,
      uploadId,
      description: `This loan's total interest is ${rate}% (${interestAmount} on ${principal}), which differs from the standard 13.33%. This is consistent with a ${tenure}-installment repayment plan. Possible explanations: different approved tenure, GL-level based rate tier, administrative adjustment. Verify against loan application records.`,
      context: {
        possibleExplanations: [
          'Different approved tenure than the standard plan',
          'GL-level based rate tier applied to this loan',
          'Administrative adjustment to loan terms',
        ],
        suggestedAction: `Verify against loan application records for ${r.staffName} at ${mdaName}.`,
        dataCompleteness: completeness,
        dataPoints: {
          rate,
          interestAmount,
          principal,
          totalLoan,
          tenure,
          standardRate: '13.33',
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
