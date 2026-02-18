# VEHICLE LOAN PROCESSING & REPORTING SYSTEM (VLPRS)

---

## PART A — COUNCIL PRESENTATION SLIDES (TEXT VERSION)

### Slide 1: Title
**Vehicle Loan Processing & Reporting System (VLPRS)**  
Digitisation, Integrity & Financial Control for the Government Car Loan Scheme

---

### Slide 2: Why Council Attention Is Required
- Manual, spreadsheet-based reporting across 62 MDAs
- Recurrent disputes on over‑deduction and loan status
- High administrative burden and audit exposure
- No single source of truth for loan balances

**This is a systems problem, not a personnel problem.**

---

### Slide 3: What VLPRS Does
- Central digital system of record for all car loans
- Accepts payroll deductions as factual inputs
- Computes balances, interest, and exceptions automatically
- Preserves existing approval authority and rules

---

### Slide 4: What VLPRS Does NOT Do
- Does not approve or reject loans
- Does not change loan policy or eligibility
- Does not punish MDAs or staff
- Does not replace payroll systems

---

### Slide 5: Key Outcomes
- Elimination of over‑deduction disputes
- Audit‑ready loan and repayment records
- Transparent retirement and gratuity settlements
- Early detection of anomalies without accusation

---

### Slide 6: Transition Strategy
- One‑time legacy data capture from existing MDA templates
- System reconciliation without retrospective sanctions
- Parallel run before full adoption

---

### Slide 7: Council Decision Requested
Approval to:
1. Adopt VLPRS as the official system of record
2. Mandate standardised MDA submissions
3. Approve non‑punitive reconciliation phase

---

## PART B — AG / AUDITOR‑GENERAL DEFENCE NOTE

### Purpose
This note explains how VLPRS strengthens financial control while preserving due process.

### Key Assurance Points
1. **Single Source of Truth**  
All balances are generated from an immutable repayment ledger.

2. **No Retrospective Liability**  
Legacy discrepancies are administrative variances, not misconduct.

3. **Audit Traceability**  
Every figure is reconstructable by date, source, and authority.

4. **Segregation of Duties**  
MDAs submit deductions; VLPRS computes balances; approvals remain human.

5. **Controlled Exception Handling**  
No automatic refunds, recoveries, or sanctions.

**Conclusion:** VLPRS reduces audit risk and strengthens public finance governance.

---

## PART C — EXCEPTION RESOLUTION WORKFLOW

### Step 1: Detection
System flags:
- Over‑deduction
- Under‑deduction
- Installment mismatch
- Interest misalignment

### Step 2: Classification
Each exception tagged as:
- Timing
- Calculation
- Payroll
- Policy

### Step 3: Freeze Position
System establishes authoritative balance as at cut‑off date.

### Step 4: Notification
- MDA Reporting Officer
- Car Loan Department
(No corrective instruction issued yet)

### Step 5: Review Committee
- Finance
- Payroll liaison
- Legal (if required)

### Step 6: Resolution Options
- Forward payroll adjustment
- Credit offset
- Refund (exceptional)
- Policy clarification

---

## PART D — PRODUCT REQUIREMENTS DOCUMENT (PRD)

### 1. Objective
Digitise the Government Car Loan Scheme to ensure accuracy, transparency, and audit compliance.

---

### 2. User Roles
- Super Admin (Commissioner, AG, Committee Chair)
- Department Admin
- Front Desk Officer
- MDA Reporting Officer
- Beneficiary (post‑approval only)

---

### 3. Core Modules
1. Loan Master Registry
2. Repayment Ledger
3. Loan Balance Engine
4. MDA Reporting Dashboard
5. Retirement & Gratuity Module
6. Exception & Audit Module
7. Public Education Portal

---

### 4. Data Model (Summary)
- Loan_Master (immutable)
- Repayment_Ledger (event‑based)
- Generated_Loan_View (computed)
- Retirement_Receivables

---

### 5. Loan Lifecycle States
Approved → Active → Accelerated / Early Exit / Retirement → Settled → Closed

---

### 6. Reporting
- Monthly MDA summaries
- Active loan balances
- Retiree receivables
- Exception reports

---

### 7. Compliance
- NDPR compliant
- Full audit logs
- Role‑based access

---

## PART E — BUSINESS PROPOSAL

### 1. Business Need
The Car Loan Scheme manages large public funds with manual tools, creating operational, reputational, and audit risks.

---

### 2. Proposed Solution
VLPRS as a secure, web‑based internal system with a public education interface.

---

### 3. Value Proposition
- Reduced administrative workload
- Protection of staff welfare
- Improved fund rotation
- Strengthened public trust

---

### 4. Implementation Phases
1. Discovery & Data Mapping
2. System Build
3. Legacy Data Migration
4. Parallel Run
5. Full Adoption

---

### 5. Governance
- Policy remains with Government
- System enforces rules, not discretion

---

### 6. Risk Mitigation
- Non‑punitive reconciliation
- Controlled rollout
- Continuous oversight

---

### 7. Conclusion
VLPRS modernises the Car Loan Scheme responsibly, without policy shock or institutional risk.

---

**END OF DOCUMENT**

