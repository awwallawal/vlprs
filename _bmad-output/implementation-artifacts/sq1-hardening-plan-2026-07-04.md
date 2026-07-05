# SQ-1 Hardening & Rebuild Plan — 2026-07-04 (resumable)

**Goal:** fold the overdeduction detectors surfaced by the 47-case cycle into the SQ-1 pipeline as first-class, harness-gated capability, fix the data defects, then regenerate the whole pipeline + the standing AG register. **Track A (SQ-1 archaeology) — this plan.** Track B (app/BMAD) runs in parallel (harmonised doc → PM John).

**Context anchors:** WAKEUP.md (pipeline Layer A–D, run commands, close-out checklist) · harmonised-findings-2026-07-04.md (H1–H26, frozen) · session-log §10 (hardening protocol), §14 (go-forward). Catalog snapshot at plan start: `83c9e11c…`, 101,338 records, through 2026-04.

> **Ordering rule (the one thing not to get wrong):** fix the period-parse defect and re-ingest **before** building detectors — the detectors read the catalog, so building them on the buggy catalog then re-running wastes the work and could shift the 47 tiers. Data fix → re-ingest → detectors → validate → scale → regenerate → close.

> **Thread-model constraint (accepted from Fable W2-brief pt 2 / contract §10):** the rebuilt engine keys person-threads on **resolvable identity, not raw name-strings** — resolution order staff/OYSG-ID → Yoruba-canonical → raw, as a distinct swappable step upstream of thread-building. Keeps 17.2-portability and avoids re-importing H3/H11.

> **Awwal decision 2026-07-04 — month-0 ghosts: KEEP-BUT-MARK (not hard-drop), for audit fidelity.** So Phase 1.1 Part (b) becomes: do NOT drop; the 255 ghost duplicates stay in the catalog (month-0 is self-marking as year-only), and the **detectors exclude month-0 records from monthly-sequence analysis** (slope/sweep/transfer) while dossiers note them. Only Part (a) (HOS bare-month recovery) edits the parser.

---

## PHASE 0 — Ground (fast)
- [x] 0.1 Read WAKEUP.md — pipeline + close-out refreshed (2026-07-04).
- [ ] 0.2 Run freshness audit `verify-folder-freshness.ts` — confirm catalog is current before building on it (exit 0).
- [ ] 0.3 Inventory scratch: `_tmp-zero-vanish · _tmp-check-names · _tmp-baseline-47 · _tmp-verify-47 · _tmp-mda-reconcile-47 · _tmp-tally-47 · _tmp-transfer-oyshmb · _tmp-register-47 · _tmp-dump-47` + promoted `overdeduction-regression-2026-07.ts`. Mark keep-fold-delete (do NOT delete until logic is in a kept module + harness — Phase 4).

## PHASE 1 — Fix data defects first (they change the catalog)
- [~] 1.1 **Period-parse fix — DIAGNOSED 2026-07-04.** 260 month-0 records = **59 recoverable** (HOS `JAN`/`FEB`/`MARCH` sheets: month in sheet name, never combined with filename year) + **201 secondary-sheet ghosts** (`Sheet1`/`WORKING SHEET`/`Sheet2`/`Sheet5` duplicating proper monthly sheets, escaping dedup via year-00 key). **255/260 have a real-month twin (safe to drop); 5 orphans** (4 HOS→recoverable to month; 1 INFORMATION WORKING-SHEET null-balance). **Fix = 2 parts:** (a) `period-extract.ts` — combine bare-month sheet name + filename year (recovers 59); (b) `car-loan-parse.ts` dedup — drop a month-0 record when the same person+MDA has any real-month record (drops the 255 ghosts; keeps the 5 orphans). **CORRECTION to harmonised H25:** "Aliyu's missing February = the month-0 record" is WRONG — his `2025-00` is a WORKING-SHEET ghost (bal ≈ ₦0); his February is a **genuine data gap** (absent from the FEBRUARY,2025 sheet). Two separate issues; do not let the wrong version ride into 17.26 ACs.
- [x] 1.1 Part (a) DONE — `period-extract.ts` bare-month + filename-year combination (guarded to pure month-word sheets). Part (b) = detector-side month-0 exclusion (keep-but-mark, Awwal), deferred to Phase 2.
- [x] 1.2 DONE — deep-scan → parse → crossref → ledger → report → mda-class → heatmaps re-run. Catalog **101,338 → 104,396**, SHA `83c9e11c` → **`667ebdd8`**. Harness **re-baselined + PASS** (PRIORITY 174, CREDIBLE 33, SECONDARY 698; #42 Adeleke → NEVER_CROSSED_ZERO). Deliverable → v1.2. Coordination note to Fable in session-log §16. **Findings:** Adeleke's LIVE was a mis-dated artifact (withdrawn); H25/Aliyu-February corrected; +1 portfolio below-zero surfaced.
      _Remaining Layer A (reconciliation-inventory, staging, invariant-check) + Layer B/C/D + close-out = still to run before final freeze._

## PHASE 2 — Consolidate detectors into kept modules (fold the `_tmp` scratch)
- [ ] 2.1 **Shared thread-segmentation utility** (zero-reset boundaries + stale-month exclusion) — *one utility, two consumers* (per H21). Prereq for 2.2 and 2.4.
- [x] 2.2 **Slope detector — EXHAUSTED-NULL (session-log §17).** 4 iterations; final heavily-gated version flags 0; diagnostic: 98.8% of loans decline at *exactly* their stated rate. Root: catalog balance IS the schedule (`balance[t]=balance[t-1]−stated`), can't surface cash-divergence. Retained `overdeduction-slope.ts` as evidence.
- [x] 2.5 **Rate-conformance (H26) — built, REVIEW-SURFACE ONLY (§18).** `overdeduction-rate.ts`; 311 WRONG_RATE candidates but dominated by data errors; real-vs-error undecidable from catalog. Kept as a gated payslip-triage surface, not an over-deduction figure.
- **⛔ DETECTION CEILING REACHED:** in-flight over-deduction is not reliably detectable from the catalog (report ≠ cash). Defensible = **Species A (below-zero endpoint) only** — done, harness-locked. In-flight T3/T4 → payroll data (staff-ID memo / app pillar-C).
- [ ] 2.3 **Instrument-grading gate** — grade each source workbook (monotonicity, 0-resurrection, month-0, impossible jumps); low-graded → `DATA_RECONSTRUCTION` *before* tiering (Samson = HOS 2024+2025 workbooks). → app story **17.17 instrument-grading**.
- [x] 2.4 **Transfer test DONE** — `overdeduction-transfer.ts`: 47 cross-MDA resolved = **6 CONFIRMED · 3 LIKELY · 4 NAMESAKE · 1 SETTLEMENT**. Settlement-path aware; flags candidates for human/ID confirmation (name-only can't beat namesakes without staff-ID). → app **17.4/17.5**. Deliverable §6 updated.
- [ ] 2.5 **Rate-conformance (H26)** — **extend** `car-loan-crossref.ts`'s existing `P×0.1333×InstallmentCount/60` check from *interest-column* to *deduction-column* conformance → `WRONG_RATE` mechanism. Reuse, don't rebuild.
- [ ] 2.6 Add each detector's assertions to `overdeduction-regression-2026-07.ts`. Nothing ships until the harness PASSes on the 47 + fixtures (Lamidi/Alatise/ADELEKE/CDU).

## PHASE 3 — Validate, then scale (never scale an un-validated detector)
- [x] 3.1 Harness PASS (re-baselined post period-fix).
- [x] 3.2 **Portfolio Species-A sweep DONE** — `overdeduction-register.ts`: 185 clean below-zero (₦7.74M), **18 LIVE + 167 vanished + 17 reconstruct**, resolve-at-read keyed, instrument-graded. *(Slope/rate detectors NOT scaled — exhausted-null; below-zero is the only catalog-provable species.)*
- [x] 3.3 **Worklist deliverable** — `docs/Car_Loan/analysis/reports/AG-Portfolio-BelowZero-Worklist-2026-07-04.md` (proactive companion to the 47-case register). Rolling-status + DELTA = close-out / next cycle.

## PHASE 4 — Close-out (WAKEUP checklist) — DONE 2026-07-04
- [x] 4.1 DELTA_2026-07-04 + prior superseded/moved · [x] 4.2 memory `project_engine_rerun_2026_07_04` + MEMORY.md · [x] 4.3 Layer B→D regenerated (15/15; heatmap step-7a copy fixed) · [x] 4.4 **freshness 15/15 exit 0** · [~] 4.5 deploy-drive refresh = **deferred to Awwal** (needs physical drive) · [x] 4.6 `_tmp-*` deleted (4 kept detectors remain) · [x] 4.7 session-log §20.

---

## Track A ⇄ Track B handshake (SQ-1 validates, the app implements)

The **golden harness is the shared contract**: the app should reuse the *same* 47-case set as its acceptance test (Team Agreement 15, test-fixture parity) — one test set, two implementations, guaranteed parity.

| SQ-1 hardening (Track A) | Validates / feeds app story (Track B) |
|---|---|
| Period-parse fix (1.1) | H25 period-parser fix |
| Slope detector (2.2) | 16.1 cross-month / pillar B (calendar-anchored projector, H6) |
| Instrument-grading (2.3) | 17.17 instrument-grading + PARSER_BLIND (H10) |
| Transfer test (2.4) | 17.4/17.5 identity + transfer handshake (H11/H3) |
| Rate-conformance / WRONG_RATE (2.5) | H16 reconciliation + H26 |
| Standing register + refund quantum | 17.25/17.26 refund rails (AG sole authority, ledger-event terminal, H7/H8) |
| DATA memos (sent) | shrinks T5; H24 data-acquisition |

---

## Status: PLAN WRITTEN — not started. Next concrete step = **0.2 freshness audit**, then **1.1 period-parse fix**.
