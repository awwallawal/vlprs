# Story 17.26: Overdeduction Refund Workflow

Status: backlog — consolidated at Step-5 fold 2026-07-06

## Story

As the **Accountant General (sole refund authority) and the staff members owed refunds**,
I want a refund workflow whose every resolution terminates in a ledger money event, whose quantum rules are explicit, and whose detection is settlement-path-aware,
So that refunds are authorised, posted, and certificated with accounting force — and no legitimate accelerated repayment is ever flagged as an overdeduction.

**Origin:** SCP 2026-04-15 §4.1 (base). Amended ×1: Addendum 3 §4.1 (published 2026-07-06) [H7, H25, H8 + the §14 bounded-reopen items]. Ledger row: clean (single addendum).

**Priority:** core Epic 17, Settlement/Cash/Overdeduction sub-theme. Downstream of 17.25 (detection/adjudication).

## Scope (folded)

**Base (SCP §4.1):** `overdeduction_cases` table + 6-state progression (DETECTED → PENDING_AG_APPROVAL → AG_APPROVED → AWAITING_PAYMENT_CONFIRMATION → PAYMENT_CONFIRMED → CERTIFICATE_REISSUED → CLOSED). AG sole authority; Deputy AG substitute in AG absence; Dept Admin routes + confirms payment only. Batch-approval UI for AG efficiency. Certificate-with-comment pattern: issue certificate when scheme total paid + Scheme Observations section if overdeduction present; reissue clean v2 on refund confirmation.

**+ A3 §4.1:**
1. **Refund must terminate in a ledger event [H7].** REFUND and REVERSAL entry types join the ledger enum (today: PAYROLL/ADJUSTMENT/MIGRATION_BASELINE/WRITE_OFF only — `schema.ts:71–72`). The state machine gains a money-event terminal: PAYMENT_CONFIRMED posts the REFUND ledger entry; certificate reissue follows the event, never substitutes for it. Resolution without a money event is recorded as exactly that — a status, not a settlement.
2. **The Bakare month-count rule as an explicit AC [H25]:** *whether the zero-landing month's deduction was owed determines the refund quantum* (Bakare: ₦51,874 vs ₦34,582 — a 2-vs-3-month determination). Every computed quantum states which side of this rule it took and why.
3. **Authority restated from the locked decision [H8]:** Dept Admin initiates; AG sole approver; Deputy AG substitutes; certificate-with-comment on approval. (FR104 records the decision; not reopened here.)
4. **BLOCKING AC — settlement-path-aware detection [SQ-1 handoff §2.2/§6.2, folded via A3 §14; applies to 17.25 AND this story and any future rate detector]:** before any "deduction exceeds schedule" or "rate differs" observation is raised, the detector **consults tenure-change and early-exit events** (Path 2 accelerated repayment — tenure 60→45, monthly recalculated; Path 3 lump-sum). Evidence: path-aware analysis at pin `667ebdd8` found **1,662 loans whose higher-than-standard monthly maps to a valid accelerated tenure** — legitimate choices, not overdeductions; a path-blind detector would flag every one. The naive 311 "wrong-rate" flags collapse to ~14 real candidates + 89 data-error rows under the path test.
5. **Refund-quantum AC — a ghost is not a claimant [H25 correction, source-verified]:** quantum computation excludes self-marked ghost/working-sheet records from the claimant's thread; the below-zero magnitude is the quantum basis, confirmed against payslip evidence (≥ test), never against a ghost row.

## Acceptance Criteria

1. **Given** the 6-state progression, **When** a case advances, **Then** transitions follow DETECTED → PENDING_AG_APPROVAL → AG_APPROVED → AWAITING_PAYMENT_CONFIRMATION → PAYMENT_CONFIRMED → CERTIFICATE_REISSUED → CLOSED with role gates (Dept Admin initiates/routes/confirms payment; AG approves; Deputy AG substitutes). [Base + A3, H8]
2. **Given** PAYMENT_CONFIRMED, **When** the state commits, **Then** a REFUND ledger entry posts (REVERSAL where applicable); certificate reissue follows the posted event and never substitutes for it. [A3, H7]
3. **Given** a resolution without a money event, **When** recorded, **Then** it is a status, not a settlement — visibly distinct. [A3, H7]
4. **Given** a computed refund quantum, **When** presented for approval, **Then** it states which side of the Bakare month-count rule it took (zero-landing month owed or not) and why. [A3, H25]
5. **Given** any deduction-exceeds-schedule or rate-differs candidate, **When** detection runs, **Then** tenure-change and early-exit events are consulted FIRST; Path-2 accelerated repayments are never flagged. BLOCKING: this AC gates any detector this story or 17.25 ships. [A3 §4.1#4, folded SQ-1 §2.2]
6. **Given** a claimant thread containing self-marked ghost/working-sheet rows, **When** quantum computes, **Then** ghost rows are excluded; the below-zero magnitude is the basis, confirmed against payslip evidence. [A3 §4.1#5, H25]
7. **Given** multiple approved cases, **When** the AG reviews, **Then** batch approval is available with per-case quantum + rule-side disclosure. [Base]

## Sequencing

- **Upstream:** 17.25 (detection + adjudication, shares the blocking path-aware AC), 17.9 (arithmetic classes).
- **Downstream:** certificate reissue (17.27/17.28 chain); refund posting consumes the ledger enum extension.
- **Authority record:** FR104 (locked 2026-07-03; restated here, not reopened).

---
## Provenance (Step-5 fold, 2026-07-06)
Consolidated per scp-consolidation-ledger.md §A. From this FOLDED moment this file is the
single truth for Story 17.26; the addenda are journal history (Agreement 30). Corrections
reopen; additions queue to A5+ as new ledger fold rows.

| # | Source | Contribution |
|---|---|---|
| 1 | Base — SCP 2026-04-15 §4.1 | overdeduction_cases + 6-state machine; AG sole authority; batch approval; certificate-with-comment |
| 2 | A3 §4.1 (`scp-addendum-3-2026-07-04.md`) | H7 REFUND/REVERSAL ledger terminal; H25 Bakare month-count rule; H8 authority restated; §14-folded settlement-path blocking AC + ghost-≠-claimant AC |

Evidence keys carried: H7, H8, H25 (+ SQ-1 handoff §2.2/§3 via A3 §14)
Collision resolution: none
Engine status (per ledger §A): —
Pending amendments: none — additions queue to A5+ (evidence-graded finding model touches findings, not this workflow — A5 §H#1)
