/**
 * loanSnapshotReportService — Composition layer for Loan Snapshot Report (Story 6.2, FR40).
 *
 * Two-query batch approach (no N+1):
 *   Query 1: loans + MDA data (stored columns)
 *   Query 2: batch ledger summary for installmentsPaid, totalPaid, lastPeriod
 *
 * In-memory: compute outstandingBalance via computeBalanceForLoan(), derive dates.
 */

import Decimal from 'decimal.js';
import { eq, and, sql, count, inArray, asc, desc } from 'drizzle-orm';
import { addMonths } from 'date-fns';
import { db } from '../db';
import { loans, ledgerEntries, mdas } from '../db/schema';
import { computeBalanceForLoan } from './computationEngine';
import { withMdaScope } from '../lib/mdaScope';
import type { LoanSnapshotReportData, LoanSnapshotRow, LoanStatusValue } from '@vlprs/shared';
import type { SQL } from 'drizzle-orm';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

type SortField = 'staffName' | 'staffId' | 'principalAmount' | 'outstandingBalance' | 'status' | 'approvalDate' | 'monthlyDeductionAmount' | 'tenureMonths' | 'gradeLevel';

function getSortColumn(sortBy: SortField) {
  switch (sortBy) {
    case 'staffName': return loans.staffName;
    case 'staffId': return loans.staffId;
    case 'principalAmount': return loans.principalAmount;
    case 'status': return loans.status;
    case 'approvalDate': return loans.approvalDate;
    case 'monthlyDeductionAmount': return loans.monthlyDeductionAmount;
    case 'tenureMonths': return loans.tenureMonths;
    case 'gradeLevel': return loans.gradeLevel;
    default: return loans.staffName;
  }
}

export async function generateLoanSnapshotReport(
  mdaId: string,
  mdaScope: string | null,
  options: {
    page?: number;
    pageSize?: number;
    sortBy?: SortField;
    sortOrder?: 'asc' | 'desc';
    statusFilter?: string;
  } = {},
): Promise<LoanSnapshotReportData> {
  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? 50;
  const sortBy = options.sortBy ?? 'staffName';
  const sortOrder = options.sortOrder ?? 'asc';
  const offset = (page - 1) * pageSize;

  // Build WHERE conditions
  const conditions: SQL[] = [eq(loans.mdaId, mdaId)];
  const scopeCondition = withMdaScope(loans.mdaId, mdaScope);
  if (scopeCondition) conditions.push(scopeCondition);
  if (options.statusFilter) {
    conditions.push(eq(loans.status, options.statusFilter as LoanStatusValue));
  }

  const whereClause = and(...conditions);

  // Query 1: Fetch loans with MDA data (stored columns only)
  const sortColumn = getSortColumn(sortBy);
  const orderFn = sortOrder === 'desc' ? desc : asc;

  const loansWithMda = await db
    .select({
      id: loans.id,
      staffId: loans.staffId,
      staffName: loans.staffName,
      gradeLevel: loans.gradeLevel,
      principalAmount: loans.principalAmount,
      interestRate: loans.interestRate,
      tenureMonths: loans.tenureMonths,
      moratoriumMonths: loans.moratoriumMonths,
      monthlyDeductionAmount: loans.monthlyDeductionAmount,
      status: loans.status,
      approvalDate: loans.approvalDate,
      firstDeductionDate: loans.firstDeductionDate,
      loanReference: loans.loanReference,
      limitedComputation: loans.limitedComputation,
      mdaCode: mdas.code,
    })
    .from(loans)
    .innerJoin(mdas, eq(loans.mdaId, mdas.id))
    .where(whereClause)
    .orderBy(orderFn(sortColumn))
    .limit(pageSize)
    .offset(offset);

  // Count query for pagination
  const [totalResult] = await db
    .select({ value: count() })
    .from(loans)
    .where(whereClause);

  const totalItems = totalResult?.value ?? 0;
  const totalPages = Math.ceil(totalItems / pageSize);

  if (loansWithMda.length === 0) {
    return {
      data: [],
      summary: {
        totalLoans: totalItems,
        totalOutstanding: '0.00',
        totalMonthlyDeduction: '0.00',
        averageInterestRate: '0.000',
      },
      pagination: { page, pageSize, totalItems, totalPages },
    };
  }

  // Query 2: Batch-fetch ledger summaries for all loans in one query
  const loanIds = loansWithMda.map((l) => l.id);
  const ledgerSummaries = await db
    .select({
      loanId: ledgerEntries.loanId,
      totalPaid: sql<string>`SUM(${ledgerEntries.amount})`,
      installmentCount: sql<number>`COUNT(*) FILTER (WHERE ${ledgerEntries.entryType} = 'PAYROLL')`,
      lastPeriod: sql<string>`MAX(${ledgerEntries.periodYear} || '-' || LPAD(${ledgerEntries.periodMonth}::text, 2, '0'))`,
    })
    .from(ledgerEntries)
    .where(inArray(ledgerEntries.loanId, loanIds))
    .groupBy(ledgerEntries.loanId);

  const ledgerMap = new Map(ledgerSummaries.map((s) => [s.loanId, s]));

  // In-memory: compute installmentsPaid + outstandingBalance per loan (page rows)
  const snapshotRows: LoanSnapshotRow[] = loansWithMda.map((loan) => {
    const ledger = ledgerMap.get(loan.id);
    const installmentsPaid = ledger?.installmentCount ?? 0;
    const totalPaid = ledger?.totalPaid ?? '0.00';

    // Compute balance using the aggregated path
    const balance = computeBalanceForLoan({
      limitedComputation: loan.limitedComputation,
      principalAmount: loan.principalAmount,
      interestRate: loan.interestRate,
      tenureMonths: loan.tenureMonths,
      totalPaid,
    });

    const lastDeductionDate = ledger?.lastPeriod ?? null;

    // Next deduction date: firstDeductionDate + installmentsPaid + moratoriumMonths
    let nextDeductionDate: string | null = null;
    if (loan.firstDeductionDate && installmentsPaid < loan.tenureMonths) {
      const nextDate = addMonths(
        new Date(loan.firstDeductionDate),
        installmentsPaid + loan.moratoriumMonths,
      );
      nextDeductionDate = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
    }

    return {
      staffId: loan.staffId,
      staffName: loan.staffName,
      gradeLevel: loan.gradeLevel,
      principalAmount: loan.principalAmount,
      interestRate: loan.interestRate,
      tenureMonths: loan.tenureMonths,
      moratoriumMonths: loan.moratoriumMonths,
      monthlyDeductionAmount: loan.monthlyDeductionAmount,
      installmentsPaid,
      outstandingBalance: balance.computedBalance,
      status: loan.status,
      lastDeductionDate,
      nextDeductionDate,
      approvalDate: loan.approvalDate instanceof Date
        ? loan.approvalDate.toISOString()
        : String(loan.approvalDate),
      loanReference: loan.loanReference,
      mdaCode: loan.mdaCode,
    };
  });

  // ─── Dataset-wide summary (not page-scoped) ──────────────────────
  // SQL aggregation for monthlyDeduction and interestRate (full dataset)
  const [summaryAgg] = await db
    .select({
      totalMonthlyDeduction: sql<string>`COALESCE(SUM(${loans.monthlyDeductionAmount})::numeric(15,2)::text, '0.00')`,
      avgInterestRate: sql<string>`COALESCE(AVG(${loans.interestRate})::numeric(10,3)::text, '0.000')`,
    })
    .from(loans)
    .where(whereClause);

  // totalOutstanding requires per-loan computation (balance = totalLoan - totalPaid)
  const allLoanCore = await db
    .select({
      id: loans.id,
      principalAmount: loans.principalAmount,
      interestRate: loans.interestRate,
      tenureMonths: loans.tenureMonths,
      limitedComputation: loans.limitedComputation,
    })
    .from(loans)
    .where(whereClause);

  let datasetOutstanding = new Decimal('0');
  if (allLoanCore.length > 0) {
    const allIds = allLoanCore.map((l) => l.id);
    const allLedgerTotals = await db
      .select({
        loanId: ledgerEntries.loanId,
        totalPaid: sql<string>`SUM(${ledgerEntries.amount})`,
      })
      .from(ledgerEntries)
      .where(inArray(ledgerEntries.loanId, allIds))
      .groupBy(ledgerEntries.loanId);

    const allLedgerMap = new Map(allLedgerTotals.map((s) => [s.loanId, s.totalPaid]));
    for (const loan of allLoanCore) {
      const bal = computeBalanceForLoan({
        limitedComputation: loan.limitedComputation,
        principalAmount: loan.principalAmount,
        interestRate: loan.interestRate,
        tenureMonths: loan.tenureMonths,
        totalPaid: allLedgerMap.get(loan.id) ?? '0.00',
      });
      datasetOutstanding = datasetOutstanding.plus(new Decimal(bal.computedBalance));
    }
  }

  return {
    data: snapshotRows,
    summary: {
      totalLoans: totalItems,
      totalOutstanding: datasetOutstanding.toFixed(2),
      totalMonthlyDeduction: summaryAgg?.totalMonthlyDeduction ?? '0.00',
      averageInterestRate: summaryAgg?.avgInterestRate ?? '0.000',
    },
    pagination: { page, pageSize, totalItems, totalPages },
  };
}
