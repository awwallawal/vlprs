# Story 8.0h: Monthly Metric Snapshots & MoM Trend

Status: ready-for-dev

## Story

As the **Accountant General**,
I want the Month-over-Month trend arrows on the Executive Summary to show real percentage changes based on historical data,
So that I can see genuine progress (or decline) across Active Loans, Total Exposure, Monthly Recovery, and Completion Rate — not misleading 0% placeholders.

**Origin:** Tech debt item #2 from E7+E6 retro (2026-03-29). 3 of 4 MoM metrics show 0% because no historical snapshot exists. Zero-debt-forward principle: don't show broken data, fix it properly.

**Dependencies:** None — independent of 8.0a–8.0g. Can run in parallel with 8.0i.

## Acceptance Criteria

1. **Given** the system is running, **When** the 1st of a new month arrives, **Then** a scheduled job captures a snapshot of 4 key metrics (Active Loans count, Total Exposure amount, Monthly Recovery amount, Completion Rate percentage) and stores them in a `metric_snapshots` table with the snapshot month/year.

2. **Given** the `metric_snapshots` table has a snapshot for the previous month, **When** the Executive Summary report is generated, **Then** the MoM trend section shows real percentage changes: e.g., "Active Loans: 4,926 ▲ 2.3% from previous month" (not 0%).

3. **Given** no snapshot exists for the previous month (first month of operation or data gap), **When** the Executive Summary report is generated, **Then** the MoM trend section shows "—" or "No prior data" instead of a misleading 0% arrow.

4. **Given** a fresh deployment with no snapshots, **When** the snapshot scheduler starts for the first time, **Then** it backfills the current month's metrics as the initial baseline snapshot, so the NEXT month will have a comparison point.

5. **Given** the snapshot scheduler, **When** it runs, **Then** it is idempotent — running twice in the same month does not create duplicate snapshots (upsert behavior).

6. **Given** the `metric_snapshots` table, **When** querying historical trends, **Then** snapshots are queryable by month/year for future trend reporting (e.g., 6-month sparklines — out of scope for this story but the schema supports it).

7. **Given** the dashboard hero metrics, **When** the `HeroMetricCard` component has a `trend` prop available, **Then** the dashboard also shows MoM trend arrows on the 4 key metrics (Active Loans, Total Exposure, Monthly Recovery, Completion Rate) using the same snapshot data.

## Tasks / Subtasks

- [ ] Task 1: Create `metric_snapshots` table (AC: 1, 5, 6)
  - [ ] 1.1: Add `metricSnapshots` table to `apps/server/src/db/schema.ts`:
    ```typescript
    export const metricSnapshots = pgTable('metric_snapshots', {
      id: uuid('id').primaryKey().$defaultFn(generateUuidv7),
      snapshotYear: integer('snapshot_year').notNull(),
      snapshotMonth: integer('snapshot_month').notNull(),
      activeLoans: integer('active_loans').notNull(),
      totalExposure: numeric('total_exposure', { precision: 15, scale: 2 }).notNull(),
      monthlyRecovery: numeric('monthly_recovery', { precision: 15, scale: 2 }).notNull(),
      completionRate: numeric('completion_rate', { precision: 5, scale: 2 }).notNull(),
      createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    }, (table) => [
      uniqueIndex('idx_metric_snapshots_year_month').on(table.snapshotYear, table.snapshotMonth),
    ]);
    ```
  - [ ] 1.2: Run `drizzle-kit generate` to create a NEW migration (never re-generate existing)
  - [ ] 1.3: Verify migration applies cleanly

- [ ] Task 2: Create snapshot capture service (AC: 1, 4, 5)
  - [ ] 2.1: Create `apps/server/src/services/metricSnapshotService.ts` with:
    ```typescript
    export async function captureMonthlySnapshot(): Promise<void>
    ```
  - [ ] 2.2: Compute the 4 metrics using existing service functions (reuse, don't duplicate):
    - **Active Loans:** count from `loans` table where `status = 'ACTIVE'` — currently computed **inline** in `dashboardRoutes.ts` lines 60-65 (NOT in a reusable service function). Extract to a helper in `dashboardService.ts` or `metricSnapshotService.ts` so both the route and the scheduler can call it
    - **Total Exposure:** sum of outstanding balances for active loans — currently computed **inline** in `dashboardRoutes.ts` lines 71-103. Same extraction needed
    - **Monthly Recovery:** sum of PAYROLL ledger entries for the current period — reuse `revenueProjectionService.getActualMonthlyRecovery()` (lines 123-150, current period). NOTE: the PREVIOUS period recovery function `getPreviousPeriodRecovery()` is a **private function in `executiveSummaryReportService.ts`** (lines 564-585), NOT in revenueProjectionService. You may need to extract it or duplicate the query for the snapshot service
    - **Completion Rate:** percentage of completed loans — reuse `loanClassificationService` computation
  - [ ] 2.3: Upsert into `metric_snapshots` using Drizzle's `onConflictDoUpdate` on the `(snapshot_year, snapshot_month)` unique index — prevents duplicates if scheduler runs twice
  - [ ] 2.4: Log snapshot capture: `logger.info({ snapshotYear, snapshotMonth, activeLoans, totalExposure, monthlyRecovery, completionRate }, 'Monthly metric snapshot captured')`
  - [ ] 2.5: Unit test in `apps/server/src/services/metricSnapshotService.test.ts` (**new file**): `captureMonthlySnapshot` creates a new snapshot row
  - [ ] 2.6: Unit test in same file: calling twice in same month upserts (no duplicate, values updated)

- [ ] Task 3: Create monthly scheduler (AC: 1, 4)
  - [ ] 3.1: Add `startMetricSnapshotScheduler()` in `metricSnapshotService.ts`, following the existing pattern from `inactiveLoanDetector.ts` (lines 314-327):
    ```typescript
    const SCHEDULER_INTERVAL_MS = 24 * 60 * 60 * 1000; // Check daily
    const SCHEDULER_STARTUP_DELAY_MS = 5 * 60 * 1000;  // 5 min after boot (matches inactiveLoanDetector pattern)

    export function startMetricSnapshotScheduler(): void {
      if (env.NODE_ENV === 'test') return;
      // ... setTimeout + setInterval pattern
    }
    ```
  - [ ] 3.2: The daily check logic: on each tick, check if a snapshot exists for the current month. If not, capture one. This effectively runs on the 1st of each month (or whenever the server restarts in a new month)
  - [ ] 3.3: On first startup: if no snapshots exist at all, immediately capture current month as baseline (AC: 4)
  - [ ] 3.4: Add `stopMetricSnapshotScheduler()` for cleanup (matching existing pattern)
  - [ ] 3.5: Register `startMetricSnapshotScheduler()` in `apps/server/src/index.ts` alongside existing schedulers (lines 28-32). Also register `stopMetricSnapshotScheduler()` in the graceful shutdown handler (lines 42-50) alongside existing `stopIntegrityChecker()` and `stopInactiveLoanScheduler()` calls
  - [ ] 3.6: Unit test in same file: scheduler skips capture if snapshot already exists for current month
  - [ ] 3.7: Unit test in same file: scheduler captures if no snapshot for current month

- [ ] Task 4: Update Executive Summary MoM computation (AC: 2, 3)
  - [ ] 4.1: Add `getPreviousMonthSnapshot(year, month)` function in `metricSnapshotService.ts`:
    - Calculate previous month: if month=1 → year-1, month=12; else month-1
    - Query `metric_snapshots` for that year/month
    - Return snapshot or null
  - [ ] 4.2: Modify `buildMonthOverMonthTrend()` in `apps/server/src/services/executiveSummaryReportService.ts` (lines 508-549):
    - Call `getPreviousMonthSnapshot()` to get real previous values
    - Replace the 3 hardcoded `buildTrendMetric(current, current)` calls with `buildTrendMetric(current, snapshot.value)`
    - Keep monthlyRecovery's existing ledger-based computation (it already works correctly)
    - If no previous snapshot: return `{ current, previous: null, changePercent: null }` instead of 0%
  - [ ] 4.3: Update `TrendMetric` type to allow `previous: number | null` and `changePercent: number | null`
  - [ ] 4.4: Update `TrendIndicator` component in `apps/client/src/pages/dashboard/components/ExecutiveSummaryReport.tsx` (lines 20-43) to handle null: show "—" when `changePercent` is null
  - [ ] 4.5: Unit test in `apps/server/src/services/executiveSummaryReportService.test.ts`: with previous snapshot → real percentage change computed
  - [ ] 4.6: Unit test in same file: without previous snapshot → null changePercent returned (not 0%)
  - [ ] 4.7: Unit test in same file: monthlyRecovery still uses ledger-based computation (not snapshot)

- [ ] Task 5: Wire MoM trends to dashboard hero metrics (AC: 7)
  - [ ] 5.1: Add MoM trend data to the `/api/dashboard/metrics` response in `apps/server/src/routes/dashboardRoutes.ts`:
    - Call `getPreviousMonthSnapshot()` for the previous month
    - Compute `changePercent` for each of the 4 metrics
    - Add `trends: { activeLoans, totalExposure, monthlyRecovery, completionRate }` to the response, each with `{ direction: 'up'|'down'|'flat', label: '+2.3%' | '—' }`
  - [ ] 5.2: Update the `useDashboardMetrics()` hook response type to include `trends`
  - [ ] 5.3: Pass `trend` prop to the 4 relevant `HeroMetricCard` instances in `DashboardPage.tsx` — the component already supports it (lines 131-137 of `HeroMetricCard.tsx`) but it's never used
  - [ ] 5.4: Determine trend direction: positive change = `'up'` for recovery/completion (good), `'up'` for exposure/active loans (neutral — more loans isn't inherently bad in a loan scheme)

- [ ] Task 6: Update resetDb.ts (AC: all)
  - [ ] 6.1: Add `metric_snapshots` to the TRUNCATE list in `apps/server/src/test/resetDb.ts`

- [ ] Task 7: Full regression and verification (AC: all)
  - [ ] 7.1: Run `pnpm typecheck` — zero errors
  - [ ] 7.2: Run `pnpm test` — zero regressions
  - [ ] 7.3: Manual test: verify scheduler captures snapshot on startup (check DB) → generate Executive Summary report → verify MoM shows "—" (no previous month yet) → wait for or simulate next month → verify real percentage appears

## Dev Notes

### The Root Cause: Why 3 of 4 MoM Metrics Show 0%

**File:** `apps/server/src/services/executiveSummaryReportService.ts` (lines 532-541)

```typescript
// MVP: only monthlyRecovery has real previous-period data (via ledger query).
// activeLoans, totalExposure, completionRate use current values for both
// current and previous — historical snapshots require point-in-time queries
// that are deferred to a future enhancement.
return {
  activeLoans: buildTrendMetric(currentActiveCount, currentActiveCount),         // ← SAME value = 0%
  totalExposure: buildTrendMetric(currentExposureNum, currentExposureNum),       // ← SAME value = 0%
  monthlyRecovery: buildTrendMetric(currentRecoveryNum, prevRecoveryNum),        // ← DIFFERENT = real %
  completionRate: buildTrendMetric(currentCompletionRate, currentCompletionRate), // ← SAME value = 0%
};
```

`buildTrendMetric(current, previous)` computes `(current - previous) / previous * 100`. When both values are identical: `(x - x) / x = 0 / x = 0%`.

Monthly Recovery works because `getPreviousPeriodRecovery()` (line 526) queries `ledger_entries` for the previous month's PAYROLL entries — it has actual temporal data.

### Solution: Point-in-Time Snapshots

The other 3 metrics (Active Loans, Total Exposure, Completion Rate) are computed from the current state of the `loans` table. There's no way to know what they were "last month" without storing them. The snapshot table captures these values monthly so the next month has a comparison point.

### Scheduler Pattern (Follow Existing)

**Precedent:** `inactiveLoanDetector.ts` lines 314-327

```typescript
let intervalRef: ReturnType<typeof setInterval> | null = null;
let timeoutRef: ReturnType<typeof setTimeout> | null = null;

export function startInactiveLoanScheduler(): void {
  if (env.NODE_ENV === 'test') return;
  if (intervalRef || timeoutRef) return;

  timeoutRef = setTimeout(() => {
    timeoutRef = null;
    runDetection();
    intervalRef = setInterval(runDetection, SCHEDULER_INTERVAL_MS);
  }, SCHEDULER_STARTUP_DELAY_MS);
}
```

For metric snapshots:
- **Interval:** 24 hours (daily check, not monthly interval — simpler than computing "next 1st of month")
- **Startup delay:** 5 minutes (matches `inactiveLoanDetector` pattern — let other services initialize first)
- **Logic per tick:** "Does a snapshot for this month exist? No → capture. Yes → skip."
- **First-run backfill:** If NO snapshots exist at all, capture immediately as baseline

### Why Daily Check Instead of Monthly Interval

`setInterval(30 * 24 * 60 * 60 * 1000)` drifts and doesn't account for month boundaries. A daily check with "already captured this month?" guard is simpler, idempotent, and handles server restarts mid-month correctly.

### Upsert Pattern for Idempotency

```typescript
await db.insert(metricSnapshots).values({
  snapshotYear: year,
  snapshotMonth: month,
  activeLoans,
  totalExposure,
  monthlyRecovery,
  completionRate,
}).onConflictDoUpdate({
  target: [metricSnapshots.snapshotYear, metricSnapshots.snapshotMonth],
  set: { activeLoans, totalExposure, monthlyRecovery, completionRate, createdAt: new Date() },
});
```

### Metric Computation: Reuse, Don't Duplicate

Each metric is already computed somewhere in the codebase. Extract or reuse:

| Metric | Current Source | Location |
|---|---|---|
| Active Loans (count) | `SELECT COUNT(*) FROM loans WHERE status = 'ACTIVE'` | `dashboardRoutes.ts` lines 60-65 |
| Total Exposure (₦) | Sum of outstanding balances for active loans | `dashboardRoutes.ts` lines 71-103 |
| Monthly Recovery (₦) | Sum of PAYROLL ledger entries for current period | `revenueProjectionService.getActualMonthlyRecovery()` (lines 123-150, current period). Previous period: `getPreviousPeriodRecovery()` in `executiveSummaryReportService.ts` (lines 564-585, private — may need extraction) |
| Completion Rate (%) | Completed / total loans in 60-month window | `loanClassificationService` |

If these computations are currently inline in `dashboardRoutes.ts` (not in a reusable service function), extract them into `dashboardService.ts` or `metricSnapshotService.ts` helpers so both the dashboard endpoint and the snapshot scheduler can call them.

### HeroMetricCard Trend Prop (Already Exists)

**File:** `apps/client/src/components/shared/HeroMetricCard.tsx`

The component already has:
```typescript
trend?: { direction: 'up' | 'down' | 'flat'; label: string };
```

And renders it (lines 131-137) but NO dashboard card currently passes it. Task 5 wires this up.

### TrendIndicator Null Handling

The `TrendIndicator` in `ExecutiveSummaryReport.tsx` (lines 20-43) currently always renders an arrow and percentage. Update to handle null:

```typescript
{changePercent !== null ? (
  <>
    {arrow} {changePercent}% from previous month
  </>
) : (
  <span className="text-text-muted">No prior data</span>
)}
```

### What This Story Does NOT Change

- **Monthly Recovery MoM computation** — already works via ledger query, keep as-is
- **Dashboard metrics computation** — real-time computation unchanged, snapshots are an additional capture
- **Executive Summary report structure** — same 4 MoM metrics, just with real data
- **Report PDF layout** — trend section format unchanged

### File Locations

| What | Path | Key Lines |
|---|---|---|
| Executive Summary service | `apps/server/src/services/executiveSummaryReportService.ts` | 508-549 (MoM builder) |
| Revenue projection service | `apps/server/src/services/revenueProjectionService.ts` | 564-585 (prev period recovery) |
| Executive Summary report UI | `apps/client/src/pages/dashboard/components/ExecutiveSummaryReport.tsx` | 286-297 (MoM display), 20-43 (TrendIndicator) |
| HeroMetricCard | `apps/client/src/components/shared/HeroMetricCard.tsx` | 42-50 (trend prop), 131-137 (trend render) |
| Dashboard page | `apps/client/src/pages/dashboard/DashboardPage.tsx` | 147-232 (hero metric cards — no trend prop currently) |
| Dashboard routes | `apps/server/src/routes/dashboardRoutes.ts` | 47-122 (Phase 1 metrics computation) |
| Inactive loan scheduler (pattern) | `apps/server/src/services/inactiveLoanDetector.ts` | 314-327 (scheduler), 340-350 (stop) |
| Server startup | `apps/server/src/index.ts` | Scheduler registration |
| DB schema | `apps/server/src/db/schema.ts` | New table location |
| resetDb | `apps/server/src/test/resetDb.ts` | Add new table |

### Drizzle Migration Rules

- Generate a NEW migration for the `metric_snapshots` table
- Never re-generate existing migrations
- See `docs/drizzle-migrations.md`

### Non-Punitive Vocabulary

- "No prior data" (not "Missing data" or "Error")
- Trend arrows are informational, not judgmental — a decrease in Active Loans could be positive (loans completing)

### Testing Standards

- Co-located tests: `metricSnapshotService.test.ts`
- Integration tests for the scheduler idempotency
- Vitest framework
- Financial assertions use string comparison via Decimal.js

### Team Agreements Applicable

- **Extend, don't fork** — reuse existing metric computations, don't duplicate queries
- **Zero-debt-forward** — no more 0% placeholders; either show real data or "No prior data"

### References

- [Source: _bmad-output/implementation-artifacts/epic-7-6-retro-2026-03-29.md#Debt Item #2 — MoM trend 0%]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.0h]
- [Source: apps/server/src/services/executiveSummaryReportService.ts:532-541 — Hardcoded same-value MoM]
- [Source: apps/server/src/services/executiveSummaryReportService.ts:508-549 — buildMonthOverMonthTrend]
- [Source: apps/server/src/services/executiveSummaryReportService.ts:564-585 — getPreviousPeriodRecovery (private fn, computes real previous month PAYROLL sum)]
- [Source: apps/server/src/services/revenueProjectionService.ts:123-150 — getActualMonthlyRecovery (current period)]
- [Source: apps/client/src/pages/dashboard/components/ExecutiveSummaryReport.tsx:286-297 — TrendIndicator display]
- [Source: apps/client/src/pages/dashboard/components/ExecutiveSummaryReport.tsx:20-43 — TrendIndicator component]
- [Source: apps/client/src/components/shared/HeroMetricCard.tsx:42-50 — trend prop (unused)]
- [Source: apps/server/src/services/inactiveLoanDetector.ts:314-327 — Scheduler pattern to follow]
- [Source: apps/server/src/routes/dashboardRoutes.ts:47-122 — Current metric computation]

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
