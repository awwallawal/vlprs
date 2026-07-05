/**
 * refresh.ts — one-step data refresh on the BUILD machine (SQ2-8 convenience).
 *
 * After new Excel files have been ingested by the SQ-1 engine (Layer A → fresh catalog.json):
 *   pnpm refresh                  → re-vendor + rebuild catalog.db(.enc) + manifest
 *   pnpm refresh -- --source <p>  → override the catalog.json path
 *
 * Then stage the two refreshed files to the laptop with `pnpm stage-data`.
 * (This does NOT re-run the SQ-1 engine — run that first; it lives outside the station.)
 */

import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { syncFromParent } from "./sync-from-parent.js";
import { buildCatalogDb, parseArgs } from "./build-catalog-db.js";

const STATION_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(STATION_ROOT, ".env");
if (existsSync(envPath)) process.loadEnvFile(envPath); // STATION_DB_KEY drives encryption

console.log("1/2 — sync vendored knowledge from parent…");
const { drifted } = syncFromParent();
if (drifted) {
  console.warn("\n⚠ A vendored source drifted. The build will use the EXISTING vendored copy.");
  console.warn("  Review the drift and re-vendor deliberately if the change matters (see vendor/).\n");
}

console.log("\n2/2 — rebuild catalog snapshot…");
const { source, out, key } = parseArgs(process.argv.slice(2));
buildCatalogDb(source, out, key);

console.log("\nRefresh complete. Stage to the laptop:  pnpm stage-data -- --drive D:");
