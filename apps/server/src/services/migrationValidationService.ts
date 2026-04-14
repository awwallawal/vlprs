import Decimal from 'decimal.js';
import { eq, and, isNull, desc, asc, sql } from 'drizzle-orm';
import { db } from '../db/index';


import { migrationUploads, migrationRecords } from '../db/schema';
import { AppError } from '../lib/appError';
import { withMdaScope } from '../lib/mdaScope';
import { VOCABULARY, inferTierFromPrincipal } from '@vlprs/shared';
import type { VarianceCategory, ValidationSummary, ValidationResultRecord, MigrationRecordDetail } from '@vlprs/shared';
import { computeRepaymentSchedule, computeSchemeExpected, inferTenureFromRate } from './computationEngine';
import { detectMultiMda } from '../migration/mdaDelineation';
import * as deduplicationService from './deduplicationService';
import { generateWithinFileDuplicateObservations } from './observationEngine';
import { trackFireAndForget } from './fireAndForgetTracking';

// Configure decimal.js for financial precision (consistent with computationEngine)
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// ─── Constants ──────────────────────────────────────────────────────

export const KNOWN_RATE_TIERS = [6.67, 8.0, 8.89, 10.66, 11.11, 13.33];
export const STANDARD_RATE = new Decimal('13.33');
export const RATE_TOLERANCE = new Decimal('0.5');

const VARIANCE_THRESHOLD_CLEAN = new Decimal('1');
const VARIANCE_THRESHOLD_MINOR = new Decimal('500');

// ─── Rate Computation ───────────────────────────────────────────────

/**
 * Compute effective interest rate from principal and totalLoan.
 * Returns rate as string (e.g., "13.330") or null if inputs are missing/invalid.
 */
export function computeEffectiveRate(principal: string | null, totalLoan: string | null): string | null {
  if (!principal || !totalLoan) return null;
  try {
    const p = new Decimal(principal);
    const t = new Decimal(totalLoan);
    if (p.isZero() || p.isNegative() || t.isNegative()) return null;
    return t.minus(p).div(p).mul(100).toDecimalPlaces(3).toString();
  } catch {
    return null;
  }
}

/**
 * Check if a computed rate matches any known rate tier within tolerance.
 */
export function matchesKnownTier(computedRate: string): boolean {
  const rate = new Decimal(computedRate);
  return KNOWN_RATE_TIERS.some((tier) => rate.minus(tier).abs().lte(RATE_TOLERANCE));
}

/**
 * Check if a computed rate is the standard rate (13.33%) within tolerance.
 */
export function isStandardRate(computedRate: string): boolean {
  return new Decimal(computedRate).minus(STANDARD_RATE).abs().lte(RATE_TOLERANCE);
}

// ─── Variance Categorisation ────────────────────────────────────────

interface RecordValidationResult {
  varianceCategory: VarianceCategory;
  varianceAmount: string;
  computedRate: string | null;
  hasRateVariance: boolean;
  computedTotalLoan: string | null;
  computedMonthlyDeduction: string | null;
  computedOutstandingBalance: string | null;
  schemeExpectedTotalLoan: string | null;
  schemeExpectedMonthlyDeduction: string | null;
  schemeExpectedTotalInterest: string | null;
}

interface MigrationRecordRow {
  id: string;
  principal: string | null;
  totalLoan: string | null;
  monthlyDeduction: string | null;
  outstandingBalance: string | null;
  installmentCount: number | null;
  installmentsPaid: number | null;
  installmentsOutstanding: number | null;
  interestTotal: string | null;
  [key: string]: unknown;
}

/**
 * Determine tenure for scheme expected computation using priority order:
 * 1. installmentCount if available AND > 0
 * 2. inferTenureFromRate() if rate matches known tier
 * 3. null if neither available (don't silently default to 60)
 */
function inferSchemeExpectedTenure(record: MigrationRecordRow, computedRate: string | null): number | null {
  if (record.installmentCount != null && record.installmentCount > 0) {
    return record.installmentCount;
  }
  if (computedRate !== null) {
    return inferTenureFromRate(computedRate);
  }
  return null;
}

/**
 * Validate a single migration record: compute rate, compare values, categorise variance.
 * Computes three vectors: Scheme Expected, Reverse Engineered, MDA Declared.
 */
export function validateRecord(record: MigrationRecordRow): RecordValidationResult {
  const { principal, totalLoan, monthlyDeduction, outstandingBalance } = record;

  const nullScheme = { schemeExpectedTotalLoan: null, schemeExpectedMonthlyDeduction: null, schemeExpectedTotalInterest: null };

  // Check if we have enough data for any validation
  const hasFinancialData = principal || totalLoan || monthlyDeduction || outstandingBalance;
  if (!hasFinancialData) {
    return {
      varianceCategory: 'anomalous',
      varianceAmount: '0.00',
      computedRate: null,
      hasRateVariance: false,
      computedTotalLoan: null,
      computedMonthlyDeduction: null,
      computedOutstandingBalance: null,
      ...nullScheme,
    };
  }

  // Step 1: Compute effective rate if possible
  const computedRate = computeEffectiveRate(principal, totalLoan);
  const hasRateVariance = computedRate !== null && !isStandardRate(computedRate);

  // Step 2: Detect structural error (unknown rate tier) — flag but don't short-circuit
  // so computed values are still available for admin comparison
  const isStructuralError = computedRate !== null && hasRateVariance && !matchesKnownTier(computedRate);

  // Step 3: Determine rate to use for reverse-engineered computation
  const rateForComputation = computedRate !== null && hasRateVariance
    ? computedRate
    : STANDARD_RATE.toString();

  // Step 4: Infer tenure (for reverse-engineered path)
  const tenure = inferTenure(record);

  // Step 5: Compute Scheme Expected vector (separate tenure inference — no silent defaults)
  let schemeExpectedTotalLoan: string | null = null;
  let schemeExpectedMonthlyDeduction: string | null = null;
  let schemeExpectedTotalInterest: string | null = null;

  if (principal) {
    const schemeTenure = inferSchemeExpectedTenure(record, computedRate);
    if (schemeTenure !== null) {
      try {
        const scheme = computeSchemeExpected(principal, schemeTenure);
        schemeExpectedTotalLoan = scheme.totalLoan;
        schemeExpectedMonthlyDeduction = scheme.monthlyDeduction;
        schemeExpectedTotalInterest = scheme.totalInterest;
      } catch {
        // invalid principal for scheme computation — leave null
      }
    }
  }

  // Step 6: Reverse-engineered computation (existing path)
  if (principal && tenure > 0) {
    try {
      const schedule = computeRepaymentSchedule({
        principalAmount: principal,
        interestRate: rateForComputation,
        tenureMonths: tenure,
        moratoriumMonths: 0,
      });

      const computedTotalLoan = schedule.totalLoan;
      const computedMonthlyDed = schedule.monthlyDeduction;

      // Compute expected outstanding balance
      let computedOutstandingBal: string | null = null;
      const paidInstallments = record.installmentsPaid ?? 0;
      if (paidInstallments > 0) {
        const totalPaid = new Decimal(computedMonthlyDed).mul(paidInstallments);
        computedOutstandingBal = new Decimal(computedTotalLoan).minus(totalPaid).toFixed(2);
      }

      // Variance: use Scheme Expected vs MDA Declared if scheme is available,
      // otherwise fall back to Reverse Engineered vs Declared
      const diffs: Decimal[] = [];

      if (schemeExpectedTotalLoan !== null && totalLoan) {
        diffs.push(new Decimal(totalLoan).minus(schemeExpectedTotalLoan).abs());
      } else if (totalLoan) {
        diffs.push(new Decimal(totalLoan).minus(computedTotalLoan).abs());
      }

      if (schemeExpectedMonthlyDeduction !== null && monthlyDeduction) {
        diffs.push(new Decimal(monthlyDeduction).minus(schemeExpectedMonthlyDeduction).abs());
      } else if (monthlyDeduction) {
        diffs.push(new Decimal(monthlyDeduction).minus(computedMonthlyDed).abs());
      }

      // Outstanding balance: no scheme expected equivalent exists (depends on payment history,
      // not the scheme formula — see Story 8.0b). Falls back to reverse-engineered vs declared.
      if (outstandingBalance && computedOutstandingBal) {
        diffs.push(new Decimal(outstandingBalance).minus(computedOutstandingBal).abs());
      }

      const maxDiff = diffs.length > 0
        ? Decimal.max(...diffs)
        : new Decimal('0');

      // Structural errors override the amount-based category
      const varianceCategory = isStructuralError
        ? 'structural_error' as VarianceCategory
        : categoriseByAmount(maxDiff);

      return {
        varianceCategory,
        varianceAmount: maxDiff.toFixed(2),
        computedRate,
        hasRateVariance: isStructuralError || hasRateVariance,
        computedTotalLoan,
        computedMonthlyDeduction: computedMonthlyDed,
        computedOutstandingBalance: computedOutstandingBal,
        schemeExpectedTotalLoan,
        schemeExpectedMonthlyDeduction,
        schemeExpectedTotalInterest,
      };
    } catch {
      return {
        varianceCategory: isStructuralError ? 'structural_error' : 'anomalous',
        varianceAmount: '0.00',
        computedRate,
        hasRateVariance: isStructuralError || hasRateVariance,
        computedTotalLoan: null,
        computedMonthlyDeduction: null,
        computedOutstandingBalance: null,
        schemeExpectedTotalLoan,
        schemeExpectedMonthlyDeduction,
        schemeExpectedTotalInterest,
      };
    }
  }

  // Not enough data for full computation
  return {
    varianceCategory: isStructuralError ? 'structural_error' : 'anomalous',
    varianceAmount: '0.00',
    computedRate,
    hasRateVariance: isStructuralError || hasRateVariance,
    computedTotalLoan: null,
    computedMonthlyDeduction: null,
    computedOutstandingBalance: null,
    schemeExpectedTotalLoan,
    schemeExpectedMonthlyDeduction,
    schemeExpectedTotalInterest,
  };
}

/**
 * Categorise variance by amount threshold.
 */
function categoriseByAmount(amount: Decimal): VarianceCategory {
  if (amount.lt(VARIANCE_THRESHOLD_CLEAN)) return 'clean';
  if (amount.lt(VARIANCE_THRESHOLD_MINOR)) return 'minor_variance';
  return 'significant_variance';
}

/**
 * Infer tenure from available record data.
 */
function inferTenure(record: MigrationRecordRow): number {
  // If installmentCount is present, use it directly
  if (record.installmentCount && record.installmentCount > 0) {
    return record.installmentCount;
  }

  // If monthlyDeduction and totalLoan both available, infer
  if (record.monthlyDeduction && record.totalLoan) {
    try {
      const monthly = new Decimal(record.monthlyDeduction);
      const total = new Decimal(record.totalLoan);
      if (monthly.gt(0)) {
        return Math.ceil(total.div(monthly).toNumber());
      }
    } catch {
      // Fall through to default
    }
  }

  // Default to 60-month standard tenure
  return 60;
}

// ─── Batch Validation ───────────────────────────────────────────────

/**
 * Validate all records in an upload. Updates each record's variance columns
 * and sets the upload status to 'validated'.
 */
export async function validateUpload(
  uploadId: string,
  mdaScope?: string | null,
): Promise<ValidationSummary> {
  // Load the upload
  const [upload] = await db
    .select()
    .from(migrationUploads)
    .where(
      and(
        eq(migrationUploads.id, uploadId),
        withMdaScope(migrationUploads.mdaId, mdaScope),
        isNull(migrationUploads.deletedAt),
      ),
    );

  if (!upload) {
    throw new AppError(404, 'UPLOAD_NOT_FOUND', VOCABULARY.MIGRATION_UPLOAD_NOT_FOUND);
  }

  if (upload.status === 'validated') {
    throw new AppError(400, 'ALREADY_VALIDATED', VOCABULARY.MIGRATION_ALREADY_VALIDATED);
  }

  if (upload.status !== 'completed') {
    throw new AppError(400, 'NOT_READY', VOCABULARY.MIGRATION_UPLOAD_NOT_VALIDATED);
  }

  // Load all records for this upload
  const records = await db
    .select()
    .from(migrationRecords)
    .where(
      and(
        eq(migrationRecords.uploadId, uploadId),
        isNull(migrationRecords.deletedAt),
      ),
    )
    .orderBy(asc(migrationRecords.sourceRow));

  if (records.length === 0) {
    throw new AppError(400, 'NO_RECORDS', VOCABULARY.MIGRATION_FILE_NO_DATA);
  }

  // Run multi-MDA detection
  const multiMdaResult = await detectMultiMda(records);

  // Validate all records in memory and tally summary
  const summary: ValidationSummary = {
    clean: 0,
    minorVariance: 0,
    significantVariance: 0,
    structuralError: 0,
    anomalous: 0,
    rateVarianceCount: 0,
  };

  const validationResults: Array<{ id: string; result: RecordValidationResult }> = [];

  for (const record of records) {
    const result = validateRecord(record as MigrationRecordRow);
    validationResults.push({ id: record.id, result });

    switch (result.varianceCategory) {
      case 'clean': summary.clean++; break;
      case 'minor_variance': summary.minorVariance++; break;
      case 'significant_variance': summary.significantVariance++; break;
      case 'structural_error': summary.structuralError++; break;
      case 'anomalous': summary.anomalous++; break;
    }
    if (result.hasRateVariance) summary.rateVarianceCount++;
  }

  // Batch update in a transaction (100 records/batch for efficiency)
  await db.transaction(async (tx) => {
    const BATCH_SIZE = 100;
    for (let i = 0; i < validationResults.length; i += BATCH_SIZE) {
      const batch = validationResults.slice(i, i + BATCH_SIZE);
      const values = sql.join(
        batch.map(({ id, result: r }) =>
          sql`(${id}::uuid, ${r.varianceCategory}::varchar, ${r.varianceAmount}::numeric, ${r.computedRate}::numeric, ${r.hasRateVariance}::boolean, ${r.computedTotalLoan}::numeric, ${r.computedMonthlyDeduction}::numeric, ${r.computedOutstandingBalance}::numeric, ${r.schemeExpectedTotalLoan}::numeric, ${r.schemeExpectedMonthlyDeduction}::numeric, ${r.schemeExpectedTotalInterest}::numeric)`
        ),
        sql`, `,
      );

      await tx.execute(sql`
        UPDATE migration_records AS mr SET
          variance_category = v.vc::variance_category,
          variance_amount = v.va,
          computed_rate = v.cr,
          has_rate_variance = v.hrv,
          computed_total_loan = v.ctl,
          computed_monthly_deduction = v.cmd,
          computed_outstanding_balance = v.cob,
          scheme_expected_total_loan = v.setl,
          scheme_expected_monthly_deduction = v.semd,
          scheme_expected_total_interest = v.seti
        FROM (VALUES ${values}) AS v(id, vc, va, cr, hrv, ctl, cmd, cob, setl, semd, seti)
        WHERE mr.id = v.id
      `);
    }

    // Update upload with validation results
    // Write multi-MDA state into delineationResult (consolidated from legacy hasMultiMda + multiMdaBoundaries)
    const preliminaryDelineation = multiMdaResult.hasMultiMda ? {
      uploadId,
      targetMdaId: upload.mdaId,
      targetMdaName: '',
      delineated: true,
      sections: multiMdaResult.boundaries.map((b) => ({
        startRow: b.startRow,
        endRow: b.endRow,
        mdaName: b.detectedMda,
        resolvedMdaId: null,
        resolvedMdaName: null,
        recordCount: b.recordCount,
        confidence: b.confidence,
      })),
      totalRecords: records.length,
    } : null;

    await tx
      .update(migrationUploads)
      .set({
        status: 'validated',
        validationSummary: summary,
        delineationResult: preliminaryDelineation,
        updatedAt: new Date(),
      })
      .where(eq(migrationUploads.id, uploadId));
  });

  // Fire-and-forget: auto-trigger duplicate detection (after tx commit)
  void trackFireAndForget(deduplicationService.detectCrossFileDuplicates(mdaScope).catch((err) =>
    console.error(`Auto dedup detection failed for upload ${uploadId}:`, err),
  ));

  // Story 15.0m (finding M1): surface within-file duplicate observations BEFORE
  // the user clicks Baseline, so the Observations tab has something to drill
  // into if the guard later blocks. Fire-and-forget — never blocks validation.
  void trackFireAndForget(generateWithinFileDuplicateObservations(uploadId).catch((err) =>
    console.error(`Within-file dedup observation generation failed for upload ${uploadId}:`, err),
  ));

  return summary;
}

// ─── Validation Results Query ───────────────────────────────────────

interface ValidationQueryParams {
  page: number;
  limit: number;
  category?: VarianceCategory;
  sortBy: string;
  sortOrder: string;
}

export async function getValidationResults(
  uploadId: string,
  params: ValidationQueryParams,
  mdaScope?: string | null,
) {
  // Load the upload
  const [upload] = await db
    .select()
    .from(migrationUploads)
    .where(
      and(
        eq(migrationUploads.id, uploadId),
        withMdaScope(migrationUploads.mdaId, mdaScope),
        isNull(migrationUploads.deletedAt),
      ),
    );

  if (!upload) {
    throw new AppError(404, 'UPLOAD_NOT_FOUND', VOCABULARY.MIGRATION_UPLOAD_NOT_FOUND);
  }

  const summary = (upload.validationSummary as ValidationSummary | null) ?? {
    clean: 0, minorVariance: 0, significantVariance: 0,
    structuralError: 0, anomalous: 0, rateVarianceCount: 0,
  };

  // Build query conditions
  const conditions = [
    eq(migrationRecords.uploadId, uploadId),
    isNull(migrationRecords.deletedAt),
  ];

  if (params.category) {
    conditions.push(eq(migrationRecords.varianceCategory, params.category));
  }

  // Count total matching records
  const [{ count: totalStr }] = await db
    .select({ count: sql<string>`count(*)` })
    .from(migrationRecords)
    .where(and(...conditions));

  const total = Number(totalStr);

  // Determine sort column
  const sortColumn =
    params.sortBy === 'staff_name' ? migrationRecords.staffName :
    params.sortBy === 'source_row' ? migrationRecords.sourceRow :
    migrationRecords.varianceAmount;

  const orderFn = params.sortOrder === 'asc' ? asc : desc;

  // Fetch paginated records
  const offset = (params.page - 1) * params.limit;
  const rows = await db
    .select()
    .from(migrationRecords)
    .where(and(...conditions))
    .orderBy(orderFn(sortColumn))
    .limit(params.limit)
    .offset(offset);

  const records: ValidationResultRecord[] = rows.map((r) => {
    // Compute apparent rate as a virtual field from computedRate via tier table
    let apparentRate: string | null = null;
    if (r.computedRate) {
      const inferredTenure = inferTenureFromRate(r.computedRate);
      if (inferredTenure !== null) {
        apparentRate = new Decimal('13.33').mul(inferredTenure).div(60).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
      }
    }

    return {
      recordId: r.id,
      staffName: r.staffName,
      varianceCategory: (r.varianceCategory ?? 'anomalous') as VarianceCategory,
      varianceAmount: r.varianceAmount,
      computedRate: r.computedRate,
      apparentRate,
      declaredValues: {
        principal: r.principal,
        totalLoan: r.totalLoan,
        monthlyDeduction: r.monthlyDeduction,
        outstandingBalance: r.outstandingBalance,
      },
      computedValues: {
        totalLoan: r.computedTotalLoan,
        monthlyDeduction: r.computedMonthlyDeduction,
        outstandingBalance: r.computedOutstandingBalance,
      },
      schemeExpectedValues: {
        totalLoan: r.schemeExpectedTotalLoan ?? null,
        monthlyDeduction: r.schemeExpectedMonthlyDeduction ?? null,
        totalInterest: r.schemeExpectedTotalInterest ?? null,
      },
    };
  });

  return {
    summary,
    records,
    multiMda: (() => {
      const dr = upload.delineationResult as { delineated?: boolean; sections?: Array<{ startRow: number; endRow: number; mdaName: string; resolvedMdaName?: string | null; recordCount: number; confidence: string }> } | null;
      return {
        hasMultiMda: !!dr?.delineated,
        boundaries: (dr?.sections ?? []).map((s) => ({
          startRow: s.startRow,
          endRow: s.endRow,
          detectedMda: s.resolvedMdaName ?? s.mdaName,
          recordCount: s.recordCount,
          confidence: s.confidence,
        })),
      };
    })(),
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.ceil(total / params.limit),
    },
  };
}

// ─── Record Detail (Story 8.0b) ────────────────────────────────────

/**
 * Get full detail for a single migration record including all three vectors.
 */
export async function getRecordDetail(
  recordId: string,
  uploadId: string,
  mdaScope?: string | null,
): Promise<MigrationRecordDetail> {
  // Verify upload exists and is accessible
  const [upload] = await db
    .select()
    .from(migrationUploads)
    .where(
      and(
        eq(migrationUploads.id, uploadId),
        withMdaScope(migrationUploads.mdaId, mdaScope),
        isNull(migrationUploads.deletedAt),
      ),
    );

  if (!upload) {
    throw new AppError(404, 'UPLOAD_NOT_FOUND', VOCABULARY.MIGRATION_UPLOAD_NOT_FOUND);
  }

  // Fetch the specific record
  const [record] = await db
    .select()
    .from(migrationRecords)
    .where(
      and(
        eq(migrationRecords.id, recordId),
        eq(migrationRecords.uploadId, uploadId),
        isNull(migrationRecords.deletedAt),
      ),
    );

  if (!record) {
    throw new AppError(404, 'RECORD_NOT_FOUND', 'The requested migration record was not found.');
  }

  // Fetch MDA code for personKey construction (UAT 2026-04-14)
  const { mdas: mdasTable } = await import('../db/schema');
  const [mdaInfo] = await db.select({ code: mdasTable.code }).from(mdasTable).where(eq(mdasTable.id, record.mdaId));
  const mdaCode = mdaInfo?.code ?? null;

  // Compute apparent rate (virtual field from computedRate via tier table)
  let apparentRate: string | null = null;
  if (record.computedRate) {
    const inferredTenure = inferTenureFromRate(record.computedRate);
    if (inferredTenure !== null) {
      apparentRate = new Decimal('13.33').mul(inferredTenure).div(60).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
    }
  }

  return {
    recordId: record.id,
    uploadId: record.uploadId,
    staffName: record.staffName,
    staffId: record.employeeNo ?? null,
    gradeLevel: record.gradeLevel ?? null,
    station: record.station ?? null,
    mdaText: record.mdaText ?? null,
    mdaCode,
    serialNumber: record.serialNumber ?? null,
    sheetName: record.sheetName,
    sourceRow: record.sourceRow,
    era: record.era,
    periodYear: record.periodYear ?? null,
    periodMonth: record.periodMonth ?? null,
    varianceCategory: (record.varianceCategory ?? 'anomalous') as VarianceCategory,
    varianceAmount: record.varianceAmount ?? null,
    computedRate: record.computedRate ?? null,
    apparentRate,
    hasRateVariance: record.hasRateVariance,
    declaredValues: {
      principal: record.principal ?? null,
      totalLoan: record.totalLoan ?? null,
      monthlyDeduction: record.monthlyDeduction ?? null,
      outstandingBalance: record.outstandingBalance ?? null,
      interestTotal: record.interestTotal ?? null,
      installmentCount: record.installmentCount ?? null,
      installmentsPaid: record.installmentsPaid ?? null,
      installmentsOutstanding: record.installmentsOutstanding ?? null,
    },
    computedValues: {
      totalLoan: record.computedTotalLoan ?? null,
      monthlyDeduction: record.computedMonthlyDeduction ?? null,
      outstandingBalance: record.computedOutstandingBalance ?? null,
    },
    schemeExpectedValues: {
      totalLoan: record.schemeExpectedTotalLoan ?? null,
      monthlyDeduction: record.schemeExpectedMonthlyDeduction ?? null,
      totalInterest: record.schemeExpectedTotalInterest ?? null,
    },
    // Grade inference from principal amount
    inferredGrade: (() => {
      if (!record.principal) return null;
      const tier = inferTierFromPrincipal(record.principal);
      if (!tier) return null;
      return { tier: tier.tier, gradeLevels: tier.gradeLevels, maxPrincipal: tier.maxPrincipal };
    })(),
    isBaselineCreated: record.isBaselineCreated,
    loanId: record.loanId ?? null,
    // Correction fields
    correctedValues: (record.correctedOutstandingBalance ?? record.correctedTotalLoan ?? record.correctedMonthlyDeduction ?? record.correctedInstallmentCount ?? record.correctedInstallmentsPaid ?? record.correctedInstallmentsOutstanding) != null
      ? {
          outstandingBalance: record.correctedOutstandingBalance ?? null,
          totalLoan: record.correctedTotalLoan ?? null,
          monthlyDeduction: record.correctedMonthlyDeduction ?? null,
          installmentCount: record.correctedInstallmentCount ?? null,
          installmentsPaid: record.correctedInstallmentsPaid ?? null,
          installmentsOutstanding: record.correctedInstallmentsOutstanding ?? null,
        }
      : null,
    originalValuesSnapshot: (record.originalValuesSnapshot as Record<string, unknown>) ?? null,
    correctedBy: record.correctedBy ?? null,
    correctedAt: record.correctedAt?.toISOString() ?? null,
    // MDA Review fields (Story 8.0j)
    correctionReason: record.correctionReason ?? null,
    flaggedForReviewAt: record.flaggedForReviewAt?.toISOString() ?? null,
    reviewWindowDeadline: record.reviewWindowDeadline?.toISOString() ?? null,
  };
}

// ─── Record Correction (Story 8.0b) ────────────────────────────────

interface CorrectionInput {
  outstandingBalance?: string;
  totalLoan?: string;
  monthlyDeduction?: string;
  installmentsPaid?: number;
  installmentsOutstanding?: number;
  installmentCount?: number;
  // Required since Story 15.0n — enforced at the validation layer.
  correctionReason: string;
}

/**
 * Apply corrections to a migration record before baseline establishment.
 * Wrapped in a transaction to prevent race conditions with concurrent baseline attempts.
 */
export async function correctRecord(
  recordId: string,
  uploadId: string,
  corrections: CorrectionInput,
  userId: string,
  mdaScope?: string | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  externalTx?: any,
): Promise<MigrationRecordDetail> {
  // Verify upload exists and is accessible (outside transaction — acceptable because the
  // record lock inside the transaction prevents concurrent modification, and FK constraints
  // ensure record integrity if upload is deleted between check and transaction start)
  const queryRunner = externalTx ?? db;
  const [upload] = await queryRunner
    .select()
    .from(migrationUploads)
    .where(
      and(
        eq(migrationUploads.id, uploadId),
        withMdaScope(migrationUploads.mdaId, mdaScope),
        isNull(migrationUploads.deletedAt),
      ),
    );

  if (!upload) {
    throw new AppError(404, 'UPLOAD_NOT_FOUND', VOCABULARY.MIGRATION_UPLOAD_NOT_FOUND);
  }

  // Transaction body — lock, validate, update
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const runCorrection = async (tx: any) => {
    // Lock the record to prevent concurrent modification
    const [record] = await tx
      .select()
      .from(migrationRecords)
      .where(
        and(
          eq(migrationRecords.id, recordId),
          eq(migrationRecords.uploadId, uploadId),
          isNull(migrationRecords.deletedAt),
        ),
      )
      .for('update');

    if (!record) {
      throw new AppError(404, 'RECORD_NOT_FOUND', 'The requested migration record was not found.');
    }

    // Cannot correct an already-baselined record
    if (record.isBaselineCreated) {
      throw new AppError(409, 'RECORD_ALREADY_BASELINED', 'This record already has an established baseline. Corrections can only be made before baseline establishment.');
    }

    // On first correction: snapshot original values (including variance)
    const isFirstCorrection = record.originalValuesSnapshot === null;
    const originalSnapshot = isFirstCorrection
      ? {
          outstandingBalance: record.outstandingBalance,
          totalLoan: record.totalLoan,
          monthlyDeduction: record.monthlyDeduction,
          installmentCount: record.installmentCount,
          installmentsPaid: record.installmentsPaid,
          installmentsOutstanding: record.installmentsOutstanding,
          varianceCategory: record.varianceCategory,
          varianceAmount: record.varianceAmount,
        }
      : undefined;

    // Build update payload
    const updateData: Record<string, unknown> = {
      correctedBy: userId,
      correctedAt: new Date(),
    };

    // correctionReason is required by validation (Story 15.0n) — always set
    updateData.correctionReason = corrections.correctionReason;

    if (isFirstCorrection && originalSnapshot) {
      updateData.originalValuesSnapshot = originalSnapshot;
    }

    if (corrections.outstandingBalance !== undefined) {
      updateData.correctedOutstandingBalance = corrections.outstandingBalance;
    }
    if (corrections.totalLoan !== undefined) {
      updateData.correctedTotalLoan = corrections.totalLoan;
    }
    if (corrections.monthlyDeduction !== undefined) {
      updateData.correctedMonthlyDeduction = corrections.monthlyDeduction;
    }
    if (corrections.installmentCount !== undefined) {
      updateData.correctedInstallmentCount = corrections.installmentCount;
    }
    if (corrections.installmentsPaid !== undefined) {
      updateData.correctedInstallmentsPaid = corrections.installmentsPaid;
    }
    if (corrections.installmentsOutstanding !== undefined) {
      updateData.correctedInstallmentsOutstanding = corrections.installmentsOutstanding;

      // Auto-recompute outstanding balance when installmentsOutstanding is corrected
      // but outstandingBalance is NOT explicitly provided in this correction
      if (corrections.outstandingBalance === undefined) {
        const effectiveMonthly = corrections.monthlyDeduction ?? record.correctedMonthlyDeduction ?? record.monthlyDeduction;
        if (effectiveMonthly) {
          const autoOutstanding = new Decimal(effectiveMonthly).mul(corrections.installmentsOutstanding).toFixed(2);
          updateData.correctedOutstandingBalance = autoOutstanding;
        }
      }
    }

    // Re-compute scheme expected if installmentCount changed
    if (corrections.installmentCount !== undefined && record.principal) {
      try {
        const scheme = computeSchemeExpected(record.principal, corrections.installmentCount);
        updateData.schemeExpectedTotalLoan = scheme.totalLoan;
        updateData.schemeExpectedMonthlyDeduction = scheme.monthlyDeduction;
        updateData.schemeExpectedTotalInterest = scheme.totalInterest;
      } catch {
        // Invalid values for scheme computation — leave existing scheme expected
      }
    }

    // Re-compute variance using corrected values vs scheme expected.
    // Use updateData first (picks up auto-computed values like correctedOutstandingBalance
    // derived from installmentsOutstanding), then fall back to existing corrected/declared values.
    const effectiveOutstanding = (updateData.correctedOutstandingBalance as string | undefined) ?? corrections.outstandingBalance ?? record.correctedOutstandingBalance ?? record.outstandingBalance;
    const effectiveTotalLoan = (updateData.correctedTotalLoan as string | undefined) ?? corrections.totalLoan ?? record.correctedTotalLoan ?? record.totalLoan;
    const effectiveMonthlyDed = (updateData.correctedMonthlyDeduction as string | undefined) ?? corrections.monthlyDeduction ?? record.correctedMonthlyDeduction ?? record.monthlyDeduction;

    // Use updated scheme expected if just recomputed, otherwise existing
    const schemeExpTotalLoan = (updateData.schemeExpectedTotalLoan as string | undefined) ?? record.schemeExpectedTotalLoan;
    const schemeExpMonthlyDed = (updateData.schemeExpectedMonthlyDeduction as string | undefined) ?? record.schemeExpectedMonthlyDeduction;

    const diffs: Decimal[] = [];
    if (schemeExpTotalLoan && effectiveTotalLoan) {
      diffs.push(new Decimal(effectiveTotalLoan).minus(schemeExpTotalLoan).abs());
    } else if (record.computedTotalLoan && effectiveTotalLoan) {
      diffs.push(new Decimal(effectiveTotalLoan).minus(record.computedTotalLoan).abs());
    }
    if (schemeExpMonthlyDed && effectiveMonthlyDed) {
      diffs.push(new Decimal(effectiveMonthlyDed).minus(schemeExpMonthlyDed).abs());
    } else if (record.computedMonthlyDeduction && effectiveMonthlyDed) {
      diffs.push(new Decimal(effectiveMonthlyDed).minus(record.computedMonthlyDeduction).abs());
    }
    if (effectiveOutstanding && record.computedOutstandingBalance) {
      diffs.push(new Decimal(effectiveOutstanding).minus(record.computedOutstandingBalance).abs());
    }

    if (diffs.length > 0) {
      const maxDiff = Decimal.max(...diffs);
      updateData.varianceAmount = maxDiff.toFixed(2);
      updateData.varianceCategory = categoriseByAmount(maxDiff);
    }

    await tx
      .update(migrationRecords)
      .set(updateData)
      .where(eq(migrationRecords.id, recordId));
  };

  // Run within external transaction or create a new one
  if (externalTx) {
    await runCorrection(externalTx);
  } else {
    await db.transaction(runCorrection);
  }

  // Return updated record detail (after transaction commits so db sees changes)
  return getRecordDetail(recordId, uploadId, mdaScope);
}
