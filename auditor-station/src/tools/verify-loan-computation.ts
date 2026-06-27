/**
 * verify_loan_computation — check loan figures against the scheme formula (13.33% / ÷60).
 *
 * Two modes:
 *   - explicit: pass principal + installmentCount (+ optional observed interest / monthly
 *     deduction) → returns expected values and the variance.
 *   - by name: pass name (+ optional mda) → looks up the matching records and verifies each
 *     record's stored interest against what the formula expects from its principal & tenure.
 *
 * Non-punitive: a difference is an "observation for review", never an error/flag.
 */

import { canonicalKey } from "../lib/normalize.js";
import { resolveMda } from "../lib/mda-resolve.js";
import {
  BASE_MONTHS,
  STANDARD_RATE,
  TOLERANCE_NAIRA,
  expectedInterest,
  expectedMonthlyDeduction,
} from "../../vendor/loan-model.js";
import type { DB } from "../lib/catalog-db.js";
import { asNumber, asString, citationsFrom, type ToolDef, type ToolResult } from "./types.js";

interface Row {
  name: string;
  mda: string | null;
  year: number | null;
  month: number | null;
  principal: number | null;
  interest: number | null;
  monthlyDeduction: number | null;
  installmentCount: number | null;
  sourceFile: string | null;
}

function verifyOne(principal: number, installmentCount: number, observedInterest: number | null) {
  const expInterest = expectedInterest(principal, installmentCount);
  const expDeduction = expectedMonthlyDeduction(principal, installmentCount);
  const variance = observedInterest != null ? observedInterest - expInterest : null;
  const withinTolerance = variance != null ? Math.abs(variance) <= TOLERANCE_NAIRA : null;
  return {
    principal,
    installmentCount,
    expectedInterest: Math.round(expInterest * 100) / 100,
    expectedMonthlyDeduction: Math.round(expDeduction * 100) / 100,
    observedInterest,
    variance: variance != null ? Math.round(variance * 100) / 100 : null,
    withinTolerance,
  };
}

export const verifyLoanComputation: ToolDef = {
  name: "verify_loan_computation",
  description:
    "Verify a loan's interest/monthly deduction against the scheme formula (13.33% flat ÷ 60 months, ₦50 tolerance). Pass principal + installmentCount directly, OR a person's name to verify their stored records. Use when the user asks to verify, check, or recompute interest or deductions.",
  parameters: {
    type: "object",
    properties: {
      principal: { type: "number", description: "Loan principal (e.g. 750000)." },
      installmentCount: { type: "number", description: "Tenure in months (e.g. 60, 48, 36)." },
      observedInterest: { type: "number", description: "Optional: the interest figure to check." },
      name: { type: "string", description: "Alternative to principal: a person to verify their records." },
      mda: { type: "string", description: "Optional: restrict the name lookup to one MDA." },
    },
    required: [],
  },

  run(db: DB, args: Record<string, unknown>): ToolResult {
    const principal = asNumber(args.principal);
    const installmentCount = asNumber(args.installmentCount);
    const name = asString(args.name);

    // ── explicit mode ──
    if (principal != null && installmentCount != null) {
      if (installmentCount <= 0) {
        return { ok: false, summary: "", citations: [], error: "installmentCount must be greater than zero." };
      }
      const v = verifyOne(principal, installmentCount, asNumber(args.observedInterest) ?? null);
      const verdict =
        v.withinTolerance === null
          ? `Expected interest ₦${v.expectedInterest.toLocaleString()}, expected monthly deduction ₦${v.expectedMonthlyDeduction.toLocaleString()} for ₦${principal.toLocaleString()} over ${installmentCount} months.`
          : v.withinTolerance
            ? `Aligned — observed interest is within ₦${TOLERANCE_NAIRA} of the expected ₦${v.expectedInterest.toLocaleString()}.`
            : `Variance for review — observed differs from the expected ₦${v.expectedInterest.toLocaleString()} by ₦${v.variance?.toLocaleString()}.`;
      return {
        ok: true,
        summary: verdict,
        rows: [v],
        citations: [],
        meta: { mode: "explicit", rate: STANDARD_RATE, base: BASE_MONTHS, tolerance: TOLERANCE_NAIRA },
      };
    }

    // ── by-name mode ──
    if (name) {
      const tokens = canonicalKey(name).split(" ").filter(Boolean);
      if (!tokens.length) return { ok: false, summary: "", citations: [], error: `Could not parse a name from "${name}".` };
      const where = tokens.map(() => "canonicalName LIKE ?");
      const params: unknown[] = tokens.map((t) => `%${t}%`);
      const mdaTerm = asString(args.mda);
      if (mdaTerm) {
        const res = resolveMda(db, mdaTerm);
        if (!res.matched) return { ok: false, summary: "", citations: [], error: `MDA "${mdaTerm}" not resolved.` };
        where.push(`mda IN (${res.codes.map(() => "?").join(", ")})`);
        params.push(...res.codes);
      }
      const ROW_CAP = 200;
      const fetched = db
        .prepare(
          `SELECT name, mda, year, month, principal, interest, monthlyDeduction, installmentCount, sourceFile
           FROM records WHERE ${where.join(" AND ")}
             AND principal IS NOT NULL AND installmentCount IS NOT NULL
           ORDER BY year, month LIMIT ${ROW_CAP + 1}`,
        )
        .all(...params) as Row[];
      const truncated = fetched.length > ROW_CAP;
      const rows = truncated ? fetched.slice(0, ROW_CAP) : fetched;

      if (!rows.length) {
        return { ok: true, summary: `No records with principal + tenure found for "${name}" to verify.`, rows: [], citations: [], meta: { mode: "by-name", verified: 0 } };
      }

      const checked = rows.map((r) => ({
        name: r.name,
        mda: r.mda,
        period: r.year ? `${r.year}-${String(r.month ?? 0).padStart(2, "0")}` : null,
        sourceFile: r.sourceFile,
        ...verifyOne(r.principal!, r.installmentCount!, r.interest),
      }));
      const forReview = checked.filter((c) => c.withinTolerance === false);
      const truncNote = truncated ? ` (first ${ROW_CAP} records — narrow by MDA to verify all)` : "";
      return {
        ok: true,
        summary:
          forReview.length === 0
            ? `Verified ${checked.length} record(s) for ${rows[0].name} — all interest figures align with the formula (within ₦${TOLERANCE_NAIRA})${truncNote}.`
            : `Verified ${checked.length} record(s) for ${rows[0].name} — ${forReview.length} show a variance for review${truncNote}.`,
        rows: checked,
        citations: citationsFrom(rows),
        meta: { mode: "by-name", verified: checked.length, forReview: forReview.length, truncated },
      };
    }

    return {
      ok: false,
      summary: "",
      citations: [],
      error: "Provide either principal + installmentCount, or a name to verify.",
    };
  },
};
