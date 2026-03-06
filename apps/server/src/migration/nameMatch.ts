/**
 * nameMatch.ts — Staff name fuzzy matching for cross-MDA person detection.
 *
 * Ported from SQ-1 pipeline: scripts/legacy-report/utils/name-match.ts
 *
 * Match levels: exact -> surname+first-initial -> Levenshtein <= 2
 */

/** Honorific/title prefixes to strip before matching. */
const TITLE_PATTERNS = [
  /^(MRS?\.?|MISS|DR\.?|CHIEF|ALHAJ[IA]\.?|ALH\.?|PRINCE|PRINCESS|ENGR\.?|ARC\.?|PROF\.?|BARR\.?|HON\.?|COMR?A?DE?\.?|COL\.?|GEN\.?|CAPT\.?|PASTOR|REV\.?|ELDER|DEACON(ESS)?|OTUNBA|BAALE)\s+/i,
];

export type MatchConfidence = 'exact' | 'high' | 'fuzzy' | 'none';

export interface NameMatchResult {
  confidence: MatchConfidence;
  matchedName: string | null;
  distance: number;
}

/**
 * Normalize a name for comparison.
 * - Uppercase, trim, collapse whitespace
 * - Remove parenthetical suffixes like "(LATE)"
 * - Strip honorific prefixes (up to 2 passes for chained titles)
 * - Strip trailing punctuation
 */
export function normalizeName(raw: string): string {
  let name = raw.toUpperCase().trim();
  // Remove parenthetical notes: (LATE), (Mrs), etc.
  name = name.replace(/\([^)]*\)/g, '').trim();
  // Collapse whitespace
  name = name.replace(/\s+/g, ' ');
  // Strip titles (may appear multiple times, e.g., "MRS. DR. NAME")
  for (let i = 0; i < 2; i++) {
    for (const pattern of TITLE_PATTERNS) {
      name = name.replace(pattern, '').trim();
    }
  }
  // Strip trailing periods or commas
  name = name.replace(/[.,]+$/, '').trim();
  return name;
}

/**
 * Extract surname (first word) and first initial of given name.
 * Returns null if the name has fewer than 2 parts.
 */
export function surnameAndInitial(normalized: string): string | null {
  const parts = normalized.split(' ').filter((p) => p.length > 0);
  if (parts.length < 2) return null;
  return parts[0] + ' ' + parts[1][0];
}

/**
 * Levenshtein distance (edit distance) between two strings.
 * Optimized for short strings (names) with early exit when length diff > 3.
 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Early exit if length difference alone exceeds threshold
  if (Math.abs(a.length - b.length) > 3) return Math.abs(a.length - b.length);

  const matrix: number[][] = [];
  for (let i = 0; i <= a.length; i++) matrix[i] = [i];
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return matrix[a.length][b.length];
}

/**
 * Match a query name against a candidate name.
 * Both should be raw (unnormalized) — normalization is applied internally.
 */
export function matchName(query: string, candidate: string): NameMatchResult {
  const qNorm = normalizeName(query);
  const cNorm = normalizeName(candidate);

  if (!qNorm || !cNorm) {
    return { confidence: 'none', matchedName: null, distance: Infinity };
  }

  // Level 1: Exact match
  if (qNorm === cNorm) {
    return { confidence: 'exact', matchedName: candidate, distance: 0 };
  }

  // Level 2: Surname + first initial match
  const qSI = surnameAndInitial(qNorm);
  const cSI = surnameAndInitial(cNorm);
  if (qSI && cSI && qSI === cSI) {
    return { confidence: 'high', matchedName: candidate, distance: 0 };
  }

  // Level 3: Levenshtein <= 2
  const dist = levenshtein(qNorm, cNorm);
  if (dist <= 2) {
    return { confidence: 'fuzzy', matchedName: candidate, distance: dist };
  }

  return { confidence: 'none', matchedName: null, distance: dist };
}

/**
 * Pre-built index for efficient name lookups within an MDA.
 * Groups normalized names by MDA code for fast search.
 */
export interface NameIndex {
  byMda: Map<string, Array<{ normalized: string; original: string; indices: number[] }>>;
}

/**
 * Build a name index from an array of records.
 * Each record must have a `name` and `mdaCode` field.
 */
export function buildNameIndex(
  records: Array<{ name: string; mdaCode: string }>,
): NameIndex {
  const byMda = new Map<string, Array<{ normalized: string; original: string; indices: number[] }>>();

  for (let i = 0; i < records.length; i++) {
    const { name, mdaCode } = records[i];
    const norm = normalizeName(name);
    if (!norm || !mdaCode) continue;

    if (!byMda.has(mdaCode)) byMda.set(mdaCode, []);
    const mdaEntries = byMda.get(mdaCode)!;

    const existing = mdaEntries.find((e) => e.normalized === norm);
    if (existing) {
      existing.indices.push(i);
    } else {
      mdaEntries.push({ normalized: norm, original: name, indices: [i] });
    }
  }

  return { byMda };
}

/**
 * Search for a name within an MDA in the index.
 * Returns the best match (highest confidence).
 */
export function searchName(
  query: string,
  mdaCode: string,
  index: NameIndex,
): NameMatchResult & { indices: number[] } {
  const entries = index.byMda.get(mdaCode);
  if (!entries || entries.length === 0) {
    return { confidence: 'none', matchedName: null, distance: Infinity, indices: [] };
  }

  const qNorm = normalizeName(query);
  if (!qNorm) {
    return { confidence: 'none', matchedName: null, distance: Infinity, indices: [] };
  }

  // Level 1: Exact match
  const exactMatch = entries.find((e) => e.normalized === qNorm);
  if (exactMatch) {
    return { confidence: 'exact', matchedName: exactMatch.original, distance: 0, indices: exactMatch.indices };
  }

  // Level 2: Surname + first initial
  const qSI = surnameAndInitial(qNorm);
  if (qSI) {
    for (const entry of entries) {
      const eSI = surnameAndInitial(entry.normalized);
      if (eSI && qSI === eSI) {
        return { confidence: 'high', matchedName: entry.original, distance: 0, indices: entry.indices };
      }
    }
  }

  // Level 3: Fuzzy match (Levenshtein <= 2) — only check similar length
  let bestFuzzy: (typeof entries)[0] | null = null;
  let bestDist = 3;
  for (const entry of entries) {
    if (Math.abs(qNorm.length - entry.normalized.length) > 2) continue;
    const dist = levenshtein(qNorm, entry.normalized);
    if (dist < bestDist) {
      bestDist = dist;
      bestFuzzy = entry;
    }
  }
  if (bestFuzzy) {
    return { confidence: 'fuzzy', matchedName: bestFuzzy.original, distance: bestDist, indices: bestFuzzy.indices };
  }

  return { confidence: 'none', matchedName: null, distance: Infinity, indices: [] };
}
