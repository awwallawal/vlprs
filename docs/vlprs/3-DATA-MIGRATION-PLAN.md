# VLPRS — Data Migration Plan

**Version:** 1.0
**Date:** February 2026

---

## 1. Migration Objective

Transfer all active and historical vehicle loan records from the current paper/Excel-based system into VLPRS while:

- Preserving all existing data for audit purposes
- Identifying and flagging data quality issues (not silently accepting errors)
- Establishing the Repayment Ledger as the single source of financial truth
- Protecting MDAs and Reporting Officers from inherited blame for legacy errors

---

## 2. Core Principle

> **Legacy data is captured as "declared positions" — not accepted as system truth. VLPRS computes truth independently and surfaces variances for reconciliation.**

---

## 3. Scale

- **62 MDAs** reporting to the Car Loan Department
- **50+ active loans per MDA** (minimum 3,100 active records)
- **Unknown volume** of historical/completed loan records
- **17 columns** per record in the current MDA template format

---

## 4. Current State Assessment

### What MDAs Currently Submit

A monthly Excel spreadsheet with 17 columns (plus an 18th "LPC IN/OUT" column — meaning to be confirmed with client):

| # | Column | Status |
|---|--------|--------|
| 1 | S/N | Sequential counter |
| 2 | Name of MDA | MDA identifier |
| 3 | Name of Staff | Staff name |
| 4 | Principal | Original loan amount |
| 5 | Interest According to Installment | Total interest obligation |
| 6 | Total Loan | Principal + Interest |
| 7 | No. of Installments | Tenure in months |
| 8 | Monthly Interest | Monthly interest deduction |
| 9 | Monthly Deduction (Total) | Total monthly payment |
| 10 | Monthly Principal | Monthly principal deduction |
| 11 | Total Interest Paid | Cumulative interest paid |
| 12 | Outstanding Interest | Remaining interest |
| 13 | No. of Installments Paid | Months paid |
| 14 | No. of Installments Outstanding | Months remaining |
| 15 | Total Loan Paid | Cumulative total paid |
| 16 | Outstanding Balance | Remaining total obligation |
| 17 | Remarks | Free text |
| 18 | LPC IN/OUT | Meaning TBC |

> **Note:** Column order in actual Excel files (8=Interest, 9=Total, 10=Principal) differs from some spec documents (8=Principal, 9=Interest, 10=Total). The migration tool must handle the **actual** Excel format.

### Known Data Quality Issues (Verified from Sample Data)

From analysis of the Oyo State Sports Council April 2025 template (21 records):

| Issue | Description | Frequency |
|-------|------------|-----------|
| Wrong interest calculations | Total interest doesn't match 13.33% formula | Multiple entries |
| Swapped column values | Monthly Principal and Total Monthly Payment values swapped | Found in manual examples |
| Column 12 errors | Outstanding Interest contains wildly wrong values | ~30% of entries |
| Inconsistent early payoff formula | Some entries apply the incentive formula correctly, others don't | Multiple entries |
| Anomalous entries | Negative monthly principal, zero balances on active loans | 1+ entries |
| Undocumented interest rates | Some entries imply rates of 6.66% or 11.11% instead of 13.33% | Multiple entries |

**Conclusion:** The legacy data cannot be trusted as-is. The migration strategy must account for ~30%+ error rate.

---

## 5. Migration Phases

### Phase 0 — Reframe Legacy Data (CRITICAL — Before Any Import)

**Formally rename** the existing 17-column template:

> **"Legacy Loan Position Declaration (For Reconciliation Only)"**

Add a governance banner:

> *"Figures submitted under this template are treated as declared positions for reconciliation and audit purposes only and do not constitute system-validated loan balances."*

This protects the entire rollout from "your system is wrong" accusations.

### Phase 1 — Template Standardisation

**1a. Create standardised import template**

Design a CSV/Excel template that maps to the actual MDA column layout. Include:

- All 17 original columns (accepted as DECLARATIONS)
- Additional required fields: `staff_id` (payroll number), `mda_code`
- Validation helper columns (system will populate after import)

**1b. Classify columns by trust level**

| Trust Level | Columns | Treatment |
|------------|---------|-----------|
| **ACCEPTED** (stored in Loan Master) | 2 (MDA), 3 (Name), 4 (Principal), 7 (Installments) | Accepted as source data |
| **CLAIMS** (stored but flagged for validation) | 11 (Interest Paid), 13 (Installments Paid), 15 (Total Paid), 16 (Outstanding) | Compared against computed values |
| **IGNORED** (system will compute) | 5, 6, 8, 9, 10, 12, 14 | Replaced by VLPRS calculations |
| **METADATA** | 1 (S/N), 17 (Remarks), 18 (LPC) | Stored as reference only |

### Phase 2 — Data Ingestion & Validation

**2a. Bulk import process**

For each MDA submission:

1. Parse CSV/Excel file
2. For each row, create a **Loan Master** record using ACCEPTED columns
3. Compute all derived values using the standard formula (13.33%, 60 months or as declared)
4. Compare computed values against CLAIMS columns
5. Tag each record with a validation status

**2b. Validation status categories**

| Status | Definition | Action |
|--------|-----------|--------|
| **CLEAN** | All computed values match declared values within ±NGN 5 tolerance | Auto-approved for import |
| **MINOR VARIANCE** | Differences due to rounding (< NGN 100) | Auto-approved with variance note |
| **SIGNIFICANT VARIANCE** | Differences > NGN 100 in any column | Flagged for manual review |
| **STRUCTURAL ERROR** | Interest rate doesn't match 13.33%, impossible values, missing data | Flagged — requires officer investigation |
| **ANOMALOUS** | Negative values, more installments paid than months elapsed, etc. | Quarantined — escalated to Dept Admin |

**2c. What to do with CLAIMS data that doesn't match**

- Store the MDA's declared values in a `legacy_declarations` table for audit
- Use VLPRS-computed values as the system truth going forward
- Generate a variance report per MDA showing every discrepancy

### Phase 3 — Reconciliation Sprint

**3a. Per-MDA reconciliation reports**

For each MDA, generate a side-by-side report:

```
Staff: [Name]
Loan: [Principal] at [Tenure] months
                          MDA Declared    VLPRS Computed    Variance
Total Interest            27,771.00       33,325.00         -5,554.00
Outstanding Balance       51,942.88       51,942.92         -0.04
Installments Paid         49              49                 0
...
```

**3b. MDA review process**

1. Share variance report with MDA Reporting Officer
2. MDA **acknowledges** (not "fixes") discrepancies
3. Discrepancies classified as: Clerical / Structural / Behavioural
4. Only behavioural discrepancies escalate to committee visibility

**3c. Governance language for discrepancy communication**

> *"The following variances were detected between your declared loan positions and system-computed positions. Please review and confirm or provide clarification. No corrective action is required at this stage."*

### Phase 4 — Repayment History Reconstruction

For each imported loan, reconstruct the Repayment Ledger:

**Option A — Summary Entry (Recommended for initial migration)**

Create a single ledger entry per loan representing cumulative payments to date:

```
ledger_id:       [generated]
loan_id:         [from import]
posting_month:   [migration month]
principal_paid:  [computed: monthly_principal × installments_paid]
interest_paid:   [computed: monthly_interest × installments_paid]
payment_source:  MIGRATION
reference_id:    LEGACY-IMPORT-[batch_id]
notes:           "Migrated from legacy records. Declared installments: [N]"
```

**Option B — Monthly Reconstruction (If historical month data is available)**

Create individual ledger entries for each historical month. This requires knowing the exact deduction history, which may not be available from the current spreadsheets.

**Recommendation:** Start with Option A. If detailed payroll history becomes available later, it can be retroactively loaded.

### Phase 5 — Parallel Run

- Set a cutover date (e.g., Month 1 of new financial year)
- From cutover: all new deductions go through VLPRS only
- MDAs submit monthly data via the new simplified template (staff_id, month, amount, payroll_ref)
- Legacy spreadsheet continues for 3 months alongside VLPRS for comparison
- After 3 months of clean parallel run: legacy spreadsheet retired

### Phase 6 — Certification & Closure

- Each MDA signs off that their migrated data has been reviewed
- Dept Admin certifies the reconciliation is complete
- Legacy data archived (not deleted)
- VLPRS becomes the sole system of record

---

## 6. Migration Timeline

| Week | Activity |
|------|---------|
| 1–2 | Build import tool, validation engine, and reporting templates |
| 3–4 | Pilot with 3–5 MDAs (selected for data quality variation) |
| 5 | Refine based on pilot findings |
| 6–8 | Bulk import for remaining 57–59 MDAs |
| 9–10 | Reconciliation sprint (MDA reviews and acknowledgements) |
| 11–12 | Parallel run begins |
| 13+ | Legacy template retired after 3 clean months |

---

## 7. Migration Tooling Requirements

| Tool | Purpose |
|------|---------|
| Excel/CSV parser | Read actual MDA spreadsheet format (handles merged headers, varying column order) |
| Validation engine | Apply formula checks, flag variances, categorise errors |
| Variance report generator | Per-MDA side-by-side comparison (PDF/CSV export) |
| Bulk import API | Ingest validated records into Loan Master and Repayment Ledger |
| Migration dashboard | Track import status per MDA (pending, imported, validated, reconciled, certified) |
| Legacy archive store | Store original MDA declarations unchanged for audit reference |

---

## 8. Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| MDAs resist by claiming "system is wrong" | Legacy data formally labelled as declarations, not truth |
| Reporting Officers blamed for legacy errors | Governance clause: no retrospective liability |
| Data quality worse than expected (>30% errors) | Validation categories allow triage; anomalous records quarantined, not rejected |
| Historical payroll data unavailable | Summary entry approach (Option A) handles missing history |
| Political pushback on exposing discrepancies | Management sees patterns and aggregates only, not individual blame |

---

*Document version: 1.0 | Consolidated from all prior working documents | February 2026*
