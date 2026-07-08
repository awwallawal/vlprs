# Story 17.16: Idempotency Property Tests + Full-Corpus CI Invariants

Status: backlog — consolidated at Step-5 fold 2026-07-06

## Story

As the **engineering team and every future rule change**,
I want the idempotency property-test framework extended into full-corpus CI invariants and the golden detection harness, under one CI policy,
So that no parser, resolver, or detection change can silently regress portfolio-scale behaviour — the gate that institutionalises the questions that caught regressions by hand.

**Origin:** SCP 2026-04-15 §4.1 (base). Amended ×1: Addendum 4 §3.3 (published 2026-07-06) + Addendum 3 execution-contract §10.2#3 (harness-as-treaty). Ledger collision row X-5.

**Priority:** core Epic 17, Reconciliation & Truth State sub-theme. Engine status: YES (6 audit scripts + harness live).

## Scope (folded)

**Base (SCP §4.1):** 24-permutation ingestion-order test for the Alatise + Lamidi + ADELEKE + CDU fixtures. Final state must be byte-identical across all orderings.

**+ A4 §3.3 — full-corpus invariants as CI regression gates [L2, L6, L7, L20]:**
1. The six full-corpus audit scripts (template-audit, file-coverage-audit, cross-MDA, coverage-verify, mid-sheet diagnostic, name-merge audit — each ≤60s) become CI invariants: **defect counts must not increase across commits**; they run on any commit touching parser/resolver utilities or adding an MDA template.
2. Any change to column-map / period-extract / mda-resolve produces a **BEFORE → AFTER delta report**; the reviewer cannot merge without acknowledging the delta (L6: two single questions each caught a portfolio-scale regression — the delta report institutionalises that question).
3. Content-hash archive invariant (L20): every retired-archive file matches a drop-zone twin by hash.
4. Fixture set extends with: multi-month + mid-sheet files (L4/L11), the L2 defect-class catalogue, stale-marker canaries (L12), year-aggregate FINANCE sheets (L19).

**+ A3 contract §10.2#3 — the harness treaty (X-5 resolution):** the golden harness (`overdeduction-regression-2026-07.ts`, 47-case set at catalog pin `667ebdd8`) and the corpus invariants are **one CI policy with two instrument families** — detection fixtures (harness) + corpus invariants (audit scripts). **17.16 owns both; one gate, not two.** Harness green before shipping anything touching detection; harness failure blocks deployment (Agreement 24).

## Acceptance Criteria

1. **Given** the four golden fixtures, **When** ingested in any of the 24 orderings, **Then** final state is byte-identical. [Base]
2. **Given** a commit touching parser/resolver utilities or adding an MDA template, **When** CI runs, **Then** the six corpus audit scripts execute and fail the build if any defect count increases. [A4, L2/L7]
3. **Given** a change to column-map / period-extract / mda-resolve, **When** a PR is raised, **Then** a BEFORE→AFTER delta report is generated and merge is blocked until the reviewer acknowledges it. [A4, L6]
4. **Given** the retired-archive set, **When** the archive invariant runs, **Then** every retired file matches its drop-zone twin by content hash. [A4, L20]
5. **Given** the golden harness at its pin, **When** any change touches detection logic, **Then** the harness runs and must be green before ship — one CI policy covering both instrument families. [A3 §10.2#3, X-5]
6. **Given** the extended fixture set (multi-month, mid-sheet, L2 catalogue, stale-marker canaries, year-aggregate sheets), **When** the suite runs, **Then** all fixture classes are exercised. [A4]

## Sequencing

- **Consumes:** 17.2's ported utilities + fixtures; the SQ-1 harness (treaty artifact, re-baselines only consciously).
- **Gates:** every subsequent parser/resolver/detection story — this is the enforcement story for Agreements 15/24.

---
## Provenance (Step-5 fold, 2026-07-06)
Consolidated per scp-consolidation-ledger.md §A. From this FOLDED moment this file is the
single truth for Story 17.16; the addenda are journal history (Agreement 30). Corrections
reopen; additions queue to A5+ as new ledger fold rows.

| # | Source | Contribution |
|---|---|---|
| 1 | Base — SCP 2026-04-15 §4.1 | 24-permutation idempotency test, byte-identical final state |
| 2 | A4 §3.3 (`scp-addendum-4-2026-07-04.md`) | Six corpus scripts as CI invariants; BEFORE→AFTER delta gate; content-hash invariant; fixture extensions |
| 3 | A3 §10.2#3 (`scp-addendum-3-2026-07-04.md`) | Golden harness as treaty — one CI policy, two instrument families |

Evidence keys carried: L2, L4, L6, L7, L11, L12, L19, L20
Collision resolution: X-5 (17.16 owns both instrument families; one gate)
Engine status (per ledger §A): YES — 6 scripts + harness live
Pending amendments: none — additions queue to A5+ (Kolade/Oke fixtures queue via A5 §H#5)
