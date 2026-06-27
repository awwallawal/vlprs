/**
 * package-bundle.ts — assemble a clean, checksummed distributable of the station (SQ2-8).
 *
 * Produces a folder containing everything needed to run on the laptop and nothing it
 * shouldn't carry: code + web + vendor + docs + the ENCRYPTED catalog + manifest. Excludes
 * node_modules, .env (the secret), the plaintext db, audit logs, and tests. Writes
 * BUNDLE.sha256 over every file so the recipient can verify the whole bundle.
 *
 *   pnpm bundle                    → ../auditor-station-bundle
 *   pnpm bundle -- --out D:\dist   → custom destination
 *
 * The laptop then runs `pnpm install --ignore-workspace` once, sets .env, and `pnpm start`.
 * (The full Tauri/one-click installer is the funded step — see PACKAGING.md.)
 */

import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const STATION_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Decide whether a path (relative to station root, forward-slashed) is excluded from the bundle. */
export function shouldSkipPath(rel: string): boolean {
  if (rel === "") return false;
  const parts = rel.split("/");
  if (parts.includes("node_modules") || parts.includes("dist") || parts.includes(".git")) return true;
  if (rel === ".env") return true;
  if (rel === "audit" || rel.startsWith("audit/")) return true; // never ship the local log
  if (rel === "data/catalog.db") return true; // never ship the plaintext db
  if (rel.endsWith(".test.ts")) return true;
  if (rel === "__fixtures__" || rel.includes("/__fixtures__")) return true;
  return false;
}

function walk(absDir: string, root: string, out: string[]): void {
  for (const name of readdirSync(absDir)) {
    const abs = join(absDir, name);
    const rel = relative(root, abs).split("\\").join("/");
    if (shouldSkipPath(rel)) continue;
    if (statSync(abs).isDirectory()) walk(abs, root, out);
    else out.push(rel);
  }
}

function run(): void {
  const outArg = process.argv.indexOf("--out");
  const dest = outArg >= 0 ? resolve(process.argv[outArg + 1]) : resolve(STATION_ROOT, "..", "auditor-station-bundle");

  if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });

  const files: string[] = [];
  walk(STATION_ROOT, STATION_ROOT, files);

  for (const rel of files) {
    const target = join(dest, rel);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(STATION_ROOT, rel), target);
  }

  // Checksum every copied file.
  const lines = files
    .sort()
    .map((rel) => `${createHash("sha256").update(readFileSync(join(dest, rel))).digest("hex")}  ${rel}`);
  writeFileSync(join(dest, "BUNDLE.sha256"), lines.join("\n") + "\n", "utf8");

  console.log(`Bundle written: ${dest}`);
  console.log(`  ${files.length} files · BUNDLE.sha256 over all of them`);
  if (!existsSync(join(STATION_ROOT, "data/catalog.db.enc"))) {
    console.log("  WARNING: no data/catalog.db.enc — build with STATION_DB_KEY so the bundle carries the ENCRYPTED catalog.");
  }
  console.log("  On the laptop: pnpm install --ignore-workspace → set .env → pnpm start");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run();
