# PROPOSED — Auditor AI Assistant (WakeUp-Primed, Read-Only Q&A over the Car Loan Catalog)

> **STATUS: PROPOSED — NOT YET IN SPRINT PLAN.**
> Net-new scope. Not in `epics.md`; not added to `sprint-status.yaml`. Bringing it into the
> tracked plan must go through **`correct-course` / a Sprint Change Proposal**, because it
> intersects existing Epic 17 stories (`17-2`, `17-32`) and the Epic 17 "App is source of
> truth" thesis. Provisional key: `17-35-auditor-ai-assistant` (placeholder — PM assigns).
>
> This document is the **SCP input** for John (PM) / `correct-course`.
> Author: Amelia (Senior Software Engineer) · Drafted: 2026-06-21

---

## 1. Summary

Bring the capability of the CLI-only **"WakeUp Session"** car-loan analyst
(`scripts/legacy-report/WAKEUP.md`) **into the VLPRS app**, as a role-gated, **read-only**,
conversational assistant. An auditor asks natural-language questions ("Trace BADMUS F.G.
across all MDAs", "Which MDAs have the highest stall rates?", "Verify the interest on all
36-month loans") and receives **cited, non-punitive** answers drawn from the deduplicated
catalog — with **no CLI, no scripts, and no hand-reading of 469 spreadsheets**.

Two delivery surfaces, one codebase:
- **In-app** (central VLPRS): an `/assistant` route for the auditor role.
- **Auditor laptop**: a portable, **offline-capable** station the same code packages into
  (see §9 — the distribution design).

Three load-bearing design choices, each justified below:
1. **Query the catalog, not the raw Excel.** The `.xlsx` files are already parsed (8 phases
   of bug-fixes) into `catalog.json`. The assistant queries a derived store; it never
   re-parses spreadsheets per question.
2. **Fixed read-only tools, never code execution.** In the CLI the analyst writes throwaway
   TypeScript. In a multi-user / on-a-laptop app that is remote code execution — forbidden.
   A fixed toolset gives the same answers, safely and auditably.
3. **Provider behind an adapter.** Claude / paid Gemini / local Ollama are swappable by
   config. The prompt, tools, data, RBAC, and audit logging are provider-agnostic.

---

## 2. Story

**As an** Auditor (Auditor-General office; and, per `17-32`, federal AG / civil society /
parliamentary reviewers),
**I want** to ask natural-language questions about the car-loan scheme and get cited,
non-punitive answers from the catalog,
**so that** I can trace beneficiaries, verify computations, and assess MDA compliance
independently — in the office or on a standalone laptop — without technical tooling.

## 3. Business Value

- Auditors self-serve the analysis Awwal currently performs manually via the CLI WakeUp bootstrap.
- Every answer is **auditable** (logged) and **traceable** (cited to `sourceFile`) — defensible for a government scheme.
- **Portable**: ships to an auditor's laptop as an offline, self-contained, PII-safe station.
- Reuses the hard-won domain engine (computation model, MDA resolution, name matching) instead of duplicating it.

---

## 4. Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  Auditor (browser tab, or desktop-app window)                          │
│  /assistant  — chat panel, streaming answers, citation chips           │
└───────────────┬──────────────────────────────────────────────────────┘
                │ POST /api/assistant/query  (SSE stream)
                ▼
┌──────────────────────────────────────────────────────────────────────┐
│ apps/server — assistant module                                         │
│                                                                        │
│  1. RBAC gate (reuse 1-4)            → 403 if not auditor+             │
│  2. Audit-log open (reuse 1-5)       → record question                 │
│  3. Build system prompt              → WakeUp knowledge + live stats   │
│                                        (prompt-cached, stable prefix)  │
│  4. AuditorLLM.ask({system,msgs,tools}) ── adapter ──┐                 │
│       claude | gemini | ollama  (config)             │                 │
│  5. Tool loop (READ-ONLY):                           │                 │
│       search_beneficiary / get_mda_summary /         │                 │
│       verify_loan_computation / query_catalog        │                 │
│  6. Stream answer + citations → client               │                 │
│  7. Audit-log close                  → record answer + tools used      │
└───────────────┬──────────────────────────────────────────────────────┘
                │ read-only
                ▼
        catalog.db (SQLite, single file)
        built once from docs/Car_Loan/analysis/foundation/catalog.json
        indexed on: normalizedName, mda, period(year,month), outstandingBalance
        carries provenance: catalogSha256, builtAt, recordCount
```

The **only** difference between central and laptop deployments is config (provider, auth,
where `catalog.db` lives) and packaging (§9) — the module is identical.

---

## 5. Acceptance Criteria (BDD)

**AC1 — Role-gated access.** Non-auditor requests to `POST /api/assistant/query` return 403
server-side and the `/assistant` UI route is hidden. Reuses `1-4-role-based-access-control`
and the auditor role from `17-32` when it lands.

**AC2 — WakeUp-primed, cached system prompt.** The system prompt carries: the loan model
(Principal × 13.33%; **Monthly Interest = Standard Interest ÷ 60 ALWAYS, never ÷ tenure**;
₦50 tolerance), the four settlement pathways, the human-reviewed MDA overrides, and the live
catalog "Current State" stats. It enforces the approved vocabulary from
`packages/shared/src/constants/vocabulary.ts`. The stable prefix is prompt-cached.

**AC3 — Provider-agnostic adapter.** A single interface
`AuditorLLM.ask({ system, messages, tools }) -> AsyncIterable<Chunk>` with impls for
`claude | gemini | ollama`, selected by config. Swapping providers changes no tool, prompt,
data, RBAC, or audit code. The LLM credential is read **server-side only**.

**AC4 — Fixed read-only toolset (NO code execution).** The LLM may call ONLY:
`search_beneficiary`, `get_mda_summary`, `verify_loan_computation`, `query_catalog` (schemas
in §7). No script/code-execution tool is exposed. Every tool is read-only — no write, mutate,
or delete. The DB handle is opened read-only.

**AC5 — Portable SQLite store.** A documented, repeatable build step turns `catalog.json`
(~101,602 records) into a single-file `catalog.db` with indexes on the filtered fields. Tools
query SQLite — never the raw `.xlsx`, never the 48MB JSON in memory. `catalog.db` + the app is
copyable to a laptop and runs offline with `provider=ollama`.

**AC6 — Audit logging.** Every query logs: question, answer, tools invoked (+ args),
provider/model, user id, timestamp — via `1-5-audit-logging`. Blocked/failed queries are
logged too. On the laptop, the audit log is local, append-only, and exportable.

**AC7 — Citations on every figure.** Tool results carry `sourceFile` (and sheet/period where
available); the assistant cites them for every stated number. An answer it cannot ground in a
tool result says so rather than inventing a figure.

**AC8 — Non-punitive language, enforced.** Rendered answers use approved vocabulary; banned
terms ("anomaly", "discrepancy", "flagged", "over-deduction", red badges) do not appear.
Checked by lint/test against `vocabulary.ts`, not prompt-only.

**AC9 — Streaming UX.** Answers stream to the client (SSE) and appear incrementally.

**AC10 — Provenance & mode labelling.** Every answer/session surfaces which `catalog.db`
snapshot it used (catalog SHA-256 + build date) and is labelled **"Operational —
non-authoritative"** until Epic 17 authoritative go-live (consistent with sprint-status mode
note).

---

## 6. System Prompt Construction

Two layers:

- **Stable prefix (cached):** distilled durable knowledge from `WAKEUP.md` — the computation
  model, the four settlement pathways, the MDA overrides table, the non-punitive vocabulary
  rules, tool-usage guidance, and worked example Q&A. This is the programmatic equivalent of
  "calling the Wake Session." It changes rarely → cache it.
- **Volatile suffix (not cached):** the live "Current State" stats (record count, MDA counts,
  total exposure, catalog SHA-256), and the user's question.

Keep the stable prefix byte-identical across requests (no timestamps/UUIDs in it) so prompt
caching actually hits. Source the vocabulary from `vocabulary.ts` at build time so prompt and
lint check share one definition.

---

## 7. Tool Contracts (read-only)

All tools reuse the ported utilities from `17-2` and query `catalog.db`.

```ts
// 1. Fuzzy beneficiary search — reuses name-match (+ Yoruba normalization)
search_beneficiary(input: { name: string; limit?: number })
  -> { matches: Array<{ personLabel: string; mda: string; recordCount: number;
                        firstPeriod: string; lastPeriod: string; sourceFiles: string[] }> }

// 2. Per-MDA rollup — reuses mda-resolve (63 canonical + 200+ aliases)
get_mda_summary(input: { mda: string })
  -> { mda: string; canonicalName: string; recordCount: number; staffCount: number;
       totalExposure: string; submissionStatus: 'active'|'inactive'|'never';
       firstPeriod: string; lastPeriod: string; sourceFiles: string[] }

// 3. Computation check — reuses the 8-0a scheme formula (13.33% / ÷60)
verify_loan_computation(input: {
  principal: number; tenure: number; declaredMonthly?: number; declaredInterest?: number })
  -> { expectedMonthlyInterest: string; expectedMonthlyPrincipal: string;
       expectedMonthlyDeduction: string; expectedTotalInterest: string;
       withinTolerance: boolean; toleranceNaira: 50; notes: string }

// 4. Structured filter — capped + paginated; returns rows WITH sourceFile for citation
query_catalog(input: {
  mda?: string; year?: number; month?: number;
  balanceBelowZero?: boolean; multiLoan?: boolean; namesake?: boolean;
  limit?: number; cursor?: string })
  -> { rows: CatalogRow[]; nextCursor?: string; truncated: boolean }
```

`CatalogRow` mirrors the WAKEUP record shape; `sourceFile` (+ `sheet`, `period`) is the
citation anchor. **No tool accepts free-form SQL or code.** `query_catalog` builds
parameterized SQL from the typed filter only.

---

## 8. SQLite Build Step

- Script: `apps/server/scripts/build-catalog-db.ts` (or `packages/shared`): read
  `catalog.json` → create `catalog.db` → insert records → create indexes
  (`normalizedName`, `mda`, `(year,month)`, `outstandingBalance`) → write a `meta` row
  (`catalogSha256`, `builtAt`, `recordCount`, `engineVersion`).
- Idempotent: re-runnable after any pipeline cycle; output is a function of input.
- Read path opens the DB **read-only**.
- Size sanity: ~101k rows in SQLite ≈ tens of MB; indexed lookups are sub-millisecond — far
  better than JSON-in-memory.
- **Encryption option** (laptop): build with **SQLCipher** so the data file is encrypted at
  rest; passphrase entered at app start (see §9 security).

---

## 9. Deployment & Auditor-Laptop Distribution  ★ (the "copy to the auditor's laptop" answer)

### 9.1 What actually needs to be on the laptop to be *useful*
An auditor station needs four things, and trust in all four:
1. **The data** — `catalog.db` (one file).
2. **A way to ask** — the app (server + client), or a packaged desktop app.
3. **The brain** — an LLM: a **local model (Ollama)** for offline, or a **paid no-train API**
   key for online.
4. **Trust** — citations (AC7), local audit log (AC6), and provenance stamping (AC10) so the
   auditor knows exactly which snapshot answered and can show their working.

### 9.2 Packaging options (best → simplest)

| Option | What you ship | Auditor experience | Effort | When |
|---|---|---|---|---|
| **A. Desktop app (Tauri)** ★ recommended | One signed installer bundling the client, a local server, `catalog.db`, and Ollama (or API config) | Double-click an icon, enter passphrase, ask questions. Fully offline. | Higher | The real deliverable for a non-technical auditor |
| **B. Portable folder + single-exe** | A folder: a single-file server build (`bun build --compile` / `pkg`), static client, `catalog.db`, a `start.bat` | Run one file; browser opens to localhost | Medium | Fast MVP / pilot on one laptop |
| **C. Docker** | The existing `Dockerfile.*` + `catalog.db` volume | Needs Docker installed | Low build / high install burden | **Central server only — not a govt laptop** |
| **D. Encrypted USB** | `catalog.db` (SQLCipher) on a BitLocker/VeraCrypt USB + option A or B | Plug in, launch | Low | Air-gapped review rooms |

Recommendation: **B for the pilot, A for production.** Tauri over Electron — smaller binary,
lower memory, better for a locked-down machine.

### 9.3 The LLM on the laptop — the decision that makes or breaks "useful"

| Mode | Pros | Cons | Use when |
|---|---|---|---|
| **Offline — local Ollama** ★ | No internet needed; **PII never leaves the laptop**; no per-query cost | Needs adequate RAM (≈16GB+ for a useful model); weaker reasoning | Secure/air-gapped rooms; default for the station |
| **Online — paid no-train API** | Best reasoning quality | Needs internet; a key on a laptop is a credential risk; only minimal tool-result slices may egress | Connected offices, harder questions |
| **Hybrid (config flag)** | Best of both | Slightly more config | Recommended: ship offline-capable, allow online when permitted |

Because the **deterministic tools do the actual math and lookup**, a mid-size local model
(narration + routing only) is good enough offline. Correctness lives in the tools, not the
model — that's what makes Ollama viable for a government station.

### 9.4 Security & PII — non-negotiable for a laptop holding ~6,521 citizens' financial records

- **Full-disk encryption** (BitLocker) on the laptop — mandatory.
- **Encrypt the data file** with **SQLCipher**; passphrase at launch. A copied `catalog.db`
  is then useless without the passphrase.
- **Read-only** DB handle; no write tools exist.
- **Local auth** — auditor logs in (reuse VLPRS auth, or a local PIN for the standalone app).
- **No bulk egress** — offline (Ollama) sends nothing out; online sends only minimal
  tool-result slices to a **no-train** tier, **never** the whole catalog, **never** a free
  consumer tier.
- **Local, append-only audit log**, exportable for oversight (ties to `17-32` audit-log feed).
- **Provenance stamp** — `catalog.db` carries catalog SHA-256 + build date; the UI shows it
  (AC10). Matches Epic 17's hashing discipline so an auditor's snapshot is identifiable.
- **Mode label** — "Operational / non-authoritative" until Epic 17 go-live, so an auditor
  never mistakes a side-quest snapshot for final reconciled truth.

### 9.5 Keeping a laptop current (update mechanism)
- Rebuild `catalog.db` centrally after a pipeline cycle → distribute via **signed/encrypted
  USB** (air-gapped) or an authenticated pull with **checksum verify** (the app refuses a
  `catalog.db` whose SHA-256 doesn't match the signed manifest).
- The app displays "data as of <builtAt>, snapshot <sha>" so staleness is visible.

### 9.6 Recommended laptop "gold path"
**Tauri desktop app + SQLCipher-encrypted `catalog.db` + bundled Ollama (offline) with an
optional paid-API config flag**, distributed on encrypted media, db stamped with provenance,
audit log local + exportable. One signed installer; double-click; passphrase; fully offline;
PII never leaves the machine.

---

## 10. Developer Context / Guardrails

- **Loan model** — `WAKEUP.md` §"Loan Computation Model". Reuse the `8-0a` scheme-formula
  service; do **not** re-derive `÷60`-vs-`÷tenure`.
- **Record shape** — `WAKEUP.md` §"Code Template"; `sourceFile` is the citation anchor.
- **Reuse, don't reinvent** — tools consume the `17-2` ported utils (`name-match`,
  `mda-resolve`, `number-parse`); RBAC `1-4`; audit `1-5`; API envelope
  `{ success, data }` (`WIRING-MAP.md`); client `useQuery` + `apiClient` pattern.
- **File locations** (confirm against `architecture.md`): server `apps/server/src/assistant/*`
  (route, adapter + provider impls, tools, sqlite layer, build script); client
  `apps/client/src/.../assistant/*` (route + chat panel); shared types in `packages/shared`.
- **PII / governance** — §9.4. Paid no-train API or local model only; never a free tier.
- **Prompt-injection** — treat catalog text (names, remarks) as data, not instructions.

---

## 11. Dependencies

| Depends on | Why | Status |
|---|---|---|
| `17-2-port-side-quest-utilities` | Tool implementations | backlog — **hard** |
| `17-32-external-auditor-read-only-role` | Auditor role, scoped-query semantics, audit-log feed | backlog — **strong** |
| `1-4-role-based-access-control` | Role gate | done |
| `1-5-audit-logging-action-tracking` | Audit sink | done |
| `8-0a-migration-computation-model-scheme-formula` | 13.33%/÷60 computation | done |
| `vocabulary.ts` | Non-punitive enforcement | exists |
| `catalog.json` (legacy-report output) | Source for `catalog.db` | exists (side-quest) |

## 12. Phasing (sizing guardrail: keep stories ≤15 tasks — split if needed)

- **Phase 1 — Engine core (in-app):** SQLite build + the four tools + adapter (one provider) +
  role-gated SSE endpoint + audit logging. No UI polish.
- **Phase 2 — Auditor UI:** `/assistant` chat panel, streaming, citation chips, provenance/mode banner.
- **Phase 3 — Offline laptop station:** Ollama adapter, SQLCipher, Tauri/portable packaging,
  update/provenance mechanism, local audit export.

Likely **3+ stories** — flag to PM for splitting at SCP time.

## 13. Open Questions for PM / SCP

1. **Placement** — new story under Epic 17 (Sub-theme K, beside `17-32`), an extension of
   `17-32`, or a small new epic? (Conversational-AI scope is distinct from Epic 17's
   deterministic engine work.)
2. **First provider** — paid Claude/Gemini (online) or Ollama (offline laptop) first?
3. **Catalog source** — read the side-quest `catalog.json` now, or wait for Epic 17's
   authoritative DB (PRP) so answers reflect reconciled truth? (Affects AC10 labelling.)
4. **`query_catalog` v1 filters** — which subset ships first (keep small)?
5. **Laptop fleet** — one auditor laptop or several? Drives the update/distribution model (§9.5).
6. **Authoritative vs operational** — is an offline snapshot acceptable to oversight bodies, or
   must the laptop pull live from the central authoritative DB once Epic 17 ships?

## 14. Definition of Done

- All ACs met, tests red→green→refactor.
- Role-gating verified per role; non-auditor denied.
- Four tools unit-tested against fixture catalog; `verify_loan_computation` tested against the
  WAKEUP tenure table.
- SQLite build documented + reproducible; read-only verified (no write path in any tool).
- Adapter has ≥1 working impl end-to-end + a contract test proving swappability.
- Audit-log entries verified for success and blocked queries.
- Non-punitive vocabulary check passes (automated).
- (Phase 3) Laptop package launches offline, decrypts `catalog.db`, answers a question, shows
  provenance, writes a local audit entry — on a clean machine.

---

## 15. Ollama / Local-Model Profile (offline auditor station)

> Decision: **local model via Ollama** is the default brain for the auditor station — PII never
> leaves the laptop, no internet, no per-query cost. The correctness comes from the
> deterministic read-only tools (§7); the model only **routes and narrates**.

### 15.1 Runtime
- Official Windows runtime: `OllamaSetup.exe` (installs the Ollama server on `localhost:11434`).
- This is necessary but not sufficient: runtime → **pull a model** → **carry the model offline**
  (it does not ship with the installer).

### 15.2 Target hardware: **8 GB RAM minimum** — this pins the model
Windows itself consumes ~3–4 GB, leaving ~4–5 GB for the model + the app. Therefore:

| Model class | Fits 8 GB? | Verdict |
|---|---|---|
| **3B (Q4)** — e.g. **Llama 3.2 3B Instruct** or **Qwen2.5 3B** (both tool-capable) | ✅ ~2 GB disk, ~3–4 GB resident | **Recommended default at 8 GB** |
| 7–8B (Q4) | ⚠️ borderline — swaps, slow, risk of OOM with the app open | Only if other apps closed; not safe as the standard |
| 14B+ | ❌ | Not viable at 8 GB |

**Recommendation:** standardize the 8 GB station on a **3B tool-capable model, Q4**
(`llama3.2:3b` or `qwen2.5:3b` — verify the `tools` capability on the model's Ollama page).

**Upgrade note for PM:** 8 GB works, but a **16 GB** auditor laptop unlocks 7B/14B and
materially better reasoning and tool-calling reliability. If the fleet can be specced at
16 GB, do it — it is the single biggest quality lever for the offline station. Document 8 GB as
the *floor*, 16 GB as *recommended*.

### 15.3 Tool-calling at 3B — the fallback router is REQUIRED, not optional
Small (3B) models call tools **less reliably** than 7B+/Claude/Gemini. Since the whole design
depends on the model invoking the four tools, harden it:
- Use a model that natively supports tools (above).
- Keep the toolset tiny (4 tools — already the design) and the schemas flat.
- Strong system-prompt tool guidance + 2–3 few-shot examples of question→tool-call.
- **Deterministic fallback router (mandatory at 3B):** if the model returns prose instead of a
  tool call, the server keyword-classifies the question to the correct tool and calls it. The
  model then narrates the tool result. This makes answer quality robust to weak local routing.

### 15.4 Runtime tuning for 8 GB
- `OLLAMA_KEEP_ALIVE` — keep the model resident to avoid per-query reload latency, but on 8 GB
  it competes with the app; tune (e.g. a few minutes) rather than indefinite.
- Prefer Q4_K_M; drop to Q3 only if memory-pressured (quality cost).
- Keep the cached system prompt lean and cap/paginate tool results (already in §7) — small
  models have small effective context and 8 GB constrains the KV cache.
- CPU-only inference is expected on this class of laptop → **slower tokens/sec**. The streaming
  UX (AC9) + a "working…" indicator are essential so the auditor sees progress.

### 15.5 Offline model transfer (air-gap)
Ollama stores models at `C:\Users\<user>\.ollama\models` (a `blobs/` + `manifests/` tree).
Pull on a connected machine, then **copy that whole `models` directory** to the same path on
the auditor laptop. No internet required on the laptop.

### 15.6 Adapter mapping (`provider=ollama`)
- `AuditorLLM.ask(...)` → `POST localhost:11434/api/chat` with `model`, `messages`, `tools`,
  `stream: true`.
- Map Ollama's tool-call response shape to the shared tool-call/tool-result round-trip; stream
  text chunks to the SSE endpoint.
- Record `model` + version + quant in the audit log (AC6) and surface it with the provenance
  stamp (AC10) — so an answer is attributable to a specific model build, not just "AI".

### 15.7 Packaging
- **Pilot:** install Ollama separately + the portable app (§9.2 option B); adapter points at
  `localhost:11434`.
- **Production (golden path):** ship Ollama as a **Tauri sidecar** (binary + the 3B model),
  started on app launch (§9.2 option A).

### 15.8 Smoke-test gate (run in the native `vlprs` session, on the 8 GB target if possible)
Before committing to packaging:
1. `ollama pull llama3.2:3b` (or `qwen2.5:3b`)
2. `ollama run <model>` — confirm it loads within RAM budget
3. `POST /api/chat` with a `tools` array + a question that should trigger a tool → **confirm a
   tool call is emitted**
4. Measure tokens/sec on the 8 GB machine → confirm the streaming UX is acceptable
5. If tool-calling is unreliable → the §15.3 fallback router carries it; if still poor, revisit
   model choice or recommend the 16 GB upgrade.
