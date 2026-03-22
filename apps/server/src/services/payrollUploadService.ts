/**
 * Payroll Upload Service (Story 7.0h).
 * AG uploads consolidated monthly payroll deduction extracts,
 * automatically split by MDA for three-way reconciliation (Story 7.0i).
 *
 * Two-step flow:
 * 1. previewPayrollUpload() — parse, validate, group by MDA, return summary
 * 2. confirmPayrollUpload() — persist to mda_submissions + submission_rows
 *
 * Payroll data stored with source='payroll' — coexists with MDA submissions.
 * Does NOT trigger reconciliation or comparison (Story 7.0i handles that).
 */
import Decimal from 'decimal.js';
import { eq, sql, desc, and, inArray } from 'drizzle-orm';
import { db } from '../db/index';
import { mdaSubmissions, submissionRows, mdas } from '../db/schema';
import { AppError } from '../lib/appError';
import { withTransaction } from '../lib/transaction';
import { generateUuidv7 } from '../lib/uuidv7';
import { parseSubmissionFile, type ParsedCsvRow } from '../lib/fileParser';
import { validateSubmissionRows } from './submissionService';
import { resolveMdaByName } from './mdaService';
import { checkDeclaredExists, triggerThreeWayReconciliation } from './threeWayReconciliationService';
import { VOCABULARY } from '@vlprs/shared';
import type {
  PayrollDelineationSummary,
  PayrollUploadResponse,
  PayrollMdaBreakdown,
  PayrollUploadListItem,
  PayrollUploadDetail,
  SubmissionValidationError,
  EventFlagType,
} from '@vlprs/shared';

// ─── Constants ────────────────────────────────────────────────────────

const MAX_PAYROLL_ROWS = 500;

// ─── Preview Cache ────────────────────────────────────────────────────
// In-memory cache for the two-step preview→confirm flow.
// Keyed by userId — SUPER_ADMIN only (1-2 concurrent users max).

interface PendingPayrollUpload {
  rows: ParsedCsvRow[];
  period: string;
  summary: PayrollDelineationSummary;
  resolvedMdas: Map<string, { mdaId: string; mdaName: string }>;
  filename: string;
  fileSizeBytes: number;
  createdAt: number; // Date.now() — for TTL cleanup
}

const pendingUploads = new Map<string, PendingPayrollUpload>();

// TTL: 30 minutes — auto-cleanup stale previews
const PREVIEW_TTL_MS = 30 * 60 * 1000;

function cleanupStale(): void {
  const now = Date.now();
  for (const [key, val] of pendingUploads) {
    if (now - val.createdAt > PREVIEW_TTL_MS) {
      pendingUploads.delete(key);
    }
  }
}

// ─── Preview (Step 1) ────────────────────────────────────────────────

export async function previewPayrollUpload(
  buffer: Buffer,
  filename: string,
  fileSizeBytes: number,
  userId: string,
): Promise<PayrollDelineationSummary> {
  cleanupStale();

  // 1. Parse file (CSV or XLSX) — re-throw parser errors with payroll vocabulary
  let rows: ParsedCsvRow[];
  try {
    rows = parseSubmissionFile(buffer, filename);
  } catch (err) {
    if (err instanceof AppError && (err.code === 'CSV_PARSE_ERROR' || err.code === 'SUBMISSION_VALIDATION_FAILED')) {
      throw new AppError(422, 'PAYROLL_EMPTY_FILE', VOCABULARY.PAYROLL_EMPTY_FILE);
    }
    throw err;
  }

  if (rows.length === 0) {
    throw new AppError(422, 'PAYROLL_EMPTY_FILE', VOCABULARY.PAYROLL_EMPTY_FILE);
  }

  // 2. Row limit check
  if (rows.length > MAX_PAYROLL_ROWS) {
    throw new AppError(422, 'PAYROLL_ROW_LIMIT_EXCEEDED', VOCABULARY.PAYROLL_ROW_LIMIT_EXCEEDED);
  }

  // 3. Relax event fields for payroll: default empty eventFlag to NONE
  for (const row of rows) {
    if (!row.eventFlag || row.eventFlag.trim() === '') {
      row.eventFlag = 'NONE';
    }
    // eventDate and cessationReason already default to null in the parser
  }

  // 4. Validate rows (schema validation using shared pipeline)
  const indexedRows = rows.map((r, idx) => ({
    rowIndex: idx,
    staffId: r.staffId,
    month: r.month,
    amountDeducted: r.amountDeducted,
    payrollBatchReference: r.payrollBatchReference,
    mdaCode: r.mdaCode,
    eventFlag: r.eventFlag,
    eventDate: r.eventDate,
    cessationReason: r.cessationReason,
  }));

  const { errors: rowErrors } = validateSubmissionRows(indexedRows);
  if (rowErrors.length > 0) {
    throw new AppError(422, 'PAYROLL_VALIDATION_FAILED', VOCABULARY.SUBMISSION_NEEDS_ATTENTION, rowErrors);
  }

  // 5. Single-period constraint (AC 9)
  const periods = [...new Set(rows.map((r) => r.month))];
  if (periods.length > 1) {
    const errors: SubmissionValidationError[] = rows
      .filter((r) => r.month !== periods[0])
      .map((r, idx) => ({
        row: idx,
        field: 'month',
        message: `Expected period ${periods[0]} but found ${r.month}`,
      }));
    throw new AppError(422, 'PAYROLL_MIXED_PERIOD', VOCABULARY.PAYROLL_MIXED_PERIOD, errors);
  }
  const period = periods[0];

  // 6. Group by MDA code and resolve MDA names
  const mdaGroups = new Map<string, ParsedCsvRow[]>();
  for (const row of rows) {
    const code = row.mdaCode.toUpperCase();
    const group = mdaGroups.get(code);
    if (group) {
      group.push(row);
    } else {
      mdaGroups.set(code, [row]);
    }
  }

  const mdaBreakdown: PayrollMdaBreakdown[] = [];
  const unmatchedCodes: string[] = [];
  const resolvedMdas = new Map<string, { mdaId: string; mdaName: string }>();

  for (const [code, groupRows] of mdaGroups) {
    // Resolve MDA via Layer 1 exact code match
    const resolved = await resolveMdaByName(code);

    if (!resolved) {
      unmatchedCodes.push(code);
      mdaBreakdown.push({
        mdaCode: code,
        mdaName: `Unmatched: ${code}`,
        recordCount: groupRows.length,
        totalDeduction: groupRows.reduce(
          (sum, r) => sum.plus(r.amountDeducted.replace(/,/g, '')),
          new Decimal(0),
        ).toFixed(2),
      });
      continue;
    }

    resolvedMdas.set(code, { mdaId: resolved.id, mdaName: resolved.name });
    mdaBreakdown.push({
      mdaCode: code,
      mdaName: resolved.name,
      recordCount: groupRows.length,
      totalDeduction: groupRows.reduce(
        (sum, r) => sum.plus(r.amountDeducted.replace(/,/g, '')),
        new Decimal(0),
      ).toFixed(2),
    });
  }

  const summary: PayrollDelineationSummary = {
    period,
    totalRecords: rows.length,
    mdaBreakdown,
    unmatchedCodes,
  };

  // Store in preview cache for confirm step
  pendingUploads.set(userId, {
    rows,
    period,
    summary,
    resolvedMdas,
    filename,
    fileSizeBytes,
    createdAt: Date.now(),
  });

  return summary;
}

// ─── Confirm (Step 2) ────────────────────────────────────────────────

export async function confirmPayrollUpload(
  period: string,
  userId: string,
): Promise<PayrollUploadResponse> {
  cleanupStale();

  const pending = pendingUploads.get(userId);
  if (!pending || pending.period !== period) {
    throw new AppError(400, 'PAYROLL_NO_PENDING', VOCABULARY.PAYROLL_NO_PENDING_UPLOAD);
  }

  // Reject if unmatched MDA codes exist
  if (pending.summary.unmatchedCodes.length > 0) {
    throw new AppError(422, 'PAYROLL_UNMATCHED_MDA', VOCABULARY.PAYROLL_UNMATCHED_MDA);
  }

  const now = new Date();
  const referenceNumbers: string[] = [];

  // Group rows by MDA code
  const mdaGroups = new Map<string, ParsedCsvRow[]>();
  for (const row of pending.rows) {
    const code = row.mdaCode.toUpperCase();
    const group = mdaGroups.get(code);
    if (group) {
      group.push(row);
    } else {
      mdaGroups.set(code, [row]);
    }
  }

  // Atomic transaction: create one mda_submissions per MDA + all submission_rows
  await withTransaction(async (tx) => {
    for (const [code, groupRows] of mdaGroups) {
      const resolved = pending.resolvedMdas.get(code);
      if (!resolved) continue; // shouldn't happen — unmatched already rejected

      // Generate PAY- reference number
      const refNumber = await generatePayrollReference(period, tx);
      referenceNumbers.push(refNumber);

      const submissionId = generateUuidv7();

      await tx.insert(mdaSubmissions).values({
        id: submissionId,
        mdaId: resolved.mdaId,
        uploadedBy: userId,
        period,
        referenceNumber: refNumber,
        status: 'confirmed',
        recordCount: groupRows.length,
        source: 'payroll',
        filename: pending.filename,
        fileSizeBytes: pending.fileSizeBytes,
        createdAt: now,
        updatedAt: now,
      });

      const rowValues = groupRows.map((row, idx) => ({
        id: generateUuidv7(),
        submissionId,
        rowNumber: idx + 1,
        staffId: row.staffId,
        month: row.month,
        amountDeducted: row.amountDeducted.replace(/,/g, ''),
        payrollBatchReference: row.payrollBatchReference,
        mdaCode: row.mdaCode,
        eventFlag: (row.eventFlag || 'NONE') as EventFlagType,
        eventDate: row.eventDate ? new Date(row.eventDate) : null,
        cessationReason: row.cessationReason,
        createdAt: now,
      }));

      await tx.insert(submissionRows).values(rowValues);
    }
  });

  // Clear preview cache
  pendingUploads.delete(userId);

  // Story 7.0i: Fire-and-forget three-way reconciliation for MDAs with existing submissions
  for (const [code] of mdaGroups) {
    const resolved = pending.resolvedMdas.get(code);
    if (!resolved) continue;
    checkDeclaredExists(resolved.mdaId, period).then((hasDeclared) => {
      if (hasDeclared) {
        triggerThreeWayReconciliation(resolved.mdaId, period, userId, 'payroll');
      }
    }).catch(() => { /* reconciliation failure does not block payroll */ });
  }

  return {
    referenceNumbers,
    totalRecords: pending.rows.length,
    mdaCount: mdaGroups.size,
    period,
  };
}

// ─── Reference Number Generation ─────────────────────────────────────

// Race condition note: concurrent uploads for the same period could read the same
// MAX sequence. The UNIQUE constraint on reference_number prevents duplicate inserts —
// the second transaction would fail cleanly. Acceptable for 1-2 concurrent SUPER_ADMINs.
async function generatePayrollReference(
  period: string,
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
): Promise<string> {
  const prefix = `PAY-${period}-`;

  const refResult = await tx
    .select({ referenceNumber: mdaSubmissions.referenceNumber })
    .from(mdaSubmissions)
    .where(sql`${mdaSubmissions.referenceNumber} LIKE ${prefix + '%'}`)
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

  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
}

// ─── List Payroll Uploads ────────────────────────────────────────────

export async function listPayrollUploads(
  filters: { period?: string },
): Promise<PayrollUploadListItem[]> {
  const conditions = [eq(mdaSubmissions.source, 'payroll')];
  if (filters.period) {
    conditions.push(eq(mdaSubmissions.period, filters.period));
  }

  const rows = await db
    .select({
      period: mdaSubmissions.period,
      referenceNumber: mdaSubmissions.referenceNumber,
      recordCount: mdaSubmissions.recordCount,
      createdAt: mdaSubmissions.createdAt,
      id: mdaSubmissions.id,
    })
    .from(mdaSubmissions)
    .where(and(...conditions))
    .orderBy(desc(mdaSubmissions.createdAt));

  // Group by period + exact createdAt timestamp (confirmPayrollUpload sets the
  // same `now` for all inserts in a batch, so exact match correctly identifies batches)
  const uploadGroups = new Map<string, {
    ids: string[];
    period: string;
    referenceNumbers: string[];
    totalRecords: number;
    createdAt: string;
  }>();

  for (const row of rows) {
    const ts = row.createdAt ? new Date(row.createdAt).toISOString() : '';
    const key = `${row.period}-${ts}`;

    const existing = uploadGroups.get(key);
    if (existing) {
      existing.ids.push(row.id);
      existing.referenceNumbers.push(row.referenceNumber);
      existing.totalRecords += row.recordCount;
    } else {
      uploadGroups.set(key, {
        ids: [row.id],
        period: row.period,
        referenceNumbers: [row.referenceNumber],
        totalRecords: row.recordCount,
        createdAt: ts,
      });
    }
  }

  return [...uploadGroups.values()].map((g) => ({
    id: g.ids[0],
    period: g.period,
    totalRecords: g.totalRecords,
    mdaCount: g.referenceNumbers.length,
    referenceNumbers: g.referenceNumbers,
    createdAt: g.createdAt,
  }));
}

// ─── Get Payroll Upload Detail ───────────────────────────────────────

export async function getPayrollUploadDetail(
  submissionId: string,
): Promise<PayrollUploadDetail> {
  // Get the submission record
  const [submission] = await db
    .select({
      id: mdaSubmissions.id,
      period: mdaSubmissions.period,
      referenceNumber: mdaSubmissions.referenceNumber,
      recordCount: mdaSubmissions.recordCount,
      source: mdaSubmissions.source,
      createdAt: mdaSubmissions.createdAt,
      mdaId: mdaSubmissions.mdaId,
    })
    .from(mdaSubmissions)
    .where(and(eq(mdaSubmissions.id, submissionId), eq(mdaSubmissions.source, 'payroll')));

  if (!submission) {
    throw new AppError(404, 'NOT_FOUND', 'Payroll upload not found');
  }

  // Find all payroll submissions in the same batch — matched by exact createdAt
  // (confirmPayrollUpload sets the same `now` for all inserts in a single upload)
  const ts = submission.createdAt ? new Date(submission.createdAt).toISOString() : '';
  const batchSubmissions = await db
    .select({
      id: mdaSubmissions.id,
      referenceNumber: mdaSubmissions.referenceNumber,
      recordCount: mdaSubmissions.recordCount,
      mdaId: mdaSubmissions.mdaId,
      mdaName: mdas.name,
      mdaCode: mdas.code,
    })
    .from(mdaSubmissions)
    .innerJoin(mdas, eq(mdaSubmissions.mdaId, mdas.id))
    .where(and(
      eq(mdaSubmissions.period, submission.period),
      eq(mdaSubmissions.source, 'payroll'),
      eq(mdaSubmissions.createdAt, submission.createdAt),
    ))
    .orderBy(mdas.name);

  // Single aggregated query for all deduction totals (avoids N+1)
  const batchIds = batchSubmissions.map((s) => s.id);
  const deductionSums = batchIds.length > 0
    ? await db
        .select({
          submissionId: submissionRows.submissionId,
          total: sql<string>`COALESCE(SUM(${submissionRows.amountDeducted}::numeric), 0)`,
        })
        .from(submissionRows)
        .where(inArray(submissionRows.submissionId, batchIds))
        .groupBy(submissionRows.submissionId)
    : [];

  const sumMap = new Map(deductionSums.map((d) => [d.submissionId, d.total]));

  // Build per-MDA breakdown
  const mdaBreakdown: PayrollMdaBreakdown[] = [];
  let totalRecords = 0;

  for (const sub of batchSubmissions) {
    mdaBreakdown.push({
      mdaCode: sub.mdaCode ?? '',
      mdaName: sub.mdaName ?? '',
      recordCount: sub.recordCount,
      totalDeduction: new Decimal(sumMap.get(sub.id) ?? '0').toFixed(2),
    });
    totalRecords += sub.recordCount;
  }

  return {
    id: submissionId,
    period: submission.period,
    totalRecords,
    mdaCount: batchSubmissions.length,
    referenceNumbers: batchSubmissions.map((s) => s.referenceNumber),
    createdAt: ts,
    mdaBreakdown,
  };
}

// ─── Test Helpers (exported for test isolation) ──────────────────────

export const _testHelpers = {
  clearPendingUploads: () => pendingUploads.clear(),
  getPendingUpload: (userId: string) => pendingUploads.get(userId),
};
