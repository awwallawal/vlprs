# Story 17.4b: Yoruba/Nigerian Name Canonicalizer (utility)

Status: backlog — consolidated at Step-5 fold 2026-07-06

## Story

As the **PIS service and every downstream identity consumer**,
I want a pure-function canonicalizer that collapses pronunciation variants of the same name to an identical canonical form — paired with a token-sort rule and an ops-editable diminutive map,
So that PIS match runs `canonicalize → exact` before Levenshtein and avoids the "widen Lev to catch variants, accidentally merge namesakes" trap.

**Origin:** CREATED by Addendum 2 §2.5.1 (published 2026-07-06) — that section is this story's base. Amended by Addendum 4 §3.2 items 1–2 (published 2026-07-06). Ledger row X-2.

**Priority:** [17a] Sprint 1, parallel with 17.2. Blocks 17.4 (PIS). Effort: Small–Medium (utility exists in `scripts/legacy-report/utils/yoruba-name-normalize.ts`; port + shared-package wrap + review gate).

## Scope (folded)

**Base (A2 §2.5.1):** pure-function canonicalizer; the 9-rule set (title strip, punctuation normalise, diacritic strip, OLUWA→OLU / ADEWA→ADE / OLAWA→OLA prefix contraction, silent-H in SH[AEIOU] / PH[AEIOU], silent-H between vowels, EE/IE/EI→E cluster collapse, NM→M nasal collapse, double-consonant collapse, terminal-U after consonant); `canonicalizeWithTrace` API; `NATIVE_SPEAKER_REVIEW_PENDING` gate annotation (G5); latency observability + caching hook.

**+ A4 §3.2 items 1–2 — variant coverage [L13, L14]:**
1. **Token-sort canonicalization** (L13): name-order swaps (`AWODELE ADEOLA EUNICE` ↔ `AWODELE EUNICE ADEOLA`) are first-class variance; order-independent matching is baseline.
2. **Yoruba diminutive map** (L14): ~30 engineer-curated pairs (`TEMITOPE↔TOPE`, `OLUWASEGUN↔SEGUN`, `BABATUNDE↔TUNDE`, …) as an explicit alias map ALONGSIDE the 9-rule canonicalizer — the canonicalizer handles spelling variance; the diminutive map handles social-naming variance; both are required. Externalised as ops-editable JSON (no deploy to add a pair).

**+ W2-approved design (rule/data layer split):** the approved 17a schema design (`architect-winston-17a-schema-2026-07-04-W2-AMENDED.md`) splits the rule layer (code) from the data layer (variant/diminutive maps) with **version-stamping on the map data**, so every identity decision records which map version informed it.

**Collision home (ledger §B) — X-2:** the pending native-speaker review (17a Go gate **G5**) is re-scoped to cover the diminutive map as well as the 9 rules — **one review, both rule sets**. Ledger §E Line-1 staging option if reviewer availability binds: review the 9 rules for pilot activation; diminutive map as a fast-follow inside the same G5 process.

**17a-envelope note (A4 §3.2):** extending variant coverage before pilot activation is the G5 gate working as designed — design input within the authorised envelope, exactly parallel to A3's W2 treatment of the schema story.

## Acceptance Criteria

1. **Given** any of the 35 hard-coded merge/distinct pairs in the session's test harness, **When** the canonicalizer runs, **Then** all 35 pass (ALATISE=ALATISHE, OLUWASEGUN=OLUSEGUN, ADEWUMI=ADEWUNMI, SALAHUDEEN=SALAUDEN, FOLASADE=FOLASHADE merge; namesakes stay distinct). [A2]
2. **Given** the 9-rule set, **When** applied to the 248 BIR roster names, **Then** 189 canonical-exact matches surface (matches the validated test report). [A2]
3. **Given** a `canonicalizeWithTrace(name)` call, **When** it returns, **Then** the result carries the input, each rule applied with before/after, and the final output — for auditor "why did we merge these?" drill-down. [A2]
4. **Given** two names that are token-order permutations of each other, **When** canonicalized, **Then** they resolve to the same canonical form (order-independent matching). [A4, L13]
5. **Given** the diminutive map (~30 pairs, ops-editable JSON), **When** a mapped pair is compared, **Then** it resolves as a variant match distinct from rule-driven collapse; adding a pair requires no deploy. [A4, L14]
6. **Given** the W2-approved rule/data split, **When** any identity decision consumes the map, **Then** the map version is stamped on the decision record. [W2-AMENDED design]
7. **Given** the native-speaker review (G5) has not yet concluded, **When** this story passes, **Then** `NATIVE_SPEAKER_REVIEW_PENDING` remains attached to BOTH rule sets (9 rules + diminutive map) until the review concludes — gate, not nicety. Staging option: rules reviewed for activation, map as fast-follow within the same G5 process. [A2 + X-2 + ledger §E]
8. **Given** pilot-scale hot paths, **When** observability is configured, **Then** per-call latency + rule-trace cardinality are emitted to metrics and a caching hook is available. [A2]

## Sequencing

- **Dependencies:** none (pure-function utility; source exists in SQ-1).
- **Blocks:** 17.4 (PIS) — hard dependency per A2 §2.4.
- **Regression gate:** Alatise / Lamidi / ADELEKE / CDU golden fixtures (Agreement 24).

---
## Provenance (Step-5 fold, 2026-07-06)
Consolidated per scp-consolidation-ledger.md §A. From this FOLDED moment this file is the
single truth for Story 17.4b; the addenda are journal history (Agreement 30). Corrections
reopen; additions queue to A5+ as new ledger fold rows.

| # | Source | Contribution |
|---|---|---|
| 1 | Base — A2 §2.5.1 (`scp-2026-04-15-addendum-2.md`) | Story creation: 9 rules, trace API, G5 gate, observability |
| 2 | A4 §3.2 items 1–2 (`scp-addendum-4-2026-07-04.md`) | L13 token-sort; L14 diminutive map ~30 pairs, ops-editable JSON; G5 re-scoped to both rule sets |
| 3 | W2-approved design (`architect-winston-17a-schema-2026-07-04-W2-AMENDED.md`) | Rule/data layer split + version-stamping for the variant maps |

Evidence keys carried: L13, L14 (+ G5 gate; memo §8 risk 4)
Collision resolution: X-2 (one G5 review covers both rule sets; implementation home = this story; §E staging option recorded)
Engine status (per ledger §A): YES — both rule sets landed engine-side
Pending amendments: none — additions queue to A5+
