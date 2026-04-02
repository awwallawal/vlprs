# Story 15.4: Onboarding Pipeline Dashboard & Report

Status: ready-for-dev

## Story

As a **Super Admin (AG)**,
I want to see a dashboard showing the onboarding status of all approved beneficiaries across all MDAs,
So that I can answer "how many approved loans are actually operational?" and identify which MDAs are slow to start deductions.

**Origin:** Epic 15, FR94. Team Review Q5: "Both — headline in Executive Summary + full dashboard page."

**Dependencies:** Stories 15.1 (approved_beneficiaries table), 15.2 (matching engine for confidence data), 15.3 (monthly scan populates first_deduction_month + onboarding_status). The dashboard reads from data these stories produce.

## Acceptance Criteria

1. **Given** a Super Admin or Department Admin navigates to the Onboarding Pipeline Dashboard, **When** the page loads, **Then** they see headline metrics: Total Approved, Operational, Awaiting First Deduction, Operational Rate (%), with batch selector to filter by batch year/label.

2. **Given** the dashboard displays an onboarding curve chart, **When** viewing it, **Then** it shows % operational over time (one line per batch year) using recharts LineChart — x-axis: months since approval, y-axis: % operational.

3. **Given** the per-MDA breakdown table, **When** viewing it, **Then** it shows per MDA: Approved count, Operational count, Awaiting count, Operational Rate %, Average Months-to-First-Deduction — sortable by any column.

4. **Given** a user clicks an MDA row in the breakdown table, **When** the drill-down page opens, **Then** it shows all approved beneficiaries for that MDA: Name, GL, Amount, Status (badge), First Deduction Month, Months Since Approval, Match Confidence (%).

5. **Given** a user clicks an individual beneficiary in the drill-down, **When** the detail panel opens, **Then** it shows a timeline: Approved (date) → Awaiting → First Deduction (date) → Current Status, with matched loan details (loan reference, principal, loan status) if matched.

6. **Given** a user clicks "Export", **When** the PDF is generated, **Then** a branded PDF with Oyo State crest is downloaded containing: headline metrics, onboarding curve (as a data table — no chart rendering in PDF), per-MDA table, attention items for onboarding lag.

7. **Given** the Executive Summary report (FR37) is generated, **When** the Onboarding Pipeline section renders, **Then** it is populated with real data: total approved, operational, rate %, top 5 slowest MDAs, count awaiting >3 months — replacing the current minimal implementation.

## Tasks / Subtasks

- [ ] Task 1: Create onboarding dashboard API endpoints (AC: 1, 3)
  - [ ] 1.1: Create `apps/server/src/services/onboardingDashboardService.ts` with:
    ```typescript
    export async function getOnboardingMetrics(
      filters?: { batchId?: string; year?: number },
      mdaScope?: string | null
    ): Promise<OnboardingDashboardData>
    ```
  - [ ] 1.2: **Headline metrics** query:
    ```sql
    SELECT
      COUNT(*) as total_approved,
      COUNT(*) FILTER (WHERE onboarding_status = 'OPERATIONAL') as operational,
      COUNT(*) FILTER (WHERE onboarding_status = 'NOT_YET_OPERATIONAL') as awaiting,
      ROUND(COUNT(*) FILTER (WHERE onboarding_status = 'OPERATIONAL') * 100.0 / NULLIF(COUNT(*), 0), 1) as operational_rate
    FROM approved_beneficiaries ab
    WHERE ab.mda_canonical_id IS NOT NULL
      [AND ab.batch_id = ? / JOIN approval_batches WHERE year = ?]
      [AND ab.mda_canonical_id = ? -- MDA scope]
    ```
  - [ ] 1.3: **Per-MDA breakdown** query:
    ```sql
    SELECT
      ab.mda_canonical_id, m.name as mda_name, m.code as mda_code,
      COUNT(*) as approved,
      COUNT(*) FILTER (WHERE onboarding_status = 'OPERATIONAL') as operational,
      COUNT(*) FILTER (WHERE onboarding_status = 'NOT_YET_OPERATIONAL') as awaiting,
      AVG(EXTRACT(YEAR FROM AGE((ab.first_deduction_month || '-01')::date, ab.created_at)) * 12 +
          EXTRACT(MONTH FROM AGE((ab.first_deduction_month || '-01')::date, ab.created_at)))
        FILTER (WHERE first_deduction_month IS NOT NULL) as avg_months_to_first_deduction
    -- NOTE: first_deduction_month is varchar(7) 'YYYY-MM' — append '-01' before casting to date
    FROM approved_beneficiaries ab
    JOIN mdas m ON ab.mda_canonical_id = m.id
    GROUP BY ab.mda_canonical_id, m.name, m.code
    ORDER BY awaiting DESC
    ```
  - [ ] 1.4: **Onboarding curve data** — for each batch year, compute monthly cumulative operational %:
    - For months 0-12 (or however many months since approval), count how many beneficiaries had `first_deduction_month` ≤ that month offset
    - Return: `Array<{ monthOffset: number, operationalPercent: number, batchLabel: string }>`
  - [ ] 1.5: Response type:
    ```typescript
    interface OnboardingDashboardData {
      headline: { totalApproved, operational, awaiting, operationalRate };
      perMda: Array<{ mdaId, mdaName, mdaCode, approved, operational, awaiting, operationalRate, avgMonthsToFirstDeduction }>;
      onboardingCurve: Array<{ monthOffset, operationalPercent, batchLabel }>;
      batches: Array<{ id, label, year, listType, recordCount }>;
    }
    ```
  - [ ] 1.6: Add `GET /api/onboarding/dashboard` in `apps/server/src/routes/onboardingRoutes.ts` (new route file). Auth: SUPER_ADMIN, DEPT_ADMIN. Apply `scopeToMda`
  - [ ] 1.7: Integration test in `apps/server/src/routes/onboarding.integration.test.ts` (**new file**): with seeded beneficiaries → returns correct headline + breakdown

- [ ] Task 2: Create MDA drill-down endpoint (AC: 4)
  - [ ] 2.1: Add `GET /api/onboarding/mda/:mdaId` endpoint:
    - Returns paginated list of `approved_beneficiaries` for that MDA
    - Columns: name, gradeLevel, approvedAmount, onboardingStatus (badge), firstDeductionMonth, monthsSinceApproval (computed), matchConfidence, matchStatus, matchedLoanId
    - Sortable: `sortBy`, `sortDir` query params
    - Filterable: `status` query param (OPERATIONAL / NOT_YET_OPERATIONAL / all)
  - [ ] 2.2: Apply MDA scope — DEPT_ADMIN sees all, MDA_OFFICER sees only their MDA
  - [ ] 2.3: Integration test in same file: returns correct beneficiaries for specific MDA

- [ ] Task 3: Create beneficiary timeline endpoint (AC: 5)
  - [ ] 3.1: Add `GET /api/onboarding/beneficiary/:id` endpoint:
    - Returns: beneficiary details + timeline events + matched loan details
    ```typescript
    interface BeneficiaryTimeline {
      beneficiary: { name, mdaName, gradeLevel, approvedAmount, batchLabel, listType };
      timeline: Array<{ event: string, date: string | null, status: 'completed' | 'current' | 'pending' }>;
      matchedLoan?: { loanId, loanReference, staffId, principalAmount, status, outstandingBalance };
    }
    ```
  - [ ] 3.2: Timeline events: "Approved" (created_at) → "Awaiting First Deduction" → "First Deduction" (first_deduction_month) → "Operational" / "Matched" / current status
  - [ ] 3.3: If matched loan exists, fetch loan summary via `balanceService.getOutstandingBalance()`

- [ ] Task 4: Create Onboarding Pipeline Dashboard page (AC: 1, 2, 3)
  - [ ] 4.1: Create `apps/client/src/pages/dashboard/OnboardingPipelinePage.tsx`:
    - Route: `/dashboard/onboarding`
    - Layout follows `DashboardPage.tsx` pattern: hero metrics row + chart + table
  - [ ] 4.2: **Headline metrics row** — 4 `HeroMetricCard` components:
    - Total Approved (`format="count"`)
    - Operational (`format="count"`)
    - Awaiting First Deduction (`format="count"`)
    - Operational Rate (`format="percentage"`)
  - [ ] 4.3: **Batch selector** — dropdown above the hero row to filter by batch (year + label). Default: "All Batches"
  - [ ] 4.4: **Onboarding curve chart** — recharts `LineChart`:
    ```tsx
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={curveData}>
        <XAxis dataKey="monthOffset" label="Months Since Approval" />
        <YAxis domain={[0, 100]} label="% Operational" />
        <Tooltip />
        <Legend />
        {batches.map(batch => (
          <Line key={batch.label} type="monotone" dataKey={batch.label}
                stroke={batchColors[i]} strokeWidth={2} dot={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
    ```
    - One line per batch year. Color palette: teal, amber, navy (matching existing scheme)
    - This is the first recharts usage in the codebase — the library is installed but unused
  - [ ] 4.5: **Per-MDA breakdown table** — sortable columns:
    - MDA Name, Approved, Operational, Awaiting, Rate %, Avg Months
    - Row click → navigates to `/dashboard/onboarding/mda/:mdaId`
    - Use existing table patterns (border, hover, font sizes)
  - [ ] 4.6: Add route in `apps/client/src/router.tsx` (lazy-loaded)
  - [ ] 4.7: Add "Onboarding Pipeline" to sidebar navigation in `navItems.ts` (SUPER_ADMIN, DEPT_ADMIN) — icon: `UserCheck` from lucide-react. Place after "Committee Lists" if Story 15.1 has landed, otherwise place after "Migration"

- [ ] Task 5: Create MDA drill-down page (AC: 4, 5)
  - [ ] 5.1: Create `apps/client/src/pages/dashboard/OnboardingMdaDrillDownPage.tsx`:
    - Route: `/dashboard/onboarding/mda/:mdaId`
    - Header: MDA name, summary counts (approved/operational/awaiting)
    - Back link: "← Back to Onboarding Pipeline"
  - [ ] 5.2: Beneficiary table: Name, GL, Amount (₦), Status (badge: teal "Operational" / amber "Awaiting"), First Deduction Month, Months Since Approval, Match Confidence (% badge)
  - [ ] 5.3: Status filter tabs: All | Operational | Awaiting
  - [ ] 5.4: Row click → open beneficiary detail drawer (shadcn Sheet component)
  - [ ] 5.5: **Beneficiary detail drawer** (AC: 5):
    - Timeline visualization: vertical steps with completed/current/pending states
    - Matched loan section: loan reference, principal, current balance, loan status
    - If no match: "No matching loan record found — awaiting first MDA submission"

- [ ] Task 6: Create TanStack Query hooks (AC: 1-5)
  - [ ] 6.1: Create `apps/client/src/hooks/useOnboarding.ts`:
    ```typescript
    useOnboardingDashboard(filters?)     // GET /api/onboarding/dashboard
    useOnboardingMdaDrillDown(mdaId)     // GET /api/onboarding/mda/:mdaId
    useBeneficiaryTimeline(id)           // GET /api/onboarding/beneficiary/:id
    ```
  - [ ] 6.2: Query keys:
    ```typescript
    ['onboarding', 'dashboard', { batchId, year }]
    ['onboarding', 'mda', mdaId, { page, status, sortBy }]
    ['onboarding', 'beneficiary', id]
    ```

- [ ] Task 7: Create onboarding PDF report (AC: 6)
  - [ ] 7.1: Create `apps/server/src/services/onboardingPipelinePdf.tsx`:
    - Follow existing PDF pattern: `generateOnboardingPipelinePdf(data, meta): Promise<Buffer>`
    - Sections: headline metrics row, onboarding curve as data table (columns: Month 0-12, % Operational per batch), per-MDA breakdown table, onboarding lag attention items
    - Reuse `ReportHeader` (crest), `ReportPageWrapper`, `ReportStatCard`, `ReportTable` from `reportPdfComponents.tsx`
    - No chart rendering in PDF — use a data table instead (recharts cannot render in @react-pdf)
  - [ ] 7.2: Add `GET /api/onboarding/report/pdf` endpoint in `onboardingRoutes.ts`. Follow `reportRoutes.ts` pattern: dynamic import, Content-Type, Content-Disposition
  - [ ] 7.3: Add "Export PDF" button on `OnboardingPipelinePage` using `authenticatedFetch` + Blob pattern

- [ ] Task 8: Enrich Executive Summary onboarding section (AC: 7)
  - [ ] 8.1: In `apps/server/src/services/executiveSummaryReportService.ts`, enhance `buildOnboardingPipeline()` (lines 397-467):
    - Current implementation counts `no_approval_match` observations — this is a proxy, not the real onboarding data
    - Add direct queries against `approved_beneficiaries` table:
      - `totalApproved`: COUNT all approved beneficiaries
      - `operational`: COUNT where `onboarding_status = 'OPERATIONAL'`
      - `operationalRate`: operational / totalApproved * 100
      - `awaitingOver3Months`: COUNT where NOT_YET_OPERATIONAL and created_at > 3 months ago
      - `top5SlowestMdas`: MDAs with highest awaiting count
    - Keep existing `approvedNotCollectingCount` + `revenueAtRisk` for backward compatibility
  - [ ] 8.2: Update `OnboardingPipelineData` type in shared types to include new fields
  - [ ] 8.3: Update `ExecutiveSummaryReport.tsx` (lines 237-243) to display enriched data:
    - Total Approved / Operational / Rate %
    - Top 5 slowest MDAs (name + awaiting count)
    - Awaiting >3 months count
  - [ ] 8.4: Update Executive Summary PDF (`executiveSummaryPdf.tsx` lines 127-132) onboarding section to match — currently shows only `approvedNotCollectingCount` and `revenueAtRisk`

- [ ] Task 9: Full regression and verification (AC: all)
  - [ ] 9.1: Run `pnpm typecheck` — zero errors
  - [ ] 9.2: Run `pnpm test` — zero regressions
  - [ ] 9.3: Manual test: upload approval list (15.1) → run matching (15.2) → submit CSV (15.3) → verify dashboard updates → export PDF → verify Executive Summary section populated

## Dev Notes

### First Recharts Usage in the Codebase

Recharts (`^3.7.0`) is installed but has ZERO active usage. This story introduces the first chart. Keep it simple:

```tsx
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
```

The onboarding curve is a classic "S-curve" showing adoption over time — one line per batch year. X-axis: months since approval (0-12+). Y-axis: % operational (0-100).

**Color palette** for chart lines — use existing scheme colors:
- Batch 2024: `#0D7377` (teal)
- Batch 2025: `#B8860B` (heritage gold)
- Batch 2026+: `#1a1a2e` (navy)

### PDF: No Chart Rendering

`@react-pdf/renderer` cannot render recharts components. The PDF version of the onboarding curve uses a **data table** instead:

```
Month Since Approval | 2024 Batch | 2025 Batch
0                    | 0%         | 0%
1                    | 32%        | 28%
2                    | 64%        | 55%
3                    | 82%        | 72%
...
```

This is the same approach the existing reports use — text-only tables for data that's charted on screen.

### Executive Summary Current State

The onboarding section in `executiveSummaryReportService.ts` (lines 397-467) currently derives data from `no_approval_match` observations — a proxy metric from the observation engine, not the real onboarding pipeline. Story 15.4 replaces this with direct queries against `approved_beneficiaries`.

The existing fields (`approvedNotCollectingCount`, `revenueAtRisk`) are kept for backward compatibility. New fields are added alongside them.

### Dashboard Page Pattern

Follow `DashboardPage.tsx` layout:
1. Hero metrics row (4 cards, `HeroMetricCard`)
2. Chart section (new — recharts)
3. Data table (sortable, clickable rows)
4. MDA drill-down via route param

### Drill-Down Navigation

```
OnboardingPipelinePage (/dashboard/onboarding)
  └→ MDA row click → OnboardingMdaDrillDownPage (/dashboard/onboarding/mda/:mdaId)
       └→ Beneficiary row click → detail drawer (Sheet component)
            └→ Timeline + matched loan details
```

### Onboarding Curve Data Computation

For each batch, compute cumulative operational % at each month offset:

```typescript
// For batch "2025 Main Approval" (uploaded 2026-01-15):
// Month 0: 0% operational
// Month 1: count beneficiaries where first_deduction_month <= '2026-02' / total * 100
// Month 2: count where first_deduction_month <= '2026-03' / total * 100
// ...
```

The curve rises over time as beneficiaries' deductions start appearing. A slow-rising curve for an MDA indicates processing delays.

### Non-Punitive Vocabulary

- "Not yet operational" not "Missing" or "Non-compliant"
- "Awaiting first deduction" not "Overdue" or "Failed"
- "Avg months to first deduction" — factual average, no ranking or judgment
- No red indicators — teal for operational, amber for awaiting

### What This Story Does NOT Build

- **Matching engine** — Story 15.2 (consumed here)
- **Monthly scan** — Story 15.3 (populates data this dashboard reads)
- **Committee list upload** — Story 15.1 (creates the records)
- **Retirement verification** — Story 15.5
- **Beneficiary portal** — future phase (this dashboard is for AG/admins)

### File Locations

| What | Path | Key Lines |
|---|---|---|
| Executive Summary service | `apps/server/src/services/executiveSummaryReportService.ts` | 397-467 (buildOnboardingPipeline) |
| Executive Summary UI | `apps/client/src/pages/dashboard/components/ExecutiveSummaryReport.tsx` | 237-243 (onboarding section) |
| Executive Summary PDF | `apps/server/src/services/executiveSummaryPdf.tsx` | Onboarding section |
| PDF components | `apps/server/src/services/reportPdfComponents.tsx` | ReportHeader, ReportTable, etc. |
| Report routes pattern | `apps/server/src/routes/reportRoutes.ts` | PDF endpoint pattern |
| Dashboard page pattern | `apps/client/src/pages/dashboard/DashboardPage.tsx` | 145-232 (hero metrics + layout) |
| MDA drill-down pattern | `apps/client/src/pages/dashboard/MdaDetailPage.tsx` | useParams + back nav |
| HeroMetricCard | `apps/client/src/components/shared/HeroMetricCard.tsx` | Reusable metric card |
| Router | `apps/client/src/router.tsx` | Add onboarding routes |
| Sidebar nav | `apps/client/src/components/layout/navItems.ts` | Add "Onboarding Pipeline" |
| Approved beneficiaries (15.1) | `apps/server/src/db/schema.ts` | Created in Story 15.1 |
| Approval batches (15.1) | `apps/server/src/db/schema.ts` | Created in Story 15.1 |
| New routes | `apps/server/src/routes/onboardingRoutes.ts` | To be created |
| New service | `apps/server/src/services/onboardingDashboardService.ts` | To be created |
| New PDF | `apps/server/src/services/onboardingPipelinePdf.tsx` | To be created |
| New page | `apps/client/src/pages/dashboard/OnboardingPipelinePage.tsx` | To be created |
| New drill-down | `apps/client/src/pages/dashboard/OnboardingMdaDrillDownPage.tsx` | To be created |
| New hooks | `apps/client/src/hooks/useOnboarding.ts` | To be created |

### Testing Standards

- Co-located tests: `onboardingDashboardService.test.ts`
- Integration tests in `onboardingRoutes.integration.test.ts`
- Vitest framework
- Recharts components: test that data transforms produce correct chart data shape

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 15.4]
- [Source: _bmad-output/planning-artifacts/epic-15-beneficiary-onboarding-pipeline.md — § Monthly Scanning Model]
- [Source: _bmad-output/planning-artifacts/epic-15-team-review.md — Q5: "Both — headline + full dashboard"]
- [Source: apps/server/src/services/executiveSummaryReportService.ts:397-467 — Current onboarding section]
- [Source: apps/client/src/pages/dashboard/components/ExecutiveSummaryReport.tsx:237-243 — Current UI]
- [Source: apps/client/src/pages/dashboard/DashboardPage.tsx — Hero metrics + drill-down pattern]
- [Source: apps/client/src/pages/dashboard/MdaDetailPage.tsx — MDA drill-down page pattern]
- [Source: apps/server/src/services/reportPdfComponents.tsx — Shared PDF components]

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
