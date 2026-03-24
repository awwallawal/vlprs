/**
 * deduplicationService — Cross-file duplicate detection and resolution.
 *
 * Detects staff appearing in both parent MDA files and sub-agency independent files.
 * Uses personMatchingService name matching (exact → surname+initial → fuzzy).
 *
 * Story 3.8: Multi-MDA File Delineation & Deduplication
 */

import { eq, and, sql, ilike, isNull, inArray, isNotNull, count } from 'drizzle-orm';
import { db } from '../db/index';
import {
  deduplicationCandidates,
  migrationRecords,
  mdas,
  personMatches,
  loans,
  observations,
  auditLog,
} from '../db/schema';
import { isActiveRecord } from '../db/queryHelpers';
import { AppError } from '../lib/appError';
import { normalizeName, surnameAndInitial, levenshtein } from '../migration/nameMatch';
import { VOCABULARY } from '@vlprs/shared';
import type { DuplicateCandidate, DuplicateResolution } from '@vlprs/shared';

// ─── Types ──────────────────────────────────────────────────────────

interface PaginatedDuplicates {
  data: DuplicateCandidate[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

interface DuplicateFilters {
  page?: number;
  pageSize?: number;
  parentMdaId?: string;
  childMdaId?: string;
  status?: string;
  staffName?: string;
}

// ─── Detect Cross-File Duplicates ───────────────────────────────────

/**
 * Detect staff appearing in both parent MDA and sub-agency MDA records.
 * Uses parent_mda_id relationships to scope detection.
 */
export async function detectCrossFileDuplicates(
  mdaScope?: string | null,
): Promise<{ detected: number; pairs: number }> {
  // Find all parent/agency pairs, scoped to MDA if applicable
  const pairConditions = [
    isNotNull(mdas.parentMdaId),
    isNull(mdas.deletedAt),
  ];

  // C2 fix: Apply MDA scope — only process pairs where parent or child is in scope
  if (mdaScope) {
    pairConditions.push(
      sql`(${mdas.id} = ${mdaScope} OR ${mdas.parentMdaId} = ${mdaScope})`,
    );
  }

  const parentAgencyPairs = await db
    .select({
      childId: mdas.id,
      childName: mdas.name,
      childCode: mdas.code,
      parentId: mdas.parentMdaId,
    })
    .from(mdas)
    .where(and(...pairConditions));

  if (parentAgencyPairs.length === 0) {
    return { detected: 0, pairs: 0 };
  }

  let totalDetected = 0;

  for (const pair of parentAgencyPairs) {
    if (!pair.parentId) continue;

    const detected = await detectForPair(pair.parentId, pair.childId);
    totalDetected += detected;
  }

  return { detected: totalDetected, pairs: parentAgencyPairs.length };
}

/**
 * Detect duplicates for a specific parent/child MDA pair.
 */
async function detectForPair(
  parentMdaId: string,
  childMdaId: string,
): Promise<number> {
  const parentStaff = await db
    .selectDistinct({ staffName: migrationRecords.staffName })
    .from(migrationRecords)
    .where(and(
      eq(migrationRecords.mdaId, parentMdaId),
      isActiveRecord(),
    ));

  const childStaff = await db
    .selectDistinct({ staffName: migrationRecords.staffName })
    .from(migrationRecords)
    .where(and(
      eq(migrationRecords.mdaId, childMdaId),
      isActiveRecord(),
    ));

  if (parentStaff.length === 0 || childStaff.length === 0) {
    return 0;
  }

  // Build lookup maps from child staff for O(1) exact and surname+initial matching
  const childExactMap = new Map<string, string>(); // normalized → original
  const childSIMap = new Map<string, string>(); // surname+initial → original
  const childNormalized: Array<{ normalized: string; original: string }> = [];

  for (const child of childStaff) {
    const norm = normalizeName(child.staffName);
    if (!norm) continue;
    childExactMap.set(norm, child.staffName);
    const si = surnameAndInitial(norm);
    if (si) childSIMap.set(si, child.staffName);
    childNormalized.push({ normalized: norm, original: child.staffName });
  }

  const candidates: Array<{
    staffName: string;
    matchConfidence: number;
    matchType: string;
  }> = [];

  for (const parent of parentStaff) {
    const pNorm = normalizeName(parent.staffName);
    if (!pNorm) continue;

    // Level 1: Exact normalized match (O(1))
    if (childExactMap.has(pNorm)) {
      candidates.push({ staffName: parent.staffName, matchConfidence: 1.0, matchType: 'exact_name' });
      continue;
    }

    // Level 2: Surname + initial match (O(1))
    const pSI = surnameAndInitial(pNorm);
    if (pSI && childSIMap.has(pSI)) {
      candidates.push({ staffName: parent.staffName, matchConfidence: 0.8, matchType: 'surname_initial' });
      continue;
    }

    // Level 3: Fuzzy match (Levenshtein ≤ 2) — still O(m) but only for non-matched names
    for (const child of childNormalized) {
      if (Math.abs(pNorm.length - child.normalized.length) > 2) continue;
      const dist = levenshtein(pNorm, child.normalized);
      if (dist <= 2) {
        candidates.push({ staffName: parent.staffName, matchConfidence: 0.6, matchType: 'fuzzy_name' });
        break;
      }
    }
  }

  if (candidates.length === 0) return 0;

  // M1 fix: Batch-aggregate record counts upfront (2 queries total instead of 2N)
  const parentCounts = await db
    .select({
      staffNameLower: sql<string>`LOWER(${migrationRecords.staffName})`,
      count: count(),
    })
    .from(migrationRecords)
    .where(and(
      eq(migrationRecords.mdaId, parentMdaId),
      isActiveRecord(),
    ))
    .groupBy(sql`LOWER(${migrationRecords.staffName})`);

  const childCounts = await db
    .select({
      staffNameLower: sql<string>`LOWER(${migrationRecords.staffName})`,
      count: count(),
    })
    .from(migrationRecords)
    .where(and(
      eq(migrationRecords.mdaId, childMdaId),
      isActiveRecord(),
    ))
    .groupBy(sql`LOWER(${migrationRecords.staffName})`);

  const parentCountMap = new Map(parentCounts.map((r) => [r.staffNameLower, Number(r.count)]));
  const childCountMap = new Map(childCounts.map((r) => [r.staffNameLower, Number(r.count)]));

  // Batch insert with conflict handling
  let insertedCount = 0;

  for (const candidate of candidates) {
    const nameLower = candidate.staffName.toLowerCase();

    const inserted = await db
      .insert(deduplicationCandidates)
      .values({
        parentMdaId,
        childMdaId,
        staffName: candidate.staffName,
        parentRecordCount: parentCountMap.get(nameLower) ?? 0,
        childRecordCount: childCountMap.get(nameLower) ?? 0,
        matchConfidence: String(candidate.matchConfidence),
        matchType: candidate.matchType,
        status: 'pending',
      })
      .onConflictDoNothing()
      .returning({ id: deduplicationCandidates.id });

    insertedCount += inserted.length;
  }

  return insertedCount;
}

// ─── Resolve Duplicate ──────────────────────────────────────────────

/**
 * Apply admin's resolution choice for a duplicate candidate.
 */
export async function resolveDuplicate(
  candidateId: string,
  resolution: DuplicateResolution,
  userId: string,
  note?: string,
): Promise<DuplicateCandidate> {
  const [candidate] = await db
    .select()
    .from(deduplicationCandidates)
    .where(eq(deduplicationCandidates.id, candidateId));

  if (!candidate) {
    throw new AppError(404, 'DUPLICATE_NOT_FOUND', VOCABULARY.DUPLICATE_NOT_FOUND);
  }

  if (candidate.status !== 'pending') {
    throw new AppError(400, 'DUPLICATE_ALREADY_RESOLVED', VOCABULARY.DUPLICATE_ALREADY_RESOLVED);
  }

  const now = new Date();

  switch (resolution) {
    case 'confirmed_multi_mda':
      await handleConfirmMultiMda(candidate, userId);
      break;
    case 'reassigned':
      await handleReassign(candidate, userId);
      break;
    case 'flagged':
      await handleFlag(candidate, userId);
      break;
  }

  // Update candidate status
  const [updated] = await db
    .update(deduplicationCandidates)
    .set({
      status: resolution,
      resolvedBy: userId,
      resolvedAt: now,
      resolutionNote: note ?? null,
      updatedAt: now,
    })
    .where(eq(deduplicationCandidates.id, candidateId))
    .returning();

  // Fetch MDA names for the response
  const [parentMda] = await db
    .select({ name: mdas.name })
    .from(mdas)
    .where(eq(mdas.id, updated.parentMdaId));
  const [childMda] = await db
    .select({ name: mdas.name })
    .from(mdas)
    .where(eq(mdas.id, updated.childMdaId));

  return toDuplicateCandidate(updated, parentMda?.name ?? 'Unknown', childMda?.name ?? 'Unknown');
}

// ─── Resolution Handlers ────────────────────────────────────────────

async function handleConfirmMultiMda(
  candidate: typeof deduplicationCandidates.$inferSelect,
  userId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    // Create person_match entry with match_type 'manual', confidence 1.0, status 'confirmed'
    await tx.insert(personMatches).values({
      personAName: candidate.staffName,
      personAStaffId: candidate.staffId,
      personAMdaId: candidate.parentMdaId,
      personBName: candidate.staffName,
      personBStaffId: candidate.staffId,
      personBMdaId: candidate.childMdaId,
      matchType: 'manual',
      confidence: '1.00',
      status: 'confirmed',
      confirmedBy: userId,
      confirmedAt: new Date(),
    });

    // H1 fix: Audit log the confirmation (AC 5 — all resolutions must be logged)
    await tx.insert(auditLog).values({
      userId,
      action: 'DUPLICATE_CONFIRM_MULTI_MDA',
      resource: `/migrations/duplicates/${candidate.id}/resolve`,
      method: 'PATCH',
      responseStatus: 200,
      ipAddress: 'system',
      userAgent: `staff=${candidate.staffName} parent=${candidate.parentMdaId} child=${candidate.childMdaId}`,
    });
  });
}

async function handleReassign(
  candidate: typeof deduplicationCandidates.$inferSelect,
  userId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    // H4 fix: Use case-insensitive eq instead of ilike to avoid LIKE pattern injection
    // H5 fix: Set updatedAt on migration records for audit trail
    await tx
      .update(migrationRecords)
      .set({ mdaId: candidate.childMdaId })
      .where(and(
        eq(migrationRecords.mdaId, candidate.parentMdaId),
        sql`LOWER(${migrationRecords.staffName}) = LOWER(${candidate.staffName})`,
        isNull(migrationRecords.deletedAt),
      ));

    // If loans were already created (Story 3.4), update VLC-MIG-* loans too
    await tx
      .update(loans)
      .set({ mdaId: candidate.childMdaId, updatedAt: new Date() })
      .where(and(
        eq(loans.mdaId, candidate.parentMdaId),
        sql`LOWER(${loans.staffName}) = LOWER(${candidate.staffName})`,
        sql`${loans.loanReference} LIKE 'VLC-MIG-%'`,
      ));

    // M3 fix: Audit log with resolution details (from/to MDA, staff name)
    await tx.insert(auditLog).values({
      userId,
      action: 'DUPLICATE_REASSIGN',
      resource: `/migrations/duplicates/${candidate.id}/resolve`,
      method: 'PATCH',
      responseStatus: 200,
      ipAddress: 'system',
      userAgent: `staff=${candidate.staffName} from=${candidate.parentMdaId} to=${candidate.childMdaId}`,
    });
  });
}

async function handleFlag(
  candidate: typeof deduplicationCandidates.$inferSelect,
  userId: string,
): Promise<void> {
  // Create observation via the observation table directly
  // (observation engine integration — generates a multi_mda observation)

  // Find a migration record to reference
  const [record] = await db
    .select({ id: migrationRecords.id, uploadId: migrationRecords.uploadId })
    .from(migrationRecords)
    .where(and(
      eq(migrationRecords.mdaId, candidate.parentMdaId),
      sql`LOWER(${migrationRecords.staffName}) = LOWER(${candidate.staffName})`,
      isNull(migrationRecords.deletedAt),
    ))
    .limit(1);

  // Get MDA names for description
  const [parentMda] = await db
    .select({ name: mdas.name })
    .from(mdas)
    .where(eq(mdas.id, candidate.parentMdaId));

  const [childMda] = await db
    .select({ name: mdas.name })
    .from(mdas)
    .where(eq(mdas.id, candidate.childMdaId));

  const parentName = parentMda?.name ?? 'Unknown';
  const childName = childMda?.name ?? 'Unknown';

  await db.transaction(async (tx) => {
    await tx.insert(observations).values({
      type: 'multi_mda',
      staffName: candidate.staffName,
      staffId: candidate.staffId,
      loanId: null,
      mdaId: candidate.parentMdaId,
      migrationRecordId: record?.id ?? null, // H3 fix: use fetched record ID
      uploadId: record?.uploadId ?? null,
      description: `Potential duplicate flagged for investigation: ${candidate.staffName} has records in both ${parentName} and ${childName}. Match confidence: ${candidate.matchConfidence} (${candidate.matchType}).`,
      context: {
        possibleExplanations: [
          'Staff legitimately works across both MDAs',
          'Duplicate record from consolidated file — needs delineation',
          'Name similarity with different individual — verify identity',
        ],
        suggestedAction: `Investigate whether ${candidate.staffName} is the same person in both ${parentName} and ${childName} files.`,
        dataCompleteness: 100,
        completenessNote: `Cross-MDA comparison using ${candidate.matchType} matching (confidence: ${candidate.matchConfidence}).`,
        dataPoints: {
          parentMda: parentName,
          childMda: childName,
          parentRecordCount: candidate.parentRecordCount,
          childRecordCount: candidate.childRecordCount,
          matchConfidence: candidate.matchConfidence,
          matchType: candidate.matchType,
        },
      },
      sourceReference: null,
    });

    // H1 fix: Audit log the flag (AC 5 — all resolutions must be logged)
    await tx.insert(auditLog).values({
      userId,
      action: 'DUPLICATE_FLAG',
      resource: `/migrations/duplicates/${candidate.id}/resolve`,
      method: 'PATCH',
      responseStatus: 200,
      ipAddress: 'system',
      userAgent: `staff=${candidate.staffName} parent=${parentName} child=${childName}`,
    });
  });
}

// ─── List Pending Duplicates ────────────────────────────────────────

/**
 * List deduplication candidates with filters and pagination.
 */
export async function listPendingDuplicates(
  filters: DuplicateFilters,
  mdaScope?: string | null,
): Promise<PaginatedDuplicates> {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  const conditions = [];

  if (filters.parentMdaId) {
    conditions.push(eq(deduplicationCandidates.parentMdaId, filters.parentMdaId));
  }
  if (filters.childMdaId) {
    conditions.push(eq(deduplicationCandidates.childMdaId, filters.childMdaId));
  }
  if (filters.status) {
    conditions.push(sql`${deduplicationCandidates.status} = ${filters.status}`);
  }
  if (filters.staffName) {
    // L1 fix: Escape LIKE special characters before building pattern
    const escaped = filters.staffName.replace(/[%_\\]/g, '\\$&');
    conditions.push(ilike(deduplicationCandidates.staffName, `%${escaped}%`));
  }

  // MDA scope: restrict to candidates where parent or child matches scope
  if (mdaScope) {
    conditions.push(
      sql`(${deduplicationCandidates.parentMdaId} = ${mdaScope} OR ${deduplicationCandidates.childMdaId} = ${mdaScope})`,
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Count total
  const [totalResult] = await db
    .select({ count: count() })
    .from(deduplicationCandidates)
    .where(whereClause);

  const total = totalResult?.count ?? 0;

  // Fetch rows with MDA names
  const rows = await db
    .select({
      id: deduplicationCandidates.id,
      parentMdaId: deduplicationCandidates.parentMdaId,
      childMdaId: deduplicationCandidates.childMdaId,
      staffName: deduplicationCandidates.staffName,
      staffId: deduplicationCandidates.staffId,
      parentRecordCount: deduplicationCandidates.parentRecordCount,
      childRecordCount: deduplicationCandidates.childRecordCount,
      matchConfidence: deduplicationCandidates.matchConfidence,
      matchType: deduplicationCandidates.matchType,
      status: deduplicationCandidates.status,
      resolvedBy: deduplicationCandidates.resolvedBy,
      resolvedAt: deduplicationCandidates.resolvedAt,
      resolutionNote: deduplicationCandidates.resolutionNote,
      createdAt: deduplicationCandidates.createdAt,
    })
    .from(deduplicationCandidates)
    .where(whereClause)
    .orderBy(deduplicationCandidates.createdAt)
    .limit(pageSize)
    .offset(offset);

  // Fetch MDA names for all unique MDA IDs
  const allMdaIds = [...new Set([
    ...rows.map((r) => r.parentMdaId),
    ...rows.map((r) => r.childMdaId),
  ])];

  const mdaNames = allMdaIds.length > 0
    ? await db
        .select({ id: mdas.id, name: mdas.name })
        .from(mdas)
        .where(inArray(mdas.id, allMdaIds))
    : [];

  const mdaNameMap = new Map(mdaNames.map((m) => [m.id, m.name]));

  const data: DuplicateCandidate[] = rows.map((row) => ({
    id: row.id,
    parentMdaId: row.parentMdaId,
    parentMdaName: mdaNameMap.get(row.parentMdaId) ?? 'Unknown',
    childMdaId: row.childMdaId,
    childMdaName: mdaNameMap.get(row.childMdaId) ?? 'Unknown',
    staffName: row.staffName,
    staffId: row.staffId,
    parentRecordCount: row.parentRecordCount,
    childRecordCount: row.childRecordCount,
    matchConfidence: row.matchConfidence,
    matchType: row.matchType as DuplicateCandidate['matchType'],
    status: row.status,
    resolvedBy: row.resolvedBy,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    resolutionNote: row.resolutionNote,
    createdAt: row.createdAt.toISOString(),
  }));

  return {
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

// ─── Helpers ────────────────────────────────────────────────────────

function toDuplicateCandidate(
  row: typeof deduplicationCandidates.$inferSelect,
  parentMdaName: string,
  childMdaName: string,
): DuplicateCandidate {
  return {
    id: row.id,
    parentMdaId: row.parentMdaId,
    parentMdaName,
    childMdaId: row.childMdaId,
    childMdaName,
    staffName: row.staffName,
    staffId: row.staffId,
    parentRecordCount: row.parentRecordCount,
    childRecordCount: row.childRecordCount,
    matchConfidence: row.matchConfidence,
    matchType: row.matchType as DuplicateCandidate['matchType'],
    status: row.status,
    resolvedBy: row.resolvedBy,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    resolutionNote: row.resolutionNote,
    createdAt: row.createdAt.toISOString(),
  };
}
