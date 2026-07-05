# Epic 8 — UAT Findings Register (In-Session, 2026-04-05/06)

**Tester:** Awwal (Product Owner / Project Lead)
**Method:** Clean-room UAT — purge → upload single BIR file (Aug + Dec 2024) → verify all dashboards
**Roles Tested:** Super Admin (AG), MDA Officer (BIR), Dept Admin

---

## Findings

### Bugs (Fix Required)

| # | Finding | Severity | Root Cause | File(s) |
|---|---------|----------|------------|---------|
| 5 | MDA Detail page shows empty Loans table despite 171 loans existing | **Critical** | `apiClient.ts:198` returns `body.data` (array), but `MdaDetailPage.tsx:35` does `data?.data` expecting wrapped format — gets `undefined` | `apiClient.ts`, `useMdaData.ts`, `MdaDetailPage.tsx` |
| 8 | Observations not auto-generated after baseline creation | **High** | `baselineService.ts` `createBatchBaseline()` never calls `generateObservations()` after transaction commits | `baselineService.ts:439-654` |

### Workflow Gaps

| # | Finding | Severity | Description |
|---|---------|----------|-------------|
| 18 | Duplicates tab — manual trigger only, no drill-down | Medium | Detection doesn't auto-run after upload. Table has no click-to-expand |
| 22 | MDA Review tab not discoverable for MDA officers | **High** | Migration page not in MDA officer sidebar. Only path is conditional Dashboard card |
| 25 | MDA officer has zero visibility into migration quality breakdown | **High** | Variance breakdown (Clean/Minor/Significant) only on admin Migration page |
| 27 | Historical Upload is reconciliation, not migration — purpose mismatch | Medium | Historical Upload (CSV, 2-vector) vs Migration Upload (Excel, 3-vector, baseline) |

### UX — Dead-End Metrics (Numbers without drill-down)

| # | Finding | Severity | Component |
|---|---------|----------|-----------|
| 2 | Drill-down requires 2 clicks, no 'View All Loans' shortcut | High | `MetricDrillDownPage.tsx` |
| 14 | Top Variances hardcoded to 5, needs pagination | Medium | `executiveSummaryReportService.ts:496` — `.limit(5)` |
| 16 | Recovery Potential Summary cards not clickable | Medium | `ExecutiveSummaryReport.tsx:207-226` |
| 17 | MDA Scorecard table rows not clickable | Medium | `ExecutiveSummaryReport.tsx:48-75` |
| 19 | Observations + Duplicates tabs need full drill-down | Medium | Migration page tabs |
| 21 | Zero Deduction Review — plain text list, truncated, no table | **High** | `PreSubmissionCheckpoint.tsx:8` — MAX_ITEMS=50, shows "and 118 more" |
| 31 | Operations Hub cards not clickable for Dept Admin | Medium | `OperationsHubPage.tsx` |

### UX — Missing Context (Numbers without explanation)

| # | Finding | Severity | Description |
|---|---------|----------|-------------|
| 4 | Active Loans (168) vs Loans in Window (171) difference unexplained | Low | 3 COMPLETED loans in window. Needs MetricHelp tooltip |
| 6 | Monthly Recovery = zero with no explanation on migration-only data | Medium | Correct (no PAYROLL entries) but needs "Awaiting first submission" |
| 7 | Staff Migrated (92) vs Baselines (171) gap not explained | Medium | 92 unique staff across 171 records. Needs "92 unique staff across 171 records" |
| 11 | Breadcrumb shows UUID on first load, MDA name on refresh | Low | `Breadcrumb.tsx:120-123` — query cache empty on first render |
| 12 | MDA Progress "4 of 6" meaning unclear | Low | Baseline completion count needs MetricHelp tooltip |
| 23 | Submission History empty — no context message | Low | Needs "No monthly submissions yet" guidance |
| 24 | Approaching Retirement + Pending Events empty — no empty state messages | Low | Each empty section needs explanation of when data appears |

### Data Hygiene

| # | Finding | Severity | Description |
|---|---------|----------|-------------|
| 3 | Stale 500M demo fund total survives purge | Medium | `scheme_config.scheme_fund_total` preserved by purge, should be cleared or configurable |
| 9 | Correction worksheet missing period (month/year) column | Medium | `correctionWorksheetService.ts:72-92` — periodYear/periodMonth not in SELECT or mapping |
| 13 | Reports page: 500M fund available + alignment broken | Medium/Low | Same stale value + CSS grid misalignment in `ExecutiveSummaryReport.tsx:114-143` |

### MDA Officer Experience

| # | Finding | Severity | Description |
|---|---------|----------|-------------|
| 20 | MDA Officer dashboard sparse — only 5 sidebar items | **High** | No Dashboard, no Migration, no Reports access |
| 26 | Historical Upload accepts CSV only, not Excel | Medium | `historicalSubmissionRoutes.ts:18-30` hardcodes `.csv` |
| 28 | **SIGNIFICANT DISCOVERY:** Data pipeline must be federated — MDA officers upload, admins verify | **High** | Current AG-centric model doesn't scale to 47 MDAs. Infrastructure 90% built |
| 29 | MDA officer needs purpose-built dashboard with hero metrics, quality scores, action items | **High** | Full design proposed in retro session — see wireframe in retro document |

### Tooling / Cosmetic

| # | Finding | Severity | Description |
|---|---------|----------|-------------|
| 1 | `purge-demo-data` script broken (tsx not at root) | Medium | **Fixed in-session** — moved to `apps/server/scripts/`, updated root package.json |
| 15 | MoM Trend section cramped layout | Low | `TrendIndicator` component — inline flex, needs vertical stacking |
| 30 | Stale sprint label "Sprint 1" above logout button | Low | **Fixed in-session** — updated `apps/client/.env` to Sprint 11 |
| 32 | Dept Admin sees same empty Loans/Submissions on MDA Detail | Medium | Same as #5 — cascades from apiClient unwrap fix |

### Positive

| # | Finding | Description |
|---|---------|-------------|
| 10 | Coverage Tracker works excellently | MDA x Month grid, clickable cells, CSV/Excel download — exactly as designed |

---

## Summary Statistics

- **Total Findings:** 43 (42 issues + 1 positive)
- **Critical:** 1 (#5 — apiClient unwrap bug)
- **High:** 9 (#2, #8, #20, #21, #22, #25, #28, #29, #39, #40)
- **Medium:** 21 (#3, #6, #7, #9, #12, #13, #14, #16, #17, #18, #19, #26, #27, #31, #32, #34, #35, #36, #37, #41, #42, #43)
- **Low:** 8 (#4, #11, #15, #23, #24, #30, #38)
- **Fixed in-session:** 3 (#1 purge script, #30 sprint label, BIR officer account added to seed)

## Significant Discovery

**Finding #28:** The data pipeline must be federated. MDA officers should upload their own migration data (using the existing three-vector engine), admins verify and baseline. Coverage Tracker becomes the accountability dashboard. Infrastructure is 90% built — the gap is role gates, verification workflow, and MDA officer dashboard/sidebar.

### Certificate & Verification

| # | Finding | Severity | Description |
|---|---------|----------|-------------|
| 33 | Public certificate verification page — route exists, component missing | **High** | `router.tsx:189` defines `/verify/:certificateId` but `VerifyCertificatePage` component never created. Backend API works. QR codes on printed certificates link to broken page |
| 34 | No certificate preview/list in admin dashboard | Medium | AG/Dept Admin have no way to see all issued certificates. Only via individual Loan Detail pages |

### Domain Model Gaps

| # | Finding | Severity | Description |
|---|---------|----------|-------------|
| 35 | MDA officers need MDA-scoped Beneficiary Ledger with loan lifecycle awareness | Medium | Active staff, completed loans, transferred out/in, consecutive loan history. Infrastructure exists, needs frontend + lifecycle grouping |
| 36 | Within-file deduplication gap — same person twice in same file/period not detected | Medium | Cross-MDA dedup works (3.8). But same-person-same-period-same-file produces two loans silently |
| 37 | Transfer history not visible in MDA Beneficiary Ledger | Medium | After transfer, person vanishes from originating MDA view. Need "Transferred Out" section with destination MDA and date |

### Data Pipeline & Supersede

| # | Finding | Severity | Description |
|---|---------|----------|-------------|
| 38 | "47 MDAs" referenced incorrectly — actual count is 63 | Low | MDA registry has 63 MDAs. "47" is legacy data coverage only |
| 39 | devAutoSeed re-seeds demo loans after Docker volume loss | **High** | Volume reset → auto-seed destroys real data. Fix: separate admin user seeding from demo loan seeding |
| 40 | Upload supersede needs data comparison/diff preview | **High** | Current supersede shows only filenames + counts. Needs record-level comparison: unchanged/modified/new/removed with field-level diffs |
| 41 | Per-sheet/per-period supersede not supported | Medium | Only entire uploads can be superseded. Needs single-month replacement capability |
| 42 | Correction reason not required for non-flagged records | Medium | `RecordDetailDrawer.tsx:482` — reason textarea only renders when `isFlagged`. AG corrections save with no explanation. Violates 8.0j AC3 |
| 43 | MDA officer needs RecordDetailDrawer in federated upload flow | Medium | Same correction drawer + mandatory reason, scoped to their MDA. Part of federated upload (Finding #28) |

## Cascade Analysis

Fixes to shared components cascade across all roles:
- `apiClient.ts` fix (#5) → fixes AG, Dept Admin, MDA Officer loans table
- `MetricDrillDownPage.tsx` fix (#2) → fixes all admin drill-downs
- `Breadcrumb.tsx` fix (#11) → fixes all roles
- MDA officer-specific work (#20, #25, #28, #29) requires new components
