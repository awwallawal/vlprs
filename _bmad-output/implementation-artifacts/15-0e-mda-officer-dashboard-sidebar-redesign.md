# Story 15.0e: MDA Officer Dashboard & Sidebar Redesign

Status: done

## Story

As an **MDA Officer**,
I want a purpose-built dashboard showing my MDA's hero metrics (active loans, monthly recovery, outstanding receivables, completion rate), migration quality score, flagged records requiring my review, pre-submission checkpoint, gap-aware submission history, and quick action buttons,
So that I can see everything relevant to my MDA at a glance and take action without hunting through menus.

**Origin:** UAT Findings #20, #25, #29 (High) from E8 retro. Current MDA officer has 5 sparse sidebar items, no dashboard, no migration quality visibility.

**Priority:** HIGH — MDA officer role is fundamentally under-served. This story transforms the MDA officer from a passive participant into a first-class user.

## Acceptance Criteria

1. **Given** an MDA Officer logs in, **When** the dashboard loads, **Then** they see a purpose-built MDA dashboard (not the admin executive dashboard) with hero metrics scoped to their assigned MDA: Active Loans count, Monthly Recovery amount, Total Exposure, and Completion Rate (loans completed / total loans).

2. **Given** an MDA Officer's dashboard, **When** migration data exists for their MDA, **Then** a Migration Quality section shows the variance breakdown (Clean, Minor, Significant, Structural, Anomalous counts) with a quality score percentage (Clean+Minor / Total).

3. **Given** the MDA officer has flagged records pending review (from Story 8.0j selective baseline pipeline), **When** the dashboard loads, **Then** a "Records Awaiting Your Review" section shows count, countdown to review deadline, and a direct link to the review workflow.

4. **Given** the MDA officer's dashboard, **When** a pre-submission checkpoint exists for their MDA, **Then** a "Pre-Submission Status" section shows the checkpoint result with clear pass/attention indicators.

5. **Given** the MDA officer's dashboard, **When** submission history exists, **Then** the last 5 submissions are shown with period, status, and record count. If no submissions exist, an empty state message explains when data will appear.

6. **Given** the MDA officer sidebar, **When** the sidebar renders, **Then** it shows exactly 6 items: **My Dashboard**, **Upload Data** (monthly submission + embedded pre-submission checkpoint), **My Reviews** (flagged records), **Employment Events**, **Reconciliation**, **My Reports**. (Original 7-item design reduced to 6 — "Submit Monthly" merged into "Upload Data" because no standalone `/dashboard/pre-submission` route exists; "History" removed as duplicate; "Historical Upload" removed per UAT #27.)

7. **Given** the MDA officer's dashboard, **When** any hero metric card is clicked, **Then** it navigates to the relevant detail view (e.g., Active Loans → loan list for their MDA).

8. **Given** any empty section on the MDA officer dashboard, **When** no data is available, **Then** a contextual empty state message is shown (Team Agreement #13).

## Current State Analysis

### Current MDA Officer Experience (5 Sidebar Items)

| # | Item | Path | Issue |
|---|------|------|-------|
| 1 | Submit | `/dashboard/submissions` | Home page — also the redirect target |
| 2 | History | `/dashboard/submissions` | Same path as Submit (duplicate!) |
| 3 | Historical Upload | `/dashboard/historical-upload` | CSV-only, purpose mismatch (UAT #27) |
| 4 | Employment Events | `/dashboard/employment-events` | Works but isolated |
| 5 | Reconciliation | `/dashboard/reconciliation/three-way` | Works |

**Missing:** Dashboard, Migration quality view, Reports, Reviews (flagged records).

### Target Sidebar (6 Items)

**Note:** Original design had 7 items including "Submit Monthly → `/dashboard/pre-submission`". PM validation found this route doesn't exist — `PreSubmissionCheckpoint` is an embedded component inside `SubmissionsPage.tsx`, not a standalone page. Merged into "Upload Data" which already contains the pre-submission checkpoint.

| # | Item | Path | Icon | Purpose |
|---|------|------|------|---------|
| 1 | My Dashboard | `/dashboard` | LayoutDashboard | Hero metrics, quality score, reviews, checkpoint |
| 2 | Upload Data | `/dashboard/submissions` | Upload | Monthly CSV upload + embedded pre-submission checkpoint |
| 3 | My Reviews | `/dashboard/migration` | ClipboardCheck | Flagged records review (8.0j flow) |
| 4 | Employment Events | `/dashboard/employment-events` | UserCog | Event filing |
| 5 | Reconciliation | `/dashboard/reconciliation/three-way` | ArrowRightLeft | Three-way view |
| 6 | My Reports | `/dashboard/reports` | FileText | MDA-scoped reports |

**Removed:** "History" (duplicate of Submit), "Historical Upload" (UAT #27 purpose mismatch)

## Tasks / Subtasks

- [x] Task 1: Update sidebar navigation for MDA Officer role (AC: 6)
  - [x] 1.1: In `apps/client/src/components/layout/navItems.ts`, restructure the `NAV_ITEMS` array:
    - Add `ROLES.MDA_OFFICER` to `Dashboard` item's roles array (line 26)
    - Remove the duplicate `History` item (line 29 — currently same path as Submit)
    - **Remove `ROLES.MDA_OFFICER` from `Historical Upload` item's roles array** (line 30 — UAT Finding #27, purpose mismatch). This leaves it as `[ROLES.DEPT_ADMIN]` only.
    - Add `ROLES.MDA_OFFICER` to `Reports` item's roles array (line 35)
    - Rename items for MDA officer context by adding role-specific label overrides OR create separate MDA officer nav items with appropriate labels ("My Dashboard", "My Reviews", "My Reports")
    - Add a new "My Reviews" item pointing to `/dashboard/migration` with `ROLES.MDA_OFFICER` (making migration page accessible to MDA officers for review)
    - **Note on "Submit Monthly":** No `/dashboard/pre-submission` route exists. `PreSubmissionCheckpoint` is an embedded component within `SubmissionsPage.tsx` (at `pages/dashboard/components/PreSubmissionCheckpoint.tsx`), not a standalone page. Do NOT add a sidebar item pointing to a nonexistent route. Instead, point "Upload Data" to `/dashboard/submissions` which already contains both the upload flow and the embedded pre-submission checkpoint. The target sidebar is **6 items** (My Dashboard, Upload Data, My Reviews, Employment Events, Reconciliation, My Reports) unless a separate pre-submission page is created in a future story.
  - [x] 1.2: Update `ROLE_HOME_ROUTES` to set MDA officer home to `/dashboard` instead of `/dashboard/submissions`:
    ```typescript
    [ROLES.MDA_OFFICER]: '/dashboard',
    ```
  - [x] 1.3: May need to import new icon(s) from lucide-react (e.g., `ClipboardCheck` for My Reviews). Check available imports.

- [x] Task 2: Create MDA Officer Dashboard component (AC: 1, 7, 8)
  - [x] 2.1: Create `apps/client/src/pages/dashboard/MdaOfficerDashboard.tsx` — a new component rendered when `user.role === 'mda_officer'` visits `/dashboard`.
  - [x] 2.2: Implement hero metrics section using `useDashboardMetrics()` (NOT `useMdaDetail`):
    **IMPORTANT:** The existing `useDashboardMetrics()` hook calls `GET /api/dashboard/metrics` which applies `scopeToMda` middleware (`dashboardRoutes.ts:34,45-46`). For MDA officers, the backend automatically scopes ALL metrics to their assigned MDA via `req.mdaScope`. This means the same hero metric data used by the admin dashboard is already MDA-scoped — no need for a separate `useMdaDetail` call.
    - **Active Loans** — from `metrics.data?.activeLoans` (clickable → `/dashboard/loans?filter=active&mda=${userMdaId}`)
    - **Monthly Recovery** — from `metrics.data?.monthlyRecovery` (use `NairaDisplay` hero variant)
    - **Total Exposure** — from `metrics.data?.totalExposure` (use `NairaDisplay` hero variant)
    - **Completion Rate** — from `metrics.data?.completionRate` (already computed by backend)
    - Reuse `HeroMetricCard` component from `apps/client/src/components/shared/HeroMetricCard.tsx`
    - Follow the same `HeroMetricCard` pattern used in `DashboardPage.tsx:148-237` — the cards, formats, and onClick handlers are the same, just with MDA-scoped click targets
  - [x] 2.3: Add `WelcomeGreeting` component at top of page with MDA name subtitle (use `subtitle` prop: `WelcomeGreeting subtitle={mdaName}`)
  - [x] 2.4: Add `StatusDistributionBar` below hero cards — use `useMdaDetail(userMdaId)` here for `statusDistribution` data (this is the one place `useMdaDetail` IS needed, since `useDashboardMetrics` doesn't return status distribution)
  - [x] 2.5: Make each hero metric card clickable (AC: 7) — navigate to filtered loan list or MDA detail. `HeroMetricCard` already supports `onClick` prop with keyboard accessibility (Enter/Space) and "Click to view breakdown" ARIA label.

- [x] Task 3: Add Migration Quality section (AC: 2)
  - [x] 3.1: Use `useMigrationStatus()` hook — **no client-side filtering needed.** The backend endpoint `GET /api/migrations/dashboard` applies `scopeToMda` middleware (`migrationDashboardRoutes.ts:18`). For MDA officers, this returns a **single-element array** containing only their MDA's data. Confirmed by integration test at `migrationDashboard.integration.test.ts:566-575` ("MDA officer dashboard is scoped to their MDA", `data.length === 1`). Access via `data?.[0]`.
  - [x] 3.2: Display variance breakdown from `recordCounts`: Clean, Minor, Significant, Structural, Anomalous
  - [x] 3.3: Compute quality score: `((clean + minor) / total * 100).toFixed(1)%`
  - [x] 3.4: Consider reusing `MigrationProgressCard` component (`apps/client/src/components/shared/MigrationProgressCard.tsx`) which already displays this data for admin views
  - [x] 3.5: Add `MetricHelp` tooltip explaining what each variance category means

- [x] Task 4: Add Records Awaiting Review section (AC: 3)
  - [x] 4.1: Use existing `MdaReviewSection` component from `apps/client/src/pages/dashboard/components/MdaReviewSection.tsx` — it's already shown to MDA officers on the current dashboard page
  - [x] 4.2: Integrate into the new MDA officer dashboard layout
  - [x] 4.3: Ensure the "Navigate to Review" button links to `/dashboard/migration` (which MDA officer now has sidebar access to)

- [x] Task 5: Add Pre-Submission Checkpoint section (AC: 4)
  - [x] 5.1: Use `usePreSubmissionCheckpoint(user.mdaId)` hook (verified: accepts `mdaId: string | undefined`, at `hooks/usePreSubmissionCheckpoint.ts:1-16`)
  - [x] 5.2: Display pass/attention status with clear visual indicators (green check / amber warning)
  - [x] 5.3: Link to submissions page (`/dashboard/submissions`) where the full `PreSubmissionCheckpoint` component is embedded — no standalone pre-submission route exists

- [x] Task 6: Add Recent Submissions section (AC: 5, 8)
  - [x] 6.1: Use `useSubmissionHistory(user.mdaId, 1, 5)` to fetch last 5 submissions
  - [x] 6.2: Display as compact table: Period, Status (badge), Record Count, Date
  - [x] 6.3: Add empty state: "No monthly submissions yet. Upload your first submission via the Upload Data menu." (Team Agreement #13)
  - [x] 6.4: "View All" link to submission history page

- [x] Task 7: Integrate MDA officer dashboard into routing (AC: 1)
  - [x] 7.1: In `apps/client/src/pages/dashboard/DashboardPage.tsx`, add early return role check near the top of the component (after hooks):
    ```typescript
    if (user?.role === ROLES.MDA_OFFICER) {
      return <MdaOfficerDashboard />;
    }
    ```
    This is the simplest approach — the route `/dashboard` already exists, and the early return means no admin dashboard code is reached for MDA officers.
  - [x] 7.2: The early return in 7.1 makes the old MDA officer `MdaReviewSection` block (lines 340-343) unreachable for MDA officers — it can be safely removed as cleanup. It was the only MDA-officer-specific section in `DashboardPage`:
    ```typescript
    {/* MDA Review Section — visible to MDA_OFFICER only (Story 8.0j) */}
    {user?.role === ROLES.MDA_OFFICER && (
      <MdaReviewSection onNavigateToReview={() => navigate('/dashboard/migration')} />
    )}
    ```
    `MdaReviewSection` is now used inside `MdaOfficerDashboard.tsx` (Task 4) instead.
  - [x] 7.3: Import the new `MdaOfficerDashboard` component

- [x] Task 8: Add empty states for all sections (AC: 8)
  - [x] 8.1: Migration Quality: "No migration data available for your MDA yet."
  - [x] 8.2: Records Awaiting Review: "No records flagged for your review."
  - [x] 8.3: Pre-Submission: "Pre-submission checkpoint will appear when your submission window opens."
  - [x] 8.4: Submissions: "No monthly submissions yet. Upload your first submission via the Upload Data menu."

- [x] Task 9: Grant MDA officer access to Migration and Reports pages (AC: 6)
  - [x] 9.1: Verify that `/dashboard/migration` page works for MDA officer role — it should scope data by `user.mdaId`. If it doesn't, add MDA scope filtering.
  - [x] 9.2: Verify that `/dashboard/reports` page works for MDA officer role — reports should scope by MDA. Check if report endpoints support MDA scoping (the `mdaId` query param).
  - [x] 9.3: If either page breaks for MDA officer role (missing data, wrong scope), create follow-up tasks.

- [x] Task 10: Tests (AC: all)
  - [x] 10.1: Create test for `MdaOfficerDashboard` component — verify it renders hero metrics, quality section, and empty states
  - [x] 10.2: Verify sidebar renders correct items for MDA officer role
  - [x] 10.3: Run full client test suite: `pnpm test` in `apps/client`

### Review Follow-ups (AI)
- [x] [AI-Review][HIGH] H1: Extract AdminDashboard component to prevent admin hooks firing for MDA officers [DashboardPage.tsx:47-121]
- [x] [AI-Review][MEDIUM] M1: Type STATUS_LABEL keys with shared SubmissionRecordStatus type [MdaOfficerDashboard.tsx:19]
- [x] [AI-Review][MEDIUM] M2: Add hook parameter assertions to tests — verify mdaId, page, pageSize passed correctly [MdaOfficerDashboard.test.tsx]
- [x] [AI-Review][MEDIUM] M3: AC5 "Period" column — SubmissionRecord type was missing period field (backend already returned it). Added period to shared type, updated table column from Reference→Period with formatted display [submission.ts, MdaOfficerDashboard.tsx, submissionHistory.ts mock]
- [x] [AI-Review][MEDIUM] M4: Extract IIFE quality score computation to pre-JSX variables [MdaOfficerDashboard.tsx:38-44]
- [x] [AI-Review][LOW] L1: Standardize userMdaId with consistent `|| undefined` pattern [MdaOfficerDashboard.tsx:28]
- [x] [AI-Review][LOW] L2: Admin Migration sidebar icon changed from Database→ClipboardCheck (undocumented side-effect, now documented)
- [x] [AI-Review][LOW] L3: Guard empty userMdaId in Active Loans navigation URL [MdaOfficerDashboard.tsx:53]

## Dev Notes

### All Data Already MDA-Scoped — No Backend Changes

**Critical discovery during PM validation:** The server-side `scopeToMda` middleware automatically scopes data for MDA officers. This means hooks that appear "global" actually return MDA-scoped data when called by an MDA officer. No client-side filtering is needed for any of these:

| Data | Hook | MDA-Scoped How? |
|------|------|:---------------:|
| Dashboard hero metrics (loans, exposure, recovery) | `useDashboardMetrics()` | `scopeToMda` on `dashboardRoutes.ts:34,45` — same hook admin uses, but returns MDA-scoped data |
| MDA summary (status distribution, health) | `useMdaDetail(mdaId)` | Explicit `mdaId` param |
| Loan list | `useMdaLoans(mdaId)` | Explicit `mdaId` param |
| Submission history | `useSubmissionHistory(mdaId)` | Explicit `mdaId` param |
| Pre-submission checkpoint | `usePreSubmissionCheckpoint(mdaId)` | Explicit `mdaId` param |
| Migration quality (variance breakdown) | `useMigrationStatus()` | `scopeToMda` on `migrationDashboardRoutes.ts:18` — returns single-element array for MDA officer (confirmed by integration test line 566-575) |
| Flagged records for review | `useFlaggedRecords(uploadId)` | MDA-scoped via auth middleware |
| Coverage tracker | `useMigrationCoverage()` | Has MDA breakdown |

**Use `useDashboardMetrics()` for hero metrics, NOT `useMdaDetail()`.** The dashboard metrics hook already returns active loans, exposure, recovery, completion rate — all MDA-scoped. Use `useMdaDetail()` only for `statusDistribution` data (needed for `StatusDistributionBar`).

### Reusable Components

| Component | File | Used For |
|-----------|------|----------|
| `HeroMetricCard` | `components/shared/HeroMetricCard.tsx` | Hero metrics with trend |
| `NairaDisplay` | `components/shared/NairaDisplay.tsx` | Currency formatting |
| `HealthScoreBadge` | `components/shared/HealthScoreBadge.tsx` | Health score display |
| `StatusDistributionBar` | `components/shared/StatusDistributionBar.tsx` | Loan status breakdown |
| `MigrationProgressCard` | `components/shared/MigrationProgressCard.tsx` | Variance breakdown display |
| `MetricHelp` | `components/shared/MetricHelp.tsx` | Tooltip explanations |
| `WelcomeGreeting` | `components/shared/WelcomeGreeting.tsx` | Page greeting |
| `MdaReviewSection` | `pages/dashboard/components/MdaReviewSection.tsx` | Flagged records panel |
| `Badge` | `components/ui/badge.tsx` | Status badges |

### Accessing Current User's MDA

```typescript
import { useAuthStore } from '@/stores/authStore';

const user = useAuthStore((s) => s.user);
const userMdaId = user?.mdaId;  // string | null — set for MDA officers
```

### Files to Touch

| File | Action |
|------|--------|
| `apps/client/src/components/layout/navItems.ts` | Update sidebar items + home route for MDA officer |
| `apps/client/src/pages/dashboard/MdaOfficerDashboard.tsx` | **NEW** — purpose-built dashboard |
| `apps/client/src/pages/dashboard/DashboardPage.tsx` | Add role check to render MDA officer dashboard |

**Possibly also:**
- `apps/client/src/router.tsx` — if separate route needed (probably not, conditional render is simpler)

**No backend changes needed.**

### Dashboard Layout (Suggested)

```
┌──────────────────────────────────────────────┐
│ Welcome, [Officer Name]! — [MDA Name]        │
├──────────┬──────────┬──────────┬─────────────┤
│ Active   │ Monthly  │ Total    │ Completion  │
│ Loans    │ Recovery │ Exposure │ Rate        │
│   171    │ ₦2.4M    │ ₦89.2M   │   2.3%     │
├──────────┴──────────┴──────────┴─────────────┤
│ ████████████████████████░░░ Status Breakdown  │
├──────────────────────┬───────────────────────┤
│ Migration Quality    │ Records for Review    │
│ Quality: 87.2%       │ 12 flagged            │
│ Clean: 149  Minor: 8 │ Deadline: 8 days      │
│ Significant: 14      │ [Review Now →]        │
├──────────────────────┴───────────────────────┤
│ Pre-Submission Status  ✓ Ready / ⚠ 3 issues │
├──────────────────────────────────────────────┤
│ Recent Submissions                           │
│ Aug 2024  │ Confirmed │ 171 records │ Apr 02 │
│ Dec 2024  │ Confirmed │ 171 records │ Apr 02 │
│           [View All Submissions →]           │
└──────────────────────────────────────────────┘
```

### Architecture Compliance

- **Non-punitive vocabulary:** All labels use approved vocabulary (Team Agreement)
- **Every number is a doorway (Agreement #11):** All hero metrics must be clickable
- **Empty states are UX (Agreement #13):** Every section needs contextual empty message
- **Role-specific UAT (Agreement #12):** Test as MDA officer after implementation

### Project Structure Notes

- Client pages: `apps/client/src/pages/dashboard/`
- Shared components: `apps/client/src/components/shared/`
- Layout components: `apps/client/src/components/layout/`
- Hooks: `apps/client/src/hooks/`
- Auth store: `apps/client/src/stores/authStore.ts`

### References

- [Source: `_bmad-output/implementation-artifacts/epic-8-uat-findings-2026-04-06.md` — Findings #20, #25, #29]
- [Source: `_bmad-output/implementation-artifacts/epic-8-retro-2026-04-06.md` — Prep-4 assignment]
- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 15.0e specification, line ~3472]
- [Source: `apps/client/src/components/layout/navItems.ts` — current sidebar config]
- [Source: `apps/client/src/hooks/useMdaData.ts` — MDA-scoped hooks]
- [Source: `apps/client/src/hooks/useMigrationData.ts` — migration quality data]
- [Source: `apps/client/src/components/shared/HeroMetricCard.tsx` — reusable hero card]
- [Source: `apps/client/src/components/shared/MigrationProgressCard.tsx` — variance display]
- [Source: `apps/client/src/pages/dashboard/components/MdaReviewSection.tsx` — review panel]

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (1M context)

### Debug Log References
- TypeScript compilation error: unused `MdaReviewSection` import in DashboardPage after removing the MDA officer block — fixed by removing import
- React hooks rule: early return for MDA officers placed before hooks — moved after all hooks to comply with rules of hooks

### Completion Notes List
- Created purpose-built MDA Officer Dashboard with 5 sections: hero metrics, migration quality, records review, pre-submission checkpoint, recent submissions
- Restructured sidebar from 5 sparse items to 6 purpose-built items with role-specific labels (My Dashboard, Upload Data, My Reviews, Employment Events, Reconciliation, My Reports)
- Removed duplicate "History" sidebar item and removed MDA officer access to "Historical Upload" (UAT #27)
- All hero metrics are clickable with keyboard accessibility (Team Agreement #11: every number is a doorway)
- All empty sections have contextual messages (Team Agreement #13: empty states are UX)
- MDA officer home route changed from `/dashboard/submissions` to `/dashboard`
- No backend changes required — all data already MDA-scoped via `scopeToMda` middleware
- Migration and Reports pages verified accessible to MDA officers (no role guards blocking)
- 11 new tests covering all 8 ACs + sidebar configuration
- Full client test suite: 88 files, 672 tests, all passing, zero regressions

### File List
- `apps/client/src/components/layout/navItems.ts` — Modified: sidebar restructure, home route, icon imports
- `apps/client/src/pages/dashboard/MdaOfficerDashboard.tsx` — New: purpose-built MDA officer dashboard
- `apps/client/src/pages/dashboard/MdaOfficerDashboard.test.tsx` — New: 12 tests covering all ACs + hook param assertions
- `apps/client/src/pages/dashboard/DashboardPage.tsx` — Modified: AdminDashboard extraction, role-based wrapper
- `packages/shared/src/types/submission.ts` — Modified: added period field to SubmissionRecord (review fix M3)
- `apps/client/src/mocks/submissionHistory.ts` — Modified: added period to mock data (review fix M3)

## Change Log
- 2026-04-06: Story 15.0e implemented — MDA Officer Dashboard & Sidebar Redesign. Transforms MDA officer from passive participant to first-class user with purpose-built dashboard, 6-item sidebar, hero metrics, migration quality score, review section, pre-submission checkpoint, and recent submissions. UAT findings #20, #25, #29 addressed.
- 2026-04-06: Code review (AI) — 8 findings (1H, 4M, 3L), all 8 resolved. H1 extracted AdminDashboard to eliminate wasted admin API calls for MDA officers; M1 typed STATUS_LABEL with SubmissionRecordStatus; M2 added hook parameter assertions; M3 added period field to SubmissionRecord type + table column (backend already returned it); M4 extracted IIFE to pre-JSX variables; L1 standardized mdaId handling; L2 documented Migration icon change (Database→ClipboardCheck); L3 added empty-mdaId URL guard. Files added to scope: packages/shared/src/types/submission.ts, apps/client/src/mocks/submissionHistory.ts.
