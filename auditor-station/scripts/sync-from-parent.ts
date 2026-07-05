/**
 * sync-from-parent.ts — SQ2-2.
 *
 * Snapshots the few things the station inherits from the parent repo into `vendor/`, and
 * stamps each source's SHA-256 + date into `vendor/provenance.json`. This is the ONLY moment
 * data/knowledge crosses the one-way boundary — at build, never at runtime.
 *
 *   - vocabulary.ts          → vendored verbatim (vendor/vocabulary.snapshot.ts.txt)
 *   - WAKEUP.md (loan model) → SHA stamped (vendor/loan-model.ts is authored from it)
 *   - name-match.ts          → SHA stamped (normalizeName vendored in src/lib/normalize.ts)
 *   - yoruba-name-normalize  → SHA stamped (canonicalize vendored in src/lib/normalize.ts)
 *
 * DRIFT: if a source SHA changed since the last sync, this prints a warning so the vendored
 * copy can be reviewed deliberately. Run from the auditor-station folder: `pnpm sync:parent`.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const STATION_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = resolve(STATION_ROOT, "..");
const PROVENANCE = resolve(STATION_ROOT, "vendor/provenance.json");

interface Source {
  item: string;
  sourcePath: string; // relative to repo root
  vendoredVia: string; // how it lives in the station
  snapshotTo?: string; // verbatim copy target (relative to station root), if any
}

const SOURCES: Source[] = [
  {
    item: "vocabulary",
    sourcePath: "packages/shared/src/constants/vocabulary.ts",
    vendoredVia: "verbatim snapshot",
    snapshotTo: "vendor/vocabulary.snapshot.ts.txt",
  },
  {
    item: "loan-model",
    sourcePath: "scripts/legacy-report/WAKEUP.md",
    vendoredVia: "authored from source in vendor/loan-model.ts",
  },
  {
    item: "normalizeName",
    sourcePath: "scripts/legacy-report/utils/name-match.ts",
    vendoredVia: "copied into src/lib/normalize.ts",
  },
  {
    item: "canonicalize",
    sourcePath: "scripts/legacy-report/utils/yoruba-name-normalize.ts",
    vendoredVia: "copied into src/lib/normalize.ts",
  },
];

function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

interface ProvenanceEntry {
  item: string;
  sourcePath: string;
  sha256: string;
  vendoredVia: string;
  snapshotTo?: string;
}

function loadPreviousShas(): Map<string, string> {
  const prev = new Map<string, string>();
  if (!existsSync(PROVENANCE)) return prev;
  try {
    const data = JSON.parse(readFileSync(PROVENANCE, "utf8")) as { sources?: ProvenanceEntry[] };
    for (const e of data.sources ?? []) prev.set(e.item, e.sha256);
  } catch {
    /* ignore malformed previous provenance */
  }
  return prev;
}

export interface SyncResult {
  missing: number;
  drifted: number;
}

export function syncFromParent(): SyncResult {
  const prev = loadPreviousShas();
  const entries: ProvenanceEntry[] = [];
  let missing = 0;
  let drifted = 0;

  for (const s of SOURCES) {
    const abs = resolve(REPO_ROOT, s.sourcePath);
    if (!existsSync(abs)) {
      console.warn(`  MISSING  ${s.item}: ${s.sourcePath} (skipped — run on the build machine)`);
      missing++;
      continue;
    }
    const buf = readFileSync(abs);
    const hash = sha256(buf);

    if (s.snapshotTo) {
      const dest = resolve(STATION_ROOT, s.snapshotTo);
      const header =
        `// VENDORED SNAPSHOT — do not edit. Source: ${s.sourcePath}\n` +
        `// sha256: ${hash}\n` +
        `// Refresh with: pnpm sync:parent\n\n`;
      writeFileSync(dest, header + buf.toString("utf8"), "utf8");
      console.log(`  snapshot ${s.item} -> ${s.snapshotTo}`);
    }

    const before = prev.get(s.item);
    if (before && before !== hash) {
      console.warn(`  DRIFT    ${s.item}: source changed since last sync — review the vendored copy.`);
      drifted++;
    } else {
      console.log(`  ok       ${s.item}  (${hash.slice(0, 12)}…)`);
    }
    entries.push({ item: s.item, sourcePath: s.sourcePath, sha256: hash, vendoredVia: s.vendoredVia, snapshotTo: s.snapshotTo });
  }

  const out = {
    syncedAt: new Date().toISOString(),
    note: "SHA-256 of each parent source at snapshot time. Drift here means a vendored copy may need review.",
    sources: entries,
  };
  writeFileSync(PROVENANCE, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log(`\nWrote ${PROVENANCE}`);
  if (missing) console.log(`(${missing} source(s) missing — provenance is partial.)`);
  if (drifted) {
    console.log(`\n${drifted} source(s) DRIFTED. Review vendored copies before trusting the build.`);
  }
  return { missing, drifted };
}

// Run directly (pnpm sync:parent): exit 2 on drift so the operator notices.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { drifted } = syncFromParent();
  if (drifted) process.exit(2);
}
