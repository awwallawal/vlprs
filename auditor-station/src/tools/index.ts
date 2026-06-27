/**
 * tools/index.ts — the read-only tool registry (SQ2-3).
 *
 * These four tools are the station's entire surface for touching data. The Ollama adapter
 * (SQ2-4) advertises `ollamaToolSchemas()` to the model; the server (SQ2-5) dispatches a
 * chosen tool through `runTool()`. The deterministic fallback router also dispatches here.
 */

import type { DB } from "../lib/catalog-db.js";
import type { ToolDef, ToolResult } from "./types.js";
import { searchBeneficiary } from "./search-beneficiary.js";
import { getMdaSummary } from "./get-mda-summary.js";
import { verifyLoanComputation } from "./verify-loan-computation.js";
import { queryCatalog } from "./query-catalog.js";

export const TOOLS: ToolDef[] = [
  searchBeneficiary,
  getMdaSummary,
  verifyLoanComputation,
  queryCatalog,
];

const BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));

export function getTool(name: string): ToolDef | undefined {
  return BY_NAME.get(name);
}

/** The `tools` array shape Ollama's /api/chat expects. */
export function ollamaToolSchemas(): unknown[] {
  return TOOLS.map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
}

/** Dispatch a tool by name with loose args; unknown tool → error result, never throws. */
export function runTool(db: DB, name: string, args: Record<string, unknown>): ToolResult {
  const tool = getTool(name);
  if (!tool) return { ok: false, summary: "", citations: [], error: `Unknown tool: ${name}` };
  try {
    return tool.run(db, args ?? {});
  } catch (err) {
    return { ok: false, summary: "", citations: [], error: `Tool ${name} failed: ${(err as Error).message}` };
  }
}

export type { ToolDef, ToolResult } from "./types.js";
