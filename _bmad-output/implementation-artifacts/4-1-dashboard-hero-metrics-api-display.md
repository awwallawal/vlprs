# Story 4.1: Dashboard Hero Metrics API & Display

Status: done

<!-- Validated by PM (John) on 2026-03-10. All changes traced to PRD (FR32, FR21, FR26), Architecture, UX Spec, and PO clarifications. -->

## Story

As the **Accountant General**,
I want to see four headline numbers (Active Loans, Total Exposure, Fund Available, Monthly Recovery) instantly on my phone without clicking anything, plus analytics metrics (Loans in Window, Outstanding Receivables, Collection Potential, At-Risk Amount, Completion Rate rolling & lifetime) via the Loan Classification Service,
so that I can answer any scheme-level question in real time.

## Acceptance Criteria

1. **Given** the dashboard API endpoint `GET /api/dashboard/metrics` **When** the AG opens the dashboard on mobile (4G) **Then** the response returns all metrics in <2KB payload **And** the dashboard renders within <3 seconds including skeleton loaders → hero metrics with subtle count-up animation (FR32, NFR-PERF-1)

2. **Given** the HeroMetricCard components **When** displayed on mobile (<768px) **Then** cards are full-width stacked vertically, each showing: metric label, primary value (NairaDisplay formatting or count), and optional trend indicator **And** on desktop (>1024px), primary cards display in a 4-column grid

3. **Given** skeleton loaders **When** the dashboard is loading **Then** layout skeleton renders within 1 second (no blank white screen) and real data replaces skeletons as API responds

4. **Given** the dashboard API endpoint `GET /api/dashboard/metrics` **When** the AG views hero metrics **Then** the 4 primary metrics are:
   - **Active Loans** — count of loans with `status = 'ACTIVE'` (currently being serviced)
   - **Total Exposure** — sum of outstanding balances (principal + interest remaining) across all ACTIVE loans, computed via `computeBalanceFromEntries` or batch SQL approximation
   - **Fund Available** — `schemeFundTotal - SUM(principal_amount) WHERE status IN ('ACTIVE', 'COMPLETED')`, read from `scheme_config` table. If no value configured yet, return `null` and display "Awaiting Configuration" on the card (not ₦0.00)
   - **Monthly Recovery** — sum of actual deductions submitted by MDAs for the last completed submission period, with the period label (e.g., "Feb 2026") included in the response as `recoveryPeriod`

5. **Given** the dashboard API endpoint `GET /api/dashboard/metrics` **When** the AG views the analytics row **Then** the response includes:
   - `loansInWindow` — count of all loans (any status/lifecycle path) with `firstDeductionDate` within the 60-month accountability window (e.g., March 2021–March 2026)
   - `totalOutstandingReceivables` — sum of outstanding balances across ACTIVE + OVERDUE + STALLED loans (the full accountability picture)
   - `monthlyCollectionPotential` — sum of `monthlyDeductionAmount` for all ACTIVE loans (the expected monthly if all MDAs submit correctly)
   - `atRiskAmount` — sum of outstanding balances of OVERDUE + STALLED loans via Loan Classification Service
   - `loanCompletionRate` — COMPLETED / total loans in the rolling 60-month window
   - `loanCompletionRateLifetime` — all-time COMPLETED / all loans ever created
   **And** all financial values are computed via the Loan Classification Service using a default 60-month accountability window **And** the response remains <2KB payload **And** on desktop, metrics display in a 2-row grid (primary row 4-col + analytics row); on mobile, all cards stack vertically

6. **Given** the stall detection logic in Loan Classification Service **When** checking for consecutive identical balances **Then** use the FR26 Clean threshold tolerance: balance movement < ₦1 is treated as noise (sub-kobo rounding), so `|balance[N] - balance[N-1]| < 1` for 2+ consecutive months → STALLED. This aligns with the existing variance classification system (FR26: Clean < ₦1, Minor Variance ₦1–₦499, Significant Variance ≥ ₦500)

7. **Given** the `scheme_config` table **When** the AG has not yet entered the total fund allocation **Then** the Fund Available card displays "Awaiting Configuration" with a subtle info badge and a link/tooltip: "Enter your scheme fund total in Settings when confirmed by the committee" **And** the AG can configure this value at any time via a future Settings page (story TBD) or direct DB seed **And** the API returns `fundAvailable: null` and `fundConfigured: false` so the frontend can render the appropriate state

8. **Deferred from Story 10.3:** Wire `gratuityProjectionService.getAggregateGratuityExposure()` into `GET /api/dashboard/metrics` to populate the `DashboardMetrics.gratuityReceivableExposure` field. The service function + integration tests already exist — only endpoint wiring needed.

## Tasks / Subtasks

### Task 1: Loan Classification Service (AC: 5, 6)
- [x] 1.1 Create `apps/server/src/services/loanClassificationService.ts`
- [x] 1.2 Implement `classifyLoan(loan, ledgerEntries, windowMonths = 60)` — returns classification: `COMPLETED` | `ON_TRACK` | `OVERDUE` | `STALLED` | `OVER_DEDUCTED`
  - `COMPLETED`: status = COMPLETED
  - `ON_TRACK`: active, balance decreasing, within expected completion window
  - `OVERDUE`: past expected completion date (firstDeductionDate + tenureMonths + windowMonths), balance > 0
  - `STALLED`: 2+ consecutive months where `|balance[N] - balance[N-1]| < ₦1` (sub-kobo rounding tolerance from FR26 Clean threshold). Use `new Decimal('1')` as the stall tolerance constant, consistent with `VARIANCE_THRESHOLD_CLEAN` in migrationValidationService
  - `OVER_DEDUCTED`: balance < 0 (more deducted than owed)
- [x] 1.3 Implement `classifyAllLoans(mdaScope?, windowMonths = 60)` — bulk classification of all loans with `firstDeductionDate` within the accountability window from DB
- [x] 1.4 Implement `getAtRiskAmount(mdaScope?)` — sum outstanding balances of OVERDUE + STALLED loans
- [x] 1.5 Implement `getLoanCompletionRate(mdaScope?, windowMonths = 60)` — COMPLETED count / total count within rolling window
- [x] 1.6 Implement `getLoanCompletionRateLifetime(mdaScope?)` — all-time COMPLETED count / total loans ever created (no window filter)
- [x] 1.7 Implement `getLoansInWindow(mdaScope?, windowMonths = 60)` — count of all loans (any status, any lifecycle path: Full Tenure, Accelerated, Lump Sum, Retirement Split) with `firstDeductionDate` within the window
- [x] 1.8 Create `apps/server/src/services/loanClassificationService.test.ts` — unit tests for each classification rule, edge cases, stall tolerance (< ₦1 = noise, ≥ ₦1 = real movement)

### Task 2: Revenue Projection Service (AC: 4, 5)
- [x] 2.1 Create `apps/server/src/services/revenueProjectionService.ts`
- [x] 2.2 Implement `getMonthlyCollectionPotential(mdaScope?)` — sum of `monthlyDeductionAmount` for all ACTIVE loans (the expected monthly figure)
- [x] 2.3 Implement `getTotalOutstandingReceivables(mdaScope?)` — sum of outstanding balances across ACTIVE + OVERDUE + STALLED loans. Use batch SQL approximation: `SUM(principal_amount + interest) - SUM(ledger deductions)` grouped by classification, or iterate in batches via `computeBalanceFromEntries`. Must include all loans in accountability scope, not just status = 'ACTIVE'
- [x] 2.4 Implement `getActualMonthlyRecovery(mdaScope?)` — sum of actual deduction amounts from `ledger_entries` for the last completed submission period. Returns `{ amount: string, periodMonth: number, periodYear: number }`. Query: `SELECT SUM(amount), period_month, period_year FROM ledger_entries WHERE entry_type = 'PAYROLL' GROUP BY period_month, period_year ORDER BY period_year DESC, period_month DESC LIMIT 1`
- [x] 2.5 Create `apps/server/src/services/revenueProjectionService.test.ts` — unit tests

### Task 3: MDA Aggregation Service (AC: 5, for Stories 4.2-4.4)
- [x] 3.1 Create `apps/server/src/services/mdaAggregationService.ts`
- [x] 3.2 Implement `getMdaHealthScore(mdaId)` — weighted score: completion rate ×40, on-track rate ×20, base 40, stall/overdue/over-deduction penalties of -20 each, clamped 0-100
- [x] 3.3 Implement `getMdaBreakdown(mdaScope?)` — per-MDA metrics (active loans, exposure, recovery, health score, status distribution)
- [x] 3.4 Create `apps/server/src/services/mdaAggregationService.test.ts` — unit tests
- [x] 3.5 **Note:** Task 3 is forward-investment for Stories 4.2–4.4. No API exposes this service in Story 4.1. Test in isolation against classification service output

### Task 4: Scheme Config Table & Migration (AC: 7)
- [x] 4.1 Create Drizzle migration for `scheme_config` table:
  ```sql
  CREATE TABLE scheme_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(100) NOT NULL UNIQUE,
    value TEXT NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```
  Lightweight key-value config table. First entry: `key = 'scheme_fund_total'`, `value = NULL` (not seeded — AG provides when committee confirms)
- [x] 4.2 Add `schemeConfig` table definition to `apps/server/src/db/schema.ts` following existing patterns (UUIDv7 PK, timestamptz)
- [x] 4.3 Run `drizzle-kit generate` to create the migration file — **generate a NEW migration, never re-run for existing ones** (ref: Drizzle Migrations doc)
- [x] 4.4 Implement `getSchemeConfig(key: string)` and `setSchemeConfig(key, value, updatedBy)` utility functions in a new `apps/server/src/services/schemeConfigService.ts`

### Task 5: Dashboard API Endpoint (AC: 1, 4, 5, 7, 8)
- [x] 5.1 Create `apps/server/src/routes/dashboardRoutes.ts` with `GET /api/dashboard/metrics`
- [x] 5.2 Apply middleware chain: `authenticate → authorise(SUPER_ADMIN, DEPT_ADMIN) → scopeToMda → readLimiter → auditLog` (wire existing `readLimiter` from rateLimiter.ts — 120 req/min)
- [x] 5.3 Assemble response by calling: loanClassificationService, revenueProjectionService, schemeConfigService, gratuityProjectionService.getAggregateGratuityExposure(), and direct DB aggregation queries
- [x] 5.4 Compute `fundAvailable`: if `scheme_fund_total` config exists, return `schemeFundTotal - totalDisbursed`. If not configured, return `fundAvailable: null` and `fundConfigured: false`
- [x] 5.5 Compute `totalExposure`: sum of outstanding balances for ACTIVE loans (not raw principal — this is what the scheme is still owed)
- [x] 5.6 Compute `monthlyRecovery`: call `getActualMonthlyRecovery()` for last completed period. Include `recoveryPeriod` in response (e.g., "2026-02")
- [x] 5.7 Ensure response is <2KB — only return numeric aggregates, no arrays/objects
- [x] 5.8 Register route in `apps/server/src/app.ts` BEFORE migrationRoutes
- [x] 5.9 Create `apps/server/src/routes/dashboardRoutes.test.ts` — integration tests for the endpoint, including `fundConfigured: false` scenario

### Task 6: Update Shared Types (AC: 4, 5, 7)
- [x] 6.1 Update `packages/shared/src/types/dashboard.ts` — extend `DashboardMetrics`
- [x] 6.2 Add Zod response schema in `packages/shared/src/validators/dashboardSchemas.ts`
- [x] 6.3 Export new types from `packages/shared/src/index.ts`

### Task 7: Wire Frontend Hook (AC: 1, 3)
- [x] 7.1 Update `apps/client/src/hooks/useDashboardData.ts` — replace mock import with `apiClient<DashboardMetrics>('/dashboard/metrics')` call
- [x] 7.2 Keep queryKey `['dashboard', 'metrics']` and staleTime 30_000
- [x] 7.3 Verify skeleton loading state still works via `isPending`

### Task 8: Update Dashboard UI (AC: 2, 4, 5, 7)
- [x] 8.1 Update `apps/client/src/pages/dashboard/DashboardPage.tsx` — update primary hero row:
  - Active Loans: count format (unchanged)
  - Total Exposure: currency format (now shows outstanding balances, not raw principal)
  - Fund Available: currency format OR "Awaiting Configuration" with info badge if `fundConfigured === false`. Tooltip: "Enter your scheme fund total in Settings when confirmed by the committee"
  - Monthly Recovery: currency format with period subtitle (e.g., "Feb 2026")
- [x] 8.2 Add analytics row with section label "Portfolio Analytics" (6 HeroMetricCards):
  - Loans in Window (count) — "All loans within 60-month accountability period"
  - Outstanding Receivables (currency)
  - Collection Potential (currency) — "Expected monthly if all MDAs submit"
  - At-Risk Amount (currency)
  - Completion Rate (percentage) — label: "Completion Rate (60m)"
  - Completion Rate Lifetime (percentage) — label: "Completion Rate (All-Time)"
- [x] 8.3 Layout: primary row `xl:grid-cols-4`, analytics row `xl:grid-cols-3 2xl:grid-cols-6` (responsive wrap), single column on mobile
- [x] 8.4 Verify mobile stacking: all cards stack vertically on <768px

### Task 9: Update Mock Data (AC: 1)
- [x] 9.1 Update `apps/client/src/mocks/dashboardMetrics.ts` — add all new fields for dev/test fallback
- [x] 9.2 Add a second mock variant with `fundConfigured: false` and `fundAvailable: null` for testing the unconfigured state
- [x] 9.3 Ensure mock values are realistic Oyo State scale

### Task 10: Verification & Performance (AC: 1, 3)
- [x] 10.1 Run `tsc --noEmit` in both apps/server and apps/client — zero errors
- [x] 10.2 Run all existing tests — zero regressions
- [x] 10.3 Verify API response size <2KB via manual check
- [x] 10.4 Verify dashboard route chunk <150KB gzipped
- [x] 10.5 Verify `readLimiter` is applied to dashboard route (120 req/min)

### Review Follow-ups (AI) — Code Review 2026-03-10

- [x] [AI-Review][HIGH] revenueProjectionService.test.ts has placeholder tests (export checks only) — write real unit tests with mocked DB [revenueProjectionService.test.ts]
- [x] [AI-Review][HIGH] Double `classifyAllLoans` call per request + sequential `getTotalOutstandingReceivables` — refactor route to compute inline from already-fetched classifications and parallelize total exposure [dashboardRoutes.ts:61,205]
- [x] [AI-Review][HIGH] Missing RBAC rejection test — add 403 test for mda_officer role [dashboardRoutes.test.ts]
- [x] [AI-Review][MEDIUM] Git changes not in File List: drizzle/meta/_journal.json, drizzle/meta/0016_snapshot.json [story file]
- [x] [AI-Review][MEDIUM] `setSchemeConfig` uses read-then-write instead of atomic upsert — race condition [schemeConfigService.ts:22-43]
- [x] [AI-Review][MEDIUM] N+1 in `getMdaBreakdown` — add TODO for batch refactor before Stories 4.2-4.4 [mdaAggregationService.ts:109]
- [x] [AI-Review][LOW] Duplicate task 10.5 in story file [story file]
- [x] [AI-Review][LOW] Story docs `getAggregateGratuityExposure` return type incorrect — fix docs [story file]
- [x] [AI-Review][LOW] Zod `dashboardMetricsSchema` created but unused — acceptable, note for future client validation

## Dev Notes

### Architecture & Constraints

- **API envelope:** All responses MUST use `{ success: true, data: { ... } }` format
- **Money values:** Always `string` type in JSON (NUMERIC(15,2) → string). Never `number`. Server-side `decimal.js` for all arithmetic. Frontend displays via `<NairaDisplay>` component
- **RBAC:** Dashboard metrics require `super_admin` or `dept_admin` role. `mda_officer` scoped queries use `mdaScope` parameter from JWT. Import role constants from `@vlprs/shared` — never hardcode strings
- **Rate limiting:** Dashboard read endpoints use existing `readLimiter` middleware (120 req/min per user). Already implemented in `apps/server/src/middleware/rateLimiter.ts` — just wire it into the route middleware chain
- **Non-punitive vocabulary:** Use `vocabulary.ts` constants. "Observation" not "Anomaly", "Variance" not "Discrepancy". Badge variants: `review` (gold), `info` (teal), `complete` (green) — never red
- **UUIDv7:** All new primary keys use `generateUuidv7()` from schema.ts
- **Nullable Fund Available:** `fundAvailable: string | null` — the AG may not have the committee-confirmed figure on day one. Frontend must handle `null` gracefully with "Awaiting Configuration" message, not ₦0.00

### Key Metric Definitions (PO-Validated)

| Metric | Definition | Source |
|--------|-----------|--------|
| **Active Loans** | Count of loans with `status = 'ACTIVE'` (currently being serviced via monthly deductions) | FR32, PO clarification |
| **Loans in Window** | Count of ALL loans with `firstDeductionDate` within 60-month accountability window, regardless of status or lifecycle path (Full Tenure, Accelerated, Lump Sum, Retirement Split) | PO clarification, FR32 |
| **Total Exposure** | Sum of outstanding balances (principal + interest remaining) across ACTIVE loans. NOT raw principal — this is what the scheme is still owed. Compute via `computeBalanceFromEntries` or batch SQL: `SUM(principal + interest) - SUM(ledger deductions)` | PO clarification |
| **Total Outstanding Receivables** | Sum of outstanding balances across ACTIVE + OVERDUE + STALLED loans (the full accountability picture, broader than Total Exposure) | PO clarification |
| **Fund Available** | `schemeFundTotal - SUM(principal_amount) WHERE status IN ('ACTIVE', 'COMPLETED')`. Source: `scheme_config` table, key `'scheme_fund_total'`. If not yet configured → `null`. AG enters when committee confirms the figure | PO clarification, Technical Proposal |
| **Monthly Recovery** | Sum of actual deductions submitted by MDAs for the last completed period. NOT the expected/theoretical sum. Comes from `ledger_entries WHERE entry_type = 'PAYROLL'` for the most recent period | PO clarification, FR21 |
| **Monthly Collection Potential** | Sum of `monthlyDeductionAmount` for all ACTIVE loans — the theoretical expected if all MDAs submit correctly. Analytics row metric for Expected vs Actual comparison context | FR32, PO clarification |
| **At-Risk Amount** | Sum of outstanding balances of OVERDUE + STALLED loans | FR32 |
| **Completion Rate (60m)** | `COMPLETED / total loans in rolling 60-month window`. Rolling window: loans with `firstDeductionDate` from (now - 60 months) to now | FR32, PO clarification |
| **Completion Rate (All-Time)** | `COMPLETED / total loans ever created`. No window filter. For historical perspective especially when legacy records are imported | PO clarification |

### Stall Detection Logic (FR26 Clean Threshold)

```
Stall detection uses the same tolerance as the FR26 variance classification system:
- Clean: < ₦1 (sub-kobo rounding noise — not real balance movement)
- Minor Variance: ₦1–₦499 (real but small)
- Significant Variance: ≥ ₦500 (substantial)

For stall detection:
  const STALL_TOLERANCE = new Decimal('1'); // Same as VARIANCE_THRESHOLD_CLEAN

  hasStalled(ledgerEntries):
    Sort entries by period (year, month)
    Compute running balance after each entry
    For consecutive pairs:
      if |balance[N] - balance[N-1]| < STALL_TOLERANCE for 2+ consecutive months:
        → STALLED (balance is not meaningfully moving)
      if |balance[N] - balance[N-1]| >= STALL_TOLERANCE:
        → Real movement, reset consecutive counter

This prevents false stall classifications from sub-kobo decimal arithmetic artifacts.
```

### Expected vs Actual Recovery Insight

The dashboard now surfaces both numbers — enabling the AG to spot variance at a glance:
- **Monthly Recovery** (headline) = what MDAs actually submitted last month
- **Collection Potential** (analytics) = what should have been submitted based on loan records

When `monthlyRecovery < monthlyCollectionPotential`, there's a submission gap. The difference is the aggregate variance. Per-MDA drill-down (Story 4.3, FR34) will show which MDAs are responsible via `variance percentage vs expected deductions`.

This traces to FR21: *"System can compare submitted deductions against expected deduction schedules and generate a comparison summary"* and the non-punitive vocabulary mandate: display as "comparison" and "variance", never "error" or "shortfall".

### Services Already Built (DO NOT recreate)

| Service | File | What It Does |
|---------|------|--------------|
| `computationEngine` | `services/computationEngine.ts` | `computeBalanceFromEntries()`, `computeRepaymentSchedule()`, `computeRetirementDate()`, `computeGratuityProjection()` |
| `balanceService` | `services/balanceService.ts` | `getOutstandingBalance(loanId, asOf?, mdaScope?)` — wraps computationEngine |
| `gratuityProjectionService` | `services/gratuityProjectionService.ts` | `getAggregateGratuityExposure(mdaScope?)` — returns `Promise<string>` (total exposure amount as decimal string) |
| `loanService` | `services/loanService.ts` | `getLoanById()`, `searchLoans()`, `getLoanDetail()` with full balance + gratuity enrichment |
| `mdaService` | `services/mdaService.ts` | `resolveMdaByName()`, `getAllMdas()`, `getMdaById()` |
| `ledgerService` | `services/ledgerService.ts` | Ledger entry creation, computed views |
| `migrationDashboardService` | `services/migrationDashboardService.ts` | Migration-specific dashboard (separate from executive dashboard) |
| `migrationValidationService` | `services/migrationValidationService.ts` | Contains `VARIANCE_THRESHOLD_CLEAN = new Decimal('1')` — reuse this constant pattern for stall detection |

### Services to Create in This Story

| Service | File | Purpose | Consumed By |
|---------|------|---------|-------------|
| `loanClassificationService` | `services/loanClassificationService.ts` | Classify loans as COMPLETED/ON_TRACK/OVERDUE/STALLED/OVER_DEDUCTED (with < ₦1 stall tolerance), compute at-risk amount, completion rate (rolling + lifetime), loans in window | Dashboard API, Stories 4.2-4.4 |
| `revenueProjectionService` | `services/revenueProjectionService.ts` | Monthly collection potential (expected), actual monthly recovery (from submissions), total outstanding receivables | Dashboard API |
| `mdaAggregationService` | `services/mdaAggregationService.ts` | Per-MDA health score, status distribution, metrics breakdown. **Forward-investment for Stories 4.2–4.4 — no API consumer in this story. Test in isolation** |
| `schemeConfigService` | `services/schemeConfigService.ts` | Get/set scheme-level configuration values (e.g., scheme_fund_total). Lightweight key-value store | Dashboard API (Fund Available), future Settings page |

### Loan Classification Logic (60-month accountability window)

```
classifyLoan(loan, ledgerEntries, windowMonths = 60):
  if loan.status === 'COMPLETED' → COMPLETED

  expectedCompletionDate = firstDeductionDate + tenureMonths months
  accountabilityDeadline = expectedCompletionDate + windowMonths months
  outstandingBalance = computeBalanceFromEntries(...)

  if outstandingBalance <= 0 → OVER_DEDUCTED (balance below zero)
  if Date.now() > accountabilityDeadline && outstandingBalance > 0 → OVERDUE

  // Stall detection with FR26 Clean tolerance (< ₦1 = noise)
  if hasConsecutiveNearIdenticalBalances(ledgerEntries, 2, stallTolerance = 1) → STALLED

  → ON_TRACK (default: active, balance decreasing, within window)
```

### MDA Health Score Formula (FR36)

```
healthScore = base(40) + completionRate×40 + onTrackRate×20
  - penalty: stalled loans present → -20
  - penalty: overdue loans present → -20
  - penalty: over-deducted loans present → -20
  clamp(0, 100)

healthBand:
  ≥70 → "healthy" (green badge)
  40-69 → "attention" (amber badge)
  <40 → "for-review" (grey badge — never red)
```

### Frontend Existing Components (REUSE, do not recreate)

| Component | File | Props |
|-----------|------|-------|
| `HeroMetricCard` | `components/shared/HeroMetricCard.tsx` | `label, value, format('currency'|'count'|'percentage'), trend?, onClick?, isPending?, className?` |
| `NairaDisplay` | `components/shared/NairaDisplay.tsx` | `amount: string, variant?: 'hero'` |
| `Skeleton` | `components/ui/skeleton.tsx` | shadcn component |
| `Badge` | `components/ui/badge.tsx` | `variant: 'complete'|'review'|'pending'|'info'` |
| `WelcomeGreeting` | `components/shared/WelcomeGreeting.tsx` | `subtitle: string` |
| `AttentionItemCard` | `components/shared/AttentionItemCard.tsx` | `description, mdaName, category, timestamp` |

### Database Tables

**Existing tables used (read-only):**

| Table | Key Columns for Dashboard |
|-------|--------------------------|
| `loans` | `id`, `staffId`, `mdaId`, `principalAmount`, `monthlyDeductionAmount`, `tenureMonths`, `firstDeductionDate`, `status`, `computedRetirementDate` |
| `ledger_entries` | `loanId`, `amount`, `periodMonth`, `periodYear`, `entryType` |
| `mdas` | `id`, `name`, `code` |

**New table (created in this story):**

| Table | Purpose |
|-------|---------|
| `scheme_config` | Key-value configuration store for scheme-level settings. First entry: `scheme_fund_total`. AG populates when committee confirms the figure. Lightweight — no triggers, no audit log (uses `updated_by` + `updated_at` for traceability) |

### Key Query Patterns

**Active loan count:**
```sql
SELECT COUNT(*) FROM loans WHERE status = 'ACTIVE';
```

**Loans in 60-month window (all lifecycle paths):**
```sql
SELECT COUNT(*) FROM loans
WHERE first_deduction_date >= NOW() - INTERVAL '60 months';
```

**Total exposure (outstanding balances of active loans):**
```sql
-- Batch SQL approximation (performant):
SELECT
  SUM(l.principal_amount) + SUM(l.principal_amount * l.interest_rate / 100)
  - COALESCE(SUM(le.amount), 0) AS total_exposure
FROM loans l
LEFT JOIN ledger_entries le ON le.loan_id = l.id
WHERE l.status = 'ACTIVE';
-- Or iterate via computeBalanceFromEntries for exact values (slower but precise)
```

**Actual monthly recovery (last completed period):**
```sql
SELECT SUM(amount) as recovery, period_month, period_year
FROM ledger_entries
WHERE entry_type = 'PAYROLL'
GROUP BY period_month, period_year
ORDER BY period_year DESC, period_month DESC
LIMIT 1;
```

**Monthly collection potential (expected):**
```sql
SELECT SUM(monthly_deduction_amount) FROM loans WHERE status = 'ACTIVE';
```

**Fund available:**
```sql
-- Step 1: Get scheme fund total from config
SELECT value FROM scheme_config WHERE key = 'scheme_fund_total';
-- Step 2: If configured, compute:
-- fund_available = scheme_fund_total - SUM(principal_amount) WHERE status IN ('ACTIVE', 'COMPLETED')
-- If not configured: return null
```

### Performance Budget

- API response: <2KB (all metrics — no arrays, no nested objects beyond staffIdCoverage)
- Dashboard route chunk: <150KB gzipped
- LCP target: <3s on 4G
- TanStack Query: staleTime 30s, auto-refetch on window focus
- Skeleton loading: renders within 1s (already implemented)

### Middleware Stack for Dashboard Routes

```typescript
import { authenticate } from '../middleware/authenticate';
import { authorise } from '../middleware/authorise';
import { scopeToMda } from '../middleware/scopeToMda';
import { readLimiter } from '../middleware/rateLimiter';
import { auditLog } from '../middleware/auditLog';
import { ROLES } from '@vlprs/shared';

const dashboardAuth = [
  authenticate,
  authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN),
  scopeToMda,
  readLimiter,  // 120 req/min — already implemented
  auditLog,
];
```

### Route Registration

Add to `apps/server/src/app.ts` BEFORE migrationRoutes (which is the catch-all):
```typescript
import dashboardRoutes from './routes/dashboardRoutes';
// ...
app.use('/api', dashboardRoutes);  // Add before migrationRoutes
```

### Wiring Hook Pattern (Zero UI Component Changes for existing cards)

The `useDashboardMetrics()` hook already exists at `apps/client/src/hooks/useDashboardData.ts` with mock data. Change ONLY the `queryFn`:

```typescript
// BEFORE (mock):
queryFn: async () => MOCK_DASHBOARD_METRICS,

// AFTER (real API):
queryFn: () => apiClient<DashboardMetrics>('/dashboard/metrics'),
```

Keep: queryKey `['dashboard', 'metrics']`, staleTime 30_000, return type `DashboardMetrics`.

### Project Structure Notes

- All new service files go in `apps/server/src/services/`
- All test files co-located: `serviceName.test.ts` alongside `serviceName.ts`
- Route file: `apps/server/src/routes/dashboardRoutes.ts`
- Shared types: `packages/shared/src/types/dashboard.ts`
- Shared validators: `packages/shared/src/validators/dashboardSchemas.ts` (new file)
- New table: `scheme_config` (Drizzle migration required)
- No new client components needed — reuse HeroMetricCard (except Fund Available unconfigured state needs conditional rendering)

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 4, Story 4.1]
- [Source: _bmad-output/planning-artifacts/prd.md — FR32, FR33, FR34, FR35, FR36, FR21, FR26]
- [Source: _bmad-output/planning-artifacts/architecture.md — Dashboard API, Services Dependency Map, Performance Budgets]
- [Source: _bmad-output/planning-artifacts/executive-dashboard-report-specs.md — Loan Classification Service, Revenue Projection]
- [Source: Story 10.3 — Deferred task: wire gratuityProjectionService.getAggregateGratuityExposure()]
- [Source: WIRING-MAP.md — useDashboardMetrics() → GET /api/dashboard/metrics]
- [Source: apps/server/src/services/gratuityProjectionService.ts — getAggregateGratuityExposure() already implemented]
- [Source: apps/server/src/services/computationEngine.ts — computeBalanceFromEntries() for balance derivation]
- [Source: apps/server/src/services/balanceService.ts — getOutstandingBalance() wrapper]
- [Source: apps/server/src/services/migrationValidationService.ts — VARIANCE_THRESHOLD_CLEAN = 1 (stall tolerance source)]
- [Source: apps/server/src/middleware/rateLimiter.ts — readLimiter (120 req/min)]
- [Source: docs/proposal/technical-proposal.html — "available fund balance for new loan approvals"]
- [Source: PO validation session 2026-03-10 — Fund Available, Active Loans, Total Exposure, Monthly Recovery, stall tolerance, completion rate scope]

### Previous Story Intelligence (Epic 3)

- **Code review patterns:** Audit logging required for all mutation operations (H priority). Batch aggregation preferred over N+1 queries (M priority). LIKE escaping for user input filters (L priority).
- **Testing rewrite risk:** Tests were rewritten twice in Story 3.8 during code review. Write tests that directly test AC requirements — not implementation details.
- **API response envelope:** Always `{ success: true, data: {...} }`. Verified by all Epic 3 stories.
- **Badge variants:** Use `complete`, `review`, `info`, `pending` — never custom strings.
- **Drizzle queries:** Use Drizzle query builder. Numeric fields return as strings from PostgreSQL — handle accordingly with `decimal.js` on server.

### Git Intelligence (Recent Commits)

Recent commit pattern: `feat: Story X.Y — Title with code review fixes`. Stories are committed as single feature commits with code review fixes bundled. All recent work is Epic 3 (migration engine) — Epic 4 is a clean transition to the executive dashboard domain.

## Validation Log

### PM Validation (2026-03-10)

**Validator:** John (PM Agent)
**PO:** Awwal

**Changes applied from validation:**

| # | Change | Rationale | Traced To |
|---|--------|-----------|-----------|
| 1 | **Total Exposure** redefined: outstanding balances (not raw principal) | AG needs "what we're still owed", not "what we disbursed" | PO clarification |
| 2 | **Fund Available** → `scheme_config` table, nullable, "Awaiting Configuration" if empty | AG may not have committee-confirmed figure on day one. Avoids misleading ₦0.00 | PO clarification, Technical Proposal |
| 3 | **Monthly Recovery** → actual last-period submissions, not theoretical expected | AG needs ground truth from MDAs, not projections | PO clarification, FR21 |
| 4 | **Monthly Collection Potential** → moved to analytics row | Expected monthly becomes comparison context against actual recovery | PO clarification |
| 5 | **Loans in Window** added as analytics metric | Both "currently servicing" (Active Loans) and "in accountability scope" (Loans in Window) needed | PO clarification |
| 6 | **Stall detection tolerance** → < ₦1 (FR26 Clean threshold) | Prevents false stall classifications from sub-kobo rounding artifacts | PO clarification, FR26 |
| 7 | **Completion Rate** → both rolling 60-month AND lifetime | Rolling for current performance, lifetime for historical perspective with legacy data imports | PO clarification |
| 8 | **Rate limiting** → wire existing `readLimiter` into dashboard route | Was mentioned in Dev Notes but had no task. Limiter already exists | PM validation (minor observation) |
| 9 | **MDA Aggregation Service** → added note about forward-investment, test in isolation | No API consumer in 4.1 — dev should know this | PM validation (minor observation) |
| 10 | **Single endpoint clarification** → removed <1KB claim for 4-primary subset | One endpoint returns all metrics. <2KB is the testable AC | PM validation (minor observation) |

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
- LATERAL JOIN in Drizzle ORM not supported for complex SQL — rewrote total exposure query to use separate queries for loan totals and ledger sums
- Client TypeScript errors after shared type update — resolved by rebuilding shared package (`pnpm --filter @vlprs/shared run build`)
- useDashboardData.test.tsx failure — test was testing mock-based queryFn; updated to mock apiClient

### Completion Notes List
- **Task 1:** Loan Classification Service with 5 classification types (COMPLETED, ON_TRACK, OVERDUE, STALLED, OVER_DEDUCTED). Pure `classifyLoan()` function + DB-backed aggregation functions. 13 unit tests covering all classification rules, edge cases, priority ordering, and FR26 stall tolerance.
- **Task 2:** Revenue Projection Service with collection potential (theoretical expected), actual monthly recovery (from ledger entries), and total outstanding receivables (ACTIVE + OVERDUE + STALLED). 3 export tests.
- **Task 3:** MDA Aggregation Service with health score formula (base 40 + completion×40 + onTrack×20 - penalties). Forward-investment for Stories 4.2-4.4. 9 unit tests for health score computation and band classification.
- **Task 4:** `scheme_config` table (migration 0016) + `schemeConfigService` with get/set operations. UUIDv7 PK, unique key constraint, FK to users.
- **Task 5:** `GET /api/dashboard/metrics` endpoint with full middleware chain (authenticate, requirePasswordChange, authorise, scopeToMda, readLimiter, auditLog). Assembles all metrics via Promise.all for concurrent execution. 6 integration tests including auth, fund configuration states, payload size.
- **Task 6:** Extended `DashboardMetrics` interface with 8 new fields (fundConfigured, recoveryPeriod, loansInWindow, totalOutstandingReceivables, monthlyCollectionPotential, atRiskAmount, loanCompletionRate, loanCompletionRateLifetime). Added Zod response schema.
- **Task 7:** Wired `useDashboardMetrics` hook from mock to real `apiClient('/dashboard/metrics')`. Updated test to mock apiClient.
- **Task 8:** Updated DashboardPage with conditional Fund Available rendering ("Awaiting Configuration" when unconfigured), recovery period subtitle, and new Portfolio Analytics section (6 HeroMetricCards). Responsive grid: xl:grid-cols-3 2xl:grid-cols-6.
- **Task 9:** Updated mock data with all new fields at realistic Oyo State scale. Added MOCK_DASHBOARD_METRICS_UNCONFIGURED variant.
- **Task 10:** TypeScript zero errors (both apps). 949 server tests pass, 380 client tests pass. API payload <2KB verified. readLimiter wired to dashboard route.

### Change Log
- 2026-03-10: Story 4.1 implementation complete — all 10 tasks done, all ACs satisfied
- 2026-03-10: Code review fixes applied (9 findings: 3H, 3M, 3L + bonus latent bug fix):
  - [H1] Replaced placeholder revenueProjectionService tests with 8 real integration tests
  - [H2] Refactored dashboardRoutes to eliminate double classifyAllLoans call, parallelize total exposure, compute totalOutstandingReceivables inline
  - [H3] Added RBAC rejection test (403 for mda_officer)
  - [M2] schemeConfigService.setSchemeConfig → atomic upsert via onConflictDoUpdate
  - [M3] Added TODO to getMdaBreakdown for N+1 batch refactor before Stories 4.2-4.4
  - [BONUS] Fixed latent Drizzle ANY() bug — replaced sql`ANY(${array})` with inArray() across loanClassificationService, revenueProjectionService, dashboardRoutes (would have crashed with real loan data)
  - All 955 server tests + 380 client tests pass

### File List
- apps/server/src/services/loanClassificationService.ts (new)
- apps/server/src/services/loanClassificationService.test.ts (new)
- apps/server/src/services/revenueProjectionService.ts (new)
- apps/server/src/services/revenueProjectionService.test.ts (new)
- apps/server/src/services/mdaAggregationService.ts (new)
- apps/server/src/services/mdaAggregationService.test.ts (new)
- apps/server/src/services/schemeConfigService.ts (new)
- apps/server/src/db/schema.ts (modified — added schemeConfig table)
- apps/server/drizzle/0016_magical_puck.sql (new — scheme_config migration)
- apps/server/src/routes/dashboardRoutes.ts (new)
- apps/server/src/routes/dashboardRoutes.test.ts (new)
- apps/server/src/app.ts (modified — registered dashboardRoutes)
- packages/shared/src/types/dashboard.ts (modified — extended DashboardMetrics)
- packages/shared/src/validators/dashboardSchemas.ts (new)
- packages/shared/src/index.ts (modified — exported new types)
- apps/client/src/hooks/useDashboardData.ts (modified — wired to real API)
- apps/client/src/hooks/useDashboardData.test.tsx (modified — mock apiClient)
- apps/client/src/pages/dashboard/DashboardPage.tsx (modified — analytics row + fund available)
- apps/server/drizzle/meta/_journal.json (modified — migration 0016 journal entry)
- apps/server/drizzle/meta/0016_snapshot.json (new — migration 0016 snapshot)
- apps/client/src/mocks/dashboardMetrics.ts (modified — all new fields + unconfigured variant)
