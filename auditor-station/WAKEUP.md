# SQ-2 Auditor Station — WAKEUP (fresh-session bootstrap)

You are resuming work on **SQ-2: Auditor Station** — a self-contained, offline, local-Ollama
car-loan analyst for the Auditor-General's office. This is a **parallel side quest**, like SQ-1
(`scripts/legacy-report/WAKEUP.md`). It is **not** part of the VLPRS app and must never
contaminate it.

## Read these first
1. `auditor-station/README.md` — what this is + the four invariants.
2. `auditor-station/planning/epic.md` — the SQ-2 epic + the 9-story ladder (Gate-0-first).
3. `auditor-station/planning/sprint-status.yaml` — current story states.
4. Fence record: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-06-23.md`.
5. Source proposal: `_bmad-output/implementation-artifacts/PROPOSED-auditor-ai-assistant.md`.
6. Domain ground truth (snapshot source): `scripts/legacy-report/WAKEUP.md`
   (loan model 13.33% / ÷60 ALWAYS / ₦50 tolerance; four settlement pathways; MDA overrides).

## Hard rules (do not break)
- **No PII egress.** Brain is **local Ollama only**. No online/paid/free API. Ever.
- **One-way boundary.** This folder reads app outputs only at build (snapshot into `vendor/`).
  The app never imports this folder. Keep it out of the root pnpm workspace and app CI.
- **PII hygiene.** `data/` and `audit/` are gitignored. Never commit catalog.db/json or the log.
- **Correctness lives in the tools, not the model.** The 4 read-only tools do the math/lookup;
  the model only routes + narrates. Ship the deterministic fallback router.
- **Non-punitive language**, enforced by lint vs the vendored vocabulary snapshot.
- **Provenance + "Operational — non-authoritative pilot"** on every answer.

## First action
**Gate 0 (`SQ2-0`)** gates everything: on the target auditor laptop, `ollama pull qwen2.5:3b`
and `llama3.2:3b`, confirm tool-call emission via `POST /api/chat` with a `tools` array, measure
tokens/sec, and **pin** the model + quant. Only then start `SQ2-1` (scaffold + isolation).

## Inputs to snapshot at build (never import at runtime)
- Data: `docs/Car_Loan/analysis/foundation/catalog.json` → `data/catalog.db`.
- Vocabulary: `packages/shared/src/constants/vocabulary.ts` → `vendor/`.
- Loan model: from `scripts/legacy-report/WAKEUP.md` / the `8-0a` scheme formula → `vendor/`.
