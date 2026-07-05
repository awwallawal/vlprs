# Session Log — Over-deduction Sweep & the Ledger Reframe

**Thread window:** 2026-07-02 (crash) → 2026-07-03 (recovery + continuation)
**Track:** SQ-1 legacy Car-Loan analysis (uncommitted-by-convention; not VLPRS app code)
**Status:** LIVE — update as we proceed. Written specifically so we can resume cleanly after a crash.

> Non-punitive vocabulary is mandatory in any output from this thread: "Observation" not "Anomaly", "Variance" not "Discrepancy", "Balance below zero" not "Over-deduction" (borrower-facing), "For review" not "Flagged". Amber/gold for attention, grey for neutral — no red badges.

---

## ⏩ RESUME HERE (read this first if the session was lost)

**★ SINGLE SOURCE OF TRUTH (post-close 2026-07-04):** the frozen **`harmonised-findings-2026-07-04.md` (H1–H26)** is the BMAD input — land there first on crash-recovery. **This log = evidence trail + go-forward (§14); the deliverable = `docs/Car_Loan/analysis/reports/AG-Reconciliation-Register-2026-07-04.md`.** Everything in §1–§13 below is superseded-but-preserved history.

**Where we are:** Foundation Audit + 47-case validation + two-agent harmonisation are **CLOSED** (§13). Verdict: modify/re-charter, not rebuild. Harness `overdeduction-regression-2026-07.ts` PASS. Deliverable at v1.1 (harmonised, Samson → DATA_RECONSTRUCTION).

**Immediate next action:** **Track A (SQ-1) = `sq1-hardening-plan-2026-07-04.md`** (resumable, 5 phases; next concrete step = 0.2 freshness audit → 1.1 period-parse fix → detectors → validate → scale → regenerate). **Track B (app/BMAD)** = harmonised doc → PM John. DATA memos drafted (`AG-Data-Requests-2026-07-04.md`, sendable now). Judgment items still Awwal's: portfolio-sweep scale, borrower-statement pull-forward, W1 staleness-chip.

**Decisions locked (crash-safe ledger — all captured below):**
1. Session-log framed around the ledger reframe; 47 = validation set inside it. → §RESUME, §5b
2. Q2 answered = archaeology + forward-bookkeeping (not the single-residual). → §5b, §8.5
3. Foundation verdict = **re-charter the anchor, NOT rebuild**; layered keep/harden/build. → §8, open-decision #4 RESOLVED
4. Reframe graduates into BMAD pipeline (SCP Addendum 3 / re-charter Epic 17 + new E/F epics). → §8.6
5. Frontend IA = 3 primitives (worklist/object/action), person-as-spine, role≠persona; 9-cluster UX/IA epic. → §9
6. **Refund authority = AG sole approver** (Dept Admin initiates, certificate-with-comment); needs new SCP FR. → §9.7#1
7. SQ-1 Hardening Protocol = 47-as-golden-harness, findings dual-recorded as proto-stories, refund dossiers need provenance+confidence. → §10
8. Baseline result = **4/46 caught by the untouched sweep (~9%)** (corrected from 5 via cross-review; Adeleke Muibat = LIVE_BELOW_ZERO, most-urgent, missed-by-design); miss is wrong-detector (Species A vs B), slope detector is #1 fix. → §10.5
9. **OYSHMB is dark** (0 catalog records, Awwal-confirmed): **7 truly dark + 4 cross-MDA + 1 no-name = 12 unresolvable-from-catalog.** → §11.2
10. **Cross-MDA re-tiering (verified):** 15/47 matched a name in a *different* MDA = transfer hypotheses (not namesakes-to-discard). **Clean SAME_MDA + below-zero Tier-1 = 3** (Ajibade, Aliyu, Bakare), not 5; Adeleke + Samson move to transfer-verify. Transfer-projection method defined. → §11
11. **"MDA-gate and discard" retracted** → flag-and-route cross-MDA as transfer hypothesis. → §11.6

**Still OPEN (not yet decided):** (a) promote-harness-first vs slope-detector-first; (b) softening "born at approval" → "origin-graded, approval-preferred" (§8.5); (c) Phase-2 role sequencing (§9.8); (d) **step b — build MDA-aware transfer test on the 15 cross-MDA cases** (§11.8); (e) harmonisation-process decision from the sequestered-file reveal (blind-read compromised).

**Two questions that were still open when we paused:**
1. Session-log scope — RESOLVED: framed around the ledger reframe, with the 47 as validation set inside it (this document).
2. Q2 "reason" confirmation — the reason Awwal wanted Q2 answered first: the fresh frame reveals today's "blind spots" are not sweep bugs but artifacts of using the wrong source of truth. Confirmed by the Fable-5 answer.

**How to run the scratch scripts** (from project root `C:\Users\DELL\Desktop\vlprs`):
```
apps/server/node_modules/.bin/tsx scripts/legacy-report/_tmp-zero-vanish.ts
apps/server/node_modules/.bin/tsx scripts/legacy-report/_tmp-check-names.ts
```
Catalog source: `docs/Car_Loan/analysis/foundation/catalog.json` (101,338 records, 58 MDAs).

---

## 1. How the session started — crash recovery

Awwal's laptop went down mid-session. Recovery via most-recently-modified files surfaced two untracked scratch scripts touched 2026-07-02 ~17:45–17:56, with nothing written to a session log. Both scripts survived and still run. The full prior transcript was also preserved in `auditor_app.txt` (lines 614–645 = original question set; 650–1005 = recovered transcript incl. a second Fable-5 continuation).

---

## 2. The trigger — Bakare Vivian

A borrower, **Bakare Vivian**, walked in with **payslip proof of ~3 months of over-deduction** (−17,291 + −34,583). Catalog shows **BAKARE VIVAN B [HEALTH]**, lastBal −34,582, ~2 months over on the sweep's arithmetic. This is the prototype case and the origin of the whole sweep.

> **Signal, not anecdote:** the single best piece of evidence in the entire system (payslip-grade) arrived *by a borrower walking in*, beating 101,338 catalogued records. This directly motivates inversion #2 below.

---

## 3. What the sweep found — `_tmp-zero-vanish.ts`

Groups every catalog record into `(MDA, person)` threads; finds threads whose **last recorded balance reached ≤ 0** and who then **vanished from that MDA's later returns**.

**Live re-run 2026-07-03 (8,023 threads scanned):**

- **PRIORITY — balance below zero, then vanished: 173 threads**
  - Visible over-collection (sum of last negative balances): **₦6,647,111**
  - Invisible-window upper bound (gap × monthly, *if* deductions continued): **₦72,881,952**
  - By MDA: EDUCATION 78, CDU 26, AGRICULTURE 24, INFORMATION 8, BIR 8, ESTABLISHMENT 5, …
  - Triage: **32 CREDIBLE** refund candidates (since 2024-08, ≤4 months over, clean monthly; visible ₦545,503) + **141 DATA-REVIEW** (old or many-months-over → likely mis-entered balance). Includes **LAMIDI MORUFU [BIR]** — the canonical over-deduction fixture — confirming the classifier catches the right cases.
- **SECONDARY — balance ~zero, then vanished: 694 threads** (loan completed then dropped; mostly normal, but the app cannot confirm the deduction actually *stopped*). Top: EDUCATION 114, AGRICULTURE 86, CDU 68, LANDS AND HOUSING 60, …

> Note: earlier run's labels baked "~25 / 141 / 694"; live re-run gives **32 / 141 / 694** (catalog/threshold drift).

---

## 4. The 6-name spot-check — `_tmp-check-names.ts`

Fuzzy-matches 6 names against the catalog, buckets each. **Result: 2 of 6 caught — and the 4 misses each break a *different* hurdle.**

| Name | In sweep? | Catalog reality |
|---|---|---|
| Folashade Olubukola Ajibade | ✅ CREDIBLE | [INFORMATION] 0 → −26,666 → −53,332, 2mo over |
| Aliyu Adekunle Taofeek | ✅ CREDIBLE | [INFORMATION] 0 → −4,722 → −9,445, 2mo over |
| Aboderin Dele Ezekiel | ❌ not in catalog | no close-spelling match — **identity gap** |
| Kolade Taiwo Amos | ❌ never below zero | [FIRE] balance **flatlines at 42,499** — **stale template** |
| Oke Elizabeth Folashade | ❌ never below zero | positive across EDUCATION/AGRICULTURE/CDU (transfers/namesakes) |
| Aremu Olubunmi Omolara | ❌ balance null | [ACCOUNTANT GENERAL] template captures **no balance** — **PARSER_BLIND** |

**The pattern (why this matters):** the below-zero sweep only catches over-collection that clears three hurdles at once — (1) matchable name in catalog, (2) template captured a balance, (3) balance crossed below zero *in the recorded window*. Each miss knocks out a different hurdle. **The sweep structurally under-counts.**

**Two data bugs logged:**
- Aliyu's tail shows period `2025-00` (month 0) — **period-parse defect**.
- Kolade's flatlined 42,499 — **stale-template blind spot confirmed live in FIRE**.

---

## 5. Question 2 — the fresh-perspective answer (the conceptual backbone)

Q2 asked to set all prior knowledge aside and reconsider the whole project fresh (63 MDAs, monthly self-reports, 13.33% flat / 60-month tenure, staff transfer with loan, early payoff). Answered **twice**; the second (repo-grounded, Fable 5) supersedes the first.

### 5a. First answer (SUPERSEDED) — "schedule-as-truth, one residual"
Every loan is deterministic, so treat the computed schedule as truth and each return as an observation; reconciliation collapses to one metric `residual = observed − expected`. Directionally right, but **revised** because: (1) **circular** — with 7.6% start-date coverage the schedule must be inferred from the same observations it judges; (2) **conflates contract vs cash** — mixes refund cases with paperwork cases; (3) **purely analytical** — misses that the biggest wins are contractual, not analytical.

### 5b. Second answer (AUTHORITATIVE) — archaeology + forward bookkeeping

Six ground-truth facts a cold repo read must survive:
1. The "standard" isn't standard — only ~64% run 60 months (large populations at 50/48/40/36/30/24); 1,058 people hold multiple loans.
2. Start dates known for **7.6%** of records; staff IDs **25%**; principal 97.5%; balance 91.4%. The two parameters you most need — start & owner — are the ones the data lacks.
3. Each MDA is its own instrument (~42 template shapes; typo-headers, multi-month packing, mid-sheet splits; ~60% raw-row dupes; 10,259 records / ₦1.78bn fail their own row arithmetic).
4. Reports state **balances (stock)**; reality is **deductions (flow)**. Flows aren't recoverable from stale stocks; stocks are always recomputable from flows.
5. Maximum truth is **loan approval** (committee list: person + principal + start all known). Current catalog anchors on monthly returns instead.
6. Best evidence walked in the door (Bakare) — a signal about where evidence quality lives.

**The reframe:** the State disbursed to ~6,500 people with **no central account** for any of them. This is not analytics and not data-cleaning — it is **reconstruct a central ledger that should have existed, then operate it forward.** Two projects, different epistemics:
- **Backward = archaeology** (inference, confidence-graded, **must be designed to terminate** in an *attested opening balance* per loan as of a cut-over date, with borrower + MDA sign-off, sub-materiality variances absorbed by policy). Without a closure mechanism, history is re-litigated on every re-run forever.
- **Forward = bookkeeping** (deterministic; every deduction is an event posted once; the monthly return becomes a *confirmation*, not a data source).

**Five design commitments:**
1. **Atomic fact = the deduction event; balance is a checksum.** Fold events to derive balance. A flatline = a *missing flow* = a finding, not a blind spot.
2. **A loan is born at approval, not first report.** Mint identity + loan from the committee list; every monthly row is evidence attached to a known account. Turns identity from unsolvable 100k-row clustering into tractable roster-matching (~6,500 accounts); failures enumerate as RESOLVER_MISS / namesake.
3. **Three ledgers, pairwise reconciliation:** *contract* (fitted per loan from approval, not assumed) vs *cash* (what payroll took) vs *report* (witness statement, graded by instrument). Cash > contract = over-collection (refund); cash < contract = stalled loan (resume); report ≠ cash = reporting-quality (template) — **different owners, different urgency.**
4. **Parameters estimated with stated confidence, never assumed.** Same ₦34k variance = refund case if start observed, data-review case if fitted from two snapshots. Confidence becomes structural, not a calendar heuristic.
5. **Conservation: "vanished" is not a state.** Every naira is always in exactly one bucket (collected/outstanding/written-off/refundable); every loan in exactly one lifecycle state, ending only in a proven terminal event. A thread that stops appearing is by construction an open worklist item that cannot silently drain. *The entire zero-vanish sweep exists only because the current frame permits threads to end without a state.*

**Three inversions (make it better — these compound; detector tweaks don't):**
1. **Issue, don't collect** — center sends each MDA a pre-filled expected-deductions statement monthly; MDA confirms/annotates exceptions. Diffing your own issued doc is trivial; parsing 42 freestyle templates is heroic. Parsing engine survives only for the (terminating) archaeology.
2. **Enlist the borrower — 6,500 free auditors.** Annual/on-demand statement per borrower ("we record ₦X of ₦Y paid; deductions stop month Z"). Agreement = attestation; disagreement = payslip-grade evidence arriving unprompted. Inherently non-punitive: a service, not surveillance. Bakare is the prototype working before we built it.
3. **Give history an ending** — the attested opening balance. Success metric shifts from "variances found" to "% of loans at an attested opening position, at what confidence" — a number that reaches 100% and stays.

**What the app already embodies (cold read validates the skeleton):** immutable ledger entries with computed balance, scheme-formula engine, three-way reconciliation, auto-stop certificates, loan state machine. **Missing organs:** first-class person entity minted at approval, loan-origination anchor, bi-directional statement issuance, opening-balance closure to end the archaeology.

**In this frame:** the 47 pending cases + yesterday's sweep = **the validation set for the archaeology track**; Bakare = prototype of inversion #2.

---

## 6. Parked / tangential

- **Q1 (this document)** — session log: DONE (open, live).
- **The original "big" Q2** was tangential to the side quest; Awwal wanted it answered first so the log carries robust conceptual context before we resume the 47-case work. Rationale confirmed.
- **"a and b" and the 47-list** — Awwal referenced "we'll do both a and b" and "47 recorded cases pending"; the 47 list itself is still to be provided.

---

## 7. Open decisions / next steps

- [ ] **Awwal provides the 47-case list** → cross-reference against sweep buckets (catch-rate + per-miss blind-spot class). NEAR-TERM NEXT.
- [ ] Decide whether to harden the sweep (add null-balance imputation + flatline detection) *before or after* the 47-run.
- [ ] Fix the two data bugs (period `2025-00` parse defect; confirm stale-template detection).
- [x] **RESOLVED (2026-07-03):** graduate the reframe into the BMAD pipeline — see §8 Foundation Audit. Not a rebuild; re-charter + consolidate + build-missing-organs.
- [ ] Take §8.4 layered verdict through BMAD (SCP Addendum 3 candidate / re-charter Epic 17 + new E-issuance & F-attestation epics). Decompose each row into stories.
- [ ] Confirm the §8.5 self-critique with Awwal: soften "born at approval" → "origin-graded, approval-preferred"; formally split archaeology vs forward-bookkeeping tracks.

---

## 8. Foundation Audit — critical architectural review (2026-07-03)

Ran five parallel `file:line`-cited surveys (server data model / ingestion / frontend / BMAD planning state / loan-math & topology), each with a *criticise-don't-validate* mandate. Load-bearing claims re-verified against source by hand. This section is the answer to "do we add / modify / restart so we don't build on a wrong foundation."

### 8.1 The one-sentence verdict

**Do NOT restart, and do NOT "keep building as-is." The app's core machinery is genuinely sound and must be preserved; the foundational error is *epistemic, not structural* — the system is architected to COLLECT and DETECT when the domain requires it to ISSUE and ATTEST. Every confirmed weakness is a symptom of that single root. So the correct move is to _invert the epistemic stance and re-charter the anchor_, keeping most existing code, not to rewrite.**

### 8.2 What is genuinely SOUND (keep — throwing this away would be the real mistake)

- **Loan-math engine is pure, correct, and well-tested.** `computationEngine.ts` (528 LOC, no I/O) with **93 hand-verified test cases**; deterministic from `(principal, rate, tenure)`; tenure-aware (**refuses to default to 60** — `inferSchemeExpectedTenure` returns null, never silently 60).
- **Money math is defensible.** Every naira column is `numeric(15,2)`; all arithmetic via `decimal.js` at precision 20, ROUND_HALF_UP. **No floating-point on money** (hypothesis contradicted).
- **The immutable ledger + derived balance already exist.** `ledger_entries` is append-only (DB trigger `fn_prevent_modification`); balance is *always computed* (`totalLoan − Σentries`), never stored. Pillar B is already half-built.
- **A real enforced loan state machine exists** (`VALID_TRANSITIONS` + `TERMINAL_STATUSES`, row-locked transitions, immutable transition log).
- **Low debt, clean migrations, strong coverage:** 127 server test files, 46 versioned migrations, only 7 TODO/FIXME across `apps/server/src`.
- **Mature certificate/auto-stop + public verification.** Production-grade.
- **A genuine cross-MDA person view exists** (`StaffProfilePanel`) — good, but orphaned (see 8.3).
- **Non-punitive vocabulary is enforced-by-construction** in the Observation/Variance components via shared constants.

### 8.3 What is FOUNDATIONALLY WRONG (the epistemic root and its symptoms)

**Root cause — the system collects freestyle and detects after the fact, instead of issuing expected figures and collecting attestations.** Symptoms, each verified:

1. **No first-class Person entity.** Only `personMatches` (name-pair confidences) exists — no `persons` table. Identity is denormalised name/ID strings copied per row; continuity/transfer/namesake/dedup all reduce to fuzzy string-matching at write time. *(Epic 17.3/17.4 plans the table but it is not built.)*
2. **Two disjoint ingestion regimes, and the real one is the throwaway.** The freestyle 42-template parser that handles actual MDA files is the **uncommitted SQ-1 side-quest engine**; the committed production path (`fileParser.ts`) is a rigid **8-column positional CSV** (`row[0]..row[7]`) that **no MDA produces** — one inserted column mis-maps every field. The production ingestion for the data that matters is code the team decided never to version.
3. **Statement issuance does not exist (pillar E).** The centre hands out a blank template and reverse-engineers correctness from whatever 63 MDAs freelance back. No per-loan expected figure is ever issued for confirmation.
4. **Balance is trusted stock with no expected-value check and no flow reconstruction.** The one field auditors rely on (91.4% coverage) has *no* scheme-expected to reconcile against; its reverse-engineered check vanishes whenever payment history is absent (the norm at 7.6% start-date coverage). Month-over-month deltas are never used to recover actual deductions — the richest signal is used only for amber flags.
5. **Fail-open parsing / no PARSER_BLIND.** Unrecognised columns dropped, all-null-financial rows dropped, no-period rows dropped from dedup. "Not reported" is indistinguishable from "parser missed it" — both become `null`. PARSER_BLIND exists only in `.md` proposals.
6. **No conservation — "vanished" is not a state.** A loan created ACTIVE from a baseline that never recurs stays ACTIVE forever; nothing routes a drained thread to a terminal event. *(This is the entire reason the zero-vanish sweep of §3 exists.)* Transfer mutates `loan.mdaId` in place and **orphans historical ledger rows** under the old MDA; a second uncoordinated mutator (`deduplicationService`) also rewrites MDA ownership.
7. **Reconciliation is ephemeral, fragmented, and has no accounting force.** Four unshared variance taxonomies; the "three-way" compares single-period *amounts* stored as recomputable JSONB blobs; runtime "expected" is a **frozen `loans.monthlyDeductionAmount` column**, not a fresh scheme recomputation. Over-deduction produces an **observation, never a financial reversal**.
8. **No refund / correction rails (blocks the 47-case work directly).** "Process refund" appears only as prose in `description`/`suggestedAction`. The actual resolution enum is `verified_correct | adjusted_record | referred_to_mda | no_action_required` — **no issue-refund, no amount, no AG-authorization, no certificate-with-comment.** *(17.26 plans it; not built.)*
9. **No borrower in the loop (pillar F).** Zero authenticated borrower surface; the ground-truth holder can't see or confirm their record. `/verify/:cert` fires only *after* closure.
10. **Non-punitive regression:** the parallel **Exception queue is punitive** ("Flag Exception," AlertTriangle, `ghost_deduction`, red status chips) — a non-compliant island beside the compliant Observation layer.
11. **Scheme formula has no single owner:** the authoritative `(P×0.1333)/60` lives only in `computeSchemeExpected`, but balance/auto-stop/certificate run through `computeRepaymentSchedule`, which trusts a stored per-loan `interestRate` — **two interest models in one file** that diverge if a rate is mis-stored. The engine is also **not calendar-anchored** (`monthNumber`-indexed, no `startDate`), so it cannot impute a null balance for a named month. And it is physically **forked three ways** (server + `auditor-station/vendor` hand-copy + SQ-1 engine), reconciled only by a manual SHA check.

### 8.4 Layered verdict (per layer — not a single slogan)

| Layer | Verdict | Action |
|---|---|---|
| Loan-math engine | **KEEP + PROMOTE + FIX** | Lift to `packages/shared` (kill the 3-way fork), collapse two interest models to one scheme-driven path, add a **calendar-anchored projector** (ideal-vs-actual per month → imputes nulls, detects flatlines). |
| Immutable ledger + state machine | **KEEP + HARDEN** | Forbid the bypass paths; enforce conservation (no ACTIVE-forever); fix transfer orphaning `ledger.mdaId`; single owner of MDA ownership. |
| Identity model | **RE-CHARTER (not rebuild)** | Ship the `persons` table; unify Epic-17 returns-anchored identity + reframe approval-anchored identity into **one confidence-graded identity with approval as *preferred* origin** (see self-critique 8.5). |
| Ingestion | **CONSOLIDATE (biggest structural fix)** | Promote the real freestyle parser into the app + version it; add PARSER_BLIND; stop fail-open silent drops; recover flows from balance deltas. |
| Reconciliation | **UNIFY + PERSIST** | One shared taxonomy; durable pairwise contract/cash/report records with accounting force. |
| Refund / correction rails | **BUILD (missing organ)** | AG-authority refund workflow + certificate-with-comment. Unblocks Bakare / the 47. |
| Statement issuance (E) | **BUILD (new epic)** | Invert collection chaos at source. |
| Borrower attestation (F) | **BUILD (new epic)** | Give the ground-truth holder an input surface. |
| Opening-balance closure (G) | **ADD closure semantics** | Building blocks exist (3.4 / 8.0j / 17.33); add per-loan attested-opening + a termination metric ("% of loans attested"). |
| Non-punitive compliance | **FIX (regression)** | Bring the Exception queue under the mandate. |

### 8.5 Self-critique — where the reframe (§5b) is itself wrong

Per the "criticise, don't validate" instruction, turning the lens on my own frame:

- **"Mint the loan at approval" cannot be universal.** Approval/committee data covers only a subset (pre-2024 loans have no register). So approval cannot be the *hard* origin — it must be the **highest-confidence tier** of a confidence-graded origin, falling back to fitted-from-earliest-observation. This actually *converges* with Epic 17.8's fingerprint approach; the two stances are not either/or. **The reframe must soften from "born at approval" to "origin-graded, approval-preferred."**
- **The single-residual idea (first Q2 answer) is dead** — it conflated contract vs cash and was circular. Superseded by the three-ledger split; retained here only as a documented rejection.
- **Issue-and-attest is a *forward-operations* redesign; it does not retroactively fix 7 years of legacy.** The archaeology track (messy parser + fitting + confidence, terminating in attested opening balances) still must run in parallel. The app today's core mistake is **conflating archaeology and forward-bookkeeping into one collect-and-detect pipeline.** The fix is to *split* them, not to replace one with the other.

### 8.6 Recommendation into BMAD

This graduates open-decision #4 to **YES — into the pipeline** (SCP Addendum 3 candidate, or a re-charter of Epic 17 + two new epics E-issuance / F-attestation). Nothing here is a from-scratch rebuild; it is **re-charter + consolidate + build-missing-organs**, sequenced as stories so each nuance is captured. The 47-case run remains the near-term validation set and feeds the refund-rails story directly.

---

## 9. Frontend Information Architecture — "what screens for whom" (2026-07-03)

Grounded in a full read of the canonical PRD (`_bmad-output/planning-artifacts/prd.md`) + the frontend audit (§8) + the ledger reframe (§5b). Answers Awwal's headache: *how to present the app so every user category navigates intuitively.* Feeds a dedicated UX/IA epic in the SCP.

### 9.1 Diagnosis — why it feels hard to navigate

The app is organised around **the system's data-entry unit (MDA → submission → month)**, not around **the job the user is trying to do**. Audit symptoms all trace to this one inversion: the good cross-MDA Person view (`StaffProfilePanel`) is orphaned under `/migration/` with no nav entry; global search is a "coming soon" toast; navigation is a **flat 17-item list filtered by role**; the punitive Exception queue sits beside the compliant Observation layer; over-deduction has no action surface. Users must reverse-engineer where to go.

### 9.2 The fix — three IA primitives, identical for every role, scoped by authority

1. **HOME = my worklist ("what needs me now").** Every role lands on an actionable queue scoped to its authority, not a wall of charts. Generalises FR33 Attention Items to all roles.
2. **OBJECTS = four nouns, globally searchable: Person · Loan · MDA · Period.** Each has one canonical detail page. **The Person becomes the spine** (fixes the orphaned profile + stubbed search). FR99 "every number is a doorway" already means every metric drills into one of these four objects.
3. **ACTIONS = surfaced in context on the object, gated by role.** Refund, resolve observation, confirm statement, approve loan, issue certificate — no orphaned action screens.

### 9.3 The single biggest unlock — **role ≠ persona**

One role can serve distinct personas needing different home surfaces:
- **Super Admin = two personas.** AG (executive: 4 headline numbers, mobile, one-tap Cabinet report — FR32-37) vs Deputy AG (investigator: Attention Items, Staff Trace FR88, comparison view). Give them **two landing surfaces under one role**, not one compromise dashboard.
- **MDA Officer changes job under issue-and-attest** (reframe pillar E): from "upload a freestyle spreadsheet" to "**confirm my issued statement + annotate exceptions**." That rewrites their entire home.

### 9.4 User categories (PRD's 7 roles + reframe deltas)

| # | Category | Build status | One job |
|---|---|---|---|
| 1 | **AG** (Super Admin – exec) | MVP | "Tell me the number, from my phone." |
| 2 | **Deputy AG** (Super Admin – investigator) | MVP | "Catch the pattern before it's a crisis." |
| 3 | **Dept Admin** | MVP | "Run reconciliation + resolve items end-to-end." |
| 4 | **MDA Officer** | MVP | "Confirm my statement fast, report events." (issue-and-attest shifts this) |
| 5 | **Committee Admin** | Phase 2 (data-side only in MVP) | "Approve/defer applications." |
| 6 | **Front Desk Officer** | Phase 2 | "Answer a walk-in instantly; raise a ticket." |
| 7 | **Beneficiary / Borrower** | Phase 2 (+ attestation = NET-NEW) | "See my loan, confirm it's right, raise a concern." |
| 8 | **Auditor / Oversight** | Phase 2 (PRD role 7, read-only) | "Verify independently; write nothing." |

### 9.5 Persona × Screen access matrix (A = act · R = read · — = none)

| Screen / surface | AG | DepAG | DeptAdm | MDAOff | Cmte² | FrDesk² | Benef²ᴺ | Audit² |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Executive dashboard (headline) | R | R | R | — | — | — | — | R |
| Attention/Investigator home + Trace | R | A | A | — | — | — | — | R |
| **Global search (Person/Loan/MDA)** ᴳ | R | R | R | R∙own | R | R | — | R |
| **Person profile (cross-MDA spine)** ᴳ | R | R | A | R∙own | R | R | R∙self | R |
| Loan detail | R | R | A | R∙own | R | R | R∙self | R |
| MDA detail / compliance | R | R | A | R∙own | — | — | — | R |
| Submission — **issued-statement confirm** ᴺ | — | R | A | A | — | — | — | R |
| Reconciliation (contract·cash·report) | R | A | A | R∙own | — | — | — | R |
| **Observations / For-Review** (unified) ᶠ | R | A | A | R∙own | R | — | — | R |
| **Refund / correction workflow** ᴺ | A∙approve | R | A∙init | — | — | — | R∙self | R |
| Certificates | R | R | A | R∙own | — | R | R∙self | R |
| Committee approval workspace | R | R | R | — | A | — | — | R |
| Front-desk walk-in lookup + ticket | — | — | R | — | — | A | — | — |
| **Beneficiary self-statement + attest** ᴺ | — | R | R | — | — | — | A | R |
| Auditor read-only ledger + audit log | R | R | R | — | — | — | — | A |
| Reports / exports | A | A | A | A∙own | R | R | R∙self | A |
| User management | A∙CLI | — | A∙↓ | — | — | — | — | — |
| System health | R | R | R | — | — | — | — | R |

Legend: ² Phase 2 · ᴺ net-new (reframe) · ᴳ built-but-orphaned/stubbed today · ᶠ non-punitive regression to fix · `A?` refund authority unresolved (9.7) · ∙own/∙self = scoped.

### 9.6 Per-role navigation after redesign (worklist-first, noun-second)

- **AG:** Home *(Exec — 4 numbers)* · Portfolio · Reports · [search]
- **Deputy AG:** Home *(Attention worklist)* · Search · Observations · Trace · Reconciliation · Reports
- **Dept Admin:** Home *(Ops worklist)* · Search · Migration · Observations · **Refunds** · Certificates · Committee Lists · Users · Data Quality
- **MDA Officer:** Home *(My worklist)* · **My Statement to Confirm** · Upload · **My People** · Employment Events · My Reports
- **Beneficiary (P2):** My Loan · **My Statement** · Raise a Concern *(= attest)*
- **Auditor (P2):** Ledger · Audit Log · Reports *(all read-only)*
- **Committee (P2):** Approval Queue · Applications
- **Front Desk (P2):** Lookup · Walk-in Ticket

### 9.7 Gaps to reconcile in the SCP (PRD vs reframe)

1. **Refund authority — RESOLVED 2026-07-03: AG sole authority.** Dept Admin *initiates* the refund request; **AG is sole approver**; a **certificate-with-comment** is issued on approval (aligns with the memory overdeduction pattern / Lamidi class). PRD is currently silent, so this **requires a new FR in the SCP**. Matrix updated: refund row → AG = `A` (approve), Dept Admin = `A` (init), Deputy AG = `R`. Unblocks story cluster 4 and the 47-case correction workflow.
2. **Borrower-as-auditor / self-attestation is PRD-silent** — but the PRD *does* plan a Phase-2 Beneficiary Dashboard (login, status, history, statements, grievance). Correct move: **extend that planned dashboard with the attest loop**, not invent a parallel surface.
3. **Non-punitive regression:** the Exception queue violates hard requirement **FR22** (prohibited terms, no red, informational icons only). Unify Exception + Observation into one "For Review" worklist.
4. **Person-as-spine + global search** are implied by FR99 but unbuilt/orphaned — a foundational IA story, prerequisite to everything else.
5. **NDPR "right of access"** is a stated compliance principle with no MVP surface — realised only by the beneficiary dashboard; strengthens the case to pull it forward.

### 9.8 Proposed UX/IA epic decomposition (for BMAD)

A dedicated **UX/IA epic**, story clusters (each AC-governed by the 9.5 matrix):
1. **IA foundation** — global search + Person-as-spine top-level + canonical object-detail pages.
2. **Role-home worklists** — one story per role's "what needs me" landing.
3. **Observation/Exception unification** — non-punitive compliance fix (FR22).
4. **Refund/correction action surface** — governance resolved (AG sole approver, Dept Admin initiates, certificate-with-comment); needs a new refund-authority FR in the SCP. Unblocks Bakare / the 47.
5. **MDA-officer issue-and-attest home** — statement-confirm redesign (reframe E).
6. **Beneficiary portal + attestation** (P2) — extends planned dashboard (reframe F).
7. **Auditor read-only role** (P2) — PRD role 7 / Journey 10.
8. **Committee + Front Desk surfaces** (P2) — Journeys 8 & 9.
9. **Super-Admin persona split** — distinct AG vs Deputy AG landing under one role.

Companion visual artifact (role×screen map) generated 2026-07-03.

---

## 10. SQ-1 Hardening Protocol — the 47 as a golden regression harness (2026-07-03)

**Purpose.** Keep SQ-1 (the legacy analysis engine) providing trustworthy value *while the app is re-chartered*, without the two drifting apart. The 47 pending over-deduction cases (Bakare Vivian among them) become a **versioned regression harness for the archaeology track**, not a one-off check. SQ-1's parser is the *good* one (app's committed parser is the 8-col throwaway) and is slated to be ported into the app (story 17.2) — so every SQ-1 fix has two lives: it hardens the engine *and* becomes a proto-story for the app.

### 10.1 Why this is more than "patch + note" (the three risks it closes)
- **Divergence:** findings are recorded as *proto-stories with an app implication + target epic*, not loose notes — so SQ-1 hardening and BMAD stories stay in lockstep.
- **Governance:** refund outputs drive *real refunds to real people* → every confirmed candidate carries **provenance + confidence grade** before it reaches the AG. (Attested-opening-balance idea at single-case scale; feeds the AG-sole-authority refund workflow — see §9.7#1.)
- **Crash:** the harness is promoted out of `_tmp-*` scratch (which a crash/re-run wipes) into a **kept, named file** with expected results written into this log, reproducible from the log alone.

### 10.2 The workflow (6 steps)
1. **Honest baseline** — run all 47 through the *current* sweep unchanged. Record catch-rate + per-miss blind-spot class. *(Measure the gap before changing the ruler.)*
2. **Triage misses into fix-classes** (see 10.3). Each class → one SQ-1 hardening + one proto-story.
3. **Promote the harness** — `_tmp-check-names.ts` → `scripts/legacy-report/overdeduction-regression-2026-07.ts`, seeded with all 47 + canonical fixtures (Lamidi, Alatise, ADELEKE, CDU). Still uncommitted per convention, but named + durable; expected results logged in 10.6.
4. **Fix SQ-1 per class**, re-running all 47 + fixtures as a **regression gate** each time — *nothing that fixes a miss may break a fixture (esp. Lamidi).*
5. **Dual-record** each finding in 10.5 (SQ-1 fix ✓ + app implication + target story).
6. **Per-case refund dossier** for confirmed candidates (10.4 schema) — the AG-facing deliverable.

### 10.3 Fix-class taxonomy (each maps to an app story)
| Class | Symptom | SQ-1 fix | App proto-story → target |
|---|---|---|---|
| `IDENTITY_NOT_FOUND` | name absent under any close spelling | strengthen matcher / canonicalizer | `persons` table + PersonIdentityService → 17.3/17.4 |
| `NULL_BALANCE` | template captured no balance | impute from calendar-anchored schedule; tag PARSER_BLIND | PARSER_BLIND 4th state → 17.17 |
| `STALE_FLATLINE` | balance repeats ≥N months | detect flatline as missing-flow finding | stale-template detector → 16.1 |
| `NEVER_CROSSED_ZERO` | still positive / paid after cutoff | confirm genuine vs cutoff artifact | (data-review; usually no story) |
| `PERIOD_PARSE` | e.g. `2025-00` month 0 | fix period extractor | period parser hardening → ingestion |

### 10.4 Refund dossier schema (per confirmed candidate)
`name · MDA · staffId(if any) · last period · last balance · monthly · months-over · **balance source** (observed \| imputed) · **name-match confidence** (exact \| fuzzyN) · source-row refs · bucket · recommended action`. No candidate goes to the AG without balance-source + confidence populated.

### 10.5 Findings ledger (dual-record — append as we go)

**BASELINE RUN 2026-07-04** (`_tmp-baseline-47.ts` + `_tmp-verify-47.ts` vs catalog 101,338 recs). Source `C:\Users\DELL\Desktop\47_list.xlsx` = 47 rows = **46 named + 1 no-name**.

**Headline: 4 / 46 caught by the untouched sweep (~9%). The miss is a _wrong-detector_ problem, not tuning.** The 47 contain **two species of over-deduction**, and the below-zero sweep only detects one:
- **Species A — post-completion** (balance crosses below zero, then may continue). The sweep's target. **4 caught.**

> **Correction 2026-07-04 (cross-review, verified):** the parallel Fable-agent audit flagged that my first pass said 5/46. **Adeleke Muibat Dasola** is below-zero **but still on the latest return** (gap<1); the untouched `_tmp-zero-vanish.ts` excludes gap<1 (line 46), so it never flags her — confirmed by grepping the sweep output (ABSENT). Honest sweep catch = **4**. Adeleke is a new, most-urgent class **`LIVE_BELOW_ZERO`** — over-deduction happening *right now*, missed by design because the sweep only looks for people who have *vanished*. My baseline *classifier* over-counted by conflating its own "CAUGHT" branch with what the sweep actually emits.
- **Species B — in-flight** (loan still active, positive balance, but cash taken exceeds the schedule). **The majority. The below-zero sweep is structurally blind to it.**

**The key, hopeful finding:** Species B is **NOT "data we don't have"** — it is detectable from the *same catalog balances* via **month-over-month delta vs scheme-expected monthly** (flow reconstruction). **Verified on Oke Elizabeth Folasade [EDUCATION]:** balance falls **11,333/mo** while the scheme-expected monthly is **10,200** (principal 450k ÷ tenure 50 × 1.1333) → a faster-than-scheduled slope, invisible to an endpoint (below-zero) test but obvious to a slope test. This is the #1 hardening target and maps to app pillar B / story 16.1.

| Fix-class | Count | Meaning | SQ-1 fix | App proto-story → target |
|---|---|---|---|---|
| `NEVER_CROSSED_ZERO` (Species B) | 20 | positive balance; needs slope/flow test | **build delta-vs-scheme slope detector** (#1) | flow reconstruction → 16.1 / pillar B |
| `IDENTITY_NOT_FOUND` | 10 (+1 no-name = 11) | absent under any close spelling | strengthen matcher/canonicalizer; escalate no-name to source MDA | `persons` + PersonIdentityService → 17.3/17.4 |
| `NULL_BALANCE` | 5 | template captured no balance | impute from schedule; tag PARSER_BLIND | PARSER_BLIND → 17.17 |
| weak (ZERO-VANISH / ZERO-STILL-PRESENT) | 6 | seen but not read as over-deduction | fold into slope/zero-crossing detector | 16.1 |
| `LIVE_BELOW_ZERO` (Adeleke Muibat) | 1 | below-zero **AND still on latest return** — sweep excludes gap<1 | zero-crossing detector w/o vanish requirement — **most urgent** | 17.25 / 16.1 |
| `STALE_FLATLINE` | 1 | balance repeats ≥3 mo | flatline = missing-flow finding | stale detector → 16.1 |
| **CAUGHT** (Species A) | **4** | below-zero **and vanished**, sweep flags it | — (working) | validates 17.25 |

**The 4 caught (Species A):** Folashade Olubukola Ajibade [INFORMATION] · Aliyu Adekunle Taofeek [INFORMATION] · Bakare Vivian Bukola [HEALTH] · Samson Ademola Mosobalaje [HOS]. CREDIBLE visible over-deduction (matched) = ₦97,360 (unchanged; Adeleke was not a credible/vanished catch). Adeleke Muibat Dasola [LOCAL GOVERNMENT] → `LIVE_BELOW_ZERO`.

**Data-quality findings for the reviewer:** (a) 1/47 has **no name** — untraceable, must go back to the source MDA; (b) 10 named cases not found in catalog — spelling-variant (identity layer) or genuinely never submitted (MDA/parser gap) — to be split during identity hardening.

**Confirmed by Awwal 2026-07-04:** **OYSHMB submitted no records** — so Yekeen Ganiyat Adetutu [OYSHMB] (case 11) is NOT a spelling miss; it is the *MDA-never-submitted* class (over-deduction on a person the portfolio has zero record of). This is the serious sub-class of IDENTITY_NOT_FOUND. Action: cannot be solved by matcher hardening — needs the OYSHMB source data ingested, or the case worked from the payslip evidence alone. **→ Full analysis in §11: 11 OYSHMB rows (7 dark + 4 cross-MDA transfer-hypotheses) + 1 no-name = 12 unresolvable; cross-MDA re-tiering; transfer-projection method. §11 supersedes the rough IDENTITY_NOT_FOUND=10/11 split here.**

### 10.6 Harness expected-results (reproducibility anchor)

Baseline tallies (verifiable by re-running `_tmp-baseline-47.ts`, then applying the gap<1 correction): **sweep-CAUGHT 4 · LIVE_BELOW_ZERO 1 (Adeleke) · ZERO-VANISH 5 · ZERO-STILL-PRESENT 1 · MISS 35** (of which NEVER_CROSSED_ZERO 20, IDENTITY_NOT_FOUND 10, NULL_BALANCE 5, STALE_FLATLINE 1). NB: `_tmp-baseline-47.ts` classifier prints Adeleke as CAUGHT (its own branch); the untouched sweep does not — honest sweep catch = 4. Dropped from run: 1 no-name row (case 26/47, Finance ₦113,330). Prior sweep-wide counts unchanged: PRIORITY 173 (32 credible + 141 review) / SECONDARY 694.
_(Full per-case bucket table lives in the script output; promote `_tmp-*` → `overdeduction-regression-2026-07.ts` at hardening step 3.)_

### 10.7 Boundaries
- **Don't rebuild SQ-1 into the app** — the archaeology *terminates*; scope hardening to "trustworthy 47 + refunds + clean port," not a second app.
- **SQ-1 stays the archaeology track** — no forward-ops features (issuance, attestation) built in scratch; those are app stories only.

---

## 11. OYSHMB / Cross-MDA Transfer Analysis — verified tally + transfer-projection method (2026-07-04)

> **For the other (Fable) agent + harmonisation.** Detailed record of the transfer investigation. Corrects two of my earlier claims (flagged below). All numbers reproducible via `_tmp-tally-47.ts`, `_tmp-transfer-oyshmb.ts`, `_tmp-mda-reconcile-47.ts`.

### 11.1 Trigger
Awwal challenged my "namesake false-positive" dismissal of 4 OYSHMB name-matches: **what if those 4 transferred _into_ OYSHMB?** In this domain staff move between MDAs *carrying their loan*, so a cross-MDA name match may be the person's **own pre-transfer loan**, not a stranger's. He is right — dismissing them was wrong. A cross-MDA match is a **transfer hypothesis to test**, not noise to discard.

### 11.2 Verified definitive tally of all 47 (`_tmp-tally-47.ts`)
OYSHMB present in catalog? **NO** (dark MDA — 0 records among 58 catalog MDAs).

| Category | Count | of which OYSHMB |
|---|---|---|
| SAME_MDA (name matched **in the person's own MDA** — most reliable) | 21 | 0 |
| CROSS_MDA (name matched **in a different MDA** — transfer hypothesis) | 15 | 4 |
| DARK (no name candidate at all) | 10 | **7** |
| NO_NAME (blank) | 1 | 0 |
| **TOTAL** | **47** | 11 |

**OYSHMB subset (11):** **7 truly DARK** (rows 11,17,18,19,22,23,25) + **4 cross-MDA** (rows 14,16,21,24). **+1 no-name (Finance row 26) = 12 unresolvable-from-catalog-alone.** ✅ **Awwal's 7 and 12 confirmed** (corrects my earlier prose slip "6 dark").

### 11.3 The cross-MDA dimension re-tiers everything (the material finding)
**15 of 47 matched a name in a different MDA than the list.** For transferred staff that is *expected*; but each is transfer-OR-namesake until verified. **Two cases I earlier called "Tier-1 caught" are actually cross-MDA:** Adeleke Muibat Dasola [Auditor General→Local Govt Audit] and Samson Mosobalaje [Head of Service→Agriculture]. So the **clean SAME_MDA + below-zero Tier-1 count is 3, not 5** — Ajibade, Aliyu, Bakare. The other two need transfer verification before the AG.

New confidence tiers: **SAME_MDA (21) reliable · CROSS_MDA (15) transfer-hypothesis-verify · DARK (10) · NO_NAME (1).**

### 11.4 Transfer-projection method (`_tmp-transfer-oyshmb.ts`)
For a cross-MDA / dark-MDA match, test same-person + estimate the loan:
1. **Name-match strength** (3/3 exact ≫ 2/3 surname-differs).
2. **Monthly-deduction equality** — list-monthly vs catalog-monthly. *The key same-loan signal* (a carried loan keeps its monthly). Mismatch ⇒ different person **or** same person deducted at the wrong rate (itself an over-deduction cause) — undecidable from catalog alone.
3. **Timing** — matched record's last period must precede the over-deduction window.
4. **Project schedule forward** from last observed balance (scheme formula) → projected completion month. If completion ≤ over-deduction window → over-deduction credible; estimate = months-past-completion × monthly.
Output = same-person confidence + **mechanism** (schedule-overrun / lump-sum / wrong-rate) + estimated refund. **Result is IMPUTED, not observed** → must be labelled as such in the AG dossier (distinct tier from catalog-evidenced cases). **Caution (per Fable §3.6):** segment threads at each zero-reset and exclude stale months, or the projection misfires at loan-cycle boundaries.

### 11.5 Per-case OYSHMB findings (the 4 cross-MDA)
- **Row 14 Rasaki Tajudeen Olajiire** → RASAKI TAJUDEEN OLAJIRE [Lands & Housing], **name 3/3 (same person very likely)**. BUT list ₦150,000 vs catalog ₦20,416 → not a monthly; the ₦150k **"Overpayment" is a LUMP-SUM over-charge** → Path-3 settlement review, not schedule projection. Loan completes ~2027 (not near done). **Route: manual settlement review, same person.**
- **Row 16 Adetunji Foluke Atinuke** → MALIK FOLUKE ATINUKE [High Court], name 2/3, **surname differs** (marriage name change?). Matched loan **completed 2021**; claim is Oct-2024→Mar-2025 → **timing coherent for post-completion over-deduction IF same person.** **Route: manual identity confirmation.**
- **Row 21 Hassan Taiwo Romoke** → HASSAN TAIWO LATEEFAT [Water Corp], 2/3, monthly differs, loan far from done → **likely genuine namesake.** Low priority.
- **Row 24 Omoniyi Deborah Abiodun** → two candidates (Education / Lands & Housing), ambiguous, monthlies differ → **likely namesake.** Low.
- **7 OYSHMB truly dark** (11,17,18,19,22,23,25): no pre-transfer record → need OYSHMB source data or the payslip.

### 11.6 Corrections to my earlier claims (honesty ledger)
1. **"MDA-gate and discard" was WRONG** → correct rule = **flag-and-route**: a cross-MDA match is a transfer hypothesis (verify), not an observed fact and not noise.
2. **Tier-1 report-ready-now = 3, not 5** (Adeleke + Samson are cross-MDA → move to transfer-verify).
3. **OYSHMB dark = 7, not 6** (verified).

### 11.7 Confidence-tiered AG report structure (revised)
- **T1 observed** (SAME_MDA + below-zero, catalog-evidenced): **3** — Ajibade, Aliyu, Bakare.
- **T2 transfer-verified** (CROSS_MDA + below-zero, monthly+timing confirmed): Adeleke, Samson — pending check.
- **T3 in-flight Species-B** (SAME_MDA positive balance, via slope detector): ~16.
- **T4 imputed transfer-projection** (cross/dark-MDA where evidence supports): Rasaki (lump-sum), Foluke Atinuke (timing) + any of the 11 non-OYSHMB cross-MDA that pass the monthly test.
- **T5 unresolvable from catalog** (data-request memo): 7 OYSHMB dark + 3 other dark (rows 1,7,32) + 1 no-name = **11**.

### 11.8 Steps to harmonise (a + b)
- **Step a (this section): DONE** — findings/method/corrections captured for the other agent.
- **Step b (proposed, not yet built): MDA-aware transfer test into the harness.** Run the §11.4 method on **all 15 CROSS_MDA cases** — not just OYSHMB. The **11 non-OYSHMB cross-MDA** (rows 8,15,20,27,30,40,41,42,44,45,46) are the high-value set: their monthlies are more likely to match (real transfers), so many should resolve to HIGH-confidence transfer-verified. Apply the zero-reset segmentation + stale-exclusion caution. Output confidence + mechanism + estimated refund per case.

### 11.9 Open questions for the other agent / harmonisation
1. **Staff IDs?** The OYSG staff-ID namespace is portfolio-wide (memory) and would confirm transfers definitively — but the 47-list carries no IDs. Is there an ID source we can join on?
2. **How many of the 15 cross-MDA are true transfers vs namesakes?** Not yet run — step b answers this.
3. **Interaction with Fable's LOAN_CYCLE class (their §3.6):** cross-MDA + second-loan-in-thread compound; the transfer test and the cycle-segmentation must share thread-segmentation logic.
4. **Wrong-rate over-deduction:** where monthly mismatches on a confirmed transfer, that IS the over-deduction (OYSHMB deducting at the wrong rate) — needs its own detection, distinct from schedule-overrun.

---

## 12. Spec — Standing AG Reconciliation Register via SQ-1 (2026-07-04)

**Purpose.** A repeatable mechanism for SQ-1 to produce AG-office reports used at meetings to trace cases **in tandem with the Auditor**, going forward — not a one-off. Governing principle: **the Auditor's independent verification is the control that makes an uncommitted-engine report safe to act on** — so the register is built to *enable* that verification.

### 12.1 Three design pillars
1. **Provenance to source (linchpin).** Every case carries exact coordinates so the Auditor can pull the original: catalog `sourceFile · sheet · period · employeeNo · balance/monthly-as-recorded`, **plus** the beneficiary's **payslip figures** (dual-source: SQ-1 view + payslip). No number without a traceable origin.
2. **Confidence tiers, honestly labelled** (T1–T5, §12.3). Observed vs imputed vs unresolvable. An estimate never wears the clothes of a fact.
3. **Reproducible snapshot.** Pinned to catalog `SHA + date` (CURRENT/PREVIOUS pattern). Regenerable identically; any challenged number re-derivable live via the deployed Query Station.

### 12.2 Format
- **Cover:** portfolio summary (cases by tier · exposure *observed* vs *estimated* · snapshot SHA/date) + **plain-language methodology & limitations** (what SQ-1 can't see: dark MDAs, null-balance templates, imputed estimates) + **authority matrix** (which tier the AG authorises alone vs needs Auditor sign-off vs needs data).
- **Register table:** all cases, one row each, tiered.
- **Per-case dossier** (actionable tiers): identity · tier · mechanism (post-completion / schedule-overrun / lump-sum / wrong-rate) · amount (observed or estimated, labelled) · **full provenance** · recommended action · **Auditor-verification field** · **AG-authorisation field** · **status**.
- **Data-request appendix** (T5): grouped by cause (dark MDA / null-balance / no-name).

### 12.3 Confidence tiers
- **T1 observed** — same-MDA, balance below zero in catalog → AG may authorise (confirm ≥ amount vs latest payslip).
- **T2 transfer-verify** — cross-MDA + below zero → confirm transfer (monthly + timing) first.
- **T3 in-flight** — same-MDA active loan, deduction beyond schedule → **pending slope detector** to quantify.
- **T4 transfer-projection** — cross-MDA hypothesis → confirm same-person + project; **imputed**, needs Auditor corroboration.
- **T5 unresolvable** — dark MDA / null-balance / no-name → **data-request memo**, not a decision.

### 12.4 Status lifecycle (rolling register — nothing silently drops = conservation)
`Raised → Auditor-verified → AG-authorised → Refunded/Closed` (or `→ Data-pending`). Stable case IDs across meetings + snapshots. Next meeting resumes from status. **Success metric = % of raised cases attested/closed** — this register *is* the archaeology track (§5b) delivering value now; each Auditor-verified + AG-authorised case = an attested resolution.

### 12.5 Live companion
Register = static, signed artifact. **Deployed Query Station = live drill-down** at the meeting (pre-canned traces: "show <name> full history", "trace <staffID/employeeNo> across MDAs"). Auditor asks → operator queries live → answer traces to source.

### 12.6 Governance guardrails (mandatory, given SQ-1's known weaknesses)
MDA-gate/transfer-verify before any refund (no namesake payouts) · imputed never shown as observed · provenance mandatory · reproducible snapshot · non-punitive vocabulary throughout ("balance below zero"/"variance"/"for return to beneficiary", no red, no MDA blame).

### 12.7 Deliverable v1
First issuance: `docs/Car_Loan/analysis/reports/AG-Reconciliation-Register-2026-07-04.md` — all 47 tiered, snapshot `83c9e11c…`, marked **PRELIMINARY** (pending Auditor verification + cross-agent harmonisation). Generator: `_tmp-register-47.ts` (promote to `overdeduction-register.ts` at hardening step 3).

### 12.8 New-case intake (going forward) — see response 2026-07-04
Two sources feed the register each cycle: (a) **walk-in/complaint cases** (like Bakare) → enter as Raised, run through the tier classifier; (b) **engine re-run after each catalog refresh** → the detectors (below-zero sweep + slope + transfer test) surface *new* cases the complaints haven't caught. Both converge into the same register. Re-run cadence = per catalog refresh; diff against prior snapshot (DELTA) to show *newly surfaced* cases.

---

## 13. Harmonisation outcome + final pass (2026-07-04)

Two-agent review harmonised into **`harmonised-findings-2026-07-04.md`** (H1–H25), which **supersedes §8–§12 of this log as the single BMAD input**. This log remains the evidence trail.

**My final pass (independently verified, now in that doc's §8 addendum):**
- **H1 CONCEDED** — grep proves `submissionService`/`payrollUploadService` never post to the ledger (0/0); my §8.2 "ledger sound" was wrong without the *starvation* caveat ("mechanism sound, never connected"). Largest miss on my side.
- **H23 alias re-tier verified** — HOS/CSC/OYSPHB aliases were missing from my tally; corrected scope **25/11/10/1** (not 21/15). Fixed 4 mis-tiered cases: **Samson → reviewed-T1 (HOS −₦69,998, largest observed)**, Adeyemi → T5 null, Olawoyin → stale, Komolafe → same-MDA.
- Regression harness `overdeduction-regression-2026-07.ts` **re-run: PASS**.

**My addendum proposals (in harmonised §8, pending Fable's final agree/disagree):** A1 standing-register + proactive portfolio sweep (173 below-zero portfolio-wide; 47 = calibration not population); A2 `WRONG_RATE` class; M1 deliverable regenerated; M2 elevate Samson; M3 reconcile §7 "strong transfer" prose vs harness (#8/#45 are same-MDA); D1 down-rank H10 to assert-verify.

**Deliverable regenerated:** `docs/Car_Loan/analysis/reports/AG-Reconciliation-Register-2026-07-04.md` **v1.1 (harmonised)** — LIVE (Adeleke) + T1 (3, ₦97,359) + T1-review (Samson ₦69,998) actionable; harness-locked tiers.

**Loop back to Awwal:** harmonised doc passes to the Fable agent for the final agree/disagree round on my §8 addendum → then it's the SCP Addendum 3 input.

**CLOSED 2026-07-04:** Fable accepted all 7 §8 items (each sharpened, not rubber-stamped); its 2 new claims re-verified from source (H26 crossref formula ✓; Samson jump ✓). Post-seal source-check re-bucketed **Samson → DATA_RECONSTRUCTION** (HOS thread pervasively corrupted: 0-resurrection + 169,996→329,992 jump + month-0 defect; −₦69,998 not a reliable quantum — deliverable §4.4 fixed). Register now **H1–H26**; detector suite three-legged (endpoint + slope + rate-conformance/H26). Harmonised doc §9.1 = bounded verification-only final pass, then frozen → BMAD (PM John, SCP Addendum 3 candidate).

---

## 14. Go-forward items surfaced post-close (2026-07-04)

> These are **forward recommendations**, not current-state findings, so they live here (working record), **not** in the frozen harmonised doc (§9.1 = no new scope). Flagged for **PM John at BMAD entry** — each is carry-forward, not part of the frozen H1–H26 register.

1. **Instrument-grading + thread-integrity gate _before_ tiering (design constraint on the slope detector + portfolio sweep).** Samson proved a thread can be pervasively corrupted (0-resurrection, upward jump, month-0) — and (Fable-flagged, source-verified 2026-07-04) **the corruption is instrument-level, not case-level:** his bad values come from the **HOS source workbooks** (`HOS_SOFT COPY CAR LOAN 2025.xlsx` = 0-resurrection + jumps; `HOS_SOFT COPY 2024.xlsx` = the month-0 defect — *both* HOS instruments, correcting Fable's "one workbook"). So grade the **source instrument**, not just the thread: a low-graded workbook flags *all* its threads. Integrity-check first; anything failing (non-monotone-with-jumps / 0-resurrection / month-0, or sourced from a low-graded instrument) routes straight to **`DATA_RECONSTRUCTION`** and never receives a refund tier. At 101k records, un-gated tiering would mis-mark corrupted threads as "ready" — the error most likely to discredit the register before the AG. → feeds A1 portfolio sweep + slope detector spec (§10) + the **17.17 instrument-grading story**.

2. **Quantify the `YYYY-00` month-0 period defect portfolio-wide.** Now confirmed in ≥2 of the 47 (Aliyu #6, Samson #44). When the period-parser fix (H25 / §10 `PERIOD_PARSE`) lands, count how many threads carry a month-0 record catalog-wide — it corrupts quantum accuracy and may be a larger cleanup than the 47 imply. → adds a metric to the H25 period-parser story.

3. **Proposed team agreement: "a review closes on a bounded, reproducible verification pass, not on consensus."** Generalises §9.1 (the N-reproducible-checks-then-freeze discipline that stopped this thread ping-ponging). *(Fable suggests folding this into **TA-B** rather than a standalone TA-D — same substance, one fewer agreement.)* → PM John to consider with TA-A/B/C at SCP Addendum 3 entry.

---

## 15. Read-receipt — two-track execution contract (2026-07-04)

**SQ-1 (Opus) agent acknowledges harmonised-findings §10 as the operating contract** (division of labour, H-numbers as foreign key, three merge points, harness-as-treaty, class-vs-disposition boundary, §10.4 SQ-1 expectations). No clause challenged.

**Accepted engine-side (Fable W2-brief point 2 / resolve-at-read rule):** the rebuilt SQ-1 engine will **key person-threads on resolvable identity, not baked name-strings** — so the 17.2 parser/segmentation port does not smuggle the H3/H11 identity-as-string pattern into the app. Archaeology adaptation: resolution order = staff/OYSG-ID → Yoruba-canonical name → raw name, as a *distinct, swappable step* upstream of thread-building (better identity re-forms threads without touching detector logic). Added as a thread-model constraint in `sq1-hardening-plan-2026-07-04.md`.

**Two DATA memos:** already drafted this session — `docs/Car_Loan/analysis/reports/AG-Data-Requests-2026-07-04.md` (OYSHMB returns + staff-ID-at-intake). Fable need not re-draft.

**One coordination note back to Fable (via Awwal):** Awwal's keep-but-mark decision on the month-0 ghosts (below) is a *disposition/record-flag*, not a taxonomy class — it does not touch the harness taxonomy, so no §10.2.3 both-tracks sign-off is triggered. Flagging per the contract in case Fable sees it otherwise.

---

## 16. Period-parse fix EXECUTED + coordination note to Fable (2026-07-04)

**Done (plan Phase 1.1–1.2 + Layer A regenerated):** `period-extract.ts` now combines a bare-month sheet name (`JAN`) with the filename year (guarded to pure month-word sheets so `MARCH'21`-style names keep their own year). Re-ran **deep-scan → parse → crossref → ledger → report → mda-class → heatmaps**. Catalog **101,338 → 104,396** records (recovered monthly granularity across ~12 bare-month-sheet files: ACCOUNTANT GENERAL 3-yr, lands, TRADE, HOS, TESCOM…); **SHA `83c9e11c` → `667ebdd8`**. Month-0 records 260 → 201 (59 HOS recovered; 201 secondary-sheet ghosts KEPT per Awwal's keep-but-mark, month-0 self-marks as year-only for detectors to exclude). Harness **re-baselined + PASS**.

**⇉ COORDINATION NOTE TO FABLE (per contract §10 — the period fix moved the 47 baseline; fold into the BMAD input as a post-freeze correction):**
1. **#42 Adeleke — WITHDRAWN from below-zero.** Was LIVE_BELOW_ZERO (H20's sole 47-member) on the defective catalog; the −₦17,999 was a **mis-dated artifact**. Corrected thread runs positive through 2025-12 (+₦369,989) → cross-MDA active loan, NOT an over-deduction. **H20's class stays valid portfolio-wide but has no 47-member; #42 anchor re-locked to NEVER_CROSSED_ZERO.**
2. **H25 correction (also affects 17.26 ACs):** "Aliyu's missing February = the month-0 record" is WRONG — that record is a WORKING-SHEET ghost (bal ≈ ₦0); his February is a **genuine data gap** (absent from the FEBRUARY,2025 sheet). Two separate issues — do not conflate in the refund-quantum AC.
3. **Sweep re-baselined:** PRIORITY 173→174, CREDIBLE 32→33, SECONDARY 694→698 — **+1 real below-zero case surfaced portfolio-wide** by recovered granularity (not in the 47). Lamidi fixture holds.
4. **Deliverable → v1.2** (`AG-Reconciliation-Register-2026-07-04.md`): no LIVE case this cycle; 3 T1 (₦97,359) unchanged and ready; Adeleke → Tier-4; Samson still DATA_RECONSTRUCTION (2024 mis-dating fixed, 2025 corruption remains).

**Vindication of rebuild-first:** the pre-fix register's #1 "urgent stop-order" case was a data artifact. Presenting it would have had the AG chase a non-over-deduction. Caught before the meeting.

---

## 17. Slope detector EXHAUSTED (negative result) + the "report is the schedule" finding (2026-07-04)

Per Awwal's "exhaust before forking": built the slope detector through **4 iterations** (per-month-excess → endpoint → heavily-gated → segment-scoped reference). Each attempt's false positives traced to a real cause (scheme-estimation noise; data-error drops; **loan-cycle** trap = larger 2nd loan compared to 1st loan's monthly). Final segment-scoped, heavily-gated version: **0 flagged.**

**Diagnostic (1,375 clean active loans): observed÷stated ratio p10=p50=p90=1.000; only 12 loans >1.10×.** → **no systematic in-flight over-deduction is detectable by slope.**

**WHY (the load-bearing finding — validates reframe pillar C with hard data):** the MDA computes each month's balance *by subtracting the stated monthly* — `balance[t] = balance[t-1] − stated`. **The catalog balance IS the reported schedule, not a measurement of cash taken.** It is tautologically consistent and can NEVER surface in-flight over-deduction. Real in-flight over-deduction lives in payroll **cash**, which the catalog does not contain. The harmonised H19 slope hypothesis (validated on one case, Oke) was a loan-cycle artifact.

**Consequences:**
- **T3 "in-flight, pending measurement" tier is NOT measurable from the returns** — it needs payroll actuals (staff-ID DATA memo + app pillar-C bank/payroll reconciliation). Reframe T3: *pending payroll data*, not *pending slope*.
- **Species A (post-completion, balance crosses zero) remains detectable** (the 3 T1 + portfolio 174) — the report DOES show a below-zero when the schedule is exhausted.
- **Fork to rate-conformance (H26)** for `WRONG_RATE` (stated monthly ≠ scheme-correct monthly) — that IS in the catalog, detectable, defensible. Distinct from cash-divergence (undetectable).

**⇉ Fable coordination:** H19's slope method does not hold at portfolio scale (report = schedule); the in-flight species is a payroll-data problem, not a detector. H26 rate-conformance stands. `overdeduction-slope.ts` retained as evidence of the exhausted option.

---

## 18. Rate-conformance (H26) built + the catalog's detection limit reached (2026-07-04)

Forked to rate-conformance per Awwal. `overdeduction-rate.ts`: stated monthly vs scheme-correct monthly (`P/tenure + P×0.1333/60`), per-loan (6,564 loans). Distribution: p10=p50=**1.000**, p90=1.020; **353 over-rate, 311 WRONG_RATE candidates.** BUT the candidates are **dominated by data errors** (total-loan-in-monthly-column ratio 100×; garbage rows name=`600000` tenure=`13333`; implausible ₦60–75k principals). Plausibly-real ones (RABIU ₦750k/60 @ ₦50,166; FIRE ₦250k loans @ the ₦600k rate) are **undecidable from the catalog** — "stated too high for principal" ≡ "principal mis-recorded"; both give ratio>1.

**CONVERGENT CONCLUSION (both detectors, same wall):** in-flight over-deduction is **not reliably detectable from the catalog.** Slope fails (balance = schedule); rate-conformance fails (self-declared fields, error ≡ over-rate). Root: the catalog holds the MDA's **report**, never an independent measure of **cash**. This is reframe pillar C, proven twice.

**Standing position on detection:**
- **Defensible from catalog = Species A only** (below-zero endpoint): 3 T1 (₦97,360) + 174 portfolio-wide. The report shows a negative when the schedule is exhausted → real.
- **Rate-conformance survives as a gated REVIEW surface** (exclude total-in-monthly + garbage rows): "loans whose stated monthly is implausible for principal → pull payslip." Triage, not a figure. Retained as `overdeduction-rate.ts`.
- **In-flight (T3/T4) needs payroll actuals** — data-acquisition (staff-ID memo, app pillar-C), not a detector.

**⇉ Fable coordination:** H19 (slope) AND H26 (rate) both hit the catalog's report-vs-cash limit. The BMAD framing should state plainly: the app's value for in-flight over-deduction depends on ingesting payroll cash (pillar C / W1 posting), because legacy returns alone cannot surface it. Species-A detection is the only over-deduction the archaeology can stand behind.

**Detector effort status:** endpoint sweep (Species A) = works, harness-locked. Slope = exhausted-null. Rate-conformance = review-surface only. **The catalog's over-deduction detection ceiling is reached.**

---

## 19. Settlement paths void the rate signal (Awwal domain input, PRD-verified 2026-07-04)

Awwal flagged — **PRD-confirmed** (line 648: accelerated repayment, "old tenure 60 → new tenure 45, monthly principal recalculated"; lines 449-453: Path-3 lump-sum early exit, interest waived) — that staff CHOOSE settlement paths, so **a higher monthly is a legitimate accelerated tenure, not over-deduction.**

Rebuilt `overdeduction-rate.ts` settlement-path-aware (impliedTenure = P/(stated − P×0.1333/60)):
- **5,458 conformant** (~standard) · **1,662 accelerated** (implied 12–45 mo, Path-2 legitimate) · **103 anomaly** (89 data-error `monthly>principal`; 14 very-short-tenure to payslip-check).
- **The 311 prior "WRONG_RATE" flags were mostly legitimate accelerated settlements.** Rate-conformance finds ~no genuine over-deduction once paths are honored → **confirms slope's null; the review surface shrinks to ~14 + 89 data-quality rows.**

**Compounded conclusion:** three independent angles (endpoint-slope, endpoint-rate, path-aware-rate) all converge: **the catalog cannot surface in-flight over-deduction.** A high monthly is legitimately a *choice*; the only catalog-provable over-deduction is a **below-zero balance** (Species A), which is path-agnostic (deducted past completion is wrong on any path). Everything else needs payroll cash.

**⇉ Fable coordination:** any "wrong-rate"/"deduction exceeds schedule" finding in the app MUST be settlement-path-aware, or it will flag accelerated settlements as over-deductions. This is a hard AC for 17.25/17.26 and the rate-conformance story. Path-2/Path-3 are in the PRD (Computation Engine, all 4 paths) — the detector must consult the tenure-change / early-exit events, not assume 60 months.

---

## 20. Close-out complete — corrected catalog frozen clean (2026-07-04)

Full pipeline regenerated on the corrected catalog (SHA `667ebdd8`, 104,396 records):
- **Layer A remainder + B + C + D: 15/15 scripts OK.** (reconciliation-inventory v2, staging, register cross-check, staff-ID identity refresh, manifest, WAKEUP stats.)
- **Heatmap invariant:** initially FAILED — root cause was skipping WAKEUP step 7a (copy fresh heatmaps → reconciliation folder; the check reads the copies). Copied → **PASS**.
- **DELTA_2026-07-04.md** written; DELTA_2026-06-30 marked superseded + moved to `_superseded/`. README/INDEX date + delta-pointer + record-count bumped; mid-sheet audit refreshed.
- **Freshness audit: 15/15 OK, exit 0.**
- **Scratch cleaned:** all 15 `_tmp-*.ts` removed; 4 kept detectors remain (`overdeduction-{regression,slope,rate,register}.ts`).
- **Memory:** `project_engine_rerun_2026_07_04.md` written + MEMORY.md current-state updated.

**Deferred (manual, needs physical drive):** Query-Station deploy-drive refresh (`query-station/refresh-deploy-drive.cmd`) — the deployed bundle is now stale vs the corrected catalog; Awwal to run when the drive is connected. Everything else is frozen and consistent.

**#4 done.** Remaining from the #1→#2→#4→#3 sequence: **#3 transfer test** (T4 cross-MDA resolution).

---

## 21. Transfer test (#3) + deploy-drive refresh — DONE (2026-07-04)

**Transfer resolver** (`overdeduction-transfer.ts`) — resolves the 47's cross-MDA cases (transfer vs namesake) via name-strength + monthly-match (carried loan) + timing, settlement-path aware:
- **6 TRANSFER_CONFIRMED** (name 3/3 + monthly match): Opaleye→SUBEB, Akinwale→OYSAA, Babalola→Agriculture, Lateef→Local Govt Audit, **Adeleke→Local Govt Audit** (confirms she's a same-person active loan, not over-deduction), Komolafe→Health.
- **3 TRANSFER_LIKELY** (name matches, monthly differs — post-transfer accel? or 2nd loan): Olawoyin, Samson, Oyadeyi.
- **4 NAMESAKE_LIKELY** (name 2/3, monthly differs): Adebayo Akeeb, Adetunji Foluke, Hassan, Omoniyi.
- **1 SETTLEMENT_REVIEW**: Rasaki (₦150k lump-sum, Path 3).
- *Known limitation:* name-only matching can pick a namesake when the person has records in two MDAs (Samson matched his AGRICULTURE namesake, not his own HOS thread) → resolver flags candidates for human confirmation, never auto-decides. Staff-ID would make this definitive (DATA memo).
- **Governance:** no case advances to AG refund on a cross-MDA match alone; CONFIRMED/LIKELY still need payslip/ID.

**Deploy-drive refresh (D: attached):** `refresh-deploy-drive.ps1` → **D: (Awwal_Trade) CURRENT** — 162.2 MB, 104,396 records, exposure ₦1.65B, checksum MATCH. Deployed Query Station now matches the corrected catalog. (Item 4.5 was deferred; now done.)

**ALL of #1→#2→#4→#3 + deploy COMPLETE.** SQ-1 rebuild cycle closed clean.

---

## Appendix — key files & references

- Scratch scripts: `scripts/legacy-report/_tmp-zero-vanish.ts`, `scripts/legacy-report/_tmp-check-names.ts`
- Catalog: `docs/Car_Loan/analysis/foundation/catalog.json`
- SQ-1 canonical context: `scripts/legacy-report/WAKEUP.md`
- Recovered transcript: `auditor_app.txt` (lines 614–645 questions; 650–1005 transcript)
- Loan math: single rate 13.33%, base ÷60 always; monthly interest = (P×0.1333)÷60 regardless of tenure
