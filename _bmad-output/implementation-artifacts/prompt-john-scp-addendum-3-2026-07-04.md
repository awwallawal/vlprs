# Prompt for John (PM) — SCP Addendum 3 drafting session (2026-07-04)

> Copy everything below the line into a fresh CLI session.

---

Load the BMAD PM agent (John) from the `_bmad/` framework and run the correct-course / Sprint Change Proposal workflow. This session drafts **SCP ADDENDUM 3**. You are drafting documentation FIRST, before any agent designs or builds — the PO's standing rule for this addendum: documentation moves first, or reality forks.

## Context (one paragraph)

Between 2026-07-02 and 2026-07-04, two AI agents independently audited the full VLPRS repo against a new conceptual frame (the "ledger reframe"), adversarially cross-verified each other's findings, resolved every disagreement by reproducible test, and froze the result as a 26-finding register (H1–H26). The frozen document is the single input to this workflow. A 47-case over-deduction validation set, a golden regression harness, an architect brief (W2), and two outward memos already exist. Your job is to route the frozen findings into BMAD-disciplined documentation: an SCP Addendum, a PRD delta plan, story amendments, new epic charters, and agent assignments.

## Read in this order before writing anything

1. `_bmad-output/implementation-artifacts/harmonised-findings-2026-07-04.md` — **§1–§9 are FROZEN** (findings H1–H26, all test-verified; do NOT re-litigate, reword, or "improve" any finding). **§10 is the two-track execution contract — it binds this workflow.**
2. `_bmad-output/implementation-artifacts/winston-w2-brief-2026-07-04.md` — architect input, already written; you route it, you don't rewrite it.
3. `_bmad-output/implementation-artifacts/session-log-2026-07-02-overdeduction-sweep-and-ledger-reframe.md` — **§14 only** (three carry-forward items addressed to you).
4. `_bmad-output/implementation-artifacts/app-foundation-critique-INDEPENDENT-fable-2026-07-03.md` — **§7** (PO-approved UX direction, input for Sally's assignment) and **§8.3** (PRD touch map: which FR bands each change lands in).
5. Current planning state: `_bmad-output/planning-artifacts/epics.md` (Epic 17 + 17a/17b/17c split), `_bmad-output/implementation-artifacts/sprint-status.yaml`, `_bmad-output/planning-artifacts/sprint-change-proposal-2026-04-15.md`, Addendum 1 (`scp-2026-04-15-addendum-1.md`), Addendum 2 DRAFT (`_bmad-output/implementation-artifacts/scp-addendum-2-2026-04-20-DRAFT.md`).
6. `packages/shared/src/constants/vocabulary.ts` — non-punitive vocabulary is mandatory in everything you write.

**If any referenced file is missing or its content contradicts this prompt, STOP and report the discrepancy — do not improvise around it.**

## Task

Draft **`_bmad-output/planning-artifacts/scp-addendum-3-2026-07-04-DRAFT.md`**, routing every H-finding by the Provenance column of the frozen register §2. The routing rule is fixed — do not deviate:

**SPEC → PRD delta section.** New FRs for: submission→ledger posting (H1/H2); refund authority — AG sole approver, Dept Admin initiates, certificate-with-comment (H8 — decision already locked 2026-07-03, do not reopen); statement issuance to MDAs (H13); borrower statements + attestation (H14); opening-balance attestation + materiality policy (H15); the two-track epistemics statement (authoritative by design, non-authoritative by mode until K-gate); FR91–92 numbering repair. Deliver as a PRD delta/addendum plan (do not rewrite the 100-FR PRD body).

**BUILD → repair stories.** W1 posting pipeline + the staleness-disclosure stopgap story (H1); W3 quarantine intake replacing whole-file 422 rejection (H4); FR22 Exception-queue unification (H9); computation-engine lift to `packages/shared` + single scheme path + calendar anchor, killing the 3-way fork (H6); reconciliation unify + persist (H16); conservation/terminal-state enforcement (H12).

**PLAN → story amendments + new charters.**
- Amend **17.26**: refund must terminate in a ledger event — new REFUND/REVERSAL entry types (H7); the Bakare month-count rule (whether the zero-landing month's deduction was owed determines quantum) as an explicit acceptance criterion (H25).
- Amend **17.33**: per-loan attested opening-balance seal + materiality policy; termination metric "% of loans attested" (H15).
- Amend **17.17**: instrument-grading + thread-integrity gate BEFORE tiering (session-log §14.1 — the SCP sentence: "no refund tier without instrument grading"); PARSER_BLIND fourth state with H10 verification as AC #1; portfolio-wide month-0 defect count as a story metric (session-log §14.2).
- Amend **17.2** (parser port): elevated priority; explicitly receives the SQ-1 parser AND the shared thread-segmentation utility (contract §10.2 merge point (a)).
- Amend the **17a schema story**: incorporate the Winston W2 brief by reference, and write this gate into the story text **verbatim**: *"No persons-table implementation until the W2-amended schema design is approved."*
- New epic charters: **E-issuance** (pre-filled statements to MDAs, confirm/annotate) and **F-attestation** (borrower statements + dispute intake) — both explicitly sequenced as **destinations** (after W1 lands and archaeology matures), not near-term work.
- The **UX/IA epic**: 9 story clusters per session-log §9.8, AC-governed by the Role–Job–Screen matrix, with truth-type dependency sequencing behind W1 (screens showing computed money cannot ship as "live" before W1).

**DATA → note only.** Two memos already drafted and moving now (no authorisation needed): `docs/Car_Loan/analysis/reports/memo-oyshmb-data-request-2026-07-04.md` and `memo-staff-id-intake-2026-07-04.md`. Record them; do not redraft.

## Hard constraints

1. **Every story, amendment, and charter cites its H## in its header** (contract §10.2#1). A number or claim with no H## behind it does not enter the Addendum.
2. **Sequencing rule from the frozen verdict:** W1–W3 land **before** any Epic 17b retrofit story. Make this an explicit ordering constraint in the Addendum.
3. **Governance:** this Addendum REQUESTS Deputy AG authorisation; nothing in it authorises itself. The only pre-signature movements are the two DATA memos (already moving) — flag the W1 staleness-disclosure chip as a PO decision on pre-authorisation shipment, with the argument for (pure disclosure, reduces false confidence) and against (touches authorised surfaces) stated in two sentences each.
4. **Propose team agreements** as numbered agreements: **TA-A** "no load-bearing behaviour may live only in a user journey — journeys must compile into FRs" (cite H2 as example 1 and this addendum's documentation-first ordering as example 2); **TA-B** "findings labelled independent vs post-contact; disagreements resolved by falsification test; every adversarial review closes on a bounded, enumerated verification pass" (folds in session-log §14.3); **TA-C** "imputed never wears the clothes of observed."
5. **Do not edit** `harmonised-findings-2026-07-04.md` (frozen), the session log (other agent's file), or any file under `scripts/legacy-report/` (SQ-1 track owns those).
6. **Do not apply** epics.md or sprint-status.yaml changes in this session — propose them as a change-list for PO approval.
7. Non-punitive vocabulary throughout. Retirements/scope-downs framed per the vocabulary constants.

## End your session with

1. **Change-list** for `epics.md` and `sprint-status.yaml` (proposed, not applied).
2. **Open PO decisions**, each with your recommendation in one sentence: (a) W1 staleness chip pre-authorisation; (b) borrower-statement pull-forward timing (NDPR right-of-access argument); (c) portfolio-sweep scale/sequencing (SQ-1 track executes, but the authorisation lives in this Addendum).
3. **Handoff block for Winston** (Architect): which Addendum section is his, the gate wording, and his read list (`winston-w2-brief-2026-07-04.md`, harmonised §2 rows H3/H6/H11/H12/H17, harmonised §10, his own `architect-winston-17a-schema-2026-04-20.md`). Note his first act is to independently re-run the H3 falsification test.
4. **Handoff block for Sally** (UX): which Addendum section is hers and her read list (Fable critique §7, session-log §9, the UX/IA epic charter you drafted). Her deliverable: the Role–Job–Screen matrix as a UX spec with story-ID-named routes and time-to-answer UAT criteria.
5. A one-paragraph **Deputy AG cover note** summarising what authorisation is being requested and why the findings are trustworthy (two independent audits, every dispute resolved by reproducible test, zero resolved by argument).
