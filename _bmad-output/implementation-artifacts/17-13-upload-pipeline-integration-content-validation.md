# Story 17.13: Upload Pipeline Integration & Content Validation

Status: backlog — consolidated at Step-5 fold 2026-07-06

## Story

As the **upload pipeline boundary**,
I want content-level validation that classifies files by what they contain — multi-month structures, stale markers, ghost rows, filename mismatches, year-aggregates — rather than what they claim to be,
So that non-car-loan files are turned away with clear reasons, and every legitimate-but-irregular file shape ingests correctly instead of corrupting monthly sequences.

**Origin:** SCP 2026-04-15 §4.1 (base). Amended ×1: Addendum 4 §3.1 (published 2026-07-06) — the consolidated ingest amendment [L4, L11, L12, L15, L16, L19, L20]. X-3 consumer.

**Priority:** core Epic 17, Reconciliation & Truth State sub-theme. Engine status: YES (all six A4 behaviours field-validated engine-side).

## Scope (folded)

**Base (SCP §4.1):** reject non-car-loan files at the boundary (the OYSHMB class). Rate-limiter Redis migration (UAT #44) integrated here — the ICR pipeline multiplies request volume.

**+ A4 §3.1 — the consolidated ingest amendment:**
1. **Multi-month & mid-sheet detection** (L4, L11): detect multi-month range filenames and mid-sheet period stacking at ingest (the engine's `findPeriodMarkers`/`getPeriodForRow` pattern, field-validated on 656 sheets); officer confirms row-shape; `MULTI_MONTH_FILE_HANDLING` observation emitted.
2. **Stale-marker defence** (L12): two-layer rule ported from the engine — spatial filter (period section-headers live in cols A–AA; far-right markers are template artifacts) + authority rule (an unambiguous sheet-name period outranks body markers; mid-sheet logic fires only on generic sheet names). At ingest, a stale marker prompts: *"your sheet header at row N still says X but the sheet name says Y — please confirm."*
3. **Filename-vs-content sanity** (L16): compare filename year against body markers; `FILENAME_YEAR_MISMATCH` observation on disagreement; body markers win when consistent. **X-3: one implementation in the shared 17.2 utilities; this story and 17.3b both consume it — dual citation, single build.**
4. **Secondary-table ghost rows** (L15): detect the secondary-table pattern (rows with one populated financial column where the sheet's rows have many) and tag `PARSER_NOISE` rather than ingesting as full records.
5. **Year-aggregate submissions are valid** (L19): officer declares "monthly" vs "year-end aggregate" at upload; the system ingests accordingly (FINANCE-class submissions carry the AG schema natively and are *better* than monthly for year-end purposes).
6. **Archive-retired markers content-hash verified** (L20): any "retired/do-not-use" source designation is backed by a content-hash manifest at marking time, re-runnable as an audit (the qa_qa lesson: "retired" read as "uningested" cost an investigation).

## Acceptance Criteria

1. **Given** a file whose content is not car-loan returns (the OYSHMB class), **When** uploaded, **Then** it is rejected at the boundary with the content-based reason stated. [Base]
2. **Given** ICR-scale request volume, **When** the rate limiter operates, **Then** it runs on Redis (UAT #44 migration). [Base]
3. **Given** a multi-month range filename or mid-sheet period stacking, **When** ingested, **Then** period blocks are detected per the `findPeriodMarkers` pattern, the officer confirms row-shape, and `MULTI_MONTH_FILE_HANDLING` is emitted. [A4, L4/L11]
4. **Given** a far-right or template-artifact period marker, **When** parsed, **Then** the spatial filter + authority rule apply and the officer sees the confirm prompt naming row N, header X, sheet name Y. [A4, L12]
5. **Given** filename year ≠ body markers, **When** validated, **Then** `FILENAME_YEAR_MISMATCH` is emitted and consistent body markers win — via the shared 17.2 utility (X-3), not a local reimplementation. [A4, L16]
6. **Given** secondary-table rows with one populated financial column, **When** parsed, **Then** they tag `PARSER_NOISE` and never ingest as full records. [A4, L15]
7. **Given** an officer declaring "year-end aggregate" at upload, **When** ingested, **Then** the file processes under aggregate semantics and is not mis-tiered as 1-month coverage (pairs with 17.17's format-aware tier). [A4, L19]
8. **Given** a source marked retired/do-not-use, **When** the marking commits, **Then** a content-hash manifest records exactly what was retired, re-runnable as an audit. [A4, L20]

## Sequencing

- **Consumes:** 17.2 shared utilities (X-3 content-vs-filename; period markers; record-picker).
- **Feeds:** 17.12 PRP (clean period-attributed rows), 17.17 (format-aware tiers), 17.13b (template fingerprint drift — separate new story).

---
## Provenance (Step-5 fold, 2026-07-06)
Consolidated per scp-consolidation-ledger.md §A. From this FOLDED moment this file is the
single truth for Story 17.13; the addenda are journal history (Agreement 30). Corrections
reopen; additions queue to A5+ as new ledger fold rows.

| # | Source | Contribution |
|---|---|---|
| 1 | Base — SCP 2026-04-15 §4.1 | Boundary rejection of non-car-loan files; Redis rate limiter (UAT #44) |
| 2 | A4 §3.1 (`scp-addendum-4-2026-07-04.md`) | Consolidated ingest amendment: L4/L11 multi-month + mid-sheet; L12 stale markers; L15 ghost rows; L16 filename-vs-content (X-3); L19 year-aggregate; L20 content-hash archives |

Evidence keys carried: L4, L11, L12, L15, L16, L19, L20 (+ UAT #44)
Collision resolution: X-3 (consumer — shared utility built in 17.2)
Engine status (per ledger §A): YES — all six behaviours landed engine-side
Pending amendments: none — additions queue to A5+
