import { eq, and, sql, ilike, or } from 'drizzle-orm';
import Decimal from 'decimal.js';
import { db } from '../db/index';
import { loans, mdas, ledgerEntries, personMatches, migrationRecords } from '../db/schema';
import { isActiveRecord } from '../db/queryHelpers';
import { computeBalanceForLoan } from './computationEngine';
import { withMdaScope } from '../lib/mdaScope';
import { getUnreviewedCount, getObservationCountsByStaffNames } from './observationService';
import type { BeneficiaryListItem, BeneficiaryListMetrics, PaginatedBeneficiaries } from '@vlprs/shared';

// ─── Types ───────────────────────────────────────────────────────────

interface BeneficiaryFilters {
  search?: string;
  page?: number;
  pageSize?: number;
  mdaId?: string;
  sortBy?: 'staffName' | 'totalExposure' | 'loanCount' | 'lastActivityDate';
  sortOrder?: 'asc' | 'desc';
}

interface BeneficiaryRow {
  staff_name: string;
  staff_id: string;
  primary_mda_code: string;
  primary_mda_name: string;
  primary_mda_id: string;
  loan_count: string;
  last_activity_date: string | null;
  loan_ids: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function escapeLike(input: string): string {
  return input.replace(/[%_\\]/g, '\\$&');
}

// ─── Service Functions ───────────────────────────────────────────────

export async function listBeneficiaries(
  filters: BeneficiaryFilters = {},
  mdaScope?: string | null,
): Promise<PaginatedBeneficiaries> {
  const page = filters.page ?? 1;
  const pageSize = Math.min(filters.pageSize ?? 25, 100);
  const offset = (page - 1) * pageSize;

  // Base conditions: migration loans only
  const conditions: ReturnType<typeof eq>[] = [
    sql`${loans.loanReference} LIKE 'VLC-MIG-%'`,
  ];

  const scopeCondition = withMdaScope(loans.mdaId, mdaScope);
  if (scopeCondition) conditions.push(scopeCondition);

  if (filters.mdaId) {
    conditions.push(eq(loans.mdaId, filters.mdaId));
  }

  if (filters.search) {
    const escaped = escapeLike(filters.search);
    const term = `%${escaped}%`;
    conditions.push(
      or(
        ilike(loans.staffName, term),
        ilike(loans.staffId, term),
      )!,
    );
  }

  const whereClause = and(...conditions);

  // Sort mapping — totalExposure is computed post-query, so use staffName as SQL fallback
  const needsJsSort = (filters.sortBy ?? 'staffName') === 'totalExposure';
  const sortCol = {
    staffName: sql`MIN(${loans.staffName})`,
    totalExposure: sql`MIN(${loans.staffName})`,
    loanCount: sql`loan_count`,
    lastActivityDate: sql`last_activity_date`,
  }[filters.sortBy ?? 'staffName'];

  const sortDirection = filters.sortOrder ?? 'asc';
  const orderSql = sortDirection === 'asc'
    ? sql`${sortCol} ASC NULLS LAST`
    : sql`${sortCol} DESC NULLS LAST`;

  // Count query: distinct (staffName, staffId) groups
  const countResult = await db.execute(sql`
    SELECT COUNT(*)::text AS value FROM (
      SELECT 1 FROM ${loans}
      INNER JOIN ${mdas} ON ${loans.mdaId} = ${mdas.id}
      WHERE ${whereClause}
      GROUP BY ${loans.staffName}, ${loans.staffId}
    ) sub
  `);
  const totalItems = (countResult.rows[0] as { value: string }).value;

  const total = parseInt(totalItems, 10);

  if (total === 0) {
    const metrics = await getBeneficiaryMetrics(mdaScope);
    return {
      data: [],
      pagination: { page, pageSize, totalItems: 0, totalPages: 0 },
      metrics,
    };
  }

  // Main aggregation query: group by person
  const rawResult = await db.execute(sql`
    SELECT
      ${loans.staffName} AS staff_name,
      ${loans.staffId} AS staff_id,
      MIN(${mdas.code}) AS primary_mda_code,
      MIN(${mdas.name}) AS primary_mda_name,
      MIN(${mdas.id}::text) AS primary_mda_id,
      COUNT(${loans.id})::text AS loan_count,
      MAX(${loans.createdAt})::text AS last_activity_date,
      ARRAY_AGG(${loans.id})::text AS loan_ids
    FROM ${loans}
    INNER JOIN ${mdas} ON ${loans.mdaId} = ${mdas.id}
    WHERE ${whereClause}
    GROUP BY ${loans.staffName}, ${loans.staffId}
    ORDER BY ${orderSql}
    LIMIT ${pageSize} OFFSET ${offset}
  `);
  const rows = rawResult.rows as BeneficiaryRow[];

  // Batch balance computation for all loans in this page
  const allLoanIds: string[] = [];
  const loanInfoMap = new Map<string, { principalAmount: string; interestRate: string; tenureMonths: number; limitedComputation: boolean }>();

  if (rows.length > 0) {
    // Collect all loan IDs from the aggregated groups
    const groupLoanIds: string[] = rows.flatMap((r: BeneficiaryRow) => {
      // Parse PostgreSQL array format: {id1,id2,id3}
      const cleaned = r.loan_ids.replace(/[{}]/g, '');
      return cleaned.split(',').filter(Boolean);
    });

    // Get loan details for balance computation
    if (groupLoanIds.length > 0) {
      const loanDetails = await db
        .select({
          id: loans.id,
          principalAmount: loans.principalAmount,
          interestRate: loans.interestRate,
          tenureMonths: loans.tenureMonths,
          limitedComputation: loans.limitedComputation,
        })
        .from(loans)
        .where(sql`${loans.id} IN (${sql.join(groupLoanIds.map((id: string) => sql`${id}`), sql`, `)})`);

      for (const l of loanDetails) {
        allLoanIds.push(l.id);
        loanInfoMap.set(l.id, {
          principalAmount: l.principalAmount,
          interestRate: l.interestRate,
          tenureMonths: l.tenureMonths,
          limitedComputation: l.limitedComputation,
        });
      }
    }
  }

  // Batch ledger aggregation
  const paidMap = new Map<string, string>();
  if (allLoanIds.length > 0) {
    const sums = await db
      .select({
        loanId: ledgerEntries.loanId,
        totalPaid: sql<string>`COALESCE(SUM(${ledgerEntries.amount}), '0.00')`,
      })
      .from(ledgerEntries)
      .where(sql`${ledgerEntries.loanId} IN (${sql.join(allLoanIds.map(id => sql`${id}`), sql`, `)})`)
      .groupBy(ledgerEntries.loanId);

    for (const s of sums) {
      paidMap.set(s.loanId, s.totalPaid);
    }
  }

  // Check multi-MDA for all staff in this page
  const staffNames = rows.map((r: BeneficiaryRow) => r.staff_name);
  const multiMdaSet = new Set<string>();
  if (staffNames.length > 0) {
    const matches = await db
      .select({
        personAName: personMatches.personAName,
        personBName: personMatches.personBName,
      })
      .from(personMatches)
      .where(
        and(
          sql`${personMatches.status} IN ('auto_confirmed', 'confirmed')`,
          or(
            sql`${personMatches.personAName} IN (${sql.join(staffNames.map((n: string) => sql`${n}`), sql`, `)})`,
            sql`${personMatches.personBName} IN (${sql.join(staffNames.map((n: string) => sql`${n}`), sql`, `)})`,
          ),
        ),
      );

    for (const m of matches) {
      multiMdaSet.add(m.personAName);
      multiMdaSet.add(m.personBName);
    }
  }

  // Observation counts per person (delegated to observationService)
  const observationCountMap = await getObservationCountsByStaffNames(staffNames);

  // Compute per-person exposure and build result
  const data: BeneficiaryListItem[] = rows.map((row: BeneficiaryRow) => {
    const loanIdsForPerson = row.loan_ids.replace(/[{}]/g, '').split(',').filter(Boolean);

    let totalExposure = new Decimal('0');
    for (const loanId of loanIdsForPerson) {
      const info = loanInfoMap.get(loanId);
      if (!info) continue;

      const result = computeBalanceForLoan({
        limitedComputation: info.limitedComputation,
        principalAmount: info.principalAmount,
        interestRate: info.interestRate,
        tenureMonths: info.tenureMonths,
        totalPaid: paidMap.get(loanId) ?? '0.00',
      });
      totalExposure = totalExposure.plus(new Decimal(result.computedBalance));
    }

    return {
      staffName: row.staff_name,
      staffId: row.staff_id,
      primaryMdaCode: row.primary_mda_code,
      primaryMdaName: row.primary_mda_name,
      primaryMdaId: row.primary_mda_id,
      loanCount: parseInt(row.loan_count, 10),
      totalExposure: totalExposure.toFixed(2),
      observationCount: observationCountMap.get(row.staff_name) ?? 0,
      isMultiMda: multiMdaSet.has(row.staff_name),
      lastActivityDate: row.last_activity_date,
    };
  });

  // Re-sort in JS when sorting by totalExposure (computed post-query)
  if (needsJsSort) {
    const dir = sortDirection === 'asc' ? 1 : -1;
    data.sort((a, b) => dir * (parseFloat(a.totalExposure) - parseFloat(b.totalExposure)));
  }

  const metrics = await getBeneficiaryMetrics(mdaScope);

  return {
    data,
    pagination: {
      page,
      pageSize,
      totalItems: total,
      totalPages: Math.ceil(total / pageSize),
    },
    metrics,
  };
}

export async function getBeneficiaryMetrics(
  mdaScope?: string | null,
): Promise<BeneficiaryListMetrics> {
  const conditions: ReturnType<typeof eq>[] = [
    sql`${loans.loanReference} LIKE 'VLC-MIG-%'`,
  ];
  const scopeCondition = withMdaScope(loans.mdaId, mdaScope);
  if (scopeCondition) conditions.push(scopeCondition);
  const whereClause = and(...conditions);

  const [result] = await db
    .select({
      totalStaff: sql<string>`COUNT(DISTINCT (${loans.staffName}, ${loans.staffId}))`,
      totalLoans: sql<string>`COUNT(*)`,
    })
    .from(loans)
    .where(whereClause);

  // Total exposure: batch computation
  const migrationLoans = await db
    .select({
      id: loans.id,
      principalAmount: loans.principalAmount,
      interestRate: loans.interestRate,
      tenureMonths: loans.tenureMonths,
      limitedComputation: loans.limitedComputation,
    })
    .from(loans)
    .where(whereClause);

  let totalExposure = new Decimal('0');

  if (migrationLoans.length > 0) {
    const loanIds = migrationLoans.map((l) => l.id);
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

  return {
    totalStaff: parseInt(result.totalStaff, 10),
    totalLoans: parseInt(result.totalLoans, 10),
    totalObservationsUnreviewed: await getUnreviewedCount(mdaScope),
    totalExposure: totalExposure.toFixed(2),
  };
}

export async function exportBeneficiariesCsv(
  filters: BeneficiaryFilters = {},
  mdaScope?: string | null,
): Promise<string> {
  // Same query as listBeneficiaries but without pagination (all rows)
  // and with additional detail columns per loan
  const conditions: ReturnType<typeof eq>[] = [
    sql`${loans.loanReference} LIKE 'VLC-MIG-%'`,
  ];
  const scopeCondition = withMdaScope(loans.mdaId, mdaScope);
  if (scopeCondition) conditions.push(scopeCondition);

  if (filters.mdaId) {
    conditions.push(eq(loans.mdaId, filters.mdaId));
  }

  if (filters.search) {
    const escaped = escapeLike(filters.search);
    const term = `%${escaped}%`;
    conditions.push(
      or(
        ilike(loans.staffName, term),
        ilike(loans.staffId, term),
      )!,
    );
  }

  const whereClause = and(...conditions);

  // Get all migration loans with details (LEFT JOIN migration_records for varianceCategory)
  const loanRows = await db
    .select({
      staffName: loans.staffName,
      staffId: loans.staffId,
      mdaName: mdas.name,
      loanReference: loans.loanReference,
      principalAmount: loans.principalAmount,
      interestRate: loans.interestRate,
      tenureMonths: loans.tenureMonths,
      monthlyDeductionAmount: loans.monthlyDeductionAmount,
      id: loans.id,
      limitedComputation: loans.limitedComputation,
      createdAt: loans.createdAt,
      varianceCategory: migrationRecords.varianceCategory,
    })
    .from(loans)
    .innerJoin(mdas, eq(loans.mdaId, mdas.id))
    .leftJoin(migrationRecords, and(
      eq(migrationRecords.loanId, loans.id),
      isActiveRecord(),
    ))
    .where(whereClause)
    .orderBy(loans.staffName);

  if (loanRows.length === 0) {
    return 'Staff Name,Staff ID,MDA,Loan Reference,Principal Amount,Interest Rate,Tenure Months,Monthly Deduction,Outstanding Balance,Variance Category,Multi-MDA,Observations Count,Last Activity\n';
  }

  // Batch ledger aggregation
  const loanIds = loanRows.map((l) => l.id);
  const sums = await db
    .select({
      loanId: ledgerEntries.loanId,
      totalPaid: sql<string>`COALESCE(SUM(${ledgerEntries.amount}), '0.00')`,
    })
    .from(ledgerEntries)
    .where(sql`${ledgerEntries.loanId} IN (${sql.join(loanIds.map(id => sql`${id}`), sql`, `)})`)
    .groupBy(ledgerEntries.loanId);

  const paidMap = new Map(sums.map((s) => [s.loanId, s.totalPaid]));

  // Check multi-MDA
  const staffNames = [...new Set(loanRows.map((r) => r.staffName))];
  const multiMdaSet = new Set<string>();
  if (staffNames.length > 0) {
    const matches = await db
      .select({
        personAName: personMatches.personAName,
        personBName: personMatches.personBName,
      })
      .from(personMatches)
      .where(
        and(
          sql`${personMatches.status} IN ('auto_confirmed', 'confirmed')`,
          or(
            sql`${personMatches.personAName} IN (${sql.join(staffNames.map((n: string) => sql`${n}`), sql`, `)})`,
            sql`${personMatches.personBName} IN (${sql.join(staffNames.map((n: string) => sql`${n}`), sql`, `)})`,
          ),
        ),
      );

    for (const m of matches) {
      multiMdaSet.add(m.personAName);
      multiMdaSet.add(m.personBName);
    }
  }

  // Observation counts for CSV (delegated to observationService)
  const obsCountMap = await getObservationCountsByStaffNames(staffNames);

  // Build CSV
  const headers = [
    'Staff Name', 'Staff ID', 'MDA', 'Loan Reference', 'Principal Amount',
    'Interest Rate', 'Tenure Months', 'Monthly Deduction', 'Outstanding Balance',
    'Variance Category', 'Multi-MDA', 'Observations Count', 'Last Activity',
  ];

  const escapeCsv = (val: string) => {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const csvRows = [headers.join(',')];

  for (const row of loanRows) {
    const balResult = computeBalanceForLoan({
      limitedComputation: row.limitedComputation,
      principalAmount: row.principalAmount,
      interestRate: row.interestRate,
      tenureMonths: row.tenureMonths,
      totalPaid: paidMap.get(row.id) ?? '0.00',
    });

    csvRows.push([
      escapeCsv(row.staffName),
      escapeCsv(row.staffId),
      escapeCsv(row.mdaName),
      row.loanReference,
      row.principalAmount,
      row.interestRate,
      String(row.tenureMonths),
      row.monthlyDeductionAmount,
      balResult.computedBalance,
      row.varianceCategory ?? '',
      multiMdaSet.has(row.staffName) ? 'Yes' : 'No',
      String(obsCountMap.get(row.staffName) ?? 0),
      row.createdAt ? new Date(row.createdAt).toISOString().slice(0, 10) : '',
    ].join(','));
  }

  return csvRows.join('\n') + '\n';
}

