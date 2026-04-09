# Story 15.0j: Quick Fixes Bundle — MetricHelp, Empty States, Data Hygiene

Status: done

## Story

As **any user**,
I want MetricHelp tooltips explaining metric discrepancies, contextual empty state messages, correct data hygiene, and polished layouts,
So that every number has context and every empty state has guidance.

**Origin:** UAT Findings #3, #4, #6, #7, #9, #11, #12, #13, #14, #15, #23, #24 (Low-Medium) from E8 retro. 12 individual fixes + 1 PO-requested feature (sidebar calculator) bundled into one story.

**Priority:** MEDIUM — UX polish and data hygiene. No showstoppers, but each fix improves trust and clarity.

## Acceptance Criteria

1. **Given** the purge-demo-data script is run, **When** it completes, **Then** the `scheme_config` table's `scheme_fund_total` entry is cleared (not preserved with stale ₦500M demo value). (#3)

2. **Given** the Active Loans metric card on the Dashboard, **When** MetricHelp is displayed, **Then** it explains: "Loans in active repayment (ON_TRACK, OVERDUE, STALLED). Differs from Loans in Window which includes COMPLETED loans." (#4)

3. **Given** the Monthly Recovery metric shows ₦0, **When** no PAYROLL submissions exist (migration-only data), **Then** a subtitle "Awaiting first submission" appears below the value. (#6)

4. **Given** the Migration page hero cards, **When** MetricHelp is displayed for "Total Staff Migrated" and "Baselines Established", **Then** tooltips explain: "92 unique staff may have 171 baseline records if some staff have multiple loans." (#7)

5. **Given** the correction worksheet is downloaded, **When** it renders as Excel, **Then** it includes Period Month and Period Year columns. (#9)

6. **Given** the Breadcrumb component on MDA Detail page, **When** the page loads for the first time (cold cache), **Then** it shows the MDA name (not a truncated UUID). (#11)

7. **Given** the MDA Progress "4 of 6" display on Migration Progress cards, **When** MetricHelp is shown, **Then** it explains the numerator (baselined) and denominator (total flagged records). (#12)

8. **Given** the Reports page Scheme Overview grid, **When** rendered, **Then** the Fund Available card aligns correctly with siblings (no CSS misalignment). (#13)

9. **Given** the Executive Summary Report Top Variances section, **When** more than 5 variances exist, **Then** a "View All" button or expanded limit is available (not hardcoded to 5). (#14)

10. **Given** the MoM Trend section in the Executive Summary Report, **When** rendered, **Then** TrendIndicator components use vertical stacking (label above value+trend) with 2-column grid on desktop. (#15)

11. **Given** the MDA Detail page Submission History section, **When** no submissions exist, **Then** it shows: "No monthly submissions yet. Submissions will appear here once the MDA submits their first monthly return." (#23)

12. **Given** the Pre-Submission Checkpoint Approaching Retirement and Pending Events sections, **When** empty, **Then** each shows a contextual message explaining when data will appear. (#24)

13. **Given** any authenticated user (AG, Dept Admin, MDA Officer), **When** they click the calculator icon in the sidebar, **Then** a collapsible Naira-aware calculator panel expands with basic arithmetic (+, −, ×, ÷), auto-formatted ₦ output with commas (e.g., `₦1,375,000.00`), and a copy-to-clipboard button on the result. (PO request)

## Fix Register — All 12 Items

### Category A: Data Hygiene (3 fixes)

#### Fix #3: Stale ₦500M scheme_fund_total survives purge

**File:** `apps/server/scripts/purge-demo-data.ts`
**Problem:** `scheme_config` is in the PRESERVED list (lines 87-90, 138-141). The stale demo value ₦500M persists after purge.
**Fix:** Add a selective DELETE for the demo scheme_fund_total value during purge:
```typescript
// After truncating financial tables, clear demo scheme config
await db.delete(schemeConfig).where(eq(schemeConfig.key, 'scheme_fund_total'));
```
Or move `scheme_config` to the truncated tables list. Prefer selective delete — preserves other scheme config entries that may be real.

#### Fix #9: Correction worksheet missing period column

**File:** `apps/server/src/services/correctionWorksheetService.ts`
**Lines:** 44-63 (SELECT), 72-92 (mapping)
**Problem:** `periodMonth` and `periodYear` not in SELECT or Excel column mapping.
**Fix:**
1. Add to SELECT (line ~55): `periodMonth: migrationRecords.periodMonth, periodYear: migrationRecords.periodYear`
2. Add to Excel mapping (line ~80): `'Period': r.periodYear && r.periodMonth ? \`${r.periodYear}-${String(r.periodMonth).padStart(2, '0')}\` : ''`

#### Fix #13: Reports page Fund Available alignment

**File:** `apps/client/src/pages/dashboard/components/ExecutiveSummaryReport.tsx`
**Lines:** 114-134 (Scheme Overview grid)
**Problem:** `grid-cols-2 md:grid-cols-4` doesn't enforce equal heights. Fund Available card misaligns when content wraps.
**Fix:** Add `auto-rows-fr` to grid and `h-full` to each child:
```typescript
<div className="grid grid-cols-2 md:grid-cols-4 auto-rows-fr gap-4">
  <div className="flex flex-col justify-start h-full"> ... </div>
```
Note: The stale ₦500M value is fixed by Fix #3 (purge script) — this fix is layout only.

---

### Category B: MetricHelp Tooltips (3 fixes)

#### Fix #4: Active Loans vs Loans in Window unexplained

**Files:**
- `packages/shared/src/constants/metricGlossary.ts` — lines 186-212
- `apps/client/src/pages/dashboard/DashboardPage.tsx` — line ~150

**Problem:** Active Loans card has no `helpKey` or guidance explaining why 168 ≠ 171.
**Fix:**
1. Update `metricGlossary.ts` `activeLoans` entry (~line 186) — add guidance: "Excludes COMPLETED loans. Differs from Loans in Window which includes all loans with activity in the 60-month window."
2. Add `helpKey="dashboard.activeLoans"` to the Active Loans `HeroMetricCard` in `DashboardPage.tsx` if not already present.

#### Fix #7: Staff Migrated vs Baselines unexplained

**Files:**
- `packages/shared/src/constants/metricGlossary.ts` — add entries
- `apps/client/src/pages/dashboard/MigrationPage.tsx` — lines 65-88

**Problem:** No glossary entries for "Total Staff Migrated" or "Baselines Established". No helpKeys on the cards.
**Fix:**
1. Add `MIGRATION_HELP.totalStaffMigrated` to glossary: "Count of unique staff members. May differ from baseline count if staff have multiple loans."
2. Add `MIGRATION_HELP.baselinesEstablished` to glossary: "Count of individual baseline records (one per staff-loan combination)."
3. Add `helpKey` props to both `HeroMetricCard` components in `MigrationPage.tsx`.

#### Fix #12: MDA Progress "4 of 6" meaning unclear

**Files:**
- `packages/shared/src/constants/metricGlossary.ts` — lines 354-358
- `apps/client/src/components/shared/MigrationProgressCard.tsx` — lines 114-117

**Problem:** "Baselines: 4/6" has no tooltip. Users don't know what the denominator represents.
**Fix:**
1. Update `reviewProgress` glossary entry to explain: "Baselined records vs total flagged records for this MDA."
2. Add `<MetricHelp>` component inline next to the "Baselines: X/Y" text in `MigrationProgressCard.tsx`.

---

### Category C: Empty State Messages (2 fixes)

#### Fix #23: Submission History empty — no context

**File:** `apps/client/src/pages/dashboard/MdaDetailPage.tsx`
**Lines:** 229-233
**Problem:** Shows generic "No submission history available."
**Fix:** Replace with: "No monthly submissions yet. Submissions will appear here once the MDA submits their first monthly return."

#### Fix #24: Approaching Retirement + Pending Events — no empty state

**File:** `apps/client/src/pages/dashboard/components/PreSubmissionCheckpoint.tsx`
**Problem:** Collapsible sections for Approaching Retirement and Pending Events render empty content area with no message.
**Fix:** Add contextual empty states inside each section:
- Approaching Retirement: "No staff approaching retirement in the next 6 months."
- Pending Events: "No pending employment events. New events will appear here when filed."

---

### Category D: UX/Layout (4 fixes)

#### Fix #6: Monthly Recovery = ₦0 with no explanation

**File:** `apps/client/src/pages/dashboard/DashboardPage.tsx`
**Lines:** 225-234 (Monthly Recovery card area)
**Problem:** When recovery = 0 (migration-only, no PAYROLL entries), no explanation shown.
**Fix:** Add conditional text below the Monthly Recovery `HeroMetricCard`. Note: `HeroMetricCard` does NOT have a `subtitle` prop — render the text as a sibling element below the card, not inside it:
```typescript
<div>
  <HeroMetricCard label="Monthly Recovery" ... />
  {(metrics.data?.monthlyRecovery === '0' || metrics.data?.monthlyRecovery === '0.00') && (
    <p className="mt-1 text-xs text-text-secondary text-center">Awaiting first submission</p>
  )}
</div>
```
This may require wrapping the card in a `<div>` container. Check how the grid parent handles this — may need to ensure the wrapper div doesn't break `grid-cols-4` layout.

#### Fix #11: Breadcrumb shows UUID on first load

**File:** `apps/client/src/components/layout/Breadcrumb.tsx`
**Lines:** 119-123
**Problem:** `queryClient.getQueryData<MdaSummary>(['mda', mdaId])` returns undefined on cold cache. Fallback shows `MDA <UUID>`.
**Fix:** Use `useQuery` to actively fetch the MDA name when a `mdaId` param is present, not just read from cache:
```typescript
// Add at component level:
const mdaIdParam = /* extract from route params */;
const mdaQuery = useMdaDetail(mdaIdParam ?? '');
// In getMdaName():
return mdaQuery.data?.name ?? queryClient.getQueryData<MdaSummary>(['mda', id])?.name ?? 'Loading...';
```
This ensures the breadcrumb shows "Loading..." briefly then resolves to the MDA name, never a UUID.

**Tradeoff note:** This adds one `GET /api/mdas/:id/summary` API call per MDA navigation on cold cache. Acceptable — `useMdaDetail` has `staleTime: 30_000`, so subsequent navigations within the same MDA within 30 seconds won't re-fetch. The call is likely already being made by `MdaDetailPage` anyway, so TanStack Query deduplication will prevent a double-fetch on that page.

#### Fix #14: Top Variances hardcoded to 5

**Files:**
- `apps/server/src/services/executiveSummaryReportService.ts` — line ~496
- `apps/client/src/pages/dashboard/components/ExecutiveSummaryReport.tsx` — lines 259-287

**Problem:** `.limit(5)` is hardcoded. No pagination or "View All".
**Fix:**
1. Backend: Change hardcoded `.limit(5)` to `.limit(10)` (increase visible count from 5 to 10).
2. Frontend: Add a "View Full Report" link below the table that navigates to `/dashboard/reports` (ReportsPage) — the VarianceReport is a **tab** inside ReportsPage (`<TabsContent value="variance">`), not a standalone route. **No `/dashboard/reports/variance` route exists.** If tab auto-selection is desired, add `?tab=variance` URL param support to ReportsPage. Otherwise, simply increasing the limit from 5 to 10 may be sufficient without a navigation link.

#### Fix #15: MoM Trend section cramped layout

**File:** `apps/client/src/pages/dashboard/components/ExecutiveSummaryReport.tsx`
**Lines:** 289-300 (grid), and the `TrendIndicator` sub-component (~lines 20-46)
**Problem:** `grid-cols-2 md:grid-cols-4` with inline `flex items-center` makes content cramped.
**Fix:**
1. Change grid to: `grid grid-cols-1 md:grid-cols-2 gap-6`
2. Change TrendIndicator to vertical layout: `flex flex-col gap-1` — label on top, value + trend icon below.

---

## Tasks / Subtasks

- [x] Task 1: Data Hygiene — purge script + correction worksheet + report alignment (#3, #9, #13)
  - [x] 1.1: Fix purge script (`apps/server/scripts/purge-demo-data.ts`) — add selective delete of `scheme_fund_total` from `scheme_config`
  - [x] 1.2: Fix correction worksheet (`apps/server/src/services/correctionWorksheetService.ts`) — add `periodMonth`/`periodYear` to SELECT and Excel mapping
  - [x] 1.3: Fix report grid alignment (`ExecutiveSummaryReport.tsx:114-134`) — add `auto-rows-fr` and `h-full`

- [x] Task 2: MetricHelp tooltips — glossary entries + helpKey props (#4, #7, #12)
  - [x] 2.1: Update `packages/shared/src/constants/metricGlossary.ts` — add/update entries for `activeLoans`, `totalStaffMigrated`, `baselinesEstablished`, `reviewProgress`
  - [x] 2.2: Add `helpKey` props to metric cards in `DashboardPage.tsx` (Active Loans) and `MigrationPage.tsx` (Staff Migrated, Baselines)
  - [x] 2.3: Add `<MetricHelp>` to `MigrationProgressCard.tsx` baseline count display

- [x] Task 3: Empty state messages (#23, #24)
  - [x] 3.1: Update `MdaDetailPage.tsx:229-233` — replace generic empty message
  - [x] 3.2: Update `PreSubmissionCheckpoint.tsx` — add empty state messages for Approaching Retirement and Pending Events sections (updated `vocabulary.ts` constants which `CheckpointSection` already consumes)

- [x] Task 4: UX/Layout fixes (#6, #11, #14, #15)
  - [x] 4.1: Add "Awaiting first submission" subtitle to Monthly Recovery card when = 0 (`DashboardPage.tsx`)
  - [x] 4.2: Fix Breadcrumb UUID fallback (`Breadcrumb.tsx:119-123`) — use `useMdaDetail` for active fetch
  - [x] 4.3: Increase Top Variances limit from 5 to 10 (`executiveSummaryReportService.ts:496`); also added "View full variance report →" link navigating to `/dashboard/reports` (the VarianceReport tab inside ReportsPage)
  - [x] 4.4: Restack MoM Trend to `grid-cols-1 md:grid-cols-2` + vertical `TrendIndicator` (`ExecutiveSummaryReport.tsx:289-300`)

- [x] Task 5: Sidebar Naira Calculator (AC: 13)
  - [x] 5.1: Create `apps/client/src/components/sidebar/SidebarCalculator.tsx` — collapsible panel with input, `=` button + Enter key, Naira-formatted result, copy-to-clipboard, Clear button, and 4×4 keypad (0-9, +, −, ×, ÷, ., (, ), backspace, =)
  - [x] 5.2: Wire into `DashboardLayout.tsx` — visible to all authenticated roles, hidden when sidebar is collapsed to icons
  - [x] 5.3: Uses `formatNaira` for ₦ display and `Decimal.js` for precise arithmetic — no floating-point errors on financial values
  - [x] 5.4: Hand-written recursive-descent parser (NO `eval()`) supporting +, −, ×, ÷, *, /, parentheses, unary minus, and standard operator precedence
  - [x] 5.5: Component test added — 21 tests covering parser correctness (incl. `0.1 + 0.2 = 0.3` precision, division-by-zero, parentheses, precedence) and component behaviour (Enter eval, button eval, clear, keypad append, copy-to-clipboard, compact mode)

- [x] Task 6: Tests
  - [x] 6.1: Added assertion to `mdaReviewService.integration.test.ts:302` verifying the `Period` column is present in the generated correction worksheet
  - [x] 6.2: SidebarCalculator component test (covered by Task 5.5)
  - [x] 6.3: Full test suites pass — client: 93 files / 741 tests; server unit: 79 files / 1045 tests; server integration: 42 files / 620 tests; typecheck clean across client/server/shared

### Review Follow-ups (AI)

Adversarial code review run on 2026-04-08 surfaced 15 findings (0 CRITICAL, 0 HIGH, 5 MEDIUM, 10 LOW) plus a file-list reconciliation gap. Each is listed below at its original severity. Items marked [x] were fixed in the same review session; items marked [ ] are deferred with a justification.

- [x] [AI-Review][MEDIUM] AC3 brittle string comparison on `monthlyRecovery` — replaced `=== '0' || === '0.00'` with `Number(metrics.data?.monthlyRecovery ?? 0) === 0`. Now immune to backend format drift (`'0.000'`, numeric `0`, etc.). [`apps/client/src/pages/dashboard/DashboardPage.tsx:240`]
- [x] [AI-Review][MEDIUM] Active Loans MetricHelp inconsistency between Dashboard and Reports — `ExecutiveSummaryReport.tsx` was hardcoding an inline definition without the new "Differs from Loans in Window" guidance. Replaced with `metric="dashboard.activeLoans"` so both views now read from the same updated glossary entry. [`apps/client/src/pages/dashboard/components/ExecutiveSummaryReport.tsx:151`]
- [x] [AI-Review][MEDIUM] `create-bir-officer.ts` undeclared + plaintext password — RESOLVED by **deleting** the file. The BIR officer (`bir.officer@oyo.gov.ng`) is already part of the seeded credentials in both `apps/server/src/db/seed-demo.ts:166` and `apps/server/src/db/devAutoSeed.ts:53`, with proper MDA mapping via `mdaMap.get('BIR')`. The standalone script was a temporary one-off helper and is now genuinely redundant. No password ever lands in git history.
- [x] [AI-Review][MEDIUM] File List documentation count drift — Dev Notes "Files to Touch" table claimed "13 files (11 modified + 2 new), 13 fixes" but the actual File List section enumerates 17 files (15 modified + 2 new). Updated the claim to match reality.
- [x] [AI-Review][MEDIUM] SidebarCalculator `compact` mode is dead code — RESOLVED by wiring it into the collapsed sidebar. Removed the `group-data-[collapsible=icon]:hidden` wrapper in `DashboardLayout.tsx` and changed the calculator render to two siblings: full mode shown when sidebar is expanded, compact icon-only mode shown when collapsed. Used Tailwind `group-data-[collapsible=icon]:*` modifiers so the toggle is purely CSS-driven (no React state read of sidebar collapse state required). MDA officers and admins can now access the calculator from the collapsed sidebar too. [`apps/client/src/components/layout/DashboardLayout.tsx:241-247`]
- [x] [AI-Review][LOW] SidebarCalculator parser doesn't accept scientific notation — DOCUMENTED as an intentional scope guard in the JSDoc. Adding `1e6` support would require lexer changes and isn't useful for a basic naira calculator (users type `1000000` not `1e6`). The parser now explicitly notes this in its grammar comment. [`apps/client/src/components/sidebar/SidebarCalculator.tsx:34-46`]
- [x] [AI-Review][LOW] SidebarCalculator parser allows multiple decimal points in a number literal — added lexer-level guard that rejects a second `.` within a single number literal with a clearer error message ("Invalid number: multiple decimal points"). [`apps/client/src/components/sidebar/SidebarCalculator.tsx:117-126`]
- [x] [AI-Review][LOW] Test gap: parser parens-with-decimals + nested parens precedence — added `evaluates nested parentheses with decimals preserving precision` test that asserts `(0.1 + 0.2) * 10 = 3` and `1 + (2 * (3 + 4)) = 15`. [`apps/client/src/components/sidebar/SidebarCalculator.test.tsx`]
- [x] [AI-Review][LOW] Test gap: localStorage persistence not exercised — added `persists open state to localStorage` test that asserts toggling the open state writes to `vlprs.sidebarCalculator.open`. [`apps/client/src/components/sidebar/SidebarCalculator.test.tsx`]
- [x] [AI-Review][LOW] Test gap: Period column value not asserted — strengthened the existing assertion from `expect(firstRow).toHaveProperty('Period')` to also check the formatted value (`expect(firstRow['Period']).toBe('2026-03')`). The NULL branch (`''` when periodMonth/Year are null) is a trivial ternary; restructuring the seed data to add a NULL-period record was disproportionate to the value. [`apps/server/src/services/mdaReviewService.integration.test.ts`]
- [x] [AI-Review][LOW] Breadcrumb cache key churn — `useMdaDetail('')` was creating a `['mda', '']` cache entry on every non-MDA route. Hook is now called with `undefined` (via `useMdaDetail` accepting `string | undefined`) so no cache entry is created when the route has no `:mdaId`. [`apps/client/src/components/layout/Breadcrumb.tsx:125`]
- [x] [AI-Review][LOW] `purge-demo-data.ts` dry-run "PRESERVED" text was misleading about scheme_config — clarified the bullet to read "scheme_config (all keys EXCEPT scheme_fund_total)" so users see at a glance that one key is selectively removed. [`apps/server/scripts/purge-demo-data.ts:102`]
- [x] [AI-Review][LOW] Test mock pollution: `SidebarCalculator` test stubbed `navigator.clipboard.writeText` via global `Object.assign` — RESOLVED by mocking the `useCopyToClipboard` hook itself with `vi.mock('@/hooks/useCopyToClipboard', ...)`. The test now asserts the hook was called with the formatted result and never touches `navigator`, so there's no global state to clean up. The dedicated `useCopyToClipboard.test.ts` keeps its navigator-stubbing pattern (with proper `beforeEach`/`afterEach` save+restore) because that test specifically exercises the navigator integration. [`apps/client/src/components/sidebar/SidebarCalculator.test.tsx`]
- [x] [AI-Review][LOW] Breadcrumb fallback path uses imperative `queryClient.getQueryData` for non-route MDA ids — RESOLVED by deleting the dead code. `buildCrumbs` only invokes `getMdaName` when `params.mdaId === segment` (see `Breadcrumb.tsx:84`), so the function is provably only called with the route's own `:mdaId`. The active `mdaQuery` is always the right one. Removed the cache-fallback branch, the unused `MdaSummary` import, and tightened the function to: active data → loading placeholder → UUID stub. [`apps/client/src/components/layout/Breadcrumb.tsx:113-141`]
- [x] [AI-Review][LOW] AC10 grid breakpoint: dev shipped `md:grid-cols-2` (≥768px) but AC says "2-column grid on desktop" — RESOLVED by bumping the breakpoint to `lg:grid-cols-2` (≥1024px) so it kicks in on actual desktop widths. Tablet now sees the same single-column stack as mobile, which still respects the AC's primary intent ("not cramped") because the new vertical `TrendIndicator` layout prevents the original cramped horizontal layout regardless of column count. [`apps/client/src/pages/dashboard/components/ExecutiveSummaryReport.tsx:356`]

### Review Follow-ups (AI 2026-04-09)

Second adversarial code review run on 2026-04-09 surfaced 10 findings (1 HIGH, 4 MEDIUM, 5 LOW) plus a re-opened file-list reconciliation FAIL. All items below were fixed in the same review session unless marked deferred.

- [x] [AI-Review][HIGH] SidebarCalculator compact mode is still broken — the previous "fix" only added an icon button whose `onClick` toggled a local `useState` that the early-return JSX never read. Two separate `<SidebarCalculator>` instances also had independent React state, so toggling compact never propagated to full mode. RESOLVED by (a) refactoring the calculator state (`open`, `expression`, `result`, `error`) into a module-level pub/sub store consumed via `useSyncExternalStore`, so both instances read the same source of truth, and (b) wrapping compact mode in a Radix `<Popover>` whose content renders the same `CalculatorPanel` UI the full mode renders. Clicking the compact icon now actually shows a usable calculator. [`apps/client/src/components/sidebar/SidebarCalculator.tsx`]
- [x] [AI-Review][MEDIUM] File List omits `useMdaData.ts` — the AI Review #11 fix changed the hook signature and queryKey but the story File List was never updated. RESOLVED by adding `apps/client/src/hooks/useMdaData.ts` to the Client section of the File List (and to the Files-to-Touch table) and bumping the count.
- [x] [AI-Review][MEDIUM] `purge-demo-data.ts` was mislabeled as "modified" — git history shows the file has never been tracked (the entire `apps/server/scripts/` directory is untracked). RESOLVED by reclassifying it as a NEW file in the File List, with a note that it carries Fix #3 modifications applied to the previously-uncommitted Story 11.0a script.
- [x] [AI-Review][MEDIUM] Dev Notes file count was internally inconsistent — header said "17 files (15 modified + 2 new)" but the enumerated list contained 16 files. With `useMdaData.ts` added (M1) and `purge-demo-data.ts` reclassified as new (M2), the corrected total is **17 files (14 modified + 3 new)**. RESOLVED.
- [x] [AI-Review][MEDIUM] SidebarCalculator state desync — root cause for HIGH above: each instance had its own React state and only WROTE to localStorage in `useEffect`, never reading from it after mount. RESOLVED by the module-level `useSyncExternalStore` store described above; both instances now read+write the same external snapshot and re-render in lockstep.
- [x] [AI-Review][LOW] `MIGRATION_HELP.reviewProgress` description contradicted itself — first sentence said denominator = "total flagged"; second sentence said denominator = "awaiting review". RESOLVED by dropping the "awaiting review" qualifier so both sentences agree. [`packages/shared/src/constants/metricGlossary.ts:355-359`]
- [x] [AI-Review][LOW] AI Review #11 fix only helped the Breadcrumb caller — `MdaOfficerDashboard.tsx:31` still passed `userMdaId ?? ''`, which converts `undefined` → `''` and the new `mdaId ?? '__none__'` guard does NOT fire on empty string. RESOLVED by passing `userMdaId` directly (the hook now accepts `string | undefined`). [`apps/client/src/pages/dashboard/MdaOfficerDashboard.tsx:31`]
- [ ] [AI-Review][LOW] `apps/server/scripts/` is entirely untracked — process risk beyond this story. DEFERRED. The directory has lived as uncommitted local helpers since Story 11.0a. Cleaning it up (commit or `.gitignore` everything) is out-of-scope for 15.0j and should be a separate hygiene ticket. Story 15.0j commits `purge-demo-data.ts` for the first time as part of this work.
- [x] [AI-Review][LOW] `ExecutiveSummaryReport.test.tsx` not updated for any of the 3 fixes that touched the file (#13/#14/#15). RESOLVED by adding a click test that asserts the new "View full variance report →" button navigates to `/dashboard/reports`. [`apps/client/src/pages/dashboard/components/ExecutiveSummaryReport.test.tsx`]
- [x] [AI-Review][LOW] SidebarCalculator test gap: cross-instance localStorage sync not exercised — RESOLVED by adding a test that mounts both compact and full modes inside the same render and asserts that toggling the popover from compact mode also opens the full-mode panel via the shared store. [`apps/client/src/components/sidebar/SidebarCalculator.test.tsx`]

## Dev Notes

### Files to Touch (Complete List)

| File | Fixes |
|------|-------|
| `apps/server/scripts/purge-demo-data.ts` | **NEW (committed by this story)** — Fix #3 applied to a previously-uncommitted Story 11.0a script |
| `apps/server/src/services/correctionWorksheetService.ts` | #9 — add period columns |
| `apps/server/src/services/executiveSummaryReportService.ts` | #14 — increase limit to 10 |
| `packages/shared/src/constants/metricGlossary.ts` | #4, #7, #12 — add/update glossary entries (+ AI Review L1) |
| `packages/shared/src/constants/vocabulary.ts` | #24 — contextual checkpoint empty-state copy |
| `apps/client/src/pages/dashboard/DashboardPage.tsx` | #4 (helpKey), #6 (awaiting submission) |
| `apps/client/src/pages/dashboard/MigrationPage.tsx` | #7 — add helpKeys to hero cards |
| `apps/client/src/pages/dashboard/MdaDetailPage.tsx` | #23 — empty state message |
| `apps/client/src/pages/dashboard/MdaOfficerDashboard.tsx` | AI Review L2 — pass `userMdaId` directly to `useMdaDetail` |
| `apps/client/src/pages/dashboard/components/ExecutiveSummaryReport.tsx` | #13 (grid), #14 (View All button), #15 (MoM layout) |
| `apps/client/src/components/shared/MigrationProgressCard.tsx` | #12 — add MetricHelp inline |
| `apps/client/src/components/layout/Breadcrumb.tsx` | #11 — fix UUID fallback |
| `apps/client/src/hooks/useMdaData.ts` | #11 — accept `string \| undefined`, stable cache key |
| `apps/client/src/components/sidebar/SidebarCalculator.tsx` | **NEW** — Naira-aware calculator with shared store + popover compact mode (AI Review H1/M4) |
| `apps/client/src/components/layout/DashboardLayout.tsx` | Wire calculator into sidebar |

**19 files (16 modified + 3 new), 13 fixes. No database migrations.** The table above lists 13 modified production files + 2 new production files (`purge-demo-data.ts`, `SidebarCalculator.tsx`). Add 4 test files — 3 modified (`mdaReviewService.integration.test.ts`, `PreSubmissionCheckpoint.test.tsx`, `ExecutiveSummaryReport.test.tsx`) and 1 new (`SidebarCalculator.test.tsx`) — to reach the 19-file total. `purge-demo-data.ts` lived locally as an uncommitted Story 11.0a artifact and is being committed for the first time by this story with Fix #3 applied, so it is counted as **new** rather than modified.

### Execution Order Suggestion

Group by file to minimize context switches:
1. Server files first: purge script, correction worksheet, report service
2. Shared package: metricGlossary.ts
3. Client pages: DashboardPage, MigrationPage, MdaDetailPage
4. Client components: PreSubmissionCheckpoint, ExecutiveSummaryReport, MigrationProgressCard, Breadcrumb

### Sidebar Calculator Design Notes

**Naira-aware:** Result auto-formats using the existing `formatNaira` utility so output matches every other ₦ display in the system. Uses `Decimal.js` for precision — no floating-point errors on financial values.

**Expression parsing:** Safe arithmetic parser (NO `eval()`). Supports: `+`, `−`, `×`/`*`, `÷`/`/`, parentheses, decimal points. Standard operator precedence (× and ÷ before + and −).

**UX:** Collapsible sidebar section with calculator icon (lucide `Calculator`). Persists open/closed state in `localStorage`. Keyboard input supported alongside optional click keypad. Result has one-click copy via existing `useCopyToClipboard` hook (Story 7.0e).

**Scope guard:** This is a basic arithmetic calculator, NOT a loan amortization tool. No interest calculation, no tenure computation — those are handled by the system's computation engine.

### Architecture Compliance

- **Every number is a doorway (Agreement #11):** Top Variances "View All" creates the doorway
- **Empty states are UX (Agreement #13):** Fixes #23, #24 directly implement this agreement
- **Non-punitive vocabulary:** All empty state messages use neutral, helpful language

### References

- [Source: `_bmad-output/implementation-artifacts/epic-8-uat-findings-2026-04-06.md` — Findings #3,4,6,7,9,11,12,13,14,15,23,24]
- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 15.0j specification, line ~3514]
- [Source: `apps/server/scripts/purge-demo-data.ts` — purge preserved list]
- [Source: `apps/server/src/services/correctionWorksheetService.ts:44-92` — worksheet generation]
- [Source: `apps/server/src/services/executiveSummaryReportService.ts:496` — .limit(5)]
- [Source: `packages/shared/src/constants/metricGlossary.ts` — metric definitions]
- [Source: `apps/client/src/components/layout/Breadcrumb.tsx:119-123` — UUID fallback]
- [Source: `apps/client/src/pages/dashboard/components/ExecutiveSummaryReport.tsx:114-300` — report layout]

## Dev Agent Record

### Agent Model Used

claude-opus-4-6 (1M context)

### Debug Log References

- Client typecheck: clean
- Server typecheck: clean
- Shared package build: clean
- Client tests: 93 files / 741 tests pass (PreSubmissionCheckpoint test updated to match new copy)
- Server unit tests: 79 files / 1045 tests pass
- Server integration tests: 42 files / 620 tests pass (initial run hit a known intermittent ledgerService flake — re-run cleaned up automatically; the modified `mdaReviewService.integration.test.ts` correction worksheet round-trip test still passes with the new `Period` column assertion)

### Completion Notes List

**Story 15.0j — Quick Fixes Bundle** addresses 12 individual UAT findings (Low–Medium severity) plus the PO-requested sidebar Naira calculator, all bundled into one story per the 14-prep-story plan from the Epic 8 retrospective.

**Data Hygiene (Category A)**
- Fix #3 — `purge-demo-data.ts` now selectively deletes the `scheme_fund_total` row from `scheme_config` (was on the PRESERVED list, leaving the stale ₦500M demo value visible on Reports → Fund Available). The dry-run summary lists the row count, and the live purge logs the count under "Summary of removed records". Other `scheme_config` rows are still preserved — the delete is keyed on `eq(schemeConfig.key, 'scheme_fund_total')`.
- Fix #9 — `correctionWorksheetService.ts` now SELECTs `periodMonth`/`periodYear` and renders a `Period` column (`YYYY-MM`) in the Excel "Corrections" sheet, so reviewers know which reporting month a flagged record belongs to without cross-referencing the upload.
- Fix #13 — `ExecutiveSummaryReport.tsx` Scheme Overview grid now uses `auto-rows-fr` and each child wraps its content in `flex flex-col justify-start h-full`, so Fund Available aligns vertically with siblings even when card content wraps.

**MetricHelp Tooltips (Category B)**
- Fix #4 — `DASHBOARD_HELP.activeLoans` glossary entry rewritten to explicitly explain the difference vs Loans in Window. `DashboardPage.tsx` Active Loans `HeroMetricCard` now passes `helpKey="dashboard.activeLoans"` (was missing).
- Fix #7 — Added `MIGRATION_HELP.totalStaffMigrated` and `MIGRATION_HELP.baselinesEstablished` glossary entries. Added `helpKey` props to both hero cards on `MigrationPage.tsx`. The "92 unique staff = 171 baselines" mismatch now has a one-line explanation in the tooltip.
- Fix #12 — `MIGRATION_HELP.reviewProgress` rewritten to explain the numerator/denominator. `MigrationProgressCard.tsx` now renders `<MetricHelp metric="migration.reviewProgress" />` inline next to the "Baselines: X/Y" line.

**Empty State Messages (Category C)**
- Fix #23 — `MdaDetailPage.tsx` submission history empty state copy replaced with "No monthly submissions yet. Submissions will appear here once the MDA submits their first monthly return."
- Fix #24 — Updated three `CHECKPOINT_EMPTY_*` constants in `vocabulary.ts`. The existing `CheckpointSection` component already consumes these and renders them inside an empty-state callout, so updating the constants automatically reaches all three sections (Approaching Retirement, Zero Deduction Review, Pending Events). The Approaching Retirement and Pending Events sections now have the contextual messages required by the AC; the Zero Deduction copy gained a trailing period for consistency.

**UX/Layout (Category D)**
- Fix #6 — `DashboardPage.tsx` now renders an "Awaiting first submission" subtitle below the Monthly Recovery card when `metrics.data.recoveryPeriod` is missing AND `monthlyRecovery` is `'0'`/`'0.00'`. Sits inside the existing wrapper `<div>` so the parent grid layout is unaffected.
- Fix #11 — `Breadcrumb.tsx` now imports `useMdaDetail` and actively fetches the MDA name when `params.mdaId` is set. Falls back to "Loading…" briefly while the query is pending, then resolves to the real name. The truncated UUID fallback (`MDA <UUID>`) is only used when no `mdaId` route param matches the segment being labelled. TanStack Query deduplication means this does not cause double-fetch on `MdaDetailPage` (same `staleTime: 30_000`, same query key).
- Fix #14 — `executiveSummaryReportService.ts` `getTopVariancesByMagnitude` limit raised from `5` to `10`. `ExecutiveSummaryReport.tsx` now also renders a "View full variance report →" button below the table that navigates to `/dashboard/reports` (the VarianceReport tab — confirmed there is no standalone `/dashboard/reports/variance` route).
- Fix #15 — `TrendIndicator` component restacked from horizontal `flex items-center` to vertical `flex flex-col gap-1`: label on top, value+trend icon+percent below. The MoM Trend grid changed from `grid-cols-2 md:grid-cols-4` to `grid-cols-1 md:grid-cols-2`, giving each indicator more room and removing the cramped horizontal layout.

**Sidebar Naira Calculator (PO request, AC 13)**
- New component `SidebarCalculator.tsx`. Collapsible panel rendered between the navigation and the footer in `DashboardLayout.tsx`, visible to ALL authenticated roles (no role gate). Hidden when the sidebar is collapsed to icons (`group-data-[collapsible=icon]:hidden`).
- Safe expression parser: hand-written recursive-descent (NO `eval()`). Supports `+`, `−`, `×`, `÷`, `*`, `/`, parentheses, unary minus, decimals. Standard operator precedence (× and ÷ before + and −). Normalises Unicode operators (× → *, ÷ → /, − → -) before tokenising. Throws on invalid characters, division by zero, unmatched parentheses, and empty input.
- Uses `Decimal.js` for arithmetic — no floating-point errors on financial values. The component test verifies `0.1 + 0.2 === 0.3` (a classic floating-point trap that fails with native Number arithmetic).
- Result auto-formats via the existing `formatNaira` utility: `1875000 - 500000` → `₦1,375,000.00`. Copy-to-clipboard via the existing `useCopyToClipboard` hook (Story 7.0e).
- Open/closed state persists in `localStorage` under `vlprs.sidebarCalculator.open`.
- Keyboard input is fully supported alongside the optional 4×4 click keypad (0-9, +, −, ×, ÷, ., (, ), ⌫, =). Enter key evaluates the expression.
- Component test: 21 tests in `SidebarCalculator.test.tsx` covering the parser (12 cases) and the component (9 cases) including precision, error handling, keypad, clear, copy-to-clipboard, and compact mode.

**Architecture compliance**
- Every number is a doorway (Agreement #11): the new "View full variance report →" link creates a doorway from the Top Variances summary into the full report tab.
- Empty states are UX (Agreement #13): Fixes #23 and #24 directly implement this agreement, replacing terse messages with contextual explanations of when data will appear.
- Non-punitive vocabulary: all empty-state copy uses neutral, helpful language ("No staff approaching retirement…", "Awaiting first submission", "All staff have recent deductions — no action needed.").

### File List

**Server (2 files modified, 1 new)**
- `apps/server/src/services/correctionWorksheetService.ts` — added `periodMonth`/`periodYear` to SELECT and `Period` column to Excel mapping (Fix #9)
- `apps/server/src/services/executiveSummaryReportService.ts` — raised top-variance limit from 5 to 10 (Fix #14)
- `apps/server/scripts/purge-demo-data.ts` — **NEW (committed by this story)** — Story 11.0a script that lived as an uncommitted local helper, now committed with Fix #3 applied (selective `scheme_fund_total` deletion)

**Server tests (1 file modified)**
- `apps/server/src/services/mdaReviewService.integration.test.ts` — added assertion that the generated correction worksheet contains the `Period` column with value `2026-03`

**Shared (2 files modified)**
- `packages/shared/src/constants/metricGlossary.ts` — rewrote `DASHBOARD_HELP.activeLoans` and `MIGRATION_HELP.reviewProgress`; added `MIGRATION_HELP.totalStaffMigrated` and `MIGRATION_HELP.baselinesEstablished` (Fixes #4, #7, #12)
- `packages/shared/src/constants/vocabulary.ts` — updated three `CHECKPOINT_EMPTY_*` constants with contextual copy (Fix #24)

**Client (9 files modified, 2 new)**
- `apps/client/src/pages/dashboard/DashboardPage.tsx` — added `helpKey` to Active Loans card and "Awaiting first submission" subtitle below Monthly Recovery (Fixes #4, #6)
- `apps/client/src/pages/dashboard/MigrationPage.tsx` — added `helpKey` to Total Staff Migrated and Baselines Established cards (Fix #7)
- `apps/client/src/pages/dashboard/MdaDetailPage.tsx` — replaced submission history empty-state copy (Fix #23)
- `apps/client/src/pages/dashboard/MdaOfficerDashboard.tsx` — pass `userMdaId` directly to `useMdaDetail` instead of `?? ''` so the cache-key fix from #11 also applies here (AI Review 2026-04-09 L2)
- `apps/client/src/pages/dashboard/components/ExecutiveSummaryReport.tsx` — Scheme Overview alignment, Top Variances "View full report" link, MoM Trend vertical layout, restacked `TrendIndicator` (Fixes #13, #14, #15)
- `apps/client/src/components/shared/MigrationProgressCard.tsx` — added inline `<MetricHelp metric="migration.reviewProgress" />` next to baseline count (Fix #12)
- `apps/client/src/components/layout/Breadcrumb.tsx` — actively fetch MDA name via `useMdaDetail` instead of read-from-cache (Fix #11)
- `apps/client/src/hooks/useMdaData.ts` — accept `string | undefined`, stable cache key for non-MDA routes (Fix #11)
- `apps/client/src/components/layout/DashboardLayout.tsx` — wired the new `SidebarCalculator` component into the sidebar (AC 13); compact mode now lives in a Radix `<Popover>` (AI Review 2026-04-09 H1)
- `apps/client/src/components/sidebar/SidebarCalculator.tsx` — **NEW** — Naira-aware calculator widget with safe parser; module-level `useSyncExternalStore` shared state so compact and full mode stay in sync (AI Review 2026-04-09 H1/M4)
- `apps/client/src/components/sidebar/SidebarCalculator.test.tsx` — **NEW** — parser + component tests, including a cross-instance sync test that mounts both compact and full modes and verifies they share state

**Client tests (2 files modified)**
- `apps/client/src/pages/dashboard/components/PreSubmissionCheckpoint.test.tsx` — updated existing empty-state assertions to match the new contextual copy (Fix #24)
- `apps/client/src/pages/dashboard/components/ExecutiveSummaryReport.test.tsx` — added click test for the "View full variance report →" button (AI Review 2026-04-09 L4)

### Change Log

| Date       | Author          | Change |
|------------|-----------------|--------|
| 2026-04-08 | Amelia (Dev)    | Story 15.0j — Quick Fixes Bundle implemented. 12 UAT findings resolved (#3, #4, #6, #7, #9, #11, #12, #13, #14, #15, #23, #24) + sidebar Naira calculator (PO request). 13 files modified, 2 new files. All tests pass: client 741/741, server unit 1045/1045, server integration 620/620. Status → review. |
| 2026-04-09 | Code Review (AI)| Second adversarial review surfaced 1 HIGH (SidebarCalculator compact mode broken), 4 MEDIUM (file-list reconciliation FAIL — useMdaData.ts missing, purge-demo-data.ts mislabeled, footer count drift, calculator state desync), 5 LOW (glossary contradiction, MdaOfficerDashboard caller still creates `['mda', '']`, untracked scripts dir, missing executive-summary test, missing cross-instance sync test). All HIGH/MEDIUM/LOW findings fixed except L3 (untracked scripts dir, deferred). SidebarCalculator refactored to use a module-level `useSyncExternalStore` for shared state across compact/full instances; compact mode now wraps the icon in a Radix `<Popover>` rendering the same `CalculatorPanel`. Final totals: 19 files (16 modified + 3 new), client tests 752/752 pass, client typecheck clean, shared package typecheck clean. Status → review (awaiting human approval). |
| 2026-04-09 | Code Review (AI)| Resolved the 3 LOW items previously deferred from the first review pass: (1) test mock pollution — `SidebarCalculator.test.tsx` now mocks `useCopyToClipboard` directly instead of stubbing `navigator.clipboard`; (2) Breadcrumb dead-code fallback — removed the unreachable `queryClient.getQueryData` branch in `getMdaName` and the now-unused `MdaSummary` import; (3) AC10 breakpoint — bumped the MoM Trend grid from `md:grid-cols-2` (≥768px tablet) to `lg:grid-cols-2` (≥1024px desktop) to match the AC wording. Client tests 752/752 still pass, client typecheck still clean. Status → done. |
