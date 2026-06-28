/**
 * smoke-ask.ts — manual live check of the ask() pipeline end-to-end (SQ-2).
 *
 * Honors .env: provider (ollama|anthropic), encryption, narrate/deterministic. Proves the real
 * brain round-trip against the configured catalog. Run on a machine with the brain available
 * (Ollama up, or ANTHROPIC_API_KEY set) and a built catalog.
 *
 *   pnpm smoke:ask "Trace BADMUS across all MDAs"
 *   pnpm smoke:ask "Which staff have a balance below zero?"
 */

import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { OllamaClient } from "../src/llm/ollama.js";
import { AnthropicClient } from "../src/llm/anthropic.js";
import type { LlmClient } from "../src/llm/types.js";
import { ask } from "../src/llm/ask.js";
import { buildSystemPrompt } from "../src/server/system-prompt.js";
import { loadConfig, openConfiguredCatalog } from "../src/server/index.js";

const STATION_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(STATION_ROOT, ".env");
if (existsSync(envPath)) process.loadEnvFile(envPath);

const config = loadConfig(STATION_ROOT);
const { db } = openConfiguredCatalog(config); // verifies manifest; decrypts if STATION_DB_KEY set

const client: LlmClient =
  config.provider === "anthropic"
    ? new AnthropicClient({ model: config.model })
    : new OllamaClient({ baseUrl: config.ollamaBaseUrl, model: config.model, numPredict: config.numPredict });

const question = process.argv.slice(2).join(" ") || "Trace BADMUS across all MDAs";
console.log(`Brain: ${config.provider} (${config.model})`);
console.log(`Q: ${question}\n\nA: `);

const result = await ask({
  db, client, question,
  system: buildSystemPrompt(db),
  model: config.model,
  narrate: config.narrate,
  deterministic: config.deterministic,
  onText: (c) => process.stdout.write(c),
});
console.log("\n");
console.log("— routedBy :", result.routedBy);
console.log("— tools    :", result.toolRuns.map((t) => `${t.name}(${JSON.stringify(t.args)})`).join(", ") || "(none)");
console.log("— citations:", result.citations.slice(0, 5).join("; ") || "(none)");
db.close();
