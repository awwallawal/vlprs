# Story 16.3: Cross-Month Dashboard & Drill-Down

Status: ready-for-dev

## Story

As the **Accountant General**,
I want cross-month findings surfaced on existing dashboards with progressive drill-down from portfolio to MDA to individual staff,
so that I can govern data quality at scale without manually reviewing spreadsheets.

**Origin:** Discovery spike 16.0 (2026-04-02). Progressive disclosure principle from UX design specification.

**Dependencies:** Story 16.1 (findings data), Story 16.2 (resolution actions available in drill-down).

## Acceptance Criteria

### AC1: New Attention Item Detectors

**Given** unreviewed cross-month findings exist,
**Then** 3 new detectors in `attentionItemService.ts`:
- `detectDisappearingBeneficiaries` — "N staff absent from latest submissions across M MDAs — review suggested"
- `detectDeductionChanges` — "N deduction changes detected across M MDAs — for awareness"
- `detectPhantomCompletions` — "N staff absent with outstanding balance across M MDAs — review suggested"

All follow existing `buildPerMdaItems()` pattern (max 3 per MDA + "and N more").

### AC2: Cross-Month Tab on Submissions Page

**Given** the user navigates to the Submissions page,
**When** cross-month findings exist for any submission,
**Then** a "Cross-Month Comparison" tab is visible showing aggregate findings across all MDAs. Tab hidden when no findings exist.

### AC3: Per-MDA Anomaly Summary

**Given** the Cross-Month tab is active,
**Then** per-MDA summary cards show: MDA name, finding counts by type (icon + count), severity distribution bar, review progress (reviewed / total), latest submission period compared. Cards sortable by total findings or unreviewed count.

### AC4: Anomaly List with Filtering

**Given** the user clicks an MDA card (or views all MDAs as DEPT_ADMIN),
**Then** a paginated list of findings with filters: finding type (multi-select), severity (multi-select), status (unreviewed / expected / resolved). Sortable by severity, date, staff name. Each row shows: staff name, finding type badge, severity badge, previous → current amount (for deduction changes), auto-explanation snippet, status badge.

### AC5: Per-Staff Submission Timeline

**Given** the user clicks a staff member in the finding list,
**Then** a timeline view shows all submissions for this staff across months: `amountDeducted` per month as a row, presence/absence indicators (teal dot = present, empty = absent), event flags shown at relevant months, findings highlighted at change points with amber marker. Timeline reads left-to-right chronologically.

### AC6: Progressive Drill-Down Routing

**Given** an attention item for cross-month findings,
**When** clicked,
**Then** navigates to Cross-Month tab → filtered to relevant MDA → finding type pre-selected in filter.

### AC7: MDA-Scoped Views

**Given** MDA_OFFICER navigates to the Cross-Month tab,
**Then** they see only their MDA's findings (no MDA card selector — directly shows their MDA's finding list).

### AC8: Non-Punitive Vocabulary

All labels use non-punitive language:
- Tab heading: "Cross-Month Comparison" (not "Anomaly Detection")
- Finding descriptions: "Variance observed between [month] and [month]" (not "Inconsistency detected")
- Severity labels: "Review suggested" (High), "For awareness" (Medium), "Minor change" (Low)
- Status: "Expected" (teal), "Resolved" (teal), "Unreviewed" (amber)
- Amber/teal colour scheme throughout (never red)

### AC9: MetricHelp Integration

All cross-month metrics wrapped with `<MetricHelp>` tooltips:
- "Findings Count" → how findings are detected (consecutive submission comparison)
- "Review Progress" → reviewed / total calculation
- "Severity Distribution" → what Low/Medium/High mean in this context
- Add glossary entries to `METRIC_GLOSSARY` for compile-time enforcement

## Tasks / Subtasks

- [ ] **Task 0 — Shared Type Extensions** (AC: 1,9)
  - [ ] 0.1 Extend `AttentionItemType` union in `packages/shared/src/types/dashboard.ts` with 3 new types: `'cross_month_disappearing'`, `'cross_month_deduction_change'`, `'cross_month_phantom_completion'`. Without this, new detectors can't return typed `AttentionItem` objects.
  - [ ] 0.2 Add 3 corresponding entries to `ATTENTION_HELP` in `packages/shared/src/constants/metricGlossary.ts` — compile-time enforcement (TypeScript `Record<AttentionItemType, ...>`) will error if any are missing.
  - [ ] 0.3 Add `METRIC_GLOSSARY` entries: `crossMonth.findingsCount`, `crossMonth.reviewProgress`, `crossMonth.severityDistribution` for MetricHelp tooltips on the dashboard.

- [ ] **Task 1 — Attention Item Detectors** (AC: 1,6)
  - [ ] 1.1 `detectDisappearingBeneficiaries(mdaScope)` — query `cross_month_findings` where type = 'disappearing_beneficiary' AND status = 'unreviewed', group by MDA
  - [ ] 1.2 `detectDeductionChanges(mdaScope)` — same pattern for 'deduction_change' type
  - [ ] 1.3 `detectPhantomCompletions(mdaScope)` — same pattern for 'phantom_completion' type
  - [ ] 1.4 Add all 3 to `Promise.all()` in `getAttentionItems()` function
  - [ ] 1.5 Use `buildPerMdaItems()` helper with priority: phantom=18, disappearing=25, deduction=35. **Note:** priority 20 is already taken by `detectPostRetirementActive` — do not reuse.
  - [ ] 1.6 Set `drillDownUrl` to `/dashboard/submissions?tab=cross-month&mda={mdaId}&type={findingType}`

- [ ] **Task 2 — Findings List API** (AC: 2,3,4,7)
  - [ ] 2.1 `GET /api/cross-month/findings` — paginated, filtered, MDA-scoped
  - [ ] 2.2 Query params: `page`, `pageSize`, `findingType[]`, `severity[]`, `status[]`, `mdaId`, `sortBy`, `sortOrder`
  - [ ] 2.3 Returns: paginated findings + summary (counts by type, severity, status)
  - [ ] 2.4 MDA scope enforcement via `scopeToMda` middleware

- [ ] **Task 3 — MDA Summary API** (AC: 3)
  - [ ] 3.1 `GET /api/cross-month/mda-summary` — per-MDA aggregation
  - [ ] 3.2 Returns: `{ mdas: [{ mdaId, mdaName, totalFindings, unreviewed, byType, bySeverity, latestPeriod }] }`
  - [ ] 3.3 MDA scope enforcement (MDA_OFFICER sees only own MDA)

- [ ] **Task 4 — Staff Timeline API** (AC: 5)
  - [ ] 4.1 `GET /api/cross-month/staff/:staffId/timeline` — all submissions for a staff member across months
  - [ ] 4.2 Query `submission_rows` joined with `mda_submissions` for the staff, ordered by month
  - [ ] 4.3 Include: month, amountDeducted, eventFlag, presence flag, findings at each change point
  - [ ] 4.4 Include employment events for context markers on timeline
  - [ ] 4.5 MDA scope enforcement

- [ ] **Task 5 — Frontend Hooks** (AC: all)
  - [ ] 5.1 `useCrossMonthFindings(filters)` — paginated findings query
  - [ ] 5.2 `useCrossMonthMdaSummary()` — MDA summary cards data
  - [ ] 5.3 `useStaffTimeline(staffId)` — staff submission timeline
  - [ ] 5.4 All hooks respect MDA scope from auth context

- [ ] **Task 6 — Cross-Month Tab Component** (AC: 2,3,8,9)
  - [ ] 6.1 Create `apps/client/src/pages/dashboard/components/CrossMonthTab.tsx`
  - [ ] 6.2 Add to Submissions page tab bar (conditional on findings existing)
  - [ ] 6.3 Default view: MDA summary cards (DEPT_ADMIN/SUPER_ADMIN) or direct findings list (MDA_OFFICER)
  - [ ] 6.4 MDA cards: name, finding counts with type icons, severity bar, review progress, latest period
  - [ ] 6.5 MetricHelp tooltips on all displayed metrics

- [ ] **Task 7 — Findings List Component** (AC: 4,8)
  - [ ] 7.1 Create `apps/client/src/pages/dashboard/components/CrossMonthFindingsList.tsx`
  - [ ] 7.2 Filter bar: finding type multi-select, severity multi-select, status multi-select
  - [ ] 7.3 Table columns: Staff Name, Finding Type (badge), Severity (badge), Previous → Current (for deduction changes), Auto-Explanation (truncated), Status (badge), Actions
  - [ ] 7.4 Row click opens FindingDetailDrawer (from Story 16.2)
  - [ ] 7.5 Checkbox selection for bulk actions (from Story 16.2)
  - [ ] 7.6 Non-punitive badges: amber for unreviewed, teal for expected/resolved

- [ ] **Task 8 — Staff Timeline Component** (AC: 5)
  - [ ] 8.1 Create `apps/client/src/pages/dashboard/components/StaffSubmissionTimeline.tsx`
  - [ ] 8.2 Horizontal timeline: months on x-axis, amount on y-axis (optional line chart) or table rows
  - [ ] 8.3 Presence indicators: teal dot (present), empty circle (absent)
  - [ ] 8.4 Event flag markers at relevant months (badge overlays)
  - [ ] 8.5 Finding markers: amber highlight at change points
  - [ ] 8.6 Accessible from FindingDetailDrawer "View Staff Timeline" link

- [ ] **Task 9 — MetricHelp Glossary Entries** (AC: 9)
  - [ ] 9.1 Add entries to `METRIC_GLOSSARY`: `crossMonth.findingsCount`, `crossMonth.reviewProgress`, `crossMonth.severityDistribution`, `crossMonth.churnRate` (for 16.4)
  - [ ] 9.2 Ensure compile-time enforcement (TypeScript will error on missing entries)

- [ ] **Task 10 — Integration Tests** (AC: 1,2,3,4,5,6,7)
  - [ ] 10.1 Test attention item detectors: create findings → verify attention items appear
  - [ ] 10.2 Test findings list pagination, filtering, MDA scoping
  - [ ] 10.3 Test MDA summary aggregation accuracy
  - [ ] 10.4 Test staff timeline: create submissions across months → verify timeline includes all

- [ ] **Task 11 — Vocabulary Constants** (AC: 8)
  - [ ] 11.1 Add attention item description templates to `packages/shared/src/constants/vocabulary.ts`:
    - `CROSS_MONTH_DISAPPEARING_DESC`: "{count} staff absent from latest submissions across {mdaCount} MDAs — review suggested"
    - `CROSS_MONTH_DEDUCTION_DESC`: "{count} deduction changes detected across {mdaCount} MDAs — for awareness"
    - `CROSS_MONTH_PHANTOM_DESC`: "{count} staff absent with outstanding balance across {mdaCount} MDAs — review suggested"
  - [ ] 11.2 Import and use in detector functions — never hardcode description strings

- [ ] **Task 12 — Unit Tests** (AC: 1,8,9)
  - [ ] 12.1 Test detector priority ordering
  - [ ] 12.2 Test non-punitive label generation
  - [ ] 12.3 Test MetricHelp glossary completeness (compile-time)

## Dev Notes

### Prep Story Context (15.0a–15.0n)

- **15.0e:** MDA officer has a purpose-built dashboard (`MdaOfficerDashboard.tsx`). Cross-month findings relevant to an MDA officer's MDA should surface there — add a "Cross-Month Findings" section or attention item card.
- **15.0h:** All metric cards must be clickable (Agreement #11: "Every number is a doorway"). Build click handlers into cross-month dashboard components from day one — don't ship static cards.
- **15.0j:** Empty states are mandatory (Agreement #13). Every cross-month section needs a contextual message when no data exists (e.g., "Cross-month analysis requires at least 2 monthly submissions. Awaiting data.").
- **15.0g:** `MetricDrillDownPage` now has "View All" shortcuts. Consider whether cross-month metrics need a similar direct-to-list shortcut.

### Attention Item Detector Pattern

Follow the existing detector pattern in `attentionItemService.ts` (grep for `Promise.all`). Each detector is an async function returning `AttentionItem[]`. Add to the `Promise.all()` array:

```typescript
const results = await Promise.all([
  // ... existing 12 detectors ...
  detectDisappearingBeneficiaries(mdaScope),  // NEW
  detectDeductionChanges(mdaScope),           // NEW
  detectPhantomCompletions(mdaScope),         // NEW
]);
```

Use `buildPerMdaItems()` helper (grep for `buildPerMdaItems`) for per-MDA aggregation with max 3 items + "and N more" overflow.

### Submissions Page Tab Integration

**Target file:** `apps/client/src/pages/dashboard/SubmissionsPage.tsx` — uses shadcn `<Tabs>`, `<TabsList>`, `<TabsTrigger>`, `<TabsContent>` (NOT MigrationPage's custom button pattern).

Add the Cross-Month tab conditionally alongside existing "CSV Upload" and "Manual Entry" tabs:

```typescript
const { data: summary } = useCrossMonthMdaSummary();
const hasCrossMonthData = summary && summary.mdas.some(m => m.totalFindings > 0);

<Tabs value={activeTab} onValueChange={setActiveTab}>
  <TabsList>
    <TabsTrigger value="csv">CSV Upload</TabsTrigger>
    <TabsTrigger value="manual">Manual Entry</TabsTrigger>
    {hasCrossMonthData && (
      <TabsTrigger value="cross-month">Cross-Month Comparison</TabsTrigger>
    )}
  </TabsList>
  {/* ... existing TabsContent ... */}
  {hasCrossMonthData && (
    <TabsContent value="cross-month" forceMount={activeTab === 'cross-month' ? undefined : true} className={activeTab !== 'cross-month' ? 'hidden' : ''}>
      <CrossMonthTab />
    </TabsContent>
  )}
</Tabs>
```

### Staff Timeline Data Model

The timeline queries `submission_rows` across all confirmed submissions for a staff member:

```sql
SELECT sr.month, sr.amount_deducted, sr.event_flag, ms.id as submission_id
FROM submission_rows sr
JOIN mda_submissions ms ON sr.submission_id = ms.id
WHERE sr.staff_id = ? AND ms.status = 'confirmed'
ORDER BY sr.month ASC
```

Overlay findings from `cross_month_findings` at change points and employment events from `employment_events` for context.

### Progressive Disclosure Architecture

```
Level 1: Attention Items (portfolio summary)
  → "3 MDAs have staff absent from latest submissions"
  
Level 2: Cross-Month Tab — MDA Cards (per-MDA summary)
  → Education: 12 disappearing, 3 deduction changes, 89% reviewed
  
Level 3: Findings List (per-MDA detail)
  → Alatise Boseda: disappearing_beneficiary, High, ₦16,999 last month
  
Level 4: Finding Detail Drawer (individual finding)
  → Previous: ₦16,999 (Sep 2024) → Current: absent (Oct 2024)
  
Level 5: Staff Timeline (full history)
  → Jul: ₦16,999 | Aug: ₦16,999 | Sep: ₦16,999 | Oct: absent | Nov: ₦16,999
```

### Non-Punitive Badge Styles

Follow existing variance badge pattern from RecordDetailDrawer:
```typescript
const FINDING_BADGE_STYLES: Record<FindingType, string> = {
  disappearing_beneficiary: 'bg-amber-50 text-amber-600 border-amber-200',
  reappearing_beneficiary: 'bg-gold/10 text-gold border-gold/20',
  deduction_change: 'bg-gold/10 text-gold border-gold/20',
  phantom_completion: 'bg-amber-50 text-amber-600 border-amber-200',
  new_midstream_appearance: 'bg-gray-100 text-gray-500 border-gray-200',
};

const STATUS_BADGE_STYLES: Record<FindingStatus, string> = {
  unreviewed: 'bg-amber-50 text-amber-600 border-amber-200',
  expected: 'bg-teal/10 text-teal border-teal/20',
  resolved: 'bg-teal/10 text-teal border-teal/20',
};
```

### Project Structure Notes

- New/extended routes: `apps/server/src/routes/crossMonthRoutes.ts` (findings list, MDA summary, staff timeline) — **must register in `apps/server/src/app.ts`** alongside existing routes (grep for `submissionRoutes` to find registration pattern)
- Extended service: `apps/server/src/services/attentionItemService.ts` (3 new detectors added to `Promise.all()`)
- New frontend hooks: `apps/client/src/hooks/useCrossMonthFindings.ts` (paginated query, MDA summary, staff timeline)
- New components:
  - `apps/client/src/pages/dashboard/components/CrossMonthTab.tsx` (MDA summary cards + tab container)
  - `apps/client/src/pages/dashboard/components/CrossMonthFindingsList.tsx` (filtered paginated list)
  - `apps/client/src/pages/dashboard/components/StaffSubmissionTimeline.tsx` (horizontal timeline)
- Modified: `apps/client/src/pages/dashboard/SubmissionsPage.tsx` (add Cross-Month tab)
- Extended types: `packages/shared/src/types/dashboard.ts` (AttentionItemType union)
- Extended constants: `packages/shared/src/constants/metricGlossary.ts` (ATTENTION_HELP + METRIC_GLOSSARY entries)

### References

All line numbers below are approximate — parallel stories modify these files. Use `grep` to locate targets at implementation time.

- [Source: apps/server/src/services/attentionItemService.ts] — Detector `Promise.all()` (grep for `Promise.all`), `buildPerMdaItems()` helper (grep for `buildPerMdaItems`), current priority values (grep for `priority:`)
- [Source: apps/server/src/services/observationService.ts:~46-67] — **Gold-standard pagination pattern:** `withMdaScope()` + filter conditions + parallel count/data queries. Follow this exact pattern for findings list and MDA summary endpoints.
- [Source: apps/server/src/lib/mdaScope.ts] — `withMdaScope(column, mdaScope)` utility — returns `undefined` for SUPER_ADMIN/DEPT_ADMIN (no filter) or `eq(column, mdaScope)` for MDA_OFFICER
- [Source: apps/client/src/pages/dashboard/SubmissionsPage.tsx] — Shadcn `<Tabs>` integration point for Cross-Month tab (grep for `TabsTrigger`)
- [Source: apps/client/src/pages/dashboard/components/RecordDetailDrawer.tsx] — Drawer component pattern (shadcn Sheet, right-side)
- [Source: apps/client/src/components/shared/MetricHelp.tsx] — MetricHelp component + `METRIC_GLOSSARY` (grep for `METRIC_GLOSSARY`)
- [Source: packages/shared/src/types/dashboard.ts] — `AttentionItemType` union (must extend) + `AttentionItem` interface
- [Source: packages/shared/src/constants/metricGlossary.ts] — `ATTENTION_HELP` Record (must add 3 entries for compile-time enforcement)
- [Source: apps/server/src/db/schema.ts] — `submission_rows` table (grep for `submissionRows`), `mda_submissions` (grep for `mdaSubmissions`)
- [Source: apps/server/src/app.ts] — Route registration (grep for `submissionRoutes` to find pattern)
- [Source: Story 16.1] — `cross_month_findings` table and finding types
- [Source: Story 16.2] — `FindingDetailDrawer`, resolution actions, `crossMonthRoutes.ts`

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
