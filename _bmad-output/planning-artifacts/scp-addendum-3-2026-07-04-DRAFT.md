---
title: Sprint Change Proposal — Addendum 3 to SCP 2026-04-15 (DRAFT)
subtitle: Ledger Reframe — routing the harmonised findings register (H1–H26) into PRD delta, foundation-repair stories, story amendments, and new epic charters
date_drafted: 2026-07-04
author: PM John (drafted) — for Awwal Lawal (Product Owner) review and Deputy AG authorisation
parent_scp: sprint-change-proposal-2026-04-15.md (approved 2026-04-15, Round 5)
parent_addenda:
  - scp-2026-04-15-addendum-1.md (published 2026-04-18)
  - scp-addendum-2-2026-04-20-DRAFT.md (PO-approved structure; Deputy AG signature pending)
scope_classification: MAJOR — new foundation-repair sub-epic (17f) sequenced before 17b; PRD delta plan (7 new FR items); 5 story amendments; 3 new epic charters; 3 team agreements
status: DRAFT — this Addendum REQUESTS Deputy AG authorisation; nothing in it authorises itself
single_input: _bmad-output/implementation-artifacts/harmonised-findings-2026-07-04.md (§1–§9 FROZEN, H1–H26; §10 two-track execution contract, binding)
evidence_chain:
  harmonised_register: _bmad-output/implementation-artifacts/harmonised-findings-2026-07-04.md
  architect_brief_w2: _bmad-output/implementation-artifacts/winston-w2-brief-2026-07-04.md
  session_log: _bmad-output/implementation-artifacts/session-log-2026-07-02-overdeduction-sweep-and-ledger-reframe.md
  independent_critique: _bmad-output/implementation-artifacts/app-foundation-critique-INDEPENDENT-fable-2026-07-03.md
  golden_harness: scripts/legacy-report/overdeduction-regression-2026-07.ts (PASS 2026-07-04, both agents independently)
  validation_set: 47-case over-deduction census (harness-locked tally, harmonised §4)
  data_memos:
    - docs/Car_Loan/analysis/reports/memo-oyshmb-data-request-2026-07-04.md
    - docs/Car_Loan/analysis/reports/memo-staff-id-intake-2026-07-04.md
routing_rule: harmonised §2 Provenance column — SPEC → PRD delta · BUILD → repair stories · PLAN → story amendments / new charters · DATA → memos (note only)
---

# Sprint Change Proposal — Addendum 3 to SCP 2026-04-15 (DRAFT)

## The Ledger Reframe — foundation repair before consumer multiplication

- **Date drafted:** 2026-07-04
- **Author:** PM John — for Awwal Lawal (PO) review and Deputy AG authorisation
- **Status:** **DRAFT — REQUESTS authorisation.** The only movements preceding signature are the two DATA memos (§7), which need no authorisation, and — subject to PO decision D-a (§10) — the W1 staleness-disclosure story.

---

## Section 0 — Executive summary

Between 2026-07-02 and 2026-07-04, two AI agents independently audited the full VLPRS repository against the ledger-reframe conceptual frame (archaeology + forward bookkeeping: *issue, post, and attest* rather than *collect freestyle and detect after the fact*). Each review was conducted blind, then adversarially cross-verified; **every disagreement was resolved by a reproducible test — zero by argument**. The result is a frozen 26-finding register (H1–H26) in `harmonised-findings-2026-07-04.md`, promoted to a golden regression harness that both agents ran independently to PASS.

**The unified verdict (harmonised §1, frozen): MODIFY / RE-CHARTER — do not rebuild, do not keep building as-is.** The app's skeleton (append-only ledger, computed-not-stored balance, scheme-formula engine, state machine, decimal money math, non-punitive vocabulary system) is sound and expensive to rebuild. The foundational gap is epistemic, with three structural expressions no planned story covers — the ledger is never fed (H1), identity repair leaves history keyed to superseded knowledge (H3), and intake declines the unknown (H4) — plus a set of missing organs (refund rails, statement issuance, borrower attestation, opening-balance closure) that Epic 17 planning partially anticipates.

**What this Addendum does** — routes every H-finding by the frozen register's Provenance column:

| Provenance | Destination | Section |
|---|---|---|
| SPEC | PRD Delta Plan — 7 items (posting FR, refund authority FR, issuance FR, attestation FR, materiality FR, two-track epistemics statement, FR91–92 numbering repair) | §2 |
| BUILD | New sub-epic **17f — Foundation Repair** (7 stories: W1 ×2, W3, engine unification, reconciliation unify+persist, conservation, For-Review worklist) | §3 |
| PLAN | 5 story amendments (17.26, 17.33, 17.17, 17.2, 17a schema) + 3 new epic charters (E-issuance, F-attestation, UX/IA) | §4–§5 |
| DATA | Two memos already drafted and moving — recorded, not redrafted | §7 |

**The one sequencing rule this Addendum makes binding (§6):** the three structural repairs **W1 (post the ledger), W2 (history-safe re-keying), W3 (quarantine intake)** land **before any Epic 17b retrofit story starts**. This is the frozen verdict's own ordering — repairing the foundation before 17b multiplies consumers on it.

**Anti-drift discipline (contract §10.2, binding):** every story, amendment, and charter below carries its H## in its header. A number or claim with no H## behind it does not enter this Addendum.

---

## Section 1 — Two-track epistemics statement (SPEC — H2, H18; carried into PRD delta §2.6)

The PRD's framing ("VLPRS computes truth / system of record") and the current operating reality (non-authoritative mode pending the K-gate) are both correct, and the PRD must say so explicitly rather than leaving the reconciliation to a banner:

> **VLPRS is authoritative by design and non-authoritative by mode until the K-gate.** The PRD states the destination; the mode banner states the phase. Every screen, report, and export declares which truth-type it presents (contract line / cash events / reported balances) and its provenance (live / as-at-baseline / declared-by-MDA). Imputed values never wear the clothes of observed values (TA-C, §8).

This statement resolves conflict (a) of the PRD review (Fable critique §8.2) and generalises Team Agreement 19 (dual-truth by default) from dashboard figures to the whole product.

**Detection-ceiling scope statement [SQ-1 handoff §2.1/§6.1 — post-freeze correction to H19, triple-tested at pin 667ebdd8; folded 2026-07-04 bounded reopen]:** legacy MDA returns can prove only **one** over-deduction species — a balance driven below zero (deductions continued past completion). The reported balance in a return is the schedule recited (`balance[t] = balance[t−1] − stated monthly`), not an observation of cash; in-flight over-deduction is therefore **not detectable from returns on any method** (balance-slope exhausted-null; rate-conformance resolves to data errors; path-aware rate resolves to legitimate accelerations). Consequence for scope: **payroll-cash ingestion (W1 posting + pillar C, 17.24/17.3b) is the prerequisite for in-flight detection, not an enhancement** — and no VLPRS surface, report, or commitment to the AG may promise in-flight detection from legacy returns alone. This enters the PRD delta as a scope boundary alongside the epistemics statement.

---

## Section 2 — SPEC → PRD Delta Plan (delta/addendum document, NOT a rewrite of the 100-FR body)

> Per Fable critique §8.4: the 100-FR PRD body is not rewritten. A **PRD Delta Addendum** document is produced as a pipeline output once this Addendum is authorised, following the same pattern as the SCP addenda — reviewable diff, auditable history. The touch map below is Fable critique §8.3, adopted unchanged. Proposed FR numbers continue the current band (PRD is current through FR102) and are final only at PRD-delta drafting.

| # | New FR (proposed number) | Content | H## | PRD anchor (touch map §8.3) |
|---|---|---|---|---|
| 2.1 | **FR103 — Submission→ledger posting** | Every confirmed MDA submission and payroll upload posts PAYROLL ledger events with provenance + confidence attributes. Closes the gap where FR16–24 stop at confirm and the posting intent lives only in Journeys 1/4/10. Computed surfaces (dashboard, reports, loan detail, auto-stop, 60-day inactivity detection) thereby read live events, not baseline-frozen figures. | **H1, H2** | FR16–24 + FR6/FR11 |
| 2.2 | **FR104 — Refund authority** | Dept Admin initiates a refund request; **AG is sole approver** (Deputy AG substitutes in AG absence); certificate-with-comment issues on approval; refund terminates in a ledger event (see 17.26 amendment §4.1). **Decision locked 2026-07-03 (session-log §9.7#1) — this FR records it; it is not reopened here.** | **H8** | New FRs anchoring 17.25/17.26 |
| 2.3 | **FR105 — Statement issuance to MDAs** | VLPRS issues pre-filled per-MDA statements each period; MDA confirms or annotates. The system moves from collecting freestyle declarations to issuing positions for attestation. Charter: Epic E-issuance (§5.1) — a destination, not near-term work. | **H13** | Entirely new FRs — nothing exists |
| 2.4 | **FR106 — Borrower statements + attestation** | Each borrower can obtain their own statement (what has been deducted; when deductions stop) and dispute a line. Extends the PRD's planned Phase-2 Beneficiary Dashboard rather than inventing a parallel surface; realises the NDPR right-of-access principle, which currently has no MVP surface. Charter: Epic F-attestation (§5.2) — a destination. | **H14** | New Beneficiary FRs; extends FR8/9/51/98 |
| 2.5 | **FR107 — Opening-balance attestation + materiality policy** | Every migrated loan's opening balance carries an attestation seal (who attested, against what evidence, when) and a materiality policy governs which variances block the seal versus ride as recorded observations. Termination metric: **% of loans attested** (see 17.33 amendment §4.2). | **H15** | Extends FR26/FR28–29/FR93 |
| 2.6 | **Two-track epistemics statement** | §1 verbatim, into the PRD preamble/framing section. | **H2, H18** | PRD framing section |
| 2.7 | **FR91–92 numbering repair** | FR91 (coverage tracker) and FR92 (scheme fund input) are referenced in frontmatter but absent from the FR body. Hygiene repair — restore the two FR entries to the body with their shipped story references (11.0b, 11.0a). | **Declared exception to the H## rule** — evidence key: PRD review (Fable critique §8 preamble) + PO direction via the drafting brief 2026-07-04; recorded in the Consolidation Ledger §C exceptions note | FR body numbering |

The PRD Delta Addendum also carries the **new IA section** (five altitudes, six primitives) required by the UX/IA epic charter (§5.3), absorbing FR32–37/97/99 into it per the touch map — drafted by Sally under her handoff (§12).

---

## Section 3 — BUILD → New sub-epic **17f — Foundation Repair** (7 stories)

> **Placement.** A new sub-epic in the Epic 17 family, slotted **between 17a and 17b in the authorisation sequence**. Rationale: the frozen verdict requires W1–W3 before 17b, and sprint-status needs a gateable home for that constraint (§6). 17f stories are repairs to already-authorised surfaces plus the connective tissue the register shows was never specified; none expands the product's authorised scope. Naming follows the 17a/17b/17c convention from Addendum 2.
>
> **Vocabulary note.** These are *repair* stories in the engineering sense — the register confirms each is a faithfully-implemented specification gap (H2), not a workmanship concern. No punitive framing attaches to prior work.

### 17f.1 — Post the loop: submission/payroll → ledger posting pipeline [H1, H2] (W1)

Wire `submissionService` and `payrollUploadService` to emit PAYROLL ledger entries with provenance + confidence on every confirmed row, so computed surfaces present live truth, auto-stop becomes reachable from ongoing deductions, `monthlyRecovery` reflects reality, and the 60-day inactivity detector reads entries that exist. Grep-confirmed baseline (2026-07-04): zero occurrences of "ledger" in either service; detector reads PAYROLL entries nothing writes (`loanService.ts:241–243`). Implements FR103 (§2.1). Keys must follow the W2 rule (§4.4) — W1 writes through sound keys, never denormalised identity. Regression anchors: canonical fixtures + the golden harness (contract §10.2#3: harness green before shipping anything touching detection).

**Supersede-safety acceptance criterion [H1-adjacent, W2 rider (ii); added pre-signature 2026-07-04, source-verified independently by Winston (§1 boundary check), the W2-brief author, and PM]:** the upload-supersede purge (`migrationService.ts:903–934`) deletes whole un-shared loan threads — including their ledger entries (`tx.delete(ledgerEntries)` at `:920`) — under a sanctioned trigger-disable. Today that removes only baseline entries; once this story posts real PAYROLL events, a supersede would silently remove posted deduction history with no replay. **AC: posted PAYROLL events must be supersede-safe** — block the purge, archive-and-replay, or an equivalent mechanism (Winston/Amelia decide the mechanism at story time; this criterion pins the property: no posted deduction event is silently removed by an upload supersede).

### 17f.2 — Staleness-disclosure stopgap: the provenance chip [H1]

Until 17f.1 lands, every computed money figure displays a provenance chip ("as at baseline YYYY-MM" / "live" / "declared by MDA") — pure disclosure, no computation change. This is UX primitive #2 of the agreed direction (Fable critique §7.3) shipped early as a stopgap; the UX/IA epic later absorbs it as a component story. **Shipment timing is PO decision D-a (§10)** — it is the only Addendum item argued for pre-authorisation movement.

### 17f.3 — Open-world quarantine intake [H4] (W3)

Replace whole-file 422 rejection on unknown staffIds (`submissionService.ts:358`) with a quarantine lane: known rows post normally; unknown rows land in `pending_verification` (FR96's existing status is the ready-made anchor) for identity resolution or registration follow-up. Closes the path by which RECORD_WITHOUT_APPROVAL cases (3,290 in the register cross-check) cannot arrive through the front door, and removes the incentive for MDAs to trim returns to what the system already knows. Quarantined rows appear in the For-Review worklist (17f.7).

### 17f.4 — Computation-engine unification: shared package, single scheme path, calendar anchor [H6]

Lift the computation engine to `packages/shared`; retire the stored-`interestRate` path in favour of the single scheme formula (`computeSchemeExpected`); add a `startDate` calendar anchor so the engine can impute an expected position for a named month. Ends the confirmed 3-way fork (app engine + `auditor-station/vendor/loan-model.ts` + SQ-1 copy) — after this story, SQ-1 consumes the shared engine (contract §10.2 merge point (b)). Regression anchors: Alatise, Lamidi, ADELEKE, CDU fixtures + golden harness.

### 17f.5 — Reconciliation unify + persist [H16]

One variance taxonomy across the four current ones; three-way comparison recomputes fresh scheme expectations rather than comparing JSONB blobs against frozen `loans.monthlyDeductionAmount`; results persist as first-class records with accounting force (each variance is a claim that must resolve, not a display artefact). Consumes 17f.4's shared engine.

### 17f.6 — Conservation & terminal-state enforcement [H12]

Nothing vanishes silently: every ACTIVE loan either continues, or exits through an evented terminal state (completion, settlement, write-off, transfer, employment event). Baseline-created ACTIVE loans that never receive events surface as observations rather than persisting unexamined. The SQ-1 standing register's lifecycle (harmonised §5) is the interim control until this lands; the register dissolves into 17.25/17.26 + this story at authoritative go-live (contract §10.2 merge point (c)). **[SQ-1 handoff §6.7, folded 2026-07-04]** At dissolution the app operationalises the **proactive portfolio Species-A worklist** (below-zero detection portfolio-wide, not complaint-driven — 185 cases / ₦7.74M found at pin 667ebdd8: 18 still-deducting + 167 ended + 17 needing data reconstruction), with DELTA-per-refresh watching disappearances.

### 17f.7 — "For Review" worklist unification [H9]

Unify the Exception queue and Observation surfaces into one non-punitive "For Review" worklist, restoring FR22 compliance ("Flag Exception" / warning-triangle iconography / `ghost_deduction` naming currently present across 14 client files). Single implementation, dual citation: this is also UX/IA cluster 3 (§5.3) — build lands here, matrix-governed AC comes from the UX spec.

---

## Section 4 — PLAN → Story amendments (each cites its H##)

### 4.1 Amend Story 17.26 — Overdeduction refund workflow [H7, H25, H8]

1. **Refund must terminate in a ledger event.** Add REFUND and REVERSAL entry types to the ledger enum (today: PAYROLL/ADJUSTMENT/MIGRATION_BASELINE/WRITE_OFF only — `schema.ts:71–72`). The 17.26 state machine gains a money-event terminal: PAYMENT_CONFIRMED posts the REFUND ledger entry; certificate reissue follows the event, never substitutes for it. Resolution without a money event is recorded as exactly that — a status, not a settlement.
2. **The Bakare month-count rule as an explicit acceptance criterion:** *whether the zero-landing month's deduction was owed determines the refund quantum* (Bakare: ₦51,874 vs ₦34,582 — a 2-vs-3-month determination). Every computed quantum states which side of this rule it took and why.
3. Authority text restated from the locked decision (H8): Dept Admin initiates; AG sole approver; Deputy AG substitutes; certificate-with-comment on approval.
4. **BLOCKING AC — settlement-path-aware detection [SQ-1 handoff §2.2/§6.2, post-freeze correction to H26; applies to 17.25 AND 17.26 and any future rate detector]:** before any "deduction exceeds schedule" or "rate differs" observation is raised, the detector **consults tenure-change and early-exit events** (PRD Path 2 accelerated repayment — tenure 60→45, monthly recalculated; Path 3 lump-sum). Evidence for why this blocks: path-aware analysis at pin 667ebdd8 found **1,662 loans whose higher-than-standard monthly maps to a valid accelerated tenure** — legitimate choices, not over-deductions; a path-blind detector would flag every one of them. The naive 311 "wrong-rate" flags collapse to ~14 real candidates + 89 data-error rows when the path test is applied.
5. **Refund-quantum AC — a ghost is not a claimant [SQ-1 handoff §3 H25-correction, source-verified: the `2025-00` record is a WORKING-SHEET artifact at ~₦0 balance; Aliyu's February is a genuine data gap]:** refund-quantum computation must exclude self-marked ghost/working-sheet records from the claimant's thread; the below-zero magnitude is the quantum basis, confirmed against payslip evidence (≥ test), never against a ghost row.

### 4.2 Amend Story 17.33 — Retroactive backfill [H15]

1. Add the **per-loan attested opening-balance seal**: each backfilled loan's opening position carries attestor, evidence basis, and timestamp — the seal FR107 (§2.5) specifies.
2. Add the **materiality policy** as a story input: which variance magnitudes block the seal vs ride as recorded observations (policy value AG-editable per Story 17.31's pattern).
3. Add the **termination metric: % of loans attested.** 17.33 is done when the attested share crosses the policy threshold, not when the script finishes running.

### 4.3 Amend Story 17.17 — Dual-truth dashboard [H10; session-log §14.1, §14.2]

1. **Instrument-grading + thread-integrity gate BEFORE tiering.** Source instruments (workbooks/returns) are integrity-graded; threads failing integrity (non-monotone-with-jumps, zero-resurrection, month-0 records) or sourced from a low-graded instrument route to the DATA_RECONSTRUCTION disposition and never receive a refund tier. The sentence for this SCP, verbatim from the carry-forward: **"no refund tier without instrument grading."** (Evidence: the Samson/MOSOBALAJE thread, harmonised §8.2 M2 + §9.2 — pervasively affected values across both HOS source workbooks.)
2. **PARSER_BLIND fourth state** joins Reconciled / Pending Review / Difference — "the parser could not see this" rendered distinctly from "the MDA did not report this." **AC #1 is the verification of H10 itself** (H10 is ASSERTED, not grep-confirmed — per the register's own down-rank D1, the story first proves or bounds the fail-open behaviour, then builds).
3. **Portfolio-wide month-0 defect count as a story metric:** when the period-parser fix (H25's `YYYY-00` class) lands, count month-0 records catalog-wide and display the trend — confirmed in ≥2 of the 47 (Aliyu, Samson); the portfolio number sizes the cleanup. **[Updated per SQ-1 handoff §4, 2026-07-04: the engine-side fix has landed (catalog 101,338 → 104,396, pin 83c9e11c → 667ebdd8); the app-side rule is that year-only records self-mark and are excluded from monthly-sequence analysis, and ghost duplicates are kept-but-marked — dashboard renders them as PARSER_BLIND-adjacent disclosure, never silently absorbed.]**

### 4.4 Amend Story 17.2 — Parser port [H5, H21; contract §10.2 merge point (a)]

1. **Elevated priority** within 17a (it is already first in Bob's Sprint 1 and a hard blocker for 17.3b per Addendum 2 §2.6; this Addendum adds the H5 evidence — the production parser is an 8-column positional CSV no MDA produces, while the real 42-template parser lives uncommitted in SQ-1).
2. 17.2 explicitly receives **the SQ-1 parser AND the shared thread-segmentation utility** (zero-reset segmentation + stale-month exclusion, the H21 LOAN_CYCLE design constraint) — one shared utility, two consumers (app + SQ-1 detectors). The SQ-1 engine rebuild keeps 17.2-portability as a day-one constraint (contract §10.4; SQ-1 read-receipt session-log §15 confirms the resolve-at-read identity ordering so the port does not carry the identity-as-string pattern into the app).
3. **[SQ-1 handoff §4/§6.4, folded 2026-07-04]** The port carries the three parsing behaviours proven in the 2026-07-04 rebuild: (a) bare-month sheet names (`JAN`) combine with the filename year — guarded to pure month-word sheets (the fix that recovered 3,058 records of monthly granularity); (b) secondary-sheet ghost/working-sheet rows self-mark and are excluded from monthly-sequence analysis (kept-but-marked, never deleted); (c) year-only / month-0 records self-mark the same way. **The golden harness (`overdeduction-regression-2026-07.ts`, 47-case set at pin 667ebdd8) is the port's acceptance test** — Team Agreement 15 parity: the app parser must reproduce the engine's classifications on the same fixtures.

### 4.5 Amend the 17a schema story (Winston 17a schema deliverable + persons-table migrations under 17.3/17.4) [H3, H11]

1. **Incorporate the Winston W2 brief by reference:** `winston-w2-brief-2026-07-04.md` — the resolve-identity-at-read rule; `ledger_entries.mdaId` re-defined as *collecting MDA* (historical fact, kept); `ledger_entries.staffId` deprecated (no reader may consume it; lint/CI guard; drop at next safe migration); `person_loans`-style linkage so re-attribution moves a mutable pointer and never touches immutable history; single-mutator rule for `loans.mdaId`; the transfer fixture added to the regression anchors.
2. **Gate, written into the story text verbatim:** ***"No persons-table implementation until the W2-amended schema design is approved."***
3. This is the register's only ticking clock (W2 brief header): honouring the constraint before the persons table ships is cheap; after, the immutability trigger makes it effectively unfixable. Design input within the authorised 17a envelope — not scope expansion; Winston flags anything he judges to exceed the envelope back into this Addendum rather than absorbing it (W2 brief §4).

---

## Section 5 — PLAN → New epic charters

### 5.1 Epic E-issuance — Statement Issuance to MDAs [H13] (proposed Epic 19; **DESTINATION**)

**Charter:** VLPRS issues pre-filled per-MDA statements each period ("here is the position we compute for your people"); the MDA confirms or annotates line-by-line. Inverts the intake relationship — the system states, the MDA attests — which is the reframe's forward-bookkeeping half made operational. Implements FR105 (§2.3).
**Sequencing — explicitly a destination, not near-term work:** requires W1 landed (statements over starved ledgers would issue baseline-frozen numbers as positions) and archaeology mature enough that issued statements don't immediately generate mass disputes over known-unreconstructed history. Authorisation for charter creation is requested now so the destination is on the map; story decomposition follows the 17f K-gate.

### 5.2 Epic F-attestation — Borrower Statements & Dispute Intake [H14] (proposed Epic 20; **DESTINATION**)

**Charter:** every borrower can obtain their statement and dispute a line; dispute intake feeds the For-Review worklist (17f.7) and the refund rails (17.26). Extends the PRD's planned Phase-2 Beneficiary Dashboard — not a parallel surface. Realises the NDPR right-of-access principle (currently zero MVP surface). Implements FR106 (§2.4).
**Sequencing — destination:** behind W1 (a borrower statement over a starved ledger is a false statement) and behind E-issuance pilot learning. Pull-forward timing is PO decision D-b (§10).

### 5.3 UX/IA Epic — One Spine, Five Altitudes [H9 + merged direction, harmonised §5] (proposed Epic 21)

**Charter:** rebuild navigation around the single spine (Person → Loan → Ledger events → Computed position → Variance → Action) entered at five role altitudes, composed from six primitives (person header, position card with provenance chip, ledger timeline, three-truth panel, variance card, worklist row). Direction is PO-approved 2026-07-03 (Fable critique §7).

**Decomposition — 9 story clusters per session-log §9.8**, each AC-governed by the **Role–Job–Screen matrix** (Sally's deliverable, §12): 1. IA foundation (global search + person-as-spine + canonical object pages) · 2. Role-home worklists · 3. Observation/Exception unification (= 17f.7 build; matrix AC here) · 4. Refund/correction action surface (unblocks the 47-case workflow; FR104) · 5. MDA-officer issue-and-attest home (E-issuance surface) · 6. Beneficiary portal + attestation (P2; F-attestation surface) · 7. Auditor read-only role (P2) · 8. Committee + Front Desk surfaces (P2) · 9. Super-Admin persona split (AG vs Deputy AG landing).

**Truth-type dependency sequencing behind W1 (binding on cluster ordering):** every matrix row marks its truth-type; **screens presenting computed money cannot ship as "live" before W1 lands** — until then they ship with the provenance chip stating their basis. Beautiful screens over frozen balances manufacture false confidence and are a worse product than plain ones.
**AC metric:** every screen story carries a **time-to-answer UAT criterion** measured against the spreadsheet workflow it replaces.

---

## Section 6 — Binding sequencing constraint (frozen verdict, harmonised §1/§5)

> **W1 (17f.1), W2 (17a schema amendment §4.5), and W3 (17f.3) land BEFORE any Epic 17b retrofit story starts.**

Ordering as an explicit constraint chain for sprint-status (§9): 17a (with the W2-amended schema gate) → **17f** → 17b → 17c. Within 17f: 17f.1/17f.3 are the gate-carrying stories; 17f.4–17f.7 are 17f-scoped but do not gate 17b individually — the sub-epic K-gate does. Rationale, in the register's words: repair is concentrated and enumerable; sequence the structural repairs **before** 17b multiplies consumers on the current foundation.

---

## Section 7 — DATA → record only (no authorisation needed; already moving)

Two memos drafted 2026-07-04 and moving now — recorded here per the routing rule, **not redrafted**:

1. `docs/Car_Loan/analysis/reports/memo-oyshmb-data-request-2026-07-04.md` — OYSHMB returns request [H24]: 7 dark + 1 no-name threads (~₦1.08M claims) unresolvable from the catalog; source-acquisition, not detection.
2. `docs/Car_Loan/analysis/reports/memo-staff-id-intake-2026-07-04.md` — staff-ID capture at claim intake [H25 intake practice]: IDs from payslips at walk-in, so future claims arrive anchored. **[Elevated per SQ-1 handoff §6.6: the cheapest high-leverage move on the board — staff-ID converts cross-MDA transfer resolution from "likely" to "definitive" (name-only matching mis-picked a namesake over the claimant's own thread in the Samson case).]**

(Combined AG-facing copy: `AG-Data-Requests-2026-07-04.md`, same folder — session-log §15.)

---

## Section 8 — Proposed team agreements (continuing the numbering: Agreements 17–26 exist)

| # | Agreement | Substance | Evidence |
|---|---|---|---|
| **27 (TA-A)** | **Journeys must compile into FRs.** No load-bearing behaviour may live only in a user journey. | Example 1: H2 — the submission→ledger posting intent lived only in Journeys 1/4/10; FR16–24 stopped at confirm; the gap was faithfully implemented. Example 2: this Addendum's own documentation-first ordering — the PO's standing rule for this cycle is that documentation moves first, or reality forks. | H2 |
| **28 (TA-B)** | **Adversarial review discipline.** Findings are labelled independent vs post-contact; disagreements are resolved by falsification test, not prose; and every adversarial review closes on a **bounded, enumerated verification pass** — N reproducible checks, then freeze — not on consensus. | The 2026-07-02→04 cycle: zero disputes resolved by argument; the §9.1 bounded final pass stopped the thread ping-ponging. Folds in session-log §14.3 (proposed TA-D — same substance, one fewer agreement, per the Fable suggestion recorded there). | H19–H23 process record; harmonised §6 |
| **29 (TA-C)** | **Imputed never wears the clothes of observed.** Every projected, backfilled, or inferred value is visually and structurally distinct from an observed one, at every altitude — registers, dashboards, statements, exports. | Register guardrail generalised; also the calibration discipline behind the H10 down-rank (an unverified claim never rides at verified confidence). | H22, D1/H10 |

---

## Section 9 — Change-list for `epics.md` and `sprint-status.yaml` (PROPOSED — not applied in this session; PO approval required)

### 9.1 `epics.md`

1. **Add sub-epic section "Epic 17f — Foundation Repair"** under the Epic 17 family: charter paragraph (frozen-verdict citation), stories 17f.1–17f.7 (§3, each with H## header), K-gate = all seven done + golden harness PASS + provenance chip live on every computed money surface.
2. **Record the binding sequence** 17a → 17f → 17b → 17c (§6) in the Epic 17 structure section.
3. **Amend story entries:** 17.26 (§4.1), 17.33 (§4.2), 17.17 (§4.3), 17.2 (§4.4), 17a schema story (§4.5 incl. the verbatim gate sentence).
4. **Add three new epic charters:** Epic 19 E-issuance (destination), Epic 20 F-attestation (destination), Epic 21 UX/IA (§5) — each flagged with its authorisation status and W1 dependency.
5. **Append Team Agreements 27–29** (§8) to the governance principles table.
6. **PRD cross-reference note:** FR103–FR107 + epistemics statement + FR91–92 repair pending in the PRD Delta Addendum (§2).

### 9.2 `sprint-status.yaml`

1. **Add `epic-17f` block** (status `backlog`, gated: `post Deputy AG authorisation of SCP Addendum 3`), stories `17f-1` … `17f-7` with H## comment lines; `17f-2` annotated `shipment timing = PO decision D-a`.
2. **Add ordering comments:** `# BINDING (Addendum 3 §6): no 17b story leaves backlog before 17f.1 + 17f.3 done and 17a schema carries the W2 amendment`.
3. **Annotate amended stories** (17-2, 17-17, 17-26, 17-33) with `# AMENDED per SCP Addendum 3 §4.x [H##]`.
4. **Add `epic-19` / `epic-20` / `epic-21` stubs** (`backlog`, destination-flagged, no stories activated; Epic 21 stories created by Bob after Sally's matrix lands).
5. **Sub-epic tags** (17a/17b/17c/17f) per Addendum 2 §6.3 — note the dependency: Addendum 2 is itself Deputy-AG-signature-pending; both addenda travel to the Deputy AG together.

---

## Section 10 — Open PO decisions (recommendation in one sentence each)

**D-a — W1 staleness-disclosure chip (17f.2): ship pre-authorisation?**
*For:* it is pure disclosure — it changes no computation, no data, no authority, and every day without it the app presents baseline-frozen figures with unearned confidence to its own operators. Reducing false confidence is a duty that predates any authorisation cycle.
*Against:* it touches authorised, shipped surfaces (dashboard, reports, loan detail), and the pause discipline since SCP 2026-04-15 has drawn its credibility precisely from moving nothing on those surfaces without signature. A "small pure-disclosure exception" is how envelopes erode.
**Recommendation:** ship it pre-authorisation as a disclosure fix within the current envelope, disclosed to the Deputy AG in the cover note rather than requested — one sentence there converts the exception into transparency.

**D-b — Borrower-statement pull-forward timing (F-attestation / NDPR right-of-access).**
**Recommendation:** charter now (this Addendum), anchor the FR now (§2.4), build after W1 — the NDPR argument justifies priority *within* the sequence, and a borrower statement issued off a starved ledger would be a false statement, which is worse for the borrower and for NDPR posture than a phased one.

**D-c — Portfolio-sweep scale/sequencing (full portfolio — 104,396 records at the live catalog pin SHA 667ebdd8; the frozen register's "101,338" is correct at its own pin 83c9e11c; the sweep runs at current catalog. SQ-1 track executes, authorisation lives here).**
**Recommendation:** authorise the standing-register sweep in this Addendum with the contract's own guardrails — detectors pass the golden harness first, instrument-grading gate before any tiering, priority order LIVE_BELOW_ZERO → most-recent T1 → T3-by-magnitude, DELTA-per-refresh watching disappearances — because the fairness argument is decisive: the State finds and returns over-deductions for everyone, not only for those who complain.

---

## Section 11 — Handoff block: Winston (Architect)

- **Your section:** §4.5 (the 17a schema amendment) — you own turning the W2 brief into the amended 17a schema design; §3 stories 17f.4/17f.5/17f.6 need your architecture pass when 17f is authorised.
- **The gate, verbatim, for the story text:** *"No persons-table implementation until the W2-amended schema design is approved."*
- **Read list:** `winston-w2-brief-2026-07-04.md` (your primary input — route, don't rewrite); `harmonised-findings-2026-07-04.md` §2 rows **H3 / H6 / H11 / H12 / H17** and **§10** (the execution contract — binding); your own `architect-winston-17a-schema-2026-04-20.md` (the design being amended).
- **First act:** independently re-run the **H3 falsification test** (W2 brief §5 / Fable critique §6.2): confirm no operational read path may consume `ledger_entries.staffId` and no 17a story writes person attributions into the ledger. Result of your test outranks the brief's prose — if you refute any part, that goes to Awwal, not into silent absorption.
- **Scope discipline:** design input within the authorised 17a envelope; anything you judge to exceed it comes back into this Addendum as a request (W2 brief §4).

## Section 12 — Handoff block: Sally (UX)

- **Your section:** §5.3 (the UX/IA epic charter) — you own its UX spec; §2's PRD Delta IA section is drafted by you; the provenance chip (17f.2) is your primitive #2 shipped early.
- **Read list:** Fable critique §7 (the PO-approved direction — one spine, five altitudes, six primitives, navigation rules); session-log §9 (diagnosis, role matrix §9.5, per-role navigation §9.6, the 9-cluster decomposition §9.8); this Addendum §5.3.
- **Deliverable:** the **Role–Job–Screen matrix as a UX spec** — one row per (role × job-to-be-done × screen) carrying primary question, truth-type, doorways in/out, and story ID; **routes named after matrix row IDs**; every screen story's AC includes a **time-to-answer UAT criterion** against the spreadsheet workflow it replaces; every row marks its truth-type dependency so screen stories sequence behind W1.
- **Constraints:** non-punitive vocabulary throughout (`vocabulary.ts` is mandatory); no red, no confidence percentages (evidence classes, per Addendum 2 UX decisions); screens showing computed money cannot ship as "live" before W1.

---

## Section 13 — Deputy AG cover note (draft)

> Between 2 and 4 July 2026, two independent AI review agents audited the entire VLPRS system — code, plans, and product requirements — against the accounting standard the scheme ultimately requires: that the system issue statements, post every deduction as a ledger event, and obtain attestation, rather than collect declarations and detect problems afterwards. The two reviews were conducted blind to each other, then cross-examined; every point of disagreement between them was settled by running a reproducible test on the actual system — none by argument — and the agreed findings were locked into a 26-item register backed by an automated verification harness that both agents ran independently. This Addendum requests authorisation for the repairs and plans that register requires: a small set of foundation-repair stories (connecting monthly submissions to the financial ledger, protecting historical records during identity corrections, and accepting-with-quarantine rather than rejecting unrecognised submissions), amendments to five already-planned stories, three new epic charters for the system's destination state (statements issued to MDAs, statements available to borrowers, and a navigation redesign), and the corresponding product-requirement updates. Nothing in this Addendum authorises itself; the only items already moving are two data-request memos to your office that require no authorisation. The verdict of both reviews, reached independently, is that the system's core is sound and worth keeping — the work requested here connects it, in the right order, before wider rollout multiplies anything built on the unconnected parts.

---

---

## Section 14 — Bounded reopen record (2026-07-04, post-assembly)

The SQ-1 track's handoff (`sq1-track-handoff-to-bmad-2026-07-04.md`) arrived after pack assembly with four post-freeze H-corrections (H19, H20, H25, H26 — all source-verified by the second reader at pin 667ebdd8; evidence in the Consolidation Ledger §F step-4 row) and seven recommended moves (handoff §6). This Addendum was reopened **bounded to that diff** (Agreement 28 discipline) and the moves folded as follows: §6.1 detection-ceiling scope statement → §1; §6.2 settlement-path blocking AC → §4.1#4; §6.3 ghost-≠-claimant AC → §4.1#5; §6.4 parser behaviours + harness-as-acceptance-test → §4.4#3; §6.5 instrument-grading → already landed at §4.3#1 (no change — dual-route guard); §6.6 DATA memos → already recorded at §7, staff-ID memo elevated; §6.7 register dissolution + proactive Species-A worklist → §3/17f.6. The frozen harmonised register was not edited; corrections live in the handoff and here, per the class-vs-disposition and freeze disciplines.

*End of DRAFT. Pipeline outputs downstream of this Addendum: PRD Delta Addendum (§2), Sally's Role–Job–Screen matrix UX spec (§12), Bob's story decomposition + sprint-status wiring (contract §10.3#4) once the Addendum shape is PO-approved. Winston's W2-amended 17a schema design (§11) is delivered and PO-approved (2026-07-04). This document does not edit the frozen harmonised register, the session log, or anything under `scripts/legacy-report/`.*
