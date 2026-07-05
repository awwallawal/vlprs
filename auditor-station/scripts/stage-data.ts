/**
 * stage-data.ts — copy ONLY the refreshed catalog files to removable media (SQ2-8).
 *
 * A data refresh is just two files: the (encrypted) catalog + its manifest. This stages them
 * onto a drive, ready to drop into the laptop's auditor-station\data\ folder. The brain, code,
 * and node_modules on the laptop are untouched.
 *
 *   pnpm stage-data                  → D:\auditor-station-data\
 *   pnpm stage-data -- --drive E:\
 */

import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const STATION_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = resolve(STATION_ROOT, "data");

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const drive = arg("drive") ?? "D:\\";
if (!existsSync(drive)) {
  console.error(`Drive not found at '${drive}'. Plug it in or pass --drive E:\\`);
  process.exit(1);
}

const enc = join(DATA, "catalog.db.enc");
const plain = join(DATA, "catalog.db");
const manifest = join(DATA, "MANIFEST.sha256");

let dbFile: string;
let encrypted: boolean;
if (existsSync(enc)) {
  dbFile = enc;
  encrypted = true;
} else if (existsSync(plain)) {
  dbFile = plain;
  encrypted = false;
} else {
  console.error(`No catalog in ${DATA}. Run \`pnpm refresh\` (or \`pnpm build:catalog\`) first.`);
  process.exit(1);
}
if (!existsSync(manifest)) {
  console.error(`No MANIFEST.sha256 in ${DATA}. Rebuild so the integrity gate can verify the copy.`);
  process.exit(1);
}

const dest = join(drive, "auditor-station-data");
mkdirSync(dest, { recursive: true });
const dbName = encrypted ? "catalog.db.enc" : "catalog.db";
copyFileSync(dbFile, join(dest, dbName));
copyFileSync(manifest, join(dest, "MANIFEST.sha256"));

writeFileSync(
  join(dest, "READ-ME-FIRST.txt"),
  [
    "Auditor Station — DATA REFRESH",
    "",
    `Copy these files into the laptop's  auditor-station\\data\\  folder (overwrite):`,
    `  - ${dbName}`,
    "  - MANIFEST.sha256",
    "",
    "Then restart the station (run-station.cmd). It verifies the manifest and shows the new",
    "'data as of' date. Record the deployment:  pnpm copy-log -- --laptop \"<id>\" --operator \"<name>\"",
    encrypted ? "" : "WARNING: this catalog is UNENCRYPTED — build with STATION_DB_KEY for distribution.",
  ].join("\n"),
  "utf8",
);

console.log(`Staged data refresh → ${dest}`);
console.log(`  ${dbName} + MANIFEST.sha256${encrypted ? " (encrypted)" : "  (UNENCRYPTED — set STATION_DB_KEY!)"}`);
console.log("  On the laptop: drop these into auditor-station\\data\\ and restart run-station.cmd");
