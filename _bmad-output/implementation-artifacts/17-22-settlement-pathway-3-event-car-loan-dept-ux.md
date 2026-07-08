# Story 17.22: Settlement Pathway 3 — LUMP_SUM_SETTLEMENT Event + Car Loan Dept UX

Status: backlog — consolidated at Step-5 fold 2026-07-06

## Story

As the **Car Loan Department officer filing walk-up settlements**,
I want an explicit LUMP_SUM_SETTLEMENT event with receipt reference and bank cross-reference — with the transfer-with-debt boundary made explicit,
So that settled loans are distinguishable from stopped-reporting loans, and departures with debt route to handshake, never to a false settlement.

**Origin:** SCP 2026-04-15 §4.1 (base). Amended ×1: Addendum 4 §3.8 (published 2026-07-06) [L1].

**Priority:** core Epic 17, Settlement/Cash/Overdeduction sub-theme.

## Scope (folded)

**Base (SCP §4.1):** explicit LUMP_SUM_SETTLEMENT event with receipt reference + bank-receipt cross-reference. Car Loan Dept officer files (dual-signature above threshold per scheme policy — SCP §7 authority model).

**+ A4 §3.8 [L1] — the boundary rule:** **LPC Out with non-zero outstanding routes to transfer handshake, not Path 3** — the boundary between "left this MDA" and "settled the loan" made explicit (shared boundary with 17.5's L1 amendment; FR109 marker semantics).

## Acceptance Criteria

1. **Given** a walk-up lump-sum settlement, **When** the officer files it, **Then** a LUMP_SUM_SETTLEMENT event records receipt reference and bank-receipt cross-reference, under the SCP §7 authority model. [Base]
2. **Given** a person with a native LPC Out and non-zero outstanding, **When** classification runs, **Then** the case routes to transfer handshake — the Path 3 filing surface refuses it with the boundary rule stated. [A4, L1]
3. **Given** a settled loan, **When** its state renders anywhere, **Then** it is distinguishable from MDA-stopped-reporting (the base problem this story exists to fix). [Base]

---
## Provenance (Step-5 fold, 2026-07-06)
Consolidated per scp-consolidation-ledger.md §A. From this FOLDED moment this file is the
single truth for Story 17.22; the addenda are journal history (Agreement 30). Corrections
reopen; additions queue to A5+ as new ledger fold rows.

| # | Source | Contribution |
|---|---|---|
| 1 | Base — SCP 2026-04-15 §4.1 | LUMP_SUM_SETTLEMENT event + receipt/bank cross-reference + authority model |
| 2 | A4 §3.8 (`scp-addendum-4-2026-07-04.md`) | L1 boundary rule: LPC Out + debt → handshake, never Path 3 |

Evidence keys carried: L1 (+ FR109)
Collision resolution: none (boundary shared with 17.5 by rule statement, one valve there)
Engine status (per ledger §A): —
Pending amendments: none — additions queue to A5+
