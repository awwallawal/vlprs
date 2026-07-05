# SQ-1 Engine Track → BMAD Handoff (2026-07-04)

**From:** SQ-1 / engine-rebuild track (Opus agent) · **To:** BMAD / app track (Fable agent → PM John)
**Purpose:** everything the SQ-1 track did *after the two-track fork*, and how each finding routes into the BMAD / SCP Addendum 3 path.
**Anchoring:** companion to the **frozen** `harmonised-findings-2026-07-04.md` (H1–H26). Per contract §10.2.1, **H-numbers are the foreign key.** Nothing here edits the frozen doc — items below are **post-freeze corrections + new findings** for John to route (SPEC → PRD delta · BUILD → repair story · PLAN → amendment/new story · DATA → AG memo).

---

## 0. The forking point

Contract §10 (`harmonised-findings-2026-07-04.md`, PO-directed 2026-07-04) split execution into two tracks: **SQ-1/engine = this agent**, **BMAD/app = Fable**. This document is the SQ-1 track's deliverable back to the BMAD track. Read-receipt for §10 is logged (session-log §15); the resolve-at-read identity rule (W2-brief pt 2) was accepted engine-side.

## 1. What the SQ-1 track did (chronology)

1. **DATA memos drafted** — OYSHMB returns + staff-ID-at-intake (`AG-Data-Requests-2026-07-04.md`).
2. **Rebuild-first (PO decision)** — regenerate the catalog before trusting any figure, gov/fintech rigor.
3. **Period-parse defect found + fixed** — bare-month sheet names (`JAN`) never combined with the filename year → fell to a `month=0` sentinel. Fixed in `utils/period-extract.ts` (guarded to pure month-word sheets).
4. **Full pipeline regenerated** — deep-scan → parse → Layer A–D. Catalog **101,338 → 104,396** records (recovered monthly granularity), SHA `83c9e11c` → **`667ebdd8`**. Freshness 15/15, exit 0.
5. **Harness re-baselined + PASS** — the data fix shifted locked counts; re-locked consciously (not reverted).
6. **Over-deduction detectors built + tested to exhaustion** — endpoint sweep (Species A, works), slope (4 iterations → null), rate-conformance (→ data errors), path-aware rate (→ legitimate accelerations). **Detection ceiling reached.**
7. **Three AG deliverables produced** (see §5), all pinned to the corrected snapshot.
8. **Close-out** — DELTA, memory, `_tmp` cleanup, deploy-drive refresh (D: CURRENT).

Full narrative: `session-log-2026-07-02-overdeduction-sweep-and-ledger-reframe.md` §15–§21.

---

## 2. The two headline findings (most important for the SCP)

### 2.1 The catalog can prove only ONE over-deduction species — below-zero
The MDA's reported balance is computed **by subtracting the stated monthly each month** (`balance[t] = balance[t−1] − stated`). So the reported balance **is the schedule, not a measure of cash taken.** Consequence, proven three independent ways (balance-slope null; rate-conformance = data errors; path-aware rate = 1,662 legitimate accelerations):

> **In-flight over-deduction is NOT detectable from the returns. The only over-deduction the returns can prove is a balance driven BELOW ZERO** (deductions continued past completion — real on any settlement path). Everything else lives in payroll **cash**, which the returns do not contain.

**Why this matters for BMAD:** it defines what the app can and cannot promise the AG from legacy returns alone, and it makes **payroll-cash ingestion (pillar C / W1 posting) the _only_ path to in-flight over-deduction detection** — not a nice-to-have, a prerequisite. This is reframe pillar C, now backed by hard data. It belongs in the SCP as a plain statement of scope.

### 2.2 Settlement paths void the in-flight rate signal (Awwal domain input, PRD-verified)
Staff choose settlement paths (PRD line 648: accelerated repayment, tenure 60→45, monthly recalculated; lines 449–453: Path-3 lump-sum early exit). **A higher monthly is a legitimate choice, not over-deduction.** Path-aware analysis: **1,662 loans** show a higher-than-standard monthly that maps to a valid accelerated tenure — legitimate. The 311 naive "wrong-rate" flags collapse to ~14 real candidates + 89 data errors.

**Why this matters for BMAD:** any app "deduction exceeds schedule" / "wrong rate" detector that ignores settlement paths will flag **1,662 legitimate settlements as over-deductions** — a reputational failure for a government scheme. This must be a **blocking acceptance criterion**: the detector consults the tenure-change / early-exit events before flagging.

---

## 3. Corrections to frozen findings (post-freeze addenda)

| H# | Frozen doc said | Correction (evidence 2026-07-04) | Routes to |
|---|---|---|---|
| **H19** | slope method finds in-flight over-deduction (validated on Oke) | **Does not hold at portfolio scale** — report = schedule; slope null across 4 iterations; Oke was a loan-cycle artifact. In-flight not catalog-detectable. | 16.1 story: do NOT build a slope over-deduction detector expecting in-flight hits; its value is payroll reconciliation |
| **H20** | LIVE_BELOW_ZERO class, sole 47-member = Adeleke | **Adeleke's −₦17,999 was a mis-dated artifact** (period defect); corrected thread is +₦369,989. Class **valid portfolio-wide (18 LIVE found)** but the 47-member is vacated. | register anchor; 17.14 truth-state |
| **H25** | "Aliyu's missing February = the `2025-00` period-parse record" | **Wrong** — the `2025-00` record is a WORKING-SHEET ghost (bal ≈ ₦0); Aliyu's February is a **genuine data gap** (absent from the Feb sheet). Two separate issues. | **17.26 refund-quantum AC** — do not treat a ghost as a claimant |
| **H26** | rate-conformance detector (stated vs scheme) | **Must be settlement-path-aware** — else flags 1,662 legitimate accelerations. Implied-tenure test isolates real anomalies (~14). | 17.25/17.26 + rate story: hard AC |

## 4. New findings → BMAD routing

| Finding | Type | Provenance | Target story / AC |
|---|---|---|---|
| **Detection ceiling** — returns prove only Species A; in-flight needs payroll | new (scope) | SPEC | SCP scope statement; strengthens **W1** posting + **pillar-C** payroll reconciliation (17.24/17.3b) as prerequisite for in-flight detection |
| **Settlement-path-aware detection** (Path 2/3) | new (blocking) | SPEC + PLAN | Hard AC on **17.25/17.26** + rate story: consult tenure-change / early-exit events before any over-rate flag |
| **Period-parse: bare-month sheet + filename year** | new | BUILD | **17.2** parser port must combine bare-month sheet names with filename year (guarded) |
| **Secondary-sheet ghosts / month-0 handling** | new | BUILD | **17.17** (PARSER_BLIND-adjacent): year-only records must self-mark and be excluded from monthly-sequence analysis; ghost duplicates kept-but-marked |
| **Instrument-grading (thread integrity BEFORE tiering)** | new | BUILD/PLAN | **17.17**: a corrupted thread (0-resurrection, mid-loan jump) routes to DATA_RECONSTRUCTION and never receives a refund tier — *"no refund tier without instrument grading"* |
| **Transfer resolution needs staff-ID** | new | DATA + PLAN | **17.4/17.5**: name-only matching cannot beat namesakes (it mis-picked Samson's Agriculture namesake over his own HOS thread); OYSG-ID makes it definitive → DATA memo #2 |
| **Proactive Species-A sweep (185 below-zero found)** | new (value) | BUILD | **16.1 / conservation stories**: the app should operationalise proactive below-zero detection portfolio-wide, not only complaint-driven; DELTA watches disappearances |

---

## 5. Deliverables the SQ-1 track produced

**Kept detectors** (`scripts/legacy-report/`, uncommitted per side-quest convention):
- `overdeduction-regression-2026-07.ts` — the **golden harness / cross-track treaty** (PASS; re-baselined to `667ebdd8`). *The app should reuse the same 47-case set as its acceptance test (Team Agreement 15 parity).*
- `overdeduction-slope.ts` — exhausted-null; retained as evidence the method doesn't hold.
- `overdeduction-rate.ts` — settlement-path-aware; a **payslip-triage review surface**, not an over-deduction figure.
- `overdeduction-register.ts` — portfolio Species-A worklist generator.
- `overdeduction-transfer.ts` — cross-MDA transfer vs namesake resolver.

**AG-facing deliverables** (`docs/Car_Loan/analysis/reports/`):
- `AG-Reconciliation-Register-2026-07-04.md` **v1.2** — the 47 referred cases, tiered; 3 ready to authorise (₦97,360).
- `AG-Portfolio-BelowZero-Worklist-2026-07-04.md` — 185 proactive below-zero cases (₦7.74M); 18 LIVE + 167 vanished + 17 reconstruct.
- `AG-Data-Requests-2026-07-04.md` — OYSHMB returns + staff-ID-at-intake.

**Corrected foundation:** catalog `667ebdd8` (104,396 records), full Layer A–D regenerated, DELTA_2026-07-04, deploy-drive CURRENT.

## 6. Recommended incorporation into SCP Addendum 3

1. **Scope statement (SPEC):** state plainly that legacy returns prove only below-zero over-deduction; **in-flight detection depends on payroll ingestion** (W1/pillar-C). This right-sizes what the app promises the AG.
2. **New blocking AC (PLAN):** every over-deduction/rate detector is **settlement-path-aware** (consults tenure-change + early-exit events). Add to 17.25/17.26 and the rate story.
3. **Amend 17.26 AC (from H25):** refund-quantum rules must not treat a ghost/working-sheet record as a claimant; state the below-zero magnitude as the quantum, confirm ≥ that vs payslip.
4. **Elevate 17.2 (parser port):** carry the bare-month + secondary-sheet + month-0 handling proven here; reuse the harness as the port's acceptance test.
5. **17.17 gets instrument-grading** as an explicit precondition ("no refund tier without instrument grading").
6. **DATA memos move now** (no authorisation): OYSHMB returns; staff-ID-at-intake — the latter converts transfer resolution from "likely" to "definitive" and is the cheapest high-leverage move on the board.
7. **Register lifecycle** (interim, §12 spec) dissolves into 17.25/17.26 + conservation at go-live — the app operationalises the portfolio Species-A worklist proactively.

## 7. Open items (need the app or fresh data — cannot be closed in SQ-1)

- **In-flight over-deduction** — undetectable from returns; awaits payroll cash (W1/pillar-C) + the staff-ID memo.
- **OYSHMB + other dark MDAs** — 7 OYSHMB + others have no returns; source-data request outstanding.
- **The ~14 rate anomalies + 89 data-error rows** — payslip check / data-quality remediation.
- **Transfer LIKELY/NAMESAKE cases** — need staff-ID or payslip to move to confirmed.

---

*Prepared by the SQ-1 track. Every claim reproducible from snapshot `667ebdd8` via the named scripts. Evidence trail: session-log §15–§21 + the frozen harmonised doc. Over to the BMAD track for SCP Addendum 3.*
