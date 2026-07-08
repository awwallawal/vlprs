---
title: Sprint Change Proposal — Addendum 4 to SCP 2026-04-15 (PUBLISHED)
subtitle: AG 2024-2025 Report Cycle Lessons — routing the 20-lesson field register (L1–L20) into FR deltas, story amendments, new stories, and CI policy
date_drafted: 2026-07-04
author: PM John (drafted) — for Awwal Lawal (Product Owner) review and Deputy AG authorisation
parent_scp: sprint-change-proposal-2026-04-15.md (approved 2026-04-15, Round 5)
parent_addenda:
  - scp-2026-04-15-addendum-1.md (published 2026-04-18)
  - scp-2026-04-15-addendum-2.md (published 2026-07-06; formerly scp-addendum-2-2026-04-20-DRAFT.md)
  - scp-addendum-3-2026-07-04.md (published 2026-07-06; ledger-reframe package, H1–H26)
scope_classification: MODERATE — no new epics, no sequencing changes; 3 new FRs, 2 new stories, ~14 story amendments (mostly ingest/identity hardening), 1 CI policy
status: PUBLISHED 2026-07-06 — authorised by Deputy AG signature on the two-line pack, 2026-07-05 (Line 2; ledger §F SIGNATURE RECORD). Formerly scp-addendum-4-2026-07-04-DRAFT.md. Journal entry — corrections are new entries, never edits.
single_input: _bmad-output/implementation-artifacts/ag-2024-2025-session-lessons-2026-05-04.md (v2, 20 lessons, re-keyed to Addendum 4 on 2026-07-04)
naming_note: originally earmarked "Addendum 3" (2026-05-07); re-keyed to Addendum 4 after the ledger-reframe package took that number. Root cause + fix = allocation registry, scp-consolidation-ledger.md §C / proposed Agreement 30.
evidence_chain:
  lessons_doc: _bmad-output/implementation-artifacts/ag-2024-2025-session-lessons-2026-05-04.md (incl. Implementation Evidence Appendix — every patch cited landed ENGINE-SIDE in scripts/legacy-report/)
  investigation_log: _bmad-output/implementation-artifacts/ag-2024-2025-investigation-log-2026-05-06.md
  defect_catalogue: docs/Car_Loan/analysis/reports/AUDIT-FINDINGS-2026-05-04.md
  name_merge_audit: docs/Car_Loan/analysis/reports/name-merge-audit-2026-05-07.json (45 merges / 18 MDAs)
  canaries: SPORTS COUNCIL tier (L6) · AWODELE EUNICE ADEOLA (L13) · AWOFOLAJU TOPE/TEMITOPE (L14) · AMOSUN B.K/K.B (L18) · FINANCE year-aggregate (L19) · LGA/AGRIC stale markers (L12) · BIR Sheet1/2/3 ghost rows (L15)
routing_rule: every item cites its L## (the lessons register is this Addendum's foreign key, exactly as H## is Addendum 3's). An item with no L## does not enter this Addendum.
---

# Sprint Change Proposal — Addendum 4 to SCP 2026-04-15 (PUBLISHED)

## AG 2024-2025 Report Cycle Lessons — field-validated ingest and identity hardening

- **Date drafted:** 2026-07-04 (source lessons finalised 2026-05-07; formalisation deferred by the naming collision, now resolved) · **Published:** 2026-07-06
- **Author:** PM John — for Awwal Lawal (PO) review and Deputy AG authorisation
- **Status:** **PUBLISHED — AUTHORISED.** Deputy AG signed the two-line pack 2026-07-05; Line 2 covers this Addendum in full (ledger §F SIGNATURE RECORD). Takes effect through the §I runbook: change-list applied at step 2 (this publication); story texts consolidate at the Step-5 fold.

---

## Section 0 — Executive summary

The AG 2024-2025 report cycle (2026-05-04 → 2026-05-08) ran the side-quest engine across the full portfolio (465 files, 46 MDAs, 101k records) to produce the AG's Excel/CSV report — and in doing so field-tested, at industrial scale, exactly the ingest and identity machinery Epic 17 plans to build. Twenty lessons were captured (L1–L20), each with a named canary case and, per the lessons doc's Implementation Evidence Appendix, **a concrete patch already landed and validated on the engine side**. None of those patches exists app-side.

**What this Addendum does:** routes L1–L20 into the app's planning artifacts — 3 new FRs, 2 new stories, ~14 story amendments, 1 CI policy — so the field-validated fixes become specification rather than side-quest folklore. Where Addendum 4 items collide or converge with Addenda 1–3, the resolution is stated inline (§6) and cross-recorded in the Consolidation Ledger; **no lesson is routed twice**.

**Character of this Addendum:** unlike Addendum 3 (structural repairs, new sub-epic, sequencing rule), Addendum 4 is **hardening** — it changes no sequencing, creates no epics, and mostly thickens the acceptance criteria of stories that already exist. Its evidence is unusually strong: every claim has a reproducible canary and a shipped engine-side patch (`already-landed-in-engine = YES` throughout the ledger).

---

## Section 1 — SPEC → FR deltas (into the same PRD Delta Addendum as Addendum 3 §2; numbers allocated per the registry)

| # | New FR (allocated) | Content | L## | PRD anchor |
|---|---|---|---|---|
| 1.1 | **FR108 — AG-facing reports in Excel/CSV as well as PDF** | AG reports ship both branded PDF (FR41-style) and Excel/CSV export: portfolio coverage map, per-MDA-per-year sheets per the AG schema, consistency-violations sheet, cover letter, audit attestation. Awwal accepted Excel/CSV as the canonical AG delivery format 2026-05-07. Amends the PDF-only stance of FR41/FR53/FR54; extends 17.32 (CSV as primary auditor export). | **L8** | FR41/FR53/FR54; 17.32 |
| 1.2 | **FR109 — LPC Out as a first-class field** | MDA submission templates capture an optional "LPC Out" (Last Pay Check Out) column. **When present, the native LPC Out date is authoritative** (Agreement 22); when absent, the system infers from cross-MDA timeline analysis **with a confidence flag** (imputed never wears the clothes of observed — TA-C/Agreement 29). Amends FR61 (Transfer Lifecycle: LPC Out as a filed field) and FR101 (MDA Beneficiary Ledger: LPC Out column). | **L1** | FR61, FR101 |
| 1.3 | **FR110 — Content-integrity observations at ingest** | Upload validation compares what the file *says it is* against what its *content shows*, emitting non-punitive observations rather than silent processing: `MULTI_MONTH_FILE_HANDLING` (multi-month/mid-sheet files confirmed by the officer, L4/L11), `STALE_TEMPLATE_MARKER` (copy-paste period artifacts, L12), `FILENAME_YEAR_MISMATCH` (filename year vs body markers, L16), `PARSER_NOISE` (secondary-table ghost rows, L15), and a declared submission format (monthly vs **year-aggregate**, a valid pattern — L19). | **L4, L11, L12, L15, L16, L19** | FR16–24 band; anchors the 17.13 amendment (§3.1) |

---

## Section 2 — New stories

### Story 15.7 — Filename hygiene validation at submit time [L5] (NEW — extension of 15.0f, which is DONE and cannot be amended)

When an MDA officer drops a file, validate the filename against the MDA's expected pattern **before** upload and warn on mismatch (lowercase prefixes, year-prefixing, typo'd domain words — `VEHINCLE`, `HIGHCOURT` — all field-observed classes that drove RESOLVER_MISS 94→32 engine-side). Adds a `FILENAME_RESOLVER_CONFIDENCE` flag to the upload record (low confidence triggers officer confirmation) and a "filename pattern guide" panel to the MDA officer dashboard (15.0e surface). Non-punitive framing: the guide helps the officer; the warning is a question, not a fault.
*Story ID allocated via the registry; 15.7 proposed (Epic 15's next free slot).*

### Story 17.13b — Template fingerprint & drift detection [L2] (NEW)

The engine learns each MDA's typical template shape (column set, ordering, header idioms) as a **fingerprint**; subsequent uploads validate against it. Drift (new column, renamed column, reordered layout) is flagged for review rather than silently dropped — converting the L2 defect classes (24 of 41 MDAs had ≥1 column-mapper defect; typos, multi-row headers, currency suffixes, word-order swaps) from recurring surprises into surfaced observations. Every defect class in the L2 catalogue becomes a regression fixture. Companion to 17.13 (which validates a single upload's content) — the fingerprint validates *against history*.

---

## Section 3 — PLAN → Story amendments (each cites its L##; fold-order vs prior addenda recorded in the Consolidation Ledger)

### 3.1 Amend Story 17.13 — Upload pipeline integration & content validation [L4, L11, L12, L15, L16, L19, L20] — the consolidated ingest amendment

1. **Multi-month & mid-sheet detection** (L4, L11): detect multi-month range filenames and mid-sheet period stacking at ingest (the engine's `findPeriodMarkers`/`getPeriodForRow` pattern, field-validated on 656 sheets); officer confirms row-shape; `MULTI_MONTH_FILE_HANDLING` observation emitted.
2. **Stale-marker defence** (L12): two-layer rule ported from the engine — spatial filter (period section-headers live in cols A–AA; far-right markers are template artifacts) + authority rule (an unambiguous sheet-name period outranks body markers; mid-sheet logic fires only on generic sheet names). At ingest, a stale marker prompts: *"your sheet header at row N still says X but the sheet name says Y — please confirm."*
3. **Filename-vs-content sanity** (L16): compare filename year against body markers; `FILENAME_YEAR_MISMATCH` observation on disagreement; body markers win when consistent. **Collision resolution (Ledger row X-3): this is the same defect class as Addendum 2 §2.4's 17.3b content-vs-filename fix (the OYSIPA mis-route). One implementation in the shared 17.2 utilities; 17.3b and 17.13 both consume it; dual citation, single build.**
4. **Secondary-table ghost rows** (L15): detect the secondary-table pattern (rows with one populated financial column where the sheet's rows have many) and tag `PARSER_NOISE` rather than ingesting as full records.
5. **Year-aggregate submissions are valid** (L19): officer declares "monthly" vs "year-end aggregate" at upload; the system ingests accordingly (FINANCE-class submissions carry the AG schema natively and are *better* than monthly for year-end purposes — the current monthly assumption mis-tiered exactly the MDA that submitted most completely).
6. **Archive-retired markers content-hash verified** (L20): any "retired/do-not-use" source designation is backed by a content-hash manifest at marking time, re-runnable as an audit (the qa_qa lesson: "retired" read as "uningested" and cost an investigation).

### 3.2 Amend Stories 17.4b (canonicalizer) and 17.4 (PIS) — Yoruba identity variants and the namesake guard [L10, L13, L14, L18]

**Routed to 17.4b (the canonicalizer — 17a story):**
1. **Token-sort canonicalization** (L13): name-order swaps (`AWODELE ADEOLA EUNICE` ↔ `AWODELE EUNICE ADEOLA`) are first-class variance; order-independent matching is baseline.
2. **Yoruba diminutive map** (L14): ~30 engineer-curated pairs (`TEMITOPE↔TOPE`, `OLUWASEGUN↔SEGUN`, `BABATUNDE↔TUNDE`, …) as an **explicit alias map alongside the 9-rule canonicalizer** — the canonicalizer handles spelling variance; the diminutive map handles social-naming variance; both are required. Externalised as ops-editable JSON (no deploy to add a pair). **Collision resolution (Ledger row X-2): the pending native-speaker review (17a Go gate G5) is re-scoped to cover the diminutive map as well as the 9 rules — one review, both rule sets.**

**Routed to 17.4 (PIS):**
3. **Namesake guard by principal agreement** (L18): the reverse valve of the canonicalizer — collapse mechanisms (token-sort + diminutives) must be paired with separation mechanisms (principal agreement within tolerance keeps a merge; distinct principals split into per-principal buckets; the AMOSUN B.K/K.B canary). Explicit policy for **same person, sequential loans** (two loans = two rows, not a namesake). **Convergence note (Ledger row X-8): sequential-loans is the same phenomenon as Addendum 3's H21 LOAN_CYCLE — the shared zero-reset segmentation utility (A3 §4.4) and the 17.8 sequential-vs-concurrent schema question serve both; single design, dual citation.**
4. **Explicit-lookup principle** (L10): for low-cardinality high-stakes domains (months, MDA names), explicit typo maps beat fuzzy matching (the `'NEW'→NOV` false positive). PIS carries a known-variants table alongside its algorithm; typo maps are editable JSON (17.2).

> **17a-envelope note:** items 1–2 touch 17a stories. They are **design input within the authorised envelope** — the canonicalizer story already carries the native-speaker-review gate and an extensible rule set; extending its variant coverage before pilot activation is the gate working as designed, exactly parallel to Addendum 3's W2 treatment of the schema story. Anything Winston or the PO judges to exceed the envelope moves to the Line-2 request instead — flag, don't absorb.

### 3.3 Amend Story 17.16 — Property tests → full-corpus invariants as CI regression gates [L2, L6, L7, L20]

1. The six full-corpus audit scripts (template-audit, file-coverage-audit, cross-MDA, coverage-verify, mid-sheet diagnostic, name-merge audit — each ≤60s) become CI invariants: **defect counts must not increase across commits**; they run on any commit touching parser/resolver utilities or adding an MDA template.
2. Any change to column-map / period-extract / mda-resolve produces a **BEFORE → AFTER delta report**; the reviewer cannot merge without acknowledging the delta (L6: two of Awwal's single questions each caught a portfolio-scale regression — the delta report institutionalises that question).
3. Content-hash archive invariant (L20): every retired-archive file matches a drop-zone twin by hash.
4. **Convergence note (Ledger row X-5): Addendum 3's golden harness (`overdeduction-regression-2026-07.ts`, contract §10.2#3 "the harness is the treaty") and these corpus invariants are one CI policy with two instrument families — detection fixtures (harness) + corpus invariants (audit scripts). 17.16 owns both; one gate, not two.**
5. Fixture set extends with: multi-month + mid-sheet files (L4/L11), the L2 defect-class catalogue, stale-marker canaries (L12), year-aggregate FINANCE sheets (L19).

### 3.4 Amend Story 17.17 — Dual-truth dashboard [L3, L6, L19] — additive to the A1 and A3 amendments (fold-order in the Ledger)

1. **PARSER_BLIND fourth state: already landed via Addendum 3 §4.3 (H10) — NOT re-routed here** (dual-route guard, Ledger row X-4). What A4 adds is the lesson's original evidence base (FINANCE's native columns unread; "missing data" → "unrecognized data"; blank-cell three-way disambiguation: not-submitted / not-computable / submitted-but-unread).
2. **Year-aggregate tier indicator** (L19): tier classification becomes format-aware — an MDA submitting a complete year-end aggregate is not "1-month coverage."
3. **Three-click drill-down invariant** (L6): every dashboard figure drills to contributing MDAs → source files → records (Agreement 11 made an AC).

### 3.5 Amend Story 17.18 — Variance badge [L3]

Fourth badge state for PARSER_BLIND (the half of L3 that H10/A3 did not cover — A3 amended 17.17 only). Amber/grey, non-punitive, consistent with the existing three.

### 3.6 Amend Story 17.5 — Person link candidates & transfer handshake [L1, L9]

1. **Native LPC Out consumption** (L1): when an MDA submits LPC Out natively, the engine reads it as the authoritative transfer-out marker rather than inferring from cross-MDA timelines (FR109). LPC Out + non-zero outstanding = transfer-with-debt = handshake required, not Path 3 (feeds 17.22).
2. **PARENT_CHILD_OVERLAP bypass** (L9): AGRICULTURE↔CDU-class same-period appearances resolve to the parent/child verdict, never auto-treated as transfer or duplicate-deduction. **Convergence note (Ledger row X-9): Addendum 1 already added the OVERLAPPING_MDA_PRESENCE distinct workflow to 17.5 — L9 confirms it from field data and adds the parent/child sub-case; same valve, one implementation.**

### 3.7 Amend Story 17.11 — Missing-record detection [L1]

After a native LPC Out + 2 grace months, the missing-record detector does **not** fire for that MDA (the person is expected to be gone) — suppression reason recorded, so silence is explained rather than mysterious.

### 3.8 Amend Story 17.22 — Settlement Pathway 3 [L1]

LPC Out with non-zero outstanding routes to transfer handshake, not Path 3 — the boundary rule between "left this MDA" and "settled the loan" made explicit.

### 3.9 Amend Story 17.12 — Person Reconciliation Pass [L4, L17]

1. Idempotence explicitly tested across multi-month file orderings (L4).
2. **Completeness tie-break** (L17): when multiple records exist for the same (person, period), the more-complete record is canonical — latest-at-each-completeness-tier, not latest-wins (the ghost-row lesson: a sparse later record must not override a complete earlier one).

### 3.10 Amend Story 17.15 — Monthly snapshots [L6, L17]

Snapshot row-picker uses the completeness tie-break (L17); historical-figure drift across engine fixes is preserved and surfaced as a quality signal, not silently rewritten (L6).

### 3.11 Amend Story 17.10 — Most Likely Explanation engine [L12, L18]

Two new narratives: STALE_TEMPLATE_MARKER ("the sheet header was copied from a prior month — likely template artifact, not a data event") and sequential-loans ("same staff, two loan instances — a new loan, not a namesake or an error").

### 3.12 Amend Story 17.2 — Utility port [L2, L10, L11, L15]

The port explicitly includes: the full L2 alias catalogue (each defect a regression fixture), `findPeriodMarkers` + period-block splitting (L11), the completeness tie-break record-picker (L15/L17 pattern), and editable-JSON typo/variant maps (L10). Additive to the A1/A2/A3 amendments of 17.2 — fold-order in the Ledger.

### 3.13 Amend Story 17.7 — Unified loan detail page [L1, L3]

Identity tab displays LPC Out alongside MDA-level history (L1); Activity Log surfaces "MDA submitted column X with value Y; engine did not extract it" entries (L3's per-record disclosure).

### 3.14 Amend Story 17.32 — External auditor role [L8]

CSV export as a primary format (FR108), not a PDF afterthought.

---

## Section 4 — Authorisation position

Everything in this Addendum sits behind **Line 2 of the consolidated signature pack** except as noted in §3.2 — where the two canonicalizer items ride the already-authorised 17a envelope as design input under the existing G5 gate, on the same logic as Addendum 3's W2 schema amendment. Nothing here alters the W1-before-17b sequencing rule (A3 §6); no A4 item lands in a 17b retrofit story. Sub-epic placement of the amended core-Epic-17 stories (17.13, 17.16, 17.12, …) is a Consolidation Ledger task, resolved at the post-signature fold.

## Section 5 — Already-landed-in-engine register (summary)

Every lesson's engine-side patch is live in `scripts/legacy-report/` (Implementation Evidence Appendix of the lessons doc has the file-level table). **This Addendum requests the app-side counterparts only.** The engine implementations serve as executable reference specifications for the app stories — Amelia builds from a working model, not prose. Per the side-quest convention, none of it is committed; the lessons doc's appendix is the durable record.

## Section 6 — Collision & convergence register (the seven + two, resolved here, cross-recorded in the Consolidation Ledger)

| # | Between | Resolution |
|---|---|---|
| X-1 | 17.2 quadruple-stack (A1 + A2 + A3 + A4 §3.12) | Compatible; fold in chronological order; consolidated story text at post-signature fold |
| X-2 | L14 diminutive map ↔ 17a G5 native-speaker review | Map routed to 17.4b; G5 re-scoped to cover both rule sets; one review |
| X-3 | L16 filename-vs-content ↔ A2 §2.4 (17.3b OYSIPA fix) | One implementation in 17.2 shared utilities; 17.3b + 17.13 both consume; dual citation |
| X-4 | L3 PARSER_BLIND ↔ A3 H10 (17.17) | Landed via A3; A4 carries only the residual (17.18 badge, 17.7 activity log) — dual-route guard |
| X-5 | L6/L7 corpus invariants ↔ A3 harness-as-treaty | One CI policy in 17.16, two instrument families |
| X-6 | L5 ↔ 15.0f (done) | New story 15.7 — done stories are never amended |
| X-7 | FR numbering ↔ A3's FR103–107 | Registry allocates A4 = FR108–110 |
| X-8 | L18 sequential-loans ↔ A3 H21 LOAN_CYCLE | Convergent: shared segmentation utility + 17.8 schema question serve both; single design |
| X-9 | L9 parent/child ↔ A1's 17.5 OVERLAPPING_MDA_PRESENCE workflow | Convergent: field confirmation + parent/child sub-case; same valve, one implementation |

---

*End of DRAFT. This Addendum edits no frozen artifact and applies no epics.md / sprint-status.yaml changes — the consolidated change-list lives in the Consolidation Ledger and is applied only at the post-signature fold (playbook Step 5). Second-read: routed to the SQ-1 agent (via Awwal) together with the Ledger, per the agreed adversarial-reader assignment.*
