# Story 17.18: `<VarianceBadge>` — Direction-Explicit Variance Badge

Status: backlog — consolidated at Step-5 fold 2026-07-06

## Story

As **every user reading a variance on any surface**,
I want a direction-explicit badge component with four states,
So that "who is owed" is never ambiguous and parser blindness is never dressed as reconciled data.

**Origin:** SCP 2026-04-15 §4.1 (base). Amended ×1: Addendum 4 §3.5 (published 2026-07-06). X-4 residual.

**Priority:** core Epic 17, Dashboard & Observability sub-theme (component story).

## Scope (folded)

**Base (SCP §4.1):** `<VarianceBadge>` component with three states: ↓ Outstanding to scheme / ↑ Refund due to staff / ⚠ Pending classification. Amber/grey only, non-punitive (FR22).

**+ A4 §3.5 [L3]:** **fourth badge state for PARSER_BLIND** — the half of L3 that H10/A3 did not cover (A3 amended 17.17 only; this is the component-level residual). Amber/grey, non-punitive, consistent with the existing three.

**Collision note (ledger §B) — X-4 residual:** the PARSER_BLIND *state and dashboard semantics* are owned by 17.17 (via A3 §4.3). This story carries only the badge-component rendering of that state. One state definition, two surfaces.

## Acceptance Criteria

1. **Given** a variance in scheme's favour, **When** rendered, **Then** the badge shows ↓ Outstanding to scheme. [Base]
2. **Given** a variance in the staff member's favour, **When** rendered, **Then** the badge shows ↑ Refund due to staff. [Base]
3. **Given** an unclassified variance, **When** rendered, **Then** the badge shows ⚠ Pending classification. [Base]
4. **Given** a value the parser could not read, **When** rendered, **Then** the badge shows the PARSER_BLIND state, visually consistent with the other three, semantically per 17.17's state definition. [A4, L3]
5. **Given** all four states, **When** styled, **Then** amber/grey only — no red, no punitive iconography (FR22 vocabulary). [Base + A4]

---
## Provenance (Step-5 fold, 2026-07-06)
Consolidated per scp-consolidation-ledger.md §A. From this FOLDED moment this file is the
single truth for Story 17.18; the addenda are journal history (Agreement 30). Corrections
reopen; additions queue to A5+ as new ledger fold rows.

| # | Source | Contribution |
|---|---|---|
| 1 | Base — SCP 2026-04-15 §4.1 | Three-state direction-explicit badge, amber/grey, non-punitive |
| 2 | A4 §3.5 (`scp-addendum-4-2026-07-04.md`) | PARSER_BLIND fourth badge state (L3 residual) |

Evidence keys carried: L3 (residual half; state owned by 17.17 via H10)
Collision resolution: X-4 residual (component rendering only; state semantics in 17.17)
Engine status (per ledger §A): —
Pending amendments: none — additions queue to A5+
