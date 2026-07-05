/**
 * mda-resolve.ts — resolve a user's MDA term to the catalog's actual MDA code(s).
 *
 * Grounded in the data: it resolves against the distinct `mda` / `mdaName` pairs actually
 * present in catalog.db, rather than vendoring the SQ-1 200+-alias table. That keeps the
 * station severable and means it can only ever resolve to MDAs that exist in the snapshot.
 * (If richer alias handling is needed later, vendor mda-resolve.ts from the engine.)
 */

import type { DB } from "./catalog-db.js";

export interface MdaResolution {
  matched: boolean;
  /** Resolved MDA codes (>1 means the term was ambiguous). */
  codes: string[];
  /** Human label for the single resolved MDA, if unambiguous. */
  label?: string;
  /** Candidate "code — name" strings when ambiguous, for the caller to disambiguate. */
  candidates?: string[];
}

interface MdaRow {
  mda: string;
  mdaName: string | null;
}

function distinctMdas(db: DB): MdaRow[] {
  return db
    .prepare("SELECT DISTINCT mda, mdaName FROM records WHERE mda IS NOT NULL AND mda <> '' ORDER BY mda")
    .all() as MdaRow[];
}

export function resolveMda(db: DB, term: string): MdaResolution {
  const U = (term ?? "").toUpperCase().trim();
  if (!U) return { matched: false, codes: [] };

  const rows = distinctMdas(db);

  // 1. Exact code match.
  const exact = rows.filter((r) => r.mda.toUpperCase() === U);
  if (exact.length) {
    return { matched: true, codes: [exact[0].mda], label: exact[0].mdaName ?? exact[0].mda };
  }

  // 2. Substring match on code or full name (either direction).
  const partial = rows.filter((r) => {
    const code = r.mda.toUpperCase();
    const name = (r.mdaName ?? "").toUpperCase();
    return code.includes(U) || U.includes(code) || (name && name.includes(U));
  });

  const codes = [...new Set(partial.map((r) => r.mda))];
  if (codes.length === 1) {
    const hit = partial.find((r) => r.mda === codes[0])!;
    return { matched: true, codes, label: hit.mdaName ?? hit.mda };
  }
  if (codes.length > 1) {
    return {
      matched: false,
      codes,
      candidates: partial.map((r) => `${r.mda}${r.mdaName ? ` — ${r.mdaName}` : ""}`),
    };
  }

  return { matched: false, codes: [] };
}

/** List all MDA codes + names present in the snapshot (for get_mda_summary with no arg / help). */
export function listMdas(db: DB): MdaRow[] {
  return distinctMdas(db);
}
