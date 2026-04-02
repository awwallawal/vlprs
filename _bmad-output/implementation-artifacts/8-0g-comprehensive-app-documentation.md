# Story 8.0g: Comprehensive App Documentation

Status: ready-for-dev

## Story

As a **new developer or end user**,
I want a comprehensive README and user guide explaining what each page does, what each card/table means, how figures are derived, and how pages connect,
So that I can understand the system without needing to ask the development team.

**Origin:** Planning Item B from E7+E6 retro (2026-03-29). Two deliverables: End-User Guide + Developer Documentation.

**Dependencies:** Should be the LAST prep story before UAT checkpoint — runs after 8.0a–8.0f so documentation reflects all prep story changes. However, the dev agent can start from the current codebase state and note any sections that depend on unmerged stories.

## Acceptance Criteria

1. **Given** an end user (AG officer, MDA officer, Dept Admin), **When** they open the End-User Guide, **Then** they can find an explanation of every page they have access to: what it does, what each card/table/metric means, how figures are derived, and how pages connect to each other.

2. **Given** the End-User Guide, **When** describing a metric card (e.g., "Total Exposure", "Monthly Recovery"), **Then** the guide explains in plain language: what the number represents, what data it's computed from, what "good" vs "concerning" looks like, and what action to take.

3. **Given** a new developer joining the project, **When** they open the Developer Documentation, **Then** they can understand: the monorepo structure, how to set up locally, the tech stack, how the API is organized, how the database schema is structured, and how the key data flows work (migration pipeline, submission lifecycle, reconciliation).

4. **Given** the Developer Documentation, **When** describing a page, **Then** it lists: the route path, the React component file, the TanStack Query hooks used, the API endpoints called, and the server services that produce the data.

5. **Given** both documents, **When** referencing a specific metric or feature, **Then** the documentation uses the same non-punitive vocabulary as the application (e.g., "Variance" not "Discrepancy", "Observation" not "Anomaly").

6. **Given** the End-User Guide, **When** describing role-based access, **Then** it clearly states which pages/features each role (Super Admin, Dept Admin, MDA Officer) can access, matching the sidebar navigation configuration.

## Tasks / Subtasks

- [ ] Task 1: Create End-User Guide (AC: 1, 2, 5, 6)
  - [ ] 1.1: Create `docs/end-user-guide.md` with the following structure:

    **Part 1 — Getting Started:**
    - [ ] 1.1.1: System overview: what VLPRS does, who it's for, the three user roles
    - [ ] 1.1.2: Login and session management: how to log in, session timeout behavior, "Continue Working" prompt
    - [ ] 1.1.3: Navigation guide: sidebar items per role, role home pages (SUPER_ADMIN → Dashboard, DEPT_ADMIN → Operations Hub, MDA_OFFICER → Submissions)

    **Part 2 — Executive Dashboard (SUPER_ADMIN):**
    - [ ] 1.1.4: Hero metrics section — 3 metric groups, **13 total metrics**. The dev agent MUST read `DashboardPage.tsx` and trace through `dashboardService` to get actual names and derivation — do NOT trust this list blindly:
      - **Primary Row (4):** Active Loans, Total Exposure, Fund Available, Monthly Recovery
      - **Portfolio Analytics (6):** Loans in Window, Outstanding Receivables, Collection Potential, At-Risk Amount, Completion Rate (60m), Completion Rate (All-Time)
      - **Reconciliation (3, SUPER_ADMIN/DEPT_ADMIN only):** Overall Match Rate, Full Variances, Top Variance MDAs
      - For EACH metric: name, plain-language meaning, how derived, what action to take
    - [ ] 1.1.5: MDA Compliance Grid — what each row shows, what status badges mean (Pending/Submitted/Awaiting)
    - [ ] 1.1.6: Attention Items — what generates an attention item, severity levels, how to resolve
    - [ ] 1.1.7: Metric Drill-Down — how clicking a metric shows per-MDA breakdown

    **Part 3 — Migration Dashboard:**
    - [ ] 1.1.9: Overview: the 6-tab layout (MDA Progress, Master Beneficiary Ledger, Observations, Duplicates, Coverage Tracker, Uploads)
    - [ ] 1.1.10: MDA Progress tab — what each progress bar means, stage definitions
    - [ ] 1.1.11: Migration Upload flow — step by step: upload file → column mapping → period detection → validation → baseline → reconciled
    - [ ] 1.1.12: Validation results — what variance categories mean (Clean, Minor Variance, Significant Variance, Rate Variance, Requires Clarification), what "Largest Variance" shows
    - [ ] 1.1.13: Three-vector comparison (after 8.0a): Scheme Expected vs Reverse Engineered vs MDA Declared — what each vector means in plain language
    - [ ] 1.1.14: Establishing baselines — what it does, why it matters, what the baseline amount represents
    - [ ] 1.1.15: Coverage Tracker — how to read the MDA × Month grid, what colors mean (emerald/amber/gray), how to click into a cell (after 8.0f)
    - [ ] 1.1.16: Observations — what each observation type means, review workflow
    - [ ] 1.1.17: Master Beneficiary Ledger — how to search, what each column shows

    **Part 4 — Submissions & Operations:**
    - [ ] 1.1.18: Monthly submission flow — CSV upload, manual entry, template download
    - [ ] 1.1.19: Comparison Summary — what "declared vs expected" means, variance categories
    - [ ] 1.1.20: Pre-submission checkpoint — what checks run, what to fix before submitting
    - [ ] 1.1.21: Employment events — what events exist (transfer, retirement, etc.), how to file
    - [ ] 1.1.22: Historical data upload — when and how to use it
    - [ ] 1.1.23: Payroll upload — AG consolidated payroll, auto-split by MDA

    **Part 5 — Exceptions & Reconciliation:**
    - [ ] 1.1.24: Exception queue — how exceptions are generated, priority levels, resolution workflow
    - [ ] 1.1.25: Three-way reconciliation page — Expected vs Declared vs Actual, what match/partial/full variance means
    - [ ] 1.1.26: Record annotations and event flag corrections — how to annotate and correct

    **Part 6 — Reports:**
    - [ ] 1.1.27: Executive Summary report — what each section contains, how to generate/download PDF
    - [ ] 1.1.28: MDA Compliance report — per-MDA breakdown
    - [ ] 1.1.29: Variance & Loan Snapshot reports — what they show, when to use each
    - [ ] 1.1.30: Weekly AG Report — purpose, content, schedule

    **Part 7 — Administration:**
    - [ ] 1.1.31: User management — invite, assign role, assign MDA, deactivate, reset password
    - [ ] 1.1.32: System health — what each metric means, when to be concerned

  - [ ] 1.2: Use screenshots or ASCII diagrams for key page layouts where helpful (e.g., dashboard hero metrics layout, migration upload flow diagram)
  - [ ] 1.3: Cross-reference MetricHelp glossary entries (`packages/shared/src/constants/metricGlossary.ts`) for metric descriptions — ensure consistency

- [ ] Task 2: Create Developer Documentation (AC: 3, 4, 5)
  - [ ] 2.1: Create `docs/developer-guide.md` with the following structure:

    **Part 1 — Architecture Overview:**
    - [ ] 2.1.1: Monorepo structure: `apps/client`, `apps/server`, `packages/shared`, `packages/testing`
    - [ ] 2.1.2: Tech stack summary: Express 5, React 18, Drizzle ORM, PostgreSQL, Zod, TanStack Query, Zustand, Vite, Vitest, Playwright
    - [ ] 2.1.3: Development setup: prerequisites, `pnpm install`, `.env` configuration, database setup, `pnpm dev`, seed data
    - [ ] 2.1.4: Key architectural decisions: immutable ledger (3-layer enforcement), financial arithmetic (Decimal.js, never floats), non-punitive vocabulary, MDA scoping

    **Part 2 — Page-by-Page Technical Guide:**
    - [ ] 2.1.5: For each major dashboard page, document:
      - Route path and component file
      - TanStack Query hooks used (with query keys)
      - API endpoints called
      - Server services that produce the data
      - Key data flow (which DB tables → which service → which API → which hook → which component)

    Pages to cover (prioritized):
      1. Executive Dashboard (`DashboardPage.tsx`)
      2. Migration Dashboard (`MigrationPage.tsx`) + Upload (`MigrationUploadPage.tsx`)
      3. Submissions (`SubmissionsPage.tsx`, `SubmissionDetailPage.tsx`)
      4. Reports (`ReportsPage.tsx`) — 5 report types
      5. Exceptions (`ExceptionsPage.tsx`, `ExceptionDetailPage.tsx`)
      6. Three-Way Reconciliation (`ThreeWayReconciliationPage.tsx`)
      7. Operations Hub (`OperationsHubPage.tsx`)
      8. Loan Detail (`LoanDetailPage.tsx`)
      9. System Health (`SystemHealthPage.tsx`)
      10. User Management (`AdminPage.tsx`)

    **Part 3 — Key Data Flows:**
    - [ ] 2.1.6: Migration pipeline flow: Excel upload → parse → map columns → detect period → extract records → validate (three-vector) → establish baseline → ledger entry → observation scan
    - [ ] 2.1.7: Monthly submission lifecycle: pre-submission check → CSV upload/manual entry → row validation → comparison engine → reconciliation → exception flagging → attention items
    - [ ] 2.1.8: Reconciliation engine: expected (from loans) vs declared (from submissions) vs actual (from payroll) → match/partial/variance
    - [ ] 2.1.9: Loan computation model: scheme formula (P×13.33%÷60), repayment schedule, balance reconstruction, auto-split deduction
    - [ ] 2.1.10: Report generation: composition layer (Promise.all over existing services), server-side PDF via @react-pdf/renderer

    **Part 4 — Database Reference:**
    - [ ] 2.1.11: Entity-relationship summary: key tables and their relationships (loans, ledger_entries, migration_records, mda_submissions, submission_rows, observations, exceptions)
    - [ ] 2.1.12: Naming conventions: snake_case tables, camelCase API, non-punitive enum values
    - [ ] 2.1.13: Migration rules: generate NEW, never re-generate, hash tracking

    **Part 5 — Testing & Deployment:**
    - [ ] 2.1.14: Testing strategy: Vitest unit/integration (co-located), Playwright E2E, structured UAT
    - [ ] 2.1.15: How to run tests: `pnpm test`, `pnpm test:integration`, `pnpm typecheck`, `pnpm lint`
    - [ ] 2.1.16: Docker deployment: `docker compose`, BUILD_SHA verification, `--force-recreate`
    - [ ] 2.1.17: Database migrations: `drizzle-kit generate`, `drizzle-kit migrate`, tracking table

  - [ ] 2.2: Include a page-to-service mapping table as a quick reference appendix

- [ ] Task 3: Verify accuracy and consistency (AC: 5)
  - [ ] 3.1: Cross-reference all metric descriptions against `metricGlossary.ts` entries
  - [ ] 3.2: Cross-reference all vocabulary against `vocabulary.ts` constants
  - [ ] 3.3: Verify all file paths mentioned in developer docs exist in the codebase
  - [ ] 3.4: Verify all route paths mentioned in the user guide match `navItems.ts` and the route definitions

- [ ] Task 4: Final review
  - [ ] 4.1: Read both documents end-to-end for coherence and completeness
  - [ ] 4.2: Verify non-punitive language throughout — no "error", "anomaly", "discrepancy", "invalid"
  - [ ] 4.3: Ensure both documents are self-contained — a reader shouldn't need to ask the dev team for clarification on any section

## Dev Notes

### Two Deliverables — Different Audiences

| Document | Audience | Tone | Focus |
|---|---|---|---|
| `docs/end-user-guide.md` | AG officers, MDA officers, Dept Admins | Plain language, no code | What each page does, what numbers mean, how to take action |
| `docs/developer-guide.md` | New developers onboarding | Technical, with code references | How the system is built, where to find things, how data flows |

### Approach: Read the Codebase, Not Guess

The dev agent must READ the actual components, hooks, services, and types to write accurate documentation. Do NOT guess what a metric means — find the service that computes it and trace the data flow.

For each metric card:
1. Find the component that renders it (e.g., `DashboardPage.tsx`)
2. Find the hook that fetches data (e.g., `useDashboardMetrics()`)
3. Find the API endpoint (e.g., `GET /api/dashboard/metrics`)
4. Find the service function (e.g., `dashboardService.getMetrics()`)
5. Read the SQL/Drizzle query to understand what's actually computed

### Key Source Files for Documentation

**Metric glossary** (authoritative descriptions): `packages/shared/src/constants/metricGlossary.ts`
**Vocabulary** (approved terms): `packages/shared/src/constants/vocabulary.ts`
**Navigation** (role-based sidebar): `apps/client/src/components/layout/navItems.ts`
**Route definitions**: `apps/client/src/router.tsx` or `apps/client/src/App.tsx`
**Architecture doc** (reference): `_bmad-output/planning-artifacts/architecture.md`

### Page Inventory (26 Dashboard Routes)

**Dashboard & Analytics:**
- `/dashboard` — Executive Dashboard (hero metrics, compliance grid, attention items)
- `/dashboard/drill-down/:metric` — Metric Drill-Down
- `/dashboard/operations` — Operations Hub (DEPT_ADMIN home)

**Loans:**
- `/dashboard/loans` — Filtered Loan List (classification filters)
- `/dashboard/mda/:mdaId` — MDA Detail
- `/dashboard/mda/:mdaId/loan/:loanId` — Loan Detail

**Submissions:**
- `/dashboard/submissions` — Submissions List (MDA_OFFICER home)
- `/dashboard/submissions/:submissionId` — Submission Detail
- `/dashboard/historical-upload` — Historical Upload
- `/dashboard/payroll-upload` — Payroll Upload
- `/dashboard/employment-events` — Employment Events

**Migration:**
- `/dashboard/migration` — Migration Dashboard (6 tabs)
- `/dashboard/migration/upload` — Migration Upload & Validation
- `/dashboard/migration/persons/:personKey` — Person Detail
- `/dashboard/migration/trace/:personKey` — Trace Report

**Reconciliation & Exceptions:**
- `/dashboard/reconciliation/three-way` — Three-Way Reconciliation
- `/dashboard/exceptions` — Exceptions Queue
- `/dashboard/exceptions/:id` — Exception Detail

**Reports:**
- `/dashboard/reports` — Reports (5 types: Executive Summary, MDA Compliance, Variance, Loan Snapshot, Weekly AG)

**Administration:**
- `/dashboard/admin` — User Management
- `/dashboard/profile` — User Profile
- `/dashboard/system-health` — System Health

### Role-Based Access Summary

| Role | Home Page | Key Capabilities |
|---|---|---|
| SUPER_ADMIN | `/dashboard` | Everything: dashboard, migration, reports, user management, payroll upload, system health |
| DEPT_ADMIN | `/dashboard/operations` | Operations, migration, submissions review, reconciliation, exceptions, reports, user management |
| MDA_OFFICER | `/dashboard/submissions` | Submit monthly returns, view submission history, file employment events, view reconciliation |

### Non-Punitive Vocabulary (Must Use Throughout)

- "Variance" not "Discrepancy" or "Error"
- "Observation" not "Anomaly" or "Issue"
- "Requires Clarification" not "Anomalous"
- "Rate Variance" not "Rate Error"
- "Attention Item" not "Alert" or "Warning"
- Amber/teal indicators, never red for data quality

Source: `packages/shared/src/constants/vocabulary.ts`

### What This Story Does NOT Change

- **No code changes** — this is a documentation-only story
- **No new features** — documents existing functionality
- **No UI changes** — no help buttons, tooltips, or in-app documentation (those are separate features)

### Format Guidelines

- Use GitHub-Flavored Markdown for both documents
- Include a table of contents at the top of each document
- Use tables for structured information (metrics, routes, columns)
- Use code blocks for file paths and technical references (developer guide only)
- Keep end-user guide free of code — use plain language and screenshots/diagrams
- Use ASCII diagrams for data flows (developer guide) — avoids dependency on external tools

### Prep Stories That May Affect Documentation

If these stories land before 8.0g, incorporate their changes:
- **8.0a** — Three-vector model (Scheme Expected / Reverse Engineered / MDA Declared)
- **8.0b** — Record detail drawer, correction flow, baseline guard
- **8.0c** — "Largest Variance" label, discard uploads, MetricHelp tooltips
- **8.0d** — Per-sheet period overlap detection
- **8.0e** — Extended session timeout (60 min), background refresh
- **8.0f** — Coverage tracker drill-down, CSV/Excel download

If any haven't merged yet, note them as "Coming soon" sections with placeholders.

### References

- [Source: _bmad-output/implementation-artifacts/epic-7-6-retro-2026-03-29.md#Planning Item B — Comprehensive documentation]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.0g]
- [Source: _bmad-output/planning-artifacts/architecture.md — System architecture reference]
- [Source: packages/shared/src/constants/metricGlossary.ts — Authoritative metric descriptions]
- [Source: packages/shared/src/constants/vocabulary.ts — Non-punitive vocabulary constants]
- [Source: apps/client/src/components/layout/navItems.ts — Role-based navigation config]
- [Source: apps/client/src/router.tsx — Route definitions]
- [Source: apps/server/src/routes/ — 17 API route handler files (+ 27 integration test files)]
- [Source: apps/server/src/services/ — ~55 service files (+ tests and PDF generators)]

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
