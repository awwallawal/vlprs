# VLPRS – Council Visuals, Rollout Pack & Access Control

---

## PART A — COUNCIL SLIDE DECK (VISUAL / DIAGRAMMED)

### Slide 1 — Problem Landscape (As‑Is)
```
62 MDAs
   │
   ▼
Manual Spreadsheets (17 columns)
   │  (recalculation every month)
   ▼
Car Loan Dept
   │
   ▼
Disputes • Over‑deduction • Audit Exposure
```

---

### Slide 2 — VLPRS Target Architecture (To‑Be)
```
MDAs (Payroll Facts Only)
   │
   ▼
Repayment Ledger (Immutable)
   │
   ▼
VLPRS Computation Engine
   │
   ├─ Loan Balances (Generated)
   ├─ Exception Flags
   ├─ Retirement Receivables
   ▼
Audit‑Ready Reports
```

---

### Slide 3 — Transition Model (No Shock)
```
Legacy MDA Template  ──►  VLPRS Intake
          │                  │
          │                  ▼
          └──► Variance Detection (No Punishment)
                             │
                             ▼
                    Standardised Digital Reporting
```

---

### Slide 4 — What Changes / What Does Not
```
UNCHANGED                     CHANGED
Approval Authority             Balance Computation
Loan Rules                     Dispute Resolution Speed
Tenure & Interest              Audit Traceability
```

---

## PART B — IMPLEMENTATION COST & TIMELINE MODEL

### Timeline (Indicative)
```
Month 1   Discovery & Data Mapping
Month 2   System Design & Policy Lock‑in
Month 3   Core Build (Ledger, Loans, RBAC)
Month 4   Legacy Data Intake + Parallel Run
Month 5   MDA Training + Go‑Live
```

### Cost Buckets (Non‑Numeric, Cabinet‑Safe)
- Software Development
- Secure Hosting & Backup
- Data Migration & Reconciliation
- Training & Change Management
- Support & Maintenance

*Costs are front‑loaded; savings accrue annually from dispute reduction.*

---

## PART C — CHANGE‑MANAGEMENT MEMO TO MDAs

### Subject: Transition to VLPRS Monthly Loan Reporting

MDAs are hereby informed that:

1. VLPRS will become the official system for computing loan balances
2. MDAs will no longer calculate cumulative balances
3. Monthly responsibility is limited to reporting actual deductions made
4. Legacy submissions will be reconciled without sanctions
5. Training and dashboards will be provided before full adoption

This transition is administrative and protective in nature.

---

## PART D — SAMPLE ANOMALY REPORT (SIMULATED)

### Reporting Period: March 2026

| MDA | Staff | Issue Type | System Balance | MDA Declared | Variance |
|----|------|-----------|---------------|-------------|---------|
| BIR | A. Tunji | Over‑deduction | ₦51,943 | ₦48,500 | ₦3,443 |
| MOH | K. Sadiq | Under‑deduction | ₦112,500 | ₦97,500 | ₦15,000 |
| Works | L. Ade | Timing Delay | ₦0 | ₦12,500 | ₦12,500 |

**Status:** Logged → Classified → Pending Committee Review

No payroll action taken.

---

## PART E — PUBLIC‑FACING FAQ (CABINET‑ALIGNED)

**Q: Does VLPRS approve loans?**  
No. Approval remains with the appropriate authorities.

**Q: Can staff apply online?**  
The portal provides education and expression of interest only.

**Q: Does early repayment attract penalties?**  
No. Government incentives apply as approved.

**Q: Will deductions change immediately?**  
No. Any adjustment follows administrative review.

**Q: Is personal data protected?**  
Yes. VLPRS complies with NDPR requirements.

---

## PART F — ROLE‑BASED ACCESS CONTROL (RBAC)

### 1. Super Admin (Council‑Level)
**Who:** Commissioner for Finance, Accountant‑General
**Powers:**
- Full system visibility
- Policy configuration approval
- Exception override (recorded)

---

### 2. Committee Admin
**Who:** Vehicle Loan Committee Chair & Members
**Powers:**
- Approve / reject loans (outside computation)
- View anomaly patterns
- Recommend resolutions

---

### 3. Department Admin (Car Loan Dept)
**Powers:**
- Manage loan records
- Trigger retirement settlements
- Coordinate reconciliation

---

### 4. Front Desk Officer
**Powers:**
- Register applications
- Upload documents
- View (not edit) balances

---

### 5. MDA Reporting Officer
**Powers:**
- Submit monthly deduction data
- View variances for own MDA
- Respond to reconciliation queries

---

### 6. Beneficiary (Post‑Approval)
**Powers:**
- View own loan status
- Download letters
- Raise discrepancy tickets

---

### 7. Auditor / Oversight (Read‑Only)
**Powers:**
- View ledger, reports, audit logs
- No write access

---

**END OF PACK**

