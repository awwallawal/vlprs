# Story 11.0b: Migration Coverage Tracker

Status: done

<!-- New feature — provides MDA x month coverage matrix with export. Split from original Story 11.0 per PM decision 2026-03-17. FR91. -->

## Story

As a **Department Admin / AG (SUPER_ADMIN)**,
I want to see a matrix showing which MDAs have migrated data for which months, with the ability to export it as CSV or PDF,
So that I can identify coverage gaps across the 63 MDAs and use the export in conversations with MDA officers about missing periods.

## Acceptance Criteria

1. **Given** the DEPT_ADMIN views the Migration Dashboard, **When** they open the "Coverage Tracker" tab, **Then** a matrix shows all 63 MDAs (rows) x months (columns) with indicators for which periods have migrated data. **And** the default view shows the standard 60-month window (current month back 5 years). **And** an "Extended" toggle expands the view to 2017/2018. **And** a "Download CSV" and "Download PDF" button exports the tracker for offline use and MDA officer conversations.

2. **Given** the AG/Deputy (SUPER_ADMIN) or MDA_OFFICER views the tracker, **When** displayed, **Then** SUPER_ADMIN sees all 63 MDAs, and MDA_OFFICER sees only their own MDA's row — same matrix, scoped by role.

## Tasks / Subtasks

### Task 1: Coverage Endpoint (AC: #1, #2)

- [x] 1.1 Add `GET /api/migrations/coverage` endpoint in `apps/server/src/routes/migrationDashboardRoutes.ts`:
  - Returns matrix data: `{ mdas: [{ mdaId, mdaName, mdaCode, periods: { '2020-03': { recordCount, stage }, ... } }], periodRange: { start, end } }`
  - Query params: `?extended=true` to include periods back to 2017; default is 60-month window
  - Scoped via `scopeToMda`: SUPER_ADMIN/DEPT_ADMIN see all MDAs, MDA_OFFICER sees own MDA only
  - Data source: aggregate `migration_records` (or equivalent) grouped by MDA + extracted period
- [x] 1.2 Add tests for the coverage endpoint:
  - Returns correct matrix shape (MDA rows x month columns)
  - `?extended=true` includes 2017/2018 periods
  - MDA_OFFICER scoping returns only own MDA
  - DEPT_ADMIN/SUPER_ADMIN see all MDAs

### Task 2: Coverage Tracker Component (AC: #1)

- [x] 2.1 Create `MigrationCoverageTracker` component in `apps/client/src/pages/dashboard/components/`:
  - Matrix/grid view: MDA rows x month columns
  - Cell indicators: green (data exists), empty/grey (gap), amber (partial — has data but not yet baselined)
  - Record count tooltip on hover per cell
  - Sticky first column (MDA name) for horizontal scroll
  - Default: 60-month window. "Extended View" toggle adds 2017/2018 columns
  - Summary row at bottom: total MDAs with data per month
  - Summary column at right: total months covered per MDA + gap count
- [x] 2.2 Add "Coverage Tracker" tab to `MigrationPage.tsx` alongside existing tabs (MDA Progress, Beneficiary Ledger, Observations, Duplicates).
- [x] 2.3 Add component tests for MigrationCoverageTracker.

### Task 3: CSV Export (AC: #1)

- [x] 3.1 Implement CSV export:
  - Button: "Download CSV" — exports the full matrix as a spreadsheet-friendly CSV
  - Format: first column = MDA Name, subsequent columns = YYYY-MM, cell values = record count (0 for gaps)
  - Includes summary row and gap count column

### Task 4: PDF Export (AC: #1)

- [x] 4.1 Implement PDF export:
  - Button: "Download PDF" — generates a branded, print-ready PDF of the tracker
  - Uses Oyo State letterhead styling (if available) or clean VLPRS branding
  - Landscape orientation for the matrix
  - Includes generation date, role context, and gap summary statistics

### Task 5: Role-Based Scoping (AC: #2)

- [x] 5.1 Wire role-based scoping in the component:
  - DEPT_ADMIN: full matrix (all 63 MDAs) — this is their primary operational tool
  - SUPER_ADMIN: full matrix (read-only overview for AG/Deputy)
  - MDA_OFFICER: single-row view showing only their MDA's coverage + gap count

## Dev Notes

### Context

This is a **net-new feature** surfaced during UAT preparation. The Department Admin needs a visual tool to identify which MDAs have migrated data for which months, and which periods have gaps. The CSV/PDF exports enable offline conversations with MDA officers about missing data. Split from original Story 11.0 to respect the 15-task sizing guardrail.

### Architecture Notes

**Data source:**
- Aggregate from `migration_records` (or the table that stores parsed migration rows) grouped by MDA + period (extracted from the `period` column).
- The endpoint returns pre-aggregated data — the component does not fetch raw records.

**Matrix rendering:**
- 63 MDAs x 60 months = ~3,780 cells in default view, ~5,670 in extended view. Use CSS Grid or a lightweight virtual table for performance.
- Sticky first column via `position: sticky; left: 0` for horizontal scroll usability.

**PDF generation:**
- Consider client-side generation (e.g., html2canvas + jsPDF) or a lightweight server-side approach. Epic 6 (Reporting & PDF Export) will establish the full PDF pipeline — this story can use a simpler approach that gets replaced later.

### Existing Infrastructure to Reuse

| Component | Location | Status |
|-----------|----------|--------|
| `MigrationPage` | `apps/client/src/pages/dashboard/MigrationPage.tsx` | Exists, needs new tab |
| `MigrationProgressCard` | `apps/client/src/components/shared/MigrationProgressCard.tsx` | Exists, shows per-MDA stage + counts |
| `migrationDashboardRoutes` | `apps/server/src/routes/migrationDashboardRoutes.ts` | Exists, add coverage endpoint here |
| `scopeToMda` | `apps/server/src/middleware/scopeToMda.ts` | Exists, use for role-based filtering |

### References

- [Source: apps/client/src/pages/dashboard/MigrationPage.tsx — Migration Dashboard with MDA progress, beneficiary ledger, observations, duplicates tabs]
- [Source: apps/server/src/routes/migrationDashboardRoutes.ts — GET /api/migrations/dashboard + /dashboard/metrics]
- FR91: Migration Coverage Tracker

## Dev Agent Record

### Implementation Plan

- **Backend:** Added `getMigrationCoverage()` service function that aggregates `migration_records` by MDA + periodYear + periodMonth, with `withMdaScope` for role-based filtering. Supports default 60-month window and extended (back to 2017) via query param.
- **API:** Added `GET /api/migrations/coverage?extended=true|false` endpoint with `coverageQuerySchema` validation.
- **Frontend:** Created `MigrationCoverageTracker` component with matrix grid, sticky first column, color-coded cells (green=baselined, amber=partial, grey=gap), summary row/column, extended view toggle, CSV download, and PDF print export.
- **Integration:** Added "Coverage Tracker" tab to `MigrationPage.tsx` as fifth tab.
- **PDF approach:** Used print-based window approach (no external dependencies). Epic 6 will replace this with a proper PDF pipeline.
- **Types:** Added `CoveragePeriodData`, `CoverageMdaRow`, `CoverageMatrix` interfaces to shared types. Used `baselinedCount` instead of `stage` per period for more granular cell-color decisions.

### Review Follow-ups (AI)

- [x] [AI-Review][MEDIUM] M1: Add error state rendering when API call fails — component showed misleading "No migration data" on errors [MigrationCoverageTracker.tsx:217]
- [x] [AI-Review][MEDIUM] M2: Add popup blocker feedback for PDF export — `window.open` returns null with no user notification [MigrationCoverageTracker.tsx:201]
- [x] [AI-Review][MEDIUM] M3: Fix `validateQuery` middleware to assign parsed result to `req.query` (matching `validate` behavior); fix `coverageQuerySchema` to properly handle boolean query strings; simplify handler [validate.ts:31, migrationSchemas.ts:98, migrationDashboardRoutes.ts:50]
- [x] [AI-Review][MEDIUM] M4: CSV export doesn't escape double quotes in cell values per RFC 4180 [MigrationCoverageTracker.tsx:73]
- [x] [AI-Review][LOW] L1: Add component test for API error state — error state was untested [MigrationCoverageTracker.test.tsx]
- [x] [AI-Review][LOW] L2: Fix `URL.revokeObjectURL` timing — called synchronously after `a.click()` could abort download; deferred with setTimeout [MigrationCoverageTracker.tsx:85]
- [x] [AI-Review][LOW] L3: Use `replaceAll` instead of `replace` for role display in PDF — single replace only handles first underscore [MigrationCoverageTracker.tsx:199]

### Completion Notes

- All 5 tasks and 8 subtasks implemented and verified
- 8 server integration tests covering matrix shape, period filtering, extended mode, role scoping
- 18 client component tests covering rendering, indicators, toggle, legend, CSV/PDF exports, empty state, error state, vocabulary compliance
- Full regression suite: 76 server test files (1100 tests), 71 client test files (518 tests) — all passing
- Linting clean on all changed files

## File List

### New Files
- `apps/server/src/services/migrationCoverage.integration.test.ts` — Integration tests for coverage endpoint
- `apps/client/src/pages/dashboard/components/MigrationCoverageTracker.tsx` — Coverage matrix component with CSV/PDF export
- `apps/client/src/pages/dashboard/components/MigrationCoverageTracker.test.tsx` — Component tests

### Modified Files
- `packages/shared/src/types/mda.ts` — Added CoveragePeriodData, CoverageMdaRow, CoverageMatrix types
- `packages/shared/src/validators/migrationSchemas.ts` — Added coverageQuerySchema; fixed boolean coercion (review M3)
- `packages/shared/src/index.ts` — Exported new types and schema
- `apps/server/src/services/migrationDashboardService.ts` — Added getMigrationCoverage() function
- `apps/server/src/routes/migrationDashboardRoutes.ts` — Added GET /api/migrations/coverage route; simplified extended param handling (review M3)
- `apps/server/src/middleware/validate.ts` — Fixed validateQuery to assign parsed result to req.query (review M3)
- `apps/client/src/hooks/useMigrationData.ts` — Added useMigrationCoverage() hook
- `apps/client/src/pages/dashboard/MigrationPage.tsx` — Added Coverage Tracker tab

## Change Log

- **2026-03-17:** Story 11.0b implemented — Migration Coverage Tracker with MDA x month matrix, CSV/PDF export, and role-based scoping (FR91)
- **2026-03-17:** Code review — 4 MEDIUM + 3 LOW issues found and auto-fixed: error state, popup blocker feedback, validateQuery middleware fix, CSV escaping, error test, revokeObjectURL timing, replaceAll for role display
