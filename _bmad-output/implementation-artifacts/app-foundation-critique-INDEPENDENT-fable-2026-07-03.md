# App Foundation Critique — Independent Findings (Fable, 2026-07-03)

**Status:** INDEPENDENT running file — deliberately NOT merged into the session log (`session-log-2026-07-02-overdeduction-sweep-and-ledger-reframe.md`, owned by the other agent). All Fable-side findings accumulate HERE; the two files are compared at end of session. Comparison protocol: resolve disagreements by running the falsification tests (§6), not by comparing prose.
**Contents:** §0–§6 foundation critique (2026-07-03 AM) · §7 agreed UX direction for Sally (2026-07-03, PO-approved) · §8 PRD review — root-cause + touch map (2026-07-03) · §9 the 47-case validation run (2026-07-04).
**Provenance for the blind read:** §0–§8 were written before I read the other agent's log sections. §9's script, run, and write-up were also produced independently (the 47-run predates my read of their §10). Nothing below §0 references their findings.
**Question answered:** Is the VLPRS app built on the right foundation for the ledger reframe (session-log §5b)? Add, modify, or start afresh?
**Method:** Four parallel deep audits over the full repo — (1) money path through `apps/server`, (2) schema/identity in `schema.ts` + shared packages, (3) Epic 17/SCP planning surface in `_bmad-output`, (4) product frame in `apps/web`. Instruction honoured: critique, criticise, clarify, validate nothing — including the §5b frame itself.
**Comparison protocol:** every finding is numbered, carries evidence (file:line), a severity, and a **falsification test** — the specific evidence that would disprove it. Disagreements between the two reviews should be resolved by running the falsification tests, not by comparing prose.

---

## 0. Verdict

**MODIFY. Do not start afresh — but do not proceed to Epic 17b either, because three defects are foundational and none of the three has a story anywhere in current planning.**

Grounds for not restarting: the organs the reframe demands mostly exist or are already planned —

- immutable append-only ledger with balance always computed, never stored (`schema.ts:109–141`, no balance column on `loans`);
- scheme-formula computation engine (`computationEngine.ts` — `computeSchemeExpected` = P×0.1333/60, full amortization schedules);
- loan state machine with audited transitions (`loanTransitions.ts`, `loan_state_transitions`);
- three-way reconciliation (Expected vs Declared vs Actual) already built;
- non-punitive vocabulary genuinely applied — 51 UI files / 145 render sites, not just constants;
- person entity + PIS **already planned and pilot-authorised** (17.3/17.4/17a, Winston's schema mints `person` keyed on OYSG ID);
- refund workflow **already planned** with AG-sole-authority 6-state machine (17.25/17.26).

The wrongness is concentrated and enumerable — which is precisely the situation where you repair rather than demolish. Restarting would discard ~86 done stories and re-derive the same skeleton under the same constraints.

---

## 1. Foundational defects (no planned story covers any of them)

### F1 — The ledger is starved. The circulatory system was never connected. **Severity: CRITICAL**

**Claim:** Only two producers of ledger entries exist in the entire codebase: migration baselines (`baselineService.ts:502, 783` — both hardcoded `MIGRATION_BASELINE`) and a manual SUPER_ADMIN/DEPT_ADMIN endpoint (`ledgerRoutes.ts:23–27`). Monthly MDA submissions write only `mda_submissions` + `submission_rows` (`submissionService.ts:396, 426`); payroll uploads likewise (`payrollUploadService.ts:249, 279`). **Nothing posts a deduction event. Ever.**

**Consequence chain:**
1. Every computed balance is frozen at its migration baseline.
2. `monthlyRecovery = SUM(ledger PAYROLL entries)` (`revenueProjectionService.ts:123–150`) reads ≈ ₦0 forever.
3. Auto-stop can never fire from an ongoing deduction — `checkAndTriggerAutoStop` is called from exactly two sites, both inside baselineService (`:544, :834`); the 6-hour scan recomputes over the same starved ledger.
4. Therefore **the app cannot catch the next Bakare Vivian even in principle** — her deductions never enter the truth store it reads.

**The aggravating factor:** the product presents these frozen numbers as authoritative everywhere money is shown — executive dashboard (`dashboardRoutes.ts:167–168`), loan detail derivation accordion, every report (`loanSnapshotReportService.ts:16,139,169,217`). And the dashboard folds in raw ACTIVE-loan *counts* (`dashboardRoutes.ts:159–163`), so counts move while balances are dead — the dashboard *looks* alive. This is the Kolade flatline (session-log §4) institutionalised at portfolio scale: stale figures wearing the authority of computation.

**Steel-man considered and rejected as exculpatory:** deliberately not posting unconfirmed submissions is consistent with Agreement 21/22 (audit-before-authority, dual-truth). But (a) no story anywhere plans the posting pipeline — 17.12 PRP is a per-person *recompute pass* over inputs, not event posting; grep of epics/SCP/addenda finds no submission→ledger story; and (b) no computed surface discloses its staleness, which violates dual-truth *in presentation*. Note the trap ahead: story 17.34a's 14-day pre-cutover shadow dashboard would show the Deputy AG frozen balances.

**Falsification test:** find any code path or any planned story in which a confirmed `submission_row` or payroll row produces a `ledger_entries` insert with `entryType='PAYROLL'`. If one exists, F1 downgrades from CRITICAL to a disclosure/sequencing issue.

### F2 — Identity is a string, and every identity repair silently corrupts history. **Severity: CRITICAL (latent)**

**Claim:** `loans.staffId` is a non-unique `varchar(50)` with a plain index (`schema.ts:113, 135`); legacy rows lacking IDs receive synthetic `MIG-{upload8}-{seq}` values (`baselineService.ts:118–121, 237`). All three identity-repair mechanisms mutate `loans` in place while leaving the **denormalised copies of `staffId`/`mdaId` inside `ledger_entries` stale**:

- `updateStaffId` (`loanService.ts:585–617`) — updates loans + migrationRecords, not ledgerEntries;
- dedup reassign (`deduplicationService.ts:420–437`) — updates loans.mdaId + migrationRecords.mdaId, not ledgerEntries;
- transfer completion (`employmentEventService.ts:468–477`) — re-points loans.mdaId, never touches ledgerEntries.

Because the ledger's immutability trigger (`fn_prevent_modification`, `immutable.ts`) rejects updates, these stale keys are **uncorrectable by design**. The immutable table contains mutable-truth columns. Balance still computes correctly today only because `computeBalance` reads by `loanId` alone — but any MDA-scoped ledger view attributes a transferred borrower's history to the wrong MDA, and after a staffId correction the ledger permanently disagrees with the loan about who it belongs to. Split-brain, silent, growing.

**Interaction with Epic 17a:** the person-entity work (17.3/17.4) will *increase* re-attribution frequency (namesake splits, merges, canonicalisation), multiplying F2 events — while no 17a story addresses ledger re-keying. The cheapest moment to fix is **now, in Winston's 17a schema, before the person table ships**: either ledger entries reference `loanId` only with attribution resolved via joins at read time, or re-attribution becomes an append-only event type.

**Falsification test:** show that no operational read path ever consumes `ledger_entries.staffId`/`mdaId` directly (all joins via loanId→loans), AND that no planned 17a/17b story writes person-keyed attributions into the ledger. If both hold, F2 downgrades to schema hygiene (drop the denormalised columns) rather than corruption.

### F3 — Closed-world intake: the app cannot learn from the field. **Severity: HIGH**

**Claim:** `validateStaffIds` (`submissionService.ts:180–201`) requires every row to match an existing loan; one unknown person **422-rejects the entire file** (`:358`) — all-or-nothing, no quarantine, no partial persistence. The only ways the system learns a loan are migration baseline and manual creation. Consequently the RECORD_WITHOUT_APPROVAL class — **3,290 real cases** in the registers — structurally cannot arrive through the front door; 17.3c plans to *detect* it in archaeology, but the operational intake still rejects the unknown. Under the reframe, an unknown row is *evidence to quarantine and adjudicate*, not an error to reject. Secondary effect: whole-file rejection teaches MDAs to edit their returns until they pass — training the field to censor evidence.

**Falsification test:** find an intake path (submission, payroll, or planned story) that persists non-matching rows for later adjudication instead of aborting. 17.11's missing-record prompt and 17.30's re-declaration do not qualify — both operate on already-known loans.

---

## 2. Secondary findings

- **S1 — Exception resolution is status theatre.** `resolveException` (`exceptionService.ts:349–407`) sets status + note; no path posts an ADJUSTMENT entry or corrects a loan parameter. The web ResolveDialog offers only status choices (`ExceptionDetailPage.tsx`). Observations→exceptions terminate with zero financial effect. (Consistent with ledger immutability as designed — but then *nothing* in the system can ever move a wrong number, which cannot be the end state for a reconciliation platform.)
- **S2 — Refunds have no money representation.** Over-collection today ends in advisory strings (`observationEngine.ts:446–453`); the planned 17.26 state machine ends in certificate reissue — but no REFUND/REVERSAL `entryType` exists, so even after 17.26, the refund would not be a ledger event. The system models collection only.
- **S3 — approvedBeneficiaries cannot serve as the loan birth certificate as-is.** No interest rate, no tenureMonths, `collectionDate`/`commencementDate` are raw text (`schema.ts:934–935`). Loan↔approval linkage is only the reverse `matchedLoanId` (`:939`); `loans` has no approval FK.
- **S4 — No constraint distinguishes concurrent from sequential loans.** Only `loanReference` is unique; 1,058 legitimate multi-loan holders and accidental duplicates are indistinguishable at schema level.
- **S5 — personMatches is operationally inert.** confirm/reject only flip status (`personMatchingService.ts:279–315`); no downstream effect on loans or ledger. A review queue to nowhere — worth knowing before 17a assumes it as substrate.

---

## 3. Coverage map — reframe requirement vs built vs planned

| Reframe requirement | Built today | Planned | Gap disposition |
|---|---|---|---|
| A. Person entity | none — strings; personMatches inert (S5) | 17.3/17.4/**17a pilot authorised** | ride 17a; inject F2 re-keying into its schema |
| B. Origination anchor | no approval FK; birth-certificate fields missing (S3) | 17.3c/17.3e detect-only | amend: provenance-graded birth evidence on the loan |
| C. Deduction events → ledger | **starved (F1)** | **nothing** | new stories — the single biggest gap in the portfolio |
| D. Statement issuance (issue, don't collect) | none — free-form upload | **nothing** | new epic candidate — but a *destination* (see §4.2) |
| E. Borrower statements/attestation | none (public page = Phase-2 stub) | explicitly deferred (D-15) | PO decision: pull forward minimal read-only statement + dispute intake |
| F. Attested opening balance + materiality | baseline acknowledgment only | 8.0j sign-off; 17.33 cutover gate | amend: per-loan seal semantics + materiality policy |
| G. Refund workflow | strings only (S2) | 17.25/17.26 | amend: must terminate in a ledger event |
| H. Under-collection/resume | 7.2 inactive detection (done) | 17.9/17.11/17.23 | resume workflow thin — acceptable post-pilot |

Reading: **A and G validate the reframe independently** (the planning organism was already converging on it). **C and D are absent everywhere** — and C is the load-bearing one.

---

## 4. Self-critique of the reframe (assumptions not validated — including my own)

1. **"A loan is born at approval" is too strong.** 3,290 repayment streams have no approval record, and the approval table lacks the fields a birth certificate needs (S3). Revised: origination anchor = *best available* birth evidence with a recorded **provenance grade** (approval record > earliest coherent observation > synthetic) — never approval-or-nothing.
2. **"Issue, don't collect" is a destination, not a next step.** Statements can only be issued from a trusted roster plus a running ledger — i.e. after F1 is fixed and archaeology has matured. Issuing wrong statements with official authority is worse than parsing spreadsheets, and would violate app-as-source-of-truth in the dangerous direction.
3. **Borrower attestation must be phased.** 6,500 borrowers include retirees and estates; contact infrastructure and dispute-handling capacity don't exist. High-confidence cohort first — natural alignment with the BIR pilot.
4. **The conservation invariant is a convergence metric, not a day-one constraint.** Total-disbursed is unknowable while start dates sit at 7.6% coverage and registers are incomplete. Track "% of portfolio under conservation," don't assert the invariant.
5. **Bias check on this review:** the verdict "modify, not restart" conveniently avoids condemning prior work this same collaboration produced. I stress-tested it: the restart case would need the *skeleton* to be wrong — balance-from-events, state machine, immutability, computed-not-stored are all exactly what the reframe demands and are the expensive parts to rebuild. The defects are pipes and keys, not skeleton. I hold the verdict, but the comparison review should attack precisely this point.

---

## 5. Recommendation (input to BMAD pipeline / SCP Addendum 3 candidates)

Three foundation-repair workstreams, sequenced **before Epic 17b retrofit** — retrofitting more consumers onto a starved ledger only multiplies the stale-truth surface:

- **W1 — Close the loop.** Confirmed submission/payroll rows → PAYROLL ledger posting, carrying provenance + confidence. Immediate stopgap story (one sprint, low risk): staleness disclosure — "balance as at baseline YYYY-MM" — on every computed surface. Do the stopgap even if W1 proper waits for authorisation.
- **W2 — Re-key history-safe.** Ledger attribution via joins or append-only re-attribution events; fixes the transfer/updateStaffId/reassign split-brain (F2). Must be designed into the 17a schema **now** — this is the only item that touches the authorised pilot, and it is cheapest before the person table exists.
- **W3 — Open-world intake.** Quarantine lane replacing 422-reject-all (F3); quarantined rows feed identity adjudication.

Story amendments (not new epics): origination provenance grade on loans (B/S3); REFUND/REVERSAL entryTypes so 17.26 ends in money-truth (G/S2); opening-balance seal + materiality policy extending 8.0j/17.33 (F); exception resolution gains an "propose ADJUSTMENT entry" path with dual-control (S1). New epic candidates, explicitly sequenced as destinations: statement issuance (D), borrower attestation (E).

**Governance:** all of the above enters through BMAD as SCP Addendum 3 input; nothing here modifies the 17a pilot scope except W2's influence on its schema design; 17b/17c remain paused pending Deputy AG authorisation as per Addendum 2.

---

## 6. What would change my mind (summary of falsification tests)

1. F1: any existing/planned submission→ledger posting path.
2. F2: proof no read path consumes ledger's denormalised keys AND no planned story writes person attributions into the ledger.
3. F3: any intake path that quarantines rather than rejects unknown rows.
4. Verdict: evidence the *skeleton* (event-ledger, computed balance, state machine) is itself wrong for the reframe — e.g. a requirement the append-only model cannot express even with W1–W3 done.

> **F1 partial resolution (2026-07-03 PM, via PRD review §8):** the falsification test was run against the PRD. No FR requires submission→ledger posting — the step exists only in journey prose (Journeys 1/4/10). F1 therefore reclassifies from "build defect" to **"PRD under-specification faithfully implemented."** Severity unchanged (the product still presents frozen balances as computed truth); ownership changes: the fix enters through a PRD amendment + new FR, not a bug ticket. See §8.1.

---

## 7. Agreed UX direction — "One spine, five altitudes" (2026-07-03, PO-approved)

**For Sally (UX):** this is the consolidated UX input for the BMAD pipeline. Companion context: §1–§3 (foundation defects screens must not paper over), §8 (PRD touch map). Direction discussed and agreed with Awwal 2026-07-03.

### 7.1 The problem being solved
Screens accreted **per epic** (E4 dashboard, E5 upload pages, E7 exception queue…), so navigation mirrors the build history, not any user's mental model. Nobody navigates by epic.

### 7.2 The information architecture
Everything in the system is one spine:

**Person → Loan → Ledger events → Computed position → Variance (vs contract / vs report) → Action**

Every user category enters the same spine at a different **altitude**:

| Role | Altitude | Lands on | Core question answered | Never sees |
|---|---|---|---|---|
| Executive (AG / Deputy AG) | Portfolio | Posture view | "Is the scheme healthy? Where is exposure moving?" | Raw uploads, queues |
| Dept Admin / reconciliation officer | Variance | **Worklist, not dashboard** | "What needs my decision today?" | — (full access) |
| MDA officer | My roster | My-MDA period status | "Have I submitted? What's open on *my* people?" | Other MDAs, portfolio totals |
| Auditor / analyst | Evidence | Person search | "One person's full story, provenance to source row" | Write actions |
| Borrower (phased, per D-15) | My loan | My statement | "What have I paid; when do deductions stop?" | Everyone else's data |

Intuitiveness comes from **the same objects looking identical at every altitude** with consistent doorways up/down — extending team agreement "every number is a doorway" (= FR99) to screens: every aggregate clicks down to its list, every row to its evidence; breadcrumb = altitude (Portfolio → MDA → Person → Loan → Event).

### 7.3 Six primitives — build once, compose every screen
1. **Person header** — canonical identity + match-confidence indicator (17a's output made visible).
2. **Position card** — computed balance + **provenance chip** ("as at baseline YYYY-MM" / "live" / "declared by MDA"). This chip IS the F1 staleness-disclosure stopgap turned into a UI primitive; dual-truth (Agreement 21) stops being a per-screen decision.
3. **Ledger timeline** — deduction events on a time axis where **gaps are visible** (a Kolade flatline or missing month is *seen*, not inferred).
4. **Three-truth panel** — contract line vs cash events vs reported balances, one chart. The reframe made tangible; the signature screen for the Deputy AG.
5. **Variance card** — class, non-punitive label from `vocabulary.ts`, owner, doorway to adjudication.
6. **Worklist row** — one consistent shape across every queue (variance, identity, quarantine intake).

### 7.4 Navigation rules
1. **Ops roles land on a worklist** — verbs with counts ("Review variances (12)"); the system briefs you, you never hunt. Executives land on posture (nouns).
2. **Global person search from everywhere** — Bakare Vivian walks in, anyone pulls her file in five seconds.
3. **Global mode banner** — "operational (non-authoritative) mode" until the K-gate. Prevents the 17.34a shadow-dashboard trap of frozen numbers wearing authority. (Not a contradiction of the PRD's "computation-authoritative" vision — the PRD states the destination, the banner states the phase; see §8.2.)
4. **Progressive disclosure of confidence/provenance:** chip → hover detail → click-through full evidence trail. Executives see clean numbers with small chips; auditors click to the source spreadsheet row. Same data, altitude-appropriate depth.

### 7.5 BMAD feed mechanism — the Role–Job–Screen matrix
The trackability artifact: one row per (role × job-to-be-done × screen), carrying primary question, truth-type, doorways in/out, story ID.
- **Screens and routes are named after matrix row IDs** → any bug maps to one row → one story → one owner ("know where the issue lies").
- The six primitives are **component stories** (built once); screen stories only compose them.
- Acceptance criteria carry a **time-to-answer metric**: role-specific UAT task scripts ("determine whether X's deduction should stop"), measured against the old spreadsheet workflow. A screen that can't beat the spreadsheet fails UAT regardless of aesthetics.
- **Each matrix row marks its truth-type dependency** so screen stories sequence correctly behind W1 — beautiful screens over frozen balances manufacture false confidence and are a *worse* product than ugly ones.

### 7.6 Highest-leverage items
1. **The worklist inversion** — cheapest transformative change: the queues already exist; one unified "needs your decision" inbox converts the app from a place you search into a place that briefs you.
2. **The three-truth panel** — the one screen that makes the ledger reframe legible to non-engineers (and to the Deputy AG at the K-gate drill-down, Go-gate G7).

---

## 8. PRD review — root cause + touch map (2026-07-03)

Source: `_bmad-output/planning-artifacts/prd.md` (~100 FRs, current through E8 retro FR96–FR102). Validation report is stale (2026-02-15, 75-FR era). Hygiene: FR91–92 referenced in frontmatter but absent from the FR body (numbering gap).

### 8.1 Root-cause finding: F1 is a PRD under-specification, faithfully implemented
No FR requires accepted submissions to post into the ledger. FR16–24 specify upload → validate → compare → confirm and **stop**; FR11 requires the immutable ledger; FR6 requires computed balances — the connecting step lives only in journey prose (Journey 1 "updated with last month's submissions"; Journey 4 "₦10,000 posted by MOH"; Journey 10 "source PAYROLL"). Dev built the FR letter; the journey intent fell through.
**Process lesson for BMAD (propose as team agreement):** *no load-bearing behaviour may live only in a user journey — journeys must compile into FRs.*

### 8.2 PRD vs reframe/UX direction — conflicts and alignments
**Conflicts:** (a) PRD framing "VLPRS computes truth / system of record" vs non-authoritative mode — resolve by adopting two-track epistemics explicitly (authoritative by design, non-authoritative by mode until K-gate); (b) ledger is **loan-scoped** (FR11) vs person-scoped spine; (c) **two-way** declared-vs-computed comparison (FR21/FR27) vs three-truth (only migration has three-vector, FR93/95); (d) dashboard-first ops landing (FR33/FR56) vs worklist-first; (e) provenance/confidence exists only locally (FR85/87/93/95), not as a universal primitive.
**Alignments:** non-punitive language (FR22, FR86 no-red/no-league-tables), "every number is a doorway" = FR99 verbatim, MDA-officer dashboard FR97 ≈ the my-roster altitude, WCAG 2.1 AA NFRs.
**Absent from PRD entirely:** refund FRs (17.25/17.26 have no PRD anchor), person entity (PRD predates Epic 17), statement issuance to MDAs, borrower statements/disputes (all Phase-2 prose or missing).

### 8.3 Touch map — where each workstream lands in the PRD
| Workstream / direction | PRD sections to touch |
|---|---|
| W1 event posting | FR16–24 + FR6/FR11 — add the explicit posting FR |
| W2 person re-keying | **new Identity/Person section**; amend FR13/61/74/75 |
| W3 quarantine intake | FR16–24; FR96's `pending_verification` status is a ready-made anchor |
| Five-altitude IA + six primitives (§7) | **new IA section** under Web Application Requirements; FR32–37/97/99 absorbed into it |
| Borrower statements | **new Beneficiary FRs** (pulled forward from Phase 2); extends FR8/9/51/98 |
| MDA statement issuance | **entirely new FRs** — nothing exists |
| Attested opening balance + materiality | extends FR26/FR28–29/FR93 |
| Refund rails | **new FRs** anchoring 17.25/17.26 |

### 8.4 Delivery recommendation
Do not rewrite the 100-FR body. Ship a **PRD delta/addendum document** through BMAD (same pattern as the SCP addenda) carrying: the new FRs above, the two-track epistemics statement, the IA section, and the FR91–92 numbering repair. Keeps the diff reviewable for John and Sally, and keeps PRD history auditable.


---

## 9. The 47-case validation run (2026-07-04)

**Inputs:** `C:\Users\DELL\Desktop\47_list.xlsx` (47 recorded over-deduction claims: 46 named + 1 unnamed). Script: `scripts/legacy-report/_tmp-check-47.ts` (reuses the zero-vanish sweep bucket logic; fuzzy name match across ALL MDAs; claim-monthly vs catalog-monthly corroboration). Full output: `docs/Car_Loan/analysis/reports/47-case-crossref-2026-07-04.txt`.

**Integrity note (reported faithfully):** first run had a port defect — threads that hit ~0 mid-stream then show a new balance were misclassified as "caught zero-vanish." Fixed (zero-vanish now requires the LAST balance ≈ 0); three cases reclassified to a new class MISS_LOAN_CYCLE. Numbers below are from the corrected run.

### 9.1 Headline: the sweep catches 4 of 47 as over-collection signals (8.5%); 6 of 47 (13%) counting zero-vanish

| Class | n | Cases / meaning |
|---|---|---|
| CAUGHT_CREDIBLE | 3 | Ajibade (#2), Aliyu (#6), Bakare (#13) — all amount-corroborated |
| CAUGHT_REVIEW | 1 | Mosobalaje (#44) [HOS], −69,998, 7mo over |
| CAUGHT_ZERO_VANISH | 2 | Rafiu (#43); Oladele (#34 — but the zero-vanish loan ended 2023-11 while the claim is 2025-09 → claim actually concerns his SECOND loan, so effectively another loan-cycle case |
| MISS_STILL_POSITIVE | 20 | claim of over-deduction while the REPORTED balance never crossed zero |
| MISS_MDA_DARK | 8 | 7× OYSHMB + Governor's Office — claim MDA has zero catalog data |
| MISS_BAL_NULL | 4 | Accountant General ×3, OYSPHB — PARSER_BLIND instrument class |
| MISS_LOAN_CYCLE | 3 | #9, #37, #38 — thread hit ≈0 then a second loan's balance resumes |
| MISS_NOT_VANISHED | 2 | incl. #42 Adeleke Muibat [LG AUDIT]: −17,999 and STILL on the latest return (2025-12) — LIVE ongoing over-collection, excluded by the sweep BY DESIGN |
| MISS_NOT_IN_CATALOG | 2 | #7, #32 — identity gap |
| MISS_FLATLINE | 1 | #29 Adesina [TRADE] flatlined 45,332 |
| UNTRACEABLE_NO_NAME | 1 | #26 [FINANCE] — amount-trace found 30 candidate threads at ₦11,333/mo |

### 9.2 What the misses prove (this is the payload)

1. **The dominant species is invisible to ANY balance-threshold detector: 21/47 (45%).** STILL_POSITIVE + FLATLINE = claims of over-deduction while the *reported* balance sits above zero. In the three-ledger frame these are **report-vs-cash divergences** (mid-loan wrong/extra deductions, deductions taken but not credited, or claims after the report stream went stale). The sweep reads only the report ledger, so no amount of hardening fixes this — only cash-vs-contract residuals can see it. **The 47 empirically validate the reframe's central claim.**
2. **A fourth hurdle exists that the 6-name spot-check never revealed: "must have vanished."** #42 is below zero and STILL being reported — the most urgent case type (over-collection continuing right now) is structurally excluded because the sweep requires disappearance. Detector fix: flag any below-zero in the latest return as LIVE, highest priority.
3. **Loan cycles corrupt thread-level analysis (4 cases + visible jumps in AG/Justice threads, e.g. 14,166 → 668,647).** Second loans concatenate into the same (MDA, name) thread — confirming schema finding S4 (nothing distinguishes sequential from concurrent loans) at the analysis layer too. Threads must be segmented at zero-reset before any per-loan conclusion.
4. **OYSHMB is the single biggest coverage hole: 11 claims ≈ ₦1.08M essentially unverifiable** (7 fully dark; the few "matches" are 2/3-token namesakes in other MDAs). OYSHMB's files in the corpus are revenue reports, not loan returns. This is a **source-acquisition problem, not a detection problem** — no engine improvement helps until OYSHMB's actual loan returns are obtained.
5. **The claims are largely real people with matching amounts:** 17/47 amount-corroborated (claim monthly == catalog monthly within ₦1) even where balances never crossed zero. The claim list is not noise; the catalog simply cannot adjudicate most of it.

### 9.3 Case-level nuggets worth carrying forward
- **Aliyu's missing February solved-ish:** claim note asks "January to March is three months — what happened in February"; his catalog tail is `2025-00 | 2025-01 | 2025-03` — the **period-parse defect (month 0) is sitting exactly where February should be.** The known data bug has a real claimant attached now.
- **Bakare month-count reconciliation (2 vs 3 months):** the borrower counts Jul+Aug+Sep (deductions after the loan should have ended); the balance-crossing counts Aug+Sep because July's deduction landed exactly on 0. Whether July's deduction was owed determines refund quantum (₦51,874 vs ₦34,582). **Only a contract-vs-cash view resolves this** — another small proof of the frame, and it matters for every refund computation in 17.26.
- **#43 Rafiu [OYSAA]:** tail shows a −441,500 spike then 0 — data-entry artifact; year of claim unknown per the list's own note.
- **Catalog window correction:** global max period is **2026-04**, not 2025 — several MDAs (HEALTH, AGRICULTURE, ACCT GEN, CSC, ESTABLISHMENT) report into 2026. Claim windows into 2026-01 are inside coverage.
- **#26 (no name) is traceable by amount:** 30 FINANCE threads at ₦11,333/mo; narrowable by activity in the claimed Feb–Nov 2025 window. Trace-by-amount is a viable adjudication tool for anonymous claims.

### 9.4 Implications
- **For the archaeology track:** the 47 as validation set worked exactly as intended — they quantified the sweep's structural under-count (13% catch) and enumerated the blind-spot census. Next detector version: (a) LIVE below-zero flag (drop vanish requirement), (b) cycle segmentation at zero-reset, (c) flatline detection, (d) claim-window vs thread-window overlap check, (e) OYSHMB source acquisition escalated to the AG office.
- **For BMAD/17.25–17.26:** over-deduction detection specified as balance-threshold-only would reproduce this 13% catch-rate in the app. The refund workflow needs the cash-vs-contract residual and the month-count semantics (Bakare off-by-one) written into its acceptance criteria.
- **For the frame:** commitment #3 (three ledgers) and inversion #2 (borrower as auditor) are now empirically supported by the State's own pending-case list, not just by argument.
