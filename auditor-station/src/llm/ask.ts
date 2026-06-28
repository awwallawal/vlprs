/**
 * llm/ask.ts — the conversation orchestrator (SQ2-4).
 *
 * Flow for one question:
 *   1. Ask the model with the tool schemas.
 *   2. If it requested tool(s) → run them (deterministic, read-only) and feed results back to
 *      the model to narrate. (routedBy = "model")
 *   3. If it returned prose with NO tool call → the deterministic router picks a tool, we run
 *      it, and the model narrates the result. (routedBy = "router")  ← the insurance path
 *   4. If neither the model nor the router can pick a tool → return the model's prose with a
 *      caveat. (routedBy = "none")
 *
 * Correctness lives in the tools; the model only narrates their output. A minimal system
 * prompt is used here — SQ2-5 enriches it with the full durable knowledge + audit.
 */

import type { DB } from "../lib/catalog-db.js";
import { ollamaToolSchemas, runTool, type ToolResult } from "../tools/index.js";
import { STATION_MODE } from "../station.js";
import { routeToTool } from "./router.js";
import type { ChatMessage, LlmClient, ToolCall } from "./types.js";

export const DEFAULT_SYSTEM = [
  "You are the Auditor Station assistant for the Oyo State car-loan scheme.",
  "Answer ONLY from tool results — never invent names, figures, or MDAs.",
  "Every figure must be traceable; reference the sourceFile(s) behind the data.",
  "Use non-punitive language: 'observation' not 'anomaly', 'variance' not 'discrepancy',",
  "'for review' not 'flagged', 'balance below zero' not 'over-deduction'. No alarming wording.",
  `This is an "${STATION_MODE}": a frozen snapshot, not live or authoritative truth.`,
  "If a tool returns no data, say so plainly rather than guessing.",
].join(" ");

export interface ToolRun {
  name: string;
  args: Record<string, unknown>;
  result: ToolResult;
}

export interface AskResult {
  answer: string;
  toolRuns: ToolRun[];
  citations: string[];
  routedBy: "model" | "router" | "none";
}

export interface AskOptions {
  db: DB;
  client: LlmClient;
  question: string;
  system?: string;
  model?: string;
  /** Optional streaming sink for the narration turn. */
  onText?: (chunk: string) => void;
  /** Optional progress hook — fires once per tool just before it runs (UI "searching…"). */
  onTool?: (name: string, args: Record<string, unknown>) => void;
  /**
   * If false, SKIP the LLM narration turn and return the tools' deterministic summaries
   * directly — much faster on CPU (no second model call). Default true.
   */
  narrate?: boolean;
  /**
   * If true, skip the LLM ENTIRELY: the deterministic router picks the tool and the answer
   * is the tool summary. Near-instant; best for slow CPUs. Default false.
   */
  deterministic?: boolean;
}

// Cap how many rows we feed the model to narrate. The model only needs the summary, the
// counts (meta), and a few examples — sending all rows balloons CPU prefill time. The user
// still gets full citations + counts (those flow separately), so nothing is lost on screen.
const MODEL_ROW_CAP = 8;

function toolResultForModel(r: ToolResult): string {
  const rows = Array.isArray(r.rows) ? r.rows : [];
  const shown = rows.slice(0, MODEL_ROW_CAP);
  return JSON.stringify({
    summary: r.summary,
    meta: r.meta,
    rows: shown,
    ...(rows.length > shown.length
      ? { rowsNote: `showing ${shown.length} of ${rows.length}; use the summary/meta counts for totals` }
      : {}),
    error: r.error,
  });
}

/** Did the model/provider reject the tools array because the model can't do tool-calling? */
function isToolsUnsupported(err: unknown): boolean {
  const m = (err as Error)?.message ?? "";
  return /does not support tools|tools? (are )?not supported|tool[\s-]?call/i.test(m);
}

/** Build a direct answer from the tools' deterministic summaries (no LLM). */
function composeAnswer(toolRuns: ToolRun[]): string {
  const parts = toolRuns.map((r) => r.result.error || r.result.summary).filter(Boolean);
  return parts.join("\n\n") || "No matching records found.";
}

export async function ask(opts: AskOptions): Promise<AskResult> {
  const { db, client, question, model } = opts;
  const system = opts.system ?? DEFAULT_SYSTEM;
  const narrate = opts.narrate !== false;
  const deterministic = opts.deterministic === true;
  const messages: ChatMessage[] = [{ role: "user", content: question }];

  let toolCalls: ToolCall[] = [];
  let routedBy: AskResult["routedBy"] = "none";
  let firstContent = "";

  if (deterministic) {
    // No LLM at all — the deterministic router picks the tool.
    const routed = routeToTool(db, question);
    if (routed) {
      toolCalls = [{ function: { name: routed.name, arguments: routed.args } }];
      routedBy = "router";
    }
  } else {
    // 1. Tool-decision turn. If the model can't do tool-calling (e.g. Llama 3.0), Ollama
    //    rejects the tools array — catch that and retry WITHOUT tools so the router can carry it.
    let first;
    try {
      first = await client.chat({ model, system, messages, tools: ollamaToolSchemas() });
    } catch (err) {
      if (!isToolsUnsupported(err)) throw err;
      first = await client.chat({ model, system, messages });
    }
    firstContent = first.content;
    toolCalls = first.toolCalls;
    routedBy = toolCalls.length ? "model" : "none";

    // 2. Fallback router if the model returned prose.
    if (!toolCalls.length) {
      const routed = routeToTool(db, question);
      if (routed) {
        toolCalls = [{ function: { name: routed.name, arguments: routed.args } }];
        routedBy = "router";
      }
    }
  }

  // Nothing to run — return prose/help with a caveat.
  if (!toolCalls.length) {
    const answer =
      firstContent ||
      "I can answer questions about car-loan beneficiaries, MDA summaries, loan-computation checks, and record queries. Could you rephrase?";
    if (opts.onText) opts.onText(answer);
    return { answer, toolRuns: [], citations: [], routedBy: "none" };
  }

  // Execute the chosen tool(s).
  const toolRuns: ToolRun[] = [];
  const citations = new Set<string>();
  const toolMessages: ChatMessage[] = [];
  for (const tc of toolCalls) {
    opts.onTool?.(tc.function.name, tc.function.arguments ?? {});
    const result = runTool(db, tc.function.name, tc.function.arguments ?? {});
    toolRuns.push({ name: tc.function.name, args: tc.function.arguments ?? {}, result });
    for (const c of result.citations) citations.add(c);
    toolMessages.push({ role: "tool", tool_name: tc.function.name, content: toolResultForModel(result) });
  }

  // Fast path: skip the LLM narration turn — return the deterministic tool summary directly.
  if (deterministic || !narrate) {
    const answer = composeAnswer(toolRuns);
    if (opts.onText) opts.onText(answer);
    return { answer, toolRuns, citations: [...citations], routedBy };
  }

  // Narration turn — model explains the deterministic results (stream if requested).
  const narrationMessages: ChatMessage[] = [
    ...messages,
    { role: "assistant", content: firstContent, tool_calls: toolCalls },
    ...toolMessages,
  ];
  const narration =
    opts.onText && client.chatStream
      ? await client.chatStream({ model, system, messages: narrationMessages }, opts.onText)
      : await client.chat({ model, system, messages: narrationMessages });

  return { answer: narration.content, toolRuns, citations: [...citations], routedBy };
}
