# Story 17.2: Port Side-Quest Utilities + Ingest-Time Content-Level MDA Verification

Status: backlog — consolidated at Step-5 fold 2026-07-06

## Story

As the **upload pipeline and every identity/reconciliation consumer downstream**,
I want the field-proven side-quest utilities (`name-match`, `mda-resolve`, `number-parse`, `column-map`, `header-detect`, `period-extract`) ported into `packages/shared` with their regression suite, hardened with ingest-time content-level MDA verification and the SQ-1 parser behaviours,
So that production ingestion resolves MDA attribution, periods, and record shapes with the same accuracy the analysis engine has demonstrated at portfolio scale — and no silent mis-attribution class survives the port.

**Origin:** SCP 2026-04-15 §4.1 (base). Amended ×4: Addendum 1 §3 (2026-04-18) → Addendum 2 §2.4/§2.6 (published 2026-07-06) → Addendum 3 §4.4 (published 2026-07-06) → Addendum 4 §3.12 (published 2026-07-06). Ledger collision row X-1 (quadruple stack, folded in order).

**Priority:** FIRST story of 17a Sprint 1 — elevated per A3 §4.4 [H5]: the production parser is an 8-column positional CSV no MDA produces, while the real 42-template parser lives in SQ-1. Hard blocker for 17.3b (A2 §2.6 — not advisory).

**Sub-epic:** [17a] · **Sprint:** 1 (per `sm-bob-17a-sprint-plan`, 5 pts + ~2 pts recurrence scan)

## Scope (folded)

**Base (SCP §4.1):** port the six utilities into the server codebase (`packages/shared`) with the regression fixture suite from the March 2026 side-quest refinements.

**+ A1 §3 — three ingest-time gates:**
1. Content-level MDA verification as hard gate (first 5 title rows → 3-layer resolver → compare to catalog attribution).
2. Folder-aware fallback resolver as 4th resolution layer (priority below title, above fuzzy fallback).
3. `RESOLVER_ALIAS_MISSING` observation + `ALIAS_PROPOSAL` on fuzzy-wins-over-absent-alias events (the WCOS→BCOS class).

**+ A2 §2.4/§2.6 — sequencing + recurrence:**
4. Mid-sheet-MDA-split audit becomes a recurring pipeline scan, not one-shot (CDU-in-Agric, OYSGPP-in-OYSAA).
5. The 21 files in `_MULTI-MDA/` are an operational-debt counter (visible KPI) that must show zero before 17.3b activates in production.

**+ A3 §4.4 — the SQ-1 parser and segmentation [H5, H21; contract §10.2 merge point (a)]:**
6. 17.2 explicitly receives the SQ-1 parser AND the shared thread-segmentation utility (zero-reset segmentation + stale-month exclusion — the H21 LOAN_CYCLE design constraint). One shared utility, two consumers (app + SQ-1 detectors). The port does not carry the identity-as-string pattern into the app (resolve-at-read identity ordering per SQ-1 read-receipt).
7. The port carries the three parsing behaviours proven in the 2026-07-04 rebuild: (a) bare-month sheet names (`JAN`) combine with the filename year, guarded to pure month-word sheets; (b) secondary-sheet ghost/working-sheet rows self-mark and are excluded from monthly-sequence analysis — kept-but-marked, never deleted; (c) year-only / month-0 records self-mark the same way.

**+ A4 §3.12 — field-lesson hardening [L2, L10, L11, L15]:**
8. The full L2 alias catalogue ships as regression fixtures (each defect class a fixture).
9. `findPeriodMarkers` + period-block splitting (L11).
10. The completeness tie-break record-picker (L15/L17 pattern).
11. Editable-JSON typo/variant maps — ops can add a pair without a deploy (L10).

**Collision homes (ledger §B):**
- **X-1:** this story is the quadruple stack; amendments folded strictly base → A1 → A2 → A3 → A4 (this document).
- **X-3:** 17.2 HOSTS the shared content-vs-filename verification utility (the OYSIPA mis-route / L16 class). 17.3b and 17.13 consume it — dual citation, single build (A4 §3.1#3).

## Acceptance Criteria

1. **Given** the six utilities (`name-match`, `mda-resolve`, `number-parse`, `column-map`, `header-detect`, `period-extract`), **When** ported to `packages/shared`, **Then** the March-2026 regression fixture suite passes unchanged, and headers are normalized BEFORE column matching (column-map lesson).
2. **Given** an upload, **When** the server reads the first 5 title rows of each sheet and the 3-layer MDA resolver disagrees with catalog attribution, **Then** the entire upload routes to the Review Queue with `MDA_ATTRIBUTION_DISAGREEMENT` attached and cannot commit until Dept Admin confirms or corrects. [A1]
3. **Given** filename + title + column resolution all fail, **When** the parent folder name carries an MDA hint, **Then** the folder-aware layer proposes it as a 4th-layer resolution (below title, above fuzzy). [A1]
4. **Given** a fuzzy match wins where an exact/alias match to the correct MDA is absent (Levenshtein ≤ 2 to a wrong canonical), **When** the resolver commits, **Then** a `RESOLVER_ALIAS_MISSING` observation and an `ALIAS_PROPOSAL` for Dept Admin review are emitted. [A1]
5. **Given** any ingested sheet, **When** the mid-sheet recurrence scan runs, **Then** mid-sheet MDA splits are detected on every pipeline pass (recurring, not one-shot). [A2 §2.4, L7]
6. **Given** the `_MULTI-MDA/` operational-debt counter, **When** this story completes, **Then** all 21 files upload cleanly end-to-end and the counter shows zero — the precondition for 17.3b production activation. [A2 §2.6]
7. **Given** the shared thread-segmentation utility, **When** a loan thread shows a zero-reset followed by fresh deductions, **Then** segmentation splits it into loan cycles with stale-month exclusion, and both the app and the SQ-1 detectors consume the same implementation. [A3 §4.4, H21]
8. **Given** a workbook with pure month-word sheet names (`JAN`, `FEB`…), **When** parsed, **Then** sheet month combines with filename year to produce monthly granularity — guarded to pure month-word sheets only. [A3 §4.4, SQ-1 handoff §4]
9. **Given** secondary-table ghost/working-sheet rows or year-only/month-0 records, **When** parsed, **Then** they self-mark and are excluded from monthly-sequence analysis — kept-but-marked, never deleted. [A3 §4.4, H25 class]
10. **Given** the golden harness `overdeduction-regression-2026-07.ts` (47-case set at catalog pin `667ebdd8`), **When** the ported parser runs the same fixtures, **Then** it reproduces the engine's classifications — the harness is this port's acceptance test (Team Agreement 15 parity). [A3 §4.4]
11. **Given** the L2 alias-catalogue defect classes, **When** the regression suite runs, **Then** each class is covered by a fixture and passes. [A4, L2]
12. **Given** a multi-period sheet, **When** `findPeriodMarkers` + period-block splitting run, **Then** rows attribute to their in-sheet period blocks. [A4, L11]
13. **Given** multiple records for the same (person, period), **When** the record-picker selects, **Then** the more-complete record is canonical (completeness tie-break, latest-at-each-completeness-tier). [A4, L15/L17]
14. **Given** the typo/variant maps, **When** ops edits the JSON, **Then** the change takes effect without a deploy. [A4, L10]
15. **Given** the shared content-vs-filename verification utility (X-3 home), **When** filename metadata disagrees with sheet content, **Then** the utility exposes the disagreement for its consumers (17.3b, 17.13) — one implementation, consumed twice.

## Sequencing

- **Blocks:** 17.3b (hard, A2 §2.6 — 21-file counter must be zero first). Downstream: 17.4 critical path (17.2 → 17.3b → 17.4 → 17.4d).
- **Blocked by:** nothing. First in Sprint 1; 17.4b runs parallel.

---
## Provenance (Step-5 fold, 2026-07-06)
Consolidated per scp-consolidation-ledger.md §A. From this FOLDED moment this file is the
single truth for Story 17.2; the addenda are journal history (Agreement 30). Corrections
reopen; additions queue to A5+ as new ledger fold rows.

| # | Source | Contribution |
|---|---|---|
| 1 | Base — SCP 2026-04-15 §4.1 | Port six utilities + regression suite |
| 2 | A1 §3 (`scp-2026-04-15-addendum-1.md`) | Three ingest-time gates: content-level MDA verification hard gate; folder-aware 4th resolver layer; RESOLVER_ALIAS_MISSING/ALIAS_PROPOSAL |
| 3 | A2 §2.4 + §2.6 (`scp-2026-04-15-addendum-2.md`) | Hard-block before 17.3b; mid-sheet recurrence scan; 21-file `_MULTI-MDA/` operational-debt counter |
| 4 | A3 §4.4 (`scp-addendum-3-2026-07-04.md`) | H5 priority evidence; SQ-1 parser + shared thread-segmentation utility (H21, merge point (a)); three proven parsing behaviours; golden harness as acceptance test |
| 5 | A4 §3.12 (`scp-addendum-4-2026-07-04.md`) | L2 alias catalogue as fixtures; L11 period markers; L15/L17 record-picker; L10 editable JSON maps |

Evidence keys carried: H5, H21, H25 (class), L2, L7, L10, L11, L15, L16 (via X-3), L17
Collision resolution: X-1 (quadruple stack, folded in order); X-3 (17.2 hosts content-vs-filename utility; 17.3b + 17.13 consume)
Engine status (per ledger §A): YES — all A4 items + segmentation already landed engine-side
Pending amendments: none — additions queue to A5+
