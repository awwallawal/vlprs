# Story 15.0h: Clickable Cards & Reports Drill-Down Bundle

Status: done

## Story

As the **AG/Department Admin**,
I want Recovery Potential Summary cards, MDA Scorecard table rows, and Operations Hub cards to be clickable with drill-down navigation,
So that every visible metric on every page leads somewhere actionable.

**Origin:** UAT Findings #16, #17, #31 (Medium) from E8 retro. Team Agreement #11: "Every number is a doorway."

**Priority:** MEDIUM — UX polish. All data and target pages already exist; this story adds click handlers and navigation.

## Acceptance Criteria

1. **Given** the Executive Summary Report, **When** the user clicks a Recovery Potential Summary card (Quick Recovery / Requires Intervention / Extended Follow-up), **Then** they navigate to a filtered loan list showing the loans in that recovery tier.

2. **Given** the Executive Summary Report, **When** the user clicks an MDA Scorecard table row (in Top 10 Healthy or Bottom 5 For Review), **Then** they navigate to `/dashboard/mda/:mdaId` showing that MDA's detail page.

3. **Given** the Operations Hub page, **When** the Dept Admin clicks a Migration Progress card for an MDA, **Then** they navigate to `/dashboard/mda/:mdaId` for that MDA's detail page.

4. **Given** any of the above clickable elements, **When** the user presses Enter or Space while focused, **Then** the same navigation triggers (keyboard accessibility).

5. **Given** any of the above clickable elements, **When** the user hovers, **Then** a visual cue shows interactivity (`cursor-pointer`, subtle shadow or background change).

6. **Given** all existing tests, **When** the click handlers are added, **Then** all tests pass with zero regressions.

## Current State & Gap Analysis

### Finding #16: Recovery Potential Cards — Not Clickable

**File:** `apps/client/src/pages/dashboard/components/ExecutiveSummaryReport.tsx:207-226`

**Current:** 3 nested cards render `tierName`, `loanCount`, `totalAmount`, `monthlyProjection` as static `<div>`s. No `onClick`, no `cursor-pointer`, no keyboard handlers.

**Data available:** `RecoveryTier` has `tierName`, `loanCount`, `totalAmount`, `monthlyProjection`. No `mdaId` — these are scheme-wide aggregates.

**Navigation targets by tier:**
| Tier | Filter | Route |
|------|--------|-------|
| Quick Recovery | `?filter=quick-win` | `/dashboard/loans?filter=quick-win` |
| Requires Intervention | `?classification=OVERDUE` | `/dashboard/loans?classification=OVERDUE` |
| Extended Follow-up | `?classification=STALLED` | `/dashboard/loans?classification=STALLED` |

### Finding #17: MDA Scorecard Rows — Not Clickable

**File:** `apps/client/src/pages/dashboard/components/ExecutiveSummaryReport.tsx:48-75`

**Current:** `ScorecardTable` renders `<tr>` elements for Top 10 Healthy and Bottom 5 For Review. Columns: MDA name, Health badge, Outstanding amount, Observation count. Rows are plain `<tr>` — no `onClick`, `role="link"`, `tabIndex`, or `cursor-pointer`.

**Data available:** `MdaScorecardRow` has `mdaId` — the navigation key.

**Navigation target:** `/dashboard/mda/:mdaId` (MdaDetailPage — already exists).

**Pattern to follow:** `DashboardPage.tsx:516-532` — MDA compliance table rows already use the correct clickable pattern:
```typescript
<tr
  role="link"
  tabIndex={0}
  onClick={() => navigate(`/dashboard/mda/${row.mdaId}`)}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      navigate(`/dashboard/mda/${row.mdaId}`);
    }
  }}
  className={cn('border-b transition-colors hover:bg-slate-50', 'cursor-pointer')}
>
```

### Finding #31: Operations Hub Migration Cards — Not Clickable

**File:** `apps/client/src/pages/dashboard/OperationsHubPage.tsx:98-107`

**Current:** `MigrationProgressCard` component IS built with `onClick` prop support (`MigrationProgressCard.tsx:20-21`), but the parent `OperationsHubPage` does NOT pass `onClick` to the cards.

```typescript
// Current (no onClick):
<MigrationProgressCard
  key={mda.mdaId}
  mdaName={mda.mdaName}
  mdaCode={mda.mdaCode}
  stage={mda.stage}
  recordCounts={mda.recordCounts}
  lastActivity={mda.lastActivity ?? undefined}
/>
```

**Data available:** Each card has `mda.mdaId` — the navigation key.

**Navigation target:** `/dashboard/mda/:mdaId`

**Note:** Loan search results (lines 143-178) and exception queue rows (line 231) on this page ARE already clickable — the migration cards are the only gap.

## Tasks / Subtasks

- [x] Task 1: Make Recovery Potential cards clickable (AC: 1, 4, 5)
  - [x] 1.1: In `apps/client/src/pages/dashboard/components/ExecutiveSummaryReport.tsx`, find the Recovery Potential Summary section (around lines 207-226).
  - [x] 1.2: Add a tier-to-route mapping. **Deviation:** the story specified `?classification=OVERDUE` / `?classification=STALLED`, but `FilteredLoanListPage.tsx:52` only reads `searchParams.get('filter')` (it does NOT read a `classification` URL param — `classification` is computed server-side from the `filter` value). Using the literal URLs would route to an empty page. Used the working filter values instead:
    ```typescript
    const TIER_ROUTES: Record<string, string> = {
      'Quick Recovery': '/dashboard/loans?filter=quick-win',
      'Requires Intervention': '/dashboard/loans?filter=overdue',
      'Extended Follow-up': '/dashboard/loans?filter=stalled',
    };
    ```
  - [x] 1.3: Wrapped each tier `<Card>` with `role="button"`, `tabIndex={0}`, `onClick`, `onKeyDown` (Enter/Space), and `cursor-pointer hover:shadow-md transition-shadow` className. Used the shadcn `<Card>` component directly (it forwards `HTMLAttributes<HTMLDivElement>`).
  - [x] 1.4: Added `import { useNavigate } from 'react-router'` at top of file. `navigate` is called both inside `ExecutiveSummaryReport` (recovery cards) and inside `ScorecardTable` (Task 2).

- [x] Task 2: Make MDA Scorecard rows clickable (AC: 2, 4, 5)
  - [x] 2.1: Updated `<TableRow>` elements in `ScorecardTable` with `role="link"`, `tabIndex={0}`, `onClick`, `onKeyDown` (Enter/Space), and `cn('cursor-pointer transition-colors hover:bg-slate-50')` className. Pattern matches `DashboardPage.tsx:511-528` exactly.
  - [x] 2.2: Confirmed `row.mdaId` is available on `MdaScorecardRow` (`packages/shared/src/types/report.ts:71`).
  - [x] 2.3: Chose option (a) — called `useNavigate()` directly inside `ScorecardTable` sub-component. Cleaner than threading `navigate` as a prop.

- [x] Task 3: Pass onClick to Operations Hub migration cards (AC: 3, 4, 5)
  - [x] 3.1: Added `onClick={() => navigate(\`/dashboard/mda/${mda.mdaId}\`)}` to the `MigrationProgressCard` instances at `OperationsHubPage.tsx:98-108`.
  - [x] 3.2: Verified `MigrationProgressCard.tsx:38-52` already implements `cursor-pointer`, `hover:shadow-md`, `role="button"`, `tabIndex={0}`, and `onKeyDown` handler conditionally when `onClick` is provided. No changes needed in the component itself.
  - [x] 3.3: `useNavigate` already imported on `OperationsHubPage.tsx:2`. No new import.

- [x] Task 4: Tests (AC: 6)
  - [x] 4.1: Created `apps/client/src/pages/dashboard/components/ExecutiveSummaryReport.test.tsx` with 11 tests covering: 3 recovery tier card click navigations, Enter + Space keyboard handlers, cursor-pointer + tabIndex assertions, scorecard row click navigation (Top Healthy + Bottom For Review), Enter key from focused row, and cursor-pointer assertion.
  - [x] 4.2: Extended `apps/client/src/pages/dashboard/OperationsHubPage.test.tsx` with 3 new tests under "Migration card navigation (Story 15.0h, UAT #31)": click navigation, Enter key navigation, cursor-pointer class. Disambiguates between migration card and exception row (both render `role="button"` for the same mock MDA name) by also requiring the unique `mdaCode` "MOF" in textContent.
  - [x] 4.3: Ran `pnpm vitest run` in `apps/client` — **711 tests passed across 91 test files (zero regressions)**. Ran `pnpm typecheck` — clean. Ran `pnpm lint` on the 4 changed files — 0 errors, 0 new warnings.

### Review Follow-ups (AI)

Findings from code review 2026-04-07. All items addressed in the same review pass.

- [x] [AI-Review][Medium] Decouple recovery tier client/server contract — promote `tierKey: 'QUICK' | 'INTERVENTION' | 'EXTENDED'` onto `RecoveryTier`, key `TIER_ROUTES` by `tierKey` instead of display `tierName`. Eliminates silent fallback to `/dashboard/loans` when label text drifts. Touches `packages/shared/src/types/report.ts`, `packages/shared/src/validators/reportSchemas.ts`, `apps/server/src/services/executiveSummaryReportService.ts`, `apps/client/src/pages/dashboard/components/ExecutiveSummaryReport.tsx` + test fixtures.
- [x] [AI-Review][Medium] Update story file `Navigation Target Reference` table to match shipped `?filter=overdue` / `?filter=stalled` URLs (was `?classification=OVERDUE` / `?classification=STALLED`) so the spec table no longer contradicts the implementation. [`_bmad-output/implementation-artifacts/15-0h-clickable-cards-reports-drilldown.md:165-167`]
- [x] [AI-Review][Low] Drop the no-op `cn(...)` wrapper around the single-string `className` on the scorecard `<TableRow>`. [`apps/client/src/pages/dashboard/components/ExecutiveSummaryReport.tsx:87`]
- [x] [AI-Review][Low] Add `aria-label` to recovery tier cards and scorecard rows so screen readers announce a concise navigation intent instead of the full card body. [`apps/client/src/pages/dashboard/components/ExecutiveSummaryReport.tsx:75-94, 240-262`]
- [x] [AI-Review][Low] Replace text-content regex filtering of `getAllByRole('button')` with scoped queries (e.g., `data-testid="recovery-tier-card"` per tier) so adding any future button containing the tier name does not flip these tests red. [`apps/client/src/pages/dashboard/components/ExecutiveSummaryReport.test.tsx:175-180`, `apps/client/src/pages/dashboard/OperationsHubPage.test.tsx:132-141`]

## Dev Notes

### All Three Fixes Are Frontend-Only, Minimal Scope

| Fix | File | Lines of Code | Complexity |
|-----|------|---------------|------------|
| Recovery cards | `ExecutiveSummaryReport.tsx` | ~15 lines (mapping + handler) | Low |
| Scorecard rows | `ExecutiveSummaryReport.tsx` | ~10 lines per `<tr>` | Low |
| Ops Hub cards | `OperationsHubPage.tsx` | ~1 line (add `onClick` prop) | Trivial |

### Clickable Element Pattern (Copy-Paste Ready)

From `DashboardPage.tsx:516-532` — the established pattern in this codebase:

```typescript
// For <tr> elements:
role="link"
tabIndex={0}
onClick={() => navigate(`/dashboard/mda/${row.mdaId}`)}
onKeyDown={(e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    navigate(`/dashboard/mda/${row.mdaId}`);
  }
}}
className={cn('border-b transition-colors hover:bg-slate-50', 'cursor-pointer')}

// For <div> card elements:
role="button"
tabIndex={0}
onClick={() => navigate(targetRoute)}
onKeyDown={/* same */}
className="cursor-pointer hover:shadow-md transition-shadow"
```

### Navigation Target Reference

| Source | Target Route | Target Page |
|--------|-------------|-------------|
| Recovery: Quick Recovery | `/dashboard/loans?filter=quick-win` | FilteredLoanListPage |
| Recovery: Requires Intervention | `/dashboard/loans?filter=overdue` | FilteredLoanListPage |
| Recovery: Extended Follow-up | `/dashboard/loans?filter=stalled` | FilteredLoanListPage |
| Scorecard: any MDA row | `/dashboard/mda/:mdaId` | MdaDetailPage |
| Ops Hub: migration card | `/dashboard/mda/:mdaId` | MdaDetailPage |

Note: `FilteredLoanListPage` reads `?filter=` (not `?classification=`) — the `filter` value is mapped server-side to a `LoanClassification`. Routing to `?classification=OVERDUE` would render an empty page. The previous draft of this table is preserved in commit history.

### Files to Touch

| File | Action |
|------|--------|
| `apps/client/src/pages/dashboard/components/ExecutiveSummaryReport.tsx` | Add click handlers to recovery cards + scorecard rows |
| `apps/client/src/pages/dashboard/OperationsHubPage.tsx` | Pass `onClick` prop to `MigrationProgressCard` |

Possibly also:
- `apps/client/src/components/shared/MigrationProgressCard.tsx` — verify it handles `onClick` with keyboard + cursor (may already be implemented)

**No backend changes needed.**

### Architecture Compliance

- **Every number is a doorway (Agreement #11):** Core purpose of this story
- **Keyboard accessibility:** All click targets must support Enter/Space via `onKeyDown`
- **Semantic HTML:** Use `role="link"` for table rows, `role="button"` for card elements

### References

- [Source: `_bmad-output/implementation-artifacts/epic-8-uat-findings-2026-04-06.md` — Findings #16, #17, #31]
- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 15.0h specification, line ~3498]
- [Source: `apps/client/src/pages/dashboard/components/ExecutiveSummaryReport.tsx:48-75, 207-226`]
- [Source: `apps/client/src/pages/dashboard/OperationsHubPage.tsx:98-107`]
- [Source: `apps/client/src/pages/dashboard/DashboardPage.tsx:516-532` — clickable row pattern]
- [Source: `apps/client/src/components/shared/MigrationProgressCard.tsx:20-21` — onClick prop support]

## Dev Agent Record

### Agent Model Used

claude-opus-4-6 (1M context) — BMAD dev-story workflow

### Debug Log References

- `apps/client` — `pnpm vitest run src/pages/dashboard/components/ExecutiveSummaryReport.test.tsx src/pages/dashboard/OperationsHubPage.test.tsx` → 20 tests passed (11 new in `ExecutiveSummaryReport.test.tsx`, 9 in `OperationsHubPage.test.tsx` including 3 new for migration card navigation).
- `apps/client` — `pnpm vitest run` → **711 tests passed across 91 test files**, zero regressions.
- `apps/client` — `pnpm typecheck` → clean.
- root — `pnpm lint <changed-files>` → 0 errors, 0 new warnings on changed files (19 pre-existing warnings in unrelated `apps/server/src/services/autoStopService.test.ts`).

### Completion Notes List

**All 6 ACs satisfied. Zero regressions. Zero backend changes.**

1. **AC 1 (Recovery Potential cards):** Three tier cards (`Quick Recovery`, `Requires Intervention`, `Extended Follow-up`) wrapped with `role="button"`, `tabIndex={0}`, `onClick`, `onKeyDown`, and `cursor-pointer hover:shadow-md transition-shadow`. Navigation via `useNavigate()` from `react-router`.

2. **AC 2 (MDA Scorecard rows):** Both `Top 10 — Healthy` and `Bottom 5 — For Review` tables now have clickable rows. `<TableRow>` elements get `role="link"`, `tabIndex={0}`, `onClick`, `onKeyDown`, and `cursor-pointer transition-colors hover:bg-slate-50`. `useNavigate()` lives inside the `ScorecardTable` sub-component.

3. **AC 3 (Operations Hub migration cards):** Single-line addition — passed `onClick={() => navigate(\`/dashboard/mda/${mda.mdaId}\`)}` to `MigrationProgressCard`. The card component already implemented role/tabIndex/keyboard/cursor when `onClick` is provided.

4. **AC 4 (Keyboard accessibility):** Every clickable element has an `onKeyDown` handler that responds to `Enter` and `Space` and calls `e.preventDefault()` before navigating. Verified by tests.

5. **AC 5 (Visual hover cue):** Cards use `cursor-pointer hover:shadow-md transition-shadow`. Table rows use `cursor-pointer transition-colors hover:bg-slate-50` (matching the established `DashboardPage.tsx:511-528` pattern).

6. **AC 6 (Zero regressions):** Full client test suite passes (711/711). Type-check passes. Lint clean on changed files.

**KEY DEVIATION FROM STORY (please review):**

The story specified the following routes for two of the three Recovery Potential tiers:
- Requires Intervention → `/dashboard/loans?classification=OVERDUE`
- Extended Follow-up → `/dashboard/loans?classification=STALLED`

These URLs **do not work** with `FilteredLoanListPage.tsx`. The page reads `searchParams.get('filter')` (line 52), not `classification`. The classification is then computed internally via `CLASSIFICATION_FILTERS` (lines 35-42, e.g. `'overdue' → 'OVERDUE'`). Using the literal URLs would route to a page that fails the `enabled: !!(filter || classification)` guard in `useFilteredLoans` and shows nothing.

**Used the working filter values:**
- `Quick Recovery → /dashboard/loans?filter=quick-win` (matches story)
- `Requires Intervention → /dashboard/loans?filter=overdue` (was `?classification=OVERDUE`)
- `Extended Follow-up → /dashboard/loans?filter=stalled` (was `?classification=STALLED`)

This honors the story's intent — Team Agreement #11 "every number is a doorway" requires that the destination actually loads. A code comment in `ExecutiveSummaryReport.tsx:14-16` explains the rationale for future readers. The story's `Navigation Target Reference` table (lines 203-209) is also out of sync and should be corrected if the story is referenced in retrospective.

### File List

Modified:
- `apps/client/src/pages/dashboard/components/ExecutiveSummaryReport.tsx` — added `useNavigate` import, `TIER_ROUTES` mapping (keyed by `RecoveryTierKey` after review fix M1); wrapped recovery tier `<Card>`s with click+keyboard handlers + `aria-label` + `data-testid`; made `<TableRow>` elements in `ScorecardTable` clickable with `aria-label` + `data-testid` + navigation to `/dashboard/mda/:mdaId`.
- `apps/client/src/pages/dashboard/OperationsHubPage.tsx` — added `onClick` prop to `MigrationProgressCard` instances (1-line change).
- `apps/client/src/pages/dashboard/OperationsHubPage.test.tsx` — added `userEvent` + `within` + `beforeEach` imports; mocked `useNavigate` to capture navigations; added 3 tests under `Migration card navigation (Story 15.0h, UAT #31)` scoped via `getByRole('region', { name: /Migration Status/i })`.
- `packages/shared/src/types/report.ts` — added `RecoveryTierKey` union and `tierKey` field on `RecoveryTier` (review fix M1).
- `packages/shared/src/index.ts` — re-exported `RecoveryTierKey`.
- `packages/shared/src/validators/reportSchemas.ts` — added `tierKey` enum to `recoveryPotential` Zod schema (review fix M1).
- `apps/server/src/services/executiveSummaryReportService.ts` — emits `tierKey: 'QUICK' | 'INTERVENTION' | 'EXTENDED'` on every `RecoveryTier` (review fix M1).
- `apps/server/src/services/reportPdfGenerators.test.ts` — added `tierKey` to `recoveryPotential` test fixture so the report passes the updated Zod schema.

Created:
- `apps/client/src/pages/dashboard/components/ExecutiveSummaryReport.test.tsx` — 11 tests covering recovery tier cards (3 click navigations, Enter, Space, cursor class, tabIndex via `data-testid`) and MDA scorecard rows (Top Healthy click, Bottom For Review click, Enter key from focused row, cursor class). Mock fixture updated to include `tierKey` on each recovery tier.

## Change Log

| Date       | Change                                                                                                                              |
|------------|-------------------------------------------------------------------------------------------------------------------------------------|
| 2026-04-07 | Story 15.0h implemented — Recovery Potential cards, MDA Scorecard rows, and Operations Hub migration cards now navigate on click + keyboard. UAT #16, #17, #31 closed. 14 new client tests; 711/711 client tests passing; lint + typecheck clean. Status → review. |
| 2026-04-07 | Code review (BMAD adversarial). Findings: 0H 2M 3L. Fixes applied: M1 promoted `RecoveryTierKey` (`'QUICK' \| 'INTERVENTION' \| 'EXTENDED'`) onto shared `RecoveryTier` + Zod schema, server emits `tierKey`, client `TIER_ROUTES` keyed by `tierKey` (no more silent fallback on label drift); M2 corrected `Navigation Target Reference` table to match shipped `?filter=` URLs; L1 dropped no-op `cn()` wrapper + import; L2 added `aria-label` to recovery cards and scorecard rows; L3 replaced text-content regex tests with `data-testid` lookups for recovery cards and `getByRole('region', { name: /Migration Status/i })` scoping for migration card tests. Re-verified: client 711/711, server 1045/1045, typecheck + lint clean. Status → done. |
