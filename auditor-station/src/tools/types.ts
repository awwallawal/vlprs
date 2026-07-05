/**
 * types.ts — the read-only tool contract (SQ2-3).
 *
 * Every answer the station gives is grounded in one of these tools. The model only routes
 * and narrates; the tools do the lookup/math deterministically. Each tool:
 *   - takes the read-only DB handle + loosely-typed args (from the model or the router),
 *   - validates/coerces its own args (returns an error result, never throws),
 *   - returns structured rows + a short summary + citations (the sourceFiles behind the data).
 */

import type { DB } from "../lib/catalog-db.js";

export interface ToolResult {
  ok: boolean;
  /** Short, narration-ready summary of what was found (non-punitive language). */
  summary: string;
  /** Structured data the model narrates from. */
  rows?: unknown[];
  /** Distinct sourceFiles behind the result — every figure must trace to one. */
  citations: string[];
  /** Extra structured facts (counts, ranges, computed values). */
  meta?: Record<string, unknown>;
  /** Set when args were invalid or nothing matched in a way the caller should surface. */
  error?: string;
}

export interface ToolDef {
  name: string;
  description: string;
  /** JSON Schema for the Ollama `tools` array (SQ2-4 adapter consumes this). */
  parameters: Record<string, unknown>;
  /** Deterministic, read-only execution. */
  run(db: DB, args: Record<string, unknown>): ToolResult;
}

// ───────────────────────────── arg-coercion helpers ─────────────────────────────

/** Coerce a model-supplied value to a trimmed non-empty string, else undefined. */
export function asString(v: unknown): string | undefined {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return undefined;
}

/** Coerce to a finite number, tolerating "₦750,000" / "750000" strings. */
export function asNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[₦,\s]/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/** Coerce to a bounded positive integer with a default and a hard cap. */
export function asLimit(v: unknown, def = 50, max = 500): number {
  const n = asNumber(v);
  if (n === undefined) return def;
  return Math.max(1, Math.min(max, Math.floor(n)));
}

export function asBool(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    if (/^(true|yes|1)$/i.test(v)) return true;
    if (/^(false|no|0)$/i.test(v)) return false;
  }
  return undefined;
}

/** Distinct, non-null sourceFiles from a row set, capped for readability. */
export function citationsFrom(rows: { sourceFile?: string | null }[], cap = 25): string[] {
  const seen = new Set<string>();
  for (const r of rows) {
    if (r.sourceFile) seen.add(r.sourceFile);
    if (seen.size >= cap) break;
  }
  return [...seen];
}
