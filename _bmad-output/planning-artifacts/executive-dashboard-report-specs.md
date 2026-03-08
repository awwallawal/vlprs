# Executive Dashboard — Analytics Services & Report Specification

> **Purpose:** Specification of shared computation services and dashboard/report enrichments derived from SQ-1 Legacy CD Analysis, for integration into existing Epic 4 and Epic 6 stories (MVP) with advanced analytics deferred to Phase 2.
>
> **For:** John (PM) — AC enrichment & cascade into PRD/epics
>
> **From:** SQ-1 Discovery Session — March 2026
>
> **Status:** PM Review — Pending Approval & Cascade
>
> **Supersedes:** Original 18-report catalogue (v1). Restructured per PM review to fit solo-developer sprint model without scope expansion.

---

## Table of Contents

1. [Background & Motivation](#1-background--motivation)
2. [Design Principles](#2-design-principles)
3. [Shared Computation Services (5 Services)](#3-shared-computation-services)
4. [MVP: Epic 4 Story Enrichments](#4-mvp-epic-4-story-enrichments)
5. [MVP: Epic 6 Story Enrichments](#5-mvp-epic-6-story-enrichments)
6. [Phase 2 Backlog: Advanced Analytics (E15)](#6-phase-2-backlog-advanced-analytics)
7. [FR Mapping: Existing Coverage & Gaps](#7-fr-mapping-existing-coverage--gaps)
8. [Data Source Mapping: Legacy to VLPRS Schema](#8-data-source-mapping)
9. [Non-Punitive Language Compliance](#9-non-punitive-language-compliance)
10. [Decisions Log](#10-decisions-log)
11. [Cascade Actions](#11-cascade-actions)

---

## 1. Background & Motivation

The SQ-1 Legacy CD Analysis Engine processed **77,095 deduction records** across **122 Excel files** from the Oyo State Car Loan Scheme's legacy CD (2015-2025). From this data, 18 executive factsheet reports were generated as static HTML files to validate data patterns and prove report concepts.

**Key findings:**
- 63 MDAs in the scheme, but only 32 ever submitted data; only 22 have data in the last 60 months
- 34.6% of loans in the 60-month accountability window are past expected completion
- 9.5% have unchanged balances (frozen deductions)
- The standard "13.33% interest rate" maps to 6 tenure lengths (60/50/48/40/36/30 months)
- 10 MDAs that previously submitted data have gone completely dark

**Why this matters for the app:** Every one of these reports can be generated in real-time from the VLPRS database once loans are ingested (Epic 3) and submissions begin (Epic 5). The legacy analysis is the proof-of-concept; the app makes it live.

**What changed from the original spec:** The original document proposed 18 reports as a standalone catalogue, recommending E4 expand from 4 to 8-10 stories and E6 from 4 to 6 stories. That would add 6-8 stories (3-4 extra weeks) to a solo-developer timeline already at 65 stories / 28 weeks, and delay E5 (MDA adoption) — the most time-sensitive epic in the sequence. This restructured version achieves the same analytical capability by:

1. Building **5 shared computation services** that power all analytics
2. **Enriching existing E4/E6 story ACs** — zero new stories
3. Deferring standalone advanced analytics views to **Phase 2 (E15)**

---

## 2. Design Principles

### 2.1 Build Engines, Not Reports

Individual reports are view-layer formatting on top of shared computation. The engineering investment is in the services — once the Loan Classification Engine exists, a new report is hours of UI work, not days of computation work.

### 2.2 Enrich, Don't Expand

E4 has 4 stories. E6 has 4 stories. They stay at 4 stories each. The SQ-1 insights make each story's output richer, not more numerous.

### 2.3 Epic 3 Already Did the Hard Part

The Observation Engine (Story 3.6), Master Beneficiary Ledger (Story 3.5), Individual Trace Reports (Story 3.7), and Beneficiary Cross-Reference (FR85) already compute and store the data underlying the 6 historical reports. E4 and E6 consume this data — they don't recompute it.

### 2.4 60-Month Window as a Parameter, Not a Feature

The accountability window is a query parameter on the classification service, not a standalone UI feature. Default: 60 months. Configurable via Phase 2 UI.

### 2.5 Consumer + Action for Every Dashboard Element

Every metric, card, or table answers: **Who reads this?** and **What do they do next?**

---

## 3. Shared Computation Services

These 5 services are the engineering core. They live in `apps/server/src/services/` and are built as internal dependencies of E4 Story 4.1's API layer. Each is a pure-function service with no side effects — testable in isolation.

### 3.1 Loan Classification Service

**File:** `loanClassificationService.ts`
**Used by:** E4 Stories 4.1-4.4, E6 Stories 6.1-6.3
**Depends on:** `loans` table, `monthly_submissions` table (when available post-E5)

**Purpose:** Classifies any loan into a lifecycle status within a time window.

**Interface:**
```
classifyLoan(loan, window: { start: Date, end: Date }):
  → { status, monthsOverdue, stallMonths, expectedExitDate, isQuickWin }

Status enum:
  COMPLETED    — balance reached zero within window
  OVER_DEDUCTED — balance below zero
  STALLED      — 2+ consecutive identical non-zero balances at tail
  OVERDUE      — expected exit passed, balance still positive
  ON_TRACK     — expected exit in future, balance moving

classifyPortfolio(loans[], window):
  → { byStatus: Map<Status, LoanSummary[]>, totals, quickWinCount }
```

**Algorithm:**
```
FOR each loan in window:
  expectedExit = loan.start_date + loan.tenure_months
  latestBalance = loan.outstanding_balance  (or latest submission balance)

  IF latestBalance < 0          → OVER_DEDUCTED
  IF latestBalance = 0          → COMPLETED
  IF 2+ consecutive identical balances at tail AND balance > 0 → STALLED
  IF expectedExit ≤ window.end AND balance > 0 → OVERDUE
  ELSE → ON_TRACK

  isQuickWin = (status = ON_TRACK OR status = OVERDUE)
               AND installments_remaining ≤ 3
  monthsOverdue = max(0, monthsBetween(expectedExit, window.end))
```

**Stall Detection Note:** Post-E3, stall detection uses observation data from the Observation Engine (FR87 type #2). Post-E5, it compares consecutive `monthly_submissions` records. The service abstracts the data source.

**Test cases:** Must validate against SQ-1 legacy data — the classification of 2,930 loans from the legacy analysis serves as the regression baseline.

---

### 3.2 MDA Aggregation Service

**File:** `mdaAggregationService.ts`
**Used by:** E4 Stories 4.2-4.4, E6 Stories 6.1-6.2
**Depends on:** Loan Classification Service output

**Purpose:** Aggregates classified loans per MDA and computes health scores.

**Interface:**
```
aggregateByMda(classifiedLoans[]):
  → Map<mdaId, {
      counts: { completed, onTrack, overdue, stalled, overDeducted },
      totals: { outstanding, monthlyCollection, atRisk },
      healthScore: number (0-100),
      healthBand: 'healthy' | 'attention' | 'review'
    }>

computeHealthScore(mdaCounts):
  → number (0-100)
```

**Health Score Formula:**

```
score = (completionRate × 40) + (onTrackRate × 20) + 40
      - (stallRate × 20)
      - (overdueRate × 20)
      - (overDeductionRate × 20)
clamp(score, 0, 100)

Bands:
  ≥ 70  → 'healthy'    (green badge)
  40-69 → 'attention'  (amber badge)
  < 40  → 'review'     (grey badge — NOT red)
```

**Known limitation:** The formula produces `70` for an MDA with 50% completion + 50% on-track and zero problems. This should be validated against the 22 active MDAs from SQ-1 data before finalising. If scores don't match intuition, adjust weights.

**Health score is fixed for MVP.** Configurability deferred to Phase 2.

---

### 3.3 Revenue Projection Service

**File:** `revenueProjectionService.ts`
**Used by:** E4 Story 4.1 (monthly collection potential metric), E6 Story 6.1
**Depends on:** `loans` table (active loans with `monthly_deduction > 0`)

**Purpose:** Projects future revenue from active loans.

**Interface:**
```
projectRevenue(activeLoans[], horizonMonths: number = 24):
  → {
      monthlyCollectionCurrent: Decimal,
      totalRemainingToCollect: Decimal,
      waterfall: Array<{ month: Date, expectedRevenue: Decimal, loansCompleting: number }>,
      lastLoanClearsDate: Date,
      monthsToPortfolioZero: number
    }

computeRecoveryTiers(overdueAndStalledLoans[]):
  → {
      tier1: { count, amount, monthlyIfResumed },  // Quick: stalled ≤4mo OR overdue ≤6mo
      tier2: { count, amount, monthlyIfResumed },  // Intervention: overdue 7-18mo OR stalled 5-12mo
      tier3: { count, amount, monthlyIfResumed },  // Extended: overdue >18mo OR stalled >12mo
      totalRecoverable: Decimal
    }
```

**For MVP E4:** Only `monthlyCollectionCurrent` and `totalRemainingToCollect` are wired to the dashboard hero metrics. The full waterfall and recovery tiers are Phase 2 standalone views.

---

### 3.4 Beneficiary Pipeline Service

**File:** `beneficiaryPipelineService.ts`
**Used by:** E4 Story 4.2 (attention item: onboarding lag count), E6 Story 6.1
**Depends on:** `beneficiary_approvals` table (Epic 3 Story 3.4), `loans` table
**Note:** Merges original H4 (Beneficiary Match) and C6 (Onboarding Lag) into one service with two views.

**Purpose:** Cross-references approved beneficiaries against active loan records.

**Interface:**
```
crossReference(approvals[], loans[]):
  → {
      matched: Array<{ approval, loan, matchType: 'exact' | 'partial' }>,
      unmatched: Array<{ approval, status: 'no_deductions' | 'name_mismatch' }>,
      reverseUnmatched: Array<{ loan, status: 'no_approval' }>,
      stats: { matchRate, revenueAtRisk, onboardingLagCount }
    }
```

**Relationship to Epic 3:** FR85 (Approved Beneficiary Cross-Reference) is implemented in Story 3.6 as observation type #5 ("No Approval Match"). This service wraps that observation data into an aggregated pipeline view. It does NOT re-run the matching — it queries existing observation results.

---

### 3.5 Submission Coverage Service

**File:** `submissionCoverageService.ts`
**Used by:** E4 Story 4.4 (compliance status), E6 Story 6.1
**Depends on:** `monthly_submissions` table (post-E5), `mdas` table
**Note:** Pre-E5, uses migration data coverage from Epic 3 manifest. Post-E5, uses live submission data.

**Purpose:** Measures MDA data submission consistency and identifies gaps.

**Interface:**
```
analyseCoverage(mdaId, window: { start, end }):
  → {
      monthsPresent: number,
      totalMonths: number,
      coveragePercent: number,
      lastSubmissionDate: Date | null,
      monthsSinceLastSubmission: number,
      gapMonths: Date[],
      status: 'active' | 'spotty' | 'dark'
    }

analyseAllMdas(window):
  → {
      byMda: Map<mdaId, CoverageResult>,
      darkCount: number,
      activeCoverage: number,
      averageCoveragePercent: number
    }

Status thresholds:
  'active'  — ≥ 80% coverage AND submitted within last 2 months
  'spotty'  — 20-79% coverage OR last submission 3-6 months ago
  'dark'    — < 20% coverage OR last submission > 6 months ago
```

**Relationship to FR86 (Submission Heatmap):** The heatmap (already mapped to E4 + E5) is the visual layer. This service provides the data. The heatmap consumes `analyseAllMdas()` output.

---

## 4. MVP: Epic 4 Story Enrichments

**Sprint 6 — zero new stories, richer ACs.**

The classification engine and aggregation service are built as internal dependencies of Story 4.1's API layer — not separate stories. They're tested via the API endpoints they power.

### Story 4.1: Dashboard Hero Metrics API & Display

**Existing scope:** 4 headline numbers (Active Loans, Total Exposure, Fund Available, Monthly Recovery).

**Enriched with:**

| New Metric | Source Service | Consumer | Action |
|------------|---------------|----------|--------|
| Total Outstanding Receivables (₦) | `loanClassificationService.classifyPortfolio()` → sum outstanding | AG | Answers "what's owed to us?" |
| Monthly Collection Potential (₦) | `revenueProjectionService.projectRevenue().monthlyCollectionCurrent` | AG | Answers "what should come in monthly?" |
| At-Risk Amount (₦) | Sum of OVERDUE + STALLED outstanding | AG, Deputy AG | Answers "how much is stuck?" |
| Loan Completion Rate (%) | COMPLETED / total in window | AG | Answers "are loans finishing?" |

**New AC addition:**
- Given the dashboard API endpoint `GET /api/dashboard/metrics`, When the AG views hero metrics, Then in addition to the existing 4 metrics, the response includes: totalOutstandingReceivables, monthlyCollectionPotential, atRiskAmount, and loanCompletionRate, And all financial values are computed via the Loan Classification Service using a default 60-month window, And the response remains <2KB payload

**API dependency:** `GET /api/dashboard/metrics` internally calls `loanClassificationService.classifyPortfolio()` and `revenueProjectionService.projectRevenue()`. These services are built and tested as part of this story's implementation.

**Visual:** Add a second row of 4 HeroMetricCards below the existing row (8 total on desktop in 2×4 grid, stacked on mobile).

---

### Story 4.2: Attention Items & Status Indicators

**Existing scope:** Attention items with priority indicators.

**Enriched with:**

| New Attention Source | Trigger | Consumer | Action |
|---------------------|---------|----------|--------|
| Overdue loan count | Classification: OVERDUE count > 0 | AG, Deputy AG | Drill to overdue list |
| Stalled deduction count | Classification: STALLED count > 0 | Deputy AG | Investigate frozen balances |
| Quick-wins available | Classification: isQuickWin count > 0 | Dept Admin | Prioritise near-complete loans |
| Dark MDAs | `submissionCoverageService`: status = 'dark' | AG | Compliance follow-up |
| Onboarding lag | `beneficiaryPipelineService`: onboardingLagCount > 0 | AG, Dept Admin | Activate approved beneficiaries |

**New AC addition:**
- Given the attention items API, When attention items are generated, Then the system includes items sourced from the Loan Classification Service (overdue count, stalled count, quick-wins) and Submission Coverage Service (dark MDAs), And each attention item includes: description, count, amount (where applicable), category badge, and drill-down link
- Given quick-win loans (≤3 installments remaining), When the quick-wins attention item is displayed, Then it shows: count of quick-win loans, total amount to recover, and a link to the filtered loan list

**Consumer + action principle:** Every attention item links to a drill-down view where the user can take action.

---

### Story 4.3: Progressive Drill-Down (Dashboard → MDA → Loan)

**Existing scope:** Headline → MDA breakdown → individual loan.

**Enriched with:**

| Enhancement | Source | What It Adds |
|------------|--------|-------------|
| Loan status badge | Classification Service | Each loan in drill-down shows: COMPLETED / ON_TRACK / OVERDUE / STALLED |
| MDA status summary | Aggregation Service | MDA detail view shows count per status category |
| MDA health score | Aggregation Service | Each MDA row shows computed health score + band badge |

**New AC addition:**
- Given the MDA-level breakdown view, When the AG drills into a metric, Then each MDA row shows: MDA name, contribution count, outstanding amount, health score badge (healthy/attention/review), and status distribution (mini bar showing proportion of completed/on-track/overdue/stalled)
- Given an individual loan in the detail view, When displayed, Then the loan shows a status badge computed by the Loan Classification Service with colour coding: green (completed/on-track), amber (overdue), grey (stalled), teal info (over-deducted)

---

### Story 4.4: MDA Compliance Status View

**Existing scope:** Which MDAs submitted for current period.

**Enriched with:**

| Enhancement | Source | What It Adds |
|------------|--------|-------------|
| Health score column | Aggregation Service | Portfolio health per MDA alongside submission status |
| Coverage % | Coverage Service | Historical submission consistency per MDA |
| Dark MDA highlighting | Coverage Service | MDAs with no recent submissions get "Submission gap observed" label |
| Staleness indicator | Coverage Service | "Last updated: X months ago" per MDA |

**New AC addition:**
- Given the MDA compliance view, When the AG views submission status, Then each MDA row includes: submission status (current period), health score badge, historical coverage percentage, and last submission date, And MDAs classified as 'dark' by the Submission Coverage Service display an amber "Submission gap observed" label (non-punitive — not "Non-compliant")
- Given a 'dark' MDA (no submission in 6+ months), When data for that MDA is displayed anywhere in the dashboard, Then a staleness indicator shows: "Data as of {lastSubmissionDate} — {months} months since last update" so the AG knows the recency of the numbers

---

## 5. MVP: Epic 6 Story Enrichments

**Sprint 10 — zero new stories, richer report content.**

By Sprint 10, the system has: migration data (E3), dashboard services (E4), live submissions (E5), event reconciliation (E11), and resolved exceptions (E7). Reports should reflect this depth.

### Story 6.1: Executive Summary & MDA Compliance Reports

**Existing scope:** Scheme overview, compliance status, top variances, exception summary.

**Enriched with:**

| New Section | Source Service | What It Adds |
|------------|---------------|-------------|
| Loan portfolio status breakdown | Classification Service | Count + % per status (completed, on-track, overdue, stalled, over-deducted) |
| MDA scorecard table | Aggregation Service | All MDAs ranked by health score with status columns |
| Outstanding receivables by MDA | Aggregation Service | Ranked table of MDA exposure |
| Recovery potential summary | Revenue Projection Service | 3-tier recovery strategy: quick / intervention / extended |
| Submission coverage summary | Coverage Service | Active / spotty / dark MDA counts with coverage % |
| Onboarding pipeline summary | Pipeline Service | Approved-but-not-collecting count and revenue at risk |

**New AC addition:**
- Given the Executive Summary report, When generated, Then it includes the following sections beyond the existing scope: Loan Portfolio Status (count and % per classification status), MDA Scorecard (top 10 by health score + bottom 5), Outstanding Receivables by MDA (top 10 ranked by exposure), Recovery Potential Summary (3-tier strategy with amounts), and Submission Coverage Summary (active/spotty/dark counts)
- Given the MDA Compliance report, When generated, Then each MDA row includes: submission status, health score, coverage %, total outstanding, and observation count (unresolved)

---

### Story 6.2: Variance & Loan Snapshot Reports

**Existing scope:** Declared vs computed, loan snapshot by MDA.

**Enriched with:**

| New Section | Source | What It Adds |
|------------|--------|-------------|
| Overdue register | Classification Service (filtered to OVERDUE) | Named list of staff past expected completion — the operational action list |
| Stalled deduction register | Classification Service (filtered to STALLED) | Named list of frozen-balance loans — for investigation |
| Over-deduction register | Classification Service (filtered to OVER_DEDUCTED) | Named list of negative-balance cases — for refund assessment |

**New AC addition:**
- Given a Variance report, When generated for a specific MDA, Then it includes: the existing declared-vs-computed comparison, PLUS a "Loans Past Expected Completion" section listing staff where classification = OVERDUE with: staff name, months past expected, outstanding balance, severity (mild ≤6mo / moderate 7-18mo / elevated >18mo), And a "Balance Unchanged" section listing STALLED loans with: staff name, consecutive unchanged months, frozen amount
- Given severity classification on overdue loans, Then severity labels use: Mild, Moderate, Elevated — never Low/Medium/High or colour-coded red badges

---

### Story 6.3: Weekly AG Report

**Existing scope:** 7-day activity summary.

**Enriched with:**

| New Section | Source | What It Adds |
|------------|--------|-------------|
| Quick wins this week | Classification Service | Loans with ≤3 installments remaining — lowest effort recoveries |
| Observation resolution summary | Observation Engine (E3) | Observations reviewed/resolved since last report |
| Portfolio status snapshot | Classification Service | Point-in-time status breakdown for trend comparison week-over-week |

**New AC addition:**
- Given a weekly AG report, When generated, Then it includes: the existing activity summary, PLUS "Quick Recovery Opportunities" (loans with ≤3 installments remaining, sorted by outstanding ascending), "Observation Activity" (new/reviewed/resolved counts since last report date), and "Portfolio Snapshot" (status breakdown for week-over-week comparison)

---

### Story 6.4: Branded PDF Export & One-Tap Sharing

**No enrichment needed.** The existing scope (branded PDF with Oyo State crest, one-tap share) already covers the export mechanism. The enriched content from Stories 6.1-6.3 flows through automatically.

---

## 6. Phase 2 Backlog: Advanced Analytics

These capabilities are proven by SQ-1 but deferred from MVP. They become **Epic 15: Executive Analytics & Intelligence** if approved as a standalone epic, or fold into an expanded E4/E6 post-launch.

**Dependency:** E3 (migration), E4 (dashboard services), E5 (live submissions), E6 (reports).

### 6.1 Standalone Report Views (Phase 2)

| ID | Report | Derivation | Why Deferred |
|----|--------|-----------|-------------|
| P2-R1 | Expected vs Actual Exit Gap Chart | Cumulative timeline: expected exits per month vs actual exits — shows gap widening over time | Powerful political visual, but requires monthly submission history (E5) to be meaningful. Best launched after 3+ months of live data. |
| P2-R2 | Revenue Recovery Planner (standalone view) | 3-tier recovery strategy with per-tier loan lists, projected monthly recovery if resumed, annual projections | MVP surfaces the summary in E6 Executive Report. Standalone drill-down is Phase 2. |
| P2-R3 | Revenue Forecast Waterfall | 24-month forward projection: monthly revenue tapering as loans complete | Requires active loan data to be stable post-migration. Meaningful after E5 submissions validate balances. |
| P2-R4 | Concentration & Exposure Risk View | Top 20 individual exposure, top 3 MDA concentration as % of portfolio | Risk view. Useful but not operationally urgent for launch. |
| P2-R5 | MDA Scorecard (standalone full view) | Full ranked table of all 63 MDAs with health scores, all status columns, trend indicators | MVP surfaces health score in E4 compliance view. Standalone scorecard page is Phase 2. |
| P2-R6 | Rate / Tenure Distribution Dashboard | Proves the "one rate, six tenures" model — interest rate variants mapped to tenure lengths | Analytical / archival. Important for understanding the scheme but not for daily operations. |
| P2-R7 | Configurable Accountability Window UI | User-selectable time window (24/36/48/60 months, fiscal year, custom range) | MVP uses fixed 60-month default. Configurability is a UI feature, not a computation gap. |
| P2-R8 | Configurable Health Score Weights | AG can adjust health score formula weights | Needs 3+ months of real scores to know if weights need adjusting. Premature to build now. |

### 6.2 Alert & Notification Triggers (Phase 2)

These transform the dashboard from passive (user must look) to active (system pushes):

| Trigger | Condition | Notification Channel | Why Deferred |
|---------|-----------|---------------------|-------------|
| MDA health drop | Score drops below 40 | Email to AG + attention item | Requires baseline health scores from 2+ months of data |
| New over-deduction | Balance crosses below zero | Attention item + Dept Admin email | Epic 9 (Sprint 13) covers notification infrastructure |
| MDA goes dark | No submission for 3+ months | Escalation email chain | Epic 9 covers escalation patterns |
| Quick-win expiring | Loan at 1 installment remaining for 2+ months without completion | Attention item | Needs live submission data to detect |

**Note:** These are natural extensions of Epic 9 (Notifications & Alerts, Sprint 13). When E9 is built, these triggers should be included.

---

## 7. FR Mapping: Existing Coverage & Gaps

### 7.1 Reports Already Covered by Existing FRs

| SQ-1 Report | Existing FR | Epic | What's New (AC Enrichment Only) |
|------------|------------|------|-------------------------------|
| C1: Executive Action Dashboard | FR32 (headline metrics) + FR33 (attention items) | E4 | Loan classification, at-risk amount, collection potential |
| C2: Window Overview | FR34 (MDA drill-down) | E4 | Status breakdown per MDA, health score |
| C4: Overdue Register | FR57 (inactive loan detection) + FR56 (exception queue) | E7 | Severity tiers, months-overdue in report output |
| C5: Stalled & Over-Deduction | FR87 observation types #2 and #3 | E3 | Current-window filter as report section in E6 |
| C9: Quick Wins | FR32 (metrics) — derived from classification | E4 | Quick-win count as attention item + report section |
| C10: MDA Scorecard | FR36 (compliance status) | E4 | Health score formula, weighted scoring |
| C12: Data Submission Gaps | FR86 (Submission Heatmap) | E4+E5 | Coverage %, dark MDA concept, staleness indicator |
| H1: Outstanding Receivables | FR37 (Executive Summary component) | E6 | Ranked MDA table in Executive Summary report |
| H2: Stalled Deductions | FR87 observation type #2 (Stalled Balance) | E3 | Already generated during migration |
| H3: Over-Deduction | FR87 observation type #3 (Negative Balance) | E3 | Already generated during migration |
| H4: Beneficiary Match | FR85 (Beneficiary Cross-Reference) | E3 | Already generated during migration |
| H6: Multi-MDA Staff | FR87 observation type #4 (Multi-MDA) | E3 | Already generated during migration |

### 7.2 Genuinely New Capabilities (Not Covered by Existing FRs)

| Capability | Where It Lives | FR Impact |
|-----------|---------------|-----------|
| Loan Classification Service | Internal service, no new FR — powers FR32/FR33/FR34 | None — implementation detail |
| MDA Health Score | Enriches FR36 | Expand FR36 description to include health score |
| Revenue Projection (monthly collection potential) | Enriches FR32 | Expand FR32 to include collection potential metric |
| Recovery Tiers (quick/intervention/extended) | E6 Executive Summary section | Expand FR37 to include recovery potential |
| Staleness Indicator | Enriches FR36 | Expand FR36 to include last-updated date |
| Quick-Win identification | Enriches FR33 | Expand FR33 to include quick-win attention items |

**Total new FRs needed: 0.** All capabilities are enrichments of existing FRs (FR32, FR33, FR36, FR37). PRD cascade updates FR descriptions, not FR count.

---

## 8. Data Source Mapping

### 8.1 Legacy JSON to VLPRS Database Schema

| Legacy Field (catalog.json) | VLPRS Table.Column | Notes |
|-------|------|-------|
| `fields.staffName` | `loans.staff_name` | Normalised, uppercase |
| `fields.mda` / `rec.mda.code` | `loans.mda_id` → `mdas.code` | FK relationship |
| `fields.principal` | `loans.principal_amount` | NUMERIC(15,2) |
| `fields.totalLoan` | `loans.total_loan_amount` | NUMERIC(15,2) |
| `fields.outstandingBalance` | `loans.outstanding_balance` | Updated per submission |
| `fields.monthlyDeduction` | `loans.monthly_deduction` | NUMERIC(15,2) |
| `fields.installmentCount` | `loans.tenure_months` | Total installments |
| `fields.installmentsPaid` | `loans.installments_paid` | Running count |
| `fields.installmentsOutstanding` | `loans.installments_remaining` | Computed or stored |
| `fields.interestTotal` | `loans.interest_amount` | NUMERIC(15,2) |
| `rec.period.year/month` | `monthly_submissions.period_year/month` | Per-month snapshot |

### 8.2 Key Computations: Legacy Approach vs VLPRS

| Computation | Legacy (SQ-1) | VLPRS |
|-------------|--------------|-------|
| Latest balance per staff | Walk all records, find max period | `loans.outstanding_balance` (always current) |
| Stall detection | Compare consecutive monthly records | Observation Engine (E3) + `monthly_submissions` comparison (E5) |
| Expected exit | `first_period + installments_outstanding` | `loans.start_date + tenure_months` |
| Rate/tenure mapping | `(totalLoan - principal) / principal` | `loans.interest_rate` or computed from amounts |
| MDA submission coverage | Count distinct months per MDA in JSON | `monthly_submissions` GROUP BY `mda_id`, `period_month` |
| Loan classification | Custom JSON walker in analysis script | `loanClassificationService.classify()` — shared, tested service |

---

## 9. Non-Punitive Language Compliance

All dashboard elements and reports use observation-style language per `packages/shared/src/constants/vocabulary.ts`:

| Element | Use | Do NOT Use |
|---------|-----|-----------|
| Stalled deductions | "Balance unchanged" | "Stalled" / "Frozen" |
| Over-deductions | "Balance below zero" | "Over-deduction" / "Error" |
| Overdue loans | "Past expected completion" | "Delinquent" / "Defaulted" |
| MDA health scores | "Needs attention" / "For review" | "Failing" / "Poor" |
| Dark MDAs | "Submission gap observed" | "Non-compliant" / "Delinquent" |
| Severity tags | Mild / Moderate / Elevated | Low / Medium / High |
| Colour coding | Amber for attention, grey for neutral, teal for info | Red badges |
| Health score bands | Healthy / Attention / For Review | Good / Warning / Critical |

**"Four Settlement Paths" reference:** The SQ-1 H5 report references a "Four Settlement Paths" policy framework. This refers to the 4 ways a loan can reach zero: (1) Standard completion (full tenure), (2) Accelerated repayment (shortened tenure), (3) Early exit (lump sum payoff), (4) Retirement split (payroll portion + gratuity receivable). This framework is already modelled in the computation engine (FR1-FR5) and early exit workflow (FR67-FR69). No new feature needed — just a labelling convention for reports.

---

## 10. Decisions Log

All original open questions closed with rationale:

| # | Question | Decision | Rationale |
|---|----------|----------|-----------|
| 1 | Window configurable? | **Service accepts window params. Default 60 months. No MVP UI.** | Build the capability, defer the configuration interface. The AG won't change the window in Month 1. |
| 2 | Health score weights configurable? | **Fixed for MVP.** Revisit after 3 months of live scores. | Need real data to know if weights are wrong. Configurability without data is a feature nobody uses. |
| 3 | E4 story sizing? | **Enrich existing 4 stories. Zero new stories.** | Classification engine is an internal dependency, not a user-facing story. Preserves sprint model. |
| 4 | Export format priority? | **In-app dashboard (E4). PDF (E6, FR53). HTML export: never.** | FR53/54 already cover PDF. Nobody emails raw HTML in government. |
| 5 | Real-time vs batch? | **All real-time for MVP.** | ~3,150 loans is tiny. Classification query on this volume is <500ms. Batch infrastructure is premature. Revisit at 10K+ loans. |
| 6 | C6/H4 merge? | **Merged.** One service (`beneficiaryPipelineService`), two views. | Same data source, same matching logic. One service, not two stories. |
| 7 | Transfers as first-class entity? | **Yes — Epic 10 + Epic 3 Story 3.3 already build the foundation.** | Cross-MDA profiles exist after E3. `staff_transfers` table or inferred from loan history — architecture decision for Story 3.3 implementation. |
| 8 | MDA Governance standalone report? | **No. Fold into FR86 (Submission Heatmap) + E4 Story 4.4 enrichment.** | The submission heatmap IS the governance view. Adding "dark MDA" concept to 4.4 covers it. |

---

## 11. Cascade Actions

When this document is approved, the following updates propagate:

### 11.1 PRD Updates (edit, not add)

| FR | Current Description | Add |
|----|-------------------|-----|
| FR32 | 4 headline numbers | Add: "Additionally includes totalOutstandingReceivables, monthlyCollectionPotential, atRiskAmount, and loanCompletionRate computed via Loan Classification Service with 60-month default window" |
| FR33 | Attention items with status indicators | Add: "Attention sources include: overdue loan count, stalled deduction count, quick-win opportunities (≤3 installments remaining), dark MDAs (no submission in 6+ months), and onboarding lag (approved but not collecting)" |
| FR36 | MDA compliance status | Add: "Each MDA displays: submission status, health score (0-100, computed from weighted portfolio performance), historical submission coverage %, last submission date, and staleness indicator for MDAs with data older than 2 months" |
| FR37 | Executive Summary reports | Add: "Report includes: loan portfolio status breakdown (by classification), MDA scorecard (top 10 + bottom 5 by health score), outstanding receivables ranked by MDA, recovery potential summary (3-tier: quick/intervention/extended), and submission coverage summary" |
| Phase 2 | Full Executive Report Suite | Add: "Epic 15: Executive Analytics & Intelligence — Expected vs Actual Exit Gap, Revenue Recovery Planner, Revenue Forecast Waterfall, Concentration Risk View, Configurable Window UI, Configurable Health Score Weights, Active Alert Triggers" |

### 11.2 Epics Updates

| Story | Update Type | Details |
|-------|------------|---------|
| 4.1 | Expand ACs | Add hero metrics (outstanding, collection potential, at-risk, completion rate). Note: Loan Classification Service and Revenue Projection Service built as internal dependencies. |
| 4.2 | Expand ACs | Add attention sources (overdue, stalled, quick-wins, dark MDAs, onboarding lag). |
| 4.3 | Expand ACs | Add loan status badges and MDA health scores in drill-down views. |
| 4.4 | Expand ACs | Add health score column, coverage %, dark MDA highlighting, staleness indicator. |
| 6.1 | Expand ACs | Add portfolio status breakdown, MDA scorecard, receivables ranking, recovery summary, coverage summary. |
| 6.2 | Expand ACs | Add overdue register section, stalled register section, over-deduction register section with severity tiers. |
| 6.3 | Expand ACs | Add quick-wins section, observation resolution summary, portfolio snapshot for trend comparison. |

### 11.3 Sprint Status

**No changes.** Story count unchanged. Sprint sequence unchanged.

### 11.4 Architecture

**No structural changes.** The 5 computation services are implementation details of existing stories, built within the existing service layer (`apps/server/src/services/`). They follow the established pattern of the 20 server-side services already specified in the architecture.

---

*Derived from SQ-1 Legacy CD Analysis Engine — March 2026*
*5 computation services | 8 enriched story ACs | 8 Phase 2 items*
*Zero new stories | Zero new FRs | Zero sprint delay*
