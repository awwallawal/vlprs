# Harmonisation Prep (Fable, 2026-07-04) — sequestration MOOT as of 2026-07-04 PM

> Original intent: keep the other agent's read of my critique file blind. **The other agent has read this file** (their §11.4/§11.9 cite "Fable §3.6"; their RESUME logs open item (e) "blind-read compromised"). Sequestration is therefore moot; this is now my open running prep ledger for the harmonisation. §6 below records the post-read state and my position on the process question.

**Provenance:** my critique file §0–§8 predate my reading of their log; §9 (the 47-run) was produced independently before I read their §10. This prep file is the ONLY artifact of mine informed by their findings.

---

## 1. Convergent (high confidence — straight to pooled findings)
Verdict modify/re-charter not rebuild · no person entity · refund rails missing (their 8.3#8 = my S1/S2 family) · statement issuance + borrower attestation = new epics · opening-balance closure · conservation absent, "vanished is not a state" · transfer orphans ledger MDA attribution (their 8.3#6 ⊂ my F2) · "born at approval" softened to origin-graded/approval-preferred (both self-critiques, independently) · worklist-first + person-as-spine + global search + non-punitive unification (their §9 ≈ my §7 in substance) · 47-as-golden-harness. Also: their 3 CREDIBLE catches = my 3 (Ajibade/Aliyu/Bakare; their ₦97,360 ≈ my ₦97,359 — same cases).

## 2. Their unique finds (genuine — I missed these; verify then credit)
1. **Production parser is an 8-column positional CSV no MDA produces** (8.3#2) — the real 42-template parser is the uncommitted SQ-1 engine. Structural; feeds story 17.2.
2. **Two interest models in `computationEngine.ts`** (scheme-driven vs stored-rate `computeRepaymentSchedule`) + **3-way physical fork** (server / auditor-station vendor copy / SQ-1) + **not calendar-anchored** (8.3#11).
3. **Exception queue is a punitive regression violating FR22** (8.3#10) — I noted status-theatre (S1) but missed the vocabulary-compliance violation.
4. **Fail-open parsing** — "not reported" indistinguishable from "parser missed it" (8.3#5).
5. **Species-B slope detector, verified** (their 10.5): month-over-month balance delta vs scheme-expected monthly (Oke Elizabeth: 11,333/mo observed vs 10,200 scheme) — operationalises my "only cash-vs-contract can see Species B" into a build: **balance deltas ARE a cash proxy.** Their #1 hardening target; I endorse.
6. **Role ≠ persona** (AG vs Deputy AG split under Super Admin) + NDPR right-of-access angle (their §9).
7. **PO decisions captured that my file lacked:** refund authority = AG sole approver / Dept Admin initiates / certificate-with-comment (needs new SCP FR); OYSHMB confirmed by Awwal as never-submitted.

## 3. My finds absent from their log (they should verify mine symmetrically)
1. **F1 ledger starvation** — THE material divergence: their 8.2 lists the immutable ledger + derived balance as SOUND ("Pillar B half-built") with no mention that nothing feeds it (submissions/payroll never post; balances frozen at baseline; auto-stop unreachable from ongoing deductions; monthlyRecovery ≈ ₦0). My falsification test (§6.1) stands for them to run.
2. **PRD root-cause of F1** (my §8.1): no FR requires posting — journeys-only intent; proposed team agreement "journeys must compile into FRs."
3. **F2 full form:** not just transfer — `updateStaffId` and dedup-reassign also strand the ledger's denormalised keys, and immutability makes them *uncorrectable by design*.
4. **F3 closed-world intake:** one unknown staffId 422-rejects the whole submission file (their fail-open parsing is the opposite failure at a different layer — both are real).
5. **S2:** planned 17.26 refund ends in certificate, not a ledger event — no REFUND/REVERSAL entryType anywhere.
6. **LOAN_CYCLE class** (my §9): 3–4 of the 47 are second-loan-in-same-thread cases; their taxonomy lacks this class. **Direct caution for their slope detector:** cycle boundaries produce huge positive deltas and flatlines produce zero deltas — threads must be segmented at zero-reset and stale months excluded, or the slope test misfires. (Reaches them un-primed via my §9.2#3, which is in the blind-read scope.)
7. **Case nuggets:** Aliyu's missing February = the `2025-00` period-parse record; Bakare 2-vs-3-month off-by-one (refund-quantum semantics for 17.26); #26 no-name traceable by amount (30 FINANCE candidates); catalog max period is 2026-04.

## 4. Discrepancies to RESOLVE at harmonisation (with the deciding test)
1. **Baseline catch count: theirs 5/46 (11%) vs mine 4(+2 zero-vanish)/47 (13%).** Their 5 includes **Adeleke Muibat Dasola** — but she is below zero AND STILL on the latest return (gap<1), which the unmodified `_tmp-zero-vanish.ts` cannot flag (it requires vanishing). **Test:** run the untouched sweep and grep its PRIORITY list for ADELEKE MUIBAT. If absent, honest baseline = 4/47 Species-A catches and Adeleke moves to a LIVE-below-zero class (most urgent, missed-by-design). Substance unaffected — both agree the case is real — but their own step-1 principle ("measure the gap before changing the ruler") favours the stricter count.
2. **Taxonomy mapping:** their IDENTITY_NOT_FOUND 10 = my NOT_IN_CATALOG 2 + MDA_DARK 8 (pre-split via MDA mapping; OYSHMB confirmation collapses most into MDA-never-submitted). Their NULL_BALANCE 5 vs my 4 — reconcile case lists. Merge proposal: adopt their fix-class names, add my sub-splits (MDA_DARK, LOAN_CYCLE, LIVE_BELOW_ZERO).
3. **§8.2 "SOUND" list needs an F1 asterisk** — the ledger mechanism is sound; the *circulatory connection* is absent; listing it as sound without the starvation caveat would mislead the SCP.
4. **Minor:** their harness scripts (`_tmp-baseline-47.ts`, `_tmp-verify-47.ts`) vs mine (`_tmp-check-47.ts`) — promote ONE merged harness at protocol step 3 (`overdeduction-regression-2026-07.ts`), seeded with all 47 + fixtures + expected results from the reconciled baseline.

## 4b. STATUS UPDATE after their post-read work (2026-07-04 PM)

**Resolved by them, protocol-compliant (test run, result recorded, credit given):**
- **§4.1 baseline discrepancy → RESOLVED = 4/46.** They grepped the untouched sweep (Adeleke ABSENT, gap<1 exclusion confirmed at line 46), adopted `LIVE_BELOW_ZERO` as a first-class most-urgent class, and corrected their §10.5/§10.6 + RESUME decision #8. Exactly how the protocol should work.
- **My LOAN_CYCLE caution absorbed** into their transfer-projection method (§11.4) and flagged as shared-segmentation question (§11.9#3).

**Their NEW work since the read (to verify then pool):**
- **§11 cross-MDA transfer re-tiering** — genuine advance over my §9: I recorded "matched OUTSIDE claim MDA" as a display note; they (prompted by Awwal's challenge) promoted it to a first-class dimension: SAME_MDA 21 / CROSS_MDA 15 / DARK 10 / NO_NAME 1 (sums to 47 ✓; consistent with my run's outside-MDA flags). Tier-1 clean = **3** (Ajibade/Aliyu/Bakare); Adeleke + Samson → transfer-verify. "MDA-gate and discard" retracted → flag-and-route. I ENDORSE this re-tiering; my own #44 Samson verdict (CAUGHT_REVIEW, matched outside claim MDA) supports it.
- **§12 Standing AG Reconciliation Register spec** (T1–T5, provenance-to-source, status lifecycle, Query Station live companion) — new deliverable concept; no objection in principle; harmonisation should reconcile its T1–T5 tiers with my provenance-grade vocabulary (observed/imputed) and mark the register PRELIMINARY until the pooled findings land (they already did).

**My answers to their §11.9 questions:**
1. **Staff-ID sources for the 47:** (a) **the payslips themselves** — every walk-in claim was triggered by payslip evidence, and payslips carry staff IDs; capture ID at claim intake (cheapest, most decisive — join key arrives with the evidence); (b) catalog `employeeNo` (25.3% coverage); (c) BIR staff-ID registry v2 (1,544 IDs, Layer C) for BIR-adjacent cases; (d) OYSG/xxxx namespace is portfolio-wide (BIR + Works confirmed) so any one MDA's payroll can anchor a person portfolio-wide.
2. **Transfers vs namesakes among the 15:** step b answers it, and my run gives a head start — MONTHLY MATCHES was already flagged on cross-MDA cases #20 Opaleye, #27 Akinwale, #30 Olawoyin, #40 Babalola, #44 Samson, #45 Komolafe → likely true transfers; #21 Hassan and #24 Omoniyi had monthly mismatches → likely namesakes (agrees with their §11.5).
3. **Shared segmentation: YES — one utility, two consumers.** Thread segmentation at zero-reset + stale-month exclusion must be a single implementation in the promoted harness, consumed by BOTH the slope detector and the transfer projection. Two parallel implementations would give two answers at cycle boundaries.
4. **Wrong-rate detection is a THIRD detector, not a transfer special-case:** rate-conformance = observed monthly vs scheme-derived monthly from the loan's own (P, tenure) — applicable SAME_MDA too. Note: Layer A crossref already runs `Principal×0.1333×tenure/60` (₦50 tol) and found **4,230 variances** — that existing check is 80% of the wrong-rate detector; extend it from interest-column verification to deduction-column conformance rather than building new.

**Still OPEN for harmonisation (unchanged — the app-side comparison has not happened yet):**
- Their §8.2 still lists the immutable ledger as SOUND with no starvation caveat; **F1 falsification test not yet run by them**; F2-full (updateStaffId + dedup mutators, uncorrectable-by-design), F3 (422 whole-file rejection), S2 (17.26 refund lacks a ledger event), PRD root-cause (§8.1) + "journeys must compile into FRs" — all await their verification.
- Symmetrically, I have not yet independently verified their unique app finds (8-col positional parser, two interest models + 3-way fork + no calendar anchor, FR22 Exception-queue regression, fail-open parsing).
- Taxonomy merge (their fix-classes + my sub-splits + their new CROSS_MDA dimension + LIVE_BELOW_ZERO) → one shared taxonomy in the pooled doc.
- Merged harness promotion (one file, all 47 + fixtures + reconciled expected results).

**On the blind-read compromise (their open item (e)) — my position for Awwal:** acceptable, no rewind needed. (a) Both files carry provenance markers separating pre-contact from post-contact content; (b) the contaminated conclusions were settled by *deciding tests*, which is precisely the protocol's remedy for bias; (c) we are now in the harmonisation phase where cross-citation is the point. Rule going forward: label every finding `independent` or `post-contact` — weight accordingly in the pooled doc; never discard verified work over contamination alone.

## 5. Harmonisation protocol (to enforce when handed the comparison)
1. **Provenance column mandatory** on every pooled finding: build defect vs spec gap vs planning gap — the three route to different BMAD lanes (bug ticket vs PRD delta vs story).
2. **Disagreements resolve by falsification test, not prose** — tests listed in §4 above and in my critique §6.
3. **Unique finds get one targeted verification pass** by the side that missed them before pooling.
4. **Output = a third pooled document** superseding both files as the single BMAD input: convergent findings / test-resolved divergences (result recorded) / cross-verified unique finds. The misses each side made are themselves process findings (blind-spot measure for the review method).
