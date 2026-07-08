# Story 17.5: Person Link Candidates + Transfer Handshake Wiring

Status: backlog — consolidated at Step-5 fold 2026-07-06 (SPRINT-BLOCKED pending A5 continuity guard)

> **⛔ SEQUENCING GUARD (ledger §H item 3, standing since 2026-07-05):** the A5-queued **Species-C transfer continuity guard is a BLOCKING AC on this story**: the receiving MDA must carry forward true installments-paid; a backward restatement is a blocking reconciliation event, never a silent overwrite (ties to the W2-approved `loan_mda_reassignments` + `person_loans` schema). **This story enters NO sprint before that guard lands in this story text via an A5 ledger fold row.** The dependency is explicit rather than lucky — 17.5 is post-signature work anyway.

## Story

As the **identity layer and both MDAs party to a staff transfer**,
I want `person_link_candidates` surfaced proactively as Pending Handshakes wired into the existing Transfer Handshake workflow — with overlap cases routed to their own distinct workflow,
So that cross-MDA continuations resolve through a handshake both MDAs confirm, and same-time-two-MDAs cases are never misfiled as transfers.

**Origin:** SCP 2026-04-15 §4.1 (base). Amended ×2: Addendum 1 §3 (2026-04-18) → Addendum 4 §3.6 (published 2026-07-06). Ledger row X-9. A5 amendment queued (see guard above).

**Priority:** post-17a core Epic 17; sprint entry blocked by the A5 guard.

## Scope (folded)

**Base (SCP §4.1):** `person_link_candidates` table + proactive Pending Handshake surfacing to both MDAs + wiring into the existing Transfer Handshake workflow (Agreement: transfers resolve by handshake, not silent re-attribution).

**+ A1 §3 — the overlap valve:**
Overlap cases (`OVERLAPPING_MDA_PRESENCE` verdict from 17.4) do **NOT** file Pending Handshake — they are not transfers (same person present in two MDAs at the same time). They route to a distinct workflow:
1. Namesake frequency check (name appears ≥N times across scheme → require namesake disambiguation UI);
2. MDA hierarchy check (both MDAs share a `reporting_parent_mda` → flag as concurrent reporting, not merge);
3. Manual disposition by Dept Admin (rare residual).

**+ A4 §3.6 — field-confirmed valve + native LPC Out [L1, L9]:**
1. **Native LPC Out consumption** (L1): when an MDA submits LPC Out natively, the engine reads it as the authoritative transfer-out marker rather than inferring from cross-MDA timelines (FR109). **LPC Out + non-zero outstanding = transfer-with-debt = handshake required, not Path 3** (boundary rule feeds 17.22).
2. **PARENT_CHILD_OVERLAP bypass** (L9): AGRICULTURE↔CDU-class same-period appearances resolve to the parent/child verdict — never auto-treated as transfer or duplicate-deduction.

**Collision home (ledger §B) — X-9:** A1 already added the overlap distinct workflow; **L9 is its field confirmation plus the parent/child sub-case. Same valve, ONE implementation** — the A4 amendment extends the A1 workflow's hierarchy check, it does not add a second mechanism.

## Acceptance Criteria

1. **Given** a `LOAN_CONTINUATION_CONSISTENT` verdict (17.4), **When** link candidates surface, **Then** a Pending Handshake is proactively visible to BOTH MDAs and resolves through the existing Transfer Handshake workflow. [Base]
2. **Given** an `OVERLAPPING_MDA_PRESENCE` verdict, **When** routing runs, **Then** NO Pending Handshake is filed; the case enters the overlap workflow: namesake check → MDA hierarchy check → manual disposition. [A1]
3. **Given** two MDAs sharing a `reporting_parent_mda` (e.g., AGRICULTURE↔CDU), **When** the same person appears in both for the same period, **Then** the verdict is parent/child concurrent reporting — never transfer, never duplicate-deduction. [A1 + A4, L9, X-9]
4. **Given** an MDA return carrying a native LPC Out marker, **When** parsed, **Then** the marker is the authoritative transfer-out signal (no timeline inference needed) per FR109. [A4, L1]
5. **Given** LPC Out with non-zero outstanding, **When** classified, **Then** the case is transfer-with-debt requiring handshake — explicitly NOT Path 3 settlement (boundary shared with 17.22). [A4, L1]
6. **Given** the A5 continuity guard has landed in this story text, **When** a handshake completes, **Then** the receiving MDA's opening position carries forward true installments-paid, and any backward restatement raises a blocking reconciliation event. [QUEUED — A5 §H#3; placeholder AC, not implementable until the A5 fold row lands]

## Sequencing

- **Blocked by:** the A5 §H#3 continuity guard (sprint-entry gate — see banner); 17.4 (verdict source).
- **Feeds:** 17.22 (Path 3 boundary), Transfer Handshake workflow (existing).

---
## Provenance (Step-5 fold, 2026-07-06)
Consolidated per scp-consolidation-ledger.md §A. From this FOLDED moment this file is the
single truth for Story 17.5; the addenda are journal history (Agreement 30). Corrections
reopen; additions queue to A5+ as new ledger fold rows.

| # | Source | Contribution |
|---|---|---|
| 1 | Base — SCP 2026-04-15 §4.1 | person_link_candidates + proactive Pending Handshake + Transfer Handshake wiring |
| 2 | A1 §3 (`scp-2026-04-15-addendum-1.md`) | OVERLAPPING_MDA_PRESENCE distinct workflow (namesake check, hierarchy check, manual disposition) |
| 3 | A4 §3.6 (`scp-addendum-4-2026-07-04.md`) | L1 native LPC Out as authoritative marker (FR109); L9 parent/child bypass — field confirmation of A1's valve |

Evidence keys carried: L1, L9, FR109
Collision resolution: X-9 (one valve; L9 = field confirmation + parent/child sub-case of A1's workflow)
Engine status (per ledger §A): YES — LPC Out extraction landed engine-side
Pending amendments: **A5 §H#3 Species-C transfer continuity guard — QUEUED BLOCKING AC; this story enters no sprint before it lands here via an A5 ledger fold row**
