import { eq, and, or, sql, ilike, count, inArray, asc, desc } from 'drizzle-orm';
import Decimal from 'decimal.js';
import { db } from '../db/index';
import { loans, mdas, ledgerEntries } from '../db/schema';
import { generateUuidv7 } from '../lib/uuidv7';
import { AppError } from '../lib/appError';
import { withMdaScope } from '../lib/mdaScope';
import { ledgerDb } from '../db/immutable';
import { computeBalanceFromEntries, computeRepaymentSchedule, computeRetirementDate } from './computationEngine';
import { buildTemporalProfile, getExtensionDataForLoan } from './temporalProfileService';
import * as gratuityProjectionService from './gratuityProjectionService';
import { VOCABULARY } from '@vlprs/shared';
import type { Loan, LoanSearchResult, LoanDetail, LoanStatus } from '@vlprs/shared';
import { toDateString } from '../lib/dateUtils';

// ─── Types ───────────────────────────────────────────────────────────

interface ActingUser {
  userId: string;
  role: string;
  mdaId: string | null;
}

interface CreateLoanData {
  staffId: string;
  staffName: string;
  gradeLevel: string;
  mdaId: string;
  principalAmount: string;
  interestRate: string;
  tenureMonths: number;
  moratoriumMonths: number;
  monthlyDeductionAmount: string;
  approvalDate: string;
  firstDeductionDate: string;
  dateOfBirth?: string;
  dateOfFirstAppointment?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────

function toLoanResponse(row: typeof loans.$inferSelect): Loan {
  return {
    id: row.id,
    staffId: row.staffId,
    staffName: row.staffName,
    gradeLevel: row.gradeLevel,
    mdaId: row.mdaId,
    principalAmount: row.principalAmount,
    interestRate: row.interestRate,
    tenureMonths: row.tenureMonths,
    moratoriumMonths: row.moratoriumMonths,
    monthlyDeductionAmount: row.monthlyDeductionAmount,
    approvalDate: toDateString(row.approvalDate),
    firstDeductionDate: toDateString(row.firstDeductionDate),
    loanReference: row.loanReference,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    temporalProfile: buildTemporalProfile(row),
  };
}

async function generateLoanReference(maxRetries = 3): Promise<string> {
  const currentYear = new Date().getFullYear();

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const [result] = await db
      .select({ count: sql<string>`COUNT(*)` })
      .from(loans)
      .where(sql`EXTRACT(YEAR FROM ${loans.createdAt}) = ${currentYear}`);

    const nextNum = parseInt(result.count, 10) + 1 + attempt;
    const padded = String(nextNum).padStart(Math.max(4, String(nextNum).length), '0');
    const reference = `VLC-${currentYear}-${padded}`;

    // Check uniqueness
    const [existing] = await db
      .select({ id: loans.id })
      .from(loans)
      .where(eq(loans.loanReference, reference));

    if (!existing) return reference;
  }

  throw new AppError(500, 'DUPLICATE_LOAN_REFERENCE', VOCABULARY.DUPLICATE_LOAN_REFERENCE);
}

// ─── Service Functions ──────────────────────────────────────────────

export async function createLoan(_actingUser: ActingUser, data: CreateLoanData): Promise<Loan> {
  // Verify MDA exists
  const [mda] = await db.select({ id: mdas.id }).from(mdas).where(eq(mdas.id, data.mdaId));
  if (!mda) {
    throw new AppError(404, 'MDA_NOT_FOUND', VOCABULARY.MDA_NOT_FOUND);
  }

  // Validate temporal dates (if provided)
  if (data.dateOfBirth && new Date(data.dateOfBirth) > new Date()) {
    throw new AppError(422, 'TEMPORAL_DOB_FUTURE', VOCABULARY.TEMPORAL_DOB_FUTURE);
  }
  if (data.dateOfBirth && data.dateOfFirstAppointment &&
      new Date(data.dateOfFirstAppointment) < new Date(data.dateOfBirth)) {
    throw new AppError(422, 'TEMPORAL_APPT_BEFORE_DOB', VOCABULARY.TEMPORAL_APPT_BEFORE_DOB);
  }

  const MAX_INSERT_RETRIES = 3;
  for (let attempt = 0; attempt < MAX_INSERT_RETRIES; attempt++) {
    const loanReference = await generateLoanReference();

    try {
      // Compute retirement date if both temporal dates provided
      let computedRetirementDate: Date | null = null;
      if (data.dateOfBirth && data.dateOfFirstAppointment) {
        const { retirementDate } = computeRetirementDate(
          new Date(data.dateOfBirth),
          new Date(data.dateOfFirstAppointment),
        );
        computedRetirementDate = retirementDate;
      }

      const [row] = await db
        .insert(loans)
        .values({
          id: generateUuidv7(),
          staffId: data.staffId,
          staffName: data.staffName,
          gradeLevel: data.gradeLevel,
          mdaId: data.mdaId,
          principalAmount: data.principalAmount,
          interestRate: data.interestRate,
          tenureMonths: data.tenureMonths,
          moratoriumMonths: data.moratoriumMonths,
          monthlyDeductionAmount: data.monthlyDeductionAmount,
          approvalDate: new Date(data.approvalDate),
          firstDeductionDate: new Date(data.firstDeductionDate),
          loanReference,
          status: 'APPLIED',
          dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
          dateOfFirstAppointment: data.dateOfFirstAppointment ? new Date(data.dateOfFirstAppointment) : null,
          computedRetirementDate,
        })
        .returning();

      return toLoanResponse(row);
    } catch (err: unknown) {
      // PostgreSQL unique_violation error code = 23505
      const isUniqueViolation =
        err instanceof Error && 'code' in err && (err as Error & { code: string }).code === '23505';
      if (isUniqueViolation && attempt < MAX_INSERT_RETRIES - 1) continue;
      throw err;
    }
  }

  throw new AppError(500, 'DUPLICATE_LOAN_REFERENCE', VOCABULARY.DUPLICATE_LOAN_REFERENCE);
}

export async function getLoanById(
  id: string,
  mdaScope?: string | null,
): Promise<Loan> {
  const conditions = [eq(loans.id, id)];
  const scopeCondition = withMdaScope(loans.mdaId, mdaScope);
  if (scopeCondition) conditions.push(scopeCondition);

  const [row] = await db
    .select()
    .from(loans)
    .where(and(...conditions));

  if (!row) {
    throw new AppError(404, 'LOAN_NOT_FOUND', VOCABULARY.LOAN_NOT_FOUND);
  }

  return toLoanResponse(row);
}

// ─── Search & Detail (Story 2.6) ────────────────────────────────────

interface SearchLoansFilters {
  search?: string;
  page?: number;
  pageSize?: number;
  status?: LoanStatus;
  mdaId?: string;
  sortBy?: 'createdAt' | 'staffName' | 'loanReference' | 'status';
  sortOrder?: 'asc' | 'desc';
}

interface PaginatedLoans {
  data: LoanSearchResult[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

const SORT_COLUMNS = {
  createdAt: loans.createdAt,
  staffName: loans.staffName,
  loanReference: loans.loanReference,
  status: loans.status,
} as const;

export async function searchLoans(
  mdaScope: string | null | undefined,
  filters: SearchLoansFilters = {},
): Promise<PaginatedLoans> {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;
  const offset = (page - 1) * pageSize;

  // Build WHERE conditions
  const conditions: ReturnType<typeof eq>[] = [];

  // MDA scoping
  const mdaScopeCondition = withMdaScope(loans.mdaId, mdaScope);
  if (mdaScopeCondition) conditions.push(mdaScopeCondition);

  // Optional status filter
  if (filters.status) {
    conditions.push(eq(loans.status, filters.status));
  }

  // Optional MDA filter (from query param, separate from scope)
  if (filters.mdaId) {
    conditions.push(eq(loans.mdaId, filters.mdaId));
  }

  // Multi-field search
  if (filters.search) {
    const escaped = filters.search.replace(/[%_\\]/g, '\\$&');
    const term = `%${escaped}%`;
    conditions.push(
      or(
        ilike(loans.staffId, term),
        ilike(loans.staffName, term),
        ilike(loans.loanReference, term),
        ilike(mdas.code, term),
        ilike(mdas.name, term),
      )!,
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Sort direction
  const sortCol = SORT_COLUMNS[filters.sortBy ?? 'createdAt'];
  const sortDirection = filters.sortOrder ?? 'desc';
  const orderExpr = sortDirection === 'asc' ? asc(sortCol) : desc(sortCol);

  // Count query
  const [{ value: totalItems }] = await db
    .select({ value: count() })
    .from(loans)
    .innerJoin(mdas, eq(loans.mdaId, mdas.id))
    .where(whereClause);

  // Data query
  const rows = await db
    .select({
      id: loans.id,
      staffId: loans.staffId,
      staffName: loans.staffName,
      mdaName: mdas.name,
      mdaCode: mdas.code,
      loanReference: loans.loanReference,
      status: loans.status,
      principalAmount: loans.principalAmount,
      interestRate: loans.interestRate,
      tenureMonths: loans.tenureMonths,
    })
    .from(loans)
    .innerJoin(mdas, eq(loans.mdaId, mdas.id))
    .where(whereClause)
    .orderBy(orderExpr)
    .limit(pageSize)
    .offset(offset);

  // Batch balance computation: single aggregation for all loans in page
  const loanIds = rows.map((r) => r.id);
  let balanceMap = new Map<string, { totalPaid: string; installments: number }>();

  if (loanIds.length > 0) {
    const sums = await db
      .select({
        loanId: ledgerEntries.loanId,
        totalPaid: sql<string>`COALESCE(SUM(${ledgerEntries.amount}), '0.00')`,
        installments: sql<number>`COUNT(*) FILTER (WHERE ${ledgerEntries.entryType} = 'PAYROLL')`,
      })
      .from(ledgerEntries)
      .where(inArray(ledgerEntries.loanId, loanIds))
      .groupBy(ledgerEntries.loanId);

    balanceMap = new Map(sums.map((s) => [s.loanId, { totalPaid: s.totalPaid, installments: Number(s.installments) }]));
  }

  // Map to LoanSearchResult with computed balances
  const data: LoanSearchResult[] = rows.map((row) => {
    const ledgerAgg = balanceMap.get(row.id);
    const totalPaid = new Decimal(ledgerAgg?.totalPaid ?? '0.00');
    const principal = new Decimal(row.principalAmount);
    const totalInterest = principal.mul(new Decimal(row.interestRate)).div(100);
    const totalLoan = principal.plus(totalInterest);
    const outstandingBalance = Decimal.max(new Decimal('0'), totalLoan.minus(totalPaid));
    const installmentsPaid = ledgerAgg?.installments ?? 0;

    return {
      loanId: row.id,
      staffName: row.staffName,
      staffId: row.staffId,
      mdaName: row.mdaName,
      loanReference: row.loanReference,
      outstandingBalance: outstandingBalance.toFixed(2),
      status: row.status,
      installmentsPaid,
      installmentsRemaining: Math.max(0, row.tenureMonths - installmentsPaid),
      principalAmount: row.principalAmount,
      tenureMonths: row.tenureMonths,
    };
  });

  return {
    data,
    pagination: {
      page,
      pageSize,
      totalItems: Number(totalItems),
      totalPages: Math.ceil(Number(totalItems) / pageSize),
    },
  };
}

export async function getLoanDetail(
  loanId: string,
  mdaScope: string | null | undefined,
): Promise<LoanDetail> {
  // Fetch loan + MDA JOIN
  const [row] = await db
    .select({
      loan: loans,
      mdaName: mdas.name,
      mdaCode: mdas.code,
    })
    .from(loans)
    .innerJoin(mdas, eq(loans.mdaId, mdas.id))
    .where(eq(loans.id, loanId));

  if (!row) {
    throw new AppError(404, 'LOAN_NOT_FOUND', VOCABULARY.LOAN_NOT_FOUND);
  }

  // MDA scope check — 403 if officer tries to access loan outside their MDA
  if (mdaScope && row.loan.mdaId !== mdaScope) {
    throw new AppError(403, 'MDA_ACCESS_DENIED', VOCABULARY.MDA_ACCESS_DENIED);
  }

  // Fetch all ledger entries for this loan
  const entries = await ledgerDb.selectByLoan(loanId);

  // Compute full balance from entries (Story 2.5 pure function)
  const balance = computeBalanceFromEntries(
    row.loan.principalAmount,
    row.loan.interestRate,
    row.loan.tenureMonths,
    entries.map((e) => ({
      amount: e.amount,
      principalComponent: e.principalComponent,
      interestComponent: e.interestComponent,
      entryType: e.entryType,
    })),
    null,
  );

  // Compute repayment schedule (Story 2.3 pure function)
  const schedule = computeRepaymentSchedule({
    principalAmount: row.loan.principalAmount,
    interestRate: row.loan.interestRate,
    tenureMonths: row.loan.tenureMonths,
    moratoriumMonths: row.loan.moratoriumMonths,
  });

  // Ledger entry count + extension data + gratuity projection (concurrent)
  const [ledgerCountResult, extensionData, gratuityProjection] = await Promise.all([
    db.select({ value: count() }).from(ledgerEntries).where(eq(ledgerEntries.loanId, loanId)),
    getExtensionDataForLoan(loanId),
    gratuityProjectionService.getGratuityProjection(loanId, mdaScope),
  ]);
  const [{ value: ledgerEntryCount }] = ledgerCountResult;

  return {
    id: row.loan.id,
    staffId: row.loan.staffId,
    staffName: row.loan.staffName,
    gradeLevel: row.loan.gradeLevel,
    mdaId: row.loan.mdaId,
    mdaName: row.mdaName,
    mdaCode: row.mdaCode,
    principalAmount: row.loan.principalAmount,
    interestRate: row.loan.interestRate,
    tenureMonths: row.loan.tenureMonths,
    moratoriumMonths: row.loan.moratoriumMonths,
    monthlyDeductionAmount: row.loan.monthlyDeductionAmount,
    approvalDate: toDateString(row.loan.approvalDate),
    firstDeductionDate: toDateString(row.loan.firstDeductionDate),
    loanReference: row.loan.loanReference,
    status: row.loan.status,
    createdAt: row.loan.createdAt.toISOString(),
    updatedAt: row.loan.updatedAt.toISOString(),
    balance,
    schedule,
    ledgerEntryCount: Number(ledgerEntryCount),
    temporalProfile: buildTemporalProfile(row.loan, extensionData),
    gratuityProjection,
  };
}
