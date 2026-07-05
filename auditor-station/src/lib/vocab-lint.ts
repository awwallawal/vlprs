/**
 * vocab-lint.ts — non-punitive language guard (SQ2-6).
 *
 * The system prompt instructs the model to use non-punitive language; this is the deterministic
 * backstop that guarantees no banned term is *rendered* even if the model slips. It rewrites
 * banned terms to their neutral equivalents and reports what it changed (audited).
 *
 * Rules mirror the project vocabulary ([[domain]] non-punitive rule; vendor/vocabulary.snapshot):
 *   "observation" not "anomaly" · "variance" not "discrepancy" · "for review" not "flagged" ·
 *   "balance below zero" not "over-deduction" · no "red flag".
 */

export interface VocabViolation {
  term: string;
  suggestion: string;
}

export interface LintResult {
  clean: string;
  violations: VocabViolation[];
}

interface Rule {
  pattern: RegExp; // must be global
  suggestion: string;
}

// Plurals before singulars so the longer form matches first.
const RULES: Rule[] = [
  { pattern: /\banomalies\b/gi, suggestion: "observations" },
  { pattern: /\banomaly\b/gi, suggestion: "observation" },
  { pattern: /\bdiscrepancies\b/gi, suggestion: "variances" },
  { pattern: /\bdiscrepancy\b/gi, suggestion: "variance" },
  { pattern: /\bflagged\b/gi, suggestion: "marked for review" },
  // red-flag BEFORE the bare "flag" rule so "red flag" isn't half-rewritten.
  { pattern: /\bred[-\s]?flags?\b/gi, suggestion: "point(s) for review" },
  { pattern: /\bflag\b/gi, suggestion: "note for review" },
  { pattern: /\bover[-\s]?deductions?\b/gi, suggestion: "balance below zero" },
  { pattern: /\bculprits?\b/gi, suggestion: "record(s) for review" },
  { pattern: /\boffenders?\b/gi, suggestion: "record(s) for review" },
];

/** Preserve the leading capitalization of the matched term on the replacement. */
function matchCase(original: string, replacement: string): string {
  if (original[0] === original[0]?.toUpperCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

export function lintNonPunitive(text: string): LintResult {
  const violations: VocabViolation[] = [];
  let clean = text ?? "";
  for (const rule of RULES) {
    clean = clean.replace(rule.pattern, (m) => {
      const suggestion = matchCase(m, rule.suggestion);
      violations.push({ term: m, suggestion });
      return suggestion;
    });
  }
  return { clean, violations };
}
