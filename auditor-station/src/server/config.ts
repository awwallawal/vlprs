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
    auditFile: env.STATION_AUDIT ?? resolve(stationRoot, "audit/audit-log.jsonl"),
  };
  return { ...base, ...overrides };
}
