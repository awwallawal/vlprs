# VLPRS — Cabinet Presentation Pack

**Version:** 1.0
**Date:** February 2026

---

## PART A — COUNCIL PRESENTATION SLIDES

---

### Slide 1 — Title

**Vehicle Loan Processing & Receivables System (VLPRS)**
Digitisation, Integrity & Financial Control for the Government Car Loan Scheme

*Presented to: Executive Council / Accountant General's Office*
*Sponsoring Department: Car Loan Department, Accountant General's Office*

---

### Slide 2 — Why Council Attention Is Required

**Current Reality:**
- Manual, spreadsheet-based reporting across **62 MDAs** managing **3,100+ active loans**
- Recurrent disputes on over-deduction and loan status — including physical confrontations
- High administrative burden: thousands of paper files in cabinets
- No single source of truth for loan balances
- Retirement obligations tracked ad hoc — risk of unrecovered funds
- Verified calculation errors in **~30% of sampled MDA records**

**This is a systems problem, not a personnel problem.**

---

### Slide 3 — The Problem Landscape (As-Is)

```
62 MDAs
   │
   ▼
Manual Spreadsheets (17 columns, manually calculated)
   │  (different formulas, different interpretations)
   ▼
Car Loan Department
   │  (paper files, manual reconciliation)
   ▼
Disputes • Over-deduction • Audit Exposure • Corruption Risk
```

---

### Slide 4 — What VLPRS Does

- **Central digital system of record** for all car loans across 62 MDAs
- Accepts **payroll deductions as factual inputs** (MDAs no longer calculate)
- **Computes balances, interest, and exceptions automatically** — one formula, applied consistently
- **Tracks retirement obligations** proactively — advance notice to gratuity-processing ministries
- **Detects anomalies** (over-deduction, under-deduction, patterns) without accusation
- Preserves **existing approval authority** — committee decisions remain human

---

### Slide 5 — What VLPRS Does NOT Do

- Does **not** approve or reject loans
- Does **not** change loan policy or eligibility criteria
- Does **not** punish MDAs or staff
- Does **not** replace payroll systems
- Does **not** process gratuity payments
- Does **not** impose retrospective sanctions on legacy data

---

### Slide 6 — VLPRS Target Architecture (To-Be)

```
MDAs (Submit Payroll Facts Only — 6 fields)
   │
   ▼
Immutable Repayment Ledger
   │
   ▼
VLPRS Computation Engine
   │
   ├─► Loan Balances (Generated — no manual input)
   ├─► Exception Flags (Over/Under-deduction alerts)
   ├─► Retirement Receivables (Proactive tracking)
   ├─► Fund Pool Status (Available for new approvals)
   ▼
Audit-Ready Reports & Dashboards
```

---

### Slide 7 — Key Outcomes

| Before VLPRS | After VLPRS |
|-------------|-------------|
| Over-deduction disputes (physical altercations) | Automatic deduction stop at loan completion |
| Paper file retrieval (days, bribery risk) | Instant digital search |
| Manual calculations (30%+ error rate) | Automated, consistent computation |
| No visibility into retirement obligations | 3/6/12-month retirement pipeline forecasting |
| Unknown available fund pool | Real-time fund availability dashboard |
| Audit exposure | Full traceability, immutable ledger |

---

### Slide 8 — What Changes / What Does Not

```
UNCHANGED                          CHANGED
─────────────────────────────      ─────────────────────────────
Loan approval authority            Balance computation (automated)
Interest rate & tenure rules       Dispute resolution speed
Eligibility criteria               Audit traceability
Committee decision-making          MDA reporting burden (reduced)
Government policy                  File retrieval (instant digital)
```

---

### Slide 9 — Transition Strategy (No Shock)

```
Legacy MDA Templates ──► VLPRS Intake (digitised as declarations)
         │                    │
         │                    ▼
         └──► Variance Detection (non-punitive comparison)
                              │
                              ▼
              Reconciliation (MDA acknowledges, not "fixes")
                              │
                              ▼
              Standardised Digital Reporting (MDAs submit 6 fields only)
```

**No sanctions. No blame. No policy shock.**

---

### Slide 10 — Implementation Timeline

| Phase | Activity | Duration |
|-------|---------|----------|
| 0 | Discovery & policy lock-in | 2 weeks |
| 1 | System design & core build | 6 weeks |
| 2 | Pilot migration (3–5 MDAs) | 2 weeks |
| 3 | Full migration (all 62 MDAs) | 3 weeks |
| 4 | Parallel run | 4 weeks |
| 5 | Full adoption | 2 weeks |
| 6 | Public portal & beneficiary access | 4 weeks |

**Total: ~5 months to full internal adoption**

---

### Slide 11 — Council Decision Requested

Approval to:

1. **Adopt VLPRS** as the official system of record for the Vehicle Loan Scheme
2. **Mandate standardised MDA submissions** (6 fields, no manual calculations)
3. **Approve non-punitive reconciliation phase** for legacy data
4. **Authorise project implementation** budget and timeline

---

## PART B — AG / AUDITOR-GENERAL DEFENCE NOTE

### Purpose

This note explains how VLPRS strengthens financial control while preserving due process and existing authority structures.

### Key Assurance Points

**1. Single Source of Truth**
All loan balances are generated from an immutable repayment ledger. No manual balance adjustments are possible. Every figure is reconstructable by date, source, and authority.

**2. No Retrospective Liability**
Legacy discrepancies discovered during data migration are classified as administrative variances inherited from the prior manual system — not misconduct.

**3. Audit Traceability**
Complete derivation chain from raw deduction data to computed balance. Immutable audit logs for every state transition, every posting, every exception.

**4. Segregation of Duties**
MDAs submit deductions. VLPRS computes balances. Committee approves loans. Auditors observe. No single actor controls both input and outcome.

**5. Controlled Exception Handling**
No automatic refunds, recoveries, or sanctions. All exceptions flow through a classified, documented resolution workflow with committee oversight.

**Conclusion:** VLPRS reduces audit risk and strengthens public finance governance without disrupting existing approval authority.

---

## PART C — SAMPLE ANOMALY REPORT (SIMULATED)

### Reporting Period: April 2026

| MDA | Staff | Issue Type | System Balance (NGN) | MDA Declared (NGN) | Variance (NGN) | Status |
|-----|-------|-----------|---------------------|--------------------|--------------:|--------|
| Sports Council | Oladunjoye C.A. | Clean | 278,602.72 | 278,602.72 | 0.00 | Verified |
| Sports Council | Badmus F.G. | Interest Mismatch | 799,975.00 | 799,980.00 | -5.00 | Minor Variance |
| BIR | Tunji A. | Under-deduction | 51,942.92 | 48,500.00 | 3,442.92 | Flagged |
| MOH | Sadiq K. | Over-deduction | 112,500.00 | 97,500.00 | 15,000.00 | Alert |
| Works | Ade L. | Timing Delay | 0.00 | 12,500.00 | 12,500.00 | Info |

**Status:** Logged → Classified → Pending Committee Review

**No payroll action taken without committee decision.**

---

## PART D — PUBLIC-FACING FAQ (CABINET-ALIGNED)

**Q: Does VLPRS approve loans?**
No. All loan approvals remain with the Vehicle Loan Committee. VLPRS records and tracks decisions — it does not make them.

**Q: Can staff apply for loans online?**
The public portal provides education about the scheme and allows staff to submit an Expression of Interest (EOI). EOI submission does not constitute an application or imply approval.

**Q: Does early repayment attract penalties?**
No. The Government incentivises early repayment — staff who pay off early save on total interest and help the revolving fund serve more colleagues.

**Q: Will salary deductions change immediately after VLPRS launch?**
No. Any adjustment to salary deductions follows existing administrative review processes. VLPRS computes recommended deduction schedules but does not directly modify payroll.

**Q: Is personal data protected?**
Yes. VLPRS complies with the Nigeria Data Protection Regulation (NDPR). Only data necessary for loan administration is collected. Access is role-based and all activity is audit-logged.

**Q: What happens to my loan if I retire?**
Outstanding loan obligations at retirement are calculated by VLPRS and reported to the gratuity-processing ministry for settlement. No additional interest accrues after retirement.

**Q: How do I raise a complaint about my loan balance?**
Post-approval beneficiaries can raise discrepancy tickets through their VLPRS dashboard. Each complaint is tracked with a target resolution timeline and you'll be notified of progress.

---

## PART E — COST FRAMEWORK (CABINET-SAFE, NON-NUMERIC)

### Cost Buckets

| Category | Description |
|----------|------------|
| Software Development | Core application build, testing, deployment |
| Secure Hosting & Backup | Cloud or data centre hosting, backup systems, security |
| Data Migration & Reconciliation | Legacy data intake, validation tooling, reconciliation support |
| Training & Change Management | Workshops, materials, MDA onboarding support |
| Support & Maintenance | Post-launch support, bug fixes, system updates |

### Cost Profile

- Costs are **front-loaded** in the build and migration phases
- Savings accrue **annually** from: reduced disputes, eliminated manual reconciliation, faster processing, reduced audit exposure, improved fund rotation
- Operational cost reduces significantly after Phase 5 (full adoption)

### Value Realisation

| Benefit | Timing |
|---------|--------|
| Elimination of calculation errors | Immediate at go-live |
| Reduction in over-deduction disputes | Within 3 months |
| Improved audit readiness | Within 3 months |
| Proactive retirement tracking | Within 6 months |
| Fund pool visibility and improved rotation | Within 6 months |
| Full scheme transparency | Within 12 months |

---

*Document version: 1.0 | Consolidated from all prior working documents | February 2026*
