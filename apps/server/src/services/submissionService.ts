import Papa from 'papaparse';
import { eq, and, inArray, sql, desc, count } from 'drizzle-orm';
import { db } from '../db/index';
import { mdaSubmissions, submissionRows, mdas, loans } from '../db/schema';
import { AppError } from '../lib/appError';
import { withTransaction } from '../lib/transaction';
import { withMdaScope } from '../lib/mdaScope';
import { generateUuidv7 } from '../lib/uuidv7';
import { compareSubmission } from './comparisonEngine';
import { reconcileSubmission } from './reconciliationEngine';
import { sendReconciliationAlertEmail } from '../lib/email';
import { VOCABULARY, submissionRowSchema } from '@vlprs/shared';
import type {
  SubmissionRow,
  SubmissionUploadResponse,
  SubmissionDetail,
  SubmissionValidationError,
  SubmissionRecordStatus,
  EventFlagType,
} from '@vlprs/shared';

// ─── CSV Parsing ────────────────────────────────────────────────────

const CSV_HEADERS = [
  'Staff ID', 'Month', 'Amount Deducted', 'Payroll Batch Reference',
  'MDA Code', 'Event Flag', 'Event Date', 'Cessation Reason',
] as const;

interface ParsedCsvRow {
  rowNumber: number;
  staffId: string;
  month: string;
  amountDeducted: string;
  payrollBatchReference: string;
  mdaCode: string;
  eventFlag: string;
  eventDate: string | null;
  cessationReason: string | null;
}

/** Row type used internally by the shared processing pipeline. */
interface IndexedRow {
  rowIndex: number; // 0-based array index (used in error.row)
  staffId: string;
  month: string;
  amountDeducted: string;
  payrollBatchReference: string;
  mdaCode: string;
  eventFlag: string;
  eventDate: string | null;
  cessationReason: string | null;
}

export function parseSubmissionCsv(buffer: Buffer): ParsedCsvRow[] {
  // Strip BOM if present
  let csvText = buffer.toString('utf-8');
  if (csvText.charCodeAt(0) === 0xFEFF) {
    csvText = csvText.slice(1);
  }

  const result = Papa.parse<string[]>(csvText, {
    header: false,
    skipEmptyLines: true,
    delimiter: ',',
  });

  if (result.errors.length > 0 && result.data.length === 0) {
    throw new AppError(422, 'CSV_PARSE_ERROR', VOCABULARY.SUBMISSION_EMPTY_FILE);
  }

  // Skip header row if present (first row matches expected headers or is text-like)
  let dataRows = result.data;
  if (dataRows.length > 0) {
    const firstRow = dataRows[0];
    const isHeader = firstRow.some(
      (cell) => CSV_HEADERS.some((h) => h.toLowerCase() === cell.trim().toLowerCase()),
    );
    if (isHeader) {
      dataRows = dataRows.slice(1);
    }
  }

  // Skip comment rows (lines starting with #)
  dataRows = dataRows.filter((row) => !(row[0] || '').trim().startsWith('#'));

  if (dataRows.length === 0) {
    throw new AppError(422, 'SUBMISSION_VALIDATION_FAILED', VOCABULARY.SUBMISSION_EMPTY_FILE);
  }

  return dataRows.map((row, idx) => ({
    rowNumber: idx + 2, // 1-based, +1 for header row
    staffId: (row[0] || '').trim(),
    month: (row[1] || '').trim(),
    amountDeducted: (row[2] || '').trim(),
    payrollBatchReference: (row[3] || '').trim(),
    mdaCode: (row[4] || '').trim(),
    eventFlag: (row[5] || '').trim(),
    eventDate: row[6]?.trim() || null,
    cessationReason: row[7]?.trim() || null,
  }));
}

// ─── Row Validation ─────────────────────────────────────────────────

export function validateSubmissionRows(
  rows: IndexedRow[],
): { validRows: SubmissionRow[]; errors: SubmissionValidationError[] } {
  const errors: SubmissionValidationError[] = [];
  const validRows: SubmissionRow[] = [];

  for (const row of rows) {
    const displayRow = row.rowIndex + 1; // 1-based for human-readable messages
    const result = submissionRowSchema.safeParse({
      staffId: row.staffId,
      month: row.month,
      amountDeducted: row.amountDeducted,
      payrollBatchReference: row.payrollBatchReference,
      mdaCode: row.mdaCode,
      eventFlag: row.eventFlag,
      eventDate: row.eventDate,
      cessationReason: row.cessationReason,
    });

    if (!result.success) {
      for (const issue of result.error.issues) {
        const field = issue.path[0]?.toString() || 'unknown';
        let message: string;

        if (field === 'amountDeducted') {
          message = VOCABULARY.SUBMISSION_AMOUNT_FORMAT
            .replace('{row}', String(displayRow))
            .replace('{value}', row.amountDeducted);
        } else if (field === 'month') {
          message = VOCABULARY.SUBMISSION_MONTH_FORMAT
            .replace('{row}', String(displayRow))
            .replace('{value}', row.month);
        } else if (field === 'eventDate') {
          message = VOCABULARY.SUBMISSION_EVENT_DATE_REQUIRED
            .replace('{row}', String(displayRow));
        } else if (field === 'cessationReason') {
          message = VOCABULARY.SUBMISSION_CESSATION_REQUIRED
            .replace('{row}', String(displayRow));
        } else {
          message = `Row ${displayRow}: ${issue.message}`;
        }

        errors.push({ row: row.rowIndex, field, message });
      }
    } else {
      validRows.push(result.data as SubmissionRow);
    }
  }

  // Check intra-file duplicates (same Staff ID + same Month within submission)
  const seen = new Map<string, number>();
  for (const row of rows) {
    const key = `${row.staffId}::${row.month}`;
    if (seen.has(key)) {
      errors.push({
        row: row.rowIndex,
        field: 'staffId',
        message: VOCABULARY.SUBMISSION_DUPLICATE_ROW
          .replace('{row}', String(row.rowIndex + 1))
          .replace('{staffId}', row.staffId)
          .replace('{month}', row.month),
      });
    } else {
      seen.set(key, row.rowIndex);
    }
  }

  return { validRows, errors };
}

// ─── MDA Code Validation ─────────────────────────────────────────────

export async function validateMdaCodes(
  rows: IndexedRow[],
  mdaScope: string | null,
): Promise<{ mdaId: string; errors: SubmissionValidationError[] }> {
  const errors: SubmissionValidationError[] = [];

  // Get unique MDA codes from submission
  const mdaCodes = [...new Set(rows.map((r) => r.mdaCode))];

  if (mdaScope !== null) {
    // MDA_OFFICER: all rows must match their assigned MDA
    const assignedMda = await db.select({ id: mdas.id, code: mdas.code })
      .from(mdas)
      .where(eq(mdas.id, mdaScope))
      .limit(1);

    if (assignedMda.length === 0) {
      throw new AppError(400, 'MDA_NOT_FOUND', VOCABULARY.MDA_NOT_FOUND);
    }

    const mdaCode = assignedMda[0].code;
    for (const row of rows) {
      if (row.mdaCode !== mdaCode) {
        errors.push({
          row: row.rowIndex,
          field: 'mdaCode',
          message: VOCABULARY.SUBMISSION_MDA_MISMATCH
            .replace('{row}', String(row.rowIndex + 1))
            .replace('{code}', row.mdaCode),
        });
      }
    }

    return { mdaId: mdaScope, errors };
  }

  // DEPT_ADMIN: resolve MDA from submission data
  if (mdaCodes.length > 1) {
    errors.push({
      row: 0,
      field: 'mdaCode',
      message: 'All rows must belong to the same MDA',
    });
    return { mdaId: '', errors };
  }

  const matchedMda = await db.select({ id: mdas.id })
    .from(mdas)
    .where(eq(mdas.code, mdaCodes[0]))
    .limit(1);

  if (matchedMda.length === 0) {
    errors.push({
      row: 0,
      field: 'mdaCode',
      message: `MDA Code '${mdaCodes[0]}' not found in the system`,
    });
    return { mdaId: '', errors };
  }

  return { mdaId: matchedMda[0].id, errors };
}

// ─── Staff ID Validation (batch) ─────────────────────────────────────

export async function validateStaffIds(
  rows: IndexedRow[],
  mdaId: string,
): Promise<SubmissionValidationError[]> {
  const errors: SubmissionValidationError[] = [];
  const uniqueStaffIds = [...new Set(rows.map((r) => r.staffId))];

  if (uniqueStaffIds.length === 0) return errors;

  // Batch query: find all staff IDs that exist for this MDA
  const existing = await db.select({ staffId: loans.staffId })
    .from(loans)
    .where(and(
      inArray(loans.staffId, uniqueStaffIds),
      eq(loans.mdaId, mdaId),
    ));

  const existingSet = new Set(existing.map((r) => r.staffId));

  for (const row of rows) {
    if (!existingSet.has(row.staffId)) {
      errors.push({
        row: row.rowIndex,
        field: 'staffId',
        message: VOCABULARY.SUBMISSION_STAFF_NOT_FOUND
          .replace('{row}', String(row.rowIndex + 1))
          .replace('{staffId}', row.staffId),
      });
    }
  }

  return errors;
}

// ─── Duplicate Check (against existing confirmed submissions) ────────

export async function checkDuplicates(
  rows: IndexedRow[],
  mdaId: string,
): Promise<SubmissionValidationError[]> {
  const errors: SubmissionValidationError[] = [];
  const uniqueStaffIds = [...new Set(rows.map((r) => r.staffId))];
  const uniqueMonths = [...new Set(rows.map((r) => r.month))];

  if (uniqueStaffIds.length === 0) return errors;

  // Single composite query: find existing confirmed submission rows for these staff+month combos
  const existingRows = await db.select({
    staffId: submissionRows.staffId,
    month: submissionRows.month,
  })
    .from(submissionRows)
    .innerJoin(mdaSubmissions, eq(submissionRows.submissionId, mdaSubmissions.id))
    .where(and(
      eq(mdaSubmissions.mdaId, mdaId),
      eq(mdaSubmissions.status, 'confirmed'),
      inArray(submissionRows.staffId, uniqueStaffIds),
      inArray(submissionRows.month, uniqueMonths),
    ));

  const existingSet = new Set(existingRows.map((r) => `${r.staffId}::${r.month}`));

  for (const row of rows) {
    const key = `${row.staffId}::${row.month}`;
    if (existingSet.has(key)) {
      errors.push({
        row: row.rowIndex,
        field: 'staffId',
        message: VOCABULARY.SUBMISSION_DUPLICATE_ROW
          .replace('{row}', String(row.rowIndex + 1))
          .replace('{staffId}', row.staffId)
          .replace('{month}', row.month),
      });
    }
  }

  return errors;
}

// ─── Period Lock ──────────────────────────────────────────────────────

export function checkPeriodLock(period: string, role?: string): SubmissionValidationError | null {
  // DEPT_ADMIN and SUPER_ADMIN can submit for any historical period (Story 11.0a, AC#3)
  if (role === 'dept_admin' || role === 'super_admin') {
    return null;
  }

  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1; // 1-based, UTC

  const [yearStr, monthStr] = period.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  // Calculate current period and previous period
  const currentPeriod = currentYear * 12 + currentMonth;
  const submissionPeriod = year * 12 + month;
  const previousPeriod = currentPeriod - 1;

  // Open: current month or previous month
  if (submissionPeriod === currentPeriod || submissionPeriod === previousPeriod) {
    return null;
  }

  const periodLabel = `${yearStr}-${monthStr}`;
  return {
    row: 0,
    field: 'period',
    message: VOCABULARY.SUBMISSION_PERIOD_CLOSED.replace('{period}', periodLabel),
  };
}

// ─── Process Submission Rows (shared pipeline for CSV + manual) ──────

/**
 * Shared processing pipeline for both CSV upload and manual entry.
 * Validates rows, checks business rules, and persists atomically.
 *
 * Row errors use 0-based indices in `details[].row`.
 * Human-readable messages display 1-based row numbers.
 */
export async function processSubmissionRows(
  rawRows: Array<{
    staffId: string;
    month: string;
    amountDeducted: string;
    payrollBatchReference: string;
    mdaCode: string;
    eventFlag: string;
    eventDate: string | null;
    cessationReason: string | null;
  }>,
  mdaScope: string | null,
  userId: string,
  source: 'csv' | 'manual' | 'historical',
  fileInfo?: { filename: string; fileSizeBytes: number },
  role?: string,
): Promise<SubmissionUploadResponse> {
  // Convert to indexed rows with 0-based indices
  const rows: IndexedRow[] = rawRows.map((r, idx) => ({
    rowIndex: idx,
    ...r,
  }));

  const allErrors: SubmissionValidationError[] = [];

  // 1. Validate row data (schema + intra-file duplicates)
  const { errors: rowErrors } = validateSubmissionRows(rows);
  allErrors.push(...rowErrors);

  // 2. Validate MDA codes & resolve MDA ID
  const { mdaId, errors: mdaErrors } = await validateMdaCodes(rows, mdaScope);
  allErrors.push(...mdaErrors);

  // 3. Check period lock (validate once, all rows should share the same period)
  const periods = [...new Set(rows.map((r) => r.month))];
  for (const period of periods) {
    const periodError = checkPeriodLock(period, role);
    if (periodError) {
      allErrors.push(periodError);
    }
  }

  // If we have errors already or no valid MDA, reject early before DB lookups
  if (allErrors.length > 0) {
    throw new AppError(422, 'SUBMISSION_VALIDATION_FAILED', VOCABULARY.SUBMISSION_NEEDS_ATTENTION, allErrors);
  }

  // 4. Validate Staff IDs exist (batch query)
  const staffErrors = await validateStaffIds(rows, mdaId);
  allErrors.push(...staffErrors);

  // 5. Check duplicates against existing confirmed submissions
  const dupErrors = await checkDuplicates(rows, mdaId);
  allErrors.push(...dupErrors);

  // If any DB-level validation errors, reject
  if (allErrors.length > 0) {
    throw new AppError(422, 'SUBMISSION_VALIDATION_FAILED', VOCABULARY.SUBMISSION_NEEDS_ATTENTION, allErrors);
  }

  // 6. Validate all rows share the same period (submission.period is singular)
  if (periods.length > 1) {
    allErrors.push({
      row: 0,
      field: 'month',
      message: 'All rows must belong to the same submission period',
    });
    throw new AppError(422, 'SUBMISSION_VALIDATION_FAILED', VOCABULARY.SUBMISSION_NEEDS_ATTENTION, allErrors);
  }

  const period = periods[0];

  // 7. Atomic INSERT — reference generation + submission + all rows in single transaction
  const submissionId = generateUuidv7();
  const now = new Date();

  const { refNumber, reconciliationResult } = await withTransaction(async (tx) => {
    // Generate reference number INSIDE transaction to prevent race conditions
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

    await tx.insert(mdaSubmissions).values({
      id: submissionId,
      mdaId,
      uploadedBy: userId,
      period,
      referenceNumber: refNumber,
      status: 'confirmed',
      recordCount: rows.length,
      source,
      filename: fileInfo?.filename ?? null,
      fileSizeBytes: fileInfo?.fileSizeBytes ?? null,
      createdAt: now,
      updatedAt: now,
    });

    const rowValues = rows.map((row) => ({
      id: generateUuidv7(),
      submissionId,
      rowNumber: row.rowIndex + 1, // 1-based for DB storage
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

    // Story 11.3: Reconcile mid-cycle employment events INSIDE transaction (AC 6)
    // Story 11.4: Defensive guard — historical uploads use their own pipeline, never trigger reconciliation
    const reconciliationResult = source !== 'historical'
      ? await reconcileSubmission(submissionId, mdaId, tx)
      : { counts: { matched: 0, dateDiscrepancy: 0, unconfirmed: 0, newCsvEvent: 0 } };

    // Store reconciliation summary counts as JSONB on the submission record
    await tx.update(mdaSubmissions)
      .set({ reconciliationSummary: reconciliationResult.counts, updatedAt: now })
      .where(eq(mdaSubmissions.id, submissionId));

    return { refNumber, reconciliationResult };
  });

  const referenceNumber = refNumber;

  // Story 11.3: Fire-and-forget email if discrepancies found (OUTSIDE transaction)
  const { counts: reconCounts } = reconciliationResult;
  if (reconCounts.dateDiscrepancy > 0 || reconCounts.unconfirmed > 0) {
    // M1 fix: Resolve MDA name for email content
    db.select({ name: mdas.name }).from(mdas).where(eq(mdas.id, mdaId)).limit(1)
      .then((rows) => {
        const mdaName = rows[0]?.name ?? 'Unknown MDA';
        return sendReconciliationAlertEmail({
          mdaName,
          referenceNumber,
          period,
          dateDiscrepancyCount: reconCounts.dateDiscrepancy,
          unconfirmedCount: reconCounts.unconfirmed,
        });
      })
      .catch(() => { /* fire-and-forget */ });
  }

  // Run comparison engine and persist aggregate counts.
  // Wrapped in try/catch: if comparison fails, the submission is still valid
  // with 0/0 counts — counts can be recomputed via GET /submissions/:id/comparison.
  // Story 11.4: Defensive guard — historical uploads skip comparison (different purpose)
  if (source === 'historical') {
    return {
      id: submissionId,
      referenceNumber,
      recordCount: rows.length,
      submissionDate: now.toISOString(),
      status: 'confirmed' as SubmissionRecordStatus,
      alignedCount: 0,
      varianceCount: 0,
    };
  }
  try {
    const { summary: comparisonSummary } = await compareSubmission(submissionId, mdaScope);
    await db.update(mdaSubmissions)
      .set({
        alignedCount: comparisonSummary.alignedCount,
        varianceCount: comparisonSummary.varianceCount,
        updatedAt: new Date(),
      })
      .where(eq(mdaSubmissions.id, submissionId));

    return {
      id: submissionId,
      referenceNumber,
      recordCount: rows.length,
      submissionDate: now.toISOString(),
      status: 'confirmed' as SubmissionRecordStatus,
      alignedCount: comparisonSummary.alignedCount,
      varianceCount: comparisonSummary.varianceCount,
    };
  } catch {
    // Comparison failed — submission is valid, counts default to 0.
    // Counts will be computed on-demand via GET /submissions/:id/comparison.
    return {
      id: submissionId,
      referenceNumber,
      recordCount: rows.length,
      submissionDate: now.toISOString(),
      status: 'confirmed' as SubmissionRecordStatus,
      alignedCount: 0,
      varianceCount: 0,
    };
  }
}

// ─── Process Submission — CSV entry point (delegates to shared pipeline) ─

export async function processSubmission(
  file: Express.Multer.File,
  mdaScope: string | null,
  userId: string,
  role?: string,
): Promise<SubmissionUploadResponse> {
  const csvRows = parseSubmissionCsv(file.buffer);

  // Strip CSV-specific rowNumber and pass to shared pipeline
  const rows = csvRows.map(({ rowNumber: _rn, ...rest }) => rest);

  return processSubmissionRows(rows, mdaScope, userId, 'csv', {
    filename: file.originalname,
    fileSizeBytes: file.size,
  }, role);
}

// ─── Get Submissions (paginated list) ────────────────────────────────

export async function getSubmissions(
  mdaScope: string | null,
  filters: { page: number; pageSize: number; period?: string; mdaId?: string },
): Promise<{
  items: Array<{
    id: string;
    referenceNumber: string;
    submissionDate: string;
    recordCount: number;
    status: string;
    period: string;
    alignedCount: number;
    varianceCount: number;
  }>;
  total: number;
  page: number;
  pageSize: number;
}> {
  const { page, pageSize, period, mdaId } = filters;
  const offset = (page - 1) * pageSize;

  const conditions = [];
  const scopeCondition = withMdaScope(mdaSubmissions.mdaId, mdaScope);
  if (scopeCondition) conditions.push(scopeCondition);
  if (period) conditions.push(eq(mdaSubmissions.period, period));
  if (mdaId) conditions.push(eq(mdaSubmissions.mdaId, mdaId));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [items, totalResult] = await Promise.all([
    db.select({
      id: mdaSubmissions.id,
      referenceNumber: mdaSubmissions.referenceNumber,
      submissionDate: mdaSubmissions.createdAt,
      recordCount: mdaSubmissions.recordCount,
      status: mdaSubmissions.status,
      period: mdaSubmissions.period,
      alignedCount: mdaSubmissions.alignedCount,
      varianceCount: mdaSubmissions.varianceCount,
    })
      .from(mdaSubmissions)
      .where(whereClause)
      .orderBy(desc(mdaSubmissions.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ count: count() })
      .from(mdaSubmissions)
      .where(whereClause),
  ]);

  return {
    items: items.map((item) => ({
      ...item,
      submissionDate: item.submissionDate.toISOString(),
    })),
    total: totalResult[0].count,
    page,
    pageSize,
  };
}

// ─── Get Submission By ID ────────────────────────────────────────────

export async function getSubmissionById(
  id: string,
  mdaScope: string | null,
): Promise<SubmissionDetail> {
  const conditions = [eq(mdaSubmissions.id, id)];
  const scopeCondition = withMdaScope(mdaSubmissions.mdaId, mdaScope);
  if (scopeCondition) conditions.push(scopeCondition);

  const submission = await db.select()
    .from(mdaSubmissions)
    .where(and(...conditions))
    .limit(1);

  if (submission.length === 0) {
    throw new AppError(404, 'NOT_FOUND', 'Submission not found');
  }

  const rows = await db.select()
    .from(submissionRows)
    .where(eq(submissionRows.submissionId, id))
    .orderBy(submissionRows.rowNumber);

  const sub = submission[0];

  // Resolve MDA name for admin views (AC 2)
  const mda = await db.select({ name: mdas.name })
    .from(mdas)
    .where(eq(mdas.id, sub.mdaId))
    .limit(1);

  return {
    id: sub.id,
    mdaId: sub.mdaId,
    mdaName: mda[0]?.name ?? 'Unknown MDA',
    period: sub.period,
    referenceNumber: sub.referenceNumber,
    status: sub.status,
    recordCount: sub.recordCount,
    source: sub.source as 'csv' | 'manual',
    filename: sub.filename,
    fileSizeBytes: sub.fileSizeBytes,
    createdAt: sub.createdAt.toISOString(),
    rows: rows.map((r) => ({
      staffId: r.staffId,
      month: r.month,
      amountDeducted: r.amountDeducted,
      payrollBatchReference: r.payrollBatchReference,
      mdaCode: r.mdaCode,
      eventFlag: r.eventFlag as EventFlagType,
      eventDate: r.eventDate ? r.eventDate.toISOString().split('T')[0] : null,
      cessationReason: r.cessationReason,
    })),
  };
}
