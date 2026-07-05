/**
 * integrity.ts — MANIFEST.sha256 gate (SQ2-7).
 *
 * The build writes the SHA-256 of the catalog artifact (the .enc file, or the plain .db in dev)
 * to data/MANIFEST.sha256. At launch the station re-hashes the artifact and refuses to open if
 * it doesn't match — so a corrupted, truncated, or substituted snapshot is caught before any
 * answer is given. (For encrypted artifacts, AES-GCM's auth tag is a second, cryptographic check.)
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";

export function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/** Write "<sha>  <filename>" so the manifest is human-readable and tool-checkable. */
export function writeManifest(artifactPath: string, manifestPath: string): string {
  const sha = sha256File(artifactPath);
  writeFileSync(manifestPath, `${sha}  ${basename(artifactPath)}\n`, "utf8");
  return sha;
}

export interface IntegrityResult {
  ok: boolean;
  reason?: string;
  expected?: string;
  actual?: string;
}

/**
 * Verify an artifact against its manifest. If the manifest is absent, returns ok with a note
 * (dev convenience) — callers that require it (production) should treat "no manifest" as fatal.
 */
export function verifyManifest(artifactPath: string, manifestPath: string): IntegrityResult {
  if (!existsSync(artifactPath)) return { ok: false, reason: "artifact-missing" };
  if (!existsSync(manifestPath)) return { ok: true, reason: "no-manifest" };
  const expected = readFileSync(manifestPath, "utf8").trim().split(/\s+/)[0];
  const actual = sha256File(artifactPath);
  if (expected !== actual) return { ok: false, reason: "sha-mismatch", expected, actual };
  return { ok: true, expected, actual };
}
