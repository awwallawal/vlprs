/**
 * server/system-prompt.ts — the station's system prompt + provenance (SQ2-5).
 *
 * Structured as a DURABLE prefix (constant across calls — loan model, settlement pathways,
 * MDA overrides, vocabulary rules, worked examples) followed by a VOLATILE suffix (live
 * snapshot stats + provenance banner). The durable part is identical every call so Ollama can
 * reuse it from context; only the small suffix changes.
 */

import type { DB } from "../lib/catalog-db.js";
import { readMeta } from "../lib/catalog-db.js";
import { STATION_MODE } from "../station.js";
import {
  MDA_OVERRIDES,
  SETTLEMENT_PATHWAYS,
  STANDARD_RATE,
  TENURE_TABLE,
  TOLERANCE_NAIRA,
  expectedInterest,
} from "../../vendor/loan-model.js";

export interface Provenance {
  mode: string;
  builtAt: string;
  catalogSha256: string;
  shortSha: string;
  recordCount: number;
  mdaCount: number;
}

export function getProvenance(db: DB): Provenance {
  const meta = readMeta(db);
  const mdaCount = (db.prepare("SELECT COUNT(DISTINCT mda) AS n FROM records WHERE mda IS NOT NULL").get() as { n: number }).n;
  const sha = meta.catalogSha256 ?? "unknown";
  return {
    mode: STATION_MODE,
    builtAt: meta.builtAt ?? "unknown",
    catalogSha256: sha,
    shortSha: sha.slice(0, 12),
    recordCount: meta.recordCount ?? 0,
    mdaCount,
  };
}

/** One-line banner surfaced with every answer and on screen. */
export function provenanceBanner(p: Provenance): string {
  const day = p.builtAt.slice(0, 10);
  return `${p.mode} · data as of ${day} · snapshot ${p.shortSha} · ${p.recordCount.toLocaleString()} records`;
}

const DURABLE_PREFIX = [
  "You are the Auditor Station assistant for the Oyo State Government car-loan scheme.",
  "You help auditors trace beneficiaries, summarize MDAs, verify loan computations, and query records.",
  "",
  "GROUND RULES:",
  "- Answer ONLY from tool results. Never invent names, figures, MDAs, or dates.",
  "- Every figure must be traceable; reference the sourceFile(s) behind the data.",
  "- If a tool returns no data, say so plainly. Do not guess.",
  "",
  "NON-PUNITIVE LANGUAGE (mandatory):",
  "- Say 'observation' not 'anomaly'; 'variance' not 'discrepancy'; 'for review' not 'flagged';",
  "  'balance below zero' not 'over-deduction'. Neutral, factual tone. No alarming wording.",
  "",
  "LOAN COMPUTATION MODEL (one rate, one base, all tenures):",
  `- Standard interest = Principal × ${STANDARD_RATE} (13.33% flat).`,
  "- Monthly interest = Standard interest ÷ 60 (ALWAYS ÷ 60, never ÷ tenure).",
  "- Monthly principal = Principal ÷ tenure. Monthly deduction = monthly principal + monthly interest.",
  `- Rate check: Expected interest = Principal × ${STANDARD_RATE} × (tenure / 60), tolerance ₦${TOLERANCE_NAIRA}.`,
  "- Apparent rate by tenure: " + TENURE_TABLE.map((t) => `${t.tenure}mo=${t.apparentRate}`).join(", ") + ".",
  `- Worked example: ₦750,000 over 36 months → interest ₦${Math.round(expectedInterest(750000, 36)).toLocaleString()}.`,
  "",
  "SETTLEMENT PATHWAYS: " + SETTLEMENT_PATHWAYS.map((p) => `(${p.id}) ${p.name}`).join("; ") + ".",
  "",
  "FILE→MDA OVERRIDES (human-reviewed): " +
    MDA_OVERRIDES.map((o) => `${o.filePattern}→${o.correctMda}`).join("; ") + ".",
].join("\n");

export function buildSystemPrompt(db: DB): string {
  const p = getProvenance(db);
  const volatile = [
    "",
    "CURRENT SNAPSHOT:",
    `- Mode: ${p.mode}. This is a frozen snapshot, NOT live or authoritative truth.`,
    `- Data as of ${p.builtAt} · snapshot ${p.shortSha} · ${p.recordCount.toLocaleString()} records across ${p.mdaCount} MDAs.`,
    "- When stating figures, remind the user this is an operational, non-authoritative pilot snapshot.",
  ].join("\n");
  return DURABLE_PREFIX + "\n" + volatile;
}
