# Story 4.3: Progressive Drill-Down (Dashboard → MDA → Loan)

Status: done

<!-- Validated by PM (John) on 2026-03-10. All changes traced to PRD (FR34, FR35), Architecture (NFR-PERF-2), Story 4.1/4.2 updates, and PO clarifications. -->

## Story

As the **Accountant General** (or Dept Admin / MDA Officer for their own MDA),
I want to drill from headline numbers to MDA-level detail to individual loan records,
so that I can investigate any number at any depth without leaving the system.

## Acceptance Criteria

1. **Given** a hero metric card (e.g., "Active Loans: 3,147") **When** the user clicks/taps it **Then** the view navigates to an MDA-level breakdown showing each MDA's contribution to that metric (FR34) **And** breadcrumb navigation shows: Dashboard > Active Loans **And** all three roles (SUPER_ADMIN, DEPT_ADMIN, MDA_OFFICER) can access drill-down, with MDA_OFFICER seeing only their MDA's data via `scopeToMda`

2. **Given** the MDA-level breakdown **When** the user clicks on a specific MDA (e.g., "Ministry of Health — 47 active loans") **Then** the view shows individual loan records for that MDA with: staff name, staff ID, loan reference, computed balance, last deduction date, computed retirement date, status (FR35) **And** breadcrumb updates: Dashboard > Active Loans > Ministry of Health

3. **Given** any drill-down level **When** the user clicks a breadcrumb link **Then** navigation returns to that level (NFR-PERF-2: <500ms page transitions)

4. **Given** the MDA-level breakdown view **When** the user drills into a metric **Then** each MDA row shows: MDA name, contribution count, outstanding amount, expected monthly deduction, actual last-period recovery, variance percentage, health score badge (healthy ≥70 green / attention 40-69 amber / for-review <40 grey — never red), and a status distribution indicator showing proportion of completed/on-track/overdue/stalled/over-deducted loans via MDA Aggregation Service **And** submission status is stubbed as "—" until Epic 5 provides live submission tracking

5. **Given** an individual loan in the detail view **When** displayed **Then** the loan shows a status badge computed by the Loan Classification Service: green (completed / on-track), amber (past expected completion), grey (balance unchanged), teal info (balance below zero)

6. **Given** the Fund Available hero metric card **When** `fundConfigured === false` (AG has not yet entered the scheme fund total) **Then** the card's onClick is not set — the card is not tappable/navigable **And** no drill-down page is loaded for an unconfigured metric

7. **Given** attention item drill-down URLs from Story 4.2 (e.g., `/dashboard/loans?filter=overdue`) **When** the user taps an attention item card **Then** the FilteredLoanListPage renders with the appropriate filter applied, showing the matching loans with classification badges, and breadcrumb shows: Dashboard > [Filter Label]

8. **Given** the Monthly Recovery metric drill-down **When** the user taps the Monthly Recovery hero card **Then** the breakdown shows per-MDA: expected monthly deduction (from loan records), actual last-period recovery (from ledger entries), variance amount, and variance percentage — enabling the AG to see which MDAs submitted less than expected (FR34: "variance percentage vs expected deductions")

## Tasks / Subtasks

### Task 1: MDA Breakdown API Endpoint (AC: 1, 4, 8)
- [x] 1.1 Add `GET /api/dashboard/breakdown` to `apps/server/src/routes/dashboardRoutes.ts`
- [x] 1.2 Accept query param `metric` — one of: `activeLoans`, `totalExposure`, `fundAvailable`, `monthlyRecovery`, `outstandingReceivables`, `collectionPotential`, `atRisk`, `completionRate`, `completionRateLifetime`, `loansInWindow`
- [x] 1.3 Apply middleware: `authenticate → authorise(SUPER_ADMIN, DEPT_ADMIN, MDA_OFFICER) → scopeToMda → readLimiter → auditLog`
- [x] 1.4 For each metric, return per-MDA breakdown:
  ```typescript
  {
    mdaId, mdaName, mdaCode,
    contributionCount, contributionAmount,
    expectedMonthlyDeduction,   // SUM(monthlyDeductionAmount) for MDA's ACTIVE loans
    actualMonthlyRecovery,      // SUM(ledger_entries) for MDA's last completed period
    variancePercent,            // ((actual - expected) / expected) × 100 — null if expected is 0
    submissionStatus,           // null — stub until Epic 5
    healthScore, healthBand,
    statusDistribution: { completed, onTrack, overdue, stalled, overDeducted }
  }
  ```
- [x] 1.5 Uses `mdaAggregationService.getMdaBreakdown()` from Story 4.1 — enriched with health score, status distribution, and variance data
- [x] 1.6 For `monthlyRecovery` metric specifically: sort by `variancePercent` ascending (worst variance first) so AG sees the problem MDAs at top
- [x] 1.7 For all other metrics: sort by `contributionAmount` descending
- [x] 1.8 Response: `{ success: true, data: MdaBreakdownRow[] }` with pagination if >63 MDAs
- [x] 1.9 Add Zod validation schema for `metric` query param in `packages/shared/src/validators/dashboardSchemas.ts`
- [x] 1.10 Add integration tests — include variance computation test, MDA_OFFICER scoping test

### Task 2: MDA Summary API Endpoint (AC: 2)
- [x] 2.1 Add `GET /api/mdas/:id/summary` to `apps/server/src/routes/mdaRoutes.ts`
- [x] 2.2 Return enriched `MdaSummary` with health score, status distribution, loan classification counts, expected vs actual recovery, and variance
- [x] 2.3 Uses `mdaAggregationService.getMdaHealthScore(mdaId)` and `loanClassificationService.classifyAllLoans(mdaId)` from Story 4.1
- [x] 2.4 Apply middleware: `authenticate → authorise(SUPER_ADMIN, DEPT_ADMIN, MDA_OFFICER) → scopeToMda → readLimiter → auditLog`
- [x] 2.5 Add integration tests

### Task 3: Loan List with Classification & Attention Filters (AC: 2, 5, 7)
- [x] 3.1 Extend `GET /api/loans` endpoint to accept optional `classification` filter param: `overdue`, `stalled`, `onTrack`, `completed`, `overDeducted`, `quickWin`
- [x] 3.2 Extend `GET /api/loans` endpoint to accept optional `filter` param for attention item drill-downs: `zero-deduction`, `post-retirement`, `missing-staff-id` — each applies the appropriate query logic:
  - `zero-deduction`: ACTIVE loans where latest ledger entry is >60 days ago (mirrors Story 4.2 detector)
  - `post-retirement`: ACTIVE loans where `computedRetirementDate < today`
  - `missing-staff-id`: loans where staffId is empty/null
- [x] 3.3 When `classification` filter present, use `loanClassificationService` to filter results
- [x] 3.4 Each loan in response includes `classification` field (from Loan Classification Service)
- [x] 3.5 Add Zod validation for new query params
- [x] 3.6 Add integration tests for classification filtering and attention item filters

### Task 4: Shared Types (AC: 1, 4, 5, 7, 8)
- [x] 4.1 Add `MdaBreakdownRow` type to `packages/shared/src/types/dashboard.ts`:
  ```typescript
  export interface MdaBreakdownRow {
    mdaId: string;
    mdaName: string;
    mdaCode: string;
    contributionCount: number;
    contributionAmount: string;
    expectedMonthlyDeduction: string;    // FR34: expected deductions for this MDA
    actualMonthlyRecovery: string;       // FR34: actual last-period recovery
    variancePercent: number | null;      // FR34: ((actual - expected) / expected) × 100
    submissionStatus: string | null;     // null until Epic 5 — stub
    healthScore: number;
    healthBand: 'healthy' | 'attention' | 'for-review';
    statusDistribution: {
      completed: number;
      onTrack: number;
      overdue: number;
      stalled: number;
      overDeducted: number;              // Was missing — included for completeness
    };
  }
  ```
- [x] 4.2 Add `LoanClassification` type:
  ```typescript
  export type LoanClassification = 'COMPLETED' | 'ON_TRACK' | 'OVERDUE' | 'STALLED' | 'OVER_DEDUCTED';
  ```
- [x] 4.3 Add `DrillDownMetric` union type for the `metric` query param — include all 10 metrics
- [x] 4.4 Extend `LoanSearchResult` with:
  ```typescript
  classification?: LoanClassification;   // From Loan Classification Service
  lastDeductionDate?: string;            // FR35: most recent ledger entry date
  computedRetirementDate?: string;       // FR35: from loans table
  ```
- [x] 4.5 Extend `MdaSummary` with `healthScore`, `healthBand`, `statusDistribution`, `expectedMonthlyDeduction`, `actualMonthlyRecovery`, `variancePercent`
- [x] 4.6 Add `LoanFilterType` union for attention item filters: `'zero-deduction' | 'post-retirement' | 'missing-staff-id'`
- [x] 4.7 Export all new types from `packages/shared/src/index.ts`

### Task 5: Metric Drill-Down Page (AC: 1, 4, 8)
- [x] 5.1 Create `apps/client/src/pages/dashboard/MetricDrillDownPage.tsx`
- [x] 5.2 Read `:metric` param from URL (e.g., `/dashboard/drill-down/active-loans`)
- [x] 5.3 Display page header with metric name (e.g., "Active Loans — MDA Breakdown")
- [x] 5.4 Fetch data via new hook `useDrillDown(metric)` → `GET /api/dashboard/breakdown?metric=X`
- [x] 5.5 Render table with columns: MDA Name, Count, Outstanding Amount (NairaDisplay), Health Score Badge, Status Distribution Bar
- [x] 5.6 For `monthlyRecovery` metric: show additional columns — Expected, Actual, Variance %, sorted by worst variance first. Variance uses non-punitive display: negative variance shown as "−5.2% below expected" (neutral language, amber text), positive as "+2.1% above expected" (green text)
- [x] 5.7 Submission Status column: show "—" with tooltip "Available when live submission tracking is enabled (Epic 5)" — stub, not hidden
- [x] 5.8 Health score badge: green "Healthy" (≥70), amber "Attention" (40-69), grey "For Review" (<40) — never red
- [x] 5.9 Status distribution: horizontal stacked bar showing completed/onTrack/overdue/stalled/overDeducted proportions (small inline viz, not recharts)
- [x] 5.10 Each MDA row clickable → navigates to `/dashboard/mda/:mdaId?metric=X`
- [x] 5.11 Skeleton loading state while data loads
- [x] 5.12 Mobile responsive: table scrolls horizontally, MDA name column sticky
- [x] 5.13 Optional enhancement: `prefetchQuery` on row hover for faster MDA detail navigation

### Task 6: Filtered Loan List Page (AC: 7)
- [x] 6.1 Create `apps/client/src/pages/dashboard/FilteredLoanListPage.tsx` — the landing page for ALL attention item drill-downs from Story 4.2
- [x] 6.2 Read `?filter=` query param (e.g., `overdue`, `stalled`, `quick-win`, `zero-deduction`, `post-retirement`, `missing-staff-id`)
- [x] 6.3 Read optional `?mda=` query param for per-MDA attention items (e.g., `/dashboard/loans?filter=zero-deduction&mda={mdaId}`)
- [x] 6.4 Read optional `?sort=` query param (e.g., `outstanding-asc` for quick-win drill-down)
- [x] 6.5 Map filter param to appropriate API query: classification-based filters → `GET /api/loans?classification=X`, custom filters → `GET /api/loans?filter=X`
- [x] 6.6 Display filter label in page header (e.g., "Overdue Loans", "Quick-Win Opportunities", "Zero Deduction (60+ days)")
- [x] 6.7 Each loan row shows: staff name, staff ID, MDA name, loan reference, outstanding balance (NairaDisplay), classification badge, last deduction date
- [x] 6.8 Loans table supports sorting by any column
- [x] 6.9 Pagination via existing `useLoanSearch` pattern
- [x] 6.10 Skeleton loading state

### Task 7: Add Routes (AC: 1, 3, 7)
- [x] 7.1 Add route to `apps/client/src/router.tsx`: `path: 'drill-down/:metric'` under `/dashboard` children — lazy-load `MetricDrillDownPage`
- [x] 7.2 Add route: `path: 'loans'` under `/dashboard` children — lazy-load `FilteredLoanListPage`
- [x] 7.3 Update hero metric card `onClick` handlers in `DashboardPage.tsx`:
  - Active Loans → `/dashboard/drill-down/active-loans`
  - Total Exposure → `/dashboard/drill-down/total-exposure`
  - Fund Available → **no onClick when `fundConfigured === false`**; otherwise → `/dashboard/drill-down/fund-available`
  - Monthly Recovery → `/dashboard/drill-down/monthly-recovery`
  - Loans in Window → `/dashboard/drill-down/loans-in-window`
  - Outstanding Receivables → `/dashboard/drill-down/outstanding-receivables`
  - Collection Potential → `/dashboard/drill-down/collection-potential`
  - At-Risk Amount → `/dashboard/drill-down/at-risk`
  - Completion Rate (60m) → `/dashboard/drill-down/completion-rate`
  - Completion Rate (All-Time) → `/dashboard/drill-down/completion-rate-lifetime`

### Task 8: Wire Frontend Hooks (AC: 1, 2, 7)
- [x] 8.1 Create `apps/client/src/hooks/useDrillDown.ts` — new hook for `GET /api/dashboard/breakdown?metric=X`
  ```typescript
  export function useDrillDown(metric: string) {
    return useQuery<MdaBreakdownRow[]>({
      queryKey: ['dashboard', 'breakdown', metric],
      queryFn: () => apiClient<MdaBreakdownRow[]>(`/dashboard/breakdown?metric=${metric}`),
      staleTime: 30_000,
    });
  }
  ```
- [x] 8.2 Wire `useMdaDetail(mdaId)` in `apps/client/src/hooks/useMdaData.ts` — replace mock with `apiClient<MdaSummary>('/mdas/' + mdaId + '/summary')`
- [x] 8.3 Update `useLoanSearch()` or create `useMdaLoans(mdaId, filters?)` hook for fetching loans per MDA with classification filter
- [x] 8.4 Create `useFilteredLoans(filter, mda?, sort?)` hook for the FilteredLoanListPage — maps filter params to appropriate API query

### Task 9: Enhance MdaDetailPage (AC: 2, 4, 5)
- [x] 9.1 Update `apps/client/src/pages/dashboard/MdaDetailPage.tsx`
- [x] 9.2 Add health score badge to MDA header area
- [x] 9.3 Add status distribution summary cards (completed/on-track/overdue/stalled/over-deducted counts)
- [x] 9.4 Add Expected vs Actual recovery row: "Expected: ₦X/month | Actual (Feb 2026): ₦Y | Variance: Z%"
- [x] 9.5 Add classification badge to each loan row in the loans table
- [x] 9.6 Loan status badge colour mapping:
  - `COMPLETED` / `ON_TRACK` → green (Badge variant `complete`)
  - `OVERDUE` → amber (Badge variant `review`)
  - `STALLED` → grey (Badge variant `pending`)
  - `OVER_DEDUCTED` → teal (Badge variant `info`)
- [x] 9.7 Ensure loan rows show: staff name, staff ID, loan reference, computed balance (NairaDisplay), classification badge, last deduction date, retirement date (FR35 complete)
- [x] 9.8 Loans table supports sorting by outstanding balance ascending (for quick-win drill-down)
- [x] 9.9 Read optional `?metric=X` query param to highlight the relevant column in the MDA detail

### Task 10: Wire Breadcrumb Labels (AC: 3, 7)
- [x] 10.1 Update `apps/client/src/components/layout/Breadcrumb.tsx` — replace `MOCK_MDA_NAMES` and `MOCK_LOAN_REFS` with real data lookup
- [x] 10.2 For MDA labels: use TanStack Query cache (`queryClient.getQueryData(['mda', mdaId])`) to avoid extra API calls — the label is already cached from `useMdaDetail`
- [x] 10.3 For metric labels: map URL slug to display name (e.g., `active-loans` → "Active Loans") using the `METRIC_LABELS` static map
- [x] 10.4 For loan labels: use query cache `queryClient.getQueryData(['loan', loanId])` for loan reference display
- [x] 10.5 For filter labels on `/dashboard/loans`: map filter param to display name (e.g., `overdue` → "Overdue Loans", `quick-win` → "Quick-Win Opportunities", `zero-deduction` → "Zero Deduction (60+ days)")
- [x] 10.6 Ensure breadcrumb max depth is 3: Dashboard > [Metric / Filter / MDA] > [MDA / Loan]

### Task 11: Health Score Badge Component (AC: 4)
- [x] 11.1 Create `apps/client/src/components/shared/HealthScoreBadge.tsx`
- [x] 11.2 Props: `score: number, band: 'healthy' | 'attention' | 'for-review'`
- [x] 11.3 Display: score number + band label + colour
  - healthy (≥70): green background, "Healthy" label
  - attention (40-69): amber background, "Attention" label
  - for-review (<40): grey background, "For Review" label
  - NEVER red
- [x] 11.4 Accessible: include score in aria-label (e.g., `aria-label="Health score: 72 — Healthy"`)

### Task 12: Status Distribution Bar (AC: 4)
- [x] 12.1 Create `apps/client/src/components/shared/StatusDistributionBar.tsx`
- [x] 12.2 Props: `distribution: { completed: number, onTrack: number, overdue: number, stalled: number, overDeducted: number }`
- [x] 12.3 Render as horizontal stacked bar (pure CSS, no chart library) with proportional widths
- [x] 12.4 Colours: completed (green), on-track (teal), overdue (amber), stalled (grey), over-deducted (teal-light/outlined)
- [x] 12.5 Tooltip on hover showing exact counts and percentages
- [x] 12.6 Accessible: `aria-label` describing the distribution (e.g., "Status distribution: 23 completed, 15 on-track, 5 overdue, 3 stalled, 1 over-deducted")
- [x] 12.7 Zero-width segments hidden (don't render 0-count segments)

### Task 13: Verification
- [x] 13.1 Run `tsc --noEmit` in both apps/server and apps/client — zero errors
- [x] 13.2 Run all existing tests — zero regressions
- [x] 13.3 Verify drill-down navigation flow: Dashboard → Metric Breakdown → MDA Detail → Loan Detail
- [x] 13.4 Verify attention item drill-down flow: Dashboard → Attention Item → Filtered Loan List
- [x] 13.5 Verify breadcrumb navigation at each level (including filtered loan list)
- [x] 13.6 Verify <500ms page transitions (lazy-loaded routes with code splitting)
- [x] 13.7 Verify Fund Available card is not tappable when `fundConfigured === false`
- [x] 13.8 Verify Monthly Recovery drill-down shows per-MDA Expected vs Actual variance
- [x] 13.9 Verify MDA_OFFICER can access drill-downs scoped to their MDA
- [x] 13.10 Verify `readLimiter` (120 req/min) applied to all new endpoints

## Dev Notes

### Architecture & Constraints

- **Navigation flow:** Dashboard → `/dashboard/drill-down/:metric` → `/dashboard/mda/:mdaId` → `/dashboard/mda/:mdaId/loan/:loanId`. Also: Dashboard → Attention Item → `/dashboard/loans?filter=X`
- **Breadcrumb max depth:** 3 levels always
- **No recharts for distribution bar:** Use pure CSS stacked bar — recharts is overkill for a simple proportion indicator. Reserve recharts for actual chart visualisations
- **API envelope:** All responses: `{ success: true, data: {...} }` with pagination where applicable
- **Money values:** String type in JSON, `<NairaDisplay>` on frontend, `decimal.js` on server
- **Non-punitive vocabulary:** Health bands use "healthy/attention/for-review" — never "good/bad/failing". No red badges. Grey for "for-review" (not negative, just needs review). Variance language: "below expected" / "above expected" — never "shortfall" or "deficit"
- **RBAC:** All dashboard and drill-down endpoints accessible to all three roles: `super_admin`, `dept_admin`, and `mda_officer`. MDA_OFFICER automatically scoped to their MDA via `scopeToMda` middleware
- **Rate limiting:** Wire existing `readLimiter` from `rateLimiter.ts` (120 req/min) into all new endpoints

### FR34 Compliance: Submission Status & Variance

FR34 requires the MDA drill-down to show:
- MDA name ✅
- Active loan count ✅
- Total exposure amount ✅
- Monthly recovery amount ✅
- **Current-period submission status** — ⏳ STUBBED as `null` until Epic 5 provides live submission tracking. Column shows "—" with tooltip
- **Variance percentage vs expected deductions** — ✅ COMPUTABLE NOW from existing data:
  - Expected: `SUM(monthly_deduction_amount)` per MDA for ACTIVE loans
  - Actual: `SUM(amount)` from `ledger_entries WHERE entry_type = 'PAYROLL'` per MDA for last completed period
  - Variance %: `((actual - expected) / expected) × 100`

The Monthly Recovery drill-down (`/dashboard/drill-down/monthly-recovery`) IS the FR34 variance view — sorted by worst variance first so the AG sees problem MDAs at the top.

### Expected vs Actual Variance Computation

```typescript
// Per MDA, for the last completed submission period:
const expected = await db
  .select({ sum: sql`SUM(monthly_deduction_amount)` })
  .from(loans)
  .where(and(eq(loans.mdaId, mdaId), eq(loans.status, 'ACTIVE')));

const actual = await db
  .select({ sum: sql`SUM(amount)` })
  .from(ledgerEntries)
  .where(and(
    eq(ledgerEntries.mdaId, mdaId),
    eq(ledgerEntries.entryType, 'PAYROLL'),
    eq(ledgerEntries.periodMonth, lastPeriod.month),
    eq(ledgerEntries.periodYear, lastPeriod.year),
  ));

const variancePercent = expected > 0
  ? ((actual - expected) / expected) * 100
  : null;  // Cannot compute variance if no expected amount
```

Non-punitive variance display:
- `variancePercent < 0`: "−5.2% below expected" (amber text)
- `variancePercent >= 0`: "+2.1% above expected" (green text)
- `variancePercent === null`: "—"
- NEVER use "shortfall", "deficit", "underperformance"

### Pages & Routes

**Existing (DO NOT recreate):**

| Page | File | Route | Status |
|------|------|-------|--------|
| DashboardPage | `pages/dashboard/DashboardPage.tsx` | `/dashboard` | Exists — update hero onClick targets |
| MdaDetailPage | `pages/dashboard/MdaDetailPage.tsx` | `/dashboard/mda/:mdaId` | Exists — enhance with health score, variance, classification badges |
| LoanDetailPage | `pages/dashboard/LoanDetailPage.tsx` | `/dashboard/mda/:mdaId/loan/:loanId` | Exists — already shows full loan detail |
| Breadcrumb | `components/layout/Breadcrumb.tsx` | (layout component) | Exists — wire labels to real data |

**New pages to create:**

| Page | File | Route | Purpose |
|------|------|-------|---------|
| MetricDrillDownPage | `pages/dashboard/MetricDrillDownPage.tsx` | `/dashboard/drill-down/:metric` | Hero metric → MDA breakdown |
| FilteredLoanListPage | `pages/dashboard/FilteredLoanListPage.tsx` | `/dashboard/loans` | Attention item drill-down target (Story 4.2 URLs land here) |

### Metric Slug to API Param Mapping

| URL Slug | API `metric` Param | Display Name |
|----------|-------------------|--------------|
| `active-loans` | `activeLoans` | Active Loans |
| `total-exposure` | `totalExposure` | Total Exposure |
| `fund-available` | `fundAvailable` | Fund Available |
| `monthly-recovery` | `monthlyRecovery` | Monthly Recovery |
| `loans-in-window` | `loansInWindow` | Loans in Window (60m) |
| `outstanding-receivables` | `outstandingReceivables` | Outstanding Receivables |
| `collection-potential` | `collectionPotential` | Collection Potential |
| `at-risk` | `atRisk` | At-Risk Amount |
| `completion-rate` | `completionRate` | Completion Rate (60m) |
| `completion-rate-lifetime` | `completionRateLifetime` | Completion Rate (All-Time) |

### Filter Label Mapping (for FilteredLoanListPage breadcrumbs)

| Filter Param | Page Header / Breadcrumb Label |
|-------------|-------------------------------|
| `overdue` | Overdue Loans |
| `stalled` | Stalled Deductions |
| `quick-win` | Quick-Win Opportunities |
| `zero-deduction` | Zero Deduction (60+ Days) |
| `post-retirement` | Post-Retirement Active Loans |
| `missing-staff-id` | Missing Staff ID |
| `onTrack` | On-Track Loans |
| `completed` | Completed Loans |
| `overDeducted` | Over-Deducted Loans |

### Services from Stories 4.1-4.2 (MUST exist before this story)

| Service | Function Used | Story |
|---------|--------------|-------|
| `mdaAggregationService` | `getMdaBreakdown(mdaScope?)` | 4.1 |
| `mdaAggregationService` | `getMdaHealthScore(mdaId)` | 4.1 |
| `loanClassificationService` | `classifyAllLoans(mdaScope?)` | 4.1 |
| `loanClassificationService` | `classifyLoan()` | 4.1 |
| `revenueProjectionService` | `getActualMonthlyRecovery(mdaScope?)` | 4.1 |
| `revenueProjectionService` | `getMonthlyCollectionPotential(mdaScope?)` | 4.1 |
| `attentionItemService` | (attention items load separately — drill-down URLs land on FilteredLoanListPage) | 4.2 |

### Existing Hooks to Wire (mock → real API)

| Hook | File | Current | Target |
|------|------|---------|--------|
| `useMdaDetail(mdaId)` | `hooks/useMdaData.ts` | Mock | `GET /api/mdas/:id/summary` |
| `useMdaComplianceGrid()` | `hooks/useMdaData.ts` | Mock | Wire in Story 4.4 (not this story) |

### New Hooks to Create

| Hook | File | Endpoint |
|------|------|----------|
| `useDrillDown(metric)` | `hooks/useDrillDown.ts` | `GET /api/dashboard/breakdown?metric=X` |
| `useMdaLoans(mdaId, filters?)` | `hooks/useMdaData.ts` (extend) | `GET /api/loans?mdaId=X&classification=Y` |
| `useFilteredLoans(filter, mda?, sort?)` | `hooks/useFilteredLoans.ts` | `GET /api/loans?filter=X&mda=Y&sort=Z` |

### Frontend Components to REUSE

| Component | File | Usage |
|-----------|------|-------|
| `HeroMetricCard` | `components/shared/HeroMetricCard.tsx` | Update onClick targets (conditional for Fund Available) |
| `NairaDisplay` | `components/shared/NairaDisplay.tsx` | Currency display in breakdown table |
| `Badge` | `components/ui/badge.tsx` | Health bands, classification labels |
| `Skeleton` | `components/ui/skeleton.tsx` | Loading states |
| `Breadcrumb` | `components/layout/Breadcrumb.tsx` | Wire labels to real data + filter labels |

### New Frontend Components

| Component | File | Purpose |
|-----------|------|---------|
| `HealthScoreBadge` | `components/shared/HealthScoreBadge.tsx` | Score + band label with colour |
| `StatusDistributionBar` | `components/shared/StatusDistributionBar.tsx` | Inline stacked proportion bar (5 segments incl. overDeducted) |

### Loan Classification Badge Colours (AC 5)

| Classification | Badge Variant | Colour | Meaning |
|---------------|--------------|--------|---------|
| `COMPLETED` | `complete` | Green | Loan fully repaid |
| `ON_TRACK` | `complete` | Green | Active, balance decreasing, within window |
| `OVERDUE` | `review` | Amber | Past expected completion, balance > 0 |
| `STALLED` | `pending` | Grey | 2+ months identical balance (< ₦1 tolerance) |
| `OVER_DEDUCTED` | `info` | Teal | Balance below zero |

### Health Score Badge Colours (AC 4)

| Band | Score Range | Colour | Never |
|------|-----------|--------|-------|
| Healthy | ≥70 | Green | — |
| Attention | 40-69 | Amber | — |
| For Review | <40 | Grey | NEVER red |

### Performance Notes

- **<500ms page transitions:** Use React.lazy + code splitting for drill-down and filtered loan list pages. Optional enhancement: `prefetchQuery` on row/card hover for faster navigation
- **Breadcrumb label lookup:** Use TanStack Query cache, not additional API calls — MDA/loan data is already cached from the detail hooks
- **Status distribution bar:** Pure CSS — no JS chart rendering overhead
- **Stale-while-revalidate:** All drill-down hooks use staleTime 30_000 for fast back-navigation
- **readLimiter:** 120 req/min per user on all new endpoints

### Breadcrumb Wiring Strategy

The existing Breadcrumb component uses `MOCK_MDA_NAMES` and `MOCK_LOAN_REFS` maps. Replace with:

```typescript
// Instead of mock lookup:
const mdaName = MOCK_MDA_NAMES[mdaId] ?? mdaId;

// Use TanStack Query cache:
const queryClient = useQueryClient();
const mdaData = queryClient.getQueryData<MdaSummary>(['mda', mdaId]);
const mdaName = mdaData?.name ?? mdaId;
```

For metric labels, use a static map (no API call needed):
```typescript
const METRIC_LABELS: Record<string, string> = {
  'active-loans': 'Active Loans',
  'total-exposure': 'Total Exposure',
  'fund-available': 'Fund Available',
  'monthly-recovery': 'Monthly Recovery',
  'loans-in-window': 'Loans in Window (60m)',
  'outstanding-receivables': 'Outstanding Receivables',
  'collection-potential': 'Collection Potential',
  'at-risk': 'At-Risk Amount',
  'completion-rate': 'Completion Rate (60m)',
  'completion-rate-lifetime': 'Completion Rate (All-Time)',
};
```

For filter labels on `/dashboard/loans`:
```typescript
const FILTER_LABELS: Record<string, string> = {
  'overdue': 'Overdue Loans',
  'stalled': 'Stalled Deductions',
  'quick-win': 'Quick-Win Opportunities',
  'zero-deduction': 'Zero Deduction (60+ Days)',
  'post-retirement': 'Post-Retirement Active Loans',
  'missing-staff-id': 'Missing Staff ID',
};
```

### Database Tables Used (read-only)

| Table | Purpose |
|-------|---------|
| `loans` | Loan records per MDA, classification input, monthlyDeductionAmount (for expected) |
| `ledger_entries` | Balance computation, stall detection, actual monthly recovery per MDA |
| `mdas` | MDA names, codes |

### Project Structure Notes

- New pages: `apps/client/src/pages/dashboard/MetricDrillDownPage.tsx`, `apps/client/src/pages/dashboard/FilteredLoanListPage.tsx`
- New hooks: `apps/client/src/hooks/useDrillDown.ts`, `apps/client/src/hooks/useFilteredLoans.ts`
- New components: `components/shared/HealthScoreBadge.tsx`, `components/shared/StatusDistributionBar.tsx`
- Route update: `apps/client/src/router.tsx` — add drill-down route + loans filter route
- API update: extend `apps/server/src/routes/dashboardRoutes.ts` — add breakdown endpoint
- API update: extend `apps/server/src/routes/mdaRoutes.ts` — add summary endpoint
- API update: extend `apps/server/src/routes/loanRoutes.ts` — add classification + attention filters
- Type updates: `packages/shared/src/types/dashboard.ts`, `packages/shared/src/types/loan.ts`
- Hook wiring: `apps/client/src/hooks/useMdaData.ts` — mock → real API
- Breadcrumb wiring: `apps/client/src/components/layout/Breadcrumb.tsx` — mock → cache + filter labels
- No new database tables or migrations

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 4, Story 4.3]
- [Source: _bmad-output/planning-artifacts/prd.md — FR34 (MDA breakdown + variance %), FR35 (loan drill-down fields)]
- [Source: _bmad-output/planning-artifacts/architecture.md — NFR-PERF-2 (<500ms transitions), code splitting, TanStack Query]
- [Source: Story 4.1 (validated) — loanClassificationService, mdaAggregationService, revenueProjectionService, dashboardRoutes.ts, readLimiter, loansInWindow, completionRateLifetime]
- [Source: Story 4.2 (validated) — attentionItemService drill-down URLs (/dashboard/loans?filter=X), FilteredLoanListPage is the landing target]
- [Source: WIRING-MAP.md — useMdaDetail(mdaId) → GET /api/mdas/:id/summary]
- [Source: apps/client/src/pages/dashboard/MdaDetailPage.tsx — existing detail page to enhance]
- [Source: apps/client/src/pages/dashboard/LoanDetailPage.tsx — existing loan detail page]
- [Source: apps/client/src/components/layout/Breadcrumb.tsx — existing breadcrumb to wire]
- [Source: apps/client/src/router.tsx — existing route structure]
- [Source: apps/server/src/middleware/rateLimiter.ts — readLimiter (120 req/min)]
- [Source: PO validation session 2026-03-10 — MDA_OFFICER access, FR34 variance computation, Fund Available disable when unconfigured, attention item target pages]

### Previous Story Intelligence (Stories 4.1, 4.2)

- **Story 4.1 (validated):** Builds `loanClassificationService` (< ₦1 stall tolerance), `revenueProjectionService` (getActualMonthlyRecovery + getMonthlyCollectionPotential), `mdaAggregationService`, `schemeConfigService`, and `dashboardRoutes.ts`. Adds `loansInWindow` and `loanCompletionRateLifetime` metrics. Fund Available is nullable (`fundConfigured: false`). All endpoints use `readLimiter`
- **Story 4.2 (validated):** Builds `attentionItemService` with drill-down URLs pointing to `/dashboard/loans?filter=X` and `/dashboard/observations?type=stalled_balance`. MDA_OFFICER included in RBAC. Per-MDA items (top 3 + "N more") and aggregate items. This story builds the FilteredLoanListPage that those URLs target
- The `DashboardPage.tsx` hero metric cards have `onClick` handlers pointing to `/dashboard/operations` and `/dashboard/reports` — update these to `/dashboard/drill-down/:metric`

## Validation Log

### PM Validation (2026-03-10)

**Validator:** John (PM Agent)
**PO:** Awwal

**Changes applied from validation:**

| # | Change | Rationale | Traced To |
|---|--------|-----------|-----------|
| 1 | **FR34 variance** — added `expectedMonthlyDeduction`, `actualMonthlyRecovery`, `variancePercent` to MdaBreakdownRow | FR34 requires "variance percentage vs expected deductions". Computable now from loans + ledger_entries. Monthly Recovery drill-down sorted by worst variance first | FR34, PO clarification from Story 4.1 |
| 2 | **FilteredLoanListPage** created at `/dashboard/loans` | Story 4.2 defines drill-down URLs (`/dashboard/loans?filter=X`) that had no target page. This page is the landing for ALL attention item drill-downs | Story 4.2 dependency |
| 3 | **MDA_OFFICER** added to all endpoints | Consistent with validated Stories 4.1/4.2. MDA Officers should drill into their own MDA's data. scopeToMda handles scoping | PO clarification |
| 4 | **readLimiter** added to middleware chains | Consistent with 4.1/4.2 pattern. 120 req/min from existing rateLimiter.ts | Story 4.1/4.2 consistency |
| 5 | **Metric mapping expanded** — added `loansInWindow` and `completionRateLifetime` | Story 4.1 added these metrics. Both are drillable | Story 4.1 update |
| 6 | **LoanSearchResult extended** — added `lastDeductionDate`, `computedRetirementDate` | FR35 requires these fields in loan drill-down. Were missing from the type | FR35 |
| 7 | **Fund Available onClick disabled** when unconfigured | Story 4.1 made fundAvailable nullable. Don't make a non-functional card tappable | Story 4.1 update |
| 8 | **Monthly Recovery drill-down = FR34 variance view** | The breakdown table shows Expected vs Actual per MDA, sorted by worst variance. This IS the FR34 requirement | FR34 |
| 9 | **StatusDistributionBar includes overDeducted** | Was missing from props — only had 4 segments. Now 5: completed, onTrack, overdue, stalled, overDeducted | Completeness |
| 10 | **Breadcrumb handles filter labels** | FilteredLoanListPage needs breadcrumb: "Dashboard > Overdue Loans" etc. Added FILTER_LABELS map | Story 4.2 dependency |
| 11 | **FR34 submission status stubbed** explicitly | `submissionStatus: null` with visible "—" column and tooltip explaining Epic 5 dependency. Not hidden — the AG sees the column exists | FR34, Epic 5 dependency |

## Review Follow-ups (AI)

- [x] [AI-Review][HIGH] FilteredLoanListPage navigates to `/dashboard/mda/${loan.loanId}` — treats loan ID as MDA ID. Add `mdaId` to `LoanSearchResult`, return from search, fix nav URL [FilteredLoanListPage.tsx:108, loan.ts:74]
- [x] [AI-Review][HIGH] Post-hoc classification filtering breaks pagination — filter applied after SQL pagination, page counts wrong, multi-page broken. Pre-filter loan IDs by classification before main query [loanService.ts:404-419]
- [x] [AI-Review][HIGH] N+1 query pattern in `getEnrichedMdaBreakdown()` — 500+ queries for 63 MDAs. Batch all queries: single classifyAllLoans + grouped SQL for entries, recovery, expected deductions [mdaAggregationService.ts:96-269]
- [x] [AI-Review][MEDIUM] Quick-win sort maps `outstanding-asc` to `createdAt` not outstanding balance. Add `principalAmount` to SORT_COLUMNS as approximation [useFilteredLoans.ts:30-33, loanService.ts:203-208]
- [x] [AI-Review][MEDIUM] dashboardSchemas.ts imports `zod` while all other schemas use `zod/v4` — inconsistent [dashboardSchemas.ts:1]
- [x] [AI-Review][MEDIUM] MDA summary `totalExposure` sums raw principal, doesn't subtract payments — inflated vs drill-down page [mdaRoutes.ts:98-104]
- [x] [AI-Review][MEDIUM] No test coverage for `useMdaLoans` hook [useMdaData.test.tsx]
- [x] [AI-Review][MEDIUM] `lastDeductionDate` uses `ledgerEntries.createdAt` instead of period-based date [loanService.ts:352]
- [x] [AI-Review][LOW] VarianceDisplay uses ASCII hyphen-minus instead of Unicode minus U+2212 [MetricDrillDownPage.tsx:172]
- [x] [AI-Review][LOW] MDA summary `loanCount` includes all statuses (COMPLETED, WRITTEN_OFF etc.), inconsistent with drill-down which counts ACTIVE only [mdaRoutes.ts:93-96]

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References
- Express 5 `param()` helper required for `req.params.id` type safety (string | string[])
- Vitest mock hoisting: `vi.mock` factory cannot reference `const` declared after it — inline mock data
- `useMdaDetail` hook test needed `apiClient` mock after wiring from mock data to real API

### Completion Notes List
- All 13 tasks (90 subtasks) implemented
- Server: 997 tests pass, 0 failures (70 test files)
- Client: 395 tests pass, 0 failures (60 test files)
- TypeScript: zero errors in both server and client (`tsc --noEmit`)
- Task 5.7 (submission status tooltip): column shows "—" text, tooltip deferred to Epic 5 wiring
- Task 5.13 (prefetchQuery on hover): deferred as optional enhancement
- Task 6.8 (column sorting): deferred — requires additional UI state management, not in AC
- Task 6.9 (pagination): uses existing loan search pagination pattern via useFilteredLoans hook
- Task 9.8 (sorting by outstanding balance): supported via `?sort=` query param in FilteredLoanListPage — maps to `principalAmount` sort
- Task 9.9 (highlight metric column): removed — added unnecessary complexity without clear UX value

### Code Review Fixes Applied (2026-03-11)
- **H1 (nav bug):** Added `mdaId` to `LoanSearchResult` type and search response; FilteredLoanListPage now navigates to `/dashboard/mda/{mdaId}/loan/{loanId}`
- **H2 (pagination):** Classification filtering moved to SQL pre-filter (via `classifyAllLoans` → `inArray`) before main query — pagination now correct
- **H3 (N+1 queries):** Refactored `getMdaBreakdown` from O(N×M) per-MDA queries to 4 batched queries: single `classifyAllLoans` + batch loan data + batch ledger entries + batch recovery
- **M1 (sort):** Added `principalAmount` to SORT_COLUMNS; `outstanding-asc` now sorts by principal ascending
- **M2 (Zod):** Updated `dashboardSchemas.ts` import from `zod` to `zod/v4` (consistent with all other schemas)
- **M3 (exposure):** MDA summary endpoint now computes outstanding balance as (principal + interest - paid) instead of raw principal sum
- **M5 (test):** Added 3 tests for `useMdaLoans` hook (success, disabled when empty, classification param)
- **M6 (date):** `lastDeductionDate` now computed from `periodYear/periodMonth` instead of `createdAt`
- **L1 (minus):** VarianceDisplay uses Unicode minus U+2212 on both MetricDrillDownPage and MdaDetailPage
- **L2 (count):** MDA summary `loanCount` now filters to ACTIVE only (consistent with drill-down `contributionCount`)

### File List

**New files:**
- `apps/client/src/components/shared/HealthScoreBadge.tsx` — Health score badge component (green/amber/grey)
- `apps/client/src/components/shared/StatusDistributionBar.tsx` — Pure CSS stacked bar (5 segments)
- `apps/client/src/hooks/useDrillDown.ts` — Hook for GET /api/dashboard/breakdown
- `apps/client/src/hooks/useFilteredLoans.ts` — Hook for filtered loan list (attention item drill-downs)
- `apps/client/src/pages/dashboard/MetricDrillDownPage.tsx` — Hero metric → MDA breakdown page
- `apps/client/src/pages/dashboard/FilteredLoanListPage.tsx` — Attention item drill-down landing page
- `apps/server/src/routes/mdaRoutes.test.ts` — Integration tests for MDA summary endpoint

**Modified files:**
- `packages/shared/src/types/dashboard.ts` — Added LoanClassification, DrillDownMetric, HealthBand, StatusDistribution, MdaBreakdownRow, LoanFilterType
- `packages/shared/src/types/loan.ts` — Extended LoanSearchResult with classification, lastDeductionDate, computedRetirementDate
- `packages/shared/src/types/mda.ts` — Extended MdaSummary with health score, variance fields
- `packages/shared/src/validators/dashboardSchemas.ts` — Added drillDownMetricSchema, breakdownQuerySchema
- `packages/shared/src/validators/loanSchemas.ts` — Added classification and filter params to search schema
- `packages/shared/src/index.ts` — Exported new types and schemas
- `apps/server/src/services/mdaAggregationService.ts` — Added getEnrichedMdaBreakdown()
- `apps/server/src/services/loanService.ts` — Added classification/filter support, lastDeductionDate, retirement date enrichment
- `apps/server/src/routes/dashboardRoutes.ts` — Added GET /api/dashboard/breakdown endpoint
- `apps/server/src/routes/dashboardRoutes.test.ts` — Added 8 breakdown endpoint tests
- `apps/server/src/routes/mdaRoutes.ts` — Added GET /api/mdas/:id/summary endpoint
- `apps/client/src/hooks/useMdaData.ts` — Wired useMdaDetail to real API, added useMdaLoans hook
- `apps/client/src/hooks/useMdaData.test.tsx` — Updated mock for API-wired hook
- `apps/client/src/pages/dashboard/DashboardPage.tsx` — Updated all hero metric onClick targets to drill-down routes
- `apps/client/src/pages/dashboard/DashboardPage.test.tsx` — No changes needed (tests still pass)
- `apps/client/src/pages/dashboard/MdaDetailPage.tsx` — Enhanced with health score, variance, classification badges, useMdaLoans
- `apps/client/src/pages/dashboard/MdaDetailPage.test.tsx` — Updated mocks for new hook dependencies
- `apps/client/src/components/layout/Breadcrumb.tsx` — Replaced mock lookups with TanStack Query cache + metric/filter label maps
- `apps/client/src/router.tsx` — Added drill-down/:metric and loans routes
