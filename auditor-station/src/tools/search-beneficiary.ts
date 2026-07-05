/**
 * search_beneficiary — find a person across MDAs (or within one), with citations.
 *
 * Matching is on the canonical key (Yoruba/Nigerian variant-collapsing), so ALATISHE and
 * ALATISE find the same person. A query's tokens must ALL appear in a record's canonicalName,
 * so "ALATISE BOSEDE" won't pull "ALATISHE KHADIJAT" (different given name).
 */

import { canonicalKey } from "../lib/normalize.js";
import { resolveMda } from "../lib/mda-resolve.js";
import type { DB } from "../lib/catalog-db.js";
import { asLimit, asString, citationsFrom, type ToolDef, type ToolResult } from "./types.js";

interface Row {
  name: string;
  canonicalName: string;
  mda: string | null;
  year: number | null;
  month: number | null;
  outstandingBalance: number | null;
  sourceFile: string | null;
}

interface PersonGroup {
  name: string;
  canonicalName: string;
  mdas: string[];
  recordCount: number;
  firstPeriod: string | null;
  lastPeriod: string | null;
  latestOutstanding: number | null;
}

const periodKey = (y: number | null, m: number | null) => (y ?? 0) * 100 + (m ?? 0);
const fmtPeriod = (y: number | null, m: number | null) =>
  y ? `${y}-${String(m ?? 0).padStart(2, "0")}` : null;

function group(rows: Row[]): PersonGroup[] {
  const byKey = new Map<string, Row[]>();
  for (const r of rows) {
    if (!byKey.has(r.canonicalName)) byKey.set(r.canonicalName, []);
    byKey.get(r.canonicalName)!.push(r);
  }
  const groups: PersonGroup[] = [];
  for (const [key, rs] of byKey) {
    const sorted = [...rs].sort((a, b) => periodKey(a.year, a.month) - periodKey(b.year, b.month));
    // Representative raw name = most frequent spelling.
    const freq = new Map<string, number>();
    for (const r of rs) freq.set(r.name, (freq.get(r.name) ?? 0) + 1);
    const name = [...freq.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const latestWithBal = [...sorted].reverse().find((r) => r.outstandingBalance != null);
    groups.push({
      name,
      canonicalName: key,
      mdas: [...new Set(rs.map((r) => r.mda).filter(Boolean) as string[])].sort(),
      recordCount: rs.length,
      firstPeriod: fmtPeriod(sorted[0].year, sorted[0].month),
      lastPeriod: fmtPeriod(sorted[sorted.length - 1].year, sorted[sorted.length - 1].month),
      latestOutstanding: latestWithBal?.outstandingBalance ?? null,
    });
  }
  // Most records first.
  return groups.sort((a, b) => b.recordCount - a.recordCount);
}

export const searchBeneficiary: ToolDef = {
  name: "search_beneficiary",
  description:
    "Search for a car-loan beneficiary by name across all MDAs (or within one MDA). Use whenever the user asks to trace, find, look up, or show the history of a person.",
  parameters: {
    type: "object",
    properties: {
      name: { type: "string", description: "The person's name to search for (full or partial)." },
      mda: { type: "string", description: "Optional: restrict to one MDA (code or name)." },
      limit: { type: "number", description: "Max persons to return (default 50)." },
    },
    required: ["name"],
  },

  run(db: DB, args: Record<string, unknown>): ToolResult {
    const name = asString(args.name);
    if (!name) return { ok: false, summary: "", citations: [], error: "A name is required." };

    const tokens = canonicalKey(name).split(" ").filter(Boolean);
    if (!tokens.length) {
      return { ok: false, summary: "", citations: [], error: `Could not derive a searchable name from "${name}".` };
    }

    const where: string[] = tokens.map(() => "canonicalName LIKE ?");
    const params: unknown[] = tokens.map((t) => `%${t}%`);

    let mdaLabel: string | undefined;
    const mdaTerm = asString(args.mda);
    if (mdaTerm) {
      const res = resolveMda(db, mdaTerm);
      if (!res.matched) {
        return {
          ok: false,
          summary: "",
          citations: [],
          error: res.candidates?.length
            ? `MDA "${mdaTerm}" is ambiguous. Candidates: ${res.candidates.slice(0, 8).join("; ")}`
            : `MDA "${mdaTerm}" was not found in the snapshot.`,
        };
      }
      where.push(`mda IN (${res.codes.map(() => "?").join(", ")})`);
      params.push(...res.codes);
      mdaLabel = res.label;
    }

    // Hard cap on rows scanned for grouping. Fetch CAP+1 so we can tell the user honestly
    // when the result was truncated rather than silently undercounting.
    const ROW_CAP = 5000;
    const fetched = db
      .prepare(
        `SELECT name, canonicalName, mda, year, month, outstandingBalance, sourceFile
         FROM records WHERE ${where.join(" AND ")}
         ORDER BY canonicalName, year, month LIMIT ${ROW_CAP + 1}`,
      )
      .all(...params) as Row[];
    const truncated = fetched.length > ROW_CAP;
    const rows = truncated ? fetched.slice(0, ROW_CAP) : fetched;

    if (!rows.length) {
      return {
        ok: true,
        summary: `No records found for "${name}"${mdaLabel ? ` in ${mdaLabel}` : ""}.`,
        rows: [],
        citations: [],
        meta: { personCount: 0 },
      };
    }

    const limit = asLimit(args.limit);
    const allGroups = group(rows);
    const groups = allGroups.slice(0, limit);
    const allMdas = [...new Set(rows.map((r) => r.mda).filter(Boolean) as string[])];
    const truncNote = truncated
      ? ` (showing the first ${ROW_CAP} records — refine the name for a complete view)`
      : "";
    const limitNote = allGroups.length > limit ? ` Showing the top ${limit} of ${allGroups.length} persons.` : "";
    const summary =
      groups.length === 1 && !truncated
        ? `Found ${groups[0].name} — ${groups[0].recordCount} record(s) across ${groups[0].mdas.length} MDA(s) (${groups[0].mdas.join(", ")}), ${groups[0].firstPeriod}–${groups[0].lastPeriod}.`
        : `Found ${allGroups.length} person(s) matching "${name}"${mdaLabel ? ` in ${mdaLabel}` : ""} across ${allMdas.length} MDA(s)${truncNote}.${limitNote}`;

    return {
      ok: true,
      summary,
      rows: groups,
      citations: citationsFrom(rows),
      meta: { personCount: allGroups.length, returned: groups.length, recordCount: rows.length, truncated, mdas: allMdas },
    };
  },
};
