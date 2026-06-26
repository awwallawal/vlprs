/**
 * normalize.ts — name normalization for the auditor station.
 *
 * VENDORED (not imported) from the SQ-1 legacy-report engine, per the severability
 * invariant: the station must build and run with zero reference to the parent repo.
 *
 * Sources (see vendor/provenance.json for the exact SHA + snapshot date):
 *   - normalizeName  ← scripts/legacy-report/utils/name-match.ts
 *   - canonicalize   ← scripts/legacy-report/utils/yoruba-name-normalize.ts
 *
 * PARITY NOTE: if the SQ-1 originals change, re-run `pnpm sync:parent` to refresh the
 * provenance SHA and review the diff. Do NOT silently fork these — a drift here would let
 * an auditor-station answer disagree with the app/engine on who is who.
 *
 * Two layers, both deterministic:
 *   - normalizeName(): light — uppercase, strip titles/parentheticals, collapse spaces.
 *     Good for exact lookup + display.
 *   - canonicalize(): Yoruba/Nigerian variant-collapsing — pronunciation variants of the
 *     SAME person reduce to one string (ALATISHE === ALATISE). Good for same-person search.
 */

// ───────────────────────── normalizeName (from name-match.ts) ─────────────────────────

/** Honorific/title prefixes to strip before matching. */
const TITLE_PATTERNS = [
  /^(MRS?\.?|MISS|DR\.?|CHIEF|ALHAJ[IA]\.?|ALH\.?|PRINCE|PRINCESS|ENGR\.?|ARC\.?|PROF\.?|BARR\.?|HON\.?|COMR?A?DE?\.?|COL\.?|GEN\.?|CAPT\.?|PASTOR|REV\.?|ELDER|DEACON(ESS)?|OTUNBA|BAALE)\s+/i,
];

/**
 * Normalize a name for comparison.
 * - Uppercase, trim, collapse whitespace
 * - Remove parenthetical suffixes like "(LATE)"
 * - Strip honorific prefixes
 * - Strip trailing punctuation
 */
export function normalizeName(raw: string): string {
  let name = (raw ?? "").toUpperCase().trim();
  name = name.replace(/\([^)]*\)/g, "").trim();
  name = name.replace(/\s+/g, " ");
  for (let i = 0; i < 2; i++) {
    for (const pattern of TITLE_PATTERNS) {
      name = name.replace(pattern, "").trim();
    }
  }
  name = name.replace(/[.,]+$/, "").trim();
  return name;
}

// ──────────────────── canonicalize (from yoruba-name-normalize.ts) ────────────────────

export interface CanonicalizationTrace {
  input: string;
  steps: { rule: string; after: string }[];
  output: string;
}

const TITLES = [
  "MR", "MRS", "MISS", "MS", "DR", "DRS",
  "CHIEF", "ALHAJI", "ALHAJA", "HRH",
  "ENGR", "PROF", "PROFESSOR",
  "REV", "REVD", "PASTOR", "PST", "FR", "BARR",
  "HON", "HONOURABLE",
  "JP", "SAN",
];

const SUFFIXES = ["JR", "JNR", "SR", "SNR", "II", "III", "IV"];

function apply(
  s: string,
  rule: string,
  transform: (x: string) => string,
  trace?: CanonicalizationTrace,
): string {
  const after = transform(s);
  if (trace && after !== s) trace.steps.push({ rule, after });
  return after;
}

/** Main canonicalizer. Apply all rules in order; return normalized form. */
export function canonicalize(raw: string): string {
  return canonicalizeWithTrace(raw).output;
}

export function canonicalizeWithTrace(raw: string): CanonicalizationTrace {
  const trace: CanonicalizationTrace = { input: raw, steps: [], output: "" };
  let s = raw ?? "";

  // 1. Unicode + case + whitespace normalization
  s = apply(s, "uppercase", (x) => x.toUpperCase(), trace);
  s = apply(s, "strip-diacritics", (x) =>
    x.normalize("NFD").replace(/[̀-ͯ]/g, "").normalize("NFC"), trace);
  s = apply(s, "strip-smart-quotes", (x) =>
    x.replace(/[‘’“”`]/g, ""), trace);
  s = apply(s, "punct-to-space", (x) =>
    x.replace(/[.,;:!?()\[\]{}"'\/\\_]/g, " "), trace);
  s = apply(s, "dash-to-space", (x) => x.replace(/[–—−-]/g, " "), trace);
  s = apply(s, "collapse-spaces", (x) => x.replace(/\s+/g, " ").trim(), trace);

  // 2. Strip titles (prefix tokens)
  for (const t of TITLES) {
    s = apply(s, `strip-title-${t}`, (x) =>
      x.replace(new RegExp(`^(${t})\\b\\.?\\s*`, "i"), "")
        .replace(new RegExp(`\\s+(${t})\\b\\.?`, "i"), ""), trace);
  }

  // 3. Strip suffixes (JR/SR/etc. at end)
  for (const suf of SUFFIXES) {
    s = apply(s, `strip-suffix-${suf}`, (x) =>
      x.replace(new RegExp(`\\s+${suf}\\b\\.?$`, "i"), ""), trace);
  }

  // 4. OLUWA-/ADEWA-/OLAWA- prefix contraction (Yoruba name pattern)
  s = apply(s, "contract-OLUWA", (x) => x.replace(/\bOLUWA/g, "OLU"), trace);
  s = apply(s, "contract-ADEWA", (x) => x.replace(/\bADEWA/g, "ADE"), trace);
  s = apply(s, "contract-OLAWA", (x) => x.replace(/\bOLAWA/g, "OLA"), trace);
  s = apply(s, "contract-OMOWU", (x) => x.replace(/\bOMOWU/g, "OMO"), trace);

  // 5. Silent-H in -SH-/-PH- clusters before any vowel (Yoruba softening).
  s = apply(s, "silent-H-in-SH", (x) => x.replace(/SH([AEIOU])/g, "S$1"), trace);
  s = apply(s, "silent-H-in-PH", (x) => x.replace(/PH([AEIOU])/g, "P$1"), trace);

  // 5b. Silent-H between vowels (Arabic loanwords).
  s = apply(s, "silent-H-between-vowels", (x) =>
    x.replace(/([AEIOU])H([AEIOU])/g, "$1$2"), trace);

  // 6. Vowel-cluster collapse
  s = apply(s, "collapse-EE-IE-EI", (x) => x.replace(/EE|IE|EI/g, "E"), trace);
  s = apply(s, "collapse-II", (x) => x.replace(/II/g, "I"), trace);
  s = apply(s, "collapse-OO", (x) => x.replace(/OO/g, "O"), trace);
  s = apply(s, "collapse-UU", (x) => x.replace(/UU/g, "U"), trace);
  s = apply(s, "collapse-AA", (x) => x.replace(/AA/g, "A"), trace);

  // 7. Double consonant collapse
  s = apply(s, "collapse-double-consonant", (x) =>
    x.replace(/([BCDFGHJKLMNPQRSTVWXYZ])\1/g, "$1"), trace);

  // 8. Yoruba NM-cluster collapse
  s = apply(s, "collapse-NM-to-M", (x) => x.replace(/NM/g, "M"), trace);

  // 8b. Terminal -U after a consonant (Arabic-loanword pattern).
  s = apply(s, "drop-terminal-U-after-consonant", (x) =>
    x.replace(/([BCDFGHJKLMNPQRSTVWXYZ])U\b/g, "$1"), trace);

  // 9. Remove remaining whitespace runs
  s = apply(s, "final-collapse-spaces", (x) => x.replace(/\s+/g, " ").trim(), trace);

  trace.output = s;
  return trace;
}

/**
 * The station's same-person search key: strip titles/parentheticals (normalizeName) FIRST,
 * then collapse Yoruba/Nigerian spelling variants (canonicalize). Composing the two vendored
 * functions (rather than forking either) is what lets "MRS. ALATISHE … (LATE)" and
 * "ALATISE …" reduce to one key. This is the key stored as `canonicalName` in the DB.
 */
export function canonicalKey(raw: string): string {
  return canonicalize(normalizeName(raw));
}

/** Are two names the same-person candidate under the canonical normalizer? */
export function sameCanonical(a: string, b: string): boolean {
  return canonicalize(a) === canonicalize(b);
}
