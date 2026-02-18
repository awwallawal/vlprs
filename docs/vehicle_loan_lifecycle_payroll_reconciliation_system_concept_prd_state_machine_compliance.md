# Vehicle Loan Lifecycle & Payroll Reconciliation System (VLPRS)

## 1. One-Page Concept Note

### Project Title
Vehicle Loan Lifecycle & Payroll Reconciliation System (VLPRS)

### Sponsoring Office
Accountant General’s Office, Oyo State Government

### Problem Statement
The Vehicle Loan Scheme currently operates through paper-based records, fragmented tracking, and manual reconciliation with payroll deductions. This has resulted in frequent over-deductions, delayed resolution of complaints, difficulty retrieving loan files, administrative inefficiencies, and reputational risk to the Accountant General’s Office.

### Objective
To deploy a secure, internal, mobile-first web application that provides a single source of truth for vehicle loan records, aligns loan lifecycle data with payroll deductions, and significantly reduces over-deductions, disputes, and processing delays.

### Scope
- Digitization of all active and historical vehicle loan records
- Automated loan lifecycle tracking (approval → active → completion)
- Monthly payroll reconciliation support
- Role-based access for departmental officers and supervisors
- Controlled worker access for loan status and grievance submission (Phase 2)

### Expected Outcomes
- Elimination of over-deduction beyond loan tenure
- Faster resolution of worker complaints
- Improved audit readiness and transparency
- Reduced front-desk pressure and file handling

### Strategic Value
The system strengthens financial controls, protects government workers, improves public trust, and supports the Accountant General’s Office’s mandate for accurate payroll and loan administration.

---

## 2. Minister-Safe Product Requirements Document (PRD)

### Purpose
The VLPRS is an internal administrative system designed to ensure accurate tracking, recovery, and closure of vehicle loans issued to Oyo State Government employees, including payroll recovery, early settlement incentives, and retirement-triggered recovery via gratuity.

### In-Scope Functional Requirements
1. **Loan Application & Policy Management**
   - Eligibility validation by grade level
   - Automatic principal limits and interest rules
   - Locking of policy parameters at approval

2. **Loan Lifecycle Management**
   - State-based tracking from application to closure
   - Tenure adjustment processing
   - Early principal-only settlement workflow

3. **Payroll Reconciliation Support**
   - Monthly deduction schedules
   - Explicit deduction stop instructions
   - Exception and mismatch reports

4. **Retirement & Gratuity Settlement Module**
   - Identification of loan holders approaching retirement
   - Automatic conversion of active loans to receivables at retirement
   - Computation of outstanding principal and interest at retirement date
   - Generation of gratuity deduction instructions
   - Tracking of settlement confirmation from gratuity-processing ministries

5. **Receivables Management**
   - Register of outstanding gratuity-based loan receivables
   - Aging analysis (current, overdue, long outstanding)
   - Aggregate and individual receivable reporting

6. **Reporting & Oversight**
   - Dashboards for senior officials
   - Monthly operational, retirement, and exception reports
   - Historical loan and settlement records

7. **Controlled Worker Access (Phase 2)**
   - Read-only loan status and history
   - Downloadable approval and clearance letters
   - Structured grievance submission

### Out-of-Scope
- Direct payroll computation or execution
- Direct gratuity payment processing

### Non-Functional Requirements
- Mobile-first, browser-based application
- Role-based access control
- Full audit logging
- NDPR-compliant data handling

---

## 3. Loan Lifecycle State Machine (Updated with Retirement & Receivables)

### Core Principle
The loan lifecycle explicitly models payroll-based recovery, early settlement incentives, and retirement-triggered receivables. A loan is **never closed** until financial settlement is confirmed.

### States
1. **Draft**  
   Application captured but not formally submitted.

2. **Submitted**  
   Application received and awaiting committee review.

3. **Approved**  
   Loan approved with policy parameters locked (principal, interest, standard tenure).

4. **Active – Under Payroll Deduction**  
   Loan disbursed; monthly salary deductions ongoing.

5. **Tenure-Adjusted (Optional Sub-State)**  
   Staff elects shortened tenure; monthly principal recalculated, monthly interest fixed.

6. **Early Settled – Principal Only**  
   Staff pays outstanding principal in lump sum; remaining interest waived by policy.

7. **Completed (Payroll)**  
   Loan obligation fully recovered via payroll deductions.

8. **Retired – Receivable Raised**  
   Staff retires before loan completion; payroll stops and outstanding obligation becomes a government receivable.

9. **Settled via Gratuity**  
   Outstanding loan obligation deducted from gratuity by processing ministry.

10. **Closed**  
   Loan fully settled; clearance letter issued; record archived.

11. **Disputed (Exception State)**  
   Triggered by grievance, payroll mismatch, retirement discrepancy, or delayed settlement.

### Key Transitions
- Approved → Active: Disbursement confirmation
- Active → Tenure-Adjusted: Approved tenure revision request
- Active → Early Settled – Principal Only: Approved lump-sum settlement
- Active → Completed: Balance reaches zero via payroll
- Active → Retired – Receivable Raised: Retirement effective date reached
- Retired – Receivable Raised → Settled via Gratuity: Gratuity deduction confirmed
- Any State → Disputed: Exception flag raised
- Completed / Settled → Closed: Clearance documentation issued

---

## 4. NDPR & Audit Compliance Mapping

### Data Protection (NDPR)
- **Lawful Basis:** Public interest and statutory financial administration
- **Data Minimization:** Only data required for loan, payroll, and gratuity reconciliation
- **Access Control:** Strict role-based permissions
- **Retention:** Active loans retained until closure; receivable records retained per financial regulations
- **Rights Management:** Workers may view records and submit correction requests

### Audit & Governance
- Immutable audit trails for:
  - Loan approvals
  - Tenure adjustments
  - Interest waivers
  - Retirement-triggered receivables
- Clear segregation of duties
- Read-only audit access for oversight bodies

### Risk Mitigation
- System designated as administrative support, not payroll or gratuity authority
- Explicit documentation of interest waivers and gratuity deductions
- Exception escalation workflows for delayed or disputed settlements

---

## 5. Monthly Retirement & Receivables Reporting

### Current Month Retirees
- List of staff retiring in the current month with active loans
- Outstanding principal and interest at retirement
- Total receivable raised

### Upcoming Retirees (Forecast)
- Staff retiring in 3, 6, and 12 months
- Estimated receivables
- Advance notifications to gratuity-processing offices

### Overdue Receivables
- Retired staff with unsettled gratuity deductions
- Aging buckets
- Escalation status

---

## 6. Edge Case Stress-Testing (Policy-Aware)

### Death in Service
- Loan converted to receivable
- Settlement routed through death benefits processing per government policy
- Interest frozen at date of death

### Delayed Gratuity Payment
- Receivable remains open
- No additional interest accrual
- Periodic reminders and escalation

### Partial Gratuity Settlement
- Partial settlement recorded
- Balance tracked as outstanding receivable
- Loan not closed until full recovery

---

*This document reflects an expanded lifecycle and governance-aware design aligned with Oyo State Government financial administration realities.*


---

## 0. Official System Name (Locked)

### Primary Name (Recommended)
**VLPRS — Vehicle Loan Processing & Receivables System**

**Official Description:**
A government financial administration system for the intake, processing, monitoring, settlement, and receivables management of staff vehicle loans, including payroll deductions, early exit settlements, and retirement/gratuity recoveries.

**Why this is Minister-safe:**
- Avoids words like *Automated Approval*, *Decision Engine*, or *Scoring*
- Emphasizes **administration and receivables**, not discretion removal
- Aligns with Treasury, Accountant-General, and Audit language

### Acceptable Alternate (If required by Cabinet / Legal)
**VLPMRS — Vehicle Loan Processing, Monitoring & Receivables System**

---

## 1. Public-Facing Portal Sitemap (Education + Intake Only)

### Purpose of the Public Portal
The public-facing portal exists strictly for **programme education, transparency, and digital intake**, not for approval, eligibility determination, or loan management.

### Sitemap

#### A. Home
- Programme overview
- Objectives of the Vehicle Loan Scheme
- Government policy intent (staff welfare, productivity)

#### B. Eligibility & Rules (Read-only)
- Who may apply
- Tenure rules (standard 60 months, 24‑month pre‑retirement exception)
- Repayment methods (payroll, retirement/gratuity)
- Early exit and voluntary liquidation policy (principal-only payoff incentive)

#### C. How the Process Works
- Step 1: Expression of Interest (EOI)
- Step 2: Administrative vetting
- Step 3: Committee review & approval (offline)
- Step 4: Publication of approved beneficiaries
- Step 5: Digital onboarding of approved staff

*(Explicit disclaimer: submission does not imply approval)*

#### D. Expression of Interest (EOI)
- Basic biodata
- Staff ID
- Ministry/Department/Agency
- Loan category selection (no figures)
- Consent & NDPR notice
- Auto-generated reference number

#### E. Approved Beneficiary Lists
- Published by batch and month
- Searchable and paginated
- Masked identifiers (NDPR-compliant)

#### F. FAQs & Help
- Common questions
- Contact escalation guidance

---

## 2. Policy Statement: Digital Intake ≠ Approval

### Digital Intake & Approval Separation Policy

Submission of an Expression of Interest (EOI) through the Vehicle Loan public portal **does not constitute loan approval, eligibility confirmation, or commitment by the Government**.

The digital intake process exists solely to:
- document staff interest
- create a transparent and timestamped administrative pipeline
- reduce physical paperwork
- improve auditability and reporting

All loan approvals, rejections, deferments, and prioritisation decisions remain the **exclusive responsibility of the designated approval committee**, operating under existing government financial regulations and policies.

The VLPRS platform **records and administers decisions**; it does not make them.

---

## 3. PRD Addendum: Program Integrity & Abuse Detection

### Objective
To preserve fairness, sustainability, and public trust in the Vehicle Loan Scheme by identifying non‑illegal but policy‑distorting usage patterns.

### Key Risk Addressed
Rules‑compliant behaviours that undermine programme intent, including:
- repeated early liquidation followed by rapid re‑application
- disproportionate access frequency by specific individuals or units
- approval pattern anomalies linked to timing or batches

### System Controls (Non‑Punitive)
The VLPRS shall:
- maintain immutable loan history per staff ID
- record loan cycle durations and settlement types
- flag unusually short loan tenures
- flag repeated re‑entries within defined cooling windows (policy‑configurable)

### Governance Principle
Flags generated by the system **do not trigger automatic sanctions**.

They serve as:
- management information
- policy review inputs
- audit and oversight signals

Any corrective action shall be implemented through **policy revision**, not retroactive enforcement.

### Reporting Outputs
- Early liquidation frequency reports
- Repeat beneficiary heatmaps (aggregated)
- Monthly anomaly summaries for management review

---


---

# VLPRS CONSOLIDATED DATA & REPORTING SPECIFICATION

This section consolidates all prior tasks into a single, non‑redundant execution plan and implements each item as a formal specification.

---

## A. Consolidated Task List (Redundancy Removed)

1. Define Canonical Data Models
   - Loan Master Schema
   - Repayment Ledger Schema

2. Define Generated Loan Snapshot View (16 Columns)
   - Lock stored vs computed fields
   - Define exact formulas

3. Define VLPRS Loan Snapshot Report Specification
   - Purpose
   - Data sources
   - Calculation logic

4. Redesign MDA Monthly Submission Mechanism
   - Standard upload template (CSV/Excel)
   - Optional API structure

5. Define Payroll Validation & Reconciliation Matrix

6. Stress‑Test the Model Across All Settlement Paths
   - Standard repayment
   - Accelerated repayment
   - Early exit (principal‑only)
   - Retirement / gratuity settlement

---

## 1. Canonical Data Models

### 1.1 Loan Master (Authoritative, Stored)

| Field | Description |
|---|---|
| loan_id | System‑generated unique ID |
| staff_id | Government staff identifier |
| staff_name | Legal name |
| mda_code | MDA identifier |
| grade_level | Staff level |
| approved_principal | Approved loan amount |
| approved_total_interest | Total interest per scheme |
| standard_tenure_months | Default = 60 |
| approval_date | Committee approval date |
| deduction_start_month | Payroll start month |
| repayment_mode | STANDARD / ACCELERATED / EXIT / RETIREMENT |
| loan_status | ACTIVE / CLOSED / RECEIVABLE |

No derived totals are stored here.

---

### 1.2 Repayment Ledger (Event‑Based, Stored)

Each row = one financial event.

| Field | Description |
|---|---|
| ledger_id | Unique entry |
| loan_id | FK to Loan Master |
| posting_month | YYYY‑MM |
| principal_paid | Amount applied to principal |
| interest_paid | Amount applied to interest |
| payment_source | PAYROLL / VOLUNTARY / GRATUITY |
| reference_id | Payroll batch / receipt |
| posted_by | Officer/system |
| posted_at | Timestamp |

This ledger is immutable.

---

## 2. Generated Loan Snapshot View (16 Columns)

This is a **read‑only computed view** generated from Loan Master + Ledger.

### Stored vs Computed Lock

- Stored: Columns 2–7
- Computed: Columns 8–16

### Column Definitions & Formulas

| # | Column | Formula |
|---|---|---|
| 1 | Serial No | ROW_NUMBER() |
| 2 | MDA | LoanMaster.mda_code |
| 3 | Staff Name | LoanMaster.staff_name |
| 4 | Principal | LoanMaster.approved_principal |
| 5 | Interest (Total) | LoanMaster.approved_total_interest |
| 6 | Total Loan | (4 + 5) |
| 7 | No. of Installments | LoanMaster.standard_tenure_months |
| 8 | Monthly Principal | 4 ÷ 7 |
| 9 | Monthly Interest | 5 ÷ 7 |
|10 | Total Monthly Payment | 8 + 9 |
|11 | Total Interest Paid | SUM(Ledger.interest_paid) |
|12 | Outstanding Interest | 5 − 11 |
|13 | Installments Paid | COUNT(DISTINCT Ledger.posting_month) |
|14 | Installments Outstanding | 7 − 13 |
|15 | Total Loan Paid | SUM(Ledger.principal_paid + Ledger.interest_paid) |
|16 | Outstanding Balance | 6 − 15 |

No column here is manually editable.

---

## 3. VLPRS Loan Snapshot Report Specification

### Report Name
**Loan Snapshot by MDA**

### Purpose
To provide a reconciled, audit‑safe snapshot of loan status per staff, per MDA, per reporting month.

### Data Sources
- Loan Master
- Repayment Ledger

### Frequency
- Monthly (post‑payroll)

### Consumers
- Car Loan Department
- Accountant‑General
- Audit

---

## 4. MDA Monthly Submission Design

### 4.1 Standard Upload Template (Minimum Required)

| Field | Description |
|---|---|
| staff_id | Mandatory |
| loan_id (optional) | If known |
| month | YYYY‑MM |
| amount_deducted | Total amount |
| payroll_batch_ref | Payroll reference |
| mda_code | Reporting MDA |

MDAs **do not calculate interest or principal**.

---

### 4.2 System Allocation Logic

VLPRS auto‑splits amount_deducted into:
- interest_paid (up to outstanding interest)
- principal_paid (remainder)

Based on repayment_mode.

---

## 5. Payroll Validation Matrix

| Check | Rule |
|---|---|
| Missing deduction | Expected − Actual ≠ 0 |
| Over‑deduction | Actual > Expected |
| Under‑deduction | Actual < Expected |
| Duplicate posting | Same staff + month |
| Closed loan payment | loan_status ≠ ACTIVE |

Exceptions generate flags, not auto‑penalties.

---

## 6. Stress‑Test Across Settlement Paths

### 6.1 Standard Repayment
- Ledger posts fixed principal + interest
- Snapshot matches amortisation

### 6.2 Accelerated Repayment
- interest_paid fixed monthly
- principal_paid increases
- Total interest recomputed dynamically

### 6.3 Early Exit (Principal‑Only)
- interest_paid stops
- remaining principal paid
- loan_status → CLOSED
- outstanding interest set to zero (policy)

### 6.4 Retirement / Gratuity
- loan_status → RECEIVABLE
- future payroll entries blocked
- gratuity deduction ledger entries posted
- receivable tracked until cleared

---

## 7. Final Governance Rule (Locked)

> **The Repayment Ledger is the single financial truth. All reports are generated views.**

Once this is enforced, spreadsheets become unnecessary.

---

