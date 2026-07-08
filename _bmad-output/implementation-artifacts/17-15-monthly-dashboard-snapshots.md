# Story 17.15: Monthly Dashboard Snapshots

Status: backlog — consolidated at Step-5 fold 2026-07-06

## Story

As the **AG reading historical figures**,
I want monthly dashboard snapshots that preserve what was published despite later re-attribution — with drift surfaced as a quality signal,
So that history is never silently rewritten and improvement is measurable.

**Origin:** SCP 2026-04-15 §4.1 (base). Amended ×1: Addendum 4 §3.10 (published 2026-07-06) [L6, L17].

**Priority:** core Epic 17, Reconciliation & Truth State sub-theme. Engine status: YES.

## Scope (folded)

**Base (SCP §4.1):** preserve historical figures despite re-attribution.

**+ A4 §3.10 [L6, L17]:**
1. Snapshot row-picker uses the **completeness tie-break** (L17 — same rule as 17.12: latest-at-each-completeness-tier).
2. **Historical-figure drift across engine fixes is preserved and surfaced as a quality signal**, not silently rewritten (L6) — a snapshot differing from today's recomputation is a fact about improvement, displayed as such.

## Acceptance Criteria

1. **Given** a published monthly snapshot, **When** later re-attribution or engine fixes change computed history, **Then** the snapshot's figures remain as published. [Base]
2. **Given** the snapshot row-picker, **When** multiple candidate records exist for a (person, period), **Then** the completeness tie-break selects the canonical row. [A4, L17]
3. **Given** drift between a historical snapshot and current recomputation, **When** surfaced, **Then** it displays as a quality/improvement signal (observation vocabulary), never silently reconciled away. [A4, L6]

---
## Provenance (Step-5 fold, 2026-07-06)
Consolidated per scp-consolidation-ledger.md §A. From this FOLDED moment this file is the
single truth for Story 17.15; the addenda are journal history (Agreement 30). Corrections
reopen; additions queue to A5+ as new ledger fold rows.

| # | Source | Contribution |
|---|---|---|
| 1 | Base — SCP 2026-04-15 §4.1 | Historical-figure preservation despite re-attribution |
| 2 | A4 §3.10 (`scp-addendum-4-2026-07-04.md`) | L17 completeness tie-break in row-picker; L6 drift-as-signal |

Evidence keys carried: L6, L17
Collision resolution: none
Engine status (per ledger §A): YES
Pending amendments: none — additions queue to A5+
