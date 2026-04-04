import XLSX from 'xlsx';
import { eq, and, isNull, isNotNull } from 'drizzle-orm';
import { db } from '../db/index';
import { migrationRecords, migrationUploads, mdas } from '../db/schema';
import { AppError } from '../lib/appError';
import { VOCABULARY } from '@vlprs/shared';
import type { CorrectionWorksheetPreview } from '@vlprs/shared';
import { markReviewedNoCorrection } from './mdaReviewService';
import { correctRecord } from './migrationValidationService';

// ─── XLSX Export (AC: 5) ────────────────────────────────────────────

export async function generateCorrectionWorksheet(
  uploadId: string,
  mdaScope: string | null | undefined,
): Promise<Buffer> {
  // Verify upload
  const [upload] = await db
    .select()
    .from(migrationUploads)
    .where(
      and(
        eq(migrationUploads.id, uploadId),
        isNull(migrationUploads.deletedAt),
      ),
    );

  if (!upload) {
    throw new AppError(404, 'UPLOAD_NOT_FOUND', VOCABULARY.MIGRATION_UPLOAD_NOT_FOUND);
  }

  // Fetch flagged records
  const conditions = [
    eq(migrationRecords.uploadId, uploadId),
    isNotNull(migrationRecords.flaggedForReviewAt),
    isNull(migrationRecords.correctedBy), // Only pending records
    isNull(migrationRecords.deletedAt),
  ];

  if (mdaScope) {
    conditions.push(eq(migrationRecords.mdaId, mdaScope));
  }

  const rows = await db
    .select({
      id: migrationRecords.id,
      staffName: migrationRecords.staffName,
      employeeNo: migrationRecords.employeeNo,
      gradeLevel: migrationRecords.gradeLevel,
      mdaName: mdas.name,
      outstandingBalance: migrationRecords.outstandingBalance,
      totalLoan: migrationRecords.totalLoan,
      monthlyDeduction: migrationRecords.monthlyDeduction,
      schemeExpectedTotalLoan: migrationRecords.schemeExpectedTotalLoan,
      schemeExpectedMonthlyDeduction: migrationRecords.schemeExpectedMonthlyDeduction,
      varianceCategory: migrationRecords.varianceCategory,
      varianceAmount: migrationRecords.varianceAmount,
      mdaId: migrationRecords.mdaId,
    })
    .from(migrationRecords)
    .leftJoin(mdas, eq(migrationRecords.mdaId, mdas.id))
    .where(and(...conditions))
    .orderBy(migrationRecords.staffName);

  if (rows.length === 0) {
    throw new AppError(404, 'NO_FLAGGED_RECORDS', 'No pending flagged records found for this upload.');
  }

  const wb = XLSX.utils.book_new();

  // "Corrections" sheet — reference columns + empty correction columns
  const correctionsData = rows.map((r) => ({
    'Record ID': r.id,
    'Staff Name': r.staffName,
    'Staff ID': r.employeeNo ?? '',
    'Grade Level': r.gradeLevel ?? '',
    'MDA': r.mdaName ?? '',
    'Declared Outstanding Balance': r.outstandingBalance ?? '',
    'Declared Total Loan': r.totalLoan ?? '',
    'Declared Monthly Deduction': r.monthlyDeduction ?? '',
    'Scheme Expected Total Loan': r.schemeExpectedTotalLoan ?? '',
    'Scheme Expected Monthly Deduction': r.schemeExpectedMonthlyDeduction ?? '',
    'Variance Category': r.varianceCategory ?? '',
    'Variance Amount': r.varianceAmount ?? '',
    'Corrected Outstanding Balance': '',
    'Corrected Total Loan': '',
    'Corrected Monthly Deduction': '',
    'Corrected Installment Count': '',
    'Corrected Installments Paid': '',
    'Corrected Installments Outstanding': '',
    'Correction Reason': '',
  }));
  const ws1 = XLSX.utils.json_to_sheet(correctionsData);
  XLSX.utils.book_append_sheet(wb, ws1, 'Corrections');

  // "Instructions" sheet — static text
  const instructionsContent = [
    ['Correction Worksheet Instructions'],
    [''],
    ['This worksheet contains migration records that require your review before baseline establishment.'],
    [''],
    ['HOW TO USE:'],
    ['1. Review each record in the "Corrections" sheet.'],
    ['2. If a value needs correction, enter the correct value in the corresponding "Corrected" column.'],
    ['3. The "Correction Reason" column is MANDATORY for every record you review (minimum 10 characters).'],
    ['4. If a record\'s values are correct as-is, leave the correction columns blank but still provide a reason'],
    ['   (e.g., "Values verified against source documents — no correction needed").'],
    ['5. Records with no Correction Reason will be SKIPPED (not processed).'],
    [''],
    ['COLUMN DESCRIPTIONS:'],
    ['- Record ID: Unique identifier (DO NOT modify)'],
    ['- Reference columns (Staff Name through Variance Amount): Read-only context'],
    ['- Corrected columns: Enter corrected values here (leave blank if no correction needed)'],
    ['- Correction Reason: Explain why corrections are being made OR why values are correct (REQUIRED)'],
    [''],
    ['IMPORTANT:'],
    ['- Do NOT modify the Record ID column'],
    ['- Do NOT add or remove rows'],
    ['- Do NOT rename sheets or columns'],
    ['- Records already baselined by the time of upload will be flagged as conflicts'],
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(instructionsContent);
  XLSX.utils.book_append_sheet(wb, ws2, 'Instructions');

  // "Metadata" sheet — hidden, for conflict detection
  const mdaId = mdaScope ?? rows[0]?.mdaId ?? '';
  const metadata = [{
    downloadedAt: new Date().toISOString(),
    uploadId,
    mdaId,
    recordCount: rows.length,
  }];
  const ws3 = XLSX.utils.json_to_sheet(metadata);
  XLSX.utils.book_append_sheet(wb, ws3, 'Metadata');

  // Hide the Metadata sheet
  if (!wb.Workbook) wb.Workbook = {};
  if (!wb.Workbook.Sheets) wb.Workbook.Sheets = [];
  wb.Workbook.Sheets = [
    { Hidden: 0 }, // Corrections — visible
    { Hidden: 0 }, // Instructions — visible
    { Hidden: 2 }, // Metadata — very hidden
  ];

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return buffer;
}

// ─── XLSX Import + Preview (AC: 6) ─────────────────────────────────

export async function parseCorrectionWorksheet(
  buffer: Buffer,
  uploadId: string,
  mdaScope: string | null | undefined,
): Promise<CorrectionWorksheetPreview> {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { cellDates: true });
  } catch {
    throw new AppError(400, 'INVALID_WORKSHEET', 'Unable to parse the uploaded file. Please use the downloaded worksheet template.');
  }

  const correctionsSheet = wb.Sheets['Corrections'];
  const metadataSheet = wb.Sheets['Metadata'];

  if (!correctionsSheet) {
    throw new AppError(400, 'MISSING_CORRECTIONS_SHEET', 'The uploaded file does not contain a "Corrections" sheet.');
  }

  const corrections = XLSX.utils.sheet_to_json<Record<string, unknown>>(correctionsSheet);
  const metadata = metadataSheet ? XLSX.utils.sheet_to_json<Record<string, unknown>>(metadataSheet) : [];
  const downloadedAt = metadata[0]?.['downloadedAt'] as string | undefined;

  if (!downloadedAt) {
    throw new AppError(400, 'MISSING_METADATA', 'Worksheet metadata is missing. Please use a freshly downloaded worksheet.');
  }

  const downloadDate = new Date(downloadedAt);

  // Fetch current state of all record IDs in the worksheet
  const recordIds = corrections.map((r) => String(r['Record ID'])).filter(Boolean);

  if (recordIds.length === 0) {
    throw new AppError(400, 'EMPTY_WORKSHEET', 'No records found in the worksheet.');
  }

  const parseConditions = [
    eq(migrationRecords.uploadId, uploadId),
    isNull(migrationRecords.deletedAt),
  ];
  if (mdaScope) {
    parseConditions.push(eq(migrationRecords.mdaId, mdaScope));
  }

  const dbRecords = await db
    .select({
      id: migrationRecords.id,
      isBaselineCreated: migrationRecords.isBaselineCreated,
      correctedAt: migrationRecords.correctedAt,
    })
    .from(migrationRecords)
    .where(and(...parseConditions));

  const recordMap = new Map(dbRecords.map((r) => [r.id, r]));

  const preview: CorrectionWorksheetPreview = {
    readyToApply: 0,
    reviewedNoCorrection: 0,
    skipped: 0,
    alreadyBaselined: 0,
    conflicts: 0,
    records: [],
  };

  for (const row of corrections) {
    const recordId = String(row['Record ID'] ?? '');
    const staffName = String(row['Staff Name'] ?? '');
    const reason = row['Correction Reason'] ? String(row['Correction Reason']).trim() : '';
    const dbRecord = recordMap.get(recordId);

    if (!dbRecord) {
      preview.skipped++;
      preview.records.push({ recordId, staffName, category: 'skipped' });
      continue;
    }

    // Already baselined since download
    if (dbRecord.isBaselineCreated) {
      preview.alreadyBaselined++;
      preview.records.push({ recordId, staffName, category: 'baselined' });
      continue;
    }

    // Conflict: modified by another user since download
    if (dbRecord.correctedAt && dbRecord.correctedAt > downloadDate) {
      preview.conflicts++;
      preview.records.push({
        recordId,
        staffName,
        category: 'conflict',
        conflictDetail: `Modified at ${dbRecord.correctedAt.toISOString()} (after worksheet download)`,
      });
      continue;
    }

    // No reason → skipped
    if (!reason || reason.length < 10) {
      preview.skipped++;
      preview.records.push({ recordId, staffName, category: 'skipped' });
      continue;
    }

    // Check if any correction columns have values
    const corrOB = row['Corrected Outstanding Balance'] ? String(row['Corrected Outstanding Balance']).trim() : '';
    const corrTL = row['Corrected Total Loan'] ? String(row['Corrected Total Loan']).trim() : '';
    const corrMD = row['Corrected Monthly Deduction'] ? String(row['Corrected Monthly Deduction']).trim() : '';
    const corrIC = row['Corrected Installment Count'] ? String(row['Corrected Installment Count']).trim() : '';
    const corrIP = row['Corrected Installments Paid'] ? String(row['Corrected Installments Paid']).trim() : '';
    const corrIO = row['Corrected Installments Outstanding'] ? String(row['Corrected Installments Outstanding']).trim() : '';

    const hasCorrections = corrOB || corrTL || corrMD || corrIC || corrIP || corrIO;

    if (hasCorrections) {
      const corrs: Record<string, string | number | null> = {};
      if (corrOB) corrs.outstandingBalance = corrOB;
      if (corrTL) corrs.totalLoan = corrTL;
      if (corrMD) corrs.monthlyDeduction = corrMD;
      if (corrIC) corrs.installmentCount = parseInt(corrIC, 10);
      if (corrIP) corrs.installmentsPaid = parseInt(corrIP, 10);
      if (corrIO) corrs.installmentsOutstanding = parseInt(corrIO, 10);

      preview.readyToApply++;
      preview.records.push({ recordId, staffName, category: 'ready', corrections: corrs, reason });
    } else {
      // Reason provided but no corrections → "reviewed, values correct"
      preview.reviewedNoCorrection++;
      preview.records.push({ recordId, staffName, category: 'reviewed', reason });
    }
  }

  return preview;
}

// ─── Apply Correction Worksheet (AC: 6) ────────────────────────────

export async function applyCorrectionWorksheet(
  uploadId: string,
  preview: CorrectionWorksheetPreview,
  userId: string,
  mdaScope: string | null | undefined,
): Promise<{ applied: number; reviewed: number }> {
  let applied = 0;
  let reviewed = 0;

  await db.transaction(async (tx) => {
    for (const record of preview.records) {
      if (record.category === 'ready' && record.corrections && record.reason) {
        const corrections: {
          outstandingBalance?: string;
          totalLoan?: string;
          monthlyDeduction?: string;
          installmentCount?: number;
          installmentsPaid?: number;
          installmentsOutstanding?: number;
          correctionReason?: string;
        } = {};

        if (record.corrections.outstandingBalance) corrections.outstandingBalance = String(record.corrections.outstandingBalance);
        if (record.corrections.totalLoan) corrections.totalLoan = String(record.corrections.totalLoan);
        if (record.corrections.monthlyDeduction) corrections.monthlyDeduction = String(record.corrections.monthlyDeduction);
        if (record.corrections.installmentCount) corrections.installmentCount = Number(record.corrections.installmentCount);
        if (record.corrections.installmentsPaid) corrections.installmentsPaid = Number(record.corrections.installmentsPaid);
        if (record.corrections.installmentsOutstanding) corrections.installmentsOutstanding = Number(record.corrections.installmentsOutstanding);
        corrections.correctionReason = record.reason;

        await correctRecord(record.recordId, uploadId, corrections, userId, mdaScope, tx);
        applied++;
      } else if (record.category === 'reviewed' && record.reason) {
        await markReviewedNoCorrection(record.recordId, uploadId, record.reason, userId, mdaScope, tx);
        reviewed++;
      }
    }
  });

  return { applied, reviewed };
}
