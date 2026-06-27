/**
 * server/handler.ts — the core request handler (SQ2-5).
 *
 * Transport-agnostic so it's unit-testable without HTTP or a live Ollama: auth → ask → audit.
 * Records an audit entry for EVERY outcome (success, blocked, error) and surfaces provenance
 * with every answer.
 */

import type { DB } from "../lib/catalog-db.js";
import { ask, type AskResult } from "../llm/ask.js";
import type { LlmClient } from "../llm/types.js";
import type { StationConfig } from "./config.js";
import { checkPin } from "./auth.js";
import type { Auditor } from "./audit.js";
import { buildSystemPrompt, getProvenance, provenanceBanner, type Provenance } from "./system-prompt.js";

export interface HandlerDeps {
  db: DB;
  client: LlmClient;
  config: StationConfig;
  auditor: Auditor;
  /** Wall-clock injector (tests pass a fixed value; runtime uses () => new Date().toISOString()). */
  now?: () => string;
}

export interface AskInput {
  question: string;
  pin?: string;
  onText?: (chunk: string) => void;
}

export interface AskOutput {
  ok: boolean;
  answer?: string;
  toolRuns?: AskResult["toolRuns"];
  citations?: string[];
  routedBy?: AskResult["routedBy"];
  provenance: Provenance;
  banner: string;
  error?: string;
}

export async function handleAsk(deps: HandlerDeps, input: AskInput): Promise<AskOutput> {
  const { db, client, config, auditor } = deps;
  const now = deps.now ?? (() => new Date().toISOString());
  const provenance = getProvenance(db);
  const banner = provenanceBanner(provenance);
  const question = (input.question ?? "").trim();

  if (!question) {
    auditor.append({ ts: now(), status: "error", question: "", error: "Empty question." });
    return { ok: false, provenance, banner, error: "Please enter a question." };
  }

  const auth = checkPin(config, input.pin);
  if (!auth.ok) {
    auditor.append({ ts: now(), status: "blocked", question, error: auth.error });
    return { ok: false, provenance, banner, error: auth.error };
  }

  try {
    const system = buildSystemPrompt(db);
    const result = await ask({ db, client, question, system, model: config.model, onText: input.onText });
    auditor.append({
      ts: now(),
      status: "success",
      question,
      answer: result.answer,
      tools: result.toolRuns.map((t) => ({ name: t.name, args: t.args })),
      routedBy: result.routedBy,
      citations: result.citations,
      model: config.model,
    });
    return {
      ok: true,
      answer: result.answer,
      toolRuns: result.toolRuns,
      citations: result.citations,
      routedBy: result.routedBy,
      provenance,
      banner,
    };
  } catch (err) {
    const message = (err as Error).message;
    auditor.append({ ts: now(), status: "error", question, error: message, model: config.model });
    return { ok: false, provenance, banner, error: `Could not complete the request: ${message}` };
  }
}
