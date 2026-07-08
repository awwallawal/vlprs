# Story 17.10: Most Likely Explanation (MLE) Suggestion Engine

Status: backlog — consolidated at Step-5 fold 2026-07-06

## Story

As the **Dept Admin and AG adjudicating variances**,
I want a suggestion engine that attaches a specific remedial narrative to every CRITICAL and HIGH variance,
So that adjudication starts from the most likely explanation instead of a bare flag — reducing latency and improving consistency.

**Origin:** SCP 2026-04-15 §4.1 (base, from UAT #43 — tenure example only). Amended ×2: Addendum 1 §3 (2026-04-18, broadened) → Addendum 4 §3.11 (published 2026-07-06) [L12, L18]. Counts per ledger §G C6: **14 narrative rows / 12 classes** post-A1, +2 per A4 = 16 rows.

**Priority:** core Epic 17, Loan & Lifecycle sub-theme. Engine status: YES (A1 + A4 narratives).

## Scope (folded)

**Base (SCP §4.1, UAT #43):** narrow — tenure mis-recording narrative, built on the reverse-engineered-tenure logic from the Alatise audit ("Declared monthly consistent with tenure=50, not declared 28 — likely tenure misrecording").

**+ A1 §3 — broadened to ALL CRITICAL + HIGH variance classes, including the 4 register-driven classes.** The 14 narrative rows / 12 classes (APPROVED_BUT_NO_RECORD carries 3 sub-class narratives): TENURE_MIS_RECORDING · CUMULATIVE_OVERDEDUCTION · ARITHMETIC_IMPOSSIBILITY · BALANCE_INCREASE · BALANCE_DECREASE_BEYOND_MONTHLY · OVERLAPPING_MDA_PRESENCE · MDA_ATTRIBUTION_DISAGREEMENT · RESOLVER_ALIAS_MISSING · APPROVED_BUT_NO_RECORD (NO_TRACE / MDA_COVERAGE_GAP / FUZZY_MATCH_WITHIN_MDA) · RECORD_WITHOUT_APPROVAL · RETIRED_BUT_STILL_DEDUCTED · DECEASED_BUT_STILL_DEDUCTED — each with the specific remedial narrative per the A1 table (verbatim source: A1 §3, 17.10 amendment).

**+ A4 §3.11 — two new narratives [L12, L18]:**
- **STALE_TEMPLATE_MARKER:** "the sheet header was copied from a prior month — likely template artifact, not a data event."
- **Sequential-loans:** "same staff, two loan instances — a new loan, not a namesake or an error."

## Acceptance Criteria

1. **Given** any CRITICAL or HIGH variance, **When** it surfaces on an adjudication surface, **Then** the MLE engine attaches the class-specific remedial narrative from the folded set (16 rows). [A1 + A4]
2. **Given** a tenure-consistency computation, **When** declared tenure disagrees with the arithmetic-implied tenure, **Then** the narrative names both values and the likely correction. [Base]
3. **Given** an APPROVED_BUT_NO_RECORD case, **When** narrated, **Then** the sub-class (NO_TRACE / MDA_COVERAGE_GAP / FUZZY_MATCH_WITHIN_MDA) selects its distinct narrative and routing. [A1]
4. **Given** a stale template marker detection (from 17.13's L12 defence), **When** narrated, **Then** the STALE_TEMPLATE_MARKER explanation attaches — template artifact, not a data event. [A4, L12]
5. **Given** a sequential-loans determination (from the shared segmentation utility via 17.4/X-8), **When** narrated, **Then** the explanation states "new loan, not a namesake or an error." [A4, L18]
6. **Given** every narrative, **When** rendered, **Then** vocabulary is non-punitive (Observation/Variance; no fault attribution to MDAs or staff). [FR22]

---
## Provenance (Step-5 fold, 2026-07-06)
Consolidated per scp-consolidation-ledger.md §A. From this FOLDED moment this file is the
single truth for Story 17.10; the addenda are journal history (Agreement 30). Corrections
reopen; additions queue to A5+ as new ledger fold rows.

| # | Source | Contribution |
|---|---|---|
| 1 | Base — SCP 2026-04-15 §4.1 (UAT #43) | Tenure mis-recording narrative on reverse-engineered-tenure logic |
| 2 | A1 §3 (`scp-2026-04-15-addendum-1.md`) | Broadened to ALL CRITICAL+HIGH incl. 4 register-driven — 14 narrative rows / 12 classes (counts per §G C6) |
| 3 | A4 §3.11 (`scp-addendum-4-2026-07-04.md`) | STALE_TEMPLATE_MARKER + sequential-loans narratives |

Evidence keys carried: L12, L18 (+ UAT #43)
Collision resolution: none (sequential-loans mechanism lives in X-8's shared design; this story narrates it)
Engine status (per ledger §A): YES
Pending amendments: none — additions queue to A5+
