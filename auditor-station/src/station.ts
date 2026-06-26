/**
 * Auditor Station — identity & operating constants (SQ-2).
 *
 * This is the only module SQ2-1 ships: it pins what Gate 0 decided and the invariants
 * every later story must honour. Real functionality arrives in SQ2-2..SQ2-6.
 */

/** Operating mode is ALWAYS this — surfaced on screen, never presented as authoritative truth. */
export const STATION_MODE = "Operational — non-authoritative pilot" as const;

/** Brain selection, pinned by Gate 0 (SQ2-0, 2026-06-26, 16 GB tier). */
export const MODEL = {
  /** Default brain: best routing + non-punitive narration of the interactively-viable speeds. */
  default: "qwen2.5:7b",
  /** Configurable snappy alternative (8.1 tok/s); returns identical cited numbers. */
  fast: "qwen2.5:3b",
} as const;

/** The four invariants that make "self-contained" enforceable (see README). */
export const INVARIANTS = [
  "severability",
  "one-way-boundary",
  "pipeline-isolation",
  "pii-hygiene",
] as const;

export type Invariant = (typeof INVARIANTS)[number];

export const STATION = {
  name: "auditor-station",
  track: "SQ-2",
  mode: STATION_MODE,
  model: MODEL,
} as const;
