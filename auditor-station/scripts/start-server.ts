/**
 * start-server.ts — launch the Auditor Station locally (SQ2-5).
 *
 * Wires the real OllamaClient + read-only catalog.db + local audit log and listens on the
 * configured port. Run on a machine with Ollama up and a built catalog.db:
 *   pnpm start
 */

import { existsSync } from "node:fs";
import { totalmem } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { OllamaClient } from "../src/llm/ollama.js";
import { selectModelForRam } from "../src/lib/model-profile.js";
import { createAuditor, createStationServer, loadConfig, openConfiguredCatalog } from "../src/server/index.js";
import { getProvenance, provenanceBanner } from "../src/server/system-prompt.js";

const STATION_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Load .env (PIN, DB key, overrides) with zero dependencies — Node built-in. Optional.
const envPath = resolve(STATION_ROOT, ".env");
if (existsSync(envPath)) process.loadEnvFile(envPath);

const config = loadConfig(STATION_ROOT);

// Auto-select the model by RAM unless STATION_MODEL was pinned explicitly.
let modelNote = "pinned";
if (!process.env.STATION_MODEL) {
  const prof = selectModelForRam(totalmem());
  config.model = prof.model;
  modelNote = `auto (${prof.tier})${prof.belowFloor ? " — below 8GB floor, may be slow" : ""}`;
}

let opened;
try {
  opened = openConfiguredCatalog(config); // verifies manifest; decrypts if STATION_DB_KEY set
} catch (err) {
  console.error((err as Error).message);
  process.exit(1);
}
const { db, encrypted, integrity } = opened;

const client = new OllamaClient({ baseUrl: config.ollamaBaseUrl, model: config.model, numPredict: config.numPredict });
const auditor = createAuditor(config.auditFile);

const server = createStationServer({ db, client, config, auditor });
server.listen(config.port, "127.0.0.1", () => {
  console.log(`Auditor Station listening on http://127.0.0.1:${config.port}`);
  console.log(provenanceBanner(getProvenance(db)));
  console.log(`Model: ${config.model} (${modelNote}) · Ollama: ${config.ollamaBaseUrl} · Auth: ${config.pin ? "PIN required" : "open (no PIN)"}`);
  console.log(`At-rest: ${encrypted ? "encrypted (AES-256-GCM)" : "plain (dev)"} · Integrity: ${integrity}`);
  console.log(`Audit log: ${config.auditFile}`);
});
