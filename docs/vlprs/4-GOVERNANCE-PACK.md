# VLPRS — Governance Pack

**Version:** 1.0
**Date:** February 2026

---

## Table of Contents

1. [System Designation & Authority Boundaries](#1-system-designation--authority-boundaries)
2. [Minister-Safe Policy Clauses](#2-minister-safe-policy-clauses)
3. [NDPR & Data Protection Compliance](#3-ndpr--data-protection-compliance)
4. [Audit & Financial Control Mapping](#4-audit--financial-control-mapping)
5. [Exception Resolution Policy](#5-exception-resolution-policy)
6. [MDA Submission Mandate](#6-mda-submission-mandate)
7. [Program Integrity & Abuse Detection Policy](#7-program-integrity--abuse-detection-policy)
8. [AG / Auditor-General Defence Note](#8-ag--auditor-general-defence-note)

---

## 1. System Designation & Authority Boundaries

### Official Designation

VLPRS is classified as an **administrative support system** for the Vehicle Loan Scheme of the Oyo State Government.

### What VLPRS Does

- Records and tracks loan applications, approvals, and lifecycle events
- Accepts payroll deduction data as factual inputs from MDAs
- Computes balances, interest, and exception flags automatically
- Generates reports, snapshots, and reconciliation outputs
- Preserves an immutable audit trail of all financial events

### What VLPRS Does NOT Do

- Approve or reject loan applications (committee authority is preserved)
- Change loan policy, eligibility criteria, or interest rates
- Execute payroll deductions or process gratuity payments
- Impose sanctions, penalties, or corrective actions automatically
- Replace human judgement in exception resolution

### Formal Statement

> *"The VLPRS platform records and administers decisions; it does not make them. All loan approvals, rejections, deferments, and prioritisation decisions remain the exclusive responsibility of the designated approval committee, operating under existing government financial regulations and policies."*

---

## 2. Minister-Safe Policy Clauses

These clauses are written in neutral, defensive, governance-safe language suitable for ministerial circulation.

### Clause 1 — Tracking-Only Assurance

> *"The VLPRS shall, in its initial operational phase, function strictly as a monitoring, reconciliation, and reporting system. No punitive, corrective, or enforcement actions shall be automatically triggered based solely on system-detected discrepancies."*

### Clause 2 — Non-Presumption of Irregularity

> *"Any discrepancy identified by the VLPRS shall be treated as a reconciliation variance and shall not, by default, be interpreted as misconduct, abuse, or irregularity."*

### Clause 3 — Evidence Accumulation Mandate

> *"The purpose of discrepancy tracking is to build a verified historical evidence base to support future policy refinement, system improvement, and administrative decision-making."*

### Clause 4 — Deferred Policy Enforcement

> *"Rules relating to interest forfeiture, accelerated repayment treatment, early exit penalties, or corrective measures shall only be activated following documented review, approval, and ministerial sign-off."*

### Clause 5 — Transparency Protection

> *"MDAs shall be provided access to discrepancy findings relating to their submissions prior to any escalation or policy deliberation."*

### Clause 6 — No Retrospective Liability

> *"Legacy discrepancies identified during data migration are classified as administrative variances inherited from the prior manual system and shall not be attributed as misconduct to current Reporting Officers or MDA personnel."*

### Clause 7 — Digital Intake Separation

> *"Submission of an Expression of Interest (EOI) through the Vehicle Loan public portal does not constitute loan approval, eligibility confirmation, or commitment by the Government. The digital intake process exists solely to document staff interest, create a transparent administrative pipeline, reduce physical paperwork, and improve auditability."*

---

## 3. NDPR & Data Protection Compliance

### Lawful Basis

- **Public interest** and statutory financial administration under Oyo State Government regulations
- Processing is necessary for the performance of a task carried out in the public interest

### Data Minimisation

- Only data required for loan processing, payroll reconciliation, and gratuity recovery is collected
- EOI captures minimum fields necessary for eligibility assessment
- No collection of data unrelated to the loan scheme

### Access Control

- Strict role-based permissions (7 defined roles — see PRD Section 2)
- MDA officers see only their MDA's data
- Beneficiaries see only their own records
- Auditors have read-only access

### Data Retention

| Data Type | Retention Period |
|-----------|-----------------|
| Active loan records | Until loan closure + archive |
| Closed loan records | Per government financial record retention regulations |
| Receivable records | Until settlement confirmed + retention period |
| Audit logs | Minimum 7 years (or per government regulation) |
| EOI submissions (not approved) | 24 months, then purged |

### Data Subject Rights

- Workers may **view** their loan records via the beneficiary dashboard
- Workers may **submit correction requests** via the grievance module
- Workers may **request** information about what data is held (subject access request)
- Corrections are processed through the exception workflow, not direct edit

### Privacy Notice

A privacy notice must be displayed:
- On the EOI form (public portal)
- At beneficiary onboarding (post-approval)
- On the login page

---

## 4. Audit & Financial Control Mapping

### Immutable Audit Trails

The following events generate permanent, non-editable audit records:

| Event | Data Captured |
|-------|-------------|
| Loan application submitted | Applicant, date, fields submitted |
| Loan approved/rejected | Committee decision, approving authority, date, conditions |
| Disbursement confirmed | Amount, date, recipient |
| Tenure adjustment | Old tenure, new tenure, requestor, approver |
| Monthly deduction posted | Amount, source, payroll reference, posting officer |
| Interest waiver (early exit) | Amount waived, policy basis, authorising officer |
| Retirement conversion | Retirement date, outstanding amounts, receivable raised |
| Gratuity settlement | Amount settled, source, confirmation reference |
| Clearance letter issued | Loan ID, date, issuing officer |
| Exception flag raised | Type, amounts involved, trigger rule |
| Grievance lifecycle events | Each status change with actor and timestamp |
| Login/logout | User, timestamp, IP, role |

### Segregation of Duties

| Function | Responsible Party | Restriction |
|----------|------------------|-------------|
| Submit deduction data | MDA Reporting Officer | Cannot edit Loan Master or Ledger |
| Compute balances | VLPRS (system) | No human override of calculations |
| Approve loans | Vehicle Loan Committee | Cannot post deductions |
| Post deductions to ledger | Dept officers / system | Cannot approve loans |
| Override exceptions | Super Admin | Must provide documented justification |
| View audit logs | Auditor | Read-only; no write access to any module |

### Read-Only Audit Access

External oversight bodies (Auditor-General's office, financial regulators) may be granted read-only access to:
- Complete Repayment Ledger
- All generated reports
- Full audit log
- Exception and grievance registers

---

## 5. Exception Resolution Policy

### Step 1 — Detection

System automatically flags:
- Over-deduction (actual > expected)
- Under-deduction (actual < expected)
- Installment mismatch
- Interest misalignment
- Payment on closed/non-active loan
- Duplicate posting

### Step 2 — Classification

Each exception is tagged with a type:

| Type | Description | Severity |
|------|------------|----------|
| **Timing** | Payment received in wrong month | Low |
| **Calculation** | Amount differs from expected (rounding, formula error) | Medium |
| **Payroll** | Payroll system discrepancy | Medium |
| **Policy** | Legitimate action under current rules but unusual | Low |
| **Behavioural** | Pattern suggesting policy gaming | High (committee visibility) |

### Step 3 — Freeze Position

System establishes the authoritative balance as at the cut-off date. No further changes until resolution.

### Step 4 — Notification

- MDA Reporting Officer receives variance details
- Car Loan Department receives exception summary
- **No corrective instruction issued** — only request for confirmation or clarification

### Step 5 — Review

For Medium and High severity:
- Review by Reconciliation Officer (Dept Admin)
- Legal consultation if required
- Committee review for behavioural patterns only

### Step 6 — Resolution Options

| Option | When Used |
|--------|----------|
| Forward payroll adjustment | Over-deduction confirmed; future deduction reduced |
| Credit offset | Under-deduction confirmed; next month increased |
| Refund | Exceptional — over-deduction after loan completion |
| Policy clarification | Rule ambiguity caused the variance |
| No action | Variance within tolerance or timing issue self-corrects |

### Three-Lane Resolution Flow

1. **Lane 1 — Clerical** (rounding, timing): Auto-resolved or officer-resolved
2. **Lane 2 — Structural** (payroll delays, manual overrides): Dept Admin resolution
3. **Lane 3 — Behavioural** (repeat early exits, pattern anomalies): Committee visibility

Only Lane 3 escalates to management view.

---

## 6. MDA Submission Mandate

### Administrative Directive

Each MDA must submit, monthly, the following to the Car Loan Department via VLPRS:

### A. Required Monthly Data (Per Active Loan)

| Field | Required | Description |
|-------|----------|------------|
| Staff ID (Payroll Number) | Yes | Unique identifier |
| Month of Deduction | Yes | YYYY-MM format |
| Amount Deducted | Yes | Total amount deducted from salary |
| Payroll Batch Reference | Yes | Payroll batch number |
| MDA Code | Yes | Reporting MDA |
| Event Flag | Yes | NONE / RETIRED / TRANSFERRED / DECEASED / ACCELERATED / STOPPED |

### B. What MDAs No Longer Do

- Calculate interest
- Compute outstanding balances
- Track installment counts
- Determine principal/interest split
- Maintain running total spreadsheets

> All computation is performed centrally by VLPRS.

### C. Event Disclosure (Mandatory)

MDAs must explicitly declare if, during the month, any loan-holding staff:
- Retired from service
- Transferred to another MDA
- Deceased
- Made accelerated/voluntary payment
- Had deductions stopped unexpectedly

**"No event" must be declared as `NONE`** — omission is not acceptable.

### Submission Legal Language

> *"Failure to declare loan-affecting events shall be treated as an administrative omission, subject to review."*

### Submission Deadline

- Monthly, by the **10th working day** of the following month
- Late submissions flagged in the MDA Compliance Scorecard
- Chronic late submission reported to Dept Admin and Super Admin

---

## 7. Program Integrity & Abuse Detection Policy

### Objective

To preserve fairness, sustainability, and public trust in the Vehicle Loan Scheme by identifying non-illegal but policy-distorting usage patterns.

### Key Risks Addressed

- Repeated early liquidation followed by rapid re-application (interest gaming)
- Disproportionate access frequency by specific individuals or units
- Approval pattern anomalies linked to timing or batches

### System Controls (Non-Punitive)

VLPRS shall:
- Maintain immutable loan history per staff ID
- Record loan cycle durations and settlement types
- Flag unusually short loan tenures
- Flag repeated re-entries within configurable cooling windows
- Track repeat early-exit patterns

### Governance Principle

> *"Flags generated by the system do not trigger automatic sanctions. They serve as management information, policy review inputs, and audit/oversight signals. Any corrective action shall be implemented through policy revision, not retroactive enforcement."*

### Repeat Early Exit Disclosure

**Trigger:** Staff exits loan repayment early more than once across loan cycles.

**System Actions:**
- Flag as **Repeat Early Exit Pattern**
- Insert into **Committee Review Queue**
- Apply reporting delay (exclude from "clean performance" statistics)

**Committee Note Template:**
> *"This record is presented for pattern observation only. No adverse inference is drawn at this stage."*

### Reporting Outputs

| Report | Frequency |
|--------|-----------|
| Early liquidation frequency report | Quarterly |
| Repeat beneficiary heatmap (aggregated) | Quarterly |
| Monthly anomaly summary | Monthly |
| Cool-off period compliance | As configured |

---

## 8. AG / Auditor-General Defence Note

### Purpose

This note explains how VLPRS strengthens financial control while preserving due process and existing authority structures.

### Key Assurance Points

**1. Single Source of Truth**
All loan balances are generated from an immutable repayment ledger. No manual balance adjustments are possible.

**2. No Retrospective Liability**
Legacy discrepancies discovered during migration are classified as administrative variances, not misconduct. Current personnel are not held responsible for inherited errors.

**3. Audit Traceability**
Every figure in the system is reconstructable by date, source, and authority. The complete derivation chain from raw deduction to computed balance is preserved.

**4. Segregation of Duties**
MDAs submit deduction facts. VLPRS computes balances. Loan approvals remain with the committee. No single actor can both input data and determine outcomes.

**5. Controlled Exception Handling**
No automatic refunds, recoveries, or sanctions. All exceptions go through a classified, documented resolution workflow.

**6. Policy Preservation**
VLPRS enforces existing rules; it does not create new ones. Interest rates, tenure rules, and eligibility criteria are configured by authorised policy-makers, not embedded in code.

### Conclusion

> *"VLPRS reduces audit risk, strengthens public finance governance, and provides defensible evidence for policy review — without disrupting existing approval authority or imposing retrospective sanctions."*

---

*Document version: 1.0 | Consolidated from all prior working documents | February 2026*
