# VLPRS — Rollout Plan

**Version:** 1.0
**Date:** February 2026

---

## 1. Rollout Strategy

### Approach: Phased, Non-Disruptive, Parallel-Run

VLPRS will be deployed in controlled phases to:
- Minimise institutional disruption
- Build confidence through visible wins
- Allow course correction before full adoption
- Protect all stakeholders during transition

---

## 2. Phase Overview

| Phase | Name | Duration | Key Outcome |
|-------|------|----------|-------------|
| 0 | Discovery & Policy Lock-in | 2 weeks | Requirements confirmed, policies formalised |
| 1 | System Design & Core Build | 6 weeks | Core application built and tested |
| 2 | Legacy Data Migration (Pilot) | 2 weeks | 3–5 MDAs migrated and validated |
| 3 | Full Data Migration | 3 weeks | All 62 MDAs migrated |
| 4 | Parallel Run | 4 weeks | VLPRS runs alongside legacy spreadsheets |
| 5 | Full Adoption & Legacy Retirement | 2 weeks | VLPRS becomes sole system of record |
| 6 | Phase 2 Features | 4 weeks | Public portal, beneficiary dashboard |

**Total estimated timeline: ~5 months** to full internal adoption (Phases 0–5), plus ~1 month for Phase 2 features.

---

## 3. Phase Details

### Phase 0 — Discovery & Policy Lock-in (2 Weeks)

**Objectives:**
- Confirm all loan policy rules with the HOD and committee
- Formalise interest calculation rules (including early payoff quirks)
- Obtain sign-off on governance clauses (see Governance Pack)
- Confirm RBAC roles and access levels
- Clarify meaning of "LPC IN/OUT" column
- Identify pilot MDAs (mix of data quality levels)

**Deliverables:**
- Signed-off policy rules document
- Confirmed RBAC matrix
- Pilot MDA list (3–5 MDAs)
- Approved governance clauses

**Stakeholders:** HOD (Car Loan Dept), Accountant General's Office, Vehicle Loan Committee Chair

---

### Phase 1 — System Design & Core Build (6 Weeks)

**Week 1–2: Architecture & Design**
- Database schema implementation (Loan Master, Repayment Ledger, all supporting tables)
- API design
- UI/UX wireframes (mobile-first)
- Authentication and RBAC framework

**Week 3–4: Core Module Build**
- Loan lifecycle management (state machine)
- Repayment & reconciliation engine (auto-split logic, validation matrix)
- MDA submission interface (CSV upload + manual entry)
- Loan Snapshot View (generated 16-column report)

**Week 5–6: Admin & Reporting**
- Dashboard views (Super Admin, Dept Admin, MDA Officer)
- Exception & audit module
- Report generation (monthly snapshot, variance, retirement pipeline)
- Notification framework

**Deliverables:**
- Working core application (internal modules)
- Tested calculation engine with all 4 tiers and settlement paths
- Admin dashboards

---

### Phase 2 — Legacy Data Migration — Pilot (2 Weeks)

**Pilot MDA Selection Criteria:**
- 1 MDA with clean-looking data
- 1 MDA with known data quality issues
- 1 MDA with early payoff / accelerated loans
- 1–2 additional MDAs for volume testing

**Activities:**
1. Import pilot MDA spreadsheets using migration tool
2. Run validation engine — categorise all records (CLEAN / MINOR / SIGNIFICANT / STRUCTURAL / ANOMALOUS)
3. Generate variance reports for each pilot MDA
4. Conduct reconciliation review with pilot MDA Reporting Officers
5. Refine import tool and validation rules based on findings

**Deliverables:**
- Pilot MDAs fully migrated and validated
- Refined validation rules
- Migration playbook for remaining MDAs
- Realistic error rate assessment

---

### Phase 3 — Full Data Migration (3 Weeks)

**Week 1:** Import MDAs 6–25 (batch 1)
**Week 2:** Import MDAs 26–45 (batch 2)
**Week 3:** Import MDAs 46–62 (batch 3) + reconciliation catch-up

**Per-MDA Process:**
1. Receive current Excel template from MDA
2. Run through standardised import tool
3. Validate and categorise
4. Generate variance report
5. Share with MDA Reporting Officer for acknowledgement
6. Mark as "Imported — Pending Reconciliation" or "Imported — Clean"

**Migration Dashboard Tracking:**

| Status | Meaning |
|--------|---------|
| Pending | MDA data not yet received |
| Received | File received, not yet processed |
| Imported | Data loaded into VLPRS |
| Validated | Validation engine has run |
| Reconciled | MDA has acknowledged variances |
| Certified | Dept Admin has signed off |

**Deliverables:**
- All 62 MDAs imported
- Variance reports distributed
- Reconciliation status tracked per MDA

---

### Phase 4 — Parallel Run (4 Weeks)

**What Runs in Parallel:**
- MDAs continue submitting legacy Excel templates as before
- MDAs ALSO submit the new simplified monthly data via VLPRS
- VLPRS processes the new submissions and generates reports
- Reports are compared against legacy Excel submissions

**Success Criteria for Exiting Parallel Run:**
- All 62 MDAs submitting via VLPRS consistently
- VLPRS-computed balances match or explain all variances from legacy
- No critical system bugs
- Dept Admin and Super Admin satisfied with reporting quality
- At least 3 consecutive months of clean submission from majority of MDAs

**Deliverables:**
- Parallel run comparison reports (monthly)
- Issue log and resolution tracking
- Go/no-go recommendation for full adoption

---

### Phase 5 — Full Adoption & Legacy Retirement (2 Weeks)

**Cutover Activities:**
1. Formal announcement: VLPRS is the sole system of record (effective date)
2. Legacy Excel template formally deprecated
3. MDA submission obligation moves exclusively to VLPRS
4. Legacy data archived (not deleted)
5. Final reconciliation report published

**Post-Cutover Support:**
- Dedicated support channel for 4 weeks post-cutover
- Weekly check-ins with MDA Reporting Officers
- Rapid-response for exception handling

---

### Phase 6 — Phase 2 Features (4 Weeks)

**Public Education Portal:**
- Static informational website
- EOI form with auto-generated reference number
- Approved beneficiary lists (NDPR-compliant)
- FAQs and early repayment calculator

**Beneficiary Dashboard:**
- Login with credentials issued post-approval
- View loan status, repayment history, outstanding balance
- Download approval letter, monthly statements, clearance letter
- Submit grievances and track status

**Retirement & Gratuity Module (Enhanced):**
- Proactive retirement pipeline alerts
- Automated receivable computation
- Monthly reports to gratuity-processing ministry

**Fund Pool Management Dashboard:**
- Available funds for new approvals
- Projected monthly recoveries
- Waitlist/queue tracking

---

## 4. Training Plan

### Training Audiences & Content

| Audience | Training Content | Format | Duration |
|----------|-----------------|--------|----------|
| Super Admins | Dashboard overview, policy configuration, exception override | In-person/virtual workshop | 2 hours |
| Committee Admins | Approval workflow, anomaly reports | In-person/virtual workshop | 2 hours |
| Dept Admins | Full system walkthrough, reconciliation, retirement module | Hands-on training | 1 day |
| Front Desk Officers | Application registration, document upload, balance lookup | Hands-on training | Half day |
| MDA Reporting Officers | Monthly submission process, variance review, event flagging | Virtual training (scalable) | 2 hours |
| Beneficiaries | Self-service portal tour (Phase 2) | Video tutorial + in-app guide | Self-paced |

### Training Materials

- Quick-start guides (1-pager per role)
- Video walkthroughs for key workflows
- In-app help tooltips
- FAQ document
- Support escalation contact

---

## 5. Change Management

### MDA Communication Memo

**Subject: Transition to VLPRS Monthly Loan Reporting**

MDAs are hereby informed that:

1. VLPRS will become the official system for computing loan balances
2. MDAs will no longer calculate cumulative balances, interest, or installment counts
3. Monthly responsibility is limited to reporting **actual deductions made** plus event flags
4. Legacy submissions will be reconciled **without sanctions**
5. Training and dashboards will be provided before full adoption
6. This transition is administrative and protective in nature

### Resistance Mitigation

| Anticipated Resistance | Mitigation |
|-----------------------|-----------|
| "Our old numbers are correct" | Side-by-side variance report shows exactly where and why differences exist |
| "This creates more work" | New submission is 6 fields vs 17 columns — less work, not more |
| "We'll be blamed for errors" | Governance clause: no retrospective liability |
| "System will be used to punish us" | Tracking-only assurance clause; committee sign-off required for any action |
| "We don't trust the calculations" | Worked examples for all 4 tiers published; calculation engine is auditable |

---

## 6. Support & Maintenance

### Post-Launch Support Model

| Period | Support Level |
|--------|-------------|
| Month 1 post-launch | Dedicated support (daily monitoring) |
| Months 2–3 | Active support (weekly check-ins) |
| Months 4–6 | Standard support (issue-based response) |
| Month 7+ | Maintenance mode (SLA-based) |

### Ongoing Maintenance

- Monthly system health checks
- Quarterly security reviews
- Annual policy parameter review (interest rates, tenure rules, eligibility)
- Feature requests tracked and prioritised

---

## 7. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| MDA submission compliance | 95%+ by Month 3 | % of MDAs submitting on time |
| Over-deduction incidents | 50% reduction in 6 months | Compared to pre-VLPRS baseline |
| Grievance resolution time | <10 working days average | SLA tracking |
| Data accuracy (system vs payroll) | 99%+ match rate | Monthly reconciliation |
| User adoption | All 7 roles active | Login/activity metrics |
| Retirement receivables tracked | 100% | All retiring staff with loans captured |

---

*Document version: 1.0 | Consolidated from all prior working documents | February 2026*
