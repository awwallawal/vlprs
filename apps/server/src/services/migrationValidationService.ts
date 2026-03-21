import Decimal from 'decimal.js';
import { eq, and, isNull, desc, asc, sql } from 'drizzle-orm';
import { db } from '../db/index';
import { migrationUploads, migrationRecords } from '../db/schema';
import { AppError } from '../lib/appError';
import { withMdaScope } from '../lib/mdaScope';
import { VOCABULARY } from '@vlprs/shared';
import type { VarianceCategory, ValidationSummary, ValidationResultRecord } from '@vlprs/shared';
import { computeRepaymentSchedule } from './computationEngine';
import { detectMultiMda } from '../migration/mdaDelineation';

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
 * Validate a single migration record: compute rate, compare values, categorise variance.
 */
export function validateRecord(record: MigrationRecordRow): RecordValidationResult {
  const { principal, totalLoan, monthlyDeduction, outstandingBalance } = record;

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
    };
  }

  // Step 1: Compute effective rate if possible
  const computedRate = computeEffectiveRate(principal, totalLoan);
  const hasRateVariance = computedRate !== null && !isStandardRate(computedRate);

  // Step 2: Detect structural error (unknown rate tier) — flag but don't short-circuit
  // so computed values are still available for admin comparison
  const isStructuralError = computedRate !== null && hasRateVariance && !matchesKnownTier(computedRate);

  // Step 3: Determine rate to use for computation
  // For structural errors, still use the detected rate to provide comparison data
  const rateForComputation = computedRate !== null && hasRateVariance
    ? computedRate
    : STANDARD_RATE.toString();

  // Step 4: Infer tenure
  const tenure = inferTenure(record);

  // Step 5: If we can compute, use the computation engine
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

      // Compare declared vs computed — use largest absolute difference
      const diffs: Decimal[] = [];

      if (totalLoan) {
        diffs.push(new Decimal(totalLoan).minus(computedTotalLoan).abs());
      }
      if (monthlyDeduction) {
        diffs.push(new Decimal(monthlyDeduction).minus(computedMonthlyDed).abs());
      }
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
      };
    } catch {
      // If computation engine throws (e.g. invalid params), mark appropriately
      return {
        varianceCategory: isStructuralError ? 'structural_error' : 'anomalous',
        varianceAmount: '0.00',
        computedRate,
        hasRateVariance: isStructuralError || hasRateVariance,
        computedTotalLoan: null,
        computedMonthlyDeduction: null,
        computedOutstandingBalance: null,
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
          sql`(${id}::uuid, ${r.varianceCategory}::varchar, ${r.varianceAmount}::numeric, ${r.computedRate}::numeric, ${r.hasRateVariance}::boolean, ${r.computedTotalLoan}::numeric, ${r.computedMonthlyDeduction}::numeric, ${r.computedOutstandingBalance}::numeric)`
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
          computed_outstanding_balance = v.cob
        FROM (VALUES ${values}) AS v(id, vc, va, cr, hrv, ctl, cmd, cob)
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

  const records: ValidationResultRecord[] = rows.map((r) => ({
    recordId: r.id,
    staffName: r.staffName,
    varianceCategory: (r.varianceCategory ?? 'anomalous') as VarianceCategory,
    varianceAmount: r.varianceAmount,
    computedRate: r.computedRate,
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
  }));

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
