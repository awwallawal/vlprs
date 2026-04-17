---
status: DRAFT — SUPERSEDED (preserve only)
title: Sprint Change Proposal — Addendum 1 to SCP 2026-04-15 (Draft)
subtitle: Epic 17 Empirical Validation and Refinement via Reconciliation Inventory Exercise
date_drafted: 2026-04-16
author: Awwal Lawal (Product Owner / Project Lead), with engineering support
parent_scp: sprint-change-proposal-2026-04-15.md (approved 2026-04-15)
scope_classification: MINOR — Epic 17 story refinements, no architectural redirect
proposed_status_at_drafting: APPROVED PENDING — awaiting PM/PO/Architect/UX sign-off
provenance:
  source_file: C:\Users\DELL\Desktop\vlprs\error.txt (running transcript — DO NOT MODIFY)
  source_line_range: ~1440–1938 (second of two near-duplicate occurrences in transcript)
  extracted_by: Claude (auto-memory session, 2026-04-17)
  extraction_principle: verbatim semantic preservation — markdown reconstruction of terminal-rendered tables; no edits to substantive content
  destruction_policy: error.txt is not modified; this file is a clean copy for archival
supersedes: null
superseded_by:
  planned: post-inventory consolidated Addendum 1 (to be drafted after VLPRS-Reconciliation-2026-04-18 v2 generation + LESSONS_LEARNED extraction)
  status_when_published: This draft will be marked as superseded; this file remains in drafts/ as the historical reasoning record
house_rule_notes:
  - This draft contains time/effort estimates ("+1 day", "1-day task") preserved verbatim from the original transcript.
  - Per house rules, time estimates MUST be removed in the published consolidated Addendum.
  - Proposals here SHOULD be re-validated against v2 empirical data before publication.
  - The story-count math in §2 ("34 → 33") was correct at draft time. Post-Round-5 baseline (which added 17.3b MDA Payroll Snapshot) shifts the math to "37 → 36"; consolidated Addendum will reconcile this.
---

# Sprint Change Proposal — Addendum 1 to SCP 2026-04-15 (Draft, Superseded)

> **Status banner:** This is the **archived original draft** of Addendum 1, written 2026-04-16 from v1 Reconciliation Inventory data only (`reconciliation-inventory-2026-04-16/`). It is preserved here to maintain the reasoning chain. The **published** Addendum 1 will be a *consolidated* document drafted post-v2 (after `VLPRS-Reconciliation-2026-04-18` generates and `LESSONS_LEARNED.md` is produced) and will supersede this draft. Some proposals here may be revised, dropped, or extended once v2 register data lands.

## Epic 17 Empirical Validation and Refinement via Reconciliation Inventory Exercise

- **Date:** 2026-04-16
- **Author:** Awwal Lawal (Product Owner / Project Lead), with engineering support
- **Parent SCP:** `sprint-change-proposal-2026-04-15.md` (approved 2026-04-15)
- **Scope classification:** MINOR — Epic 17 story refinements, no architectural redirect
- **Status (at drafting):** Proposed for review by Bob (SM), Alice (PO), John (PM), Winston (Architect), Sally (UX)

---

## Section 1 — Issue Summary

### Trigger

A Reconciliation Inventory exercise was conducted 2026-04-16 as a pre-Epic-17 forensic catalogue of the side-quest data (74,138 deduplicated records from 373 source files across 46 MDAs, `docs/Car_Loan/analysis/foundation/catalog.json`). The exercise executed a four-pass pipeline that materially parallels the Epic 17 17.12 PRP design:

- **Pass 0:** Content-level MDA verification (opens each source sheet, re-runs the 3-layer MDA resolver against title rows, compares to catalog attribution)
- **Pass 1:** Per-record variance classification (11 classes, 5 severity tiers)
- **Pass 2:** Per-person signature decomposition + cross-MDA continuity testing
- **Pass 3:** Three-audience rendering (AG brief, external auditor methodology, full traceback) + per-staff drill-down (3,216 HTML pages)

### Outputs produced

- `reconciliation-inventory-2026-04-16/RECONCILIATION_INVENTORY_AG.html` — Deputy AG brief
- `reconciliation-inventory-2026-04-16/RECONCILIATION_INVENTORY_AUDITOR.html` — External auditor methodology
- `reconciliation-inventory-2026-04-16/RECONCILIATION_INVENTORY_FULL.html` — Traceback with provenance
- `reconciliation-inventory-2026-04-16/by-mda-staff/` — Drill-down: top-level index → per-MDA index → per-staff detail (3,216 pages)
- `reconciliation-inventory-2026-04-16/variance-catalogue-v1.json`, `cross-mda-signature-report-v1.json`, `content-verification-v1.json`
- `reconciliation-inventory-2026-04-16/DELTA_AUDIT.md` — comparison against existing `staff-variances/` (closing a 411-staff detection gap via BALANCE_INCREASE port)
- `reconciliation-inventory-2026-04-16/METHODOLOGY.md` with catalog + script SHA-256 for reproducibility

### Empirical findings relevant to Epic 17

| Finding | Count | Epic 17 implication |
|---|---|---|
| Staff who accessed the scheme (normalized-name candidates) | 4,926 | New headline metric for 17.17 dashboard |
| Persons with at least one principal-recorded record | 4,209 | MISSING_PRINCIPAL as new variance class |
| Distinct loan signatures | 7,576 | Validates signature primitive in 17.8 |
| Cross-MDA persons | 1,085 | Review Queue volume estimate |
| Variances classified | 40,062 | ₦-weighted severity required for 17.17 |
| Cross-MDA continuity cases | 358 | 5 distinct verdicts, not 2 |
| OVERLAPPING_MDA_PRESENCE verdict cases | 53 | Class not in current Epic 17 17.4 |
| MDA_ATTRIBUTION_DISAGREEMENT sheets | 14 | Requires pre-Epic-17 remediation + ingest-time gate |
| Alatishe forensic confirmation | 4 signatures, overlap verdict | Confirms user hypothesis ("₦450K BIR/CSC transfer") NOT supported by data |

### Issue type

Empirical validation with gap identification. The exercise confirmed most of Epic 17's architecture is correct (sequential three-gate pipeline, severity stratification, signature decomposition, idempotency by construction). It also surfaced specific gaps in story specifications that were not visible until running the pipeline end-to-end over full catalog data.

### Problem statement

The original SCP 2026-04-15 specified Epic 17 from design principles and domain knowledge. The Reconciliation Inventory exercise ran the equivalent pipeline against production-scale data. Several stories are now revealed to be under-specified (17.4 cross-MDA verdicts), over-fragmented (17.17/19/20/21 all extend the same surface), or missing production-critical detail (17.2 content-level verification needs to be a hard ingest gate, not just a backfill tool). Without these refinements, Epic 17 risks shipping a pipeline that technically works but doesn't handle the empirical shape of the data.

---

## Section 2 — Impact Summary

### Epic 17 story changes

| Action | Story | Summary |
|---|---|---|
| AMEND | 17.2 | Add "content-level MDA verification at ingest as hard gate" |
| AMEND | 17.4 | Enumerate 5 cross-MDA verdicts explicitly (adding OVERLAPPING_MDA_PRESENCE); add bidirectional signature test |
| AMEND | 17.5 | Specify handling for overlap-MDA distinct from transfer |
| NEW | 17.6a | Review Queue capacity planning + routing rules |
| AMEND | 17.8 | Externalize signature tolerance bands to `scheme_config` |
| AMEND | 17.9 | Add BALANCE_INCREASE and BALANCE_DECREASE_BEYOND_MONTHLY variance classes; add MISSING_PRINCIPAL |
| AMEND | 17.10 | Broaden scope from tenure-only to all CRITICAL + HIGH classes |
| AMEND | 17.12 | Add explicit dry-run mode |
| MERGE | 17.17 | Absorbs 17.19, 17.20, 17.21 (all same surface). Also: add Scheme Participation tile block + ₦-weighted severity metrics |
| RETIRE | 17.19 | Merged into 17.17 |
| RETIRE | 17.20 | Merged into 17.17 |
| RETIRE | 17.21 | Merged into 17.17 |
| AMEND | 17.33 | Carry input + engine SHA-256 hashes on every output |
| NEW | 17.33a | Quarterly Reconciliation Inventory auto-regeneration + diff-to-previous view |

**Net change (as drafted):** 34 stories → 33 stories (−3 merged + 2 new).

> **House note:** At time of drafting, baseline was 34 stories. Post-Round-5 baseline (with 17.3b MDA Payroll Snapshot added) is 37 stories. Post-amendment count is therefore 37 → 36. The consolidated published Addendum will reconcile this.

### Artifact impact

- **PRD:** add FR — Scheme Participation Headline, FR — MDA Attribution Verification at Ingest, extend FR85 (fuzzy matching) to include namesake frequency lookup, extend variance class enumeration in FR87 to include BALANCE_INCREASE, BALANCE_DECREASE_BEYOND_MONTHLY, MISSING_PRINCIPAL, MDA_ATTRIBUTION_DISAGREEMENT. Update go-live criteria to reference ₦-weighted severity thresholds.
- **Architecture:** extend persons schema with `name_frequency` materialized view. Extend `scheme_config` with tolerance parameters (`interest_tolerance`, `monthly_tolerance`, `math_tolerance`, `signature_monthly_rounding_bucket`, `outstanding_continuity_tolerance_pct`). Document bidirectional cross-MDA signature test. Document 5-verdict enumeration. Document hash-carrying invariant for all engine outputs.
- **UX Design:** add `<ActionGuidance>` component spec. Add Scheme Participation tile block spec. Standardize print-ready A4 layout across all report surfaces. Audit severity palette for non-punitive compliance (CRITICAL badge currently red-tinted).
- **Sprint-status.yaml:** 34 → 33 stories; update story IDs; add 17.6a and 17.33a.

### Regression fixture expansion

Epic 17's regression suite should absorb the Reconciliation Inventory outputs as canonical fixture set:

- 3,171 staff with variances (property-test PRP idempotency via 24-permutation sampling)
- 358 cross-MDA cases (regression coverage for 17.4/17.5 verdict classifications)
- 14 MDA attribution disagreement sheets (regression coverage for 17.2 ingest gate)
- Alatishe (51 records, 4 signatures, OVERLAPPING verdict) and Lamidi (36 records, overdeduction) remain canonical individual fixtures

---

## Section 3 — Detailed Amendments (per story)

### 17.2 — Port side-quest utilities to production [AMEND]

**Current scope:** Port name-match, mda-resolve, number-parse, column-map, header-detect, period-extract utilities into server codebase.

**Amended scope:** Above + content-level MDA verification at ingest as hard gate. At upload time, server reads first 5 title rows of each sheet, runs the 3-layer MDA resolver, compares to the MDA attribution derived from filename/column. Disagreement routes the entire upload to the Review Queue with MDA_ATTRIBUTION_DISAGREEMENT class attached to affected records. Upload cannot commit until Dept Admin confirms or corrects the attribution.

**Rationale:** Exercise found 14 silent mis-attributions out of 1,607 sheets (0.87%). At projected 1,000 uploads/month, ~9 silent mis-attributions/month would enter the portfolio without human detection. Inherited 1,432 records of silent corruption into the AG dashboard.

**Effort impact:** +1 day (API endpoint extension + Review Queue routing logic). *[Verbatim from draft; remove per house rules in consolidated Addendum.]*

---

### 17.4 — PersonIdentityService [AMEND]

**Current scope:** Similarity bands (high/medium/low), namesake frequency guard, cross-MDA flag (no auto-link), confidence evidence persistence.

**Amended scope:** Above + enumerate 5 cross-MDA verdicts explicitly, bidirectional signature continuity test, and namesake frequency lookup against materialized `name_frequency` table (refreshed on every ingest).

**Cross-MDA verdict enumeration (required):**

| Verdict | Trigger | Routing |
|---|---|---|
| LOAN_CONTINUATION_CONSISTENT | Predicted outstanding matches declared within ±5%; gap ≥ 0 months; principal stable | File backdated Transfer Handshake |
| LOAN_CONTINUATION_VARIANT | Predicted ≠ declared beyond tolerance; gap ≥ 0 months; not fresh principal | Review Queue — manual arithmetic audit |
| FRESH_PRINCIPAL | Destination principal > predicted × 2; gap ≥ 0 months | File completion event for source loan; treat destination as new loan |
| OVERLAPPING_MDA_PRESENCE | Source lastPeriod > destination firstPeriod (signatures overlap in time) | Namesake check + MDA hierarchy review |
| AMBIGUOUS | Source or destination outstanding unavailable; test cannot resolve | Review Queue — escalate for MDA redeclaration or employment-event attestation |

**Bidirectional test:** For any person with signatures in MDAs A and B, test both A→B and B→A; tie-break by `firstPeriod` (earlier is source) OR `recordCount` (more records is source) when verdicts differ.

**Rationale:** Exercise invented OVERLAPPING_MDA_PRESENCE mid-build because Alatishe's data required it (BIR Feb 2026 ↔ CSC Jan 2025). 53 of 358 cases hit this verdict. Epic 17 treating cross-MDA as binary (transfer-or-namesake) misses this class entirely and would either auto-link a concurrent-presence case (data corruption) or leave it ambiguous (lost signal).

**Effort impact:** +0.5 day (verdict enumeration + bidirectional test logic). *[Verbatim; remove per house rules in consolidated.]*

---

### 17.5 — person_link_candidates + Pending Handshake [AMEND]

**Current scope:** `person_link_candidates` table + proactive Pending Handshake surfacing to both MDAs + Transfer Handshake wiring.

**Amended scope:** Above + distinct workflow for OVERLAPPING_MDA_PRESENCE cases. Overlap cases do NOT file Pending Handshake (they're not transfers). They route to:

1. Namesake frequency check (if name appears >N times across scheme → require namesake disambiguation UI)
2. MDA hierarchy check (if both MDAs share a `parent_mda_id` → flag as concurrent reporting, not merge)
3. Manual disposition by Dept Admin (rare residual)

**Rationale:** 53 overlap cases would be mishandled as transfer candidates if routed through the same flow. Overlap means "same person in two MDAs at the same time" — never a transfer.

**Effort impact:** +0.5 day (separate route + namesake UI spec). *[Verbatim; remove per house rules in consolidated.]*

---

### 17.6a — Review Queue capacity planning and routing rules [NEW]

**Scope:** Specification document + operational staffing model for the Review Queue implemented in 17.6.

**Deliverables:**

1. **Queue partitioning:** separate queues per verdict class (transfer-candidate, overlap-mda, arithmetic-variance, tenure-mis-record, overdeduction-refund, attribution-disagreement, ambiguous). Each queue has distinct SLA and ownership.
2. **SLA matrix:**
   - CRITICAL (overdeduction, arithmetic impossibility): AG direct adjudication within 7 days
   - HIGH (tenure mis-record, attribution disagreement, frozen template): Dept Admin within 14 days
   - MEDIUM (rate variance, math variance, balance increase): MDA Officer within 30 days, disclosure-only otherwise
3. **Staffing model:** estimate required Dept Admin + MDA Officer review-hours/month given:
   - Backfill: ~3,620 CRITICAL + ~14,602 HIGH + ~21,840 MEDIUM = ~40,062 items (one-time)
   - Steady state: estimate from post-Epic-17 pilot (Story 17.34 feeds this)
4. Escalation paths for SLA expiry (attention-item to escalation owner).
5. Reporting: monthly queue-throughput KPI per MDA (override rate per Agreement 21 "Dept Admin escape hatch").

**Rationale:** Exercise found 40,062 variances in backfill alone. Review Queue is not just a UX — it's an operational capacity question. Without staffing model, queue will silently accumulate debt.

**Effort impact:** 1 day (spec + staffing estimate). *[Verbatim; remove per house rules in consolidated.]*

---

### 17.8 — loans schema + fingerprint columns + loan_attribution_history [AMEND]

**Current scope:** Fingerprint = (`person_key`, `principal`, `first_deduction_date`, `original_tenure`).

**Amended scope:** Above + externalize tolerance bands to `scheme_config` (not hard-coded constants).

**New `scheme_config` entries (proposed):**

| Key | Default | Used by |
|---|---|---|
| `interest_tolerance_kobo` | 5000 | RATE_VARIANCE classification |
| `monthly_tolerance_kobo` | 5000 | Monthly deduction vs scheme formula |
| `math_tolerance_kobo` | 1000 | Balance identity check |
| `signature_monthly_rounding_kobo` | 10000 | Signature bucketing |
| `outstanding_continuity_tolerance_pct` | 0.05 | Cross-MDA predicted-vs-declared |
| `balance_increase_min_kobo` | 100 | BALANCE_INCREASE detection threshold |
| `principal_drift_threshold_kobo` | 100000 | New-loan-vs-same-loan discriminator |
| `frozen_template_min_periods` | 12 | FROZEN_TEMPLATE detection |

**Rationale:** Exercise hard-coded all tolerances as constants. Scheme policy clarifications (17.31) will legitimately change some of these (e.g., interest tolerance may widen to accommodate historical rounding); without config externalization, every tolerance change becomes a code change + redeploy.

**Effort impact:** +0.5 day (schema additions + engine reads from config). *[Verbatim; remove per house rules in consolidated.]*

---

### 17.9 — LoanIdentityService + lifecycle detector [AMEND]

**Current scope:** Fingerprint + outstanding-zero-crossing lifecycle + TEMPLATE_ROLLOVER_ERROR + negative-value hard-fail.

**Amended scope:** Above + three new variance classes at detector output:

1. **BALANCE_INCREASE** — Period-over-period outstanding delta ≥ `balance_increase_min_kobo` with principal change < `principal_drift_threshold_kobo`. Severity: MEDIUM default, HIGH if delta > ₦50K. (Ported from existing staff-variances pipeline; observed 2,112 instances in 3,171 staff during exercise.)
2. **BALANCE_DECREASE_BEYOND_MONTHLY** — Period-over-period outstanding delta MORE NEGATIVE than declared monthly deduction. Signals: (a) Path 3 lump-sum settlement (legitimate — but event must be filed); (b) data error; (c) off-book payment. Route to Unattributed Loan Endings queue (Story 17.23). Severity: HIGH.
3. **MISSING_PRINCIPAL** — Person has ≥1 record in catalog but no record with a recorded principal amount. Indicates roster entry without loan-grant detail. Severity: MEDIUM. (717 persons observed in exercise — the 4,926 − 4,209 gap.)

**Rationale:**
- BALANCE_INCREASE port closed a 411-staff detection gap vs existing staff-variances (validated in delta audit).
- BALANCE_DECREASE_BEYOND_MONTHLY is the inverse of BALANCE_INCREASE and is the primary signal for identifying Path 3 settlement candidates at ingest, feeding Story 17.23 Unattributed Loan Endings queue directly.
- MISSING_PRINCIPAL separates "loan accesser with complete record" from "roster-only entry" — the AG headline distinguishes these and current Epic 17 does not.

**Effort impact:** +1 day (three new classifiers + test coverage). *[Verbatim; remove per house rules in consolidated.]*

---

### 17.10 — Most Likely Explanation suggestion engine [AMEND]

**Current scope:** Propose most probable cause for variance correction (narrow: tenure mis-recording example).

**Amended scope:** Cover all CRITICAL + HIGH variance classes with specific remedial suggestions:

| Variance class | Suggested correction narrative |
|---|---|
| TENURE_MIS_RECORDING | "Monthly deduction ₦X on principal ₦Y is consistent with T-month tenure. Declared tenure: D months. Likely correction: update installment count to T." |
| CUMULATIVE_OVERDEDUCTION | "Cumulative deducted ₦X exceeds scheme total ₦Y for this loan. Overdeduction ₦Z requires AG refund workflow. Certificate-with-comment applies if completion certificate already issued." |
| ARITHMETIC_IMPOSSIBILITY | "Installments paid P exceeds tenure T. Either tenure was mis-recorded (see TENURE_MIS_RECORDING if applicable) or cumulative overdeduction — see CUMULATIVE_OVERDEDUCTION." |
| BALANCE_INCREASE | "Outstanding increased from ₦X to ₦Y with principal unchanged. Likely cause: interest accrual on stalled loan / MDA template recalculation / data entry error. No scheme-level action required unless pattern repeats." |
| BALANCE_DECREASE_BEYOND_MONTHLY | "Outstanding dropped by ₦X, more than declared monthly ₦Y. Likely Path 3 lump-sum settlement — file LUMP_SUM_SETTLEMENT event with receipt reference. If no receipt, flag for fraud review." |
| OVERLAPPING_MDA_PRESENCE | "Person recorded concurrently in MDA A and MDA B. Namesake frequency for this name: N. If N>threshold → probable namesake. If both MDAs share parent → probable hierarchical presence. Else: Dept Admin adjudication." |
| MDA_ATTRIBUTION_DISAGREEMENT | "Content-level resolver identified MDA Z based on sheet title rows; catalog attributes to MDA Y. Likely correction: move the file to Z's folder OR correct the catalog." |

**Rationale:** Exercise surfaced that tenure-only suggestions miss the 5+ other patterns that dominate the variance population. Broadening this scope is a direct improvement to Dept Admin/AG workflow quality.

**Effort impact:** +1 day (7 suggestion patterns vs 1). *[Verbatim; remove per house rules in consolidated.]*

---

### 17.12 — Person Reconciliation Pass (PRP) [AMEND]

**Current scope:** Set-based, idempotent, per-person recompute. Triggered by upload/correction/handshake.

**Amended scope:** Above + explicit `DRY_RUN=true` mode. When set:

- PRP executes all passes against the proposed input set
- Produces diff report: "what would change" vs current persisted state
- Emits no writes, no audit entries, no Review Queue mutations
- Returns full projected state for inspection

**Use cases enabled:**

- Pre-commit preview: officer sees N new persons, M continuations, K new loans, F flags before upload commits
- Policy tuning: Dept Admin can test "what would PRP do if we change tolerance X?" without impacting prod
- Scheme rule changes: Scheme Secretariat (17.31) can preview impact of proposed policy before authorisation

**Rationale:** Exercise runs are implicitly dry-runs (rerunning with different catalog doesn't persist anything). Production PRP must make this explicit — otherwise every tolerance change requires a full PRP execution on prod with risk.

**Effort impact:** +0.5 day (mode parameter + early-exit logic + diff report). *[Verbatim; remove per house rules in consolidated.]*

> **Cross-reference:** This proposal partially overlaps with the existing Story 17.0b (DRY_RUN infrastructure, added in earlier SCP amendment round). The consolidated Addendum should reconcile whether 17.12's dry-run is a separate amendment or an instance of the broader 17.0b mode.

---

### 17.17 — Dual-truth dashboard [AMEND + MERGE]

**Current scope:** Reconciled / Pending Review / Difference rendering per tile. Absorbs UAT findings #8, #40, #47.

**Amended scope:** Above + merge 17.19 (pre-ingest aggregated preview), 17.20 (re-attribution UX), 17.21 (MDA parent/child taxonomy — UI surface) INTO 17.17. Rationale: all three extend the same dashboard data model; separating them fragmented the story.

**Additional scope for 17.17:**

1. **Scheme Participation tile block** at dashboard top: 4 tiles showing distinct persons, with-principal, distinct signatures, cross-MDA persons. Recommended headline narrative inline.
2. **₦-weighted severity metrics** alongside count metrics. Tile shows both "3,620 CRITICAL variances" and "₦X total exposure at CRITICAL". ₦-weighting becomes the governance KPI; count becomes the operational KPI.
3. **Re-attribution feed panel** (formerly 17.20): scrollable log of the last 30 re-attributions with before/after, owner, reason, timestamp. Click-through to affected records.
4. **Pre-ingest preview** (formerly 17.19): pre-commit modal showing "N new persons, M continuations, K new loans, F flags" with drill-down per class.
5. **MDA parent/child surface** (formerly 17.21): hierarchy view in MDA scorecard where applicable (e.g., CDU rolls into Agriculture parent row).

**Stories 17.19, 17.20, 17.21:** RETIRED.

**Effort impact:** Net −1 day (merge eliminates context-switching between 3 stories that all touch the same files). *[Verbatim; remove per house rules in consolidated.]*

> **House note:** Story 17.21 (MDA Autonomy Model) was already amended in SCP 2026-04-15 to be metadata-only (`is_autonomous` BOOLEAN + `reporting_parent_mda` NULLABLE). The merger here is the dashboard surface for that metadata, not the data model itself. Consolidated Addendum should clarify scope boundary.

---

### 17.33 — Retroactive backfill [AMEND]

**Current scope:** Route 74,138 catalog records through PRP. Human-gated sign-off before cutover. Dry-run + preview + rollback.

**Amended scope:** Above + carry input catalog SHA-256 and engine script SHA-256 on every output row. Every `loan_attribution_history` entry, every `audit_log` entry, every dashboard snapshot references the engine version that produced it. Reruns are diff-able by hash.

**Rationale:** External auditor (17.32 read-only role) needs to independently verify any figure in the system by rerunning against the same input. Without hash traceability, verification is opaque. The exercise proved this pattern works (catalog + script SHA-256 carried through all outputs).

**Effort impact:** +0.5 day (schema addition + engine instrumentation). *[Verbatim; remove per house rules in consolidated.]*

---

### 17.33a — Quarterly Reconciliation Inventory auto-regeneration [NEW]

**Scope:** Make the Reconciliation Inventory a recurring quarterly artefact, not a one-shot pre-Epic-17 output.

**Deliverables:**

1. Scheduled cron (quarterly) that regenerates the full inventory
2. Diff view against previous quarter's version: "CRITICAL count: 3,620 → 3,412 (−208) / 5.7% reduction" etc.
3. Published to AG as a "scheme health heartbeat" with declining CRITICAL count as the improvement metric
4. Governance KPI dashboard: per-MDA CRITICAL trend (are MDAs getting worse or better?)
5. Versioned output with diff-to-previous. Each version carries engine SHA-256 so diffs attribute changes to either data or rule changes.

**Rationale:** The exercise produced v1. Without a recurring mechanism, this is a one-shot artefact that will be stale within weeks. With it, the Inventory becomes a governance heartbeat and the data quality improvement signal the AG can track.

**Effort impact:** 2 days (cron + diff view + AG dashboard integration). *[Verbatim; remove per house rules in consolidated.]*

---

## Section 4 — Urgent Pre-Epic-17 Action

### Immediate remediation: 14 MDA attribution disagreement sheets

The exercise's Pass 0 content-level verification identified 14 sheets whose catalog MDA attribution disagrees with their own title-row content. These 14 sheets contain ~1,432 records silently attributed to the wrong MDA in the existing catalog.

**Action (pre-Epic-17, 1-day task for Dept Admin or Awwal):**

1. Open `reconciliation-inventory-2026-04-16/RECONCILIATION_INVENTORY_FULL.html` → "Content-Level MDA Attribution Disagreements" section
2. For each of the 14 sheets: manually open the source file, verify the true MDA from the content
3. Update `docs/Car_Loan/` file organization OR `utils/mda-resolve.ts` HUMAN_OVERRIDES to correct
4. Rerun `scripts/legacy-report/reconciliation-inventory-build.ts` to verify 0 disagreements

**Rationale:** Epic 17 17.2 will catch these at ingest going forward. But existing catalog data has silent corruption that Epic 17 won't backfill-correct without explicit intervention. Ship this fix now, before Epic 17 cutover.

> **Status update (2026-04-16):** Partial first-pass remediation already applied — see `reconciliation-inventory-2026-04-16/catalog-corrections-2026-04-16.json` which corrects 5 files (3 AGRIC mis-resolved as CDU + 2 LANDS mis-resolved as BUDGET AND PLANNING). **Cluster C / AANFE-as-AGRICULTURE resolver fix is pending** — must ship before v2 rebuild or it propagates.

---

## Section 5 — Regression Fixture Set Update

The Reconciliation Inventory outputs become a canonical fixture set for Epic 17's regression coverage. Alatishe + Lamidi + ADELEKE + CDU remain named canonical fixtures; the Inventory adds statistical coverage:

| Fixture type | Count | Used by |
|---|---|---|
| Staff with variances (random 100 sampled) | 3,171 → 100 | PRP idempotency property test (17.16) across 24 permutations |
| Cross-MDA continuity cases | 358 | Cross-MDA verdict classification (17.4/17.5) |
| MDA attribution disagreement sheets | 14 | Ingest gate regression (17.2) |
| Loan signatures | 7,576 | LoanIdentityService fingerprint (17.8) |
| Balance-increase cases | 2,112 | BALANCE_INCREASE classifier (17.9) |

**Action:** Add fixture references to `tests/fixtures/identity-continuity/reconciliation-inventory-2026-04-16/` with `.expected.json` artefacts for each named case class. Covered by Agreement 18 "Fixture-first for architectural tracks."

---

## Section 6 — Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Amendments expand Epic 17 effort beyond timeline | Low | Medium | Net story count drops 34 → 33 via merge of 17.19/20/21. Individual story effort deltas total ~5 days additional — absorbable. |
| Scheme-config externalization (17.8) introduces tuning surface Dept Admin could misuse | Medium | Low | Tuning requires AG approval + audit log entry per Agreement 21 "Dept Admin escape hatch with audit" |
| OVERLAPPING_MDA_PRESENCE verdict creates a new operational category that wasn't staffed | Medium | Medium | 17.6a capacity planning absorbs this |
| BALANCE_DECREASE_BEYOND_MONTHLY reveals unexpected volume of off-book / Path 3 cases | Low | Low | Exercise did not run this class; actual volume TBD at Epic 17 17.9 implementation. Staff retrospectively if volume exceeds ~500. |
| Quarterly inventory (17.33a) becomes political artefact | Low | Medium | Frame as "governance heartbeat" at launch; establish declining-CRITICAL KPI before first publication |

---

## Section 7 — Approval

### Process

1. **Bob (SM)** to review story changes and update `sprint-status.yaml`:
   - Retire 17.19, 17.20, 17.21
   - Amend 17.2, 17.4, 17.5, 17.8, 17.9, 17.10, 17.12, 17.17, 17.33 per Section 3
   - Add 17.6a, 17.33a per Section 3
2. **Alice (PO)** to review and approve amended MVP impact (marginal — net −1 story, net +5 days effort spread across 12 stories)
3. **John (PM)** to update `prd.md` with FR additions listed in Section 2
4. **Winston (Architect)** to update `architecture.md` with schema extensions (`name_frequency`, `scheme_config` additions, hash-carrying invariant, 5-verdict enumeration, bidirectional cross-MDA test, 3 new variance classes)
5. **Sally (UX)** to update `ux-design-specification.md` with `<ActionGuidance>` component, Scheme Participation tile block, severity palette audit for non-punitive compliance, A4-print-ready standardization
6. **Awwal** to execute Section 4 pre-Epic-17 remediation (14 MDA disagreement sheets) — 1 day
7. **Deputy AG brief update:** mention the Reconciliation Inventory as input to Epic 17 confidence; include Scheme Participation headline (4,926 staff / 4,209 with principal / 7,576 loans) in updated PDFs

### Proposed status (at drafting)

**APPROVED PENDING** — Awaiting PM/PO/Architect/UX sign-off per process above.

### Supporting evidence

- `reconciliation-inventory-2026-04-16/RECONCILIATION_INVENTORY_AG.html` — Deputy AG brief with headline
- `reconciliation-inventory-2026-04-16/RECONCILIATION_INVENTORY_AUDITOR.html` — Methodology
- `reconciliation-inventory-2026-04-16/RECONCILIATION_INVENTORY_FULL.html` — Full traceback
- `reconciliation-inventory-2026-04-16/by-mda-staff/` — Drill-down (3,216 pages)
- `reconciliation-inventory-2026-04-16/DELTA_AUDIT.md` — Delta vs existing staff-variances
- `reconciliation-inventory-2026-04-16/METHODOLOGY.md` — Reproducibility hashes
- `scripts/legacy-report/reconciliation-inventory-build.ts` — Pipeline source (~1,200 lines)
- `scripts/legacy-report/reconciliation-inventory-by-staff.ts` — Drill-down renderer
- `scripts/legacy-report/variance-delta-audit.ts` — Delta audit script

---

*End of Addendum 1 (Draft). Proposed for review 2026-04-16. **Superseded by post-inventory consolidated Addendum 1** (to be drafted after `VLPRS-Reconciliation-2026-04-18` v2 generation + LESSONS_LEARNED extraction). This file remains in `drafts/` as the historical reasoning record.*
