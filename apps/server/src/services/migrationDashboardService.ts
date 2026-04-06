import { eq, and, isNull, sql, count, asc, desc } from 'drizzle-orm';
import Decimal from 'decimal.js';
import { db } from '../db/index';
import { mdas, migrationUploads, migrationRecords, loans, ledgerEntries, observations, deduplicationCandidates } from '../db/schema';
import { isActiveRecord } from '../db/queryHelpers';
import { computeBalanceForLoan } from './computationEngine';
import { withMdaScope } from '../lib/mdaScope';
import type { MigrationMdaStatus, MigrationStage, MigrationDashboardMetrics, CoverageMatrix, CoverageRecordsResponse } from '@vlprs/shared';

// ─── Stage Derivation ────────────────────────────────────────────────

const UPLOAD_STATUS_RANK: Record<string, number> = {
  uploaded: 1,
  mapped: 2,
  processing: 3,
  completed: 4,
  pending_verification: 4, // Treated as imported — data is processed, awaiting admin approval
  validated: 5,
  reconciled: 6,
  certified: 7,
  // 'rejected' intentionally omitted — rejected uploads don't represent progress
};

const RANK_TO_STAGE: Record<number, MigrationStage> = {
  1: 'received',
  2: 'imported',
  3: 'imported',
  4: 'imported',
  5: 'validated',
  6: 'reconciled',
  7: 'certified',
};

export function deriveStage(maxStatus: string | null): MigrationStage {
  if (!maxStatus) return 'pending';
  const rank = UPLOAD_STATUS_RANK[maxStatus];
  if (!rank) return 'pending';
  return RANK_TO_STAGE[rank] ?? 'pending';
}

// ─── Dashboard Service ───────────────────────────────────────────────

export async function getMigrationDashboard(
  mdaScope?: string | null,
): Promise<MigrationMdaStatus[]> {
  // Get all active, non-deleted MDAs
  const mdaConditions = [isNull(mdas.deletedAt), eq(mdas.isActive, true)];
  const scopeCondition = withMdaScope(mdas.id, mdaScope);
  if (scopeCondition) mdaConditions.push(scopeCondition);

  const allMdas = await db
    .select({ id: mdas.id, name: mdas.name, code: mdas.code })
    .from(mdas)
    .where(and(...mdaConditions))
    .orderBy(mdas.name);

  if (allMdas.length === 0) return [];

  // Get the most advanced upload status per MDA
  const uploadStatuses = await db
    .select({
      mdaId: migrationUploads.mdaId,
      maxStatus: sql<string>`MAX(CASE
        WHEN ${migrationUploads.status} = 'reconciled' THEN '6_reconciled'
        WHEN ${migrationUploads.status} = 'validated' THEN '5_validated'
        WHEN ${migrationUploads.status} = 'pending_verification' THEN '4_completed'
        WHEN ${migrationUploads.status} = 'completed' THEN '4_completed'
        WHEN ${migrationUploads.status} = 'processing' THEN '3_processing'
        WHEN ${migrationUploads.status} = 'mapped' THEN '2_mapped'
        WHEN ${migrationUploads.status} = 'uploaded' THEN '1_uploaded'
        WHEN ${migrationUploads.status} = 'rejected' THEN '0_unknown'
        ELSE '0_unknown'
      END)`,
      lastActivity: sql<string>`MAX(COALESCE(${migrationUploads.updatedAt}, ${migrationUploads.createdAt}))`,
    })
    .from(migrationUploads)
    .where(isNull(migrationUploads.deletedAt))
    .groupBy(migrationUploads.mdaId);

  const uploadMap = new Map(
    uploadStatuses.map((u) => [
      u.mdaId,
      {
        maxStatus: u.maxStatus?.split('_')[1] ?? null,
        lastActivity: u.lastActivity,
      },
    ]),
  );

  // Get record counts per MDA grouped by variance category (excludes superseded)
  const recordCounts = await db
    .select({
      mdaId: migrationRecords.mdaId,
      category: migrationRecords.varianceCategory,
      cnt: sql<string>`COUNT(*)`,
    })
    .from(migrationRecords)
    .where(isActiveRecord())
    .groupBy(migrationRecords.mdaId, migrationRecords.varianceCategory);

  const countMap = new Map<string, MigrationMdaStatus['recordCounts']>();
  for (const row of recordCounts) {
    if (!countMap.has(row.mdaId)) {
      countMap.set(row.mdaId, { clean: 0, minor: 0, significant: 0, structural: 0, anomalous: 0 });
    }
    const counts = countMap.get(row.mdaId)!;
    const cat = row.category;
    const n = parseInt(row.cnt, 10);
    if (cat === 'clean') counts.clean = n;
    else if (cat === 'minor_variance') counts.minor = n;
    else if (cat === 'significant_variance') counts.significant = n;
    else if (cat === 'structural_error') counts.structural = n;
    else if (cat === 'anomalous') counts.anomalous = n;
    else counts.clean += n; // null category treated as clean
  }

  // Get baseline completion per MDA (excludes superseded)
  const baselineCompletion = await db
    .select({
      mdaId: migrationRecords.mdaId,
      total: sql<string>`COUNT(*)`,
      done: sql<string>`COUNT(*) FILTER (WHERE ${migrationRecords.isBaselineCreated} = true)`,
    })
    .from(migrationRecords)
    .where(isActiveRecord())
    .groupBy(migrationRecords.mdaId);

  const baselineMap = new Map(
    baselineCompletion.map((b) => [
      b.mdaId,
      { done: parseInt(b.done, 10), total: parseInt(b.total, 10) },
    ]),
  );

  // Observation counts per MDA
  const observationCounts = await db
    .select({
      mdaId: observations.mdaId,
      cnt: count(),
    })
    .from(observations)
    .groupBy(observations.mdaId);

  const obsCountMap = new Map(
    observationCounts.map((o) => [o.mdaId, Number(o.cnt)]),
  );

  return allMdas.map((mda) => {
    const upload = uploadMap.get(mda.id);
    const stage = deriveStage(upload?.maxStatus ?? null);
    const counts = countMap.get(mda.id) ?? { clean: 0, minor: 0, significant: 0, structural: 0, anomalous: 0 };
    const baseline = baselineMap.get(mda.id);

    return {
      mdaId: mda.id,
      mdaName: mda.name,
      mdaCode: mda.code,
      stage,
      recordCounts: counts,
      lastActivity: upload?.lastActivity ?? null,
      baselineCompletion: baseline ?? { done: 0, total: 0 },
      observationCount: obsCountMap.get(mda.id) ?? 0,
    };
  });
}

export async function getDashboardMetrics(
  mdaScope?: string | null,
): Promise<MigrationDashboardMetrics> {
  // Total staff migrated: COUNT DISTINCT staffName from migration loans
  const migrationLoanConditions = [sql`${loans.loanReference} LIKE 'VLC-MIG-%'`];
  const scopeCondition = withMdaScope(loans.mdaId, mdaScope);
  if (scopeCondition) migrationLoanConditions.push(scopeCondition);
  const migrationLoanWhere = and(...migrationLoanConditions);

  const [staffResult] = await db
    .select({ cnt: sql<string>`COUNT(DISTINCT ${loans.staffName})` })
    .from(loans)
    .where(migrationLoanWhere);

  const totalStaffMigrated = parseInt(staffResult.cnt, 10);

  // Total exposure: sum of (totalLoan - totalPaid) for migration loans via unified wrapper
  const migrationLoans = await db
    .select({
      id: loans.id,
      principalAmount: loans.principalAmount,
      interestRate: loans.interestRate,
      tenureMonths: loans.tenureMonths,
      limitedComputation: loans.limitedComputation,
    })
    .from(loans)
    .where(migrationLoanWhere);

  let totalExposure = new Decimal('0');

  if (migrationLoans.length > 0) {
    const loanIds = migrationLoans.map((l) => l.id);

    // Batch ledger aggregation
    const sums = await db
      .select({
        loanId: ledgerEntries.loanId,
        totalPaid: sql<string>`COALESCE(SUM(${ledgerEntries.amount}), '0.00')`,
      })
      .from(ledgerEntries)
      .where(sql`${ledgerEntries.loanId} IN (${sql.join(loanIds.map(id => sql`${id}`), sql`, `)})`)
      .groupBy(ledgerEntries.loanId);

    const paidMap = new Map(sums.map((s) => [s.loanId, s.totalPaid]));

    for (const loan of migrationLoans) {
      const result = computeBalanceForLoan({
        limitedComputation: loan.limitedComputation,
        principalAmount: loan.principalAmount,
        interestRate: loan.interestRate,
        tenureMonths: loan.tenureMonths,
        totalPaid: paidMap.get(loan.id) ?? '0.00',
      });
      totalExposure = totalExposure.plus(new Decimal(result.computedBalance));
    }
  }

  // MDAs complete: count of MDAs whose highest upload status is 'reconciled' or 'certified'
  // Direct query avoids re-running the full getMigrationDashboard (3 additional DB queries)
  const mdaCompleteConditions = [
    isNull(migrationUploads.deletedAt),
    sql`${migrationUploads.status} = 'reconciled'`,
  ];
  const uploadScopeCondition = withMdaScope(migrationUploads.mdaId, mdaScope);
  if (uploadScopeCondition) mdaCompleteConditions.push(uploadScopeCondition);

  const [completeResult] = await db
    .select({ cnt: sql<string>`COUNT(DISTINCT ${migrationUploads.mdaId})` })
    .from(migrationUploads)
    .where(and(...mdaCompleteConditions));
  const mdasComplete = parseInt(completeResult.cnt, 10);

  // Baselines established (excludes superseded)
  const [baselineResult] = await db
    .select({ cnt: count() })
    .from(migrationRecords)
    .where(and(
      eq(migrationRecords.isBaselineCreated, true),
      isActiveRecord(),
    ));

  // Pending duplicates
  const [pendingDupResult] = await db
    .select({ cnt: count() })
    .from(deduplicationCandidates)
    .where(eq(deduplicationCandidates.status, 'pending'));

  return {
    totalStaffMigrated,
    totalExposure: totalExposure.toFixed(2),
    mdasComplete,
    baselinesEstablished: Number(baselineResult.cnt),
    pendingDuplicates: Number(pendingDupResult.cnt),
  };
}

// ─── Coverage Tracker (Story 11.0b) ─────────────────────────────────

export async function getMigrationCoverage(
  mdaScope?: string | null,
  extended = false,
): Promise<CoverageMatrix> {
  // Determine period range
  const now = new Date();
  const endYear = now.getFullYear();
  const endMonth = now.getMonth() + 1; // 1-based
  const end = `${endYear}-${String(endMonth).padStart(2, '0')}`;

  let startYear: number;
  let startMonth: number;
  if (extended) {
    startYear = 2017;
    startMonth = 1;
  } else {
    // 60 months back
    const d = new Date(endYear, endMonth - 1 - 59, 1);
    startYear = d.getFullYear();
    startMonth = d.getMonth() + 1;
  }
  const start = `${startYear}-${String(startMonth).padStart(2, '0')}`;

  // Get all active MDAs (scoped)
  const mdaConditions = [isNull(mdas.deletedAt), eq(mdas.isActive, true)];
  const scopeCondition = withMdaScope(mdas.id, mdaScope);
  if (scopeCondition) mdaConditions.push(scopeCondition);

  const allMdas = await db
    .select({ id: mdas.id, name: mdas.name, code: mdas.code })
    .from(mdas)
    .where(and(...mdaConditions))
    .orderBy(mdas.name);

  if (allMdas.length === 0) {
    return { mdas: [], periodRange: { start, end } };
  }

  // Aggregate migration records by MDA + period (year/month)
  // Filter to the requested period range and exclude null period data + superseded
  const periodConditions = [
    isActiveRecord()!,
    sql`${migrationRecords.periodYear} IS NOT NULL`,
    sql`${migrationRecords.periodMonth} IS NOT NULL`,
    sql`(${migrationRecords.periodYear} * 100 + ${migrationRecords.periodMonth}) >= ${startYear * 100 + startMonth}`,
    sql`(${migrationRecords.periodYear} * 100 + ${migrationRecords.periodMonth}) <= ${endYear * 100 + endMonth}`,
  ];

  const recordScopeCondition = withMdaScope(migrationRecords.mdaId, mdaScope);
  if (recordScopeCondition) periodConditions.push(recordScopeCondition);

  const periodAgg = await db
    .select({
      mdaId: migrationRecords.mdaId,
      periodYear: migrationRecords.periodYear,
      periodMonth: migrationRecords.periodMonth,
      recordCount: sql<string>`COUNT(*)`,
      baselinedCount: sql<string>`COUNT(*) FILTER (WHERE ${migrationRecords.isBaselineCreated} = true)`,
      uploadSource: sql<string>`CASE
        WHEN bool_or(${migrationUploads.uploadSource} = 'mda_officer') AND bool_or(${migrationUploads.uploadSource} = 'admin') THEN 'mixed'
        WHEN bool_or(${migrationUploads.uploadSource} = 'mda_officer') THEN 'mda_officer'
        ELSE 'admin'
      END`,
    })
    .from(migrationRecords)
    .innerJoin(migrationUploads, and(eq(migrationRecords.uploadId, migrationUploads.id), isNull(migrationUploads.deletedAt)))
    .where(and(...periodConditions))
    .groupBy(migrationRecords.mdaId, migrationRecords.periodYear, migrationRecords.periodMonth);

  // Build lookup: mdaId → { 'YYYY-MM': { recordCount, baselinedCount, uploadSource? } }
  const coverageMap = new Map<string, Record<string, { recordCount: number; baselinedCount: number; uploadSource?: 'admin' | 'mda_officer' | 'mixed' }>>();
  for (const row of periodAgg) {
    if (!coverageMap.has(row.mdaId)) {
      coverageMap.set(row.mdaId, {});
    }
    const key = `${row.periodYear}-${String(row.periodMonth).padStart(2, '0')}`;
    coverageMap.get(row.mdaId)![key] = {
      recordCount: parseInt(row.recordCount, 10),
      baselinedCount: parseInt(row.baselinedCount, 10),
      uploadSource: row.uploadSource as 'admin' | 'mda_officer' | 'mixed',
    };
  }

  return {
    mdas: allMdas.map((mda) => ({
      mdaId: mda.id,
      mdaName: mda.name,
      mdaCode: mda.code,
      periods: coverageMap.get(mda.id) ?? {},
    })),
    periodRange: { start, end },
  };
}

// ─── Coverage Records Drill-Down (Story 8.0f) ──────────────────────

const SORT_COLUMN_MAP = {
  staffName: migrationRecords.staffName,
  employeeNo: migrationRecords.employeeNo,
  principal: migrationRecords.principal,
  totalLoan: migrationRecords.totalLoan,
  monthlyDeduction: migrationRecords.monthlyDeduction,
  outstandingBalance: migrationRecords.outstandingBalance,
  varianceCategory: migrationRecords.varianceCategory,
  isBaselineCreated: migrationRecords.isBaselineCreated,
} as const;

export async function getCoverageRecords(
  mdaId: string,
  year: number,
  month: number,
  pagination: { page: number; limit: number },
  sort: { sortBy: keyof typeof SORT_COLUMN_MAP; sortDir: 'asc' | 'desc' },
  mdaScope?: string | null,
): Promise<CoverageRecordsResponse> {
  // Build conditions
  const conditions = [
    isActiveRecord()!,
    eq(migrationRecords.mdaId, mdaId),
    eq(migrationRecords.periodYear, year),
    eq(migrationRecords.periodMonth, month),
  ];

  const scopeCondition = withMdaScope(migrationRecords.mdaId, mdaScope);
  if (scopeCondition) conditions.push(scopeCondition);

  // Count total and baselined records in a single query
  const [countResult] = await db
    .select({
      total: sql<string>`COUNT(*)`,
      baselined: sql<string>`COUNT(*) FILTER (WHERE ${migrationRecords.isBaselineCreated} = true)`,
    })
    .from(migrationRecords)
    .where(and(...conditions));
  const totalRecords = parseInt(countResult.total, 10);
  const baselinedCount = parseInt(countResult.baselined, 10);

  // Get MDA info
  const [mdaInfo] = await db
    .select({ name: mdas.name, code: mdas.code })
    .from(mdas)
    .where(eq(mdas.id, mdaId));

  if (!mdaInfo) {
    return {
      records: [],
      pagination: { page: 1, limit: pagination.limit, totalPages: 0, totalRecords: 0 },
      summary: { total: 0, baselinedCount: 0, mdaName: '', mdaCode: '', periodLabel: '' },
    };
  }

  // Period label e.g. "August 2024"
  const periodLabel = new Date(year, month - 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  // Fetch records with pagination and sorting
  const sortColumn = SORT_COLUMN_MAP[sort.sortBy];
  const sortFn = sort.sortDir === 'desc' ? desc : asc;
  const offset = (pagination.page - 1) * pagination.limit;

  const records = await db
    .select({
      id: migrationRecords.id,
      staffName: migrationRecords.staffName,
      employeeNo: migrationRecords.employeeNo,
      gradeLevel: migrationRecords.gradeLevel,
      principal: migrationRecords.principal,
      totalLoan: migrationRecords.totalLoan,
      monthlyDeduction: migrationRecords.monthlyDeduction,
      outstandingBalance: migrationRecords.outstandingBalance,
      varianceCategory: migrationRecords.varianceCategory,
      varianceAmount: migrationRecords.varianceAmount,
      isBaselineCreated: migrationRecords.isBaselineCreated,
      computedRate: migrationRecords.computedRate,
      sheetName: migrationRecords.sheetName,
    })
    .from(migrationRecords)
    .where(and(...conditions))
    .orderBy(sortFn(sortColumn))
    .limit(pagination.limit)
    .offset(offset);

  const totalPages = Math.ceil(totalRecords / pagination.limit);

  return {
    records,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      totalPages,
      totalRecords,
    },
    summary: {
      total: totalRecords,
      baselinedCount,
      mdaName: mdaInfo.name,
      mdaCode: mdaInfo.code,
      periodLabel,
    },
  };
}

/**
 * Fetch ALL records for a given MDA + period (no pagination).
 * Used by the export endpoint.
 */
export async function getAllCoverageRecords(
  mdaId: string,
  year: number,
  month: number,
  mdaScope?: string | null,
): Promise<{ records: CoverageRecordsResponse['records']; mdaName: string; mdaCode: string; periodLabel: string }> {
  const conditions = [
    isActiveRecord()!,
    eq(migrationRecords.mdaId, mdaId),
    eq(migrationRecords.periodYear, year),
    eq(migrationRecords.periodMonth, month),
  ];

  const scopeCondition = withMdaScope(migrationRecords.mdaId, mdaScope);
  if (scopeCondition) conditions.push(scopeCondition);

  const [mdaInfo] = await db
    .select({ name: mdas.name, code: mdas.code })
    .from(mdas)
    .where(eq(mdas.id, mdaId));

  if (!mdaInfo) {
    return { records: [], mdaName: '', mdaCode: '', periodLabel: '' };
  }

  const periodLabel = new Date(year, month - 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  const records = await db
    .select({
      id: migrationRecords.id,
      staffName: migrationRecords.staffName,
      employeeNo: migrationRecords.employeeNo,
      gradeLevel: migrationRecords.gradeLevel,
      principal: migrationRecords.principal,
      totalLoan: migrationRecords.totalLoan,
      monthlyDeduction: migrationRecords.monthlyDeduction,
      outstandingBalance: migrationRecords.outstandingBalance,
      varianceCategory: migrationRecords.varianceCategory,
      varianceAmount: migrationRecords.varianceAmount,
      isBaselineCreated: migrationRecords.isBaselineCreated,
      computedRate: migrationRecords.computedRate,
      sheetName: migrationRecords.sheetName,
    })
    .from(migrationRecords)
    .where(and(...conditions))
    .orderBy(asc(migrationRecords.staffName));

  return { records, mdaName: mdaInfo.name, mdaCode: mdaInfo.code, periodLabel };
}
