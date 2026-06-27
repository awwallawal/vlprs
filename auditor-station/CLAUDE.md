# Auditor Station (SQ-2) — working notes for this folder

> **You are inside a severable side quest, not the VLPRS app.** Everything needed to build and
> run lives in this folder. The app must never import it; it imports the app only as build-time
> data/knowledge *snapshots*, never code. See `README.md` for the full charter and `WAKEUP.md`
> to bootstrap a fresh session.

## What this is
A self-contained, **offline, local-Ollama** car-loan analyst for the Auditor-General's office.
Auditors ask natural-language questions and get **cited, non-punitive** answers from a snapshot of
the catalog — on their own laptop, **PII never leaving the machine**, at zero licensing cost.

## The four invariants (do not break these)
1. **Severability** — copy this folder anywhere and it still builds/runs. No reference to the
   parent repo at runtime. Inputs are *vendored at build*, never imported.
2. **One-way boundary** — reads repo outputs once at build; the app never imports this folder.
3. **Pipeline isolation** — own `package.json` + lockfile; excluded from the root pnpm workspace,
   from `eslint .`, and from the Docker build context. A break here cannot break the app.
4. **PII hygiene** — `data/` (catalog.db) and `audit/` (local log) are gitignored; only code,
   stories, and non-PII vendored knowledge are committed.

## How isolation is wired (SQ2-1)
- `pnpm-workspace.yaml` (root): `!auditor-station/**` — explicit non-member.
- `eslint.config.js` (root): `auditor-station/` in `ignores`.
- `.dockerignore` (root): `auditor-station` — kept out of image build context.
- This folder is **standalone**: install with `pnpm install --ignore-workspace` (mirrors how it
  behaves once copied off the repo). Its `pnpm-lock.yaml` is its own.

## Brain (pinned by Gate 0, SQ2-0)
Local Ollama only. **Default `qwen2.5:7b`**, fast-mode `qwen2.5:3b` (config, not code). Correctness
lives in the deterministic read-only tools — a 3B and a 14B return identical numbers; only narration
differs. The SQ2-4 fallback router is insurance (all models hit 5/5 at Gate 0), still built.

## Layout
```
src/        TypeScript source (tools, adapter, server) — committed
data/        catalog.db snapshot — GITIGNORED (PII)
audit/       local append-only audit log — GITIGNORED (PII)
vendor/      build-time snapshots of vocabulary.ts + loan-model constants (non-PII) — committed
web/         plain streaming chat page (NOT the React app) — committed
scripts/     gate0 smoke test + stage-to-device + (later) build-catalog/sync-from-parent
planning/    epic.md, sprint-status.yaml, gate-0 result
```

## Commands
```
pnpm install --ignore-workspace   # standalone install
pnpm typecheck                    # tsc --noEmit
pnpm test                         # vitest run
```

## Status
SQ2-0 ✅ (Gate 0, qwen2.5:7b pinned) · SQ2-1 ✅ (scaffold/isolation) · SQ2-2 ✅ (catalog.db +
vendor snapshot) · SQ2-3 ✅ (four read-only tools in `src/tools/`) · SQ2-4 ✅ (Ollama adapter +
router + `ask()` in `src/llm/`) · SQ2-5 ✅ (server + system prompt + audit + optional PIN in
`src/server/`) · SQ2-6 ✅ (chat UI in `web/` + SSE streaming + vocab lint) · SQ2-7 ✅ (AES-256-GCM
at-rest encryption + MANIFEST.sha256 integrity gate + governance) · SQ2-8 ✅ (RAM→model auto-select,
audit CSV export, double-click launcher, checksummed bundle; Tauri/signing documented in PACKAGING.md).
**ALL 9 STORIES DONE.** Distribute: `pnpm bundle` → copy folder → laptop `pnpm install --ignore-workspace` → `.env` → `run-station.cmd`.
Run locally: `pnpm start` (needs Ollama + a built catalog.db) → open http://127.0.0.1:8717.
Live ask check: `pnpm smoke:ask "…"`.

## PIN (local-auth)
`.env` is the only knob (gitignored). `cp .env.example .env`, set `STATION_PIN=…`, `pnpm start`.
Change = edit + restart. Remove = clear value / delete `.env` + restart. Unset = open. Constant-time check.

## At-rest encryption (SQ2-7)
Set `STATION_DB_KEY` in `.env`, then `pnpm build:catalog` → `data/catalog.db.enc` (no plain db) +
`data/MANIFEST.sha256`. Launch verifies the manifest and decrypts in memory; wrong key or tamper is
refused. Deliver the key separately from the bundle. See `GOVERNANCE.md`. Record deployments with
`pnpm copy-log -- --laptop "<id>" --operator "<name>"`.
Ladder + DoD: `planning/epic.md`. Status: `planning/sprint-status.yaml`.

## Data refresh (new MDA spreadsheets arrive)
On the BUILD machine only: drop files into `docs/Car_Loan/` → re-run the SQ-1 engine
(`scripts/legacy-report/` Layer A) → `pnpm sync:parent` → `pnpm build:catalog`. Copy ONLY the
fresh `data/catalog.db` to the laptop. `pnpm sync:parent` warns if a vendored source drifted.
