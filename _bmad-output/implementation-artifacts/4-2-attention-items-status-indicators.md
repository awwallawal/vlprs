# Story 4.2: Attention Items & Status Indicators

Status: done

<!-- Validated by PM (John) on 2026-03-10. All changes traced to PRD (FR33, FR26), Architecture, UX Spec, Story 3.6 (Observation System), and PO clarifications. -->

## Story

As the **Accountant General** (or Dept Admin / MDA Officer for their own MDA),
I want to see attention-worthy items on my dashboard with clear priority indicators,
so that I know immediately if anything needs my awareness without digging through data.

## Acceptance Criteria

1. **Given** the attention items API endpoint `GET /api/dashboard/attention` **When** the dashboard loads (asynchronously after hero metrics) **Then** attention items are displayed sorted by priority (FR33) **And** all three roles (SUPER_ADMIN, DEPT_ADMIN, MDA_OFFICER) can access the endpoint, with MDA_OFFICER seeing only their MDA's items via `scopeToMda`

2. **Given** attention item sources **When** any of these conditions exist: (c) loans with zero deduction for 60+ consecutive days, (e) staff with active deductions past computed retirement date, (g) records missing Staff ID with percentage-complete metric, (h) overdue loan count via Loan Classification Service, (i) stalled deduction count via Loan Classification Service, (j) quick-win opportunities (≤3 installments remaining) via Loan Classification Service **Then** each generates an AttentionItemCard with: description, MDA name (or "Scheme-wide" for aggregate items), category badge (gold "Review" / teal "Info" / green "Complete"), and timestamp **And** items that depend on future epics return empty arrays with no errors: (a) submission variance, (b) overdue submissions, (d) auto-stop certificates, (f) pending early exits, (k) dark MDAs, (l) onboarding lag

3. **Given** an attention item **When** the user taps it **Then** it navigates to the relevant detail view (filtered loan list, observation list, or MDA detail)

4. **Given** attention item sources from analytics services **When** loans classified as OVERDUE, STALLED, or quick-win exist (via Loan Classification Service from Story 4.1) **Then** each generates an AttentionItemCard with: description, count, amount (where applicable), category badge, and drill-down link to the relevant filtered view **And** quick-win attention items show: count of quick-win loans, total outstanding balance recoverable, and link to the filtered loan list sorted by outstanding ascending

5. **Given** the attention items response **When** rendered on the dashboard **Then** items are grouped by priority: Review items first, then Info items, then Complete items **And** maximum 10 items displayed with "View all" link if more exist **And** each item shows a timestamp indicating when the condition was last evaluated

6. **Given** per-MDA detectors (zero deduction, post-retirement active) **When** multiple MDAs have the same condition **Then** the detector returns max 3 per-MDA items (top offenders by count) **And** if more MDAs are affected, the description of the last item reads "and N more MDAs" **And** the entire card is clickable — tapping navigates to the full filtered list for that detector type (e.g., `/dashboard/loans?filter=zero-deduction`) showing all affected MDAs

7. **Given** a stalled deduction attention item **When** the user drills down to investigate **Then** the drill-down links to the observation list filtered by `type=stalled_balance` (existing observation system from Story 3.6) **And** the Dept Admin (Car Loan Department Head) can review the stall, add a resolution note documenting the reason (e.g., "Confirmed with MDA — staff on LWOP Sept–Nov, deductions resumed December"), and mark as resolved for audit trail purposes **And** the AG has visibility over all resolutions but delegates day-to-day resolution to Dept Admin

## Tasks / Subtasks

### Task 1: Extend AttentionItem Shared Type (AC: 1, 2, 4, 6)
- [x]1.1 Update `packages/shared/src/types/dashboard.ts` — extend `AttentionItem` interface:
  ```typescript
  export interface AttentionItem {
    id: string;
    type: AttentionItemType;
    description: string;
    mdaName: string;                 // MDA name or "Scheme-wide" for aggregate items
    category: 'review' | 'info' | 'complete';
    priority: number;                // sort order (lower = higher priority)
    count?: number;                  // e.g., "12 overdue loans"
    amount?: string;                 // e.g., "₦45,000,000.00" (string for decimal safety)
    drillDownUrl?: string;           // navigation target when tapped
    hasMore?: number;                // if set, description includes "and {hasMore} more MDAs"
    timestamp: string;               // ISO 8601 — when condition was last evaluated
  }
  ```
- [x]1.2 Add `AttentionItemType` union type:
  ```typescript
  export type AttentionItemType =
    | 'zero_deduction'           // (c) 60+ days no deduction
    | 'post_retirement_active'   // (e) active past retirement
    | 'missing_staff_id'         // (g) records without Staff ID
    | 'overdue_loans'            // (h) past expected completion
    | 'stalled_deductions'       // (i) unchanged balance 2+ months
    | 'quick_win'                // (j) ≤3 installments remaining
    | 'submission_variance'      // (a) future: Epic 5
    | 'overdue_submission'       // (b) future: Epic 5
    | 'pending_auto_stop'        // (d) future: Epic 8
    | 'pending_early_exit'       // (f) future: Epic 12
    | 'dark_mda'                 // (k) future: Epic 5
    | 'onboarding_lag';          // (l) future: Epic 5
  ```
- [x]1.3 Export new types from `packages/shared/src/index.ts`
- [x]1.4 Add Zod response schema in `packages/shared/src/validators/dashboardSchemas.ts`

### Task 2: Attention Item Service (AC: 1, 2, 4, 6, 7)
- [x]2.1 Create `apps/server/src/services/attentionItemService.ts`
- [x]2.2 Implement `getAttentionItems(mdaScope?: string | null): Promise<AttentionItem[]>` — orchestrator that calls each detector and merges results sorted by priority
- [x]2.3 Implement detector: `detectZeroDeductionLoans(mdaScope?)` — **per-MDA detector** (max 3 MDA items + "and N more" if applicable). Loans with ACTIVE status where latest ledger entry is >60 days ago, grouped by MDA. Category: `review`, priority: 10. Top 3 MDAs by count; if more exist, 3rd item description includes "and {remainingCount} more MDAs" with `hasMore` field set
- [x]2.4 Implement detector: `detectPostRetirementActive(mdaScope?)` — **per-MDA detector** (max 3 MDA items + "and N more" if applicable). ACTIVE loans where `computedRetirementDate < today`, grouped by MDA. Category: `review`, priority: 20. Same top-3 + "N more" pattern
- [x]2.5 Implement detector: `detectMissingStaffId(mdaScope?)` — **aggregate (scheme-wide)** item. Loans where staffId is empty/null or doesn't match expected format. Category: `info`, priority: 50. Include `count` and percentage coverage metric in description (e.g., "87% of records have Staff ID — 371 records missing")
- [x]2.6 Implement detector: `detectOverdueLoans(mdaScope?)` — **aggregate (scheme-wide)** item. Uses `loanClassificationService.classifyAllLoans()` to find OVERDUE loans. Category: `review`, priority: 15. Include `count` and `amount` (total outstanding of overdue loans)
- [x]2.7 Implement detector: `detectStalledLoans(mdaScope?)` — **aggregate (scheme-wide)** item. Uses `loanClassificationService.classifyAllLoans()` to find STALLED loans (< ₦1 tolerance from Story 4.1 / FR26 — already handled by the classification service, do NOT apply additional tolerance). Category: `info`, priority: 30. Include `count` and `amount`. Drill-down links to observation list (`/dashboard/observations?type=stalled_balance`) for resolution workflow
- [x]2.8 Implement detector: `detectQuickWinLoans(mdaScope?)` — **aggregate (scheme-wide)** item. Loans where `remainingInstallments = ceil(outstandingBalance / monthlyDeductionAmount) <= 3` AND `outstandingBalance > 0`. Category: `info`, priority: 40. Include `count`, `amount` (sum of outstanding balances — the actual money recovered when these loans close), drillDownUrl to filtered loan list sorted by outstanding ascending
- [x]2.9 Add stub methods that return `[]` for future-epic detectors: submission variance, overdue submissions, auto-stop certificates, pending early exits, dark MDAs, onboarding lag — each with a `// TODO: Wire in Epic N` comment
- [x]2.10 Create `apps/server/src/services/attentionItemService.test.ts` — unit tests for each detector, sorting, mdaScope filtering, per-MDA top-3 truncation, "and N more" logic

### Task 3: Attention Items API Endpoint (AC: 1, 5)
- [x]3.1 Add `GET /api/dashboard/attention` route to `apps/server/src/routes/dashboardRoutes.ts` (file created in Story 4.1)
- [x]3.2 Apply middleware chain: `authenticate → authorise(SUPER_ADMIN, DEPT_ADMIN, MDA_OFFICER) → scopeToMda → readLimiter → auditLog` — MDA_OFFICER sees only their MDA's items via scopeToMda; readLimiter is the existing 120 req/min from `rateLimiter.ts`
- [x]3.3 Call `attentionItemService.getAttentionItems(mdaScope)` and return sorted array
- [x]3.4 Limit response to first 10 items; include `totalCount` in response for "View all" logic
- [x]3.5 Response format: `{ success: true, data: { items: AttentionItem[], totalCount: number } }`
- [x]3.6 Add integration tests in `apps/server/src/routes/dashboardRoutes.test.ts` — include test for MDA_OFFICER scoping

### Task 4: Wire Frontend Hook (AC: 1)
- [x]4.1 Update `apps/client/src/hooks/useAttentionItems.ts` — replace mock with `apiClient` call
- [x]4.2 Update return type to match new `AttentionItem[]` shape (with `type`, `count`, `amount`, `drillDownUrl`, `priority`, `hasMore`)
- [x]4.3 Keep queryKey `['dashboard', 'attention']` and staleTime 30_000

### Task 5: Enhance AttentionItemCard Component (AC: 2, 3, 4, 6)
- [x]5.1 Update `apps/client/src/components/shared/AttentionItemCard.tsx` — accept optional `count`, `amount`, `drillDownUrl`, `hasMore` props
- [x]5.2 Display count badge when present (e.g., "12 loans")
- [x]5.3 Display amount via `<NairaDisplay>` when present (e.g., "₦45,000,000.00")
- [x]5.4 Wire `onClick` to `navigate(drillDownUrl)` when drillDownUrl is provided — the entire card is the click target (existing pattern, 44×44px minimum touch area)
- [x]5.5 Add appropriate icon per attention item type (use lucide-react icons consistently)
- [x]5.6 When `drillDownUrl` is present, show a subtle right-chevron icon to indicate the card is tappable/navigable

### Task 6: Update DashboardPage (AC: 3, 5)
- [x]6.1 Update `apps/client/src/pages/dashboard/DashboardPage.tsx` — pass `drillDownUrl` to AttentionItemCard onClick handler using `useNavigate()`
- [x]6.2 Add "View all attention items" link when `totalCount > 10` (link to `/dashboard/attention` — placeholder route until full attention list page is built)
- [x]6.3 Ensure attention items section loads asynchronously after hero metrics (already async via separate `useAttentionItems()` hook)
- [x]6.4 If drill-down target route doesn't exist yet (Story 4.3 not implemented), `useNavigate` will hit router fallback — no crash, no 404 page needed for MVP

### Task 7: Update Mock Data (fallback)
- [x]7.1 Update `apps/client/src/mocks/attentionItems.ts` — add new fields (`type`, `count`, `amount`, `drillDownUrl`, `priority`, `hasMore`) to mock items
- [x]7.2 Include at least one mock item with `hasMore` set to demonstrate the "and N more MDAs" pattern
- [x]7.3 Include a stalled deductions mock item with `drillDownUrl` pointing to `/dashboard/observations?type=stalled_balance`

### Review Follow-ups (AI)
- [x] [AI-Review][HIGH] Extract duplicated `computeBalanceSumForIds` — removed 47-line copy from `dashboardRoutes.ts`, now imports from `attentionItemService.ts` [dashboardRoutes.ts:38-84, attentionItemService.ts:420]
- [x] [AI-Review][HIGH] Call `classifyAllLoans()` once in orchestrator — was called independently in `detectOverdueLoans` and `detectStalledLoans`, now pre-fetched and passed [attentionItemService.ts:15-34]
- [x] [AI-Review][HIGH] Fix count badge — added per-type unit label map (`COUNT_UNIT`) instead of hardcoded "loans". `missing_staff_id` now shows "records" [AttentionItemCard.tsx:28-31]
- [x] [AI-Review][MEDIUM] Remove dead `conditions` array in `detectZeroDeductionLoans` — was built but never used by the raw SQL query [attentionItemService.ts:48-49]
- [x] [AI-Review][MEDIUM] Add integration tests for detectors — 8 new tests: missing_staff_id, post_retirement_active, zero_deduction (with seeded data), priority sorting, totalCount, MDA_OFFICER scoping, stub absence, field completeness [dashboardRoutes.test.ts]
- [x] [AI-Review][MEDIUM] Remove unused `hasMore` prop from `AttentionItemCard` interface — server embeds "and N more" in description text, prop was dead code [AttentionItemCard.tsx:37, DashboardPage.tsx:215]
- [x] [AI-Review][MEDIUM] Add `aria-label` to navigable AttentionItemCard for accessibility — UX spec requires full context label [AttentionItemCard.tsx:70]
- [x] [AI-Review][LOW] Add `role="list"` to attention items container in DashboardPage — UX spec requires list semantics [DashboardPage.tsx:202]
- [x] [AI-Review][LOW] Fix `formatAmount` to use Decimal instead of `parseFloat` — maintains decimal precision consistent with project standards [attentionItemService.ts:470]
- [x] [AI-Review][LOW] Added performance note to `detectQuickWinLoans` documenting the tradeoff and when to optimize [attentionItemService.ts:240]

### Task 8: Verification
- [x]8.1 Run `tsc --noEmit` in both apps/server and apps/client — zero errors
- [x]8.2 Run all existing tests — zero regressions
- [x]8.3 Verify attention items render with correct category badges and navigation
- [x]8.4 Verify MDA_OFFICER can access the endpoint and sees only their MDA's items
- [x]8.5 Verify `readLimiter` is applied (120 req/min)

## Dev Notes

### Architecture & Constraints

- **API envelope:** `{ success: true, data: { items: AttentionItem[], totalCount: number } }` — follows standard response envelope
- **Non-punitive vocabulary:** Attention items use approved language from `vocabulary.ts`. "Observation" not "Anomaly", "Review" not "Warning". Badge colours: gold (review), teal (info), green (complete) — NEVER red, NEVER "error", NEVER "warning"
- **RBAC:** `GET /api/dashboard/attention` accessible to ALL three roles: `super_admin`, `dept_admin`, and `mda_officer`. MDA_OFFICER sees only their MDA's items via `scopeToMda` middleware. This enables MDA Officers to see attention items relevant to their own MDA (e.g., "3 staff in your MDA with zero deductions")
- **Rate limiting:** Wire existing `readLimiter` from `apps/server/src/middleware/rateLimiter.ts` (120 req/min) — already implemented, just add to middleware chain
- **Money values:** Always string type in JSON responses. Use `decimal.js` for server-side arithmetic
- **Async loading:** Attention items load independently from hero metrics — separate TanStack Query hook. Dashboard never blocks on attention items

### Detector Granularity: Aggregate vs Per-MDA

Detectors fall into two categories:

| Category | Detectors | Behaviour | 10-Item Budget Impact |
|----------|-----------|-----------|----------------------|
| **Per-MDA** (top offenders) | (c) zero deduction, (e) post-retirement | Returns max 3 items (top MDAs by affected loan count). If >3 MDAs affected, 3rd item includes "and N more MDAs" with `hasMore` field. Entire card is clickable → full filtered list | Max 3 items per detector |
| **Aggregate** (scheme-wide) | (g) missing Staff ID, (h) overdue, (i) stalled, (j) quick-win | Returns 1 item with count + amount. Description: "47 overdue loans — ₦312M at risk". Card navigates to filtered list | 1 item per detector |

**Why this split:** The AG needs to know *which* MDA to call about zero deductions or post-retirement staff — that's operational, per-MDA. For overdue/stalled/quick-win, the AG cares about the aggregate number first, then drills down (Story 4.3). Missing Staff ID is a data quality metric — always scheme-wide.

**Budget math:** 2 per-MDA detectors × 3 items max = 6, plus 4 aggregate detectors × 1 = 4. Total: 10 items max from implementable detectors. Fits within the 10-item display limit.

### Stall Resolution Workflow (Existing from Story 3.6)

The stalled deductions attention item connects to the **existing observation review system** built in Story 3.6:

```
Attention Item: "14 stalled deductions — ₦45M at risk"
    ↓ User taps card
Drill-down: /dashboard/observations?type=stalled_balance
    ↓ Observation list (filtered by stalled_balance)
Individual Observation Card shows:
    - Description: "Outstanding balance remained at ₦X for N months (Jan–Mar 2026)"
    - Possible explanations: salary suspension, admin hold, data entry lag
    - Suggested action: "Confirm with MDA payroll records"
    ↓ Dept Admin investigates
Resolution: Dept Admin adds resolutionNote
    - e.g., "Confirmed with MDA — staff on LWOP Sept–Nov, deductions resumed December"
    - Status: Reviewed → Resolved
    - Audit trail: resolvedBy, resolvedAt, resolutionNote
```

**Who resolves:**
- **Dept Admin (Car Loan Department Head):** Primary resolver. Closest to operational truth. Reviews stall observations, documents reason, marks resolved
- **AG (Super Admin):** Has oversight of all resolutions. Can also resolve but delegates day-to-day work to Dept Admin
- **MDA Officer:** Can VIEW observations for their MDA (see the stall exists) but CANNOT review or resolve (existing RBAC in observation routes)

**Resolution note is REQUIRED** — `markAsResolved(observationId, userId, resolutionNote)` enforces this. No silent closures. Full audit trail for every stall resolution.

**If the stall is serious:** Dept Admin can **promote to exception** instead of resolving → creates a record in the exceptions table (Epic 7 handoff) for formal follow-up.

### Stall Detection Tolerance (from Story 4.1 / FR26)

The `loanClassificationService` (built in Story 4.1) already applies the FR26 Clean threshold tolerance for stall detection: balance movement < ₦1 is treated as sub-kobo rounding noise. **Do NOT apply additional tolerance in the attention item detector** — the classification service handles it. The detector simply reads STALLED classifications from `classifyAllLoans()`.

### Attention Item Detectors: Implementable vs Stubbed

| FR33 Ref | Detector | Status | Granularity | Category | Priority | Notes |
|----------|----------|--------|-------------|----------|----------|-------|
| (c) | Zero deduction 60+ days | **IMPLEMENT** | Per-MDA (top 3) | review | 10 | Query ledger_entries for latest entry per active loan, group by MDA |
| (e) | Post-retirement active | **IMPLEMENT** | Per-MDA (top 3) | review | 20 | ACTIVE loans where `computedRetirementDate < NOW()`, group by MDA |
| (g) | Missing Staff ID | **IMPLEMENT** | Aggregate | info | 50 | Count loans with empty/null staffId, show % coverage |
| (h) | Overdue loans | **IMPLEMENT** | Aggregate | review | 15 | Via `loanClassificationService` from Story 4.1 |
| (i) | Stalled deductions | **IMPLEMENT** | Aggregate | info | 30 | Via `loanClassificationService` from Story 4.1. Drill-down → observation list |
| (j) | Quick-win opportunities | **IMPLEMENT** | Aggregate | info | 40 | `ceil(outstandingBalance / monthlyDeductionAmount) <= 3` |
| (a) | Submission variance >5% | **STUB** | — | review | 5 | Wire in Epic 5 when submissions exist |
| (b) | Overdue submissions | **STUB** | — | review | 8 | Wire in Epic 5 |
| (d) | Auto-stop pending | **STUB** | — | review | 12 | Wire in Epic 8 |
| (f) | Pending early exit | **STUB** | — | info | 35 | Wire in Epic 12 |
| (k) | Dark MDAs | **STUB** | — | review | 25 | Wire in Epic 5 (Submission Coverage Service) |
| (l) | Onboarding lag | **STUB** | — | info | 45 | Wire in Epic 5 (Beneficiary Pipeline Service) |

**Priority numbers are reserved.** New detectors from future epics should use their pre-assigned slot.

### Detector Query Patterns

**Zero deduction 60+ days (c) — Per-MDA:**
```sql
-- Find ACTIVE loans whose most recent ledger entry is >60 days ago, grouped by MDA
SELECT m.id as mda_id, m.name as mda_name, COUNT(l.id) as affected_count
FROM loans l
JOIN mdas m ON l.mda_id = m.id
LEFT JOIN ledger_entries le ON l.id = le.loan_id
WHERE l.status = 'ACTIVE'
GROUP BY m.id, m.name, l.id
HAVING MAX(le.created_at) < NOW() - INTERVAL '60 days'
   OR MAX(le.created_at) IS NULL;
-- Then aggregate by MDA and take top 3 by affected_count DESC
```

**Post-retirement active (e) — Per-MDA:**
```sql
SELECT m.id as mda_id, m.name as mda_name, COUNT(*) as affected_count
FROM loans l
JOIN mdas m ON l.mda_id = m.id
WHERE l.status = 'ACTIVE'
  AND l.computed_retirement_date IS NOT NULL
  AND l.computed_retirement_date < CURRENT_DATE
GROUP BY m.id, m.name
ORDER BY affected_count DESC;
-- Take top 3; if more exist, 3rd item includes "and {remaining} more MDAs"
```

**Quick-win detection (j) — Balance-based (works for all lifecycle paths):**
```typescript
// Uses outstanding balance, NOT entry counting (handles accelerated, lump sum, etc.)
const outstandingBalance = computeBalanceFromEntries(...)
const monthlyDeduction = loan.monthlyDeductionAmount
const remainingInstallments = Math.ceil(
  new Decimal(outstandingBalance).div(new Decimal(monthlyDeduction)).toNumber()
)
const isQuickWin = remainingInstallments <= 3 && new Decimal(outstandingBalance).gt(0)
// "total recoverable" = sum of outstanding balances of quick-win loans
```

### Services from Story 4.1 (MUST exist before this story)

This story depends on services built in Story 4.1:

| Service | Function Used | Purpose |
|---------|--------------|---------|
| `loanClassificationService` | `classifyAllLoans(mdaScope?)` | Get OVERDUE, STALLED classifications |
| `loanClassificationService` | `getAtRiskAmount(mdaScope?)` | Aggregate outstanding for at-risk loans |

### Services Already Built (DO NOT recreate)

| Service | File | Relevant Functions |
|---------|------|--------------------|
| `loanClassificationService` | `services/loanClassificationService.ts` | `classifyAllLoans()` — built in Story 4.1, includes < ₦1 stall tolerance |
| `computationEngine` | `services/computationEngine.ts` | `computeBalanceFromEntries()` |
| `balanceService` | `services/balanceService.ts` | `getOutstandingBalance()` |
| `temporalProfileService` | `services/temporalProfileService.ts` | Retirement date + remaining service computation |
| `gratuityProjectionService` | `services/gratuityProjectionService.ts` | `getAggregateGratuityExposure()` |
| `mdaService` | `services/mdaService.ts` | `getAllMdas()`, `getMdaById()` |
| `observationService` | `services/observationService.ts` | `listObservations(filters, mdaScope)`, `markAsReviewed()`, `markAsResolved()` — Story 3.6 |
| `observationEngine` | `services/observationEngine.ts` | `generateObservations()` — detects stalled_balance during migration. Story 3.6 |

### Frontend Components to REUSE (do not recreate)

| Component | File | Notes |
|-----------|------|-------|
| `AttentionItemCard` | `components/shared/AttentionItemCard.tsx` | Extend with `count`, `amount`, `drillDownUrl`, `hasMore` props |
| `AttentionEmptyState` | `components/shared/AttentionItemCard.tsx` | Shows "No attention items — all systems normal" |
| `Badge` | `components/ui/badge.tsx` | Variants: `complete`, `review`, `info`, `pending` |
| `NairaDisplay` | `components/shared/NairaDisplay.tsx` | For amount display in attention cards |
| `Skeleton` | `components/ui/skeleton.tsx` | Loading state (already in DashboardPage) |

### Attention Item Priority Sort Order

Lower priority number = shown first. Review items (gold) appear before Info items (teal):

1. Priority 5-12: Review items requiring AG awareness (submission, auto-stop, zero deduction)
2. Priority 15-25: Analytics review items (overdue, post-retirement, dark MDAs)
3. Priority 30-50: Informational items (stalled, early exit, quick-win, onboarding lag, Staff ID coverage)

### Drill-Down URL Patterns

| Item Type | drillDownUrl | Target View | Notes |
|-----------|-------------|-------------|-------|
| `zero_deduction` | `/dashboard/loans?filter=zero-deduction` | Filtered loan list | Per-MDA items add `&mda={mdaId}` |
| `zero_deduction` (with hasMore) | `/dashboard/loans?filter=zero-deduction` | Full filtered list (all MDAs) | "And N more" card links to unfiltered detector list |
| `post_retirement_active` | `/dashboard/loans?filter=post-retirement` | Filtered loan list | Per-MDA items add `&mda={mdaId}` |
| `post_retirement_active` (with hasMore) | `/dashboard/loans?filter=post-retirement` | Full filtered list (all MDAs) | "And N more" card links to unfiltered detector list |
| `missing_staff_id` | `/dashboard/loans?filter=missing-staff-id` | Filtered loan list | Scheme-wide |
| `overdue_loans` | `/dashboard/loans?filter=overdue` | Filtered loan list (Story 4.3) | Scheme-wide |
| `stalled_deductions` | `/dashboard/observations?type=stalled_balance` | **Observation list** (Story 3.6) | Links to existing observation review workflow for resolution + audit trail |
| `quick_win` | `/dashboard/loans?filter=quick-win&sort=outstanding-asc` | Sorted loan list (Story 4.3) | Scheme-wide, sorted by lowest outstanding first |

Note: The `/dashboard/loans` pages are built in Story 4.3 (Progressive Drill-Down). The `/dashboard/observations` page already exists from Story 3.6. For drill-down URLs where the target doesn't exist yet, the router will hit its fallback — no crash.

### Route Addition Pattern

Add to existing `dashboardRoutes.ts` (created in Story 4.1):
```typescript
import { readLimiter } from '../middleware/rateLimiter';

// Note: MDA_OFFICER included — they see their own MDA's attention items
const attentionAuth = [
  authenticate,
  authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN, ROLES.MDA_OFFICER),
  scopeToMda,
  readLimiter,
  auditLog,
];

router.get('/dashboard/attention', ...attentionAuth, async (req, res) => {
  const mdaScope = req.mdaScope ?? null;
  const items = await attentionItemService.getAttentionItems(mdaScope);
  res.json({
    success: true,
    data: { items: items.slice(0, 10), totalCount: items.length },
  });
});
```

### Stub Extension Points

Each stub detector follows this pattern for future wiring:
```typescript
// TODO: Wire in Epic 5 when submission data exists
async function detectSubmissionVariance(mdaScope?: string | null): Promise<AttentionItem[]> {
  // Requires: mda_submissions table (Epic 5)
  // Logic: Find MDAs with variance >5% for 2+ consecutive months
  return [];
}
```

When the relevant epic is built, the dev simply implements the detector function body — the orchestrator `getAttentionItems()` already calls it and merges results. Zero structural changes needed.

### Database Tables Used (read-only)

| Table | Purpose |
|-------|---------|
| `loans` | Active loan lookup, status, staffId, computedRetirementDate, tenureMonths, monthlyDeductionAmount, principalAmount |
| `ledger_entries` | Last deduction date per loan (gap detection), balance computation |
| `mdas` | MDA name resolution for attention item display |
| `observations` | Existing stalled_balance observations for drill-down resolution workflow (Story 3.6) |

### Performance Notes

- Attention items load asynchronously after hero metrics — never blocks dashboard render
- Each detector runs a single aggregation query — no N+1 patterns
- Per-MDA detectors cap at 3 items — prevents unbounded growth
- Loan Classification Service (from Story 4.1) may already have cached classification results if hero metrics loaded first — consider reusing
- Response is an array of ≤10 items — minimal payload
- `readLimiter` enforces 120 req/min per user

### Previous Story Intelligence (Story 4.1 + Story 3.6)

- **Story 4.1 (just validated):** Builds `loanClassificationService` (with < ₦1 stall tolerance), `revenueProjectionService`, `mdaAggregationService`, `schemeConfigService`, and `dashboardRoutes.ts`. Middleware chain includes `readLimiter`. This story extends that routes file
- **Story 3.6:** Built the full observation system — observationEngine (6 detectors including stalled_balance), observationService (list, review, resolve, promote), observation routes, types. Stalled deduction resolution workflow already exists with mandatory `resolutionNote` and full audit trail
- The `DashboardMetrics` type is extended in 4.1 with analytics fields — this story extends `AttentionItem` type similarly
- Testing pattern: unit tests for each service function, integration tests for API endpoints

### Project Structure Notes

- New service: `apps/server/src/services/attentionItemService.ts` + `.test.ts`
- Route addition: extend `apps/server/src/routes/dashboardRoutes.ts` (from Story 4.1)
- Type updates: `packages/shared/src/types/dashboard.ts`
- Component update: `apps/client/src/components/shared/AttentionItemCard.tsx` (extend props)
- Hook update: `apps/client/src/hooks/useAttentionItems.ts` (mock → real API)
- Mock update: `apps/client/src/mocks/attentionItems.ts`
- No new database tables or migrations — leverages existing `observations` table from Story 3.6

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 4, Story 4.2]
- [Source: _bmad-output/planning-artifacts/prd.md — FR33 (12 attention item sources a-l)]
- [Source: _bmad-output/planning-artifacts/prd.md — FR26 (variance classification: Clean < ₦1)]
- [Source: _bmad-output/planning-artifacts/architecture.md — Dashboard API patterns, RBAC, Rate Limiting]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — AttentionItemCard design, priority-sorted queue pattern, AG journey]
- [Source: Story 4.1 — loanClassificationService dependency (< ₦1 stall tolerance), dashboardRoutes.ts file, readLimiter pattern]
- [Source: Story 3.6 — observationEngine (stalled_balance detection), observationService (review/resolve workflow), observation routes (RBAC)]
- [Source: WIRING-MAP.md — useAttentionItems() → GET /api/dashboard/attention]
- [Source: apps/client/src/components/shared/AttentionItemCard.tsx — existing component to extend]
- [Source: packages/shared/src/constants/vocabulary.ts — non-punitive language constants]
- [Source: apps/server/src/services/temporalProfileService.ts — computedRetirementDate for post-retirement detection]
- [Source: apps/server/src/middleware/rateLimiter.ts — readLimiter (120 req/min)]
- [Source: PO validation session 2026-03-10 — MDA_OFFICER access, per-MDA top-3 truncation, stall resolution via Dept Admin, quick-win balance-based detection]

## Validation Log

### PM Validation (2026-03-10)

**Validator:** John (PM Agent)
**PO:** Awwal

**Changes applied from validation:**

| # | Change | Rationale | Traced To |
|---|--------|-----------|-----------|
| 1 | **Rate limiter** added to middleware chain (`readLimiter`) | Consistency with Story 4.1 pattern. Was mentioned in Dev Notes but had no task wiring | PM validation, Story 4.1 update |
| 2 | **MDA_OFFICER** added to authorise list | MDA Officers benefit from seeing their own MDA's attention items (e.g., "3 staff with zero deductions"). Scoped via scopeToMda | PO clarification |
| 3 | **Quick-win detection** fixed: balance-based, not entry-counting | Entry counting fails for accelerated/lump sum paths. `ceil(outstandingBalance / monthlyDeductionAmount) <= 3` works for all lifecycle paths. Entry type was wrong ('REPAYMENT' doesn't exist — should be 'PAYROLL') | PM validation |
| 4 | **Per-MDA vs aggregate** granularity defined | Per-MDA (top 3 + "N more") for zero deduction & post-retirement. Aggregate for overdue, stalled, quick-win, missing Staff ID. Budget: max 10 items from 6 detectors | PM validation, PO clarification |
| 5 | **Stall tolerance reference** added | loanClassificationService already handles < ₦1 tolerance from FR26. Detectors must NOT add additional tolerance | PM validation, Story 4.1 / FR26 |
| 6 | **Quick-win "total recoverable"** defined as sum of outstanding balances | This is the actual money the scheme recovers, not a projection. Clear for the AG | PM validation |
| 7 | **Stall drill-down** links to observation system (Story 3.6) | Existing review → resolve workflow with mandatory `resolutionNote` provides full audit trail. Dept Admin resolves, AG has oversight | PO clarification, Story 3.6 |
| 8 | **"And N more" pattern** for per-MDA items | Card is the button — entire card clickable, navigates to full filtered list. No separate inline button needed | PO clarification |
| 9 | **Stall resolution ownership** documented | Dept Admin (Car Loan Department Head) resolves with reason for audit trail. Can promote to exception if serious. AG has oversight | PO clarification |

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
- DashboardPage.test.tsx regression: mock data shape changed from `AttentionItem[]` to `{ items: AttentionItem[], totalCount: number }` — updated mock to match new response shape
- AttentionItemCard `onClick` prop replaced with `drillDownUrl` + `useNavigate` — updated tests to use MemoryRouter and mock useNavigate

### Completion Notes List
- **Task 1 (Shared Types):** `AttentionItem` interface, `AttentionItemType` union, Zod schemas (`attentionItemSchema`, `attentionItemsResponseSchema`), exports from `index.ts` — all pre-existing from prior session
- **Task 2 (Attention Item Service):** Full `attentionItemService.ts` with 6 implementable detectors (zero deduction, post-retirement active, missing Staff ID, overdue loans, stalled deductions, quick-win) + 6 stub detectors for future epics. `buildPerMdaItems` helper for top-3 + "and N more" pattern. `computeBalanceSumForIds` for balance aggregation. 12 unit tests — all pre-existing from prior session
- **Task 3 (API Endpoint):** `GET /api/dashboard/attention` added to `dashboardRoutes.ts` with `attentionAuth` middleware chain (authenticate, requirePasswordChange, authorise SUPER_ADMIN/DEPT_ADMIN/MDA_OFFICER, scopeToMda, readLimiter, auditLog). Returns max 10 items with totalCount. 7 integration tests — all pre-existing from prior session
- **Task 4 (Wire Frontend Hook):** Replaced mock import in `useAttentionItems.ts` with `apiClient<AttentionItemsResponse>('/dashboard/attention')`. Return type updated to `{ items: AttentionItem[], totalCount: number }`. Updated test to mock apiClient
- **Task 5 (Enhance AttentionItemCard):** Added `type`, `count`, `amount`, `drillDownUrl`, `hasMore` props. Per-type icon mapping (AlertCircle, Clock, UserX, Pause, Zap). Count badge display. NairaDisplay for amount. ChevronRight indicator for navigable cards. onClick wired to `useNavigate(drillDownUrl)`. 17 tests updated/added
- **Task 6 (Update DashboardPage):** Updated attention section to read `data.items` (new response shape). Pass all new props to AttentionItemCard. "View all attention items" link when `totalCount > 10`
- **Task 7 (Update Mock Data):** Updated all 5 mock items with `type`, `priority`, `count`, `amount`, `drillDownUrl`, `hasMore` fields. Includes stalled deductions item with observation drill-down URL and "and N more" pattern example
- **Task 8 (Verification):** `tsc --noEmit` zero errors (client + server). Client: 60 files, 386 tests passed. Server: 69 files, 974 tests passed. Zero regressions

### File List
- `packages/shared/src/types/dashboard.ts` — AttentionItem interface, AttentionItemType union (no changes this session — pre-existing)
- `packages/shared/src/validators/dashboardSchemas.ts` — Zod schemas for attention items (no changes this session — pre-existing)
- `packages/shared/src/index.ts` — exports for AttentionItem, AttentionItemType, Zod schemas (no changes this session — pre-existing)
- `apps/server/src/services/attentionItemService.ts` — NEW: all 6 detectors + 6 stubs + helpers (no changes this session — pre-existing)
- `apps/server/src/services/attentionItemService.test.ts` — NEW: 12 unit tests (no changes this session — pre-existing)
- `apps/server/src/routes/dashboardRoutes.ts` — Extended: GET /api/dashboard/attention endpoint (no changes this session — pre-existing)
- `apps/server/src/routes/dashboardRoutes.test.ts` — Extended: 7 attention endpoint integration tests (no changes this session — pre-existing)
- `apps/client/src/hooks/useAttentionItems.ts` — MODIFIED: mock → apiClient, return type updated to { items, totalCount }
- `apps/client/src/hooks/useAttentionItems.test.tsx` — MODIFIED: updated to mock apiClient, test new response shape
- `apps/client/src/components/shared/AttentionItemCard.tsx` — MODIFIED: added type/count/amount/drillDownUrl/hasMore props, per-type icons, chevron, NairaDisplay, useNavigate
- `apps/client/src/components/shared/AttentionItemCard.test.tsx` — MODIFIED: updated for drillDownUrl navigation, MemoryRouter, new prop tests
- `apps/client/src/pages/dashboard/DashboardPage.tsx` — MODIFIED: updated attention section for new response shape, pass all props, "View all" link
- `apps/client/src/pages/dashboard/DashboardPage.test.tsx` — MODIFIED: mock attention data updated to { items, totalCount } shape
- `apps/client/src/mocks/attentionItems.ts` — MODIFIED: added type, priority, count, amount, drillDownUrl, hasMore to all mock items

## Change Log

- 2026-03-11: Story 4.2 implementation complete — attention items service (6 detectors + 6 stubs), API endpoint with RBAC (3 roles), frontend hook wired to real API, AttentionItemCard enhanced with drill-down navigation/icons/count/amount, DashboardPage updated. All tests pass (1,360 total).
- 2026-03-11: **Code review (AI)** — 10 findings (3 HIGH, 4 MEDIUM, 3 LOW). All 10 resolved: deduplicated `computeBalanceSumForIds`, eliminated double `classifyAllLoans` call, fixed hardcoded "loans" count unit, removed dead code, removed unused `hasMore` prop, added `aria-label`, added `role="list"`, replaced `parseFloat` with Decimal in `formatAmount`, added 8 detector integration tests with seeded data, documented quick-win performance tradeoff. All tests pass (client: 60 files/390 tests, server: 69 files/982 tests).
