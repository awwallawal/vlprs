/**
 * start-server.ts — launch the Auditor Station locally (SQ2-5).
 *
 * Wires the real OllamaClient + read-only catalog.db + local audit log and listens on the
 * configured port. Run on a machine with Ollama up and a built catalog.db:
 *   pnpm start
 */

import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { openCatalogReadonly } from "../src/lib/catalog-db.js";
import { OllamaClient } from "../src/llm/ollama.js";
import { createAuditor, createStationServer, loadConfig } from "../src/server/index.js";
import { getProvenance, provenanceBanner } from "../src/server/system-prompt.js";

const STATION_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const config = loadConfig(STATION_ROOT);

if (!existsSync(config.dbPath)) {
  console.error(`No catalog.db at ${config.dbPath}. Run \`pnpm build:catalog\` first.`);
  process.exit(1);
}

const db = openCatalogReadonly(config.dbPath);
const client = new OllamaClient({ baseUrl: config.ollamaBaseUrl, model: config.model });
const auditor = createAuditor(config.auditFile);

const server = createStationServer({ db, client, config, auditor });
server.listen(config.port, "127.0.0.1", () => {
  console.log(`Auditor Station listening on http://127.0.0.1:${config.port}`);
  console.log(provenanceBanner(getProvenance(db)));
  console.log(`Model: ${config.model} · Ollama: ${config.ollamaBaseUrl} · Auth: ${config.pin ? "PIN required" : "open (no PIN)"}`);
  console.log(`Audit log: ${config.auditFile}`);
});
