# Story 16.4: Portfolio Stability Metrics & Trend Charts

Status: ready-for-dev

## Story

As the **Accountant General**,
I want aggregate stability metrics and trend charts that show how the loan portfolio's data quality evolves over time,
so that I can track governance improvements and identify MDAs needing attention.

**Origin:** Discovery spike 16.0 (2026-04-02). Completes Epic 16's governance vision — every monthly submission becomes a measurable data quality checkpoint.

**Dependencies:** Story 16.1 (findings data), Story 16.2 (resolution workflow — needed for AC6 resolution rate). Runs parallel with Story 16.3 (dashboard).

## Acceptance Criteria

### AC1: Per-MDA Stability Metrics Computed

**Given** cross-month findings exist for an MDA across ≥2 consecutive submission months,
**Then** the system computes three stability metrics:
- **Beneficiary Churn Rate:** percentage of staff appearing or disappearing per month (lower = more stable)
- **Deduction Stability Index:** percentage of amounts unchanged month-over-month (higher = more stable)
- **Submission Consistency:** percentage of expected months with confirmed submissions (higher = more compliant)

### AC2: Portfolio-Level Aggregation

**Given** per-MDA metrics are computed,
**Then** a portfolio-level rollup shows: weighted-average churn rate, overall deduction stability, overall submission consistency across all MDAs. Weights by MDA record count (larger MDAs weigh more).

### AC3: MDA Ranking Table

**Given** the portfolio stability view,
**Then** an MDA ranking table shows all MDAs sorted by a composite stability score (average of the 3 normalised metrics), with ability to sort by any individual metric column. Colour-coded: teal (stable, score ≥ 80%), amber (needs attention, 50–79%), grey (insufficient data).

### AC4: Trend Charts

**Given** ≥2 months of cross-month data exist,
**Then** line charts (Recharts) show metric trajectories over time: months on x-axis, metric percentage on y-axis. One chart per metric. MDA filter dropdown for per-MDA trends. Portfolio-level trend shown as default.

### AC5: Executive Summary Report Integration

**Given** cross-month findings data exists,
**Then** the Executive Summary Report (Story 6.1, `executiveSummaryReportService.ts`) includes a "Cross-Month Data Quality" section with:
- Portfolio stability score (composite)
- Top 3 MDAs needing attention (lowest stability)
- MoM trend direction arrow (improving / declining / stable)

### AC6: Weekly AG Report Integration

**Given** the Weekly AG Report is generated (Story 6.3),
**Then** a "Cross-Month Findings" section shows:
- New findings this week (count by type)
- Resolution rate (% of all findings resolved or expected)
- Top anomaly type this week

### AC7: MetricHelp Tooltips

Add entries to `METRIC_GLOSSARY` in `packages/shared/src/constants/metricGlossary.ts` using `prefixKeys('stability', STABILITY_HELP)` pattern (matching `prefixKeys('attention', ATTENTION_HELP)`, `prefixKeys('dashboard', DASHBOARD_HELP)`, etc.). Then wrap all stability metrics with `<MetricHelp metric="stability.churnRate" />`:
Define these in `STABILITY_HELP` record in `metricGlossary.ts` (keyed to match `<MetricHelp metric="stability.churnRate" />` etc.). Descriptions must use non-punitive framing per `vocabulary.ts`:
- `churnRate` → label: "Beneficiary Churn Rate", description: "Percentage of staff who appeared or disappeared between consecutive monthly submissions. Lower is better. 0% = fully stable roster."
- `deductionStability` → label: "Deduction Stability Index", description: "Percentage of staff whose deduction amount was unchanged between months. Higher is better. 100% = all amounts consistent."
- `submissionConsistency` → label: "Submission Consistency", description: "Percentage of expected months where this MDA submitted on time. Higher is better."
- `compositeScore` → label: "Stability Score", description: "Composite of churn rate, deduction stability, and submission consistency. Higher indicates more reliable data."

## Tasks / Subtasks

- [ ] **Task 1 — Stability Metrics Service** (AC: 1,2)
  - [ ] 1.1 Create `apps/server/src/services/crossMonthMetricsService.ts`
  - [ ] 1.2 `computeMdaStability(mdaId, periodRange?)` — computes 3 metrics for an MDA from cross_month_findings + submission history
  - [ ] 1.3 **Churn Rate:** count(disappearing + reappearing + new_midstream) / total unique staff in current submission × 100
  - [ ] 1.4 **Deduction Stability:** count(staff with unchanged amount) / count(staff present in both months) × 100
  - [ ] 1.5 **Submission Consistency:** count(confirmed submissions for MDA) / count(expected months in range) × 100. Expected months = range from first submission to current month
  - [ ] 1.6 `computePortfolioStability(periodRange?)` — weighted average across all MDAs (weight = MDA record count)
  - [ ] 1.7 `computeCompositeScore(churn, stability, consistency)` — normalise churn (invert: 100 - churn), average all three

- [ ] **Task 2 — Trend Data Service** (AC: 4)
  - [ ] 2.1 `getStabilityTrend(mdaId?, periodRange?)` — returns monthly data points for charting
  - [ ] 2.2 For each month: compute the 3 metrics as of that month's submission pair
  - [ ] 2.3 Return: `{ months: [{ period, churnRate, deductionStability, submissionConsistency, compositeScore }] }`
  - [ ] 2.4 If mdaId is null, return portfolio-level trend

- [ ] **Task 3 — API Routes** (AC: 1,2,3,4)
  - [ ] 3.1 Create `apps/server/src/routes/crossMonthRoutes.ts` — new route file (no existing cross-month routes exist). Register in `apps/server/src/routes/index.ts` under `/api/cross-month`
  - [ ] 3.2 Define `stabilityAuth` middleware stack matching `reportRoutes.ts:executiveReportAuth` pattern: `[authenticate, requirePasswordChange, authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN), scopeToMda, readLimiter, auditLog]`
  - [ ] 3.3 `GET /api/cross-month/stability/mda-ranking` — all MDAs with stability metrics + composite score
  - [ ] 3.4 `GET /api/cross-month/stability/portfolio` — portfolio-level aggregation
  - [ ] 3.5 `GET /api/cross-month/stability/trend` — trend data points, optional mdaId query filter
  - [ ] 3.6 Zod response schemas in `packages/shared/src/validators/crossMonthSchemas.ts` (follows naming: `dashboardSchemas.ts`, `reportSchemas.ts`, etc.). Export from `packages/shared/src/index.ts`

- [ ] **Task 4 — Frontend Hooks** (AC: all)
  Create `apps/client/src/hooks/useCrossMonthStability.ts`. Follow existing pattern in `useReportData.ts` / `useAttentionItems.ts`: `apiClient<T>()` + `useQuery()`.
  Since cross-month metrics derive from immutable findings, use `staleTime: 5 * 60_000` (5 min, longer than the 30s default elsewhere).
  - [ ] 4.1 `useMdaStabilityRanking()` — queryKey: `['cross-month', 'stability', 'mda-ranking']`
  - [ ] 4.2 `usePortfolioStability()` — queryKey: `['cross-month', 'stability', 'portfolio']`
  - [ ] 4.3 `useStabilityTrend(mdaId?)` — queryKey: `['cross-month', 'stability', 'trend', mdaId]`, omit mdaId from key when null

- [ ] **Task 5 — MDA Ranking Table Component** (AC: 3)
  - [ ] 5.1 Create `apps/client/src/pages/dashboard/components/MdaStabilityRanking.tsx`
  - [ ] 5.2 Sortable table: MDA Name, Churn Rate, Deduction Stability, Submission Consistency, Composite Score
  - [ ] 5.3 Colour-coded rows: teal ≥ 80%, amber 50–79%, grey < 50% or insufficient data
  - [ ] 5.4 MetricHelp on each column header

- [ ] **Task 6 — Trend Chart Components** (AC: 4)
  - [ ] 6.1 Create `apps/client/src/pages/dashboard/components/StabilityTrendCharts.tsx`
  - [ ] 6.2 Three Recharts LineCharts: Churn Rate, Deduction Stability, Submission Consistency
  - [ ] 6.3 MDA filter dropdown (default: portfolio-level)
  - [ ] 6.4 X-axis: months (YYYY-MM labels), Y-axis: percentage (0–100%)
  - [ ] 6.5 Responsive: stack vertically on mobile, side-by-side on desktop

- [ ] **Task 7 — Executive Summary Integration** (AC: 5)
  - [ ] 7.1 In `executiveSummaryReportService.ts`, add `getCrossMonthQuality()` section
  - [ ] 7.2 Portfolio stability score, top 3 MDAs needing attention, MoM trend direction
  - [ ] 7.3 Frontend: add section to Executive Summary page between existing sections
  - [ ] 7.4 Conditionally render only when cross-month data exists

- [ ] **Task 8 — Weekly AG Report Integration** (AC: 6)
  - [ ] 8.1 In `weeklyAgReportService.ts` (or wherever weekly report is generated), add cross-month section
  - [ ] 8.2 New findings this week, resolution rate, top anomaly type
  - [ ] 8.3 PDF export: include in branded report template

- [ ] **Task 9 — Integration Tests** (AC: 1,2,3,4,5,6)
  - [ ] 9.1 Test per-MDA stability computation with synthetic findings data
  - [ ] 9.2 Test portfolio aggregation (weighted average by record count)
  - [ ] 9.3 Test trend data: create findings across multiple months → verify data points
  - [ ] 9.4 Test composite score normalisation (churn inverted correctly)
  - [ ] 9.5 Test executive summary section renders when data exists, hidden when not

- [ ] **Task 10 — Unit Tests** (AC: 1,2,7)
  - [ ] 10.1 Test churn rate formula: 5 disappearing / 100 staff = 5%
  - [ ] 10.2 Test deduction stability: 90 unchanged / 95 present in both = 94.7%
  - [ ] 10.3 Test submission consistency: 10 submitted / 12 expected months = 83.3%
  - [ ] 10.4 Test composite score: (95 + 94.7 + 83.3) / 3 = 91% (with inverted churn = 100-5 = 95)
  - [ ] 10.5 Test colour classification: ≥80 teal, 50-79 amber, <50 grey

## Dev Notes

### Prep Story Context (15.0a–15.0n)

- **15.0j:** All new metrics need MetricHelp glossary entries (`metricGlossary.ts`). Churn rate, deduction stability, and trend metrics must have `helpKey` props on their display cards.
- **15.0h:** Stability metric cards must be clickable to drill-down (Agreement #11). Follow the `HeroMetricCard` onClick + keyboard pattern from `DashboardPage.tsx:516-532`.
- **15.0e:** If stability metrics are relevant to MDA officers, surface them on `MdaOfficerDashboard.tsx` (MDA-scoped).

### Metric Formulas

**Beneficiary Churn Rate (lower = better):**
```
churnRate = (disappearing + reappearing + new_midstream) / totalStaffInCurrentSubmission × 100
```
Where counts come from `cross_month_findings` for the submission pair.

**Deduction Stability Index (higher = better):**
```
stability = staffWithUnchangedAmount / staffPresentInBothMonths × 100
```
"Unchanged" means `amountDeducted` is identical (Decimal.js equality, not ₦500 threshold). The threshold-based severity is for individual findings; the stability metric is binary unchanged/changed.

**Submission Consistency (higher = better):**
```
consistency = confirmedSubmissions / expectedMonths × 100
```
`expectedMonths` = count of distinct calendar months from MDA's first confirmed submission to the current month. Compute in Drizzle/TS, not raw SQL — extract min `periodYear`/`periodMonth` from confirmed submissions, diff against current month:
```typescript
const firstMonth = submissions[0]; // earliest confirmed
const expected = (currentYear - firstMonth.periodYear) * 12 + (currentMonth - firstMonth.periodMonth) + 1;
const confirmed = submissions.length; // count of distinct confirmed periods
const consistency = (confirmed / expected) * 100;
```

**Composite Score:**
```
composite = (invertedChurn + stability + consistency) / 3
invertedChurn = 100 - churnRate
```
All three components are on 0–100 scale where higher = better.

### Trend Data Computation

Trend data is computed retroactively from stored findings. For each month pair:
1. Find the `cross_month_findings` for that submission pair
2. Compute the 3 metrics from the findings + submission data
3. Return as a data point: `{ period: "2024-10", churnRate: 5.2, stability: 94.7, consistency: 83.3, composite: 91.0 }`

Computed on-demand (not stored) since findings are immutable once generated. No server-side caching needed — the frontend `staleTime: 5 * 60_000` handles repeat requests. If performance degrades with large datasets, add a DB view or materialised query later (not in this story).

### Report Integration Points

**Executive Summary (Story 6.1):**
- Service: `apps/server/src/services/executiveSummaryReportService.ts`
- Add a new section after existing metrics
- Guard: only render when `cross_month_findings` table has data

**Weekly AG Report (Story 6.3):**
- Service: `apps/server/src/services/weeklyAgReportService.ts` (or wherever the weekly report lives)
- Add section with this week's findings count, resolution rate
- PDF: include in existing branded template (uses the same PDF generation pattern)

### Recharts Pattern

Recharts 3.7.0 is installed (`apps/client/package.json`) but **has never been used in the codebase** — this story establishes the charting pattern. Minimal working skeleton:

```typescript
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

<ResponsiveContainer width="100%" height={300}>
  <LineChart data={trendData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="period" />
    <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
    <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
    <Legend />
    <Line type="monotone" dataKey="compositeScore" stroke="#0d9488" name="Stability Score" />
  </LineChart>
</ResponsiveContainer>
```

### Colour Classification

```typescript
const STABILITY_COLORS = {
  teal:  { bg: 'bg-teal-50',  text: 'text-teal-800',  border: 'border-teal-200'  },
  amber: { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200' },
  grey:  { bg: 'bg-gray-100',  text: 'text-gray-500',  border: 'border-gray-200'  },
} as const;

function getStabilityColor(score: number) {
  if (score >= 80) return STABILITY_COLORS.teal;
  if (score >= 50) return STABILITY_COLORS.amber;
  return STABILITY_COLORS.grey;
}
```

Use Tailwind classes consistent with existing codebase badge patterns (see `HealthScoreBadge.tsx`, `WeeklyAgReport.tsx`):
- Teal (≥80%): `bg-teal-50 text-teal-800 border-teal-200`
- Amber (50–79%): `bg-amber-100 text-amber-800 border-amber-200`
- Grey (<50% or insufficient): `bg-gray-100 text-gray-500 border-gray-200`

### Non-Punitive Framing

- "Stability Score" not "Compliance Score" or "Quality Grade"
- "Needs Attention" not "Failing" or "Non-Compliant"
- "Insufficient Data" not "No Submissions" (for MDAs with < 2 months)
- Trend direction: "Improving" (teal arrow up), "Stable" (grey dash), "Declining" (amber arrow down)

### Project Structure Notes

- **New route file:** `apps/server/src/routes/crossMonthRoutes.ts` — first cross-month route file. Story 16.1 may also create this; if so, extend it. Register in route index.
- **New service:** `apps/server/src/services/crossMonthMetricsService.ts` — sits alongside existing `crossMonthResolutionService.ts` (Story 16.2)
- **New hooks file:** `apps/client/src/hooks/useCrossMonthStability.ts`
- **New components:** `apps/client/src/pages/dashboard/components/MdaStabilityRanking.tsx`, `StabilityTrendCharts.tsx` — follows existing dashboard component location
- **New Zod schemas:** `packages/shared/src/validators/crossMonthSchemas.ts` — follows `reportSchemas.ts`, `dashboardSchemas.ts` naming
- **First Recharts usage:** This story establishes the charting pattern for the project. No existing chart components to reference.

### References

- [Source: apps/server/src/services/executiveSummaryReportService.ts] — Executive summary integration point (AC5, Task 7)
- [Source: apps/server/src/services/weeklyAgReportService.ts] — Weekly AG report integration point (AC6, Task 8)
- [Source: apps/server/src/services/attentionItemService.ts] — Per-MDA aggregation pattern
- [Source: apps/server/src/routes/reportRoutes.ts#L33-L40] — `executiveReportAuth` middleware stack to replicate
- [Source: apps/client/src/components/shared/MetricHelp.tsx] — MetricHelp component (accepts `metric` key or `definition` object)
- [Source: packages/shared/src/constants/metricGlossary.ts#L376-L389] — METRIC_GLOSSARY with `prefixKeys()` pattern
- [Source: packages/shared/src/constants/vocabulary.ts] — Non-punitive language constants
- [Source: apps/client/src/hooks/useReportData.ts] — TanStack Query hook pattern to follow
- [Source: _bmad-output/implementation-artifacts/16-1-cross-month-diffing-engine.md] — cross_month_findings table, finding types, submission summary
- [Source: _bmad-output/implementation-artifacts/16-2-anomaly-resolution-event-context.md] — Resolution workflow (markExpected, markResolved) needed for AC6
- [Source: _bmad-output/implementation-artifacts/16-3-cross-month-dashboard-drilldown.md] — Cross-Month tab integration, MDA summary cards

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
