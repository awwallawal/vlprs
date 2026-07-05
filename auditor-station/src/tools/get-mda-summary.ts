/**
 * get_mda_summary — portfolio summary for one MDA, with citations.
 *
 * Distinct persons are counted by canonical key (so spelling variants of one person count
 * once). Outstanding is summed over each person's LATEST record, not every monthly row, to
 * avoid double-counting a balance that appears across many months.
 */

import { resolveMda, listMdas } from "../lib/mda-resolve.js";
import type { DB } from "../lib/catalog-db.js";
import { asString, citationsFrom, type ToolDef, type ToolResult } from "./types.js";

interface Row {
  canonicalName: string;
  year: number | null;
  month: number | null;
  outstandingBalance: number | null;
  sourceFile: string | null;
}

const periodKey = (y: number | null, m: number | null) => (y ?? 0) * 100 + (m ?? 0);

export const getMdaSummary: ToolDef = {
  name: "get_mda_summary",
  description:
    "Summarize one MDA's car-loan portfolio: record count, distinct beneficiaries, period range, and total latest outstanding. Use when the user asks about an MDA, ministry, agency, or department as a whole.",
  parameters: {
    type: "object",
    properties: {
      mda: { type: "string", description: "The MDA code or name (e.g. 'BIR', 'Works', 'Education')." },
    },
    required: ["mda"],
  },

  run(db: DB, args: Record<string, unknown>): ToolResult {
    const term = asString(args.mda);
    if (!term) {
      const all = listMdas(db).map((m) => m.mda);
      return {
        ok: false,
        summary: "",
        citations: [],
        error: `An MDA is required. Available MDAs: ${all.join(", ")}`,
      };
    }

    const res = resolveMda(db, term);
    if (!res.matched) {
      return {
        ok: false,
        summary: "",
        citations: [],
        error: res.candidates?.length
          ? `MDA "${term}" is ambiguous. Candidates: ${res.candidates.slice(0, 8).join("; ")}`
          : `MDA "${term}" was not found in the snapshot.`,
      };
    }

    const placeholders = res.codes.map(() => "?").join(", ");
    const rows = db
      .prepare(
        `SELECT canonicalName, year, month, outstandingBalance, sourceFile
         FROM records WHERE mda IN (${placeholders})`,
      )
      .all(...res.codes) as Row[];

    // Latest record per person → sum its outstanding.
    const latest = new Map<string, Row>();
    for (const r of rows) {
      const cur = latest.get(r.canonicalName);
      if (!cur || periodKey(r.year, r.month) > periodKey(cur.year, cur.month)) latest.set(r.canonicalName, r);
    }
    let totalLatestOutstanding = 0;
    let balanceBelowZero = 0;
    for (const r of latest.values()) {
      if (r.outstandingBalance != null) {
        totalLatestOutstanding += r.outstandingBalance;
        if (r.outstandingBalance < 0) balanceBelowZero++;
      }
    }
    totalLatestOutstanding = Math.round(totalLatestOutstanding * 100) / 100;

    const periods = rows.map((r) => periodKey(r.year, r.month)).filter((p) => p > 0).sort((a, b) => a - b);
    const fmt = (p: number | undefined) => (p ? `${Math.floor(p / 100)}-${String(p % 100).padStart(2, "0")}` : null);

    const meta = {
      mda: res.codes.join(", "),
      label: res.label,
      recordCount: rows.length,
      distinctPersons: latest.size,
      firstPeriod: fmt(periods[0]),
      lastPeriod: fmt(periods[periods.length - 1]),
      totalLatestOutstanding,
      personsWithBalanceBelowZero: balanceBelowZero,
    };

    return {
      ok: true,
      summary: `${res.label} (${res.codes.join(", ")}): ${rows.length.toLocaleString()} records, ${latest.size.toLocaleString()} distinct beneficiaries, ${meta.firstPeriod}–${meta.lastPeriod}. Total latest outstanding ₦${Math.round(totalLatestOutstanding).toLocaleString()}.`,
      rows: [meta],
      citations: citationsFrom(rows),
      meta,
    };
  },
};
