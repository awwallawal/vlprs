# Story 17.7: Unified Loan Detail Page

Status: backlog — consolidated at Step-5 fold 2026-07-06

## Story

As **any role examining a single loan**,
I want one loan detail page — Identity | Timeline | Variance | Certificates | Activity Log — with transfer markers on the Identity tab and per-record parser disclosure in the Activity Log,
So that everything known about a loan, including what the system could NOT read, is visible in one place.

**Origin:** SCP 2026-04-15 §4.1 (base). Amended ×1: Addendum 4 §3.13 (published 2026-07-06) [L1, L3].

**Priority:** core Epic 17, Identity layer sub-theme. Staff self-service view = Phase 2.

## Scope (folded)

**Base (SCP §4.1):** tabs — Identity | Timeline (blank months explicit) | Variance | Certificates | Activity Log. Scoped by role.

**+ A4 §3.13 [L1, L3]:**
1. **Identity tab displays LPC Out** alongside MDA-level history (L1) — the native transfer-out marker is first-class on the identity surface.
2. **Activity Log surfaces "submitted-but-not-extracted" entries** (L3's per-record disclosure): "MDA submitted column X with value Y; engine did not extract it."

## Acceptance Criteria

1. **Given** a loan, **When** its detail page opens, **Then** the five tabs render, role-scoped, with blank months explicit on the Timeline. [Base]
2. **Given** a loan with an LPC Out marker, **When** the Identity tab renders, **Then** LPC Out appears alongside the MDA-level history. [A4, L1]
3. **Given** a record where the MDA submitted a column the engine did not extract, **When** the Activity Log renders, **Then** an entry states the column, the value, and that it was not extracted — per-record disclosure, non-punitive phrasing. [A4, L3]

---
## Provenance (Step-5 fold, 2026-07-06)
Consolidated per scp-consolidation-ledger.md §A. From this FOLDED moment this file is the
single truth for Story 17.7; the addenda are journal history (Agreement 30). Corrections
reopen; additions queue to A5+ as new ledger fold rows.

| # | Source | Contribution |
|---|---|---|
| 1 | Base — SCP 2026-04-15 §4.1 | Five-tab unified loan detail, role-scoped, blank months explicit |
| 2 | A4 §3.13 (`scp-addendum-4-2026-07-04.md`) | L1 LPC Out on Identity tab; L3 submitted-but-not-extracted Activity Log entries |

Evidence keys carried: L1, L3 (residual half — dashboard state owned by 17.17 via X-4)
Collision resolution: X-4 residual (per-record disclosure surface only)
Engine status (per ledger §A): YES
Pending amendments: none — additions queue to A5+
