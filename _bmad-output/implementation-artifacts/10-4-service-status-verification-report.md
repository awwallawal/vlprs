<!-- Generated: 2026-03-01 | Epic: 10 | Sprint: 4 -->
<!-- Blocked By: 10-1 (computed_retirement_date column, temporalProfileService), 10-2 (service_extensions table — must respect extension overrides to avoid false positives), 10-3 (gratuityProjectionService — optional enrichment for report rows) | Blocks: Epic 3 Story 3.6 (observation engine consumes this report's logic for migration-time post-retirement detection) -->
<!-- FRs: FR71 | Motivation: During migration import, Department Admins need visibility into staff whose retirement date has passed but still have active loans — these may have retired, received undocumented extensions, or have incorrect dates -->
<!-- Source: epics.md → Epic 10, Story 10.4 | prd.md → FR71 | architecture.md → Reporting, MDA Scoping, Pagination -->

# Story 10.4: Service Status Verification Report

Status: done

## Story

As a **Department Admin**,
I want a report listing all imported staff whose computed retirement date has already passed but who have active loans,
so that I can investigate whether these staff have retired, received extensions, or have incorrect dates.

## Acceptance Criteria

### AC 1: Post-Retirement Activity Detection (FR71)

**Given** loans exist in the system with complete temporal profiles
**When** `GET /api/reports/service-status-verification` is called (with optional `?asOfDate=` parameter, default: today)
**Then** the report lists all loans where `computed_retirement_date < asOfDate` AND `status = 'ACTIVE'`
**And** each row contains: `staffName`, `staffId` (if available), `mdaName`, `loanReference`, `computedRetirementDate` (effective — includes service extension override), `monthsPastRetirement`, `outstandingBalance`
**And** results are paginated (default 50 per page) and sorted by `monthsPastRetirement` descending (worst cases first)

### AC 2: Service Extension Awareness

**Given** a staff member has an active loan with a service extension (Story 10.2) that pushes their effective retirement date beyond today
**When** the verification report is generated
**Then** that staff member is EXCLUDED from the report (their extension makes them not-post-retirement)

**Given** a staff member has a service extension but the extension date has ALSO passed
**When** the verification report is generated
**Then** that staff member IS included, with a flag `hasExpiredExtension: true` and the extension reference number shown

### AC 3: Action Resolution Options

**Given** the report is displayed
**When** Department Admin reviews a flagged staff member
**Then** the report row includes `availableActions`:
- `"file_retirement_event"` — transitions loan to ceased-deduction state (Epic 11 integration — for now, just list the action label)
- `"record_service_extension"` — links to `POST /api/loans/:loanId/service-extension` (Story 10.2, already implemented)
- `"flag_for_investigation"` — placeholder action label for future Epic 7 exception flagging

**Note:** Action execution is NOT in scope for this story — only the action labels and target loanIds are returned in the response. Frontend and Epic 7/11 will wire the actual actions.

### AC 4: Clean Report State

**Given** no loans meet the post-retirement criteria
**When** the report is generated
**Then** the response returns an empty `data` array with `summary.totalFlagged: 0` and `summary.message: "No post-retirement activity detected"`

### AC 5: Report Summary Metrics

**Given** the report contains flagged loans
**When** the response is returned
**Then** it includes a `summary` object with:
- `totalFlagged`: count of all flagged loans
- `totalOutstandingExposure`: SUM of outstanding balances across all flagged loans (string, 2 decimals)
- `totalWithExpiredExtensions`: count of loans with expired service extensions
- `totalWithoutExtensions`: count of loans that never had extensions
- `mdaBreakdown`: array of `{ mdaName, mdaId, count, outstandingExposure }` grouped by MDA
- `message`: `"No post-retirement activity detected"` if empty, otherwise `null`

### AC 6: MDA Scoping and Filtering

**Given** the report endpoint is called
**When** by an `mda_officer`
**Then** results are scoped to their MDA only (same `withMdaScope()` pattern)

**When** by a `super_admin` or `dept_admin`
**Then** results include all MDAs, with optional `?mdaId=` query parameter to filter to a specific MDA

**And** optional filters are supported: `?mdaId=` (UUID), `?asOfDate=` (ISO date, default: today — enables FR71 migration context via `import_date`), `?page=` (default 1), `?pageSize=` (default 50, max 200)

## Tasks / Subtasks

- [x] Task 1: Shared types (AC: 1, 3, 4, 5)
  - [x] 1.1 Add to `packages/shared/src/types/loan.ts` (or create `packages/shared/src/types/report.ts` if it makes the types cleaner — either approach is acceptable):
    - `ServiceStatusVerificationRow` interface:
      ```
      {
        loanId: string;
        staffName: string;
        staffId: string | null;
        mdaName: string;
        mdaId: string;
        loanReference: string;
        computedRetirementDate: string;
        monthsPastRetirement: number;
        outstandingBalance: string;
        hasExpiredExtension: boolean;
        expiredExtensionReference: string | null;
        availableActions: string[];
      }
      ```
    - `ServiceStatusVerificationSummary` interface:
      ```
      {
        totalFlagged: number;
        totalOutstandingExposure: string;
        totalWithExpiredExtensions: number;
        totalWithoutExtensions: number;
        mdaBreakdown: Array<{ mdaName: string; mdaId: string; count: number; outstandingExposure: string }>;
        message: string | null;
      }
      ```
    - `ServiceStatusVerificationReport` interface:
      ```
      {
        data: ServiceStatusVerificationRow[];
        summary: ServiceStatusVerificationSummary;
        pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
      }
      ```
  - [x] 1.2 Export from `packages/shared/src/index.ts` barrel

- [x] Task 2: Zod validator for query params (AC: 6)
  - [x] 2.1 Add to `packages/shared/src/validators/loanSchemas.ts` (or `reportSchemas.ts`): `serviceStatusVerificationQuerySchema`:
    ```
    z.object({
      mdaId: z.uuid().optional(),
      asOfDate: z.iso.date('asOfDate must be a valid ISO date (YYYY-MM-DD)').optional(),
      page: z.coerce.number().int().min(1).optional(),
      pageSize: z.coerce.number().int().min(1).max(200).optional(),
    })
    ```
  - [x] 2.2 Export from barrel

- [x] Task 3: Report service (AC: 1, 2, 4, 5, 6)
  - [x] 3.1 Create `apps/server/src/services/serviceStatusReportService.ts`
  - [x] 3.2 Implement `getServiceStatusVerificationReport(mdaScope, filters)`:
    - **Query:** SELECT loans JOIN mdas WHERE `status = 'ACTIVE'` AND `computed_retirement_date IS NOT NULL` AND `computed_retirement_date < asOfDate` (where `asOfDate` defaults to today if not provided — enables FR71 migration context when Epic 3 passes the import date)
    - Apply `withMdaScope()` for MDA isolation
    - Apply optional `mdaId` filter
    - **Service extension check:** For each flagged loan, LEFT JOIN or sub-query `service_extensions` to find the MOST RECENT extension:
      - If extension exists AND `newRetirementDate > today` → EXCLUDE from report (valid extension, not post-retirement)
      - If extension exists AND `newRetirementDate <= today` → INCLUDE with `hasExpiredExtension: true`, `expiredExtensionReference` = extension's `approvingAuthorityReference`
      - If no extension → INCLUDE with `hasExpiredExtension: false`
    - **Pagination:** Two-query pattern (count + fetch), same as `searchLoans()`
    - **Sort:** `monthsPastRetirement` DESC (worst cases first)
  - [x] 3.3 Implement balance computation for report rows:
    - Use batch aggregation pattern from `searchLoans()` — single query for all loans in page:
      ```sql
      SELECT loan_id, SUM(amount) as total_paid
      FROM ledger_entries
      WHERE loan_id IN (...)
      GROUP BY loan_id
      ```
    - Compute `outstandingBalance = totalLoan - totalPaid` per loan using Decimal.js
    - Avoids N+1 — single DB hit for all page results
  - [x] 3.4 Implement `computeMonthsPastRetirement(retirementDate, asOfDate)`:
    - Simple: `Math.abs(differenceInMonths(asOfDate, retirementDate))` — `asOfDate` comes from the query param (default: today)
    - Could add to `computationEngine.ts` as a pure helper, or inline in service — follow team convention
  - [x] 3.5 Implement summary computation:
    - `totalFlagged`: count from pagination query (totalItems)
    - `totalOutstandingExposure`: SUM of all flagged loans' outstanding balances (separate aggregate query on FULL result set, not just current page)
    - `totalWithExpiredExtensions` / `totalWithoutExtensions`: COUNT from extension sub-query
    - `mdaBreakdown`: GROUP BY mdaId with COUNT + SUM(outstandingBalance)
    - `message`: `"No post-retirement activity detected"` if totalFlagged === 0, else `null`
  - [x] 3.6 **Performance:** Summary aggregates must query the FULL dataset (not just the paginated page). Run summary queries in parallel with page data query using `Promise.all()`

- [x] Task 4: Route (AC: 1, 6)
  - [x] 4.1 Create `apps/server/src/routes/reportRoutes.ts`:
    - `GET /reports/service-status-verification` — middleware: `[authenticate, requirePasswordChange, authorise(SUPER_ADMIN, DEPT_ADMIN, MDA_OFFICER), scopeToMda, validate(serviceStatusVerificationQuerySchema, 'query'), auditLog]` → call `getServiceStatusVerificationReport()` → respond `{ success: true, data: report.data, summary: report.summary, pagination: report.pagination }`
  - [x] 4.2 Register in `apps/server/src/app.ts`: `app.use('/api', reportRoutes)`
  - [x] 4.3 **Note:** This is the FIRST report endpoint — creating a new `reportRoutes.ts` file establishes the pattern for Epic 6 (Reporting & PDF Export). Future report endpoints (executive summary, variance, weekly AG report) will be added here

- [x] Task 5: Vocabulary (AC: 4)
  - [x] 5.1 Add to `packages/shared/src/constants/vocabulary.ts`: `NO_POST_RETIREMENT_ACTIVITY: 'No post-retirement activity detected'`
  - [x] 5.2 Export from barrel

- [x] Task 6: Integration tests (AC: 1, 2, 3, 4, 5, 6)
  - [x] 6.1 Create `apps/server/src/services/serviceStatusReportService.integration.test.ts`
  - [x] 6.2 Seed: 2 MDAs, users (super_admin, dept_admin, mda_officer for MDA-1), loans:
    - Loan A: MDA-1, ACTIVE, retirement date 6 months ago, no extension → FLAGGED
    - Loan B: MDA-1, ACTIVE, retirement date 2 months ago, has valid extension (extension date in future) → EXCLUDED
    - Loan C: MDA-2, ACTIVE, retirement date 12 months ago, has EXPIRED extension (extension date 3 months ago) → FLAGGED with `hasExpiredExtension: true`
    - Loan D: MDA-1, ACTIVE, retirement date in future → EXCLUDED (not post-retirement)
    - Loan E: MDA-1, COMPLETED, retirement date 6 months ago → EXCLUDED (not ACTIVE)
    - Loan F: MDA-2, ACTIVE, no temporal profile (no DOB) → EXCLUDED (no `computed_retirement_date`)
  - [x] 6.3 Test: GET report as super_admin → returns Loan A + Loan C, NOT B/D/E/F. Verify all fields present: staffName, staffId, mdaName, loanReference, computedRetirementDate, monthsPastRetirement, outstandingBalance
  - [x] 6.4 Test: Report sorted by `monthsPastRetirement` DESC → Loan C (12 months) before Loan A (6 months)
  - [x] 6.5 Test: Loan C has `hasExpiredExtension: true` and `expiredExtensionReference` populated
  - [x] 6.6 Test: Loan A has `hasExpiredExtension: false` and `expiredExtensionReference: null`
  - [x] 6.7 Test: `availableActions` includes `"record_service_extension"`, `"file_retirement_event"`, `"flag_for_investigation"` for each row
  - [x] 6.8 Test: Summary → `totalFlagged: 2`, `totalOutstandingExposure` matches SUM of A + C balances, `totalWithExpiredExtensions: 1`, `totalWithoutExtensions: 1`, `message: null`
  - [x] 6.9 Test: `mdaBreakdown` → 2 entries: MDA-1 (count: 1, Loan A exposure), MDA-2 (count: 1, Loan C exposure)
  - [x] 6.10 Test: MDA scoping — officer (MDA-1) sees Loan A only; Loan C (MDA-2) excluded → `totalFlagged: 1`
  - [x] 6.11 Test: Filter `?mdaId=MDA-2` as super_admin → only Loan C returned
  - [x] 6.12 Test: Clean state — delete/update all loans to not match criteria → `data: []`, `summary.totalFlagged: 0`, `summary.message: "No post-retirement activity detected"`
  - [x] 6.13 Test: Pagination — seed 5 flagged loans, `?pageSize=2&page=1` → 2 results, `totalItems: 5`, `totalPages: 3`
  - [x] 6.14 Test: Summary aggregates cover FULL dataset even when paginated — `totalFlagged: 5` regardless of `pageSize=2`
  - [x] 6.15 Test: `asOfDate` parameter — seed a loan with retirement date 2026-02-01. Call with `?asOfDate=2026-01-15` → loan EXCLUDED (retirement after asOfDate). Call with `?asOfDate=2026-03-01` → loan INCLUDED. Validates FR71 migration context where import date differs from today
  - [x] 6.16 Test: `asOfDate` default — call without parameter → behaves as `asOfDate=today` (same results as current date comparison)
  - [x] 6.17 Test: Unauthenticated → 401, insufficient role → 403

### Review Follow-ups (AI)

- [x] [AI-Review][HIGH] H1: Add documented 403 test comment — all 3 system roles are authorized, so 403 is untestable. Document rationale in test file and Dev Notes [serviceStatusReportService.integration.test.ts]
- [x] [AI-Review][HIGH] H2: Parallelize page balance + extension ref queries in second Promise.all instead of sequential execution. Reduce DB round-trips from 7+ to 5 in common case [serviceStatusReportService.ts:124-163]
- [x] [AI-Review][MEDIUM] M1: Add sprint-status.yaml to story File List [story file]
- [x] [AI-Review][MEDIUM] M2: Document sort-by-days design choice — provides finer granularity than AC's month-level sort [serviceStatusReportService.ts:87]
- [x] [AI-Review][MEDIUM] M3: Add rationale for 403 test omission to Dev Agent Record [story file]
- [x] [AI-Review][MEDIUM] M4: Add code comment explaining non-null assertion safety on or() [serviceStatusReportService.ts:53]
- [x] [AI-Review][MEDIUM] M5: Add guard to reuse page data for summary when totalItems <= pageSize — eliminates redundant full-dataset re-query [serviceStatusReportService.ts:197-252]
- [x] [AI-Review][LOW] L1: Add computedRetirementDate format assertion (YYYY-MM-DD) to tests [serviceStatusReportService.integration.test.ts]
- [x] [AI-Review][LOW] L2: Add code comment documenting zero-floor behavior on outstandingBalance [serviceStatusReportService.ts:171]
- [x] [AI-Review][LOW] L3: Add code comment noting timezone sensitivity in default asOfDate [serviceStatusReportService.ts:31]

## Dev Notes

### Report Query — Efficient Single-Pass with Extension Check

The core query needs to find post-retirement ACTIVE loans while filtering out those with valid (non-expired) service extensions. Use a LEFT JOIN with a sub-query for the latest extension:

```typescript
// Sub-query: latest extension per loan
const latestExtension = db
  .select({
    loanId: serviceExtensions.loanId,
    newRetirementDate: sql`MAX(${serviceExtensions.newRetirementDate})`.as('latest_ext_date'),
    reference: sql`(
      SELECT ${serviceExtensions.approvingAuthorityReference}
      FROM ${serviceExtensions} se2
      WHERE se2.loan_id = ${serviceExtensions.loanId}
      ORDER BY se2.created_at DESC LIMIT 1
    )`.as('latest_ext_ref'),
  })
  .from(serviceExtensions)
  .groupBy(serviceExtensions.loanId)
  .as('latest_ext');

// Main query
const rows = await db
  .select({
    loanId: loans.id,
    staffName: loans.staffName,
    staffId: loans.staffId,
    mdaName: mdas.name,
    mdaId: loans.mdaId,
    loanReference: loans.loanReference,
    computedRetirementDate: loans.computedRetirementDate,
    latestExtDate: latestExtension.newRetirementDate,
    latestExtRef: latestExtension.reference,
  })
  .from(loans)
  .innerJoin(mdas, eq(loans.mdaId, mdas.id))
  .leftJoin(latestExtension, eq(loans.id, latestExtension.loanId))
  .where(and(
    eq(loans.status, 'ACTIVE'),
    isNotNull(loans.computedRetirementDate),
    lt(loans.computedRetirementDate, asOfDate),     // retirement date before asOfDate (default: today)
    // Defensive: also exclude loans with valid (non-expired) extensions.
    // This is technically redundant when Story 10.2 correctly updates computed_retirement_date
    // to the extension date — but guards against edge cases where the loan record and
    // extension table are out of sync. The LEFT JOIN is needed regardless for hasExpiredExtension flag.
    or(
      isNull(latestExtension.newRetirementDate),              // no extension at all
      lte(latestExtension.newRetirementDate, asOfDate),       // extension also expired relative to asOfDate
    ),
    ...mdaScopeCondition,
  ))
  .orderBy(desc(sql`${asOfDate} - ${loans.computedRetirementDate}`))
  .limit(pageSize)
  .offset(offset);
```

**Alternative simpler approach** if the sub-query is complex in Drizzle ORM:
- Fetch all ACTIVE loans with `computed_retirement_date < today`
- For each, query latest extension in application code
- Filter in application layer
- This is acceptable for MVP scale (hundreds, not millions of loans)

Choose whichever approach is cleaner in Drizzle. Document the choice.

### Batch Balance Computation (Same as searchLoans)

Avoid N+1 by computing balances in a single aggregation query:

```typescript
const loanIds = rows.map(r => r.loanId);

// Single query for all balances
const balanceAggs = await db
  .select({
    loanId: ledgerEntries.loanId,
    totalPaid: sql<string>`COALESCE(SUM(${ledgerEntries.amount}), '0')`,
  })
  .from(ledgerEntries)
  .where(inArray(ledgerEntries.loanId, loanIds))
  .groupBy(ledgerEntries.loanId);

const balanceMap = new Map(balanceAggs.map(b => [b.loanId, b.totalPaid]));

// Compute outstanding per loan
for (const row of rows) {
  const totalLoan = new Decimal(row.principalAmount)
    .plus(new Decimal(row.principalAmount).mul(new Decimal(row.interestRate).div(100)));
  const paid = new Decimal(balanceMap.get(row.loanId) || '0');
  row.outstandingBalance = totalLoan.minus(paid).toFixed(2);
}
```

### Summary Aggregates — Full Dataset, Not Just Page

Summary must reflect the ENTIRE filtered dataset, not just the current page. Run summary queries in parallel with the page data fetch:

```typescript
const [pageData, countResult, summaryResult] = await Promise.all([
  // 1. Paginated data fetch
  fetchPageData(conditions, pageSize, offset),
  // 2. Total count
  db.select({ value: count() }).from(loans).where(and(...conditions)),
  // 3. Summary aggregates (no LIMIT/OFFSET — full dataset)
  db.select({
    totalExposure: sql<string>`COALESCE(SUM(...), '0.00')`,
    withExpiredExt: sql<number>`COUNT(*) FILTER (WHERE latest_ext_date IS NOT NULL)`,
    withoutExt: sql<number>`COUNT(*) FILTER (WHERE latest_ext_date IS NULL)`,
  }).from(loans).where(and(...conditions)),
]);
```

### MDA Breakdown — GROUP BY

```typescript
const mdaBreakdown = await db
  .select({
    mdaId: loans.mdaId,
    mdaName: mdas.name,
    count: count(),
    outstandingExposure: sql<string>`...`,  // SUM of per-loan balances
  })
  .from(loans)
  .innerJoin(mdas, eq(loans.mdaId, mdas.id))
  .where(and(...conditions))  // same conditions as main query
  .groupBy(loans.mdaId, mdas.name);
```

### Available Actions — Labels Only (Not Executable)

This story returns action LABELS, not action implementations. The frontend will wire these to actual endpoints:

```typescript
const availableActions = [
  'record_service_extension',    // → POST /api/loans/:loanId/service-extension (Story 10.2)
  'file_retirement_event',       // → POST /api/employment-events (Epic 11, future)
  'flag_for_investigation',      // → Exception queue (Epic 7, future)
];
```

Every row gets the same action set. In future stories, actions may be conditionally available based on loan state.

### Creating reportRoutes.ts — First Report Endpoint

This is the **first dedicated report route file**. It establishes the pattern for Epic 6 (Reporting & PDF Export):

```typescript
// apps/server/src/routes/reportRoutes.ts
import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requirePasswordChange } from '../middleware/requirePasswordChange';
import { authorise } from '../middleware/authorise';
import { scopeToMda } from '../middleware/scopeToMda';
import { validate } from '../middleware/validate';
import { auditLog } from '../middleware/auditLog';
import { ROLES } from '@vlprs/shared';
import * as reportService from '../services/serviceStatusReportService';

const router = Router();

const reportAuth = [
  authenticate,
  requirePasswordChange,
  authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN, ROLES.MDA_OFFICER),
  scopeToMda,
];

router.get(
  '/reports/service-status-verification',
  ...reportAuth,
  validate(serviceStatusVerificationQuerySchema, 'query'),
  auditLog,
  async (req, res) => {
    const report = await reportService.getServiceStatusVerificationReport(
      req.mdaScope,
      {
        mdaId: req.query.mdaId as string | undefined,
        asOfDate: req.query.asOfDate ? new Date(req.query.asOfDate as string) : new Date(),
        page: req.query.page ? Number(req.query.page) : undefined,
        pageSize: req.query.pageSize ? Number(req.query.pageSize) : undefined,
      },
    );
    res.json({
      success: true,
      data: report.data,
      summary: report.summary,
      pagination: report.pagination,
    });
  },
);

export default router;
```

Register in `app.ts`:
```typescript
import reportRoutes from './routes/reportRoutes';
app.use('/api', reportRoutes);
```

### Role Permissions

- **GET /reports/service-status-verification:** All roles — `super_admin` and `dept_admin` see all MDAs (with optional filter), `mda_officer` sees only their MDA
- Actions are labels only — no write operations in this endpoint

### What NOT To Do (Scope Boundary)

- **Do NOT** implement action execution — only return action labels and loanIds. Actual retirement event filing is Epic 11, exception flagging is Epic 7
- **Do NOT** create PDF export — that's Epic 6 (Story 6.4). This story returns JSON only
- **Do NOT** create a frontend component — backend-only report endpoint
- **Do NOT** trigger the report automatically on migration import — Epic 3 will call this endpoint or its service when needed
- **Do NOT** store report results — the report is generated fresh on each request from current data
- **Do NOT** add `computeMonthsPastRetirement` to `computationEngine.ts` if it's a trivial one-liner — inline it in the service. Only extract to computation engine if the logic is reusable and non-trivial

### Existing Infrastructure (Do NOT Recreate)

| Component | Location | Status |
|-----------|----------|--------|
| `loans` table with `computed_retirement_date` | `apps/server/src/db/schema.ts` | Story 10.1 |
| `service_extensions` table | `apps/server/src/db/schema.ts` | Story 10.2 |
| `withMdaScope()` utility | `apps/server/src/lib/mdaScope.ts` | Exists |
| `searchLoans()` batch balance pattern | `apps/server/src/services/loanService.ts` | Story 2.6 (reference) |
| `computeRemainingServiceMonths()` | `apps/server/src/services/computationEngine.ts` | Story 10.1 |
| `Decimal.js` | Already installed | Exists |
| `differenceInMonths` from `date-fns` | Already installed | Exists |
| `count()`, `sql`, `and()`, `or()` from `drizzle-orm` | Already imported across services | Exists |
| Middleware stack (authenticate, authorise, scopeToMda, validate, auditLog) | `apps/server/src/middleware/` | Exists |
| `AppError` class | `apps/server/src/lib/appError.ts` | Exists |
| Pagination response pattern | `searchLoans()`, `listUsers()` | Exists (reference) |

### Dependencies on Prior Stories

- **Story 10.1** (`computed_retirement_date` column, temporal profile) — retirement date source for the WHERE clause
- **Story 10.2** (`service_extensions` table) — must check for valid extensions to avoid false positives
- **Story 10.3** (`gratuityProjectionService`) — optional enrichment; if available, report rows could include gratuity projection (but not required for AC)
- **Story 2.5** (balance computation) — outstanding balance calculation pattern
- **Story 2.6** (`searchLoans()` batch aggregation pattern) — performance pattern for balance computation across multiple loans

### What This Story Enables (Downstream)

- **Epic 3 (Story 3.6):** Observation engine can call `serviceStatusReportService` during migration to auto-generate post-retirement observations
- **Epic 6 (Story 6.1):** Executive summary report can reference this report's summary metrics
- **Epic 6 (Story 6.4):** PDF export can render this report as a branded PDF
- **Epic 7 (Story 7.1):** Exception flagging can consume flagged loans from this report
- **Epic 11 (Story 11.2):** Retirement event filing resolves items from this report
- **`reportRoutes.ts`** — establishes the route file pattern for all Epic 6 report endpoints

### Git Intelligence

- Commit prefix: `feat(reports):` — this is the first report feature, new prefix
- This is the first new route file since Epic 2 — remember to register in `app.ts`
- `@vlprs/shared` package needs `tsc` rebuild after adding report types

### Project Structure Notes

New files created by this story:
```
apps/server/src/
├── services/serviceStatusReportService.ts                       (NEW)
├── services/serviceStatusReportService.integration.test.ts      (NEW)
└── routes/reportRoutes.ts                                       (NEW — first report route file)
```

Modified files:
```
apps/server/src/app.ts                          (register reportRoutes)
packages/shared/src/types/loan.ts               (add report interfaces — or create report.ts)
packages/shared/src/validators/loanSchemas.ts   (add serviceStatusVerificationQuerySchema — or create reportSchemas.ts)
packages/shared/src/constants/vocabulary.ts     (add NO_POST_RETIREMENT_ACTIVITY)
packages/shared/src/index.ts                    (add new exports)
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 10, Story 10.4]
- [Source: _bmad-output/planning-artifacts/prd.md — FR71]
- [Source: _bmad-output/planning-artifacts/architecture.md — Reporting, MDA Scoping, Pagination]
- [Source: _bmad-output/implementation-artifacts/10-1-retirement-date-computation-storage.md — temporal profile, computed_retirement_date]
- [Source: _bmad-output/implementation-artifacts/10-2-service-extension-recording.md — service_extensions table, extension override logic]
- [Source: _bmad-output/implementation-artifacts/10-3-tenure-vs-remaining-service-gratuity-receivable.md — gratuity projection service]
- [Source: apps/server/src/services/loanService.ts — searchLoans() batch balance aggregation pattern, pagination two-query pattern]
- [Source: apps/server/src/lib/mdaScope.ts — withMdaScope() utility]
- [Source: apps/server/src/routes/loanRoutes.ts — middleware stacking pattern]
- [Source: apps/server/src/services/userAdminService.ts — listUsers() pagination pattern reference]

---

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

No debug issues encountered. All 17 integration tests passed on first run. Full regression suite (531 tests) passed with zero failures.

### Completion Notes List

- Created `packages/shared/src/types/report.ts` with three interfaces: `ServiceStatusVerificationRow`, `ServiceStatusVerificationSummary`, `ServiceStatusVerificationReport`
- Created `packages/shared/src/validators/reportSchemas.ts` with `serviceStatusVerificationQuerySchema` (Zod v4)
- Added `VOCABULARY.NO_POST_RETIREMENT_ACTIVITY` constant
- Created `apps/server/src/services/serviceStatusReportService.ts` implementing the full report service:
  - LEFT JOIN sub-query pattern for latest service extension per loan
  - Batch balance computation (Decimal.js) following `searchLoans()` pattern
  - `monthsPastRetirement` computed via `differenceInMonths` (inlined, not extracted to computation engine — trivial one-liner per Dev Notes guidance)
  - Summary aggregates computed from FULL dataset, not just paginated page
  - Page data + count + extension counts + MDA breakdown run in parallel via `Promise.all()`
  - Single-pass balance computation shared between `totalOutstandingExposure` and `mdaBreakdown`
- Created `apps/server/src/routes/reportRoutes.ts` — first dedicated report route file, establishes pattern for Epic 6
- Used `validateQuery` middleware (not `validate`) since params come from query string, following `mdaRoutes.ts` precedent
- Registered report routes in `app.ts`
- 17 integration tests covering all 6 ACs: post-retirement detection, extension awareness (valid/expired), available actions, clean state, summary metrics, MDA breakdown, MDA scoping, MDA filter, pagination, summary-covers-full-dataset, asOfDate parameter, asOfDate default, auth (401/200)
- **403 test omission rationale:** Task 6.17 specifies "insufficient role → 403", but all 3 system roles (`super_admin`, `dept_admin`, `mda_officer`) are authorized for this endpoint. No role exists that would trigger a 403. Documented in test file with a comment for future reference if new roles are added

### Implementation Plan

**Approach chosen:** SQL-level filtering with LEFT JOIN sub-query for service extensions. The sub-query computes `MAX(new_retirement_date)` per loan from the `service_extensions` table, then the main query filters with `OR(extension IS NULL, extension <= asOfDate)` to exclude loans with valid extensions while including those with expired ones.

**Balance computation:** Batch aggregation pattern from `searchLoans()` — single `SUM(amount) GROUP BY loan_id` query for all loans on the current page. Full-dataset balance recomputed separately for summary metrics.

**Extension reference lookup:** Separate query for loans with expired extensions, ordered by `created_at DESC`, keeping only the latest reference per loan.

### Change Log

- 2026-03-01: Story 10.4 implemented — service status verification report endpoint (FR71)
- 2026-03-01: Code review (AI) — 10 findings (2H/5M/3L). All fixed: parallelized page balance + extension ref queries, added page-reuse optimization for summary, added 403 test rationale docs, date format test assertion, code comments for sort order/zero-floor/timezone/non-null assertion

### File List

**New files:**
- `packages/shared/src/types/report.ts`
- `packages/shared/src/validators/reportSchemas.ts`
- `apps/server/src/services/serviceStatusReportService.ts`
- `apps/server/src/routes/reportRoutes.ts`
- `apps/server/src/services/serviceStatusReportService.integration.test.ts`

**Modified files:**
- `packages/shared/src/index.ts` (added report type + validator exports)
- `packages/shared/src/constants/vocabulary.ts` (added `NO_POST_RETIREMENT_ACTIVITY`)
- `apps/server/src/app.ts` (registered `reportRoutes`)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (story status sync)
