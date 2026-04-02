# Epic 15: Team Review & Decisions
## For: John (PM) — Feedback from E7+E6 Retro Session

**Reviewers:** Bob (SM), Alice (PO), Charlie (Sr Dev), Dana (QA), Winston (Architect), Awwal (Project Lead)
**Date:** 2026-03-29
**Epic Reviewed:** `_bmad-output/planning-artifacts/epic-15-beneficiary-onboarding-pipeline.md`
**Verdict:** Strong draft. Data corrections needed, architectural decisions made, all open questions answered.

---

## Overall Assessment

The team's consensus is that John's epic is **well-crafted and ready for refinement**. The temporal pipeline model (monthly scanning, onboarding curves, per-MDA drill-down) is exactly what Awwal described. The confidence-banded fuzzy matching approach is realistic about the data quality challenges.

**Strongest elements:**
- The distinction between FR85 (static report) and what's actually needed (temporal pipeline)
- Confidence bands (High/Medium/Low) with human review queue — right pattern for fuzzy data
- Monthly scan hooking into the existing submission pipeline — no new scheduler needed
- Non-punitive vocabulary applied throughout

**Areas needing correction/update:**
- File locations and schemas differ from what John documented
- The retiree/deceased file is much richer than assumed (17 columns, not 5)
- A 4th dataset (Payment/Disbursement 2025) was discovered that John didn't account for
- Deceased beneficiaries are mixed with retirees — need separate handling

---

## Data File Corrections

### Actual File Location

**John wrote:** `docs/legacy_cd/`
**Correct:** `docs/Car_Loan/beneficiaries_retirees/`

### Actual Files (4, not 3)

| # | Filename | John's Label | Sheets | Rows | Schema |
|---|----------|-------------|--------|------|--------|
| 1 | `VEHICLE LOAN COLLATION 2024(2).xlsx` | 2024 Main List | "POST MEETING FOR LIST 1" | 779 | 5 columns (S/N, NAME, MDAS, GL, AMOUNT) ✅ matches John's |
| 2 | `2024 INTERVENTION LIST(1).xlsx` | 2024 Addendum | "Sheet1" | 352 | 5 columns, title row "INTERVENTION LIST 2024", data starts row 3 ✅ matches |
| 3 | `VEHICLE LOAN COLLATION 2025 (Recovered)(2).xlsx` | 2025 Main List | "ARRANGED FOR APPROVAL" | 1,409 | 5 columns ✅ matches |
| 4 | `RETIRING , DECEASED RECORD AND 2025 PAYMENT LIST(1).xlsx` | **NOT in John's analysis** | **3 sheets** (see below) | 123 + 81 + 1,332 | **17 columns for retirees, 10 columns for payments** |

### The Retiree/Deceased File — Major Schema Difference

John assumed the retiree file would have the same 5-column schema as approval lists. **It does not.** It has 3 sheets with completely different structures:

**Sheet 1: "2024RETIREE & DECEASED" (123 rows, 17 columns)**

| Column | Header |
|--------|--------|
| 0 | S/N |
| 1 | NAMES |
| 2 | MDAs |
| 3 | DATE OF COLLECTION OF LOAN |
| 4 | PRINCIPAL |
| 5 | INTEREST |
| 6 | TOTAL LOAN |
| 7 | COMMENCEMENT DATE |
| 8 | NO OF INST. PAID |
| 9 | MONTHLY DEDUCTION |
| 10 | TOTAL PRINCIPAL PAID |
| 11 | TOTAL INTEREST PAID |
| 12 | TOTAL LOAN PAID |
| 13 | OUTSTANDING PRINCIPAL BALANCE |
| 14 | OUTSTANDING INTEREST BALANCE |
| 15 | OUTSTANDING TOTAL LOAN BALANCE |
| 16 | NO OF INSTAL. OUTSTANDING |

This is the **same schema as the BIR migration file** Awwal tested in UAT — full loan financial data, not just name/MDA/amount.

**Sheet 2: "2025 RETIRE & DECEASED" (81 rows, same 17 columns)**

Same structure as Sheet 1. Some rows have null values for computed fields.

**Sheet 3: "PAYMENT 2025" (1,332 rows, 10 columns)**

| Column | Header |
|--------|--------|
| 0 | S/N |
| 1 | NAMES |
| 2 | MDA'S |
| 3 | G.L. |
| 4 | BANKS |
| 5 | ACCOUNT NO. |
| 6 | AMOUNTS(#) |
| 7 | DATE OF RETIRE |
| 8 | REMARKS |
| 9 | NO ON LIST |

This is a **disbursement/payment list** — contains bank details, retirement dates, and remarks. This is a completely different dataset from what John planned for. The title row says "MERTI RELEASE FOR 2025 JULY" (likely "MERIT RELEASE").

### Deceased Beneficiaries

Names prefixed with "LATE" indicate deceased staff:
- 2024 sheet: 6 deceased rows
- 2025 sheet: 8 deceased rows

**Implication for Story 15.5:** The retiree verification needs to handle **two categories** — RETIRED and DECEASED — with different pathways. A deceased beneficiary's outstanding balance may need a different settlement pathway (beneficiary estate, guarantor) than a living retiree (gratuity deduction).

---

## Architectural Decisions Made by Team

### Decision 1: Name Matching Library

**Decision:** Implement both Jaro-Winkler and Levenshtein-based token-set comparison during Story 15.2. Benchmark against a 20-record fixture set with known variants. Pick the one with better precision at the 85% and 95% thresholds.

**Rationale (Charlie):** Jaro-Winkler favours prefix matches (good for surname-first names). Levenshtein handles insertions/deletions (good for missing middle names). Neither is universally better for this dataset — empirical testing on real data decides.

### Decision 2: Scan Trigger Pattern

**Decision:** Monthly onboarding scan (Story 15.3) is fire-and-forget — same pattern as three-way reconciliation (7.0i). Submission processing must not be blocked by matching engine.

**Rationale (Winston):** The submission pipeline is the critical path. The onboarding scan is an enrichment layer. If the matcher fails or is slow, submissions still process. Results are eventual, not transactional.

### Decision 3: Batch Retirement Import

**Decision:** Batch import with Department Admin confirmation + preview + provenance tagging. Each retirement processed in its own transaction (not one giant batch tx).

**Rationale (Charlie):** Retirement events trigger `transitionLoan` (ACTIVE → RETIRED) which involves ledger entries, state transitions, and potentially gratuity pathway activation. One transaction per retirement prevents deadlocks and allows partial success.

**Addition (Winston):** Each batch-imported retirement event must include: `source: 'RETIREE_LIST_BATCH_IMPORT'`, `uploadReference: <upload_id>`, `batchDate: <import_date>` — so the audit trail distinguishes list imports from manual filings.

### Decision 4: Batch Identifier Flexibility

**Decision:** Support both annual batches (2024, 2025) and ad-hoc batches. Use a `batch_id` (UUID) + `batch_label` (string) + `batch_year` (optional int) model rather than year-only.

**Rationale (Alice, from Awwal's input):** "Committee rhythm is annual + addendums, but political expediency may override — ad-hoc processes may arise." A rigid year-only model would break for mid-year emergency approval batches.

**Schema implication:**
```
approved_beneficiaries.batch_id    → FK to approval_batches table
approval_batches: { id, label, year (nullable), list_type, uploaded_at, uploaded_by, notes }
```

This allows: "2024 Main Approval" (year=2024), "2024 Addendum" (year=2024), "Emergency Q3 2025" (year=2025, label distinguishes), or "Governor's Special Directive" (year=null, ad-hoc).

### Decision 5: Retiree/Deceased Separation

**Decision:** Split the `list_type` enum from John's 3 values (APPROVAL / ADDENDUM / RETIREE) to 4 values: APPROVAL / ADDENDUM / RETIREE / DECEASED.

**Rationale (Team):** Deceased beneficiaries have different settlement pathways than living retirees. A deceased staff's outstanding balance may involve beneficiary estate claims or guarantor recovery — not the gratuity pathway. Story 15.5 needs to handle both categories with distinct verification statuses and actions.

### Decision 6: Payment/Disbursement List (New Discovery)

**Decision:** The "PAYMENT 2025" sheet (1,332 rows with bank details) is a **separate concern** from onboarding tracking. Capture it as a future enhancement or Story 15.7, not part of the initial 6 stories.

**Rationale (Bob):** This sheet contains bank account numbers, retirement dates, and disbursement remarks. It's useful for: (a) verifying loan disbursement actually happened, (b) cross-referencing retirement dates against temporal profiles. But it adds significant scope (bank data handling, PII sensitivity) and is not required for the core onboarding pipeline. Park it.

**Awwal to confirm:** Is the payment list relevant to the onboarding question, or is it a separate operational concern?

### Decision 7: Retiree File Uses Migration-Like Schema

**Decision:** Story 15.1's upload pipeline must handle TWO schema types:
- **Approval schema** (5 columns): S/N, Name, MDA, GL, Amount — for approval and addendum lists
- **Retiree schema** (17 columns): Full loan financial data — same structure as migration files

**Rationale (Charlie):** The retiree file has principal, interest, total loan, outstanding balance, instalments paid/outstanding — all fields the migration upload pipeline already handles. Story 15.1 should detect which schema type a file uses (by column count and header matching) and parse accordingly.

**Opportunity (Winston):** The 17-column retiree data is rich enough to create RETIRED loan records directly — with full financial history — rather than just matching against existing loans. This means Story 15.5 (Retirement Verification) has two pathways:
1. **Match found:** Retiree matches an existing loan → verify retirement event recorded
2. **No match but full data available:** Retiree has complete loan data → offer to create the loan record + retirement event in one step (similar to migration baseline + retirement in a single workflow)

---

## Open Questions — Answers

### Q1: 2025 Retirees List — Where is it?

**Answer (Awwal):** `docs/Car_Loan/beneficiaries_retirees/RETIRING , DECEASED RECORD AND 2025 PAYMENT LIST(1).xlsx`

Contains 3 sheets:
- "2024RETIREE & DECEASED" — 122 retirees/deceased (2024 cohort)
- "2025 RETIRE & DECEASED" — 80 retirees/deceased (2025 cohort)
- "PAYMENT 2025" — 1,331 payment/disbursement records (separate concern)

**Action for John:** Update Data Analysis section. File path, schema (17 columns not 5), and three-sheet structure all differ from the draft.

### Q2: Aging Threshold

**Answer (Awwal):** Accepts 3-month default with 6-month escalation unless team has a stronger recommendation.

**Team recommendation (Alice):** 3/6 months is appropriate. The typical cycle is: committee approves (month 0) → MDA receives list (month 0-1) → first payroll deduction (month 1-2) → first submission to VLPRS (month 2-3). So 3 months allows for normal process lag before flagging. 6 months is genuinely late. **No change recommended — 3/6 stands.**

### Q3: Batch Import of Retirements

**Answer:** Batch import with Department Admin confirmation is approved (see Decision 3 above). Add preview before execution and provenance tagging on every imported event.

### Q4: Committee Rhythm

**Answer (Awwal):** Annual + addendums as baseline, but political expediency may create ad-hoc batches.

**Resolution:** Flexible batch identifiers (see Decision 4 above). `approval_batches` table with optional year, required label.

### Q5: Onboarding Curve Placement

**Team decision (Alice):** Both. Headline metrics populate the existing Executive Summary stub (FR37). Full onboarding curve and per-MDA drill-down lives on its own dashboard page — same pattern as Migration Coverage Tracker.

### Q6: Epic Number

**Answer (Awwal + Team):** Epic 15 confirmed. No objection.

---

## Corrections to John's Draft

| Section | Issue | Correction |
|---------|-------|-----------|
| Data Analysis — File Location | `docs/legacy_cd/` | `docs/Car_Loan/beneficiaries_retirees/` |
| Data Analysis — File Count | 3 files | **4 files** (2024 Main, 2024 Addendum, 2025 Main, Retirees/Deceased+Payment) |
| Data Analysis — Retiree Schema | Assumed 5-column schema | Actually **17 columns** (full loan financial data) |
| Data Analysis — Deceased | Not mentioned | 14 deceased rows (6 in 2024, 8 in 2025) — need separate DECEASED list_type |
| Data Analysis — Payment Sheet | Not mentioned | "PAYMENT 2025" — 1,332 rows with bank details, retirement dates. Park as future scope |
| Stories — 15.1 | Single upload schema | Must handle **two schema types** (5-column approval + 17-column retiree) |
| Stories — 15.5 | Retirees only | Must handle **RETIRED and DECEASED** with different pathways |
| Schema — list_type enum | APPROVAL / ADDENDUM / RETIREE | Add **DECEASED** |
| Schema — batch model | batch_year (integer) | **batch_id FK to approval_batches** table for flexible ad-hoc batch support |
| Dependencies | Missing | Add dependency on **8.0a (computation model fix)** — linked loan records must have correct balances |

---

## Recommended Story Adjustments

### Story 15.1 — Upload Pipeline (Updated Scope)

**Add:**
- Dual schema detection (5-column approval vs 17-column retiree)
- DECEASED list_type alongside RETIREE
- Flexible batch model (`approval_batches` table)
- Title row says "INTERVENTION LIST 2024" with no header row — parser must handle this edge case (already noted by John)

### Story 15.5 — Retirement Verification (Updated Scope)

**Add:**
- Deceased handling: "LATE" prefix detection → DECEASED status → different settlement pathway note
- For 17-column retiree records with no existing loan match: offer to create loan record + retirement event directly (migration-like baseline creation)
- Two verification categories in the report:
  - **Retirees** → gratuity settlement pathway (FR65)
  - **Deceased** → estate/guarantor recovery pathway (informational, no auto-action)

### Potential Story 15.7 — Payment/Disbursement Verification (Future)

**New story (parked):**
- Upload "PAYMENT 2025" sheet (bank details, amounts, retirement dates)
- Cross-reference against approved beneficiaries: "Was this person approved? Was the loan disbursed? Has deduction started?"
- PII sensitivity: bank account numbers require access control review
- **Not in initial scope** — Awwal to confirm relevance

---

## Critical Context for John: The ALATISE Problem and Why It Affects Epic 15

During the E7+E6 retro, Awwal conducted live UAT by uploading the BIR legacy file (`docs/Car_Loan/BIR CAR LAON AUGUST, 2024.xlsx`). One record — **ALATISE BOSEDE SUSAINAH** — exposed a fundamental flaw in how VLPRS processes legacy financial data. This flaw directly affects Epic 15's retiree pipeline because the retiree files have the **same 17-column schema** as the BIR migration file.

### What Happened

ALATISE's BIR record (Principal ₦450,000, 30-month tenure):

| Field | Excel Value | Problem |
|-------|------------|---------|
| OUTSTANDING BAL. | ₦671,979 | **Exceeds total loan of ₦479,985** — mathematically impossible |
| NO OF INSTALMENT | 30 | But: 8 paid + 42 outstanding = 50, not 30 |
| MONTHLY INTEREST | ₦999.50 | Should be ₦999.75 per scheme formula (P×13.33%÷60) — rounding error in legacy spreadsheet |

### Three-Way Computation Discrepancy

Awwal manually computed using the scheme formula and found all three sources disagree:

| Source | Monthly Interest | Total Loan |
|--------|-----------------|------------|
| **Scheme Formula** (P×13.33%÷60) | ₦999.75 | **₦479,992.50** (authoritative) |
| **VLPRS** (reverse-engineered 6.663% from Excel) | ₦999.45 | ₦479,983.50 |
| **Excel** (legacy spreadsheet) | ₦999.50 | ₦479,985.00 |

**VLPRS currently reverse-engineers the rate from the Excel's already-wrong Total Loan**, then recomputes everything with that wrong rate. It doesn't use the authoritative scheme formula.

### The Cascade

If "Establish Baseline" is clicked on ALATISE's record:
1. System uses the DECLARED outstanding balance (₦671,979) — not computed
2. Creates a **negative** baseline entry: ₦479,985 - ₦671,979 = **-₦191,994**
3. When the dashboard computes balance: totalLoan - (-₦191,994) = totalLoan + ₦191,994
4. **Every downstream metric is inflated**: Total Outstanding Receivables, MDA Health Score, Recovery Projections, all E6 PDF reports

### Why This Matters for Epic 15

The retiree/deceased file (`RETIRING , DECEASED RECORD AND 2025 PAYMENT LIST(1).xlsx`) has the **exact same 17-column structure**, including: PRINCIPAL, INTEREST, TOTAL LOAN, OUTSTANDING PRINCIPAL BALANCE, OUTSTANDING INTEREST BALANCE, OUTSTANDING TOTAL LOAN BALANCE, NO OF INSTAL. OUTSTANDING.

**If Story 15.5 creates loan records from retiree data** (the "no match but full data available" pathway in Decision 7), it will inherit the same problems:
- Outstanding balances may exceed total loans
- Interest computations may have legacy rounding errors
- Instalment counts may be internally inconsistent

**Therefore:** Prep story 8.0a (which introduces the three-vector model: Scheme Expected vs Reverse Engineered vs MDA Declared) and prep story 8.0b (which adds the record detail view + correction flow before acceptance) **must be completed before Story 15.5 processes retiree financial data.** Without these guardrails, the retiree pipeline will inject the same bad data into the system.

### The Three-Vector Model (from 8.0a)

Prep story 8.0a introduces a three-column comparison for all legacy financial data:

| Vector | Source | Purpose |
|--------|--------|---------|
| **Scheme Expected** | Always computed from P × 13.33% ÷ 60 | "What VLPRS says this loan should be" |
| **Reverse Engineered** | Rate derived from the file's own Principal and Total Loan | "What the file's numbers imply internally" |
| **MDA Declared** | Raw values from the file | "What the MDA/Committee actually wrote" |

This model must apply to the retiree data pipeline in Story 15.5, not just the migration upload. The department admin needs to see all three vectors before accepting a retiree record into the system — especially for deceased beneficiaries where settlement amounts must be accurate.

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| High-confidence auto-link rate lower than 60% due to name variants | Medium | Review queue backlog for Department Admin | Start with conservative thresholds, tune after first batch. The queue IS the feature |
| Common names create false positive matches within same MDA | Medium | Wrong person linked to wrong loan | MDA + name + amount triple-check for HIGH confidence. Medium band requires human review |
| Deceased handling needs legal/policy clarity on settlement | Low | Story 15.5 scope creep | Park estate recovery as informational only — no auto-action for deceased, just reporting |
| Payment list (1,332 rows with bank data) creates PII exposure | Low | Security review needed | Parked as Story 15.7. Not in initial scope |
| **Retiree 17-column data has same computation flaws as ALATISE (BIR UAT finding)** | **High** | **Cascading bad data into loans, dashboards, and reports — proven in UAT** | **Hard dependency on prep stories 8.0a (three-vector model) and 8.0b (inspect-and-correct flow). Story 15.5 must NOT process retiree financial data until these are complete. Three-vector validation must apply to retiree data exactly as it applies to migration data.** |

---

## Final Team Recommendation

**To John:** Your epic is solid. Apply the corrections above, update the file locations and schemas, add the DECEASED category, and switch to the flexible batch model. The core architecture (confidence-banded matching, monthly scan, onboarding curve) is approved by the team.

**Sequencing confirmed:**
```
E8 prep (8.0a–8.0i) → E15 Stories 15.1-15.2 (can start) + E8 core (8.1-8.3) parallel
                     → E15 Stories 15.3-15.6 (after 15.2 matching engine exists)
                     → E12 → E9 → E13
```

**Critical dependency:** Prep story 8.0a (computation model fix) must be done before Story 15.5 processes retiree financial data — otherwise the same cascade problem we found in today's UAT will affect the retirement verification pipeline.

---

*Document prepared by the VLPRS team for John (PM) based on collaborative review during the E7+E6 retrospective session, 2026-03-29.*
