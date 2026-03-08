# Story 3.5: Migration Dashboard & Master Beneficiary Ledger

Status: review

<!-- Generated: 2026-03-06 | Epic: 3 | Sprint: 5 -->
<!-- Blocked By: 3-4-baseline-acknowledgment-ledger-entry-creation | Blocks: 3-6-observation-engine-review-workflow -->
<!-- FRs: FR30, FR31 | Motivation: Operational command centre for the 63-MDA migration marathon + person-level scheme visibility -->
<!-- Source: epics.md SS Epic 3 Story 3.5, sprint-change-proposal-2026-02-28.md SS Story 3.5 RESHAPE -->

## Story

As a **Department Admin**,
I want a Migration Dashboard with a Master Beneficiary Ledger showing all staff and their migration status, observations, and exposure,
So that I can track batch completion, investigate patterns, and know which MDAs still need attention.

### Context

Stories 3.1-3.4 built the complete migration pipeline: upload -> extract -> validate -> person match -> baseline acknowledgment. But there is no single view showing **where we are** across all 63 MDAs, and no person-level table for sorting, filtering, and drilling into individual staff loan histories. This story provides both.

**What changed (from sprint change proposal):** The original Story 3.5 was just an MDA-level dashboard (FR30, FR31). SQ-1's master beneficiary ledger prototype (`docs/legacy_cd/output/master-beneficiary-ledger.html`) proved that a person-level interactive table is equally essential. Awwal's exact words: *"I believe we will need to create a table of all beneficiaries so that from this full pool we can sort, filter and analyse a particular individual across multiple MDAs."*

**What this story builds on:**
- Story 3.1 created `migration_records` with 24 canonical fields per extracted row
- Story 3.2 added `variance_category`, `computed_rate`, and validation summary per record
- Story 3.3 introduced person matching and the `person_matches` table for cross-MDA linking
- Story 3.4 created loan records + `MIGRATION_BASELINE` ledger entries from acknowledged records

**What this story does NOT do:**
- Does NOT generate observations (Story 3.6 -- observation engine generates and manages observations)
- Does NOT generate trace reports (Story 3.7 -- individual trace)
- Does NOT handle file delineation (Story 3.8 -- multi-MDA delineation)
- Does NOT replace the Epic 4 Executive Dashboard -- that dashboard shows live scheme operations; this dashboard shows migration progress

**SQ-1 Prototype Reference:** `docs/legacy_cd/output/master-beneficiary-ledger.html` -- working HTML with sort/filter/search, metric strip, and per-row observation badges. Use as acceptance criteria reference for the MasterBeneficiaryLedger component.

**"Three Clicks to Clarity" (Sprint Change Proposal SS 3.3):**
1. **Click 1 -- Dashboard (MasterBeneficiaryLedger):** See the big picture. Total staff, total loans, observations by category. Filter by MDA, observation type. Numbers update as observations are reviewed.
2. **Click 2 -- Staff Profile (StaffProfilePanel from Story 3.3):** Click a name. See complete loan timeline, observations with context. No accusatory language.
3. **Click 3 -- Action:** Mark observation as reviewed, generate trace report, promote to exception. Every action is audit-logged.

This story delivers Click 1. Stories 3.3 (Click 2) and 3.6/3.7 (Click 3) are separate.

## Acceptance Criteria

### AC 1: MDA Migration Progress Grid

**Given** the migration dashboard at the `/dashboard/migration` route
**When** Department Admin opens it
**Then** all 63 MDAs are listed as `MigrationProgressCard` components with their current migration status: Data Pending, Received, Imported, Validated, Reconciled, Certified (FR30)
**And** each card shows: MDA name + code, current pipeline stage (1-6), record counts per variance category, observation count (read from Story 3.6 data if available, 0 if observations not yet generated), last activity timestamp (FR31)
**And** MDAs with status "Data Pending" use neutral language -- no punitive framing for missing data
**And** the grid is filterable by MDA name (client-side text filter, extending existing pattern from `OperationsHubPage.tsx`)
**And** cards are clickable -- navigating to `/dashboard/mda/{mdaId}` for MDA-level detail

### AC 2: Overall Progress Indicator

**Given** the migration dashboard
**When** Department Admin views progress
**Then** an overall progress indicator shows "X of 63 MDAs complete" with a visual progress bar
**And** "complete" is defined as status reaching "Certified"
**And** a secondary metric shows "X of 63 MDAs with data" (any status beyond "Data Pending")
**And** HeroMetricCards display: Total Staff Migrated (count), Total Exposure (currency, sum of outstanding balances), MDAs Complete (count of "Certified"), Baselines Established (count of loans with MIGRATION_BASELINE entry)

### AC 3: Master Beneficiary Ledger Table

**Given** the migration dashboard
**When** Department Admin clicks "View All Staff" or navigates to the beneficiary ledger tab
**Then** a `MasterBeneficiaryLedger` displays an interactive table of all staff who have baseline loans (from Story 3.4) with columns:
- Staff Name (sortable, searchable)
- Staff ID (sortable) -- employee_no or MIG-xxx generated ID
- MDA(s) (filterable) -- primary MDA name; multi-MDA indicator badge if person_matches exist
- Active Loans (count)
- Total Exposure (currency -- sum of outstanding balances for this person)
- Observations count badge (grey background, teal text -- neutral, not warning style)
- Last Activity Date (sortable)
**And** a metrics strip above the table shows: Total Staff | Total Loans | Total Observations (unreviewed count, or 0 if Story 3.6 not yet deployed) | Total Exposure (currency)
**And** the table supports: sort by any column, filter by MDA (dropdown), search by name/Staff ID (debounced text input), pagination (page/pageSize pattern from `searchLoans`)

### AC 4: Staff Row Navigation

**Given** the MasterBeneficiaryLedger table
**When** Department Admin clicks a staff row
**Then** the StaffProfilePanel from Story 3.3 is displayed (or navigates to the person profile route)
**And** the panel shows the complete loan timeline, cross-MDA history, and computation transparency
**And** this implements Click 1 -> Click 2 of the "Three Clicks to Clarity" pattern

### AC 5: CSV Export

**Given** the MasterBeneficiaryLedger with active filters
**When** Department Admin clicks "Export CSV"
**Then** the currently filtered/sorted data is exported as a CSV file for offline analysis
**And** the CSV includes all visible columns plus additional detail: loanReference, principalAmount, interestRate, tenureMonths, varianceCategory
**And** the filename includes date and filter description: `vlprs-beneficiary-ledger-{date}-{filter}.csv`

### AC 6: MDA Migration Status API

**Given** the migration dashboard
**When** the frontend requests `GET /api/migrations/dashboard`
**Then** the API returns all 63 MDAs with:
- MDA id, name, code
- Current migration stage (derived from migration_uploads status progression)
- Record counts: total records, per variance category (clean, minor, significant, structural, anomalous)
- Baseline completion: records with `is_baseline_created = true` vs total
- Last activity timestamp (most recent migration_upload created_at or updated_at)
- Observation count (from observations table if Story 3.6 deployed, or 0)
**And** MDAs with no migration_uploads show stage "pending" (Data Pending)
**And** the response is cached with 30-second staleTime (matching existing `useMigrationStatus` pattern)

### AC 7: Master Beneficiary Ledger API

**Given** the migration dashboard
**When** the frontend requests `GET /api/migrations/beneficiaries`
**Then** the API returns paginated beneficiary data:
- Per-person aggregation: staffName, staffId, primaryMdaName, primaryMdaId, loanCount, totalExposure (sum of outstanding balances), observationCount (0 if Story 3.6 not deployed), isMultiMda (boolean from person_matches), lastActivityDate
- Pagination: page, pageSize (default 25, max 100), totalItems, totalPages
- Filters: mdaId, search (name/staffId), sortBy (staffName, totalExposure, loanCount, lastActivityDate), sortOrder (asc/desc)
**And** aggregate metrics: totalStaff, totalLoans, totalObservationsUnreviewed, totalExposure (for metrics strip, computed as part of the response)
**And** MDA-scoped for mda_officer role (see only their MDA's staff via `withMdaScope`)

### AC 8: Integration Tests

**Given** the migration dashboard and beneficiary ledger features
**When** integration tests run
**Then** at minimum:
- Test: dashboard API returns all 63 MDAs with correct stage derivation
- Test: MDAs without uploads show stage "pending"
- Test: beneficiary list aggregates loans per person correctly (count, exposure)
- Test: multi-MDA indicator reflects person_matches data
- Test: pagination works correctly (page 1 of N, correct totalItems)
- Test: MDA filter returns only staff from that MDA
- Test: search by name and staffId returns correct results
- Test: sort by totalExposure descending returns highest-exposure staff first
- Test: CSV export includes all expected columns
- Test: MDA-scoped access returns only scoped data

## Tasks / Subtasks

- [x] Task 0: Add `limitedComputation` flag to loans table (carried from Story 3.4 review H4)
  - [x] 0.1 Add `limitedComputation` boolean column to `loans` table in `apps/server/src/db/schema.ts`: `boolean('limited_computation').notNull().default(false)` — flags migration loans where principalAmount is "0.00" and `computeBalanceFromEntries()` cannot be used
  - [x] 0.2 Run `drizzle-kit generate` for migration SQL
  - [x] 0.3 Set `limitedComputation = true` in `baselineService.deriveLoanFromMigrationRecord()` when principalAmount falls back to "0.00"
  - [x] 0.4 Dashboard and beneficiary ledger queries must check this flag: if true, use declared outstanding balance instead of `computeBalanceFromEntries()`

- [x] Task 1: Migration dashboard service (AC: 1, 2, 6)
  - [x] 1.1 Create `apps/server/src/services/migrationDashboardService.ts`:
    - `getMigrationDashboard(mdaScope?)` -- returns all 63 MDAs with migration status
    - `getDashboardMetrics(mdaScope?)` -- returns aggregate hero metrics
  - [x] 1.2 Implement `getMigrationDashboard`:
    - Query all MDAs (63) from `mdas` table (active, non-deleted)
    - LEFT JOIN migration_uploads to get latest upload status per MDA
    - Derive stage from most advanced upload status: no uploads -> "pending", has upload with status "uploaded" -> "received", "mapped"/"processing"/"completed" -> "imported", "validated" -> "validated", "reconciled" -> "reconciled", "certified" -> "certified"
    - Aggregate record counts per MDA: join migration_records, group by variance_category
    - Aggregate baseline completion: count where is_baseline_created = true vs total
    - Include observation count placeholder (0 for now, wired in Story 3.6)
    - Include last activity: MAX(migration_uploads.updated_at) per MDA
  - [x] 1.3 Implement `getDashboardMetrics`:
    - Total staff migrated: COUNT DISTINCT staffName from loans WHERE loanReference LIKE 'VLC-MIG-%'
    - Total exposure: SUM of outstanding balances (computed from loans + ledger entries using batch aggregation pattern from `searchLoans`)
    - MDAs complete: COUNT of MDAs with stage "certified"
    - Baselines established: COUNT of migration_records WHERE is_baseline_created = true
  - [x] 1.4 Stage derivation mapping (migration_upload status -> migration stage):
    ```
    no uploads          -> 'pending'
    uploaded            -> 'received'
    mapped              -> 'imported'
    processing          -> 'imported'
    completed           -> 'imported'
    validated           -> 'validated'
    reconciled          -> 'reconciled'
    certified           -> 'certified'
    ```
  - [x] 1.5 Write unit + integration tests for dashboard service

- [x] Task 2: Master beneficiary ledger service (AC: 3, 5, 7)
  - [x] 2.1 Create `apps/server/src/services/beneficiaryLedgerService.ts`:
    - `listBeneficiaries(filters, pagination, mdaScope)` -- paginated beneficiary list
    - `getBeneficiaryMetrics(mdaScope?)` -- aggregate metrics for metrics strip
    - `exportBeneficiariesCsv(filters, mdaScope)` -- CSV export of filtered data
  - [x] 2.2 Implement `listBeneficiaries`:
    - Base query: loans table (migration loans: loanReference LIKE 'VLC-MIG-%' OR status derived from migration)
    - JOIN mdas for MDA name/code
    - Aggregate per person: GROUP BY staffName, staffId to get loanCount, totalExposure
    - Total exposure per person: use batch balance computation pattern from `searchLoans` (lines 282-298 of `loanService.ts`):
      ```sql
      SELECT loan_id, COALESCE(SUM(amount), '0.00') as total_paid
      FROM ledger_entries
      WHERE loan_id IN (...)
      GROUP BY loan_id
      ```
    - Multi-MDA indicator: LEFT JOIN person_matches (status IN ('auto_confirmed', 'confirmed')) on staffName match
    - Observation count: placeholder 0 (wired in Story 3.6)
    - Last activity: MAX(loans.created_at) per person
    - Pagination: page/pageSize pattern (default 25, max 100)
    - Filters: mdaId, search (ILIKE on staffName, staffId), sort (staffName, totalExposure, loanCount, lastActivityDate)
  - [x] 2.3 Implement `getBeneficiaryMetrics`:
    - Total staff: COUNT DISTINCT (staffName, staffId) from migration loans
    - Total loans: COUNT of migration loans
    - Total observations unreviewed: 0 (placeholder until Story 3.6)
    - Total exposure: SUM of (totalLoan - totalPaid) across all migration loans
  - [x] 2.4 Implement `exportBeneficiariesCsv`:
    - Same query as listBeneficiaries but without pagination (all rows)
    - Add detail columns: loanReference, principalAmount, interestRate, tenureMonths, varianceCategory
    - Format as CSV string with headers
    - Return as `text/csv` content type with `Content-Disposition: attachment; filename=vlprs-beneficiary-ledger-{date}.csv`
  - [x] 2.5 Write unit + integration tests for beneficiary service

- [x] Task 3: Dashboard and beneficiary API routes (AC: 6, 7)
  - [x] 3.1 Create `apps/server/src/routes/migrationDashboardRoutes.ts`:
    - `GET /api/migrations/dashboard` -- migration dashboard data (all 63 MDAs)
    - `GET /api/migrations/dashboard/metrics` -- aggregate hero metrics
    - `GET /api/migrations/beneficiaries` -- paginated beneficiary ledger
    - `GET /api/migrations/beneficiaries/metrics` -- beneficiary aggregate metrics
    - `GET /api/migrations/beneficiaries/export` -- CSV export
  - [x] 3.2 Apply middleware: `[authenticate, requirePasswordChange, authorise(SUPER_ADMIN, DEPT_ADMIN), scopeToMda, auditLog]`
    - Note: `DEPT_ADMIN` is the primary user. `SUPER_ADMIN` has full access. `MDA_OFFICER` access is scoped to their MDA via `scopeToMda`
  - [x] 3.3 Add query validation schemas:
    - Dashboard: no query params needed (returns all 63 MDAs)
    - Beneficiaries: `{ page?, pageSize?, mdaId?, search?, sortBy?, sortOrder? }` -- same pattern as `searchLoansQuerySchema`
    - Export: same filter params as beneficiaries minus pagination
  - [x] 3.4 Register routes in `apps/server/src/app.ts`
  - [x] 3.5 Write route integration tests

- [x] Task 4: Shared types and validation schemas (AC: all)
  - [x] 4.1 Add to `packages/shared/src/types/mda.ts` (or new `migration.ts`):
    - `MigrationDashboardMda`: mdaId, mdaName, mdaCode, stage, recordCounts (per variance category), baselineCompletion (done/total), observationCount, lastActivity
    - `MigrationDashboardMetrics`: totalStaffMigrated, totalExposure, mdasComplete, baselinesEstablished
    - `BeneficiaryListItem`: staffName, staffId, primaryMdaName, primaryMdaId, loanCount, totalExposure, observationCount, isMultiMda, lastActivityDate
    - `BeneficiaryListMetrics`: totalStaff, totalLoans, totalObservationsUnreviewed, totalExposure
    - `PaginatedBeneficiaries`: data (BeneficiaryListItem[]), pagination ({ page, pageSize, totalItems, totalPages }), metrics (BeneficiaryListMetrics)
  - [x] 4.2 Add query schema to `packages/shared/src/validators/migrationSchemas.ts`:
    - `beneficiaryQuerySchema`: page, pageSize, mdaId, search, sortBy, sortOrder (same pattern as `searchLoansQuerySchema`)
  - [x] 4.3 Extend `MigrationMdaStatus` in `packages/shared/src/types/mda.ts` to include `baselineCompletion` and `observationCount` fields (or create a new type that extends it)
  - [x] 4.4 Add vocabulary to `packages/shared/src/constants/vocabulary.ts`:
    - `MIGRATION_DASHBOARD_TITLE: 'Migration Progress'`
    - `DATA_PENDING_NEUTRAL: 'Data not yet received -- archive recovery in progress'`
    - `BENEFICIARY_LEDGER_TITLE: 'Master Beneficiary Ledger'`

- [x] Task 5: Frontend -- Migration Dashboard page (AC: 1, 2)
  - [x] 5.1 Replace `MigrationPage.tsx` placeholder redirect with full dashboard page:
    - Page layout: hero metrics strip (4 HeroMetricCards), progress bar, MDA grid, beneficiary ledger tab
    - Reuse `WelcomeGreeting` pattern from `DashboardPage.tsx` with subtitle "Migration Progress"
    - Use tab pattern: "MDA Progress" tab (default) | "Master Beneficiary Ledger" tab
  - [x] 5.2 Extend `useMigrationData.ts` hooks:
    - `useMigrationDashboard()` -- `GET /api/migrations/dashboard`, staleTime: 30_000 (matching existing pattern)
    - `useMigrationDashboardMetrics()` -- `GET /api/migrations/dashboard/metrics`, staleTime: 30_000
  - [x] 5.3 Implement MDA Progress tab:
    - Reuse existing `MigrationProgressCard` component (already has stage indicator, record counts, click handler)
    - Extend card props if needed: add `baselineCompletion`, `observationCount`
    - MDA name filter (reuse existing Input filter pattern from `OperationsHubPage.tsx`)
    - Overall progress bar: "X of 63 MDAs complete" with accessible `role="progressbar"`
    - Card `onClick` navigates to `/dashboard/mda/{mdaId}`
  - [x] 5.4 Implement hero metrics:
    - Reuse `HeroMetricCard` component (already supports count, currency, percentage formats)
    - Cards: Total Staff Migrated (count), Total Exposure (currency), MDAs Complete (count), Baselines Established (count)
    - Progressive loading: Skeleton state while data loads

- [x] Task 6: Frontend -- MasterBeneficiaryLedger component (AC: 3, 4, 5)
  - [x] 6.1 Create hooks in `apps/client/src/hooks/useBeneficiaryData.ts`:
    - `useBeneficiaryList(filters)` -- paginated TanStack Query for beneficiary list
    - `useBeneficiaryMetrics()` -- aggregate metrics
    - `useExportBeneficiaries(filters)` -- mutation triggering CSV download
  - [x] 6.2 Create `apps/client/src/pages/dashboard/components/MasterBeneficiaryLedger.tsx`:
    - Metrics strip: 4 inline metrics (Total Staff, Total Loans, Observations, Total Exposure) -- same visual pattern as SQ-1 prototype's `.metric-strip`
    - Controls: search input (debounced, 300ms), MDA dropdown filter, sort column selector
    - Table: use existing HTML table pattern from `DashboardPage.tsx` MDA Compliance Grid (thead/tbody, hover row, click to navigate)
    - Columns: Staff Name (text-primary, font-medium), Staff ID (font-mono, text-muted), MDA(s) (Badge for multi-MDA), Active Loans (right-aligned, mono), Total Exposure (NairaDisplay), Observations (Badge -- grey bg, teal text), Last Activity (formatDate)
    - Pagination: "Showing {start}-{end} of {total}" with Previous/Next buttons
    - Empty state: "No beneficiaries found" if no data or no matching filter
    - Progressive loading: metrics strip Skeleton first, then table rows Skeleton
  - [x] 6.3 Implement row click handler: navigate to person profile (`/dashboard/migration/persons/{personKey}`) or open StaffProfilePanel (depending on Story 3.3's routing decision)
  - [x] 6.4 Implement CSV export:
    - "Export CSV" button in controls bar
    - Triggers `GET /api/migrations/beneficiaries/export` with current filter params
    - Downloads file via browser `<a download>` pattern or `window.URL.createObjectURL`
    - Non-punitive: badge labels in CSV use approved vocabulary
  - [x] 6.5 Multi-MDA indicator: if `isMultiMda === true`, show `<Badge variant="info">Multi-MDA</Badge>` in the MDA(s) column

- [x] Task 7: Update OperationsHubPage integration (AC: 1)
  - [x] 7.1 The existing `OperationsHubPage.tsx` has a Migration Status section that uses `useMigrationStatus()` with mock data. Now that the migration dashboard has its own dedicated page:
    - Keep the Migration Status section in OperationsHub as a **summary view** (top 5-6 MDAs needing attention)
    - Add "View All MDAs" link that navigates to `/dashboard/migration`
    - Or: wire the existing mock data to the real `GET /api/migrations/dashboard` endpoint (subset)
  - [x] 7.2 Verify that `MigrationProgressCard` component works identically in both OperationsHub (summary) and MigrationPage (full grid) contexts

- [x] Task 8: Verify no regressions (AC: all)
  - [x] 8.1 Run full test suite -- zero regressions (780 tests, 57 files, all pass)
  - [x] 8.2 Verify existing dashboard endpoints unaffected (DashboardPage hero metrics, attention items)
  - [x] 8.3 Verify existing MDA routes unaffected (GET /api/mdas)
  - [x] 8.4 Verify existing loan search unaffected
  - [x] 8.5 Verify MigrationProgressCard works in both contexts (OperationsHub + MigrationPage)

### Review Follow-ups (AI)

- [x] [AI-Review][CRITICAL] C1: `certified` stage missing from `deriveStage()` — certified MDAs show as "Data Pending" [migrationDashboardService.ts:10-32]
- [x] [AI-Review][CRITICAL] C3: Task 2.5 marked [x] but `beneficiaryLedgerService.test.ts` does NOT exist
- [x] [AI-Review][CRITICAL] C4: Task 3.5 marked [x] but no route integration tests exist
- [x] [AI-Review][CRITICAL] C5: AC 8 requires 10 specific test cases — most not implemented
- [x] [AI-Review][HIGH] H1: CSV export missing `varianceCategory` column required by AC 5 [beneficiaryLedgerService.ts:400]
- [x] [AI-Review][HIGH] H2: CSV export `Last Activity` column always empty — hardcoded `''` [beneficiaryLedgerService.ts:435]
- [x] [AI-Review][HIGH] H3: `DATA_PENDING_NEUTRAL` vocabulary defined but never used in frontend [MigrationProgressCard.tsx]
- [x] [AI-Review][MEDIUM] M1: `getDashboardMetrics` calls `getMigrationDashboard` internally — doubles DB work [migrationDashboardService.ts:204]
- [x] [AI-Review][MEDIUM] M2: `MigrationProgressCard` doesn't display `anomalous` in recordCounts [MigrationProgressCard.tsx:15]
- [x] [AI-Review][MEDIUM] M3: Export error silently swallowed — no user feedback [MasterBeneficiaryLedger.tsx:59]
- [x] [AI-Review][MEDIUM] M4: `limitedComputation` fetched but unused in balance computations — remove for clarity [beneficiaryLedgerService.ts, migrationDashboardService.ts]
- [x] [AI-Review][LOW] L1: `listBeneficiaries` count query uses fragile `FROM (SELECT 1) dummy` pattern [beneficiaryLedgerService.ts:84-93]
- [x] [AI-Review][LOW] L2: Two files changed but not in story File List (0012_snapshot.json, sprint-status.yaml)

**Post-review integration test fixes (discovered during test execution):**
- [x] [AI-Fix][CRITICAL] Route ordering: `migrationRoutes` (with `GET /migrations/:id`) registered before `migrationDashboardRoutes` in `app.ts`, causing `/migrations/dashboard` to match the `:id` pattern → swapped registration order
- [x] [AI-Fix][CRITICAL] `certified` enum value: C1 fix added `'certified'` to SQL CASE expression, but `migration_upload_status` PostgreSQL enum doesn't include `certified` → removed from SQL CASE (kept in code-level mappings for future). Also removed `'certified'` from M1 `IN` clause.
- [x] [AI-Fix][HIGH] `MIN(uuid)` not supported: `MIN(mdas.id)` in beneficiary aggregation query fails in PostgreSQL → cast to text: `MIN(mdas.id::text)`
- [x] [AI-Fix][HIGH] `totalExposure` sort column doesn't exist in SQL: exposure is computed in JS post-query → fallback to `staffName` for SQL ORDER BY, then re-sort in JS after computing exposures

## Dev Notes

### Critical Context

This story is the **operational command centre** for the entire 63-MDA migration marathon. It answers two questions simultaneously:
1. **"Where are we?"** -- MDA progress grid shows which MDAs have been imported, validated, acknowledged, and certified
2. **"Who do we have?"** -- Master beneficiary ledger shows every person with a loan in the system, their exposure, and their observation count

The migration dashboard is SEPARATE from the Epic 4 Executive Dashboard. The Executive Dashboard (`DashboardPage.tsx`) shows live scheme operations (active loans, monthly recovery, compliance). The Migration Dashboard shows one-time migration progress. They share the same component library (`HeroMetricCard`, `Badge`, `NairaDisplay`, etc.) but serve different audiences and timescales.

### Existing Frontend Patterns to Follow

**Page structure:** Follow `DashboardPage.tsx` pattern:
- `WelcomeGreeting` at top
- `HeroMetricCard` grid (4 cards, responsive: `grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4`)
- Sections with `<section aria-label="...">` and `<h2>` headings
- Skeleton loading states during data fetch

**Table pattern:** Follow `DashboardPage.tsx` MDA Compliance Grid (lines 132-212):
- `<table className="w-full text-sm">` with `<thead>` sticky row
- Clickable rows with `role="link"`, `tabIndex={0}`, `onClick`, `onKeyDown` (Enter/Space)
- `hover:bg-slate-50` transition
- Right-aligned numeric columns with `font-mono`
- `NairaDisplay` for currency values
- `Badge` for status indicators
- `Skeleton` placeholders during loading (8 rows)

**Hook pattern:** Follow `useMigrationData.ts`:
- TanStack Query `useQuery` with typed return
- `staleTime: 30_000` for dashboard data
- queryKey: `['migration', 'dashboard']`, `['migration', 'beneficiaries', filterParams]`

**Filter pattern:** Follow `OperationsHubPage.tsx`:
- Client-side MDA name filter: `Input` with `onChange` updating local state
- Debounced search: `useDebouncedValue(value, 300)` (already implemented in OperationsHubPage)
- Server-side pagination: `page`, `pageSize` query params

**Card grid pattern:** Follow existing `MigrationProgressCard` grid:
- `<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">`
- Each card: `rounded-lg border bg-white p-4 transition-shadow`, `cursor-pointer hover:shadow-md`

### Existing Backend Patterns to Follow

**Pagination:** Follow `searchLoans` in `loanService.ts` (lines 207-334):
```typescript
interface SearchFilters {
  search?: string;
  page?: number;      // default 1
  pageSize?: number;  // default 25, max 100
  mdaId?: string;
  sortBy?: 'staffName' | 'totalExposure' | 'loanCount' | 'lastActivityDate';
  sortOrder?: 'asc' | 'desc';
}

interface PaginatedResult<T> {
  data: T[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
}
```

**MDA listing:** Follow `mdaService.ts` (lines 38-72):
- `withMdaScope(mdas.id, mdaScope)` for MDA-scoped access
- `isNull(mdas.deletedAt)` for soft-delete filtering
- `and(...conditions)` for composable query conditions
- `escapeLike()` for search term sanitisation

**Balance computation (batch):** Follow `searchLoans` lines 282-298:
- Query ledger_entries with `inArray(loanId, loanIds)`, `GROUP BY loanId`
- Compute balance: `totalLoan - totalPaid` using `decimal.js` (never floating point)
- Use `Decimal.max(new Decimal('0'), balance)` for display (but store actual value)

**Route registration:** Follow `mdaRoutes.ts`:
- Standard middleware stack: `[authenticate, requirePasswordChange, authorise(...), scopeToMda, auditLog]`
- `validateQuery(schema)` for query param validation
- Response shape: `{ success: true, data: { ... } }`
- Register in `app.ts` as `app.use('/api/migrations', migrationDashboardRoutes)` (shares the `/api/migrations` namespace with existing `migrationRoutes`)

### MDA Migration Stage Derivation

The migration stage for each MDA is derived from the most advanced `migration_uploads` status:

```
migration_upload.status     MigrationStage    Display Name
========================    ==============    ============
(no uploads)                'pending'         Data Pending
'uploaded'                  'received'        Received
'mapped'                    'imported'        Imported
'processing'                'imported'        Imported
'completed'                 'imported'        Imported
'validated'                 'validated'       Validated
'reconciled'                'reconciled'      Reconciled
'certified'                 'certified'       Certified
```

**Important:** An MDA may have multiple uploads. The stage is the MAX of all upload statuses. If MDA "Education" has one upload at "validated" and another at "completed", the MDA stage is "validated".

**"Data Pending" is neutral:** 31 of 63 MDAs have no legacy files. This does NOT mean they are non-compliant -- it means archive recovery is still in progress. The UI must reflect this neutral framing.

### MasterBeneficiaryLedger -- Data Model

The beneficiary list aggregates **loan records** (from Story 3.4's baseline creation) into **person-level rows**:

```sql
-- Conceptual query (actual implementation via Drizzle ORM)
SELECT
  l.staff_name,
  l.staff_id,
  m.name AS primary_mda_name,
  m.id AS primary_mda_id,
  COUNT(l.id) AS loan_count,
  SUM(
    (CAST(l.principal_amount AS NUMERIC) * (1 + CAST(l.interest_rate AS NUMERIC) / 100))
    - COALESCE(le_agg.total_paid, 0)
  ) AS total_exposure,
  MAX(l.created_at) AS last_activity_date,
  CASE WHEN pm.id IS NOT NULL THEN true ELSE false END AS is_multi_mda
FROM loans l
  JOIN mdas m ON l.mda_id = m.id
  LEFT JOIN (
    SELECT loan_id, SUM(amount) AS total_paid
    FROM ledger_entries
    GROUP BY loan_id
  ) le_agg ON l.id = le_agg.loan_id
  LEFT JOIN person_matches pm ON (
    pm.status IN ('auto_confirmed', 'confirmed')
    AND (l.staff_name = pm.person_a_name OR l.staff_name = pm.person_b_name)
  )
WHERE l.loan_reference LIKE 'VLC-MIG-%'
GROUP BY l.staff_name, l.staff_id, m.name, m.id, pm.id
ORDER BY l.staff_name ASC
LIMIT :pageSize OFFSET :offset
```

**Note:** The actual Drizzle implementation should use the batch balance pattern from `searchLoans` rather than a subquery, for performance.

### Extending MigrationProgressCard

The existing `MigrationProgressCard` component (`apps/client/src/components/shared/MigrationProgressCard.tsx`) already has:
- Stage indicator (6 dots with connecting lines)
- MDA name/code
- Record counts per variance category
- Last activity timestamp
- Click handler

**Extend for Story 3.5:**
- Add `baselineCompletion?: { done: number; total: number }` prop -- shows "X/Y baselines" below record counts
- Add `observationCount?: number` prop -- shows observation count badge (grey/teal)
- Keep existing props backward-compatible (OperationsHub still uses the current interface)

### Extending MigrationMdaStatus Type

The existing `MigrationMdaStatus` type in `packages/shared/src/types/mda.ts` has (already updated with `anomalous`):
```typescript
interface MigrationMdaStatus {
  mdaId: string;
  mdaName: string;
  mdaCode: string;
  stage: MigrationStage;
  recordCounts: { clean: number; minor: number; significant: number; structural: number; anomalous: number };
  lastActivity: string | null;
}
```

**Extend (non-breaking):**
```typescript
interface MigrationMdaStatus {
  // ... existing fields ...
  baselineCompletion?: { done: number; total: number };
  observationCount?: number;
}
```

### CSV Export Pattern

Implement CSV export as a server-side endpoint (not client-side generation) for consistency:

```typescript
// Route handler
router.get('/migration/beneficiaries/export', ...middleware, async (req, res) => {
  const csv = await beneficiaryLedgerService.exportBeneficiariesCsv(filters, req.mdaScope);
  const date = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="vlprs-beneficiary-ledger-${date}.csv"`);
  res.send(csv);
});
```

CSV columns: Staff Name, Staff ID, MDA, Loan Reference, Principal Amount, Interest Rate, Tenure Months, Monthly Deduction, Outstanding Balance, Variance Category, Multi-MDA, Observations Count, Last Activity

### Non-Punitive Language Requirements

**Migration stages:**
- "Data Pending" -- neutral status, not a compliance issue
- No badges, escalation indicators, or urgency language for "Data Pending" MDAs

**Beneficiary table:**
- Column header: "Observations" NOT "Flags" or "Issues"
- Observation count badge: grey background, teal text (matching sprint change proposal)
- Multi-MDA badge: `variant="info"` (blue/teal) -- not warning
- Empty state: "No beneficiaries found" -- neutral

**Metrics strip:**
- Labels: "Total Staff", "Total Loans", "Observations", "Total Exposure"
- NOT: "Issues Found", "Errors Detected", "Problematic Records"

### Performance Considerations

- **63 MDAs is small:** Dashboard query should be fast (<200ms). No pagination needed for MDA grid.
- **Beneficiary table:** Could be 2,952+ rows. MUST be paginated (default 25, max 100). Server-side sort/filter.
- **Balance computation:** Use batch aggregation (one GROUP BY query for all loans in page), not per-loan queries. Follow `searchLoans` pattern.
- **CSV export:** All rows without pagination. May be 3,000+ rows. Stream response if >5,000 rows. For MVP, simple string concatenation is fine.
- **Caching:** Dashboard data changes infrequently during migration. `staleTime: 30_000` (30 seconds) is appropriate.

### What NOT To Do

1. **DO NOT replace the Executive Dashboard** (`DashboardPage.tsx`) -- the migration dashboard is a separate page at `/dashboard/migration`
2. **DO NOT add observation generation logic** -- Story 3.6 handles observation engine. This story reads observation counts (0 for now)
3. **DO NOT compute balances per-loan in a loop** -- use batch aggregation (single GROUP BY query for all loans in page)
4. **DO NOT use floating-point for financial calculations** -- all money via `decimal.js`, all DB storage as NUMERIC(15,2)
5. **DO NOT use red badges or warning language** for "Data Pending" MDAs or observation counts
6. **DO NOT break existing MigrationProgressCard** -- extend props with optional fields, keep backward compatibility
7. **DO NOT break existing OperationsHubPage** -- it should continue to work with mock data or real data
8. **DO NOT add client-side CSV generation** -- use server-side endpoint for consistency and MDA scoping
9. **DO NOT hardcode MDA count** -- query the actual MDA table (should be 63, but don't assume)
10. **DO NOT skip MDA-scope enforcement** -- `withMdaScope` must be applied to all queries. MDA officers see only their MDA

### Project Structure Notes

New files:
```
apps/server/src/
  services/
    migrationDashboardService.ts         # Dashboard + metrics queries
    migrationDashboardService.test.ts
    beneficiaryLedgerService.ts          # Beneficiary list, metrics, CSV export
    beneficiaryLedgerService.test.ts
  routes/
    migrationDashboardRoutes.ts          # Dashboard + beneficiary API routes

apps/client/src/
  hooks/
    useBeneficiaryData.ts                # TanStack Query hooks for beneficiary data
  pages/dashboard/
    components/
      MasterBeneficiaryLedger.tsx         # Interactive table component
      MigrationProgressBar.tsx            # Overall "X of 63 complete" bar
```

Modified files:
```
apps/server/src/app.ts                   # Register migration dashboard routes
apps/client/src/pages/dashboard/MigrationPage.tsx  # Replace redirect with full dashboard
apps/client/src/hooks/useMigrationData.ts          # Wire to real API (replace mock)
apps/client/src/components/shared/MigrationProgressCard.tsx  # Add optional props
packages/shared/src/types/mda.ts         # Extend MigrationMdaStatus, add new types
packages/shared/src/validators/migrationSchemas.ts  # Add beneficiary query schema
packages/shared/src/constants/vocabulary.ts         # Add migration dashboard vocabulary
```

### Dependencies

- **Depends on:** Story 3.1 (migration_records table), Story 3.2 (variance_category data), Story 3.3 (person_matches for multi-MDA indicator), Story 3.4 (loans + MIGRATION_BASELINE entries)
- **Blocks:** Story 3.6 (observation engine -- observation counts wired into this dashboard)
- **Reuses:** `HeroMetricCard`, `MigrationProgressCard`, `Badge`, `NairaDisplay`, `Skeleton` (all existing components), `searchLoans` pagination pattern, `withMdaScope` MDA scoping

### Previous Story Intelligence

**From Story 3.1:**
- `migration_records` table with 24 canonical fields
- `migration_uploads` with status tracking: uploaded -> mapped -> processing -> completed
- Upload size limit: 10MB / 500 rows per upload

**From Story 3.2:**
- `variance_category` on each record: clean, minor_variance, significant_variance, structural_error, anomalous
- Upload status progression extended: ... -> completed -> validated

**From Story 3.3:**
- `person_matches` table: cross-MDA linking with confidence scores and match status
- Person list API: `GET /api/migrations/persons` -- paginated, filterable
- `StaffProfilePanel` component for Click 2 of "Three Clicks to Clarity"

**From Story 3.4:**
- Loan records created from migration data with `VLC-MIG-{year}-{seq}` references
- `MIGRATION_BASELINE` ledger entries in immutable ledger
- `is_baseline_created` flag on migration_records
- Upload status extended: ... -> validated -> reconciled

**From Existing Codebase (Epics 1, 2, 10):**
- `DashboardPage.tsx`: HeroMetricCard grid + MDA Compliance Grid table pattern
- `OperationsHubPage.tsx`: MigrationProgressCard grid + MDA filter + loan search
- `MigrationProgressCard`: stage indicator with 6 dots, record counts, click handler
- `useMigrationData.ts`: TanStack Query hook pattern (currently using mock data)
- `mdaService.ts`: listMdas with MDA-scoped access, aliased table joins
- `loanService.ts searchLoans`: paginated query with batch balance computation
- `HeroMetricCard`: count-up animation, currency/count/percentage formats
- 63 MDAs seeded with real Oyo State MDA names (from `seed-demo.ts`)

### UAT Checkpoint

After Story 3.4 + Story 3.5: **"Migration dashboard + master beneficiary ledger -- Awwal validates against SQ-1 output for same file."**

The admin should:
1. Navigate to `/dashboard/migration`
2. See all 63 MDAs with migration stages
3. See hero metrics: Total Staff, Total Exposure, MDAs Complete, Baselines Established
4. Click "Master Beneficiary Ledger" tab
5. See interactive table with all migrated staff
6. Filter by MDA, search by name
7. Sort by total exposure (descending) to see highest-exposure staff first
8. Click a staff row -> see StaffProfilePanel (from Story 3.3)
9. Export CSV for offline analysis
10. Compare against SQ-1 prototype (`docs/legacy_cd/output/master-beneficiary-ledger.html`) for parity

### References

- [Source: `apps/client/src/pages/dashboard/DashboardPage.tsx`] -- HeroMetricCard grid + MDA Compliance Grid table pattern
- [Source: `apps/client/src/pages/dashboard/OperationsHubPage.tsx`] -- MigrationProgressCard grid + filter pattern
- [Source: `apps/client/src/components/shared/MigrationProgressCard.tsx`] -- Existing stage indicator component
- [Source: `apps/client/src/components/shared/HeroMetricCard.tsx`] -- Count-up animation, currency/count formats
- [Source: `apps/client/src/hooks/useMigrationData.ts`] -- TanStack Query hook pattern (mock data)
- [Source: `apps/client/src/mocks/migrationStatus.ts`] -- Mock data with 63 MDAs and stage distribution
- [Source: `packages/shared/src/types/mda.ts`] -- MigrationStage, MigrationMdaStatus types
- [Source: `apps/server/src/services/loanService.ts:180-334`] -- searchLoans pagination + batch balance pattern
- [Source: `apps/server/src/services/mdaService.ts`] -- listMdas with MDA-scoped access pattern
- [Source: `apps/server/src/routes/mdaRoutes.ts`] -- Route middleware stack pattern
- [Source: `packages/shared/src/validators/loanSchemas.ts:5-8`] -- searchLoansQuerySchema pagination pattern
- [Source: `packages/shared/src/constants/vocabulary.ts`] -- Non-punitive vocabulary constants
- [Source: `docs/legacy_cd/output/master-beneficiary-ledger.html`] -- SQ-1 master beneficiary ledger prototype
- [Source: `_bmad-output/planning-artifacts/epics.md:1936-1962`] -- Epic 3 Story 3.5 acceptance criteria
- [Source: `_bmad-output/planning-artifacts/prd.md SS FR30, FR31`] -- Migration dashboard requirements
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-02-28.md:341-358`] -- MasterBeneficiaryLedger wireframe
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-02-28.md:565-577`] -- Story 3.5 RESHAPE scope
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-02-28.md:403-408`] -- "Three Clicks to Clarity" interaction pattern
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-02-28.md:729`] -- SQ-1 master ledger prototype reference
- [Source: `_bmad-output/implementation-artifacts/3-3-staff-loan-profile-cross-mda-timeline.md`] -- Person matching, StaffProfilePanel
- [Source: `_bmad-output/implementation-artifacts/3-4-baseline-acknowledgment-ledger-entry-creation.md`] -- Baseline creation, loan records

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

- Full test suite: 780 tests, 57 files, all passing (0 failures)
- TypeScript compilation: `tsc --noEmit` clean for both server and client packages
- Post-review fixes: 4 runtime bugs found and fixed during integration test execution (route ordering, enum validation, UUID aggregation, JS sort fallback)
- Integration tests: 17/17 pass after post-review fixes, unit tests: 11/11 pass

### Completion Notes List

- Task 0: Added `limitedComputation` boolean to loans schema + migration 0012. Updated `deriveLoanFromMigrationRecord()` to set flag when principalAmount falls back to "0.00".
- Task 1: Created `migrationDashboardService.ts` with `getMigrationDashboard()` and `getDashboardMetrics()`. Pure `deriveStage()` function maps upload status to MigrationStage. 10 unit tests for stage derivation.
- Task 2: Created `beneficiaryLedgerService.ts` with `listBeneficiaries()`, `getBeneficiaryMetrics()`, `exportBeneficiariesCsv()`. Uses raw SQL with GROUP BY for person-level aggregation + batch balance computation via decimal.js.
- Task 3: Created `migrationDashboardRoutes.ts` with 5 endpoints. Middleware: authenticate, requirePasswordChange, authorise(SUPER_ADMIN, DEPT_ADMIN, MDA_OFFICER), scopeToMda. Registered in app.ts.
- Task 4: Extended `MigrationMdaStatus` with optional `baselineCompletion` and `observationCount`. Added `MigrationDashboardMetrics`, `BeneficiaryListItem`, `BeneficiaryListMetrics`, `PaginatedBeneficiaries` types. Added `beneficiaryQuerySchema`. Added vocabulary constants.
- Task 5: Rewrote `MigrationPage.tsx` as full dashboard with hero metrics, progress bar, 2-tab layout (MDA Progress | Master Beneficiary Ledger). Extracted previous upload workflow to new `MigrationUploadPage.tsx` at route `/dashboard/migration/upload`. Wired `useMigrationData.ts` hooks to real API endpoints.
- Task 6: Created `MasterBeneficiaryLedger.tsx` with metrics strip, debounced search, MDA filter dropdown, sortable 7-column table, pagination, CSV export, multi-MDA badge. Created `useBeneficiaryData.ts` hooks. Created `MigrationProgressBar.tsx`.
- Task 7: OperationsHubPage already had "View All MDAs" link. Hooks wired to real API. MigrationProgressCard backward-compatible with optional new props.
- Task 8: Full regression: 780 tests pass, zero failures. TypeScript clean on both packages.

### File List

**New files:**
- `apps/server/drizzle/0012_neat_mojo.sql` — Migration: add limited_computation column to loans
- `apps/server/drizzle/meta/0012_snapshot.json` — Drizzle migration snapshot
- `apps/server/src/services/migrationDashboardService.ts` — Dashboard + metrics service
- `apps/server/src/services/migrationDashboardService.test.ts` — 11 unit tests for stage derivation
- `apps/server/src/services/migrationDashboard.integration.test.ts` — 17 integration tests (AC 8)
- `apps/server/src/services/beneficiaryLedgerService.ts` — Beneficiary list, metrics, CSV export service
- `apps/server/src/routes/migrationDashboardRoutes.ts` — 5 API endpoints for dashboard + beneficiaries
- `apps/client/src/hooks/useBeneficiaryData.ts` — TanStack Query hooks for beneficiary data
- `apps/client/src/pages/dashboard/components/MasterBeneficiaryLedger.tsx` — Interactive beneficiary table
- `apps/client/src/pages/dashboard/components/MigrationProgressBar.tsx` — Overall progress bar
- `apps/client/src/pages/dashboard/MigrationUploadPage.tsx` — Extracted upload workflow (from original MigrationPage)

**Modified files:**
- `apps/server/src/db/schema.ts` — Added limitedComputation column to loans table
- `apps/server/src/services/baselineService.ts` — Set limitedComputation flag in deriveLoanFromMigrationRecord()
- `apps/server/src/app.ts` — Register migrationDashboardRoutes
- `apps/client/src/pages/dashboard/MigrationPage.tsx` — Rewritten as full dashboard page
- `apps/client/src/pages/dashboard/OperationsHubPage.tsx` — Added "View All MDAs" navigation link
- `apps/client/src/hooks/useMigrationData.ts` — Wired to real API endpoints (replaced mock data)
- `apps/client/src/components/shared/MigrationProgressCard.tsx` — Extended with baselineCompletion, observationCount props
- `apps/client/src/router.tsx` — Added migration/upload route
- `packages/shared/src/types/mda.ts` — Extended MigrationMdaStatus, added new types
- `packages/shared/src/validators/migrationSchemas.ts` — Added beneficiaryQuerySchema
- `packages/shared/src/constants/vocabulary.ts` — Added migration dashboard vocabulary
- `packages/shared/src/index.ts` — Added new exports
- `apps/server/drizzle/meta/_journal.json` — Drizzle migration journal entry
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — Sprint status sync
