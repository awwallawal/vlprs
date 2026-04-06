import XLSX from 'xlsx';
import { eq, and, isNull, desc, sql } from 'drizzle-orm';
import { db } from '../db/index';
import { migrationUploads, migrationRecords, migrationExtraFields, mdas } from '../db/schema';
import { AppError } from '../lib/appError';
import { withMdaScope } from '../lib/mdaScope';
import { VOCABULARY, ROLES } from '@vlprs/shared';
import type { MigrationUploadPreview, SheetPreview, ColumnMappingSuggestion, ConfirmedColumnMapping, SkippedSheet, MultiSheetOverlapResponse, SheetOverlapResult } from '@vlprs/shared';
import { detectHeaderRow } from '../migration/headerDetect';
import { mapColumns, extractRecord } from '../migration/columnMap';
import { detectEra } from '../migration/eraDetect';
import { extractPeriod, type Period } from '../migration/periodExtract';
import { parseFinancialNumber, isSummaryRowMarker } from '../migration/parseUtils';
import type { CanonicalField } from '@vlprs/shared';

const MONTH_LABELS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function formatPeriodLabel(year: number, month: number): string {
  return `${MONTH_LABELS[month - 1] ?? 'Unknown'} ${year}`;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_ROWS_PER_SHEET = 500;
const MIN_MAPPED_COLUMNS = 4; // Sheets with fewer mapped canonical fields are likely summaries

const FINANCIAL_FIELDS: CanonicalField[] = [
  'principal', 'interestTotal', 'totalLoan',
  'monthlyDeduction', 'monthlyInterest', 'monthlyPrincipal',
  'totalInterestPaid', 'totalOutstandingInterest',
  'totalLoanPaid', 'outstandingBalance',
];

const INTEGER_FIELDS: CanonicalField[] = [
  'installmentCount', 'installmentsPaid', 'installmentsOutstanding',
];

const STRING_FIELDS: CanonicalField[] = [
  'remarks', 'startDate', 'endDate', 'employeeNo', 'refId',
  'commencementDate', 'station', 'dateOfBirth', 'dateOfFirstAppointment',
  'gradeLevel',
];

const SKIP_SHEET_PATTERNS = [
  /cooperative/i,
  /housing\s*loan/i,
  /health\s*insurance/i,
  /govt\.?\s*qtrs/i,
  /government\s*quarters/i,
  /shortpayment/i,
  /staff\s*salary/i,
  /^salary$/i,
];

function shouldSkipSheet(sheetName: string): boolean {
  return SKIP_SHEET_PATTERNS.some(p => p.test(sheetName));
}

function hasRealFinancialValue(raw: unknown): boolean {
  if (raw === null || raw === undefined) return false;
  if (typeof raw === 'number') return true;
  const s = String(raw).trim();
  if (s === '' || s === '-' || s === '–' || s === '—' || s === 'N/A' || s === 'NIL') return false;
  return parseFinancialNumber(raw) !== null;
}

export async function previewUpload(
  fileBuffer: Buffer,
  filename: string,
  fileSizeBytes: number,
  mdaId: string,
  userId: string,
  userRole: string,
): Promise<MigrationUploadPreview> {
  if (fileSizeBytes > MAX_FILE_SIZE) {
    throw new AppError(400, 'FILE_TOO_LARGE', VOCABULARY.MIGRATION_FILE_TOO_LARGE);
  }

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(fileBuffer, { cellDates: true });
  } catch {
    throw new AppError(400, 'FILE_PARSE_ERROR', VOCABULARY.MIGRATION_FILE_PARSE_ERROR);
  }

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new AppError(400, 'FILE_NO_SHEETS', VOCABULARY.MIGRATION_FILE_NO_SHEETS);
  }

  const sheets: SheetPreview[] = [];
  const skippedSheets: SkippedSheet[] = [];
  let detectedMda: string | null = null;

  for (const sheetName of workbook.SheetNames) {
    if (shouldSkipSheet(sheetName)) continue;

    const ws = workbook.Sheets[sheetName];
    if (!ws || !ws['!ref']) continue;

    const header = detectHeaderRow(ws);
    if (header.columns.length === 0) continue;

    const mapping = mapColumns(header.rawColumns);

    // Summary sheet filtering: skip sheets with too few mapped canonical fields
    if (mapping.fieldToIndex.size < MIN_MAPPED_COLUMNS) {
      skippedSheets.push({
        name: sheetName,
        reason: `Only ${mapping.fieldToIndex.size} mapped columns — likely summary`,
      });
      continue;
    }

    // Count data rows
    const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, {
      header: 1, defval: null, blankrows: true,
    });
    const dataStartRow = header.headerRowIndex + 1;
    const dataRows = rows.slice(dataStartRow);

    // Check row limit
    if (dataRows.length > MAX_ROWS_PER_SHEET) {
      throw new AppError(400, 'TOO_MANY_ROWS', VOCABULARY.MIGRATION_TOO_MANY_ROWS);
    }

    // Count actual data rows (non-empty, non-summary)
    let dataRowCount = 0;
    for (const row of dataRows) {
      if (!row || row.every(c => c === null || c === undefined || String(c).trim() === '')) continue;
      const nameIdx = mapping.fieldToIndex.get('staffName');
      const snIdx = mapping.fieldToIndex.get('serialNumber');
      const nameValue = nameIdx !== undefined ? row[nameIdx] : null;
      const serialValue = snIdx !== undefined ? row[snIdx] : row[0];
      if (isSummaryRowMarker(nameValue) || isSummaryRowMarker(serialValue)) continue;
      if (!nameValue || String(nameValue).trim() === '') continue;
      dataRowCount++;
    }

    // Detect era
    const nonEmptyCols = header.rawColumns.filter(c => c.length > 0).length;
    const era = detectEra(
      nonEmptyCols,
      mapping.fieldToIndex.has('startDate'),
      mapping.fieldToIndex.has('mda'),
      mapping.fieldToIndex.has('employeeNo'),
    );

    // Extract period
    const periodResult = extractPeriod(sheetName, header.titleRows, filename);
    const period: { year: number; month: number } | null =
      periodResult.periods.length > 0 ? periodResult.periods[0] : null;

    // Try to detect MDA from column data
    if (!detectedMda) {
      const mdaColIdx = mapping.fieldToIndex.get('mda');
      if (mdaColIdx !== undefined) {
        for (const row of dataRows.slice(0, 5)) {
          const val = row[mdaColIdx];
          if (val !== null && val !== undefined && String(val).trim()) {
            detectedMda = String(val).trim();
            break;
          }
        }
      }
    }

    // Build column mapping suggestions
    const columnMappings: ColumnMappingSuggestion[] = header.rawColumns.map((rawCol, idx) => {
      const field = mapping.indexToField.get(idx) || null;
      let confidence: 'high' | 'medium' | 'low' = 'low';
      if (field) {
        confidence = header.confidence === 'high' ? 'high' : 'medium';
      }
      return {
        sourceIndex: idx,
        sourceHeader: rawCol,
        suggestedField: field,
        confidence,
      };
    }).filter(m => m.sourceHeader.trim() !== '');

    sheets.push({
      sheetName,
      headerRow: header.rawColumns.filter(c => c.trim() !== ''),
      columnMappings,
      era,
      period,
      dataRowCount,
      unmappedColumns: mapping.unrecognized,
    });
  }

  if (sheets.length === 0) {
    throw new AppError(400, 'FILE_NO_DATA', VOCABULARY.MIGRATION_FILE_NO_DATA);
  }

  // Create upload record
  const uploadSource = userRole === ROLES.MDA_OFFICER ? 'mda_officer' : 'admin';
  const [upload] = await db.insert(migrationUploads).values({
    mdaId,
    uploadedBy: userId,
    filename,
    fileSizeBytes,
    sheetCount: sheets.length,
    totalRecords: 0,
    status: 'uploaded',
    uploadSource,
    eraDetected: sheets[0]?.era ?? null,
    metadata: { sheets: sheets.map(s => ({ name: s.sheetName, era: s.era, dataRows: s.dataRowCount, period: s.period })) },
  }).returning({ id: migrationUploads.id });

  return {
    uploadId: upload.id,
    filename,
    sheets,
    detectedMda,
    skippedSheets,
  };
}

export async function confirmMapping(
  uploadId: string,
  confirmedMappings: ConfirmedColumnMapping[],
  fileBuffer: Buffer,
): Promise<{ totalRecords: number; recordsPerSheet: Array<{ sheetName: string; count: number; era: number; periodYear: number | null; periodMonth: number | null }>; skippedRows: Array<{ row: number; sheet: string; reason: string }> }> {
  // Verify upload exists and is in correct state
  const [upload] = await db.select()
    .from(migrationUploads)
    .where(and(eq(migrationUploads.id, uploadId), isNull(migrationUploads.deletedAt)));

  if (!upload) {
    throw new AppError(404, 'UPLOAD_NOT_FOUND', VOCABULARY.MIGRATION_UPLOAD_NOT_FOUND);
  }
  if (upload.status !== 'uploaded' && upload.status !== 'mapped') {
    throw new AppError(400, 'UPLOAD_ALREADY_PROCESSED', VOCABULARY.MIGRATION_UPLOAD_ALREADY_PROCESSED);
  }
  if (fileBuffer.length !== upload.fileSizeBytes) {
    throw new AppError(400, 'FILE_MISMATCH', VOCABULARY.MIGRATION_FILE_MISMATCH);
  }

  // Use the MDA from the original upload record — not user-supplied
  const mdaId = upload.mdaId;

  // Period overlap guard: check ALL sheet periods (Story 8.0d — multi-sheet)
  const uploadMeta = upload.metadata as { sheets?: Array<{ name?: string; period?: { year: number; month: number } | null }>; overlapConfirmed?: boolean } | null;
  if (!uploadMeta?.overlapConfirmed) {
    const sheetEntries = uploadMeta?.sheets ?? [];
    // Collect unique periods from ALL sheets, deduplicating
    const uniquePeriods = new Map<string, { periodYear: number; periodMonth: number; sheetNames: string[] }>();
    const skippedSheets: Array<{ sheetName: string; reason: string }> = [];

    for (const sheet of sheetEntries) {
      const sheetName = sheet.name ?? 'Unknown';
      if (!sheet.period) {
        skippedSheets.push({ sheetName, reason: 'Period not detected' });
        continue;
      }
      const key = `${sheet.period.year}-${sheet.period.month}`;
      const existing = uniquePeriods.get(key);
      if (existing) {
        existing.sheetNames.push(sheetName);
      } else {
        uniquePeriods.set(key, { periodYear: sheet.period.year, periodMonth: sheet.period.month, sheetNames: [sheetName] });
      }
    }

    if (uniquePeriods.size > 0) {
      const results: SheetOverlapResult[] = [];
      let hasOverlap = false;

      for (const [, entry] of uniquePeriods) {
        const overlapResult = await checkPeriodOverlap(uploadId, entry.periodYear, entry.periodMonth);
        const overlaps = !!(overlapResult && overlapResult.overlap);
        if (overlaps) hasOverlap = true;

        results.push({
          sheetNames: entry.sheetNames,
          periodYear: entry.periodYear,
          periodMonth: entry.periodMonth,
          periodLabel: formatPeriodLabel(entry.periodYear, entry.periodMonth),
          overlap: overlaps,
          existingUploadId: overlapResult?.existingUploadId,
          existingFilename: overlapResult?.existingFilename,
          existingRecordCount: overlapResult?.existingRecordCount,
        });
      }

      if (hasOverlap) {
        const response: MultiSheetOverlapResponse = { hasOverlap, results, skippedSheets };
        throw new AppError(409, 'PERIOD_OVERLAP', JSON.stringify(response));
      }
    }
  }

  // Update status to processing
  await db.update(migrationUploads)
    .set({ status: 'processing', updatedAt: new Date() })
    .where(eq(migrationUploads.id, uploadId));

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(fileBuffer, { cellDates: true });
  } catch {
    await db.update(migrationUploads)
      .set({ status: 'failed', updatedAt: new Date() })
      .where(eq(migrationUploads.id, uploadId));
    throw new AppError(400, 'FILE_PARSE_ERROR', VOCABULARY.MIGRATION_FILE_PARSE_ERROR);
  }

  const recordsPerSheet: Array<{ sheetName: string; count: number; era: number; periodYear: number | null; periodMonth: number | null }> = [];
  const skippedRows: Array<{ row: number; sheet: string; reason: string }> = [];
  let totalRecords = 0;

  try {
    // Atomic transaction: all records or none
    await db.transaction(async (tx) => {
      for (const sheetMapping of confirmedMappings) {
        const ws = workbook.Sheets[sheetMapping.sheetName];
        if (!ws || !ws['!ref']) continue;
        if (shouldSkipSheet(sheetMapping.sheetName)) continue;

        const header = detectHeaderRow(ws);
        if (header.columns.length === 0) continue;

        // Build mapping from confirmed mappings
        const indexToField = new Map<number, CanonicalField>();
        const fieldToIndex = new Map<CanonicalField, number>();
        const unrecognizedIndices = new Set<number>();

        for (const m of sheetMapping.mappings) {
          if (m.canonicalField) {
            const field = m.canonicalField as CanonicalField;
            if (!fieldToIndex.has(field)) {
              indexToField.set(m.sourceIndex, field);
              fieldToIndex.set(field, m.sourceIndex);
            }
          } else {
            unrecognizedIndices.add(m.sourceIndex);
          }
        }

        // Summary sheet filtering: skip sheets with too few mapped canonical fields
        if (fieldToIndex.size < MIN_MAPPED_COLUMNS) continue;

        const mapping = { indexToField, fieldToIndex, unrecognized: [] as Array<{ index: number; name: string }> };
        // Track unrecognized columns for extra fields
        for (const idx of unrecognizedIndices) {
          const colName = header.rawColumns[idx] || `Column ${idx}`;
          mapping.unrecognized.push({ index: idx, name: colName });
        }

        // Detect era and period
        const nonEmptyCols = header.rawColumns.filter(c => c.length > 0).length;
        const era = detectEra(
          nonEmptyCols,
          fieldToIndex.has('startDate'),
          fieldToIndex.has('mda'),
          fieldToIndex.has('employeeNo'),
        );

        const periodResult = extractPeriod(sheetMapping.sheetName, header.titleRows, upload.filename);
        const period: Period | null = periodResult.periods.length > 0 ? periodResult.periods[0] : null;

        // Parse data rows
        const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, {
          header: 1, defval: null, blankrows: true,
        });
        const dataStartRow = header.headerRowIndex + 1;
        const dataRows = rows.slice(dataStartRow);

        const sheetRecordInserts: Array<typeof migrationRecords.$inferInsert> = [];
        const sheetExtraFieldInserts: Array<{ recordIndex: number; fieldName: string; fieldValue: string | null; sourceHeader: string }> = [];

        for (let i = 0; i < dataRows.length; i++) {
          const row = dataRows[i];
          const excelRow = dataStartRow + i + 1; // 1-based Excel row

          // Skip empty rows
          if (!row || row.every(c => c === null || c === undefined || String(c).trim() === '')) {
            continue;
          }

          // Skip summary rows
          const nameValue = fieldToIndex.has('staffName')
            ? row[fieldToIndex.get('staffName')!]
            : null;
          const serialValue = fieldToIndex.has('serialNumber')
            ? row[fieldToIndex.get('serialNumber')!]
            : row[0];

          if (isSummaryRowMarker(nameValue) || isSummaryRowMarker(serialValue)) {
            skippedRows.push({ row: excelRow, sheet: sheetMapping.sheetName, reason: 'Summary/total row' });
            continue;
          }

          // Skip rows with non-numeric serial number that look like headers/dividers
          if (serialValue !== null && serialValue !== undefined) {
            const sn = Number(serialValue);
            if (isNaN(sn) && typeof serialValue === 'string' && serialValue.trim().length > 0) {
              if (isSummaryRowMarker(serialValue)) {
                skippedRows.push({ row: excelRow, sheet: sheetMapping.sheetName, reason: 'Summary row marker' });
                continue;
              }
            }
          }

          // Extract canonical record
          const rawRecord = extractRecord(row, mapping);

          // Must have staff name
          const staffName = rawRecord.staffName;
          if (!staffName || String(staffName).trim() === '') {
            continue;
          }

          const staffNameStr = String(staffName).trim();

          // Filter: duplicate header rows
          const HEADER_NAMES = ['NAME', 'NAMES', 'STAFF NAME', 'STAFF NAMES', 'SURNAME, OTHER NAMES'];
          const SN_HEADERS = ['S/N', 'S/NO', 'S/NO.', 'SN'];
          if (HEADER_NAMES.includes(staffNameStr.toUpperCase())) {
            skippedRows.push({ row: excelRow, sheet: sheetMapping.sheetName, reason: 'Duplicate header row' });
            continue;
          }
          if (rawRecord.serialNumber !== null && rawRecord.serialNumber !== undefined &&
              SN_HEADERS.includes(String(rawRecord.serialNumber).trim().toUpperCase())) {
            skippedRows.push({ row: excelRow, sheet: sheetMapping.sheetName, reason: 'Duplicate header row' });
            continue;
          }

          // Filter: section headers — have name but no serial number and no financial data
          const hasSerialNumber = rawRecord.serialNumber !== null && rawRecord.serialNumber !== undefined &&
            !isNaN(Number(rawRecord.serialNumber));
          const hasAnyFinancial = FINANCIAL_FIELDS.some(f => hasRealFinancialValue(rawRecord[f]));
          if (!hasSerialNumber && !hasAnyFinancial) {
            skippedRows.push({ row: excelRow, sheet: sheetMapping.sheetName, reason: 'Section header or annotation' });
            continue;
          }

          // Parse financial fields
          const recordInsert: typeof migrationRecords.$inferInsert = {
            uploadId,
            mdaId,
            mdaText: rawRecord.mda !== null && rawRecord.mda !== undefined
              ? String(rawRecord.mda).trim() || null : null,
            sheetName: sheetMapping.sheetName,
            rowNumber: excelRow,
            era,
            periodYear: period?.year ?? null,
            periodMonth: period?.month ?? null,
            serialNumber: rawRecord.serialNumber !== null && rawRecord.serialNumber !== undefined
              ? String(rawRecord.serialNumber).trim() || null : null,
            staffName: staffNameStr,
            sourceFile: upload.filename,
            sourceSheet: sheetMapping.sheetName,
            sourceRow: excelRow,
          };

          // Financial fields
          for (const field of FINANCIAL_FIELDS) {
            const parsed = parseFinancialNumber(rawRecord[field]);
            (recordInsert as Record<string, unknown>)[field] = parsed;
          }

          // Integer fields
          for (const field of INTEGER_FIELDS) {
            const parsed = parseFinancialNumber(rawRecord[field]);
            (recordInsert as Record<string, unknown>)[field] = parsed !== null ? Math.round(Number(parsed)) : null;
          }

          // String fields
          for (const field of STRING_FIELDS) {
            const val = rawRecord[field];
            (recordInsert as Record<string, unknown>)[field] = val !== null && val !== undefined ? String(val).trim() || null : null;
          }

          const recordIndex = sheetRecordInserts.length;
          sheetRecordInserts.push(recordInsert);

          // Extra fields (unrecognized columns)
          for (const unrec of mapping.unrecognized) {
            const val = row[unrec.index];
            if (val !== null && val !== undefined && String(val).trim() !== '') {
              sheetExtraFieldInserts.push({
                recordIndex,
                fieldName: unrec.name.toLowerCase().replace(/\s+/g, '_'),
                fieldValue: String(val).trim(),
                sourceHeader: unrec.name,
              });
            }
          }
        }

        // Batch insert records
        if (sheetRecordInserts.length > 0) {
          const insertedRecords = await tx.insert(migrationRecords)
            .values(sheetRecordInserts)
            .returning({ id: migrationRecords.id });

          // Batch insert extra fields
          const extraFieldInserts = sheetExtraFieldInserts.map(ef => ({
            recordId: insertedRecords[ef.recordIndex].id,
            fieldName: ef.fieldName,
            fieldValue: ef.fieldValue,
            sourceHeader: ef.sourceHeader,
          }));

          if (extraFieldInserts.length > 0) {
            await tx.insert(migrationExtraFields).values(extraFieldInserts);
          }

          totalRecords += insertedRecords.length;
        }

        recordsPerSheet.push({
          sheetName: sheetMapping.sheetName,
          count: sheetRecordInserts.length,
          era,
          periodYear: period?.year ?? null,
          periodMonth: period?.month ?? null,
        });
      }

      // Update upload record — MDA officer uploads go to pending_verification (Story 15.0f)
      const completedStatus = upload.uploadSource === 'mda_officer' ? 'pending_verification' as const : 'completed' as const;
      await tx.update(migrationUploads).set({
        status: completedStatus,
        totalRecords,
        sheetCount: recordsPerSheet.length,
        metadata: {
          confirmedMappings,
          recordsPerSheet,
          skippedRows: skippedRows.length,
        },
        updatedAt: new Date(),
      }).where(eq(migrationUploads.id, uploadId));
    });
  } catch (err) {
    // Mark as failed if not already an AppError
    if (!(err instanceof AppError)) {
      await db.update(migrationUploads)
        .set({ status: 'failed', updatedAt: new Date() })
        .where(eq(migrationUploads.id, uploadId));
    }
    throw err;
  }

  return { totalRecords, recordsPerSheet, skippedRows };
}

// ─── Federated Upload: Admin Approve/Reject (Story 15.0f) ──────────

/**
 * Approve a pending_verification upload — advances to 'validated'.
 * Wrapped in a transaction to prevent TOCTOU race between status check and update.
 */
export async function approveUpload(uploadId: string, approvedByUserId: string, mdaScope?: string | null) {
  return db.transaction(async (tx) => {
    const [upload] = await tx.select()
      .from(migrationUploads)
      .where(and(
        eq(migrationUploads.id, uploadId),
        isNull(migrationUploads.deletedAt),
        withMdaScope(migrationUploads.mdaId, mdaScope),
      ));

    if (!upload) {
      throw new AppError(404, 'UPLOAD_NOT_FOUND', 'Upload not found.');
    }
    if (upload.status !== 'pending_verification') {
      throw new AppError(400, 'INVALID_STATUS', `Cannot approve upload with status "${upload.status}". Only pending_verification uploads can be approved.`);
    }

    const existingMeta = (upload.metadata ?? {}) as Record<string, unknown>;
    await tx.update(migrationUploads).set({
      status: 'validated',
      metadata: {
        ...existingMeta,
        approvedAt: new Date().toISOString(),
        approvedBy: approvedByUserId,
      },
      updatedAt: new Date(),
    }).where(eq(migrationUploads.id, uploadId));

    return { uploadId, status: 'validated' as const };
  });
}

/**
 * Reject a pending_verification upload — marks as 'rejected' with reason.
 * Wrapped in a transaction to prevent TOCTOU race between status check and update.
 */
export async function rejectUpload(uploadId: string, rejectedByUserId: string, reason: string, mdaScope?: string | null) {
  return db.transaction(async (tx) => {
    const [upload] = await tx.select()
      .from(migrationUploads)
      .where(and(
        eq(migrationUploads.id, uploadId),
        isNull(migrationUploads.deletedAt),
        withMdaScope(migrationUploads.mdaId, mdaScope),
      ));

    if (!upload) {
      throw new AppError(404, 'UPLOAD_NOT_FOUND', 'Upload not found.');
    }
    if (upload.status !== 'pending_verification') {
      throw new AppError(400, 'INVALID_STATUS', `Cannot reject upload with status "${upload.status}". Only pending_verification uploads can be rejected.`);
    }

    const existingMeta = (upload.metadata ?? {}) as Record<string, unknown>;
    await tx.update(migrationUploads).set({
      status: 'rejected',
      metadata: {
        ...existingMeta,
        rejectionReason: reason,
        rejectedAt: new Date().toISOString(),
        rejectedBy: rejectedByUserId,
      },
      updatedAt: new Date(),
    }).where(eq(migrationUploads.id, uploadId));

    return { uploadId, status: 'rejected' as const, reason };
  });
}

/**
 * Check for period overlap before confirming a migration upload.
 * Returns overlap info if existing records exist for the same period+MDA.
 *
 * @param periodYear - Period year from the preview response (required for accurate check)
 * @param periodMonth - Period month from the preview response (required for accurate check)
 */
export async function checkPeriodOverlap(
  uploadId: string,
  periodYear?: number,
  periodMonth?: number,
): Promise<{
  overlap: boolean;
  existingUploadId?: string;
  existingFilename?: string;
  existingRecordCount?: number;
  newRecordCount?: number;
  period?: string;
  mdaName?: string;
} | null> {
  const [upload] = await db.select()
    .from(migrationUploads)
    .where(and(eq(migrationUploads.id, uploadId), isNull(migrationUploads.deletedAt)));

  if (!upload) return null;

  const mdaId = upload.mdaId;

  // Get MDA name
  const [mda] = await db
    .select({ name: mdas.name })
    .from(mdas)
    .where(eq(mdas.id, mdaId));
  const mdaName = mda?.name ?? 'Unknown MDA';

  // Build conditions: same MDA, different upload, completed status
  const conditions = [
    eq(migrationRecords.mdaId, mdaId),
    sql`${migrationRecords.uploadId} != ${uploadId}`,
    eq(migrationUploads.status, 'completed'),
    isNull(migrationRecords.deletedAt),
  ];

  // Filter by period if provided (required for accurate overlap detection)
  if (periodYear !== undefined && periodMonth !== undefined) {
    conditions.push(eq(migrationRecords.periodYear, periodYear));
    conditions.push(eq(migrationRecords.periodMonth, periodMonth));
  }

  // Find existing records for same period+MDA (from OTHER completed uploads)
  const existingRecords = await db
    .select({
      uploadId: migrationRecords.uploadId,
      filename: migrationUploads.filename,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(migrationRecords)
    .innerJoin(migrationUploads, eq(migrationRecords.uploadId, migrationUploads.id))
    .where(and(...conditions))
    .groupBy(migrationRecords.uploadId, migrationUploads.filename)
    .limit(1);

  if (existingRecords.length === 0) {
    return { overlap: false };
  }

  // Get current upload's record count from metadata
  const uploadMeta = upload.metadata as { sheets?: Array<{ dataRows?: number }> } | null;
  const newRecordCount = (uploadMeta?.sheets ?? []).reduce((sum, s) => sum + (s.dataRows ?? 0), 0);

  const period = periodYear !== undefined && periodMonth !== undefined
    ? `${periodYear}-${String(periodMonth).padStart(2, '0')}`
    : 'Unknown period';

  return {
    overlap: true,
    existingUploadId: existingRecords[0].uploadId,
    existingFilename: existingRecords[0].filename,
    existingRecordCount: existingRecords[0].count,
    newRecordCount,
    period,
    mdaName,
  };
}

/**
 * Confirm an overlap and allow the upload to proceed.
 * Updates the upload status to allow confirmMapping to proceed.
 */
export async function confirmOverlap(
  uploadId: string,
): Promise<{ confirmed: boolean }> {
  const [upload] = await db.select()
    .from(migrationUploads)
    .where(and(eq(migrationUploads.id, uploadId), isNull(migrationUploads.deletedAt)));

  if (!upload) {
    throw new AppError(404, 'UPLOAD_NOT_FOUND', VOCABULARY.MIGRATION_UPLOAD_NOT_FOUND);
  }

  // Mark as overlap-confirmed in metadata
  await db.update(migrationUploads)
    .set({
      metadata: { ...((upload.metadata as Record<string, unknown>) ?? {}), overlapConfirmed: true },
      updatedAt: new Date(),
    })
    .where(eq(migrationUploads.id, uploadId));

  return { confirmed: true };
}

/**
 * Check period overlap for multiple sheets at once (Story 8.0d).
 * Used by the POST /check-overlap endpoint.
 */
export async function checkMultiSheetOverlap(
  uploadId: string,
  sheetPeriods: Array<{ sheetName: string; periodYear: number; periodMonth: number }>,
): Promise<MultiSheetOverlapResponse> {
  // Deduplicate periods across sheets
  const uniquePeriods = new Map<string, { periodYear: number; periodMonth: number; sheetNames: string[] }>();
  for (const sp of sheetPeriods) {
    const key = `${sp.periodYear}-${sp.periodMonth}`;
    const existing = uniquePeriods.get(key);
    if (existing) {
      existing.sheetNames.push(sp.sheetName);
    } else {
      uniquePeriods.set(key, { periodYear: sp.periodYear, periodMonth: sp.periodMonth, sheetNames: [sp.sheetName] });
    }
  }

  const results: SheetOverlapResult[] = [];
  let hasOverlap = false;

  for (const [, entry] of uniquePeriods) {
    const overlapResult = await checkPeriodOverlap(uploadId, entry.periodYear, entry.periodMonth);
    const overlaps = !!(overlapResult && overlapResult.overlap);
    if (overlaps) hasOverlap = true;

    results.push({
      sheetNames: entry.sheetNames,
      periodYear: entry.periodYear,
      periodMonth: entry.periodMonth,
      periodLabel: formatPeriodLabel(entry.periodYear, entry.periodMonth),
      overlap: overlaps,
      existingUploadId: overlapResult?.existingUploadId,
      existingFilename: overlapResult?.existingFilename,
      existingRecordCount: overlapResult?.existingRecordCount,
    });
  }

  return { hasOverlap, results, skippedSheets: [] };
}

const DISCARDABLE_STATUSES = ['uploaded', 'mapped', 'failed'] as const;

export async function discardUpload(
  uploadId: string,
  mdaScope: string | null | undefined,
): Promise<{ discarded: true; recordsAffected: number }> {
  const now = new Date();
  let recordsAffected = 0;

  await db.transaction(async (tx) => {
    const [upload] = await tx.select()
      .from(migrationUploads)
      .where(and(
        eq(migrationUploads.id, uploadId),
        isNull(migrationUploads.deletedAt),
        withMdaScope(migrationUploads.mdaId, mdaScope),
      ));

    if (!upload) {
      throw new AppError(404, 'UPLOAD_NOT_FOUND', VOCABULARY.MIGRATION_UPLOAD_NOT_FOUND);
    }

    if (!(DISCARDABLE_STATUSES as readonly string[]).includes(upload.status)) {
      throw new AppError(409, 'UPLOAD_CANNOT_BE_DISCARDED', VOCABULARY.UPLOAD_CANNOT_BE_DISCARDED);
    }

    // Soft-delete migration records
    const result = await tx.update(migrationRecords)
      .set({ deletedAt: now })
      .where(and(eq(migrationRecords.uploadId, uploadId), isNull(migrationRecords.deletedAt)));
    recordsAffected = result.rowCount ?? 0;

    // Soft-delete the upload
    await tx.update(migrationUploads)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(migrationUploads.id, uploadId));
  });

  return { discarded: true, recordsAffected };
}

export async function getUpload(uploadId: string, mdaScope: string | null | undefined) {
  const conditions = [
    eq(migrationUploads.id, uploadId),
    isNull(migrationUploads.deletedAt),
    withMdaScope(migrationUploads.mdaId, mdaScope),
  ];

  const [upload] = await db.select({
    id: migrationUploads.id,
    mdaId: migrationUploads.mdaId,
    mdaName: mdas.name,
    uploadedBy: migrationUploads.uploadedBy,
    filename: migrationUploads.filename,
    fileSizeBytes: migrationUploads.fileSizeBytes,
    sheetCount: migrationUploads.sheetCount,
    totalRecords: migrationUploads.totalRecords,
    status: migrationUploads.status,
    eraDetected: migrationUploads.eraDetected,
    metadata: migrationUploads.metadata,
    createdAt: migrationUploads.createdAt,
    updatedAt: migrationUploads.updatedAt,
    supersededBy: migrationUploads.supersededBy,
    supersededAt: migrationUploads.supersededAt,
    supersededReason: migrationUploads.supersededReason,
  })
    .from(migrationUploads)
    .innerJoin(mdas, eq(migrationUploads.mdaId, mdas.id))
    .where(and(...conditions));

  if (!upload) {
    throw new AppError(404, 'UPLOAD_NOT_FOUND', VOCABULARY.MIGRATION_UPLOAD_NOT_FOUND);
  }

  return upload;
}

export async function listUploads(
  filters: { page: number; limit: number; status?: string },
  mdaScope: string | null | undefined,
) {
  const conditions = [
    isNull(migrationUploads.deletedAt),
    withMdaScope(migrationUploads.mdaId, mdaScope),
  ];

  if (filters.status) {
    conditions.push(eq(migrationUploads.status, filters.status as 'uploaded' | 'mapped' | 'processing' | 'completed' | 'pending_verification' | 'validated' | 'reconciled' | 'failed' | 'rejected'));
  }

  const offset = (filters.page - 1) * filters.limit;

  const [countResult] = await db.select({ count: sql<number>`count(*)::int` })
    .from(migrationUploads)
    .where(and(...conditions));

  const data = await db.select({
    id: migrationUploads.id,
    mdaId: migrationUploads.mdaId,
    mdaName: mdas.name,
    filename: migrationUploads.filename,
    sheetCount: migrationUploads.sheetCount,
    totalRecords: migrationUploads.totalRecords,
    status: migrationUploads.status,
    eraDetected: migrationUploads.eraDetected,
    createdAt: migrationUploads.createdAt,
    supersededBy: migrationUploads.supersededBy,
    supersededAt: migrationUploads.supersededAt,
    supersededByFilename: sql<string | null>`(SELECT filename FROM migration_uploads WHERE id = ${migrationUploads.supersededBy})`,
    uploadSource: migrationUploads.uploadSource,
    metadata: migrationUploads.metadata,
  })
    .from(migrationUploads)
    .innerJoin(mdas, eq(migrationUploads.mdaId, mdas.id))
    .where(and(...conditions))
    .orderBy(desc(migrationUploads.createdAt))
    .limit(filters.limit)
    .offset(offset);

  return {
    data,
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total: countResult?.count ?? 0,
      totalPages: Math.ceil((countResult?.count ?? 0) / filters.limit),
    },
  };
}
