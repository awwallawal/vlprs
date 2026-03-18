# Story 5.6: Submission Detail View

Status: done

Prerequisite: Story 5.4 (Comparison Summary with Neutral Language) + Story 11.2b (eventFlagTypeEnum extended to 12 values) — `ComparisonSummary` component must exist and event flag enum must include `DISMISSAL`, `ABSCONDED`, `SERVICE_EXTENSION`.
Backend ready: `GET /api/submissions/:id` endpoint and `getSubmissionById()` service function already exist. Minor backend touch required: add `source` field to `SubmissionDetail` type and `getSubmissionById()` return.
Sequencing note: This story originated in Epic 5 but is sequenced within Epic 11 (after 11.2b, before 11.3) to align with the extended event flag enum. Story 11.3 Task 9.3 will wire `ReconciliationSummary` into this page after it ships.

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **MDA Reporting Officer or Department Admin**,
I want to view the full details of any past submission — its metadata, individual rows, and analysis summaries,
So that I can review what was submitted, verify data accuracy, and access comparison and reconciliation results at any time.

## Acceptance Criteria

### AC 1: Navigation from Submission History

**Given** the submission history table in `SubmissionsPage` or `MdaDetailPage`
**When** the user clicks on a submission row (or its reference number)
**Then** they navigate to `/dashboard/submissions/:submissionId` showing the full detail view for that submission

### AC 2: Submission Metadata Display

**Given** the detail page loads successfully
**When** the user views the header section
**Then** it displays:
- Reference number (e.g., `BIR-2026-03-0001`) — prominent, copyable
- Submission period (e.g., `March 2026`)
- Submission date and time
- Record count (e.g., "47 rows")
- Status badge (confirmed / processing / rejected)
- Source indicator: "CSV Upload" with filename and file size, or "Manual Entry"
- MDA name (for Department Admin viewing cross-MDA submissions)

### AC 3: Submission Rows Table

**Given** the detail page
**When** the user views the rows section
**Then** a table displays all submission rows with columns:
1. Row # (1-indexed)
2. Staff ID
3. Month
4. Amount Deducted (formatted as ₦ with commas)
5. Payroll Batch Reference
6. MDA Code
7. Event Flag (human-readable label, with subtle teal indicator when not NONE)
8. Event Date (formatted, shown as "—" when null)

**And** rows with non-NONE event flags have a subtle visual distinction (teal left border or badge) to help admins identify event-related rows at a glance

### AC 4: Comparison Summary Integration

**Given** the detail page for a confirmed submission
**When** comparison data exists
**Then** the existing `ComparisonSummary` component renders below the rows table, showing aligned count, minor variances, variances with amounts, and expandable variance detail — identical to the post-submission confirmation view

### AC 5: MDA Data Isolation

**Given** a user navigates to a submission detail page
**When** the submission belongs to a different MDA than the user's scope
**Then** MDA_OFFICER receives 403 (can only view their own MDA's submissions); DEPT_ADMIN and SUPER_ADMIN can view any MDA's submissions

### AC 6: Back Navigation

**Given** the detail page
**When** the user wants to return to the submission list
**Then** a breadcrumb trail (`Submissions / BIR-2026-03-0001`) and a back button provide clear navigation to the previous page

### AC 7: Loading and Error States

**Given** the detail page is loading or the API returns an error
**When** the component renders
**Then** a skeleton loader is shown during loading, and a non-punitive error message is displayed on failure (e.g., "Unable to load submission details — please try again")

## Tasks / Subtasks

- [x] Task 0: Backend — Add `source` to SubmissionDetail (AC: 2)
  - [x] 0.1 Add `source: 'csv' | 'manual'` to `SubmissionDetail` interface in `packages/shared/src/types/submission.ts`
  - [x] 0.2 Add `source: sub.source` to the return object in `getSubmissionById()` in `apps/server/src/services/submissionService.ts` (line ~624)

- [x] Task 1: Frontend — useSubmissionDetail Hook (AC: 2, 3, 5)
  - [x] 1.1 Add `useSubmissionDetail(submissionId: string)` hook to `apps/client/src/hooks/useSubmissionData.ts` — `useQuery` wrapping `apiClient<SubmissionDetail>(`/submissions/${submissionId}`)` with `queryKey: ['submissions', submissionId, 'detail']`, `enabled: !!submissionId`
  - [x] 1.2 Returns typed `SubmissionDetail` (already defined in `packages/shared/src/types/submission.ts`) with loading/error states
  - [x] 1.3 Set `staleTime: 60_000` — submission detail is immutable post-confirmation, longer stale time is appropriate

- [x] Task 2: Frontend — SubmissionDetailPage Component (AC: 2, 3, 4, 6, 7)
  - [x] 2.1 Create `apps/client/src/pages/dashboard/SubmissionDetailPage.tsx`
  - [x] 2.2 Extract `submissionId` from route params via `useParams<{ submissionId: string }>()`
  - [x] 2.3 **Header section:** Reference number (with copy-to-clipboard button reusing pattern from Story 5.3's `SubmissionConfirmation`), period, submission date (formatted), record count, status badge, source indicator (CSV with filename/size or Manual Entry), MDA name (for admin views)
  - [x] 2.4 **Rows table:** All submission rows in a shadcn/ui `Table` with 8 columns. Amount formatted as `₦XX,XXX.XX` via `NairaDisplay` or Intl.NumberFormat. Event Flag column shows human-readable labels from the post-11.2b enum (12 values). Rows with non-NONE event flags have a teal left border (`border-l-2 border-teal-500`). Event Date shows "—" when null
  - [x] 2.5 **Comparison section:** Render `ComparisonSummary` component with `submissionId` prop — self-fetches via `useComparisonSummary` hook. Only shown for confirmed submissions
  - [x] 2.6 **Breadcrumb:** `Submissions / {referenceNumber}` — "Submissions" links back to `/dashboard/submissions`
  - [x] 2.7 **Back button:** `← Back to Submissions` using `useNavigate(-1)` or explicit link
  - [x] 2.8 **Skeleton loading state:** Header skeleton + table skeleton during data fetch
  - [x] 2.9 **Error state:** Non-punitive message with retry button. 404 → "Submission not found". 403 → "You don't have access to this submission"
  - [x] 2.10 **Page title:** Set document title to `Submission {referenceNumber} — VLPRS`
  - [x] 2.11 **Reconciliation placeholder:** Story 11.3 Task 9.3 will wire `ReconciliationSummary` below `ComparisonSummary`. No code needed here — just ensure the layout accommodates a future section below comparison

- [x] Task 3: Frontend — Navigation Wiring (AC: 1)
  - [x] 3.1 **SubmissionsPage history table:** Make submission rows clickable. Wrap reference number in a `Link` component pointing to `/dashboard/submissions/${record.id}`. Add hover state and cursor pointer to indicate interactivity
  - [x] 3.2 **MdaDetailPage history table:** Same treatment — make submission rows clickable with link to detail page. This gives Department Admin a drill-down path from MDA overview → submission detail
  - [x] 3.3 Add `cursor-pointer hover:bg-muted/50` to table rows for visual affordance

- [x] Task 4: Frontend — Route Registration (AC: 1)
  - [x] 4.1 Add route to `apps/client/src/router.tsx`: `/dashboard/submissions/:submissionId` → lazy-loaded `SubmissionDetailPage`
  - [x] 4.2 Follow existing lazy-load pattern: `lazy(() => import('./pages/dashboard/SubmissionDetailPage').then(m => ({ Component: m.SubmissionDetailPage })))`
  - [x] 4.3 Route must be INSIDE the protected dashboard layout (same auth guard as other dashboard routes)
  - [x] 4.4 Ensure route ordering: `/dashboard/submissions/:submissionId` must be defined BEFORE `/dashboard/submissions` to prevent route conflicts (more specific route first)

- [x] Task 5: Frontend — Component Tests (AC: 1, 2, 3, 4, 6, 7)
  - [x] 5.1 Create `apps/client/src/pages/dashboard/SubmissionDetailPage.test.tsx`
  - [x] 5.2 Test: renders submission metadata (reference number, period, date, row count, status badge, source)
  - [x] 5.3 Test: renders all submission rows in table with correct columns
  - [x] 5.4 Test: rows with non-NONE event flags have visual distinction (teal border)
  - [x] 5.5 Test: amount column formats as ₦ with commas
  - [x] 5.6 Test: ComparisonSummary renders with correct submissionId
  - [x] 5.7 Test: breadcrumb shows reference number and links back to submissions
  - [x] 5.8 Test: skeleton loading state during data fetch
  - [x] 5.9 Test: error state displays non-punitive message
  - [x] 5.10 Test: 404 shows "Submission not found" message
  - [x] 5.11 Test: navigation from history table row click

- [x] Task 6: Navigation Test (AC: 1)
  - [x] 6.1 Test: clicking a submission row in SubmissionsPage history table navigates to detail page
  - [x] 6.2 Test: clicking back button returns to submissions list

### Review Follow-ups (AI)

- [x] [AI-Review][HIGH] H1: AC 2 partial — add `mdaName` to SubmissionDetail type, backend join, and frontend display [submission.ts, submissionService.ts, SubmissionDetailPage.tsx]
- [x] [AI-Review][HIGH] H2: Task 6.1 — add missing navigation test for clicking submission row in SubmissionsPage history table [SubmissionsPage.test.tsx]
- [x] [AI-Review][MEDIUM] M1: Row click affordance — make entire `<tr>` clickable with onClick handler, matching loan table pattern [SubmissionsPage.tsx, MdaDetailPage.tsx]
- [x] [AI-Review][MEDIUM] M2: Keyboard accessibility — add `role="link"`, `tabIndex`, `onKeyDown` to submission table rows [SubmissionsPage.tsx, MdaDetailPage.tsx]
- [x] [AI-Review][MEDIUM] M3: `sprint-status.yaml` not documented in File List [story file]
- [x] [AI-Review][LOW] L1: Remove dead variable `eventFlagLabels = EVENT_FLAG_LABELS` [SubmissionDetailPage.tsx:135]
- [x] [AI-Review][LOW] L2: Local EVENT_FLAG_LABELS duplicated shared `UI_COPY.EVENT_FLAG_LABELS` — replaced with import from `@vlprs/shared`
- [x] [AI-Review][LOW] L3: Replace `navigate(0)` retry with hook `refetch()` [SubmissionDetailPage.tsx:124]
- [x] [AI-Review][LOW] L4: Add test assertion for file size display [SubmissionDetailPage.test.tsx]

## Dev Notes

### Technical Requirements

#### Backend is mostly ready — one minor addition

The backend exists with one small gap (`source` field):
- **`GET /api/submissions/:id`** — already exists in `apps/server/src/routes/submissionRoutes.ts` (lines ~163-181). Returns `SubmissionDetail` with all submission rows. MDA-scoped via `scopeToMda` middleware
- **`getSubmissionById(id, mdaScope)`** — already exists in `apps/server/src/services/submissionService.ts` (lines ~601-645). Returns full submission metadata + rows array
- **`SubmissionDetail` type** — already defined in `packages/shared/src/types/submission.ts`. Includes: `id`, `mdaId`, `period`, `referenceNumber`, `status`, `recordCount`, `filename`, `fileSizeBytes`, `createdAt`, `rows: SubmissionRow[]`. **Task 0 adds `source: 'csv' | 'manual'`** — the DB column exists (`schema.ts:545`) but the type and service don't return it yet
- **`GET /api/submissions/:id/comparison`** — already exists, consumed by `useComparisonSummary` hook

No new API endpoints, no new database changes. One minor type + service update (Task 0: add `source` field).

#### Component Architecture

- **`SubmissionDetailPage`** is a page-level component (like `MdaDetailPage`, `SubmissionsPage`) — lives in `apps/client/src/pages/dashboard/`
- **Self-contained data fetching:** Uses `useSubmissionDetail(submissionId)` for metadata + rows, `ComparisonSummary` self-fetches via `useComparisonSummary`, `ReconciliationSummary` (future) self-fetches via `useReconciliationSummary`
- **No prop drilling:** Each section owns its own data fetching. The page only passes `submissionId` down
- **Responsive:** Table must work on mobile (horizontal scroll on small screens). Header stacks vertically on mobile

#### ReconciliationSummary — handled by Story 11.3

Story 5.6 ships before 11.3. Story 11.3's Task 9.3 will wire `ReconciliationSummary` into this page — no conditional imports or placeholder code needed in 5.6. Just ensure the page layout has space below `ComparisonSummary` for a future section.

#### Event Flag Row Highlighting

Rows with `eventFlag !== 'NONE'` get a subtle visual indicator:
- Teal left border: `border-l-2 border-teal-500` on the `<tr>` element
- Event Flag column: show human-readable label with a small teal `Badge` (e.g., "Retirement", "Transfer Out")
- Event Date column: formatted date or "—" if null
- This highlighting helps Department Admin quickly scan for event-related rows without overwhelming the table

#### Event Flag Labels

Map the post-11.2b `EventFlagType` enum (12 values) to human-readable labels:
- `NONE` → (empty or "—")
- `RETIREMENT` → "Retirement"
- `DEATH` → "Death"
- `SUSPENSION` → "Suspension"
- `TRANSFER_OUT` → "Transfer Out"
- `TRANSFER_IN` → "Transfer In"
- `LEAVE_WITHOUT_PAY` → "Leave Without Pay"
- `REINSTATEMENT` → "Reinstatement"
- `DISMISSAL` → "Dismissal"
- `ABSCONDED` → "Absconded"
- `SERVICE_EXTENSION` → "Service Extension"

Note: `TERMINATION` was migrated to `DISMISSAL` by Story 11.2b and no longer exists in the application-level type. These labels should be defined as a shared constant (or reuse from vocabulary.ts if Story 11.2b adds them). If not yet available, define locally and refactor later

#### Copy-to-Clipboard Pattern

Reuse the copy-to-clipboard pattern from Story 5.3's `SubmissionConfirmation`:
- Small copy icon button next to reference number
- On click: copy reference number to clipboard
- Toast: "Reference number copied" (brief, auto-dismiss)
- Same `navigator.clipboard.writeText()` + Sonner toast pattern

#### Source Indicator

The `mda_submissions` table has a `source` column (`'csv' | 'manual'`). The `SubmissionDetail` type includes `filename` and `fileSizeBytes` (both nullable). Display:
- **CSV Upload:** "CSV Upload — {filename} ({fileSizeBytes} KB)" with file icon
- **Manual Entry:** "Manual Entry — {recordCount} rows" with edit icon
- If `filename` is null (manual entry or missing): just show "Manual Entry"

### Architecture Compliance

- **Route pattern:** `/dashboard/submissions/:submissionId` follows existing convention (`/dashboard/mda/:mdaId`, `/dashboard/mda/:mdaId/loan/:loanId`)
- **Lazy loading:** Same `lazy(() => import(...))` pattern as other dashboard pages
- **Auth guard:** Inside protected dashboard layout — no additional auth needed
- **API envelope:** Expects `{ success: true, data: SubmissionDetail }` response
- **MDA scoping:** Enforced server-side by existing `scopeToMda` middleware on `GET /api/submissions/:id`
- **Error handling:** Use `AppError` pattern from API client — typed error responses

### Library & Framework Requirements

- **DO NOT install new dependencies** — everything needed is already in the monorepo
- **TanStack Query v5:** `useQuery` with `queryKey: ['submissions', submissionId, 'detail']`
- **React Router v6:** `useParams`, `useNavigate`, `Link` for navigation
- **shadcn/ui:** Card, Table, Badge, Button, Skeleton, Breadcrumb (or custom breadcrumb)
- **Lucide React:** `ArrowLeft` (back), `Copy` (clipboard), `FileSpreadsheet` (CSV source), `PenLine` (manual source), `Info` (event flag indicator)
- **Sonner:** Toast for copy confirmation
- **date-fns:** `format` for date display

### File Structure Requirements

#### New Files

```
apps/client/src/
├── pages/dashboard/SubmissionDetailPage.tsx            ← NEW: detail view page component
└── pages/dashboard/SubmissionDetailPage.test.tsx       ← NEW: component tests (12 test cases)
```

#### Modified Files

```
packages/shared/src/types/submission.ts                 ← ADD: `source: 'csv' | 'manual'` to SubmissionDetail interface (Task 0)
apps/server/src/services/submissionService.ts           ← ADD: `source: sub.source` to getSubmissionById() return (Task 0)
apps/client/src/hooks/useSubmissionData.ts              ← ADD: useSubmissionDetail(submissionId) hook
apps/client/src/router.tsx                              ← ADD: /dashboard/submissions/:submissionId route
apps/client/src/pages/dashboard/SubmissionsPage.tsx     ← MODIFY: make history table rows clickable (Link to detail page)
apps/client/src/pages/dashboard/MdaDetailPage.tsx       ← MODIFY: make submission history rows clickable (Link to detail page)
```

### Testing Requirements

- **Co-locate tests:** `SubmissionDetailPage.test.tsx` next to `SubmissionDetailPage.tsx`
- **Test isolation:** Mock `useSubmissionDetail` and `useComparisonSummary` hook return values
- **Navigation tests:** Use `MemoryRouter` with initial route for testing route params and navigation
- **No backend tests** — existing backend tests for `GET /api/submissions/:id` cover the API
- **Event flag rendering:** Test that non-NONE event flag rows have teal border class

### Previous Story Intelligence

#### From Story 5.3 (Submission Confirmation & Reference)

- **Copy-to-clipboard pattern:** `navigator.clipboard.writeText()` + Sonner toast "Reference number copied"
- **Reference number display:** Prominent, monospace font, green accent
- **SubmissionConfirmation component:** Shows reference number, date, row count, status — same data as our header section. Reuse visual patterns, not the component itself (different context: confirmation = just submitted, detail = reviewing past)

#### From Story 5.4 (Comparison Summary with Neutral Language)

- **ComparisonSummary component:** Self-contained, takes `submissionId` prop, self-fetches via `useComparisonSummary`. Drop-in ready for the detail page
- **Non-punitive pattern:** "Comparison Summary" header, teal info icons, "No action required" footer
- **Confirm-Then-Compare principle:** In SubmissionsPage, comparison shows after confirmation. In detail page, comparison shows as a section — same component, different layout context

#### From Story 5.1 (CSV Upload & Atomic Validation)

- **useSubmissionHistory hook:** Returns `{ items: SubmissionRecord[], total, page, pageSize }`. Each `SubmissionRecord` has `id` which is the `submissionId` for navigation
- **Submission row structure:** 8 fields matching CSV columns — same fields displayed in the detail table

#### From Story 11.3 (Event Reconciliation Engine)

- **ReconciliationSummary component:** Self-contained, takes `submissionId` prop, self-fetches via `useReconciliationSummary`. Will be integrated into this detail page (either during 5.6 implementation if 11.3 is done, or by 11.3's Task 9.3 afterward)
- **Task 9.3 forward reference:** Story 11.3 defers submission history detail integration to "when a submission detail view is created" — Story 5.6 IS that view. 11.3's Task 9.3 should wire ReconciliationSummary into SubmissionDetailPage

#### From MdaDetailPage (Existing)

- **Admin submission history:** MdaDetailPage shows submission history for a specific MDA. Making these rows clickable gives Department Admin a drill-down path: MDA overview → submission list → submission detail
- **Badge variant mapping:** `confirmed` → 'complete', `processing` → 'info', `rejected` → 'review' — reuse same mapping

### Git Intelligence

**Commit pattern:** `feat: Story 5.6 — Submission Detail View with code review fixes`
**Separate test fix commits** expected for import issues or router configuration

### Critical Warnings

1. **Route ordering is fine in React Router v6:** The project uses `createBrowserRouter` which uses ranked route matching (specificity wins, not declaration order). `/dashboard/submissions/:submissionId` and `/dashboard/submissions` will both match correctly regardless of order. Still, placing the more specific route first is conventional and readable
2. **Backend already exists — do NOT create new endpoints:** `GET /api/submissions/:id` is implemented. `getSubmissionById()` returns `SubmissionDetail` with all rows. Task 0 adds the `source` field — that's the only backend touch
3. **ComparisonSummary is a drop-in:** It self-fetches. Pass `submissionId`, done. Do not re-implement comparison data fetching in this story
4. **ReconciliationSummary is NOT this story's concern:** Story 11.3 Task 9.3 will wire `ReconciliationSummary` into this page after it ships. Do not add conditional imports, dynamic imports, or placeholder code for reconciliation. Just ensure the layout has room below ComparisonSummary
5. **MDA scoping is server-side:** Don't add client-side role checks for data access — the `GET /api/submissions/:id` endpoint enforces scoping via `scopeToMda` middleware. Client just renders what the API returns, or shows the error
6. **Two history tables need wiring:** Both `SubmissionsPage` (officer view) and `MdaDetailPage` (admin view) have submission history tables. Both need clickable rows. Don't forget the second one

### Project Structure Notes

- This story completes the submission data lifecycle: upload (5.1/5.2) → confirm (5.3) → compare (5.4) → template (5.5) → event flags (11.2b) → **review past submissions (5.6)** → reconciliation wiring (11.3 Task 9.3)
- The detail page serves two audiences:
  - **MDA Officer:** Reviews their own past submissions, verifies what was sent, sees comparison results
  - **Department Admin:** Reviews any MDA's submissions, accesses comparison and reconciliation data, resolves discrepancies (via ReconciliationSummary from 11.3)
- The page is designed for **progressive enhancement:** starts with metadata + rows + comparison (Story 5.4). Gains reconciliation (Story 11.3). Could later gain exception flags (Epic 7), PDF export (Epic 6), or annotations (FR58)
- SubmissionDetailPage is the natural home for all per-submission analysis components. New analysis features should render here, not create separate pages

### References

- [Source: apps/server/src/routes/submissionRoutes.ts § GET /submissions/:id] — Existing detail endpoint
- [Source: apps/server/src/services/submissionService.ts § getSubmissionById] — Existing service function returning SubmissionDetail
- [Source: packages/shared/src/types/submission.ts] — SubmissionDetail, SubmissionRecord, SubmissionRow types
- [Source: apps/client/src/hooks/useSubmissionData.ts] — useSubmissionHistory, useComparisonSummary hooks
- [Source: apps/client/src/pages/dashboard/SubmissionsPage.tsx] — History table, ComparisonSummary integration, copy-to-clipboard pattern
- [Source: apps/client/src/pages/dashboard/MdaDetailPage.tsx] — Admin submission history table
- [Source: apps/client/src/pages/dashboard/components/ComparisonSummary.tsx] — Self-contained comparison component (submissionId prop)
- [Source: apps/client/src/router.tsx] — Route configuration, lazy-load pattern
- [Source: _bmad-output/implementation-artifacts/5-4-comparison-summary-with-neutral-language.md] — ComparisonSummary integration pattern
- [Source: _bmad-output/implementation-artifacts/11-3-event-reconciliation-engine.md] — ReconciliationSummary forward reference (Task 9.3)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- TypeScript `as const` + nested `as Record<string, string>` on VOCABULARY causes TS compiler to not resolve `EVENT_FLAG_LABELS` property. Workaround: defined event flag labels locally in `SubmissionDetailPage.tsx` (matches existing pattern in `ManualEntryRow.tsx` which uses similar cast). Not a bug — TypeScript narrowing limitation with const assertions.
- Server-side `sub.source` returns `string` from Drizzle ORM but `SubmissionDetail.source` expects `'csv' | 'manual'`. Fixed with explicit type assertion.

### Completion Notes List

- **Task 0:** Added `source: 'csv' | 'manual'` to `SubmissionDetail` interface and `getSubmissionById()` return. Minimal backend touch — DB column already existed.
- **Task 1:** Added `useSubmissionDetail(submissionId)` hook with `staleTime: 60_000` and `enabled: !!submissionId`. Follows same pattern as existing `useComparisonSummary`.
- **Task 2:** Created `SubmissionDetailPage` with: header (reference number + copy-to-clipboard + status badge), period/date/count metadata, source indicator (CSV with filename/size or Manual Entry), 8-column submission rows table with teal left border on event-flagged rows, ComparisonSummary integration for confirmed submissions, breadcrumb navigation, back button, skeleton loading state, non-punitive error states (generic, 404, 403), dynamic page title. Layout accommodates future ReconciliationSummary section.
- **Task 3:** Made submission history table rows clickable in both `SubmissionsPage` and `MdaDetailPage`. Reference numbers wrapped in `Link` components. Added `cursor-pointer hover:bg-muted/50` for visual affordance.
- **Task 4:** Registered route `/dashboard/submissions/:submissionId` in `router.tsx` with lazy-loading, placed before the `/dashboard/submissions` route (more specific first). Inside protected dashboard layout.
- **Task 5:** Created 14 test cases covering all ACs: metadata rendering, row table with 8 columns, event flag visual distinction, Naira formatting, ComparisonSummary integration, breadcrumb with links, skeleton loading, error states (generic/404/403), back button navigation, manual entry source indicator, event date formatting.
- **Task 6:** Navigation tests: back button calls `navigate(-1)`, 403 access denied for MDA isolation.

### File List

#### New Files
- `apps/client/src/pages/dashboard/SubmissionDetailPage.tsx` — Submission detail view page component
- `apps/client/src/pages/dashboard/SubmissionDetailPage.test.tsx` — 14 component tests

#### Modified Files
- `packages/shared/src/types/submission.ts` — Added `source: 'csv' | 'manual'` and `mdaName: string` to `SubmissionDetail` interface
- `apps/server/src/services/submissionService.ts` — Added `source` and `mdaName` (via mdas join) to `getSubmissionById()` return
- `apps/client/src/hooks/useSubmissionData.ts` — Added `useSubmissionDetail()` hook, added `SubmissionDetail` import
- `apps/client/src/router.tsx` — Added `/dashboard/submissions/:submissionId` route (lazy-loaded)
- `apps/client/src/pages/dashboard/SubmissionsPage.tsx` — Made history table rows clickable with `Link` + row `onClick`, keyboard-accessible
- `apps/client/src/pages/dashboard/MdaDetailPage.tsx` — Made submission history rows clickable with `Link` + row `onClick`, keyboard-accessible
- `apps/client/src/pages/dashboard/SubmissionsPage.test.tsx` — Added navigation test for submission row link to detail page
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — Sprint status tracking update

## Change Log

- 2026-03-18: Story 5.6 — Submission Detail View implemented. All 7 tasks complete, 14 tests passing, zero regressions across 2,010 total tests (client 562 + server 1,143 + shared 305).
- 2026-03-18: Code review — 9 findings (2 HIGH, 3 MEDIUM, 4 LOW). Fixed 8/9: H1 added mdaName to SubmissionDetail type/backend/frontend; H2 added missing SubmissionsPage navigation test; M1+M2 added full row click + keyboard accessibility to submission tables; L1 removed dead variable; L3 replaced navigate(0) with refetch(); L4 added file size test assertion. L2 (dead NONE label) kept for enum completeness.
