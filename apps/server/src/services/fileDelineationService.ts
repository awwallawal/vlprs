/**
 * fileDelineationService — Intra-file MDA boundary detection and confirmation.
 *
 * Detects when an uploaded migration file contains records for multiple MDAs
 * (e.g., Agriculture files containing CDU records) and allows admin confirmation
 * of boundaries before attributing records to the correct MDAs.
 *
 * Story 3.8: Multi-MDA File Delineation & Deduplication
 */

import { eq, and, between, isNull, inArray } from 'drizzle-orm';
import { db } from '../db/index';
import {
  migrationUploads,
  migrationRecords,
  migrationExtraFields,
} from '../db/schema';
import { AppError } from '../lib/appError';
import { withMdaScope } from '../lib/mdaScope';
import { withTransaction } from '../lib/transaction';
import { resolveMdaByName, getMdaById } from './mdaService';
import { VOCABULARY } from '@vlprs/shared';
import type { DelineationSection, DelineationResult, DelineationBoundaryRecord } from '@vlprs/shared';

// ─── Types ──────────────────────────────────────────────────────────

interface ConfirmedSection {
  sectionIndex: number;
  mdaId: string;
}

// ─── Detect Boundaries ──────────────────────────────────────────────

/**
 * Scan migration_records for a given upload to detect MDA boundary changes.
 * Uses the mdaText column (or extra fields) to identify sections belonging to different MDAs.
 */
export async function detectBoundaries(
  uploadId: string,
  mdaScope?: string | null,
): Promise<DelineationResult> {
  // Verify upload exists
  const [upload] = await db
    .select({
      id: migrationUploads.id,
      mdaId: migrationUploads.mdaId,
      delineationResult: migrationUploads.delineationResult,
    })
    .from(migrationUploads)
    .where(and(
      eq(migrationUploads.id, uploadId),
      isNull(migrationUploads.deletedAt),
      withMdaScope(migrationUploads.mdaId, mdaScope),
    ));

  if (!upload) {
    throw new AppError(404, 'UPLOAD_NOT_FOUND', VOCABULARY.MIGRATION_UPLOAD_NOT_FOUND);
  }

  // Get target MDA name
  const targetMda = await getMdaById(upload.mdaId);

  // Load all records ordered by sheet + row
  const records = await db
    .select({
      id: migrationRecords.id,
      mdaText: migrationRecords.mdaText,
      sourceRow: migrationRecords.sourceRow,
      sheetName: migrationRecords.sheetName,
      staffName: migrationRecords.staffName,
    })
    .from(migrationRecords)
    .where(and(
      eq(migrationRecords.uploadId, uploadId),
      isNull(migrationRecords.deletedAt),
    ))
    .orderBy(migrationRecords.sheetName, migrationRecords.sourceRow);

  if (records.length === 0) {
    return {
      uploadId,
      targetMdaId: upload.mdaId,
      targetMdaName: targetMda.name,
      delineated: false,
      sections: [],
      totalRecords: 0,
    };
  }

  // Check if records have MDA text values
  const hasMdaColumn = records.some((r) => r.mdaText && r.mdaText.trim());

  if (!hasMdaColumn) {
    // Try detecting MDA column from extra fields
    const mdaFromExtra = await detectMdaFromExtraFields(uploadId, records);
    if (!mdaFromExtra) {
      // No MDA column — all records belong to upload target MDA
      const result: DelineationResult = {
        uploadId,
        targetMdaId: upload.mdaId,
        targetMdaName: targetMda.name,
        delineated: false,
        sections: [],
        totalRecords: records.length,
      };
      await saveDelineationResult(uploadId, result);
      return result;
    }
  }

  // Build sections by scanning MDA column values
  const sections = await buildSections(records);

  // Determine if delineation is needed
  const uniqueMdas = new Set(sections.map((s) => s.mdaId).filter(Boolean));
  const hasAmbiguous = sections.some((s) => s.confidence === 'ambiguous');
  const delineated = uniqueMdas.size > 1 || hasAmbiguous;

  const result: DelineationResult = {
    uploadId,
    targetMdaId: upload.mdaId,
    targetMdaName: targetMda.name,
    delineated,
    sections: delineated ? sections : [],
    totalRecords: records.length,
  };

  // Save result to migration_uploads
  await saveDelineationResult(uploadId, result);

  return result;
}

// ─── Build Sections ─────────────────────────────────────────────────

/** Max boundary sample records to keep per section edge (start/end). */
const BOUNDARY_SAMPLE_SIZE = 2;

async function buildSections(
  records: Array<{
    id: string;
    mdaText: string | null;
    sourceRow: number;
    sheetName: string;
    staffName: string;
  }>,
): Promise<DelineationSection[]> {
  const sections: DelineationSection[] = [];
  let currentSection: Partial<DelineationSection> | null = null;
  let currentMdaValue: string | null = null;

  // Track records for boundary preview — first N and last N per section
  let sectionRecords: Array<{ sourceRow: number; staffName: string; mdaText: string | null }> = [];

  // Resolution cache to avoid repeated DB lookups
  const resolveCache = new Map<string, { id: string | null; code: string | null; name: string | null }>();

  async function resolveValue(value: string) {
    const key = value.toUpperCase().trim();
    if (resolveCache.has(key)) return resolveCache.get(key)!;

    const resolved = await resolveMdaByName(value);
    const entry = resolved
      ? { id: resolved.id, code: resolved.code, name: resolved.name }
      : { id: null, code: null, name: null };
    resolveCache.set(key, entry);
    return entry;
  }

  function closeSectionWithBoundary(section: Partial<DelineationSection>, recs: typeof sectionRecords): void {
    if (!section.recordCount || section.recordCount <= 0) return;
    (section as DelineationSection).boundaryRecords = extractBoundaryRecords(recs);
    sections.push(section as DelineationSection);
  }

  let lastKnownMdaValue: string | null = null;

  for (const record of records) {
    const rawMdaValue = record.mdaText?.trim() || null;
    const mdaValue = rawMdaValue || lastKnownMdaValue;

    if (rawMdaValue) {
      lastKnownMdaValue = rawMdaValue;
    }

    if (!mdaValue) {
      // No MDA value at all — continue current section
      if (currentSection) {
        currentSection.endRow = record.sourceRow;
        currentSection.recordCount = (currentSection.recordCount ?? 0) + 1;
        trackBoundaryRecord(sectionRecords, record);
      }
      continue;
    }

    const mdaValueUpper = mdaValue.toUpperCase().trim();

    if (mdaValueUpper === currentMdaValue) {
      // Same section continues
      if (currentSection) {
        currentSection.endRow = record.sourceRow;
        currentSection.recordCount = (currentSection.recordCount ?? 0) + 1;
        trackBoundaryRecord(sectionRecords, record);
      }
      continue;
    }

    // MDA value changed — close current section and start new one
    if (currentSection) {
      closeSectionWithBoundary(currentSection, sectionRecords);
    }

    // Resolve the new MDA value
    const resolved = await resolveValue(mdaValue);

    sectionRecords = [];
    currentSection = {
      sectionIndex: sections.length,
      sheetName: record.sheetName,
      mdaId: resolved.id,
      mdaCode: resolved.code,
      mdaName: mdaValue,
      resolvedMdaName: resolved.name,
      startRow: record.sourceRow,
      endRow: record.sourceRow,
      recordCount: 1,
      confidence: resolved.id ? 'detected' : 'ambiguous',
    };
    trackBoundaryRecord(sectionRecords, record);
    currentMdaValue = mdaValueUpper;
  }

  // Close last section
  if (currentSection) {
    closeSectionWithBoundary(currentSection, sectionRecords);
  }

  return sections;
}

/**
 * Track a record for boundary preview. Keeps first N records always;
 * for the tail, overwrites a small ring buffer so we always have the last N.
 */
function trackBoundaryRecord(
  buf: Array<{ sourceRow: number; staffName: string; mdaText: string | null }>,
  record: { sourceRow: number; staffName: string; mdaText: string | null },
): void {
  // Keep first BOUNDARY_SAMPLE_SIZE unconditionally, then track last BOUNDARY_SAMPLE_SIZE
  // by keeping a window. We limit total buffer to 2 * BOUNDARY_SAMPLE_SIZE to bound memory.
  if (buf.length < BOUNDARY_SAMPLE_SIZE * 2) {
    buf.push(record);
  } else {
    // Overwrite the tail portion (indices BOUNDARY_SAMPLE_SIZE..end)
    const tailIdx = BOUNDARY_SAMPLE_SIZE + ((buf.length - BOUNDARY_SAMPLE_SIZE) % BOUNDARY_SAMPLE_SIZE);
    buf[tailIdx] = record;
    buf.length = tailIdx + 1; // trim
  }
}

/**
 * Extract boundary preview records from tracked buffer.
 * Returns first N labelled 'start' + last N labelled 'end' (deduplicated if section is small).
 */
function extractBoundaryRecords(
  buf: Array<{ sourceRow: number; staffName: string; mdaText: string | null }>,
): DelineationBoundaryRecord[] {
  if (buf.length === 0) return [];

  const n = BOUNDARY_SAMPLE_SIZE;
  const startRecords = buf.slice(0, n);
  const endRecords = buf.slice(-n);

  // Deduplicate: if section has <= 2*n records, start and end overlap
  const seen = new Set<number>();
  const result: DelineationBoundaryRecord[] = [];

  for (const r of startRecords) {
    seen.add(r.sourceRow);
    result.push({ sourceRow: r.sourceRow, staffName: r.staffName, mdaText: r.mdaText, position: 'start' });
  }
  for (const r of endRecords) {
    if (!seen.has(r.sourceRow)) {
      result.push({ sourceRow: r.sourceRow, staffName: r.staffName, mdaText: r.mdaText, position: 'end' });
    }
  }

  return result;
}

// ─── Extra Field MDA Detection ──────────────────────────────────────

/**
 * Detect MDA column from migration_extra_fields.
 *
 * When column mapping doesn't detect an MDA column in standard fields, checks if
 * any of the "extra" (unmapped) fields contain MDA names/codes. If found, populates
 * migration_records.mdaText to enable proper delineation.
 *
 * Side effect: UPDATEs migration_records.mdaText within a transaction.
 */
async function detectMdaFromExtraFields(
  _uploadId: string, // Retained for API consistency with other delineation functions
  records: Array<{ id: string }>,
): Promise<boolean> {
  if (records.length === 0) return false;

  // Sample first 20 records' extra fields
  const sampleRecordIds = records.slice(0, 20).map((r) => r.id);
  const extraFields = await db
    .select({
      recordId: migrationExtraFields.recordId,
      fieldName: migrationExtraFields.fieldName,
      fieldValue: migrationExtraFields.fieldValue,
    })
    .from(migrationExtraFields)
    .where(
      and(
        inArray(migrationExtraFields.recordId, sampleRecordIds),
        isNull(migrationExtraFields.deletedAt),
      ),
    );

  if (extraFields.length === 0) return false;

  // Group values by field name
  const fieldValues = new Map<string, Array<{ recordId: string; value: string }>>();
  for (const ef of extraFields) {
    if (!ef.fieldValue || ef.fieldValue.trim() === '') continue;
    const existing = fieldValues.get(ef.fieldName) ?? [];
    existing.push({ recordId: ef.recordId, value: ef.fieldValue.trim() });
    fieldValues.set(ef.fieldName, existing);
  }

  // For each field, test values against resolveMdaByName — count successful resolutions
  let bestField: string | null = null;
  let bestResolutionRate = 0;

  for (const [fieldName, values] of fieldValues) {
    let resolvedCount = 0;
    for (const v of values) {
      const mda = await resolveMdaByName(v.value);
      if (mda) resolvedCount++;
    }
    const rate = resolvedCount / values.length;
    if (rate > 0.5 && rate > bestResolutionRate) {
      bestField = fieldName;
      bestResolutionRate = rate;
    }
  }

  if (!bestField) return false;

  // Found the MDA column — batch UPDATE migration_records.mdaText within a transaction
  // Load ALL extra field values for this field name across ALL records in the upload
  const allRecordIds = records.map((r) => r.id);
  const allMdaValues = await db
    .select({
      recordId: migrationExtraFields.recordId,
      fieldValue: migrationExtraFields.fieldValue,
    })
    .from(migrationExtraFields)
    .where(
      and(
        inArray(migrationExtraFields.recordId, allRecordIds),
        eq(migrationExtraFields.fieldName, bestField),
        isNull(migrationExtraFields.deletedAt),
      ),
    );

  try {
    await withTransaction(async (tx) => {
      for (const v of allMdaValues) {
        if (!v.fieldValue) continue;
        await tx
          .update(migrationRecords)
          .set({ mdaText: v.fieldValue.trim() })
          .where(eq(migrationRecords.id, v.recordId));
      }
    });
  } catch {
    // Transaction failed — safe fallback, no partial mdaText population
    return false;
  }

  return true;
}

// ─── Confirm Boundaries ─────────────────────────────────────────────

/**
 * Apply admin-confirmed MDA attribution to migration records.
 * Each confirmed section specifies the MDA ID to assign to records in that row range.
 */
export async function confirmBoundaries(
  uploadId: string,
  confirmedSections: ConfirmedSection[],
  userId: string,
  mdaScope?: string | null,
): Promise<DelineationResult> {
  // Load existing delineation result
  const [upload] = await db
    .select({
      id: migrationUploads.id,
      mdaId: migrationUploads.mdaId,
      delineationResult: migrationUploads.delineationResult,
    })
    .from(migrationUploads)
    .where(and(
      eq(migrationUploads.id, uploadId),
      isNull(migrationUploads.deletedAt),
      withMdaScope(migrationUploads.mdaId, mdaScope),
    ));

  if (!upload) {
    throw new AppError(404, 'UPLOAD_NOT_FOUND', VOCABULARY.MIGRATION_UPLOAD_NOT_FOUND);
  }

  const existing = upload.delineationResult as DelineationResult | null;
  if (!existing || !existing.delineated) {
    throw new AppError(400, 'DELINEATION_NOT_RUN', VOCABULARY.DELINEATION_NOT_RUN);
  }

  // Build a map of section confirmations
  const confirmMap = new Map<number, string>();
  for (const cs of confirmedSections) {
    confirmMap.set(cs.sectionIndex, cs.mdaId);
  }

  // Validate that ALL sections are confirmed — partial confirmation
  // would silently leave records under the wrong MDA
  const missingSections = existing.sections.filter(
    (s) => !confirmMap.has(s.sectionIndex),
  );
  if (missingSections.length > 0) {
    throw new AppError(
      400,
      'DELINEATION_INCOMPLETE_CONFIRMATION',
      `All ${existing.sections.length} sections must be confirmed. Missing section(s): ${missingSections.map((s) => s.sectionIndex).join(', ')}`,
    );
  }

  // Apply updates in a transaction
  await db.transaction(async (tx) => {
    for (const section of existing.sections) {
      const confirmedMdaId = confirmMap.get(section.sectionIndex);
      if (!confirmedMdaId) continue;

      // Build WHERE conditions — include sheetName to prevent row-range
      // overlap across sheets in multi-sheet files (C1 fix)
      const conditions = [
        eq(migrationRecords.uploadId, uploadId),
        between(migrationRecords.sourceRow, section.startRow, section.endRow),
        isNull(migrationRecords.deletedAt),
      ];
      if (section.sheetName) {
        conditions.push(eq(migrationRecords.sheetName, section.sheetName));
      }

      await tx
        .update(migrationRecords)
        .set({ mdaId: confirmedMdaId })
        .where(and(...conditions));
    }
  });

  // Update sections with confirmed MDA info
  const updatedSections: DelineationSection[] = existing.sections.map((section) => {
    const confirmedMdaId = confirmMap.get(section.sectionIndex);
    if (confirmedMdaId) {
      return {
        ...section,
        mdaId: confirmedMdaId,
        confidence: 'confirmed' as const,
      };
    }
    return section;
  });

  const updatedResult: DelineationResult & { confirmedAt: string; confirmedBy: string } = {
    ...existing,
    sections: updatedSections,
    confirmedAt: new Date().toISOString(),
    confirmedBy: userId,
  };

  // Save confirmed result
  await db
    .update(migrationUploads)
    .set({
      delineationResult: updatedResult,
      updatedAt: new Date(),
    })
    .where(eq(migrationUploads.id, uploadId));

  return updatedResult;
}

// ─── Get Delineation Preview ────────────────────────────────────────

/**
 * Return the current delineation state for an upload.
 */
export async function getDelineationPreview(
  uploadId: string,
  mdaScope?: string | null,
): Promise<DelineationResult> {
  const [upload] = await db
    .select({
      id: migrationUploads.id,
      mdaId: migrationUploads.mdaId,
      delineationResult: migrationUploads.delineationResult,
    })
    .from(migrationUploads)
    .where(and(
      eq(migrationUploads.id, uploadId),
      isNull(migrationUploads.deletedAt),
      withMdaScope(migrationUploads.mdaId, mdaScope),
    ));

  if (!upload) {
    throw new AppError(404, 'UPLOAD_NOT_FOUND', VOCABULARY.MIGRATION_UPLOAD_NOT_FOUND);
  }

  if (!upload.delineationResult) {
    // Delineation not yet run — run it now
    return detectBoundaries(uploadId, mdaScope);
  }

  return upload.delineationResult as DelineationResult;
}

// ─── Helpers ────────────────────────────────────────────────────────

async function saveDelineationResult(
  uploadId: string,
  result: DelineationResult,
): Promise<void> {
  await db
    .update(migrationUploads)
    .set({
      delineationResult: result,
      updatedAt: new Date(),
    })
    .where(eq(migrationUploads.id, uploadId));
}
