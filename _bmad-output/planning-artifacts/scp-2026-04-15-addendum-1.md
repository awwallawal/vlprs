---
title: Sprint Change Proposal — Addendum 1 to SCP 2026-04-15 (Published)
subtitle: Epic 17 Empirical Validation and Refinement via Reconciliation Inventory (v1 + v2)
date_published: 2026-04-18
author: Awwal Lawal (Product Owner / Project Lead), with engineering support
parent_scp: sprint-change-proposal-2026-04-15.md (approved 2026-04-15, post Round 5 amendments)
scope_classification: MINOR — Epic 17 story refinements, no architectural redirect
proposed_status: APPROVED PENDING — awaiting PM / Architect / UX sign-off per §7 process
supersedes:
  - _bmad-output/planning-artifacts/drafts/scp-addendum-1-draft-2026-04-16.md
evidence_chain:
  v1_catalog_sha256: fc8b5bcba4741b7e42da01288d202801e06bdb9a4aa01c0461e1edd774535c68
  v2_catalog_sha256: 4960e2735394cb04bc77406ede1d58b3aa9103d16baf5cf0e011574e8f88e114
  v1_inventory_dir: reconciliation-inventory-2026-04-16/
  v2_inventory_dir: C:\Users\DELL\Desktop\VLPRS-Reconciliation-2026-04-18\
  v2_register_hashes:
    beneficiary_collation_2024: 64e00c08261a5892636bd12d09d42c36f69f7650fcff4cc2456672423dc2d4ea
    beneficiary_collation_2025: cd7e039212ce6e43d2b47120e27cc1197c8dbc7ec5d58c13ff73518f3bde24de
    intervention_list_2024: 70a7b8c9c86c13e9f11b68f02b61aa3dca3f875f04b5151f2bb3119a8dd8e140
    retired_deceased_2025_payment: 40e6d2949c34b4807cb2e7d8be5024dc68e60cce338e9389eb1462366b9b102b
  v2_lessons_learned: VLPRS-Reconciliation-2026-04-18/LESSONS_LEARNED.md
  qa_qa_triage: VLPRS-Reconciliation-2026-04-18/qa-qa-triage-2026-04-17.md
  register_subclasses: VLPRS-Reconciliation-2026-04-18/register-exceptions-approved-no-record-subclasses.md
---

# Sprint Change Proposal — Addendum 1 to SCP 2026-04-15 (Published)

## Epic 17 Empirical Validation and Refinement via Reconciliation Inventory (v1 + v2)

- **Date:** 2026-04-18
- **Author:** Awwal Lawal (Product Owner / Project Lead), with engineering support
- **Parent SCP:** `sprint-change-proposal-2026-04-15.md` (approved 2026-04-15, post Round 5 amendments)
- **Scope classification:** MINOR — Epic 17 story refinements, no architectural redirect
- **Status:** Proposed for review by Bob (SM), Alice (PO), John (PM), Winston (Architect), Sally (UX)

---

## Section 1 — Issue Summary

### Trigger

Two Reconciliation Inventory exercises were executed against the side-quest catalogue:

- **v1 (2026-04-16)** — pre-Epic-17 forensic catalogue (74,138 records, 373 files, 46 MDAs). Outputs in `reconciliation-inventory-2026-04-16/`.
- **v2 (2026-04-18)** — post-qa_qa-triage and register-enriched regeneration (89,502 records, 449 files, 50 MDAs + authoritative registers). Outputs in `C:\Users\DELL\Desktop\VLPRS-Reconciliation-2026-04-18\`.

Both exercises executed pipelines that materially parallel the Epic 17 17.12 PRP design. v2 adds a Pass 0.5 (register cross-check) evidence layer that v1 did not have.

### Issue type

Empirical validation with gap identification. The v1+v2 exercises confirmed most of Epic 17's architecture is correct. They also surfaced specific story-level refinements and three new stories that were not visible until the pipeline was run against production-scale data enriched with authoritative scheme registers.

### Empirical findings — v1 + v2 combined

| Finding | v1 count | v2 count | Epic 17 implication |
|---|---:|---:|---|
| Catalog records | 74,138 | 89,502 | Scheme-scale baseline; feeds 17.33 backfill sizing |
| Distinct candidate persons (normalized) | 4,926 | 6,060 | 17.17 Scheme Participation tile input |
| MDAs with data | 46 | 50 | Identity namespace (+4: Water Corporation, Fire Service, Head of Service, and one more from triage) |
| Distinct loan signatures | 7,576 | (comparable) | Validates 17.8 fingerprint primitive |
| Cross-MDA continuity cases | 358 | 558 | 17.4 verdict enumeration sizing |
| OVERLAPPING_MDA_PRESENCE verdict | 53 | (TBD at v2 scale) | Not in current 17.4; addition required |
| Total variances surfaced | 40,062 | 48,518 | 17.6a Review Queue capacity +21% |
| CRITICAL variances | 3,620 | 3,840 | AG queue sizing |
| MDA_ATTRIBUTION_DISAGREEMENT sheets | 14 | 1 (post-correction) | 13 absorbed by catalog-corrections-2026-04-16; remediation workflow validated |
| Content-verification unresolved | (not tracked) | 620 (of 1,815) | 17.2 needs folder-aware fallback resolver layer |
| **APPROVED_BUT_NO_RECORD** (v2-only, Pass 0.5) | — | **1,700** | New class; sub-class decomposition below |
| **RECORD_WITHOUT_APPROVAL** (v2-only) | — | 3,290 | New class |
| **RETIRED_BUT_STILL_DEDUCTED** (v2-only) | — | **10** | **Direct AG adjudication target — pre-Epic-17 action** |
| **DECEASED_BUT_STILL_DEDUCTED** (v2-only) | — | 0 | Positive governance signal |
| Resolver silent mis-attribution (WCOS→BCOS) | — | 36 files | New variance class required: `RESOLVER_ALIAS_MISSING` |

### APPROVED_BUT_NO_RECORD sub-classification (v2)

The headline 1,700 APPROVED_BUT_NO_RECORD count decomposes empirically:

| Sub-class | Count | Share | Governance framing |
|---|---:|---:|---|
| FUZZY_MATCH_WITHIN_MDA | 296 | 17.4% | Name-variant artifact — beneficiary IS in catalog under variant spelling. Epic 17 PersonIdentityService resolves. |
| NAMESAKE_CROSS_MDA | 0 | 0.0% | No exact-match namesakes surfaced. |
| **MDA_COVERAGE_GAP** | **1,133** | **66.6%** | **MDA REPORTING GAP — the MDA has not filed returns covering the approved beneficiary's year. MDA compliance flag, not identity flag.** |
| POSSIBLE_AWAITING_DISBURSEMENT | 0 | 0.0% | Subsumed by MDA_COVERAGE_GAP ordering. |
| NO_TRACE | 271 | 15.9% | Genuine missing — AG governance red flag. |

**Headline re-framing:** Of 1,700 APPROVED_BUT_NO_RECORD, only **271 (15.9%) are true scheme-level red flags**; 66.6% are MDA reporting gaps requiring MDA escalation; 17.4% are Epic 17 PersonIdentityService targets. The flat count dramatically overstates the governance concern.

### Problem statement

The original SCP 2026-04-15 specified Epic 17 from design principles and domain knowledge. v1+v2 ran the equivalent pipeline against production-scale enriched data. Several stories are under-specified (17.4 cross-MDA verdicts, 17.2 ingest-gate resolver layers), over-fragmented (17.17/19/20/21 extend the same surface), missing production-critical detail (17.2 content-level verification as hard gate), or missing entirely (no story covers the authoritative scheme registers as an evidence layer).

---

## Section 2 — Impact Summary

### Epic 17 story changes (post-consolidation)

| Action | Story | Summary | Evidence |
|---|---|---|---|
| AMEND | 17.2 | Content-level MDA verification at ingest as hard gate; + folder-aware resolver fallback; + `RESOLVER_ALIAS_MISSING` observation on fuzzy-wins-over-absent-alias events | v1 §1 (14 disagreements) + v2 WCOS→BCOS bug |
| AMEND | 17.4 | Enumerate 5 cross-MDA verdicts explicitly (adding OVERLAPPING_MDA_PRESENCE); bidirectional signature test; namesake-frequency calibration starter bound N≥3 from catalog+register union | v1+v2 cross-MDA cases (358 → 558) |
| AMEND | 17.5 | Distinct overlap-MDA workflow (namesake check + MDA hierarchy check), not Transfer Handshake | v1 53 OVERLAPPING cases |
| NEW | 17.6a | Review Queue capacity planning + routing rules; sized to ~53,518 backfill items (48,518 variances + 5,000 register exceptions); CRITICAL bucket sized to 5,550 | v2 volume data |
| AMEND | 17.8 | Externalize signature tolerance bands to `scheme_config` (8 keys enumerated) | v1+v2 hard-coded-tolerance brittleness |
| AMEND | 17.9 | Add variance classes: BALANCE_INCREASE (MEDIUM/HIGH), BALANCE_DECREASE_BEYOND_MONTHLY (MEDIUM — demoted from HIGH), MISSING_PRINCIPAL (MEDIUM) | v1 2,112 BALANCE_INCREASE instances + v2 severity calibration |
| AMEND | 17.10 | Broaden Most Likely Explanation scope to all CRITICAL + HIGH classes, including register-driven classes | v2 LESSONS_LEARNED §8 |
| AMEND | 17.12 | Explicit `DRY_RUN=true` mode; cross-reference with 17.0b DRY_RUN infrastructure for scope alignment | v1 dry-run-by-construction observation |
| MERGE | 17.17 | Absorbs 17.19, 17.20, 17.21 (all same dashboard surface); adds Scheme Participation tile block (6-tile: catalog-participation / register-approved / overlap-confirmed / catalog-only / register-only / post-retirement-active); adds ₦-weighted severity metrics | v2 Scheme Participation Venn |
| RETIRE | 17.19 | Merged into 17.17 | SCP 2026-04-15 baseline |
| RETIRE | 17.20 | Merged into 17.17 | SCP 2026-04-15 baseline |
| RETIRE | 17.21 | Merged into 17.17 | Pre-Round-5 scope note: schema `is_autonomous` + `reporting_parent_mda` already applied in Round 3; this retire covers the UI surface only, not the data model |
| AMEND | 17.33 | Carry catalog + script SHA-256 on every output; extend to carry register-file SHA-256s for register-driven outputs | v1+v2 hash trail validated |
| NEW | 17.33a | Quarterly Reconciliation Inventory auto-regeneration + diff-to-previous view; cadence calibratable based on delta volume (v1→v2 delta demonstrated workflow) | v2 delta evidence |
| **NEW** | **17.3c** | **Scheme Beneficiary Register ingest + diff-to-catalog** (APPROVED_BUT_NO_RECORD + RECORD_WITHOUT_APPROVAL detection). Consumes COLLATION 2024 + 2025 + INTERVENTION 2024 upload pattern. | **v2 only — register evidence layer** |
| **NEW** | **17.3d** | **Employment Event Register ingest + post-event-deduction cross-check** (RETIRED_BUT_STILL_DEDUCTED + DECEASED_BUT_STILL_DEDUCTED detection). Consumes RETIRING/DECEASED/PAYMENT upload pattern. | **v2 only — register evidence layer** |
| **NEW** | **17.3e** | **Register-to-Catalog match tiering** — sub-classifies APPROVED_BUT_NO_RECORD into FUZZY_MATCH_WITHIN_MDA / NAMESAKE_CROSS_MDA / MDA_COVERAGE_GAP / POSSIBLE_AWAITING_DISBURSEMENT / NO_TRACE. Drives correct governance framing per sub-class. | **v2 sub-class evidence** |

### Net story count impact

- Pre-amendment baseline (Round 5 final): **37 stories**
- Retirements (17.19 + 17.20 + 17.21 merged into 17.17): **−3**
- New stories (17.6a + 17.33a + 17.3c + 17.3d + 17.3e): **+5**
- **Net post-amendment: 39 stories** (+2 over Round 5)

### New variance class

| Class | Severity | Trigger |
|---|---|---|
| `RESOLVER_ALIAS_MISSING` | HIGH | Ingest-time fuzzy match wins over absent-alias (e.g., WCOS→BCOS at 1-edit-Levenshtein vs no alias for WCOS). Emits ALIAS_PROPOSAL observation routed to Dept Admin. |

### Artifact impact

- **PRD:** Add FRs — Scheme Participation Headline (6-tile Venn), MDA Attribution Verification at Ingest, Beneficiary Register Ingest, Employment Event Register Ingest, Register-to-Catalog Match Tiering, Resolver Alias Proposal. Extend FR85 (fuzzy matching) with namesake-frequency lookup + catalog+register union calibration. Extend FR87 variance enumeration: BALANCE_INCREASE, BALANCE_DECREASE_BEYOND_MONTHLY (MEDIUM), MISSING_PRINCIPAL, MDA_ATTRIBUTION_DISAGREEMENT, RESOLVER_ALIAS_MISSING, APPROVED_BUT_NO_RECORD, RECORD_WITHOUT_APPROVAL, RETIRED_BUT_STILL_DEDUCTED, DECEASED_BUT_STILL_DEDUCTED. Update go-live criteria: ₦-weighted severity thresholds; register-exception adjudication queue at zero CRITICAL.
- **Architecture:** Extend persons schema with `name_frequency` materialized view. Extend `scheme_config` with tolerance parameters (8 keys). Add `scheme_beneficiary_register` table. Add `employment_event_register` table. Add `mda_disbursement_register` table. Document bidirectional cross-MDA signature test. Document 5-verdict enumeration. Document hash-carrying invariant for all engine outputs including register hashes. Document folder-aware resolver fallback layer. Document 4 register-driven variance classes in LifecycleDetector + PRP.
- **UX Design:** Add `<ActionGuidance>` component spec. Expand Scheme Participation tile block from 4 → 6 tiles (v2 Venn). Standardize print-ready A4 layout. Audit severity palette for non-punitive compliance. Design `<RegisterExceptionPanel>` component for REGISTER_EXCEPTIONS view on dashboard. Design sub-class colour distinction on APPROVED_BUT_NO_RECORD views (17.3e).
- **Sprint-status.yaml:** 37 → 39 stories. Retire 17-19 / 17-20 / 17-21. Add 17-6a, 17-33a, 17-3c, 17-3d, 17-3e. Amend existing story entries with Addendum-1 reference.
- **Team Agreements (Epic 17 list 17–22):** No changes. Agreements stand.

### Regression fixture expansion

Epic 17's regression suite absorbs v1+v2 outputs as canonical:

| Fixture type | Count | Used by |
|---|---:|---|
| Alatishe (51 records, 4 signatures, OVERLAPPING verdict) | individual | 17.4, 17.5, 17.9, 17.16 |
| Lamidi (36 records, cumulative overpayment) | individual | 17.9, 17.25, 17.26 |
| ADELEKE (namesake) | individual | 17.4 namesake guard |
| CDU (parent/child MDA) | individual | 17.21 metadata + 17.4 routing |
| Staff with variances (v2 random 100 sampled) | 3,171 → 100 | 17.16 PRP property test, 24 permutations |
| Cross-MDA continuity cases | 558 | 17.4 / 17.5 verdict coverage |
| MDA attribution disagreement sheets | 14 (historical, 1 residual) | 17.2 ingest-gate regression |
| Loan signatures | 7,576 | 17.8 fingerprint |
| Balance-increase cases | 2,112 | 17.9 BALANCE_INCREASE classifier |
| Approved beneficiaries | 2,502 | 17.3c ingest |
| Employment events (188 retired + 14 deceased) | 202 | 17.3d ingest |
| Disbursements (MERTI release) | 1,324 | 17.3c cross-reference |
| APPROVED_BUT_NO_RECORD sub-class samples | 1,700 (classified) | 17.3e classifier |
| WCOS→BCOS silent mis-attribution | 1 case set | RESOLVER_ALIAS_MISSING regression |

Fixture root: `tests/fixtures/identity-continuity/reconciliation-inventory-v2-2026-04-18/` with `.expected.json` for each named case class.

---

## Section 3 — Detailed Amendments

### 17.2 — Port side-quest utilities + ingest-time content-level MDA verification [AMEND]

**Current scope:** Port `name-match`, `mda-resolve`, `number-parse`, `column-map`, `header-detect`, `period-extract` utilities into server codebase.

**Amended scope:** Above + **three ingest-time gates**:

1. **Content-level MDA verification as hard gate.** At upload time, server reads first 5 title rows of each sheet, runs the 3-layer MDA resolver, compares to catalog attribution. Disagreement routes the entire upload to Review Queue with `MDA_ATTRIBUTION_DISAGREEMENT` class attached. Upload cannot commit until Dept Admin confirms or corrects.
2. **Folder-aware fallback resolver layer.** When filename + title + column resolution all fail, check the parent folder name. Proposed parent-folder hint as 4th resolver layer (priority below title, above fuzzy fallback). Prevents the qa_qa-style "MDA visible in folder path but not filename" ambiguity (34% of v2 Pass 0 sheets unresolved).
3. **`RESOLVER_ALIAS_MISSING` observation.** When fuzzy match wins over absent-alias (Levenshtein ≤ 2 to wrong canonical MDA, no exact or alias match to correct one), emit `ALIAS_PROPOSAL` for Dept Admin review. Prevents the WCOS→BCOS silent mis-attribution class going forward.

**Rationale:** v1 found 14 silent disagreements (1,432 silent-corrupted records); 13 of 14 absorbed by catalog-corrections workflow, validating the remediation pattern. v2 surfaced a DIFFERENT silent-bug class: WCOS fuzzy-matching to BCOS (36 Water Corporation files silently attributed to Broadcasting). Three-gate ingest design eliminates both classes.

---

### 17.4 — PersonIdentityService [AMEND]

**Current scope:** Similarity bands (high/medium/low), namesake frequency guard, cross-MDA flag (no auto-link), confidence evidence persistence.

**Amended scope:** Above + enumerate 5 cross-MDA verdicts explicitly, bidirectional signature continuity test, namesake frequency lookup against materialized `name_frequency` table (refreshed on every ingest), **plus namesake-threshold calibration guidance** from v1+v2 combined: N≥3 starting bound using catalog+register union as frequency source; revisit post-pilot.

**Cross-MDA verdict enumeration (required):**

| Verdict | Trigger | Routing |
|---|---|---|
| `LOAN_CONTINUATION_CONSISTENT` | Predicted outstanding at destination matches declared within ±5%; gap ≥ 0 months; principal stable | File backdated Transfer Handshake |
| `LOAN_CONTINUATION_VARIANT` | Predicted ≠ declared beyond tolerance; gap ≥ 0 months; not fresh principal | Review Queue — manual arithmetic audit |
| `FRESH_PRINCIPAL` | Destination principal > predicted × 2; gap ≥ 0 months | File completion event for source loan; treat destination as new loan |
| `OVERLAPPING_MDA_PRESENCE` | Source `lastPeriod` > destination `firstPeriod` (signatures overlap in time) | Namesake check + MDA hierarchy review (routes to 17.5 overlap-specific workflow) |
| `AMBIGUOUS` | Source or destination outstanding unavailable | Review Queue — escalate for MDA redeclaration or employment-event attestation |

**Bidirectional test:** For any person with signatures in MDAs A and B, test both A→B and B→A; tie-break by `firstPeriod` (earlier is source) OR `recordCount` (more records is source) when verdicts differ.

**Rationale:** v1 invented OVERLAPPING_MDA_PRESENCE mid-build because Alatishe's data required it. 53 of 358 v1 cases hit this verdict. At v2 scale (558 cases), the class remains material.

---

### 17.5 — person_link_candidates + Pending Handshake [AMEND]

**Current scope:** `person_link_candidates` table + proactive Pending Handshake surfacing to both MDAs + Transfer Handshake wiring.

**Amended scope:** Above + distinct workflow for `OVERLAPPING_MDA_PRESENCE` cases. Overlap cases do NOT file Pending Handshake (they're not transfers). They route to:

1. Namesake frequency check (if name appears ≥N times across scheme → require namesake disambiguation UI)
2. MDA hierarchy check (if both MDAs share a `reporting_parent_mda` → flag as concurrent reporting, not merge)
3. Manual disposition by Dept Admin (rare residual)

**Rationale:** Overlap means "same person in two MDAs at the same time" — never a transfer. v1 showed 53 cases; conflating with transfers creates data corruption.

---

### 17.6a — Review Queue capacity planning and routing rules [NEW]

**Scope:** Specification document + operational staffing model for the Review Queue implemented in 17.6.

**Deliverables:**

1. **Queue partitioning:** separate queues per class — transfer-candidate, overlap-mda, arithmetic-variance, tenure-mis-record, overdeduction-refund, attribution-disagreement, **register-mismatch (APPROVED_BUT_NO_RECORD / RECORD_WITHOUT_APPROVAL)**, **post-event-still-deducting (RETIRED / DECEASED)**, ambiguous. Each queue has distinct SLA and ownership.
2. **SLA matrix:**
   - CRITICAL (overdeduction, arithmetic impossibility, **NO_TRACE APPROVED_BUT_NO_RECORD**, **RETIRED_BUT_STILL_DEDUCTED**, **DECEASED_BUT_STILL_DEDUCTED**): AG direct adjudication within 7 days (may widen to 14 days given +53% CRITICAL bucket growth post-consolidation)
   - HIGH (tenure mis-record, attribution disagreement, frozen template, resolver-alias-missing, RECORD_WITHOUT_APPROVAL): Dept Admin within 14 days
   - MEDIUM (rate variance, math variance, balance increase, balance decrease beyond monthly, missing principal, **MDA_COVERAGE_GAP APPROVED_BUT_NO_RECORD**): MDA Officer within 30 days, disclosure-only otherwise
   - FUZZY_MATCH_WITHIN_MDA and NAMESAKE_CROSS_MDA (APPROVED_BUT_NO_RECORD sub-classes): **Epic 17 PersonIdentityService auto-handle**, Review Queue only on PIS low-confidence
3. **Staffing model:** Estimate Dept Admin + MDA Officer + AG review-capacity-units required given:
   - Backfill: **~53,518 items** (v2 48,518 variances + 5,000 register exceptions)
     - CRITICAL: ~5,550 (3,840 v2 catalog + 271 NO_TRACE + 10 retired + 0 deceased + some bumped from v1 re-profiling)
     - HIGH: ~23,244 (19,954 v2 catalog + 3,290 RECORD_WITHOUT_APPROVAL)
     - MEDIUM: ~25,857 (24,724 v2 catalog + 1,133 MDA_COVERAGE_GAP)
     - Plus PersonIdentityService auto-resolve: 296 FUZZY_MATCH_WITHIN_MDA handed off
   - Steady state: estimate from post-Epic-17 pilot (17.34 feeds this)
4. Escalation paths on SLA expiry (attention-item to escalation owner).
5. Reporting: monthly queue-throughput KPI per MDA (override rate per Agreement 21 "Dept Admin escape hatch").

**Rationale:** v2 exceeds v1's expected volume by +34% overall, +53% on CRITICAL — because register-driven classes stack on top of catalog variances. Without explicit staffing model, queue silently accumulates debt.

---

### 17.8 — Loans schema + fingerprint columns + loan_attribution_history [AMEND]

**Current scope:** Fingerprint = (`person_key`, `principal`, `first_deduction_date`, `original_tenure`).

**Amended scope:** Above + externalize tolerance bands to `scheme_config` (not hard-coded constants).

**`scheme_config` entries:**

| Key | Default | Used by |
|---|---|---|
| `interest_tolerance_kobo` | 5000 | RATE_VARIANCE |
| `monthly_tolerance_kobo` | 5000 | Monthly deduction vs scheme formula |
| `math_tolerance_kobo` | 1000 | Balance identity check |
| `signature_monthly_rounding_kobo` | 10000 | Signature bucketing |
| `outstanding_continuity_tolerance_pct` | 0.05 | Cross-MDA predicted-vs-declared |
| `balance_increase_min_kobo` | 100 | BALANCE_INCREASE detection threshold |
| `principal_drift_threshold_kobo` | 100000 | New-loan-vs-same-loan discriminator |
| `frozen_template_min_periods` | 12 | FROZEN_TEMPLATE detection |

**Rationale:** Scheme policy clarifications (17.31) will legitimately change tolerances; code changes + redeploys for each shift are unacceptable friction.

---

### 17.9 — LoanIdentityService + lifecycle detector [AMEND]

**Current scope:** Fingerprint + outstanding-zero-crossing lifecycle + TEMPLATE_ROLLOVER_ERROR + negative-value hard-fail.

**Amended scope:** Above + three additional variance classes at detector output:

1. **`BALANCE_INCREASE`** — Period-over-period outstanding delta ≥ `balance_increase_min_kobo` with principal change < `principal_drift_threshold_kobo`. Severity: MEDIUM default, HIGH if delta > ₦50K. (v1: 2,112 instances in 3,171 staff.)
2. **`BALANCE_DECREASE_BEYOND_MONTHLY`** — Period-over-period outstanding delta MORE NEGATIVE than declared monthly deduction. Severity: **MEDIUM** (demoted from HIGH per v2 LESSONS_LEARNED §12 — signal-to-noise low; Path 3 settlement is the dominant legitimate explanation). Routes to Unattributed Loan Endings queue (17.23).
3. **`MISSING_PRINCIPAL`** — Person has ≥1 record in catalog but no record with a recorded principal amount. Severity: MEDIUM. (v1: 717 observed — the 4,926 − 4,209 gap.)

**Rationale:** v1 detected gap closure via BALANCE_INCREASE port (411-staff delta vs existing staff-variances). MISSING_PRINCIPAL distinguishes "accessor with full record" from "roster-only entry."

---

### 17.10 — Most Likely Explanation suggestion engine [AMEND]

**Current scope:** Narrow — tenure mis-recording example only.

**Amended scope:** Cover all CRITICAL + HIGH variance classes with specific remedial narratives, **including the 4 register-driven classes:**

| Variance class | Suggested correction narrative |
|---|---|
| `TENURE_MIS_RECORDING` | "Monthly deduction ₦X on principal ₦Y is consistent with T-month tenure. Declared tenure: D months. Likely correction: update installment count to T." |
| `CUMULATIVE_OVERDEDUCTION` | "Cumulative deducted ₦X exceeds scheme total ₦Y. Overdeduction ₦Z requires AG refund workflow. Certificate-with-comment applies if completion certificate already issued." |
| `ARITHMETIC_IMPOSSIBILITY` | "Installments paid P exceeds tenure T. Either tenure mis-recorded (see TENURE_MIS_RECORDING) or cumulative overdeduction (see CUMULATIVE_OVERDEDUCTION)." |
| `BALANCE_INCREASE` | "Outstanding increased from ₦X to ₦Y with principal unchanged. Likely: interest accrual on stalled loan / MDA template recalculation / data entry error." |
| `BALANCE_DECREASE_BEYOND_MONTHLY` | "Outstanding dropped by ₦X, more than declared monthly ₦Y. Likely Path 3 lump-sum settlement — file LUMP_SUM_SETTLEMENT event with receipt reference." |
| `OVERLAPPING_MDA_PRESENCE` | "Person recorded concurrently in MDA A and MDA B. Namesake frequency N. If N ≥ threshold → namesake. If both share parent MDA → concurrent reporting. Else: Dept Admin adjudication." |
| `MDA_ATTRIBUTION_DISAGREEMENT` | "Content-level resolver identified MDA Z from title rows; catalog attributes to MDA Y. Likely correction: move the file to Z's folder OR correct the catalog." |
| `RESOLVER_ALIAS_MISSING` | "Filename/column token 'X' fuzzy-matched canonical MDA 'A' at distance D; no exact or alias entry exists. Likely intended MDA is 'B' (check folder). Dept Admin: confirm or add alias." |
| `APPROVED_BUT_NO_RECORD` (NO_TRACE) | "Beneficiary approved in register [Y], not found in any catalog MDA. AG governance red flag — confirm disbursement status with Scheme Secretariat and originating MDA." |
| `APPROVED_BUT_NO_RECORD` (MDA_COVERAGE_GAP) | "Beneficiary approved for MDA X in year Y; MDA X has not reported any period in/after Y. MDA compliance escalation — request redeclaration." |
| `APPROVED_BUT_NO_RECORD` (FUZZY_MATCH_WITHIN_MDA) | "Beneficiary likely matches catalog entry 'Z' (fuzzy, distance D). Epic 17 PersonIdentityService merge candidate; no scheme-level action required once merged." |
| `RECORD_WITHOUT_APPROVAL` | "Catalog records exist in 2024+ without register entry. Pre-2024 approval carrying forward, or register-entry gap. Disclosure-only unless combined with other flags." |
| `RETIRED_BUT_STILL_DEDUCTED` | "Retired in year Y; deduction records after Y in MDA X. Either Path 4 gratuity-deduction plan (legitimate) or overpayment (refund-due). AG adjudication required." |
| `DECEASED_BUT_STILL_DEDUCTED` | "Deceased in year Y; deduction records after Y. Direct refund-to-estate obligation. Critical AG adjudication." |

**Rationale:** v1+v2 surfaced 6+ patterns beyond tenure. Broadened scope directly improves Dept Admin / AG workflow quality and reduces adjudication latency.

---

### 17.12 — Person Reconciliation Pass (PRP) [AMEND]

**Current scope:** Set-based, idempotent, per-person recompute. Triggered by upload/correction/handshake.

**Amended scope:** Above + explicit `DRY_RUN=true` mode. When set: PRP executes all passes against proposed input; produces diff report ("what would change"); emits no writes, audit entries, or Review Queue mutations; returns projected state for inspection.

**Cross-reference:** Reconcile with existing Story 17.0b (DRY_RUN infrastructure, added in earlier Round). If 17.0b already covers engine-wide dry-run, this clause becomes "ensure PRP conforms to 17.0b dry-run contract" rather than an independent mode. Architect to disambiguate.

**Rationale:** Policy tuning, pre-commit preview, and Scheme Secretariat policy-impact preview all require explicit dry-run. v1+v2 exercises were implicitly dry-run; production must make this explicit.

---

### 17.17 — Dual-truth dashboard [AMEND + MERGE]

**Current scope:** Reconciled / Pending Review / Difference rendering per tile. Absorbs UAT findings #8, #40, #47.

**Amended scope:** Above + merge 17.19 (pre-ingest aggregated preview), 17.20 (re-attribution UX), 17.21 (MDA parent/child UI surface) INTO 17.17. Additional scope:

1. **Scheme Participation tile block (6 tiles)** at dashboard top:
   - Catalog-participation (distinct persons in catalog)
   - Register-approved (distinct persons in scheme registers)
   - Overlap-confirmed (persons in both, confirmed deducting per approval)
   - Catalog-only (deducting without 2024+ register entry — pre-2024 approvals)
   - Register-only (approved, no deductions — with sub-class colour: MDA_COVERAGE_GAP vs NO_TRACE vs FUZZY_MATCH_WITHIN_MDA)
   - Post-event-active (retired/deceased with post-event records)
2. **₦-weighted severity metrics** alongside count metrics (both operational + governance KPI).
3. **Re-attribution feed panel** (formerly 17.20): scrollable log of last 30 re-attributions with before/after, owner, reason, timestamp. Click-through to affected records.
4. **Pre-ingest preview** (formerly 17.19): pre-commit modal showing "N new persons, M continuations, K new loans, F flags" with drill-down per class.
5. **MDA parent/child surface** (formerly 17.21 UI portion): hierarchy view in MDA scorecard where applicable (CDU rolls into Agriculture parent row where `reporting_parent_mda` set).
6. **Register exception panel** (new in this addendum): summary tile showing 4 register-driven classes with sub-class breakdown for APPROVED_BUT_NO_RECORD.

**Stories 17.19, 17.20, 17.21:** RETIRED. (17.21 data-model portion — `is_autonomous` + `reporting_parent_mda` — already shipped in earlier SCP Round 3 as Agreement 22 support; retiring the UI story only.)

---

### 17.33 — Retroactive backfill [AMEND]

**Current scope:** Route 89,502 catalog records through PRP. Human-gated sign-off. Dry-run + preview + rollback.

**Amended scope:** Above + carry catalog SHA-256, script SHA-256, **and all register SHA-256s** on every output row. Every `loan_attribution_history` entry, `audit_log` entry, and dashboard snapshot references the engine version + catalog + registers that produced it. Reruns are diff-able by hash.

**Rationale:** v1+v2 methodology confirmed pattern. External auditor (17.32) needs to independently rerun against the same inputs; opacity = unverifiable.

---

### 17.33a — Quarterly Reconciliation Inventory auto-regeneration [NEW]

**Scope:** Make the Reconciliation Inventory a recurring quarterly artefact.

**Deliverables:**

1. Scheduled cron (quarterly) regenerates full inventory.
2. Diff view vs previous quarter: "CRITICAL count: 3,840 → X (delta%)" etc.
3. Published to AG as scheme health heartbeat.
4. Governance KPI dashboard: per-MDA CRITICAL trend.
5. Versioned output with diff-to-previous. Each version carries engine SHA-256.
6. Trigger on-demand regeneration for ad-hoc stakeholder questions (with AG approval).

**Rationale:** v1 → v2 delta (40,062 → 48,518 variances; 1,700 new register exceptions surfaced) demonstrates the improvement-tracking value. Without recurrence, inventory goes stale in months.

---

### 17.3c — Scheme Beneficiary Register ingest + diff-to-catalog [NEW]

**Scope:** Ingest Scheme Secretariat's approved beneficiary lists as a first-class evidence source. Cross-check against catalog. Surface `APPROVED_BUT_NO_RECORD` and `RECORD_WITHOUT_APPROVAL` observations.

**Schema:**

```sql
CREATE TABLE scheme_beneficiary_register (
  id              SERIAL PRIMARY KEY,
  raw_name        TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  mda_id          INT REFERENCES mdas(id),
  mda_raw_token   TEXT NOT NULL,
  grade_level     INT,
  principal_kobo  BIGINT,
  approval_year   INT NOT NULL,
  register_type   TEXT NOT NULL CHECK (register_type IN ('COLLATION', 'INTERVENTION')),
  source_file     TEXT NOT NULL,
  source_sha256   TEXT NOT NULL,
  ingested_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_sbr_normalized_name ON scheme_beneficiary_register (normalized_name);
CREATE INDEX ix_sbr_mda_year ON scheme_beneficiary_register (mda_id, approval_year);
```

**Ingest pattern:** Upload-based. Dept Admin (or AG delegate) uploads register file; parser (from `authoritative-register-parse.ts` side-quest port) extracts rows; SHA-256 captured on ingest; rows written with `source_sha256` for provenance.

**Cross-check pass (Pass 0.5a of PRP):**
- For each beneficiary → check catalog for normalized-name match within same MDA.
- If absent → emit `APPROVED_BUT_NO_RECORD` observation, route to 17.3e sub-classifier.
- For each catalog person 2024+ → check register for entry.
- If absent in any register year → emit `RECORD_WITHOUT_APPROVAL` (HIGH).

**Rationale:** v2 surfaced 1,700 + 3,290 = 4,990 observations requiring this layer. No Epic 17 story currently covers beneficiary-register evidence; Scheme Secretariat reports are invisible to Epic 17 as designed.

---

### 17.3d — Employment Event Register ingest + post-event-deduction cross-check [NEW]

**Scope:** Ingest Scheme Secretariat's retired/deceased register. Cross-check post-event catalog records. Surface `RETIRED_BUT_STILL_DEDUCTED` and `DECEASED_BUT_STILL_DEDUCTED` observations.

**Schema:**

```sql
CREATE TABLE employment_event_register (
  id                       SERIAL PRIMARY KEY,
  raw_name                 TEXT NOT NULL,
  normalized_name          TEXT NOT NULL,
  is_deceased              BOOLEAN NOT NULL,
  mda_id                   INT REFERENCES mdas(id),
  mda_raw_token            TEXT NOT NULL,
  event_year               INT NOT NULL,
  loan_collection_date_raw TEXT,
  commencement_date_raw    TEXT,
  principal_kobo           BIGINT,
  interest_kobo            BIGINT,
  total_loan_kobo          BIGINT,
  outstanding_total_kobo   BIGINT,
  installments_paid        INT,
  installments_outstanding INT,
  monthly_deduction_kobo   BIGINT,
  source_file              TEXT NOT NULL,
  source_sheet             TEXT NOT NULL,
  source_sha256            TEXT NOT NULL,
  ingested_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Cross-check pass (Pass 0.5b of PRP):**
- For each retired event → check catalog for records strictly after event year.
- If found → emit `RETIRED_BUT_STILL_DEDUCTED` (CRITICAL), include post-event record count + outstanding-at-event context.
- Same for deceased events → `DECEASED_BUT_STILL_DEDUCTED` (CRITICAL).

**Rationale:** v2 surfaced 10 RETIRED_BUT_STILL_DEDUCTED cases — adjudicable today. Zero DECEASED_BUT_STILL_DEDUCTED is a positive governance signal also worth capturing.

---

### 17.3e — Register-to-Catalog match tiering [NEW]

**Scope:** Sub-classifier for `APPROVED_BUT_NO_RECORD` observations. Runs after 17.3c emits raw observations.

**Sub-class logic:**

| Sub-class | Detection rule |
|---|---|
| `FUZZY_MATCH_WITHIN_MDA` | Fuzzy name match in same MDA at Levenshtein ≤ 3 → Epic 17 PersonIdentityService merge candidate |
| `NAMESAKE_CROSS_MDA` | Exact-normalized name in different MDA → namesake check via `name_frequency` table |
| `MDA_COVERAGE_GAP` | Beneficiary's MDA has zero catalog records covering approval year → MDA compliance flag |
| `POSSIBLE_AWAITING_DISBURSEMENT` | Approval in catalog-latest year, MDA active in latest year → timing-explained, disclosure-only |
| `NO_TRACE` | No fuzzy match anywhere, MDA has adequate coverage, approval not in latest year → **CRITICAL AG adjudication** |

**Emission:** Each sub-class drives a different Review Queue partition + SLA + dashboard colour. Flat 1,700 count is replaced by 296 / 0 / 1,133 / 0 / 271 nuanced breakdown in every dashboard surface.

**Rationale:** v2 empirical: 1,700 APPROVED_BUT_NO_RECORD framed flat would misrepresent as scheme-level crisis. Sub-classified: 17.4% are name-variants (Epic 17 PIS fix), 66.6% are MDA reporting gaps (MDA escalation), 15.9% are true red flags (AG escalation). Sub-classification drives correct governance action.

---

## Section 4 — Urgent Pre-Epic-17 Actions

### 4.1 — Deputy AG governance briefing (adjudication-ready, independent of Epic 17 shipping)

Append to existing Deputy AG package (Alatishe detailed-audit + Deputy-AG-summary PDFs):

- **10 RETIRED_BUT_STILL_DEDUCTED cases** — listed in `VLPRS-Reconciliation-2026-04-18/register-exceptions-retired-but-still-deducted.csv`. Each is a direct Path 4 gratuity-deduction review or payroll-stop verification target.
- **0 DECEASED_BUT_STILL_DEDUCTED** — positive governance signal. Counter-balances the retirement flags. Worth explicit mention.
- **271 NO_TRACE APPROVED_BUT_NO_RECORD** — true scheme-level red flags. Filter `register-exceptions-approved-but-no-record.csv` by sub-class = NO_TRACE. Route to Scheme Secretariat for beneficiary-by-beneficiary disbursement-status verification.

### 4.2 — MDA compliance escalation (pre-Epic-17, Dept Admin task)

**1,133 MDA_COVERAGE_GAP cases.** These MDAs approved beneficiaries but haven't filed returns covering the approval year. Route via MDA officer channel:

- Top MDAs surfaced in `register-exceptions-approved-no-record-subclasses.md`.
- Structured re-declaration request path (future Story 17.30) but manual escalation is executable today.
- Tracking: each MDA's COVERAGE_GAP count becomes a KPI on the dashboard post-17.17.

### 4.3 — 14 historical MDA attribution disagreement sheets (v1 remediation residual)

13 of 14 absorbed by `catalog-corrections-2026-04-16.json` and the WCOS alias fix. **1 residual** surfaces at v2 Pass 0 — needs human review:

1. Open `VLPRS-Reconciliation-2026-04-18/RECONCILIATION_INVENTORY_FULL.html` → Content-Level MDA Attribution Disagreements section.
2. Open source file. Verify true MDA.
3. Update `docs/Car_Loan/` file organization OR extend `utils/mda-resolve.ts` HUMAN_OVERRIDES.
4. Rerun `reconciliation-inventory-build-v2-2026-04-18.ts` to verify 0 disagreements.

### 4.4 — WCOS / Cluster C resolver alias integration

The WCOS → WATER CORPORATION alias added mid-Stage-1 (commit included in the v2 artefacts) must be merged to the main resolver. Cluster C (AANFE-mis-resolved-as-AGRICULTURE from v1 Addendum §4) fix also pending. Both are resolver-level fixes, not catalog corrections. Ship before any future catalog rebuild.

---

## Section 5 — Regression Fixture Set Update

Epic 17's regression suite absorbs v2 outputs as canonical. New fixture root:

```
tests/fixtures/identity-continuity/reconciliation-inventory-v2-2026-04-18/
├── alatishe/                               (individual, 51 records, 4 signatures)
├── lamidi/                                 (individual, 36 records, cumulative overpayment)
├── adeleke/                                (individual, namesake)
├── cdu-agriculture-parent-child/           (individual, hierarchy)
├── wcos-bcos-resolver-alias/               (new — resolver-alias-missing regression)
├── approved-no-record-subclasses/          (new — 5 sub-class samples, 10 each)
├── retired-but-still-deducted/             (new — 10 cases, adjudication-ready)
├── cross-mda-verdicts-v2/                  (558 cases by verdict)
├── mda-attribution-disagreement-v1/        (14 historical cases, 1 residual)
└── staff-property-test-sample/             (random 100 from 3,171 staff-with-variances)
```

Each carries `.expected.json`. Covered by Agreement 18 "Fixture-first for architectural tracks."

---

## Section 6 — Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Amendments expand Epic 17 effort beyond plan | Low | Medium | Net +2 stories. Story sizing absorbs per-story marginal deltas. |
| Scheme-config externalization (17.8) invites Dept Admin mis-tuning | Medium | Low | Agreement 21 "Dept Admin escape hatch with audit" applies |
| Register ingest (17.3c/d) depends on Scheme Secretariat cooperation | Medium | Medium | Upload UI + file template published; Secretariat trained pre-cutover per Pilot Before Portfolio (Agreement 20) |
| APPROVED_BUT_NO_RECORD sub-classification thresholds mis-calibrated | Medium | Low | 17.3e classifier tuning via pilot cycle; revisit after BIR pilot (17.34) |
| MDA_COVERAGE_GAP escalation strains MDA relationships | Low | Medium | Framed as compliance support, not punitive; agreement-respecting process |
| WCOS-class resolver bugs hide in other MDA boundaries | Medium | Medium | `RESOLVER_ALIAS_MISSING` ingest gate catches all future instances |
| Register file schemas drift (Scheme Secretariat changes templates) | Medium | Low | Parser emits `SCHEMA_DRIFT` observation on header mismatch; Dept Admin confirms before ingest |
| Quarterly inventory becomes political | Low | Medium | Frame as governance heartbeat; establish declining-CRITICAL KPI pre-first-publication |

---

## Section 7 — Approval

### Process

1. **Bob (SM)** reviews story changes and updates `sprint-status.yaml`:
   - Retire 17-19, 17-20, 17-21
   - Amend 17.2, 17.4, 17.5, 17.8, 17.9, 17.10, 17.12, 17.17, 17.33 per §3
   - Add 17-6a, 17-33a, 17-3c, 17-3d, 17-3e per §3
2. **Alice (PO)** reviews and approves MVP impact (+2 net stories; empirical evidence for every amendment; sub-class framing protects governance narrative).
3. **John (PM)** updates `prd.md` with FR additions per §2 artifact impact.
4. **Winston (Architect)** updates `architecture.md` with schema extensions (`name_frequency`, `scheme_config`, `scheme_beneficiary_register`, `employment_event_register`, `mda_disbursement_register`, hash-carrying invariant, 5-verdict enumeration, bidirectional cross-MDA test, 10 variance classes, folder-aware resolver layer).
5. **Sally (UX)** updates `ux-design-specification.md` with `<ActionGuidance>` component, Scheme Participation 6-tile block, `<RegisterExceptionPanel>` spec, severity palette audit, A4-print standardization, sub-class colour distinction.
6. **Awwal** executes §4 pre-Epic-17 actions:
   - §4.1 Deputy AG briefing update (Alatishe + Lamidi + 10 retired + 271 NO_TRACE)
   - §4.2 MDA compliance escalation (1,133 MDA_COVERAGE_GAP cases, per-MDA routing)
   - §4.3 Residual 14-sheet (1 remaining) remediation
   - §4.4 Resolver alias integration (WCOS + Cluster C)
7. **Deputy AG brief update:** Mention Reconciliation Inventory v1+v2 as input to Epic 17 confidence; include Scheme Participation 6-tile headline; include 10 RETIRED_BUT_STILL_DEDUCTED adjudication-ready cases; include 0 DECEASED_BUT_STILL_DEDUCTED as positive signal.

### Supporting evidence

- `VLPRS-Reconciliation-2026-04-18/INDEX.md` — v2 folder index
- `VLPRS-Reconciliation-2026-04-18/METHODOLOGY.md` — v2 reproducibility (catalog + register + script SHA-256)
- `VLPRS-Reconciliation-2026-04-18/LESSONS_LEARNED.md` — reduce-step analysis
- `VLPRS-Reconciliation-2026-04-18/RECONCILIATION_INVENTORY_{FULL,AG,AUDITOR}.html` — v2 inventory views
- `VLPRS-Reconciliation-2026-04-18/REGISTER_EXCEPTIONS.html` — v2 register-exception view
- `VLPRS-Reconciliation-2026-04-18/register-exceptions-approved-no-record-subclasses.md` — 1,700-case sub-classification
- `VLPRS-Reconciliation-2026-04-18/qa-qa-triage-2026-04-17.md` — Stage 0 catalog-extension justification
- `VLPRS-Reconciliation-2026-04-18/stage1-ingest-manifest-2026-04-17.json` — Stage 1 ingest record
- `VLPRS-Reconciliation-2026-04-18/by-mda-staff/` — 4,279 per-staff drill-down pages
- `reconciliation-inventory-2026-04-16/` — v1 baseline artefacts (partial residual after mid-build overwrite; evidence chain intact through v2 DELTA_AUDIT and METHODOLOGY cross-references)
- `docs/Car_Loan/analysis/registers/` — parsed register JSONs (beneficiary, employment_event, disbursement)
- `scripts/legacy-report/reconciliation-inventory-build-v2-2026-04-18.ts` — v2 build engine
- `scripts/legacy-report/reconciliation-inventory-by-staff-v2-2026-04-18.ts` — v2 drill-down renderer
- `scripts/legacy-report/authoritative-register-parse.ts` — Stage 2 register parser
- `scripts/legacy-report/register-cross-check-v2-2026-04-18.ts` — Pass 0.5 cross-check
- `scripts/legacy-report/register-approved-no-record-subclass.ts` — 17.3e sub-classifier
- `scripts/legacy-report/qa-qa-triage-2026-04-17.ts` — Stage 0 triage
- `scripts/legacy-report/stage1-ingest-2026-04-17.ts` — Stage 1 ingest manifest generator
- `_bmad-output/planning-artifacts/drafts/scp-addendum-1-draft-2026-04-16.md` — superseded v1-only draft (archival)

### Proposed status

**APPROVED PENDING** — Awaiting PM / Architect / UX sign-off per process above. Awwal's §4 action items can execute in parallel with sign-off.

---

*End of Addendum 1 (Published). Consolidates v1 proposals drafted 2026-04-16 + v2 register-layer additions empirically validated 2026-04-18. Supersedes `scp-addendum-1-draft-2026-04-16.md`. Post-amendment Epic 17 story count: 37 → 39.*
