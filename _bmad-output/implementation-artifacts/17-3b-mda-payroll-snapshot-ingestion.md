# Story 17.3b: Identity Anchor Ingest (formerly MDA Payroll Snapshot Ingestion)

Status: backlog — consolidated at Step-5 fold 2026-07-06

## Story

As the **PersonIdentityService and the reconciliation layer**,
I want MDA-level monthly payroll rosters ingested as identity anchors (PIS seed) — BIR-only for the 17a pilot,
So that identity resolution runs OYSG-ID-anchored where a roster exists, and payroll-vs-MDA variance is observable from the roster evidence layer.

**Origin:** SCP 2026-04-15 round 5 (base, as "MDA Payroll Snapshot"). Amended ×3: Addendum 2 §2.4 (retitle + reframe; published 2026-07-06) → Addendum 4 (X-3 shared-check consumption; published 2026-07-06) → Addendum 5 §3.3 (master-resolver role; folded 2026-07-09). Ledger row X-3.

**Priority:** [17a] Sprint 1, Large (8 pts), starts after the 17.2 mid-checkpoint. **Hard-blocked by 17.2** (A2 §2.6: the 21-file `_MULTI-MDA/` counter must be zero before this story activates in production).

## Scope (folded)

**Base (SCP round 5):** MDA-level monthly payroll upload (BIR CSV + OYSIPA xls pattern): 249 staff × 134 active CAR LOAN deductions × ₦1.67M discovered in BIR Feb 2026. `payroll_snapshots` table + HR_ROSTER aliases (highest-confidence alias type on `person_aliases`) + `PAYROLL_VS_MDA_VARIANCE` observation. Staging input at `VLPRS-Upload-Staging/_PAYROLL-ROSTERS/`. Distinct from the AG-level consolidated payroll reconciliation (7.0h + 7.0i, done) — different evidence layer, complementary.

**+ A2 §2.4 — retitle + reframe:**
1. **Retitled "Identity Anchor Ingest."** The roster is a **PIS seed**, not a parallel reconciliation layer — its primary product is identity anchors (OYSG ID ↔ person ↔ MDA at a point in time).
2. `PAYROLL_ROSTERS` config-driven MDA list: **BIR only for 17a**; Works/AG/Health entries added under 17b.
3. Content-vs-filename classification fixed — the OYSIPA "Staff Salary" file was mis-routed as a payroll roster when its content was car-loan returns (see X-3 below).
4. **Roster-month limitation acknowledged explicitly:** the BIR Feb 2026 roster misses retired-before-Feb, joined-after-Feb, and on-leave staff = 765 of 5,325 BIR records (14%) unanchored. Multi-month roster collection is a documented post-17a workstream (governance, deferred).

**+ A4 — X-3 consumption (no separate build):** the filename-vs-content sanity check is implemented ONCE in 17.2's shared utilities (A4 §3.1#3); this story **consumes** it to classify roster vs returns by content. Dual citation, single build.

**W1 relationship (A3 context):** payroll evidence is ledger-bound under the reframe — 17f.1 (W1) posts submissions/payroll as PAYROLL ledger events [H1, H2]. This story's roster ingest is the identity-anchor half; the value-posting half is 17f.1. The two must not be conflated: 17.3b moves knowledge (identity anchors, variance observations); 17f.1 moves value onto the ledger.

**+ A5 §3.3 — master-resolver framing + worklist consumption [P7]:**
17.3b is the **master resolver** for the three-species finding portfolio: its payroll data closes A-confirmation (below-zero), B (frozen-balance projection), and C (transfer restatement). The three proactive worklists (Species A/B/C, built on 16.1 + conservation 17f.6 per A5 §4.1) are its **consumers** — each emits a structured payroll ask (FR118: person, MDA, month-range — never a refund figure) that 17.3b's ingested snapshots answer. This reaffirms 17.3b's existing Sprint-1 sequencing priority (already first for identity anchoring) and adds the resolver role on top; it introduces no new ingest mechanism.

## Acceptance Criteria

1. **Given** a BIR payroll roster (CSV) or OYSIPA-pattern xls, **When** uploaded via the roster path, **Then** rows land in `payroll_snapshots` and produce HR_ROSTER aliases on `person_aliases` (highest confidence class). [Base]
2. **Given** an ingested roster month, **When** compared against MDA car-loan returns for the same period, **Then** disagreements emit `PAYROLL_VS_MDA_VARIANCE` observations (non-punitive vocabulary). [Base]
3. **Given** the `PAYROLL_ROSTERS` config list, **When** the 17a pilot runs, **Then** only BIR is active; adding an MDA is a config change reserved for 17b scope. [A2]
4. **Given** a file whose filename suggests payroll but whose content is car-loan returns (the OYSIPA class), **When** ingested, **Then** the shared 17.2 content-vs-filename utility classifies it by CONTENT and routes it to the correct pipeline — this story consumes the shared check, it does not reimplement it. [A2 + A4, X-3, L16]
5. **Given** the roster-month limitation, **When** identity anchoring runs, **Then** records outside the roster month's coverage (retired-before / joined-after / on-leave) remain name-matched with their unanchored status visible — the 14% unanchored figure is reportable, not hidden. [A2]
6. **Given** 17.2's `_MULTI-MDA/` operational-debt counter, **When** this story is proposed for production activation, **Then** the counter shows zero — hard sequencing gate. [A2 §2.6]
7. **Given** roster ingest completes for a month, **When** PIS (17.4) runs, **Then** OYSG-anchored matching is available for anchored records (the 24% case at portfolio scale; ~86% within BIR), with name-only matching the explicit fallback. [A2]
8. **Given** a structured payroll ask (FR118) emitted by a Species A/B/C worklist (person, MDA, month-range), **When** 17.3b has ingested the matching roster snapshot, **Then** the ask is answered from snapshot data — 17.3b acts as the master resolver closing A-confirmation, B, and C; no refund figure is produced by this story. [A5 §3.3, P7]

## Sequencing

- **Blocked by:** 17.2 (hard, A2 §2.6). Uses 17.2's shared content-vs-filename utility (X-3).
- **Blocks:** 17.4 (identity anchors are PIS seed) — critical path 17.2 → 17.3b → 17.4 → 17.4d.
- **Related, not conflated:** 17f.1 (W1) posts payroll VALUE to the ledger; this story produces identity KNOWLEDGE.

---
## Provenance (Step-5 fold, 2026-07-06)
Consolidated per scp-consolidation-ledger.md §A. From this FOLDED moment this file is the
single truth for Story 17.3b; the addenda are journal history (Agreement 30). Corrections
reopen; additions queue to A5+ as new ledger fold rows.

| # | Source | Contribution |
|---|---|---|
| 1 | Base — SCP 2026-04-15 round 5 | payroll_snapshots + HR_ROSTER aliases + PAYROLL_VS_MDA_VARIANCE; BIR evidence (249×134×₦1.67M) |
| 2 | A2 §2.4 (`scp-2026-04-15-addendum-2.md`) | Retitle → Identity Anchor Ingest; PIS-seed framing; BIR-only config; content-vs-filename fix; roster-month limitation (765/5,325 unanchored) |
| 3 | A4 §3.1#3 (`scp-addendum-4-2026-07-04.md`) | X-3 consumption: shared content-vs-filename check built in 17.2, consumed here — no separate build |
| 4 | A5 §3.3 (`scp-addendum-5-2026-07-09-DRAFT.md`), folded 2026-07-09 | P7 master-resolver role — payroll data closes A-confirm/B/C; consumes structured payroll asks (FR118) from the Species A/B/C worklists; no new ingest mechanism |

Evidence keys carried: L2, L6, L16 (via X-3); P7; H1/H2 boundary note (value-posting = 17f.1, not this story)
Collision resolution: X-3 (one implementation home in 17.2; 17.3b + 17.13 consume)
Engine status (per ledger §A): Partial
Pending amendments: none — additions queue to A6
