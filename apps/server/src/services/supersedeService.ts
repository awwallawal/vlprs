/**
 * supersedeService — Orchestrates upload supersession cascade.
 *
 * When a newer upload replaces an older one for the same MDA + period,
 * this service marks the old upload as superseded, cascades status to
 * its migration_records, annotates affected baseline entries, re-runs
 * the observation engine for the surviving upload, and auto-resolves
 * the triggering period_overlap observation.
 *
 * Transaction scope (team agreement):
 *   Steps 1-3 inside tx (data changes)
 *   Steps 4-5 outside tx (observation re-run + audit are non-critical)
 */

import { eq, and, isNull, sql } from 'drizzle-orm';
import { db } from '../db/index';
import {
  migrationUploads,
  migrationRecords,
  ledgerEntries,
  baselineAnnotations,
  observations,
} from '../db/schema';
import { withTransaction, type TxHandle } from '../lib/transaction';
import { AppError } from '../lib/appError';
import { generateObservations } from './observationEngine';
import type { SupersedeResponse } from '@vlprs/shared';

/**
 * Supersede an upload: mark it replaced by another upload, cascade record
 * status, annotate baselines, re-run observation engine for survivor, and
 * auto-resolve the period_overlap observation.
 */
export async function supersedeUpload(
  supersededUploadId: string,
  replacementUploadId: string,
  reason: string,
  userId: string,
): Promise<SupersedeResponse> {
  // ── Validation ──────────────────────────────────────────────────────

  const [supersededUpload] = await db
    .select({
      id: migrationUploads.id,
      mdaId: migrationUploads.mdaId,
      filename: migrationUploads.filename,
      supersededBy: migrationUploads.supersededBy,
    })
    .from(migrationUploads)
    .where(and(eq(migrationUploads.id, supersededUploadId), isNull(migrationUploads.deletedAt)));

  if (!supersededUpload) {
    throw new AppError(404, 'UPLOAD_NOT_FOUND', 'The upload to supersede could not be found.');
  }

  if (supersededUpload.supersededBy) {
    throw new AppError(
      400,
      'ALREADY_SUPERSEDED',
      'This upload has already been superseded. Only direct replacement is supported — no chain supersessions.',
    );
  }

  const [replacementUpload] = await db
    .select({
      id: migrationUploads.id,
      mdaId: migrationUploads.mdaId,
      filename: migrationUploads.filename,
    })
    .from(migrationUploads)
    .where(and(eq(migrationUploads.id, replacementUploadId), isNull(migrationUploads.deletedAt)));

  if (!replacementUpload) {
    throw new AppError(404, 'REPLACEMENT_NOT_FOUND', 'The replacement upload could not be found.');
  }

  if (supersededUpload.mdaId !== replacementUpload.mdaId) {
    throw new AppError(
      400,
      'MDA_MISMATCH',
      'The superseded and replacement uploads must belong to the same MDA.',
    );
  }

  if (supersededUploadId === replacementUploadId) {
    throw new AppError(400, 'SELF_SUPERSEDE', 'An upload cannot supersede itself.');
  }

  // ── Transaction: steps 1-3 ─────────────────────────────────────────

  const now = new Date();

  const txResult = await withTransaction(async (tx: TxHandle) => {
    // Step 1: Mark upload as superseded
    await tx
      .update(migrationUploads)
      .set({
        supersededBy: replacementUploadId,
        supersededAt: now,
        supersededReason: reason,
        supersededByUserId: userId,
        updatedAt: now,
      })
      .where(eq(migrationUploads.id, supersededUploadId));

    // Step 2: Mark all migration_records for the superseded upload
    const updateResult = await tx
      .update(migrationRecords)
      .set({
        recordStatus: 'superseded',
        supersededAt: now,
      })
      .where(
        and(
          eq(migrationRecords.uploadId, supersededUploadId),
          isNull(migrationRecords.deletedAt),
        ),
      )
      .returning({ id: migrationRecords.id });

    const recordsSuperseded = updateResult.length;

    // Step 3: Annotate affected baseline entries
    // Find migration_records that had baselines created
    const affectedRecords = await tx
      .select({
        loanId: migrationRecords.loanId,
      })
      .from(migrationRecords)
      .where(
        and(
          eq(migrationRecords.uploadId, supersededUploadId),
          eq(migrationRecords.isBaselineCreated, true),
          sql`${migrationRecords.loanId} IS NOT NULL`,
        ),
      );

    let baselinesAnnotated = 0;

    if (affectedRecords.length > 0) {
      const loanIds = affectedRecords.map((r) => r.loanId!);

      // Find baseline ledger entries for these loans
      const baselineEntries = await tx
        .select({ id: ledgerEntries.id })
        .from(ledgerEntries)
        .where(
          and(
            eq(ledgerEntries.entryType, 'MIGRATION_BASELINE'),
            sql`${ledgerEntries.loanId} IN (${sql.join(loanIds.map((id) => sql`${id}`), sql`, `)})`,
          ),
        );

      if (baselineEntries.length > 0) {
        const annotationNote = `Superseded by Upload "${replacementUpload.filename}" on ${now.toISOString().slice(0, 10)}`;

        const annotationRows = baselineEntries.map((entry) => ({
          ledgerEntryId: entry.id,
          annotationType: 'superseded' as const,
          note: annotationNote,
          supersededUploadId,
          replacementUploadId,
          annotatedBy: userId,
          annotatedAt: now,
        }));

        await tx.insert(baselineAnnotations).values(annotationRows);
        baselinesAnnotated = annotationRows.length;
      }
    }

    return { recordsSuperseded, baselinesAnnotated };
  });

  // ── Post-transaction: steps 4-5 ──────────────────────────────────

  // Step 4: Re-run observation engine for surviving upload (fire-and-forget)
  let observationsRegenerated = false;
  try {
    await generateObservations(replacementUploadId, userId);
    observationsRegenerated = true;
  } catch {
    // Non-critical — supersession is still valid
  }

  // Step 5: Auto-resolve the specific period_overlap observation that triggered this
  // Narrow filter: only resolve observations whose context references the superseded upload
  try {
    await db
      .update(observations)
      .set({
        status: 'resolved',
        resolutionNote: `Upload superseded. Reason: ${reason}`,
        resolvedAt: now,
        resolvedBy: userId,
        updatedAt: now,
      })
      .where(
        and(
          eq(observations.type, 'period_overlap'),
          eq(observations.uploadId, replacementUploadId),
          eq(observations.status, 'unreviewed'),
          sql`${observations.context}::jsonb->'dataPoints'->>'olderUploadId' = ${supersededUploadId}`,
        ),
      );
  } catch {
    // Non-critical
  }

  return {
    supersededUploadId,
    replacementUploadId,
    recordsSuperseded: txResult.recordsSuperseded,
    baselinesAnnotated: txResult.baselinesAnnotated,
    observationsRegenerated,
  };
}
