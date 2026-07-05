/**
 * copy-log.ts — record a snapshot→laptop deployment (SQ2-7 governance).
 *
 * Appends to audit/copy-log.jsonl (gitignored): which snapshot SHA went to which laptop, by
 * whom, when. This is the accountability trail for where citizen data physically resides.
 *
 *   pnpm copy-log -- --laptop "AG-LAPTOP-01" --operator "Awwal" --note "initial deploy"
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const STATION_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const laptop = arg("laptop");
const operator = arg("operator");
const note = arg("note") ?? "";

if (!laptop || !operator) {
  console.error('Usage: pnpm copy-log -- --laptop "<id>" --operator "<name>" [--note "..."]');
  process.exit(1);
}

const manifestPath = resolve(STATION_ROOT, "data/MANIFEST.sha256");
const snapshotSha = existsSync(manifestPath)
  ? readFileSync(manifestPath, "utf8").trim().split(/\s+/)[0]
  : "(no manifest — build first)";

const logPath = resolve(STATION_ROOT, "audit/copy-log.jsonl");
mkdirSync(dirname(logPath), { recursive: true });
const entry = { ts: new Date().toISOString(), laptop, operator, snapshotSha, note };
appendFileSync(logPath, JSON.stringify(entry) + "\n", "utf8");

console.log("Recorded deployment:");
console.log(`  snapshot ${snapshotSha.slice(0, 12)}… → ${laptop} by ${operator}`);
console.log(`  log: ${logPath}`);
