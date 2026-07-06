# SQ-1 Engine Track → BMAD Handoff, Part 2 (2026-07-05)

**From:** SQ-1 / engine track (Opus agent) · **To:** BMAD / app track (Fable agent → PM John)
**Purpose:** everything the SQ-1 track did *after the Part-1 handoff* (`sq1-track-handoff-to-bmad-2026-07-04.md`) — two new detection species that push **past** the detection ceiling without inventing certainty, plus the Query Station that packages all of it for auditors. **Decision for BMAD: which of these become app detection layers, and against which stories.**
**Anchoring:** same frozen catalog `SHA 667ebdd8` (104,396 records), **no new rebuild.** Same routing discipline as Part 1 (SPEC → PRD delta · BUILD → repair story · PLAN → amendment/new story · DATA → AG memo). H-numbers remain the foreign key to `harmonised-findings-2026-07-04.md`; items here are **new post-freeze findings** for John to route.

---

## 0. Where this picks up

Part 1 established the **detection ceiling**: the MDA return is the *schedule*, not cash, so the returns prove only **Species A (balance below zero)**; everything in-flight needs payroll. This part reports the two places we could go **further than "undetectable"** — not by guessing, but by **projecting a bounded estimate + naming the one document that resolves it.** The output is a small conceptual shift the app should adopt: **reconciliation findings are evidence-graded, not binary.**

## 1. Headline — findings are now graded into THREE species (the reusable idea)

| Species | What it detects | Provable from returns? | Portfolio | Resolver document |
|---|---|---|---|---|
| **A — Balance below zero** | deductions continued past completion | **Yes (proven)** | 202 (22 live / 179 vanished / 1 reconstruct), ₦8.63M | payslip confirms ≥ the magnitude |
| **B — Frozen-balance projection** | near-complete loan froze/vanished while owing | **No (projected/bounded)** | 311 (122 frozen / 189 vanished), ₦11.6M *ceiling* | MDA payslip for the quiet months |
| **C — Transfer restatement** | receiving MDA resumes at a lower paid count | **No (rewound/bounded)** | 29 physical / 21 reporting-layer, ₦3.27M *ceiling* | payroll for the transfer window |

**Why this matters for BMAD:** the app already has a provenance concept (17f.2: `BalanceProvenance`, `dataBasis`, `deriveProvenance`). The species framework is the same idea applied to *findings*: every reconciliation observation carries an **evidence grade** (proven / projected / rewound) and a **named resolver**, never a bare "anomaly." That grade is what keeps the non-punitive promise honest — *"below zero = proven; projected = estimated, pending payslip"* — and it's the difference between "we accuse" and "we ask for one document." **Recommend the app model findings this way** (extend the provenance enum to reconciliation findings, not just balances).

---

## 2. Species B — frozen-balance projection (NEW detection method)

**What it is.** A loan that **froze positive** (balance carried forward un-moving) or **vanished** while still owing a small balance. The returns can't prove over-deduction, but `deductions_remaining = ceil(last_balance / monthly)` gives a **projected completion month**; any deduction past it is over-recovery, **bounded** and resolvable with one payslip.

**Worked case — Kolade Taiwo Amos (FIRE, OYSG/010328):** froze at ₦42,498.75 (May 2025) = exactly 5 deductions left → projected completion ~Oct 2025 → Sep–Nov 2025 deductions bounded ₦0–₦25,499, pending the FIRE payslip.

**This refines the Part-1 ceiling.** Part 1 said in-flight is undetectable. Species B is the **partial exception**: for the near-complete/frozen subset, we convert "undetectable" into **"bounded estimate + specific payslip ask"** — actionable without full payroll, and it *names* the payroll slice needed. It is honestly a **two-sided reconciliation gap** (completed / still-owed / over-recovered), never a finding.

**Detector:** `scripts/legacy-report/projection-register.ts` (tunables: ≤6 deductions remaining, frozen-tail or vanish-gap ≥2, confident monthly).

| Finding | Type | Provenance | Target story / AC |
|---|---|---|---|
| Frozen-balance projection worklist (311) | new (value) | BUILD + SPEC | **16.1 / conservation**: app runs Species-B proactively; output is a **payslip-request worklist**, not a refund figure. Ties resolver to **17.3b / pillar-C payroll snapshot**. |
| Evidence-graded finding model | new (design) | SPEC | Extend **17f.2 provenance** to findings: grade = proven/projected + named resolver; blocks any "over-deducted" label on a projected case. |

## 3. Species C — cross-MDA transfer restatement (NEW; hits the identity layer directly)

**What it is.** One person's **one loan** moves between MDAs and the **receiving MDA resumes at a lower installments-paid** than the sending MDA reached — the balance jumps **up** by ~Δ×monthly, so the same installments can be collected twice. Detector stitches the loan across MDAs by **confident identity** (OYSG ID, or name+principal+monthly), **segments loans by principal** (sequential loans never fused), and **arithmetic-guards** the rewind (balance must jump by ~Δ×monthly — this rejects new-loan-of-same-principal false positives).

**Worked case — Oke Elizabeth Folashade (₦600k, OYSG/4567):** Agriculture reached paid 38 / ₦249,326 (Aug 2023); Education resumed at paid 35 / ₦283,325 (Jan 2024) = Agriculture's **8-month-stale May-2023 snapshot** → balance +₦33,999 = 3×₦11,333, Education re-collected installments 36–38. Bounded ≈ ₦34,000, pending the Jun 2023–Apr 2024 payroll.

**Two kinds — a data-model fact the app must encode:**
- **Physical transfer** (29) — different employer; the real duplicate-deduction risk.
- **Reporting layer** (21) — the "receiving MDA" is a **central collector (CDU, AANFE/ANFE)** or a flip back to the same MDA; **same person in two reporting layers**, not a job move. *(PO-confirmed 2026-07-05: Agriculture↔CDU is exactly this parent/child pair.)* The app's MDA model needs a **collector/parent registry** so these never enter the transfer queue.

**Cohorts:** several people restated at the *same* handoff at once (BIR→Works ×4, Governor Office→Works ×3) = **one batch re-baselining event** — fix the handoff, not the person.

| Finding | Type | Provenance | Target story / AC |
|---|---|---|---|
| Transfer continuity guard | new (**blocking**) | PLAN | **17.4 / 17.5 + Transfer Handshake**: on cross-MDA reassignment the receiving MDA MUST carry forward the true installments-paid; a **backward restatement is a blocking reconciliation event**, not a silent overwrite. Ties to W2 `loan_mda_reassignments` + `person_loans`. |
| Collector (parent/child) MDA registry | new (data-model) | BUILD | MDA hierarchy must flag CDU/AANFE as **collecting units** so layer-timing variance ≠ transfer. |
| Physical-transfer restatement worklist (29) | new (value) | BUILD | app runs Species-C proactively; resolver = transfer-window payroll (17.3b). |
| Cohort/batch detection | new (value) | BUILD | surface batch re-baselining so remediation is one handoff fix, not N cases. |

## 4. Both B and C reinforce Part-1's master conclusion

Every species' worklist **terminates in a specific payslip/payroll request.** So **payroll-cash ingestion (pillar C / W1 / Story 17.3b) is not only the path to in-flight detection — it is the single resolver for the entire finding portfolio (A-confirm, B, C).** This strengthens the Part-1 recommendation to elevate payroll ingestion from nice-to-have to prerequisite. The app's data-request workflow should emit these worklists as **structured payroll asks** (person, MDA, month-range) — the detectors already produce exactly that shape.

## 5. The Query Station — reference implementation, deployed

Everything above is live in the auditor **Query Station** (headless-Claude Q&A + browsable views), deployed to D: (checksum-current). It is both the **working proof** the detectors are useful *now* (pre-app) and a **reference implementation** the app can mirror:
- Tabs: **Balance below zero (A)** · **For payslip review (B)** · **Transfer restatements (C)** · Portfolio (63-MDA inventory) · 47 referred cases; every worklist row opens full history (trajectory + sparkline + paid count), non-punitive throughout.
- The **brain** (`system-prompt.md`) now reasons in all three species and refuses to over-claim (verified live on Kolade and Oke — it separated Oke's CDU reporting-layer from the real transfer unprompted).
- Detectors are the canonical source both the station and the AG registers read from — single source of truth.

## 6. Recommended routing (the decision for John / Fable)

1. **Adopt the evidence-graded finding model (SPEC)** — extend 17f.2 provenance to reconciliation findings (proven / projected + named resolver). Low cost, high honesty payoff; unifies A/B/C.
2. **Species A + B as proactive app layers (16.1 / conservation)** — portfolio sweeps that emit payslip-request worklists; DELTA watches for newly-crossed and newly-resolved.
3. **Species C as a blocking AC on the transfer handshake (17.4/17.5)** — continuity guard + collector registry; this is the highest-leverage item because it *prevents* future over-recoveries at the source, not just detects them.
4. **Payroll ingestion (17.3b / pillar C / W1) = master resolver** — sequence it first; the three worklists are its consumers.
5. **Reuse the detectors as acceptance fixtures** (Team Agreement 15 parity) — Kolade and Oke join the 47-case golden set as canonical B/C regression anchors.

*Decision left to BMAD:* whether B/C run proactively (portfolio) or on-demand; where thresholds live (app-configurable vs fixed); where the CDU/AANFE collector registry is seeded.

## 7. Open questions for BMAD

- Proactive vs on-demand for B/C (portfolio sweeps are cheap but produce large worklists — 311 / 50).
- Threshold governance: B's "≤6 deductions remaining", C's rewind guards — config or code?
- Collector registry: is CDU/AANFE already modelled anywhere, or net-new reference data?
- Do B and C findings post to the ledger (as observations) or stay in a review surface until a payslip confirms? (Ties to W1 posting rules.)

## 8. File index (all reproducible from `667ebdd8`)

**Detectors** (`scripts/legacy-report/`, uncommitted per side-quest convention):
- `projection-register.ts` — Species B (frozen-balance projection). `buildProjectionWorklist()`.
- `transfer-restatement.ts` — Species C (cross-MDA restatement). `buildRestatementWorklist()` + `cohorts()`.
- (Part-1: `overdeduction-register.ts` A · `overdeduction-rate.ts` · `overdeduction-transfer.ts` · `overdeduction-regression-2026-07.ts` harness.)

**AG deliverables** (`docs/Car_Loan/analysis/reports/`):
- `AG-Projection-Worklist-2026-07-05.md` — Species B, 311 cases, Kolade worked example.
- `AG-Transfer-Restatement-Worklist-2026-07-05.md` — Species C, 29 physical + cohorts + reporting-layer, Oke worked example.
- (Part-1: `AG-Reconciliation-Register-2026-07-04.md` · `AG-Portfolio-BelowZero-Worklist-2026-07-04.md` v1.3 · `AG-Data-Requests-2026-07-04.md`.)

**Reference implementation:** `scripts/legacy-report/query-station/` (system-prompt.md brain · build-station-views.ts · public/ views) — deployed to D:, checksum-current.

---

*Prepared by the SQ-1 track, continuing Part 1. Every claim reproducible from snapshot `667ebdd8` via the named scripts. The three-species framework + its resolver-payroll dependency are the substantive inputs for SCP Addendum 3/4. Over to the BMAD track.*
