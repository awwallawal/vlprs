import { eq, and, isNull, ilike, sql, aliasedTable, desc } from 'drizzle-orm';
import { db } from '../db/index';
import { mdas, mdaAliases } from '../db/schema';
import { AppError } from '../lib/appError';
import { withMdaScope } from '../lib/mdaScope';
import { generateUuidv7 } from '../lib/uuidv7';
import { VOCABULARY } from '@vlprs/shared';
import type { MdaListItem, MdaAlias } from '@vlprs/shared';

const parentMda = aliasedTable(mdas, 'parent_mda');

const mdaSelectFields = {
  id: mdas.id,
  code: mdas.code,
  name: mdas.name,
  abbreviation: mdas.abbreviation,
  isActive: mdas.isActive,
  parentMdaId: mdas.parentMdaId,
  parentMdaCode: parentMda.code,
};

// ─── Types ───────────────────────────────────────────────────────────

interface ListMdasFilters {
  isActive?: boolean;
  search?: string;
  parentMdaId?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────

/** Escape LIKE-pattern wildcards so user input is treated as literal text. */
function escapeLike(input: string): string {
  return input.replace(/[%_\\]/g, '\\$&');
}

// ─── Service Functions ──────────────────────────────────────────────

export async function listMdas(
  filters?: ListMdasFilters,
  mdaScope?: string | null,
): Promise<MdaListItem[]> {
  const conditions = [
    isNull(mdas.deletedAt),
    withMdaScope(mdas.id, mdaScope),
  ];

  if (filters?.isActive !== undefined) {
    conditions.push(eq(mdas.isActive, filters.isActive));
  } else {
    // Default: only active MDAs
    conditions.push(eq(mdas.isActive, true));
  }

  if (filters?.search) {
    conditions.push(
      ilike(mdas.name, `%${escapeLike(filters.search)}%`),
    );
  }

  if (filters?.parentMdaId) {
    conditions.push(eq(mdas.parentMdaId, filters.parentMdaId));
  }

  const rows = await db
    .select(mdaSelectFields)
    .from(mdas)
    .leftJoin(parentMda, eq(mdas.parentMdaId, parentMda.id))
    .where(and(...conditions))
    .orderBy(mdas.name);

  return rows;
}

export async function getMdaById(id: string): Promise<MdaListItem> {
  const [row] = await db
    .select(mdaSelectFields)
    .from(mdas)
    .leftJoin(parentMda, eq(mdas.parentMdaId, parentMda.id))
    .where(and(eq(mdas.id, id), isNull(mdas.deletedAt)));

  if (!row) {
    throw new AppError(404, 'MDA_NOT_FOUND', VOCABULARY.MDA_NOT_FOUND);
  }

  return row;
}

/**
 * 4-Layer MDA alias matching algorithm.
 * Layer 1: Exact code match
 * Layer 2: Normalised name match (strip "Oyo State" / "Ministry of" prefixes)
 * Layer 3: Alias table lookup
 * Layer 4: Return null (fuzzy suggestion — UI concern for future stories)
 */
export async function resolveMdaByName(input: string): Promise<MdaListItem | null> {
  // Layer 1: Exact code match
  const [byCode] = await db
    .select(mdaSelectFields)
    .from(mdas)
    .leftJoin(parentMda, eq(mdas.parentMdaId, parentMda.id))
    .where(and(eq(mdas.code, input.toUpperCase()), isNull(mdas.deletedAt)));

  if (byCode) return byCode;

  // Layer 2: Normalised name match
  const normalised = input
    .toLowerCase()
    .replace(/^oyo state\s*/i, '')
    .replace(/^ministry of\s*/i, '')
    .trim();

  const byName = await db
    .select(mdaSelectFields)
    .from(mdas)
    .leftJoin(parentMda, eq(mdas.parentMdaId, parentMda.id))
    .where(and(
      ilike(mdas.name, `%${escapeLike(normalised)}%`),
      isNull(mdas.deletedAt),
    ));

  if (byName.length === 1) return byName[0];

  // Layer 3: Alias table lookup
  const [byAlias] = await db
    .select(mdaSelectFields)
    .from(mdas)
    .leftJoin(parentMda, eq(mdas.parentMdaId, parentMda.id))
    .innerJoin(mdaAliases, eq(mdas.id, mdaAliases.mdaId))
    .where(eq(sql`LOWER(${mdaAliases.alias})`, input.toLowerCase()));

  if (byAlias) return byAlias;

  // Layer 4: Fuzzy suggestion — return null (UI concern)
  return null;
}

// ─── Fuzzy Matching (Layer 2.5) ──────────────────────────────────────

/** Levenshtein edit distance between two strings. */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/** Normalize for fuzzy comparison: strip punctuation, collapse whitespace, uppercase. */
function normalizeForFuzzy(input: string): string {
  return input
    .replace(/['`.]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

interface FuzzyCandidate {
  mda: MdaListItem;
  score: number;
  reason: 'prefix' | 'levenshtein' | 'normalized';
}

/**
 * Layer 2.5: Find fuzzy candidates among all active MDAs.
 * Does NOT change resolveMdaByName() behaviour — returns candidate suggestions only.
 */
async function findFuzzyCandidates(normalizedInput: string): Promise<FuzzyCandidate[]> {
  const allMdas = await listMdas({ isActive: true });
  const norm = normalizeForFuzzy(normalizedInput);
  const normNoSpace = norm.replace(/\s/g, '');

  const candidates: FuzzyCandidate[] = [];

  for (const mda of allMdas) {
    const normCode = normalizeForFuzzy(mda.code);
    const normName = normalizeForFuzzy(mda.name);
    const normAbbr = normalizeForFuzzy(mda.abbreviation);

    let bestScore = 0;
    let bestReason: FuzzyCandidate['reason'] = 'prefix';

    // Prefix match: input is prefix of code/name/abbreviation or vice versa
    if (normCode.startsWith(norm) || norm.startsWith(normCode) ||
        normName.startsWith(norm) || norm.startsWith(normName) ||
        normAbbr.startsWith(norm) || norm.startsWith(normAbbr)) {
      bestScore = 92;
      bestReason = 'prefix';
    }

    // Normalized (space-collapsed) exact match
    const codeNoSpace = normCode.replace(/\s/g, '');
    const nameNoSpace = normName.replace(/\s/g, '');
    const abbrNoSpace = normAbbr.replace(/\s/g, '');

    if (normNoSpace === codeNoSpace || normNoSpace === nameNoSpace || normNoSpace === abbrNoSpace) {
      if (bestScore < 92) {
        bestScore = 92;
        bestReason = 'normalized';
      }
    }

    // Levenshtein for short strings (< 15 chars) against code and abbreviation only
    if (norm.length < 15) {
      for (const target of [normCode, normAbbr]) {
        if (target.length >= 15) continue;
        const dist = levenshteinDistance(norm, target);
        if (dist <= 1 && bestScore < 88) {
          bestScore = 88;
          bestReason = 'levenshtein';
        } else if (dist <= 2 && bestScore < 80) {
          bestScore = 80;
          bestReason = 'levenshtein';
        }
      }
    }

    if (bestScore > 0) {
      candidates.push({ mda, score: bestScore, reason: bestReason });
    }
  }

  return candidates.sort((a, b) => b.score - a.score);
}

/**
 * Resolve an MDA string with fuzzy candidates.
 * Calls existing resolveMdaByName() first. If resolved → return with empty candidates.
 * If null → call findFuzzyCandidates() → return with candidates.
 */
export async function resolveMdaWithCandidates(input: string): Promise<{
  resolved: MdaListItem | null;
  candidates: Array<{ mda: MdaListItem; score: number; reason: string }>;
}> {
  const resolved = await resolveMdaByName(input);
  if (resolved) {
    return { resolved, candidates: [] };
  }
  const candidates = await findFuzzyCandidates(input);
  return { resolved: null, candidates };
}

// ─── Alias CRUD ───────────────────────────────────���──────────────────

export async function createAlias(alias: string, mdaId: string): Promise<MdaAlias> {
  const trimmed = alias.trim();
  if (!trimmed) {
    throw new AppError(400, 'EMPTY_ALIAS', 'Alias cannot be empty');
  }

  // Reject if alias matches an existing MDA code (would create ambiguity)
  const [existingMda] = await db
    .select({ id: mdas.id })
    .from(mdas)
    .where(and(eq(sql`UPPER(${mdas.code})`, trimmed.toUpperCase()), isNull(mdas.deletedAt)));
  if (existingMda) {
    throw new AppError(400, 'ALIAS_CONFLICTS_WITH_CODE', 'This alias matches an existing MDA code');
  }

  // Verify target MDA exists
  const mda = await getMdaById(mdaId);

  try {
    const id = generateUuidv7();
    const [created] = await db.insert(mdaAliases).values({ id, alias: trimmed, mdaId }).returning();
    return { ...created, createdAt: created.createdAt.toISOString() } as unknown as MdaAlias;
  } catch (err: unknown) {
    // Handle unique constraint violation on LOWER(alias)
    // Drizzle may wrap pg errors; check both direct and nested .cause
    const extractPgCode = (e: unknown): string => {
      if (typeof e === 'object' && e !== null && 'code' in e) return (e as { code: string }).code;
      if (typeof e === 'object' && e !== null && 'cause' in e) return extractPgCode((e as { cause: unknown }).cause);
      return '';
    };
    if (extractPgCode(err) === '23505') {
      throw new AppError(409, 'ALIAS_EXISTS', `This alias is already mapped to ${mda.name}`);
    }
    throw err;
  }
}

export async function listAliases(): Promise<Array<MdaAlias & { mdaName: string; mdaCode: string }>> {
  const rows = await db
    .select({
      id: mdaAliases.id,
      mdaId: mdaAliases.mdaId,
      alias: mdaAliases.alias,
      createdAt: mdaAliases.createdAt,
      mdaName: mdas.name,
      mdaCode: mdas.code,
    })
    .from(mdaAliases)
    .innerJoin(mdas, eq(mdaAliases.mdaId, mdas.id))
    .orderBy(desc(mdaAliases.createdAt));

  return rows.map((r) => ({
    id: r.id,
    mdaId: r.mdaId,
    alias: r.alias,
    createdAt: r.createdAt.toISOString(),
    mdaName: r.mdaName,
    mdaCode: r.mdaCode,
  })) as Array<MdaAlias & { mdaName: string; mdaCode: string }>;
}

export async function deleteAlias(id: string): Promise<void> {
  const [deleted] = await db.delete(mdaAliases).where(eq(mdaAliases.id, id)).returning({ id: mdaAliases.id });
  if (!deleted) {
    throw new AppError(404, 'ALIAS_NOT_FOUND', 'Alias not found');
  }
}
