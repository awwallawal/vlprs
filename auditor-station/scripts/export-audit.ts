/**
 * export-audit.ts — export the local audit log to CSV (SQ2-8).
 *
 *   pnpm audit:export                 → audit/exports/audit-export-<stamp>.csv
 *   pnpm audit:export -- --out x.csv  → custom path
 *
 * Stays on the machine (the export, like the log, is local). For the AG office to review
 * questions/answers/tools in Excel.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createAuditor } from "../src/server/audit.js";
import { auditToCsv } from "../src/server/audit-export.js";
import { loadConfig } from "../src/server/config.js";

const STATION_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const config = loadConfig(STATION_ROOT);

if (!existsSync(config.auditFile)) {
  console.error(`No audit log at ${config.auditFile} yet — ask a question first.`);
  process.exit(1);
}

const entries = createAuditor(config.auditFile).readAll();
const csv = auditToCsv(entries);

const outArg = process.argv.indexOf("--out");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const out = outArg >= 0 ? resolve(process.argv[outArg + 1]) : resolve(STATION_ROOT, `audit/exports/audit-export-${stamp}.csv`);

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, csv, "utf8");
console.log(`Exported ${entries.length} audit entr${entries.length === 1 ? "y" : "ies"} → ${out}`);
