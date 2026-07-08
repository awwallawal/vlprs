# Story 17.12: Person Reconciliation Pass (PRP)

Status: backlog — consolidated at Step-5 fold 2026-07-06

## Story

As the **reconciliation engine**,
I want a set-based, idempotent, per-person recompute pass with explicit dry-run and order-independence guarantees,
So that the final state is a function of the input set — never of upload order, file shape, or record duplication.

**Origin:** SCP 2026-04-15 §4.1 (base). Amended ×2: Addendum 1 §3 (2026-04-18, DRY_RUN) → Addendum 4 §3.9 (published 2026-07-06) [L4, L17].

**Priority:** core Epic 17, Reconciliation & Truth State sub-theme — the engine story others trigger. Engine status: YES (tie-break landed).

## Scope (folded)

**Base (SCP §4.1):** set-based, idempotent, per-person recompute. Triggered by upload / correction / handshake. Output is a function of the input set, not input order.

**+ A1 §3 — explicit DRY_RUN:** `DRY_RUN=true` executes all passes against proposed input, produces a diff report ("what would change"), emits no writes / audit entries / Review Queue mutations, returns projected state. **Cross-reference 17.0b:** if 17.0b's engine-wide dry-run contract covers this, the clause becomes "PRP conforms to the 17.0b contract" — architect disambiguates at implementation.

**+ A4 §3.9 [L4, L17]:**
1. Idempotence explicitly tested across **multi-month file orderings** (L4) — the property suite (17.16) includes multi-month permutations, not just single-file orderings.
2. **Completeness tie-break** (L17): when multiple records exist for the same (person, period), the more-complete record is canonical — latest-at-each-completeness-tier, not latest-wins (the ghost-row lesson: a sparse later record must not override a complete earlier one).

## Acceptance Criteria

1. **Given** the same input set in any arrival order (including multi-month file permutations), **When** PRP completes, **Then** final state is identical. [Base + A4, L4]
2. **Given** `DRY_RUN=true`, **When** PRP runs, **Then** all passes execute against proposed input, a diff report is produced, no writes/audit/queue mutations occur, and projected state returns for inspection — per the 17.0b contract where it governs. [A1]
3. **Given** multiple records for one (person, period), **When** the canonical record is chosen, **Then** the completeness tie-break applies: latest-at-each-completeness-tier, never latest-wins. [A4, L17]
4. **Given** a correction or handshake event, **When** PRP re-triggers for the person, **Then** recompute is scoped per-person and idempotent. [Base]

---
## Provenance (Step-5 fold, 2026-07-06)
Consolidated per scp-consolidation-ledger.md §A. From this FOLDED moment this file is the
single truth for Story 17.12; the addenda are journal history (Agreement 30). Corrections
reopen; additions queue to A5+ as new ledger fold rows.

| # | Source | Contribution |
|---|---|---|
| 1 | Base — SCP 2026-04-15 §4.1 | Set-based idempotent per-person recompute; trigger set |
| 2 | A1 §3 (`scp-2026-04-15-addendum-1.md`) | Explicit DRY_RUN mode + 17.0b contract cross-reference |
| 3 | A4 §3.9 (`scp-addendum-4-2026-07-04.md`) | L4 multi-month-order idempotence; L17 completeness tie-break |

Evidence keys carried: L4, L17
Collision resolution: none
Engine status (per ledger §A): YES — tie-break landed engine-side
Pending amendments: none — additions queue to A5+
