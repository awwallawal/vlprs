---
title: Sprint Change Proposal — Addendum 5 to SCP 2026-04-15 (DRAFT)
subtitle: The three-species reconciliation framework — evidence-graded findings, Species B/C detection layers, and the transfer continuity guard
date_drafted: 2026-07-09
author: PM John (drafted) — for Awwal Lawal (Product Owner) ratification, then Fable second-read
parent_scp: sprint-change-proposal-2026-04-15.md (approved 2026-04-15, Round 5)
parent_addenda:
  - scp-2026-04-15-addendum-1.md (published 2026-04-18)
  - scp-2026-04-15-addendum-2.md (published 2026-07-06)
  - scp-addendum-3-2026-07-04.md (published 2026-07-06)
  - scp-addendum-4-2026-07-04.md (published 2026-07-06)
scope_classification: MODERATE — refines Line-2-signed scope; 2 new FRs (FR117–118); 1 blocking AC + 4 fold-row amendments to CONSOLIDATED story files; 2 proactive-detection build items; fixture additions. No new epics, no sequencing changes to the 17a→17f→17b→17c rule.
status: DRAFT — the LAST queued addendum (Agreement 30). Refines already-signed Line-2 scope; anything exceeding it is flagged (§5). Nothing arriving after A5 enters A5 — it queues to A6.
single_input: _bmad-output/implementation-artifacts/sq1-track-handoff-to-bmad-2026-07-05.md (§0–§8 FROZEN as delivered; §9 = the P1–P9 key table John appended)
routing_rule: every item cites its P## (the Part-2 handoff is A5's foreign key, exactly as H## is A3's and L## is A4's). An item with no P## does not enter this Addendum.
critical_discipline: A5 amends CONSOLIDATED story files (17.5, 17.4, 17.3b, 17f.2, 17.16). It does NOT rewrite them. Each amendment lands as a NEW ledger §A fold row appended to that story's chain; SM Bob folds only those files at the A5 fold step. Corrections reopen; additions queue — these are additions.
evidence_pin: catalog SHA 667ebdd8 (104,396 records) — no rebuild; both detectors reproduce their worked cases (Kolade B, Oke C) at this pin.
---

# Sprint Change Proposal — Addendum 5 to SCP 2026-04-15 (DRAFT)

## The three-species reconciliation framework — grading findings, not accusing

- **Date drafted:** 2026-07-09
- **Author:** PM John — for Awwal Lawal (PO) ratification, then Fable second-read
- **Status:** **DRAFT — the last queued addendum.** Refines Line-2-signed scope; requests PO ratification of four routing decisions (§5); no authorisation gate of its own beyond that (the signed envelope already covers reconciliation detection). Second-read by the non-authoring agent (Fable) before any fold.

---

## Section 0 — Executive summary

The SQ-1 engine track's Part-2 handoff (`sq1-track-handoff-to-bmad-2026-07-05.md`) delivers one reusable idea and two new detection methods that push **past** the Part-1 detection ceiling **without inventing certainty**. The idea: **reconciliation findings are evidence-graded, not binary** — every finding carries a grade (**proven / projected / rewound**) and a **named resolver document**, never a bare "anomaly." This is the 17f.2 provenance concept (`BalanceProvenance`, `deriveProvenance`) lifted from balances to findings, and it is what keeps the non-punitive promise honest at portfolio scale: *below-zero = proven; projected = estimated, pending one payslip.* The difference between "we accuse" and "we ask for one document."

**The three species (all reproducible at pin 667ebdd8):**

| Species | Detects | Provable from returns? | Portfolio | Resolver |
|---|---|---|---|---|
| **A — balance below zero** | deductions continued past completion | **proven** | 202 (₦8.63M) | payslip ≥ magnitude |
| **B — frozen-balance projection** | near-complete loan froze/vanished while owing | **projected (bounded)** | 311 (₦11.6M ceiling) | payslip for the quiet months |
| **C — transfer restatement** | receiving MDA resumes at a lower paid-count | **rewound (bounded)** | 29 physical / 21 reporting-layer (₦3.27M ceiling) | transfer-window payroll |

**The master conclusion (P7):** every species' worklist terminates in a specific payroll/payslip request — so **payroll-cash ingestion (Story 17.3b / pillar C / W1) is the single resolver for the entire finding portfolio**, not merely the path to in-flight detection. It is already the first foundation-repair dependency; A5 records that it is *also* what closes A, B, and C.

**What A5 does** — routes the nine P-keyed findings:

| Provenance | Destination | Section |
|---|---|---|
| SPEC | PRD delta — FR117 (evidence-graded finding model, P1) + FR118 (structured payroll-request worklists, P8) + a payroll-as-master-resolver scope statement (P7) | §2 |
| PLAN | 1 blocking AC + 4 amendments as **new fold rows** on consolidated files: 17.5 (P4/P5), 17.4 (P4 tie), 17.3b (P7), 17f.2 (P1), 17.16 (P9) | §3 |
| BUILD | Species B/C proactive worklists → 16.1 / conservation (17f.6); cohort detection (P6) | §4 |
| — | PO ratification of the four Part-2 §7 routing questions | §5 |

**The highest-leverage item, named plainly:** the **transfer continuity guard (P4)** is a *blocking* AC on the transfer handshake — it *prevents* the next over-recovery at the source (a backward restatement becomes a blocking reconciliation event, not a silent overwrite), rather than only detecting it after the money moves. 17.5's consolidated file already carries the placeholder AC and a `SPRINT-BLOCKED` banner waiting for exactly this text.

---

## Section 1 — Routing table (P1–P9)

| P# | Finding | Provenance | A5 route |
|---|---|---|---|
| P1 | Evidence-graded finding model | SPEC | **FR117** + fold row on **17f.2** (§2.1, §3.4) |
| P2 | Species B detector + projection worklist (311) | BUILD+SPEC | **16.1 / 17f.6** proactive worklist (§4.1) |
| P3 | Species C detector + physical-transfer worklist (29) | BUILD | **16.1 / 17f.6** proactive worklist (§4.1) |
| P4 | Transfer continuity guard (**blocking**) | PLAN | **blocking AC** — fold rows on **17.5** + **17.4** (§3.1, §3.2) |
| P5 | Collector/parent-MDA registry | BUILD | fold row on **17.5** (seed on existing `mdas.parentMdaId`) (§3.1, §4.2) |
| P6 | Cohort/batch detection | BUILD | rides the Species-C worklist story (§4.1) |
| P7 | Payroll ingestion = master resolver | SPEC | scope statement + fold row on **17.3b** (§2.3, §3.3) |
| P8 | Structured payroll-ask worklist output | SPEC/BUILD | **FR118** + rides 17.3b / worklist stories (§2.2) |
| P9 | Kolade (B) + Oke (C) golden-set fixtures | fixtures | fold row on **17.16** (§3.5) |

---

## Section 2 — SPEC → PRD Delta (into the same PRD Delta Addendum as A3 §2 / A4 §1)

### 2.1 FR117 — Evidence-graded reconciliation findings [P1]

Every reconciliation finding the system surfaces carries: (a) an **evidence grade** — `proven` (provable from returns, e.g. Species A balance-below-zero), `projected` (bounded estimate from a frozen/near-complete balance, Species B), or `rewound` (bounded estimate from a cross-MDA restatement, Species C); and (b) a **named resolver** — the specific document that would confirm it (e.g. "FIRE payslip, Sep–Nov 2025"). **No finding may wear an "over-deducted" / settled label on a `projected` or `rewound` grade** — those are two-sided reconciliation gaps pending evidence, never accusations. This is the 17f.2 `BalanceProvenance` concept extended from balances to findings; it generalises Team Agreement 29 (imputed never wears the clothes of observed) to the finding layer. Anchors the 17f.2 fold row (§3.4).

### 2.2 FR118 — Structured payroll-request worklists [P8]

The system's data-request workflow emits reconciliation worklists as **structured payroll asks** — `{person, MDA, month-range, expected-resolver}` rows — not free-text. Each finding's resolver (FR117) becomes a machine-actionable request the Car Loan Department / Dept Admin can dispatch and track. The SQ-1 detectors already produce exactly this shape; the app mirrors it. Extends the A3 DATA-memo pattern from ad-hoc memos to a standing surface; feeds the payroll-intake side (17.3b).

### 2.3 Payroll-as-master-resolver scope statement [P7]

Extends A3 §1's detection-ceiling statement: **payroll-cash ingestion (17.3b / pillar C / W1) is the single resolver for the whole finding portfolio — A-confirmation, B, and C alike.** Every worklist terminates in a payroll ask; payroll ingestion is therefore not only the prerequisite for in-flight detection (A3) but the closing evidence for the projected and rewound species. Sequencing consequence: 17.3b's priority is reaffirmed as the master resolver; the B/C worklists are its consumers.

---

## Section 3 — PLAN → amendments as NEW ledger fold rows (consolidated files NOT rewritten)

> Each item below is a **new fold row** appended to the named consolidated story file's chain in ledger §A. SM Bob folds these at the A5 fold step; A5 itself does not edit the story files. The rows are listed for approval in §6.

### 3.1 Story 17.5 — Transfer continuity guard + collector registry [P4, P5]

**The blocking AC (P4)** — replaces 17.5's placeholder AC (the `SPRINT-BLOCKED` banner lifts on this text): *On any cross-MDA reassignment, the receiving MDA MUST carry forward the sending MDA's true installments-paid. A **backward restatement** (receiving paid-count < sending paid-count, with the balance jumping up by ~Δ×monthly) is a **blocking reconciliation event** — it halts the handshake for adjudication, never silently overwrites the loan's progress.* Arithmetic guard: the balance must jump by ~Δ×monthly (rejects new-loan-of-same-principal false positives — Species C's own guard). Ties to the W2 schema's `loan_mda_reassignments` + `person_loans` (the reassignment is evented; the continuity check runs at that event). Evidence: Oke Elizabeth (Agriculture paid 38 → Education resumed paid 35, +₦33,999 = 3×₦11,333).

**Collector/parent-MDA registry (P5)** — seed, not schema (the schema exists: `mdas.parentMdaId` + the shipped 17.21 fragment `is_autonomous` / `reporting_parent_mda`). Flag CDU / AANFE(ANFE) as **collecting units** so a "receiving MDA" that is actually a central collector produces a **reporting-layer** classification, never a physical-transfer / duplicate-deduction finding. PO-confirmed 2026-07-05: Agriculture↔CDU is exactly this pair. The 21 reporting-layer cases must never enter the transfer queue.

### 3.2 Story 17.4 — Identity-side tie for the continuity guard [P4]

Fold row: the continuity guard (17.5) resolves the transferring person by **confident identity** — OYSG ID, else name + principal + monthly — and **segments loans by principal** so sequential loans are never fused into a false restatement. This is the identity-layer half of P4; it consumes 17.4's PIS resolution and the W2 `person_loans` linkage. No new matching logic — it reuses PIS and adds the principal-segmentation guard already proven in `transfer-restatement.ts`.

### 3.3 Story 17.3b — Master-resolver framing + worklist consumption [P7]

Fold row: 17.3b (payroll snapshot ingestion) is the **master resolver** for the finding portfolio; its payroll data closes A-confirmation, B, and C. The three worklists (§4) are its consumers — each emits a structured payroll ask (FR118) that 17.3b's ingested snapshots answer. Reaffirms 17.3b's sequencing priority (already first in the 17a Sprint-1 plan for identity anchoring; A5 adds the resolver role).

### 3.4 Story 17f.2 — Evidence-graded findings extension [P1]

Fold row: extend 17f.2's provenance model (shipped `BalanceProvenance` / `deriveProvenance` / `dataBasis`) from **balances** to **reconciliation findings** — the grade enum gains the finding-level values `proven` / `projected` / `rewound` and a `resolver` field (FR117). 17f.2 is a *shipped* story (the chip); this fold row records the extension as forward work, consistent with 17f.2's "formalisation of shipped work" status — the extension itself builds under the worklist stories (§4), reusing the shipped primitive.

### 3.5 Story 17.16 — Golden-set fixtures [P9]

Fold row: **Kolade Taiwo Amos** (Species B, frozen at ₦42,498.75 / 5 deductions left / FIRE) and **Oke Elizabeth Folashade** (Species C, ₦600k / Agriculture→Education / +₦33,999) join the golden regression set as canonical B/C anchors (Agreement 15/24 parity), alongside the 47-case harness. Both reproduce at pin 667ebdd8 via `projection-register.ts` / `transfer-restatement.ts`.

---

## Section 4 — BUILD → proactive detection layers

### 4.1 Species A + B + C proactive worklists [P2, P3, P6] → Story 16.1 / conservation (17f.6)

The app runs the three detectors proactively over the portfolio and emits **payslip-request worklists** (FR118), never refund figures. Output per species: the finding, its grade (FR117), its named resolver, and — for C — its **cohort** (P6: batch re-baselining events like BIR→Works ×4 surface as *one handoff fix*, not N cases). DELTA-per-refresh watches for newly-crossed and newly-resolved (conservation applied to the register — A3 §3 / 17f.6). These are BUILD items on 16.1 (cross-month diffing, already blocked-by 17.12) and the conservation story (17f.6); they inherit 17f.6's proactive-Species-A worklist and add B and C. **No new epic** — the worklists are surfaces on existing stories, governed by the evidence-grade model so a projected/rewound case never renders as an accusation.

### 4.2 Collector registry seed [P5] — see §3.1

Seeded on existing schema; noted here so the BUILD list is complete. The seed is reference data (CDU/AANFE as collectors), not a migration.

---

## Section 5 — PO decision list (the four Part-2 §7 ratifications)

Each carries the Fable §H recommendation as PM John's recommendation, for one-pass ratification:

| # | Question [P#] | Recommendation |
|---|---|---|
| R-1 | **Proactive vs on-demand** for B/C (311 / 50 cases) [P2/P3] | **Proactive generation, reviewed consumption** — sweeps run per catalog refresh (cheap), but findings land in a payslip-request review queue gated by the evidence grade; nothing auto-acts. Large worklists are fine because they are *asks*, not accusations. |
| R-2 | **Threshold governance** — B's "≤6 deductions remaining", C's rewind guards [P2/P3] | **Ops-editable versioned config** (the Winston W2 §7.2 pattern — same as the diminutive/typo maps), with a `detector_ruleset_version` stamp on every worklist row, so threshold changes are detectable and never silent. |
| R-3 | **Collector registry** — CDU/AANFE modelled or net-new? [P5] | **Seed on existing schema** — `mdas.parentMdaId` + the shipped 17.21 fragment already model parent/child; A5 seeds the collector semantics. Not net-new reference data. |
| R-4 | **Do B/C findings post to the ledger?** [P1] | **No** — "moves value → posts; moves knowledge → decides." Projected/rewound findings are *knowledge*: they live as evidence-graded observations in the review surface until a payslip confirms. Only an AG-authorised refund posts (the H7 REFUND/REVERSAL entry types via 17.26). The ledger never carries an estimate. |

---

## Section 6 — Proposed new ledger §A fold rows (for approval; Bob folds at the A5 fold step)

| Consolidated file | Appended fold-chain row |
|---|---|
| `17-5-person-link-candidates-transfer-handshake-wiring.md` | **→ A5 §3.1 [P4/P5]:** replace placeholder AC with the transfer continuity guard (blocking; backward-restatement = blocking reconciliation event; arithmetic Δ×monthly guard; ties W2 `loan_mda_reassignments`/`person_loans`) + collector/parent registry seed (CDU/AANFE as collectors; reporting-layer ≠ transfer). **Lifts the `SPRINT-BLOCKED` banner.** |
| `17-4-person-identity-service.md` | **→ A5 §3.2 [P4]:** identity-side tie — confident-identity resolution + principal-segmentation guard for the continuity check (reuses PIS + `person_loans`). |
| `17-3b-mda-payroll-snapshot-ingestion.md` | **→ A5 §3.3 [P7]:** master-resolver role — closes A-confirm/B/C; consumes the structured payroll asks (FR118). |
| `17f-2-staleness-disclosure-chip.md` | **→ A5 §3.4 [P1]:** evidence-graded findings — extend provenance (`proven`/`projected`/`rewound` + `resolver`) from balances to findings (FR117). |
| `17-16-idempotency-property-test-framework.md` | **→ A5 §3.5 [P9]:** Kolade (B) + Oke (C) join the golden set (Agreement 15/24 parity). |

**Targets without a consolidated file yet (routed at story-creation, not a fold row):** 16.1 + conservation (17f.6) receive the Species A/B/C proactive-worklist requirement (§4.1) when their stories are created; FR117/FR118 land in the PRD Delta Addendum (John). Recorded here so the Step-A5-fold reconciles (conservation applied to the ledger itself).

---

## Section 7 — Second-read handoff: Fable (non-authoring reader)

- **What to verify:** (1) every A5 item cites a P## and each P## routes exactly once (no dual-route); (2) the §6 fold rows are **appends**, not rewrites — no consolidated story file is edited by A5; (3) the P4 blocking AC is consistent with 17.5's existing placeholder/`SPRINT-BLOCKED` banner and with the W2 schema (`loan_mda_reassignments`/`person_loans`); (4) R-1…R-4 recommendations don't exceed Line-2-signed scope (reconciliation detection is signed; flag anything that looks like new authority); (5) FR117/FR118 don't collide with FR103–116 (§C registry).
- **Read list:** this draft; the handoff §9 P-key table; ledger §H (the queue this fulfils) + §C (FR registry) + §A rows for 17.5/17.4/17.3b/17f.2/17.16; the two worked cases (`AG-Projection-Worklist-2026-07-05.md` Kolade, `AG-Transfer-Restatement-Worklist-2026-07-05.md` Oke) if verifying the arithmetic.
- **Verify from source where testable:** Kolade/Oke reproduce at pin 667ebdd8; the P4 arithmetic guard (Δ×monthly) is in `transfer-restatement.ts`.
- **Route:** testable disagreement → falsification test; judgment calls (R-1…R-4) → Awwal, not another prose round. On PASS, Bob folds the §6 rows and does an §I-style fold-verify on just those files; then the **chain closes**.

---

## Stop-guard

**A5 is the last queued addendum.** Per Agreement 30, A5 opened only because A1–A4 are consolidated (§I.1). A5 amends consolidated files by **appending fold rows**, never rewriting them. **Do not open A6** — anything arriving after this queues to A6 as its own future cycle. On A5 fold + verify, the SCP 2026-04-15 amendment chain (A1–A5) is fully consolidated: story files are the single truth, and new work opens at A6.

*End of DRAFT. Downstream: PO ratification (§5) → Fable second-read (§7) → Bob folds the §6 rows + fold-verify → chain-closed marker in ledger §F. FR117/FR118 join the PRD Delta Addendum (John). This document edits no consolidated story file and no published addendum.*
