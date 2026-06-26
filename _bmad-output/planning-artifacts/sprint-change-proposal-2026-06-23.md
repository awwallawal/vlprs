# Sprint Change Proposal — 2026-06-23

## SQ-2: Auditor Station (carve-out) — FENCE RECORD

> **Type:** Course Correction (PM: John) · **Mode:** Incremental · **Status:** APPROVED by Awwal
> **Classification:** Moderate (new parallel track) → routed to side-quest owner, **not** app dev/PO.
>
> **This document is a FENCE RECORD, not a scope addition.** Its purpose is to put on the
> record that a net-new capability was evaluated and **deliberately carved OUT** of the VLPRS
> app plan as a self-contained side quest (**SQ-2**). It is the single artifact about SQ-2 that
> lives in the app's planning space. Everything else about SQ-2 — epic, stories, backlog, code —
> lives inside `/auditor-station/` and is **invisible to the app's sprint**.

---

## Section 1 — Issue Summary

**Trigger:** Amelia's `_bmad-output/implementation-artifacts/PROPOSED-auditor-ai-assistant.md`
(2026-06-21) proposed a net-new AG-office assistant capability — **as an Epic 17 story**
(provisional key `17-35`, hard deps on `17-2` and `17-32`).

**Core problem (category: new stakeholder requirement + packaging decision):** The
Auditor-General's office needs auditors to self-serve **cited, non-punitive car-loan analysis
on their own laptops — fully offline, with no PII egress and no API spend** — while the main
VLPRS app budget is **paused** (SCP 2026-04-15) and must not be disturbed. Amelia's proposal
delivers the capability but **binds it into the app**, which would contaminate paused scope,
incur false dependencies on backlogged Epic 17 work, draw on frozen budget, and embed 6,521
citizens' PII into the multi-user app.

**Evidence:** the PROPOSED doc; owner constraints (Ollama already in hand; no-PII-egress is a
hard rule; no budget to fund auditors' use of any paid online model); app budget paused per SCP
2026-04-15; Agreement 22 (app-as-source-of-truth → the station must corroborate, not override);
**SQ-1 precedent** for a parallel, non-contaminating side quest.

---

## Section 2 — Impact Analysis

**Epic impact: ZERO on the app plan.** No epic in `epics.md`/`sprint-status.yaml` is added,
modified, removed, or resequenced. The `17-35` story key is **rejected**. The false dependencies
on `17-2` (port utilities) and `17-32` (external auditor role) are **never incurred** — SQ-2
uses the side-quest's own utilities *in place* and its own local auth, so those stories keep
their original scope.

**Artifact conflicts: none.**
- **PRD** — no conflict; SQ-2 sits outside the app PRD. It reads the **non-authoritative**
  side-quest `catalog.json` and self-labels *"Operational — non-authoritative pilot,"* so it
  corroborates rather than overrides (consistent with Agreement 22).
- **Architecture** — app `architecture.md` untouched; SQ-2 documents its own architecture inside
  the folder. Stack is deliberately disjoint (SQLite, Ollama, plain web, own `package.json`).
- **UI/UX** — app UX spec untouched; SQ-2 has its own minimal chat UI, bound to non-punitive
  vocabulary via lint against a **vendored snapshot** of `vocabulary.ts`.

**Inheritance:** SQ-2 inherits exactly **two** things from the app — the **catalog** and the
**non-punitive vocabulary** — and only as **snapshotted data at build time**, never as code.

**Technical impact (the carve-out mechanics):**
1. Add `auditor-station/` to the **pnpm-workspace ignore** and **exclude it from app CI**.
2. `.gitignore` the PII paths `auditor-station/data/` and `auditor-station/audit/`.
3. This fence record in `_bmad-output/`.
4. An **SQ-2 pointer in `MEMORY.md`** mirroring the SQ-1 entry.

---

## Section 3 — Recommended Approach

**Selected: Hybrid — Parallel carve-out as SQ-2.**

| Option | Verdict |
|---|---|
| 1 — Direct Adjustment (fold into Epic 17) | ❌ Not viable — contaminates paused scope, false deps, PII into multi-user app |
| 2 — Rollback | ⊘ N/A — nothing built to revert |
| 3 — PRD MVP Review | ⊘ N/A — app MVP unaffected |
| **★ Hybrid — Parallel carve-out (SQ-2)** | ✅ **Selected** |

**Rationale:** lowest-risk path (carve-out enforced by construction — a station failure cannot
break the app build); zero impact on app timeline or committed capacity; delivers a tangible
AG-office quick win without reopening paused work; preserves optionality (a proven station can
later be ported into the app as a real story if budget returns).

**Cost note (correcting the original framing):** SQ-2 requires **no licensing or API spend** —
it runs entirely on free, local, open-source tooling (Ollama + open models + SQLCipher + Tauri).
It does **not** draw on the paused VLPRS app budget. Its only resource is the owner's time, run
as a parallel side quest. *"Pending funds"* refers to the **main app development** staying
paused — not to this station.

---

## Section 4 — Detailed Change Proposals

### New track (lives inside `/auditor-station/`, NOT in app planning)

A self-contained folder at repo root is the **unit of delivery** — copy the folder = the whole
thing. Governed by four invariants:

1. **Severability** — copies anywhere (outside repo / onto a laptop) and builds + runs with zero
   reference to the parent (inputs are vendored at build, never imported at runtime).
2. **One-way boundary** — the folder reads repo outputs once, at build; **the app never imports
   the folder.**
3. **Pipeline isolation** — own `package.json`/lockfile, excluded from root workspace and app CI;
   a station break can't break the app.
4. **PII hygiene** — `catalog.db`/`catalog.json` and the audit log are gitignored; only code +
   stories + non-PII vendored knowledge are committed.

**Brain:** local **Ollama** only (one provider + a test stub — multi-provider scope dropped as
YAGNI). 3B model floor (8 GB RAM), swappable to 7B/14B by config on higher-RAM laptops; the
**deterministic fallback router is MVP**, since correctness lives in the read-only tools, not the
model.

### App-side changes (the fence only)

| Artifact | Change |
|---|---|
| `pnpm-workspace.yaml` / app CI | Exclude `auditor-station/` (SQ2-1) |
| `.gitignore` | Add `auditor-station/data/`, `auditor-station/audit/` (SQ2-1) |
| `_bmad-output/planning-artifacts/` | This fence record |
| `MEMORY.md` | SQ-2 pointer (mirrors SQ-1) |
| `epics.md`, `sprint-status.yaml` | **No change** — SQ-2 is not an app epic |

### SQ-2 story ladder (Gate-0-first; full detail in `auditor-station/planning/epic.md`)

- **Phase 1 (quick win):** SQ2-0 (Gate 0 smoke test ⛔gates all) · SQ2-1 (scaffold + isolation) ·
  SQ2-2 (catalog.db + vendor snapshot) · SQ2-3 (4 read-only tools) · SQ2-4 (Ollama adapter +
  fallback router) · SQ2-5 (server + prompt + audit) · SQ2-6 (chat UI + vocab lint).
- **Phase 2 (pending, free):** SQ2-7 — SQLCipher + BitLocker policy + copy-log + integrity gate.
- **Phase 3 (pending, free):** SQ2-8 — Tauri installer + Ollama sidecar + RAM→model profile +
  signed update channel + audit export.

---

## Section 5 — Implementation Handoff

- **Owner:** Awwal, as SQ-2 side-quest lead (like SQ-1). **Not** a dev-team sprint item; **zero**
  committed-sprint capacity consumed.
- **Build:** Amelia (dev) only when pulled in, off-sprint.
- **PM (John):** owns this fence record.
- **PO/SM:** no app backlog reorg; SQ-2 never enters the app's `sprint-status.yaml`.
- **Success criteria:** Phase 1 hands the AG office a working, offline, PII-safe station that
  answers cited, non-punitive questions and shows its provenance/non-authoritative stamp — built
  on free tooling, with the app build/CI provably untouched.

**Gate 0 is the first action and gates everything else:** run the local-model smoke test
(`SQ2-0`) on the target auditor laptop before any build commitment.
