# Story 17f.2: Staleness-Disclosure Provenance Chip

Status: done — SHIPPED 2026-07-05; story text consolidated at Step-5 fold 2026-07-06 as formalisation of shipped work

> **Record note:** this story shipped BEFORE its story file existed, pre-authorisation, under PO decision D-a (ship-and-tell, decided 2026-07-04) — pure disclosure, no computation change — and was disclosed in the signed pack's cover note. This file formalises what shipped; it is written in the past tense deliberately.

## Story

As **every reader of a computed money figure**,
I want a provenance chip on money surfaces stating the figure's basis ("live" / "as at baseline" / "declared by MDA"),
So that until 17f.1 posts the loop, no figure wears more freshness than its data supports — the H1 staleness disclosed rather than hidden.

**Origin:** CREATED by Addendum 3 §3 (17f.2) [H1] (published 2026-07-06); UX primitive #2 of the approved direction (Fable critique §7.3) shipped early as a stopgap; the UX/IA epic (21) later absorbs it as a component story. Timing was PO decision D-a.

## What shipped (2026-07-05, John; commits `1826c6d` + `660563e`, on `dev`)

1. **`ProvenanceChip` component** on dashboard money tiles and the loan-detail balance.
2. **Basis values:** `live` / `baseline` / `declared` / `none` / `unknown` — with `unknown` rendering NOTHING (TA-C applied to the chip itself: the chip never guesses; an unprovable basis is not dressed as a known one).
3. **Per-loan provenance** derived from ledger entries in the computation engine; **portfolio `dataBasis`** on the metrics response (Zod schema extended).
4. **Adversarial review pre-merge (8 angles):** 2 CONFIRMED disclosure defects fixed before merge — loan-detail dated form ("as at baseline YYYY-MM", not undated), per-figure subset basis (a figure aggregating mixed-basis inputs discloses the subset, commit `660563e`).
5. **Verification:** 16 new tests + 158 server + 380 client regression + 56 dashboard integration tests; typecheck clean both apps.

## Acceptance Criteria (as shipped)

1. **Given** any dashboard money tile or the loan-detail balance, **When** rendered, **Then** a ProvenanceChip states the figure's basis. ✅
2. **Given** a baseline-basis figure, **When** the chip renders, **Then** it carries the dated form ("as at baseline YYYY-MM"). ✅ (adversarial-review fix 1)
3. **Given** a figure aggregating mixed-basis inputs, **When** the chip renders, **Then** the subset basis is disclosed per-figure. ✅ (adversarial-review fix 2)
4. **Given** an `unknown` basis, **When** the chip would render, **Then** nothing renders — imputed never wears observed's clothes (TA-C / Agreement 29). ✅
5. **Given** 17f.1 lands later, **When** entries post live, **Then** the same chip flips to `live` with no redesign — the basis is computed, not hard-coded. (Forward property, engine-derived basis makes it hold by construction.)

## Sequencing

- **Shipped pre-17f.1** by design (the stopgap IS the story). Epic 21 absorbs the chip as a component story at UX/IA build.
- **Extends forward (concept-lineage, folded A5 §3.4 2026-07-09):** the evidence-graded finding model extends 17f.2's shipped provenance primitive (`BalanceProvenance` / `deriveProvenance` / `dataBasis`) from **balances** to **reconciliation findings** — the grade enum gains finding-level values `proven` / `projected` / `rewound` plus a `resolver` field (FR117). This is lineage only: 17f.2 stays a shipped, done story; the extension BUILDS under the Species A/B/C worklist stories (A5 §4.1), reusing the shipped primitive — not a reopen of the chip.

---
## Provenance (Step-5 fold, 2026-07-06)
Consolidated per scp-consolidation-ledger.md §A. From this FOLDED moment this file is the
single truth for Story 17f.2; the addenda are journal history (Agreement 30). Corrections
reopen; additions queue to A5+ as new ledger fold rows.

| # | Source | Contribution |
|---|---|---|
| 1 | A3 §3 — 17f.2 (`scp-addendum-3-2026-07-04.md`) | Story creation: disclosure chip as stopgap [H1]; D-a timing decision |
| 2 | PO decision D-a (2026-07-04) + ledger §F step-4 shipped record | Ship-and-tell authorisation; shipped scope, commits `1826c6d`+`660563e`, adversarial-review record, test counts |
| 3 | A5 §3.4 (`scp-addendum-5-2026-07-09-DRAFT.md`), folded 2026-07-09 | P1 concept-lineage: evidence-graded findings extend the shipped provenance primitive (`proven`/`projected`/`rewound` + `resolver`, FR117) from balances to findings — **build lands in the A5 §4.1 worklist stories, NOT here**; 17f.2 status stays `done` |

Evidence keys carried: H1, P1 (+ TA-C / Agreement 29; Fable critique §7.3 primitive #2)
Collision resolution: none
Engine status: SHIPPED app-side 2026-07-05 (uncommitted→committed on `dev`; PO commit call recorded)
Pending amendments: none — A5 §3.4 folded 2026-07-09 as concept-lineage (build in worklist stories); additions queue to A6
