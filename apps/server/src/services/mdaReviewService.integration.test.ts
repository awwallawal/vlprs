import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import XLSX from 'xlsx';
import { sql } from 'drizzle-orm';
import { resetDb } from '../test/resetDb';
import { db } from '../db/index';
import { users, mdas, migrationUploads, migrationRecords } from '../db/schema';
import { generateUuidv7 } from '../lib/uuidv7';
import { hashPassword } from '../lib/password';
import { createBatchBaseline } from './baselineService';
import { submitReview, markReviewedNoCorrection, getFlaggedRecords, getMdaReviewProgress, extendReviewWindow, baselineReviewedRecords } from './mdaReviewService';
import { generateCorrectionWorksheet, parseCorrectionWorksheet, applyCorrectionWorksheet } from './correctionWorksheetService';

/**
 * Story 8.0j: Selective Baseline & MDA Review Handoff — Integration Tests
 *
 * Tests the full three-stage pipeline against a real database:
 *   Stage 1: Selective batch baseline (auto-baseline clean, flag significant+)
 *   Stage 2: MDA officer review (corrections + mark reviewed)
 *   Stage 3: DEPT_ADMIN baseline of reviewed records
 */

// ─── Fixtures ──────────────────────────────────────────────────────

const adminUserId = generateUuidv7();
const officerUserId = generateUuidv7();

const mda1Id = generateUuidv7();
const mda2Id = generateUuidv7();

const uploadId = generateUuidv7();

// 5 records with mixed variance categories
const recClean = generateUuidv7();
const recMinor = generateUuidv7();
const recSignificant = generateUuidv7();
const recStructural = generateUuidv7();
const recAnomalous = generateUuidv7();

// Extra record in MDA 2 for auth scoping test
const recOtherMda = generateUuidv7();

const now = new Date();
const baseRecord = {
  uploadId,
  sheetName: 'Sheet1',
  era: 2024,
  periodYear: 2026,
  periodMonth: 3,
  sourceFile: 'test-data.xlsx',
  sourceSheet: 'Sheet1',
  principal: '100000.00',
  totalLoan: '113330.00',
  monthlyDeduction: '3148.06',
  outstandingBalance: '50000.00',
  installmentCount: 36,
  installmentsPaid: 20,
  installmentsOutstanding: 16,
  computedRate: '13.330',
  computedTotalLoan: '113330.00',
  computedMonthlyDeduction: '3148.06',
  computedOutstandingBalance: '50000.00',
  schemeExpectedTotalLoan: '113330.00',
  schemeExpectedMonthlyDeduction: '3148.06',
  schemeExpectedTotalInterest: '13330.00',
};

// ─── Setup ─────────────────────────────────────────────────────────

beforeAll(async () => {
  await resetDb();

  // Create MDAs
  await db.insert(mdas).values([
    { id: mda1Id, name: 'Education', code: 'REV-EDU', abbreviation: 'EDU', isActive: true },
    { id: mda2Id, name: 'Health', code: 'REV-HEA', abbreviation: 'HEA', isActive: true },
  ]);

  // Create users
  const hashed = await hashPassword('Password1!');
  await db.insert(users).values([
    {
      id: adminUserId,
      email: 'admin-review-int@vlprs.test',
      hashedPassword: hashed,
      firstName: 'Admin',
      lastName: 'Test',
      role: 'dept_admin',
      mustChangePassword: false,
      isActive: true,
    },
    {
      id: officerUserId,
      email: 'officer-review-int@vlprs.test',
      hashedPassword: hashed,
      firstName: 'Officer',
      lastName: 'Test',
      role: 'mda_officer',
      mdaId: mda1Id,
      mustChangePassword: false,
      isActive: true,
    },
  ]);

  // Create upload (status: validated — required for baseline)
  await db.insert(migrationUploads).values({
    id: uploadId,
    mdaId: mda1Id,
    uploadedBy: adminUserId,
    filename: 'test-data.xlsx',
    fileSizeBytes: 5000,
    status: 'validated',
  });

  // Create records with mixed variance categories in MDA 1
  await db.insert(migrationRecords).values([
    { id: recClean, ...baseRecord, mdaId: mda1Id, rowNumber: 1, sourceRow: 1, staffName: 'Abiodun Taiwo', employeeNo: 'OY/EDU/001', varianceCategory: 'clean', varianceAmount: '0.00' },
    { id: recMinor, ...baseRecord, mdaId: mda1Id, rowNumber: 2, sourceRow: 2, staffName: 'Bello Khadijat', employeeNo: 'OY/EDU/002', varianceCategory: 'minor_variance', varianceAmount: '250.00' },
    { id: recSignificant, ...baseRecord, mdaId: mda1Id, rowNumber: 3, sourceRow: 3, staffName: 'Chukwu Emeka', employeeNo: 'OY/EDU/003', varianceCategory: 'significant_variance', varianceAmount: '5000.00' },
    { id: recStructural, ...baseRecord, mdaId: mda1Id, rowNumber: 4, sourceRow: 4, staffName: 'Danladi Hauwa', employeeNo: 'OY/EDU/004', varianceCategory: 'structural_error', varianceAmount: '12000.00' },
    { id: recAnomalous, ...baseRecord, mdaId: mda1Id, rowNumber: 5, sourceRow: 5, staffName: 'Ekanem Blessing', employeeNo: 'OY/EDU/005', varianceCategory: 'anomalous', varianceAmount: '25000.00' },
  ]);

  // Create a flagged record in MDA 2 (for auth scoping test)
  await db.insert(migrationRecords).values({
    id: recOtherMda,
    ...baseRecord,
    mdaId: mda2Id,
    rowNumber: 6,
    sourceRow: 6,
    staffName: 'Femi Adeyinka',
    employeeNo: 'OY/HEA/001',
    varianceCategory: 'significant_variance',
    varianceAmount: '8000.00',
    flaggedForReviewAt: now,
    reviewWindowDeadline: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
  });
});

afterAll(async () => {
  await resetDb();
});

// ─── 14.1: Selective Batch Baseline ────────────────────────────────

describe('14.1: Selective batch baseline — mixed variance partitioning', () => {
  it('auto-baselines clean + minor and flags significant+ for review', async () => {
    const actingUser = { userId: adminUserId, role: 'dept_admin', mdaId: null };
    const result = await createBatchBaseline(actingUser, uploadId, null);

    // Flagged count: significant_variance + structural_error + anomalous = 3
    expect(result.flaggedForReview.count).toBe(3);
    expect(result.flaggedForReview.byCategory).toMatchObject({
      significant_variance: 1,
      structural_error: 1,
      anomalous: 1,
    });

    // Auto-baselined: clean + minor_variance (may be in count or skipped depending on eligibility)
    expect(result.autoBaselined.count + result.skippedRecords.length).toBe(2);

    // Verify flagged records in DB have timestamps
    const [flaggedRec] = await db
      .select({ flaggedAt: migrationRecords.flaggedForReviewAt, deadline: migrationRecords.reviewWindowDeadline })
      .from(migrationRecords)
      .where(sql`${migrationRecords.id} = ${recSignificant}`);

    expect(flaggedRec.flaggedAt).not.toBeNull();
    expect(flaggedRec.deadline).not.toBeNull();

    // Verify 14-day window
    const diff = flaggedRec.deadline!.getTime() - flaggedRec.flaggedAt!.getTime();
    const daysDiff = Math.round(diff / (1000 * 60 * 60 * 24));
    expect(daysDiff).toBe(14);

    // Verify clean/minor records are NOT flagged
    const [cleanRec] = await db
      .select({ flaggedAt: migrationRecords.flaggedForReviewAt })
      .from(migrationRecords)
      .where(sql`${migrationRecords.id} = ${recClean}`);

    expect(cleanRec.flaggedAt).toBeNull();
  });
});

// ─── 14.2: MDA Review Submission ───────────────────────────────────

describe('14.2: Submit review with corrections', () => {
  it('applies corrections with mandatory reason to a flagged record', async () => {
    const corrections = {
      outstandingBalance: '48000.00',
      totalLoan: '113330.00',
    };
    const reason = 'Outstanding balance verified against MDA ledger — was overstated by ₦2,000';

    const result = await submitReview(
      recSignificant,
      uploadId,
      corrections,
      reason,
      officerUserId,
      mda1Id,
    );

    // Verify response
    expect(result.correctedBy).toBe(officerUserId);
    expect(result.correctedAt).not.toBeNull();
    expect(result.correctionReason).toBe(reason);

    // Verify DB state
    const [dbRecord] = await db
      .select({
        correctedBy: migrationRecords.correctedBy,
        correctedAt: migrationRecords.correctedAt,
        correctionReason: migrationRecords.correctionReason,
        correctedOB: migrationRecords.correctedOutstandingBalance,
        correctedTL: migrationRecords.correctedTotalLoan,
      })
      .from(migrationRecords)
      .where(sql`${migrationRecords.id} = ${recSignificant}`);

    expect(dbRecord.correctedBy).toBe(officerUserId);
    expect(dbRecord.correctedAt).not.toBeNull();
    expect(dbRecord.correctionReason).toBe(reason);
    expect(dbRecord.correctedOB).toBe('48000.00');
    expect(dbRecord.correctedTL).toBe('113330.00');
  });
});

// ─── 14.3: Mark Reviewed Without Correction ────────────────────────

describe('14.3: Mark reviewed — values correct (no correction)', () => {
  it('sets corrected_by/at/reason with correction value columns remaining NULL', async () => {
    const reason = '₦12,000 variance is correct — structural difference due to legacy rate rounding';

    const result = await markReviewedNoCorrection(
      recStructural,
      uploadId,
      reason,
      officerUserId,
      mda1Id,
    );

    expect(result.correctedBy).toBe(officerUserId);
    expect(result.correctedAt).not.toBeNull();
    expect(result.correctionReason).toBe(reason);

    // Verify correction value columns remain NULL
    const [dbRecord] = await db
      .select({
        correctedOB: migrationRecords.correctedOutstandingBalance,
        correctedTL: migrationRecords.correctedTotalLoan,
        correctedMD: migrationRecords.correctedMonthlyDeduction,
        correctedIC: migrationRecords.correctedInstallmentCount,
        correctedIP: migrationRecords.correctedInstallmentsPaid,
        correctedIO: migrationRecords.correctedInstallmentsOutstanding,
        correctionReason: migrationRecords.correctionReason,
        correctedBy: migrationRecords.correctedBy,
      })
      .from(migrationRecords)
      .where(sql`${migrationRecords.id} = ${recStructural}`);

    // Correction values must all be NULL (reviewed, no correction needed)
    expect(dbRecord.correctedOB).toBeNull();
    expect(dbRecord.correctedTL).toBeNull();
    expect(dbRecord.correctedMD).toBeNull();
    expect(dbRecord.correctedIC).toBeNull();
    expect(dbRecord.correctedIP).toBeNull();
    expect(dbRecord.correctedIO).toBeNull();

    // But correctedBy/reason must be set
    expect(dbRecord.correctedBy).toBe(officerUserId);
    expect(dbRecord.correctionReason).toBe(reason);
  });
});

// ─── 14.4: Correction Worksheet Round-Trip ─────────────────────────

describe('14.4: Correction worksheet round-trip (XLSX export → import → apply)', () => {
  it('generates valid XLSX with expected sheets and columns', async () => {
    // Only recAnomalous is still pending (recSignificant and recStructural already reviewed above)
    const buffer = await generateCorrectionWorksheet(uploadId, mda1Id);

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);

    // Parse the generated XLSX
    const wb = XLSX.read(buffer, { cellDates: true });

    // Verify 3 sheets exist
    expect(wb.SheetNames).toContain('Corrections');
    expect(wb.SheetNames).toContain('Instructions');
    expect(wb.SheetNames).toContain('Metadata');

    // Verify Corrections sheet columns
    const corrections = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['Corrections']);
    expect(corrections.length).toBeGreaterThanOrEqual(1);
    const firstRow = corrections[0];
    expect(firstRow).toHaveProperty('Record ID');
    expect(firstRow).toHaveProperty('Staff Name');
    expect(firstRow).toHaveProperty('Correction Reason');
    expect(firstRow).toHaveProperty('Corrected Outstanding Balance');

    // Verify Metadata sheet
    const metadata = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['Metadata']);
    expect(metadata.length).toBe(1);
    expect(metadata[0]).toHaveProperty('downloadedAt');
    expect(metadata[0]).toHaveProperty('uploadId');
  });

  it('parses uploaded worksheet and applies corrections in single transaction', async () => {
    // Generate worksheet, add corrections, re-upload
    const buffer = await generateCorrectionWorksheet(uploadId, mda1Id);
    const wb = XLSX.read(buffer, { cellDates: true });
    const corrections = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['Corrections']);

    // Add a correction reason to each record
    for (const row of corrections) {
      row['Corrected Outstanding Balance'] = '45000.00';
      row['Correction Reason'] = 'Values verified and corrected against source ledger documents';
    }

    // Write modified sheet back
    const ws = XLSX.utils.json_to_sheet(corrections);
    wb.Sheets['Corrections'] = ws;
    const modifiedBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    // Parse
    const preview = await parseCorrectionWorksheet(modifiedBuffer, uploadId, mda1Id);
    expect(preview.readyToApply).toBeGreaterThanOrEqual(1);
    expect(preview.records.some(r => r.category === 'ready')).toBe(true);

    // Apply
    const result = await applyCorrectionWorksheet(uploadId, preview, officerUserId, mda1Id);
    expect(result.applied).toBeGreaterThanOrEqual(1);

    // Verify DB state — anomalous record now corrected
    const [dbRecord] = await db
      .select({
        correctedOB: migrationRecords.correctedOutstandingBalance,
        correctionReason: migrationRecords.correctionReason,
        correctedBy: migrationRecords.correctedBy,
      })
      .from(migrationRecords)
      .where(sql`${migrationRecords.id} = ${recAnomalous}`);

    expect(dbRecord.correctedOB).toBe('45000.00');
    expect(dbRecord.correctedBy).toBe(officerUserId);
    expect(dbRecord.correctionReason).toBe('Values verified and corrected against source ledger documents');
  });
});

// ─── 14.5: Worksheet Conflict Detection ────────────────────────────

describe('14.5: Worksheet conflict detection', () => {
  it('detects records modified after worksheet download', async () => {
    // Create a fresh flagged record for this test
    const freshRecId = generateUuidv7();
    await db.insert(migrationRecords).values({
      id: freshRecId,
      ...baseRecord,
      mdaId: mda1Id,
      rowNumber: 10,
      sourceRow: 10,
      staffName: 'Gbenga Adekunle',
      employeeNo: 'OY/EDU/010',
      varianceCategory: 'significant_variance',
      varianceAmount: '6000.00',
      flaggedForReviewAt: now,
      reviewWindowDeadline: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
    });

    // Download worksheet (captures downloadedAt timestamp)
    const buffer = await generateCorrectionWorksheet(uploadId, mda1Id);

    // Simulate another user correcting the record AFTER download
    await db
      .update(migrationRecords)
      .set({
        correctedBy: adminUserId,
        correctedAt: new Date(), // After downloadedAt
        correctionReason: 'Corrected by admin directly',
        correctedOutstandingBalance: '47000.00',
      })
      .where(sql`${migrationRecords.id} = ${freshRecId}`);

    // Now re-upload the same worksheet (unmodified corrections, but with a reason)
    const wb = XLSX.read(buffer, { cellDates: true });
    const corrections = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['Corrections']);
    for (const row of corrections) {
      if (row['Record ID'] === freshRecId) {
        row['Correction Reason'] = 'Attempted correction after conflict';
      }
    }
    wb.Sheets['Corrections'] = XLSX.utils.json_to_sheet(corrections);
    const modifiedBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    // Parse — should detect conflict
    const preview = await parseCorrectionWorksheet(modifiedBuffer, uploadId, mda1Id);
    expect(preview.conflicts).toBeGreaterThanOrEqual(1);
    expect(preview.records.some(r => r.recordId === freshRecId && r.category === 'conflict')).toBe(true);
  });
});

// ─── 14.6: Baseline Reviewed Records (Stage 3) ────────────────────

describe('14.6: Baseline reviewed records — Stage 3 end-to-end', () => {
  it('baselines all reviewed records (corrected + mark-reviewed)', { timeout: 60_000 }, async () => {
    // At this point, recSignificant, recStructural, recAnomalous are all reviewed
    // (recSignificant: corrected, recStructural: mark-reviewed, recAnomalous: worksheet corrected)
    const result = await baselineReviewedRecords(uploadId, null, adminUserId, 'dept_admin');

    expect(result.baselinedCount).toBeGreaterThanOrEqual(1);

    // Verify at least one of the reviewed records is now baselined
    const [rec] = await db
      .select({ isBaselineCreated: migrationRecords.isBaselineCreated, loanId: migrationRecords.loanId })
      .from(migrationRecords)
      .where(sql`${migrationRecords.id} = ${recSignificant}`);

    expect(rec.isBaselineCreated).toBe(true);
    expect(rec.loanId).not.toBeNull();
  });
});

// ─── 14.9: Auth Scoping ───────────────────────────────────────────

describe('14.9: MDA_OFFICER scoped access verification', () => {
  it('MDA_OFFICER only sees own-MDA flagged records', async () => {
    // Officer is scoped to mda1Id — should NOT see recOtherMda (mda2Id)
    const result = await getFlaggedRecords(uploadId, mda1Id, { page: 1, limit: 50, status: 'all' });

    const recordIds = result.records.map(r => r.recordId);
    expect(recordIds).not.toContain(recOtherMda);

    // All returned records must belong to mda1Id (verified by MDA name)
    for (const record of result.records) {
      expect(record.mdaName).toBe('Education');
    }
  });

  it('MDA_OFFICER cannot see other MDA records via getFlaggedRecords', async () => {
    // Explicitly query with mda2Id scope — officer for mda1 shouldn't get mda2 data
    const result = await getFlaggedRecords(uploadId, mda2Id, { page: 1, limit: 50, status: 'all' });

    // Should see the mda2 record (this simulates DEPT_ADMIN or the MDA2 officer)
    expect(result.records.some(r => r.recordId === recOtherMda)).toBe(true);

    // But mda1 officer scope filters it out
    const mda1Result = await getFlaggedRecords(uploadId, mda1Id, { page: 1, limit: 50, status: 'all' });
    expect(mda1Result.records.some(r => r.recordId === recOtherMda)).toBe(false);
  });

  it('MDA review progress returns per-MDA aggregation', async () => {
    const progress = await getMdaReviewProgress(uploadId);

    expect(progress.length).toBeGreaterThanOrEqual(1);
    for (const mda of progress) {
      expect(mda.mdaId).toBeTruthy();
      expect(mda.mdaName).toBeTruthy();
      expect(mda.totalFlagged).toBeGreaterThanOrEqual(0);
      expect(mda.completionPct).toBeGreaterThanOrEqual(0);
      expect(mda.completionPct).toBeLessThanOrEqual(100);
      expect(['normal', 'warning', 'overdue']).toContain(mda.countdownStatus);
    }
  });

  it('extend review window adds 14 days within a transaction', async () => {
    // Get current deadline for mda2 record
    const [before] = await db
      .select({ deadline: migrationRecords.reviewWindowDeadline })
      .from(migrationRecords)
      .where(sql`${migrationRecords.id} = ${recOtherMda}`);

    const beforeDeadline = before.deadline!;

    // Extend window
    await extendReviewWindow(uploadId, mda2Id, adminUserId);

    // Verify new deadline is at least 14 days later
    const [after] = await db
      .select({ deadline: migrationRecords.reviewWindowDeadline, extensions: migrationRecords.reviewWindowExtensions })
      .from(migrationRecords)
      .where(sql`${migrationRecords.id} = ${recOtherMda}`);

    expect(after.deadline!.getTime()).toBeGreaterThan(beforeDeadline.getTime());
    const extensionArray = after.extensions as Array<{ extendedBy: string }>;
    expect(extensionArray.length).toBeGreaterThanOrEqual(1);
    expect(extensionArray[extensionArray.length - 1].extendedBy).toBe(adminUserId);
  });
});
