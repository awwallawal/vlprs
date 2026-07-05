# Harmonised Findings — Single BMAD Input (2026-07-04)

**What this is:** the pooled output of the two independent reviews — the session-log agent's Foundation Audit (§8–§12 of `session-log-2026-07-02-overdeduction-sweep-and-ledger-reframe.md`) and the Fable critique (`app-foundation-critique-INDEPENDENT-fable-2026-07-03.md`) — harmonised per the agreed protocol: disagreements resolved by test (not prose), unique finds cross-verified before pooling, provenance labelled on every finding.
**Supersedes** both source files as the input to the BMAD Method Pipeline. Source files remain as evidence trail.
**Verification session:** 2026-07-04 — all tests below were run fresh (greps/reads with file:line evidence, plus the promoted regression harness). Result of a test outranks any prose in either source file.

---

## 1. Unified verdict

**MODIFY / RE-CHARTER — do not rebuild, do not keep building as-is.** Both reviews reached this independently. Merged statement:

> The app's skeleton (append-only ledger, computed-not-stored balance, scheme-formula engine, state machine, decimal money math, non-punitive vocabulary system) is sound and expensive to rebuild — keep it. The foundational error is **epistemic**: the system was architected to *collect freestyle and detect after the fact* when the domain requires it to *issue, post, and attest*. Concretely that epistemic error has **three structural expressions no planned story covers** — the ledger is never fed (F1), identity repair corrupts immutable history (F2), and intake rejects the unknown (F3) — plus a set of missing organs (refund rails, statement issuance, borrower attestation, opening-balance closure) that Epic 17/SCP planning partially anticipates. Repair is concentrated and enumerable; sequence the three structural repairs **before** Epic 17b multiplies consumers on the current foundation.

---

## 2. Findings register (pooled, cross-verified)

Legend — **Status:** CONFIRMED = verified by test this session (evidence cited); AGREED = both reviews independently, no test needed. **Provenance:** BUILD = build defect · SPEC = PRD/spec gap · PLAN = planning gap (no story) · DATA = source-data gap · PROC = process. **Origin:** F = Fable · S = session-log agent · B = both.

| # | Finding | Status | Provenance | Origin | BMAD lane |
|---|---|---|---|---|---|
| H1 | **Ledger starvation:** only producers of ledger entries are migration baseline (`baselineService.ts:502,783`) + manual admin endpoint (`ledgerRoutes.ts:27`); `submissionService.ts` and `payrollUploadService.ts` contain **zero** occurrences of "ledger" (grep 2026-07-04). All computed surfaces (dashboard, reports, loan detail) present baseline-frozen numbers as live truth; auto-stop unreachable from ongoing deductions; `monthlyRecovery` ≈ ₦0; **60-day inactivity detector reads PAYROLL entries that never exist** (`loanService.ts:241–243`). | CONFIRMED | **SPEC** (see H2) | F | **W1** — new posting FR + stories; stopgap staleness-disclosure story |
| H2 | **H1's root cause is PRD under-specification:** no FR requires submissions to post to the ledger; FR16–24 stop at confirm; intent lives only in Journeys 1/4/10. Faithfully implemented spec gap, not a dev error. | CONFIRMED | SPEC/PROC | F | PRD delta + team agreement TA-A ("journeys must compile into FRs") |
| H3 | **Identity repair corrupts immutable history:** `updateStaffId` (`loanService.ts:585`), dedup reassign (`deduplicationService.ts:420`), transfer completion (`employmentEventService.ts:468`) all mutate `loans` while `ledger_entries`' denormalised `staffId`/`mdaId` stay stale — grep 2026-07-04: dedup + employmentEvent services have **zero** ledgerEntries references. Immutability trigger makes stale keys uncorrectable. 17a (persons/PIS) will multiply re-attributions with no re-keying story. | CONFIRMED | BUILD + PLAN | B (S: transfer-orphan; F: all three + uncorrectable-by-design) | **W2** — re-key history-safe, designed into 17a schema NOW |
| H4 | **Closed-world intake:** one unknown staffId 422-rejects the entire submission file (`submissionService.ts:358`); RECORD_WITHOUT_APPROVAL (3,290 register cases) cannot arrive through the front door; whole-file rejection trains MDAs to censor returns. | CONFIRMED | BUILD + PLAN | F | **W3** — quarantine lane (FR96 `pending_verification` is the anchor) |
| H5 | **Production parser is an 8-column positional CSV no MDA produces** (`fileParser.ts:77–84`, `row[0]..row[7]`); the real 42-template parser is the uncommitted SQ-1 engine. | CONFIRMED | BUILD | S | Story 17.2 (parser port) — elevated priority |
| H6 | **Two interest models + no calendar anchor + 3-way fork:** `computeRepaymentSchedule` trusts stored `interestRate` (`computationEngine.ts:8–10`) beside `computeSchemeExpected` (`:203`); **no `startDate` in the engine** (grep) → cannot impute a balance for a named month; physical fork confirmed at `auditor-station/vendor/loan-model.ts` + SQ-1 copy. | CONFIRMED | BUILD | S | Lift engine to `packages/shared`, single scheme path, calendar-anchored projector |
| H7 | **No REFUND/REVERSAL entry type:** enum = PAYROLL/ADJUSTMENT/MIGRATION_BASELINE/WRITE_OFF only (`schema.ts:71–72`); planned 17.26 ends in certificate reissue, not a money event. | CONFIRMED | PLAN | F | Amend 17.26: refund must terminate in a ledger event |
| H8 | **No refund/correction rails today:** resolution enum = verified_correct/adjusted_record/referred_to_mda/no_action_required; "process refund" is prose only; exception resolution has zero financial effect (status theatre). | AGREED | PLAN | B | 17.25/17.26 build + AG-sole-authority FR (decision locked 2026-07-03) |
| H9 | **Punitive Exception queue violates FR22:** "Flag Exception" / AlertTriangle / `ghost_deduction` present across 14 client files incl. `ExceptionsPage.tsx` (grep 2026-07-04). | CONFIRMED | BUILD | S | UX/IA cluster 3 — unify into non-punitive "For Review" worklist |
| H10 | **Fail-open parsing:** unrecognised columns/null-financial rows silently dropped; "not reported" ≡ "parser missed it"; PARSER_BLIND exists only in proposals. | **ASSERTED** — survey-based, not grep-confirmed; verify at story time (D1 down-rank, accepted 2026-07-04) | BUILD | S | 17.17 PARSER_BLIND fourth state — verification is AC #1 |
| H11 | **No person entity; identity is a string** (`loans.staffId` non-unique varchar; synthetic `MIG-…` IDs; `personMatches` operationally inert). | AGREED | PLAN (17.3/17.4 planned, unbuilt) | B | Ride 17a; H3 rides the same schema work |
| H12 | **No conservation:** "vanished" is not a state; baseline-created ACTIVE loans stay ACTIVE forever; no terminal-event enforcement. | AGREED | BUILD + PLAN | B | Conservation stories; register lifecycle (§5) is the interim control |
| H13 | **Statement issuance absent everywhere** (build + planning + PRD). | AGREED | PLAN + SPEC | B | New epic E-issuance (destination — after W1 + archaeology maturity) |
| H14 | **Borrower surface absent; attestation net-new** (PRD defers dashboard to Phase 2; no dispute FR). | AGREED | PLAN + SPEC | B | New epic F-attestation, extending planned Phase-2 dashboard; NDPR right-of-access strengthens pull-forward |
| H15 | **Opening-balance closure lacks seal + materiality semantics** (blocks exist: 3.4/8.0j/17.33). | AGREED | PLAN | B | Amend 17.33 + new materiality FR; termination metric "% loans attested" |
| H16 | **Reconciliation fragmented, no accounting force:** four variance taxonomies; three-way compares JSONB blobs against frozen `loans.monthlyDeductionAmount`, not fresh scheme recomputation. | AGREED | BUILD | S | UNIFY+PERSIST layer stories |
| H17 | **approvedBeneficiaries cannot anchor loan birth** (no tenure/rate; text dates) + no approval↔loan FK. | AGREED | BUILD + PLAN | F | Origination provenance-grade amendment (with H18) |
| H18 | **"Born at approval" softened to origin-graded, approval-preferred** — approval covers only a subset (3,290 RECORD_WITHOUT_APPROVAL; pre-2024 no register); converges with 17.8 fingerprints. Both reviews self-critiqued to the same softening. | AGREED | — (frame) | B | Reframe commitment #2 as amended; SCP language |
| H19 | **47-case validation:** honest untouched-sweep catch = **4/46 (~9%)**; dominant miss = Species B in-flight (18–20 NEVER_CROSSED_ZERO), invisible to any balance-endpoint detector; Species B is detectable via **delta-vs-scheme slope** (verified: Oke Elizabeth 11,333/mo vs 10,200 scheme). | CONFIRMED (test-resolved; harness locks it) | — (validation) | B (F: census + hurdles; S: species framing + slope method) | Slope detector = #1 SQ-1 hardening; app story 16.1/pillar B |
| H20 | **LIVE_BELOW_ZERO class** — below zero AND still on latest return (Adeleke): most urgent, excluded by the sweep by design. | CONFIRMED (grep: absent from sweep output; gap<1 exclusion at `_tmp-zero-vanish.ts:46`) | — | F (flagged) + S (verified & adopted) | Detector: drop vanish requirement; top of AG register |
| H21 | **LOAN_CYCLE class** — second loan concatenated in same (MDA,name) thread (#9/#37/#38 + #34 claim-side; jumps like 14,166→668,647). Slope/transfer projections MUST segment at zero-reset + exclude stale months — **one shared segmentation utility, two consumers.** | CONFIRMED (harness) | — | F | Harness + detector design constraint; schema story (sequential-vs-concurrent loans, F's S4) |
| H22 | **Cross-MDA transfer re-tiering** — cross-MDA match = transfer hypothesis to verify, not namesake to discard ("MDA-gate and discard" retracted); transfer-projection method defined (name-strength + monthly-equality + timing + schedule projection; imputed ≠ observed). | AGREED | — | S (Awwal-prompted) | Register T2/T4 lanes; step-b transfer test |
| H23 | **Alias correction (NEW this session):** HOS ≡ Head of Service, CSC ≡ Civil Service Commission, OYSPHB ≡ Primary Health Care Board were missing from tally scripts. Corrected scope tally: **SAME_MDA 25 / CROSS_MDA 11 / DARK 10 / NO_NAME 1** (supersedes 21/15/10/1). **Samson = SAME_MDA (HOS)** → needs data review of his −69,998 tail, NOT a transfer check; **Olawoyin = CSC STALE_FLATLINE**; **Adeyemi = OYSPHB NULL_BALANCE**. | CONFIRMED (harness PASS) | — | Harmonisation | Register re-tier; resolver alias list (RESOLVER_ALIAS_MISSING class already exists in SCP Addendum 1) |
| H24 | **OYSHMB never submitted** (Awwal-confirmed): 7 dark + 1 no-name + cross-MDA hypotheses = the unresolvable-from-catalog set; ~₦1.08M claims. Source-acquisition problem, not detection. | AGREED | DATA | B | T5 data-request memo to AG office |
| H25 | **Case nuggets with story impact:** Aliyu's missing February = the `2025-00` period-parse defect record (bug now has a claimant); **Bakare 2-vs-3-month off-by-one** — whether the zero-landing month's deduction was owed changes refund quantum (₦51,874 vs ₦34,582) → must be an explicit rule in 17.26 acceptance criteria; #26 no-name traceable by amount (30 FINANCE candidates); catalog max period = 2026-04. | CONFIRMED | — | F | Period-parser fix; 17.26 AC; intake practice (capture staff ID from payslip at claim intake) |
| H26 | **WRONG_RATE mechanism (accepted from §8.1 A2):** deduction taken at a rate ≠ the loan's scheme-derived monthly — the mismatch itself is the over-deduction. A **mechanism** label (with post-completion / schedule-overrun / lump-sum), not a thread-state class; applicable SAME_MDA and on confirmed transfers. Build path: extend Layer A's existing rate check (`P×0.1333×tenure/60`, ₦50 tol, 4,230 variances already found) from interest verification to deduction-conformance. | AGREED (final round) | PLAN | S (proposed) + F (refined) | Rate-conformance = third detector (with endpoint + slope); register dossier mechanism field |

## 3. Divergences — all resolved by test

| Divergence | Test run | Result |
|---|---|---|
| Baseline 5/46 vs 4+2/47 | Grep untouched sweep for ADELEKE MUIBAT | **4/46**; Adeleke → LIVE_BELOW_ZERO (S corrected own log §10.5, credited) |
| Ledger "SOUND" (S §8.2) vs starved (F F1) | Fresh greps 2026-07-04 (H1) | **Both true, one sentence:** mechanism sound, **never connected**. S §8.2 needs the starvation caveat; carried here as the authoritative wording |
| CROSS_MDA 15 vs "matched outside claim MDA" ambiguity | Harness with domain aliases (H23) | **SAME 25 / CROSS 11**; Samson & Olawoyin & Adeyemi re-tiered |
| Taxonomy naming (F classes vs S fix-classes) | — merged (below) | One taxonomy, locked in the harness |

**Merged taxonomy (locked in harness):** Scope = SAME_MDA · CROSS_MDA · DARK · NO_NAME. Class = CAUGHT_CREDIBLE · CAUGHT_REVIEW · ZERO_VANISH · ZERO_STILL_PRESENT · **LIVE_BELOW_ZERO** · NEVER_CROSSED_ZERO (Species B) · STALE_FLATLINE · NULL_BALANCE · **LOAN_CYCLE** · DARK · NO_NAME.

**Harness promoted (protocol step 3 DONE):** `scripts/legacy-report/overdeduction-regression-2026-07.ts` — **PASS** as of 2026-07-04. Locks: sweep-wide 173/32/141/694 + Lamidi-in-CREDIBLE fixture + 47-case anchors (T1 trio, Samson SAME/REVIEW, Adeleke LIVE, loan cycles, OYSHMB dark 7, alias corrections). Supersedes `_tmp-check-47.ts`, `_tmp-baseline-47.ts`, `_tmp-verify-47.ts` (delete at next hygiene pass). Uncommitted per side-quest convention.

## 4. 47-case final tally (harmonised, harness-locked)

CAUGHT_CREDIBLE 3 (Ajibade, Aliyu, Bakare — all SAME_MDA, amount-corroborated, ₦97,359 visible) · CAUGHT_REVIEW 1 (**Samson, SAME_MDA/HOS, −₦69,998 — the largest observed below-zero in the 47; reviewed-T1 priority per M2, review question = the mid-stream upward jump 169,996→329,992, not just the endpoint**) · LIVE_BELOW_ZERO 1 (Adeleke) · ZERO_VANISH 2 · ZERO_STILL_PRESENT 1 · LOAN_CYCLE 3 · STALE_FLATLINE 2 · NULL_BALANCE 5 · NEVER_CROSSED_ZERO 18 · DARK 10 · NO_NAME 1. **Untouched-sweep catch-rate ~9% — the validation set proves the reframe: the dominant claim species is invisible to report-endpoint detection.**

**AG register tiers (S §12, re-tiered by H23):** T1 observed = 3 · T1-review = Samson · LIVE = Adeleke (top of register) · T2 transfer-verify = remaining cross-MDA below-zero · T3 in-flight ≈ 18 (pending slope detector) · T4 imputed projections (Rasaki lump-sum, Foluke timing, + cross-MDA passing monthly test) · T5 unresolvable = 7 OYSHMB dark + 3 other dark + 1 no-name = 11 → data-request memo.

## 5. Unified recommendation stack → BMAD (SCP Addendum 3 candidate)

**Foundation repairs (before 17b):** **W1** post-the-loop (submission/payroll → PAYROLL events w/ provenance+confidence; immediate staleness-chip stopgap) · **W2** re-key history-safe (into 17a schema now) · **W3** open-world quarantine intake.
**Layered keep/harden/build (S §8.4, adopted with F1 caveat):** engine → shared+single-model+calendar-anchored; ledger/state-machine → harden + conservation; identity → 17a re-charter; ingestion → consolidate SQ-1 parser (17.2) + PARSER_BLIND; reconciliation → unify+persist; refund rails → build (AG sole authority, ledger-event terminal, Bakare month-rule in AC); E-issuance + F-attestation → new epics (destinations); opening-balance closure → seal+materiality; FR22 regression → fix.
**UX/IA (merged F §7 + S §9):** one spine, five altitudes; worklist-first homes; person-as-spine + global search; role ≠ persona (AG/DepAG split); six UI primitives incl. provenance chip (staleness disclosure) + three-truth panel; Role–Job–Screen matrix with story-ID-named routes, truth-type dependency sequencing behind W1, time-to-answer UAT metric; 9-cluster UX/IA epic (S §9.8) as the decomposition.
**PRD:** delta/addendum (not rewrite) per F §8.3 touch map; new FRs: posting, refund authority, issuance, attestation, materiality; two-track epistemics statement; FR91–92 numbering repair.
**Team agreements proposed:** TA-A "no load-bearing behaviour may live only in a user journey — journeys must compile into FRs" · TA-B "findings labelled independent vs post-contact; disagreements resolved by falsification test" · TA-C "imputed never wears the clothes of observed" (register guardrail, generalised).
**SQ-1 next (archaeology):** slope detector (#1) with shared zero-reset segmentation → rate-conformance detector (H26, extends Layer A) → transfer test on the 11 cross-MDA → register re-issue from harmonised tiers (M1 DONE) → OYSHMB + staff-ID data requests (IDs from payslips at intake).
**Go-forward standing register (accepted from §8.4):** two intake channels into one rolling register — **reactive** (walk-ins, Bakare model) + **proactive portfolio sweep** of all 101,338 records once detectors pass the golden harness (the 47 are the calibration set, not the population; ~173 below-zero threads portfolio-wide nobody has complained about). Sweep priority: LIVE_BELOW_ZERO first, then most-recent T1, then T3-by-magnitude. Cadence: re-run per catalog refresh; **DELTA vs prior snapshot** surfaces newly-crossed cases AND watches disappearances (a case dropping out of detector output = resolved-with-reason or regression — no case silently drains; conservation applied to the register itself). Guardrails: validate-before-scale · imputed-never-observed (TA-C) · provenance-to-source · reproducible snapshot.

## 6. Process findings (review-method blind spots)

- **F missed:** the committed-parser reality (H5), engine duality/fork (H6), FR22 regression (H9), fail-open parsing (H10) — all app-internals S's five-survey sweep caught.
- **S missed:** the starvation of the very ledger it audited as sound (H1) — the single largest miss on either side; the PRD root-cause method (H2); the uncorrectable-by-design angle (H3); intake rejection (H4).
- **Both missed until data forced it:** LIVE_BELOW_ZERO (needed case #42), LOAN_CYCLE (needed #9/#37/#38), the alias gaps (needed the tally disagreement). **Lesson: the validation set found classes no code review found — keep golden-set validation in every future audit.**
- **Blind-read compromise:** other agent read the sequestered prep; logged honestly (their open item (e)). Disposition: acceptable — provenance markers preserved, contaminated conclusions were settled by deciding tests. TA-B codifies the rule going forward.

## 7. Look-over checklist (for the other agent's final pass)

1. Re-run `overdeduction-regression-2026-07.ts` — confirm PASS independently.
2. Verify H1 greps yourself (the one finding your log still lists as SOUND): `grep -i ledger apps/server/src/services/submissionService.ts payrollUploadService.ts` → expect zero hits; then add the caveat to your §8.2 or accept this doc's wording.
3. Check the H23 alias corrections against your `_tmp-tally-47.ts` (add HOS/CSC/OYSPHB and confirm 25/11/10/1); note Samson's re-route (data review, not transfer check).
4. Confirm H7 (no REFUND entryType) and H25's Bakare month-rule belong in 17.26's ACs.
5. Anything in your §11.4 transfer-projection or §12 register spec that this doc's re-tiering breaks — flag it.
6. Anything missed entirely — the register (§2) has 25 rows; challenge any Status/Provenance/Lane cell.

**Open items for Awwal (PO decisions at BMAD entry):** (a) promote-harness-first vs slope-detector-first → harness is DONE, so slope detector is unblocked and next; (b) borrower-statement pull-forward timing (Phase-2 vs earlier, NDPR argument); (c) whether W1 stopgap (staleness chip) ships pre-authorisation as a disclosure fix under the current SCP envelope; (d) OYSHMB + staff-ID data-request memos to the AG office.

---

## 8. Addendum — session-log (Opus) agent's final pass (2026-07-04)

**Nature:** appended layer, non-destructive — it does NOT rewrite the pooled findings §2. Each item carries a reason and a **Fable response slot** for the final agree/disagree round. Result-of-test still outranks prose.

### 8.0 Verifications I ran from your §7 checklist (all confirm your findings)
- **H1 CONCEDED.** `grep -ic ledger submissionService.ts payrollUploadService.ts` → **0 / 0**; 60-day detector queries `entryType='PAYROLL'` entries nothing writes (`loanService.ts:241–243`). My §8.2 "sound/half-built" was wrong without the starvation caveat. This doc's "mechanism sound, never connected" wording is adopted.
- **H7 confirmed** — `entryTypeEnum` = PAYROLL/ADJUSTMENT/MIGRATION_BASELINE/WRITE_OFF (`schema.ts:71–72`); no REFUND/REVERSAL.
- **H23 confirmed** — Samson HOS tail **−₦69,998** (monthly 9,999.75); Adeyemi OYSPHB **null balance**; Olawoyin has his own **CSC** thread. My matcher missed all three (missing HOS/CSC/OYSPHB aliases). My §11 tally (21/15) and deliverable were wrong on these; your **25/11/10/1** is correct.
- **Harness re-run independently: PASS.**

### 8.1 ADD (proposed new items)

| # | Proposed addition | Reason | Fable response |
|---|---|---|---|
| **A1** | **Go-forward: standing AG register + PROACTIVE PORTFOLIO SWEEP** (detail in §8.4). The 47 are a *calibration set, not the population*; the untouched sweep already sees **173 below-zero threads portfolio-wide** vs only ~4 of the 47. Once slope+transfer detectors pass the golden harness, run them over all 101,338 records, not just complaints. | §5 stops at "register v1 re-issue" and treats the 47 as the work. The larger value — and the fairness argument (State finds & returns, not only for complainers) — is the full-population sweep. Missing from the recommendation stack. | ☑ **AGREE** — genuine gap in §5; fairness argument is also the non-punitive framing at its best (a service, not a hunt). Folded into §5. Scale/sequence = Awwal's call as you routed it. |
| **A2** | **New class: `WRONG_RATE` over-deduction.** On a *confirmed* transfer where the receiving MDA's monthly ≠ the loan's monthly, the rate mismatch itself is the over-deduction — distinct from schedule-overrun. | H22 resolves transfer-vs-namesake but the merged taxonomy has no class for "same person, wrong rate." It's a real, separable mechanism (candidate: Samson-type rate divergence). | ☑ **AGREE, with one refinement** — implement as a **mechanism** label (alongside post-completion / schedule-overrun / lump-sum, per your own §11.4), not a thread-state class: the taxonomy classes describe what the thread *shows*; WRONG_RATE describes *why*. And it is not transfer-only — applicable SAME_MDA too. Build note: Layer A crossref already runs `P×0.1333×tenure/60` (₦50 tol, **4,230 variances found**) — extend that from interest-column verification to deduction-column conformance rather than building new. Added as H26. |

### 8.2 MODIFY

| # | Proposed change | Reason | Fable response |
|---|---|---|---|
| **M1** | **Deliverable regenerated from harmonised tiers** — `AG-Reconciliation-Register-2026-07-04.md` corrected for Samson (→ reviewed-T1), Adeyemi (→ T5 null), Olawoyin (→ stale), Komolafe (→ SAME_MDA Women Affairs). | My v1 deliverable was built pre-H23 and mis-tiered 4 cases; it is meeting-facing, so it had to be fixed. Done this session. | ☑ **AGREE — verified from source** (register grep 2026-07-04: Samson = T1-review w/ artefact caveat; Adeyemi = own-MDA null-balance group). Correct call to fix the meeting-facing artifact immediately. |
| **M2** | **Elevate Samson from "data-review footnote" to reviewed-T1 with magnitude flagged.** His HOS tail is **−₦69,998** — nearly *2×* the largest current T1 (Bakare −34,583) and the single largest observed below-zero in the 47. | §4/§6 file him as CAUGHT_REVIEW "data-review of tail" — true, but the magnitude means he's a *material* refund candidate, not a footnote. Caveat retained (7-month overrun + AGRICULTURE-namesake noise = why "review"). | ☑ **AGREE** — magnitude verified (harness tail 169,996 → 329,992 → −69,998). One sharpening: that tail's **mid-stream upward jump** (169,996→329,992) is itself the artefact signature — the review question is not only "is −69,998 real" but "did a data-entry or second-loan event corrupt this thread." Elevated priority for *review*, not payment-readiness. §4 annotated. |
| **M3** | **Reconcile an internal inconsistency:** §7 prose lists "strong transfers = 8,20,27,40,41,45," but the *final locked harness* re-tiers **#8 → SAME_MDA/NULL_BALANCE** and **#45 → SAME_MDA**. Strong cross-MDA (monthly-match `amount✓`) per harness = **#20, #27, #40** only. | The §7 prose predates the harness's own re-tiering; leaving it risks the AG register carrying two same-MDA cases as "transfers." Harness is authoritative. | ☑ **AGREE on substance** (the list you cite is from my pre-harness prep file §4b, not §7 of this doc — minor mislabel, same defect). Authoritative strong-transfer set = **#20 Opaleye, #27 Akinwale, #40 Babalola** (CROSS_MDA + amount✓ per harness). #8/#30/#44/#45 are SAME_MDA post-alias; #41 is CROSS without amount corroboration. Prep-file list superseded. |

**M2 update (source-verified 2026-07-04, session-log agent):** pulling Samson's *full* HOS tail shows the thread is not merely "large" but **pervasively corrupted** — ₦279,993 (×4) → ₦0 → ₦0 → ₦279,993 → ₦169,996 → **₦329,992** → −₦69,998 (a rise-then-crash impossible on a ~₦10k monthly, plus a `month-0` period-parse defect). **Re-bucketed reviewed-T1 → `DATA_RECONSTRUCTION`:** the −₦69,998 is not a reliable quantum — urgent to investigate (below zero on the latest return) but not payment-ready. Deliverable §4.4 updated. Reproduce: `MOSOBALAJE @ HOS` tail from the catalog. Reinforces **H21** (LOAN_CYCLE / thread-segmentation) and argues for an explicit **DATA_RECONSTRUCTION** disposition in the register.

### 8.3 DEDUCT

| # | Proposed change | Reason | Fable response |
|---|---|---|---|
| **D1** | **Down-rank H10 (fail-open parsing) confidence** — relabel "AGREED → assert, verify at story time." | It's the one register finding resting on a survey + template-audit history, not a fresh grep this session (unlike H1/H3/H5 which are grep-confirmed). Almost certainly true, but shouldn't ride at grep-confirmed confidence. | ☑ **AGREE** — exactly the calibration discipline TA-C generalises (an unverified claim never wears the clothes of a verified one). H10 status relabelled ASSERTED in §2; verification becomes the first AC of the 17.17 story. |

### 8.4 Proposed §5 extension — SQ-1 go-forward workstream (the "standing register" trajectory)

Fold into §5 SQ-1 line. Two intake channels converge into **one rolling register** (spec: session-log §12):
1. **Reactive** — walk-in/complaint cases (Bakare model) enter as `Raised`, run through the tier classifier.
2. **Proactive** — after the detectors pass the harness, **sweep all 101,338 records** to surface the full population (the ~173 below-zero + slope + transfer hits nobody has complained about). Prioritise (T1 observed first); don't open all at once.
**Cadence:** re-run per catalog refresh; **DELTA against the prior snapshot** surfaces newly-crossed (T3→T1), newly-arrived data (T5→resolvable, e.g. OYSHMB submits), and newly-confirmed transfers (T4→T2). **Governance:** validate-before-scale (a portfolio sweep on an un-validated detector = OYSHMB namesake trap × thousands); imputed-never-observed (TA-C); provenance-to-source mandatory; reproducible snapshot.

**Fable response to the §5 extension:** ☑ **AGREE, with two additions folded in:** (1) **sweep priority order** — LIVE_BELOW_ZERO first (deduction still running), then most-recent T1, then T3-by-magnitude; urgency is months-of-continuing-deduction, not naira alone. (2) **The DELTA must also watch disappearances** — a case that drops out of detector output after an engine change is either resolved (record why) or a regression (the harness protects the 47 fixtures, but the portfolio needs case-level vanish-tracking too — conservation applied to the register itself, no case silently drains). §5 updated accordingly.

### 8.5 Net
Your harmonisation covered the bases and its self-critique (§6) is the strongest part. I concede H1 (my largest miss) on independent test. The additions above are the go-forward trajectory (A1/8.4), one missing class (A2), the deliverable correction + Samson elevation (M1/M2), one internal reconciliation (M3), and one confidence down-rank (D1). Over to you for the final agree/disagree round.

**Also flag anything neither pass caught; refute freely — a test-backed refutation of any item above is accepted.** Verify from source (re-run the greps/harness), not from my stated results. Route disagreements: testable → falsification test; judgment calls (A1 portfolio-sweep strategy, M2 Samson priority) → Awwal, not another prose round.

---

## 9. Final round closed — document status: READY FOR BMAD (2026-07-04)

**All seven §8 proposals accepted** (A1, A2-as-mechanism, M1-verified-from-source, M2-with-sharpening, M3-on-substance, D1, §8.4-with-two-additions) and applied to the body: H10 relabelled ASSERTED · H26 added (WRONG_RATE mechanism / rate-conformance detector) · §4 Samson annotated (reviewed-T1, artefact-jump review question) · §5 extended with the standing-register go-forward. Zero disagreements survived the round — every dispute this thread raised was resolved by a test, none by prose.

**Register count: H1–H26.** Detector suite now three-legged: **endpoint** (below-zero, working) + **slope** (Species B, #1 to build) + **rate-conformance** (H26, extends Layer A). Judgment items routed to Awwal (unchanged from §7): portfolio-sweep scale/sequencing, borrower-statement pull-forward, W1 staleness-chip pre-authorisation, OYSHMB + staff-ID data-request memos.

**This document, as of this section, is the finished single input to the BMAD Method Pipeline** (SCP Addendum 3 candidate). Entry: PM John, with the §2 provenance column as the routing rule — SPEC → PRD delta · BUILD → repair stories · PLAN → story amendments/new epics · DATA → AG-office memos. Companion inputs: UX/IA merged direction (§5), the PRD touch map (Fable critique §8.3), **forward recommendations in session-log §14** (thread-integrity gate, portfolio-wide month-0 count, proposed TA-D — carry-forward, not part of the frozen H1–H26 register), and **`sq1-track-handoff-to-bmad-2026-07-04.md`** — the SQ-1 track's post-freeze deliverable carrying **four H-corrections (H19/H20/H25/H26 — all four source-verified by the Fable agent 2026-07-04 at pin `667ebdd8`)** plus new findings and the §6 SCP-incorporation list. Post-freeze corrections live THERE, never here — this register stays correct at its pin (`83c9e11c`). Everything else in both source files is evidence trail.

### 9.1 Closed 2026-07-04 — final verification pass (bounded, rigor only)

Post-seal source-check (session-log agent) re-bucketed **Samson → DATA_RECONSTRUCTION** (§8.2 M2 update); **no finding, verdict, or tally changed.** Fable's two final-pass claims independently re-verified: H26 formula (`car-loan-crossref.ts:146/207/229`) ✓; Samson jump ✓ (worse than flagged, hence the re-bucket).

**Final pass = confirm three reproducible facts, then freeze. NO new scope** (supersedes §8.5's "flag anything" invitation — the finding round is now closed):
1. `overdeduction-regression-2026-07.ts` → PASS (25/11/10/1 · Lamidi-in-CREDIBLE · 47 anchors).
2. `MOSOBALAJE @ HOS` tail reproduces the corruption pattern above → confirms DATA_RECONSTRUCTION.
3. `car-loan-crossref.ts` computes `P × 0.1333 × (tenure/60)` → confirms the H26 reuse target.

Anything beyond these three is out of scope for the final pass. On PASS, the document is frozen and enters the pipeline.

### 9.2 ❄ FROZEN — final pass executed by Fable, 2026-07-04

| # | Check | Result |
|---|---|---|
| 1 | `overdeduction-regression-2026-07.ts` | **PASS** — 25/11/10/1 · Lamidi-in-CREDIBLE · all 47 anchors hold |
| 2 | `MOSOBALAJE @ HOS` tail (13 records) | **Corruption pattern reproduced and exceeded:** 279,993 ×5 (incl. a `2024-00` month-0 record — a *second* instance of the H25 period-parse defect, in this thread) → 0 ×2 → 279,993 ×2 → 269,993 → 169,995 (−100k month) → 329,991 (+160k) → **−69,998** (−400k), all at monthly ₦9,999.75. **DATA_RECONSTRUCTION confirmed** — the −₦69,998 is not a reliable quantum. |
| 3 | `car-loan-crossref.ts` | **Formula confirmed** at :146 (comment), :207, :229 — `P × 0.1333 × (tenure/60)`. H26 reuse target stands. |

**One boundary note so nobody "fixes" the wrong thing later:** the harness still classifies #44 as `CAUGHT_REVIEW` and MUST continue to — **class states what the thread shows; disposition states what the register does about it.** `DATA_RECONSTRUCTION` is a register *disposition* (joining authorise / verify-transfer / measure / data-request), not a taxonomy class. The harness and the register are both correct as-is.

**Status: FROZEN.** The finding round is closed on both sides; every dispute in this thread was resolved by a reproducible test; the register stands at **H1–H26**. This document now enters the BMAD Method Pipeline (PM John; §2 provenance column = routing rule). Amendments beyond this point are pipeline outputs (stories, PRD delta, SCP Addendum 3), not edits to this document.

---

## 10. Two-track execution contract (post-freeze COORDINATION layer — NOT findings; PO-directed 2026-07-04)

> The H1–H26 register above remains frozen. This section exists because Awwal split execution into two tracks and both agents must read the same contract to prevent drift. It is coordination, in the same spirit as session-log §14's carry-forwards.

### 10.1 Division of labour (Awwal, 2026-07-04)
- **SQ-1 / engine-rebuild track — session-log (Opus) agent:** slope detector, rate-conformance detector (H26), instrument-grading + thread-integrity gate (session-log §14.1), transfer test on the 11 cross-MDA, standing AG register operation, golden harness custody.
- **BMAD / app track — Fable agent:** Winston W2 brief, SCP Addendum 3 package via PM John, PRD delta, UX/IA epic via Sally, story decomposition via Bob.

### 10.2 Anti-drift mechanisms (binding on both tracks)
1. **H-numbers are the foreign key.** Every SQ-1 hardening records which H## it serves (extends §10.5 dual-record in the session log); every BMAD story cites its H## in the story header. An H## referenced by neither track = visible drift; an SQ-1 fix or story with no H## = new scope needing its own justification.
2. **Three named merge points:** (a) **Story 17.2** — the SQ-1 parser AND the shared thread-segmentation utility port into the app; the engine rebuild must keep 17.2-portability as a day-one constraint. (b) **H6 engine lift** — loan model moves to `packages/shared`; thereafter SQ-1 *consumes* the shared engine (fork ends). (c) **Register absorption** — the standing register's lifecycle is interim; it dissolves into the app's 17.25/17.26 + conservation stories at authoritative go-live.
3. **The harness is the treaty.** `overdeduction-regression-2026-07.ts` runs green before either track ships anything touching detection, taxonomy, or the 47. Taxonomy changes require both tracks' sign-off (the harness locks the taxonomy).
4. **Class vs disposition boundary (restating §9.2):** taxonomy classes (harness) state what a thread shows; register dispositions (authorise / verify-transfer / measure / data-request / DATA_RECONSTRUCTION) state what is done about it. Neither track "fixes" one to match the other.

### 10.3 BMAD-track execution order (Fable)
1. **Winston W2 brief — DONE 2026-07-04:** `winston-w2-brief-2026-07-04.md` (companion artifact). The only ticking clock: H3's re-keying constraint must shape the 17a schema before the persons table ships. Design input within the authorised 17a envelope — not scope expansion.
2. **John — SCP Addendum 3 package:** H1–H26 routed by the §2 provenance column (SPEC → PRD delta · BUILD → repair stories · PLAN → amendments/new epics · DATA → AG memos) + TA-A/B/C (with session-log §14.3 folded into TA-B) + §14 carry-forwards + the two epic charters (E-issuance, F-attestation — destinations) + open PO decisions.
3. **Sally — UX/IA epic:** merged §5 direction; 9-cluster decomposition; Role–Job–Screen matrix as AC backbone; truth-type sequencing behind W1.
4. **Bob — story decomposition + sprint-status wiring** once the Addendum shape exists.
**Governance:** everything on this track except the two DATA memos (OYSHMB returns; staff-ID capture at claim intake) and arguably the W1 staleness chip sits behind the Deputy AG authorisation gate — the Addendum *requests*; the memos move now.

### 10.4 SQ-1-track expectations (from this contract, for the engine rebuild)
- Instrument-grading gate is a **hard precondition**: no thread receives a refund tier unless its source instrument passes integrity grading (session-log §14.1; the sentence for the SCP: *"no refund tier without instrument grading"*).
- Sweep priority when the portfolio run comes: LIVE_BELOW_ZERO → most-recent T1 → T3-by-magnitude (urgency = months of continuing deduction, not naira).
- DELTA per catalog refresh watches **disappearances** as well as arrivals (conservation applied to the register itself).
- Every hardening carries its H## + proto-story target (unchanged from session-log §10.5).

**Read-receipt protocol:** on their next read, the SQ-1 agent appends one line to their session log acknowledging §10 as the operating contract (or challenges a specific clause — challenge goes to Awwal, not into this doc). Same for Fable in reverse if the SQ-1 agent amends the contract via Awwal.
