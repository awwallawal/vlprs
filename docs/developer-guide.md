# VLPRS Developer Guide

> Vehicle Loan Processing & Receivables System — Oyo State Government

This guide is for developers joining the VLPRS project. It covers the monorepo structure, tech stack, how each page is wired (component → hook → API → service → DB), key data flows, database schema, and deployment.

---

## Table of Contents

- [Part 1 — Architecture Overview](#part-1--architecture-overview)
  - [Monorepo Structure](#monorepo-structure)
  - [Tech Stack](#tech-stack)
  - [Development Setup](#development-setup)
  - [Key Architectural Decisions](#key-architectural-decisions)
- [Part 2 — Page-by-Page Technical Guide](#part-2--page-by-page-technical-guide)
  - [1. Executive Dashboard](#1-executive-dashboard)
  - [2. Migration Dashboard & Upload](#2-migration-dashboard--upload)
  - [3. Submissions](#3-submissions)
  - [4. Reports](#4-reports)
  - [5. Exceptions](#5-exceptions)
  - [6. Three-Way Reconciliation](#6-three-way-reconciliation)
  - [7. Operations Hub](#7-operations-hub)
  - [8. Loan Detail](#8-loan-detail)
  - [9. System Health](#9-system-health)
  - [10. User Management](#10-user-management)
- [Part 3 — Key Data Flows](#part-3--key-data-flows)
  - [Migration Pipeline](#migration-pipeline)
  - [Monthly Submission Lifecycle](#monthly-submission-lifecycle)
  - [Reconciliation Engine](#reconciliation-engine)
  - [Loan Computation Model](#loan-computation-model)
  - [Report Generation](#report-generation)
- [Part 4 — Database Reference](#part-4--database-reference)
  - [Entity-Relationship Summary](#entity-relationship-summary)
  - [Naming Conventions](#naming-conventions)
  - [Migration Rules](#migration-rules)
- [Part 5 — Testing & Deployment](#part-5--testing--deployment)
  - [Testing Strategy](#testing-strategy)
  - [How to Run Tests](#how-to-run-tests)
  - [Docker Deployment](#docker-deployment)
  - [Database Migrations](#database-migrations)
- [Appendix — Page-to-Service Mapping](#appendix--page-to-service-mapping)

---

## Part 1 — Architecture Overview

### Monorepo Structure

```
vlprs/
├── apps/
│   ├── client/          # React 18 SPA (Vite)
│   │   ├── src/
│   │   │   ├── components/   # Shared UI components (MetricHelp, Badge, etc.)
│   │   │   ├── hooks/        # TanStack Query hooks
│   │   │   ├── pages/        # Route-level page components
│   │   │   ├── stores/       # Zustand state stores
│   │   │   └── router.tsx    # Route definitions
│   │   └── package.json
│   └── server/          # Express 5 API
│       ├── src/
│       │   ├── db/           # Drizzle schema, migrations, seeds
│       │   ├── middleware/    # Auth, CSRF, rate limiting, audit
│       │   ├── routes/       # API route handlers
│       │   ├── services/     # Business logic layer
│       │   └── cli/          # Admin CLI tools (createAdmin, deactivateAdmin)
│       ├── drizzle/          # Generated SQL migration files
│       └── package.json
├── packages/
│   ├── shared/          # Shared types, Zod schemas, constants
│   │   └── src/
│   │       ├── constants/    # metricGlossary.ts, vocabulary.ts
│   │       ├── schemas/      # Zod validation schemas
│   │       └── types/        # Shared TypeScript interfaces
│   └── testing/         # Shared test utilities and fixtures
├── docker/              # Dockerfiles (server, client)
├── compose.dev.yaml     # Dev environment (DB + hot-reload)
├── compose.prod.yaml    # Production (Nginx + Node + Certbot)
└── package.json         # Root workspace config
```

### Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Runtime** | Node.js 22 | Server runtime |
| **Package Manager** | pnpm 9.15 | Workspace-aware monorepo management |
| **Server Framework** | Express 5 | HTTP API with async request handling |
| **Database** | PostgreSQL 17 | Primary data store |
| **ORM** | Drizzle ORM | Type-safe queries, schema-as-code, SQL migrations |
| **Validation** | Zod | Schema validation (shared between client and server) |
| **Frontend** | React 18 | Component-based UI |
| **Build Tool** | Vite | Fast dev server and production bundler |
| **Data Fetching** | TanStack Query v5 | Server state management with caching |
| **Client State** | Zustand | Lightweight client-only state (auth, UI) |
| **Styling** | Tailwind CSS | Utility-first CSS |
| **Financial Math** | Decimal.js | Arbitrary-precision arithmetic (never IEEE floats for money) |
| **PDF Generation** | @react-pdf/renderer | Server-side PDF rendering from React components |
| **Unit/Integration** | Vitest | Test runner (co-located test files) |
| **E2E Testing** | Playwright | Browser automation tests |
| **Server Build** | tsup | Fast TypeScript bundler for production |

### Development Setup

**Prerequisites:**
- Node.js 22+
- pnpm 9.15+
- Docker (for PostgreSQL)

**Steps:**

```bash
# 1. Clone and install
git clone <repo-url>
cd vlprs
pnpm install

# 2. Start PostgreSQL (Docker)
pnpm dev:db
# → PostgreSQL 17 on localhost:5433 (user: vlprs, pass: vlprs_dev, db: vlprs_dev)

# 3. Configure environment
cp apps/server/.env.example apps/server/.env
# Edit .env — the defaults work for local dev

# 4. Run database migrations
pnpm --filter server db:migrate

# 5. Apply database triggers (immutability enforcement)
pnpm --filter server db:triggers

# 6. Seed demo data (5 users, 63 MDAs, sample loans)
pnpm --filter server seed:demo

# 7. Start dev servers (hot-reload)
pnpm dev:local
# → Server: http://localhost:3001
# → Client: http://localhost:5173
```

**Key environment variables** (in `apps/server/.env`):

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | `postgresql://vlprs:vlprs_dev@localhost:5433/vlprs_dev` | PostgreSQL connection |
| `JWT_SECRET` | `change-me-in-production` | JWT signing key |
| `JWT_EXPIRY` | `15m` | Access token lifetime |
| `REFRESH_TOKEN_EXPIRY` | `7d` | Refresh token lifetime |
| `PORT` | `3001` | Server port |
| `CSRF_SECRET` | (required) | CSRF token signing, min 32 chars |
| `INACTIVITY_TIMEOUT_MINUTES` | `30` | Session inactivity timeout |
| `DEMO_SEED_PASSWORD` | `DemoPass1` | Password for demo seed accounts |

### Key Architectural Decisions

#### 1. Immutable Ledger (3-Layer Enforcement)

Financial records (`ledger_entries`) are append-only. No UPDATE or DELETE is allowed:

1. **Application layer:** No update/delete routes exist; service methods only call `insert()`
2. **Middleware layer:** `405 Method Not Allowed` returned for PUT/PATCH/DELETE on ledger endpoints
3. **Database layer:** PostgreSQL triggers reject UPDATE and DELETE operations on immutable tables

Immutable tables: `ledger_entries`, `loan_state_transitions`, `temporal_corrections`, `service_extensions`, `baseline_annotations`, `loan_annotations`, `loan_event_flag_corrections`, `audit_log`

#### 2. Financial Arithmetic (Decimal.js)

All currency computations use `Decimal.js` with 20 decimal places and ROUND_HALF_UP rounding. IEEE 754 floats are never used for money. Tolerances:

| Context | Tolerance |
|---------|-----------|
| Stall detection | ₦1 |
| Three-way match | ₦1 |
| Auto-promotion to exception | ₦500 |
| Variance classification | ₦1 (clean), ₦500 (minor) |

#### 3. Non-Punitive Vocabulary

All user-facing text uses approved vocabulary from `packages/shared/src/constants/vocabulary.ts`:

| Use | Don't Use |
|-----|-----------|
| Variance | Discrepancy, Error |
| Observation | Anomaly, Issue |
| Requires Clarification | Anomalous, Invalid |
| Rate Variance | Rate Error |
| Attention Item | Alert, Warning |

Colour indicators: amber and teal only — never red for data quality findings.

#### 4. MDA Scoping

Every data query respects the user's MDA scope:
- **SUPER_ADMIN:** Global access (all MDAs)
- **DEPT_ADMIN:** Scoped to assigned MDAs
- **MDA_OFFICER:** Scoped to single assigned MDA

The `scopeToMda` middleware attaches MDA filtering to every request. Services accept an optional `mdaId` parameter that's populated by middleware.

---

## Part 2 — Page-by-Page Technical Guide

### 1. Executive Dashboard

**Route:** `/dashboard`
**Component:** `apps/client/src/pages/dashboard/DashboardPage.tsx`
**Roles:** SUPER_ADMIN (home), DEPT_ADMIN, MDA_OFFICER (limited)

#### Data Hooks

| Hook | Endpoint | Service | What It Returns |
|------|----------|---------|-----------------|
| `useDashboardMetrics()` | `GET /api/dashboard/metrics` | `dashboardRoutes.ts` → `loanClassificationService`, `revenueProjectionService`, `schemeConfigService` | Hero metrics + portfolio analytics |
| `useMdaComplianceGrid()` | `GET /api/dashboard/compliance` | `dashboardRoutes.ts` → `mdaAggregationService`, `submissionCoverageService` | MDA compliance rows + heatmap |
| `useAttentionItems()` | `GET /api/dashboard/attention` | `dashboardRoutes.ts` → `attentionItemService` | Attention items (top 10) |
| `useThreeWayDashboard()` | `GET /api/reconciliation/three-way/dashboard` | `threeWayReconciliationRoutes.ts` → `threeWayReconciliationService` | Match rate, variance count, top MDAs |

#### Metrics Breakdown

**Primary Row (4 metrics):**

| Metric | Derivation |
|--------|-----------|
| Active Loans | `COUNT(loans)` where status = ACTIVE |
| Total Exposure | `SUM(outstanding balance)` across ACTIVE loans. Balance = principal + accrued interest - total paid (Decimal.js) |
| Fund Available | `scheme_config['scheme_fund_total']` minus disbursed principal. Shows "Awaiting Configuration" if not set |
| Monthly Recovery | `SUM(ledger_entries.amount)` where entryType = PAYROLL, most recent period |

**Portfolio Analytics (6 metrics):**

| Metric | Derivation |
|--------|-----------|
| Loans in Window | Count of loans with `firstDeductionDate` within last 60 months |
| Outstanding Receivables | Sum of balances for ACTIVE + OVERDUE + STALLED classified loans |
| Collection Potential | `SUM(loans.monthlyDeductionAmount)` where status = ACTIVE |
| At-Risk Amount | Sum of balances for OVERDUE or STALLED classified loans |
| Completion Rate (60m) | Completed loans ÷ total loans in rolling 60-month window × 100 |
| Completion Rate (All-Time) | All completed loans ÷ all loans ever created × 100 |

**Reconciliation (3 metrics, SUPER_ADMIN/DEPT_ADMIN only):**

| Metric | Derivation |
|--------|-----------|
| Overall Match Rate | Full matches ÷ total staff compared × 100 |
| Full Variances | Count of records where expected ≠ declared ≠ actual |
| Top Variance MDAs | Top 5 MDAs ranked by full variance count |

**Loan Classification Engine** (`loanClassificationService.ts`):

Priority order:
1. COMPLETED — status = COMPLETED
2. OVER_DEDUCTED — computed balance < 0
3. OVERDUE — past accountability deadline + positive balance
4. STALLED — 2+ consecutive months with < ₦1 balance movement
5. ON_TRACK — default (healthy)

**MDA Health Score** (`mdaAggregationService.ts`):

```
healthScore = base(40) + completionRate × 40 + onTrackRate × 20 - penalties
penalties: stalled(-20), overdue(-20), over_deducted(-20)
clamped to [0, 100]

Bands: healthy (≥70), attention (40-69), for-review (<40)
```

**Attention Item Detectors** (`attentionItemService.ts`): 12 detector types including zero_deduction, post_retirement_active, missing_staff_id, overdue_loans, stalled_deductions, quick_win.

#### Data Flow

```
DashboardPage.tsx
├── useDashboardMetrics()
│   └── GET /api/dashboard/metrics
│       ├── loanClassificationService.classifyAllLoans()
│       ├── revenueProjectionService.getMonthlyCollectionPotential()
│       ├── revenueProjectionService.getActualMonthlyRecovery()
│       ├── schemeConfigService.getSchemeConfig('scheme_fund_total')
│       └── gratuityProjectionService.getAggregateGratuityExposure()
│
├── useMdaComplianceGrid()
│   └── GET /api/dashboard/compliance
│       ├── mdaService.listMdas()
│       ├── mdaAggregationService.getMdaBreakdown()
│       ├── submissionCoverageService.getSubmissionCoverage()
│       └── submissionCoverageService.getSubmissionHeatmap()
│
├── useAttentionItems()
│   └── GET /api/dashboard/attention
│       └── attentionItemService.getAttentionItems()
│           ├── detectZeroDeductionLoans()
│           ├── detectPostRetirementActive()
│           ├── detectMissingStaffId()
│           ├── detectOverdueLoans()
│           ├── detectStalledLoans()
│           └── detectQuickWinLoans()
│
└── useThreeWayDashboard() [SUPER_ADMIN/DEPT_ADMIN only]
    └── GET /api/reconciliation/three-way/dashboard
        └── threeWayReconciliationService.getThreeWayDashboardMetrics()
```

---

### 2. Migration Dashboard & Upload

**Routes:**
- `/dashboard/migration` → `MigrationPage.tsx`
- `/dashboard/migration/upload` → `MigrationUploadPage.tsx`
- `/dashboard/migrations/coverage/:mdaId/:year/:month` → `CoverageRecordsPage.tsx`
- `/dashboard/migration/persons/:personKey` → `PersonDetailPage.tsx`
- `/dashboard/migration/trace/:personKey` → `TraceReportPage.tsx`

**Roles:** SUPER_ADMIN, DEPT_ADMIN (upload); MDA_OFFICER (read-only)

#### Dashboard Tabs (6)

| Tab | Component | Data Source |
|-----|-----------|-------------|
| MDA Progress | `MigrationProgressCard` grid | `GET /api/migrations/dashboard` → `migrationDashboardService` |
| Master Beneficiary Ledger | `MasterBeneficiaryLedger` | `GET /api/migrations/beneficiaries` → `migrationDashboardService` |
| Observations | `ObservationsList` | `GET /api/observations` → `observationService` |
| Duplicates | `DuplicateResolutionTable` | `GET /api/migrations/duplicates` → deduplication service |
| Coverage Tracker | `MigrationCoverageTracker` | `GET /api/migrations/coverage` → `migrationDashboardService` |
| Uploads | `MigrationUploadList` | `GET /api/migrations/uploads` → `migrationService` |

#### Upload Flow (Multi-Step Wizard)

```
Step 1: File Upload         POST /api/migrations/upload
                            → migrationService.previewUpload()
                            Returns: sheets[], columnMappings[], detectedMda, period

Step 2: Column Mapping      POST /api/migrations/:id/confirm
                            → migrationService.confirmMapping()
                            Inserts records into migration_records + migration_extra_fields

Step 3: Period Overlap       POST /api/migrations/:id/check-overlap
                            → migrationService.checkOverlap()
                            Returns: hasOverlap, per-sheet overlap results

Step 4: Validation          POST /api/migrations/:id/validate
                            → migrationValidationService.validateUpload()
                            Three-vector comparison, variance categorization

Step 5: Baseline            POST /api/migrations/:id/baseline (batch)
                            POST /api/migrations/:uploadId/records/:recordId/baseline (single)
                            → Creates loans + initial ledger entries
```

#### Three-Vector Comparison

For each migration record, the validation engine computes three vectors:

| Vector | Source | Computation |
|--------|--------|-------------|
| **Scheme Expected** | Authoritative formula | `totalLoan = principal × (1 + rate/100)`, `monthly = totalLoan / tenure` |
| **Reverse Engineered** | Declared data + schedule | Repayment schedule from declared principal, inferred rate/tenure |
| **MDA Declared** | Raw upload values | As-is from the uploaded Excel file |

The variance is the maximum difference across totalLoan, monthlyDeduction, and outstandingBalance.

**Variance Categories:**

| Category | Threshold |
|----------|-----------|
| clean | < ₦1 |
| minor_variance | ₦1 – ₦499.99 |
| significant_variance | ≥ ₦500 |
| structural_error | Rate doesn't match any known tier (±0.5%) |
| anomalous | Insufficient data for validation |

**Known Rate Tiers:** 6.67%, 8.0%, 8.89%, 10.66%, 11.11%, 13.33% (standard)

#### Observation Types (11)

| Type | Trigger |
|------|---------|
| rate_variance | Computed rate doesn't match standard 13.33% (±0.5%) |
| stalled_balance | Balance unchanged across consecutive periods |
| negative_balance | Computed balance below zero |
| multi_mda | Staff appears in records for multiple MDAs |
| no_approval_match | No matching approval record found for loan |
| consecutive_loan | Multiple overlapping loans in timeline |
| period_overlap | Upload contains same MDA+period as existing upload |
| grade_tier_mismatch | Grade level doesn't match principal tier |
| three_way_variance | All three vectors diverge significantly |
| manual_exception | Admin-created observation |
| inactive_loan | Loan created but never had a deduction |

Lifecycle: unreviewed → reviewed → resolved (or promoted to exception)

---

### 3. Submissions

**Routes:**
- `/dashboard/submissions` → `SubmissionsPage.tsx`
- `/dashboard/submissions/:submissionId` → `SubmissionDetailPage.tsx`
- `/dashboard/historical-upload` → `HistoricalUploadPage.tsx`
- `/dashboard/payroll-upload` → `PayrollUploadPage.tsx`
- `/dashboard/employment-events` → `EmploymentEventsPage.tsx`

**Roles:** MDA_OFFICER (submit), DEPT_ADMIN (review), SUPER_ADMIN (all + payroll upload)

#### Key Hooks and Endpoints

| Hook | Endpoint | Service |
|------|----------|---------|
| `usePreSubmissionCheckpoint()` | `GET /api/pre-submission/:mdaId` | `preSubmissionService.getCheckpointData()` |
| `useSubmissionUpload()` | `POST /api/submissions/upload` | `submissionService.processUpload()` |
| `useManualSubmission()` | `POST /api/submissions/manual` | `submissionService.processManualEntry()` |
| `useSubmissionDetail()` | `GET /api/submissions/:id` | `submissionService.getDetail()` |
| `usePayrollPreview()` | `POST /api/payroll/upload` | `payrollService.preview()` |
| `usePayrollConfirm()` | `POST /api/payroll/confirm` | `payrollService.confirm()` |
| `useEmploymentEvents()` | `GET /api/employment-events` | `employmentEventService.list()` |
| `useCreateEmploymentEvent()` | `POST /api/employment-events` | `employmentEventService.fileEvent()` |

#### Pre-Submission Checkpoint Sections

1. **Approaching Retirement:** Staff with retirement within 12 months
2. **Zero Deduction Review:** Staff with zero deduction in previous month
3. **Pending Events:** Unconfirmed employment events

Officer must confirm the checkpoint before submitting.

#### Employment Event Types (11)

RETIRED, DECEASED, SUSPENDED, ABSCONDED, TRANSFERRED_OUT, TRANSFERRED_IN, DISMISSED, LWOP_START, LWOP_END, REINSTATED, SERVICE_EXTENSION

Transfer events use a two-sided handshake: outgoing MDA confirms exit, incoming MDA confirms entry. Both sides must confirm before the transfer completes.

---

### 4. Reports

**Route:** `/dashboard/reports` → `ReportsPage.tsx`
**Roles:** SUPER_ADMIN, DEPT_ADMIN

#### Report Types (5 Tabs)

| Report | JSON Endpoint | PDF Endpoint | Key Service |
|--------|--------------|-------------|-------------|
| Executive Summary | `GET /api/reports/executive-summary` | `GET /api/reports/executive-summary/pdf` | Aggregates from dashboard, classification, attention services |
| MDA Compliance | `GET /api/reports/mda-compliance` | `GET /api/reports/mda-compliance/pdf` | Per-MDA status, coverage, health for a given period |
| Variance | `GET /api/reports/variance` | `GET /api/reports/variance/pdf` | Submission vs computed comparison for a period |
| Loan Snapshot | `GET /api/reports/loan-snapshot` | `GET /api/reports/loan-snapshot/pdf` | Per-MDA loan list with balances (paginated, sortable) |
| Weekly AG Report | `GET /api/reports/weekly-ag` | `GET /api/reports/weekly-ag/pdf` | Rolling 7-day activity summary |

#### PDF Generation

PDF files are rendered server-side using `@react-pdf/renderer`. Each report type has a dedicated generator in `apps/server/src/services/`:

- `executiveSummaryPdf.tsx`
- `mdaCompliancePdf.tsx`
- `variancePdf.tsx`
- `loanSnapshotPdf.tsx`
- `weeklyAgPdf.tsx`

Shared components in `reportPdfComponents.tsx`: `ReportHeader` (branded with Oyo State crest), `ReportFooter`, `ReportPageWrapper` (A4), `ReportTable`, `ReportBadge`.

Reference numbers follow the pattern: `VLPRS-[PREFIX]-[YEAR]-[UUID-8]`

Reports can be shared via email: `POST /api/reports/share` (fire-and-forget delivery).

---

### 5. Exceptions

**Routes:**
- `/dashboard/exceptions` → `ExceptionsPage.tsx`
- `/dashboard/exceptions/:id` → `ExceptionDetailPage.tsx`

**Roles:** SUPER_ADMIN, DEPT_ADMIN

#### Key Hooks and Endpoints

| Hook | Endpoint | Service |
|------|----------|---------|
| `useExceptions()` | `GET /api/exceptions` | `exceptionService.listExceptions()` |
| `useExceptionDetail()` | `GET /api/exceptions/:id` | `exceptionService.getExceptionDetail()` |
| `useResolveException()` | `PATCH /api/exceptions/:id/resolve` | `exceptionService.resolveException()` |
| `useFlagException()` | `POST /api/exceptions/flag` | `exceptionService.flagLoanAsException()` |
| `useDetectInactive()` | `POST /api/exceptions/detect-inactive` | `inactiveLoanDetectionService.detectAll()` |

#### Exception Sources

- **Manual:** Admin flags a loan from `LoanDetailPage`
- **Auto-promoted:** Three-way reconciliation variance ≥ ₦500
- **Inactive detection:** Background scheduler (6hr) + on-demand endpoint

Priority levels: high, medium, low. Resolution actions: Verified Correct, Adjusted Record, Referred to MDA, No Action Required. Resolution note minimum 10 characters.

---

### 6. Three-Way Reconciliation

**Route:** `/dashboard/reconciliation/three-way` → `ThreeWayReconciliationPage.tsx`
**Roles:** SUPER_ADMIN, DEPT_ADMIN, MDA_OFFICER

#### Data Flow

```
ThreeWayReconciliationPage.tsx
├── useThreeWayDashboard()    → dashboard metrics (admin only)
└── useThreeWayReconciliation()    → per-staff comparison for MDA+period
    └── GET /api/reconciliation/three-way?mdaId=X&period=YYYY-MM
        └── threeWayReconciliationService.reconcileThreeWay()
            ├── Expected: loans.monthlyDeductionAmount (ACTIVE, sum if multiple)
            ├── Declared: submissionRows (source IN csv/manual, latest confirmed)
            └── Actual: submissionRows (source = payroll, latest confirmed)
```

#### Match Categories

| Status | Meaning |
|--------|---------|
| Full Match | All 3 amounts agree within ₦1 |
| Partial Match | Exactly 2 of 3 agree |
| Variance Observed | None agree |
| Expected Unknown | `limitedComputation` loan (no expected amount) |

#### Variance Categories (auto-promoted if ≥ ₦500)

| Category | Meaning |
|----------|---------|
| ghost_deduction | In declared but not in actual (payroll) |
| unreported_deduction | In actual but not declared by MDA |
| amount_mismatch | Both present but amounts differ |
| staff_not_in_payroll | Staff in MDA submission but absent from payroll |

---

### 7. Operations Hub

**Route:** `/dashboard/operations` → `OperationsHubPage.tsx`
**Roles:** DEPT_ADMIN (home page)

Central dashboard showing migration status cards (searchable), loan search (by name/staffId/reference), exception queue summary (top 3, priority-sorted), and quick action buttons (Generate Report, File Employment Event, Compute Early Exit).

---

### 8. Loan Detail

**Route:** `/dashboard/mda/:mdaId/loan/:loanId` → `LoanDetailPage.tsx`
**Roles:** All (MDA-scoped)

Displays: borrower name, status badge, staff ID, MDA, loan reference, grade level tier, principal, tenure (paid/remaining), outstanding balance, last deduction date, retirement date. SUPER_ADMIN/DEPT_ADMIN can flag as exception. Includes `LoanAnnotations` and `EventFlagCorrections` components.

---

### 9. System Health

**Route:** `/dashboard/system-health` → `SystemHealthPage.tsx`
**Roles:** SUPER_ADMIN, DEPT_ADMIN

Grid of metric cards organized by groups. Each card shows: status indicator (green/amber/grey), metric name, value, unit, last updated timestamp. Data from `GET /api/system-health` → `metricsCollector` + `integrityChecker` (assembled in `systemHealthRoutes.ts`).

---

### 10. User Management

**Route:** `/dashboard/admin` → `AdminPage.tsx`
**Roles:** SUPER_ADMIN, DEPT_ADMIN

| Action | Endpoint | Notes |
|--------|----------|-------|
| List users | `GET /api/users` | Filterable by role, status, MDA |
| Invite user | `POST /api/users/invite` | Sends email with temp credentials; shows credentials if email not configured |
| Deactivate | `PATCH /api/users/:id/deactivate` | Requires confirmation; optional reason |
| Reactivate | `PATCH /api/users/:id/reactivate` | — |
| Reassign MDA | `PATCH /api/users/:id/reassign-mda` | MDA_OFFICER only |
| Reset password | `POST /api/users/:id/reset-password` | Generates temp password |
| Delete | `DELETE /api/users/:id` | Requires email confirmation match |

Hierarchy: SUPER_ADMIN manages DEPT_ADMIN + MDA_OFFICER. DEPT_ADMIN manages MDA_OFFICER only. SUPER_ADMIN accounts are CLI-only (`user:create-admin`, `user:deactivate-admin`).

---

## Part 3 — Key Data Flows

### Migration Pipeline

```
┌─────────────────┐     ┌────────────────┐     ┌──────────────────┐
│  Excel Upload    │────►│  Column Mapping │────►│ Period Detection │
│  POST /upload    │     │  POST /confirm  │     │ POST /check-     │
│                  │     │  → migration_   │     │   overlap        │
│  Parse sheets,   │     │    records      │     │                  │
│  detect headers  │     │  → extra_fields │     │ Per-sheet check  │
└─────────────────┘     └────────────────┘     └──────────────────┘
                                                        │
         ┌──────────────────────────────────────────────┘
         ▼
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Three-Vector    │────►│ Establish        │────►│ Observation Scan │
│  Validation      │     │ Baseline         │     │                  │
│  POST /validate  │     │ POST /baseline   │     │ Auto-detect 11   │
│                  │     │                  │     │ observation types │
│  Scheme Expected │     │ Creates: loans + │     │ per record       │
│  vs Reverse Eng  │     │ ledger_entries   │     │                  │
│  vs MDA Declared │     │ (MIGRATION_      │     │ → observations   │
│                  │     │  BASELINE entry) │     │   table          │
│  → variance_     │     │                  │     │                  │
│    category      │     │ → isBaseline     │     │                  │
│    per record    │     │   Created=true   │     │                  │
└──────────────────┘     └──────────────────┘     └──────────────────┘
```

**DB tables involved:** `migration_uploads` → `migration_records` + `migration_extra_fields` → `loans` + `ledger_entries` → `observations`

**Supersession:** When a new file is uploaded for the same MDA+period, the old upload and its records are marked `superseded`. Old loans/baselines are annotated via `baseline_annotations`.

---

### Monthly Submission Lifecycle

```
┌────────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│ Pre-Submission     │────►│ CSV Upload or    │────►│ Row Validation   │
│ Checkpoint         │     │ Manual Entry     │     │                  │
│                    │     │                  │     │ Schema check,    │
│ Approaching retire │     │ POST /upload     │     │ duplicate check, │
│ Zero deduction     │     │ POST /manual     │     │ staff lookup     │
│ Pending events     │     │                  │     │                  │
│ ☑ Confirmed        │     │ → mda_submissions│     │ → validation     │
│                    │     │ → submission_rows│     │   errors (JSONB) │
└────────────────────┘     └──────────────────┘     └──────────────────┘
                                                            │
         ┌──────────────────────────────────────────────────┘
         ▼
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│ Comparison       │────►│ Event            │────►│ Three-Way        │
│ Engine           │     │ Reconciliation   │     │ Reconciliation   │
│                  │     │                  │     │ (if payroll      │
│ Current vs prior │     │ Match events to  │     │  exists)         │
│ submission       │     │ submission flags  │     │                  │
│                  │     │                  │     │ Expected vs      │
│ Aligned / Minor  │     │ MATCHED /        │     │ Declared vs      │
│ / Variance       │     │ DATE_DISCREPANCY │     │ Actual           │
│                  │     │ / UNCONFIRMED    │     │                  │
│ → alignedCount,  │     │                  │     │ Auto-promote     │
│   varianceCount  │     │ → reconciliation │     │ ≥₦500 → exception│
│   in submission  │     │   Summary (JSONB)│     │                  │
└──────────────────┘     └──────────────────┘     └──────────────────┘
```

**DB tables involved:** `mda_submissions` + `submission_rows` → comparison results (stored on submission) → `employment_events` reconciliation → `exceptions` (auto-promoted)

---

### Reconciliation Engine

The three-way reconciliation compares three data sources per staff member per period:

| Source | Table | Filter |
|--------|-------|--------|
| **Expected** | `loans` | ACTIVE loans, `monthlyDeductionAmount` (sum if multiple) |
| **Declared** | `mda_submissions` + `submission_rows` | source IN (csv, manual), status = confirmed, latest by period |
| **Actual** | `mda_submissions` + `submission_rows` | source = payroll, status = confirmed, latest by period |

Match tolerance: ₦1. Auto-promotion threshold: ₦500.

Loans with `limitedComputation = true` are excluded from Expected (shown as "Expected Unknown").

---

### Loan Computation Model

**Single rate for the scheme:** 13.33% annual

**Core formula:**
```
Total Interest = Principal × 13.33%
Total Loan = Principal + Total Interest
Monthly Deduction = Total Loan ÷ Tenure (in months)
Monthly Interest = (Principal × 0.1333) ÷ 60  (always ÷60, regardless of tenure)
```

**Moratorium:** First 2 months have zero deduction (no interest accrual during moratorium).

**Settlement Pathways:**
1. **Normal completion:** All installments paid, balance reaches zero
2. **Accelerated repayment:** Higher-than-scheduled payments, completes early
3. **Retirement/deceased:** Triggers gratuity/estate pathway
4. **Early exit:** Lump-sum settlement with remaining balance computation

**Balance Reconstruction:** Outstanding = Total Loan - SUM(ledger_entries.amount) for that loan. Always computed from the immutable ledger, never stored as a mutable field.

---

### Report Generation

```
ReportsPage.tsx
├── useExecutiveSummaryReport()
│   └── GET /api/reports/executive-summary
│       └── Promise.all([
│           dashboardService.getMetrics(),
│           loanClassificationService.getPortfolioStatus(),
│           mdaAggregationService.getMdaScorecard(),
│           revenueProjectionService.getRecoveryTiers(),
│           attentionItemService.getAttentionItems(),
│           observationService.getActivitySummary()
│       ])
│
├── Download PDF
│   └── GET /api/reports/executive-summary/pdf
│       └── executiveSummaryPdf.tsx → @react-pdf/renderer → Buffer
│           └── Response: Content-Disposition: attachment; filename="vlprs-executive-summary-2026-04-04.pdf"
│
└── Share via email
    └── POST /api/reports/share
        └── Fire-and-forget email with PDF attachment
```

All 5 report types follow the same pattern: JSON endpoint for on-screen display, `/pdf` endpoint for download, `/share` for email delivery.

---

## Part 4 — Database Reference

### Entity-Relationship Summary

The database contains 26 tables. Key relationships:

```
mdas ◄──────────┬── loans ◄──── ledger_entries (immutable)
  │             │     │
  │             │     ├──── loan_state_transitions (immutable)
  │             │     ├──── loan_annotations (immutable)
  │             │     ├──── loan_event_flag_corrections (immutable)
  │             │     ├──── temporal_corrections (immutable)
  │             │     ├──── service_extensions (immutable)
  │             │     └──── exceptions
  │             │
  ├── users     ├── mda_submissions ◄── submission_rows
  │             │
  ├── mda_      ├── migration_uploads ◄── migration_records ◄── migration_extra_fields
  │   aliases   │                          │
  │             │                          ├── observations
  │             │                          └── person_matches
  │             │
  │             ├── employment_events ◄── transfers
  │             │
  │             ├── deduplication_candidates
  │             │
  │             └── baseline_annotations (immutable)
  │
  └── scheme_config (key-value)

Standalone: audit_log (immutable), refresh_tokens
```

**Core tables and their purposes:**

| Table | Purpose | Row Count Pattern |
|-------|---------|------------------|
| `mdas` | 63 MDAs (Oyo State ministries/agencies) | Static, rarely changes |
| `loans` | One row per loan per staff member | Grows with migration + onboarding |
| `ledger_entries` | Append-only financial records | High volume — every deduction |
| `migration_uploads` | One row per uploaded Excel file | ~hundreds |
| `migration_records` | One row per staff per sheet | ~thousands per upload |
| `mda_submissions` | One row per monthly submission per MDA | Grows monthly |
| `submission_rows` | One row per staff per submission | High volume |
| `observations` | Auto-detected data findings | Grows with migration |
| `exceptions` | Escalated items for review | Moderate |
| `employment_events` | Staff lifecycle events | Moderate |
| `audit_log` | Every authenticated API request | Very high volume |

**Monetary columns:** All use `NUMERIC(15,2)` — never FLOAT.
**Primary keys:** UUIDv7 (time-sortable).
**Timestamps:** Always `timestamptz` (UTC-aware).

### Naming Conventions

| Context | Convention | Example |
|---------|-----------|---------|
| DB tables | snake_case | `ledger_entries`, `mda_submissions` |
| DB columns | camelCase (Drizzle mapping) | `staffId`, `mdaId`, `createdAt` |
| API responses | camelCase | `{ activeLoans, totalExposure }` |
| Enum values | UPPER_SNAKE | `ACTIVE`, `TRANSFERRED_OUT` |
| Non-punitive enums | Descriptive | `minor_variance` not `error` |

### Migration Rules

1. **Generate NEW migrations** — never re-run `drizzle-kit generate` for an already-applied migration
2. **Never re-generate** — if a migration has been applied (exists in `__drizzle_migrations` tracking table), generate a NEW migration for any further changes
3. **Hash tracking** — Drizzle tracks migrations by file hash in `__drizzle_migrations`. Modifying a generated file causes hash mismatch that blocks all future migrations
4. **Fix procedure** — if a hash mismatch occurs, update the tracking table hash. See `docs/drizzle-migrations.md` for full diagnostic and fix procedures.

```bash
# Generate a new migration
pnpm --filter server db:generate

# Apply pending migrations
pnpm --filter server db:migrate

# Apply database triggers (after migration)
pnpm --filter server db:triggers
```

---

## Part 5 — Testing & Deployment

### Testing Strategy

| Layer | Framework | Location | Purpose |
|-------|-----------|----------|---------|
| **Unit tests** | Vitest | Co-located (`*.test.ts` next to source) | Business logic, utilities, pure functions |
| **Integration tests** | Vitest | `*.integration.test.ts` in server | API endpoint tests with real DB |
| **E2E tests** | Playwright | `apps/client/e2e/` | Full browser automation |
| **Structured UAT** | Manual | — | Client-verified acceptance testing |

Integration tests use a real PostgreSQL database (not mocks). This is a team agreement from the E10 retrospective.

### How to Run Tests

```bash
# Unit tests (all packages)
pnpm test

# Server unit tests only
pnpm --filter server test

# Server integration tests (requires running DB)
pnpm --filter server test:integration

# All server tests (unit + integration)
pnpm --filter server test:all

# Client unit tests
pnpm --filter client test

# Type checking (all packages)
pnpm typecheck

# Linting (all packages)
pnpm lint

# E2E tests
pnpm --filter client e2e
```

### Docker Deployment

**Development:**
```bash
pnpm docker:dev          # Start all services (DB + Server + Client)
pnpm docker:dev:down     # Stop all services
```

**Production:**
```bash
docker compose -f compose.prod.yaml up -d --force-recreate
```

Production stack:
- **PostgreSQL 17** — internal network only
- **Server (Node.js)** — port 3001 (internal), health check at `/api/health`
- **Client (Nginx)** — ports 80/443, serves static React build
- **Certbot** — auto-renewal every 12 hours

**BUILD_SHA verification:** The server exposes a build SHA in the health endpoint. CI confirms the deployed commit matches what was built. This is a team agreement from the E7+E6 retro.

### Database Migrations

```bash
# 1. Make schema changes in apps/server/src/db/schema.ts

# 2. Generate migration SQL
pnpm --filter server db:generate

# 3. Review generated SQL in apps/server/drizzle/

# 4. Apply migration
pnpm --filter server db:migrate

# 5. Apply triggers (if immutable tables changed)
pnpm --filter server db:triggers
```

**Drizzle config:** `apps/server/drizzle.config.ts` — schema at `./src/db/schema.ts`, output to `./drizzle`, PostgreSQL dialect.

---

## Appendix — Page-to-Service Mapping

| Page | Route | Component | Primary Hooks | API Endpoints | Server Services |
|------|-------|-----------|---------------|---------------|-----------------|
| Executive Dashboard | `/dashboard` | `DashboardPage.tsx` | `useDashboardMetrics`, `useMdaComplianceGrid`, `useAttentionItems`, `useThreeWayDashboard` | `GET /api/dashboard/metrics`, `/compliance`, `/attention`, `/reconciliation/three-way/dashboard` | `loanClassificationService`, `revenueProjectionService`, `mdaAggregationService`, `attentionItemService`, `threeWayReconciliationService` |
| Metric Drill-Down | `/dashboard/drill-down/:metric` | `MetricDrillDownPage.tsx` | `useDrillDown` | `GET /api/dashboard/drill-down/:metric` | `mdaAggregationService` |
| Operations Hub | `/dashboard/operations` | `OperationsHubPage.tsx` | `useMigrationStatus`, `useLoanSearch`, `useExceptionCounts` | Multiple | `migrationDashboardService`, `loanService`, `exceptionService` |
| Migration Dashboard | `/dashboard/migration` | `MigrationPage.tsx` | `useMigrationDashboard`, `useMigrationCoverage`, `useObservations` | `GET /api/migrations/dashboard`, `/coverage`, `/beneficiaries`, `/uploads` | `migrationDashboardService`, `observationService` |
| Migration Upload | `/dashboard/migration/upload` | `MigrationUploadPage.tsx` | `useUploadMigration`, `useConfirmMapping`, `useValidateUpload`, `useCreateBaseline` | `POST /api/migrations/upload`, `/confirm`, `/validate`, `/baseline` | `migrationService`, `migrationValidationService` |
| Coverage Records | `/dashboard/migrations/coverage/:mdaId/:year/:month` | `CoverageRecordsPage.tsx` | `useCoverageRecords` | `GET /api/migrations/coverage/records` | `migrationDashboardService` |
| Submissions | `/dashboard/submissions` | `SubmissionsPage.tsx` | `usePreSubmissionCheckpoint`, `useSubmissionUpload`, `useManualSubmission`, `useSubmissionHistory` | `GET/POST /api/submissions/*`, `GET /api/pre-submission/:mdaId` | `preSubmissionService`, `submissionService`, `comparisonEngine` |
| Submission Detail | `/dashboard/submissions/:submissionId` | `SubmissionDetailPage.tsx` | `useSubmissionDetail` | `GET /api/submissions/:id` | `submissionService` |
| Historical Upload | `/dashboard/historical-upload` | `HistoricalUploadPage.tsx` | `useHistoricalUpload` | `POST /api/submissions/historical` | `submissionService` |
| Payroll Upload | `/dashboard/payroll-upload` | `PayrollUploadPage.tsx` | `usePayrollPreview`, `usePayrollConfirm` | `POST /api/payroll/upload`, `/confirm` | `payrollService` |
| Employment Events | `/dashboard/employment-events` | `EmploymentEventsPage.tsx` | `useEmploymentEvents`, `useCreateEmploymentEvent`, `useTransferSearch` | `GET/POST /api/employment-events`, `/transfers` | `employmentEventService`, `transferService` |
| Three-Way Reconciliation | `/dashboard/reconciliation/three-way` | `ThreeWayReconciliationPage.tsx` | `useThreeWayDashboard`, `useThreeWayReconciliation` | `GET /api/reconciliation/three-way/*` | `threeWayReconciliationService` |
| Exceptions | `/dashboard/exceptions` | `ExceptionsPage.tsx` | `useExceptions`, `useExceptionCounts` | `GET /api/exceptions` | `exceptionService` |
| Exception Detail | `/dashboard/exceptions/:id` | `ExceptionDetailPage.tsx` | `useExceptionDetail`, `useResolveException` | `GET/PATCH /api/exceptions/:id` | `exceptionService` |
| Reports | `/dashboard/reports` | `ReportsPage.tsx` | `useExecutiveSummaryReport`, `useMdaCompliance`, `useVarianceReport`, `useLoanSnapshot`, `useWeeklyAg` | `GET /api/reports/*` | Report composition services + PDF generators |
| Loan Detail | `/dashboard/mda/:mdaId/loan/:loanId` | `LoanDetailPage.tsx` | `useLoanDetail`, `useAnnotations`, `useEventFlagCorrections` | `GET /api/loans/:id`, `/annotations`, `/corrections` | `loanService` |
| MDA Detail | `/dashboard/mda/:mdaId` | `MdaDetailPage.tsx` | `useMdaDetail`, `useMdaLoans` | `GET /api/mdas/:id`, `/loans` | `mdaService`, `loanService` |
| Filtered Loan List | `/dashboard/loans` | `FilteredLoanListPage.tsx` | `useFilteredLoans` | `GET /api/loans` | `loanService`, `loanClassificationService` |
| User Management | `/dashboard/admin` | `AdminPage.tsx` | `useUsers`, `useInviteUser`, `useDeactivateUser`, `useReassignMda` | `GET/POST/PATCH/DELETE /api/users/*` | `userService` |
| System Health | `/dashboard/system-health` | `SystemHealthPage.tsx` | `useSystemHealth` | `GET /api/system-health` | `metricsCollector`, `integrityChecker` |
| Profile | `/dashboard/profile` | `ProfilePage.tsx` | `useProfile`, `useChangePassword` | `GET /api/users/me`, `PATCH /api/users/me/password` | `userService` |
| Person Detail | `/dashboard/migration/persons/:personKey` | `PersonDetailPage.tsx` | `usePersonDetail` | `GET /api/migrations/persons/:key` | `migrationDashboardService` |
| Trace Report | `/dashboard/migration/trace/:personKey` | `TraceReportPage.tsx` | `useTraceReport` | `GET /api/migrations/trace/:key` | `traceReportService` |

---

## Role-Based Sidebar Navigation

This table reflects sidebar visibility as defined in `navItems.ts`. Routes may be accessible via direct URL even if not in the sidebar.

| Sidebar Item | SUPER_ADMIN | DEPT_ADMIN | MDA_OFFICER |
|-------------|:-----------:|:----------:|:-----------:|
| Dashboard | ✅ (home) | — | — |
| Operations | — | ✅ (home) | — |
| Submit | — | — | ✅ (home) |
| History | — | — | ✅ |
| Historical Upload | — | ✅ | ✅ |
| Payroll Upload | ✅ | — | — |
| Employment Events | ✅ | ✅ | ✅ |
| Migration | ✅ | ✅ | — |
| Reconciliation | ✅ | ✅ | ✅ |
| Reports | ✅ | ✅ | — |
| Exceptions | ✅ | ✅ | — |
| User Management | ✅ | ✅ | — |
| System Health | ✅ | ✅ | — |
