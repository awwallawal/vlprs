import { eq, and, sql, isNull, isNotNull, inArray } from 'drizzle-orm';
import { db } from '../db/index';
import { migrationRecords, migrationUploads, mdas } from '../db/schema';
import { AppError } from '../lib/appError';
import { VOCABULARY } from '@vlprs/shared';
import type { FlaggedRecordSummary, MdaReviewProgress, CountdownStatus } from '@vlprs/shared';
import { correctRecord, getRecordDetail } from './migrationValidationService';
import { generateObservations } from './observationEngine';
import { logger } from '../lib/logger';
import type { MigrationRecordDetail } from '@vlprs/shared';

// ─── Review Window Helpers ──────────────────────────────────────────

export function computeCountdownStatus(deadline: Date): { daysRemaining: number; status: CountdownStatus } {
  const now = new Date();
  const msRemaining = deadline.getTime() - now.getTime();
  const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
  const status: CountdownStatus = daysRemaining > 3 ? 'normal' : daysRemaining > 0 ? 'warning' : 'overdue';
  return { daysRemaining, status };
}

// ─── Flagged Records Query (AC: 2) ─────────────────────────────────

export async function getFlaggedRecords(
  uploadId: string,
  mdaScope: string | null | undefined,
  options: { page: number; limit: number; status: 'pending' | 'reviewed' | 'all' },
): Promise<{ records: FlaggedRecordSummary[]; total: number; page: number; limit: number }> {
  const { page, limit, status } = options;

  // Verify upload exists
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

  // Build conditions
  const conditions = [
    eq(migrationRecords.uploadId, uploadId),
    isNotNull(migrationRecords.flaggedForReviewAt),
    isNull(migrationRecords.deletedAt),
  ];

  // MDA scoping
  if (mdaScope) {
    conditions.push(eq(migrationRecords.mdaId, mdaScope));
  }

  // Status filter
  if (status === 'pending') {
    conditions.push(isNull(migrationRecords.correctedBy));
  } else if (status === 'reviewed') {
    conditions.push(isNotNull(migrationRecords.correctedBy));
  }

  // Count total
  const [countResult] = await db
    .select({ count: sql<string>`COUNT(*)` })
    .from(migrationRecords)
    .where(and(...conditions));
  const total = parseInt(countResult.count, 10);

  // Fetch paginated records with MDA name
  const rows = await db
    .select({
      id: migrationRecords.id,
      staffName: migrationRecords.staffName,
      employeeNo: migrationRecords.employeeNo,
      gradeLevel: migrationRecords.gradeLevel,
      varianceCategory: migrationRecords.varianceCategory,
      varianceAmount: migrationRecords.varianceAmount,
      flaggedForReviewAt: migrationRecords.flaggedForReviewAt,
      reviewWindowDeadline: migrationRecords.reviewWindowDeadline,
      correctedBy: migrationRecords.correctedBy,
      correctedAt: migrationRecords.correctedAt,
      correctionReason: migrationRecords.correctionReason,
      mdaName: mdas.name,
    })
    .from(migrationRecords)
    .leftJoin(mdas, eq(migrationRecords.mdaId, mdas.id))
    .where(and(...conditions))
    .orderBy(migrationRecords.staffName)
    .limit(limit)
    .offset((page - 1) * limit);

  const records: FlaggedRecordSummary[] = rows.map((r) => {
    const deadline = r.reviewWindowDeadline!;
    const { daysRemaining, status: countdownStatus } = computeCountdownStatus(deadline);
    return {
      recordId: r.id,
      staffName: r.staffName,
      staffId: r.employeeNo ?? null,
      gradeLevel: r.gradeLevel ?? null,
      mdaName: r.mdaName ?? null,
      varianceCategory: r.varianceCategory ?? null,
      varianceAmount: r.varianceAmount ?? null,
      flaggedAt: r.flaggedForReviewAt!.toISOString(),
      reviewWindowDeadline: deadline.toISOString(),
      daysRemaining,
      countdownStatus,
      correctedBy: r.correctedBy ?? null,
      correctedAt: r.correctedAt?.toISOString() ?? null,
      correctionReason: r.correctionReason ?? null,
    };
  });

  return { records, total, page, limit };
}

// ─── Submit Review with Corrections (AC: 3) ────────────────────────

export async function submitReview(
  recordId: string,
  uploadId: string,
  corrections: {
    outstandingBalance?: string;
    totalLoan?: string;
    monthlyDeduction?: string;
    installmentCount?: number;
    installmentsPaid?: number;
    installmentsOutstanding?: number;
  },
  reason: string,
  userId: string,
  mdaScope?: string | null,
): Promise<MigrationRecordDetail> {
  // Reuse existing correctRecord with the addition of correctionReason
  return correctRecord(recordId, uploadId, { ...corrections, correctionReason: reason }, userId, mdaScope);
}

// ─── Mark Reviewed Without Correction (AC: 4) ──────────────────────

export async function markReviewedNoCorrection(
  recordId: string,
  uploadId: string,
  reason: string,
  userId: string,
  mdaScope?: string | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  externalTx?: any,
): Promise<MigrationRecordDetail> {
  // Verify upload exists and is accessible
  const queryRunner = externalTx ?? db;
  const [upload] = await queryRunner
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const runMarkReviewed = async (tx: any) => {
    const conditions = [
      eq(migrationRecords.id, recordId),
      eq(migrationRecords.uploadId, uploadId),
      isNull(migrationRecords.deletedAt),
    ];

    if (mdaScope) {
      conditions.push(eq(migrationRecords.mdaId, mdaScope));
    }

    const [record] = await tx
      .select()
      .from(migrationRecords)
      .where(and(...conditions))
      .for('update');

    if (!record) {
      throw new AppError(404, 'RECORD_NOT_FOUND', 'The requested migration record was not found.');
    }

    if (record.isBaselineCreated) {
      throw new AppError(409, 'RECORD_ALREADY_BASELINED', 'This record already has an established baseline.');
    }

    // Set corrected_by/at/reason with corrected value columns remaining NULL
    await tx
      .update(migrationRecords)
      .set({
        correctedBy: userId,
        correctedAt: new Date(),
        correctionReason: reason,
      })
      .where(eq(migrationRecords.id, recordId));
  };

  if (externalTx) {
    await runMarkReviewed(externalTx);
  } else {
    await db.transaction(runMarkReviewed);
  }

  return getRecordDetail(recordId, uploadId, mdaScope);
}

// ─── MDA Review Progress (AC: 7,8,9) ───────────────────────────────

export async function getMdaReviewProgress(
  uploadId: string,
): Promise<MdaReviewProgress[]> {
  const rows = await db
    .select({
      mdaId: migrationRecords.mdaId,
      mdaName: mdas.name,
      totalFlagged: sql<string>`COUNT(*)`,
      reviewed: sql<string>`COUNT(CASE WHEN ${migrationRecords.correctedBy} IS NOT NULL THEN 1 END)`,
      reviewWindowDeadline: sql<Date>`MAX(${migrationRecords.reviewWindowDeadline})`,
    })
    .from(migrationRecords)
    .leftJoin(mdas, eq(migrationRecords.mdaId, mdas.id))
    .where(
      and(
        eq(migrationRecords.uploadId, uploadId),
        isNotNull(migrationRecords.flaggedForReviewAt),
        isNull(migrationRecords.deletedAt),
      ),
    )
    .groupBy(migrationRecords.mdaId, mdas.name);

  return rows.map((r) => {
    const total = parseInt(r.totalFlagged, 10);
    const reviewed = parseInt(r.reviewed, 10);
    const pending = total - reviewed;
    const completionPct = total > 0 ? Math.round((reviewed / total) * 100) : 0;
    // SQL MAX() may return a string instead of Date — ensure Date object
    const rawDeadline = r.reviewWindowDeadline!;
    const deadline = rawDeadline instanceof Date ? rawDeadline : new Date(rawDeadline as unknown as string);
    const { daysRemaining, status } = computeCountdownStatus(deadline);

    return {
      mdaId: r.mdaId,
      mdaName: r.mdaName ?? 'Unknown MDA',
      totalFlagged: total,
      reviewed,
      pending,
      completionPct,
      daysRemaining,
      countdownStatus: status,
      windowDeadline: deadline.toISOString(),
    };
  });
}

// ─── Extend Review Window (AC: 9) ──────────────────────────────────

export async function extendReviewWindow(
  uploadId: string,
  mdaId: string,
  userId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    // Lock all flagged records for this MDA to prevent concurrent extension
    const records = await tx
      .select({
        id: migrationRecords.id,
        reviewWindowDeadline: migrationRecords.reviewWindowDeadline,
        reviewWindowExtensions: migrationRecords.reviewWindowExtensions,
      })
      .from(migrationRecords)
      .where(
        and(
          eq(migrationRecords.uploadId, uploadId),
          eq(migrationRecords.mdaId, mdaId),
          isNotNull(migrationRecords.flaggedForReviewAt),
          isNull(migrationRecords.deletedAt),
        ),
      )
      .for('update');

    if (records.length === 0) {
      throw new AppError(404, 'NO_FLAGGED_RECORDS', 'No flagged records found for this MDA and upload.');
    }

    const now = new Date();
    // Compute new deadline from the max existing deadline across all records (or now if all expired)
    const maxDeadline = records.reduce((max, r) => {
      const d = r.reviewWindowDeadline?.getTime() ?? 0;
      return d > max ? d : max;
    }, now.getTime());
    const newDeadline = new Date(maxDeadline);
    newDeadline.setDate(newDeadline.getDate() + 14);

    const extensionEntry = {
      extendedBy: userId,
      extendedAt: now.toISOString(),
      newDeadline: newDeadline.toISOString(),
    };

    // Batch update all records in a single query
    const recordIds = records.map(r => r.id);
    await tx
      .update(migrationRecords)
      .set({
        reviewWindowDeadline: newDeadline,
        reviewWindowExtensions: sql`COALESCE(${migrationRecords.reviewWindowExtensions}, '[]'::jsonb) || ${JSON.stringify([extensionEntry])}::jsonb`,
      })
      .where(inArray(migrationRecords.id, recordIds));
  });
}

// ─── Baseline Reviewed Records — Stage 3 (AC: 10) ──────────────────

export async function baselineReviewedRecords(
  uploadId: string,
  mdaScope: string | null | undefined,
  userId: string,
  userRole: string = 'dept_admin',
): Promise<{ baselinedCount: number }> {
  // Import baseline creation logic — we reuse createBaseline per-record
  const { createBaseline } = await import('./baselineService');

  const conditions = [
    eq(migrationRecords.uploadId, uploadId),
    isNotNull(migrationRecords.flaggedForReviewAt),
    isNotNull(migrationRecords.correctedBy),
    isNotNull(migrationRecords.correctionReason),
    eq(migrationRecords.isBaselineCreated, false),
    isNull(migrationRecords.deletedAt),
  ];

  if (mdaScope) {
    conditions.push(eq(migrationRecords.mdaId, mdaScope));
  }

  // Select reviewed record IDs without locking — each createBaseline() call
  // manages its own transaction and row locks internally
  const reviewedRecords = await db
    .select({ id: migrationRecords.id })
    .from(migrationRecords)
    .where(and(...conditions));

  let baselinedCount = 0;
  const actingUser = { userId, role: userRole, mdaId: mdaScope ?? null };

  for (const record of reviewedRecords) {
    try {
      await createBaseline(actingUser, uploadId, record.id, mdaScope, { skipObservationGeneration: true });
      baselinedCount++;
    } catch {
      // Skip records that fail baseline (e.g. eligibility issues) — don't block batch
    }
  }

  // Story 15.0b: Fire-and-forget observation generation once for all newly baselined records
  if (baselinedCount > 0) {
    generateObservations(uploadId, userId).catch((err) =>
      logger.error({ err, uploadId }, 'Observation generation failed after reviewed baseline'),
    );
  }

  return { baselinedCount };
}
