# Epic 15: Beneficiary Onboarding & Verification Pipeline

**Author:** John (PM), with inputs from Awwal (Product Owner), Bob (Scrum Master), Winston (Architect), Charlie (Sr Dev), Dana (QA), Alice (PO)
**Date:** 2026-03-29
**Source:** E7+E6 Retro — Planning Item A, Discovery Briefing, PM Discovery Session, Team Review
**Status:** REVISED — All open questions answered, team review corrections applied

---

## Executive Summary

### The Business Question

> "We approved X loans. Are they all being deducted? If not, which ones are missing and at which MDAs?"

The Car Loan Approval Committee produces approved beneficiary lists (Excel files). MDAs are then responsible for starting payroll deductions for those approved staff. VLPRS only sees loans that appear in MDA monthly submissions. **Nobody can currently answer whether all approved loans are actually being deducted.**

### What This Epic Delivers

A **living, month-over-month tracking pipeline** that:
1. Ingests approved beneficiary lists and retiree/deceased lists from the Committee
2. Matches them against operational loan records using fuzzy name matching with confidence scoring
3. Scans each month's MDA submissions to track when approved beneficiaries first appear
4. Surfaces "not yet operational" beneficiaries with aging, per-MDA drill-down, and onboarding curves
5. Cross-references retiree/deceased lists to verify retirement events are recorded and gratuity pathways activated
6. Feeds the existing attention items and observation frameworks (FR33, FR87)

### Why Not Just FR85?

FR85 (already in the PRD) describes a **static cross-reference report** — "here's who matches and who doesn't" at a point in time. What the AG needs is a **temporal pipeline** — "track each approved name across months, show me when they first appear, alert me if they never do, and tell me which MDAs are slow." That's a fundamentally different capability.

### Design Principle: The Truth Is in the Submissions

The only reliable signal that a loan is operational is when the MDA account officer submits monthly returns showing deductions. Everything upstream — payment vouchers, bank credits, disbursement lists — has variable lag and is outside VLPRS's scope. The onboarding pipeline tracks one thing: **when does an approved name first appear in an MDA submission?**

---

## Data Analysis: What We're Working With

### Actual File Location

`docs/Car_Loan/beneficiaries_retirees/`

### Files (4 total)

| # | Filename | Label | Sheets | Rows | Schema |
|---|----------|-------|--------|------|--------|
| 1 | `VEHICLE LOAN COLLATION 2024(2).xlsx` | 2024 Main List | "POST MEETING FOR LIST 1" | 779 | 5 columns |
| 2 | `2024 INTERVENTION LIST(1).xlsx` | 2024 Addendum | "Sheet1" | 352 | 5 columns (no header row) |
| 3 | `VEHICLE LOAN COLLATION 2025 (Recovered)(2).xlsx` | 2025 Main List | "ARRANGED FOR APPROVAL" | 1,409 | 5 columns |
| 4 | `RETIRING , DECEASED RECORD AND 2025 PAYMENT LIST(1).xlsx` | Retirees/Deceased + Payment | **3 sheets** (see below) | 123 + 81 + 1,332 | **17 columns for retirees, 10 columns for payments** |

**Title rows found:**
- 2024 Main: "MOTOR VEHICLE ADVANCES BENEFICIARIES LIST FOR JULY 2024"
- 2024 Addendum: "INTERVENTION LIST 2024"
- 2025 Main: "MOTOR VEHICLE ADVANCES BENEFICIARIES LIST FOR 2025"

### Approval List Schema (Files 1–3 — Same 5-Column Structure)

| Column | Header | Type | Description |
|--------|--------|------|-------------|
| 0 | S/N | number | Serial number |
| 1 | NAME | string | Full name, surname first (e.g., "ADEWALE ADEOLA SAUDAT") |
| 2 | MDAS | string | MDA abbreviation / short name |
| 3 | GL | number or string | Grade Level (1–17). Sometimes zero-padded: "07" |
| 4 | AMOUNT | number | Approved loan principal (₦) |

Extra columns (5, 6, 7) exist in files 1 and 3 but are entirely null.

### Retiree/Deceased File Schema (File 4)

**Sheet 1: "2024RETIREE & DECEASED" (123 rows, 17 columns)**
**Sheet 2: "2025 RETIRE & DECEASED" (81 rows, same 17 columns)**

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

This is the **same schema as the BIR migration file** — full loan financial data, not just name/MDA/amount.

**Deceased beneficiaries** are identified by "LATE" prefix on the name:
- 2024 sheet: 6 deceased rows
- 2025 sheet: 8 deceased rows

**Sheet 3: "PAYMENT 2025" (1,332 rows, 10 columns) — OUT OF SCOPE**

This sheet contains bank account numbers, disbursement amounts, and retirement dates. It is a record of who was paid — **not our concern.** The truth is in the MDA submissions, not in disbursement records. There is variable lag between payment voucher, bank credit, and the start of deductions. This sheet is excluded from Epic 15 entirely.

### Key Data Quality Findings

**1. No Staff ID column.** None of the approval files contain a staff ID, file number, IPPIS number, or any unique employee identifier. Beneficiaries are identified **only by Name + MDA**.

**2. MDA name inconsistencies across files:**

| Intended MDA | Variants Found |
|-------------|----------------|
| Agriculture | `AGRIC`, `AGRIC.`, `AGRICULTURE` |
| High Court | `HIGH COURT`, `HIGHCOURT` |
| Governor's Office | `GOV'S OFFICE`, `GOVERNOR'S OFFICE`, `` GOVERNOR`S OFFICE `` |
| Establishment | `ESTAB`, `ESTABLISHMENT` |

71–74 unique MDA strings across files, mapping to ~47 canonical MDAs already in the system.

**3. Grade Level inconsistencies:** GL values sometimes stored as numbers (`7`), sometimes as zero-padded strings (`"07"`). 9 rows across all files have null GL but valid amounts.

**4. Amount tiers (not 1:1 with GL):**

| Amount (₦) | Typical GL Range |
|------------|-----------------|
| 250,000 | GL 1–7 |
| 400,000 | GL 6, 8 (2025 only) |
| 450,000 | GL 6–10 |
| 600,000 | GL 8–13 |
| 750,000 | GL 9–17 |
| 900,000 | GL 9 (rare) |

Amount is an independent field — not derivable from GL alone. One anomalous value: 45,000 in the Addendum (likely a typo for 450,000 at GL 7). One floating-point artifact: 750,000.002 in 2025 list.

**5. Retiree financial data has known computation errors.** The 17-column retiree file has the same schema as the BIR migration file that exposed the ALATISE problem in UAT (see Critical Dependency section below). Outstanding balances may exceed total loans, interest computations may have legacy rounding errors, instalment counts may be internally inconsistent.

---

## Upload Design: Committee Lists Pipeline

### Design Principle: Don't Clone the Migration Pipeline

The migration pipeline (Epic 3) is a 6-step wizard built for 374 files across 47 MDAs with 298+ header variants and intelligent column mapping. The committee list upload is **90% simpler** on the parsing side — fixed schemas from a single source. But the retiree file (17 columns) IS migration-like and needs three-vector validation.

**Solution:** One entry point, two tracks, purpose-built wizard that's shorter than migration but reuses proven patterns where they apply.

### Entry Point: Committee Lists Dashboard

Department Admin sees all batches at a glance — approval lists and retiree/deceased lists separated, with upload counts and dates. Can upload a new list, add an addendum to an existing batch, or create a new batch.

**Batch model:** Each upload belongs to a batch. Batches have: `id` (UUID), `label` (string, e.g., "2025 Main Approval"), `year` (nullable integer), `list_type`, `uploaded_at`, `uploaded_by`, `notes`. Addendums append to the same batch year. Ad-hoc batches (e.g., "Governor's Special Directive") use `year = null`. This supports the Committee's annual rhythm while allowing political expediency to create mid-year batches.

```
approval_batches: { id, label, year (nullable), list_type, uploaded_at, uploaded_by, notes }
approved_beneficiaries.batch_id → FK to approval_batches
```

### Track 1: Approval / Addendum Upload (3 Steps)

**Step 1 — Upload & Parse**
- Drag-and-drop the file (.xlsx, .xls)
- Select: New Batch (enter label, year, notes) or Add to Existing Batch (dropdown → addendum appends)
- System auto-detects the 5 columns — **no column mapping step needed** (fixed schema)
- Preview shows first 10 rows: S/N, Name, MDA, GL, Amount
- Flags quality issues: null GL (amber), anomalous amounts like 45,000 (amber), zero-padded GL strings (auto-normalized)
- Handles files with or without header rows (Addendum file has no headers)

**Step 2 — MDA Alias Review**
- System shows every unique MDA string found in the file alongside the best-match canonical MDA
- Department Admin confirms or corrects each mapping
- Three states per alias:
  - **Auto-matched** (high similarity to canonical MDA) — shown with ✅, can be overridden
  - **Needs review** (partial match) — shown with ⚠️, requires confirmation
  - **Unknown** (no match found) — shown with ❌, Department Admin must select from dropdown
- **Saved mappings persist.** Once `AGRIC` → `Ministry of Agriculture` is confirmed, it's remembered for all future uploads via an `mda_aliases` table. Department Admin does this work once, not every time.
- **Unknown MDAs block confirmation.** Every row must map to a canonical MDA before the upload can complete. No orphaned records.

**Step 3 — Confirm & Register**
- Summary: "1,390 beneficiaries across 47 MDAs for batch '2025 Main Approval'"
- Data quality flags listed (informational, not blocking)
- Click "Register Beneficiaries" → records created in `approved_beneficiaries` table
- Success screen: counts per MDA, link to Onboarding Pipeline Dashboard
- Confirmation language: "X beneficiaries registered" — not "X records imported"

### Track 2: Retiree / Deceased Upload (5 Steps)

**Step 1 — Upload & Parse**
- Same drag-and-drop, same batch selection
- System detects the multi-sheet file: "2024 RETIREE & DECEASED" (123 rows), "2025 RETIRE & DECEASED" (81 rows)
- System auto-skips the "PAYMENT 2025" sheet (flagged as "Not applicable — payment/disbursement records")
- Detects "LATE" prefix names → classifies as DECEASED (separate from RETIRED)
- Detects 17-column schema → activates retiree processing track (not the 5-column approval track)
- Preview shows 17-column data with clear labelling

**Step 2 — MDA Alias Review**
- Identical to Track 1 Step 2. Same component, same saved mappings reused.

**Step 3 — Three-Vector Validation** (reuses 8.0a infrastructure)
- For each retiree/deceased record, shows three computation columns:
  - **Scheme Expected:** Always computed from P × 13.33% ÷ 60 — "What VLPRS says this loan should be"
  - **Reverse Engineered:** Rate derived from the file's own Principal and Total Loan — "What the file's numbers imply internally"
  - **Committee Declared:** Raw values from the file — "What the Committee actually wrote"
- Summary card shows category breakdown (same pattern as migration validation):
  - Clean (scheme matches declared within ₦50 tolerance)
  - Variance (computation differences between vectors)
  - Requires Verification (impossible values — e.g., outstanding balance exceeds total loan, as in the ALATISE case)
- Department Admin reviews flagged records. Per-record options:
  - Use Scheme Expected (recommended)
  - Use Declared (as-is from committee)
  - Flag for manual review

**Step 4 — Match & Classify**
- System runs fuzzy matching against existing loan records (same engine as Story 15.2):
  - **Matched + Active Loan:** "This person has an active loan. Record retirement/deceased event?"
  - **Matched + Already Retired/Deceased:** "Event already recorded. Verified ✅"
  - **No Match + Full Financial Data:** "No existing loan record. Create loan record + immediate retirement from committee data?"
  - **No Match + No Financial Data:** "No loan record found — check Onboarding Pipeline"
- Deceased rows (LATE prefix) flagged separately with distinct settlement context:
  - Retired → gratuity settlement pathway (Pathway 4, FR65) — computed automatically by `gratuityProjectionService`
  - Deceased → estate/guarantor recovery — informational only, no auto-action (policy-driven, outside VLPRS)

**Step 5 — Confirm & Process**
- Summary of actions to be taken:
  - "45 retirement events to file (matched to existing loans)"
  - "6 deceased events to file"
  - "12 new loan records to create (no existing match) + immediate retirement"
  - "8 flagged for manual review (variance too high)"
- Click "Process" → individual transactions per record (not one giant batch — prevents deadlocks, allows partial success)
- Provenance tagging on every imported event: `source: 'RETIREE_LIST_BATCH_IMPORT'`, `uploadReference: <upload_id>`, `batchDate: <import_date>`
- Success screen with detailed results

### What Gets Reused From Migration Pipeline

| Component/Pattern | Reused? | How |
|---|---|---|
| File upload drag-and-drop | **Yes** | Same UI component |
| Column mapping intelligence (298+ variants) | **No** | Not needed — fixed schemas |
| Three-vector validation (8.0a) | **Yes** | Retiree track Step 3 |
| Validation summary card (category breakdown) | **Yes** | Same pattern, same colours |
| Per-record action buttons | **Yes** | Same pattern as "Establish Baseline" |
| MDA selection (Step 1 of migration) | **No** | Replaced by MDA Alias Review (new) |
| Delineation detection | **No** | Not needed — MDA is per-row |
| Period overlap check | **No** | Uses batch model instead |

### What's Novel (Doesn't Exist in Migration)

1. **MDA Alias Review** — mapping raw MDA strings to canonical MDAs with persistent saved mappings. Reusable component that could retroactively improve migration processing.
2. **Batch management** — `approval_batches` table and batch selection UX. Supports annual rhythm + ad-hoc batches.
3. **Deceased detection** — "LATE" prefix parsing and DECEASED vs RETIRED classification with distinct downstream pathways.
4. **Dual schema detection** — 5-column (approval) vs 17-column (retiree) auto-detected by column count and header matching.

---

## The Matching Problem: Why This Is the Hard Part

### The Challenge

We need to match ~2,500 approved names against ~74,000 deduction records (4,926 unique staff across 47 MDAs). Both sides of the matching key are fuzzy:

- **Name side:** Approval list says `ADEWALE ADEOLA SAUDAT`. Monthly submission might say `SAUDAT ADEWALE`, `ADEWALE SAUDAT A.`, or `ADEWALE, ADEOLA S.`. Name ordering, abbreviations, middle names, titles, and typos are all in play.
- **MDA side:** Approval list says `AGRIC`. Submission file is uploaded by the MDA officer for `Ministry of Agriculture` (canonical MDA name in system). The system knows the canonical → abbreviation mapping, but the approval list uses yet another variant. This is resolved at upload time by the MDA Alias Review step.

### The Solution: Confidence-Banded Fuzzy Matching

Rather than binary match/no-match, every potential link gets a confidence score:

| Band | Criteria | Action |
|------|----------|--------|
| **High confidence** | Exact name match + exact MDA match (after normalization) | Auto-linked. No human review needed. |
| **Medium confidence** | Fuzzy name match (>85% similarity) + exact MDA, OR exact name + fuzzy MDA | Surfaced in human review queue. Department Admin confirms or rejects. |
| **Low confidence** | Fuzzy on both name and MDA, or name similarity <85% | Flagged but not linked. Available for manual investigation. |
| **No match** | No plausible candidate found | Reported as "Approved — Not Yet Captured" |

**Why this works:**
- High-confidence auto-links handle the clean 60–70% without burdening anyone
- Medium-confidence review catches the name variants and abbreviations that a human can resolve in seconds
- Low-confidence flagging ensures nothing falls through silently
- The confidence bands shift over time — when Staff IDs are populated (Epic 13), medium-confidence matches can be auto-upgraded via ID confirmation

### Name Matching Algorithm

Recommended approach: **normalized token-set similarity** rather than simple string distance.

1. Normalize: uppercase, strip titles (Mr/Mrs/Ms/Dr/Alhaji/Alhaja/Chief/Engr/Barr/Hon/Prof), strip punctuation
2. Tokenize: split into name parts → `{"ADEWALE", "ADEOLA", "SAUDAT"}`
3. Compare: token-set ratio (order-independent) using Levenshtein or Jaro-Winkler distance
4. Score: 0–100 confidence. Thresholds: ≥95 = high, 85–94 = medium, <85 = low

Token-set matching handles name reordering (surname-first vs given-name-first) which is the most common variant in this dataset.

**Architectural decision:** Implement both Jaro-Winkler and Levenshtein-based token-set comparison during Story 15.2. Benchmark against a 20-record fixture set with known variants from the actual approval files. Pick the one with better precision at the 85% and 95% thresholds. Jaro-Winkler favours prefix matches (good for surname-first names). Levenshtein handles insertions/deletions (good for missing middle names). Empirical testing on real data decides.

---

## The Monthly Scanning Model

### How It Works

Once an approval list is uploaded for year X, the system scans that year's MDA submissions each month and builds a temporal picture.

```
Batch uploaded: 2026 Approval List (500 beneficiaries)

Month 1 (Jan submissions arrive):
  --> Scan against approval list
  --> 320 of 500 found in submissions --> 64% operational
  --> 180 not yet appearing --> tracked as "Awaiting First Deduction"

Month 2 (Feb submissions arrive):
  --> Rescan
  --> 410 of 500 found --> 82% operational
  --> 90 new matches since last scan (deductions started in Feb)
  --> 90 still awaiting

Month 3 (Mar submissions arrive):
  --> Rescan
  --> 450 of 500 found --> 90% operational
  --> 50 still awaiting after 3 months --> attention items generated
  --> Per-MDA: "Min. of Works: 8 approved, 3 not yet deducting (3 months)"

Month 6:
  --> 470 of 500 --> 94% operational
  --> 30 still awaiting after 6 months --> escalated attention
  --> AG can see: onboarding curve, MDA-by-MDA responsiveness, specific names
```

### What Gets Tracked Per Beneficiary

| Field | Description |
|-------|-------------|
| `name` | From approval list |
| `mda_raw` | MDA name as it appears in approval list |
| `mda_canonical_id` | Resolved canonical MDA (after MDA Alias Review) |
| `grade_level` | From approval list |
| `approved_amount` | From approval list |
| `batch_id` | FK to `approval_batches` table |
| `list_type` | APPROVAL / ADDENDUM / RETIREE / DECEASED |
| `upload_date` | When the list was uploaded to VLPRS |
| `match_status` | UNMATCHED / MATCHED_HIGH / MATCHED_MEDIUM / MATCHED_LOW / CONFIRMED / REJECTED |
| `matched_loan_id` | FK to loans table (once matched) |
| `match_confidence` | 0–100 score |
| `first_deduction_month` | The first month this name appeared in MDA submissions (null if never) |
| `months_since_approval` | Computed: current month minus batch approval month |
| `onboarding_status` | NOT_YET_OPERATIONAL / OPERATIONAL / RETIRED / DECEASED / WRITTEN_OFF |

### Scan Trigger

The scan runs automatically when MDA monthly submissions are processed (Epic 5 pipeline). No separate cron job needed — it piggybacks on the existing submission processing flow. When new monthly data arrives for an MDA, the system checks if any UNMATCHED or NOT_YET_OPERATIONAL approved beneficiaries for that MDA now appear in the submission.

**Architectural decision:** The scan is fire-and-forget — same pattern as three-way reconciliation (7.0i). Submission processing must not be blocked by the matching engine. If the matcher fails or is slow, submissions still process. Results are eventual, not transactional.

---

## Retirement & Deceased Verification: Connecting to Existing Settlement Pathways

### The Four Settlement Pathways (Current State)

| # | Pathway | Status in VLPRS | Loan Status Transition |
|---|---------|----------------|----------------------|
| 1 | **Standard Payroll** (50/60 months) | Fully implemented | ACTIVE → COMPLETED |
| 2 | **Accelerated** (shorter tenure, 24-48mo) | Computation ready, no tenure-change API | ACTIVE → COMPLETED |
| 3 | **Early Exit / Lump Sum** (pay principal, interest waived) | Stubbed (FR67-69, Epic 12) | ACTIVE → COMPLETED (Early Exit) |
| 4 | **Gratuity Deduction** (retired, balance from gratuity) | **Fully implemented** | ACTIVE → RETIRED |

**Pathway 4 is already built.** The infrastructure chain exists:

```
Employment event RETIRED filed (Epic 10/11)
  --> employmentEventService transitions loan to RETIRED status
  --> gratuityProjectionService computes:
      - Payroll deduction months remaining
      - Gratuity receivable months
      - Projected outstanding balance at retirement
      - Monthly gratuity deduction amount
  --> Dashboard shows total gratuity receivable exposure (FR64)
```

**Epic 15 does NOT build new settlement logic.** It builds the **intake mechanism** — the on-ramp that feeds approved names and retiree/deceased names into the existing machinery at scale.

### Retirees: Filing Into Pathway 4

When Story 15.5 matches a retiree to an existing active loan:
1. Department Admin confirms the match
2. System files a RETIRED employment event → triggers the existing Pathway 4 chain
3. `gratuityProjectionService` activates automatically
4. No new computation code needed

### Deceased: Informational Only

When Story 15.5 identifies a deceased beneficiary (LATE prefix):
1. System files a DECEASED employment event → loan transitions to DECEASED status (terminal)
2. Outstanding balance is recorded but **no automated settlement pathway** exists
3. Estate claims / guarantor recovery is policy-driven, outside VLPRS
4. VLPRS provides **visibility** (this person is deceased, here's what's owed) but not **resolution**

### Retirement Reconciliation Output

| Status | Meaning | Action |
|--------|---------|--------|
| **Matched — Retirement Recorded** | Retiree found in system, retirement event exists | Confirmed. Verify gratuity pathway is active. |
| **Matched — No Retirement Event** | Retiree found as active loan, no retirement recorded | Department Admin action: file retirement event → triggers Pathway 4 |
| **Matched — Stalled Balance** | Retiree found, no deductions 3+ months, no retirement event | High priority — this is likely the retirement gap the list surfaces |
| **Matched — Deceased** | LATE prefix, matched to active loan | File DECEASED event. Outstanding balance recorded. No auto-settlement. |
| **No Match — Full Financial Data** | 17-column data exists, no matching loan | Offer to create loan record + immediate RETIRED/DECEASED status (requires three-vector validation) |
| **No Match — Never Operational** | Retiree not found in any loan records, no full data | Connects to onboarding pipeline — approved, never deducted, now retired. Potential write-off candidate. |

### The "No Match + Full Financial Data" Pathway

The 17-column retiree data is rich enough to create loan records directly — with full financial history — rather than just reporting a gap. This means:

1. Retiree has complete data: principal, interest, outstanding balance, installments paid
2. Three-vector validation (8.0a) validates the financial data
3. Department Admin reviews all three vectors, confirms or corrects
4. System creates loan record + files RETIRED/DECEASED event in one step
5. For RETIRED: gratuity projection activates immediately
6. For DECEASED: balance recorded, status terminal

This turns the retiree list from a passive report into an active data quality accelerator.

---

## Critical Dependency: The ALATISE Problem

### What Happened

During E7+E6 retro UAT, Awwal uploaded the BIR legacy file. Record **ALATISE BOSEDE SUSAINAH** (Principal ₦450,000, 30-month tenure) exposed cascading computation errors:

| Field | Excel Value | Problem |
|-------|------------|---------|
| Outstanding Balance | ₦671,979 | **Exceeds total loan of ₦479,985** — mathematically impossible |
| Installment Count | 30 | But: 8 paid + 42 outstanding = 50, not 30 |
| Monthly Interest | ₦999.50 | Should be ₦999.75 per scheme formula (P×13.33%÷60) |

All three sources disagree:

| Source | Monthly Interest | Total Loan |
|--------|-----------------|------------|
| **Scheme Formula** (P×13.33%÷60) | ₦999.75 | **₦479,992.50** (authoritative) |
| **VLPRS** (reverse-engineered from Excel) | ₦999.45 | ₦479,983.50 |
| **Excel** (legacy spreadsheet) | ₦999.50 | ₦479,985.00 |

### Why This Matters for Epic 15

The retiree/deceased file has the **exact same 17-column structure** as the BIR file. If Story 15.5 creates loan records from retiree data without the three-vector model, it will inject the same bad data into the system — inflating Total Outstanding Receivables, MDA Health Scores, Recovery Projections, and all E6 PDF reports.

### Hard Dependency

**Prep story 8.0a (three-vector model) and 8.0b (inspect-and-correct flow) must be completed before Story 15.5 processes retiree financial data.** The three-vector validation must apply to retiree data exactly as it applies to migration data. Without these guardrails, the retiree pipeline replicates the ALATISE cascade.

Stories 15.1–15.4 (approval upload, matching, monthly scan, onboarding dashboard) have **no dependency on 8.0a** — they use 5-column approval data with no financial computation.

---

## PRD Changes Required

### Existing FRs to Extend

| FR | Current Scope | Proposed Extension |
|----|--------------|-------------------|
| **FR85** | Static cross-reference report (match/no-match) | Add: temporal tracking (month-first-seen, months-since-approval), fuzzy matching with confidence bands (high/medium/low), monthly scan cycle triggered by submission processing, retirement/deceased verification cross-reference. Rename output from "Reconciliation Report" to "Onboarding Pipeline Report" |
| **FR33(l)** | "onboarding lag" attention item (single line) | Add: configurable aging threshold (default: 3 months, escalation at 6 months), per-MDA drill-down showing approved count / operational count / awaiting count / average months-to-first-deduction |
| **FR87(5)** | "No Approval Match" observation (static) | Add: temporal context ("Staff appearing in deductions since {date} with no approval record for {batch_year}"), link to onboarding pipeline data |

### New FRs to Add

| FR | Title | Description |
|----|-------|-------------|
| **FR93** | Committee List Upload Pipeline | Department Admin can upload approved beneficiary lists and retiree/deceased lists as Excel files via a Committee Lists section. Two upload tracks: (a) Approval track (3-step) — 5-column schema auto-detected, MDA Alias Review with persistent saved mappings, batch registration. (b) Retiree/Deceased track (5-step) — 17-column schema auto-detected, MDA Alias Review, three-vector financial validation (reuses 8.0a infrastructure), fuzzy match against existing loans, confirm & process with individual transactions. Supports list types: APPROVAL, ADDENDUM (appends to existing batch), RETIREE, DECEASED ("LATE" prefix auto-detected). Flexible batch model: `approval_batches` table with optional year and required label, supporting annual Committee rhythm and ad-hoc batches. Dual schema detection by column count and header matching. Upload available to Super Admin and Department Admin. Non-punitive: "X beneficiaries registered" not "X records imported" |
| **FR94** | Onboarding Pipeline Dashboard | Super Admin and Department Admin can view an Onboarding Pipeline Dashboard showing: (a) headline metrics — total approved, total operational, total awaiting, overall operational rate (%), (b) onboarding curve — % operational over time since batch approval, one line per batch year, (c) per-MDA breakdown — approved count, operational count, awaiting count, operational rate (%), average months-to-first-deduction, sortable, (d) individual beneficiary drill-down with timeline (approved → awaiting → first deduction → current status), (e) historical approval-to-operational rates per MDA across batch years, (f) batch selector for year filtering. Both on dedicated dashboard page and populating the currently-stubbed Onboarding Pipeline Summary section in the Executive Summary report (FR37). Exportable as branded PDF. Non-punitive: "not yet operational" not "missing", "awaiting first deduction" not "non-compliant MDA" |
| **FR95** | Retirement & Deceased Verification Report | Super Admin and Department Admin can generate a Retirement & Deceased Verification Report by cross-referencing uploaded retiree/deceased lists against system loan records. Two categories with distinct pathways: (a) RETIRED — matched retirees trigger Pathway 4 (gratuity settlement via `gratuityProjectionService`), Department Admin can batch-file retirement employment events for high-confidence matches. (b) DECEASED ("LATE" prefix) — matched deceased trigger DECEASED loan status (terminal), outstanding balance recorded, no automated settlement (estate/guarantor recovery is policy-driven). Report shows: matched with event recorded (confirmed), matched with no event (action required), matched with stalled balance (high priority), no match with full financial data (offer to create loan + event), no match without data (connects to onboarding pipeline). For 17-column records with no existing loan match: three-vector validation required before loan creation. Each batch-imported event includes provenance: `source: RETIREE_LIST_BATCH_IMPORT`, `uploadReference`, `batchDate`. Individual transactions per record (not batch tx). Non-punitive: "verification status" not "processing failures" |

### MVP Feature Set Update

Add feature 15 to the MVP Feature Set (currently 14 features):

> 15. **Beneficiary Onboarding & Verification Pipeline** — Upload approved beneficiary and retiree/deceased lists from the Committee via a purpose-built Committee Lists interface (simpler than migration — no column mapping, fixed schemas). Fuzzy name matching with confidence scoring (high/medium/low bands) against operational loan records. Month-over-month onboarding scan tracking when approved beneficiaries first appear in MDA submissions. Onboarding Pipeline Dashboard with per-MDA drill-down, onboarding curves, and historical rates. Retirement verification cross-reference feeding into existing Pathway 4 (gratuity settlement). Deceased verification with informational reporting (no auto-settlement). Feeds attention items (FR33) and observations (FR87).

### Phase 2 Update

The *internal* onboarding pipeline is now MVP. The *public-facing searchable Approved Beneficiary Lists* remain Phase 2 under Public Education Portal Expansion.

### Journey Coverage Update

| Journey | Current Coverage | Updated Coverage |
|---------|-----------------|-----------------|
| Committee — Approval | Phase 2 | **Partial MVP** — approval list upload and onboarding tracking. Full committee workflow remains Phase 2 |

---

## Epic 15: Stories

### Story 15.1 — Committee List Upload Pipeline

**As a** Department Admin,
**I want to** upload approved beneficiary lists and retiree/deceased lists from the Committee,
**So that** the system has a record of who was approved and who has retired/deceased, enabling onboarding tracking and retirement verification.

**Acceptance Criteria:**

**Committee Lists Dashboard:**
- **Given** a Department Admin navigates to "Committee Lists" in the admin area, **Then** they see: a dashboard showing all uploaded batches (label, year, list type, record count, upload date), separated into Approval Lists and Retiree/Deceased Lists sections, with an "Upload New List" button for each

**Batch Management:**
- **Given** a Department Admin clicks "Upload New List", **Then** they see batch options: "Create New Batch" (enter label, optional year, notes) or "Add to Existing Batch" (dropdown of existing batches for the selected year → addendum appends)
- **Given** the batch model, **Then** `approval_batches` table stores: id (UUID), label, year (nullable), list_type, uploaded_at, uploaded_by, notes — supporting both annual Committee rhythm and ad-hoc batches

**Track 1 — Approval/Addendum Upload (3 Steps):**
- **Given** an approval/addendum Excel file is uploaded (Step 1), **When** the system parses it, **Then** it auto-detects the 5-column schema (S/N, Name, MDA, GL, Amount), handles files with or without header rows, and displays a preview of the first 10 rows. Data quality flags shown as amber indicators (null GL, anomalous amounts) but do NOT block the upload
- **Given** parsed MDA names (Step 2 — MDA Alias Review), **When** the system processes them, **Then** each unique MDA string is matched against the canonical MDA list and any previously saved aliases. Auto-matched aliases show ✅, partial matches show ⚠️ (needs review), unknown MDAs show ❌ (must select from dropdown). Confirmed mappings are saved to `mda_aliases` table and reused for all future uploads. Unknown MDAs block confirmation until resolved
- **Given** the Department Admin confirms (Step 3), **Then** records are created in `approved_beneficiaries` table with: name, mda_raw, mda_canonical_id (FK), grade_level, approved_amount, batch_id (FK), list_type (APPROVAL or ADDENDUM), upload_date, uploaded_by, match_status (UNMATCHED), onboarding_status (NOT_YET_OPERATIONAL). Confirmation shows: "X beneficiaries registered for {batch label}" with counts per MDA

**Track 2 — Retiree/Deceased Upload (5 Steps):**
- **Given** a retiree/deceased Excel file is uploaded (Step 1), **When** the system parses it, **Then** it detects the 17-column schema by column count and header matching, identifies multi-sheet structure, auto-skips the "PAYMENT 2025" sheet (flagged as "Not applicable"), detects "LATE" prefix names as DECEASED
- **Given** parsed MDA names (Step 2), **Then** same MDA Alias Review as Track 1 — identical component, same saved mappings
- **Given** 17-column financial data (Step 3 — Three-Vector Validation), **Then** for each record the system shows: Scheme Expected (P × 13.33% ÷ 60), Reverse Engineered (from file's own Principal and Total Loan), Committee Declared (raw values). Summary card shows category breakdown: Clean / Variance / Requires Verification. Department Admin reviews flagged records and selects resolution per record
- **Given** validated records (Step 4 — Match & Classify), **Then** system runs fuzzy matching against existing loan records. Shows: matched + active loan (offer retirement/deceased event), matched + already retired/deceased (verified), no match + full data (offer loan creation), no match + no data (flag for onboarding pipeline)
- **Given** the Department Admin confirms (Step 5), **Then** actions are processed in individual transactions per record with provenance tagging: `source: RETIREE_LIST_BATCH_IMPORT`, `uploadReference: <upload_id>`, `batchDate: <import_date>`. Summary shows results by action type

**Technical Notes:**
- `approved_beneficiaries` table is separate from `loans` — approved beneficiaries are not loans until matched
- `mda_aliases` table stores persistent MDA string → canonical MDA mappings
- `approval_batches` table manages batch lifecycle
- Dual schema detection: column count (5 = approval, 17 = retiree) + header keyword matching
- Track 2 Steps 3-5 have a **hard dependency on prep story 8.0a** (three-vector model)
- Track 1 has NO dependency on 8.0a
- Reuses existing RBAC: `super_admin` and `dept_admin` roles only

**FR Traceability:** FR93

---

### Story 15.2 — Fuzzy Name Matching Engine

**As a** Department Admin,
**I want** the system to automatically match approved beneficiaries against operational loan records using intelligent name matching,
**So that** I can see which approved people are already in the system without manually searching 2,500+ names.

**Acceptance Criteria:**

- **Given** approved beneficiary records exist with UNMATCHED status, **When** the matching engine runs, **Then** it compares each approved name against loan records within the same canonical MDA using normalized token-set similarity
- **Given** a match scores ≥95% similarity with exact MDA match, **Then** it is classified as HIGH confidence and auto-linked (match_status = MATCHED_HIGH, matched_loan_id populated)
- **Given** a match scores 85–94% similarity with exact MDA, OR ≥95% with fuzzy MDA match, **Then** it is classified as MEDIUM confidence and placed in the human review queue (match_status = MATCHED_MEDIUM)
- **Given** a match scores <85% on name, **Then** it is classified as LOW confidence (match_status = MATCHED_LOW) — flagged but not linked
- **Given** no plausible match is found (no candidate above 70%), **Then** the record remains UNMATCHED
- **Given** medium-confidence matches exist, **When** a Department Admin opens the review queue, **Then** they see: approved name, approval MDA, best-match loan record (staff name, MDA, principal, status), confidence score, and buttons to Confirm / Reject / Skip
- **Given** a Department Admin confirms a match, **Then** match_status updates to CONFIRMED and matched_loan_id is linked
- **Given** a Department Admin rejects a match, **Then** match_status updates to REJECTED and the record returns to the unmatched pool
- **Given** a loan record later gets a Staff ID populated (Epic 13), **When** the Staff ID matches a previously medium-confidence name match, **Then** the confidence is automatically upgraded
- **Given** common names within the same MDA produce multiple candidates, **Then** the system also compares approved_amount against loan principal as a disambiguation tiebreaker (Name + MDA + Amount triple-check for HIGH confidence)

**Name Normalization Rules:**
1. Convert to uppercase
2. Strip titles: Mr, Mrs, Ms, Dr, Alhaji, Alhaja, Chief, Engr, Barr, Hon, Prof
3. Strip punctuation: periods, commas, hyphens, apostrophes
4. Tokenize into name parts
5. Compare using order-independent token-set ratio (handles surname-first vs given-name-first)

**Technical Notes:**
- Implement both Jaro-Winkler and Levenshtein-based token-set comparison. Benchmark against a 20-record fixture set with known variants from the actual approval files. Pick the one with better precision at the 85% and 95% thresholds.
- Matching runs on upload (initial pass) and can be re-triggered manually
- Matching also runs incrementally when new loans are created via monthly submissions (Story 15.3)
- Performance target: match 2,500 approved records against 5,000 loan records in <30 seconds

**FR Traceability:** FR85 (extended), FR93

---

### Story 15.3 — Monthly Onboarding Scan

**As a** Super Admin,
**I want** the system to automatically scan each month's MDA submissions against the approved beneficiary list,
**So that** I can track when each approved beneficiary's deductions actually started and see the onboarding pipeline fill up over time.

**Acceptance Criteria:**

- **Given** an MDA submits monthly returns via the Epic 5 submission pipeline, **When** the submission is processed, **Then** the system checks if any NOT_YET_OPERATIONAL approved beneficiaries for that MDA (by canonical MDA match) now appear in the submission — using the same fuzzy matching logic from Story 15.2
- **Given** a new match is found between a submission record and an approved beneficiary, **When** the match confidence is HIGH, **Then** the beneficiary's `first_deduction_month` is set to the submission period, `onboarding_status` changes to OPERATIONAL, and `matched_loan_id` is linked to the corresponding loan record
- **Given** a new match is found with MEDIUM confidence, **Then** it is added to the review queue (same as Story 15.2) with context: "This name appeared in {MDA}'s {month} submission — confirm match?"
- **Given** a beneficiary has been NOT_YET_OPERATIONAL for ≥3 months (configurable), **Then** an attention item is generated per FR33(l): "{Name} approved in {batch_year}, {N} months without recorded deduction at {MDA}"
- **Given** a beneficiary has been NOT_YET_OPERATIONAL for ≥6 months, **Then** the attention item escalates to Gold (review) status
- **Given** the scan completes for a submission period, **Then** a scan summary is logged: "{MDA} {month}: {X} new matches found, {Y} still awaiting first deduction out of {Z} approved"
- **Given** all monthly submissions for a period have been processed, **Then** the system updates aggregate onboarding metrics: total operational %, per-MDA operational %, month-over-month change

**Technical Notes:**
- The scan is fire-and-forget — same pattern as three-way reconciliation (7.0i). Submission processing is the critical path and must not be blocked by the matching engine. Results are eventual, not transactional
- Incremental: only checks NOT_YET_OPERATIONAL records, not the entire approved list each time
- The matching engine from Story 15.2 is reused — this story adds the trigger and temporal tracking, not new matching logic

**FR Traceability:** FR85 (extended — temporal tracking), FR33(l) (extended — aging + per-MDA)

---

### Story 15.4 — Onboarding Pipeline Dashboard & Report

**As a** Super Admin (AG),
**I want to** see a dashboard showing the onboarding status of all approved beneficiaries across all MDAs,
**So that** I can answer "how many approved loans are actually operational?" and identify which MDAs are slow to start deductions.

**Acceptance Criteria:**

- **Given** a Super Admin or Department Admin navigates to the Onboarding Pipeline Dashboard, **Then** they see:
  - **Headline metrics:** Total approved (all batches), Total operational, Total awaiting, Overall operational rate (%)
  - **Batch selector:** Filter by year (2024, 2025, etc.) or view all
  - **Onboarding curve chart:** Line/area chart showing % operational over time since batch approval date (x-axis: months since approval, y-axis: % operational). One line per batch year if "all" is selected
  - **Per-MDA breakdown table:** MDA name, approved count, operational count, awaiting count, operational rate (%), average months-to-first-deduction — sortable by any column
- **Given** the user clicks on an MDA row, **Then** they see a drill-down: list of all approved beneficiaries for that MDA with columns: Name, GL, Amount, Status (Operational / Awaiting / Retired / Deceased), First Deduction Month (or "—"), Months Since Approval, Match Confidence
- **Given** the user clicks on an individual beneficiary, **Then** they see a timeline: Approved ({date}) → [Awaiting...] → First Deduction ({month}) → Current Status, with matched loan details if linked
- **Given** historical data exists across multiple batch years, **Then** the AG can view approval-to-operational rates per MDA over time: "Ministry of Works averaged 2.1 months to first deduction in 2024, 3.4 months in 2025"
- **Given** the user clicks "Export", **Then** the dashboard generates a branded PDF report with Oyo State crest, matching the existing report styling (FR54), containing: headline metrics, onboarding curve, per-MDA table, and attention items
- **Given** the Executive Summary report (FR37) is generated, **Then** the Onboarding Pipeline Summary section (currently stubbed) is populated with: total approved, total operational, operational rate, top 5 MDAs with longest average onboarding time, count of beneficiaries awaiting >3 months

**Non-Punitive Language Requirements:**
- "Not yet operational" — never "Missing" or "Failed to start"
- "Awaiting first deduction" — never "Delinquent" or "Non-compliant"
- "Onboarding timeline" — never "Delay report"
- Per-MDA rates presented as factual averages, not rankings or league tables

**FR Traceability:** FR94, FR37 (Onboarding Pipeline Summary stub)

---

### Story 15.5 — Retirement & Deceased Verification Report

**As a** Department Admin,
**I want to** cross-reference the Committee's retiree/deceased list against system records,
**So that** I can identify retirees whose retirement events haven't been recorded, activate their gratuity settlement pathways, and record deceased beneficiaries for outstanding balance tracking.

**Acceptance Criteria:**

**Matching & Classification:**
- **Given** retiree/deceased records exist in `approved_beneficiaries` (list_type = RETIREE or DECEASED), **When** a Department Admin generates the Verification Report, **Then** the system matches records against loan records using the same fuzzy matching engine (Story 15.2)
- **Given** a retiree matches a loan record that has a retirement event recorded (Epic 10/11), **Then** the status shows: "Retirement Recorded" with retirement date and gratuity pathway status (active/pending)
- **Given** a retiree matches an active loan record with NO retirement event, **Then** the status shows: "Retirement Not Yet Recorded — Action Required" with the loan details and a button to "Record Retirement Event"
- **Given** a retiree matches a loan record with a stalled balance (no deduction for 3+ months) and no retirement event, **Then** the status shows: "High Priority — Likely Retirement Gap" with prominent styling
- **Given** a deceased beneficiary (LATE prefix) matches an active loan, **Then** the status shows: "Deceased — Record Event" with outstanding balance displayed. Settlement note: "Estate/guarantor recovery — policy determination required"
- **Given** a retiree/deceased does not match any loan record but has 17-column financial data, **Then** the status shows: "No Loan Record — Create from Committee Data?" with three-vector validation preview (Scheme Expected vs Reverse Engineered vs Committee Declared)
- **Given** a retiree/deceased does not match and has no financial data, **Then** the status shows: "No Loan Record Found" with note: "Check Onboarding Pipeline — this individual may not have become operational"

**Batch Actions:**
- **Given** the Department Admin selects one or more high-confidence matched retirees, **When** they click "Batch Record Retirements", **Then** a preview shows all selected records with their matched loans and the actions that will be taken
- **Given** the Department Admin confirms the batch, **Then** the system files RETIRED employment events → triggers Pathway 4 (gratuityProjectionService activates automatically), updates loan statuses, with individual transactions per record (not one giant batch — prevents deadlocks, allows partial success)
- **Given** deceased records are selected for batch processing, **Then** the system files DECEASED employment events → loan transitions to DECEASED terminal status. Outstanding balance recorded, no automated settlement
- **Given** "No Match + Full Financial Data" records are selected, **Then** the system creates loan records using three-vector validated data + files RETIRED/DECEASED event in one step — with confirmation dialog showing all three vectors
- **Given** the batch import completes, **Then** a summary shows results by action type, and every imported event includes provenance: `source: RETIREE_LIST_BATCH_IMPORT`, `uploadReference: <upload_id>`, `batchDate: <import_date>`

**Non-Punitive Language:**
- "Retirement Not Yet Recorded" — never "Missing Retirement" or "Failed to Process"
- "Verification Status" — never "Error Report" or "Processing Failures"
- "Estate/guarantor recovery — policy determination required" — never "Unrecoverable" or "Bad Debt"

**Hard Dependency:** Prep story 8.0a (three-vector model) and 8.0b (inspect-and-correct flow) must be completed before this story processes retiree/deceased financial data. The three-vector validation must apply to retiree data exactly as it applies to migration data.

**FR Traceability:** FR95, FR65 (gratuity receivable tracking), FR87(2) (stalled balance observation)

---

### Story 15.6 — Attention Items & Observation Integration

**As a** Super Admin (AG),
**I want** the onboarding pipeline and retirement/deceased verification findings to surface in the existing attention items and observation frameworks,
**So that** I don't need to check a separate dashboard — the issues come to me.

**Acceptance Criteria:**

- **Given** approved beneficiaries have been NOT_YET_OPERATIONAL for ≥3 months (configurable threshold), **Then** an attention item appears on the executive dashboard under FR33(l): count of beneficiaries awaiting, grouped by MDA, with Amber (monitor) status
- **Given** the threshold reaches ≥6 months, **Then** the attention item escalates to Gold (review) status
- **Given** the attention item is clicked, **Then** it drills down to the Onboarding Pipeline Dashboard (Story 15.4) filtered to the relevant MDA
- **Given** retirees/deceased are identified as needing event recording (Story 15.5), **Then** an attention item appears: "{N} retirees/deceased awaiting event recording" with link to the Verification Report
- **Given** the FR87(5) "No Approval Match" observation is generated during monthly submissions, **Then** it includes temporal context: "Staff {name} appearing in {MDA} deductions since {first_deduction_month} with no approval record for any batch year. {N} months of deductions recorded without committee approval on file"
- **Given** the onboarding pipeline has per-MDA data, **Then** the MDA health score (FR36) can optionally factor in onboarding responsiveness as a future enhancement (not required for this story — just ensure the data is queryable)

**FR Traceability:** FR33(l) (extended), FR87(5) (extended), FR36 (data availability for future enhancement)

---

## Epic Dependencies & Placement

### Dependencies

| Dependency | Type | Detail |
|-----------|------|--------|
| **Epic 5 (MDA Submission)** | Hard | Story 15.3 hooks into the submission processing pipeline |
| **Epic 3 (Data Migration)** | Hard | Loan records must exist for matching to work |
| **Epic 10/11 (Temporal Profile)** | Hard | Story 15.5 checks for/creates retirement and deceased events |
| **Prep Story 8.0a (Three-Vector Model)** | Hard (Story 15.5 only) | Required for retiree/deceased financial data validation |
| **Prep Story 8.0b (Inspect-and-Correct Flow)** | Hard (Story 15.5 only) | Required for Department Admin review before acceptance |
| **Epic 4 (Executive Dashboard)** | Soft | Story 15.6 adds attention items to the existing dashboard |
| **Epic 6 (Reports)** | Soft | Story 15.4 populates the Executive Summary onboarding stub |
| **Epic 13 (Staff ID)** | Enhancement | Staff IDs auto-upgrade match confidence when populated |

### Recommended Placement

**After E8 prep stories (8.0a–8.0i), parallel with E8 core stories (8.1–8.3).**

Stories 15.1–15.4 (approval upload, matching, monthly scan, onboarding dashboard) can begin as soon as E8 prep stories are done — they use 5-column approval data with no financial computation dependency.

Story 15.5 (retirement/deceased verification) requires 8.0a and 8.0b for the three-vector validation of 17-column financial data.

Story 15.6 (attention integration) can run after 15.3 and 15.5.

```
E8 prep (8.0a-8.0i) --> E15 Stories 15.1-15.4 (can start) + E8 core (8.1-8.3) parallel
                     --> E15 Story 15.5 (after 8.0a/8.0b + 15.2 matching engine)
                     --> E15 Story 15.6 (after 15.3 + 15.5)
                     --> E12 --> E9 --> E13
```

### Sizing Estimate

| Story | Relative Size | Notes |
|-------|--------------|-------|
| 15.1 — Upload Pipeline | Medium–Large | Two-track wizard, MDA Alias Review (novel), dual schema detection, batch management |
| 15.2 — Fuzzy Matching | Large | The hardest story. Name normalization + confidence scoring + review UI + algorithm benchmarking |
| 15.3 — Monthly Scan | Small–Medium | Hooks into existing pipeline. Matching logic already built in 15.2 |
| 15.4 — Dashboard & Report | Medium–Large | New dashboard with charts, drill-down, PDF export, Executive Summary integration |
| 15.5 — Retirement/Deceased Verification | Medium–Large | Reuses matching engine. Three-vector validation, batch import, deceased handling, loan creation pathway |
| 15.6 — Attention Integration | Small | Wiring into existing frameworks. Mostly configuration |

**Total: ~6 stories, comparable to E5 (MDA Submission Pipeline) or E6 (Reports).**

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| High-confidence auto-link rate lower than 60% due to name variants | Medium | Review queue backlog for Department Admin | Start with conservative thresholds, tune after first batch. The queue IS the feature |
| Common names create false positive matches within same MDA | Medium | Wrong person linked to wrong loan | MDA + name + amount triple-check for HIGH confidence. Medium band requires human review |
| Deceased handling needs legal/policy clarity on settlement | Low | Story 15.5 scope creep | Park estate recovery as informational only — no auto-action for deceased, just reporting |
| **Retiree 17-column data has same computation flaws as ALATISE (BIR UAT finding)** | **High** | **Cascading bad data into loans, dashboards, and reports** | **Hard dependency on 8.0a/8.0b. Story 15.5 must NOT process retiree financial data until three-vector model is in place** |
| MDA alias mapping requires significant initial effort (74 unique strings) | Low | First upload slower than expected | One-time cost — mappings persist for all future uploads |

---

## Decisions Log

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| D1 | Benchmark both Jaro-Winkler and Levenshtein for name matching; pick empirically | Neither is universally better — Jaro-Winkler favours prefixes, Levenshtein handles insertions. Real data decides | Charlie (Sr Dev) |
| D2 | Monthly scan is fire-and-forget, non-blocking | Submission pipeline is critical path. Onboarding scan is enrichment — eventual, not transactional | Winston (Architect) |
| D3 | Batch retirement import: individual transactions per record with provenance tagging | Retirement events trigger `transitionLoan` with ledger entries. One tx per record prevents deadlocks, allows partial success | Charlie + Winston |
| D4 | Flexible batch model: `approval_batches` table with optional year | Political expediency may override annual Committee rhythm. Ad-hoc batches must be supported | Alice (PO) from Awwal |
| D5 | list_type enum: APPROVAL / ADDENDUM / RETIREE / DECEASED (4 values) | Deceased have different settlement pathways than living retirees. Distinct classification needed | Team consensus |
| D6 | Payment/Disbursement sheet (1,332 rows) — OUT OF SCOPE | Truth is in MDA submissions, not disbursement records. Variable lag between payment and deduction start. PII (bank accounts) adds security burden for zero value | Awwal (confirmed) |
| D7 | Story 15.1 must handle two schema types (5-column approval + 17-column retiree) | Retiree file has full financial data — auto-detected by column count and header matching | Charlie + Winston |
| D8 | No new settlement logic — Epic 15 is the on-ramp to existing Pathway 4 | `gratuityProjectionService` and `employmentEventService` already implement retirement settlement. Epic 15 files events at scale | John (PM) + Team |
| D9 | Two-track upload wizard, not a clone of migration pipeline | Migration handles 374 files, 298+ header variants, per-MDA uploads. Committee lists are fixed-schema from a single source. Different problems, shared infrastructure where it applies | John (PM) |
| D10 | MDA Alias Review with persistent saved mappings | Novel component — Department Admin confirms MDA string → canonical MDA once, reused for all future uploads. Unknown MDAs block confirmation | John (PM) |

---

## Answered Questions (from initial draft)

| # | Question | Answer | Source |
|---|----------|--------|--------|
| 1 | Where is the 2025 Retirees List? | `docs/Car_Loan/beneficiaries_retirees/RETIRING , DECEASED RECORD AND 2025 PAYMENT LIST(1).xlsx` — 3 sheets: 2024 retirees/deceased (123), 2025 retirees/deceased (81), Payment 2025 (out of scope) | Awwal |
| 2 | Aging threshold? | 3-month default, 6-month escalation. Matches typical approval-to-deduction cycle (committee → MDA → payroll → submission = 2-3 months normal) | Team consensus |
| 3 | Batch import of retirements? | Yes, with Department Admin confirmation + preview + provenance tagging. Individual transactions per record | Team (Decision 3) |
| 4 | Committee rhythm? | Annual + addendums as baseline, ad-hoc possible. Flexible batch model with optional year | Awwal (Decision 4) |
| 5 | Onboarding curve placement? | Both: headline metrics in Executive Summary stub (FR37) + full dashboard on dedicated page | Team consensus |
| 6 | Epic number? | Epic 15 confirmed | Awwal + Team |
