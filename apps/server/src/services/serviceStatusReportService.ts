import { eq, and, or, sql, count, isNotNull, isNull, lte, lt, inArray, desc } from 'drizzle-orm';
import Decimal from 'decimal.js';
import { differenceInMonths } from 'date-fns';
import { db } from '../db/index';
import { loans, mdas, ledgerEntries, serviceExtensions } from '../db/schema';
import { withMdaScope } from '../lib/mdaScope';
import { toDateString } from '../lib/dateUtils';
import { VOCABULARY } from '@vlprs/shared';
import type { ServiceStatusVerificationReport, ServiceStatusVerificationRow, ServiceStatusVerificationSummary } from '@vlprs/shared';

const AVAILABLE_ACTIONS = [
  'record_service_extension',
  'file_retirement_event',
  'flag_for_investigation',
] as const;

interface ReportFilters {
  mdaId?: string;
  asOfDate?: Date;
  page?: number;
  pageSize?: number;
}

export async function getServiceStatusVerificationReport(
  mdaScope: string | null | undefined,
  filters: ReportFilters = {},
): Promise<ServiceStatusVerificationReport> {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 50;
  const offset = (page - 1) * pageSize;
  // Default: server's current moment → UTC date string via toDateString(). In UTC+1 (Nigeria),
  // the 00:00–01:00 window resolves to "yesterday" in UTC. Acceptable for report purposes.
  const asOfDate = filters.asOfDate ?? new Date();
  const asOfDateStr = toDateString(asOfDate);

  // Sub-query: latest extension per loan (most recent newRetirementDate)
  const latestExt = db
    .select({
      loanId: serviceExtensions.loanId,
      newRetirementDate: sql<Date>`MAX(${serviceExtensions.newRetirementDate})`.as('latest_ext_date'),
    })
    .from(serviceExtensions)
    .groupBy(serviceExtensions.loanId)
    .as('latest_ext');

  // Build shared WHERE conditions for the main query
  const conditions = [
    eq(loans.status, 'ACTIVE'),
    isNotNull(loans.computedRetirementDate),
    lt(loans.computedRetirementDate, sql`${asOfDateStr}::date`),
    // Exclude loans with valid (non-expired) extensions
    // or() with 2+ arguments always returns SQL; non-null assertion is safe (Drizzle types return SQL | undefined)
    or(
      isNull(latestExt.newRetirementDate),
      lte(latestExt.newRetirementDate, sql`${asOfDateStr}::date`),
    )!,
  ];

  // MDA scoping
  const mdaScopeCondition = withMdaScope(loans.mdaId, mdaScope);
  if (mdaScopeCondition) conditions.push(mdaScopeCondition);

  // Optional MDA filter
  if (filters.mdaId) {
    conditions.push(eq(loans.mdaId, filters.mdaId));
  }

  const whereClause = and(...conditions);

  // Run page data, count, and summary queries in parallel
  const [rows, countResult, extensionCounts, mdaBreakdownResult] = await Promise.all([
    // 1. Paginated data
    db
      .select({
        loanId: loans.id,
        staffName: loans.staffName,
        staffId: loans.staffId,
        mdaName: mdas.name,
        mdaId: loans.mdaId,
        loanReference: loans.loanReference,
        computedRetirementDate: loans.computedRetirementDate,
        principalAmount: loans.principalAmount,
        interestRate: loans.interestRate,
        latestExtDate: latestExt.newRetirementDate,
      })
      .from(loans)
      .innerJoin(mdas, eq(loans.mdaId, mdas.id))
      .leftJoin(latestExt, eq(loans.id, latestExt.loanId))
      .where(whereClause)
      // Sort by days-past-retirement (finer granularity than AC's month-level spec — same worst-first intent)
      .orderBy(desc(sql`${asOfDateStr}::date - ${loans.computedRetirementDate}`))
      .limit(pageSize)
      .offset(offset),

    // 2. Total count
    db
      .select({ value: count() })
      .from(loans)
      .innerJoin(mdas, eq(loans.mdaId, mdas.id))
      .leftJoin(latestExt, eq(loans.id, latestExt.loanId))
      .where(whereClause),

    // 3. Extension counts (full dataset)
    db
      .select({
        withExpiredExt: sql<number>`COUNT(*) FILTER (WHERE ${latestExt.newRetirementDate} IS NOT NULL)`,
        withoutExt: sql<number>`COUNT(*) FILTER (WHERE ${latestExt.newRetirementDate} IS NULL)`,
      })
      .from(loans)
      .innerJoin(mdas, eq(loans.mdaId, mdas.id))
      .leftJoin(latestExt, eq(loans.id, latestExt.loanId))
      .where(whereClause),

    // 4. MDA breakdown (full dataset)
    db
      .select({
        mdaId: loans.mdaId,
        mdaName: mdas.name,
        count: count(),
      })
      .from(loans)
      .innerJoin(mdas, eq(loans.mdaId, mdas.id))
      .leftJoin(latestExt, eq(loans.id, latestExt.loanId))
      .where(whereClause)
      .groupBy(loans.mdaId, mdas.name),
  ]);

  const totalItems = Number(countResult[0].value);
  const loanIds = rows.map((r) => r.loanId);
  const loansWithExpiredExt = rows.filter((r) => r.latestExtDate !== null);

  // Second parallel batch: page balance + extension refs (independent queries, run concurrently)
  const [balanceAggs, extRefs] = await Promise.all([
    loanIds.length > 0
      ? db
          .select({
            loanId: ledgerEntries.loanId,
            totalPaid: sql<string>`COALESCE(SUM(${ledgerEntries.amount}), '0.00')`,
          })
          .from(ledgerEntries)
          .where(inArray(ledgerEntries.loanId, loanIds))
          .groupBy(ledgerEntries.loanId)
      : Promise.resolve([] as { loanId: string; totalPaid: string }[]),
    loansWithExpiredExt.length > 0
      ? db
          .select({
            loanId: serviceExtensions.loanId,
            approvingAuthorityReference: serviceExtensions.approvingAuthorityReference,
          })
          .from(serviceExtensions)
          .where(inArray(serviceExtensions.loanId, loansWithExpiredExt.map((r) => r.loanId)))
          .orderBy(desc(serviceExtensions.createdAt))
      : Promise.resolve([] as { loanId: string; approvingAuthorityReference: string }[]),
  ]);

  const balanceMap = new Map(balanceAggs.map((b) => [b.loanId, b.totalPaid]));

  // Keep only the latest extension ref per loan (first seen since ordered DESC by createdAt)
  const extensionRefMap = new Map<string, string>();
  for (const ref of extRefs) {
    if (!extensionRefMap.has(ref.loanId)) {
      extensionRefMap.set(ref.loanId, ref.approvingAuthorityReference);
    }
  }

  // Build report rows
  const data: ServiceStatusVerificationRow[] = rows.map((row) => {
    const totalPaid = new Decimal(balanceMap.get(row.loanId) ?? '0.00');
    const principal = new Decimal(row.principalAmount);
    const totalInterest = principal.mul(new Decimal(row.interestRate)).div(100);
    const totalLoan = principal.plus(totalInterest);
    // Floor at zero: overpaid loans report 0.00, not negative balance (matches searchLoans pattern)
    const outstandingBalance = Decimal.max(new Decimal('0'), totalLoan.minus(totalPaid));

    const retirementDate = row.computedRetirementDate as Date;
    const monthsPastRetirement = Math.abs(differenceInMonths(asOfDate, retirementDate));

    const hasExpiredExtension = row.latestExtDate !== null;
    const expiredExtensionReference = hasExpiredExtension
      ? extensionRefMap.get(row.loanId) ?? null
      : null;

    return {
      loanId: row.loanId,
      staffName: row.staffName,
      staffId: row.staffId,
      mdaName: row.mdaName,
      mdaId: row.mdaId,
      loanReference: row.loanReference,
      computedRetirementDate: toDateString(retirementDate),
      monthsPastRetirement,
      outstandingBalance: outstandingBalance.toFixed(2),
      hasExpiredExtension,
      expiredExtensionReference,
      availableActions: [...AVAILABLE_ACTIONS],
    };
  });

  // Compute summary — reuse page data when all results fit on one page to avoid redundant queries
  let totalOutstandingExposure = new Decimal('0');
  const mdaBreakdown: ServiceStatusVerificationSummary['mdaBreakdown'] = [];
  const allDataOnPage = totalItems > 0 && totalItems <= data.length;

  if (totalItems > 0 && allDataOnPage) {
    // All flagged loans are on this page — reuse computed balances (0 additional queries)
    const mdaExposureMap = new Map<string, { mdaName: string; exposure: Decimal }>();
    for (const row of data) {
      const balance = new Decimal(row.outstandingBalance);
      totalOutstandingExposure = totalOutstandingExposure.plus(balance);

      const existing = mdaExposureMap.get(row.mdaId);
      if (existing) {
        existing.exposure = existing.exposure.plus(balance);
      } else {
        mdaExposureMap.set(row.mdaId, { mdaName: row.mdaName, exposure: balance });
      }
    }

    for (const mdaRow of mdaBreakdownResult) {
      const exposureData = mdaExposureMap.get(mdaRow.mdaId);
      mdaBreakdown.push({
        mdaId: mdaRow.mdaId,
        mdaName: mdaRow.mdaName,
        count: Number(mdaRow.count),
        outstandingExposure: exposureData?.exposure.toFixed(2) ?? '0.00',
      });
    }
  } else if (totalItems > 0) {
    // Full-dataset query needed — not all results fit on current page
    const allFlaggedLoans = await db
      .select({ loanId: loans.id, mdaId: loans.mdaId, mdaName: mdas.name, principalAmount: loans.principalAmount, interestRate: loans.interestRate })
      .from(loans)
      .innerJoin(mdas, eq(loans.mdaId, mdas.id))
      .leftJoin(latestExt, eq(loans.id, latestExt.loanId))
      .where(whereClause);

    const allIds = allFlaggedLoans.map((r) => r.loanId);

    const allBalanceAggs = allIds.length > 0
      ? await db
        .select({
          loanId: ledgerEntries.loanId,
          totalPaid: sql<string>`COALESCE(SUM(${ledgerEntries.amount}), '0.00')`,
        })
        .from(ledgerEntries)
        .where(inArray(ledgerEntries.loanId, allIds))
        .groupBy(ledgerEntries.loanId)
      : [];

    const allBalanceMap = new Map(allBalanceAggs.map((b) => [b.loanId, b.totalPaid]));

    // Single pass: compute totalOutstandingExposure and group by MDA
    const mdaExposureMap = new Map<string, { mdaName: string; exposure: Decimal }>();
    for (const loan of allFlaggedLoans) {
      const paid = new Decimal(allBalanceMap.get(loan.loanId) ?? '0.00');
      const principal = new Decimal(loan.principalAmount);
      const totalInterest = principal.mul(new Decimal(loan.interestRate)).div(100);
      const totalLoan = principal.plus(totalInterest);
      // Floor at zero: overpaid loans report 0.00, not negative balance
      const balance = Decimal.max(new Decimal('0'), totalLoan.minus(paid));

      totalOutstandingExposure = totalOutstandingExposure.plus(balance);

      const existing = mdaExposureMap.get(loan.mdaId);
      if (existing) {
        existing.exposure = existing.exposure.plus(balance);
      } else {
        mdaExposureMap.set(loan.mdaId, { mdaName: loan.mdaName, exposure: balance });
      }
    }

    for (const mdaRow of mdaBreakdownResult) {
      const exposureData = mdaExposureMap.get(mdaRow.mdaId);
      mdaBreakdown.push({
        mdaId: mdaRow.mdaId,
        mdaName: mdaRow.mdaName,
        count: Number(mdaRow.count),
        outstandingExposure: exposureData?.exposure.toFixed(2) ?? '0.00',
      });
    }
  }

  const summary: ServiceStatusVerificationSummary = {
    totalFlagged: totalItems,
    totalOutstandingExposure: totalOutstandingExposure.toFixed(2),
    totalWithExpiredExtensions: Number(extensionCounts[0]?.withExpiredExt ?? 0),
    totalWithoutExtensions: Number(extensionCounts[0]?.withoutExt ?? 0),
    mdaBreakdown,
    message: totalItems === 0 ? VOCABULARY.NO_POST_RETIREMENT_ACTIVITY : null,
  };

  return {
    data,
    summary,
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / pageSize),
    },
  };
}
