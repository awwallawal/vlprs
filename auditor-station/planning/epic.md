# SQ-2 Epic — Auditor Station

> **A self-contained, offline, local-Ollama car-loan analyst for the Auditor-General's office.**
>
> Parallel side-quest track (like SQ-1). **Not** a VLPRS app epic — lives entirely inside
> `/auditor-station/`, invisible to the app's sprint. See the fence record:
> `_bmad-output/planning-artifacts/sprint-change-proposal-2026-06-23.md`.
> Source proposal: `_bmad-output/implementation-artifacts/PROPOSED-auditor-ai-assistant.md`.

## Goal

An auditor asks natural-language questions ("Trace BADMUS F.G. across all MDAs", "Verify the
interest on all 36-month loans") and gets **cited, non-punitive** answers drawn from the
deduplicated catalog — on their own laptop, **fully offline, PII never leaving the machine**,
at **zero licensing cost**.

## The unit of delivery is the folder

Copy `/auditor-station/` = the whole thing. Four invariants make "self-contained" enforceable:

1. **Severability** — copies anywhere and runs with zero reference to the parent repo (inputs
   vendored at build, never imported at runtime).
2. **One-way boundary** — reads repo outputs once at build; the app never imports this folder.
3. **Pipeline isolation** — own `package.json`/lockfile, excluded from root workspace + app CI;
   a break here cannot break the app.
4. **PII hygiene** — `data/` (catalog.db) and `audit/` are gitignored; only code + stories +
   non-PII vendored knowledge are committed.

## Brain: local Ollama only

One provider (Ollama) + a test stub. Multi-provider scope **dropped** (YAGNI; online would
violate the no-PII-egress rule). **3B model floor** at 8 GB RAM (`qwen2.5:3b` / `llama3.2:3b`),
swappable to 7B/14B by config on higher-RAM laptops. **Correctness lives in the deterministic
read-only tools, not the model** — so a 3B and a 14B return identical numbers; only narration
quality differs. The **deterministic fallback router is MVP**: if the model returns prose instead
of a tool call, the server keyword-classifies the question and calls the tool itself.

## Non-negotiables even for the quick win

- **Provenance always on screen:** "data as of `<date>`, snapshot `<sha>`, *Operational —
  non-authoritative pilot*." A copied catalog.db is frozen — never present a stale snapshot as
  live truth.
- **PII governance:** BitLocker on the laptop (policy) + a "which snapshot went to which laptop"
  copy-log. (SQLCipher at-rest is Phase 2.)
- **Non-punitive language:** enforced by lint against a vendored snapshot of `vocabulary.ts`
  ("observation" not "anomaly"; no red badges) — not prompt-only.

---

## Story ladder (Gate-0-first; each story ≤15 tasks)

### Phase 1 — the quick win (hand-over target)

#### SQ2-0 — Gate 0: Local model smoke test & selection ⛔ *gates all build work*
Pull `qwen2.5:3b` and `llama3.2:3b` on the **target auditor laptop**. Confirm each loads within
the RAM budget; POST `/api/chat` with a `tools` array + a question that should trigger a tool →
**confirm a tool call is emitted**; measure tokens/sec.
**DoD:** a pinned model + quant recorded; go/no-go on fallback-router reliance; tokens/sec
acceptable for the streaming UX. *(Run in a native session on the target hardware — owner-run.)*

#### SQ2-1 — Folder scaffold + isolation
Create the `auditor-station/` tree; own `package.json`/lockfile; **pnpm-workspace ignore + app CI
exclusion**; `.gitignore` PII paths (`data/`, `audit/`); README/WAKEUP/CLAUDE.md; confirm the
fence record + `MEMORY.md` pointer exist.
**DoD:** app build/CI provably unaffected; folder severable (copies out and still scaffolds).

#### SQ2-2 — catalog.db build + vendor snapshot
`scripts/build-catalog-db.ts`: read `catalog.json` → SQLite, indexes (`normalizedName`, `mda`,
`(year,month)`, `outstandingBalance`), `meta` row (`catalogSha256`, `builtAt`, `recordCount`).
`scripts/sync-from-parent.ts`: snapshot `vocabulary.ts` + loan-model constants into `vendor/`
with source SHA + date. Read path opens the DB **read-only**.
**DoD:** reproducible, idempotent build; provenance recorded; read-only handle verified.

#### SQ2-3 — The four read-only tools
`search_beneficiary`, `get_mda_summary`, `verify_loan_computation`, `query_catalog` — built on
the side-quest utils (`name-match` + Yoruba normalize, `mda-resolve`, `number-parse`) **in
place**. Parameterized SQL from typed filters only; no free-form SQL/code.
**DoD:** 4 tools green vs a fixture catalog; `verify_loan_computation` tested vs the WAKEUP tenure
table (13.33% / ÷60 / ₦50 tolerance); every tool read-only; results carry `sourceFile`.

#### SQ2-4 — Ollama adapter + deterministic fallback router
`ask({system, messages, tools})` → `POST localhost:11434/api/chat` (stream:true); map Ollama
tool-call shape to the tool round-trip; stream text chunks. **Deterministic keyword fallback
router (mandatory):** prose-instead-of-tool-call → server classifies + calls the tool; model
narrates the result. Provide a test stub for unit tests.
**DoD:** adapter contract test passes; router proven to catch a non-tool-calling response.

#### SQ2-5 — Local server + system prompt + audit
Role/local-auth gate; cached system-prompt prefix (durable WAKEUP knowledge: loan model, four
settlement pathways, MDA overrides, vocabulary rules, worked examples) + volatile suffix (live
stats + question); local append-only audit log (question, answer, tools+args, model+quant,
timestamp); citations + provenance/non-authoritative banner.
**DoD:** question → cited answer; audit entry written (success + blocked); provenance surfaced.

#### SQ2-6 — Chat UI + vocabulary lint
Plain streaming chat page (NOT the React app): incremental answers, **tool-progress indicator**
("searching catalog…", "verifying computation…"), citation chips, mode/provenance banner.
**DoD:** streaming works on CPU-only inference; non-punitive **vocab lint** vs the vendored list
passes (no banned terms rendered).

### Phase 2 — harden (pending; still free, time-gated)

#### SQ2-7 — At-rest encryption + governance
SQLCipher on `catalog.db` + passphrase at launch; BitLocker policy doc; "snapshot → laptop"
copy-log; `MANIFEST.sha256` integrity gate (app refuses a catalog.db whose SHA doesn't match).
**DoD:** a copied catalog.db is useless without the passphrase; mismatched snapshot is refused.

### Phase 3 — productionize (pending; still free, time-gated)

#### SQ2-8 — Packaging & distribution
Tauri installer bundling the local server + chat + `catalog.db` + **Ollama as a sidecar** + the
pinned model; RAM→model config profile (auto-select by available RAM); signed/checksummed update
channel; local audit export.
**DoD:** clean-machine install launches offline, decrypts catalog.db, answers a question, shows
provenance, writes a local audit entry — double-click, no internet.
