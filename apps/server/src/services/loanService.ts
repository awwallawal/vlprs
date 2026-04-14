import { eq, and, or, sql, ilike, count, inArray, asc, desc } from 'drizzle-orm';
import Decimal from 'decimal.js';
import { db } from '../db/index';
import { loans, mdas, ledgerEntries, migrationRecords } from '../db/schema';
import { generateUuidv7 } from '../lib/uuidv7';
import { AppError } from '../lib/appError';
import { withMdaScope } from '../lib/mdaScope';
import { ledgerDb } from '../db/immutable';
import { computeBalanceFromEntries, computeBalanceForLoan, computeRepaymentSchedule, computeRetirementDate } from './computationEngine';
import { buildTemporalProfile, getExtensionDataForLoan } from './temporalProfileService';
import * as gratuityProjectionService from './gratuityProjectionService';
import { VOCABULARY, inferTierFromPrincipal } from '@vlprs/shared';
import type { Loan, LoanSearchResult, LoanDetail, LoanStatus, LoanClassification as SharedLoanClassification } from '@vlprs/shared';
import { classifyAllLoans, LoanClassification } from './loanClassificationService';
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
  sortBy?: 'createdAt' | 'staffName' | 'loanReference' | 'status' | 'principalAmount' | 'outstandingBalance';
  sortOrder?: 'asc' | 'desc';
  classification?: SharedLoanClassification;
  filter?: 'zero-deduction' | 'post-retirement' | 'missing-staff-id';
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
  principalAmount: loans.principalAmount,
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

  // Attention item filters (Story 4.3)
  if (filters.filter === 'zero-deduction') {
    conditions.push(eq(loans.status, 'ACTIVE'));
    conditions.push(
      sql`${loans.id} NOT IN (
        SELECT DISTINCT ${ledgerEntries.loanId} FROM ${ledgerEntries}
        WHERE ${ledgerEntries.entryType} = 'PAYROLL'
        AND ${ledgerEntries.createdAt} > NOW() - INTERVAL '60 days'
      )`,
    );
  } else if (filters.filter === 'post-retirement') {
    conditions.push(eq(loans.status, 'ACTIVE'));
    conditions.push(sql`${loans.computedRetirementDate} < NOW()`);
  } else if (filters.filter === 'missing-staff-id') {
    conditions.push(
      or(
        eq(loans.staffId, ''),
        sql`${loans.staffId} IS NULL`,
      )!,
    );
  }

  // Classification enum mapping (shared between pre-filter and badge display)
  const classEnumMap: Record<LoanClassification, SharedLoanClassification> = {
    [LoanClassification.COMPLETED]: 'COMPLETED',
    [LoanClassification.ON_TRACK]: 'ON_TRACK',
    [LoanClassification.OVERDUE]: 'OVERDUE',
    [LoanClassification.STALLED]: 'STALLED',
    [LoanClassification.OVER_DEDUCTED]: 'OVER_DEDUCTED',
  };

  // Pre-filter by classification at SQL level (not post-hoc) — fixes pagination
  let preClassifications: Map<string, LoanClassification> | null = null;
  if (filters.classification) {
    preClassifications = await classifyAllLoans(filters.mdaId ?? mdaScope);
    const matchingIds: string[] = [];
    for (const [loanId, cls] of preClassifications) {
      if (classEnumMap[cls] === filters.classification) {
        matchingIds.push(loanId);
      }
    }
    if (matchingIds.length === 0) {
      return { data: [], pagination: { page, pageSize, totalItems: 0, totalPages: 0 } };
    }
    conditions.push(inArray(loans.id, matchingIds));
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

  // outstandingBalance is a computed field — requires application-level sort (all rows fetched, sorted in memory).
  // Performance is bounded: largest MDA has ~200 loans; with quick-win filter, typically <50.
  const isAppLevelSort = filters.sortBy === 'outstandingBalance';

  // Count query
  const [{ value: totalItems }] = await db
    .select({ value: count() })
    .from(loans)
    .innerJoin(mdas, eq(loans.mdaId, mdas.id))
    .where(whereClause);

  // Data query — skip SQL ORDER BY/LIMIT/OFFSET for application-level sort
  const baseQuery = db
    .select({
      id: loans.id,
      mdaId: loans.mdaId,
      staffId: loans.staffId,
      staffName: loans.staffName,
      mdaName: mdas.name,
      mdaCode: mdas.code,
      loanReference: loans.loanReference,
      status: loans.status,
      principalAmount: loans.principalAmount,
      interestRate: loans.interestRate,
      tenureMonths: loans.tenureMonths,
      limitedComputation: loans.limitedComputation,
    })
    .from(loans)
    .innerJoin(mdas, eq(loans.mdaId, mdas.id))
    .where(whereClause);

  let rows;
  if (isAppLevelSort) {
    // Fetch all matching rows — pagination applied after sort
    rows = await baseQuery;
  } else {
    const effectiveSortBy = filters.sortBy && filters.sortBy in SORT_COLUMNS ? filters.sortBy : 'createdAt';
    const sortKey = effectiveSortBy as keyof typeof SORT_COLUMNS;
    const sortCol = SORT_COLUMNS[sortKey];
    const sortDirection = filters.sortOrder ?? 'desc';
    const orderExpr = sortDirection === 'asc' ? asc(sortCol) : desc(sortCol);
    rows = await baseQuery.orderBy(orderExpr).limit(pageSize).offset(offset);
  }

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

  // Classification lookup: reuse pre-fetched classifications or fetch fresh
  const classificationMap = new Map<string, SharedLoanClassification>();
  if (loanIds.length > 0) {
    const allClassifications = preClassifications ?? await classifyAllLoans(mdaScope);
    for (const id of loanIds) {
      const cls = allClassifications.get(id);
      if (cls) {
        classificationMap.set(id, classEnumMap[cls]);
      }
    }
  }

  // Fetch last deduction date and retirement date for enriched results
  // First try PAYROLL entries (Epic 5 monthly submissions), fall back to migration record period
  let lastDeductionMap = new Map<string, string>();
  const retirementMap = new Map<string, string>();
  if (loanIds.length > 0) {
    const lastDeductions = await db
      .select({
        loanId: ledgerEntries.loanId,
        lastDate: sql<string>`MAX(${ledgerEntries.periodYear} || '-' || LPAD(${ledgerEntries.periodMonth}::text, 2, '0') || '-01')`,
      })
      .from(ledgerEntries)
      .where(and(
        inArray(ledgerEntries.loanId, loanIds),
        eq(ledgerEntries.entryType, 'PAYROLL'),
      ))
      .groupBy(ledgerEntries.loanId);
    lastDeductionMap = new Map(lastDeductions.map((d) => [d.loanId, d.lastDate]));

    // Fallback: for loans without PAYROLL entries, use latest migration record period
    const loansWithoutPayroll = loanIds.filter(id => !lastDeductionMap.has(id));
    if (loansWithoutPayroll.length > 0) {
      const migrationLastPeriods = await db.execute(sql`
        SELECT loan_id, MAX(period_year || '-' || LPAD(period_month::text, 2, '0') || '-01') as last_date
        FROM migration_records
        WHERE loan_id IN (${sql.join(loansWithoutPayroll.map(id => sql`${id}`), sql`, `)})
          AND deleted_at IS NULL
          AND period_year IS NOT NULL
          AND period_month IS NOT NULL
        GROUP BY loan_id
      `);
      for (const row of migrationLastPeriods.rows as Array<{ loan_id: string; last_date: string }>) {
        lastDeductionMap.set(row.loan_id, row.last_date);
      }
    }

    const retirementDates = await db
      .select({
        id: loans.id,
        retirementDate: loans.computedRetirementDate,
      })
      .from(loans)
      .where(inArray(loans.id, loanIds));
    for (const r of retirementDates) {
      if (r.retirementDate) {
        retirementMap.set(r.id, toDateString(r.retirementDate));
      }
    }
  }

  // Map to LoanSearchResult with computed balances
  let data: LoanSearchResult[] = rows.map((row) => {
    const ledgerAgg = balanceMap.get(row.id);
    const balResult = computeBalanceForLoan({
      limitedComputation: row.limitedComputation,
      principalAmount: row.principalAmount,
      interestRate: row.interestRate,
      tenureMonths: row.tenureMonths,
      totalPaid: ledgerAgg?.totalPaid ?? '0.00',
    });
    const installmentsPaid = ledgerAgg?.installments ?? 0;

    return {
      loanId: row.id,
      mdaId: row.mdaId,
      staffName: row.staffName,
      staffId: row.staffId,
      mdaName: row.mdaName,
      loanReference: row.loanReference,
      outstandingBalance: balResult.computedBalance,
      status: row.status,
      installmentsPaid,
      installmentsRemaining: Math.max(0, row.tenureMonths - installmentsPaid),
      principalAmount: row.principalAmount,
      tenureMonths: row.tenureMonths,
      classification: classificationMap.get(row.id),
      lastDeductionDate: lastDeductionMap.get(row.id),
      computedRetirementDate: retirementMap.get(row.id),
    };
  });

  // Application-level sort by computed outstanding balance
  if (isAppLevelSort) {
    const sortDirection = filters.sortOrder ?? 'asc';
    data.sort((a, b) => {
      const cmp = new Decimal(a.outstandingBalance).cmp(new Decimal(b.outstandingBalance));
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    data = data.slice(offset, offset + pageSize);
  }

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

  // Ledger entry count + extension data + gratuity projection + migration context (concurrent)
  const [ledgerCountResult, extensionData, gratuityProjection, migrationContext] = await Promise.all([
    db.select({ value: count() }).from(ledgerEntries).where(eq(ledgerEntries.loanId, loanId)),
    getExtensionDataForLoan(loanId),
    gratuityProjectionService.getGratuityProjection(loanId, mdaScope),
    db.select({
      installmentsPaid: migrationRecords.installmentsPaid,
      installmentsOutstanding: migrationRecords.installmentsOutstanding,
      gradeLevel: migrationRecords.gradeLevel,
    })
      .from(migrationRecords)
      .where(and(eq(migrationRecords.loanId, loanId), sql`${migrationRecords.deletedAt} IS NULL`))
      .limit(1)
      .then((rows) => rows[0] ?? null),
  ]);
  const [{ value: ledgerEntryCount }] = ledgerCountResult;

  // Resolve grade: migration record grade → tier inference from principal → fallback to loan value
  const inferredTier = inferTierFromPrincipal(row.loan.principalAmount);
  const effectiveGradeLevel = (row.loan.gradeLevel === 'MIGRATION' || !row.loan.gradeLevel)
    ? (migrationContext?.gradeLevel || (inferredTier ? inferredTier.gradeLevels : row.loan.gradeLevel))
    : row.loan.gradeLevel;

  return {
    id: row.loan.id,
    staffId: row.loan.staffId,
    staffName: row.loan.staffName,
    gradeLevel: effectiveGradeLevel,
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
    // Migration context — installment breakdown from source data (not from ledger entries)
    migrationContext: migrationContext
      ? {
          installmentsPaid: migrationContext.installmentsPaid,
          installmentsOutstanding: migrationContext.installmentsOutstanding,
        }
      : null,
  };
}

/**
 * Update the staff ID on a loan (e.g. replacing synthetic MIG-xxx with real government ID).
 * Also updates the linked migration record's employeeNo for consistency.
 */
export async function updateStaffId(
  loanId: string,
  newStaffId: string,
  _userId: string,
  mdaScope: string | null | undefined,
): Promise<{ loanId: string; staffId: string }> {
  const [loan] = await db
    .select({ id: loans.id, mdaId: loans.mdaId, staffId: loans.staffId })
    .from(loans)
    .where(eq(loans.id, loanId));

  if (!loan) {
    throw new AppError(404, 'LOAN_NOT_FOUND', VOCABULARY.LOAN_NOT_FOUND);
  }

  if (mdaScope && loan.mdaId !== mdaScope) {
    throw new AppError(403, 'MDA_ACCESS_DENIED', VOCABULARY.MDA_ACCESS_DENIED);
  }

  await db.transaction(async (tx) => {
    // Update loan staff ID
    await tx.update(loans)
      .set({ staffId: newStaffId, updatedAt: new Date() })
      .where(eq(loans.id, loanId));

    // Also update linked migration record's employeeNo for consistency
    await tx.update(migrationRecords)
      .set({ employeeNo: newStaffId })
      .where(and(
        eq(migrationRecords.loanId, loanId),
        sql`${migrationRecords.deletedAt} IS NULL`,
      ));
  });

  return { loanId, staffId: newStaffId };
}
