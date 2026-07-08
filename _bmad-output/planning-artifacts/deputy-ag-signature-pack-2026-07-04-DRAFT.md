# Deputy Accountant-General — Authorisation Pack (DRAFT)

## VLPRS: Epic 17a activation + consolidated programme scope

- **Date assembled:** 2026-07-04
- **Prepared by:** PM John, for Awwal Lawal (Product Owner) to present
- **Structure:** **TWO-LINE** (PO-confirmed 2026-07-04). Line 1 and Line 2 are independently signable; signing Line 1 alone activates the BIR pilot; signing both activates the consolidated programme scope.
- **Status:** **RE-CLOSED FOR PRESENTATION (2026-07-04, after one bounded reopen)** — all appendices seated. Appendix W (the W2-amended 17a schema design) delivered, endorsed with two riders (both resolved), and **PO-approved 2026-07-04** — the 17a design gate is satisfied and released. D-a decided (ship-and-tell; cover-note disclosure live). The SQ-1 track's final handoff (four source-verified post-freeze corrections + the detection-ceiling finding) was folded into Addendum 3 §14 under a reopen bounded to that diff; the two cover-note-level items (detection-ceiling scope; settlement-path acceptance criterion) appear in the cover note. **No open items — ready for delivery.**

---

## Cover note

Since the Sprint Change Proposal of 15 April 2026, the VLPRS programme has held its pause discipline in full: no authorisation-gated work has moved in code. In that time the team has (a) prepared the BIR identity pilot to signature-readiness (April 20), (b) run a full portfolio report cycle for the Accountant-General that field-tested the ingest machinery at scale and produced twenty documented lessons (May), and (c) completed a dual-agent adversarial audit of the entire system — two independent reviews, blind to each other, every disagreement settled by a reproducible test on the actual system, zero settled by argument — locked into a 26-item register backed by an automated verification harness (July). All of it has been consolidated into a single traceability ledger: one registry of every numbered artifact, one fold-order for every amended story, every collision between amendment documents identified and resolved, and the consolidation itself passed through a bounded adversarial second-read whose trail is recorded. What follows asks for two signatures. **Line 1 is the identical request that has been ready since 20 April** — activation of the BIR identity pilot, unchanged in scope. **Line 2 authorises the consolidated repair-and-plan scope** the audits require, sequenced so that foundation repairs land before anything multiplies on top of them. Nothing in this pack authorises itself; the only items already moving are two data-request memos to your office that require no authorisation.

One disclosure fix has been applied under the existing envelope, and we tell you rather than ask: every computed figure in the application now states the date-basis of the number it shows. It changes no computation, no data, and no authority; it exists so that no operator reads a frozen figure as a live one.

Two scope boundaries are stated plainly here rather than discovered later. **First**, the legacy monthly returns can prove only one kind of over-deduction — deductions that continued after a loan was already complete (a balance driven below zero); they cannot reveal excess deductions on a still-running loan, because a return's balance column restates the repayment schedule rather than observing cash. Detecting in-flight over-deduction therefore requires payroll-cash ingestion — which is precisely what the first foundation-repair story in Line 2 provides. Nothing in this pack promises the impossible from returns alone. **Second**, staff legitimately choose faster repayment (shorter tenure, higher monthly) under the scheme's own rules — 1,662 such cases exist in the portfolio — so every over-deduction detector this programme builds is bound by a blocking acceptance criterion to check the borrower's chosen repayment path before raising any observation. A scheme that flagged legitimate early repayment as wrongdoing would forfeit the very trust this system exists to build.

---

## LINE 1 — Activate Epic 17a (BIR Identity Pilot)

**The ask, unchanged since 2026-04-20:** authorise the 17a Identity Foundation pilot per `DEPUTY_AG_BRIEF_2026-04-20.md` — six stories (parser port, Yoruba name canonicaliser, Identity Anchor Ingest, Person Identity Service, namesake disambiguation modal, pilot observability dashboard), 37 story points, 2–3 sprints, scoped to the Board of Internal Revenue only, additive-only at the data layer, rollback = drop the new tables. Nine hard Go gates govern activation (coverage ≥85% — already achieved at 86%; zero false-merges; golden fixtures green; native-speaker review; staged rollback tested; your own drill-down audit; and this signature).

**What has changed since April — two additions *inside* the envelope, neither expanding it:**
1. **Schema gate (design input):** the pilot's schema design is amended by an architect brief before the persons table ships — *"No persons-table implementation until the W2-amended schema design is approved."* This protects the immutable financial ledger from ever carrying identity attributions that later knowledge would contradict. It costs sequence, not scope. *(Appendix W — delivered, independently verified, and PO-approved 2026-07-04; the gate is satisfied. The approved design confirmed the underlying defect from source, added zero scope requests, and governs the pilot's identity migrations from Sprint 1.)*
2. **Canonicaliser review re-scope (design input):** the pending native-speaker review now covers the original 9 spelling rules plus a ~30-pair Yoruba diminutive map and name-order handling, all field-validated during the May report cycle. If reviewer availability binds, the staged option is: review the 9 rules for pilot activation, with the diminutive map as a fast-follow inside the same review process.

**Consequence of signing Line 1:** Sprint 1 starts at T+0 per the sprint plan, with the approved schema design (Appendix W) governing the identity migrations from day one — the design critical path has already been cleared.

**Signature — Line 1:** Approved ______________________________  Date: 05/07/2026____________

---

## LINE 2 — Authorise the consolidated programme scope

One signature covering four amendment documents, consolidated in `scp-consolidation-ledger.md` (every number allocated, every overlap resolved, second-read trail recorded):

| Component | Substance |
|---|---|
| **Addendum 2 (residual)** | The Epic 17 split structure (17a / 17b retrofit / 17c workflows + Epic 18 as input-only), with 17b/17c remaining paused pending their own post-pilot authorisations |
| **Addendum 3 — Ledger Reframe** (H##-keyed, test-verified) | New sub-epic **17f Foundation Repair** (7 stories: connect submissions to the financial ledger; disclosure chip; quarantine-not-reject intake; one computation engine; unified persistent reconciliation; conservation of loan endings; unified non-punitive review worklist) — sequenced **before any 17b retrofit**; PRD delta (FR103–107, numbering repair, epistemics statement, information-architecture section); three destination epic charters (statements issued to MDAs; borrower statements & attestation; navigation redesign); Team Agreements 27–29 |
| **Addendum 4 — Field Lessons** (L##-keyed, field-validated) | Ingest and identity hardening from the May report cycle: FR108–110; 2 new stories; 14 story amendments, each with a working engine-side reference implementation |
| **Addendum 1 reconciliation** | The six requirements published in April as named-but-unnumbered, now allocated FR111–116 |
| **Team Agreement 30** | Single allocation registry for all numbered artifacts; one open addendum at a time; story truth consolidates into story files after signature |

**The binding sequencing rule inside Line 2:** foundation repairs (posting, re-keying, quarantine intake) land **before** the 17b retrofit multiplies consumers on the current foundation. Order: 17a → 17f → 17b → 17c.

**Signature — Line 2:** Approved ______________________________  Date: 05/07/2026____________

> *Transcription note (SM Bob, 2026-07-06): the Deputy AG signed both lines on the physical pack 2026-07-05. Line 1 was transcribed at §I step 2; Line 2 was found untranscribed during the step-3 pre-fold verification and completed here on PO confirmation (Awwal, 2026-07-06). No content of the pack has been altered — signature blocks only.*

---

## Decision list

**Deputy AG adjudication (from Addendum 2 §1.5):**
| # | Question | Authority | Position presented |
|---|---|---|---|
| 1 | Native-Yoruba-speaker reviewer for the canonicaliser rules — who / when | PO schedules; 17a-blocking (Go gate G5) | PO to name reviewer at signing; staged option recorded under Line 1 |
| 2 | Roster-collection workstream ownership beyond BIR | Post-pilot (17b) | No-op for Line 1; rides the 17b authorisation |
| 3 | Public-website lookup retrofit (auth-gate vs disambiguation) | 17b + legal counsel | Explicitly deferred; flagged for privacy/legal review — no signature requested now |
| 4 | Epic 18 (Historical Data Governance) creation | Deputy AG, post-go-live | Remains input-only; acknowledgement, not authorisation |

**PO decisions (recommendations restated from Addendum 3 §10):**
| # | Decision | Recommendation (one sentence) |
|---|---|---|
| D-a | Staleness-disclosure chip pre-authorisation | **CLOSED — PO decided ship-and-tell, 2026-07-04.** The chip ships as pure disclosure under the current envelope; the cover note discloses it (sentence above). Story 17f.2 becomes the formalisation of an already-shipped disclosure rather than new work |
| D-b | Borrower-statement pull-forward (NDPR right-of-access) | Charter now, FR anchored now, build after the posting repair — a statement issued off an unfed ledger would be a false statement |
| D-c | Portfolio sweep (104,396 records at the live catalog pin) | Authorise with the recorded guardrails: detectors pass the golden harness first; no refund tier without instrument grading; priority = still-deducting cases first; every re-run diffed against the prior snapshot |

*Pack-shape question: CLOSED — two-line, PO-confirmed 2026-07-04.*

---

## What this pack does NOT ask

- No expansion of the 17a pilot envelope (both April-to-July additions are design inputs inside it, sequenced gates, not scope).
- No 17b / 17c / Epic 18 activation — each retains its own later authorisation gate.
- No retroactive editing of any financial record, frozen register, or published document — the entire method is append-and-consolidate.

## After signature

Line 1 → Sprint 1 starts (sprint plan: `sm-bob-17a-sprint-plan-2026-04-20.md`). Line 2 → the consolidation fold produces one authoritative story file per amended story (SM Bob), the PRD delta is drafted, the UX specification proceeds (Sally), and sprint-status is wired once — after which the four addenda become history and the story files become the single truth.

---

## Appendices

| # | Document | Status |
|---|---|---|
| A | `DEPUTY_AG_BRIEF_2026-04-20.md` + `scp-addendum-2-2026-04-20-DRAFT.md` | Ready (April, unchanged) |
| B | `scp-addendum-3-2026-07-04-DRAFT.md` (+ frozen evidence: `harmonised-findings-2026-07-04.md`, H1–H26) | Ready |
| C | `scp-addendum-4-2026-07-04-DRAFT.md` (+ lessons register L1–L20) | Ready |
| D | `scp-consolidation-ledger.md` (registry, fold-order, collision register, second-read trail §G/§G.1) | Ready |
| E | `scp-2026-04-15-addendum-1.md` | Published 2026-04-18 (reference) |
| **W** | `architect-winston-17a-schema-2026-07-04-W2-AMENDED.md` | **Ready — approved by PO 2026-07-04** after independent source verification (H3 falsification re-run: PASS, all four legs) and the W2-brief author's endorsement; zero scope requests beyond the pilot envelope; its three shipped-surface implementation touches (single-mutator call sites, one ledger-reader migration, write-seam consolidation) were flagged by the architect rather than absorbed, and are confirmed inside the amended 17a schema story by the same approval |
