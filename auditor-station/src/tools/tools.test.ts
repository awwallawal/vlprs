import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildCatalogDb } from "../../scripts/build-catalog-db.js";
import { openCatalogReadonly, type DB } from "../lib/catalog-db.js";
import { ollamaToolSchemas, runTool, TOOLS } from "./index.js";

const FIXTURE = resolve(fileURLToPath(new URL("../../scripts/__fixtures__/catalog.sample.json", import.meta.url)));
const OUT = join(tmpdir(), "auditor-station-tools-test.db");

let db: DB;
beforeAll(() => {
  if (existsSync(OUT)) rmSync(OUT, { force: true });
  buildCatalogDb(FIXTURE, OUT);
  db = openCatalogReadonly(OUT);
});
afterAll(() => {
  db?.close();
  if (existsSync(OUT)) rmSync(OUT, { force: true });
});

describe("registry", () => {
  it("exposes four tools with Ollama schemas", () => {
    expect(TOOLS.map((t) => t.name).sort()).toEqual([
      "get_mda_summary",
      "query_catalog",
      "search_beneficiary",
      "verify_loan_computation",
    ]);
    const schemas = ollamaToolSchemas() as { function: { name: string } }[];
    expect(schemas).toHaveLength(4);
    expect(schemas[0]).toHaveProperty("function.parameters.type", "object");
  });

  it("unknown tool returns an error result, never throws", () => {
    const r = runTool(db, "nope", {});
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/unknown tool/i);
  });
});

describe("search_beneficiary", () => {
  it("collapses spelling variants into one person and cites sources", () => {
    const r = runTool(db, "search_beneficiary", { name: "ALATISE FOLASADE" });
    expect(r.ok).toBe(true);
    const groups = r.rows as { canonicalName: string; recordCount: number; mdas: string[] }[];
    expect(groups).toHaveLength(1);
    expect(groups[0].recordCount).toBe(2); // ALATISHE + ALATISE rows merged
    expect(groups[0].mdas).toEqual(["AANFE"]);
    expect(r.citations.length).toBeGreaterThan(0);
  });

  it("honours an MDA filter by name", () => {
    const r = runTool(db, "search_beneficiary", { name: "ALATISE", mda: "Education" });
    expect(r.ok).toBe(true);
    expect((r.meta as { personCount: number }).personCount).toBe(1);
  });

  it("returns an empty (ok) result when nothing matches", () => {
    const r = runTool(db, "search_beneficiary", { name: "ZZZ NOBODY" });
    expect(r.ok).toBe(true);
    expect((r.meta as { personCount: number }).personCount).toBe(0);
  });

  it("requires a name", () => {
    expect(runTool(db, "search_beneficiary", {}).error).toMatch(/name is required/i);
  });
});

describe("get_mda_summary", () => {
  it("counts records + distinct persons and sums latest outstanding", () => {
    const r = runTool(db, "get_mda_summary", { mda: "Education" });
    const m = r.meta as { recordCount: number; distinctPersons: number; totalLatestOutstanding: number };
    expect(m.recordCount).toBe(2);
    expect(m.distinctPersons).toBe(1); // variants collapse
    expect(m.totalLatestOutstanding).toBe(0); // latest (2020) record has balance 0
  });

  it("resolves a bare code", () => {
    const r = runTool(db, "get_mda_summary", { mda: "WORKS" });
    expect((r.meta as { distinctPersons: number }).distinctPersons).toBe(1);
  });
});

describe("verify_loan_computation", () => {
  it("explicit mode matches the WAKEUP tenure table (₦750k / 60mo)", () => {
    const r = runTool(db, "verify_loan_computation", { principal: 750000, installmentCount: 60, observedInterest: 99975 });
    const v = (r.rows as { expectedInterest: number; withinTolerance: boolean; expectedMonthlyDeduction: number }[])[0];
    expect(v.expectedInterest).toBe(99975);
    expect(v.expectedMonthlyDeduction).toBe(14166.25);
    expect(v.withinTolerance).toBe(true);
  });

  it("flags a variance for review when observed differs", () => {
    const r = runTool(db, "verify_loan_computation", { principal: 750000, installmentCount: 60, observedInterest: 120000 });
    expect((r.rows as { withinTolerance: boolean }[])[0].withinTolerance).toBe(false);
    expect(r.summary).toMatch(/variance for review/i);
  });

  it("by-name mode verifies stored records (consistent 48mo record aligns)", () => {
    const r = runTool(db, "verify_loan_computation", { name: "OLUWASEGUN ADEYEMI" });
    const m = r.meta as { verified: number; forReview: number };
    expect(m.verified).toBe(1);
    expect(m.forReview).toBe(0);
  });

  it("errors when neither numbers nor a name are given", () => {
    expect(runTool(db, "verify_loan_computation", {}).error).toMatch(/provide either/i);
  });
});

describe("query_catalog", () => {
  it("filters by outstanding range, cites sources", () => {
    const r = runTool(db, "query_catalog", { minOutstanding: 100000 });
    expect((r.meta as { totalMatches: number }).totalMatches).toBe(2); // 237993 + 120000
  });

  it("orders by a whitelisted column", () => {
    const r = runTool(db, "query_catalog", { minOutstanding: 1, orderBy: "outstandingBalance desc" });
    const rows = r.rows as { outstandingBalance: number }[];
    expect(rows[0].outstandingBalance).toBe(237993);
  });

  it("balanceBelowZero returns none for this clean fixture", () => {
    expect((runTool(db, "query_catalog", { balanceBelowZero: true }).meta as { totalMatches: number }).totalMatches).toBe(0);
  });

  it("ignores a non-whitelisted orderBy (no injection)", () => {
    const r = runTool(db, "query_catalog", { orderBy: "name; DROP TABLE records" });
    expect(r.ok).toBe(true); // falls back to default order, query still succeeds
  });
});
