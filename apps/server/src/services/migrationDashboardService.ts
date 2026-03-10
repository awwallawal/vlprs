import { eq, and, isNull, sql, count } from 'drizzle-orm';
import Decimal from 'decimal.js';
import { db } from '../db/index';
import { mdas, migrationUploads, migrationRecords, loans, ledgerEntries, observations, deduplicationCandidates } from '../db/schema';
import { withMdaScope } from '../lib/mdaScope';
import type { MigrationMdaStatus, MigrationStage, MigrationDashboardMetrics } from '@vlprs/shared';

// ─── Stage Derivation ────────────────────────────────────────────────

const UPLOAD_STATUS_RANK: Record<string, number> = {
  uploaded: 1,
  mapped: 2,
  processing: 3,
  completed: 4,
  validated: 5,
  reconciled: 6,
  certified: 7,
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
        WHEN ${migrationUploads.status} = 'completed' THEN '4_completed'
        WHEN ${migrationUploads.status} = 'processing' THEN '3_processing'
        WHEN ${migrationUploads.status} = 'mapped' THEN '2_mapped'
        WHEN ${migrationUploads.status} = 'uploaded' THEN '1_uploaded'
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

  // Get record counts per MDA grouped by variance category
  const recordCounts = await db
    .select({
      mdaId: migrationRecords.mdaId,
      category: migrationRecords.varianceCategory,
      cnt: sql<string>`COUNT(*)`,
    })
    .from(migrationRecords)
    .where(isNull(migrationRecords.deletedAt))
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

  // Get baseline completion per MDA
  const baselineCompletion = await db
    .select({
      mdaId: migrationRecords.mdaId,
      total: sql<string>`COUNT(*)`,
      done: sql<string>`COUNT(*) FILTER (WHERE ${migrationRecords.isBaselineCreated} = true)`,
    })
    .from(migrationRecords)
    .where(isNull(migrationRecords.deletedAt))
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

  // Total exposure: sum of (totalLoan - totalPaid) for migration loans
  // Use batch aggregation: get all migration loan IDs and their principal/rate
  // Note: limitedComputation flag is NOT needed here — negative MIGRATION_BASELINE
  // ledger entries make the standard (totalLoan - totalPaid) formula self-consistent
  // for all loans, including those where principalAmount is "0.00".
  const migrationLoans = await db
    .select({
      id: loans.id,
      principalAmount: loans.principalAmount,
      interestRate: loans.interestRate,
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
      const totalPaid = new Decimal(paidMap.get(loan.id) ?? '0.00');
      // For limitedComputation loans, we can't compute balance from principal
      // but the baseline entry already accounts for the declared balance
      const principal = new Decimal(loan.principalAmount);
      const totalInterest = principal.mul(new Decimal(loan.interestRate)).div(100);
      const totalLoan = principal.plus(totalInterest);
      const balance = Decimal.max(new Decimal('0'), totalLoan.minus(totalPaid));
      totalExposure = totalExposure.plus(balance);
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

  // Baselines established
  const [baselineResult] = await db
    .select({ cnt: count() })
    .from(migrationRecords)
    .where(and(
      eq(migrationRecords.isBaselineCreated, true),
      isNull(migrationRecords.deletedAt),
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
