/**
 * build-catalog-db.ts — SQ2-2.
 *
 * Reads the SQ-1 engine's deduplicated `catalog.json` and writes a frozen, read-only
 * SQLite snapshot to `data/catalog.db`. Idempotent: builds to a temp file, then atomically
 * swaps it in (Windows-EPERM-safe). Records provenance (catalog SHA-256, build date, counts)
 * in a `meta` table so the station can always show "data as of <date>, snapshot <sha>".
 *
 * Run from the auditor-station folder:
 *   pnpm build:catalog
 *   pnpm build:catalog -- --source <path to catalog.json> --out data/catalog.db
 *
 * This runs on the BUILD machine (where catalog.json lives), never on the auditor laptop.
 * Only the resulting catalog.db crosses to the laptop.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, rmSync, renameSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { canonicalKey, normalizeName } from "../src/lib/normalize.js";
import { encryptDbFile } from "../src/lib/crypto-db.js";
import { writeManifest } from "../src/lib/integrity.js";
import {
  type CatalogFile,
  RECORD_COLUMNS,
  SCHEMA_SQL,
  SCHEMA_VERSION,
} from "../src/lib/catalog-db.js";

const STATION_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// Load .env so STATION_DB_KEY can drive at-rest encryption at build time.
const ENV_PATH = resolve(STATION_ROOT, ".env");
if (existsSync(ENV_PATH)) process.loadEnvFile(ENV_PATH);
const DEFAULT_SOURCE = resolve(
  STATION_ROOT,
  "..",
  "docs/Car_Loan/analysis/foundation/catalog.json",
);
const DEFAULT_OUT = resolve(STATION_ROOT, "data/catalog.db");

export function parseArgs(argv: string[]): { source: string; out: string; key?: string } {
  let source = DEFAULT_SOURCE;
  let out = DEFAULT_OUT;
  let key = process.env.STATION_DB_KEY?.trim() || undefined;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--source") source = resolve(argv[++i]);
    else if (argv[i] === "--out") out = resolve(argv[++i]);
    else if (argv[i] === "--key") key = argv[++i];
  }
  return { source, out, key };
}

/** Encrypt (if a key is given) and write the integrity manifest for the final artifact. */
function finalizeArtifact(plainOut: string, key?: string): void {
  const dir = dirname(plainOut);
  const manifestPath = join(dir, "MANIFEST.sha256");
  if (key) {
    const encPath = `${plainOut}.enc`;
    encryptDbFile(plainOut, encPath, key);
    rmSync(plainOut, { force: true }); // no plaintext db left on disk
    const sha = writeManifest(encPath, manifestPath);
    console.log(`Encrypted: ${encPath} (AES-256-GCM)`);
    console.log(`Manifest : ${manifestPath} (${sha.slice(0, 12)}…)`);
    console.log("At-rest encryption ON — the laptop needs STATION_DB_KEY to open it.");
  } else {
    const sha = writeManifest(plainOut, manifestPath);
    console.log(`Manifest : ${manifestPath} (${sha.slice(0, 12)}…)`);
    console.log("At-rest encryption OFF (dev) — set STATION_DB_KEY to encrypt.");
  }
}

export function buildCatalogDb(source: string, out: string, key?: string): void {
  if (!existsSync(source)) {
    console.error(`Source catalog not found: ${source}`);
    console.error("Pass --source <path> or run the SQ-1 engine first.");
    process.exit(1);
  }

  console.log(`Source : ${source}`);
  const raw = readFileSync(source);
  const catalogSha256 = createHash("sha256").update(raw).digest("hex");
  const catalog = JSON.parse(raw.toString("utf8")) as CatalogFile;
  const records = catalog.records ?? [];
  console.log(`Records: ${records.length.toLocaleString()}  (catalog sha ${catalogSha256.slice(0, 12)}…)`);

  mkdirSync(dirname(out), { recursive: true });
  const tmp = `${out}.tmp`;
  if (existsSync(tmp)) rmSync(tmp, { force: true });

  const db = new Database(tmp);
  try {
    db.pragma("journal_mode = OFF");
    db.pragma("synchronous = OFF");
    db.exec(SCHEMA_SQL);

    const placeholders = RECORD_COLUMNS.map(() => "?").join(", ");
    const insert = db.prepare(
      `INSERT INTO records (${RECORD_COLUMNS.join(", ")}) VALUES (${placeholders})`,
    );

    const insertMany = db.transaction((rows: CatalogFile["records"]) => {
      for (const r of rows) {
        insert.run(
          r.name,
          normalizeName(r.name),
          canonicalKey(r.name),
          r.mda,
          r.mdaName,
          r.principal,
          r.totalLoan,
          r.interest,
          r.outstandingBalance,
          r.monthlyDeduction,
          r.installmentCount,
          r.installmentsPaid,
          r.installmentsRemaining,
          r.period?.year ?? null,
          r.period?.month ?? null,
          r.sourceFile,
          r.sheet,
          r.employeeNo,
          r.gradeLevel,
          r.bank,
          r.startDate,
          r.endDate,
          r.remarks,
        );
      }
    });
    insertMany(records);

    const insertMeta = db.prepare("INSERT INTO meta (key, value) VALUES (?, ?)");
    const meta: Record<string, string> = {
      catalogSha256,
      builtAt: new Date().toISOString(),
      recordCount: String(records.length),
      schemaVersion: String(SCHEMA_VERSION),
      sourceFile: source,
      sourceGenerated: catalog.generated ?? "",
      totalFiles: String(catalog.totalFiles ?? 0),
      duplicatesRemoved: String(catalog.duplicatesRemoved ?? 0),
    };
    for (const [k, v] of Object.entries(meta)) insertMeta.run(k, v);

    db.exec("ANALYZE");
    db.close();
  } catch (err) {
    db.close();
    rmSync(tmp, { force: true });
    throw err;
  }

  // Atomic swap (Windows-safe: remove old, rename temp into place).
  if (existsSync(out)) rmSync(out, { force: true });
  renameSync(tmp, out);
  console.log(`Built  : ${out}`);
  console.log(`Snapshot ${catalogSha256.slice(0, 12)}… — ${records.length.toLocaleString()} records.`);
  finalizeArtifact(out, key);
}

// Run only when invoked directly (tsx scripts/build-catalog-db.ts), not when imported by tests.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { source, out, key } = parseArgs(process.argv.slice(2));
  buildCatalogDb(source, out, key);
}
