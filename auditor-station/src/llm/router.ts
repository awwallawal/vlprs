/**
 * llm/router.ts — deterministic keyword fallback router (SQ2-4).
 *
 * Insurance, not load-bearing: Gate 0 showed all candidate models emit tool calls 5/5, so this
 * fires only when the model returns prose instead of a tool call. It keyword-classifies the
 * question, extracts simple args, and picks the right tool — so the tools ALWAYS run and the
 * model is reduced to narrating a deterministic result. Best-effort, never a security surface
 * (it only chooses a tool + typed args; the tools themselves stay parameterized/read-only).
 */

import { resolveMda } from "../lib/mda-resolve.js";
import type { DB } from "../lib/catalog-db.js";

export interface RoutedCall {
  name: string;
  args: Record<string, unknown>;
}

/**
 * Largest ₦ figure mentioned (handles "₦750,000", "750000", "750k"). Plain numbers below
 * 1,000 are ignored unless flagged with ₦ or a k/m suffix — so a tenure like "36 months"
 * is never mistaken for a principal.
 */
function extractAmount(q: string): number | undefined {
  let best: number | undefined;
  // The k/m suffix must be its own word (\b) so "36 months" isn't read as 36 million.
  for (const m of q.matchAll(/(₦)?\s*([\d,]+(?:\.\d+)?)(?:\s*(k|m)\b)?/gi)) {
    let n = Number(m[2].replace(/,/g, ""));
    if (!Number.isFinite(n)) continue;
    const flagged = Boolean(m[1]) || Boolean(m[3]);
    if (/k/i.test(m[3] ?? "")) n *= 1_000;
    if (/m/i.test(m[3] ?? "")) n *= 1_000_000;
    if (!flagged && n < 1000) continue; // looks like a tenure/count, not money
    if (best === undefined || n > best) best = n;
  }
  return best;
}

/** Tenure in months: "36 months", "36mo", "over 48". */
function extractTenure(q: string): number | undefined {
  const m = q.match(/(\d{1,3})\s*(?:months?|mo\b)/i) ?? q.match(/\bover\s+(\d{1,3})\b/i);
  if (m) {
    const n = Number(m[1]);
    if (n > 0 && n <= 600) return n;
  }
  return undefined;
}

function extractYear(q: string): number | undefined {
  const m = q.match(/\b(20\d{2})\b/);
  return m ? Number(m[1]) : undefined;
}

/** Conversational/filler words that, alone, do NOT constitute a person name. */
const NON_NAME = new Set([
  "hello", "hi", "hey", "there", "thanks", "thank", "you", "your", "yours",
  "what", "whats", "which", "who", "whom", "how", "why", "when", "where",
  "can", "could", "would", "should", "do", "does", "did", "is", "are", "was", "were",
  "the", "a", "an", "please", "kindly", "ok", "okay", "help", "me", "my", "give",
  "tell", "list", "about", "info", "information", "data", "record", "records",
  "anything", "something", "test", "and", "or", "of", "for", "to", "in", "on", "with",
]);

/** Strip verb/scaffolding phrases; what remains is treated as a person name. */
function extractName(question: string): string | undefined {
  let s = ` ${question} `;
  s = s.replace(/\b(please|kindly|can you|could you)\b/gi, " ");
  s = s.replace(/\b(trace|find|look\s*up|lookup|search\s*for|search|show\s*me|show|tell\s*me\s*about|who\s*is|the\s+)\b/gi, " ");
  // verify-intent scaffolding (so by-name verify questions reduce to just the name)
  s = s.replace(/\b(verify|check|recompute|recalculat\w*|confirm|compute)\b/gi, " ");
  s = s.replace(/\b(interest|computation|deduction|repayment|loan|rate)s?\b/gi, " ");
  s = s.replace(/\bover\s+\d+\s*(?:months?|mo)?\b/gi, " ").replace(/\b\d+\s*(?:months?|mo)\b/gi, " ");
  s = s.replace(/\b(full\s+)?history(\s+of)?\b/gi, " ");
  s = s.replace(/\bdetails?\s+(of|for)\b/gi, " ").replace(/\bfor\b/gi, " ");
  s = s.replace(/\bacross\s+(all\s+)?mdas?\b/gi, " ").replace(/\bin\s+all\s+mdas?\b/gi, " ");
  s = s.replace(/\band\s+years?\b/gi, " ").replace(/\beverywhere\b/gi, " ");
  s = s.replace(/[?.,;:—–-]/g, " ").replace(/\s+/g, " ").trim();
  // Keep only tokens that aren't conversational filler; a name needs at least one such token.
  const meaningful = s.split(" ").filter((t) => t && !NON_NAME.has(t.toLowerCase()));
  if (!meaningful.length || !meaningful.some((t) => /[a-z]/i.test(t))) return undefined;
  return meaningful.join(" ").toUpperCase();
}

/** Detect a single MDA mentioned in the question (resolved against the snapshot). */
function detectMda(db: DB, question: string): string | undefined {
  const res = resolveMda(db, question);
  return res.matched && res.codes.length === 1 ? res.codes[0] : undefined;
}

export function routeToTool(db: DB, question: string): RoutedCall | null {
  const q = question.toLowerCase();

  // 1. verify_loan_computation — explicit numbers or a "verify/check … interest" intent.
  const wantsVerify = /\b(verify|check|recompute|recalculat|confirm)\w*\b/.test(q) &&
    /\b(interest|comput|deduction|repayment|loan|rate)\b/.test(q);
  if (wantsVerify) {
    const amount = extractAmount(q);
    const tenure = extractTenure(q);
    if (amount !== undefined && tenure !== undefined) {
      return { name: "verify_loan_computation", args: { principal: amount, installmentCount: tenure } };
    }
    const name = extractName(question);
    if (name) return { name: "verify_loan_computation", args: { name } };
  }

  // 2. query_catalog — analytical phrasing.
  if (/\bbelow\s*zero\b|\bnegative\s+balance\b|\bbalance\s+below\b/.test(q)) {
    const args: Record<string, unknown> = { balanceBelowZero: true };
    const mda = detectMda(db, question);
    if (mda) args.mda = mda;
    return { name: "query_catalog", args };
  }
  if (/\b(largest|highest|biggest|top|greatest)\b/.test(q) && /\b(balance|outstanding|deduction)\b/.test(q)) {
    const args: Record<string, unknown> = { orderBy: "outstandingBalance desc" };
    const year = extractYear(q);
    if (year) args.year = year;
    const mda = detectMda(db, question);
    if (mda) args.mda = mda;
    return { name: "query_catalog", args };
  }

  // 3. get_mda_summary — an MDA plus a portfolio-level intent.
  const mda = detectMda(db, question);
  if (mda && /\b(mda|ministry|agency|department|summary|portfolio|overall|total|how\s+many|breakdown)\b/.test(q)) {
    return { name: "get_mda_summary", args: { mda } };
  }

  // 4. search_beneficiary — trace/find/who + a name (the most common ask).
  if (/\b(trace|find|look\s*up|lookup|search|who\s*is|history|show)\b/.test(q)) {
    const name = extractName(question);
    if (name) return { name: "search_beneficiary", args: { name } };
  }

  // 5. last resort: a name → search; else a bare MDA → summary.
  const name = extractName(question);
  if (name) return { name: "search_beneficiary", args: { name } };
  if (mda) return { name: "get_mda_summary", args: { mda } };

  return null;
}
