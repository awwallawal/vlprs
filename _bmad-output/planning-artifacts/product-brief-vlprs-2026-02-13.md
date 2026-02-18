---
stepsCompleted: [1, 2, 3, 4, 5, 6]
inputDocuments:
  - _bmad-output/brainstorming/brainstorming-session-2026-02-13.md
  - docs/vlprs/1-CONCEPT-NOTE.md
  - docs/vlprs/2-PRD.md
  - docs/vlprs/3-DATA-MIGRATION-PLAN.md
  - docs/vlprs/4-GOVERNANCE-PACK.md
  - docs/vlprs/5-ROLLOUT-PLAN.md
  - docs/vlprs/6-CABINET-PRESENTATION.md
  - docs/vlprs_council_slides_rollout_pack_rbac.md
  - docs/vlprs_cabinet_pack_prd_business_proposal.md
  - docs/vehicle_loan_lifecycle_payroll_reconciliation_system_concept_prd_state_machine_compliance.md
  - docs/wordvomit.txt
  - docs/dump.md
  - docs/Full_Context.md
date: 2026-02-13
lastEdited: '2026-02-15'
editHistory:
  - date: '2026-02-15'
    changes: 'PRD delta cascade: Updated all "6-field" references to "8-field" with conditional Event Date and Cessation Reason. Updated MDA count from 62 to 63 throughout. Added MVP features 11 (Staff Temporal Profile & Employment Event Tracking) and 12 (User & Staff Record Management). Expanded MDA Submission Interface with pre-submission checkpoint and conditional fields. Updated Mr. Okonkwo persona with temporal/event/user management capabilities. Updated MDA Officer role description. Moved Historical Data Archaeology and Retirement-Gratuity Handshake from Phase 2 to MVP (as parts of features 11 and 12). Added Staff ID duplicate detection to validation engine.'
author: Awwal
project_name: vlprs
---

# Product Brief: VLPRS

<!-- Content will be appended sequentially through collaborative workflow steps -->

## Executive Summary

**VLPRS (Vehicle Loan Processing & Receivables System)** is a secure, mobile-first web application that replaces the fragmented, paper-and-spreadsheet-based vehicle loan administration of the Oyo State Government with a single, authoritative digital system of record.

Sponsored by the Accountant General's Office and serving the Car Loan Department, VLPRS covers 63 Ministries, Departments, and Agencies (MDAs) and 3,100+ active loan beneficiaries across the state workforce. The system transforms how vehicle loans are tracked, reconciled, and reported — shifting from distributed manual computation to centralised automated truth.

**The core proposition is integrity:** for the first time, the Accountant General will have a complete and trustworthy picture of the State's vehicle loan obligations — who owes what, who's been overpaid, what's coming back, and what's available for new approvals. Simultaneously, every government worker with a car loan gains a guarantee they've never had: **the certainty that their salary deductions will stop the moment their obligation is fulfilled.**

Truth for the AG. Protection for the worker. One system.

---

## Core Vision

### Problem Statement

The Oyo State Vehicle Loan Scheme operates through paper-based records and fragmented Excel spreadsheets across 63 MDAs. Each MDA independently calculates interest, balances, and installment tracking using a 17-column template — producing a verified error rate of approximately 30% in sampled data. These are not isolated mistakes by careless officers. When 63 independent calculators apply the same financial rules manually across thousands of records over 60-month loan tenures, numerical divergence is mathematically inevitable. The architecture itself guarantees inaccuracy.

The Accountant General — the person upon whom accountability rests — is left in an untenable position: answerable for numbers that nobody can verify, dependent on a system structurally incapable of self-correction, and unable to see problems until they have already caused harm.

### Problem Impact

**On the Accountant General:**
The AG cannot answer the most basic executive question — "What is the State's total loan exposure?" — with confidence. Producing that number currently requires 2-3 days of manual data collection from 63 spreadsheets, and the result is the sum of 63 independent guesses. If challenged by an auditor, the Commissioner of Finance, or the Governor's office, there is no authoritative source to defend it. Every loan approval the AG signs is a decision made on incomplete, potentially inaccurate information about fund availability.

**On Government Workers (3,100+ beneficiaries):**
Over-deductions beyond loan tenure are the single largest source of worker grievances — producing headaches, accusations, counter-accusations, and in extreme cases, physical altercations. Workers whose loans have been fully repaid continue to have salaries cut because no mechanism exists to automatically detect completion and halt deductions. Under-deductions may never be discovered, creating hidden liabilities that surface unpredictably.

**On the Revolving Fund:**
The vehicle loan fund is designed to revolve — repayments flow back in and fund new approvals. But without visibility into actual recovery rates, retirement pipeline obligations, unrecoverable write-offs from terminated staff, and the true pace of repayment, the AG cannot responsibly manage the fund's health or forecast availability for new applicants.

**On Audit Exposure:**
The current system provides no immutable audit trail, no segregation between declared and computed values, and no exception resolution documentation. Every figure is manually produced and manually modifiable. This creates significant exposure for the AG's office under financial oversight review.

### Why Existing Solutions Fall Short

The problem is not effort, competence, or intention. Five structural realities make the current approach permanently unfixable:

1. **Guaranteed Drift:** 63 MDAs applying the same formula independently will produce divergent results over time. The Sports Council data revealed interest rates of 11.1% alongside the official 13.33% in the same spreadsheet. This is not negligence — it is the mathematical consequence of distributed manual computation without enforced shared rules.

2. **Silent Failure:** The current system cannot detect its own errors. Over-deductions are discovered only when an aggrieved worker walks into the Car Loan Department — sometimes after months of incorrect salary deductions. Under-deductions may never surface at all. There is no authoritative number to check against, so mistakes compound in silence until they erupt as human conflict.

3. **Passive Architecture:** Paper files and spreadsheets are inert. They cannot alert the AG that 47 staff are retiring in 12 months with ₦28M outstanding. They cannot flag that 15 MDAs missed this month's submission. They cannot notify anyone that a fully-repaid loan is still generating deductions. The system only reveals problems when humans actively go searching — and by then, the damage is done.

4. **The Accountability Void:** When everyone computes independently, nobody can be held accountable for errors because nobody can prove whose calculation is authoritative. The AG is responsible for a number that no one can defend. This is an untenable position for the officer upon whom the buck stops.

5. **The Invisible Fund:** The revolving fund — the lifeblood of the scheme — is opaque. Outstanding obligations, recovery timelines, unrecoverable losses from terminated staff, projected availability for new approvals: none of these can be reliably determined. The AG makes hundred-million-naira allocation decisions based on information she cannot verify.

No amount of training, process improvement, or additional staffing can resolve these structural realities. The architecture itself must change.

### Proposed Solution

VLPRS operates on a deceptively simple principle:

> **MDAs submit facts. VLPRS computes truth. The AG sees reality.**

Three architectural pillars make this possible:

**1. The Immutable Ledger**
Every naira deducted is recorded as a permanent, unmodifiable financial event. Nobody edits balances — the system computes them from the complete ledger history. Corrections are new entries, never overwrites. This is banking-grade architecture applied to government loan administration, and it is what makes every number in the system defensible under audit.

**2. The Discovery Engine**
VLPRS does not merely track loans — it reveals what was previously invisible. Variance detection surfaces discrepancies between declared and computed positions. Inactive loan detection flags loans with no deductions for 2+ months regardless of reason. Retirement pipeline forecasting gives 3, 6, and 12-month advance visibility into upcoming obligations. The AG asked for efficiency; VLPRS delivers financial intelligence.

**3. The Human Elevation Model**
Every role in the system is designed to feel like a promotion, not a demotion. MDA officers go from 17 columns of manual math to 8 fields of factual reporting (6 core fields plus conditional event date and cessation reason). The Department Admin shifts from pulling paper files to managing exceptions and adding institutional context. The AG moves from waiting 3 days for unreliable aggregated numbers to a 30-second executive dashboard. The system automates the drudge and elevates the human to judgment, context, and decision-making.

### Key Differentiators

**Non-Punitive by Design:** Variances are "comparisons," not "errors." The system uses "alignment" language, not "correction" language. Legacy discrepancies are classified as administrative variances, never as misconduct. This is embedded in UX tone, iconography, governance clauses, and communication protocols — and it is the reason MDAs will actually adopt the system.

**Self-Auditing:** A nightly Computation Integrity Monitor runs five automated checks across all active loans — sum validation, interest boundary enforcement, principal balance verification, timeline checks, and allocation reconciliation. A system that catches its own mistakes is more trustworthy than one that claims never to make them.

**Dual Value — Truth and Protection:** For the AG: a complete, trustworthy, audit-defensible picture of the State's loan portfolio. For every beneficiary: the Auto-Stop Certificate — an automatic, system-generated instruction to halt deductions the moment a loan reaches zero. The guarantee that no government worker will ever again be over-deducted. This dual value makes VLPRS both administratively essential and politically untouchable.

**Forensic Migration:** Snapshot-forward, not history-backward. Rather than attempting to reconstruct unreliable historical data, VLPRS establishes a verified baseline in the present and builds truth forward. Historical data is captured as "declared positions" for reconciliation — never accepted as system truth. This reduces migration risk from weeks to days and protects MDAs from inherited blame for legacy errors.

**Institutionalisation by Indispensability:** VLPRS does not require a gazette or formal mandate to become essential. Once it is the only place where the true loan position exists, removing it means returning to chaos. The mandate will follow demonstrated value — the correct sequencing for government IT adoption.

---

## Target Users

### Primary Users

#### Persona 1: Madam AG — The Accountant General

**Profile:** Senior career officer, tech-savvy, extremely time-constrained. The buck stops at her desk — a wrong call affects thousands of state workers, a right call protects them. She has perhaps 30 seconds between meetings to check on the loan scheme, and she needs answers immediately, not navigation.

**Current Pain:** Cannot answer the Commissioner of Finance's most basic question — "What's our total loan exposure?" — without waiting 2-3 days for manually aggregated numbers she can't verify. Makes hundred-million-naira fund allocation decisions on incomplete information. Personally accountable for a portfolio she has never been able to accurately measure. Wants the true financial position of the State's car loan obligations — not just efficiency, but truth.

**VLPRS Experience:** Opens the system on her phone or tablet. Three rows of information answer any executive question without a single click. Four headline numbers (active loans, total exposure, fund available, monthly recovery), attention items colour-coded by urgency, and a forensic summary showing variances and scheme health. When the Commissioner calls, she answers in real time. When she needs a report for Cabinet, she taps "Share as PDF" — branded document with Oyo State crest, ready to forward. No reformatting. No waiting.

**Success Moment:** The first time she answers the Commissioner's call *while it's happening* — no "let me get back to you," no 3-day wait. That's the moment VLPRS becomes indispensable.

---

#### Persona 2: The Deputy AG — The Power User

**Profile:** Career officer, tech-savvy, less time-constrained than the AG but still busy. Acts as the AG's operational right hand on the loan scheme. Unlike the AG who needs headlines, the Deputy can and will click through dashboards, drill into MDA-level data, review exception reports, and interrogate trends.

**Current Pain:** Serves as the human bridge between the AG's questions and the Department's manual data gathering. Currently spends significant time coordinating information flow that should be instant. Has the same accountability exposure as the AG but with more operational involvement.

**VLPRS Experience:** Uses the full dashboard suite — MDA compliance scorecards, variance reports, retirement pipeline, fund pool projections. Drills into individual MDA performance. Reviews exception queues before they reach the AG. Uses the comparison dashboard to spot patterns across MDAs. He is the system's most engaged executive user — the one who explores, questions, and validates.

**Success Moment:** The first time he catches an anomaly pattern through the system *before* it becomes a crisis on the AG's desk. VLPRS makes him proactive instead of reactive.

---

#### Persona 3: Mr. Okonkwo — Department Admin, Car Loan Department

**Profile:** ~15 years in the Car Loan Department. Institutional memory personified — knows which MDAs are difficult, which files are incomplete, why certain committee decisions were controversial. Excited about VLPRS because the promise of technology reducing his daily headaches is genuinely welcome. Not as tech-savvy as the AG/Deputy, but motivated by pain relief.

**Current Pain:** Generates reports manually by pulling data from 63 MDA spreadsheets — a process that takes 2-3 days and produces results he himself doesn't fully trust. Retrieves physical files from cabinets for every enquiry. Handles walk-in complaints from workers who believe they've been over-deducted, with no quick way to verify. His institutional knowledge — the informal arrangements, the incomplete files, the controversial decisions — exists only in his head. If he retires tomorrow, decades of context vanish.

**VLPRS Experience:** His role transforms from manual calculator to quality gatekeeper. Instead of computing balances, he reviews system-computed balances and flags anomalies the system might miss. Instead of pulling paper files, he annotates digital loan records with institutional context that the next person in his seat will inherit. Report generation drops from days to seconds — one-click Executive Summary, review, forward. He manages user accounts (creating and reassigning MDA officers without developer help), processes early exit computations for staff settling loans early, files employment events as they happen (retirements, transfers, suspensions), and reviews the Service Status Verification Report during migration to catch post-retirement deductions. His institutional knowledge — which staff retired, which received extensions — finally has a structured, permanent home in the system.

**Success Moment:** The first time the AG asks for a report and he generates it in 5 seconds instead of 3 days. He gets 3 days of his life back every month — and his expertise becomes more valuable, not less.

---

#### Persona 4: Mrs. Adebayo — MDA Reporting Officer

**Profile:** 40-55 years old, career civil servant who has risen through the ranks over 15-20+ years to become an MDA Accounting Officer. Has a dedicated computer at her desk with reliable internet. Not a digital native, but competent and experienced. Has professional pride in her work — she's been managing her MDA's loan spreadsheet for years and believes her numbers are correct.

**Current Pain:** Produces a 17-column spreadsheet every month with manual calculations for 50+ staff members. Columns 8-16 are all derived values she computes by hand or in Excel. Doesn't know that her interest calculations may differ from the official formula — nobody has ever checked. Responds to reconciliation queries from the Car Loan Department with limited ability to trace historical discrepancies. Lives in quiet dread of errors she might not know about.

**VLPRS Experience:** Her monthly obligation drops from 17 columns of manual math to 8 fields of fact: staff ID, month, amount deducted, payroll reference, MDA code, event flag, and two conditional fields — event date (required when an employment event is reported) and cessation reason (required when deduction is zero with no event). She no longer calculates interest, balances, or installment counts — the system does all of that. She submits facts; VLPRS computes truth. When the system shows a variance between her declared position and the computed position, the language is neutral: "Comparison Complete" — not "Variance Detected." She can drill down to see the full computation chain and verify against her own records. No accusation. No judgment. Just two numbers side by side.

**Success Moment:** The first month she submits 8 fields instead of 17 columns and realises her workload just dropped by two-thirds — and nobody is blaming her for past discrepancies. VLPRS feels like a relief, not a threat.

---

### Secondary Users

#### Persona 5: Alhaji Mustapha — Beneficiary (Government Worker with Active Loan)

**Profile:** Mid-career civil servant, Level 10 officer. Has a 60-month vehicle loan. Knows roughly what his monthly deduction should be but has never seen a complete breakdown of his loan — principal vs interest allocation, running balance, how many months remain. Currently relies on the Car Loan Department to tell him where he stands, which requires a physical visit and often a long wait.

**VLPRS Experience (Phase 2):** Logs into the beneficiary dashboard. Sees a Personal Loan Statement — like a bank statement — showing every month's deduction, principal and interest allocation, running balance, and projected completion date. Can download a PDF. When his loan hits zero, the system automatically generates an Auto-Stop Certificate to his MDA payroll officer. No human needs to remember to stop deductions. He is never over-deducted again.

**Success Moment:** The first time he opens his statement and sees, for the first time in his career, exactly where his money went — month by month. Transparency replaces opacity.

---

#### Persona 6: Committee Admin — Vehicle Loan Committee

**Profile:** Committee Chair and members who approve or reject loan applications. Not daily system users — they engage around committee meetings and decision cycles.

**VLPRS Experience:** Receive pre-built Committee Action Items report before each meeting. Review pending applications with eligibility pre-validated by the system. See anomaly patterns and exception reports that require policy decisions. Their approval authority is fully preserved — VLPRS presents information, they make decisions.

---

#### Persona 7: Front Desk Officer — Car Loan Department

**Profile:** Junior-to-mid-level staff handling walk-ins, application intake, and document management.

**VLPRS Experience:** Registers applications digitally instead of on paper. Looks up any loan record instantly instead of searching through file cabinets. Can tell a walk-in worker their current balance and loan status on the spot — no bribery incentive, no file-hunting delay. Views but cannot edit balances.

---

#### Persona 8: Barrister Folake — Auditor/Oversight

**Profile:** External audit body representative. Needs to verify that the system is trustworthy, not just convenient.

**VLPRS Experience:** Read-only access to the complete Repayment Ledger, all generated reports, full audit logs, and exception resolution chains. Can export any dataset to CSV/Excel for independent verification. Sees the immutable trail — every action, every user, every timestamp. Cannot write to any module. The system is designed to survive her scrutiny, not avoid it.

---

### User Journey

#### The AG's Journey: From Opacity to Command

| Phase | Experience |
|-------|-----------|
| **Discovery** | Deputy AG or Awwal demonstrates VLPRS with live data from pilot MDAs. AG sees her dashboard for the first time — four headline numbers, no clicks needed. |
| **First Value** | Commissioner calls about fund status. AG answers from her phone in real time. No "let me get back to you." |
| **Adoption** | AG opens VLPRS every morning as part of her routine. Attention items tell her what needs her focus today. |
| **Dependency** | Quarterly Cabinet meeting — AG taps "Share as PDF," forwards branded Fund Pool report to Commissioner. VLPRS output IS the presentation. |
| **Indispensability** | 63 MDAs submitting monthly. AG has the first complete, accurate picture of the loan portfolio in the scheme's history. Removing VLPRS now would mean returning to chaos. |

#### The MDA Officer's Journey: From Dread to Relief

| Phase | Experience |
|-------|-----------|
| **Discovery** | Training session convened by AG's office. Learns she'll submit 8 fields instead of 17 columns. Cautiously optimistic. |
| **First Submission** | Uploads CSV with staff IDs, amounts deducted, payroll references. System confirms receipt with reference number and row count. Done in minutes instead of hours. |
| **First Variance** | System shows her declared balance differs from computed balance by ₦26,600. Display is neutral — "Comparison Complete," information icon, no red text. She drills down, sees the math, understands the difference. Not accused. Informed. |
| **Routine** | Monthly submission becomes a 15-minute task instead of a half-day ordeal. She never calculates interest again. |
| **Advocacy** | Tells colleagues in other MDAs that the new system is actually easier. Adoption spreads through peer trust, not mandate. |

#### The Beneficiary's Journey: From Anxiety to Certainty

| Phase | Experience |
|-------|-----------|
| **Discovery** | Receives SMS notification that VLPRS is now tracking his loan. Credentials provided for beneficiary dashboard. |
| **First Login** | Sees his complete loan history for the first time — month-by-month deductions, principal vs interest, running balance. Has never had this level of visibility. |
| **Trust Building** | Checks monthly after each salary payment. Sees the deduction posted, balance decrease. Feels in control for the first time. |
| **Completion** | Loan balance hits zero. System auto-generates Stop-Deduction Certificate to his MDA. He receives SMS: "Congratulations! Your vehicle loan is fully repaid. Download your clearance letter." |
| **Advocacy** | Tells colleagues: "This system actually protects you." The 3,100+ beneficiaries become VLPRS's political constituency. |

---

## Success Metrics

> **Note:** Timelines presented below are indicative and will be recalibrated during scope and phasing definition based on MVP boundaries and delivery realities.

### The Survival Metric: Speed to First Value

The single most important metric for VLPRS is **how quickly it delivers undeniable value to the AG**. Government institutional inertia is the project's existential threat — not bugs, not scope, not budget. If the system doesn't produce a moment of visible, felt value while the pain is still fresh, the window closes and may never reopen.

**Target:** AG sees live data from pilot MDAs on her dashboard within the first deployment cycle. The Commissioner of Finance call scenario — where the AG answers a fund status question in real time from her phone — must happen before institutional momentum fades.

**Leading Indicator:** Pilot MDA data loaded and AG dashboard functional with real numbers. This is the "project is alive" signal.

---

### Institutional Value Metrics (The AG's Truth)

| Metric | Target | Timeframe | Measurement |
|--------|--------|-----------|-------------|
| Real-time fund position available | Yes (binary) | First pilot deployment | AG can answer "What's our exposure?" without waiting |
| MDA submission compliance | 95%+ of 63 MDAs | Month 3 post-rollout | % submitting on time via VLPRS |
| Report generation time | <10 seconds | Go-live | Replaces 2-3 day manual aggregation |
| Variance detection rate | 100% of computable discrepancies | Go-live | System catches what humans cannot |
| Retirement pipeline visibility | 3/6/12-month forecast active | Month 2 | AG sees upcoming obligations before they arrive |
| Legacy spreadsheet retirement | 63/63 MDAs off Excel | Month 6 | VLPRS is sole system of record |

---

### Human Impact Metrics (Worker Protection)

| Metric | Target | Timeframe | Measurement |
|--------|--------|-----------|-------------|
| Over-deduction incidents | 50% reduction | Month 6 | Compared to pre-VLPRS baseline (estimated from grievance records) |
| Over-deduction incidents | Near-zero | Month 12 | Auto-Stop Certificates prevent all new over-deductions |
| Auto-Stop Certificates issued | Track count | Ongoing | Each certificate = one worker protected from over-deduction |
| Grievance resolution time | <10 working days average | Month 3 | SLA tracking in Discrepancy Ticket System |
| Beneficiary statement access | 3,100+ accounts active | Phase 2 launch | Workers can see their own loan position for the first time |
| Physical altercation incidents | Zero | Month 6 | The disputes that previously escalated to violence are resolved digitally |

---

### Adoption Metrics (System Viability)

| Metric | Target | Timeframe | Measurement |
|--------|--------|-----------|-------------|
| Pilot MDA onboarding | 3-5 MDAs submitting via VLPRS | Month 2 | First real data flowing through the system |
| Full MDA onboarding | 63/63 MDAs active | Month 4-5 | All MDAs submitting monthly via VLPRS |
| Role activation | All 7 roles with active users | Month 3 | Login and activity metrics per role |
| Deputy AG engagement | Weekly dashboard usage | Month 2 | The power user is exploring, drilling, validating |
| MDA officer sentiment | "Easier than Excel" | Month 3 | Qualitative — peer advocacy spreading |
| Parallel run exit | Clean parallel run for 3 consecutive months | Month 5-6 | Go/no-go for legacy retirement |

---

### Financial Integrity Metrics (Fund Health)

| Metric | Target | Timeframe | Measurement |
|--------|--------|-----------|-------------|
| Data accuracy (system vs payroll) | 99%+ match rate | Month 3 | Monthly reconciliation verification |
| Fund pool visibility | Real-time available balance | Go-live | AG sees what's available for new approvals |
| Retirement receivables tracked | 100% of retiring staff with loans | Month 3 | No retiree with an outstanding loan goes untracked |
| Unrecoverable write-offs quantified | Total exposure visible | Month 6 | AG sees true cost of terminated staff loans for the first time |
| Fund rotation rate | Tracked and trending | Month 6 | Average months to full recovery — improving over time |

---

### Business Objectives

**For the Accountant General's Office:**
- Establish VLPRS as an institutional asset that outlives any single officer or political cycle
- Achieve audit-readiness — every figure reconstructable by date, source, and authority
- Demonstrate financial stewardship of the revolving fund with defensible numbers

**For Awwal (Professional Objective):**
- Deliver a working, adopted, State-level government IT system — not a demo, not a pilot, but a live system that 63 MDAs and 3,100+ beneficiaries depend on daily
- Architecture quality that stands up to technical scrutiny — immutable ledger, computed views, RBAC segregation, banking-grade correction model
- The AG's endorsement as the ultimate reference: a senior government official who can say "he built this, it works, and we use it every day"

---

### Key Performance Indicators (KPI Dashboard)

**The "VLPRS Is Working" Signal — 5 numbers the AG checks:**

1. **Submission Rate:** X/63 MDAs submitted this month (pre-submission checkpoint completed)
2. **Active Loans Under Management:** Total count and ₦ value
3. **Fund Available:** ₦ available for new approvals (real-time)
4. **Exceptions Pending:** Items requiring human decision
5. **Protection Score:** Auto-Stop Certificates issued to date (cumulative worker protections)

---

## MVP Scope

### Core Features (MVP — Phase 1)

**The MVP delivers one outcome: the AG opens VLPRS and sees the truth.** Every feature below serves that moment or directly protects the workers who make the system politically untouchable.

#### 1. Computation Engine
- Interest calculation for all 4 loan tiers (L1-6, L7-8, L9-10, L12+) at 13.33% fixed rate
- Standard (60-month), accelerated (shorter tenure), and early-exit (lump-sum principal) settlement paths
- 2-month moratorium handling (no interest accrual, scheduling offset)
- Auto-split logic: MDA-submitted deduction amount → principal + interest allocation
- Last Payment Adjustment Method (final month absorbs rounding — mathematical perfection)
- Retirement settlement computation (outstanding obligation at retirement date, no post-retirement interest)

#### 2. Loan Master + Repayment Ledger
- **Loan Master:** Static, approved facts — staff ID, MDA, grade level, principal, interest rate, tenure, approval date, disbursement date, deduction start month, date of birth, date of first appointment, computed retirement date (earlier of DOB + 60 years or appointment + 35 years), loan status
- **Repayment Ledger:** Immutable, append-only financial events — every naira posted with source, reference, timestamp, and posting officer
- Balances are always computed from the ledger, never stored or manually edited
- Generated Loan Snapshot View (the familiar 16-column report, fully computed)

#### 3. MDA Monthly Submission Interface
- 8-field submission: staff ID, month, amount deducted, payroll batch reference, MDA code, event flag, event date (conditional — required when event flag ≠ NONE), cessation reason (conditional — required when amount = ₦0 and event flag = NONE)
- CSV upload + manual entry fallback (manual form mirrors 8-field structure with conditional field visibility)
- Pre-submission checkpoint: mandatory review screen showing approaching retirements, zero-deduction staff with no event filed, and pending mid-cycle events before upload is accepted
- Mobile-friendly, responsive web interface
- Upload confirmation with reference number, timestamp, and row count
- Atomic uploads (all rows accepted or none — no partial submissions)
- Idempotent duplicate detection ("This matches your submission from 14:23 today")

#### 4. Snapshot-Forward Migration Tool
- Import existing MDA 17-column spreadsheets as baseline declarations
- Column trust classification: Accepted (MDA, Name, Principal, Installments) / Claims (flagged for validation) / Ignored (system will compute) / Metadata (stored as reference)
- Validation engine with categorisation: Clean / Minor Variance / Significant Variance / Structural Error / Anomalous
- Per-MDA variance report generation (side-by-side declared vs computed)
- Summary ledger entry creation per loan (cumulative payments to date as MIGRATION source)
- Legacy data stored unchanged in archive for audit reference
- Migration dashboard tracking per MDA: Pending → Received → Imported → Validated → Reconciled → Certified

#### 5. AG Executive Dashboard
- **Row 1 — Four Headline Numbers:** Active Loans (count), Total Exposure (₦ outstanding), Fund Pool Available (₦ for new approvals), Monthly Recovery (₦ expected this month)
- **Row 2 — Attention Items:** Non-compliant MDAs (red), pending committee items (amber), retirement settlements due within 90 days (amber), loans completing this quarter (green), migration status (X/63 MDAs baselined)
- **Row 3 — Scheme Health:** Submission rate, deduction accuracy, over/under-deduction counts, inactive loan count
- No clicks required for top-level view — serves both the AG (30-second glance) and the Deputy AG (drill-down from any number)

#### 6. RBAC (3 Core Roles)
- **Super Admin** (AG, Deputy AG, Commissioner for Finance): Full system visibility, all dashboards and reports
- **Department Admin** (Car Loan Dept HOD, Director of Finance): Manage loan records, trigger settlements, coordinate reconciliation, full reporting, migration management
- **MDA Reporting Officer** (x63): Submit monthly data (8-field CSV + pre-submission checkpoint), file mid-cycle employment events, upload historical records, manage Staff IDs for own MDA, view variances for own MDA only, respond to reconciliation queries

#### 7. Core Reports
- **Executive Summary:** Total loans, exposure, fund status, recovery rate (on-demand)
- **MDA Compliance Report:** Who submitted, who didn't, who was late (monthly)
- **Variance & Anomaly Report:** All variances classified by type and severity (monthly)
- **Loan Snapshot by MDA:** The familiar 16-column view, fully computed (monthly)
- All reports exportable to CSV/Excel for external verification

#### 8. Basic Validation Engine
- Period lock: system knows what month is expected, blocks stale data
- Duplicate detection: same staff + same month = rejected
- Staff ID uniqueness constraint: one deduction entry per staff per calendar month across all 63 MDAs
- Staff ID duplicate detection: system warns when a Staff ID being assigned already exists on another loan record
- Baseline delta check: flags 100% identical submissions as potential duplicates
- Amount reasonableness: no single deduction exceeding tier maximum

#### 9. Auto-Stop Certificate
- Automatic detection when a loan's computed balance reaches zero
- System generates formal stop-deduction certificate addressed to MDA payroll officer with copy to beneficiary
- No human needs to remember to stop deductions
- The "never be over-deducted again" guarantee — operational from day one

#### 10. Basic Notification System
- Submission deadline reminders: email/SMS at T-3, T-2, T-1 days before the 28th
- Overdue notification: email/SMS at T+1 day
- Non-compliant MDA flag on AG dashboard after T+3 days
- Auto-Stop Certificate notification to beneficiary (SMS)
- Loan completion notification to beneficiary (SMS)

#### 11. Staff Temporal Profile & Employment Event Tracking
- Date of birth, date of first appointment, and computed retirement date on every loan record
- Retirement date = min(DOB + 60 years, appointment date + 35 years), recomputed if dates corrected
- Service extension recording with approving authority reference and audit trail
- Mid-cycle employment event filing at any time via 5-field form: Staff ID, Event Type (Retired, Deceased, Suspended, Absconded, Transferred Out, Dismissed, LWOP Start/End, Service Extension), Effective Date, Reference Number, Notes
- Event reconciliation against subsequent monthly CSV submissions
- Gratuity receivable tracking when loan tenure exceeds remaining service (projected amount surfaced on executive dashboard)
- Early exit workflow: Department Admin computes lump-sum payoff, records staff commitment, records payment, triggers Auto-Stop Certificate. Computations expire at month-end if unpaid
- Service Status Verification Report during migration (flags post-retirement activity)

#### 12. User & Staff Record Management
- User account lifecycle: create, deactivate, reassign MDA officers (Department Admin); all account levels (Super Admin). All changes audit-logged
- Password reset initiation by Department Admin (for MDA officers) and Super Admin (for all levels)
- Staff ID management: MDA officers add/update Staff IDs for their MDA; admin users manage system-wide
- Duplicate Staff ID detection with warning and justification workflow
- MDA historical data upload: officers upload prior-period deduction CSVs for cross-validation against migration baseline

---

### Out of Scope for MVP

The following are valuable, validated features that will be built in subsequent phases. They are intentionally deferred — not because they don't matter, but because the MVP must ship before the institutional window closes. The architecture is designed so these features are additions to the foundation, not rewrites — enabling continuous deployment after MVP ships.

#### Phase 2 — Beneficiary & Public Experience
- **Beneficiary Dashboard:** Login, loan status, repayment history, statement download, grievance submission
- **Public Education Portal:** Static site, scheme information, EOI form, approved beneficiary lists, early repayment calculator
- **Personal Loan Statement:** Bank-statement-style PDF with month-by-month breakdown
- **Clearance Letter Generation:** Downloadable PDF upon loan completion

#### Phase 2 — Operational Depth
- **Guarantor Tracking:** Guarantor entity in data model, guarantor-staff relationships, circular guarantee detection, guarantor notification on exception status
- **Full Staff Employment Status Taxonomy:** Expand from 7 MVP event types to 13 statuses with detailed workflow rules and automated status transitions (extends MVP temporal profile foundation)
- **Transfer Handshake Protocol:** Paired Transfer Out/In workflow between MDAs
- **Discrepancy Ticket System:** Formal correction workflow — ticket → investigation → evidence → recommendation → committee approval → adjustment entry → recomputation
- **Annotation System:** Department Admin contextual notes on loan records (institutional memory capture)
- **Retirement-Gratuity Handshake Protocol:** 12-month pipeline, automated reports (extends MVP gratuity receivable tracking)

#### Phase 2 — Advanced Reporting & Governance
- **Fund Pool Forecasting:** Projected available funds for 3/6/12 months
- **Pre-Built Executive Reports (full set):** Retirement Pipeline, Fund Pool Forecast, Committee Action Items, Scheme Historical Trend, MDA Performance Ranking
- **Share as PDF:** Branded output with Oyo State crest, presentation-ready
- **Committee Admin Role:** Full committee workflow — pending approvals, anomaly patterns, resolution recommendations
- **Front Desk Officer Role:** Application registration, document upload, balance lookup
- **Auditor/Oversight Role:** Read-only access to ledger, reports, audit logs

#### Phase 3 — Advanced System Capabilities
- **Policy Versioning Engine:** Interest rates, tiers, moratorium as versioned data with effective dates
- **MDA Lifecycle Management:** Rename, merge, split, dissolve support
- **Concurrent Loan Policy:** One-at-a-time vs upgrade/top-up configuration
- **Computation Integrity Monitor:** Nightly 5-check self-audit
- **Full Notification Escalation Engine:** Complete T-3 to T+7 ladder with auto-generated query letter templates
- **Upload Resilience Protocol (advanced):** Offline email fallback, status page
- **System Self-Correction Protocol:** Append-only corrections with transparency playbook
- **Payroll Cross-Verification:** Future payroll data feed integration for automatic mismatch detection

---

### MVP Success Criteria

The MVP is successful when these conditions are met:

1. **The AG answers in real time.** She opens the dashboard on her phone and sees four accurate headline numbers from live MDA data. The Commissioner of Finance call scenario works.

2. **Pilot MDAs are submitting.** 3-5 MDAs consistently submit 8-field monthly data via VLPRS. Data flows, validation catches errors, variance reports are generated.

3. **The math is provably correct.** Computation engine produces identical results to hand-verified calculations across all 4 tiers and all settlement paths. Every number is auditable.

4. **Migration works.** Snapshot-forward migration tool successfully imports pilot MDA spreadsheets, categorises records, generates variance reports, and creates baseline ledger entries.

5. **Over-deductions start stopping.** At least one Auto-Stop Certificate is issued for a loan that reaches zero — proving the protection guarantee is real.

6. **Go/No-Go for full rollout.** Based on pilot results, the AG and Deputy AG authorise expansion from pilot MDAs to all 63.

---

### Future Vision

**If VLPRS succeeds, it becomes three things:**

**1. The Institutional Standard**
Within 12 months, VLPRS is the sole system of record for the Vehicle Loan Scheme. Legacy spreadsheets are retired. Every MDA submits digitally. Every balance is computed, not declared. The AG has the first complete, accurate picture of the loan portfolio in the scheme's history. The system is institutionalised by indispensability — removing it would mean returning to chaos.

**2. The Beneficiary Shield**
With Phase 2, every government worker with a car loan has a dashboard showing exactly where their money goes, month by month. The Auto-Stop Certificate guarantees no over-deduction. The Discrepancy Ticket System gives workers a formal, trackable channel for grievances. VLPRS transforms the relationship between the State and its workforce from opaque to transparent. The 3,100+ beneficiaries become the system's political constituency.

**3. The Blueprint**
VLPRS proves that meaningful government IT can be built and adopted in Nigeria — not as a showcase demo, but as a live system that serves real users every day. The architecture (immutable ledger, computed views, non-punitive reconciliation, snapshot-forward migration) becomes a reference pattern for other State financial administration systems. The AG's endorsement opens doors. The working system speaks for itself.

### Development Velocity Strategy

**The MVP IS the hard part.** The computation engine, immutable ledger, RBAC framework, and migration tool are the architectural foundation. If built correctly, Phase 2 features are UI layers and workflows on top of the same data.

**Continuous deployment, not big-bang phases:**
- No gap between MVP and Phase 2. Features ship individually as they're ready
- The AG sees the system growing weekly after MVP launch
- Each new feature (beneficiary dashboard, guarantor tracking, reports) goes live the moment it works
- Architecture decides velocity — if the foundation is solid, adding a new report or role is days of work, not weeks

**The key discipline:** Don't compromise MVP architecture for speed. Get the foundation right, and everything after that stacks fast.
