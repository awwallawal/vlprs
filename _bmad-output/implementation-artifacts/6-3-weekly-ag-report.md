# Story 6.3: Weekly AG Report

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **Department Admin**,
I want to generate a weekly report for the AG covering the past 7 days of activity,
so that the AG receives a concise operational summary without requesting individual reports.

## Acceptance Criteria

### AC1: Weekly AG Report Generation (FR41)

**Given** the weekly report generator
**When** a Department Admin or Super Admin requests a weekly AG report
**Then** the report covers the 7-day period ending on the generation date and contains:

1. **Executive Summary** — scheme overview with current active loans, total exposure, fund available, monthly recovery rate
2. **Compliance Status** — submissions received this week: count by MDA, submission status (processing/confirmed/rejected)
3. **Exceptions Resolved** — observations resolved in past 7 days with resolution notes
4. **Outstanding Attention Items** — current open attention items requiring AG action

**And** the report is generated in <10 seconds (NFR-PERF-4)

### AC2: Weekly AG Report Enhanced Sections

**Given** the weekly AG report
**When** generated
**Then** it additionally includes:

1. **"Quick Recovery Opportunities" section** — loans with <=3 installments remaining (via loan classification), sorted by outstanding ascending (lowest-effort recoveries first): staff name, MDA, outstanding balance, estimated remaining installments
2. **"Observation Activity" section** — counts since the 7-day window start:
   - New observations (createdAt in window)
   - Reviewed observations (reviewedAt in window)
   - Resolved observations (resolvedAt in window)
3. **"Portfolio Snapshot" section** — point-in-time classification breakdown: completed, on-track, past expected completion, balance unchanged, balance below zero — with counts and percentages for week-over-week trend comparison

## Dependencies

- **Depends on:** Story 6.1 (Executive Summary — creates ReportsPage tabs, useReportData.ts, report types) and Story 6.2 (Variance & Loan Snapshot — extends tabs and hooks). Story 6.3 adds a 5th tab and extends the same files
- **Recommended after:** Story 7.0a (Financial Precision) for Decimal.js monetary sums; Story 7.1 (Exception Queue) for meaningful "exceptions resolved" data in the report
- **Blocks:** Story 6.4 (PDF Export — applies to all reports including weekly AG)
- **No migrations required** — pure composition layer + frontend

## Tasks / Subtasks

- [x] Task 1: Create shared report types and validation schemas (AC: #1, #2)
  - [x] 1.1 Add `WeeklyAgReportData` interface to `packages/shared/src/types/report.ts`:
    - `generatedAt: string` (ISO timestamp)
    - `periodStart: string` (ISO date — 7 days ago)
    - `periodEnd: string` (ISO date — generation date)
    - `executiveSummary: WeeklyExecutiveSummary` (activeLoans, totalExposure, fundAvailable, monthlyRecoveryRate)
    - `complianceStatus: WeeklyComplianceStatus` (submissionsThisWeek: WeeklySubmissionRow[], totalSubmissions: number)
    - `exceptionsResolved: WeeklyResolvedException[]` (staffName, type, resolutionNote, resolvedAt, mdaName)
    - `outstandingAttentionItems: AttentionItem[]` (reuse existing type from dashboard.ts)
    - `quickRecoveryOpportunities: QuickRecoveryRow[]` (staffName, staffId, mdaName, outstandingBalance, estimatedRemainingInstallments)
    - `observationActivity: ObservationActivitySummary` (newCount, reviewedCount, resolvedCount)
    - `portfolioSnapshot: PortfolioSnapshotRow[]` (classification, count, percentage)
  - [x] 1.2 Add supporting sub-interfaces: `WeeklyExecutiveSummary`, `WeeklyComplianceStatus`, `WeeklySubmissionRow` (mdaName, mdaCode, submissionDate, recordCount, status), `WeeklyResolvedException`, `QuickRecoveryRow`, `ObservationActivitySummary`, `PortfolioSnapshotRow`
  - [x] 1.3 Add `weeklyAgReportQuerySchema` to `packages/shared/src/validators/reportSchemas.ts`: optional `asOfDate` (ISO date string, defaults to today — allows generating report for past dates)
  - [x] 1.4 Re-export from index files

- [x] Task 2: Create Weekly AG Report Service (AC: #1, #2)
  - [x] 2.1 Create `apps/server/src/services/weeklyAgReportService.ts`
  - [x] 2.2 Implement `generateWeeklyAgReport(mdaScope: string | null, asOfDate?: Date)` — main orchestrator:
    - Compute window: `periodEnd = asOfDate ?? new Date()`, `periodStart = subDays(periodEnd, 7)`
    - Run all section queries in parallel via `Promise.all()`
    - Return `WeeklyAgReportData`
  - [x] 2.3 Implement executive summary section (private helper):
    - Reuse dashboard metrics pattern: active loan count, total exposure (sum outstanding), fund available (from scheme fund config), monthly recovery (latest ledger period sum)
    - Use existing queries from `dashboardRoutes.ts` pattern — do NOT call the HTTP endpoint, call the underlying query logic directly
  - [x] 2.4 Implement compliance status section (private helper):
    - Query `mdaSubmissions` WHERE `createdAt >= periodStart AND createdAt <= periodEnd`
    - JOIN `mdas` for MDA name/code
    - Group results by MDA, include submission date, record count, status
  - [x] 2.5 Implement exceptions resolved section (private helper):
    - Query `observations` WHERE `resolvedAt >= periodStart AND resolvedAt <= periodEnd AND status = 'resolved'`
    - JOIN `mdas` for MDA name
    - Select: staffName, type, resolutionNote, resolvedAt, mdaName
    - Order by resolvedAt DESC
  - [x] 2.6 Implement outstanding attention items section:
    - Call `attentionItemService.getAttentionItems(mdaScope)` — reuse existing service directly
    - Return top items (same as dashboard attention endpoint)
  - [x] 2.7 Implement quick recovery opportunities section (private helper):
    - Query ACTIVE loans with `outstandingBalance > 0 AND monthlyDeductionAmount > 0`
    - Compute `remainingInstallments = Math.ceil(Decimal(outstandingBalance).div(monthlyDeductionAmount).toNumber())`
    - Filter WHERE `remainingInstallments <= 3`
    - JOIN `mdas` for MDA name
    - Sort by outstandingBalance ASC (lowest-effort first)
    - Apply MDA scope
  - [x] 2.8 Implement observation activity section (private helper):
    - Run 3 count queries in parallel:
      - New: `COUNT(*) FROM observations WHERE createdAt >= periodStart AND createdAt <= periodEnd`
      - Reviewed: `COUNT(*) FROM observations WHERE reviewedAt >= periodStart AND reviewedAt <= periodEnd`
      - Resolved: `COUNT(*) FROM observations WHERE resolvedAt >= periodStart AND resolvedAt <= periodEnd`
    - Apply MDA scope to all three
  - [x] 2.9 Implement portfolio snapshot section:
    - Call `loanClassificationService.classifyAllLoans(mdaScope)` for current classifications
    - Aggregate: count per classification enum → compute percentages
    - Map classification labels to non-punitive display names
  - [x] 2.10 Write unit tests in `weeklyAgReportService.test.ts`

- [x] Task 3: Add report API route (AC: #1, #2)
  - [x] 3.1 Add `GET /api/reports/weekly-ag` to `apps/server/src/routes/reportRoutes.ts`
    - Auth: `authenticate`, `requirePasswordChange`, `authorise(SUPER_ADMIN, DEPT_ADMIN)`, `scopeToMda`
    - Validate query with `weeklyAgReportQuerySchema`
    - Call `generateWeeklyAgReport(req.mdaScope, parsedAsOfDate)`
    - Response: `{ success: true, data: WeeklyAgReportData }`
  - [x] 3.2 Write route integration tests

- [x] Task 4: Build Reports page — Weekly AG Report view (AC: #1, #2)
  - [x] 4.1 Add "Weekly AG Report" tab to the report type selector on ReportsPage (alongside Executive Summary, MDA Compliance, Variance, Loan Snapshot from Stories 6.1-6.2)
  - [x] 4.2 Build `WeeklyAgReport` component in `apps/client/src/pages/dashboard/components/WeeklyAgReport.tsx`:
    - Report header: generation date, period window (e.g., "14 Mar — 21 Mar 2026")
    - Optional date picker for `asOfDate` (defaults to today)
    - **Executive Summary section** — card row: active loans, total exposure (₦), fund available (₦), monthly recovery rate (₦)
    - **Compliance Status section** — table: MDA name, code, submission date, record count, status badge. Summary: "X submissions received from Y MDAs this week"
    - **Exceptions Resolved section** — table: staff name, observation type, resolution note (truncated with expand), resolved date, MDA. If empty: "No observations resolved this week"
    - **Outstanding Attention Items section** — reuse `AttentionItem` card pattern from dashboard. Show top items with priority ordering
    - **Quick Recovery Opportunities section** — table: staff name, MDA, outstanding balance (₦), remaining installments. Summary: "X loans recoverable within 3 months, totaling ₦Y"
    - **Observation Activity section** — three-stat card: New (count), Reviewed (count), Resolved (count)
    - **Portfolio Snapshot section** — table/chart: classification, count, percentage. Use non-punitive labels (Completed, On Track, Past Expected Completion, Balance Unchanged, Balance Below Zero)
  - [x] 4.3 Add `useWeeklyAgReport(asOfDate?)` hook to `apps/client/src/hooks/useReportData.ts`
  - [x] 4.4 Frontend tests for WeeklyAgReport component

## Review Follow-ups (AI)

- [x] [AI-Review][HIGH] `classifyAllLoans()` called 3x per report (2x direct + 1x via `getTotalOutstandingReceivables`). Refactored to call once and pass result through. [weeklyAgReportService.ts:62-69, revenueProjectionService.ts:38-41]
- [x] [AI-Review][MEDIUM] Frontend quick recovery summary uses floating-point `Number()` addition for monetary values — violates financial precision contract. Fixed to use integer-cents computation. [WeeklyAgReport.tsx:268-269]
- [x] [AI-Review][MEDIUM] Completion notes claim 39 new tests / 10 integration tests — actual count is 32 / 9. Corrected. [story Completion Notes]
- [x] [AI-Review][MEDIUM] Missing `performance sanity check` integration test required by Testing Requirements section. Added. [reportRoutes.integration.test.ts]
- [x] [AI-Review][LOW] `generatedAt` timestamp captured after Promise.all finishes, not at function entry. Moved to top of function. [weeklyAgReportService.ts:73]
- [ ] [AI-Review][LOW] No database indexes on `observations.createdAt/reviewedAt/resolvedAt` or `mdaSubmissions.createdAt` for time-windowed queries — track as tech debt for future prep story. [schema.ts:483-491, 621-625]
- [x] [AI-Review][LOW] `formatObservationType` uses naive title-casing — produces "Multi Mda" instead of "Multi-MDA", "Grade Tier Mismatch" instead of "Grade–Tier Mismatch". Replaced with `OBSERVATION_HELP` glossary labels. [WeeklyAgReport.tsx:387-390]

## Dev Notes

### Architecture & Composition Pattern

Same composition pattern as Stories 6.1 and 6.2 — orchestrate existing services, do NOT create new data sources. This report is unique because it's **time-windowed** — most queries need a `periodStart/periodEnd` filter.

```typescript
const periodEnd = asOfDate ?? new Date();
const periodStart = subDays(periodEnd, 7);
```

Use `date-fns` for all date arithmetic: `subDays`, `differenceInMonths`, `addMonths` are already imported throughout the codebase.

### CRITICAL: Reuse Existing Services — Do NOT Duplicate

| Section | Reuse From | How |
|---------|-----------|-----|
| Executive Summary | Dashboard metrics queries in `dashboardRoutes.ts:48-122` | Extract query logic into reusable functions or call Drizzle queries directly |
| Attention Items | `attentionItemService.getAttentionItems(mdaScope)` | Call directly — returns sorted AttentionItem[] |
| Quick Recovery | `attentionItemService.ts:246-331` quick win detection pattern | Reuse computation pattern: `Math.ceil(outstanding / monthlyDeduction) <= 3` |
| Portfolio Snapshot | `loanClassificationService.classifyAllLoans(mdaScope)` | Call directly — returns Map, aggregate to counts/percentages |

**NEW queries needed** (no existing service covers these with date ranges):
- Compliance status: `mdaSubmissions` filtered by `createdAt` within 7-day window
- Exceptions resolved: `observations` filtered by `resolvedAt` within 7-day window
- Observation activity: Three count queries on `observations` by `createdAt`/`reviewedAt`/`resolvedAt` within window

### Observation Date-Range Queries

The `observationService.ts` does NOT currently support date-range filtering. For the weekly report, query the `observations` table directly in the report service rather than extending `observationService` — these date-bounded aggregations are report-specific.

**Key schema columns for time-windowed queries:**
- `observations.createdAt` — when observation was auto-generated
- `observations.reviewedAt` — when marked as reviewed (nullable)
- `observations.resolvedAt` — when resolved (nullable)
- `observations.resolutionNote` — the resolution text (nullable)
- `observations.status` — enum: `unreviewed | reviewed | resolved | promoted`

### Quick Recovery Computation

Established pattern from `attentionItemService.ts`:

```typescript
// For ACTIVE loans with positive outstanding and deduction:
const remaining = new Decimal(loan.outstandingBalance)
  .div(new Decimal(loan.monthlyDeductionAmount))
  .ceil()
  .toNumber();

if (remaining <= 3) {
  // Quick recovery opportunity
}
```

Sort results by `outstandingBalance ASC` — lowest-effort recoveries first (AG wants to see quick wins).

### Portfolio Snapshot — Classification Label Mapping

Map `LoanClassification` enum to non-punitive display names:

| Classification Enum | Display Label |
|--------------------|--------------|
| `COMPLETED` | Completed |
| `ON_TRACK` | On Track |
| `OVERDUE` | Past Expected Completion |
| `STALLED` | Balance Unchanged |
| `OVER_DEDUCTED` | Balance Below Zero |

### Executive Summary — Direct Query vs HTTP Call

Do NOT call `GET /api/dashboard/metrics` from the report service. Instead, use the same Drizzle queries that the dashboard route uses. The dashboard route handler in `dashboardRoutes.ts:48-122` runs 9 parallel queries — extract or replicate the relevant ones (active loan count, total exposure, fund available, monthly recovery).

If Story 6.1 has already extracted these into a reusable `executiveSummaryReportService.ts`, call that service's scheme overview section directly.

### Previous Stories (6.1, 6.2) Intelligence

- **6.1 Status:** ready-for-dev (as of 2026-03-21)
- **6.2 Status:** ready-for-dev (as of 2026-03-21)
- ReportsPage will have tabs from 6.1 (Executive Summary, MDA Compliance) and 6.2 (Variance, Loan Snapshot)
- `useReportData.ts` hook file created in 6.1 — extend with `useWeeklyAgReport()`
- `reportRoutes.ts` has endpoints from 6.1 and 6.2 — append weekly AG endpoint
- Report types in `packages/shared/src/types/report.ts` — extend with weekly AG interfaces
- Same auth pattern throughout: `authenticate`, `requirePasswordChange`, `authorise(SUPER_ADMIN, DEPT_ADMIN)`, `scopeToMda`
- `AttentionItem` type already exists in `packages/shared/src/types/dashboard.ts` — reuse directly, don't create a duplicate type

### Non-Punitive Vocabulary Compliance

| Data Concept | Use | Never Use |
|-------------|-----|-----------|
| Portfolio classification | On Track, Past Expected Completion, Balance Unchanged, Balance Below Zero | Overdue, Stalled, Over-Deducted |
| Resolved items | "Observation resolved" | "Exception cleared", "Issue fixed" |
| Submission status | Processing / Confirmed / Rejected | Pending / Approved / Failed |
| Quick recovery | "Quick Recovery Opportunity" | "Easy win", "Low-hanging fruit" |
| Color coding | Teal (info), amber (attention), grey (neutral) | Red badges |

### Financial Value Handling

- All monetary values: `decimal.js` on server, string in API responses, `NairaDisplay` on frontend
- Quick recovery computation MUST use `Decimal` — `Math.ceil(outstanding / deduction)` with floats will cause rounding errors
- Format chain: `NUMERIC(15,2)` → Decimal → string → `formatNaira()` → `"₦278,602.72"`

### API Design

```
GET /api/reports/weekly-ag
  Query: { asOfDate?: string (ISO date, defaults to today) }
  Response: { success: true, data: WeeklyAgReportData }
  Auth: SUPER_ADMIN, DEPT_ADMIN
  Notes: asOfDate allows generating historical weekly reports.
         7-day window computed server-side: [asOfDate - 7 days, asOfDate].
```

Extends existing `reportRoutes.ts` — no new route registration needed.

### Project Structure Notes

**Backend — new files:**
```
apps/server/src/services/
  weeklyAgReportService.ts          # NEW — weekly report composition
  weeklyAgReportService.test.ts     # NEW — unit tests
```

**Backend — modified files:**
```
apps/server/src/routes/reportRoutes.ts   # ADD weekly-ag endpoint
```

**Shared — modified files:**
```
packages/shared/src/types/report.ts           # ADD weekly AG interfaces
packages/shared/src/validators/reportSchemas.ts  # ADD weeklyAgReportQuerySchema
```

**Frontend — new files:**
```
apps/client/src/pages/dashboard/components/WeeklyAgReport.tsx   # NEW
```

**Frontend — modified files:**
```
apps/client/src/pages/dashboard/ReportsPage.tsx   # ADD Weekly AG Report tab
apps/client/src/hooks/useReportData.ts             # ADD useWeeklyAgReport() hook
```

### Testing Requirements

**Backend unit tests:**
- Weekly report composition: verify all 7 sections present with correct data shape
- Date window: verify `periodStart` is exactly 7 days before `periodEnd`
- Custom `asOfDate`: verify window shifts correctly for historical reports
- Compliance status: verify only submissions within 7-day window included
- Exceptions resolved: verify only observations with `resolvedAt` in window included, resolution notes present
- Quick recovery: verify `remaining <= 3` filter, correct decimal.js computation, sort order (ASC by outstanding)
- Observation activity: verify separate counts for new (createdAt), reviewed (reviewedAt), resolved (resolvedAt)
- Portfolio snapshot: verify classification counts sum to total active loans, percentages sum to 100%
- MDA scoping: DEPT_ADMIN restricted to assigned MDAs across all sections

**Backend integration tests:**
- Route auth: SUPER_ADMIN and DEPT_ADMIN access allowed, MDA_OFFICER blocked
- Default asOfDate (no param): uses current date
- Custom asOfDate: accepts valid ISO date string
- Invalid asOfDate: returns 400
- Response shape matches Zod schema
- Generation completes in <10 seconds (performance sanity check)

**Frontend tests:**
- WeeklyAgReport renders all 7 sections
- Date picker updates report data
- Empty states: "No submissions this week", "No observations resolved this week"
- NairaDisplay renders in executive summary and quick recovery sections
- Non-punitive labels in portfolio snapshot (no "Overdue", "Stalled", etc.)
- Attention items reuse dashboard card pattern

### Performance Budget

- Weekly AG report: <10 seconds total generation (NFR-PERF-4)
- 7 parallel queries via `Promise.all()` — each should complete in <1 second
- `classifyAllLoans()` is the heaviest (~500ms) — acceptable for weekly reports
- `attentionItemService.getAttentionItems()` runs 12 detectors in parallel (~1-2s) — acceptable
- Quick recovery query is lightweight (single table scan with filter)
- N+1 query budget: max 10 queries per endpoint (team agreement)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 6 Story 6.3] — Full AC with BDD scenarios
- [Source: apps/server/src/services/attentionItemService.ts] — Attention items + quick win detection pattern
- [Source: apps/server/src/services/observationService.ts] — Observation queries (extend with date range for report)
- [Source: apps/server/src/services/loanClassificationService.ts] — classifyAllLoans() for portfolio snapshot
- [Source: apps/server/src/routes/dashboardRoutes.ts:48-122] — Dashboard metrics query pattern (reuse for executive summary)
- [Source: apps/server/src/routes/dashboardRoutes.ts:281-294] — Attention items endpoint pattern
- [Source: apps/server/src/db/schema.ts:458-493] — Observations table (createdAt, reviewedAt, resolvedAt, resolutionNote)
- [Source: apps/server/src/db/schema.ts:592-618] — MDA submissions table (createdAt for time-windowed query)
- [Source: packages/shared/src/types/dashboard.ts:70-96] — AttentionItem type (reuse directly)
- [Source: packages/shared/src/constants/vocabulary.ts] — Non-punitive vocabulary constants
- [Source: _bmad-output/implementation-artifacts/6-1-executive-summary-mda-compliance-reports.md] — Story 6.1 patterns
- [Source: _bmad-output/implementation-artifacts/6-2-variance-loan-snapshot-reports.md] — Story 6.2 patterns

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- No blocking issues encountered during implementation.

### Completion Notes List

- Story composed from Epic 6.3 definition + exhaustive codebase analysis
- Time-windowed query pattern documented — no existing services support date-range filtering, queries go directly to DB
- attentionItemService.getAttentionItems() reused directly for outstanding attention items section
- Quick recovery uses established pattern from attentionItemService.ts:246-331 — Decimal.ceil(outstanding/deduction) <= 3
- observationService does NOT support date-range queries — report service queries observations table directly
- Observations table verified: createdAt, reviewedAt, resolvedAt, resolutionNote columns all present
- mdaSubmissions table verified: createdAt column available for time-windowed compliance status
- Portfolio snapshot maps LoanClassification enum to non-punitive display labels
- AttentionItem type from dashboard.ts reused — no duplicate type creation
- asOfDate parameter allows historical report generation for flexibility
- Implementation: 7 parallel section queries via Promise.all() in service orchestrator
- Executive summary reuses loanClassificationService, revenueProjectionService, schemeConfigService directly
- Quick recovery computes remaining installments per-loan with Decimal.js precision — sorted ASC by outstanding
- Compliance status, exceptions resolved, observation activity use direct Drizzle queries with date-range filters
- All 7 frontend sections render with non-punitive vocabulary, MetricHelp tooltips, NairaDisplay formatting
- Full test suite: 13 unit tests (service), 10 integration tests (route, incl. perf check), 9 frontend component tests, 1 new ReportsPage test = 33 new tests
- No regressions: 2,503 total tests pass across shared/server/client/integration suites

### File List

**New files:**
- apps/server/src/services/weeklyAgReportService.ts
- apps/server/src/services/weeklyAgReportService.test.ts
- apps/client/src/pages/dashboard/components/WeeklyAgReport.tsx
- apps/client/src/pages/dashboard/components/WeeklyAgReport.test.tsx

**Modified files:**
- packages/shared/src/types/report.ts (added WeeklyAgReportData + 7 sub-interfaces)
- packages/shared/src/validators/reportSchemas.ts (added weeklyAgReportQuerySchema + weeklyAgReportSchema)
- packages/shared/src/index.ts (re-exported new types and schemas)
- apps/server/src/routes/reportRoutes.ts (added GET /api/reports/weekly-ag endpoint)
- apps/server/src/routes/reportRoutes.integration.test.ts (added 10 weekly-ag integration tests)
- apps/server/src/services/revenueProjectionService.ts (added optional preComputedClassifications param to getTotalOutstandingReceivables)
- apps/client/src/hooks/useReportData.ts (added useWeeklyAgReport hook)
- apps/client/src/pages/dashboard/ReportsPage.tsx (added Weekly AG Report tab)
- apps/client/src/pages/dashboard/ReportsPage.test.tsx (added tab render test)

## Change Log

- 2026-03-28: Story 6.3 implemented — Weekly AG Report with 7 sections (executive summary, compliance status, exceptions resolved, outstanding attention items, quick recovery opportunities, observation activity, portfolio snapshot). Full-stack: shared types + Zod schemas, composition service with time-windowed queries, API route with auth/validation, React component with date picker and non-punitive vocabulary. 33 new tests added.
- 2026-03-28: Code review — 7 findings (1H, 3M, 3L). Fixed: classifyAllLoans pre-fetched once (was 3x), frontend monetary sum precision, generatedAt timing, observation type labels via OBSERVATION_HELP glossary, added performance sanity check integration test, corrected test count claims. Added optional preComputedClassifications param to revenueProjectionService.getTotalOutstandingReceivables. Tech debt noted: missing DB indexes on observation/submission date columns.
