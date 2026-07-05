/**
 * server/db-open.ts — resolve and open the catalog at launch (SQ2-7).
 *
 * Decides between the encrypted artifact (when STATION_DB_KEY is set) and the plain dev DB,
 * enforces the MANIFEST.sha256 integrity gate, and returns a read-only handle. A failed
 * integrity check or a bad passphrase is fatal — the station will not answer from a snapshot
 * it cannot vouch for.
 */

import { existsSync } from "node:fs";
import { openCatalogBufferReadonly, openCatalogReadonly, type DB } from "../lib/catalog-db.js";
import { decryptToBuffer } from "../lib/crypto-db.js";
import { verifyManifest } from "../lib/integrity.js";
import type { StationConfig } from "./config.js";

export interface OpenedCatalog {
  db: DB;
  encrypted: boolean;
  integrity: "verified" | "no-manifest";
}

export function openConfiguredCatalog(config: StationConfig): OpenedCatalog {
  const useEnc = Boolean(config.dbKey);

  if (useEnc) {
    if (!existsSync(config.encPath)) {
      throw new Error(`STATION_DB_KEY is set but no encrypted catalog at ${config.encPath}. Run \`pnpm build:catalog\` with the key.`);
    }
    const integ = verifyManifest(config.encPath, config.manifestFile);
    if (!integ.ok) {
      throw new Error(`Integrity check failed for ${config.encPath} (${integ.reason}). Refusing to open a snapshot that doesn't match its manifest.`);
    }
    const buffer = decryptToBuffer(config.encPath, config.dbKey!); // throws on wrong passphrase/tamper
    return { db: openCatalogBufferReadonly(buffer), encrypted: true, integrity: integ.reason === "no-manifest" ? "no-manifest" : "verified" };
  }

  if (!existsSync(config.dbPath)) {
    throw new Error(`No catalog at ${config.dbPath}. Run \`pnpm build:catalog\` first.`);
  }
  const integ = verifyManifest(config.dbPath, config.manifestFile);
  if (!integ.ok) {
    throw new Error(`Integrity check failed for ${config.dbPath} (${integ.reason}). Refusing to open.`);
  }
  return { db: openCatalogReadonly(config.dbPath), encrypted: false, integrity: integ.reason === "no-manifest" ? "no-manifest" : "verified" };
}
