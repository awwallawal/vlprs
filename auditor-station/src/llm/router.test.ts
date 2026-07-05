import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildCatalogDb } from "../../scripts/build-catalog-db.js";
import { openCatalogReadonly, type DB } from "../lib/catalog-db.js";
import { routeToTool } from "./router.js";

const FIXTURE = resolve(fileURLToPath(new URL("../../scripts/__fixtures__/catalog.sample.json", import.meta.url)));
const OUT = join(tmpdir(), "auditor-station-router-test.db");

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

describe("routeToTool (deterministic fallback)", () => {
  it("routes a trace question to search_beneficiary with the name", () => {
    const r = routeToTool(db, "Trace BADMUS F.G. across all MDAs");
    expect(r?.name).toBe("search_beneficiary");
    expect(String(r?.args.name)).toContain("BADMUS");
  });

  it("routes 'find ... history' to search_beneficiary", () => {
    const r = routeToTool(db, "Find Giwa Saheed — show full loan history");
    expect(r?.name).toBe("search_beneficiary");
    expect(r?.args.name).toBe("GIWA SAHEED");
  });

  it("routes an MDA summary question to get_mda_summary", () => {
    const r = routeToTool(db, "Give me a summary of WORKS");
    expect(r?.name).toBe("get_mda_summary");
    expect(r?.args.mda).toBe("WORKS");
  });

  it("routes explicit verify with principal + tenure (tenure not mistaken for money)", () => {
    const r = routeToTool(db, "Verify the interest for ₦750,000 over 36 months");
    expect(r?.name).toBe("verify_loan_computation");
    expect(r?.args).toMatchObject({ principal: 750000, installmentCount: 36 });
  });

  it("routes verify-by-name when no numbers are given", () => {
    const r = routeToTool(db, "Verify the interest computation for OLUWASEGUN ADEYEMI");
    expect(r?.name).toBe("verify_loan_computation");
    expect(r?.args.name).toBe("OLUWASEGUN ADEYEMI");
  });

  it("routes 'balance below zero' to query_catalog", () => {
    const r = routeToTool(db, "Which staff have a balance below zero?");
    expect(r?.name).toBe("query_catalog");
    expect(r?.args.balanceBelowZero).toBe(true);
  });

  it("routes 'largest outstanding in 2024' to query_catalog ordered + year", () => {
    const r = routeToTool(db, "Show the largest outstanding balances in 2024");
    expect(r?.name).toBe("query_catalog");
    expect(r?.args).toMatchObject({ orderBy: "outstandingBalance desc", year: 2024 });
  });

  it("returns null when nothing is classifiable", () => {
    expect(routeToTool(db, "hello there")).toBeNull();
  });
});
