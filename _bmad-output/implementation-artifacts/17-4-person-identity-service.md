# Story 17.4: PersonIdentityService (PIS)

Status: backlog — consolidated at Step-5 fold 2026-07-06

## Story

As the **system's identity layer and every consumer of person resolution**,
I want a PersonIdentityService with SEARCH + MATCH split APIs, canonicalize-first matching, explicit cross-MDA verdicts, and a namesake guard,
So that the same beneficiary appearing across months, MDAs, and name spellings resolves to one stable identity — and namesakes never merge.

**Origin:** SCP 2026-04-15 §4.1 + round-3 amendment (SEARCH/MATCH split) (base). Amended ×3: Addendum 1 §3 (2026-04-18) → Addendum 2 §2.4 (published 2026-07-06) → Addendum 4 §3.2 (published 2026-07-06). Ledger row X-8.

**Priority:** 17a critical path (17.2 → 17.3b → **17.4** → 17.4d). Story size L → XL per A2 (Winston to confirm perf budget at pilot scale).

**Sub-epic:** [17a] · **Sprint:** 2

## Scope (folded)

**Base (SCP §4.1, round 3):** SEARCH + MATCH split APIs. Fuzzy-Jaccard comparator with per-token Levenshtein ≤2 for token equivalence (primary gate); Jaro-Winkler tiebreaker. Bands: Jaccard<0.5 = NOT_MATCH; Lev=0 HIGH auto-link; Lev=1 HIGH_WITH_TYPO_FLAG; Lev=2–4 MEDIUM review; Lev≥5 NOT_MATCH. Namesake frequency guard on top. Confidence evidence persisted. ADELEKE fixture signed off (Awwal, 2026-04-15) at `tests/fixtures/identity-continuity/adeleke-namesake/expected.json`.

**+ A1 §3 — cross-MDA verdicts + calibration:**
1. Five cross-MDA verdicts enumerated explicitly (table below).
2. Bidirectional signature continuity test: for signatures in MDAs A and B, test both A→B and B→A; tie-break by `firstPeriod` (earlier = source) or `recordCount` (more = source) when verdicts differ.
3. Namesake frequency lookup against a materialized `name_frequency` table refreshed on every ingest; starting bound **N≥3** using catalog+register union as the frequency source; revisit post-pilot.

| Verdict | Trigger | Routing |
|---|---|---|
| `LOAN_CONTINUATION_CONSISTENT` | Predicted outstanding at destination matches declared within ±5%; gap ≥ 0 months; principal stable | File backdated Transfer Handshake |
| `LOAN_CONTINUATION_VARIANT` | Predicted ≠ declared beyond tolerance; gap ≥ 0 months; not fresh principal | Review Queue — manual arithmetic audit |
| `FRESH_PRINCIPAL` | Destination principal > predicted × 2; gap ≥ 0 months | File completion event for source loan; destination = new loan |
| `OVERLAPPING_MDA_PRESENCE` | Source `lastPeriod` > destination `firstPeriod` (signatures overlap in time) | Namesake check + MDA hierarchy review → 17.5 overlap-specific workflow |
| `AMBIGUOUS` | Source or destination outstanding unavailable | Review Queue — escalate for MDA redeclaration or employment-event attestation |

**+ A2 §2.4 — canonicalizer-first, pessimistic pilot scope:**
4. `yoruba-name-normalize` (17.4b) is a HARD dependency, not optional. Match order: `canonicalize() → exact-match` FIRST, `canonicalize() → Lev≤2` SECOND. **No raw Levenshtein.**
5. Golden fixtures (Alatise, Lamidi, ADELEKE, CDU) are hard regression gates.
6. Pessimistic framing: name-only matching is the 76% case (39 of 51 MDAs without roster); OYSG-anchored matching is the 24% case. **17a scope = BIR only** (canonicalizer validated on 248 BIR rows; larger MDAs untested).
7. Canonicalizer performance observability + caching hook built in.

**+ A4 §3.2 — the namesake guard and explicit lookups [L18, L10]:**
8. **Namesake guard by principal agreement** (L18): collapse mechanisms (token-sort + diminutives) are paired with separation mechanisms — principal agreement within tolerance keeps a merge; distinct principals split into per-principal buckets (the AMOSUN B.K/K.B canary). Explicit policy for **same person, sequential loans**: two loans = two rows, not a namesake.
9. **Explicit-lookup principle** (L10): for low-cardinality high-stakes domains (months, MDA names), explicit typo maps beat fuzzy matching (the `'NEW'→NOV` false positive). PIS carries a known-variants table alongside its algorithm; typo maps are editable JSON (implementation home: 17.2's map infrastructure).

**Collision home (ledger §B) — X-8:** L18 sequential-loans and A3's H21 LOAN_CYCLE are the same phenomenon. The shared zero-reset segmentation utility (A3 §4.4 — built in 17.2) and the 17.8 sequential-vs-concurrent schema question serve both. **Single design; 17.4 consumes the segmentation utility, it does not build it.**

## Acceptance Criteria

1. **Given** the SEARCH and MATCH APIs, **When** invoked, **Then** matching runs `canonicalize() → exact` first, `canonicalize() → Lev≤2` second, with no raw-Levenshtein path anywhere. [A2]
2. **Given** the similarity bands, **When** scores compute, **Then** routing follows: Jaccard<0.5 NOT_MATCH · Lev=0 HIGH auto-link · Lev=1 HIGH_WITH_TYPO_FLAG · Lev=2–4 MEDIUM review · Lev≥5 NOT_MATCH — with confidence evidence persisted per decision. [Base]
3. **Given** a person with signatures in two MDAs, **When** cross-MDA analysis runs, **Then** exactly one of the five enumerated verdicts is produced and routed per the verdict table. [A1]
4. **Given** signatures in MDAs A and B, **When** verdicts differ by direction, **Then** the bidirectional test tie-breaks by `firstPeriod`, then `recordCount`. [A1]
5. **Given** a name appearing ≥N times (N=3 at start, catalog+register union), **When** any auto-link would fire, **Then** the namesake frequency guard demotes it to review; the `name_frequency` table refreshes on every ingest. [A1]
6. **Given** two candidate records with agreeing principals within tolerance, **When** the namesake guard evaluates, **Then** the merge stands; **Given** distinct principals, **Then** records split into per-principal buckets (AMOSUN B.K/K.B canary as fixture). [A4, L18]
7. **Given** the same person with a completed loan cycle followed by a fresh one, **When** identity resolves, **Then** the result is one person, two loan rows — sequential loans are never classified as namesakes; cycle boundaries come from the shared segmentation utility (X-8). [A4, L18]
8. **Given** the known-variants table, **When** ops edits the JSON, **Then** the change applies without deploy; explicit map hits outrank fuzzy scores in their domains. [A4, L10]
9. **Given** the golden fixtures (Alatise, Lamidi, ADELEKE, CDU), **When** any rule changes, **Then** all fixtures pass or the change is blocked. [A2, Agreement 24]
10. **Given** pilot-scale operation, **When** PIS runs, **Then** per-call canonicalizer latency and rule-trace metrics are observable and a caching hook is available; scope is BIR only for 17a. [A2]

## Sequencing

- **Blocked by:** 17.4b (hard dependency), 17.3b (identity anchors), 17.2 (utilities + segmentation).
- **Blocks:** 17.4d (namesake modal), 17.obs (observability), 17.5 (verdict routing).

---
## Provenance (Step-5 fold, 2026-07-06)
Consolidated per scp-consolidation-ledger.md §A. From this FOLDED moment this file is the
single truth for Story 17.4; the addenda are journal history (Agreement 30). Corrections
reopen; additions queue to A5+ as new ledger fold rows.

| # | Source | Contribution |
|---|---|---|
| 1 | Base — SCP 2026-04-15 §4.1 + round 3 | SEARCH/MATCH split; Fuzzy-Jaccard + Lev bands; namesake guard concept; ADELEKE fixture |
| 2 | A1 §3 (`scp-2026-04-15-addendum-1.md`) | 5 cross-MDA verdicts enumerated; bidirectional continuity test; N≥3 namesake bound, catalog+register union |
| 3 | A2 §2.4 (`scp-2026-04-15-addendum-2.md`) | Canonicalizer hard dep; canonical-exact before Lev; BIR-only pilot; pessimistic 76% name-only framing; perf observability |
| 4 | A4 §3.2 items 3–4 (`scp-addendum-4-2026-07-04.md`) | L18 namesake guard by principal agreement + sequential-loans policy; L10 known-variants table |

Evidence keys carried: L10, L18 (+ H21 via X-8 consumption)
Collision resolution: X-8 (sequential-loans ≡ LOAN_CYCLE; shared segmentation utility built in 17.2, consumed here; single design)
Engine status (per ledger §A): YES — namesake guard, variant maps landed engine-side
Pending amendments: none — additions queue to A5+
