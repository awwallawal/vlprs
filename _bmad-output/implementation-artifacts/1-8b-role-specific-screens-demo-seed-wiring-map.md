# Story 1.8b: Role-Specific Screens, Demo Seed & Wiring Map

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->
<!-- Generated: 2026-02-19 | Epic: 1 — Project Foundation & Secure Access | Sprint: 1 -->
<!-- Blocked By: 1.8a (design tokens, components, and mock data hooks must exist) -->
<!-- Blocks: None (end of Sprint 1 UI chain) -->
<!-- FRs: FR32-FR36 (dashboard), FR42-FR46 (RBAC routing), FR16 (submission screen placeholder) -->
<!-- NFRs: NFR-PERF-2 (<500ms transitions), NFR-PERF-6 (<4s TTI), NFR-ACCESS-1 through 7 (WCAG 2.1 AA) -->

## Story

As a **product stakeholder**,
I want to log into the live hosted VLPRS at the client's domain with role-specific credentials and see a fully-designed, navigable product experience with realistic mock data across all major screens,
so that I can visualize the complete product on any device, provide early feedback, and track visible progress as screens are wired to real APIs sprint by sprint.

## Acceptance Criteria (BDD)

### AC1: Executive Dashboard Screen (Super Admin Home)

```gherkin
Given a user logged in with role super_admin
When they are redirected to their role-appropriate home screen
Then the Executive Dashboard displays:
  - 4 HeroMetricCard components: Active Loans (2,847), Total Exposure (₦2,418,350,000.00), Fund Available (₦892,000,000.00), Monthly Recovery (₦48,250,000.00) — each with count-up animation
  - Attention items section with 3 mock AttentionItemCard entries using non-punitive language:
    - "Ministry of Works — submission pending, 3 days past due"
    - "Ministry of Agriculture — variance identified in February submission"
    - "2 loans approaching zero balance — auto-stop certificates pending"
  - MDA compliance grid showing all 63 MDAs with mock submission statuses: realistic mix of Submitted (green badge), Pending (grey badge), Awaiting (amber/gold badge) — never red, never "Overdue" (non-punitive language per UX spec line 1390)
  - Skeleton loaders displayed during initial data fetch (no loading spinners blocking content)
And the dashboard is mobile-first: fully functional and legible on screens <768px
And hero metrics render as the first visible content (no layout shift)
```

### AC2: Progressive Drill-Down (Dashboard → MDA → Loan)

```gherkin
Given the Executive Dashboard is displayed
When a user taps a hero metric card or an MDA row in the compliance grid
Then they navigate to an MDA Detail screen showing:
  - MDA name, reporting officer name, submission history (last 3 months mock)
  - Loan count, total exposure for that MDA
  - List of loans with staff name, Staff ID, loan reference, outstanding balance (NairaDisplay), status badge
And breadcrumb navigation shows: Dashboard > [MDA Name] (max 3 levels)

Given the MDA Detail screen
When a user taps a loan row
Then they navigate to a Loan Detail screen showing:
  - Borrower name, Staff ID, MDA, loan reference, grade level tier
  - Loan amount, tenure, outstanding balance (NairaDisplay), loan status badge
  - Placeholder sections for "Repayment Schedule," "Ledger History," "Annotations"
  - Collapsed "How was this calculated?" accordion placeholder
And breadcrumb navigation shows: Dashboard > [MDA Name] > [Loan Ref]
```

### AC3: MDA Submission Screen (MDA Officer Home)

```gherkin
Given a user logged in with role mda_officer
When they are redirected to their role-appropriate home screen
Then the Submission View displays:
  - Header showing the officer's assigned MDA name (e.g., "Ministry of Health")
  - Pre-submission checkpoint section with mock items:
    - "2 staff approaching retirement within 12 months"
    - "1 staff with zero deduction last month and no event filed"
    — styled as checkpoint gate with confirmation checkbox
    — FileUploadZone is DISABLED until the officer checks the confirmation checkbox
    — Checkbox label: "I have reviewed the above items and confirm I am ready to submit"
  - FileUploadZone with instructions: "Upload your monthly 8-field CSV deduction file"
    and "Download CSV Template" link placeholder
  - "Manual Entry" button navigating to a placeholder form page
  - Submission history table with 3 mock past submissions:
    reference number (e.g., "HLT-2026-01-0001"), submission date, row count, status badge
  - Mock comparison summary for most recent submission using non-punitive language:
    "Comparison Complete" header with info icon, variance items with teal info circles and grey backgrounds
And the FileUploadZone accepts file selection and displays the filename but does not process the upload
And all content is scoped to the officer's assigned MDA — no data from other MDAs is visible
```

### AC4: Operations Hub Screen (Department Admin Home)

```gherkin
Given a user logged in with role dept_admin
When they are redirected to their role-appropriate home screen
Then the Operations Hub displays:
  - Migration Dashboard section: 63 MigrationProgressCard components using real Oyo State MDA names
    with mock statuses distributed across all 5 stages (per UX spec):
    8 Certified, 15 Validated, 20 Imported, 13 Pending, 7 Reconciled
  - Client-side filter/search on migration cards by MDA name
  - Loan search bar that accepts input and returns 3 mock loan results
    with staff name, Staff ID, MDA, and outstanding balance
  - Exception queue section: 3 mock ExceptionQueueRow entries
    sorted by priority (High, Medium, Low) with category badges, MDA names, descriptions
  - Quick action buttons: "Generate Report", "File Employment Event", "Compute Early Exit"
    — each navigates to a styled placeholder page with "Coming in Sprint [N]" messaging
```

### AC5: Navigation & Responsive Layout

```gherkin
Given any authenticated user on desktop (>1024px)
When they view the application
Then the Oyo Crimson sidebar (256px fixed) displays:
  - Oyo State crest/logo at top
  - User's name and role badge
  - Navigation items appropriate to their role:
    Super Admin: Dashboard, Reports, Exceptions
    Dept Admin: Operations, Migration, Reports, Exceptions
    MDA Officer: Submit, History
  - "Logout" at the bottom
And a global search bar is visible at top with Ctrl+K shortcut hint
  (non-functional — displays "Search coming soon" on interaction)

Given any authenticated user on tablet (768-1024px)
When they view the application
Then the sidebar defaults to collapsed icon-only mode (64px width)
And expands to full 256px on hover or click
And navigation items show only icons in collapsed state, icon + label when expanded

Given any authenticated user on mobile (<768px)
When they view the application
Then the sidebar collapses to a hamburger menu (Sheet overlay)
And the header bar shows the Oyo State crest and user's role badge
And all screens are fully usable at mobile width:
  tables scroll horizontally, hero metrics stack vertically, touch targets ≥44x44px
```

### AC6: Build Status Indicator

```gherkin
Given any authenticated user
When they view the sidebar footer (desktop) or settings section (mobile)
Then a "Build Status" indicator displays:
  - Current sprint label
  - Last deployment timestamp (from build metadata or env var)
  - Next milestone description
And the build status is configured via environment variables:
  VITE_SPRINT_LABEL="Sprint 1 — Foundation & UI Shell"
  VITE_NEXT_MILESTONE="Sprint 2 — Loan Computation Engine (real numbers)"
```

### AC7: Demo Seed Script

```gherkin
Given the development or production environment with the database running
When I run pnpm seed:demo
Then the following accounts are created:
  | Email                              | Role         | MDA Scope            |
  | ag@vlprs.oyo.gov.ng               | super_admin  | All MDAs             |
  | deputy.ag@vlprs.oyo.gov.ng        | super_admin  | All MDAs             |
  | admin@vlprs.oyo.gov.ng            | dept_admin   | All MDAs             |
  | health.officer@vlprs.oyo.gov.ng   | mda_officer  | Ministry of Health   |
  | education.officer@vlprs.oyo.gov.ng| mda_officer  | Ministry of Education|
And all accounts use a shared demo password meeting policy (min 8 chars, 1 upper, 1 lower, 1 digit)
  documented in .env.example as DEMO_SEED_PASSWORD
And 3 MDAs are seeded with full metadata: Ministry of Health, Ministry of Education, Ministry of Works and Transport
And mock loan records (10-15 per seeded MDA) with realistic Naira amounts,
  staff names, grade level tiers, and status distribution (Active, Completed, Applied)
And the remaining 60 MDAs are seeded as name-only entries (for compliance grid and migration dashboard)
And the seed script is idempotent — safe to run multiple times without duplicating data
And the seed script logs what it created: "Seeded 5 users, 63 MDAs, 38 loan records"
```

### AC8: Wiring Map

```gherkin
Given Stories 1.8a and 1.8b are complete
When I inspect WIRING-MAP.md in the project root
Then a documented mapping exists for every mock hook to its target API endpoint and delivery sprint:
  | Hook                      | Target Endpoint                  | Wire Sprint              |
  | useDashboardMetrics()     | GET /api/dashboard/metrics       | Sprint 5 (Epic 4)       |
  | useMdaComplianceGrid()    | GET /api/dashboard/compliance    | Sprint 5 (Epic 4)       |
  | useAttentionItems()       | GET /api/dashboard/attention     | Sprint 5 (Epic 4)       |
  | useMdaDetail(mdaId)       | GET /api/mdas/:id/summary        | Sprint 5 (Epic 4)       |
  | useLoanDetail(loanId)     | GET /api/loans/:id               | Sprint 2 (Epic 2)       |
  | useLoanSearch(query)      | GET /api/loans/search            | Sprint 2 (Epic 2)       |
  | useSubmissionHistory(mdaId)| GET /api/submissions?mdaId=     | Sprint 7 (Epic 5)       |
  | useMigrationStatus()      | GET /api/migration/status        | Sprint 4 (Epic 3)       |
  | useExceptionQueue()       | GET /api/exceptions              | Sprint 9 (Epic 7)       |
And each wiring event is a hook-level change only (swap mock for API call) — zero UI component modifications
```

## Tasks / Subtasks

- [ ] Task 1: Install dependencies and configure environment (AC: all)
  - [ ] 1.1 Install in `apps/client`: `pnpm add react-router` (v7 — single package, replaces react-router-dom)
  - [ ] 1.2 Note: `@tanstack/react-query`, `zustand`, `lucide-react` should already exist from Story 1.6. If missing, install them.
  - [ ] 1.3 Install shadcn/ui Sidebar component: `npx shadcn@latest add sidebar` in `apps/client` — this also installs Sheet + Tooltip dependencies automatically
  - [ ] 1.4 Add environment variables to `apps/client/.env`:
    ```
    VITE_SPRINT_LABEL="Sprint 1 — Foundation & UI Shell"
    VITE_NEXT_MILESTONE="Sprint 2 — Loan Computation Engine (real numbers)"
    VITE_DEPLOY_TIMESTAMP=""
    ```
  - [ ] 1.5 Add `DEMO_SEED_PASSWORD` to `.env.example` with placeholder value
  - [ ] 1.6 Update `apps/client/src/vite-env.d.ts` with new env var types:
    ```typescript
    interface ImportMetaEnv {
      readonly VITE_SPRINT_LABEL: string;
      readonly VITE_NEXT_MILESTONE: string;
      readonly VITE_DEPLOY_TIMESTAMP: string;
    }
    ```
  - [ ] 1.7 Verify `pnpm typecheck` and `pnpm test` still pass

- [ ] Task 2: Configure React Router with role-based lazy routes (AC: #1-#5)
  - [ ] 2.1 Create/update `apps/client/src/router.tsx` with `createBrowserRouter`:
    ```typescript
    import { createBrowserRouter } from 'react-router';

    export const router = createBrowserRouter([
      {
        path: '/',
        lazy: () => import('./components/layout/PublicLayout'),
        children: [
          { index: true, lazy: () => import('./pages/public/LoginPage') },
          { path: 'login', lazy: () => import('./pages/public/LoginPage') },
        ],
      },
      {
        path: '/dashboard',
        lazy: () => import('./components/layout/DashboardLayout'),
        children: [
          { index: true, lazy: () => import('./pages/dashboard/DashboardPage') },
          { path: 'mda/:mdaId', lazy: () => import('./pages/dashboard/MdaDetailPage') },
          { path: 'mda/:mdaId/loan/:loanId', lazy: () => import('./pages/dashboard/LoanDetailPage') },
          { path: 'submissions', lazy: () => import('./pages/dashboard/SubmissionsPage') },
          { path: 'operations', lazy: () => import('./pages/dashboard/OperationsHubPage') },
          { path: 'migration', lazy: () => import('./pages/dashboard/MigrationPage') },
          { path: 'exceptions', lazy: () => import('./pages/dashboard/ExceptionsPage') },
          { path: 'reports', lazy: () => import('./pages/dashboard/ReportsPage') },
          { path: 'admin', lazy: () => import('./pages/dashboard/AdminPage') },
          { path: 'placeholder/:feature', lazy: () => import('./pages/dashboard/PlaceholderPage') },
        ],
      },
    ]);
    ```
  - [ ] 2.2 Each lazy module exports a named `Component` (React Router v7 pattern):
    ```typescript
    export function Component() { return <DashboardPage />; }
    Component.displayName = 'DashboardPage';
    ```
  - [ ] 2.3 Update `apps/client/src/main.tsx` to use `RouterProvider`:
    ```typescript
    import { RouterProvider } from 'react-router';
    import { router } from './router';
    // wrap with QueryClientProvider and RouterProvider
    ```
  - [ ] 2.4 Role-based home redirect logic in DashboardLayout:
    - `super_admin` → `/dashboard` (Executive Dashboard)
    - `dept_admin` → `/dashboard/operations` (Operations Hub)
    - `mda_officer` → `/dashboard/submissions` (MDA Submission)

- [ ] Task 3: Create DashboardLayout with role-specific sidebar navigation (AC: #5)
  - [ ] 3.1 Create/update `apps/client/src/components/layout/DashboardLayout.tsx`:
    - Uses shadcn/ui `SidebarProvider` + `Sidebar` component (auto-handles mobile Sheet)
    - Oyo Crimson background (`bg-crimson`) for sidebar, white text
    - Sidebar header: Oyo State crest/logo + "VLPRS" title
    - Navigation items filtered by user role from auth store:
      ```typescript
      const NAV_ITEMS: Record<Role, NavItem[]> = {
        super_admin: [
          { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
          { label: 'Reports', icon: FileText, path: '/dashboard/reports' },
          { label: 'Exceptions', icon: AlertCircle, path: '/dashboard/exceptions' },
        ],
        dept_admin: [
          { label: 'Operations', icon: Settings, path: '/dashboard/operations' },
          { label: 'Migration', icon: Database, path: '/dashboard/migration' },
          { label: 'Reports', icon: FileText, path: '/dashboard/reports' },
          { label: 'Exceptions', icon: AlertCircle, path: '/dashboard/exceptions' },
        ],
        mda_officer: [
          { label: 'Submit', icon: Upload, path: '/dashboard/submissions' },
          { label: 'History', icon: Clock, path: '/dashboard/submissions' },
        ],
      };
      ```
    - Import role constants from `@vlprs/shared` — NEVER hardcode role strings
    - Sidebar footer: user name + role badge + Build Status indicator + Logout button
    - Auth guard: redirect to `/login` if no access token
    - Outlet for child routes
  - [ ] 3.2 Mobile header: Oyo State crest + role badge + hamburger trigger (`SidebarTrigger`)
  - [ ] 3.3 Sidebar width: 256px desktop (`SIDEBAR_WIDTH = "16rem"`), 64px tablet collapsed (`SIDEBAR_WIDTH_ICON = "4rem"`), 288px mobile sheet
    - Tablet (768-1024px): `collapsible="icon"` — defaults to collapsed icon-only, expands on hover/click
    - Nav items: 48px row height desktop, 56px row height mobile (touch target compliance)
  - [ ] 3.4 Active nav item: white left-border accent + `#7A181D` background
  - [ ] 3.5 Global search bar at top of main content area with Ctrl+K hint:
    - Non-functional — shows "Search coming soon" toast on interaction
    - Uses `useEffect` to listen for Ctrl+K keydown
  - [ ] 3.6 Accessibility — WCAG 2.1 AA requirements:
    - Skip link: render `<a href="#main-content" className="sr-only focus:not-sr-only ...">Skip to main content</a>` as first focusable element inside `SidebarProvider`
    - ARIA landmarks: `<nav aria-label="Main navigation">` on sidebar, `<main id="main-content" role="main">` on content area, `<search role="search">` on global search bar
    - Focus management on SPA route change: use `useEffect` on `location.pathname` to move focus to the page `<h1>` element after navigation (prevents screen reader users from getting lost)
  - [ ] 3.7 Create `apps/client/src/components/layout/Breadcrumb.tsx`:
    - Renders path hierarchy: Dashboard > [MDA Name] > [Loan Ref]
    - Max 3 levels deep
    - Uses React Router `useLocation` + `useParams`

- [ ] Task 4: Create Executive Dashboard screen — super_admin home (AC: #1)
  - [ ] 4.1 Create `apps/client/src/pages/dashboard/DashboardPage.tsx`:
    - Hero metrics section: 4-column grid (`grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4`)
    - Uses `useDashboardMetrics()` hook from Story 1.8a
    - `isPending` state → render `Skeleton` placeholders (NOT spinner)
    - Count-up animation duration: **200ms** (per UX spec line 572)
    - Respect `prefers-reduced-motion`: skip count-up animation and show final value immediately when user has reduced-motion preference enabled
    - Each `HeroMetricCard` has `onClick` navigating to relevant drill-down
  - [ ] 4.2 Attention items section:
    - Uses `useAttentionItems()` hook
    - Maps each item to `AttentionItemCard` component
    - Section heading: "Items Requiring Attention"
  - [ ] 4.3 MDA compliance grid section:
    - Uses `useMdaComplianceGrid()` hook
    - Renders as responsive table with columns: MDA Name, Status (Badge), Last Submission, Records
    - Status badges: Submitted (complete/green), Pending (pending/grey), Awaiting (review/gold — label "Awaiting [Month]", NEVER "Overdue") — NEVER red
    - Rows are clickable → navigate to MDA Detail page
    - On mobile: horizontal scroll with sticky first column (MDA Name)
  - [ ] 4.4 "Share as PDF" placeholder button:
    - Primary crimson button in top-right of dashboard header area, always visible (per UX spec lines 484, 557)
    - **Disabled** with tooltip: "PDF export — Coming in Sprint 10 (Epic 6)"
    - Uses `FileText` icon from lucide-react
  - [ ] 4.5 Ensure hero metrics render FIRST (no layout shift from compliance grid below)
  - [ ] 4.6 Create `apps/client/src/pages/dashboard/DashboardPage.test.tsx`:
    - Renders hero metrics with mock data
    - Shows skeleton loaders when pending
    - Attention items render with non-punitive language
    - Compliance grid renders 63 MDAs
    - Responsive: hero metrics stack on mobile

- [ ] Task 5: Create Progressive Drill-Down pages (AC: #2)
  - [ ] 5.1 Create `apps/client/src/pages/dashboard/MdaDetailPage.tsx`:
    - Receives `mdaId` from route params
    - Uses `useMdaDetail(mdaId)` hook
    - Header: MDA name + code + officer name
    - Summary cards: loan count, total exposure (NairaDisplay), monthly recovery
    - Submission history table (last 3 months from `useSubmissionHistory(mdaId)`)
    - Loan list table: staff name, Staff ID, loan ref, outstanding balance (NairaDisplay), status badge
    - Each loan row clickable → navigate to Loan Detail
    - `isPending` state → render Skeleton placeholders for summary cards and tables
    - Breadcrumb: Dashboard > [MDA Name]
  - [ ] 5.2 Create `apps/client/src/pages/dashboard/LoanDetailPage.tsx`:
    - Receives `mdaId` and `loanId` from route params
    - Uses `useLoanDetail(loanId)` hook
    - Header: borrower name + Staff ID
    - Detail cards: MDA, loan ref, grade level tier, loan amount (NairaDisplay), tenure, outstanding balance (NairaDisplay), status badge
    - Placeholder sections with "Coming in Sprint [N]" messaging:
      - "Repayment Schedule" → "Coming in Sprint 2 (Epic 2)"
      - "Ledger History" → "Coming in Sprint 2 (Epic 2)"
      - "Annotations" → "Coming in Sprint 9 (Epic 7)"
    - Collapsed accordion: "How was this calculated?" → "Coming in Sprint 2"
    - `isPending` state → render Skeleton placeholders for detail cards
    - Breadcrumb: Dashboard > [MDA Name] > [Loan Ref]
  - [ ] 5.3 Create tests for both pages: render with mock data, breadcrumb display, placeholder sections

- [ ] Task 6: Create MDA Submission screen — mda_officer home (AC: #3)
  - [ ] 6.1 Create `apps/client/src/pages/dashboard/SubmissionsPage.tsx`:
    - Header: officer's MDA name from auth store/JWT (`mdaId` → MDA name lookup)
    - Scoping confirmation: "You are viewing data for: [MDA Name]"
  - [ ] 6.2 Pre-submission checkpoint section (gateway pattern per UX spec):
    - Mock checklist items with info icon (teal) and light background
    - Items: "2 staff approaching retirement within 12 months", "1 staff with zero deduction last month and no event filed"
    - Confirmation checkbox below items: "I have reviewed the above items and confirm I am ready to submit"
    - FileUploadZone and Manual Entry button are **disabled** (greyed out, `pointer-events-none`) until checkbox is checked
    - `useState` boolean `checkpointConfirmed` controls enabled state
  - [ ] 6.3 File upload section:
    - `FileUploadZone` component from Story 1.8a
    - Instructions text: "Upload your monthly 8-field CSV deduction file"
    - "Download CSV Template" link (href="#" placeholder)
    - On file select: display filename but DO NOT process upload
  - [ ] 6.4 "Manual Entry" button → navigates to `/dashboard/placeholder/manual-entry`
  - [ ] 6.5 Submission history table:
    - Uses `useSubmissionHistory(mdaId)` hook
    - Columns: Reference Number, Submission Date, Row Count, Status (Badge)
    - 3 mock entries with format: "HLT-2026-01-0001"
  - [ ] 6.6 Mock comparison summary panel (most recent submission):
    - Header: "Comparison Complete" with info icon
    - Variance items with teal info circles and grey backgrounds
    - NEVER use "error", red, or warning triangles
  - [ ] 6.7 Create `apps/client/src/pages/dashboard/SubmissionsPage.test.tsx`

- [ ] Task 7: Create Operations Hub screen — dept_admin home (AC: #4)
  - [ ] 7.1 Create `apps/client/src/pages/dashboard/OperationsHubPage.tsx`:
    - Section heading: "Operations Hub"
    - `isPending` states for each section → render Skeleton placeholders (migration grid, search results, exception queue)
  - [ ] 7.2 Migration Dashboard section:
    - Uses `useMigrationStatus()` hook
    - 63 `MigrationProgressCard` components using real Oyo State MDA names
    - Realistic distribution across 5 UX-spec stages: 8 Certified, 15 Validated, 20 Imported, 13 Pending, 7 Reconciled
    - Stage order: Pending → Imported → Validated → Reconciled → Certified (per UX spec line 1014)
    - Client-side filter input: filters cards by MDA name (case-insensitive)
    - Grid layout: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`
  - [ ] 7.3 Loan search section:
    - Search input with debounce (300ms)
    - Uses `useLoanSearch(query)` hook (enabled only when query.length >= 2)
    - Displays 3 mock results: staff name, Staff ID, MDA, outstanding balance (NairaDisplay)
    - Empty-results state: when query doesn't match mock data, show "No records found for '[term]'" with search term retained in input
    - Each result clickable → navigate to Loan Detail
  - [ ] 7.4 Exception queue section:
    - Uses `useExceptionQueue()` hook
    - Renders 3 `ExceptionQueueRow` components sorted by priority
  - [ ] 7.5 Quick action buttons:
    - "Generate Report" → `/dashboard/placeholder/generate-report` ("Coming in Sprint 10")
    - "File Employment Event" → `/dashboard/placeholder/employment-event` ("Coming in Sprint 8")
    - "Compute Early Exit" → `/dashboard/placeholder/early-exit` ("Coming in Sprint 11")
    - Styled as secondary buttons with descriptive icons
  - [ ] 7.6 Create `apps/client/src/pages/dashboard/OperationsHubPage.test.tsx`

- [ ] Task 8: Create placeholder and utility pages (AC: #2, #4)
  - [ ] 8.1 Create `apps/client/src/pages/dashboard/PlaceholderPage.tsx`:
    - Reads `:feature` param from route
    - Displays: feature name, "Coming in Sprint [N]" message, back navigation
    - Map of feature → sprint:
      ```typescript
      const FEATURE_SPRINTS: Record<string, { label: string; sprint: string }> = {
        'generate-report': { label: 'Generate Report', sprint: 'Sprint 10 (Epic 6)' },
        'employment-event': { label: 'File Employment Event', sprint: 'Sprint 8 (Epic 11)' },
        'early-exit': { label: 'Compute Early Exit', sprint: 'Sprint 11 (Epic 12)' },
        'manual-entry': { label: 'Manual Entry Form', sprint: 'Sprint 7 (Epic 5)' },
      };
      ```
    - Styled with a "construction" icon and inviting design (not error-like)
  - [ ] 8.2 Create stub pages for routes that need to exist but aren't featured in this story:
    - `MigrationPage.tsx` — redirect to Operations Hub or simple placeholder
    - `ExceptionsPage.tsx` — simple placeholder
    - `ReportsPage.tsx` — simple placeholder
    - `AdminPage.tsx` — simple placeholder
  - [ ] 8.3 Create `apps/client/src/pages/public/LoginPage.tsx` if not already created by Story 1.6

- [ ] Task 9: Create Build Status indicator component (AC: #6)
  - [ ] 9.1 Create `apps/client/src/components/shared/BuildStatus.tsx`:
    - Reads from `import.meta.env.VITE_SPRINT_LABEL`, `VITE_NEXT_MILESTONE`, `VITE_DEPLOY_TIMESTAMP`
    - Displays in sidebar footer (desktop) or settings section (mobile)
    - Format: Sprint label (bold) + deployment timestamp + next milestone (muted)
    - Compact design: max 3 lines of text
  - [ ] 9.2 Create `apps/client/src/components/shared/BuildStatus.test.tsx`

- [ ] Task 10: Enhance demo seed script (AC: #7)
  - [ ] 10.1 Update `apps/server/src/db/seed-demo.ts`:
    - Read `DEMO_SEED_PASSWORD` from environment (fallback: 'DemoPass1')
    - Hash password with bcrypt (import from existing `lib/password.ts`)
  - [ ] 10.2 Seed 5 user accounts (idempotent via `onConflictDoNothing` on email):
    ```typescript
    const DEMO_USERS = [
      { email: 'ag@vlprs.oyo.gov.ng', firstName: 'Accountant', lastName: 'General', role: 'super_admin', mdaId: null },
      { email: 'deputy.ag@vlprs.oyo.gov.ng', firstName: 'Deputy', lastName: 'AG', role: 'super_admin', mdaId: null },
      { email: 'admin@vlprs.oyo.gov.ng', firstName: 'Department', lastName: 'Admin', role: 'dept_admin', mdaId: null },
      { email: 'health.officer@vlprs.oyo.gov.ng', firstName: 'Health', lastName: 'Officer', role: 'mda_officer', mdaId: healthMdaId },
      { email: 'education.officer@vlprs.oyo.gov.ng', firstName: 'Education', lastName: 'Officer', role: 'mda_officer', mdaId: educationMdaId },
    ];
    ```
  - [ ] 10.3 Seed 63 MDAs (idempotent via `onConflictDoNothing` on code):
    - 3 full MDAs with complete metadata: Ministry of Health (HLT), Ministry of Education (EDU), Ministry of Works and Transport (WKT)
    - Remaining 60 as name-only entries using real Oyo State MDA names
    - Reuse the MDA list from `apps/client/src/mocks/oyoMdas.ts` (created in 1.8a) — import or duplicate
  - [ ] 10.4 Seed mock loan records (10-15 per seeded MDA = ~38 total):
    - **IMPORTANT:** You will need a `loans` table. Check if it exists in schema.ts. If NOT yet defined (it may come in Epic 2), create a minimal `loans` table schema sufficient for seed data OR skip loan seeding and add a TODO comment for Epic 2. DO NOT create a full loans table — that's Epic 2 scope.
    - Realistic Naira amounts by grade level tier:
      - Tier 1: ₦500K-₦800K, Tier 2: ₦800K-₦1.5M, Tier 3: ₦1.5M-₦3M, Tier 4: ₦3M-₦5M
    - Status distribution: 60% Active, 25% Completed, 15% Applied
    - Nigerian staff names
  - [ ] 10.5 Wrap all inserts in a single transaction for atomicity
  - [ ] 10.6 Log summary: `console.log('Seeded 5 users, 63 MDAs, 38 loan records')`
  - [ ] 10.7 Ensure script exits cleanly: `process.exit(0)` on success, `process.exit(1)` on error
  - [ ] 10.8 Create `apps/server/src/db/seed-demo.test.ts` — verify idempotency (run twice, same counts)

- [ ] Task 11: Create WIRING-MAP.md (AC: #8)
  - [ ] 11.1 Create `WIRING-MAP.md` in project root with:
    - Table mapping each mock hook → target API endpoint → wire sprint
    - Instructions for wiring: "Change only the queryFn inside the hook. Zero UI component changes."
    - Example before/after code snippet showing mock → API transition
    - Status column: all "Mock" for now
  - [ ] 11.2 Include all 9 hooks from Story 1.8a

- [ ] Task 12: Add Playwright E2E smoke tests (AC: all)
  - [ ] 12.1 Check if Playwright is already configured from Story 1.6/1.7. If not, skip E2E and add TODO.
  - [ ] 12.2 If Playwright exists, create `apps/client/e2e/role-screens.spec.ts`:
    - Login as super_admin → verify redirected to Executive Dashboard → see hero metrics
    - Login as dept_admin → verify redirected to Operations Hub → see migration cards
    - Login as mda_officer → verify redirected to Submission page → see MDA name
    - Test drill-down: click MDA row → MDA Detail → click loan → Loan Detail → verify breadcrumbs
    - Test mobile viewport: verify hamburger menu appears, sidebar hidden
  - [ ] 12.3 These tests run against mock data only — no real API needed

- [ ] Task 13: Verify all tests pass (AC: all)
  - [ ] 13.1 Run `pnpm --filter shared build` — types compile
  - [ ] 13.2 Run `pnpm test` from monorepo root — all workspaces pass
  - [ ] 13.3 Run `pnpm typecheck` — no type errors
  - [ ] 13.4 Run `pnpm lint` — no lint errors
  - [ ] 13.5 Verify all existing Story 1.1-1.8a tests still pass (no regressions)

## Dev Notes

### Critical Context — What This Story Establishes

This is **Story 8b of 58** — the **demo-ready product experience**. When complete, stakeholders can log into the live VLPRS at the client's domain with 5 different credentials and see role-specific screens with realistic mock data. This is the Sprint 1 demonstrability milestone:

> **Live product shell** — branded login, role-specific screens with mock data, 5 seeded demo accounts, hosted on client domain. AG can open dashboard on her phone.

**VLPRS is a government financial system for the Oyo State Accountant General's Office (AG).** The AG's primary usage is checking dashboard metrics on her phone during 30-second glances. The design must feel like a **modern fintech dashboard**, not a legacy government form.

### What Story 1.8a Produces (Must Exist Before Starting)

| Component | Location | Purpose |
|---|---|---|
| `HeroMetricCard` | `components/shared/HeroMetricCard.tsx` | Dashboard headline numbers |
| `NairaDisplay` | `components/shared/NairaDisplay.tsx` | Formatted ₦ amounts |
| `AttentionItemCard` | `components/shared/AttentionItemCard.tsx` | Non-punitive attention items |
| `FileUploadZone` | `components/shared/FileUploadZone.tsx` | CSV upload area |
| `MigrationProgressCard` | `components/shared/MigrationProgressCard.tsx` | MDA migration tracking |
| `ExceptionQueueRow` | `components/shared/ExceptionQueueRow.tsx` | Exception queue entries |
| `Badge` (extended) | `components/ui/badge.tsx` | review/info/complete/pending/variance |
| `formatters.ts` | `lib/formatters.ts` | formatNaira, formatDate, formatCompactNaira |
| 9 mock data hooks | `hooks/use*.ts` | useDashboardMetrics, useMdaComplianceGrid, etc. |
| 10 mock data files | `mocks/*.ts` | Realistic Oyo State data |
| Shared types | `packages/shared/src/types/*.ts` | DashboardMetrics, LoanSummary, etc. |

**What earlier stories created (also must exist):**

| Component | Location | Story |
|---|---|---|
| `globals.css` @theme | `apps/client/src/styles/globals.css` | 1.1 |
| `cn()` utility | `apps/client/src/lib/utils.ts` | 1.1 |
| TanStack Query setup | `apps/client/src/lib/queryClient.ts` | 1.6 |
| Zustand auth store | `apps/client/src/stores/authStore.ts` | 1.6 |
| API client | `apps/client/src/lib/apiClient.ts` | 1.6 |
| AuthGuard | `apps/client/src/components/layout/AuthGuard.tsx` | 1.6 |
| Router foundation | `apps/client/src/router.tsx` | 1.6 |
| shadcn/ui components | `apps/client/src/components/ui/` | 1.6 |
| User/MDA/role DB tables | `apps/server/src/db/schema.ts` | 1.1-1.4 |
| Password hashing | `apps/server/src/lib/password.ts` | 1.2 |
| JWT auth + RBAC middleware | `apps/server/src/middleware/` | 1.2-1.4 |
| ROLES constant | `packages/shared/src/constants/` | 1.2 |

### What NOT To Do

1. **DO NOT use floating-point numbers for financial amounts** — All Naira amounts are `string` type. Use `NairaDisplay` for display. Computation happens server-side with `decimal.js`.
2. **DO NOT use warning triangles (⚠) for variance/attention items** — ALWAYS use info circle (ℹ) from lucide-react in teal.
3. **DO NOT use red (#DC2626) for data variances, attention items, or overdue statuses** — Red is EXCLUSIVELY for destructive actions (delete buttons). Use gold for attention, teal for info, grey for variance.
4. **DO NOT use crimson (#9C1E23) in data content areas** — Crimson lives ONLY in sidebar, header, and primary buttons.
5. **DO NOT store server/mock data in Zustand** — All data flows through TanStack Query hooks. Zustand is ONLY for UI state (sidebar toggle, filters).
6. **DO NOT hardcode role strings** — Import `ROLES` from `@vlprs/shared`. OSLRS lesson: frontend/backend role string mismatch caused 3 roles to fail at runtime despite 53 passing tests.
7. **DO NOT use `isLoading` from TanStack Query v5** — Use `isPending` for "no data yet" state. v5 renamed `isLoading` to `isPending`.
8. **DO NOT use `React.lazy()` for code splitting** — Use React Router v7's `lazy` property on route objects instead (exports named `Component`).
9. **DO NOT create a full loans table in the database** — That's Epic 2. If needed for seed, create minimal schema or add a TODO.
10. **DO NOT process file uploads** — FileUploadZone accepts file selection and shows filename only. Actual processing is Epic 5.
11. **DO NOT create a separate `__tests__` directory** — Tests are co-located next to source files.
12. **DO NOT use `react-router-dom`** — v7 uses just `react-router` as the single package.
13. **DO NOT compare MDAs against each other** — Non-punitive language means each MDA is shown independently, not ranked.

### Screen Composition Architecture

```
DashboardLayout (Skip Link + AuthGuard + SidebarProvider + Sidebar + ARIA landmarks + Outlet)
├── /dashboard          → DashboardPage (super_admin home)
│   ├── Hero Metrics Grid (useDashboardMetrics)
│   ├── Attention Items (useAttentionItems)
│   └── MDA Compliance Grid (useMdaComplianceGrid)
│
├── /dashboard/mda/:id  → MdaDetailPage
│   ├── MDA Summary Cards (useMdaDetail)
│   ├── Submission History (useSubmissionHistory)
│   └── Loan List Table (loans from MDA detail)
│
├── /dashboard/mda/:id/loan/:id → LoanDetailPage
│   ├── Loan Detail Cards (useLoanDetail)
│   └── Placeholder Sections (schedule, ledger, annotations)
│
├── /dashboard/submissions → SubmissionsPage (mda_officer home)
│   ├── MDA Scope Header
│   ├── Pre-Submission Checkpoint (checkbox gate)
│   ├── FileUploadZone + "Manual Entry" button (disabled until checkpoint confirmed)
│   ├── Submission History Table (useSubmissionHistory)
│   └── Mock Comparison Summary
│
├── /dashboard/operations → OperationsHubPage (dept_admin home)
│   ├── Migration Dashboard Grid (useMigrationStatus)
│   ├── Loan Search (useLoanSearch)
│   ├── Exception Queue (useExceptionQueue)
│   └── Quick Action Buttons
│
└── /dashboard/placeholder/:feature → PlaceholderPage
    └── "Coming in Sprint [N]" messaging
```

### Role → Home Route Mapping

```typescript
const ROLE_HOME_ROUTES: Record<string, string> = {
  super_admin: '/dashboard',
  dept_admin: '/dashboard/operations',
  mda_officer: '/dashboard/submissions',
};
```

Use this in DashboardLayout's index route to redirect users to their role-appropriate home.

### Responsive Design Rules

| Element | Mobile (<768px) | Tablet (768-1024px) | Desktop (>1024px) |
|---|---|---|---|
| Sidebar | Sheet overlay (hamburger) | Collapsible icon-only (64px/256px) | Fixed 256px |
| Hero metrics | 1 column stacked | 2 columns | 4 columns |
| Tables | Horizontal scroll, sticky col 1 | Full visible | Full visible |
| Migration cards | 1 column | 2 columns | 3 columns |
| Touch targets | ≥44x44px | ≥44x44px | N/A |
| FileUploadZone | Tap-to-browse only | Drag-drop | Drag-drop |

### shadcn/ui Sidebar — Key Implementation Details

The shadcn/ui Sidebar component auto-handles mobile via Sheet. Key patterns:

```tsx
// DashboardLayout.tsx structure
import {
  SidebarProvider, Sidebar, SidebarContent, SidebarGroup,
  SidebarGroupLabel, SidebarGroupContent, SidebarMenu,
  SidebarMenuItem, SidebarMenuButton, SidebarHeader,
  SidebarFooter, SidebarTrigger, useSidebar,
} from '@/components/ui/sidebar';

export function Component() {
  return (
    <SidebarProvider defaultOpen={true}>
      {/* collapsible="offcanvas" on mobile (<768px), "icon" on tablet (768-1024px), "none" on desktop (>1024px) */}
      <Sidebar variant="sidebar" collapsible="offcanvas" className="bg-crimson text-white">
        <SidebarHeader>{/* Oyo crest + VLPRS */}</SidebarHeader>
        <SidebarContent>{/* Role-filtered nav items */}</SidebarContent>
        <SidebarFooter>{/* User info + BuildStatus + Logout */}</SidebarFooter>
      </Sidebar>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-white">Skip to main content</a>
      <main id="main-content" role="main" className="flex-1">
        <header className="md:hidden">{/* Mobile header with SidebarTrigger */}</header>
        <Breadcrumb />
        <Outlet />
      </main>
    </SidebarProvider>
  );
}
```

The `collapsible="offcanvas"` makes the sidebar render in a Sheet on mobile automatically. No manual Sheet wiring needed.

Sidebar keyboard shortcut: `Ctrl+B` toggles by default (built into shadcn/ui Sidebar).

### Non-Punitive Design Enforcement

| Element | Correct | Incorrect |
|---|---|---|
| Late submission | Amber/gold badge "Awaiting [Month]" or "Pending" | Red badge "Overdue" |
| Variance icon | Info circle (ℹ) in teal | Warning triangle (⚠) |
| Attention background | Amber/gold (#FDF8E8) | Red (#FEE2E2) |
| Comparison header | "Comparison Complete" | "Errors Found" |
| Upload error | "Upload needs attention" | "Upload failed" |
| MDA status | Independent status per MDA | Ranked/compared MDAs |
| Crimson usage | Sidebar, header, buttons ONLY | Data content areas |

### Demo Seed Script — Database Pattern

Use Drizzle ORM's `onConflictDoNothing()` for idempotency:

```typescript
// apps/server/src/db/seed-demo.ts
import { db } from './index';
import { users, mdas } from './schema';
import { hashPassword } from '../lib/password';

async function seedDemo() {
  const password = process.env.DEMO_SEED_PASSWORD || 'DemoPass1';
  const hashed = await hashPassword(password);

  await db.transaction(async (tx) => {
    // 1. Seed MDAs first (users reference mdas via mdaId)
    const mdaList = [...FULL_MDAS, ...NAME_ONLY_MDAS]; // 63 total
    for (const mda of mdaList) {
      await tx.insert(mdas)
        .values({ name: mda.name, code: mda.code })
        .onConflictDoNothing({ target: mdas.code });
    }

    // 2. Lookup seeded MDA IDs for officer assignment
    const healthMda = await tx.query.mdas.findFirst({ where: eq(mdas.code, 'HLT') });
    const educationMda = await tx.query.mdas.findFirst({ where: eq(mdas.code, 'EDU') });

    // 3. Seed users
    for (const user of DEMO_USERS) {
      await tx.insert(users)
        .values({ ...user, hashedPassword: hashed, mdaId: user.mdaId })
        .onConflictDoNothing({ target: users.email });
    }

    // 4. Seed mock loans (if loans table exists)
    // TODO: Implement when loans table is created in Epic 2
  });

  console.log('Seeded 5 users, 63 MDAs');
}
```

### Architecture Compliance

**Data Flow Pattern (this story follows):**

```
Mock Data (from 1.8a: src/mocks/)
  ↓
TanStack Query Hooks (from 1.8a: src/hooks/)
  ↓ useQuery with isPending/isSuccess
Page Components (NEW in 1.8b: src/pages/dashboard/)
  ↓ consume hooks, render layout
Shared Components (from 1.8a: src/components/shared/)
  ↓ receive typed props
Formatted Display (from 1.8a: lib/formatters.ts)
```

**Money Format Chain:**
- DB: `NUMERIC(15,2)` → API: `string` "278602.72" → Frontend: `NairaDisplay` "₦278,602.72"
- NEVER use `Number`, `parseFloat`, or floating-point for money

**Query Key Convention:**
```typescript
['dashboard', 'metrics']           // hero metrics
['dashboard', 'compliance']        // MDA grid
['dashboard', 'attention']         // attention items
['mda', mdaId]                     // single MDA detail
['loans', loanId]                  // single loan detail
['loans', 'search', query]         // loan search
['submissions', { mdaId }]         // submission history
['migration', 'status']            // migration dashboard
['exceptions']                     // exception queue
```

**API Response Envelope (for future wiring reference):**
```typescript
// Success: { success: true, data: { ... } }
// Paginated: { success: true, data: [...], pagination: { page, pageSize, totalItems, totalPages } }
// Error: { success: false, error: { code, message, details } }
```

### Library & Framework Requirements

**Dependencies to install in this story:**

| Package | Location | Purpose |
|---|---|---|
| `react-router` | apps/client | Routing (v7 — single package) |
| shadcn/ui `sidebar` | apps/client | Sidebar + mobile sheet |

**Already installed (DO NOT reinstall):**

| Package | Purpose | Installed By |
|---|---|---|
| `@tanstack/react-query` | Server state hooks | Story 1.6 |
| `zustand` | UI state (sidebar toggle) | Story 1.6 |
| `lucide-react` | Icons | Story 1.6 |
| `recharts` | Charts (installed, used later) | Story 1.8a |
| `date-fns` | Date formatting | Story 1.8a |
| shadcn/ui components | UI primitives | Stories 1.1, 1.6 |

### File Structure — What This Story Creates

```
apps/client/src/
├── main.tsx                              # MODIFY — add RouterProvider
├── router.tsx                            # NEW or MODIFY — createBrowserRouter with lazy routes
├── vite-env.d.ts                         # MODIFY — add VITE_ env var types
│
├── components/
│   ├── ui/
│   │   └── sidebar.tsx                   # NEW — via npx shadcn add sidebar
│   ├── shared/
│   │   └── BuildStatus.tsx               # NEW
│   │   └── BuildStatus.test.tsx          # NEW
│   └── layout/
│       ├── DashboardLayout.tsx           # NEW or MAJOR MODIFY — SidebarProvider + role nav
│       ├── Breadcrumb.tsx                # NEW
│       └── PublicLayout.tsx              # NEW or VERIFY EXISTS
│
├── pages/
│   ├── public/
│   │   └── LoginPage.tsx                 # VERIFY EXISTS (from 1.6)
│   └── dashboard/
│       ├── DashboardPage.tsx             # NEW — Executive Dashboard
│       ├── DashboardPage.test.tsx        # NEW
│       ├── MdaDetailPage.tsx             # NEW — MDA drill-down
│       ├── MdaDetailPage.test.tsx        # NEW
│       ├── LoanDetailPage.tsx            # NEW — Loan drill-down
│       ├── LoanDetailPage.test.tsx       # NEW
│       ├── SubmissionsPage.tsx           # NEW — MDA officer home
│       ├── SubmissionsPage.test.tsx      # NEW
│       ├── OperationsHubPage.tsx         # NEW — dept_admin home
│       ├── OperationsHubPage.test.tsx    # NEW
│       ├── PlaceholderPage.tsx           # NEW — "Coming in Sprint N"
│       ├── MigrationPage.tsx             # NEW — stub/redirect
│       ├── ExceptionsPage.tsx            # NEW — stub
│       ├── ReportsPage.tsx               # NEW — stub
│       └── AdminPage.tsx                 # NEW — stub

apps/server/src/
└── db/
    └── seed-demo.ts                      # MAJOR MODIFY — add MDAs, users, loans

(project root)
├── WIRING-MAP.md                         # NEW
├── .env.example                          # MODIFY — add DEMO_SEED_PASSWORD
└── apps/client/.env                      # MODIFY — add VITE_ vars
```

**Files this story MUST NOT modify:**

```
apps/server/src/routes/                   # No API route changes
apps/server/src/services/                 # No service changes
apps/server/src/middleware/               # No middleware changes
apps/client/src/components/shared/        # Components from 1.8a — DO NOT MODIFY
apps/client/src/hooks/use*Data.ts         # Hooks from 1.8a — DO NOT MODIFY
apps/client/src/mocks/                    # Mock data from 1.8a — DO NOT MODIFY
apps/client/src/lib/formatters.ts         # Formatters from 1.8a — DO NOT MODIFY
packages/shared/src/types/               # Types from 1.8a — DO NOT MODIFY
packages/shared/src/constants/           # Constants — DO NOT MODIFY
packages/shared/src/validators/          # Validators — DO NOT MODIFY
```

### Previous Story Intelligence

**From Story 1.1 (scaffold):**
1. Tailwind CSS v4 uses CSS-first config (`@theme` in globals.css) — NO `tailwind.config.js`
2. shadcn/ui configured with `components.json` — `@` aliases, slate base colour
3. `cn()` utility at `apps/client/src/lib/utils.ts`
4. Tests co-located next to source files (not in `__tests__/`)
5. Vitest configured in `vite.config.ts` with `globals: true`, `environment: 'jsdom'`

**From Story 1.2 (auth):**
1. User + MDA tables exist in `apps/server/src/db/schema.ts`
2. Password hashing via `apps/server/src/lib/password.ts` — reuse for seed script
3. Users have: email, firstName, lastName, role, mdaId, hashedPassword, isActive
4. MDAs have: id, name, code, createdAt, updatedAt
5. Role enum: `['super_admin', 'dept_admin', 'mda_officer']`

**From Story 1.6 (frontend shell):**
1. TanStack Query `QueryClient` at `apps/client/src/lib/queryClient.ts` with `staleTime: 5min`
2. Zustand auth store at `apps/client/src/stores/authStore.ts` — has user, role, accessToken
3. API client at `apps/client/src/lib/apiClient.ts` — hooks will use when wiring
4. `lucide-react` installed for icons
5. shadcn/ui components: input, label, card, badge, sheet, dialog, separator, skeleton, sonner, form

**From Story 1.8a (design foundation):**
1. All 6 shared components fully tested and available
2. 9 TanStack Query hooks returning mock data — ready to consume in pages
3. Mock data with realistic Oyo State MDA names and Naira amounts
4. Formatters tested: formatNaira, formatDate, formatDateTime, formatCompactNaira
5. DO NOT use `isLoading` — use `isPending` (TanStack Query v5)

### Latest Technology Intelligence (Feb 2026)

| Technology | Version | Key Notes for This Story |
|---|---|---|
| `react-router` | 7.13.0 | Single package (not react-router-dom). Use `lazy` prop on routes, export named `Component`. `createBrowserRouter` for SPA. |
| shadcn/ui Sidebar | latest | `SidebarProvider` + `Sidebar` auto-handles mobile Sheet. `collapsible="offcanvas"` for mobile. Ctrl+B toggles. Install via `npx shadcn add sidebar`. |
| `@tanstack/react-query` | 5.90.x | `isPending` not `isLoading`. `gcTime` not `cacheTime`. Object syntax only. No `onSuccess` callbacks. |
| Tailwind CSS | 4.1.8 | CSS-first config. Container queries: `@container` + `@sm:`. Your `@theme` already configured. |
| Drizzle ORM | 0.45.x | `onConflictDoNothing()` for idempotent seeds. Wrap in `db.transaction()`. |
| Zustand | 5.0.x | `create<T>()(...)` double-invoke. Probably unnecessary if shadcn Sidebar manages its own state. |
| Vite | 6.3.5 | `VITE_` prefix for client env vars. `import.meta.env.VITE_*` access. |

### Scope Boundaries

**Explicitly IN scope:**
- React Router setup with lazy routes and role-based home redirect
- DashboardLayout with shadcn/ui Sidebar (crimson, role-specific nav, mobile sheet)
- Executive Dashboard page (hero metrics, attention items, compliance grid)
- Progressive drill-down pages (MDA Detail, Loan Detail with breadcrumbs)
- MDA Submission page (upload zone, history, comparison summary)
- Operations Hub page (migration grid, loan search, exception queue, quick actions)
- Placeholder pages for future features ("Coming in Sprint N")
- Build status indicator component
- Demo seed script (5 users, 63 MDAs)
- WIRING-MAP.md documentation
- Global search bar placeholder (non-functional)
- Responsive layout (mobile/tablet/desktop)

**Explicitly NOT in scope:**
- Actual file upload processing (Epic 5)
- Real API integration (wire sprints per WIRING-MAP.md)
- Chart components (FundPoolChart, MdaComparisonChart) — can add if time permits
- User management/admin (Story 1.9a/1.9b)
- Loans table creation (Epic 2)
- Email/notification system (Epic 9)
- PDF generation (Epic 6)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.8b: Role-Specific Screens, Demo Seed & Wiring Map]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.8a: Design Foundation (dependency)]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 1: Project Foundation & Secure Access]
- [Source: _bmad-output/planning-artifacts/epics.md#Sprint 1 Demonstrability Milestone]
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture — Component Organization]
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture — Routing Pattern]
- [Source: _bmad-output/planning-artifacts/architecture.md#RBAC Middleware — 3 Roles]
- [Source: _bmad-output/planning-artifacts/architecture.md#Mock-First Hook Pattern]
- [Source: _bmad-output/planning-artifacts/architecture.md#TanStack Query Key Convention]
- [Source: _bmad-output/planning-artifacts/architecture.md#Enforcement Rules — AI Agent Mandates]
- [Source: _bmad-output/planning-artifacts/architecture.md#Database Schema — users, mdas tables]
- [Source: _bmad-output/planning-artifacts/architecture.md#Seed Files — seed-demo.ts]
- [Source: _bmad-output/planning-artifacts/architecture.md#Environment Variables — VITE_*, DEMO_SEED_PASSWORD]
- [Source: _bmad-output/planning-artifacts/prd.md#FR32-FR36 Executive Dashboard]
- [Source: _bmad-output/planning-artifacts/prd.md#FR42-FR46 RBAC and Role Definitions]
- [Source: _bmad-output/planning-artifacts/prd.md#AG 30-Second Glance Scenario]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR-PERF Dashboard <3s on 4G]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#AG Executive Dashboard Layout]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#MDA Submission Flow]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Migration Dashboard]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Sidebar Navigation — Desktop + Mobile]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Colour System — Non-Punitive Palette]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Responsive Breakpoints]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Component Specifications A-N]
- [Source: _bmad-output/implementation-artifacts/1-8a-design-foundation-components-mock-data-layer.md]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
