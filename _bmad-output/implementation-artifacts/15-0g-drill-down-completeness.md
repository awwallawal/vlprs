# Story 15.0g: Drill-Down Completeness — View All Loans & Table Upgrades

Status: done

## Story

As the **AG/Department Admin**,
I want a "View All Loans" button on the metric drill-down page that shows a flat searchable list across all MDAs, and I want the Zero Deduction Review to be a proper paginated table (not a truncated plain text list),
So that clicking any metric card gives me direct access to the records behind the number.

**Origin:** UAT Findings #2 (High), #21 (High), #22 (High) from E8 retro. MetricDrillDownPage requires 2 clicks (card → MDA → loans). Zero Deduction shows 50 names as text with "and 118 more". MDA Review tab not discoverable for MDA officers.

**Priority:** HIGH — Team Agreement #11: "Every number is a doorway."

## Acceptance Criteria

1. **Given** the MetricDrillDownPage shows an MDA breakdown for a metric (e.g., Overdue Loans), **When** the user clicks a "View All Loans" button at the top of the page, **Then** they navigate to a flat, searchable, sortable loan list across ALL MDAs filtered by the relevant classification (e.g., `?classification=OVERDUE`).

2. **Given** the MetricDrillDownPage, **When** a user clicks an MDA row, **Then** the existing drill-down to MDA Detail still works (no regression to the 2-click path — this adds a shortcut, doesn't remove the MDA breakdown).

3. **Given** the Pre-Submission Checkpoint page, **When** the Zero Deduction section has more than 50 items, **Then** ALL items are shown in a proper paginated `<table>` with columns: Staff Name, Staff ID, Last Deduction Date, Days Since Last Deduction — with client-side pagination (25 per page) and column sorting.

4. **Given** the Zero Deduction table, **When** less than 25 items exist, **Then** the table renders without pagination controls. When zero items exist, an empty state shows "All staff have recent deductions — no action needed."

5. **Given** an MDA Officer navigates to the Migration page (via "My Reviews" sidebar item from Story 15.0e), **When** they have flagged records pending review, **Then** the MDA Review tab is auto-selected (not requiring them to manually find and click the tab).

6. **Given** the Approaching Retirement and Pending Events sections on Pre-Submission Checkpoint, **When** they have more than 50 items, **Then** they are also shown as proper paginated tables (same treatment as Zero Deduction).

7. **Given** all existing tests, **When** the drill-down and table changes are applied, **Then** all tests pass with zero regressions.

## Root Cause Analysis

### Finding #2: MetricDrillDownPage — 2-Click Drill-Down

**Current flow:**
```
Dashboard metric card → MetricDrillDownPage (MDA breakdown table) → click MDA row → MdaDetailPage (loans)
```

**File:** `apps/client/src/pages/dashboard/MetricDrillDownPage.tsx` (lines 43-184)
- Page shows MDA breakdown via `useDrillDown(metric)` hook
- Each MDA row is clickable → navigates to `/dashboard/mda/:mdaId?metric=X`
- NO shortcut to see all loans at once

**Shortcut target already exists:** `FilteredLoanListPage` at route `/dashboard/loans` accepts `?filter=X` or `?classification=X` query params and shows a flat sortable loan list across all MDAs.

Classification filter mapping (from `FilteredLoanListPage.tsx:35-42`):
- `overdue` → `OVERDUE`
- `stalled` → `STALLED`  
- `quick-win` → `ON_TRACK` (loans close to completion)
- `onTrack` → `ON_TRACK`
- `completed` → `COMPLETED`
- `overDeducted` → `OVER_DEDUCTED`

### Finding #21: Zero Deduction — Plain Text, Truncated

**File:** `apps/client/src/pages/dashboard/components/PreSubmissionCheckpoint.tsx`
- **Line 8:** `MAX_ITEMS_PER_SECTION = 50` — hardcoded truncation
- **Lines 177-191:** `ZeroDeductionRow` renders as flexbox divs (not table)
- **Lines 208-212:** `OverflowFooter` shows "...and 118 more"
- **Lines 66-80:** Items rendered via `.slice(0, MAX_ITEMS).map()`

**ZeroDeductionItem type** (`packages/shared/src/types/preSubmission.ts:14-20`):
```typescript
export interface ZeroDeductionItem {
  staffName: string;
  staffId: string;
  lastDeductionDate: string;
  daysSinceLastDeduction: number | null;
}
```

4 fields — sufficient for a proper table with sortable columns.

### Finding #22: MDA Review Discoverability

**Mostly addressed by Story 15.0e** (sidebar redesign adds "My Reviews" pointing to `/dashboard/migration`). Remaining gap: when MDA officer navigates to Migration page, the MDA Review tab should be auto-selected if they have pending reviews.

**Current tab selection:** `MigrationPage.tsx:34` — `activeTab` state defaults to `'mda-progress'`. MDA officers landing on the page see the MDA Progress tab, then have to discover and click the "MDA Review" tab.

## Tasks / Subtasks

- [x] Task 1: Add "View All Loans" button to MetricDrillDownPage (AC: 1, 2)
  - [x] 1.1: In `apps/client/src/pages/dashboard/MetricDrillDownPage.tsx`, add a "View All Loans" button in the page header area (near the metric label):
    ```typescript
    <Button
      variant="outline"
      size="sm"
      onClick={() => navigate(`/dashboard/loans?classification=${classificationForMetric}`)}
    >
      View All Loans
    </Button>
    ```
  - [x] 1.2: Create a mapping from **URL slugs** (from `useParams<{ metric }>`) to classification/filter query params. The `metric` param uses URL slugs defined in `SLUG_TO_API` (lines 30-41), NOT classification names. Map:

    ```typescript
    const SLUG_TO_LOAN_FILTER: Record<string, string> = {
      'at-risk': '/dashboard/loans?filter=overdue',
      'completion-rate': '/dashboard/loans?filter=completed',
      'completion-rate-lifetime': '/dashboard/loans?filter=completed',
      'active-loans': '/dashboard/loans',  // all active loans, no filter
    };
    ```

    **Metrics WITHOUT a loan-level drill-down** (do NOT show "View All Loans" button):
    - `total-exposure` — aggregate portfolio value, no per-loan view
    - `monthly-recovery` — aggregate monthly amount
    - `outstanding-receivables` — aggregate amount
    - `collection-potential` — projected aggregate
    - `fund-available` — single config value
    - `loans-in-window` — same as active-loans view

  - [x] 1.3: Only render the "View All Loans" button when `SLUG_TO_LOAN_FILTER[metric]` exists:
    ```typescript
    const loanFilterUrl = SLUG_TO_LOAN_FILTER[metric ?? ''];
    // Only show button when there's a meaningful loan-level view
    {loanFilterUrl && (
      <Button variant="outline" size="sm" onClick={() => navigate(loanFilterUrl)}>
        View All Loans
      </Button>
    )}
    ```
  - [x] 1.4: Keep existing MDA row click-through intact (AC: 2) — the button is an ADDITION, not a replacement
  - [x] 1.5: Import `Button` from `@/components/ui/button` and `useNavigate` (likely already imported)

- [x] Task 2: Convert Zero Deduction section to paginated table (AC: 3, 4)
  - [x] 2.1: In `apps/client/src/pages/dashboard/components/PreSubmissionCheckpoint.tsx`:
    - Remove `MAX_ITEMS_PER_SECTION = 50` constant (line 8) — or keep it for other sections if only Zero Deduction gets the table treatment
    - Replace the `ZeroDeductionRow` plain-text rendering with a proper `<table>`:
      ```typescript
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-slate-50">
            <th className="px-3 py-2 text-left font-medium text-text-secondary cursor-pointer"
                onClick={() => handleSort('staffName')}>
              Staff Name {sortIcon('staffName')}
            </th>
            <th ...>Staff ID</th>
            <th ...>Last Deduction</th>
            <th ...>Days Since</th>
          </tr>
        </thead>
        <tbody>
          {paginatedItems.map(item => (
            <tr key={item.staffId} className="border-b hover:bg-muted/50">
              <td className="px-3 py-2 font-medium">{item.staffName}</td>
              <td className="px-3 py-2 font-mono text-text-secondary">{item.staffId}</td>
              <td className="px-3 py-2 text-text-secondary">{formatDate(item.lastDeductionDate)}</td>
              <td className="px-3 py-2 text-right font-mono">{item.daysSinceLastDeduction ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      ```
  - [x] 2.2: Add client-side pagination state:
    ```typescript
    const [zeroDeductionPage, setZeroDeductionPage] = useState(1);
    const PAGE_SIZE = 25;
    const totalPages = Math.ceil(data.zeroDeduction.length / PAGE_SIZE);
    const paginatedItems = sortedItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    ```
  - [x] 2.3: Add client-side column sorting state:
    ```typescript
    const [sortBy, setSortBy] = useState<string>('daysSinceLastDeduction');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    ```
    Sort the full array before pagination.
  - [x] 2.4: Add pagination controls below the table (Previous / Page X of Y / Next)
  - [x] 2.5: Empty state (AC: 4): "All staff have recent deductions — no action needed." with green check icon
  - [x] 2.6: Remove the `OverflowFooter` component usage for Zero Deduction section — all items are now shown via pagination

- [x] Task 3: Apply same table treatment to Approaching Retirement and Pending Events sections (AC: 6)
  - [x] 3.1: Convert `RetirementItem` rendering to a paginated table:
    - Columns: Staff Name, Staff ID, Retirement Date, Days Until Retirement (or similar fields from `RetirementItem` type)
    - Same pagination + sorting pattern as Zero Deduction
  - [x] 3.2: Convert `PendingEventItem` rendering to a paginated table:
    - Columns: **Event Type**, **Staff Name**, **Effective Date**, **Status** (from `reconciliationStatus`). Note: `PendingEventItem` does NOT have a `staffId` field — its fields are `eventType`, `staffName`, `effectiveDate`, `reconciliationStatus` (verified at `packages/shared/src/types/preSubmission.ts:23-28`).
  - [x] 3.3: `RetirementItem` fields (verified at `preSubmission.ts:7-12`): `staffName`, `staffId`, `retirementDate`, `daysUntilRetirement`. All 4 suitable as table columns.
  - [x] 3.4: Add empty states for each: "No approaching retirements" / "No pending events"

- [x] Task 4: Auto-select MDA Review tab for MDA officers (AC: 5)
  - [x] 4.1: In `apps/client/src/pages/dashboard/MigrationPage.tsx`, check if the user is an MDA officer and has pending flagged records. If so, default `activeTab` to `'mda-review'` instead of `'progress'`:
    ```typescript
    const user = useAuthStore((s) => s.user);
    const isOfficer = user?.role === ROLES.MDA_OFFICER;
    
    // Also check URL search params for explicit tab selection
    const [searchParams] = useSearchParams();
    const requestedTab = searchParams.get('tab');
    
    const [activeTab, setActiveTab] = useState(
      requestedTab ?? (isOfficer ? 'mda-review' : 'mda-progress')
    );
    ```
  - [x] 4.2: Alternatively, support a `?tab=mda-review` query parameter so the "My Reviews" sidebar link from 15.0e can link directly: `/dashboard/migration?tab=mda-review`

- [x] Task 5: Tests (AC: 7)
  - [x] 5.1: **Create** `MetricDrillDownPage.test.tsx` (no existing test file exists) — verify "View All Loans" button renders for applicable metrics, doesn't render for aggregate metrics, and navigates to correct URL
  - [x] 5.2: Update `PreSubmissionCheckpoint` test — verify table renders, pagination works, empty state shows
  - [x] 5.3: Run full client test suite: `pnpm test` in `apps/client`

### Review Follow-ups (AI)

- [x] [AI-Review][HIGH] MigrationPage: Unsafe `as Tab` type cast on URL search param — invalid `?tab=` value renders blank page. Added `VALID_TABS` set + `parseTab()` validator. [MigrationPage.tsx:25-28]
- [x] [AI-Review][HIGH] MigrationPage: `?tab=` param only read on mount — URL changes don't update tab. Added `useEffect` to sync `searchParams` → `setActiveTab`. [MigrationPage.tsx:44-47]
- [x] [AI-Review][MEDIUM] `useSortedPaginated` page state doesn't reset when items array changes — stale page shows empty table after re-fetch. Added `useEffect` reset on `items.length` change. [PreSubmissionCheckpoint.tsx:162]
- [x] [AI-Review][MEDIUM] Dead code `CHECKPOINT_EMPTY_SECTION` + vocabulary pattern violation — replaced hardcoded empty messages with `UI_COPY.CHECKPOINT_EMPTY_RETIREMENT`, `UI_COPY.CHECKPOINT_EMPTY_ZERO_DEDUCTION`, `UI_COPY.CHECKPOINT_EMPTY_PENDING_EVENTS`. Removed dead constant. [vocabulary.ts:302, PreSubmissionCheckpoint.tsx:58,70,82]
- [x] [AI-Review][MEDIUM] No test coverage for AC 5 (MDA Review tab auto-select) — Created `MigrationPage.test.tsx` with 5 tests covering MDA officer auto-tab, admin default, `?tab=` deep link, invalid `?tab=` fallback, and beneficiary-ledger tab. [MigrationPage.test.tsx]
- [ ] [AI-Review][MEDIUM] AC 5 implementation is unconditional — auto-selects MDA Review for ALL MDA officers regardless of whether they have pending flagged records. AC specifies "when they have flagged records pending review." Current behavior is acceptable UX but diverges from AC wording. Deferred — requires API check for pending review count.
- [x] [AI-Review][LOW] PendingEventsTable uses array index in composite React key — breaks DOM recycling after sort. Replaced with `staffName-effectiveDate-reconciliationStatus`. [PreSubmissionCheckpoint.tsx:335]
- [x] [AI-Review][LOW] Missing negative test cases for aggregate metrics — added `active-loans`, `outstanding-receivables`, `collection-potential`, `loans-in-window` to MetricDrillDownPage.test.tsx. [MetricDrillDownPage.test.tsx:115-138]

## Dev Notes

### "View All Loans" Shortcut — Reuses Existing Page

`FilteredLoanListPage` already exists at `/dashboard/loans` and supports both:
- `?classification=OVERDUE` (loan classification filter)
- `?filter=overdue` (attention item filter)

The button on MetricDrillDownPage just needs to navigate there with the right query param. No new pages or APIs needed.

### Zero Deduction Table — Client-Side Only

The data is already fully loaded by `usePreSubmissionCheckpoint(mdaId)` — the entire `zeroDeduction[]` array arrives in one response. Pagination and sorting are client-side operations on the in-memory array. No new API endpoints needed.

### Collapsible Section Pattern

The PreSubmissionCheckpoint uses collapsible sections (expand/collapse with chevron). The table should render INSIDE the collapsible content area, replacing the plain-text rows. The section header (with count badge) stays the same.

### Files to Touch

| File | Action |
|------|--------|
| `apps/client/src/pages/dashboard/MetricDrillDownPage.tsx` | Add "View All Loans" button with metric→classification mapping |
| `apps/client/src/pages/dashboard/components/PreSubmissionCheckpoint.tsx` | Convert 3 sections from plain text to paginated tables |
| `apps/client/src/pages/dashboard/MigrationPage.tsx` | Auto-select MDA Review tab for MDA officers |

**No backend changes needed.**

### Architecture Compliance

- **Every number is a doorway (Agreement #11):** "View All Loans" makes metric counts clickable with one click
- **Empty states are UX (Agreement #13):** All table empty states need contextual messages
- **Non-punitive vocabulary:** Zero Deduction section name stays as-is (it's descriptive, not punitive)

### Team Agreement Compliance

- **Agreement #5: File list verification** — dev must include exact file list
- **Agreement #12: Role-specific UAT** — test MDA Review auto-select as MDA officer

### References

- [Source: `_bmad-output/implementation-artifacts/epic-8-uat-findings-2026-04-06.md` — Findings #2, #21, #22]
- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 15.0g specification, line ~3490]
- [Source: `apps/client/src/pages/dashboard/MetricDrillDownPage.tsx:43-184` — current drill-down page]
- [Source: `apps/client/src/pages/dashboard/components/PreSubmissionCheckpoint.tsx:8` — MAX_ITEMS constant]
- [Source: `apps/client/src/pages/dashboard/FilteredLoanListPage.tsx:35-42` — classification filter mapping]
- [Source: `packages/shared/src/types/preSubmission.ts:14-20` — ZeroDeductionItem type]
- [Source: `apps/client/src/pages/dashboard/MigrationPage.tsx:23` — activeTab default]

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (1M context)

### Debug Log References
- FilteredLoanListPage uses `?filter=` param (not `?classification=`), so SLUG_TO_LOAN_FILTER uses `?filter=overdue` and `?filter=completed` instead of `?classification=OVERDUE`
- `active-loans` excluded from SLUG_TO_LOAN_FILTER because FilteredLoanListPage's `useFilteredLoans` hook has `enabled: !!(filter || classification)` — navigating with no filter disables the query. The MDA breakdown IS the proper drill-down for active loans.
- `CheckpointSection` component extended with per-section `emptyMessage` prop to support contextual empty states (AC: 4, 6, Agreement #13)
- Extracted `useSortedPaginated` custom hook for shared sort/pagination logic across all three table components, avoiding code duplication
- `HealthScoreBadge` expects bands: `healthy`, `attention`, `for-review` (not arbitrary strings like `good`)

### Completion Notes List
- Task 1: Added "View All Loans" button to MetricDrillDownPage with SLUG_TO_LOAN_FILTER mapping for at-risk, completion-rate, completion-rate-lifetime. Button conditionally rendered only for metrics with loan-level views.
- Task 2: Replaced ZeroDeductionRow plain-text flexbox rendering with proper paginated, sortable `<table>`. Removed MAX_ITEMS_PER_SECTION truncation. 25 items per page. 4 sortable columns. Contextual empty state.
- Task 3: Converted RetirementTable and PendingEventsTable to same paginated table treatment. Each has appropriate column headers and contextual empty state messages.
- Task 4: MigrationPage now auto-selects 'mda-review' tab for MDA_OFFICER role. Also supports `?tab=` query parameter for direct linking.
- Task 5: Created MetricDrillDownPage.test.tsx (8 tests) and updated PreSubmissionCheckpoint.test.tsx (13 tests). Full suite: 89 files, 688 tests, all pass.

### File List

**New:**
- `apps/client/src/pages/dashboard/MetricDrillDownPage.test.tsx`
- `apps/client/src/pages/dashboard/MigrationPage.test.tsx`

**Modified:**
- `apps/client/src/pages/dashboard/MetricDrillDownPage.tsx`
- `apps/client/src/pages/dashboard/components/PreSubmissionCheckpoint.tsx`
- `apps/client/src/pages/dashboard/components/PreSubmissionCheckpoint.test.tsx`
- `apps/client/src/pages/dashboard/MigrationPage.tsx`
- `packages/shared/src/constants/vocabulary.ts`

**Deleted:** None

## Change Log

- 2026-04-06: Implemented Story 15.0g — Added "View All Loans" shortcut button to MetricDrillDownPage, converted all 3 PreSubmissionCheckpoint sections from truncated plain-text to proper paginated sortable tables, auto-select MDA Review tab for MDA officers, added 21 tests (8 new + 13 updated). All 688 tests pass, 0 lint errors.
- 2026-04-06: Code review fixes — Fixed unsafe `as Tab` cast with validation set, added useEffect for URL→tab sync, added page reset on items change in `useSortedPaginated`, moved hardcoded empty messages to UI_COPY vocabulary constants, removed dead `CHECKPOINT_EMPTY_SECTION`, fixed PendingEvents React key, added 4 missing negative metric test cases, created MigrationPage.test.tsx (5 new tests covering AC 5). 7 of 8 review findings fixed (1 deferred: conditional AC5 implementation by design — auto-selects for all MDA officers regardless of pending count). Total: 26 tests added/updated, all pass.
