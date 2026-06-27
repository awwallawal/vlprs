/**
 * smoke-ask.ts — manual live check of the ask() pipeline against REAL Ollama + catalog.db.
 *
 * Unit tests cover the orchestrator + router with a stub; this proves the real Ollama HTTP
 * round-trip end-to-end. Run ON A MACHINE WITH OLLAMA + a built catalog.db (e.g. the auditor
 * laptop after staging), not in CI.
 *
 *   pnpm smoke:ask "Trace BADMUS across all MDAs"
 *   pnpm smoke:ask "Which staff have a balance below zero?"
 */

import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { openCatalogReadonly } from "../src/lib/catalog-db.js";
import { OllamaClient } from "../src/llm/ollama.js";
import { ask } from "../src/llm/ask.js";

const STATION_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DB = resolve(STATION_ROOT, "data/catalog.db");

if (!existsSync(DB)) {
  console.error(`No catalog.db at ${DB}. Run \`pnpm build:catalog\` first (build machine).`);
  process.exit(1);
}

const question = process.argv.slice(2).join(" ") || "Trace BADMUS across all MDAs";
const db = openCatalogReadonly(DB);
const client = new OllamaClient();

console.log(`Q: ${question}\n`);
console.log("A: ");
const result = await ask({ db, client, question, onText: (c) => process.stdout.write(c) });
console.log("\n");
console.log("— routedBy :", result.routedBy);
console.log("— tools    :", result.toolRuns.map((t) => `${t.name}(${JSON.stringify(t.args)})`).join(", ") || "(none)");
console.log("— citations:", result.citations.slice(0, 5).join("; ") || "(none)");
db.close();
