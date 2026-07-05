<!--
status: phase-frozen
generated: 2026-07-01
note: Point-in-time session record. Frozen — do not update. Durable state lives in WAKEUP.md,
      DELTA_2026-06-30.md, and the memory files linked at the bottom.
-->

# Session Log — 2026-06-28 → 2026-07-01

**Agent:** BMAD Dev (Amelia) · **Owner:** Awwal · **Area:** SQ-1 Car Loan side-quest (engine +
new Query Station). All work is **uncommitted** (side-quest convention); nothing pushed to git.

## TL;DR
Two threads: (A) **built and hardened a web "Query Station"** that lets a non-CLI auditor ask
natural-language questions answered by headless Claude Code on a laptop's Claude subscription, and
shipped it as a one-file deploy to a USB drive; (B) **fixed three ingest/data-quality bugs** the
station itself surfaced, re-ran the full engine pipeline, and closed the books (DELTA, memory,
freshness). Portfolio exposure corrected **₦1.582B → ₦1.674B** (HIGH COURT alone ₦0 → ₦92.1M).

---

## Thread A — Query Station (build → deploy → durability)

**What it is.** `scripts/legacy-report/query-station/` — a browser chat page → tiny Node server
(`server.mjs`, zero npm deps) → spawns headless `claude -p --output-format stream-json` scoped to the
SQ-1 engine → streams the answer back (SSE). Correctness comes from the agent writing+running tsx
against `catalog.json`; grounded by `system-prompt.md`. Runs at `http://127.0.0.1:8729`.

**Key decisions.**
- **Brain = Claude subscription, not API key.** `claude /login` on the machine; the spawned `claude`
  inherits subscription OAuth (`apiKeySource:none`). Chosen over SQ-2 (local-Ollama, fixed 4 tools),
  which Awwal judged "too convoluted and too restrictive."
- **PII egress accepted** (Awwal's call) — each question sends catalog PII to Anthropic; needs
  internet; not offline. Fine for 1–3 stations; reconsider (API keys / Team seats) for scale.
- **Multi-person/multi-laptop:** one subscription ≠ multiple people (ToS). Compliant paths documented:
  per-person Pro/Max, Claude Team seats, or API keys per station.

**Deployment — hard-won.** Shipping the whole repo as a zip **failed** because bundling ~223k
`node_modules` files makes a ZIP64/long-path archive Windows can't extract (symptom: *correct SHA but
won't extract*). Fix: **exclude `node_modules`** (lean ~162 MB zip, ~10.7k entries, extracts anywhere);
the laptop runs `pnpm install`. Then hit **`spawn claude.exe ENOENT`** — the laptop had npm-installed
Claude (`%APPDATA%\npm\node_modules\@anthropic-ai\claude-code\bin\claude.exe`), so `server.mjs` now
auto-discovers claude at both the native and npm locations (`resolveClaudeBin()`).

**Durability (the "make it better").** Docs kept going stale because they embedded the literal bundle
SHA (changes every build). Fixed at the root: **no doc contains a hash anymore** — all verification
points at the `vlprs-bundle.zip.sha256` file. Added **`refresh-deploy-drive.cmd`**: one command to
rebuild from current engine+data → auto-detect the removable drive → copy zip + `.sha256` +
`READ-ME-FIRST.txt` + `BUNDLE-INFO.txt` → verify checksum. New rule: **after any engine change,
double-click `refresh-deploy-drive.cmd`.**

---

## Thread B — Phase F engine fixes (from a Query Station observation package)

The station produced an observation package (`~/Downloads/car-loan-engine-observations-*.txt`); each
item was **verified against real code/catalog before acting**.

- **Item 1 — HIGHCOURT → UNKNOWN.** `mda-resolve.ts` filename alias `\bHIGHCOURT\b` fails when preceded
  by `_` (both word chars). Fixed to a non-letter boundary. 280 UNKNOWN records reattributed to HIGH
  COURT — they were content-identical duplicates, so dedup merged them. **UNKNOWN 280 → 0.**
- **Item 1b — HIGH COURT exposure ₦0 (deeper, self-discovered).** The regex alone didn't move exposure.
  Root cause: HIGH COURT's template abbreviations `"OUTS. BAL. N"`, `"NO. OF INSTAL. PAID/OUTS."`
  (periods after `NO.`/`OF.`) were unmatched → `outstandingBalance` null across **21 files**. Added
  period-tolerant rules (corpus-verified). **HIGH COURT exposure ₦0 → ₦92,100,546; recovery ₦0 → ₦2.9M.**
- **Item 2 — BUDGET AND PLANNING null deductions.** Column headed `"AMOUNT N"`; `mapColumns` strips the
  `" N"` Naira suffix, so the rule had to match `/^amount$/i` (my first `/^amount n$/i` attempt failed
  — caught via the engine's own functions). Corpus-scanned for safety. **646 nulls → 0; recovery ₦0 → ₦813,012.**

Ran the **full Layer A→D pipeline** (all deliverables regenerated), then wrote **`DELTA_2026-06-30.md`**,
updated memory, and resolved the freshness cascade → **15/15 OK**.

---

## Final numbers (end of session)
| Metric | Start of thread B | End |
|---|---|---|
| Catalog records | 101,602 | **101,338** |
| Catalog SHA-256 | `a9c7444f…` | `83c9e11c…` |
| Total exposure | ₦1.582B | **₦1.674B** |
| Monthly expected recovery | ₦80.3M | **₦84.0M** |
| Variances surfaced | 64,151 | 65,612 |
| Freshness audit | (drift cleared at session start) | **15/15 OK** |

## Files created / changed (all uncommitted)
**Engine:** `utils/mda-resolve.ts`, `utils/column-map.ts`, `reconciliation-inventory-build-v2-2026-04-18.ts`,
and (session-start hygiene) front-matter emitters in `register-approved-no-record-subclass.ts`,
`staff-id-backfill-2026-04-20.ts`, `mid-sheet-mda-split-audit.ts`.
**Query Station (new):** `query-station/` — `server.mjs`, `system-prompt.md`, `public/{index.html,app.js,style.css}`,
`start.cmd`, `make-bundle.cmd`, `refresh-deploy-drive.cmd`+`.ps1`, `drive-readme.txt`, `README.md`, `DEPLOYMENT.md`.
**Data/deliverables:** `catalog.json`, `scheme-summary.json`, full Layer A–D outputs regenerated.
**Records:** `DELTA_2026-06-30.md` (+ superseded `DELTA_2026-05-14.md`); README/INDEX/WAKEUP freshness bumps.
**Deploy drive (D:):** `vlprs-bundle.zip`, `.sha256`, `READ-ME-FIRST.txt`, `BUNDLE-INFO.txt`.
**Memory:** `project_sq1_query_station.md`, `project_engine_rerun_2026_06_30.md`, `MEMORY.md` updates.

## Lessons / gotchas (so we don't repeat them)
1. **Never bundle `node_modules`** — ZIP64 + >260-char paths defeat Windows extractors even with a good SHA.
2. **`claude` install location varies** — native (`~/.local/bin`) vs npm (`%APPDATA%\npm\...`); resolve both.
3. **`mapColumns` normalizes headers before matching** (strips trailing `" N"`, `.#`, collapses ws) — test
   column rules against the *normalized* form, and corpus-scan a new alias before a full rebuild.
4. **Verify Query-Station observations against real code** — the regex bug was real, but the predicted
   exposure bump needed a *second* fix the report didn't identify.
5. **No literal SHA in any doc** — it always goes stale; point at the `.sha256` file.
6. **Windows PowerShell mis-reads non-ASCII in `.ps1`** — keep scripts ASCII-only (the `₦` broke parsing).
7. **`D:\` root is delete/write-guarded** for the tool — drive-root removals must be done by hand.
8. **Background servers don't survive a disconnect** — relaunch on demand via `start.cmd`, don't rely on it staying up.

## Outstanding
- **Manual:** `del D:\server.mjs` (orphaned hotfix file; guard-blocked for the agent).
- **Follow-up observations (not bugs):** HIGH COURT stallCount 248 (inactive since 2021 — submission
  gap, for review); watch for further abbreviation-template variants in new drops.

---

## Reusable session-close checklist (adopt this each substantial session)
- [ ] Engine changed? → `DELTA_YYYY-MM-DD.md` written (before/after numbers)
- [ ] Memory updated (`project_*` file + `MEMORY.md` pointer)?
- [ ] Full pipeline re-run if the catalog changed?
- [ ] Freshness audit **15/15 / exit 0**? (write a new DELTA ⇒ bump README/INDEX + supersede old DELTA)
- [ ] Deploy drive refreshed (`refresh-deploy-drive.cmd`) if code/data changed?
- [ ] Temp `_tmp-*.ts` scripts cleaned up?
- [ ] Session log written + frozen (this doc is the template)?

## Durable records this log points to
- Engine cycle: `VLPRS-Reconciliation-2026-04-18/DELTA_2026-06-30.md`
- Live state: `scripts/legacy-report/WAKEUP.md` (auto-regenerated Current State table)
- Memory: `project_sq1_query_station.md`, `project_engine_rerun_2026_06_30.md`
- Station runbook: `scripts/legacy-report/query-station/DEPLOYMENT.md`
