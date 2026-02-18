# VLPRS — Product Requirements Document (PRD)

**Version:** 1.0
**Status:** Draft — Consolidated
**Date:** February 2026

---

## Table of Contents

1. [Purpose & Objectives](#1-purpose--objectives)
2. [User Roles & Access Control (RBAC)](#2-user-roles--access-control-rbac)
3. [Loan Policy Rules & Interest Calculation](#3-loan-policy-rules--interest-calculation)
4. [Loan Lifecycle State Machine](#4-loan-lifecycle-state-machine)
5. [Data Models](#5-data-models)
6. [Core Modules](#6-core-modules)
7. [Notification System](#7-notification-system)
8. [Reporting & Dashboards](#8-reporting--dashboards)
9. [Public Education Portal](#9-public-education-portal)
10. [Non-Functional Requirements](#10-non-functional-requirements)

---

## 1. Purpose & Objectives

### Purpose

VLPRS is an internal administrative system designed to ensure accurate tracking, recovery, and closure of vehicle loans issued to Oyo State Government employees, including payroll recovery, early settlement incentives, retirement-triggered recovery via gratuity, and revolving fund management.

### Primary Objectives

1. Provide a **single source of truth** for all vehicle loan records
2. **Automate all calculations** — no human computes balances, interest, or installments
3. **Reconcile payroll deductions** against expected schedules monthly
4. **Track retirement obligations** proactively and manage gratuity receivables
5. **Detect anomalies** (over-deduction, under-deduction, policy-gaming) without accusation
6. **Enable worker transparency** via self-service loan status and grievance submission
7. **Manage the revolving fund pool** to maximise loan availability

### Core Design Principle

> **MDAs submit raw deduction facts. VLPRS computes all derived values. Reports are generated views. The Repayment Ledger is the single financial truth.**

---

## 2. User Roles & Access Control (RBAC)

### Role Matrix

| # | Role | Who | Access Level |
|---|------|-----|-------------|
| 1 | **Super Admin** | Commissioner for Finance, Accountant General | Full system visibility, policy configuration approval, exception override (recorded) |
| 2 | **Committee Admin** | Vehicle Loan Committee Chair & Members | Approve/reject loans (outside computation), view anomaly patterns, recommend resolutions |
| 3 | **Department Admin** | Car Loan Dept HOD, Director of Finance (AG Office) | Manage loan records, trigger retirement settlements, coordinate reconciliation, full reporting |
| 4 | **Front Desk Officer** | Car Loan Dept staff | Register applications, upload documents, view (not edit) balances, generate scoped reports |
| 5 | **MDA Reporting Officer** | Designated officer per MDA | Submit monthly deduction data, view variances for own MDA only, respond to reconciliation queries |
| 6 | **Beneficiary** | Government staff with approved loans | View own loan status, download letters (approval, clearance), raise discrepancy tickets, track grievance status |
| 7 | **Auditor / Oversight** | Audit bodies, oversight officials | Read-only access to ledger, reports, and audit logs — no write access |

### RBAC Rules

- All actions are logged with user ID, timestamp, and IP
- No role can edit the Repayment Ledger directly — entries are system-posted or officer-initiated with approval chain
- Super Admin overrides require documented justification (stored in audit trail)
- MDA Reporting Officers see only their MDA's data
- Beneficiaries see only their own loan record(s)

---

## 3. Loan Policy Rules & Interest Calculation

### 3.1 Loan Tiers by Grade Level

| Grade Level | Maximum Principal (NGN) |
|------------|----------------------|
| Levels 1–6 | 250,000 |
| Levels 7–8 | 450,000 |
| Levels 9–10 | 600,000 |
| Levels 12 and above | 750,000 |

> **Note:** There is no Level 11 in the government salary structure.

### 3.2 Interest Rate

- **Fixed rate: 13.33%** (simple interest, not compound)
- Applied uniformly across all grade levels
- Rate stored per-loan at approval time to future-proof against policy changes

### 3.3 Standard Tenure

- **60 months (5 years)** maximum
- Minimum tenure: TBD by policy (currently unconstrained)

### 3.4 Eligibility — Retirement Rule

- Staff must have **at least 24 months** of service remaining before retirement to access the loan
- Staff with fewer than 24 months are ineligible via standard channel
- Expected retirement date must be captured at application and verified

### 3.5 Interest Calculation — Standard (60 Months)

```
Total Interest       = Principal x 13.33 / 100
Monthly Principal    = Principal / 60
Monthly Interest     = Total Interest / 60
Total Monthly Payment = Monthly Principal + Monthly Interest
Total Loan Obligation = Principal + Total Interest
```

**Worked Example — Level 12+ (NGN 750,000, 60 months):**

| Item | Calculation | Value (NGN) |
|------|-----------|------------|
| Total Interest | 750,000 x 13.33% | 99,975.00 |
| Monthly Principal | 750,000 / 60 | 12,500.00 |
| Monthly Interest | 99,975 / 60 | 1,666.25 |
| Total Monthly Payment | 12,500 + 1,666.25 | 14,166.25 |
| Total Obligation | 750,000 + 99,975 | 849,975.00 |

### 3.6 Interest Calculation — Early Payoff (Accelerated Tenure)

When a staff member elects a shorter tenure (N months, where N < 60):

```
Monthly Principal (Accelerated) = Principal / N
Monthly Interest                = (Principal x 13.33% / 100) / 60    ← STAYS AT STANDARD RATE
Total Interest (Reduced)        = Monthly Interest x N
Total Monthly Payment           = Monthly Principal (Accelerated) + Monthly Interest
```

**Critical design property:** The monthly interest amount is ALWAYS calculated as `Total Standard Interest / 60`, regardless of chosen tenure. This is the incentive mechanism — by paying over fewer months, the total interest decreases proportionally while the monthly interest rate stays constant.

**Worked Example — Level 12+ (NGN 750,000, 50 months):**

| Item | Calculation | Value (NGN) |
|------|-----------|------------|
| Standard Monthly Interest | 99,975 / 60 | 1,666.25 |
| Total Interest (Reduced) | 1,666.25 x 50 | 83,312.50 |
| Monthly Principal | 750,000 / 50 | 15,000.00 |
| Total Monthly Payment | 15,000 + 1,666.25 | 16,666.25 |
| Total Obligation | 750,000 + 83,312.50 | 833,312.50 |
| **Interest Saved** | 99,975 - 83,312.50 | **16,662.50** |

### 3.7 Early Exit — Lump-Sum Principal Payoff

If a staff member pays off the remaining principal balance in a lump sum at any point:

```
Outstanding Principal = Principal - (Monthly Principal x Months Paid)
Amount Due            = Outstanding Principal ONLY
Outstanding Interest  = FORFEITED by government (policy incentive)
Loan Status           → CLOSED
```

**Worked Example — Level 12+ at Month 12 (of 60):**

| Item | Calculation | Value (NGN) |
|------|-----------|------------|
| Principal Paid to Date | 12,500 x 12 | 150,000.00 |
| Outstanding Principal | 750,000 - 150,000 | 600,000.00 |
| Staff Pays | Lump sum | 600,000.00 |
| Interest Already Paid | 1,666.25 x 12 | 19,995.00 |
| Interest Balance | 99,975 - 19,995 | 79,980.00 |
| **Interest Forfeited** | Government absorbs | **79,980.00** |

### 3.8 Retirement Settlement

When staff retires with an active loan:

- Payroll deductions **stop** at retirement effective date
- Outstanding principal + outstanding interest at retirement date = **receivable**
- Receivable is reported to gratuity-processing ministry for deduction from gratuity
- No additional interest accrues post-retirement
- Loan is not closed until settlement is confirmed

### 3.9 Complete Calculation Table — All 4 Tiers (Standard 60 Months)

| Tier | Principal | Total Interest | Monthly Principal | Monthly Interest | Monthly Payment | Total Obligation |
|------|-----------|---------------|-------------------|-----------------|----------------|-----------------|
| L1–6 | 250,000 | 33,325.00 | 4,166.67 | 555.42 | 4,722.08 | 283,325.00 |
| L7–8 | 450,000 | 59,985.00 | 7,500.00 | 999.75 | 8,499.75 | 509,985.00 |
| L9–10 | 600,000 | 79,980.00 | 10,000.00 | 1,333.00 | 11,333.00 | 679,980.00 |
| L12+ | 750,000 | 99,975.00 | 12,500.00 | 1,666.25 | 14,166.25 | 849,975.00 |

---

## 4. Loan Lifecycle State Machine

### States

| # | State | Description |
|---|-------|------------|
| 1 | **Draft** | Application captured but not formally submitted |
| 2 | **Submitted** | Application received, awaiting committee review |
| 3 | **Approved** | Loan approved; policy parameters locked (principal, interest, tenure) |
| 4 | **Rejected** | Application rejected by committee (with reason) |
| 5 | **Active — Payroll Deduction** | Loan disbursed; monthly salary deductions ongoing |
| 6 | **Tenure-Adjusted** | Staff elected shorter tenure; monthly principal recalculated, monthly interest unchanged |
| 7 | **Early Settled — Principal Only** | Staff paid outstanding principal lump sum; remaining interest forfeited |
| 8 | **Completed (Payroll)** | Loan obligation fully recovered via payroll deductions |
| 9 | **Retired — Receivable Raised** | Staff retired before completion; outstanding obligation becomes government receivable |
| 10 | **Settled via Gratuity** | Outstanding obligation deducted from gratuity by processing ministry |
| 11 | **Closed** | Loan fully settled; clearance letter issued; record archived |
| 12 | **Disputed** | Exception state — triggered by grievance, payroll mismatch, or discrepancy |
| 13 | **Deceased — Receivable Raised** | Staff died in service; obligation routed through death benefits processing |

### State Transitions

```
Draft → Submitted               (Staff/Front Desk submits application)
Submitted → Approved            (Committee approves)
Submitted → Rejected            (Committee rejects)
Approved → Active               (Disbursement confirmed)
Active → Tenure-Adjusted        (Staff requests and approved shorter tenure)
Active → Early Settled          (Lump-sum principal payoff approved)
Active → Completed              (Balance reaches zero via payroll)
Active → Retired — Receivable   (Staff retirement effective date reached)
Active → Deceased — Receivable  (Death in service confirmed)
Active → Disputed               (Exception flag raised)
Retired — Receivable → Settled  (Gratuity deduction confirmed)
Deceased — Receivable → Settled (Death benefits settlement confirmed)
Completed → Closed              (Clearance letter issued)
Settled → Closed                (Clearance documentation finalised)
Disputed → [Previous State]     (Resolution returns loan to correct state)
```

### Transition Rules

- **Approved → Active** requires disbursement confirmation and deduction start month
- **Tenure-Adjusted** recalculates monthly principal only; monthly interest stays at standard rate
- **Early Settled** requires verification of lump-sum receipt before status change
- **Retired — Receivable** triggers automatic computation of outstanding obligation at retirement date
- **Disputed** can be entered from ANY active state; resolution returns to the correct state
- All transitions are logged with timestamp, actor, and justification

---

## 5. Data Models

### 5.1 Loan Master (Authoritative, Stored)

Static, approved facts. No running totals. No derived values.

| Field | Type | Description |
|-------|------|------------|
| `loan_id` | UUID | System-generated unique identifier |
| `staff_id` | String | Government staff/payroll identifier |
| `staff_name` | String | Legal name |
| `mda_code` | String | MDA identifier |
| `grade_level` | Integer | Staff grade level |
| `grade_level_category` | Enum | L1_6 / L7_8 / L9_10 / L12_PLUS |
| `approved_principal` | Decimal | Approved loan amount (NGN) |
| `interest_rate` | Decimal | Interest rate at approval (default 13.33) |
| `approved_total_interest` | Decimal | Total interest per scheme rules |
| `standard_tenure_months` | Integer | Default = 60 |
| `actual_tenure_months` | Integer | Chosen tenure (may differ for early payoff) |
| `approval_date` | Date | Committee approval date |
| `disbursement_date` | Date | Date funds released |
| `deduction_start_month` | Date (YYYY-MM) | First payroll deduction month |
| `expected_retirement_date` | Date | Staff's projected retirement date |
| `repayment_mode` | Enum | STANDARD / ACCELERATED / EXIT / RETIREMENT |
| `loan_status` | Enum | Matches lifecycle states |
| `fund_batch_id` | String | Links to approval batch/fund cycle |
| `created_at` | Timestamp | Record creation |
| `created_by` | String | Creating officer |

### 5.2 Repayment Ledger (Event-Based, Immutable)

Each row = one financial event. This ledger is **append-only** — no edits, no deletions.

| Field | Type | Description |
|-------|------|------------|
| `ledger_id` | UUID | Unique entry identifier |
| `loan_id` | FK | Reference to Loan Master |
| `posting_month` | Date (YYYY-MM) | Month this payment applies to |
| `principal_paid` | Decimal | Amount applied to principal |
| `interest_paid` | Decimal | Amount applied to interest |
| `total_paid` | Decimal | principal_paid + interest_paid |
| `payment_source` | Enum | PAYROLL / VOLUNTARY / GRATUITY / DEATH_BENEFIT |
| `payroll_batch_ref` | String | Payroll reference number |
| `reference_id` | String | Receipt/voucher number |
| `posted_by` | String | Officer or SYSTEM |
| `posted_at` | Timestamp | When entry was created |
| `notes` | String | Optional remarks |

### 5.3 Generated Loan Snapshot View (Computed, Read-Only)

This view **looks exactly like** the 16-column report MDAs are accustomed to, but every value is computed live from the Loan Master + Repayment Ledger. No column is manually editable.

| # | Column | Source | Formula |
|---|--------|--------|---------|
| 1 | Serial No | Generated | ROW_NUMBER() |
| 2 | MDA | Loan Master | `mda_code` |
| 3 | Staff Name | Loan Master | `staff_name` |
| 4 | Principal | Loan Master | `approved_principal` |
| 5 | Total Interest | Loan Master | `approved_total_interest` |
| 6 | Total Loan | Computed | Col 4 + Col 5 |
| 7 | No. of Installments | Loan Master | `actual_tenure_months` |
| 8 | Monthly Principal | Computed | Col 4 / Col 7 |
| 9 | Monthly Interest | Computed | Col 5 / Col 7 |
| 10 | Total Monthly Payment | Computed | Col 8 + Col 9 |
| 11 | Total Interest Paid | Ledger | SUM(`interest_paid`) WHERE `loan_id` |
| 12 | Outstanding Interest | Computed | Col 5 - Col 11 |
| 13 | Installments Paid | Ledger | COUNT(DISTINCT `posting_month`) WHERE `loan_id` |
| 14 | Installments Outstanding | Computed | Col 7 - Col 13 |
| 15 | Total Loan Paid | Ledger | SUM(`total_paid`) WHERE `loan_id` |
| 16 | Outstanding Balance | Computed | Col 6 - Col 15 |

### 5.4 Retirement Receivables Register

| Field | Type | Description |
|-------|------|------------|
| `receivable_id` | UUID | Unique identifier |
| `loan_id` | FK | Reference to Loan Master |
| `retirement_date` | Date | Effective retirement date |
| `outstanding_principal` | Decimal | Principal balance at retirement |
| `outstanding_interest` | Decimal | Interest balance at retirement |
| `total_receivable` | Decimal | Total amount to recover from gratuity |
| `gratuity_ministry` | String | Ministry processing the gratuity |
| `notification_date` | Date | When gratuity ministry was notified |
| `settlement_status` | Enum | PENDING / PARTIAL / SETTLED |
| `amount_recovered` | Decimal | Amount actually recovered |
| `settlement_date` | Date | When settlement was confirmed |

### 5.5 Grievance Register

| Field | Type | Description |
|-------|------|------------|
| `grievance_id` | UUID | Unique identifier |
| `loan_id` | FK | Reference to Loan Master |
| `raised_by` | String | Staff ID or officer ID |
| `grievance_type` | Enum | OVER_DEDUCTION / UNDER_DEDUCTION / WRONG_BALANCE / CLEARANCE_DELAY / OTHER |
| `description` | Text | Details of the complaint |
| `evidence_ref` | String | Attached pay slip, statement, etc. |
| `status` | Enum | OPEN / UNDER_REVIEW / ESCALATED / RESOLVED / CLOSED |
| `assigned_to` | String | Officer handling |
| `resolution_notes` | Text | How it was resolved |
| `resolution_date` | Date | When resolved |
| `sla_deadline` | Date | Target resolution date |
| `created_at` | Timestamp | When grievance was raised |

### 5.6 Fund Pool Tracker

| Field | Type | Description |
|-------|------|------------|
| `period` | Date (YYYY-MM) | Reporting month |
| `total_fund_allocation` | Decimal | Total fund available for the scheme |
| `total_disbursed` | Decimal | Cumulative principal disbursed for active loans |
| `total_principal_recovered` | Decimal | Cumulative principal repaid |
| `total_interest_recovered` | Decimal | Cumulative interest repaid |
| `available_balance` | Decimal | Funds available for new approvals |
| `pending_approvals_value` | Decimal | Value of approved-but-not-yet-disbursed loans |
| `projected_monthly_recovery` | Decimal | Expected repayments in next month |

---

## 6. Core Modules

### 6.1 Loan Application & Approval Module

**Functions:**
- Capture loan applications (EOI from public portal or direct entry)
- Validate eligibility: grade level → loan tier, retirement date → 24-month rule
- Queue for committee review
- Record committee decision (approve/reject with reason)
- Lock policy parameters at approval (principal, interest rate, tenure)
- Generate approval letter (downloadable PDF)

**Business Rules:**
- Application does not imply approval (explicit policy statement)
- Staff with active loans cannot apply for a new loan
- Staff within 24 months of retirement: eligible but flagged for committee awareness
- All approvals require committee sign-off — no automatic approvals

### 6.2 Loan Lifecycle Management Module

**Functions:**
- Track loan through all lifecycle states
- Process tenure adjustment requests (recalculate monthly principal, keep monthly interest fixed)
- Process early exit / lump-sum settlement
- Trigger retirement conversion when retirement date is reached
- Manage death-in-service settlements
- Issue clearance letters upon closure

**Business Rules:**
- State transitions follow the state machine strictly
- All transitions logged with actor, timestamp, justification
- Clearance letter generation only when Outstanding Balance = 0

### 6.3 Repayment & Reconciliation Module

**Functions:**
- Accept monthly deduction submissions from MDAs (CSV/Excel upload or manual entry)
- Auto-split `amount_deducted` into principal and interest portions
- Post entries to Repayment Ledger
- Compare actual vs expected deductions
- Flag exceptions (over-deduction, under-deduction, duplicate, closed-loan payment)
- Generate monthly reconciliation reports

**Auto-Split Logic:**

```
expected_monthly_interest  = approved_total_interest / actual_tenure_months
expected_monthly_principal = approved_principal / actual_tenure_months
expected_monthly_payment   = expected_monthly_principal + expected_monthly_interest

IF amount_deducted == expected_monthly_payment (within tolerance of ±NGN 1):
    interest_paid  = expected_monthly_interest
    principal_paid = amount_deducted - interest_paid

IF amount_deducted > expected_monthly_payment + tolerance:
    FLAG: POTENTIAL OVER-DEDUCTION
    interest_paid  = expected_monthly_interest
    principal_paid = expected_monthly_principal
    excess         = amount_deducted - expected_monthly_payment
    → Route excess to exception queue for review

IF amount_deducted < expected_monthly_payment - tolerance:
    FLAG: UNDER-DEDUCTION
    interest_paid  = MIN(amount_deducted, expected_monthly_interest)
    principal_paid = amount_deducted - interest_paid

IF loan_status != ACTIVE:
    FLAG: PAYMENT ON NON-ACTIVE LOAN
    → Do not auto-post; route to exception queue
```

**MDA Monthly Submission Template (Minimum Required):**

| Field | Required | Description |
|-------|----------|------------|
| `staff_id` | Yes | Staff payroll identifier |
| `loan_id` | If known | System loan ID |
| `month` | Yes | YYYY-MM |
| `amount_deducted` | Yes | Total deduction amount |
| `payroll_batch_ref` | Yes | Payroll batch reference |
| `mda_code` | Yes | Submitting MDA |
| `event_flag` | Yes | NONE / RETIRED / TRANSFERRED / DECEASED / ACCELERATED / STOPPED |

> MDAs do **not** calculate interest, principal splits, balances, or installment counts.

### 6.4 Retirement & Gratuity Receivables Module

**Functions:**
- Flag staff approaching retirement (3, 6, 12 months out) based on `expected_retirement_date`
- Auto-compute outstanding obligation at projected retirement date
- Convert active loan to receivable upon retirement
- Generate deduction instruction for gratuity-processing ministry
- Track settlement status (pending, partial, settled)
- Generate monthly receivable reports: upcoming, current, and overdue

**Business Rules:**
- No additional interest accrues post-retirement
- Interest frozen at retirement effective date
- Partial gratuity settlements tracked; loan not closed until full recovery
- Monthly proactive reports pushed to gratuity-processing ministry

**Edge Cases:**
- **Death in Service:** Loan converted to receivable; settlement via death benefits; interest frozen at date of death
- **Delayed Gratuity:** Receivable remains open; periodic reminders; no additional interest
- **Partial Settlement:** Partial payment recorded; balance tracked as outstanding

### 6.5 Grievance & Exception Module

**Functions:**
- Accept grievance submissions from beneficiaries (via dashboard) and officers
- Classify grievance type (OVER_DEDUCTION, UNDER_DEDUCTION, WRONG_BALANCE, CLEARANCE_DELAY, OTHER)
- Assign to responsible officer
- Track SLA (target resolution timeframe)
- Escalate if SLA breached
- Record resolution and notify complainant
- Feed into anomaly reporting

**Grievance Lifecycle:**

```
OPEN → UNDER_REVIEW → ESCALATED (if SLA breached) → RESOLVED → CLOSED
                    → RESOLVED → CLOSED (if resolved within SLA)
```

**SLA Targets (Configurable):**

| Grievance Type | Target Resolution |
|---------------|------------------|
| Over-deduction | 10 working days |
| Under-deduction | 10 working days |
| Wrong balance | 5 working days |
| Clearance delay | 15 working days |

### 6.6 Exception & Audit Module

**Functions:**
- Aggregate all system-detected exceptions (from reconciliation, grievances, anomalies)
- Classify exceptions by type: Timing, Calculation, Payroll, Policy, Behavioural
- Maintain discrepancy register with: declared value, system value, variance, duration, financial impact
- Enable non-confrontational feedback loop (MDA confirms or clarifies, not "fixes")
- Generate anomaly summary reports for management

**Payroll Validation Matrix:**

| Check | Rule | Severity |
|-------|------|----------|
| Missing deduction | Expected - Actual != 0 | Warning |
| Over-deduction | Actual > Expected | Alert |
| Under-deduction | Actual < Expected | Warning |
| Duplicate posting | Same staff + same month | Error |
| Closed-loan payment | loan_status != ACTIVE | Alert |
| Timing mismatch | Payment month != expected month | Info |

**Program Integrity Flags (Non-Punitive):**
- Repeat early exits within 36 months → pattern flag
- Unusually short loan tenures → flag for committee awareness
- Repeat re-application within cooling window → flag
- Flags are **management information only** — no automatic sanctions

### 6.7 Fund Pool Management Module

**Functions:**
- Track total scheme fund allocation
- Calculate available balance for new approvals in real time
- Project monthly recovery based on active loan schedules
- Show impact of early payoffs on fund availability
- Provide "what-if" analysis: if X loans are approved, what is the remaining pool?
- Track fund utilisation rate

**Dashboard Widgets:**
- Total fund pool (current)
- Amount committed (active loans)
- Monthly inflow (repayments)
- Available for new approvals
- Waitlist/queue value (pending approved loans)
- Projected availability (3, 6, 12 months)

---

## 7. Notification System

### 7.1 Beneficiary Notifications

| Event | Channel | Message |
|-------|---------|---------|
| Loan approved | SMS + In-app | "Your vehicle loan of NGN [amount] has been approved." |
| Monthly deduction posted | SMS + In-app | "Deduction of NGN [amount] posted for [month]. Balance: NGN [balance]." |
| Milestone (50%, 75%) | SMS + In-app | "You have repaid [X]% of your vehicle loan." |
| Loan fully repaid | SMS + In-app | "Congratulations! Your vehicle loan is fully repaid. Download your clearance letter." |
| Grievance status update | In-app | "Your complaint [ID] status updated to [status]." |
| Approaching retirement | In-app | "Your retirement is in [X] months. Outstanding loan balance: NGN [amount]." |

### 7.2 Officer Notifications

| Event | Channel | Recipient |
|-------|---------|-----------|
| MDA submission due | Email + In-app | MDA Reporting Officer |
| MDA submission overdue | Email + In-app | MDA Reporting Officer + Dept Admin |
| Exception flagged | In-app | Reconciliation Officer |
| Grievance SLA approaching | In-app | Assigned Officer |
| Grievance SLA breached | Email + In-app | Dept Admin |

### 7.3 Management Notifications

| Event | Channel | Recipient |
|-------|---------|-----------|
| Monthly reconciliation complete | Email + In-app | Super Admin, Dept Admin |
| Staff retiring this month (with loans) | Email | Dept Admin |
| Overdue gratuity receivables | Email | Dept Admin, Super Admin |
| Anomaly pattern detected | In-app | Committee Admin |

---

## 8. Reporting & Dashboards

### 8.1 Super Admin Dashboard (360-Degree View)

- Total active loans (count and value) by MDA
- Total monthly deductions (expected vs actual)
- Over-deduction/under-deduction summary
- Retirement pipeline (upcoming retirees with loans)
- Fund pool status (available, committed, projected)
- Anomaly heatmap (MDAs with highest variance rates)
- Loan lifecycle distribution (how many in each state)

### 8.2 Department Admin Dashboard

- Active loan register (searchable, filterable)
- Monthly reconciliation status by MDA (submitted / pending / exceptions)
- Grievance queue and SLA tracking
- Retirement receivables aging report
- MDA compliance scorecard (on-time submission rate)

### 8.3 MDA Reporting Officer Dashboard

- Own MDA loan summary
- Monthly submission interface (upload/entry)
- Variance report for own MDA (system vs declared)
- Reconciliation query responses

### 8.4 Beneficiary Dashboard

- Loan status and current state
- Repayment history (month-by-month)
- Outstanding balance
- Deduction schedule (expected future deductions)
- Download: approval letter, monthly statements, clearance letter
- Grievance submission and tracking

### 8.5 Standard Reports

| Report | Frequency | Consumers |
|--------|-----------|-----------|
| Loan Snapshot by MDA | Monthly | All internal roles |
| Reconciliation Variance Report | Monthly | Dept Admin, Super Admin |
| Retirement Pipeline Report | Monthly | Dept Admin, Super Admin |
| Gratuity Receivables Aging | Monthly | Dept Admin, Super Admin |
| Fund Pool Status | Monthly | Super Admin, Committee Admin |
| Anomaly Summary | Monthly | Super Admin, Committee Admin |
| MDA Submission Compliance | Monthly | Dept Admin |
| Individual Loan Statement | On-demand | Beneficiary, Officers |
| Early Exit Pattern Report | Quarterly | Committee Admin |
| Annual Scheme Performance | Annual | Super Admin |

---

## 9. Public Education Portal

### Purpose

The public-facing portal exists strictly for **programme education, transparency, and digital intake** — not for approval, eligibility determination, or loan management.

### Sitemap

| Page | Content |
|------|---------|
| **Home** | Programme overview, objectives, government policy intent |
| **Eligibility & Rules** | Who may apply, tenure rules, repayment methods, early exit incentives, retirement rules |
| **How the Process Works** | Step-by-step: EOI → Vetting → Committee Review → Publication → Onboarding |
| **Expression of Interest (EOI)** | Form: biodata, staff ID, MDA, grade level, expected retirement date, loan category, NDPR consent |
| **Approved Beneficiary Lists** | Published by batch/month, searchable, NDPR-compliant masked identifiers |
| **Benefits of Early Repayment** | Interest savings calculator, worked examples |
| **FAQs & Help** | Common questions, contact guidance |

### EOI Form Fields

| Field | Required | Purpose |
|-------|----------|---------|
| Full Name | Yes | Identification |
| Staff ID / Payroll Number | Yes | Cross-reference |
| MDA | Yes | Routing |
| Grade Level | Yes | Loan tier determination |
| Expected Retirement Date | Yes | 24-month eligibility check |
| Loan Category Desired | Yes | Intent capture |
| Phone Number | Yes | Communication |
| Email | Optional | Communication |
| NDPR Consent | Yes | Legal compliance |

**Explicit disclaimer on EOI page:**
> *"Submission of an Expression of Interest does not constitute loan approval, eligibility confirmation, or commitment by the Government."*

---

## 10. Non-Functional Requirements

### 10.1 Technology

- **Architecture:** Mobile-first responsive web application (not native app)
- **Deployment:** Cloud-hosted or government data centre (TBD)
- **Database:** Relational (PostgreSQL recommended) — loan data is inherently relational
- **API:** RESTful API layer for future integrations
- **Offline consideration:** Progressive Web App (PWA) capability for areas with connectivity issues

### 10.2 Security

- HTTPS enforced
- Role-based access control (as defined in Section 2)
- Session management with timeout
- All actions audit-logged
- Data encryption at rest and in transit
- Brute-force protection on login

### 10.3 Compliance

- **NDPR:** Lawful basis = public interest and statutory financial administration; data minimisation; access control; retention per financial regulations; worker right to view and request corrections
- **Audit:** Immutable audit trails for approvals, tenure adjustments, interest waivers, receivables, all state transitions
- **Segregation of Duties:** MDAs submit; VLPRS computes; committees approve; auditors observe

### 10.4 Performance

- System must handle 62 MDAs, 3,100+ active loans, and growing historical records
- Monthly bulk operations (deduction processing) must complete within reasonable time
- Dashboard queries must respond within 3 seconds
- CSV/Excel import must handle 100+ records per MDA per upload

### 10.5 Availability

- 99.5% uptime target during business hours
- Regular automated backups
- Disaster recovery plan required

---

*Document version: 1.0 | Consolidated from all prior working documents | February 2026*
