# Story 8.0f: Coverage Tracker Drill-Down & CSV/Excel Download

Status: done

## Story

As the **Accountant General**,
I want to click any cell in the MDA × Month Coverage Tracker grid to navigate to that month's data, and download as CSV or Excel,
So that I can inspect and verify specific months of migrated data without navigating through multiple screens.

**Origin:** UAT Finding #10 from E7+E6 retro (2026-03-29). CSV/Excel preferred over PDF for wide-column data.

**Dependencies:** None — independent of 8.0a–8.0e. Can run in parallel with 8.0e.

## Acceptance Criteria

1. **Given** the Coverage Tracker grid on the Migration Dashboard, **When** the user clicks a cell with data (record count > 0), **Then** a drill-down page opens showing all migration records for that MDA and month.

2. **Given** a cell with no data (gap — record count = 0), **When** the user hovers over it, **Then** the cell shows a tooltip "No data for this period" but is NOT clickable.

3. **Given** the drill-down page for a specific MDA + month, **When** viewing the records table, **Then** it shows: staff name, staff ID, principal, total loan, monthly deduction, outstanding balance, variance category, baseline status — with sorting by any column.

4. **Given** the drill-down page, **When** the user clicks "Download CSV", **Then** a CSV file is generated containing all records for that MDA + month with the same columns as the table, filename format: `vlprs-{mdaCode}-{YYYY-MM}-records.csv`.

5. **Given** the drill-down page, **When** the user clicks "Download Excel", **Then** an Excel (.xlsx) file is generated with the same data, formatted with column headers, auto-width columns, and a title row showing the MDA name and period.

6. **Given** the drill-down page, **When** viewing the page header, **Then** it displays: MDA name, period (e.g., "August 2024"), record count, baselined count, and a "Back to Coverage Tracker" navigation link.

7. **Given** the Coverage Tracker grid cells, **When** hovering over a cell with data, **Then** the cursor changes to pointer and the cell shows a subtle hover highlight, reinforcing clickability.

## Tasks / Subtasks

- [x] Task 1: Create records-by-MDA-period API endpoint (AC: 3)
  - [x] 1.1: Add `GET /api/migrations/coverage/records` endpoint in `apps/server/src/routes/migrationDashboardRoutes.ts` with query params: `mdaId` (required), `year` (required), `month` (required), `page` (optional, default 1), `limit` (optional, default 50), `sortBy` (optional), `sortDir` (optional)
  - [x] 1.2: Add `getCoverageRecords(mdaId, year, month, pagination, mdaScope)` in `apps/server/src/services/migrationDashboardService.ts`:
    - Query `migration_records` WHERE `mdaId = ? AND periodYear = ? AND periodMonth = ?`
    - Filter: active records only (`isNull(deletedAt)`, exclude superseded via `recordStatus`)
    - Select: id, staffName, `employeeNo` (displayed as "Staff ID" in UI — schema.ts line 355, column is `employee_no` NOT `staffId`), principal, totalLoan, monthlyDeduction, outstandingBalance, varianceCategory, varianceAmount, isBaselineCreated, computedRate, sheetName
    - Join `mdas` for mdaName and mdaCode
    - Apply sorting (default: staffName ASC)
    - Return paginated results with summary: `{ records, pagination, summary: { total, baselinedCount, mdaName, mdaCode, periodLabel } }`
  - [x] 1.3: Add Zod schema for query params validation
  - [x] 1.4: Apply auth middleware (SUPER_ADMIN, DEPT_ADMIN, MDA_OFFICER) + `scopeToMda`
  - [x] 1.5: Integration test in `apps/server/src/routes/migrationDashboard.integration.test.ts` (**new file** — use `baseline.integration.test.ts` as structural precedent): returns correct records for specific MDA + period, respects MDA scope

- [x] Task 2: Create CSV/Excel download endpoint (AC: 4, 5)
  - [x] 2.1: Add `GET /api/migrations/coverage/records/export` endpoint with query params: `mdaId`, `year`, `month`, `format` (`csv` or `xlsx`)
  - [x] 2.2: For CSV format: generate server-side CSV (follow `beneficiaryLedgerService.ts` lines 331-474 pattern):
    - Set `Content-Type: text/csv; charset=utf-8`
    - Set `Content-Disposition: attachment; filename="vlprs-{mdaCode}-{YYYY-MM}-records.csv"`
    - Columns: Staff Name, Staff ID (`employeeNo` column), Grade, Step, Principal, Total Loan, Monthly Deduction, Outstanding Balance, Variance Category, Variance Amount, Baseline Status, Computed Rate, Sheet Name
    - Include BOM for Excel compatibility (`\uFEFF` prefix)
  - [x] 2.3: For Excel format: use `xlsx` library (already in project as SheetJS dependency for migration upload parsing):
    - Create workbook with single sheet named `{MDA Code} - {Month Year}`
    - Title row: `{MDA Name} — {Month Year} Migration Records`
    - Column headers with auto-width
    - Financial columns formatted as number (not string)
    - Set `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
    - Set `Content-Disposition: attachment; filename="vlprs-{mdaCode}-{YYYY-MM}-records.xlsx"`
  - [x] 2.4: Apply same auth + MDA scope as Task 1
  - [x] 2.5: Integration test in same file: CSV export returns correct headers and data rows
  - [x] 2.6: Integration test in same file: Excel export returns valid xlsx buffer

- [x] Task 3: Create CoverageRecordsPage drill-down component (AC: 3, 6)
  - [x] 3.1: Create `apps/client/src/pages/dashboard/CoverageRecordsPage.tsx`:
    - Route: `/dashboard/migrations/coverage/:mdaId/:year/:month`
    - Extract params via `useParams()`
    - Page header: MDA name, period label (e.g., "August 2024"), record count / baselined count
    - "Back to Coverage Tracker" link → navigates to `/dashboard/migrations` with Coverage Tracker tab active
  - [x] 3.2: Records table with sortable columns:
    - Staff Name, Staff ID, Principal (₦), Total Loan (₦), Monthly Deduction (₦), Outstanding Balance (₦), Variance Category (badge), Baseline Status (badge: "Established" / "Pending")
    - Use existing table patterns from MigrationUploadPage
    - Client-side sorting (click column header to toggle sort)
  - [x] 3.3: Pagination (same pattern as MigrationUploadList — Previous/Next buttons with page count)
  - [x] 3.4: Download buttons row: "Download CSV" + "Download Excel" — both trigger file download via the export endpoint (Task 2)

- [x] Task 4: Add route and navigation (AC: 1)
  - [x] 4.1: Add route in `apps/client/src/router.tsx` inside the `/dashboard` children array (alongside existing routes like `drill-down/:metric`, `mda/:mdaId`):
    ```typescript
    { path: 'migrations/coverage/:mdaId/:year/:month', lazy: () => import('@/pages/dashboard/CoverageRecordsPage').then(m => ({ Component: m.CoverageRecordsPage })) }
    ```
  - [x] 4.2: Use the React Router `lazy` property (NOT `React.lazy()`) — this is the codebase's established pattern for all dashboard child routes

- [x] Task 5: Add TanStack Query hook (AC: 3)
  - [x] 5.1: Add `useCoverageRecords(mdaId, year, month, page, sortBy, sortDir)` in `apps/client/src/hooks/useMigrationData.ts`:
    ```typescript
    queryKey: ['migration', 'coverage', 'records', { mdaId, year, month, page, sortBy, sortDir }]
    ```
  - [x] 5.2: Add `useCoverageRecordExport()` mutation hook for triggering downloads. **Must use `authenticatedFetch` + Blob** (NOT `window.open()` — that won't send the Authorization Bearer header):
    ```typescript
    mutationFn: async ({ mdaId, year, month, format }) => {
      const res = await authenticatedFetch(`/migrations/coverage/records/export?mdaId=${mdaId}&year=${year}&month=${month}&format=${format}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vlprs-${mdaCode}-${year}-${String(month).padStart(2,'0')}-records.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    }
    ```

- [x] Task 6: Make coverage tracker cells clickable (AC: 1, 2, 7)
  - [x] 6.1: In `apps/client/src/pages/dashboard/components/MigrationCoverageTracker.tsx`, add `onClick` handler to cells with `recordCount > 0`:
    ```typescript
    onClick={() => navigate(`/dashboard/migrations/coverage/${mda.mdaId}/${year}/${month}`)}
    ```
  - [x] 6.2: Add `cursor-pointer` class and hover highlight (`hover:ring-2 hover:ring-primary/30`) to cells with data
  - [x] 6.3: Gap cells (recordCount = 0): keep non-clickable, add `cursor-default`, tooltip "No data for this period"
  - [x] 6.4: Import `useNavigate` from React Router at top of component

- [x] Task 7: Full regression and verification (AC: all)
  - [x] 7.1: Run `pnpm typecheck` — zero errors
  - [x] 7.2: Run `pnpm test` — zero regressions
  - [x] 7.3: Manual test: click populated cell → drill-down page shows correct records → download CSV → verify contents → download Excel → verify contents → click "Back" → returns to Coverage Tracker

## Dev Notes

### Current Coverage Tracker State

**Component:** `apps/client/src/pages/dashboard/components/MigrationCoverageTracker.tsx` (374 lines)

- MDA × Month grid with colored cells (emerald = complete, amber = partial, gray = gap)
- CSV export of the grid itself already exists (lines 48-88) — client-side generated
- PDF export of the grid exists (lines 90-149) — HTML print-based
- Cells are NOT clickable — purely visual with tooltip on hover

**What this story adds:** clickable cells → drill-down page → per-MDA-month record list → CSV/Excel download of the records (not the grid).

### Two Levels of Export (Don't Confuse)

| Level | What | Exists? | Format |
|---|---|---|---|
| Grid export | The MDA × Month matrix itself | YES (lines 48-149) | CSV + PDF |
| Cell-level export | Individual records for one MDA + one month | NO — **this story** | CSV + Excel |

The grid-level CSV/PDF export remains unchanged. This story adds the cell-level record export.

### SheetJS (xlsx) Already Available

The project already uses SheetJS for migration upload parsing:
- Import: `import XLSX from 'xlsx'` in `apps/server/src/services/migrationService.ts` line 1
- Package: `xlsx` in server dependencies

For Excel export, use the same library server-side:
```typescript
import XLSX from 'xlsx';

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(records);
XLSX.utils.book_append_sheet(wb, ws, sheetName);
const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
```

No new dependency needed.

### Drill-Down Navigation Pattern

**Precedent:** Story 4.3 `MetricDrillDownPage`:
- Route: `/dashboard/drill-down/:metric`
- Uses `useParams()` to extract route params
- Back link to parent page
- Basic table with clickable rows (NOTE: does NOT have column sorting — implement sorting directly: click header to toggle asc/desc, track `sortBy`/`sortDir` in component state, pass to API query params)

**This story follows the same pattern:**
- Route: `/dashboard/migrations/coverage/:mdaId/:year/:month`
- `useParams()` for `mdaId`, `year`, `month`
- Back link to `/dashboard/migrations` (Coverage Tracker tab)

### API Design

**Records endpoint:**
```
GET /api/migrations/coverage/records?mdaId={uuid}&year=2024&month=8&page=1&limit=50&sortBy=staffName&sortDir=asc
```

**Export endpoint:**
```
GET /api/migrations/coverage/records/export?mdaId={uuid}&year=2024&month=8&format=csv
GET /api/migrations/coverage/records/export?mdaId={uuid}&year=2024&month=8&format=xlsx
```

Both endpoints share the same query logic (Task 1.2), differing only in response format. Consider extracting a shared `fetchCoverageRecords(mdaId, year, month, mdaScope)` function that both endpoints call.

### File Download Pattern

For CSV, follow `beneficiaryLedgerService.ts` (lines 331-474):
```typescript
res.setHeader('Content-Type', 'text/csv; charset=utf-8');
res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
res.send('\uFEFF' + csvContent);  // BOM for Excel compatibility
```

For Excel:
```typescript
res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
res.send(xlsxBuffer);
```

### Client-Side Download Trigger

**Use `authenticatedFetch` + Blob** — `window.open()` will NOT send the Authorization Bearer header, so the export endpoint would reject with 401. The fetch + Blob pattern works correctly with the existing auth infrastructure:

```typescript
const response = await authenticatedFetch(`/migrations/coverage/records/export?mdaId=${mdaId}&year=${year}&month=${month}&format=csv`);
const blob = await response.blob();
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = filename;
a.click();
URL.revokeObjectURL(url);
```

`authenticatedFetch` (apiClient.ts line 60) handles Bearer token attachment and 401 retry automatically.

### Query Performance

The composite index from Story 8.0d (`idx_migration_records_mda_period` on `mdaId, periodYear, periodMonth`) directly benefits this story's queries. If 8.0d lands first, queries are indexed. If not, they still work but may be slower for large datasets — the index is a nice-to-have, not a blocker.

### Cell Hover & Click Pattern

```tsx
// In MigrationCoverageTracker.tsx cell rendering
<div
  className={cn(
    'w-5 h-4 rounded-sm',
    statusColor,
    hasData && 'cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all',
    !hasData && 'cursor-default',
  )}
  title={tooltipText}
  onClick={hasData ? () => navigate(`/dashboard/migrations/coverage/${mda.mdaId}/${year}/${month}`) : undefined}
  role={hasData ? 'button' : undefined}
  tabIndex={hasData ? 0 : undefined}
/>
```

Add `role="button"` and `tabIndex` for keyboard accessibility on clickable cells.

### What This Story Does NOT Change

- **Grid-level CSV/PDF export** — existing exports of the MDA × Month matrix remain unchanged
- **Coverage computation logic** — `getMigrationCoverage()` stays as-is
- **Validation results page** — `MigrationUploadPage.tsx` unaffected
- **Baseline flow** — unaffected
- **Observation engine** — unaffected

### Non-Punitive Vocabulary

- "No data for this period" (not "Missing" or "Gap" in user-facing text — although internal status uses "gap")
- Variance category badges use existing `VARIANCE_CATEGORY_LABELS` from vocabulary constants

### File Locations

| What | Path | Key Lines |
|---|---|---|
| Coverage Tracker component | `apps/client/src/pages/dashboard/components/MigrationCoverageTracker.tsx` | 1-375 (cells at 318-334) |
| Coverage hook | `apps/client/src/hooks/useMigrationData.ts` | 21-27 |
| Dashboard service | `apps/server/src/services/migrationDashboardService.ts` | 261-346 (coverage query) |
| Dashboard routes | `apps/server/src/routes/migrationDashboardRoutes.ts` | 43-54 (coverage endpoint) |
| Beneficiary export (CSV pattern) | `apps/server/src/services/beneficiaryLedgerService.ts` | 331-474 |
| Drill-down pattern | `apps/client/src/pages/dashboard/MetricDrillDownPage.tsx` | Full file |
| Migration records schema | `apps/server/src/db/schema.ts` | 328-395 |
| Shared types | `packages/shared/src/types/mda.ts` | 101-118 (CoverageMdaRow, CoveragePeriodData) |

### Testing Standards

- Server integration tests co-located with route files
- Vitest framework
- Financial values as strings in assertions (never floating point comparison)

### Team Agreements Applicable

- **Extend, don't fork** — add drill-down alongside existing grid, don't replace
- **N+1 query budget** — coverage records query is a single query with JOIN, no N+1

### References

- [Source: _bmad-output/implementation-artifacts/epic-7-6-retro-2026-03-29.md#UAT Finding #10 — Coverage cells not clickable]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.0f]
- [Source: apps/client/src/pages/dashboard/components/MigrationCoverageTracker.tsx — Current grid (374 lines, not clickable)]
- [Source: apps/client/src/pages/dashboard/components/MigrationCoverageTracker.tsx:48-88 — Existing CSV export of grid]
- [Source: apps/server/src/services/migrationDashboardService.ts:261-346 — Coverage computation query]
- [Source: apps/server/src/routes/migrationDashboardRoutes.ts:43-54 — Coverage endpoint]
- [Source: apps/server/src/services/beneficiaryLedgerService.ts:331-474 — CSV export pattern to follow]
- [Source: apps/client/src/pages/dashboard/MetricDrillDownPage.tsx — Drill-down page pattern from Story 4.3]
- [Source: apps/server/src/services/migrationService.ts:1 — SheetJS (xlsx) already imported]
- [Source: apps/client/src/hooks/useMigrationData.ts:21-27 — Coverage hook]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- Fixed `CELL_LABELS` unused variable after tooltip text change (TS6133)
- Fixed `VOCABULARY.VARIANCE_CATEGORY_LABELS` → `UI_COPY.VARIANCE_CATEGORY_LABELS` (TS2339) — followed existing codebase pattern
- Updated `MigrationCoverageTracker.test.tsx` to wrap in `MemoryRouter` after adding `useNavigate()` to component
- Updated test assertions: cells with data now have `role="button"` (was `role="img"`), gap cells remain `role="img"`

### Completion Notes List

- **Task 1:** Added `GET /api/migrations/coverage/records` endpoint with Zod validation, pagination, sorting, and MDA scope. Shared `CoverageRecordItem`, `CoverageRecordsSummary`, `CoverageRecordsResponse` types. Service function `getCoverageRecords()` uses the `idx_migration_records_mda_period` composite index.
- **Task 2:** Added `GET /api/migrations/coverage/records/export` endpoint supporting CSV (with BOM) and Excel (SheetJS) formats. CSV follows `beneficiaryLedgerService` pattern. Excel includes title row, auto-width columns, financial numbers formatted as numbers. Shared `getAllCoverageRecords()` helper for unpaginated export.
- **Task 3:** Created `CoverageRecordsPage.tsx` drill-down page with header (MDA name, period, record/baseline counts), sortable table with 8 columns, pagination, and CSV/Excel download buttons. Uses non-punitive vocabulary via `UI_COPY.VARIANCE_CATEGORY_LABELS`.
- **Task 4:** Added lazy-loaded route `migrations/coverage/:mdaId/:year/:month` in `router.tsx` following established dashboard route pattern.
- **Task 5:** Added `useCoverageRecords()` query hook and `useCoverageRecordExport()` mutation hook. Export uses `authenticatedFetch` + Blob pattern (not `window.open()`) to send Authorization header.
- **Task 6:** Made coverage tracker cells clickable: cells with data get `cursor-pointer`, `hover:ring-2`, `role="button"`, keyboard navigation (Enter/Space). Gap cells show "No data for this period" tooltip and remain non-clickable. Added `useNavigate` import.
- **Task 7:** Full regression: `pnpm typecheck` zero errors across all 4 packages. `pnpm test` zero regressions (server: 964 tests, client: 653 tests). Integration tests: 9 new tests all passing.

### Change Log

- Story 8.0f implementation complete (Date: 2026-04-03)
- Code review: 8 findings (1 HIGH, 3 MEDIUM, 4 LOW), all fixed automatically (Date: 2026-04-04)

### File List

**New files:**
- `apps/server/src/routes/migrationDashboard.integration.test.ts` — 9 integration tests for coverage records + export
- `apps/client/src/pages/dashboard/CoverageRecordsPage.tsx` — Drill-down page component

**Modified files:**
- `packages/shared/src/types/mda.ts` — Added `CoverageRecordItem`, `CoverageRecordsSummary`, `CoverageRecordsResponse` types
- `packages/shared/src/validators/migrationSchemas.ts` — Added `coverageRecordsQuerySchema`, `coverageRecordsExportSchema`
- `packages/shared/src/index.ts` — Exported new types and schemas
- `apps/server/src/services/migrationDashboardService.ts` — Added `getCoverageRecords()`, `getAllCoverageRecords()`, `SORT_COLUMN_MAP`
- `apps/server/src/routes/migrationDashboardRoutes.ts` — Added `/coverage/records` and `/coverage/records/export` routes
- `apps/client/src/hooks/useMigrationData.ts` — Added `useCoverageRecords()`, `useCoverageRecordExport()` hooks
- `apps/client/src/pages/dashboard/components/MigrationCoverageTracker.tsx` — Made cells clickable with navigation, hover/keyboard a11y
- `apps/client/src/pages/dashboard/components/MigrationCoverageTracker.test.tsx` — Added `MemoryRouter` wrapper, updated role assertions
- `apps/client/src/router.tsx` — Added coverage records drill-down route
