/**
 * server/config.ts — station configuration (SQ2-5, .env-based).
 *
 * Single config source: environment variables (loaded from a local `.env` by the entry point,
 * see scripts/start-server.ts). Defaults ← env ← explicit overrides. The PIN is the optional
 * local-auth gate: unset => open (single trusted, BitLocker'd laptop); set => every request
 * must present it. BitLocker is the real at-rest control; the PIN is a light "who's here" gate.
 *
 * Set/change/remove the PIN by editing STATION_PIN in `.env` (copied from `.env.example`).
 * `.env` is gitignored, so the secret never commits and never rides in the shared bundle.
 */

import { resolve } from "node:path";
import { MODEL } from "../station.js";

export interface StationConfig {
  port: number;
  ollamaBaseUrl: string;
  model: string;
  /** Optional launch PIN (plaintext in .env). Unset => open. */
  pin?: string;
  dbPath: string;
  /** Encrypted catalog artifact (used when dbKey is set). */
  encPath: string;
  /** Integrity manifest for the catalog artifact. */
  manifestFile: string;
  /** Passphrase for the at-rest-encrypted catalog. Unset => plain catalog.db (dev). */
  dbKey?: string;
  /** Cap tokens generated per turn (bounds CPU latency). Default 512. */
  numPredict?: number;
  /** Skip the LLM narration turn — answer from tool summaries. Faster on CPU. Default true (narrate). */
  narrate: boolean;
  /** Skip the LLM entirely — router picks the tool, answer is the tool summary. Default false. */
  deterministic: boolean;
  auditFile: string;
}

export function loadConfig(stationRoot: string, overrides: Partial<StationConfig> = {}): StationConfig {
  const env = process.env;
  const base: StationConfig = {
    port: env.STATION_PORT ? Number(env.STATION_PORT) : 8717,
    ollamaBaseUrl: env.STATION_OLLAMA_URL ?? "http://localhost:11434",
    model: env.STATION_MODEL ?? MODEL.default,
    pin: env.STATION_PIN && env.STATION_PIN.trim() ? env.STATION_PIN.trim() : undefined,
    dbPath: env.STATION_DB ?? resolve(stationRoot, "data/catalog.db"),
    encPath: env.STATION_DB_ENC ?? resolve(stationRoot, "data/catalog.db.enc"),
    manifestFile: env.STATION_MANIFEST ?? resolve(stationRoot, "data/MANIFEST.sha256"),
    dbKey: env.STATION_DB_KEY && env.STATION_DB_KEY.trim() ? env.STATION_DB_KEY.trim() : undefined,
    numPredict: env.STATION_NUM_PREDICT ? Number(env.STATION_NUM_PREDICT) : undefined,
    narrate: env.STATION_NARRATE ? !/^(0|false|no)$/i.test(env.STATION_NARRATE) : true,
    deterministic: /^(1|true|yes)$/i.test(env.STATION_DETERMINISTIC ?? ""),
    auditFile: env.STATION_AUDIT ?? resolve(stationRoot, "audit/audit-log.jsonl"),
  };
  return { ...base, ...overrides };
}
