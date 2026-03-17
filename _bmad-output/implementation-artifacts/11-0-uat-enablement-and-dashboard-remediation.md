# Story 11.0: UAT Enablement & Dashboard Remediation

Status: ready-for-dev

<!-- Remediation story — addresses gaps from Epics 4 and 5 to enable end-to-end UAT before completing Epic 11. -->

## Story

As a **Department Admin / AG (SUPER_ADMIN)**,
I want the executive dashboard drill-downs to show metric-specific data, the scheme fund total to be configurable, and historical submission periods to be uploadable,
So that I can perform end-to-end UAT across all role views and validate the system before it goes live.

## Acceptance Criteria

1. **Given** the AG clicks on different dashboard metric cards (Active Loans, Total Exposure, Outstanding Receivables, etc.), **When** the drill-down page loads, **Then** each page shows data filtered to that specific metric — not the same unfiltered list for every card.

2. **Given** the AG views the "Fund Available" hero card showing "Awaiting Configuration", **When** they click the card, **Then** a dialog opens allowing them to input the total scheme fund amount (Naira). **And** on save, the dashboard immediately reflects "Fund Available = Total Fund − Total Disbursed". **And** only SUPER_ADMIN can set/edit this value.

3. **Given** a DEPT_ADMIN or SUPER_ADMIN uploads a CSV with a historical period (e.g., `2020-03`), **When** the submission is processed, **Then** the period lock is bypassed and the submission is accepted. **And** MDA_OFFICER uploads are still restricted to current + previous month only.

4. **Given** the seed/demo database, **When** the system loads, **Then** there is a scheme fund config entry, and sufficient loan + ledger data across MDAs to produce meaningful drill-down results for at least 3 different metrics.

## Tasks / Subtasks

### Task 1: Drill-Down Endpoint Metric Filtering (AC: #1)

- [ ] 1.1 Modify `GET /api/dashboard/breakdown` in `apps/server/src/routes/dashboardRoutes.ts` to pass the `metric` parameter to the service layer instead of only using it for sorting.
- [ ] 1.2 Update `getEnrichedMdaBreakdown()` in `apps/server/src/services/mdaAggregationService.ts` to accept a `metric` parameter and filter the response:
  - `activeLoans`: only MDAs with active loan count > 0, sorted by count descending
  - `totalExposure`: only MDAs with exposure > 0, sorted by exposure descending
  - `fundAvailable`: all MDAs with disbursed amounts, sorted by disbursed descending
  - `monthlyRecovery`: all MDAs, sorted by variance percent (worst recovery first)
  - `loansInWindow`: only MDAs with loans in completion window, sorted by count descending
  - `outstandingReceivables`: only MDAs with outstanding > 0, sorted by amount descending
  - `collectionPotential`: all MDAs with active loans, sorted by potential descending
  - `atRisk`: only MDAs with overdue/stalled loans, sorted by at-risk amount descending
  - `completionRate` / `completionRateLifetime`: all MDAs, sorted by completion rate ascending (worst first)
- [ ] 1.3 Update drill-down tests in `apps/server/src/routes/dashboardRoutes.test.ts` to verify different metrics return different filtered/sorted results.
- [ ] 1.4 Verify frontend `MetricDrillDownPage.tsx` correctly displays the filtered data (no frontend changes expected — it already passes the metric parameter).

### Task 2: Scheme Fund Editable Input for AG (AC: #2)

- [ ] 2.1 Add `PUT /api/dashboard/scheme-fund` route in `apps/server/src/routes/dashboardRoutes.ts`:
  - Auth: `authenticate → authorise(SUPER_ADMIN) → auditLog`
  - Body: `{ amount: string }` (Naira amount, validated as positive number)
  - Calls existing `schemeConfigService.setSchemeConfig('scheme_fund_total', amount, userId)`
  - Returns `{ success: true, fundTotal: amount }`
- [ ] 2.2 Add Zod schema for the request body in `packages/shared/src/validators/dashboardSchemas.ts`.
- [ ] 2.3 Create `SchemeFundDialog` component in `apps/client/src/pages/dashboard/components/`:
  - Modal/dialog with Naira input field (NairaDisplay formatting)
  - "Save" button calls `PUT /api/dashboard/scheme-fund`
  - On success: invalidate `['dashboard', 'metrics']` query, close dialog, show success toast
  - On error: inline error message
  - Only rendered for SUPER_ADMIN role
- [ ] 2.4 Wire the "Awaiting Configuration" card in `DashboardPage.tsx` to open `SchemeFundDialog` on click.
  - When configured: card shows value and clicking navigates to drill-down (existing behaviour)
  - When unconfigured: card opens SchemeFundDialog instead of navigating
- [ ] 2.5 Add tests for the new route and component.

### Task 3: DEPT_ADMIN Historical Period Bypass (AC: #3)

- [ ] 3.1 Modify `checkPeriodLock()` in `apps/server/src/services/submissionService.ts` to accept a `role` parameter:
  - If role is `dept_admin` or `super_admin`: return `null` (bypass lock)
  - If role is `mda_officer`: enforce current + previous month only (existing behaviour)
- [ ] 3.2 Update `processSubmissionRows()` call chain to pass the user role:
  - `processSubmission()` and the manual submission route need to pass `req.user.role` through to `checkPeriodLock()`
  - Update function signatures: `processSubmissionRows(..., role: string)`
- [ ] 3.3 Update `apps/server/src/routes/submissionRoutes.ts` to pass `req.user.role` to the processing pipeline.
- [ ] 3.4 Add tests:
  - DEPT_ADMIN can submit for historical period (e.g., `2020-03`)
  - MDA_OFFICER is still rejected for historical periods
  - SUPER_ADMIN can submit for historical period
  - Current + previous month still works for all roles

### Task 4: Seed Data Alignment (AC: #4)

- [ ] 4.1 Add `scheme_fund_total` entry to `apps/server/src/db/seed-demo.ts` (e.g., ₦500,000,000) so the AG dashboard shows "Fund Available" instead of "Awaiting Configuration".
- [ ] 4.2 Review existing seed loans and ledger entries — ensure at least 3 MDAs have active loans with ledger entries so drill-down filtering produces visibly different results per metric.
- [ ] 4.3 Add seed ledger entries for monthly deductions (if missing) so the comparison engine produces meaningful aligned/variance results when historical submissions are uploaded.
- [ ] 4.4 Verify the seed data produces non-zero values for all 4 hero metrics and at least 3 portfolio analytics cards after the fixes are applied.

### Task 5: Migration Upload Discoverability (Navigation Fix)

- [ ] 5.1 Add a prominent "Upload Legacy Data" button/link on the Migration Dashboard page (`apps/client/src/pages/dashboard/MigrationPage.tsx`):
  - Position: top of page near the hero metrics, or as a primary action button
  - Navigates to `/dashboard/migration/upload` (the existing MigrationUploadPage)
  - Only visible to DEPT_ADMIN (the upload page already enforces this server-side)
- [ ] 5.2 Verify the end-to-end flow: Migration Dashboard → Upload → column mapping → validation → baseline creation → back to Migration Dashboard with updated MDA progress cards.

## Dev Notes

### Context

This is a **remediation story** surfaced during UAT preparation. It addresses:
- **Epic 4.3 bug**: Drill-down endpoint returns unfiltered data for all metrics (only sorting differs)
- **Epic 4 gap**: Scheme Fund configuration has a service (`setSchemeConfig`) but no API route or UI to invoke it
- **Epic 5/11 enablement**: Period lock prevents historical data upload, blocking UAT with real data
- **Seed data gap**: Limited demo data produces sparse/identical drill-down results

### Architecture Notes

**Drill-down filtering approach:**
- The `getEnrichedMdaBreakdown()` already returns `statusDistribution` per MDA (counts of ACTIVE, COMPLETED, OVERDUE, etc.). Use this to filter:
  - `activeLoans` → filter where `statusDistribution.ACTIVE > 0`
  - `atRisk` → filter where `statusDistribution.OVERDUE + statusDistribution.STALLED > 0`
  - `completionRate` → filter where `statusDistribution.COMPLETED > 0 || statusDistribution.ACTIVE > 0`
- This avoids additional DB queries — filtering is done on the existing result set.

**Period lock bypass:**
- Minimal change: add `role` parameter to `checkPeriodLock(period, role?)`. Default behaviour unchanged for MDA_OFFICER.
- Story 11.4 (MDA Historical Data Upload) will build on this with additional validation (cross-validation against migration baseline, duplicate period checks). This story only unlocks the period — 11.4 adds the guardrails.

**Scheme Fund dialog:**
- Use existing shadcn Dialog component. Simple form: one Naira input + Save/Cancel.
- `schemeConfig` table already has `updatedBy` FK → audit trail is automatic.

### Existing Infrastructure to Reuse

| Component | Location | Status |
|-----------|----------|--------|
| `setSchemeConfig()` | `apps/server/src/services/schemeConfigService.ts` | Exists, untested in routes |
| `schemeConfig` table | `apps/server/src/db/schema.ts:586-599` | Exists with updatedBy FK |
| `Dialog` component | `apps/client/src/components/ui/dialog.tsx` | Exists (shadcn) |
| `NairaDisplay` | `apps/client/src/components/shared/NairaDisplay.tsx` | Exists |
| `HeroMetricCard` | `apps/client/src/pages/dashboard/components/HeroMetricCard.tsx` | Exists with onClick |
| `breakdownQuerySchema` | `packages/shared/src/validators/dashboardSchemas.ts` | Exists with 10 metric enum |
| `getEnrichedMdaBreakdown()` | `apps/server/src/services/mdaAggregationService.ts` | Exists, needs metric param |
| `checkPeriodLock()` | `apps/server/src/services/submissionService.ts:320-345` | Exists, needs role param |
| `MigrationPage` | `apps/client/src/pages/dashboard/MigrationPage.tsx` | Exists, needs upload button |
| `MigrationUploadPage` | `apps/client/src/pages/dashboard/MigrationUploadPage.tsx` | Exists, fully functional, not linked from dashboard |
| `MigrationProgressCard` | `apps/client/src/components/shared/MigrationProgressCard.tsx` | Exists, shows per-MDA stage + counts |

### References

- [Source: apps/server/src/routes/dashboardRoutes.ts — drill-down endpoint lines 233-267]
- [Source: apps/server/src/services/mdaAggregationService.ts — getEnrichedMdaBreakdown lines 223-282]
- [Source: apps/server/src/services/schemeConfigService.ts — setSchemeConfig exists but no route]
- [Source: apps/server/src/services/submissionService.ts — checkPeriodLock lines 320-345]
- [Source: apps/client/src/pages/dashboard/DashboardPage.tsx — Fund Available card lines 94-130]
- [Source: apps/server/src/db/seed-demo.ts — current seed data]
- [Source: apps/client/src/pages/dashboard/MigrationPage.tsx — Migration Dashboard with MDA progress, beneficiary ledger, observations, duplicates tabs]
- [Source: apps/client/src/pages/dashboard/MigrationUploadPage.tsx — fully functional upload page, not linked from dashboard]
- [Source: apps/server/src/routes/migrationDashboardRoutes.ts — GET /api/migrations/dashboard + /dashboard/metrics]
