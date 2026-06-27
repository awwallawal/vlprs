import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildCatalogDb } from "../../scripts/build-catalog-db.js";
import { openCatalogReadonly, type DB } from "../lib/catalog-db.js";
import { buildSystemPrompt, getProvenance, provenanceBanner } from "./system-prompt.js";

const FIXTURE = resolve(fileURLToPath(new URL("../../scripts/__fixtures__/catalog.sample.json", import.meta.url)));
const DBOUT = join(tmpdir(), "auditor-station-sysprompt-test.db");

let db: DB;
beforeAll(() => {
  if (existsSync(DBOUT)) rmSync(DBOUT, { force: true });
  buildCatalogDb(FIXTURE, DBOUT);
  db = openCatalogReadonly(DBOUT);
});
afterAll(() => {
  db?.close();
  if (existsSync(DBOUT)) rmSync(DBOUT, { force: true });
});

describe("getProvenance", () => {
  it("reports snapshot facts from meta", () => {
    const p = getProvenance(db);
    expect(p.recordCount).toBe(4);
    expect(p.mdaCount).toBe(3);
    expect(p.shortSha).toHaveLength(12);
    expect(p.mode).toMatch(/non-authoritative/i);
  });
  it("banner is one human line with mode + record count", () => {
    expect(provenanceBanner(getProvenance(db))).toMatch(/non-authoritative.*4 records/i);
  });
});

describe("buildSystemPrompt", () => {
  const prompt = () => buildSystemPrompt(db);
  it("embeds the loan model", () => {
    expect(prompt()).toContain("0.1333");
    expect(prompt()).toMatch(/÷ 60/);
  });
  it("embeds the non-punitive vocabulary rules", () => {
    expect(prompt()).toMatch(/observation.*not.*anomaly/i);
    expect(prompt()).toMatch(/balance below zero/i);
  });
  it("embeds live snapshot provenance", () => {
    expect(prompt()).toMatch(/non-authoritative/i);
    expect(prompt()).toContain("4 records across 3 MDAs");
  });
});
