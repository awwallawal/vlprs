/**
 * personMatchingService — Cross-MDA person matching.
 *
 * Scans migration_records, detects persons appearing in multiple MDAs,
 * and stores match results in person_matches table.
 */

import { eq, and, isNull, or, sql, isNotNull } from 'drizzle-orm';
import { db } from '../db/index';
import { migrationRecords, personMatches, mdas } from '../db/schema';
import { normalizeName, matchName } from '../migration/nameMatch';
import { AppError } from '../lib/appError';
import { withMdaScope } from '../lib/mdaScope';

// ─── Parent MDA lookup (CDU/Agriculture cross-posting) ──────────────

async function loadParentMdaMap(): Promise<Map<string, string>> {
  const rows = await db
    .select({ id: mdas.id, parentMdaId: mdas.parentMdaId })
    .from(mdas)
    .where(isNotNull(mdas.parentMdaId));
  const map = new Map<string, string>();
  for (const r of rows) {
    if (r.parentMdaId) map.set(r.id, r.parentMdaId);
  }
  return map;
}

/**
 * Check if two MDAs are in a parent/child relationship.
 */
function isParentChildPair(mdaIdA: string, mdaIdB: string, parentMap: Map<string, string>): boolean {
  return parentMap.get(mdaIdA) === mdaIdB || parentMap.get(mdaIdB) === mdaIdA;
}

// ─── Types ──────────────────────────────────────────────────────────

type MatchType = 'exact_name' | 'staff_id' | 'surname_initial' | 'fuzzy_name' | 'manual';
type MatchStatus = 'auto_confirmed' | 'pending_review' | 'confirmed' | 'rejected';

interface PersonRecord {
  staffName: string;
  normalizedName: string;
  employeeNo: string | null;
  mdaId: string;
  mdaCode: string;
}

interface MatchEntry {
  personAName: string;
  personAStaffId: string | null;
  personAMdaId: string;
  personBName: string;
  personBStaffId: string | null;
  personBMdaId: string;
  matchType: MatchType;
  confidence: string;
  status: MatchStatus;
}

// ─── Confidence & Status Maps ────────────────────────────────────────

const CONFIDENCE: Record<MatchType, string> = {
  exact_name: '1.00',
  staff_id: '1.00',
  surname_initial: '0.80',
  fuzzy_name: '0.60',
  manual: '1.00',
};

function getStatus(matchType: MatchType): MatchStatus {
  if (matchType === 'exact_name' || matchType === 'staff_id') return 'auto_confirmed';
  return 'pending_review';
}

// ─── Core Matching ──────────────────────────────────────────────────

/**
 * Run person matching across all migration records (or scoped to an MDA).
 * Returns summary of matches found.
 */
export async function runPersonMatching(mdaScope?: string | null) {
  // Load parent MDA relationships for CDU/Agriculture cross-posting awareness
  const parentMdaMap = await loadParentMdaMap();

  // Load all migration records with MDA info
  const records = await db
    .select({
      staffName: migrationRecords.staffName,
      employeeNo: migrationRecords.employeeNo,
      mdaId: migrationRecords.mdaId,
      mdaCode: mdas.code,
    })
    .from(migrationRecords)
    .innerJoin(mdas, eq(migrationRecords.mdaId, mdas.id))
    .where(
      and(
        isNull(migrationRecords.deletedAt),
        mdaScope ? withMdaScope(migrationRecords.mdaId, mdaScope) : undefined,
      ),
    );

  if (records.length === 0) {
    return { totalPersons: 0, multiMdaPersons: 0, autoMatched: 0, pendingReview: 0 };
  }

  // Build normalized records
  const personRecords: PersonRecord[] = records.map((r) => ({
    staffName: r.staffName,
    normalizedName: normalizeName(r.staffName),
    employeeNo: r.employeeNo?.trim() || null,
    mdaId: r.mdaId,
    mdaCode: r.mdaCode,
  }));

  // Load existing matches to avoid duplicates
  const existingMatches = await loadExistingMatchPairs();

  const newMatches: MatchEntry[] = [];

  // ─── Phase 1: Staff ID matching across MDAs ───
  const staffIdGroups = new Map<string, Map<string, PersonRecord>>();
  for (const pr of personRecords) {
    if (!pr.employeeNo) continue;
    if (!staffIdGroups.has(pr.employeeNo)) staffIdGroups.set(pr.employeeNo, new Map());
    const mdaMap = staffIdGroups.get(pr.employeeNo)!;
    if (!mdaMap.has(pr.mdaId)) mdaMap.set(pr.mdaId, pr);
  }

  for (const [, mdaMap] of staffIdGroups) {
    if (mdaMap.size < 2) continue;
    const entries = [...mdaMap.values()];
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const a = entries[i];
        const b = entries[j];
        const pairKey = makePairKey(a.normalizedName, a.mdaId, b.normalizedName, b.mdaId);
        if (existingMatches.has(pairKey)) continue;
        existingMatches.add(pairKey);
        newMatches.push({
          personAName: a.normalizedName,
          personAStaffId: a.employeeNo,
          personAMdaId: a.mdaId,
          personBName: b.normalizedName,
          personBStaffId: b.employeeNo,
          personBMdaId: b.mdaId,
          matchType: 'staff_id',
          confidence: CONFIDENCE.staff_id,
          status: getStatus('staff_id'),
        });
      }
    }
  }

  // ─── Phase 2: Exact name matching across MDAs ───
  // Parent/child MDAs (e.g., CDU↔Agriculture) get auto-confirmed as expected cross-postings
  const nameGroups = new Map<string, Map<string, PersonRecord>>();
  for (const pr of personRecords) {
    if (!pr.normalizedName) continue;
    if (!nameGroups.has(pr.normalizedName)) nameGroups.set(pr.normalizedName, new Map());
    const mdaMap = nameGroups.get(pr.normalizedName)!;
    if (!mdaMap.has(pr.mdaId)) mdaMap.set(pr.mdaId, pr);
  }

  for (const [, mdaMap] of nameGroups) {
    if (mdaMap.size < 2) continue;
    const entries = [...mdaMap.values()];
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const a = entries[i];
        const b = entries[j];
        const pairKey = makePairKey(a.normalizedName, a.mdaId, b.normalizedName, b.mdaId);
        if (existingMatches.has(pairKey)) continue;
        existingMatches.add(pairKey);
        newMatches.push({
          personAName: a.normalizedName,
          personAStaffId: a.employeeNo,
          personAMdaId: a.mdaId,
          personBName: b.normalizedName,
          personBStaffId: b.employeeNo,
          personBMdaId: b.mdaId,
          matchType: 'exact_name',
          confidence: CONFIDENCE.exact_name,
          status: 'auto_confirmed',
        });
      }
    }
  }

  // ─── Phase 3: Fuzzy matching across MDAs (surname+initial, Levenshtein) ───
  // Compare unique names across different MDAs using 3-level matching
  const allUniqueByMda = new Map<string, PersonRecord[]>();
  for (const pr of personRecords) {
    if (!pr.normalizedName) continue;
    if (!allUniqueByMda.has(pr.mdaId)) allUniqueByMda.set(pr.mdaId, []);
    const list = allUniqueByMda.get(pr.mdaId)!;
    if (!list.some((x) => x.normalizedName === pr.normalizedName)) {
      list.push(pr);
    }
  }

  const mdaIds = [...allUniqueByMda.keys()];
  for (let mi = 0; mi < mdaIds.length; mi++) {
    for (let mj = mi + 1; mj < mdaIds.length; mj++) {
      const listA = allUniqueByMda.get(mdaIds[mi])!;
      const listB = allUniqueByMda.get(mdaIds[mj])!;

      for (const a of listA) {
        for (const b of listB) {
          // Skip if already matched exactly
          if (a.normalizedName === b.normalizedName) continue;

          const pairKey = makePairKey(a.normalizedName, a.mdaId, b.normalizedName, b.mdaId);
          if (existingMatches.has(pairKey)) continue;

          const result = matchName(a.normalizedName, b.normalizedName);
          if (result.confidence === 'none') continue;

          const matchType: MatchType =
            result.confidence === 'high' ? 'surname_initial' : 'fuzzy_name';

          // Parent/child MDAs (CDU↔Agriculture) auto-confirm even fuzzy matches
          const isParentChild = isParentChildPair(a.mdaId, b.mdaId, parentMdaMap);
          const status: MatchStatus = isParentChild ? 'auto_confirmed' : getStatus(matchType);

          existingMatches.add(pairKey);
          newMatches.push({
            personAName: a.normalizedName,
            personAStaffId: a.employeeNo,
            personAMdaId: a.mdaId,
            personBName: b.normalizedName,
            personBStaffId: b.employeeNo,
            personBMdaId: b.mdaId,
            matchType,
            confidence: CONFIDENCE[matchType],
            status,
          });
        }
      }
    }
  }

  // ─── Insert new matches ───
  if (newMatches.length > 0) {
    const BATCH_SIZE = 100;
    for (let i = 0; i < newMatches.length; i += BATCH_SIZE) {
      const batch = newMatches.slice(i, i + BATCH_SIZE);
      await db.insert(personMatches).values(batch);
    }
  }

  // ─── Compute summary ───
  const totalPersons = nameGroups.size;
  const multiMdaPersons = [...nameGroups.values()].filter((m) => m.size >= 2).length;
  const autoMatched = newMatches.filter((m) => m.status === 'auto_confirmed').length;
  const pendingReview = newMatches.filter((m) => m.status === 'pending_review').length;

  return { totalPersons, multiMdaPersons, autoMatched, pendingReview };
}

/**
 * Confirm a pending match.
 */
export async function confirmMatch(matchId: string, userId: string) {
  const [match] = await db
    .select()
    .from(personMatches)
    .where(eq(personMatches.id, matchId));

  if (!match) {
    throw new AppError(404, 'MATCH_NOT_FOUND', 'The requested match could not be found.');
  }

  if (match.status !== 'pending_review') {
    throw new AppError(400, 'MATCH_NOT_PENDING', 'Only pending matches can be confirmed.');
  }

  await db
    .update(personMatches)
    .set({
      status: 'confirmed',
      confirmedBy: userId,
      confirmedAt: new Date(),
    })
    .where(eq(personMatches.id, matchId));

  return { id: matchId, status: 'confirmed' };
}

/**
 * Reject a pending match.
 */
export async function rejectMatch(matchId: string, userId: string) {
  const [match] = await db
    .select()
    .from(personMatches)
    .where(eq(personMatches.id, matchId));

  if (!match) {
    throw new AppError(404, 'MATCH_NOT_FOUND', 'The requested match could not be found.');
  }

  if (match.status !== 'pending_review') {
    throw new AppError(400, 'MATCH_NOT_PENDING', 'Only pending matches can be rejected.');
  }

  await db
    .update(personMatches)
    .set({
      status: 'rejected',
      confirmedBy: userId,
      confirmedAt: new Date(),
    })
    .where(eq(personMatches.id, matchId));

  return { id: matchId, status: 'rejected' };
}

/**
 * Get all matches for a person (by normalized name), optionally scoped to an MDA.
 */
export async function getMatchesForPerson(personName: string, mdaScope?: string | null) {
  const normalized = normalizeName(personName);

  const conditions = [
    or(
      eq(personMatches.personAName, normalized),
      eq(personMatches.personBName, normalized),
    ),
  ];

  if (mdaScope) {
    conditions.push(
      or(
        eq(personMatches.personAMdaId, mdaScope),
        eq(personMatches.personBMdaId, mdaScope),
      ),
    );
  }

  return db
    .select()
    .from(personMatches)
    .where(and(...conditions));
}

/**
 * List pending matches for review.
 */
export async function listPendingMatches(page: number, limit: number, mdaScope?: string | null) {
  const conditions = [eq(personMatches.status, 'pending_review')];

  if (mdaScope) {
    conditions.push(
      or(
        eq(personMatches.personAMdaId, mdaScope),
        eq(personMatches.personBMdaId, mdaScope),
      )!,
    );
  }

  const [{ count: totalStr }] = await db
    .select({ count: sql<string>`count(*)` })
    .from(personMatches)
    .where(and(...conditions));

  const total = Number(totalStr);
  const offset = (page - 1) * limit;

  const rows = await db
    .select()
    .from(personMatches)
    .where(and(...conditions))
    .limit(limit)
    .offset(offset);

  return {
    data: rows,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

// ─── Internals ──────────────────────────────────────────────────────

/**
 * Create a canonical pair key to prevent duplicate matches.
 * Always sorts names+mdaIds to ensure (A,B) and (B,A) produce the same key.
 */
function makePairKey(nameA: string, mdaIdA: string, nameB: string, mdaIdB: string): string {
  const keyA = `${nameA}|${mdaIdA}`;
  const keyB = `${nameB}|${mdaIdB}`;
  return keyA < keyB ? `${keyA}::${keyB}` : `${keyB}::${keyA}`;
}

/**
 * Load existing match pair keys to avoid creating duplicates.
 */
async function loadExistingMatchPairs(): Promise<Set<string>> {
  const existing = await db
    .select({
      personAName: personMatches.personAName,
      personAMdaId: personMatches.personAMdaId,
      personBName: personMatches.personBName,
      personBMdaId: personMatches.personBMdaId,
    })
    .from(personMatches);

  const pairs = new Set<string>();
  for (const row of existing) {
    pairs.add(makePairKey(row.personAName, row.personAMdaId, row.personBName, row.personBMdaId));
  }
  return pairs;
}
