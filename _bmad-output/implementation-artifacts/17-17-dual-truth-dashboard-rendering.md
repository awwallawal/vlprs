# Story 17.17: Dual-Truth Dashboard Rendering

Status: backlog — consolidated at Step-5 fold 2026-07-06

## Story

As the **Accountant General and every reader of an AG headline figure**,
I want every authoritative figure rendered dual-truth (Reconciled / Pending Review / Difference) — extended with the scheme-participation block, register exceptions, instrument grading, and the PARSER_BLIND fourth state,
So that published numbers carry their evidence status on their face, and no figure wears more confidence than its instruments support.

**Origin:** SCP 2026-04-15 §4.1 (base; absorbs UAT #8, #40, #47 + drill-downs from #45). Amended ×4: Addendum 1 §3 (2026-04-18, AMEND + MERGE) → Addendum 3 §4.3 (published 2026-07-06) → Addendum 4 §3.4 (published 2026-07-06) → W2-approved design §5 note. Ledger collision row X-4.

**Priority:** core Epic 17, Dashboard & Observability sub-theme; grading logic already landed engine-side (Partial).

## Scope (folded)

**Base (SCP §4.1):** Reconciled / Pending Review / Difference rendering on every AG headline figure; health-score absorption (#8); three-view dashboard pattern (#40); baseline diagnostic drill (#47). Admin Settings: the Difference-fraction threshold for the "Portfolio in review phase" banner is AG-editable (default 20%, SCP §placeholder table).

**+ A1 §3 — AMEND + MERGE (17.19, 17.20, 17.21-UI retired into this story):**
1. **Scheme Participation tile block (6 tiles):** catalog-participation · register-approved · overlap-confirmed · catalog-only · register-only (sub-class colour: MDA_COVERAGE_GAP / NO_TRACE / FUZZY_MATCH_WITHIN_MDA) · post-event-active.
2. **₦-weighted severity metrics** alongside counts (operational + governance KPI).
3. **Re-attribution feed panel** (ex-17.20): last 30 re-attributions with before/after, owner, reason, timestamp, click-through.
4. **Pre-ingest preview** (ex-17.19): pre-commit modal — "N new persons, M continuations, K new loans, F flags" with per-class drill.
5. **MDA parent/child surface** (ex-17.21 UI): hierarchy view in MDA scorecard (CDU rolls into Agriculture where `reporting_parent_mda` is set).
6. **Register exception panel:** the 4 register-driven classes with APPROVED_BUT_NO_RECORD sub-class breakdown.

**+ A3 §4.3 — instrument grading + PARSER_BLIND [H10]:**
7. **Instrument-grading + thread-integrity gate BEFORE tiering.** Source instruments (workbooks/returns) are integrity-graded; threads failing integrity (non-monotone-with-jumps, zero-resurrection, month-0 records) or sourced from a low-graded instrument route to the DATA_RECONSTRUCTION disposition and never receive a refund tier. Verbatim gate, from the carry-forward: **"no refund tier without instrument grading."** (Evidence: the Samson/MOSOBALAJE thread, harmonised §8.2 M2 + §9.2.)
8. **PARSER_BLIND fourth state** joins Reconciled / Pending Review / Difference — "the parser could not see this" rendered distinctly from "the MDA did not report this." **AC #1 is the verification of H10 itself** (H10 is ASSERTED, not grep-confirmed — the story first proves or bounds the fail-open behaviour, then builds).
9. **Portfolio-wide month-0 defect count as a story metric.** Per the folded SQ-1 update: the engine-side period fix has landed (catalog 101,338 → 104,396, pin 83c9e11c → 667ebdd8); the app-side rule is that year-only records self-mark and are excluded from monthly-sequence analysis, ghost duplicates are kept-but-marked — the dashboard renders them as PARSER_BLIND-adjacent disclosure, never silently absorbed.

**+ A4 §3.4 — field lessons [L3, L6, L19]:**
10. PARSER_BLIND is **NOT re-routed here** (dual-route guard, X-4 — the state landed via A3/H10). A4 adds the lesson's evidence base: FINANCE's native columns unread; "missing data" → "unrecognized data"; blank-cell three-way disambiguation (not-submitted / not-computable / submitted-but-unread).
11. **Year-aggregate tier indicator** (L19): tier classification is format-aware — an MDA submitting a complete year-end aggregate is not "1-month coverage."
12. **Three-click drill-down invariant** (L6): every dashboard figure drills to contributing MDAs → source files → records (Agreement 11 made an AC).

**+ W2-approved design §5 note:** transfer-month **owner-expected vs collector-collected divergence is *signal***, presented as an observation with explanation — never an error. (Collecting-MDA semantics: `ledger_entries.mdaId` = collecting MDA, historical fact.)

**Collision home (ledger §B) — X-4:** L3 ↔ H10 PARSER_BLIND — this story owns the state via A3; A4 §3.5/§3.13 carry residuals only (17.18 badge state, 17.7 activity-log disclosure).

## Acceptance Criteria

1. **Given** H10's asserted fail-open parser behaviour, **When** this story starts, **Then** the first task proves or bounds that behaviour (grep + fixture evidence) before any PARSER_BLIND UI is built. [A3, H10 — AC #1 by design]
2. **Given** any AG headline figure, **When** rendered, **Then** it presents Reconciled / Pending Review / Difference / PARSER_BLIND states, with PARSER_BLIND visually distinct from "MDA did not report." [Base + A3]
3. **Given** a thread failing integrity grading (non-monotone-with-jumps, zero-resurrection, month-0) or a low-graded source instrument, **When** tiering runs, **Then** the thread routes to DATA_RECONSTRUCTION and receives no refund tier — **"no refund tier without instrument grading."** [A3, H10 verbatim gate]
4. **Given** the dashboard top, **When** loaded, **Then** the 6-tile Scheme Participation block renders with register-only sub-class colours. [A1]
5. **Given** severity metrics, **When** displayed, **Then** ₦-weighted values appear alongside counts. [A1]
6. **Given** the re-attribution feed, **When** opened, **Then** the last 30 re-attributions show before/after, owner, reason, timestamp, with click-through to affected records. [A1]
7. **Given** an upload pre-commit, **When** previewed, **Then** the modal shows new-persons / continuations / new-loans / flags with per-class drill-down. [A1]
8. **Given** an MDA with `reporting_parent_mda` set, **When** the scorecard renders, **Then** the child rolls into the parent row with the hierarchy visible. [A1]
9. **Given** year-only / ghost-marked records, **When** the dashboard aggregates, **Then** they surface as PARSER_BLIND-adjacent disclosure with the portfolio month-0 count trended as a story metric. [A3 §4.3#3]
10. **Given** an MDA submitting a valid year-end aggregate, **When** coverage tier computes, **Then** the tier is format-aware — not "1-month coverage." [A4, L19]
11. **Given** any dashboard figure, **When** a user drills, **Then** contributing MDAs → source files → records are reachable in three clicks. [A4, L6 / Agreement 11]
12. **Given** a transfer month where the owner-expected and collector-collected figures diverge, **When** rendered, **Then** the divergence presents as an observation with explanation (collecting-MDA semantics), never as an error state. [W2 §5]
13. **Given** the "Portfolio in review phase" banner threshold, **When** AG edits it in Admin Settings, **Then** the change applies with audit logging (before/after, actor). [Base, SCP §placeholder]

## Sequencing

- **Feeds on:** 17.14 truth-state model, 17.12 PRP outputs, 17.3c/d/e register classes, instrument grading (engine-side, ported via 17.2/17.16 fixtures).
- **Consumed by:** 15.4 (onboarding view), 16.3 (cross-month tab), Epic 21 clusters (role-home worklists read these states).
- **Non-punitive rule:** every state label uses Observation/Variance vocabulary; amber/grey presentation, no red badges (FR22).

---
## Provenance (Step-5 fold, 2026-07-06)
Consolidated per scp-consolidation-ledger.md §A. From this FOLDED moment this file is the
single truth for Story 17.17; the addenda are journal history (Agreement 30). Corrections
reopen; additions queue to A5+ as new ledger fold rows.

| # | Source | Contribution |
|---|---|---|
| 1 | Base — SCP 2026-04-15 §4.1 | Dual-truth per tile; UAT #8/#40/#45/#47 absorption; AG-editable banner threshold |
| 2 | A1 §3 (`scp-2026-04-15-addendum-1.md`) | MERGE of 17.19/17.20/17.21-UI; 6-tile participation block; ₦-weighted severity; re-attribution feed; pre-ingest preview; parent/child surface; register exception panel |
| 3 | A3 §4.3 (`scp-addendum-3-2026-07-04.md`) | Instrument-grading gate (verbatim); PARSER_BLIND fourth state w/ H10 verification as AC #1; month-0 metric + folded SQ-1 update |
| 4 | A4 §3.4 (`scp-addendum-4-2026-07-04.md`) | L3 evidence base (state NOT re-routed — X-4 guard); L19 year-aggregate tier indicator; L6 three-click drill AC |
| 5 | W2-approved design §5 (`architect-winston-17a-schema-2026-07-04-W2-AMENDED.md`) | Transfer-month owner-vs-collector divergence = signal, observation-with-explanation, never error |

Evidence keys carried: H10, L3, L6, L19 (+ UAT #8/#40/#45/#47; Agreement 11)
Collision resolution: X-4 (PARSER_BLIND owned here via A3; A4 residuals live in 17.18 + 17.7)
Engine status (per ledger §A): Partial — grading logic engine-side
Pending amendments: none — additions queue to A5+
