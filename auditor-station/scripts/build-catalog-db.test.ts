import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { openCatalogReadonly, readMeta, type DB } from "../src/lib/catalog-db.js";
import { buildCatalogDb } from "./build-catalog-db.js";

const FIXTURE = resolve(
  fileURLToPath(new URL("./__fixtures__/catalog.sample.json", import.meta.url)),
);
const OUT = join(tmpdir(), "auditor-station-test-catalog.db");

describe("build-catalog-db", () => {
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

  it("loads every fixture record", () => {
    const { n } = db.prepare("SELECT COUNT(*) AS n FROM records").get() as { n: number };
    expect(n).toBe(4);
  });

  it("flattens period into year/month", () => {
    const row = db.prepare("SELECT year, month FROM records WHERE name = ?")
      .get("ALATISE FOLASADE") as { year: number; month: number };
    expect(row).toEqual({ year: 2020, month: 1 });
  });

  it("computes normalizedName and canonicalName", () => {
    const row = db.prepare("SELECT normalizedName, canonicalName FROM records WHERE name LIKE 'MRS. ALATISHE%'")
      .get() as { normalizedName: string; canonicalName: string };
    expect(row.normalizedName).toBe("ALATISHE FOLASHADE");
    // The two ALATISHE/ALATISE rows must canonicalize identically (same-person candidate).
    const other = db.prepare("SELECT canonicalName FROM records WHERE name = 'ALATISE FOLASADE'")
      .get() as { canonicalName: string };
    expect(row.canonicalName).toBe(other.canonicalName);
  });

  it("creates all five indexes", () => {
    const idx = (db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_records_%'")
      .all() as { name: string }[]).map((r) => r.name);
    expect(idx).toEqual(
      expect.arrayContaining([
        "idx_records_normalizedName",
        "idx_records_canonicalName",
        "idx_records_mda",
        "idx_records_year_month",
        "idx_records_outstanding",
      ]),
    );
  });

  it("writes provenance into meta", () => {
    const meta = readMeta(db);
    expect(meta.recordCount).toBe(4);
    expect(meta.schemaVersion).toBe(1);
    expect(meta.catalogSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(meta.builtAt).toBeTruthy();
  });

  it("opens read-only — writes are rejected", () => {
    expect(() => db.exec("INSERT INTO records (name, normalizedName, canonicalName) VALUES ('x','x','x')"))
      .toThrow(/readonly/i);
  });

  it("is idempotent — rebuilding yields the same count", () => {
    db.close();
    buildCatalogDb(FIXTURE, OUT);
    db = openCatalogReadonly(OUT);
    const { n } = db.prepare("SELECT COUNT(*) AS n FROM records").get() as { n: number };
    expect(n).toBe(4);
  });
});
