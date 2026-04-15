# Sprint Change Proposal — Identity, Continuity & Authoritative Go-Live Readiness

**Date:** 2026-04-15
**Author:** John (PM) with Bob (SM), Alice (PO), Charlie (Senior Dev), Dana (QA), Elena (Junior Dev)
**Project Lead:** Awwal Lawal
**Scope classification:** **MAJOR** — fundamental replan required
**Status:** Approved 2026-04-15

---

## Section 1 — Issue Summary

### Trigger

The Multi-MDA Migration UAT session (2026-04-12 → 2026-04-14), conducted against the full 46-MDA sandbox dataset following completion of the Epic 15 prep sprint (15.0a–15.0n), surfaced 53 findings. 46 were resolved in code across four commits (8490d09, ec02604, 14862f1, b9e01b1); 1 CRITICAL production bug (`baselineAmount` returning `'0.00'` stub) was caught only by an integration test that did not exist before the UAT session. Deferred findings surfaced a latent architectural gap: **the pipeline has no stable identity for a beneficiary or a loan across months or MDAs.** Each monthly upload creates fresh `staff_id` and `loan_id`, producing over-counted portfolios, false variances, and silent loss of loan-lifecycle signals.

### Confirming audits

A focused forensic audit was conducted against the side-quest analysis catalog (`docs/Car_Loan/analysis/foundation/catalog.json` — 74,138 deduplicated records from 374 source files, 46 active MDAs). Documented in:

- `docs/Car_Loan/analysis/reports/alatise-detailed-audit-report.pdf` — forensic audit (multi-page)
- `docs/Car_Loan/analysis/reports/alatise-deputy-ag-summary.pdf` — one-page Deputy AG brief

**Key findings:**
- ALATISE BOSEDE SUSAINAH: 51 records, two name spellings, two MDAs, four distinct loan signatures, eight distinct data quality observations. Group 2 (BIR ₦750K, declared 28-month): scheme math indicates 50-month; lifetime variance ≈ ₦320,656; at declared "completion" the loan actually has ~21 months still owed ≈ ₦355,516.
- LAMIDI MORUFU: BIR ₦750K 60-month (scheme max). 36 records Jan 2022 → Dec 2024. **Zero records with outstanding column populated.** Final record `paid=61, remaining=-1` — arithmetic impossibility revealing **cumulative overdeduction of ≈ ₦13,766** (one extra month of deduction past scheme terminus).
- A fragmentation scan across BIR showed 0.7% of loans have gaps ≥3 months. Rate is expected to be materially higher across the full 46-MDA population.

### Issue type

**Technical limitation discovered during implementation** (latent architectural gap) compounded by **new requirements emerged** (Path 3 settlement, concurrent-loan policy, bank reconciliation, overdeduction refund pathway) and **misunderstanding of original requirements** (the PRD's fuzzy-matching story was scoped onboarding-only; the need is system-wide).

### Problem statement

VLPRS currently produces plausibly-shaped portfolio figures that sum MDA-declared values without gating by reconciliation status. Single-beneficiary audits of Alatise (51 records) and Lamidi (36 records) reveal eight and three classes of data quality issues respectively, including tenure misrecording, installments-remaining inflation, frozen-template pattern, cross-MDA presence without handshake, lack of outstanding=0 evidence at declared completion, arithmetic impossibilities (paid>tenure), and cumulative overdeduction. The pattern is not expected to be unique; empirical prevalence across the 4,926-strong population is unknown but is likely to be material. Publishing authoritative AG figures against this pipeline state would mean publishing confidently-wrong numbers — a GovFin outcome that compounds financial accountability risk with political-governance risk.

---

## Section 2 — Impact Analysis

### Epic impact summary

| Epic | Impact class | Summary |
|---|---|---|
| E1 Foundation | EXTEND | New audit-log categories; new `EXTERNAL_AUDITOR` read-only role |
| E2 Loan Data | EXTEND | `loans` schema extends; status enum extends |
| E3 Data Migration | MODIFY | Side-quest utilities ported to production; Master Beneficiary Ledger becomes `persons` seed |
| E4 Executive Dashboard | MODIFY | Every tile rewritten for dual-truth rendering (Reconciled/Pending Review/Difference) |
| E5 MDA Submission | EXTEND | Content validation gate prepended; PRP triggered on commit |
| E6 Reports | EXTEND | Every report gains Reconciled/Pending annotation |
| E7 Exception Management | MODIFY | Exception Queue and Review Queue merge into one triage surface |
| E8 Auto-Stop Certificate | EXTEND | Certificate-with-comment pattern + versioning + supersede chain |
| E10 Temporal Profile | LEVERAGE | `employment_events` gains new types |
| E11 Pre-Submission | EXTEND | Truth-state aware; cross-time reconciliation via PRP |
| E14 Public Website | NO IMPACT | Untouched |
| E15 Beneficiary Onboarding | SUBSUME (partial) | 15.2 retires (subsumed by 17.3); 15.3–15.6 rescope |
| E16 Cross-Month | SUBSUME (partial) | 16.1 dramatically shrinks (PRP does most of it); 16.2–16.4 rescope |
| E12 Early Exit | UNCHANGED | Original 12.1–12.3 stand; Path 3/bank recon/remediation moved INTO Epic 17 |
| E9 Notifications | EXTEND | New notification types (re-attribution, handshake, Path 3 confirmation) |
| E13 Staff ID Governance | SUBSUME | 13.3 and 13.4 retire — fully subsumed by Epic 17 Identity layer |

Detail in Section 5 (Holistic Impact) and Section 6 (Post-E17 Restructure).

### Artifact conflicts

**PRD (`planning-artifacts/prd.md`):**
- Add FRs for PersonIdentityService, LoanIdentityService, LifecycleDetector, Person Reconciliation Pass, dual-truth dashboard aggregation, Settlement Pathway 3, bank reconciliation gate, content validation gate, overdeduction refund workflow, certificate versioning, app-as-source-of-truth doctrine
- Update FR85 (fuzzy matching) to system-wide scope
- Add NFRs for order-independence of ingestion, idempotency of reconciliation, append-only audit despite mutable re-attribution
- Revise "Go-Live Definition" to require Epic 17 + pilot cycle complete

**Architecture (`planning-artifacts/architecture.md`):**
- Add three-gate ingestion model (Identity → Variance → Lifecycle) with component diagram
- Add Person Reconciliation Pass (set-based, idempotent, per-person recompute)
- Add schemas: `persons`, `person_aliases`, `identity_proposals`, `person_link_candidates`, `loan_attribution_history`, `metric_snapshots_monthly`, `overdeduction_cases`, `overdeduction_case_history`, `certificates` (extended with version/supersede)
- Add truth-state model (per-record + per-person) and dashboard-gating semantics
- Add Path 3 event type to `employment_events` taxonomy
- Add content validation layer pre-identity
- Add bank reconciliation gate post-period-close
- Document append-only audit invariant despite mutable re-attribution

**UX Design (`planning-artifacts/ux-design-specification.md`):**
- Add dual-truth dashboard rendering pattern (Reconciled / Pending Review / Difference)
- Add `<VarianceBadge>` component — direction-explicit (↓ Outstanding to scheme / ↑ Refund due to staff / ⚠ Pending classification)
- Add Review Queue UI specifications (Dept Admin + MDA Officer views, merged with Exception Queue)
- Add Loan Detail Page redesign (merges 17.13 + 17.21: Identity | Timeline | Variance | Certificates | Activity Log tabs)
- Add Pre-Ingest Aggregated Preview pattern
- Add Re-Attribution Notice pattern
- Add Unattributed Loan Endings queue (Car Loan Department-facing)
- Add Overdeduction Refund Workflow surfaces (AG queue + Dept Admin confirmation queue)
- Add Certificate Design Preview sidebar entry for all roles
- Add Certificate-with-Comment PDF template variant + Supersede chain visualisation

### Side-quest code

`scripts/legacy-report/utils/name-match.ts`, `mda-resolve.ts`, `number-parse.ts`, `column-map.ts`, `header-detect.ts`, `period-extract.ts` become canonical seed code for porting into `packages/shared/` (or equivalent server location). Side-quest bug fixes (CDU sub-section, AG stale title, BOTAVED month=0, AANFE false positive, CCA columns) become named regression fixtures.

### Test fixtures

- **Alatise Bosede Susainah 51-record dataset** — canonical gold-standard regression fixture at `tests/fixtures/identity-continuity/alatise-bir-csc-2023-2026/` with Awwal-verified `.expected.json` covering person grouping, loan-boundary decomposition, variance states (including tenure misrecording), lifecycle transitions, dashboard contribution per month
- **Lamidi Morufu 36-record dataset** — canonical fixture for overdeduction pattern at `tests/fixtures/identity-continuity/lamidi-bir-2022-2024/` covering `paid=61, remaining=-1` arithmetic impossibility + cumulative overpayment detection
- **ADELEKE namesake false-positive** (UAT #30) — canonical fixture for namesake-guard behaviour
- **CDU/Agriculture parent-child** (UAT #46) — canonical fixture for MDA hierarchy
- 2–3 additional fixtures to be selected during discovery spike (17.1): transferred-mid-loan, completed-via-Path3, MDA-stopped-reporting

### Technical impact

**Performance:** PRP + full-catalog identity resolution introduces a per-upload reconciliation cost. Discovery spike (17.1) Q5 must benchmark. Per-MDA candidate filtering (500–2,000 candidates per MDA) is the first-order optimisation.

**Data migration:** 74,138 existing records require retroactive `person_key`/`loan_key` assignment with human-gated sign-off (Story 17.17).

**Audit integrity:** Append-only audit preserved via `loan_attribution_history` (every change to `loan.person_key` writes immutable history row).

**Operations:** Review queues require staffed operations. Staffing model specified before operations-affecting stories ship.

---

## Section 3 — Path Forward Evaluation

### Option 1 — Direct Adjustment — NOT VIABLE
The gap is architectural, not incremental. Modifying 15.2 in place or adding 1-2 stories would not produce the coupled three-gate engine, the PRP, the dual-truth dashboard, the overdeduction refund workflow, or the certificate-with-comment pattern the audits show are required.

### Option 2 — Potential Rollback — NOT VIABLE
Completed work is correct within its original scope; the gap is latent and was exposed only by UAT against multi-MDA data and by deeper single-beneficiary auditing.

### Option 3 — PRD MVP Review — VIABLE
The original PRD's implicit MVP was "all sixteen epics complete through E13." The audits reveal additional gates are required for authoritative go-live. Redefining the MVP to include Epic 17 is the honest representation of "go-live ready."

### Recommended path — Hybrid (Option 3 + targeted insertion)

1. **Insert new Epic 17 — Identity, Continuity & Authoritative Go-Live Readiness** into the sprint sequence, taking the place currently held by E15-core and E16-core
2. **Pause Stories 15.2–15.6 and 16.1–16.4** by moving status from `ready-for-dev` to `backlog` with explicit `blocked-by: epic-17` annotations; 15.2 retires entirely
3. **Epic 12 remains at its original scope** (3 stories 12.1–12.3). Path 3 settlement and related workflows move INTO Epic 17, not Epic 12
4. **Epic 13 retires** — 13.3 and 13.4 are fully subsumed by Epic 17's Identity layer and Review Queue
5. **Redefine go-live MVP** as: Epic 17 complete + BIR pilot cycle complete + one reconciliation cycle reviewed by AG; Epics 12, 9, 15-core, 16-core land post-go-live as enhancements
6. **Communicate to Deputy AG first** using the two PDFs + this proposal with recommendation framed as "pause authoritative go-live, commission Epic 17, pilot with BIR"

---

## Section 4 — Detailed Change Proposals

### 4.1 New Epic 17 — Identity, Continuity & Authoritative Go-Live Readiness

**Epic goal:** Establish a system-wide stable identity for beneficiaries and loans that survives haphazard upload, cross-MDA transfer, name variation, and MDA declaration error, such that AG dashboard figures can be gated by reconciliation status and published with confidence. The app becomes the source of truth for scheme records.

**Total: 37 stories in 11 sub-themes.** Lint ratchet is Story 17.0 — enforced from day one, no `any` warning count increase during Epic 17 work. Story 17.3b added 2026-04-15 following MDA payroll-snapshot discovery (BIR Feb 2026 + OYSIPA Apr 2021).

**Relationship to existing reconciliation layers (already built, not duplicated):**

| Layer | Source of truth | Story | Status |
|---|---|---|---|
| Per-record three-vector | Scheme formula vs reverse-engineered vs MDA-declared | 8.0a | **Done** |
| Aggregate three-way (AG-level consolidated payroll) | Expected (scheme) vs Declared (MDA submission) vs Actual (AG consolidated payroll extract) | 7.0h + 7.0i | **Done** |
| **Per-MDA payroll snapshot** | MDA's own monthly payroll CSV with CAR LOAN column — cross-reference to MDA-declared submission | **17.3b (new)** | Epic 17 |
| Bank-level (scheme account) | Cash arrival in scheme recovery account vs MDA-declared remittance | **17.24 (new)** | Epic 17 |

Epic 17 adds the third layer; it does not replace the first two. The payroll-extract reconciliation (Stories 7.0h + 7.0i) is already in production and becomes an input to the dual-truth dashboard (Story 17.17) rather than a scope candidate.

#### Sub-theme A — CI Hardening (2 stories)
| # | Title | Notes |
|---|---|---|
| 17.0 | Lint ratchet for `any` warnings — split prod vs test | **Production code:** CI commit-blocking ratchet on `any` warning count. **Test code:** parallel non-blocking countdown tracked in CI summary (PR comment only). Most of the 46 warnings live in test helpers where `any` is often pragmatic (mock types); commit-blocking there would create CI-thrash without meaningful gain. Enforced from day one so Epic 17 prod code cannot silently inflate warnings. |
| 17.0b | DRY_RUN infrastructure for all writing engines | Cross-cutting story: `DRY_RUN=1` mode supported by PRP, fingerprint assignment, backfill, re-attribution, overdeduction detection, certificate issuance. Produces the same diff report without committing. All downstream writing stories inherit the convention. Operationally essential for pilot risk management. |

#### Sub-theme B — Discovery & utility port (2 stories)
| # | Title | Notes |
|---|---|---|
| 17.1 | Discovery spike — prevalence survey of 8 assumptions | Q1 collision rate, Q2 first-deduction-date coverage, Q3 zero-crossing vs gap rate, Q4 concurrent-loan prevalence, Q5 performance budget, Q6 variance contamination, Q7 haphazard-upload distribution, Q8 overpayment prevalence. **Deliverable:** `_bmad-output/implementation-artifacts/17.1-spike-output.md` with decisions-log entries per question + quantitative findings. **Alice (PO) signs off as basis for re-sizing Stories 17.4 / 17.8 / 17.12 / 17.25 before their kickoff.** Prevents spike output from being orphaned. |
| 17.2 | Port side-quest utilities to production | `name-match`, `mda-resolve`, `number-parse`, `column-map`, `header-detect`, `period-extract` into server codebase with regression fixture suite from side-quest March 2026 refinements |

#### Sub-theme C — Identity layer (6 stories)
| # | Title | Notes |
|---|---|---|
| 17.3 | `persons` + `person_aliases` + `identity_proposals` schema + migration + seed from Master Beneficiary Ledger | `person_aliases.alias_type` extended with `HR_ROSTER` (highest-confidence, sourced from MDA-issued payroll-roster uploads via 17.3b). Story 17.4 resolver treats HR_ROSTER staff_id as primary match anchor before fuzzy name match. |
| 17.3b | **MDA Payroll Snapshot Ingestion** | **Discovery 2026-04-15:** BIR Feb 2026 CSV (249 staff, 134 with active car-loan deductions, ₦1,672,630 total) is a full monthly payroll snapshot containing Staff ID + Full Name + Job Title + Grade + Department + Bank + actual CAR LOAN deduction. Same for OYSIPA Apr 2021. These are not just HR rosters — they're **three evidence layers in one file**: (a) authoritative Staff ID + Name bindings (HR roster), (b) actual monthly car-loan deductions (third evidence layer alongside per-record three-vector 8.0a and aggregate three-way payroll 7.0h+7.0i), (c) rich employment context (grade, department, bank) for identity disambiguation. New schema: `payroll_snapshots(id, mda_id, snapshot_date, uploaded_by, file_hash)` + `payroll_snapshot_rows(snapshot_id, staff_id, full_name, grade, department, car_loan_deducted, basic_salary, ...)`. Upload UI: MDA Officer (primary) + Dept Admin + AG (override). Parser: reuses side-quest `column-map.ts`; detects Staff ID column, Full Name column, CAR LOAN column. On ingest, three outputs: (1) `person_aliases` seeded with HR_ROSTER type at highest confidence; (2) `payroll_snapshots` + rows populated; (3) cross-reference: payroll CAR LOAN amount compared against MDA-declared submission for same `(staff_id, period, mda)` → emits `PAYROLL_VS_MDA_VARIANCE` observation when they diverge. Staging files at `VLPRS-Upload-Staging/_PAYROLL-ROSTERS/` become the initial ingest batch. |
| 17.4 | `PersonIdentityService` — SEARCH + MATCH APIs with fuzzy-Jaccard comparator, similarity bands, namesake frequency guard, cross-MDA flag (no auto-link), confidence evidence persistence | **Two distinct operations:** `searchPersons(query)` returns broad candidate list (Google-suggest style, for Review Queue UI + LoanDetailPage search); `resolvePerson(record)` returns strict match decision (for ingestion). Same comparator, different action thresholds. **Fuzzy-Jaccard comparator:** token-set Jaccard with per-token Levenshtein <= 2 for token equivalence (primary gate); Jaro-Winkler as tiebreaker. Bands: Jaccard < 0.5 → NOT_MATCH; Jaccard >= 0.5 with max token Levenshtein = 0 → HIGH auto-link; Levenshtein = 1 → HIGH_WITH_TYPO_FLAG auto-link with audit note; Levenshtein 2–4 → MEDIUM review queue; Levenshtein >= 5 → NOT_MATCH. Namesake frequency guard downgrades HIGH to MEDIUM when normalised name frequency exceeds threshold. ADELEKE fixture (UAT #30) as regression test — see `tests/fixtures/identity-continuity/adeleke-namesake/expected.json` for signed-off ground truth including the edge case `Adeleke Olufemi` vs `Adeleke Oluwafemi` (MEDIUM band, not perpetual ambiguity). |
| 17.5 | `person_link_candidates` table + proactive Pending Handshake surfacing to both MDAs + Transfer Handshake wiring | |
| 17.6 | Review Queue UI — merged with existing Exception Queue + search-then-confirm pattern | Dept Admin approves merges; MDA Officer confirms medium-confidence matches. **Search-then-confirm:** when a user manually picks a candidate from `searchPersons` results (e.g., during a correction), the confirmation step renders match score + evidence before committing. Not a hard block — a visible "we resolved to person X at similarity Y because of evidence Z; confirm?" step. Keeps human judgment primary with engine analysis as context. |
| 17.7 | Loan Detail Page (merged Person-Centric admin view + loan timeline) | Tabs: Identity | Timeline (with blank months explicit) | Variance | Certificates | Activity Log. AG/Dept Admin/MDA Officer access (scoped). Staff self-service = Phase 2. |

#### Sub-theme D — Loan & Lifecycle layer (4 stories)
| # | Title | Notes |
|---|---|---|
| 17.8 | `loans` schema extension + fingerprint columns + `loan_attribution_history` | Fingerprint: `(person_key, principal, first_deduction_date, original_tenure)` |
| 17.9 | `LoanIdentityService` + outstanding-zero-crossing lifecycle detector + TEMPLATE_ROLLOVER_ERROR detection + negative-value validation | Lamidi fixture as regression test; handles `paid > tenure` and `remaining < 0` as hard-fail |
| 17.10 | Most Likely Explanation suggestion engine for variance correction | From UAT #43. Proposes most probable cause (e.g., "monthly deduction consistent with tenure=50, not declared 28 — likely tenure misrecording") |
| 17.11 | Missing Record Detection & MDA Prompt Service | Detects expected-but-missing months per active loan; notifies MDA with SLA; escalates to Dept Admin attention item on expiry |

#### Sub-theme E — Reconciliation & Truth State (5 stories)
| # | Title | Notes |
|---|---|---|
| 17.12 | Person Reconciliation Pass (PRP) — set-based, idempotent, per-person recompute | Triggered by upload/correction/handshake; operates on union of known records; outputs provisional until settled. **Admin CLI:** `pnpm recompute-person <personKey>` and `pnpm recompute-mda <mdaId>` with `--dry-run` and `--commit` modes for schema migrations, corruption recovery, and manual operational intervention. **Idempotency scope:** idempotent within a single schema version only; schema changes affecting PRP inputs require a full-backfill job (coordinated via 17.33). |
| 17.13 | Upload pipeline integration + content validation gate | Rejects non-car-loan files at boundary (OYSHMB class) |
| 17.14 | Truth-state model | `CLEAN`, `IN_VARIANCE`, `LIFECYCLE_REVIEW`, `OVERPAYMENT_ADJUDICATION`, `PENDING_COMPLETION_EVIDENCE`, `RESOLVED_OUT_OF_SYSTEM`, `CERTIFICATE_WITH_OBSERVATION_NOTE`, `CERTIFICATE_CLEAN`, `APP_BANK_STATEMENT_VARIANCE` per record; `SETTLED`, `PROVISIONAL`, `IN_TRANSFER` per person. New observation types from Story 17.3b MDA payroll-snapshot ingestion: `LOAN_RECORD_WITHOUT_ROSTER_MATCH` (staff_id on loan record not present in any HR roster for that MDA), `NAME_MISMATCH_BETWEEN_LOAN_AND_ROSTER` (staff_id matches but Full Name differs from roster record — typo vs name change), `HR_ROSTER_STAFF_NEVER_TOOK_LOAN` (informational coverage metric), `HR_ROSTER_STAFF_DISAPPEARED_FROM_UPDATE` (between two roster versions — retired/died/transferred/data error), `PAYROLL_VS_MDA_VARIANCE` (CAR LOAN column in payroll snapshot diverges from MDA-declared submission for same (staff_id, period)). |
| 17.15 | Monthly dashboard snapshots at month-close | Preserve historical figures despite re-attribution |
| 17.16 | Idempotency property test framework | 24-permutation test for Alatise fixture + 4–6 additional fixtures |

#### Sub-theme F — Dashboard & Observability (4 stories)
| # | Title | Notes |
|---|---|---|
| 17.17 | Dual-truth dashboard rendering (Reconciled / Pending Review / Difference) + per-MDA `dashboard_mode` enum | Absorbs UAT #8 (health score), #40 (three-view), #47 (baseline-vs-migrated diagnostic). Difference is a first-class data quality KPI. **Per-MDA rollout control:** `mdas.dashboard_mode ∈ {legacy, dual_truth_shadow, dual_truth_live}` with Dept Admin flip authority per MDA post-BIR-pilot, enabling graceful portfolio migration instead of all-or-nothing cutover. Aligns with Agreement 20 at finer grain. **Difference column UI:** when Pending Review exceeds Reconciled, headline shows Pending with amber "Portfolio in review phase" banner; Reconciled shown as fraction; prevents negative/zero-authoritative-figure display. |
| 17.18 | `<VarianceBadge>` component — direction-explicit | ↓ Outstanding to scheme / ↑ Refund due to staff / ⚠ Pending classification. Applied to Review Queue + Loan Detail Page |
| 17.19 | Pre-ingest aggregated preview | "N new persons, M continuations, K new loans, F flags" with drill-down |
| 17.20 | Re-attribution UX — audit-log feed + affected-record notifications | |

#### Sub-theme G — MDA Hierarchy (1 story)
| # | Title | Notes |
|---|---|---|
| 17.21 | MDA autonomy model — `is_autonomous` + `reporting_parent_mda` metadata (reporting rollups only, not identity routing) | **Scope simplified per Awwal 2026-04-15:** autonomous agencies (e.g., CDU under Agriculture) are standalone `mda_id` for identity resolution. Parent/child is metadata consumed only by opt-in reporting rollups, never by identity queries. Schema adds `mdas.is_autonomous BOOLEAN` + `mdas.reporting_parent_mda INT NULLABLE REFERENCES mdas.mda_id`. Side-quest `utils/mda-resolve.ts` logic preserved in production via Story 17.2 port. CDU fixture at `tests/fixtures/identity-continuity/cdu-agriculture-parent-child/expected.json` with signed-off ground truth. |

#### Sub-theme H — Settlement, Cash & Overdeduction (5 stories)
| # | Title | Notes |
|---|---|---|
| 17.22 | Settlement Pathway 3 (walk-up lump-sum) event + Car Loan Dept UX | Explicit event filing with receipt reference |
| 17.23 | Unattributed Loan Endings queue | Car Loan Dept receives candidates from legacy "stalled" bucket; must file settlement event, transfer, retirement, death, or mark as AG/Dept Admin-escalated write-off |
| 17.24 | Bank statement reconciliation (upload-based, no API) | **Revised per critique round 2:** upload-based scheme account reconciliation (monthly, by Dept Admin) + staff-level dispute statement attachment (per-case, per-complaint). PDF/CSV parsing built on side-quest utility port (17.2). **No external integration required.** Emits `BANK_CASH_VARIANCE` (scheme-level: sum of MDA-declared deductions vs credits actually landed in scheme account) and attaches evidence to dispute cases (staff-level: personal statement vs ledger_entries for their loan). **Distinct from existing payroll reconciliation** (Stories 7.0h + 7.0i, done) — payroll reconciliation matches payroll-deducted vs MDA-declared; bank reconciliation matches bank-credited vs MDA-declared. Both are complementary evidence layers. **Prerequisite:** none external. Scheme account details are internal knowledge. |
| 17.25 | Overdeduction Detection & Adjudication | NO threshold — every ₦1 overpayment surfaced. `CUMULATIVE_OVERPAYMENT` observation at the month cumulative deducted crosses scheme total. Direction-aware via `<VarianceBadge>` |
| 17.26 | Overdeduction Refund Workflow — state machine + AG sole approval + SLA semantics | `overdeduction_cases` table + 6-state progression (DETECTED → PENDING_AG_APPROVAL → AG_APPROVED → AWAITING_PAYMENT_CONFIRMATION → PAYMENT_CONFIRMED → CERTIFICATE_REISSUED → CLOSED). AG/Deputy AG sole authority (no threshold, no dual-signature). Dept Admin surfaces + confirms payment only, no approval role. Batch-approval UI for AG efficiency. **Each state transition has an SLA**; expiry generates an attention item routed to escalation (Deputy AG on AG absence; AG on Dept Admin absence). **SLA values** TBD per 17.31 Scheme Secretariat clarifications; suggested starting values — PENDING_AG_APPROVAL ≤ 14 days, AWAITING_PAYMENT_CONFIRMATION ≤ 30 days, CERTIFICATE_REISSUED ≤ 7 days after confirmation. |

#### Sub-theme I — Certificate Evolution (3 stories)
| # | Title | Notes |
|---|---|---|
| 17.27 | Certificate Issuance Precondition Gate (Epic 8 extension) | Issues when scheme total paid (observed outstanding=0 OR cumulative deducted ≥ scheme total) OR explicit settlement event. Certificate-with-comment pattern for overdeduction cases. No auto-issue on inferred-complete without evidence. |
| 17.28 | Certificate Versioning & Supersede Chain | `certificates.version`, `supersedes_id`, `supersede_reason` schema. Public verification page shows full chain; current version highlighted. Supersede reasons: `OVERDEDUCTION_CLEARED`, `DATA_ERROR_CORRECTED`, `RE_ATTRIBUTION`, `WITHDRAWAL` |
| 17.29 | Certificate Design Preview UI | Sidebar entry for AG/Deputy AG/Dept Admin/MDA Officer. Renders sample v1 (with Scheme Observations), v2 (clean), Path 3, Path 4 variants. Watermarked "SAMPLE — NOT FOR OFFICIAL USE", no valid QR. Feedback comment form. |

#### Sub-theme J — Data Remediation & Policy (2 stories)
| # | Title | Notes |
|---|---|---|
| 17.30 | MDA source data remediation workflow | Category 2 MDAs with within-file duplicates — structured re-declaration request path |
| 17.31 | Scheme policy clarifications | Concurrent-loan policy; death-in-service handling; currency/interest-rate history (scheme rule versioning with effective-date ranges); overdeduction refund authority thresholds; write-off authority thresholds; external-auditor read-only role. Deliverable: written clarifications from Scheme Secretariat incorporated into engine configuration |

#### Sub-theme K — Backfill & Pilot (3 stories)
| # | Title | Notes |
|---|---|---|
| 17.32 | External-auditor read-only role | New role with scoped queries + audit-log feed + standard-format export. Designed from day one for federal AG, civil society, parliamentary access |
| 17.33 | Retroactive backfill — run 74,138 catalog records through PRP | Route medium-confidence to Dept Admin review; sign-off gate before cutover; dry-run + preview + rollback capability |
| 17.34 | BIR pilot — one reconciliation cycle, documented findings, go/no-go gate | **Reconciliation cycle defined:** one monthly BIR upload → PRP runs → dual-truth dashboard renders → AG reviews → written sign-off OR findings log. Cycle time-boxed per 17.31 policy decision (suggested: 21 calendar days). **CRITICAL defined precisely:** a finding is CRITICAL if and only if any of: (a) app publishes a figure the AG cannot defend in writing, (b) break in append-only audit invariant, (c) overdeduction refund allowed without AG approval. Anything else is HIGH/MEDIUM and does not gate go-live expansion. |
| 17.34a | Shadow dashboard — 14 days pre-BIR-pilot-cutover | Run dual-truth dashboard in production against real data, visible to AG + PO only (not MDA Officer or external). Compare outputs to legacy dashboard daily. Systematic divergence surfaces as pre-pilot finding. Catches integration issues before BIR officer ever sees new UI. Lowers pilot risk materially. |

### 4.2 Story status changes (effective on proposal approval)

| Story | From | To | Annotation |
|---|---|---|---|
| `15-2-fuzzy-name-matching-engine` | `ready-for-dev` | `retired` | Fully subsumed by 17.4 PersonIdentityService |
| `15-3-monthly-onboarding-scan` | `ready-for-dev` | `backlog` | `blocked-by: epic-17.12; rescope: thin wrapper on PRP` |
| `15-4-onboarding-pipeline-dashboard-report` | `ready-for-dev` | `backlog` | `blocked-by: epic-17.17; extends dual-truth for onboarding view` |
| `15-5-retirement-deceased-verification-report` | `ready-for-dev` | `backlog` | `blocked-by: epic-17.9 + 17.31 policy` |
| `15-6-attention-items-observation-integration` | `ready-for-dev` | `backlog` | `blocked-by: epic-17.14; rescope smaller` |
| `16-1-cross-month-diffing-engine` | `ready-for-dev` | `backlog` | `blocked-by: epic-17.12; dramatically smaller scope post-PRP` |
| `16-2-anomaly-resolution-event-context` | `ready-for-dev` | `backlog` | `blocked-by: epic-17.14` |
| `16-3-cross-month-dashboard-drilldown` | `ready-for-dev` | `backlog` | `blocked-by: epic-17.17; becomes a dashboard tab variant` |
| `16-4-portfolio-stability-metrics` | `ready-for-dev` | `backlog` | `blocked-by: epic-17.15` |
| `epic-13` | `backlog` | `retired` | Fully subsumed by Epic 17 Identity layer |
| `13-3-staff-id-management` | `backlog` | `retired` | Subsumed by 17.3 + 17.6 |
| `13-4-duplicate-staff-id-detection` | `backlog` | `retired` | Subsumed by 17.4 namesake guard |
| `epic-15` | `in-progress` | `in-progress` | Core paused pending E17 |
| `epic-16` | `in-progress` | `in-progress` | Core paused pending E17 |

### 4.3 Team agreements additions (for retro vote)

| # | Agreement | Source |
|---|---|---|
| 15 | **Test-fixture parity** — if a commit changes a component's data shape, hook contract, or rendered strings, the companion test must be updated in the same commit | UAT #51 |
| 16 | **Pre-push integration sweep** — before pushing a multi-story feature commit to `dev`, run `pnpm test && pnpm --filter server test:integration` locally | UAT #52 |
| 17 | **Audit before authority** — any headline figure proposed for AG-facing publication must first pass a structured single-beneficiary audit against the side-quest catalog. *Publication-time expression of Agreement 18.* | Alatise audit pattern |
| 18 | **Fixture-first for architectural tracks** — new engine stories must have a gold-standard regression fixture with Awwal-verified ground truth before implementation starts. *Development-time expression of Agreement 17.* | Alatise 51-record + Lamidi 36-record pattern |
| 19 | **Dual-truth by default** — any newly-published authoritative figure must render Reconciled / Pending Review / Difference. Single-number publication requires explicit PO sign-off | Dashboard gating principle |
| 20 | **Pilot-before-portfolio** — any engine change affecting authoritative figures ships first as single-MDA pilot for one reconciliation cycle before expanding | Epic 17 risk management |
| 21 | **Dept Admin escape hatch** — every engine-enforced gate must have a Dept Admin authority escape hatch with audit trail. Engine proposes, humans dispose. **Override rate is a system-health KPI, not a discipline KPI** — high override rate signals engine mis-calibration; low override rate signals engine trust. Reframing prevents perverse incentive to under-override when override is correct. | Operational realism |
| 22 | **App is the source of truth** — VLPRS records are authoritative for scheme figures. Bank statements, MDA reports, external documents corroborate; they do not override. Every authoritative figure defensible from the app alone. **Exception:** under AG-authorised out-of-band correction (e.g., court order, external-audit-firm finding), the correction flows through the app via a formal event record with AG authorisation, so the app remains the system of record for what was done and why. | AG policy directive |
| 23 | **Editable placeholders over external blockers** — any value that would normally require external-party confirmation (Scheme Secretariat policy, bank account details, rate thresholds, SLA durations, authority limits) is implemented as an **AG-editable configuration value** with a reasonable default placeholder. Screens render the current value with an inline edit control for AG-role users. This follows the existing pattern from the AG Dashboard Fund Amount field (set by AG, not hardcoded). Build never blocks on external input — values ship with sensible placeholders and get updated through the UI when official values arrive. | Awwal directive 2026-04-15: "anything that may require external input we make it editable via the ui and put reasonable values pending official values" |

### 4.4 UAT 2026-04-12 triage — no duplicates

**Resolved in code (NOT in Epic 17, shipped):** #1–#7, #9–#27, #31, #32, #33, #34, #35, #36, #38, #39, #41, #50–#53 — **42 items**

**Validation-only (not stories):** #37, #42, #49 — **3 items**

**Genuinely deferred (4 net new Epic 17 stories, 3 absorbed into existing stories):**

| UAT # | Resolution |
|---|---|
| #8 | Absorbed into 17.17 (dual-truth subsumes health score) |
| #40 | Absorbed into 17.17 (three-view dashboard is the dual-truth pattern) |
| #43 | **New story 17.10** Most Likely Explanation engine |
| #44 | **Handled within Epic 17 infrastructure** — rate limiter migration to Redis becomes Story 17.0b or integrated into 17.13 upload pipeline integration (ICR pipeline is the reason Redis is needed) |
| #45 | Absorbed into 17.17 (drill-down) + 17.7 (loan detail page) |
| #46 | **New story 17.21** MDA parent/child taxonomy |
| #47 | Absorbed into 17.17 (drill-down of Difference column) + 17.20 (re-attribution UX) |
| #48 | Absorbed into 17.7 Loan Detail Page (timeline is a tab) |

**Pattern findings → team agreements:** Patterns 1, 2 → Agreements 15, 16. Pattern 3 → Absorbed into 17.13 content validation + test setup. Pattern 4 → Agreement enforced via 17.0 lint ratchet. Pattern 5 → Existing red-green review agreement extended.

### 4.5 MVP / Go-Live redefinition

**Revised MVP:**
- Epics 1–11, 14, 15-prep, 15.1 complete ✅ (already shipped)
- Epic 17 complete — all 34 stories + BIR pilot cycle with zero CRITICAL findings
- Epic 12 original 3 stories complete (Early Exit basic workflow)
- Scheme Secretariat policy clarifications received (17.31) and implemented
- Deputy AG authorisation of go-live

**Explicitly deferred post-MVP (enhancement epics):**
- Epic 15 core (rescoped, post-E17)
- Epic 16 core (rescoped, post-E17)
- Epic 9 Notifications
- Phase 2 features: staff self-service profile view, Raise Concern intake, additional analytics

**Go-live criteria:**
- BIR pilot: one full reconciliation cycle completed, dual-truth figures reviewed by AG, zero CRITICAL findings
- Empirical variance-contamination rate from discovery spike (Q6) below threshold TBD by AG
- External-auditor read-only role demonstrated
- Overdeduction refund workflow exercised end-to-end (at least one case through full state machine)
- Runbook for operations staff documented
- Pre-positioned comms plan for press/political exposure

---

## Section 5 — Holistic Impact on Existing Epics

Detailed by epic — read this section for "what does Epic 17 change about what we've built?"

| Epic | Impact | Specific changes Epic 17 introduces |
|---|---|---|
| **E1 Foundation** | EXTEND | New audit-log categories (re-attribution, identity merges, Path 3 events, overdeduction approvals); new `EXTERNAL_AUDITOR` role; standard-format export capability |
| **E2 Loan Data** | EXTEND | `loans` gains `person_key` FK, fingerprint columns, `attribution_history` FK. Status enum extends with `SETTLED_LUMP_SUM`, `IN_VARIANCE_REVIEW`, `PENDING_BANK_RECONCILIATION`, `OVERPAYMENT_ADJUDICATION`. Ledger untouched. |
| **E3 Data Migration** | MODIFY | Side-quest utilities ported (17.2). Master Beneficiary Ledger seeds `persons` table (17.3). Observation engine extends with new types. Migration dashboard absorbs dual-truth. |
| **E4 Executive Dashboard** | MODIFY | Every tile rewritten for dual-truth (17.17). Drill-downs extend with re-attribution audit feed (17.20). MDA Compliance adds data quality KPI. Difference column surfaces per-MDA contamination. |
| **E5 MDA Submission** | EXTEND | Content validation gate prepended (17.13). PRP triggered on commit (17.12). Submission confirmation shows dual-truth impact: "This submission moves N to CLEAN, M to VARIANCE_REVIEW." |
| **E6 Reports** | EXTEND | Every report gains Reconciled / Pending annotation. New report: Data Quality Trend per-MDA. New report: Overdeduction Cases Monthly Summary (AG-facing governance KPI). PDF footer adds audit methodology. |
| **E7 Exception Management** | MODIFY | Exception Queue + Review Queue merge (17.6). Exception types extended. MetricHelp glossary extended for truth-state vocabulary. |
| **E8 Auto-Stop Certificate** | EXTEND | Certificate preconditions tighten (17.27) — no auto-issue on inferred-complete. Certificate-with-comment pattern + versioning + supersede chain (17.28). Path 3 settlements can trigger auto-stop. Certificate Design Preview for role collaboration (17.29). |
| **E10 Temporal Profile** | LEVERAGE | `employment_events` gains `LUMP_SUM_SETTLEMENT`, `DEATH_IN_SERVICE`. Gratuity computation unchanged. Retiree verification report absorbs dual-truth. |
| **E11 Pre-Submission** | EXTEND | Mid-cycle events extend to Path 3. Pre-submission checkpoint becomes truth-state aware. Old per-submission reconciliation stays; PRP is new cross-time engine. |
| **E14 Public Website** | EXTEND (minor) | Public certificate verification page extends to render supersede chain (Story 17.28) — current version highlighted, prior versions accessible with supersede reason. Small schema addition to verification endpoint response; UI update to verification page component. |

---

## Section 6 — Post-Epic 17 Restructure of Remaining Epics

### Epic 15 (Beneficiary Onboarding) — reshape

**Pre-E17:** 15.2, 15.3, 15.4, 15.5, 15.6 = 5 core stories
**Post-E17:**
| Story | Decision | Rationale |
|---|---|---|
| 15.2 fuzzy name matching engine | **RETIRE** | Fully subsumed by 17.4 PersonIdentityService |
| 15.3 monthly onboarding scan | **RESCOPE (smaller)** | Consumes 17.12 PRP + 17.14 truth-state; thin wrapper |
| 15.4 onboarding pipeline dashboard/report | **KEEP** | Extends 17.17 dual-truth for onboarding-specific view |
| 15.5 retirement/deceased verification | **RESCOPE** | Depends on 17.9 lifecycle detector + 17.31 death-in-service policy + 17.32 external-auditor role |
| 15.6 attention items observation integration | **RESCOPE (smaller)** | Consumes 17.14 truth-state; simpler than originally specified |

**Net: 5 → 4 stories, roughly half the effort.**

### Epic 16 (Cross-Month Data Integrity) — reshape

**Pre-E17:** 16.1, 16.2, 16.3, 16.4 = 4 core stories
**Post-E17:**
| Story | Decision | Rationale |
|---|---|---|
| 16.1 cross-month diffing engine | **DRAMATICALLY SMALLER** | PRP (17.12) + snapshots (17.15) + attribution history (17.8) do ~80% of planned work |
| 16.2 anomaly resolution + event context | **RESCOPE** | Consumes 17.14 truth-state; may merge with Review Queue or stay distinct |
| 16.3 cross-month dashboard drilldown | **EXTEND 17.17** | Cross-month tab becomes dashboard variant, not separate surface |
| 16.4 portfolio stability metrics | **KEEP MOSTLY** | Consumes 17.15 snapshots; own analytics layer |

**Net: 4 → 3 stories, with 16.1 shrinking materially.**

### Epic 13 (Staff ID Governance) — RETIRE

13.3 and 13.4 fully subsumed by Epic 17. Epic 13 retires.
Stakeholder notification: "Staff ID Governance capability moved to Epic 17 Identity layer — same capability, different home."

### Epic 12 (Early Exit) — restore to original scope

Previous proposal inflated E12; consolidation into Epic 17 restores original 3-story scope (12.1, 12.2, 12.3).

### Epic 9 (Notifications) — unchanged scope

Enhanced by Epic 17 events (re-attribution, handshake candidates, Path 3 confirmation, overdeduction approvals) but not restructured.

---

## Section 7 — Retrospective Cadence and Governance Principles

### Retrospective cadence — 3 retros

| Retro | Trigger | Coverage | Purpose |
|---|---|---|---|
| **Retro 1: Foundation** | After Epic 17 K-gate (BIR pilot complete) | E15 Prep (15.0a–15.0n) + Multi-MDA UAT 2026-04-12 + Epic 17 (all 34 stories) | Captures foundational learning: architectural redirect, audit-driven design, three-gate model, PRP discovery, pilot cycle |
| **Retro 2: Enhancement Cycle** | After E15 core + E16 core ship post-E17 | E15 core (rescoped) + E16 core (rescoped) | How enhancement epics landed on Epic 17 foundation — friction, surprises, simplification |
| **Retro 3: Go-Live Meta** | At authoritative go-live (all MDAs on dual-truth production) | Whole project end-to-end, including architectural redirect's timeline and stakeholder impact | Governance-level; political/stakeholder/communication lessons |

### Governance principles (architectural commitments)

| Principle | Detail |
|---|---|
| **App is source of truth** (Agreement 22) | Bank statements, MDA reports, external docs corroborate; do not override. Every authoritative figure defensible from the app alone. |
| **AG sole approval for refunds** | No dual-signature, no threshold-based variation. Deputy AG has identical authority in AG absence. Dept Admin surfaces cases and confirms payment post-approval only. |
| **Dept Admin escape hatch with audit** (Agreement 21) | Every engine-enforced gate has a human override pathway. Engine proposes, humans dispose. Override rate per MDA is a governance KPI. |
| **Non-punitive language** (existing team agreement) | "Variance" not "Discrepancy"; "For review" not "Flagged"; amber/grey only, no red badges. Extends to `<VarianceBadge>` component. |
| **Observation-direction explicit** | Every variance surfaces with direction (↓ Outstanding to scheme / ↑ Refund due to staff / ⚠ Pending classification). No ambiguous variance-without-direction. |
| **No detection thresholds** | Overdeduction detection captures every ₦1. Thresholds apply only at the authorisation layer (AG approval can be structured), never at detection. |
| **Audit before authority** (Agreement 17) | AG-facing figures must pass structured single-beneficiary audit before publication. |
| **Pilot before portfolio** (Agreement 20) | Engine changes affecting authoritative figures ship as single-MDA pilot for one cycle before expansion. |
| **Dual-truth by default** (Agreement 19) | Reconciled / Pending Review / Difference rendering for every authoritative figure. Single-number publication requires explicit PO sign-off. |
| **Order-independent reconciliation** | Engine output is a function of input set, not input order. Property-tested via N! permutation test. |
| **Append-only audit despite mutable re-attribution** | `loan.person_key` is mutable; every change writes immutable row to `loan_attribution_history`. Historical state always reconstructable. |
| **CRITICAL finding, defined precisely** | A finding is CRITICAL if and only if any of: (a) the app publishes a figure the AG cannot defend in writing, (b) the append-only audit invariant is broken, (c) an overdeduction refund is allowed without AG approval. Anything else is HIGH/MEDIUM and does not gate pilot sign-off or go-live expansion. Prevents the binary "zero CRITICAL" gate from creating implicit pressure to downgrade legitimate findings. |

---

## Section 8 — Implementation Handoff

### Scope classification: MAJOR — fundamental replan
Per correct-course workflow taxonomy: MAJOR requires PM/Architect involvement.

### Handoff plan

| Role | Agent | Responsibility | Deliverable |
|---|---|---|---|
| Product Manager | John | Update PRD for Epic 17 FRs + NFRs. Communicate to stakeholders. | Updated `prd.md` + Deputy AG briefing pack (PDFs delivered) |
| Solution Architect | Winston | Design three-gate pipeline, PRP, schemas, truth-state model, certificate versioning, overdeduction state machine. Update architecture doc. | Updated `architecture.md` + component + sequence diagrams |
| Product Owner | Alice | Approve revised MVP and go-live criteria. Rescope 15.3–15.6 and 16.1–16.4. Validate Epic 17 story decomposition. | Approved revised MVP + validated Epic 17 stories |
| Scrum Master | Bob | Update `sprint-status.yaml`. Schedule Epic 17 kickoff + three retros. | Updated sprint-status + scheduled sessions |
| UX Designer | Sally | Design dual-truth patterns, Review Queue UI, Loan Detail Page, `<VarianceBadge>`, Pre-Ingest Preview, Certificate Design Preview, Overdeduction queues. | Updated `ux-design-specification.md` + wireframes |
| Scheme Secretariat (external) | Awwal to liaise | Clarify: concurrent-loan policy, death-in-service handling, currency-adjustment history, statute-of-limitations for write-off, overdeduction refund pathway, external-auditor role definition | Written scheme-rule clarifications |
| Deputy AG / AG Office | Awwal to brief | Review PDFs, decide on pause-for-ICR-track recommendation, authorise pilot with BIR | Written authorisation |

### Success criteria

**For this SCP:** Awwal approved (2026-04-15) ✅. Deputy AG briefed with both PDFs within 7 days. `sprint-status.yaml` updated per Section 4.2. Epic 17 added to `epics.md`. PRD, Architecture, UX Spec updates scheduled.

**For Epic 17:** Discovery spike completes with empirical answers to Q1–Q8. Idempotency property test passes against Alatise + Lamidi + ADELEKE + CDU fixtures (24 permutations = identical state). BIR pilot cycle completes with zero CRITICAL findings. Dual-truth figures reviewed and accepted by AG.

**For go-live:** All MVP criteria met. External-auditor read-only access demonstrated. Runbook for operations staff documented. Pre-positioned comms plan.

### Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Deputy AG rejects pause recommendation | Medium | High | PDFs frame as "pause-commission-pilot" not "cancel"; evidence concrete |
| Discovery spike reveals >50% variance contamination | Medium | High | Spike scoped to produce this answer honestly; MVP scope expands if needed |
| Operational staffing for review queues insufficient | Medium | Medium | Staffing model in spike output; ops recruitment in parallel with early stories |
| BIR pilot reveals integration issues | Low-Medium | Medium | Pilot contains blast radius; dual-truth preserves historical figures |
| AG becomes bottleneck on overdeduction approvals | Medium | Medium | Batch approval UI; Deputy AG as substitute; SLA alerting |
| Scheme Secretariat policy clarifications delayed | Medium | Medium | Work with placeholders; lock before pilot cutover |
| Team agreements degrade without enforcement | Low | Low | 17.0 lint ratchet + test-fixture CI checks provide mechanical enforcement |
| Political exposure of per-MDA data quality | Medium | High | Pre-brief affected MDAs (30-day window per MDA) before public dashboard exposure |
| Certificate versioning creates third-party verification confusion | Low | Low | Verification page clearly shows "You scanned v1. Current is v2" with context |
| PDF format variance across bank statement exports | Medium | Low-Medium | Format samples collected during 17.1 discovery spike; parser tolerates two known formats with manual-transcription fallback for others |
| Spike output orphaned (findings produced but not applied to story sizing) | Low | Medium | 17.1 deliverable binds to Alice (PO) sign-off as precondition for 17.4 / 17.8 / 17.12 / 17.25 kickoff |
| Lint ratchet causes CI-thrash on test-heavy stories | Low | Low | 17.0 splits prod-code ratchet (commit-blocking) from test-code countdown (tracking only, non-blocking) |
| FSM states stick indefinitely (PENDING_AG_APPROVAL etc.) | Medium | Medium | 17.26 SLA semantics added; expiry → attention item + escalation path (Deputy AG / AG substitution) |

---

## Section 9 — Approval and Next Steps

### Approval
**Awwal Lawal, Product Owner / Project Lead — APPROVED 2026-04-15.**

### Immediate (this week)
1. Update `sprint-status.yaml` per Section 4.2
2. Add Epic 17 stub to `epics.md`
3. Brief Deputy AG using the two PDFs + this proposal
4. Await Deputy AG written response

### Within 14 days of Deputy AG authorisation
5. PRD update (PM)
6. Architecture doc update (Architect)
7. UX spec update (UX)
8. Story 17.0 (lint ratchet, prod-code commit-blocking) kickoff — enforced from day one of Epic 17
9. Story 17.0b (DRY_RUN infrastructure) kickoff in parallel — precedes any writing engine story
10. Story 17.1 (discovery spike) kickoff
11. Retro 1 scheduled (post-Epic 17 K-gate)
12. Bank statement format samples collection begins (supports 17.24 parser — no vendor procurement needed)

### Discovery spike output (17.1) feeds
13. Empirical answers to Q1–Q8
14. Additional regression fixtures (4–6 beyond Alatise + Lamidi + ADELEKE + CDU)
15. Refined story sizing for Epic 17 core stories — **Alice (PO) sign-off on `17.1-spike-output.md` is a precondition for kickoff of Stories 17.4 / 17.8 / 17.12 / 17.25**
16. Staffing model for review queues

---

## Section 11 — Silent Build Strategy (Amendment Round 4, 2026-04-15)

**Decision:** Build Epic 17 in its entirety without Deputy AG engagement until the engine is demonstration-ready. Epic 17 completes on internal authority; external engagement (Deputy AG authorisation, Scheme Secretariat policy clarifications, BIR pilot) happens *after* the engine demonstrates correct behaviour against the signed-off regression fixtures.

**Rationale:** Walking into the Deputy AG conversation with a live, working system + regenerated audit + demonstrable dual-truth dashboard changes the narrative from "grant me permission" to "look at what's ready." Politically stronger. Technically feasible via Agreement 23 — editable placeholders for every value that would otherwise require external input.

**Operational consequences:**
- All 36 Epic 17 stories are buildable in silence. Every story that would have blocked on Scheme Secretariat policy (refund authority thresholds, concurrent-loan rules, death-in-service handling, write-off authority, SLA durations, scheme-rule history effective-dates) now ships with a **reasonable default placeholder** and an **AG-editable UI control**.
- Story 17.31 ("Scheme Policy Clarifications") is **re-scoped from a blocking prerequisite to a documentation artefact**. The engine runs on placeholders; 17.31 becomes the task of getting official values entered through the UI when Scheme Secretariat provides them.
- Story 17.34 (BIR pilot) remains the only story that genuinely requires external engagement. It becomes the **trigger for the Deputy AG conversation**, not a pre-requisite to engine completion. Stories 17.0 through 17.33 + 17.34a complete before this trigger fires.
- Story 17.34a (shadow dashboard) runs internally during the silent phase, AG+PO visible-to-Awwal-only, producing the daily divergence evidence that feeds the eventual Deputy AG brief.

**Editable-placeholder application across Epic 17 stories:**

| Story | External dependency | Placeholder strategy |
|---|---|---|
| 17.4 PersonIdentityService | Namesake frequency threshold (MDA-scoped, state-scoped) | Default: 2 within MDA, 3 state-wide. AG-editable via Admin Settings panel. |
| 17.4 / 17.5 Similarity thresholds | Band boundaries per Scheme Secretariat preference | Default per fuzzy-Jaccard spec: Jaccard 0.5 gate, Levenshtein 2 MEDIUM boundary, Levenshtein 5 NOT_MATCH boundary. AG-editable. |
| 17.9 Lifecycle zero-crossing | Dormant-period guard (months of zero before declaring new-loan) | Default: 2 months. AG-editable. |
| 17.9 Last-installment tolerance | Tolerance around zero for completion detection | Default: 1 × monthly deduction. AG-editable. |
| 17.11 Missing record detection SLA | Days before escalation to Dept Admin | Default: 14 days. AG-editable. |
| 17.14 Truth-state thresholds | Variance tolerances for CLEAN vs IN_VARIANCE | Default: ₦50 per Scheme formula tolerance. AG-editable per MDA. |
| 17.17 Dashboard Difference column warning threshold | Difference fraction above which "Portfolio in review phase" banner appears | Default: 20%. AG-editable. |
| 17.22 Path 3 walk-up settlement dual-signature threshold | Amount above which two signatures required | Default: ₦100,000. AG-editable. |
| 17.23 Unattributed Loan Endings queue — write-off authority threshold | Amount below which Dept Admin writes off; above which AG required | Default: ₦50,000. AG-editable. |
| 17.24 Bank reconciliation — scheme account details | Bank name, account number, statement format | Default: placeholder values with "Configure in Admin Settings" CTA. AG-editable. Statement parser runs on first upload regardless. |
| 17.25 Overdeduction detection | No threshold (per Awwal directive — detect every ₦1) | No placeholder needed. Hard-coded zero tolerance. |
| 17.26 Overdeduction refund workflow SLAs | PENDING_AG_APPROVAL, AWAITING_PAYMENT_CONFIRMATION, CERTIFICATE_REISSUED time-boxes | Defaults: 14, 30, 7 days. AG-editable. |
| 17.31 Scheme rule history (rate, tenure, principal caps over time) | Effective-date ranges and values per scheme rule change | Default: single rule entry with current known values (13.33% rate, 60-month base, 7-tenure set {24,30,36,40,48,50,60}), effective-from = scheme inception. AG-editable to add historical rule versions when dates confirmed. |
| 17.31 Concurrent-loan policy | Scheme rule: permitted or not | Default: NOT permitted (detection surfaces as observation). AG-editable to toggle to permitted when confirmed. |
| 17.31 Death-in-service pathway | Settlement path for death-in-service | Default: routes to AG/Deputy AG for case-by-case adjudication with policy placeholder "Pending Scheme Secretariat clarification." AG-editable. |
| 17.31 External-auditor role scope | Queryable tables and export formats | Default: read-only access to all non-PII aggregate views, standard CSV/Excel export. AG-editable role definition. |
| 17.34 BIR pilot cycle duration | Time-box for one reconciliation cycle | Default: 21 days. AG-editable. |

**Admin Settings surface:** a new screen added to Epic 17 scope (extension of Story 17.17 or new micro-story 17.17b if split becomes cleaner during implementation). Role-gated to AG / Deputy AG only. Every editable placeholder value appears here with current value, description, default value, and Save action. Changes audit-logged with before/after values and actor.

**Re-scoping Story 17.31:**
Story 17.31 is **no longer a prerequisite** for any other Epic 17 story. It transforms from "wait for Scheme Secretariat to provide values" to "UI + data model for receiving values when available." The placeholder values ship, the UI exists, Scheme Secretariat engagement populates real values when Awwal schedules it.

**Go-live readiness definition:**
Epic 17 reaches **demonstration-ready** when Stories 17.0 through 17.33 + 17.34a are complete (all 35 stories). Story 17.34 (BIR pilot) is the only remaining story at that point. Demonstration-ready is the internal signal that external engagement can begin.

**Go-live readiness gate (unchanged):**
Authoritative go-live requires Story 17.34 (BIR pilot cycle complete with zero CRITICAL findings as precisely defined in Section 7). Deputy AG authorisation for BIR pilot engagement is obtained *after* demonstration-ready, not before.

## Section 10 — Supporting Evidence

- `docs/Car_Loan/analysis/reports/alatise-detailed-audit-report.pdf` — Alatise forensic audit (51 records, 4 signatures, 8 observations)
- `docs/Car_Loan/analysis/reports/alatise-deputy-ag-summary.pdf` — one-page Deputy AG brief
- `_bmad-output/implementation-artifacts/uat-findings-2026-04-12.md` — Multi-MDA UAT running document (53 findings, per-finding status)
- `_bmad-output/planning-artifacts/decision-log-2026-04-15.md` — Session decision log (scannable chronological record)
- `scripts/legacy-report/alatise-pdf-reports.tsx` — PDF regenerator
- `scripts/legacy-report/alatise-bosede-focused.ts` — single-beneficiary trace
- `scripts/legacy-report/completion-evidence-check.ts` — Lamidi + Alatise + BIR fragmentation scan
- `scripts/legacy-report/WAKEUP.md` — side-quest context (engine capabilities + known issues)
- Memory records: `project_scp_2026_04_15.md`, `project_alatise_lamidi_fixtures.md`, `feedback_app_as_source_of_truth.md`, `feedback_team_agreements_epic17.md`, `domain_overdeduction_pattern.md`
- Deputy AG briefing HTML: `docs/Car_Loan/analysis/reports/alatise-deputy-ag-summary.html` (print-to-PDF)
- Detailed audit HTML: `docs/Car_Loan/analysis/reports/alatise-detailed-audit-report.html` (print-to-PDF, 6 pages)

---

**End of proposal. APPROVED 2026-04-15.**
