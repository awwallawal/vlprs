/**
 * server/config.ts — station configuration (SQ2-5).
 *
 * Resolves from defaults ← station.config (JSON, optional) ← environment. The PIN is the
 * optional local-auth gate: if unset, the station is open (single trusted, BitLocker'd laptop);
 * if set, every request must present it. BitLocker is the real at-rest control (epic); the PIN
 * is a light "who's sitting here" gate, configurable per deployment.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MODEL } from "../station.js";

export interface StationConfig {
  port: number;
  ollamaBaseUrl: string;
  model: string;
  /** Optional launch PIN. Unset => open (single trusted laptop). */
  pin?: string;
  dbPath: string;
  auditFile: string;
}

export function loadConfig(stationRoot: string, overrides: Partial<StationConfig> = {}): StationConfig {
  const defaults: StationConfig = {
    port: 8717,
    ollamaBaseUrl: "http://localhost:11434",
    model: MODEL.default,
    dbPath: resolve(stationRoot, "data/catalog.db"),
    auditFile: resolve(stationRoot, "audit/audit-log.jsonl"),
  };

  let fileCfg: Partial<StationConfig> = {};
  const cfgPath = resolve(stationRoot, "station.config.json");
  if (existsSync(cfgPath)) {
    try {
      fileCfg = JSON.parse(readFileSync(cfgPath, "utf8")) as Partial<StationConfig>;
    } catch {
      console.warn(`Ignoring malformed ${cfgPath}`);
    }
  }

  const envCfg: Partial<StationConfig> = {};
  if (process.env.STATION_PORT) envCfg.port = Number(process.env.STATION_PORT);
  if (process.env.STATION_OLLAMA_URL) envCfg.ollamaBaseUrl = process.env.STATION_OLLAMA_URL;
  if (process.env.STATION_MODEL) envCfg.model = process.env.STATION_MODEL;
  if (process.env.STATION_PIN) envCfg.pin = process.env.STATION_PIN;

  return { ...defaults, ...fileCfg, ...envCfg, ...overrides };
}
