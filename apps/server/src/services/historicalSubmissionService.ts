import Decimal from 'decimal.js';
import { eq, and, inArray, sql, desc, ne } from 'drizzle-orm';
import { db } from '../db/index';
import { mdaSubmissions, submissionRows, loans, mdas } from '../db/schema';
import { AppError } from '../lib/appError';
import { generateUuidv7 } from '../lib/uuidv7';
import { parseSubmissionCsv, validateSubmissionRows, validateMdaCodes, validateStaffIds } from './submissionService';
import { sendHistoricalUploadConfirmation, sendHistoricalVarianceAlert } from '../lib/email';
import { VOCABULARY } from '@vlprs/shared';
import { MINOR_VARIANCE_THRESHOLD } from './comparisonEngine';
import type {
  SubmissionValidationError,
  EventFlagType,
  HistoricalReconciliationSummary,
  HistoricalReconciliationDetail,
  HistoricalMatchStatus,
  HistoricalUploadResponse,
  FlaggedRow,
} from '@vlprs/shared';

// ─── Period Validation (Historical — INVERSE of Story 5.1 checkPeriodLock) ──

/**
 * Validates that all rows reference past months only.
 * Rejects future months and current month.
 * Also rejects rows where a confirmed non-historical submission already exists
 * for that staff+month combo.
 * Does NOT short-circuit — collects all errors.
 */
export async function validateHistoricalPeriods(
  rows: Array<{ rowIndex: number; staffId: string; month: string }>,
  mdaId: string,
): Promise<SubmissionValidationError[]> {
  const errors: SubmissionValidationError[] = [];

  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;
  const currentPeriodNum = currentYear * 12 + currentMonth;

  // 1. Check for future or current-period months
  for (const row of rows) {
    const [yearStr, monthStr] = row.month.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const rowPeriodNum = year * 12 + month;

    if (rowPeriodNum >= currentPeriodNum) {
      const isFuture = rowPeriodNum > currentPeriodNum;
      errors.push({
        row: row.rowIndex,
        field: 'month',
        message: isFuture
          ? VOCABULARY.HISTORICAL_PERIOD_FUTURE
              .replace('{row}', String(row.rowIndex + 1))
              .replace('{month}', row.month)
          : VOCABULARY.HISTORICAL_PERIOD_IS_CURRENT
              .replace('{row}', String(row.rowIndex + 1))
              .replace('{month}', row.month),
      });
    }
  }

  // 2. Check for existing confirmed non-historical submissions for same staff+month
  const uniqueStaffIds = [...new Set(rows.map((r) => r.staffId))];
  const uniqueMonths = [...new Set(rows.map((r) => r.month))];

  if (uniqueStaffIds.length > 0 && uniqueMonths.length > 0) {
    const existingRows = await db.select({
      staffId: submissionRows.staffId,
      month: submissionRows.month,
    })
      .from(submissionRows)
      .innerJoin(mdaSubmissions, eq(submissionRows.submissionId, mdaSubmissions.id))
      .where(and(
        eq(mdaSubmissions.mdaId, mdaId),
        eq(mdaSubmissions.status, 'confirmed'),
        ne(mdaSubmissions.source, 'historical'),
        inArray(submissionRows.staffId, uniqueStaffIds),
        inArray(submissionRows.month, uniqueMonths),
      ));

    const existingSet = new Set(existingRows.map((r) => `${r.staffId}::${r.month}`));

    for (const row of rows) {
      const key = `${row.staffId}::${row.month}`;
      if (existingSet.has(key)) {
        errors.push({
          row: row.rowIndex,
          field: 'month',
          message: VOCABULARY.HISTORICAL_PERIOD_CURRENT_EXISTS
            .replace('{row}', String(row.rowIndex + 1))
            .replace('{month}', row.month),
        });
      }
    }
  }

  return errors;
}

// ─── Cross-Validation Against Baseline ────────────────────────────────

export async function crossValidateAgainstBaseline(
  rows: Array<{ staffId: string; amountDeducted: string }>,
  mdaId: string,
): Promise<HistoricalReconciliationSummary> {
  const uniqueStaffIds = [...new Set(rows.map((r) => r.staffId))];

  // Batch query: get all loans for this MDA matching uploaded staff IDs
  const baselineLoans = await db.select({
    staffId: loans.staffId,
    monthlyDeductionAmount: loans.monthlyDeductionAmount,
    staffName: sql<string>`COALESCE(${loans.staffName}, 'Unknown')`.as('staff_name'),
  })
    .from(loans)
    .where(and(
      eq(loans.mdaId, mdaId),
      inArray(loans.staffId, uniqueStaffIds),
    ));

  // No baseline scenario (AC 9)
  if (baselineLoans.length === 0) {
    return {
      matchedCount: 0,
      varianceCount: 0,
      largestVarianceAmount: '0',
      matchRate: 0,
      noBaseline: true,
      flaggedRows: [],
      details: [],
    };
  }

  // Build lookup Map — sum monthlyDeductionAmount per staffId (handles multi-loan staff)
  const baselineMap = new Map<string, { totalBaseline: Decimal; staffName: string }>();
  for (const loan of baselineLoans) {
    const existing = baselineMap.get(loan.staffId);
    const amount = new Decimal(loan.monthlyDeductionAmount ?? '0');
    if (existing) {
      existing.totalBaseline = existing.totalBaseline.plus(amount);
    } else {
      baselineMap.set(loan.staffId, { totalBaseline: amount, staffName: loan.staffName });
    }
  }

  let matchedCount = 0;
  let varianceCount = 0;
  let largestVariance = new Decimal('0');
  const details: HistoricalReconciliationDetail[] = [];

  for (const row of rows) {
    const baseline = baselineMap.get(row.staffId);
    if (!baseline) {
      // Staff not in baseline — skip (they passed validateStaffIds, so they have a loan record)
      continue;
    }

    const declared = new Decimal(row.amountDeducted.replace(/,/g, ''));
    const baselineAmount = baseline.totalBaseline;
    const difference = declared.minus(baselineAmount).abs();

    let matchStatus: HistoricalMatchStatus;
    if (difference.lessThan(MINOR_VARIANCE_THRESHOLD)) {
      matchStatus = 'matched';
      matchedCount++;
    } else {
      matchStatus = 'variance';
      varianceCount++;
      if (difference.greaterThan(largestVariance)) {
        largestVariance = difference;
      }
    }

    details.push({
      staffId: row.staffId,
      staffName: baseline.staffName,
      declaredAmount: declared.toFixed(2),
      baselineAmount: baselineAmount.toFixed(2),
      variance: declared.minus(baselineAmount).toFixed(2),
      matchStatus,
      flagged: false,
      flagReason: null,
    });
  }

  const totalRecords = matchedCount + varianceCount;
  const matchRate = totalRecords > 0 ? Number(((matchedCount / totalRecords) * 100).toFixed(1)) : 0;

  return {
    matchedCount,
    varianceCount,
    largestVarianceAmount: largestVariance.toFixed(2),
    matchRate,
    noBaseline: false,
    flaggedRows: [],
    details,
  };
}

// ─── Process Historical Upload ────────────────────────────────────────

export async function processHistoricalUpload(
  buffer: Buffer,
  mdaScope: string | null,
  userId: string,
  fileInfo?: { filename: string; fileSizeBytes: number },
): Promise<HistoricalUploadResponse> {
  // 1. Parse CSV (reuse from Story 5.1)
  const csvRows = parseSubmissionCsv(buffer);

  // 2. Row limit validation (AC 7) — fail fast
  if (csvRows.length > 100) {
    throw new AppError(400, 'HISTORICAL_ROW_LIMIT_EXCEEDED', VOCABULARY.HISTORICAL_ROW_LIMIT_EXCEEDED);
  }

  // Convert to indexed rows for validation pipeline
  const rows = csvRows.map(({ rowNumber: _rn, ...rest }, idx) => ({
    rowIndex: idx,
    ...rest,
  }));

  const allErrors: SubmissionValidationError[] = [];

  // 3. Validate row data (schema + intra-file duplicates)
  const { errors: rowErrors } = validateSubmissionRows(rows);
  allErrors.push(...rowErrors);

  // 4. Validate MDA codes & resolve MDA ID
  const { mdaId, errors: mdaErrors } = await validateMdaCodes(rows, mdaScope);
  allErrors.push(...mdaErrors);

  // Reject early before DB lookups if structural errors
  if (allErrors.length > 0) {
    throw new AppError(422, 'SUBMISSION_VALIDATION_FAILED', VOCABULARY.SUBMISSION_NEEDS_ATTENTION, allErrors);
  }

  // 5. Single-period constraint — all rows must share the same month
  const periods = [...new Set(rows.map((r) => r.month))];
  if (periods.length > 1) {
    for (const row of rows) {
      if (row.month !== rows[0].month) {
        allErrors.push({
          row: row.rowIndex,
          field: 'month',
          message: VOCABULARY.HISTORICAL_DUPLICATE_PERIOD
            .replace('{row}', String(row.rowIndex + 1))
            .replace('{month}', row.month)
            .replace('{period}', rows[0].month),
        });
      }
    }
    throw new AppError(422, 'SUBMISSION_VALIDATION_FAILED', VOCABULARY.SUBMISSION_NEEDS_ATTENTION, allErrors);
  }

  const period = periods[0];

  // 6. Validate staff IDs exist in MDA's loan portfolio (AC 8)
  const staffErrors = await validateStaffIds(rows, mdaId);
  allErrors.push(...staffErrors);

  // 7. Historical period validation (AC 2) — past months only, no current-period confirmed submissions
  const periodErrors = await validateHistoricalPeriods(rows, mdaId);
  allErrors.push(...periodErrors);

  // Reject if any DB-level validation errors (AC 6 — atomic, all-or-nothing)
  if (allErrors.length > 0) {
    throw new AppError(422, 'SUBMISSION_VALIDATION_FAILED', VOCABULARY.SUBMISSION_NEEDS_ATTENTION, allErrors);
  }

  // 8. Cross-validate against migration baseline (AC 4)
  const reconciliation = await crossValidateAgainstBaseline(
    rows.map((r) => ({ staffId: r.staffId, amountDeducted: r.amountDeducted })),
    mdaId,
  );

  // 9. Atomic persistence (AC 6) — submission + rows + reconciliation summary
  const submissionId = generateUuidv7();
  const now = new Date();

  const referenceNumber = await db.transaction(async (tx) => {
    // Generate reference number INSIDE transaction
    const refResult = await tx.select({ referenceNumber: mdaSubmissions.referenceNumber })
      .from(mdaSubmissions)
      .where(sql`${mdaSubmissions.referenceNumber} LIKE ${'BIR-' + period + '-%'}`)
      .orderBy(desc(mdaSubmissions.referenceNumber))
      .limit(1);

    let nextSeq = 1;
    if (refResult.length > 0) {
      const lastRef = refResult[0].referenceNumber;
      const seqPart = lastRef.split('-').pop();
      if (seqPart) {
        nextSeq = parseInt(seqPart, 10) + 1;
      }
    }
    const refNumber = `BIR-${period}-${String(nextSeq).padStart(4, '0')}`;

    // Store reconciliation summary (without details for storage — details are recomputed live)
    const storedReconciliation = {
      matchedCount: reconciliation.matchedCount,
      varianceCount: reconciliation.varianceCount,
      largestVarianceAmount: reconciliation.largestVarianceAmount,
      matchRate: reconciliation.matchRate,
      noBaseline: reconciliation.noBaseline,
      flaggedRows: [] as FlaggedRow[],
    };

    await tx.insert(mdaSubmissions).values({
      id: submissionId,
      mdaId,
      uploadedBy: userId,
      period,
      referenceNumber: refNumber,
      status: 'confirmed',
      recordCount: rows.length,
      source: 'historical',
      filename: fileInfo?.filename ?? null,
      fileSizeBytes: fileInfo?.fileSizeBytes ?? null,
      historicalReconciliation: storedReconciliation,
      createdAt: now,
      updatedAt: now,
    });

    const rowValues = rows.map((row) => ({
      id: generateUuidv7(),
      submissionId,
      rowNumber: row.rowIndex + 1,
      staffId: row.staffId,
      month: row.month,
      amountDeducted: row.amountDeducted.replace(/,/g, ''),
      payrollBatchReference: row.payrollBatchReference,
      mdaCode: row.mdaCode,
      eventFlag: row.eventFlag as EventFlagType,
      eventDate: row.eventDate ? new Date(row.eventDate) : null,
      cessationReason: row.cessationReason,
      createdAt: now,
    }));

    await tx.insert(submissionRows).values(rowValues);

    return refNumber;
  });

  // 10. Fire-and-forget email notifications (OUTSIDE transaction)
  // Resolve MDA name for email content
  db.select({ name: mdas.name }).from(mdas).where(eq(mdas.id, mdaId)).limit(1)
    .then((mdaRows) => {
      const mdaName = mdaRows[0]?.name ?? 'Unknown MDA';
      // Confirmation email to uploading officer
      sendHistoricalUploadConfirmation({
        referenceNumber,
        period,
        recordCount: rows.length,
        matchRate: reconciliation.matchRate,
      }).catch(() => { /* fire-and-forget */ });

      // Variance alert to Dept Admin if variances exist
      if (reconciliation.varianceCount > 0) {
        sendHistoricalVarianceAlert({
          mdaName,
          referenceNumber,
          period,
          varianceCount: reconciliation.varianceCount,
          largestVarianceAmount: reconciliation.largestVarianceAmount,
        }).catch(() => { /* fire-and-forget */ });
      }
    })
    .catch(() => { /* fire-and-forget */ });

  return {
    id: submissionId,
    referenceNumber,
    recordCount: rows.length,
    matchedCount: reconciliation.matchedCount,
    varianceCount: reconciliation.varianceCount,
    largestVarianceAmount: reconciliation.largestVarianceAmount,
    matchRate: reconciliation.matchRate,
    noBaseline: reconciliation.noBaseline,
  };
}

// ─── Get Historical Reconciliation ──────────────────────────────────────

export async function getHistoricalReconciliation(
  submissionId: string,
  mdaScope: string | null,
): Promise<HistoricalReconciliationSummary> {
  const conditions = [eq(mdaSubmissions.id, submissionId)];
  if (mdaScope !== null) {
    conditions.push(eq(mdaSubmissions.mdaId, mdaScope));
  }

  const submission = await db.select({
    id: mdaSubmissions.id,
    mdaId: mdaSubmissions.mdaId,
    historicalReconciliation: mdaSubmissions.historicalReconciliation,
  })
    .from(mdaSubmissions)
    .where(and(...conditions))
    .limit(1);

  if (submission.length === 0) {
    throw new AppError(404, 'NOT_FOUND', 'Submission not found');
  }

  const sub = submission[0];
  const stored = sub.historicalReconciliation as {
    matchedCount: number;
    varianceCount: number;
    largestVarianceAmount: string;
    matchRate: number;
    noBaseline: boolean;
    flaggedRows: FlaggedRow[];
  } | null;

  if (!stored) {
    throw new AppError(404, 'NOT_FOUND', 'Historical reconciliation data not found for this submission');
  }

  // If no baseline, return stored summary with empty details
  if (stored.noBaseline) {
    return {
      ...stored,
      details: [],
    };
  }

  // Live query: build per-loanee comparison from submission_rows + loans
  const rows = await db.select({
    staffId: submissionRows.staffId,
    amountDeducted: submissionRows.amountDeducted,
  })
    .from(submissionRows)
    .where(eq(submissionRows.submissionId, submissionId));

  const uniqueStaffIds = [...new Set(rows.map((r) => r.staffId))];

  const baselineLoans = await db.select({
    staffId: loans.staffId,
    monthlyDeductionAmount: loans.monthlyDeductionAmount,
    staffName: sql<string>`COALESCE(${loans.staffName}, 'Unknown')`.as('staff_name'),
  })
    .from(loans)
    .where(and(
      eq(loans.mdaId, sub.mdaId),
      inArray(loans.staffId, uniqueStaffIds),
    ));

  // Build lookup Map
  const baselineMap = new Map<string, { totalBaseline: Decimal; staffName: string }>();
  for (const loan of baselineLoans) {
    const existing = baselineMap.get(loan.staffId);
    const amount = new Decimal(loan.monthlyDeductionAmount ?? '0');
    if (existing) {
      existing.totalBaseline = existing.totalBaseline.plus(amount);
    } else {
      baselineMap.set(loan.staffId, { totalBaseline: amount, staffName: loan.staffName });
    }
  }

  // Build flagged set from stored JSONB
  const flaggedSet = new Map<string, string>();
  for (const flag of stored.flaggedRows) {
    flaggedSet.set(flag.staffId, flag.reason);
  }

  const details: HistoricalReconciliationDetail[] = [];
  for (const row of rows) {
    const baseline = baselineMap.get(row.staffId);
    if (!baseline) continue;

    const declared = new Decimal(row.amountDeducted);
    const baselineAmount = baseline.totalBaseline;
    const difference = declared.minus(baselineAmount).abs();

    const matchStatus: HistoricalMatchStatus = difference.lessThan(MINOR_VARIANCE_THRESHOLD)
      ? 'matched'
      : 'variance';

    details.push({
      staffId: row.staffId,
      staffName: baseline.staffName,
      declaredAmount: declared.toFixed(2),
      baselineAmount: baselineAmount.toFixed(2),
      variance: declared.minus(baselineAmount).toFixed(2),
      matchStatus,
      flagged: flaggedSet.has(row.staffId),
      flagReason: flaggedSet.get(row.staffId) ?? null,
    });
  }

  return {
    matchedCount: stored.matchedCount,
    varianceCount: stored.varianceCount,
    largestVarianceAmount: stored.largestVarianceAmount,
    matchRate: stored.matchRate,
    noBaseline: stored.noBaseline,
    flaggedRows: stored.flaggedRows,
    details,
  };
}

// ─── Flag Discrepancy ────────────────────────────────────────────────────

export async function flagDiscrepancy(
  submissionId: string,
  staffId: string,
  reason: string,
  userId: string,
  mdaScope: string | null,
): Promise<void> {
  // Validate staffId exists in submission rows (outside transaction — read-only check)
  const staffRow = await db.select({ staffId: submissionRows.staffId })
    .from(submissionRows)
    .where(and(
      eq(submissionRows.submissionId, submissionId),
      eq(submissionRows.staffId, staffId),
    ))
    .limit(1);

  if (staffRow.length === 0) {
    throw new AppError(422, 'STAFF_NOT_IN_SUBMISSION', `Staff ID '${staffId}' not found in this submission`);
  }

  // Wrap read-modify-write in transaction to prevent race conditions (M3)
  await db.transaction(async (tx) => {
    const conditions = [eq(mdaSubmissions.id, submissionId)];
    if (mdaScope !== null) {
      conditions.push(eq(mdaSubmissions.mdaId, mdaScope));
    }

    const submission = await tx.select({
      id: mdaSubmissions.id,
      historicalReconciliation: mdaSubmissions.historicalReconciliation,
    })
      .from(mdaSubmissions)
      .where(and(...conditions))
      .limit(1);

    if (submission.length === 0) {
      throw new AppError(404, 'NOT_FOUND', 'Submission not found');
    }

    const stored = submission[0].historicalReconciliation as {
      matchedCount: number;
      varianceCount: number;
      largestVarianceAmount: string;
      matchRate: number;
      noBaseline: boolean;
      flaggedRows: FlaggedRow[];
    } | null;

    if (!stored) {
      throw new AppError(404, 'NOT_FOUND', 'Historical reconciliation data not found');
    }

    // Duplicate flag prevention (M4)
    const flaggedRows: FlaggedRow[] = [...(stored.flaggedRows || [])];
    if (flaggedRows.some((f) => f.staffId === staffId)) {
      throw new AppError(409, 'ALREADY_FLAGGED', `Staff ID '${staffId}' has already been flagged for this submission`);
    }

    flaggedRows.push({
      staffId,
      reason,
      flaggedBy: userId,
      flaggedAt: new Date().toISOString(),
    });

    // Update JSONB within transaction
    await tx.update(mdaSubmissions)
      .set({
        historicalReconciliation: { ...stored, flaggedRows },
        updatedAt: new Date(),
      })
      .where(eq(mdaSubmissions.id, submissionId));
  });
}
