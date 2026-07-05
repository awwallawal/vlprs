/**
 * query_catalog — flexible analytical queries from a fixed set of typed filters.
 *
 * SECURITY: there is NO free-form SQL. The WHERE clause is assembled only from the whitelisted
 * filters below, all values bound as parameters; ORDER BY columns come from an allowlist. The
 * model can never inject SQL — it can only choose filters.
 */

import { canonicalKey } from "../lib/normalize.js";
import { resolveMda } from "../lib/mda-resolve.js";
import type { DB } from "../lib/catalog-db.js";
import {
  asBool,
  asLimit,
  asNumber,
  asString,
  citationsFrom,
  type ToolDef,
  type ToolResult,
} from "./types.js";

const ORDER_COLUMNS: Record<string, string> = {
  outstandingBalance: "outstandingBalance",
  principal: "principal",
  monthlyDeduction: "monthlyDeduction",
  year: "year",
  month: "month",
  name: "name",
  mda: "mda",
};

const SELECT_COLUMNS =
  "name, mda, mdaName, principal, interest, outstandingBalance, monthlyDeduction, installmentCount, year, month, sourceFile";

export const queryCatalog: ToolDef = {
  name: "query_catalog",
  description:
    "Query car-loan records with structured filters (MDA, year, month, outstanding-balance range, balance-below-zero, name/source patterns) and ordering. Use for analytical questions like 'staff with balance below zero', 'records in 2024 for Works over ₦500,000', or 'largest outstanding balances'.",
  parameters: {
    type: "object",
    properties: {
      mda: { type: "string", description: "Optional MDA code or name." },
      year: { type: "number", description: "Optional period year." },
      month: { type: "number", description: "Optional period month (1-12)." },
      minOutstanding: { type: "number", description: "Optional minimum outstanding balance." },
      maxOutstanding: { type: "number", description: "Optional maximum outstanding balance." },
      balanceBelowZero: { type: "boolean", description: "Optional: only records with outstanding balance below zero." },
      namePattern: { type: "string", description: "Optional: name contains (canonicalized)." },
      sourceFileLike: { type: "string", description: "Optional: source file name contains." },
      orderBy: { type: "string", description: "Optional: one of outstandingBalance|principal|monthlyDeduction|year|month|name|mda, optionally with ' desc'." },
      limit: { type: "number", description: "Max rows (default 50, max 500)." },
    },
    required: [],
  },

  run(db: DB, args: Record<string, unknown>): ToolResult {
    const where: string[] = [];
    const params: unknown[] = [];
    const applied: Record<string, unknown> = {};

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
            : `MDA "${mdaTerm}" was not found.`,
        };
      }
      where.push(`mda IN (${res.codes.map(() => "?").join(", ")})`);
      params.push(...res.codes);
      applied.mda = res.codes.join(", ");
    }

    const year = asNumber(args.year);
    if (year != null) { where.push("year = ?"); params.push(Math.floor(year)); applied.year = Math.floor(year); }

    const month = asNumber(args.month);
    if (month != null) { where.push("month = ?"); params.push(Math.floor(month)); applied.month = Math.floor(month); }

    const minOut = asNumber(args.minOutstanding);
    if (minOut != null) { where.push("outstandingBalance >= ?"); params.push(minOut); applied.minOutstanding = minOut; }

    const maxOut = asNumber(args.maxOutstanding);
    if (maxOut != null) { where.push("outstandingBalance <= ?"); params.push(maxOut); applied.maxOutstanding = maxOut; }

    if (asBool(args.balanceBelowZero)) { where.push("outstandingBalance < 0"); applied.balanceBelowZero = true; }

    const namePattern = asString(args.namePattern);
    if (namePattern) {
      for (const t of canonicalKey(namePattern).split(" ").filter(Boolean)) {
        where.push("canonicalName LIKE ?");
        params.push(`%${t}%`);
      }
      applied.namePattern = namePattern;
    }

    const srcLike = asString(args.sourceFileLike);
    if (srcLike) { where.push("sourceFile LIKE ?"); params.push(`%${srcLike}%`); applied.sourceFileLike = srcLike; }

    // ORDER BY from allowlist only.
    let orderSql = "year DESC, month DESC";
    const orderRaw = asString(args.orderBy);
    if (orderRaw) {
      const [colRaw, dirRaw] = orderRaw.split(/\s+/);
      const col = ORDER_COLUMNS[colRaw];
      if (col) {
        orderSql = `${col} ${/^desc$/i.test(dirRaw ?? "") ? "DESC" : "ASC"}`;
        applied.orderBy = orderSql;
      }
    }

    const limit = asLimit(args.limit);
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const rows = db
      .prepare(`SELECT ${SELECT_COLUMNS} FROM records ${whereSql} ORDER BY ${orderSql} LIMIT ?`)
      .all(...params, limit) as { sourceFile?: string | null }[];

    const total = (db.prepare(`SELECT COUNT(*) AS n FROM records ${whereSql}`).get(...params) as { n: number }).n;

    return {
      ok: true,
      summary:
        total === 0
          ? "No records match those filters."
          : `${total.toLocaleString()} record(s) match${total > rows.length ? ` — showing the first ${rows.length}` : ""}.`,
      rows,
      citations: citationsFrom(rows),
      meta: { totalMatches: total, returned: rows.length, filters: applied, orderBy: orderSql },
    };
  },
};
