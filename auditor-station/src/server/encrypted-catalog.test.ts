import { existsSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildCatalogDb } from "../../scripts/build-catalog-db.js";
import { loadConfig } from "./config.js";
import { openConfiguredCatalog } from "./db-open.js";

const FIXTURE = resolve(fileURLToPath(new URL("../../scripts/__fixtures__/catalog.sample.json", import.meta.url)));
const DIR = join(tmpdir(), `auditor-station-enc-${process.pid}`);
const PLAIN = join(DIR, "catalog.db");
const ENC = `${PLAIN}.enc`;
const MAN = join(DIR, "MANIFEST.sha256");
const KEY = "test-passphrase-123";

function cfg(overrides = {}) {
  return loadConfig(tmpdir(), { dbPath: PLAIN, encPath: ENC, manifestFile: MAN, ...overrides });
}

beforeAll(() => {
  rmSync(DIR, { recursive: true, force: true });
  // Build encrypted: produces catalog.db.enc + MANIFEST.sha256, removes the plain db.
  buildCatalogDb(FIXTURE, PLAIN, KEY);
});
afterAll(() => {
  rmSync(DIR, { recursive: true, force: true });
});

describe("encrypted catalog build + open (SQ2-7)", () => {
  it("writes the encrypted artifact and removes the plaintext db", () => {
    expect(existsSync(ENC)).toBe(true);
    expect(existsSync(PLAIN)).toBe(false); // no plaintext db left on disk
    expect(existsSync(MAN)).toBe(true);
  });

  it("opens read-only with the correct key, integrity verified", () => {
    const opened = openConfiguredCatalog(cfg({ dbKey: KEY }));
    expect(opened.encrypted).toBe(true);
    expect(opened.integrity).toBe("verified");
    const n = (opened.db.prepare("SELECT COUNT(*) AS n FROM records").get() as { n: number }).n;
    expect(n).toBe(4);
    expect(() => opened.db.exec("INSERT INTO records(name,normalizedName,canonicalName) VALUES('x','x','x')")).toThrow(/readonly/i);
    opened.db.close();
  });

  it("refuses a wrong passphrase", () => {
    expect(() => openConfiguredCatalog(cfg({ dbKey: "wrong-key" }))).toThrow(/wrong passphrase|modified/i);
  });

  it("refuses a tampered encrypted artifact (manifest mismatch)", () => {
    writeFileSync(ENC, Buffer.concat([Buffer.from("ASTNENC1"), Buffer.alloc(64, 1)])); // corrupt but right magic
    expect(() => openConfiguredCatalog(cfg({ dbKey: KEY }))).toThrow(/integrity check failed/i);
  });
});
