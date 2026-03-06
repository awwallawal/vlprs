/**
 * staffProfileService — Person profile aggregation + timeline.
 *
 * Derives person identity from migration_records via normalized name grouping.
 * Builds per-person timelines with monthly snapshots, gap detection, and cycle analysis.
 */

import { eq, and, isNull, or, sql, asc } from 'drizzle-orm';
import { db } from '../db/index';
import { migrationRecords, personMatches, mdas } from '../db/schema';
import { normalizeName } from '../migration/nameMatch';
import { withMdaScope } from '../lib/mdaScope';
import { AppError } from '../lib/appError';

// ─── Types ──────────────────────────────────────────────────────────

interface PersonListFilters {
  page: number;
  limit: number;
  mdaFilter?: string;
  sortBy?: string;
  sortOrder?: string;
}

export interface PersonListItem {
  personKey: string;
  staffName: string;
  staffId: string | null;
  mdas: string[];
  recordCount: number;
  varianceCount: number;
  hasRateVariance: boolean;
  profileComplete: boolean;
}

export interface MonthSnapshot {
  year: number;
  month: number;
  outstandingBalance: string | null;
  monthlyDeduction: string | null;
  principal: string | null;
  totalLoan: string | null;
  sourceFile: string;
}

export interface PersonTimeline {
  name: string;
  mdaCode: string;
  months: MonthSnapshot[];
  firstSeen: { year: number; month: number };
  lastSeen: { year: number; month: number };
  totalMonthsPresent: number;
  gapMonths: number;
}

export interface LoanCycle {
  mdaCode: string;
  startPeriod: { year: number; month: number };
  endPeriod: { year: number; month: number };
  principal: string | null;
  rate: string | null;
  monthsPresent: number;
  gapMonths: number;
  status: 'active' | 'completed' | 'beyond_tenure';
}

// ─── Person List ────────────────────────────────────────────────────

/**
 * List persons derived from migration_records, grouped by normalized name.
 * Uses application-level normalizeName() (not SQL UPPER/TRIM) so that
 * title-stripped / parenthetical-stripped names merge correctly.
 */
export async function listPersons(
  filters: PersonListFilters,
  mdaScope?: string | null,
) {
  const conditions = [isNull(migrationRecords.deletedAt)];
  if (mdaScope) {
    conditions.push(withMdaScope(migrationRecords.mdaId, mdaScope)!);
  }
  if (filters.mdaFilter) {
    conditions.push(eq(migrationRecords.mdaId, filters.mdaFilter));
  }

  // Fetch all records with aggregation-relevant fields
  const allRecords = await db
    .select({
      staffName: migrationRecords.staffName,
      employeeNo: migrationRecords.employeeNo,
      mdaCode: mdas.code,
      varianceCategory: migrationRecords.varianceCategory,
      hasRateVariance: migrationRecords.hasRateVariance,
      dateOfBirth: migrationRecords.dateOfBirth,
      dateOfFirstAppointment: migrationRecords.dateOfFirstAppointment,
    })
    .from(migrationRecords)
    .innerJoin(mdas, eq(migrationRecords.mdaId, mdas.id))
    .where(and(...conditions));

  // Aggregate in application using normalizeName() for consistent grouping
  const personMap = new Map<string, {
    staffName: string;
    staffId: string | null;
    mdas: Set<string>;
    recordCount: number;
    varianceCount: number;
    hasRateVariance: boolean;
    hasDob: boolean;
    hasAppointment: boolean;
  }>();

  for (const r of allRecords) {
    const norm = normalizeName(r.staffName);
    if (!norm) continue;

    const existing = personMap.get(norm);
    if (existing) {
      existing.mdas.add(r.mdaCode);
      existing.recordCount++;
      if (r.varianceCategory && r.varianceCategory !== 'clean') existing.varianceCount++;
      if (r.hasRateVariance) existing.hasRateVariance = true;
      if (r.dateOfBirth) existing.hasDob = true;
      if (r.dateOfFirstAppointment) existing.hasAppointment = true;
      if (!existing.staffId && r.employeeNo?.trim()) existing.staffId = r.employeeNo.trim();
    } else {
      personMap.set(norm, {
        staffName: r.staffName,
        staffId: r.employeeNo?.trim() || null,
        mdas: new Set([r.mdaCode]),
        recordCount: 1,
        varianceCount: (r.varianceCategory && r.varianceCategory !== 'clean') ? 1 : 0,
        hasRateVariance: r.hasRateVariance ?? false,
        hasDob: !!r.dateOfBirth,
        hasAppointment: !!r.dateOfFirstAppointment,
      });
    }
  }

  // Convert to array and sort
  let persons: PersonListItem[] = [...personMap.entries()].map(([norm, p]) => {
    const mdaList = [...p.mdas].sort();
    return {
      personKey: `${mdaList[0]}:${norm}`,
      staffName: p.staffName,
      staffId: p.staffId,
      mdas: mdaList,
      recordCount: p.recordCount,
      varianceCount: p.varianceCount,
      hasRateVariance: p.hasRateVariance,
      profileComplete: p.hasDob && p.hasAppointment,
    };
  });

  // Sort
  const sortBy = filters.sortBy || 'staff_name';
  const desc = filters.sortOrder === 'desc';
  persons.sort((a, b) => {
    let cmp = 0;
    if (sortBy === 'record_count') cmp = a.recordCount - b.recordCount;
    else if (sortBy === 'variance_count') cmp = a.varianceCount - b.varianceCount;
    else cmp = a.staffName.localeCompare(b.staffName);
    return desc ? -cmp : cmp;
  });

  // Paginate
  const total = persons.length;
  const offset = (filters.page - 1) * filters.limit;
  const data = persons.slice(offset, offset + filters.limit);

  return {
    data,
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages: Math.ceil(total / filters.limit),
    },
  };
}

// ─── Person Profile ─────────────────────────────────────────────────

/**
 * Get full person profile with migration records, computed values, variance data, and cross-MDA matches.
 * Uses application-level normalizeName() to match records by normalized staff name.
 */
export async function getPersonProfile(personKey: string, mdaScope?: string | null) {
  // Parse personKey: "MDACODE:NORMALIZED_NAME"
  const colonIdx = personKey.indexOf(':');
  if (colonIdx < 0) {
    throw new AppError(400, 'INVALID_PERSON_KEY', 'Person key must be in format MDA_CODE:NAME');
  }

  const normalizedName = personKey.substring(colonIdx + 1);

  // Fetch all records (optionally MDA-scoped), then filter by normalizeName() in app
  const conditions = [isNull(migrationRecords.deletedAt)];
  if (mdaScope) {
    conditions.push(withMdaScope(migrationRecords.mdaId, mdaScope)!);
  }

  const allRecords = await db
    .select({
      id: migrationRecords.id,
      uploadId: migrationRecords.uploadId,
      mdaId: migrationRecords.mdaId,
      mdaCode: mdas.code,
      mdaName: mdas.name,
      staffName: migrationRecords.staffName,
      employeeNo: migrationRecords.employeeNo,
      periodYear: migrationRecords.periodYear,
      periodMonth: migrationRecords.periodMonth,
      era: migrationRecords.era,
      principal: migrationRecords.principal,
      interestTotal: migrationRecords.interestTotal,
      totalLoan: migrationRecords.totalLoan,
      monthlyDeduction: migrationRecords.monthlyDeduction,
      outstandingBalance: migrationRecords.outstandingBalance,
      installmentCount: migrationRecords.installmentCount,
      installmentsPaid: migrationRecords.installmentsPaid,
      installmentsOutstanding: migrationRecords.installmentsOutstanding,
      dateOfBirth: migrationRecords.dateOfBirth,
      dateOfFirstAppointment: migrationRecords.dateOfFirstAppointment,
      varianceCategory: migrationRecords.varianceCategory,
      varianceAmount: migrationRecords.varianceAmount,
      computedRate: migrationRecords.computedRate,
      hasRateVariance: migrationRecords.hasRateVariance,
      computedTotalLoan: migrationRecords.computedTotalLoan,
      computedMonthlyDeduction: migrationRecords.computedMonthlyDeduction,
      computedOutstandingBalance: migrationRecords.computedOutstandingBalance,
      sourceFile: migrationRecords.sourceFile,
      sourceSheet: migrationRecords.sourceSheet,
      sourceRow: migrationRecords.sourceRow,
    })
    .from(migrationRecords)
    .innerJoin(mdas, eq(migrationRecords.mdaId, mdas.id))
    .where(and(...conditions))
    .orderBy(asc(migrationRecords.periodYear), asc(migrationRecords.periodMonth));

  // Filter to records matching the normalized name
  const records = allRecords.filter(
    (r) => normalizeName(r.staffName) === normalizedName,
  );

  if (records.length === 0) {
    throw new AppError(404, 'PERSON_NOT_FOUND', 'No records found for this person.');
  }

  // Group records by MDA
  const recordsByMda = new Map<string, typeof records>();
  for (const r of records) {
    const key = r.mdaCode;
    if (!recordsByMda.has(key)) recordsByMda.set(key, []);
    recordsByMda.get(key)!.push(r);
  }

  // Build person summary
  const staffName = records[0].staffName;
  const staffId = records.find((r) => r.employeeNo)?.employeeNo || null;
  const mdaList = [...new Set(records.map((r) => r.mdaCode))];
  const varianceCount = records.filter(
    (r) => r.varianceCategory && r.varianceCategory !== 'clean',
  ).length;
  const hasRateVariance = records.some((r) => r.hasRateVariance);
  const profileComplete = records.some((r) => r.dateOfBirth) &&
    records.some((r) => r.dateOfFirstAppointment);

  // Build timelines
  const timelines = buildTimelines(records);

  // Detect loan cycles
  const cycles = detectCycles(timelines);

  // Get cross-MDA matches with MDA names resolved
  const rawMatches = await db
    .select()
    .from(personMatches)
    .where(
      or(
        eq(personMatches.personAName, normalizedName),
        eq(personMatches.personBName, normalizedName),
      ),
    );

  // Resolve MDA names for matches
  const mdaIds = new Set<string>();
  for (const m of rawMatches) {
    mdaIds.add(m.personAMdaId);
    mdaIds.add(m.personBMdaId);
  }
  const mdaNameMap = new Map<string, string>();
  if (mdaIds.size > 0) {
    const mdaRows = await db
      .select({ id: mdas.id, code: mdas.code })
      .from(mdas)
      .where(sql`${mdas.id} IN ${[...mdaIds]}`);
    for (const row of mdaRows) {
      mdaNameMap.set(row.id, row.code);
    }
  }

  const matches = rawMatches.map((m) => ({
    ...m,
    personAMdaCode: mdaNameMap.get(m.personAMdaId) ?? m.personAMdaId,
    personBMdaCode: mdaNameMap.get(m.personBMdaId) ?? m.personBMdaId,
  }));

  return {
    staffName,
    staffId,
    mdas: mdaList,
    recordCount: records.length,
    varianceCount,
    hasRateVariance,
    profileComplete,
    recordsByMda: Object.fromEntries(recordsByMda),
    timelines,
    cycles,
    matches,
  };
}

// ─── Timeline Building (ported from SQ-1 crossref.ts) ────────────────

/**
 * Build per-person per-MDA timelines from migration records.
 */
export function buildTimelines(
  records: Array<{
    staffName: string;
    mdaCode: string;
    periodYear: number | null;
    periodMonth: number | null;
    outstandingBalance: string | null;
    monthlyDeduction: string | null;
    principal: string | null;
    totalLoan: string | null;
    sourceFile: string;
  }>,
): PersonTimeline[] {
  const timelineMap = new Map<string, PersonTimeline>();

  for (const r of records) {
    if (r.periodYear === null || r.periodMonth === null) continue;

    const key = r.mdaCode;
    if (!timelineMap.has(key)) {
      timelineMap.set(key, {
        name: normalizeName(r.staffName),
        mdaCode: r.mdaCode,
        months: [],
        firstSeen: { year: r.periodYear, month: r.periodMonth },
        lastSeen: { year: r.periodYear, month: r.periodMonth },
        totalMonthsPresent: 0,
        gapMonths: 0,
      });
    }

    const timeline = timelineMap.get(key)!;

    // Deduplicate same-month entries (keep first)
    const alreadyHas = timeline.months.some(
      (m) => m.year === r.periodYear && m.month === r.periodMonth,
    );
    if (alreadyHas) continue;

    timeline.months.push({
      year: r.periodYear,
      month: r.periodMonth,
      outstandingBalance: r.outstandingBalance,
      monthlyDeduction: r.monthlyDeduction,
      principal: r.principal,
      totalLoan: r.totalLoan,
      sourceFile: r.sourceFile,
    });

    // Update bounds
    const period = r.periodYear * 12 + r.periodMonth;
    const firstPeriod = timeline.firstSeen.year * 12 + timeline.firstSeen.month;
    const lastPeriod = timeline.lastSeen.year * 12 + timeline.lastSeen.month;

    if (period < firstPeriod) {
      timeline.firstSeen = { year: r.periodYear, month: r.periodMonth };
    }
    if (period > lastPeriod) {
      timeline.lastSeen = { year: r.periodYear, month: r.periodMonth };
    }
  }

  // Post-processing: sort, compute stats
  for (const timeline of timelineMap.values()) {
    timeline.months.sort((a, b) => (a.year * 12 + a.month) - (b.year * 12 + b.month));
    timeline.totalMonthsPresent = timeline.months.length;

    const spanMonths =
      (timeline.lastSeen.year * 12 + timeline.lastSeen.month) -
      (timeline.firstSeen.year * 12 + timeline.firstSeen.month) + 1;
    timeline.gapMonths = spanMonths - timeline.totalMonthsPresent;
  }

  return [...timelineMap.values()];
}

// ─── Cycle Detection (new for VLPRS) ────────────────────────────────

export function detectCycles(timelines: PersonTimeline[]): LoanCycle[] {
  const cycles: LoanCycle[] = [];

  for (const tl of timelines) {
    if (tl.months.length === 0) continue;

    let cycleStart = tl.months[0];
    let currentPrincipal = cycleStart.principal;
    let cycleMonths = 1;

    for (let i = 1; i < tl.months.length; i++) {
      const m = tl.months[i];
      const principalChanged = m.principal !== currentPrincipal &&
        m.principal !== null && currentPrincipal !== null &&
        m.principal !== '0' && m.principal !== '0.00';
      const balanceZero = m.outstandingBalance !== null &&
        (m.outstandingBalance === '0' || m.outstandingBalance === '0.00' ||
         Number(m.outstandingBalance) <= 0);

      if (principalChanged || balanceZero) {
        // End current cycle
        const prevMonth = tl.months[i - (balanceZero ? 0 : 1)];
        const spanMonths =
          (prevMonth.year * 12 + prevMonth.month) -
          (cycleStart.year * 12 + cycleStart.month) + 1;

        cycles.push({
          mdaCode: tl.mdaCode,
          startPeriod: { year: cycleStart.year, month: cycleStart.month },
          endPeriod: { year: prevMonth.year, month: prevMonth.month },
          principal: currentPrincipal,
          rate: null,
          monthsPresent: cycleMonths,
          gapMonths: spanMonths - cycleMonths,
          status: balanceZero ? 'completed'
            : cycleMonths > 60 ? 'beyond_tenure'
            : 'active',
        });

        // Start new cycle
        if (principalChanged && !balanceZero) {
          cycleStart = m;
          currentPrincipal = m.principal;
          cycleMonths = 1;
        } else {
          // After balance zero, next month starts new cycle if exists
          if (i + 1 < tl.months.length) {
            cycleStart = tl.months[i + 1];
            currentPrincipal = cycleStart.principal;
            cycleMonths = 0;
          }
        }
      } else {
        cycleMonths++;
      }
    }

    // Close final open cycle
    const lastMonth = tl.months[tl.months.length - 1];
    if (cycleMonths > 0) {
      const spanMonths =
        (lastMonth.year * 12 + lastMonth.month) -
        (cycleStart.year * 12 + cycleStart.month) + 1;

      cycles.push({
        mdaCode: tl.mdaCode,
        startPeriod: { year: cycleStart.year, month: cycleStart.month },
        endPeriod: { year: lastMonth.year, month: lastMonth.month },
        principal: currentPrincipal,
        rate: null,
        monthsPresent: cycleMonths,
        gapMonths: spanMonths - cycleMonths,
        status: cycleMonths > 60 ? 'beyond_tenure' : 'active',
      });
    }
  }

  return cycles;
}

/**
 * Get person timeline data for a given person key.
 */
export async function getPersonTimeline(personKey: string, mdaScope?: string | null) {
  const profile = await getPersonProfile(personKey, mdaScope);
  return {
    staffName: profile.staffName,
    timelines: profile.timelines,
    cycles: profile.cycles,
  };
}
