import { eq, and, sql, isNull, inArray } from 'drizzle-orm';
import Decimal from 'decimal.js';
import { db } from '../db/index';
import { loans, ledgerEntries, loanStateTransitions, migrationRecords, migrationUploads } from '../db/schema';
import { generateUuidv7 } from '../lib/uuidv7';
import { AppError } from '../lib/appError';
import { withMdaScope } from '../lib/mdaScope';
import { autoSplitDeduction, computeRetirementDate } from './computationEngine';
import { VOCABULARY } from '@vlprs/shared';
import type { BaselineResult, BatchBaselineResult, BaselineSummary, VarianceCategory } from '@vlprs/shared';
import { checkAndTriggerAutoStop } from './autoStopService';

// ─── Types ───────────────────────────────────────────────────────────

interface ActingUser {
  userId: string;
  role: string;
  mdaId: string | null;
}

type MigrationRecordRow = typeof migrationRecords.$inferSelect;
type MigrationUploadRow = typeof migrationUploads.$inferSelect;

// ─── Reference Generation ────────────────────────────────────────────

async function generateMigrationLoanReference(maxRetries = 3): Promise<string> {
  const currentYear = new Date().getFullYear();

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const [result] = await db
      .select({ count: sql<string>`COUNT(*)` })
      .from(loans)
      .where(sql`${loans.loanReference} LIKE ${'VLC-MIG-' + currentYear + '-%'}`);

    const nextNum = parseInt(result.count, 10) + 1 + attempt;
    const padded = String(nextNum).padStart(Math.max(4, String(nextNum).length), '0');
    const reference = `VLC-MIG-${currentYear}-${padded}`;

    const [existing] = await db
      .select({ id: loans.id })
      .from(loans)
      .where(eq(loans.loanReference, reference));

    if (!existing) return reference;
  }

  throw new AppError(500, 'DUPLICATE_LOAN_REFERENCE', VOCABULARY.DUPLICATE_LOAN_REFERENCE);
}

function generateMigrationStaffId(uploadId: string, seq: number): string {
  const shortUploadId = uploadId.replace(/-/g, '').slice(0, 8);
  return `MIG-${shortUploadId}-${String(seq).padStart(4, '0')}`;
}

// ─── Derivation Helpers ──────────────────────────────────────────────

function derivePrincipal(record: MigrationRecordRow, rate: string): string | null {
  const r = new Decimal(rate).div(100);
  const divisor = new Decimal('1').plus(r);

  if (record.totalLoan) {
    return new Decimal(record.totalLoan).div(divisor).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
  }

  if (record.monthlyDeduction && record.installmentCount) {
    const totalLoan = new Decimal(record.monthlyDeduction).mul(record.installmentCount);
    return totalLoan.div(divisor).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
  }

  return null;
}

function inferTenure(record: MigrationRecordRow): number {
  if (record.installmentCount) return record.installmentCount;

  if (record.totalLoan && record.monthlyDeduction) {
    const total = new Decimal(record.totalLoan);
    const monthly = new Decimal(record.monthlyDeduction);
    if (!monthly.isZero()) {
      return Math.ceil(total.div(monthly).toNumber());
    }
  }

  return 60;
}

function buildBaselineSource(
  record: MigrationRecordRow,
  uploadId: string,
): string {
  const category = record.varianceCategory || 'clean';
  const categoryLabel = {
    clean: 'Clean',
    minor_variance: 'Minor Variance',
    significant_variance: 'Significant Variance',
    structural_error: 'Rate Variance',
    anomalous: 'Requires Clarification',
  }[category] || category;

  const varianceAmt = record.varianceAmount
    ? new Decimal(record.varianceAmount).toFixed(2)
    : '0.00';

  const declaredBalance = record.outstandingBalance || '0.00';

  return `Migration baseline | ${categoryLabel} | Variance: \u20A6${formatCurrency(varianceAmt)} | Declared outstanding: \u20A6${formatCurrency(declaredBalance)} | Upload: ${uploadId}`;
}

function formatCurrency(amount: string): string {
  const dec = new Decimal(amount).toFixed(2);
  const [whole, frac] = dec.split('.');
  const formatted = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${formatted}.${frac}`;
}

// ─── Core Baseline Logic ────────────────────────────────────────────

interface DerivedLoanData {
  id: string;
  staffId: string;
  staffName: string;
  gradeLevel: string;
  mdaId: string;
  principalAmount: string;
  interestRate: string;
  tenureMonths: number;
  moratoriumMonths: number;
  monthlyDeductionAmount: string;
  approvalDate: Date;
  firstDeductionDate: Date;
  loanReference: string;
  status: 'ACTIVE';
  dateOfBirth: Date | null;
  dateOfFirstAppointment: Date | null;
  computedRetirementDate: Date | null;
  limitedComputation: boolean;
}

async function deriveLoanFromMigrationRecord(
  record: MigrationRecordRow,
  upload: MigrationUploadRow,
  seq: number,
  loanReferenceOverride?: string,
): Promise<DerivedLoanData> {
  const rate = record.computedRate || '13.330';
  const derivedPrincipal = record.principal || derivePrincipal(record, rate);
  const principalAmount = derivedPrincipal || '0.00';
  const limitedComputation = principalAmount === '0.00';

  // Use corrected installmentCount for tenure inference if available (Story 8.0b)
  const effectiveRecord = record.correctedInstallmentCount != null
    ? { ...record, installmentCount: record.correctedInstallmentCount }
    : record;
  const tenureMonths = inferTenure(effectiveRecord);

  // Monthly deduction: use corrected if available, else declared (Story 8.0b)
  let monthlyDeductionAmount = record.correctedMonthlyDeduction ?? record.monthlyDeduction;
  if (!monthlyDeductionAmount) {
    const p = new Decimal(principalAmount);
    if (p.gt(0) && tenureMonths > 0) {
      const totalInterest = p.mul(new Decimal(rate)).div(100);
      const totalLoan = p.plus(totalInterest);
      monthlyDeductionAmount = totalLoan.div(tenureMonths).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
    } else {
      monthlyDeductionAmount = '0.00';
    }
  }

  const staffId = record.employeeNo || generateMigrationStaffId(upload.id, seq);
  const loanReference = loanReferenceOverride ?? await generateMigrationLoanReference();

  // Parse temporal dates
  let dateOfBirth: Date | null = null;
  let dateOfFirstAppointment: Date | null = null;
  if (record.dateOfBirth) {
    const parsed = new Date(record.dateOfBirth);
    if (!isNaN(parsed.getTime())) dateOfBirth = parsed;
  }
  if (record.dateOfFirstAppointment) {
    const parsed = new Date(record.dateOfFirstAppointment);
    if (!isNaN(parsed.getTime())) dateOfFirstAppointment = parsed;
  }

  // Compute retirement date if both temporal dates available
  let computedRetirementDate: Date | null = null;
  if (dateOfBirth && dateOfFirstAppointment && dateOfBirth < new Date() && dateOfFirstAppointment >= dateOfBirth) {
    try {
      const { retirementDate } = computeRetirementDate(dateOfBirth, dateOfFirstAppointment);
      computedRetirementDate = retirementDate;
    } catch {
      // Swallow — temporal dates may be invalid for migration records
    }
  }

  // First deduction date: earliest period from records or upload creation date
  let firstDeductionDate = upload.createdAt;
  if (record.periodYear && record.periodMonth) {
    firstDeductionDate = new Date(record.periodYear, record.periodMonth - 1, 1);
  }

  return {
    id: generateUuidv7(),
    staffId,
    staffName: record.staffName,
    gradeLevel: 'MIGRATION',
    mdaId: upload.mdaId,
    principalAmount,
    interestRate: rate,
    tenureMonths,
    moratoriumMonths: 0,
    monthlyDeductionAmount,
    approvalDate: upload.createdAt,
    firstDeductionDate,
    loanReference,
    status: 'ACTIVE',
    dateOfBirth,
    dateOfFirstAppointment,
    computedRetirementDate,
    limitedComputation,
  };
}

// ─── Baseline Eligibility Guard (Story 8.0b) ──────────────────────

interface EligibilityResult {
  eligible: boolean;
  reason?: string;
  code?: string;
}

/**
 * Validate that a record is eligible for baseline creation.
 * Uses effective values (corrected if available, else declared).
 */
export function validateBaselineEligibility(record: MigrationRecordRow): EligibilityResult {
  const effectiveOutstanding = record.correctedOutstandingBalance ?? record.outstandingBalance;
  // Use scheme expected total loan (most authoritative), fallback to computed, then declared
  const referenceTotalLoan = record.schemeExpectedTotalLoan ?? record.computedTotalLoan ?? record.totalLoan;

  if (effectiveOutstanding === null) {
    return { eligible: false, reason: 'Missing outstanding balance — cannot establish baseline.', code: 'BASELINE_MISSING_BALANCE' };
  }

  if (referenceTotalLoan === null) {
    return { eligible: true }; // No total loan to compare — allow (guard is specifically for outstanding > total)
  }

  const outstanding = new Decimal(effectiveOutstanding);
  const totalLoan = new Decimal(referenceTotalLoan);

  if (outstanding.greaterThan(totalLoan)) {
    return {
      eligible: false,
      reason: `The outstanding balance (\u20A6${outstanding.toFixed(2)}) exceeds the total loan (\u20A6${totalLoan.toFixed(2)}). Please review and correct this value before establishing the baseline.`,
      code: 'BASELINE_BALANCE_EXCEEDS_LOAN',
    };
  }

  return { eligible: true };
}

function computeBaselineEntry(
  loanData: DerivedLoanData,
  record: MigrationRecordRow,
  uploadId: string,
  actingUserId: string,
) {
  const principal = new Decimal(loanData.principalAmount);
  const rate = new Decimal(loanData.interestRate);
  const totalInterest = principal.mul(rate).div(100);
  const totalLoan = principal.plus(totalInterest);

  // Use corrected outstanding balance if available, else declared (Story 8.0b)
  const effectiveOutstandingBalance = record.correctedOutstandingBalance ?? record.outstandingBalance;
  if (!effectiveOutstandingBalance) {
    return null; // Cannot create baseline without outstanding balance
  }

  const baselineAmount = totalLoan.minus(new Decimal(effectiveOutstandingBalance));

  // Principal/interest split
  let principalComponent: string;
  let interestComponent: string;

  if (principal.gt(0) && !principal.eq(new Decimal('0.00'))) {
    try {
      const split = autoSplitDeduction(baselineAmount.toFixed(2), {
        principalAmount: loanData.principalAmount,
        interestRate: loanData.interestRate,
        tenureMonths: loanData.tenureMonths,
        moratoriumMonths: 0,
      });
      principalComponent = split.principalComponent;
      interestComponent = split.interestComponent;
    } catch {
      // Cannot split — assign full amount to principal
      principalComponent = baselineAmount.toFixed(2);
      interestComponent = '0.00';
    }
  } else {
    principalComponent = baselineAmount.toFixed(2);
    interestComponent = '0.00';
  }

  const source = buildBaselineSource(record, uploadId);

  return {
    id: generateUuidv7(),
    loanId: loanData.id,
    staffId: loanData.staffId,
    mdaId: loanData.mdaId,
    entryType: 'MIGRATION_BASELINE' as const,
    amount: baselineAmount.toFixed(2),
    principalComponent,
    interestComponent,
    periodMonth: record.periodMonth || new Date().getMonth() + 1,
    periodYear: record.periodYear || new Date().getFullYear(),
    source,
    payrollBatchReference: uploadId,
    postedBy: actingUserId,
  };
}

// ─── Service Functions ──────────────────────────────────────────────

export async function createBaseline(
  actingUser: ActingUser,
  uploadId: string,
  recordId: string,
  mdaScope: string | null | undefined,
): Promise<BaselineResult> {
  // Load the upload
  const uploadConditions = [eq(migrationUploads.id, uploadId)];
  const uploadScope = withMdaScope(migrationUploads.mdaId, mdaScope);
  if (uploadScope) uploadConditions.push(uploadScope);

  const [upload] = await db
    .select()
    .from(migrationUploads)
    .where(and(...uploadConditions));

  if (!upload) {
    throw new AppError(404, 'MIGRATION_UPLOAD_NOT_FOUND', VOCABULARY.MIGRATION_UPLOAD_NOT_FOUND);
  }

  if (upload.status !== 'validated' && upload.status !== 'reconciled') {
    throw new AppError(400, 'BASELINE_UPLOAD_NOT_VALIDATED', VOCABULARY.BASELINE_UPLOAD_NOT_VALIDATED);
  }

  const result = await db.transaction(async (tx) => {
    // Load the record with row lock
    const [record] = await tx
      .select()
      .from(migrationRecords)
      .where(and(eq(migrationRecords.id, recordId), eq(migrationRecords.uploadId, uploadId)))
      .for('update');

    if (!record) {
      throw new AppError(404, 'BASELINE_RECORD_NOT_FOUND', VOCABULARY.BASELINE_RECORD_NOT_FOUND);
    }

    if (record.isBaselineCreated) {
      throw new AppError(409, 'BASELINE_ALREADY_EXISTS', VOCABULARY.BASELINE_ALREADY_EXISTS);
    }

    // Validate baseline eligibility (Story 8.0b guard)
    const eligibility = validateBaselineEligibility(record);
    if (!eligibility.eligible) {
      const statusCode = eligibility.code === 'BASELINE_BALANCE_EXCEEDS_LOAN' ? 422 : 400;
      throw new AppError(statusCode, eligibility.code ?? 'BASELINE_MISSING_BALANCE', eligibility.reason!);
    }

    // Derive loan data
    const loanData = await deriveLoanFromMigrationRecord(record, upload, 1);

    // Insert loan record directly as ACTIVE
    await tx.insert(loans).values(loanData);

    // Insert state transition audit entry
    await tx.insert(loanStateTransitions).values({
      id: generateUuidv7(),
      loanId: loanData.id,
      fromStatus: 'APPLIED',
      toStatus: 'ACTIVE',
      transitionedBy: actingUser.userId,
      reason: 'Migration baseline — legacy data imported as active loan',
    });

    // Compute and insert baseline ledger entry
    const entryData = computeBaselineEntry(loanData, record, uploadId, actingUser.userId);
    if (!entryData) {
      throw new AppError(400, 'BASELINE_MISSING_BALANCE', VOCABULARY.BASELINE_MISSING_BALANCE);
    }

    const [entry] = await tx.insert(ledgerEntries).values(entryData).returning();

    // Link migration record to loan
    await tx
      .update(migrationRecords)
      .set({ loanId: loanData.id, isBaselineCreated: true })
      .where(eq(migrationRecords.id, recordId));

    // Check if all records in upload now have baselines — advance to 'reconciled'
    const [remaining] = await tx
      .select({ count: sql<string>`COUNT(*)` })
      .from(migrationRecords)
      .where(
        and(
          eq(migrationRecords.uploadId, uploadId),
          eq(migrationRecords.isBaselineCreated, false),
        ),
      );
    if (parseInt(remaining.count, 10) === 0) {
      await tx
        .update(migrationUploads)
        .set({ status: 'reconciled', updatedAt: new Date() })
        .where(eq(migrationUploads.id, uploadId));
    }

    return {
      loanId: loanData.id,
      loanReference: loanData.loanReference,
      ledgerEntryId: entry.id,
      varianceCategory: record.varianceCategory as VarianceCategory | null,
      baselineAmount: entryData.amount,
      correctionApplied: record.correctedOutstandingBalance != null
        || record.correctedTotalLoan != null
        || record.correctedMonthlyDeduction != null
        || record.correctedInstallmentCount != null,
    };
  });

  // Story 8.1: Check for auto-stop AFTER transaction commits (balance now visible)
  checkAndTriggerAutoStop(result.loanId, result.ledgerEntryId).catch(() => {});

  return result;
}

export async function createBatchBaseline(
  actingUser: ActingUser,
  uploadId: string,
  mdaScope: string | null | undefined,
): Promise<BatchBaselineResult> {
  const startTime = Date.now();

  // Load the upload
  const uploadConditions = [eq(migrationUploads.id, uploadId)];
  const uploadScope = withMdaScope(migrationUploads.mdaId, mdaScope);
  if (uploadScope) uploadConditions.push(uploadScope);

  const [upload] = await db
    .select()
    .from(migrationUploads)
    .where(and(...uploadConditions));

  if (!upload) {
    throw new AppError(404, 'MIGRATION_UPLOAD_NOT_FOUND', VOCABULARY.MIGRATION_UPLOAD_NOT_FOUND);
  }

  if (upload.status !== 'validated' && upload.status !== 'reconciled') {
    throw new AppError(400, 'BASELINE_UPLOAD_NOT_VALIDATED', VOCABULARY.BASELINE_UPLOAD_NOT_VALIDATED);
  }

  // Story 8.1: Track created loans + ledger entries for post-commit auto-stop check
  const createdEntries: Array<{ loanId: string; ledgerEntryId: string }> = [];

  const result = await db.transaction(async (tx) => {
    // Load all records that haven't had baselines created yet and aren't flagged for review
    const records = await tx
      .select()
      .from(migrationRecords)
      .where(
        and(
          eq(migrationRecords.uploadId, uploadId),
          eq(migrationRecords.isBaselineCreated, false),
          isNull(migrationRecords.flaggedForReviewAt),
        ),
      )
      .for('update');

    if (records.length === 0) {
      return {
        totalProcessed: 0,
        loansCreated: 0,
        entriesCreated: 0,
        byCategory: {} as Record<string, number>,
        skippedRecords: [],
        processingTimeMs: Date.now() - startTime,
        autoBaselined: { count: 0, byCategory: {} },
        flaggedForReview: { count: 0, byCategory: {} },
      };
    }

    // Partition by variance category: auto-baseline clean/minor, flag significant+ for MDA review
    const autoBaselineCategories = new Set(['clean', 'minor_variance']);
    const autoBaselineRecords: typeof records = [];
    const flagForReviewRecords: typeof records = [];

    for (const record of records) {
      const cat = record.varianceCategory || null;
      if (cat && autoBaselineCategories.has(cat)) {
        autoBaselineRecords.push(record);
      } else {
        // significant_variance, structural_error, anomalous, or null → flag for review
        flagForReviewRecords.push(record);
      }
    }

    // Flag significant+ records for MDA review
    const flaggedByCategory: Record<string, number> = {};
    if (flagForReviewRecords.length > 0) {
      const now = new Date();
      const deadline = new Date(now);
      deadline.setDate(deadline.getDate() + 14);

      const flagIds = flagForReviewRecords.map(r => r.id);
      await tx
        .update(migrationRecords)
        .set({
          flaggedForReviewAt: now,
          reviewWindowDeadline: deadline,
        })
        .where(inArray(migrationRecords.id, flagIds));

      for (const record of flagForReviewRecords) {
        const cat = record.varianceCategory || 'anomalous';
        flaggedByCategory[cat] = (flaggedByCategory[cat] || 0) + 1;
      }
    }

    // Pre-validate auto-baseline records: check each record's baseline eligibility (skip ineligible, don't block batch)
    const eligibleRecords: typeof records = [];
    const skippedRecords: Array<{ recordId: string; staffName: string; reason: string }> = [];

    for (const record of autoBaselineRecords) {
      const eligibility = validateBaselineEligibility(record);
      if (eligibility.eligible) {
        eligibleRecords.push(record);
      } else {
        skippedRecords.push({
          recordId: record.id,
          staffName: record.staffName,
          reason: eligibility.reason ?? 'Ineligible for baseline',
        });
      }
    }

    if (eligibleRecords.length === 0) {
      return {
        totalProcessed: 0,
        loansCreated: 0,
        entriesCreated: 0,
        byCategory: {} as Record<string, number>,
        skippedRecords,
        processingTimeMs: Date.now() - startTime,
        autoBaselined: { count: 0, byCategory: {} },
        flaggedForReview: { count: flagForReviewRecords.length, byCategory: flaggedByCategory },
      };
    }

    // Pre-generate sequential loan references inside transaction to avoid duplicates
    const currentYear = new Date().getFullYear();
    const [refCountResult] = await tx
      .select({ count: sql<string>`COUNT(*)` })
      .from(loans)
      .where(sql`${loans.loanReference} LIKE ${'VLC-MIG-' + currentYear + '-%'}`);
    const refStartSeq = parseInt(refCountResult.count, 10) + 1;

    let loansCreated = 0;
    let entriesCreated = 0;
    const byCategory: Record<string, number> = {};

    for (let i = 0; i < eligibleRecords.length; i++) {
      const record = eligibleRecords[i];

      // Generate loan reference from pre-computed sequence
      const refSeq = refStartSeq + i;
      const loanRef = `VLC-MIG-${currentYear}-${String(refSeq).padStart(Math.max(4, String(refSeq).length), '0')}`;

      // Derive loan data with pre-generated reference
      const loanData = await deriveLoanFromMigrationRecord(record, upload, i + 1, loanRef);

      // Insert loan
      await tx.insert(loans).values(loanData);
      loansCreated++;

      // Insert state transition
      await tx.insert(loanStateTransitions).values({
        id: generateUuidv7(),
        loanId: loanData.id,
        fromStatus: 'APPLIED',
        toStatus: 'ACTIVE',
        transitionedBy: actingUser.userId,
        reason: 'Migration baseline — legacy data imported as active loan',
      });

      // Compute and insert baseline ledger entry (pre-validated: outstandingBalance is present)
      const entryData = computeBaselineEntry(loanData, record, uploadId, actingUser.userId)!;
      await tx.insert(ledgerEntries).values(entryData);
      entriesCreated++;
      createdEntries.push({ loanId: loanData.id, ledgerEntryId: entryData.id });

      // Link record
      await tx
        .update(migrationRecords)
        .set({ loanId: loanData.id, isBaselineCreated: true })
        .where(eq(migrationRecords.id, record.id));

      // Track category
      const cat = record.varianceCategory || 'clean';
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    }

    // Check if ALL records (including skipped) are now processed or skipped
    const [remainingCount] = await tx
      .select({ count: sql<string>`COUNT(*)` })
      .from(migrationRecords)
      .where(
        and(
          eq(migrationRecords.uploadId, uploadId),
          eq(migrationRecords.isBaselineCreated, false),
        ),
      );

    // Only advance to reconciled if NO unprocessed records remain
    // (skipped + flagged-for-review records are still un-baselined)
    if (parseInt(remainingCount.count, 10) === 0) {
      await tx
        .update(migrationUploads)
        .set({ status: 'reconciled', updatedAt: new Date() })
        .where(eq(migrationUploads.id, uploadId));
    }

    return {
      totalProcessed: eligibleRecords.length,
      loansCreated,
      entriesCreated,
      byCategory,
      skippedRecords,
      processingTimeMs: Date.now() - startTime,
      autoBaselined: { count: eligibleRecords.length, byCategory },
      flaggedForReview: { count: flagForReviewRecords.length, byCategory: flaggedByCategory },
    };
  });

  // Story 8.1: Check auto-stop AFTER transaction commits (sequential to limit DB load)
  void (async () => {
    for (const { loanId, ledgerEntryId } of createdEntries) {
      await checkAndTriggerAutoStop(loanId, ledgerEntryId).catch(() => {});
    }
  })();

  return result;
}

export async function getBaselineSummary(
  uploadId: string,
  mdaScope: string | null | undefined,
): Promise<BaselineSummary> {
  const uploadConditions = [eq(migrationUploads.id, uploadId)];
  const uploadScope = withMdaScope(migrationUploads.mdaId, mdaScope);
  if (uploadScope) uploadConditions.push(uploadScope);

  const [upload] = await db
    .select()
    .from(migrationUploads)
    .where(and(...uploadConditions));

  if (!upload) {
    throw new AppError(404, 'MIGRATION_UPLOAD_NOT_FOUND', VOCABULARY.MIGRATION_UPLOAD_NOT_FOUND);
  }

  // Count total and baseline-created records
  const [totalResult] = await db
    .select({ count: sql<string>`COUNT(*)` })
    .from(migrationRecords)
    .where(eq(migrationRecords.uploadId, uploadId));

  const [createdResult] = await db
    .select({ count: sql<string>`COUNT(*)` })
    .from(migrationRecords)
    .where(
      and(
        eq(migrationRecords.uploadId, uploadId),
        eq(migrationRecords.isBaselineCreated, true),
      ),
    );

  // Category breakdown of created baselines
  const categoryResults = await db
    .select({
      category: migrationRecords.varianceCategory,
      count: sql<string>`COUNT(*)`,
    })
    .from(migrationRecords)
    .where(
      and(
        eq(migrationRecords.uploadId, uploadId),
        eq(migrationRecords.isBaselineCreated, true),
      ),
    )
    .groupBy(migrationRecords.varianceCategory);

  const totalRecords = parseInt(totalResult.count, 10);
  const baselinesCreated = parseInt(createdResult.count, 10);
  const baselinesRemaining = totalRecords - baselinesCreated;

  const byCategory: Record<string, number> = {};
  for (const row of categoryResults) {
    byCategory[row.category || 'clean'] = parseInt(row.count, 10);
  }

  let status: 'pending' | 'partial' | 'complete';
  if (baselinesCreated === 0) status = 'pending';
  else if (baselinesRemaining === 0) status = 'complete';
  else status = 'partial';

  return {
    uploadId,
    totalRecords,
    baselinesCreated,
    baselinesRemaining,
    byCategory,
    status,
  };
}
