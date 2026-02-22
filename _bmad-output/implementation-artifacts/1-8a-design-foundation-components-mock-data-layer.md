# Story 1.8a: Design Foundation, Priority Components & Mock Data Layer

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->
<!-- Generated: 2026-02-19 | Epic: 1 — Project Foundation & Secure Access | Sprint: 1 -->
<!-- Blocks: 1.8b (Role-Specific Screens, Demo Seed & Wiring Map) -->
<!-- Blocked By: 1.6 (Frontend Authentication Shell — auth store, API client, router, layout shell must exist) -->
<!-- FRs: FR32 (headline numbers), FR33 (attention items), FR36 (MDA compliance grid) | NFRs: NFR-PERF-2 (<500ms transitions), NFR-PERF-6 (<4s TTI), NFR-ACCESS-1 through 7 -->

## Story

As a **developer**,
I want the VLPRS design system, reusable components, and mock data service layer established as the foundational frontend pattern,
so that all subsequent screen stories can build on consistent design tokens, tested components, and a clean data abstraction that wires to real APIs with zero component changes.

## Acceptance Criteria (BDD)

### AC1: Design Foundation — Typography & Fonts

```gherkin
Given the React SPA with shadcn/ui + Tailwind CSS v4
When I inspect the application typography
Then Inter (variable) is loaded for all body text via @fontsource-variable/inter
And JetBrains Mono (variable) is loaded for financial figures via @fontsource-variable/jetbrains-mono
And the fonts are self-hosted (no external Google Fonts requests)
And hero metrics render at 36px bold with font-variant-numeric: tabular-nums
And minimum font size is 16px for body text
And the type scale follows: Hero 36px, H1 30px, H2 24px, H3 20px, H4/Body 16px, Body Small 14px, Caption 12px
```

### AC2: Design Foundation — Badge Variants & Button Hierarchy

```gherkin
Given the shadcn/ui component library
When I inspect the Badge component
Then the following custom variants are available:
  - review: gold background (#FDF8E8), dark gold text (#B8860B)
  - info: teal background (#E0F5F5), teal text (#0D7377)
  - complete: green-tinted background, green text (#16A34A)
  - pending: grey background (slate-100), grey text
  - variance: slate background + teal border, teal text
And each variant uses colour + text (never colour alone — WCAG 2.1 AA)

When I inspect the Button component
Then the hierarchy follows:
  - Primary (crimson #9C1E23) for main actions
  - Secondary (teal #0D7377 outline) for alternative actions
  - Tertiary (ghost) for low-emphasis actions
  - Destructive (red #DC2626) ONLY for delete/cancel — NEVER for data variances
And only one primary button is visible per screen context
```

### AC3: Design Foundation — Non-Punitive Semantic Tokens

```gherkin
Given the application styles
When I inspect the CSS custom properties
Then the following non-punitive design tokens are defined in globals.css:
  - --color-variance-bg: neutral grey for comparison panels
  - --color-variance-icon: teal (#0D7377) for info circle icons
  - --color-attention-bg: amber/gold (#FDF8E8) for attention item backgrounds
And crimson is used ONLY in UI chrome (sidebar, header, primary buttons)
And crimson is NEVER used in data content areas
And data content areas use only neutral colours (white, slate, grey, teal, gold)
```

### AC4: Priority Reusable Components

```gherkin
Given the component library at apps/client/src/components/shared/
When I inspect the shared UI components
Then the following 6 components are implemented and render correctly with mock data:

1. HeroMetricCard — large number display (36px bold, tabular-nums), label, trend indicator (↑↓→), count-up animation (200ms ease-out), click action for drill-down
   - Variants: currency (₦1,840,000,000), count (3,147), percentage (94.2%)
   - Trend indicator: ↑ green (#16A34A) for up, ↓ teal (#0D7377) for down, → grey (#64748B) for flat
   - States: loading (skeleton pulse), populated (count-up), hover (subtle lift shadow)

2. NairaDisplay — renders ₦ symbol + thousands separator + 2 decimal places using JetBrains Mono
   - Example: ₦2,418,350,000.00
   - Variants: hero (36px bold), body (16px regular), table (14px monospace), compact (no decimals for round numbers)
   - aria-label provides human-readable amount for screen readers

3. AttentionItemCard — amber/gold background (#FDF8E8), info icon (ℹ) in teal (NEVER warning triangle), description text, category badge (review/info/complete), timestamp
   - Click navigates to detail view
   - States: default, hover (background tint), new (3px teal left-border accent to indicate recently-appeared item)
   - Empty state: "No attention items — all systems normal" with green checkmark

4. FileUploadZone — drag-and-drop area accepting .csv files, drop instructions, file size limit display, template download link
   - States: default (dashed border, teal icon), dragover (teal tint, solid border), uploading (progress bar), success (green checkmark + filename), error (amber border + "Upload needs attention" — NEVER "Upload failed")
   - Mobile: tap-to-browse only (no drag-drop on touch devices)

5. MigrationProgressCard — MDA name + code, 6-stage progress indicator (Pending → Received → Imported → Validated → Reconciled → Certified), record counts per category, last activity timestamp
   - **Note:** UX spec defines 5 stages (no "Received"); epics define 6 stages (with "Received"). This story uses 6 stages per epics. Confirm with stakeholders if "Received" stage is needed for the actual migration workflow.
   - States: pending (grey), in-progress (teal), complete (green), blocked (gold attention)
   - Empty state: "No MDAs in migration pipeline" with neutral message

6. ExceptionQueueRow — priority indicator (High/Medium/Low), category badge, MDA name, description text, created timestamp, action placeholder
   - Priority uses colour + text + position (NEVER colour alone)
   - States: default, hover (subtle highlight), selected (teal left border), resolved (strikethrough + muted)
   - Empty state: "No exceptions — all issues resolved" with green checkmark

And each component has comprehensive unit tests
And each component supports prefers-reduced-motion: reduce (disables animations)
```

### AC5: Currency & Date Formatters

```gherkin
Given the utility library at apps/client/src/lib/formatters.ts
When I import the formatter functions
Then formatNaira(amount: string) returns "₦1,840,000.00" from string input "1840000.00"
And formatNaira handles edge cases: "0" → "₦0.00", negative values, null/undefined → "₦0.00"
And formatDate(isoString: string) returns "19-Feb-2026" (dd-MMM-yyyy format)
And formatDateTime(isoString: string) returns "19-Feb-2026, 02:30 PM"
And formatCompactNaira(amount: string) returns "₦1.84B" for billions, "₦126M" for millions
And all formatters are pure functions with unit tests
```

### AC6: Mock Data Service Layer

```gherkin
Given the frontend data layer
When components fetch data via custom hooks
Then all data flows through TanStack Query hook abstractions:
  - useDashboardMetrics() — 4 hero metrics + 4 secondary metrics
  - useMdaComplianceGrid() — 63 MDAs with submission statuses
  - useAttentionItems() — 3-5 mock attention items with non-punitive language
  - useMdaDetail(mdaId) — MDA summary with loan count, exposure, officer name
  - useLoanDetail(loanId) — single loan with borrower, balance, schedule placeholder
  - useLoanSearch(query) — returns 3 mock loan results
  - useSubmissionHistory(mdaId) — 3 mock past submissions with reference numbers
  - useMigrationStatus() — 63 MDAs with realistic stage distribution
  - useExceptionQueue() — 3-5 mock exceptions sorted by priority

And each hook uses TanStack Query's useQuery with a queryFn that returns mock data
And each hook's return type matches the planned API response shape
And each mock data file includes a header comment: target endpoint + wire sprint
And switching from mock to real API requires ONLY changing the queryFn — zero UI component changes
And mock data uses realistic Oyo State MDA names and Naira amounts at correct order of magnitude
```

### AC7: Shared TypeScript Types for Mock Data

```gherkin
Given the shared package at packages/shared/
When I inspect the type definitions
Then the following types are exported for mock data hooks:
  - DashboardMetrics: { activeLoans, totalExposure, fundAvailable, monthlyRecovery, ... }
  - MdaComplianceRow: { mdaId, mdaCode, mdaName, status, lastSubmission, recordCount, ... }
  - AttentionItem: { id, description, mdaName, category, timestamp, ... }
  - MdaSummary: { mdaId, name, code, officerName, loanCount, totalExposure, monthlyRecovery, ... }
  - LoanSummary: { loanId, borrowerName, staffId, mdaName, loanRef, principal, outstandingBalance, ... }
  - LoanSearchResult: { loanId, borrowerName, staffId, mdaName, outstandingBalance }
  - SubmissionRecord: { id, referenceNumber, submissionDate, recordCount, status, ... }
  - MigrationMdaStatus: { mdaId, mdaName, mdaCode, stage, recordCounts, lastActivity }
  - ExceptionItem: { id, priority, category, staffId, staffName, mdaName, description, createdAt }
And all financial amounts are typed as string (NEVER number — matches API contract for NUMERIC)
And all types are available via import from '@vlprs/shared'
```

### AC8: Tests

```gherkin
Given Story 1.8a is implemented
When I run pnpm test from the monorepo root
Then unit tests pass for:
  - All 6 priority components (render, variants, states, accessibility attributes)
  - NairaDisplay (formatting, variants, aria-label)
  - HeroMetricCard (count-up animation, skeleton loading, click handler, reduced motion)
  - AttentionItemCard (badge variants, non-punitive text verification)
  - FileUploadZone (drag events, file selection, error state text)
  - MigrationProgressCard (6 stages, progress indicator)
  - ExceptionQueueRow (priority ordering, category badges)
  - Formatter functions (formatNaira, formatDate, formatCompactNaira — edge cases)
  - All 9 mock data hooks (return correct shape, use TanStack Query)
And all existing tests from Stories 1.1-1.7 continue to pass
```

## Tasks / Subtasks

- [x] Task 1: Install new dependencies (AC: all)
  - [x] 1.1 Install runtime dependencies: `recharts` (^3.7.0), `date-fns` (^4.1.0), `@fontsource-variable/inter`, `@fontsource-variable/jetbrains-mono`
  - [x]1.2 Verify Story 1.6 dependencies exist. If any are missing, install them:
    ```bash
    pnpm --filter client add @tanstack/react-query zustand react-hook-form @hookform/resolvers react-google-recaptcha-v3 lucide-react
    ```
    Also verify shadcn/ui components are installed (card, skeleton, badge, dialog, sheet, separator, input, label, form, sonner). If missing: `npx shadcn@latest add card skeleton badge dialog sheet separator input label form sonner`
  - [x]1.3 Import fonts in `apps/client/src/main.tsx`: `import '@fontsource-variable/inter'` and `import '@fontsource-variable/jetbrains-mono'` — BEFORE any CSS imports
  - [x]1.4 Verify `pnpm typecheck` and `pnpm test` still pass after installs

- [x] Task 2: Extend design tokens in globals.css (AC: #1, #3)
  - [x]2.1 Add non-punitive semantic tokens to `apps/client/src/styles/globals.css` `@theme` block:
    ```css
    /* Non-punitive semantic tokens */
    --color-variance-bg: #F1F5F9;
    --color-variance-icon: #0D7377;
    --color-attention-bg: #FDF8E8;
    --color-attention-text: #92400E;

    /* Status colours (non-punitive) */
    --color-status-active: #0D7377;
    --color-status-complete: #16A34A;
    --color-status-pending: #6B7280;
    --color-status-review: #D4A017;
    --color-status-overdue: #D4A017;
    ```
  - [x]2.2 Add green-50 token if missing: `--color-green-50: #F0FDF4;`
  - [x]2.3 Verify existing font declarations in @theme are correct: `--font-sans: "Inter"...`, `--font-mono: "JetBrains Mono"...` (already present from Story 1.1)
  - [x]2.4 Ensure all interactive elements have 44x44px minimum touch target sizing. Add CSS utility if needed: button min-height 40px desktop / 48px mobile, card click areas 44x44px minimum. (NFR-ACCESS-4)

- [x] Task 3: Extend Badge component with custom variants (AC: #2)
  - [x]3.1 Add shadcn/ui Badge if not already added: `npx shadcn@latest add badge`
  - [x]3.2 Modify `apps/client/src/components/ui/badge.tsx` — add CVA variants:
    - `review`: `border-transparent bg-gold-50 text-gold-dark` (gold)
    - `info`: `border-transparent bg-teal-50 text-teal` (teal)
    - `complete`: `border-transparent bg-green-50 text-success` (green)
    - `pending`: `border-transparent bg-slate-100 text-text-secondary` (grey)
    - `variance`: `border-teal/30 bg-variance-bg text-teal` (grey bg + teal)
  - [x]3.3 Verify badge colour hex values against canonical UX mockup (`ux-design-directions.html`) before finalizing. If discrepancy, use mockup as truth.
  - [x]3.4 Create `apps/client/src/components/ui/badge.test.tsx` — test all variants render with correct classes

- [x] Task 4: Create currency & date formatters (AC: #5)
  - [x]4.1 Create `apps/client/src/lib/formatters.ts`:
    - `formatNaira(amount: string | null | undefined): string` — "₦1,840,000.00"
    - `formatCompactNaira(amount: string): string` — "₦1.84B" / "₦126M" / "₦48.3K"
    - `formatDate(isoString: string): string` — "19-Feb-2026" using `date-fns` `format(parseISO(s), 'dd-MMM-yyyy')`
    - `formatDateTime(isoString: string): string` — "19-Feb-2026, 02:30 PM"
    - `formatCount(n: number): string` — "3,147" with thousands separator
  - [x]4.2 All financial amount params are `string` (never `number`) — matches API contract where NUMERIC comes as string
  - [x]4.3 Create `apps/client/src/lib/formatters.test.ts` — comprehensive edge case tests:
    - "0" → "₦0.00", "1840000.00" → "₦1,840,000.00", "-500.50" → "-₦500.50"
    - null/undefined → "₦0.00"
    - Compact: "2418350000" → "₦2.42B", "892000000" → "₦892M", "48250000" → "₦48.3M"
    - Date: valid ISO → correct format, invalid → graceful fallback

- [x] Task 5: Create NairaDisplay component (AC: #4)
  - [x]5.1 Create `apps/client/src/components/shared/NairaDisplay.tsx`:
    - Props: `amount: string`, `variant?: 'hero' | 'body' | 'table' | 'compact'`
    - Uses `formatNaira` from formatters.ts
    - Applies JetBrains Mono via `font-mono` Tailwind class
    - `font-variant-numeric: tabular-nums` for column alignment
    - `aria-label` provides human-readable amount (e.g., "Two million four hundred eighteen thousand Naira")
  - [x]5.2 Variant styles:
    - `hero`: 36px bold (`text-4xl font-bold`)
    - `body`: 16px regular (`text-base`)
    - `table`: 14px monospace (`text-sm`)
    - `compact`: 14px, no decimal places for round numbers
  - [x]5.3 Create `apps/client/src/components/shared/NairaDisplay.test.tsx`

- [x] Task 6: Create HeroMetricCard component (AC: #4)
  - [x]6.1 Create `apps/client/src/components/shared/HeroMetricCard.tsx`:
    - Props: `label: string`, `value: string | number`, `format: 'currency' | 'count' | 'percentage'`, `trend?: { direction: 'up' | 'down' | 'flat'; label: string }`, `onClick?: () => void`, `isLoading?: boolean`
    - Uses `NairaDisplay` for currency format, `formatCount` for count format
    - Count-up animation: 200ms ease-out from 0 to value on mount (uses `useEffect` + `requestAnimationFrame`)
    - Skeleton pulse loading state (shadcn/ui Skeleton)
    - Hover: subtle lift shadow (`shadow-md` on hover)
    - Click: `role="link"` with `aria-label` describing action (e.g., "Active Loans: 3,147. Click to view breakdown")
    - `prefers-reduced-motion: reduce` → skip count-up, show final value immediately
  - [x]6.2 Trend indicator: ↑ green for up, ↓ teal for down, → grey for flat (subtle, not prominent)
  - [x]6.3 Responsive: full-width on mobile, 4-column grid on desktop (`grid-cols-1 md:grid-cols-2 xl:grid-cols-4`)
  - [x]6.4 Create `apps/client/src/components/shared/HeroMetricCard.test.tsx` — test count-up, skeleton, click, reduced motion, all format variants

- [x] Task 7: Create AttentionItemCard component (AC: #4)
  - [x]7.1 Create `apps/client/src/components/shared/AttentionItemCard.tsx`:
    - Props: `description: string`, `mdaName: string`, `category: 'review' | 'info' | 'complete'`, `timestamp: string`, `onClick?: () => void`
    - Background: `bg-attention-bg` (#FDF8E8 amber/gold)
    - Icon: Info circle (ℹ) from lucide-react in teal — **NEVER** warning triangle
    - Category badge uses Badge component with matching variant
    - Formatted timestamp via `formatDateTime`
  - [x]7.2 "New" state: render 3px teal left-border accent when `isNew` prop is true
  - [x]7.3 Empty state component: "No attention items — all systems normal" with green checkmark icon
  - [x]7.4 Responsive: full-width list on mobile and tablet; right panel alongside metrics on desktop (lg:)
  - [x]7.5 Create `apps/client/src/components/shared/AttentionItemCard.test.tsx` — verify no warning icons, non-punitive language, badge variants, "new" state border, empty state

- [x] Task 8: Create FileUploadZone component (AC: #4)
  - [x]8.1 Create `apps/client/src/components/shared/FileUploadZone.tsx`:
    - Props: `accept?: string` (default ".csv"), `maxSizeMb?: number` (default 5), `onFileSelect: (file: File) => void`, `onFileRemove?: () => void`, `templateDownloadUrl?: string`, `status?: 'idle' | 'dragover' | 'uploading' | 'success' | 'error'`, `fileName?: string`, `errorMessage?: string`, `progress?: number`
    - Drag-and-drop with `onDragOver`, `onDragLeave`, `onDrop` handlers
    - Click-to-browse via hidden `<input type="file">`
    - States: idle (dashed border, teal upload icon), dragover (teal bg tint, solid border), success (green check + filename), error (amber border + "Upload needs attention")
    - **Error text MUST say "Upload needs attention"** — NEVER "Upload failed" or "Error"
    - Mobile: hide drag-drop hint, show "Tap to browse" instead
    - Template download link visible when `templateDownloadUrl` is provided
  - [x]8.2 Responsive: full-width on mobile, full-width with drag-drop on tablet, centred 600px max-width on desktop (lg:max-w-[600px] lg:mx-auto)
  - [x]8.3 `aria-label="Upload CSV file. Drag and drop or click to browse."` on drop zone
  - [x]8.4 Create `apps/client/src/components/shared/FileUploadZone.test.tsx` — test drag events, file selection, error state text verification ("Upload needs attention" not "failed")

- [x] Task 9: Create MigrationProgressCard component (AC: #4)
  - [x]9.1 Create `apps/client/src/components/shared/MigrationProgressCard.tsx`:
    - Props: `mdaName: string`, `mdaCode: string`, `stage: MigrationStage`, `recordCounts?: { clean: number; minor: number; significant: number; structural: number }`, `lastActivity?: string`, `onClick?: () => void`
    - 6 stages: Pending → Received → Imported → Validated → Reconciled → Certified
    - Visual progress: dots/steps with colour (grey=incomplete, teal=current, green=done)
    - Stage label described as "Stage 3 of 6: Validated" with `aria-valuenow` and `aria-valuemax`
    - Record count category badges if provided
    - Last activity timestamp via `formatDateTime`
  - [x]9.2 Empty state: "No MDAs in migration pipeline" neutral message
  - [x]9.3 Responsive: card view on mobile, table row view on desktop (lg:)
  - [x]9.4 Create `apps/client/src/components/shared/MigrationProgressCard.test.tsx`

- [x] Task 10: Create ExceptionQueueRow component (AC: #4)
  - [x]10.1 Create `apps/client/src/components/shared/ExceptionQueueRow.tsx`:
    - Props: `priority: 'high' | 'medium' | 'low'`, `category: string`, `staffId?: string`, `staffName?: string`, `mdaName: string`, `description: string`, `createdAt: string`, `status?: 'open' | 'resolved'`, `onClick?: () => void`
    - Priority indicator: High (danger border-left), Medium (gold border-left), Low (teal border-left)
    - Uses colour + text + position for priority (NEVER colour alone)
    - Category badge (uses Badge component)
    - Resolved state: strikethrough text + muted opacity
    - Hover: subtle background highlight
    - Selected: teal left border (2px)
  - [x]10.2 Empty state: "No exceptions — all issues resolved" with green checkmark
  - [x]10.3 Responsive: full table row on desktop; on mobile, horizontal scroll or compact card collapse
  - [x]10.4 Create `apps/client/src/components/shared/ExceptionQueueRow.test.tsx`

- [x] Task 11: Add shared TypeScript types for mock data (AC: #7)
  - [x]11.1 Create `packages/shared/src/types/dashboard.ts`:
    ```typescript
    export interface DashboardMetrics {
      activeLoans: number;
      totalExposure: string;    // NUMERIC as string
      fundAvailable: string;
      monthlyRecovery: string;
      pendingEarlyExits: number;
      earlyExitRecoveryAmount: string;
      gratuityReceivableExposure: string;
      staffIdCoverage: { covered: number; total: number };
    }

    export interface AttentionItem {
      id: string;
      description: string;
      mdaName: string;
      category: 'review' | 'info' | 'complete';
      timestamp: string;
    }
    ```
  - [x]11.2 Create `packages/shared/src/types/mda.ts`:
    ```typescript
    export type SubmissionStatus = 'submitted' | 'pending' | 'overdue';
    export type MigrationStage = 'pending' | 'received' | 'imported' | 'validated' | 'reconciled' | 'certified';

    export interface MdaComplianceRow {
      mdaId: string;
      mdaCode: string;
      mdaName: string;
      status: SubmissionStatus;
      lastSubmission: string | null;
      recordCount: number;
      alignedCount: number;
      varianceCount: number;
    }

    export interface MdaSummary {
      mdaId: string;
      name: string;
      code: string;
      officerName: string;
      loanCount: number;
      totalExposure: string;
      monthlyRecovery: string;
      submissionHistory: SubmissionRecord[];
    }

    export interface MigrationMdaStatus {
      mdaId: string;
      mdaName: string;
      mdaCode: string;
      stage: MigrationStage;
      recordCounts: { clean: number; minor: number; significant: number; structural: number };
      lastActivity: string | null;
    }
    ```
  - [x]11.3 Create `packages/shared/src/types/loan.ts`:
    ```typescript
    export type LoanStatus = 'active' | 'completed' | 'applied' | 'defaulted';

    export interface LoanSummary {
      loanId: string;
      borrowerName: string;
      staffId: string | null;
      mdaName: string;
      loanRef: string;
      gradeLevelTier: number;
      principal: string;
      outstandingBalance: string;
      installmentsPaid: number;
      installmentsRemaining: number;
      lastDeductionDate: string | null;
      status: LoanStatus;
      retirementDate: string | null;
    }

    export interface LoanSearchResult {
      loanId: string;
      borrowerName: string;
      staffId: string | null;
      mdaName: string;
      loanRef: string;
      outstandingBalance: string;
    }
    ```
  - [x]11.4 Create `packages/shared/src/types/submission.ts`:
    ```typescript
    export interface SubmissionRecord {
      id: string;
      referenceNumber: string;
      submissionDate: string;
      recordCount: number;
      alignedCount: number;
      varianceCount: number;
      status: 'confirmed' | 'processing' | 'rejected';
    }
    ```
  - [x]11.5 Create `packages/shared/src/types/exception.ts`:
    ```typescript
    export type ExceptionPriority = 'high' | 'medium' | 'low';
    export type ExceptionCategory = 'over_deduction' | 'under_deduction' | 'inactive' | 'data_mismatch' | 'post_retirement' | 'duplicate_staff_id';

    export interface ExceptionItem {
      id: string;
      priority: ExceptionPriority;
      category: ExceptionCategory;
      staffId: string | null;
      staffName: string;
      mdaName: string;
      description: string;
      createdAt: string;
      status: 'open' | 'resolved';
      resolvedAt: string | null;
    }
    ```
  - [x]11.6 Extend `packages/shared/src/constants/vocabulary.ts` with UI copy constants:
    ```typescript
    export const UI_COPY = {
      UPLOAD_ERROR_HEADER: 'Upload needs attention',
      UPLOAD_SUCCESS_HEADER: 'Upload Complete',
      COMPARISON_COMPLETE: 'Comparison Complete',
      VARIANCE_LABEL: 'Variance',
      ATTENTION_LABEL: 'Review',
      EMPTY_ATTENTION: 'No attention items — all systems normal',
      EMPTY_EXCEPTIONS: 'No exceptions — all issues resolved',
      EMPTY_MIGRATION: 'No MDAs in migration pipeline',
    } as const;
    ```
  - [x]11.7 Export all new types and `UI_COPY` from `packages/shared/src/index.ts`
  - [x]11.8 Run `pnpm --filter shared build` to verify types compile

- [x] Task 12: Create mock data files (AC: #6)
  - [x]12.1 Create `apps/client/src/mocks/dashboardMetrics.ts`:
    ```typescript
    // Target: GET /api/dashboard/metrics
    // Wire: Sprint 5 (Epic 4: Executive Dashboard)
    import type { DashboardMetrics } from '@vlprs/shared';
    export const MOCK_DASHBOARD_METRICS: DashboardMetrics = { ... };
    ```
    Values: activeLoans 2847, totalExposure "2418350000.00", fundAvailable "892000000.00", monthlyRecovery "48250000.00"
  - [x]12.2 Create `apps/client/src/mocks/mdaComplianceGrid.ts` — 63 real Oyo State MDA names with realistic status distribution (45 submitted, 10 pending, 8 overdue)
    ```typescript
    // Target: GET /api/dashboard/compliance
    // Wire: Sprint 5 (Epic 4: Executive Dashboard)
    ```
  - [x]12.3 Create `apps/client/src/mocks/attentionItems.ts` — 5 items with non-punitive language:
    - "Ministry of Works — submission pending, 3 days past due"
    - "Ministry of Agriculture — variance identified in February submission"
    - "2 loans approaching zero balance — auto-stop certificates pending"
    - "Ministry of Health — 3 staff approaching retirement within 12 months"
    - "Staff ID coverage at 90.9% — 283 records pending"
    ```typescript
    // Target: GET /api/dashboard/attention
    // Wire: Sprint 5 (Epic 4: Executive Dashboard)
    ```
  - [x]12.4 Create `apps/client/src/mocks/mdaDetail.ts` — 3 detailed MDAs (Health, Education, Works) with officer names, loan counts, exposure
    ```typescript
    // Target: GET /api/mdas/:id/summary
    // Wire: Sprint 5 (Epic 4: Executive Dashboard)
    ```
  - [x]12.5 Create `apps/client/src/mocks/loanDetail.ts` — 5 mock loans across the 3 MDAs with realistic Naira amounts (₦500K-₦5M range), grade level tiers (1-4), status distribution
    ```typescript
    // Target: GET /api/loans/:id
    // Wire: Sprint 2 (Epic 2: Loan Data Management)
    ```
  - [x]12.6 Create `apps/client/src/mocks/loanSearch.ts` — 3 search results
    ```typescript
    // Target: GET /api/loans/search
    // Wire: Sprint 2 (Epic 2: Loan Data Management)
    ```
  - [x]12.7 Create `apps/client/src/mocks/submissionHistory.ts` — 3 past submissions per MDA with reference numbers (format: "HLT-2026-01-0001")
    ```typescript
    // Target: GET /api/submissions?mdaId=
    // Wire: Sprint 7 (Epic 5: MDA Monthly Submission)
    ```
  - [x]12.8 Create `apps/client/src/mocks/migrationStatus.ts` — all 63 MDAs with realistic stage distribution (8 Certified, 15 Validated, 20 Imported, 10 Received, 7 Pending, 3 Reconciled)
    ```typescript
    // Target: GET /api/migration/status
    // Wire: Sprint 4 (Epic 3: Data Migration)
    ```
  - [x]12.9 Create `apps/client/src/mocks/exceptionQueue.ts` — 5 exceptions sorted by priority with categories
    ```typescript
    // Target: GET /api/exceptions
    // Wire: Sprint 9 (Epic 7: Exception Management)
    ```
  - [x]12.10 Create `apps/client/src/mocks/oyoMdas.ts` — complete list of 63 Oyo State MDA names and codes (used across multiple mock files)

- [x] Task 13: Create TanStack Query data hooks (AC: #6)
  - [x]13.1 Create `apps/client/src/hooks/useDashboardData.ts`:
    ```typescript
    import { useQuery } from '@tanstack/react-query';
    import { MOCK_DASHBOARD_METRICS } from '@/mocks/dashboardMetrics';
    import type { DashboardMetrics } from '@vlprs/shared';

    export function useDashboardMetrics() {
      return useQuery<DashboardMetrics>({
        queryKey: ['dashboard', 'metrics'],
        queryFn: async () => MOCK_DASHBOARD_METRICS,
        staleTime: 30_000,
      });
    }
    ```
  - [x]13.2 Create `apps/client/src/hooks/useMdaData.ts` — `useMdaComplianceGrid()`, `useMdaDetail(mdaId)`
  - [x]13.3 Create `apps/client/src/hooks/useAttentionItems.ts` — `useAttentionItems()`
  - [x]13.4 Create `apps/client/src/hooks/useLoanData.ts` — `useLoanDetail(loanId)`, `useLoanSearch(query)`
  - [x]13.5 Create `apps/client/src/hooks/useSubmissionData.ts` — `useSubmissionHistory(mdaId)`
  - [x]13.6 Create `apps/client/src/hooks/useMigrationData.ts` — `useMigrationStatus()`
  - [x]13.7 Create `apps/client/src/hooks/useExceptionData.ts` — `useExceptionQueue()`
  - [x]13.8 Each hook:
    - Returns `useQuery` result with correct TypeScript type
    - Uses `queryKey` array with domain prefix (e.g., `['dashboard', 'metrics']`, `['mda', mdaId]`)
    - `queryFn` returns mock data (swap to `apiClient.get(...)` in wire sprint)
    - Has JSDoc comment with target endpoint and wire sprint
    - staleTime strategy: `30_000` (30s) for frequently-changing dashboard hooks, `Infinity` for static lookups (MDA list). Window focus refetch uses TanStack Query default (enabled).
  - [x]13.9 Create `apps/client/src/hooks/useDashboardData.test.ts` — verify hook returns correct shape via `renderHook` from `@testing-library/react` (with QueryClientProvider wrapper)
  - [x]13.10 Create similar test files for each hook (at minimum, verify return type matches expected interface)

- [x] Task 14: Verify all tests pass (AC: #8)
  - [x]14.1 Run `pnpm --filter shared build` — types compile
  - [x]14.2 Run `pnpm test` from monorepo root — all workspaces pass
  - [x]14.3 Run `pnpm typecheck` — no type errors
  - [x]14.4 Run `pnpm lint` — no lint errors
  - [x]14.5 Verify component count: 6 shared components + Badge extension + formatters = all tested
  - [x]14.6 Verify axe-core accessibility: 0 violations on all component test renders (install `vitest-axe` or `jest-axe` if not already available). Verify all `aria-label` attributes present on interactive components.
  - [x]14.7 Verify no `AlertTriangle` or `AlertCircle` imports from lucide-react in any component — only `Info` icon allowed for data-context icons

### Review Follow-ups (AI)

- [x] [AI-Review][HIGH] H1: `loanDetail.ts` mock has only 3 loans, not 5 as specified in Task 12.5. `loan-004` and `loan-005` missing — `useLoanDetail` throws for those IDs [apps/client/src/mocks/loanDetail.ts]
- [x] [AI-Review][MEDIUM] M1: FileUploadZone `dragover` visual state unreachable — `status` is controlled prop but no drag callbacks exposed and no internal state management [apps/client/src/components/shared/FileUploadZone.tsx:32-45]
- [x] [AI-Review][MEDIUM] M2: Submission reference number format doesn't match spec — uses "MOF-2026-02" instead of "MOF-2026-02-0001" [apps/client/src/mocks/submissionHistory.ts]
- [x] [AI-Review][MEDIUM] M3: submissionHistory for mda-001 has 2 records and mda-002 has only 1 record, should be 3 each per Task 12.7 [apps/client/src/mocks/submissionHistory.ts]
- [x] [AI-Review][MEDIUM] M4: Migration stage distribution uses formula giving ~equal distribution instead of spec's "8 Certified, 15 Validated, 20 Imported, 10 Received, 7 Pending, 3 Reconciled" [apps/client/src/mocks/migrationStatus.ts:9]
- [x] [AI-Review][MEDIUM] M5: Components hardcode text instead of using UI_COPY constants from @vlprs/shared — dual-maintenance risk [FileUploadZone.tsx:113, AttentionItemCard.tsx:66, ExceptionQueueRow.tsx:93, MigrationProgressCard.tsx:117]
- [x] [AI-Review][LOW] L1: package.json and pnpm-lock.yaml not documented in story File List [Dev Agent Record]
- [x] [AI-Review][LOW] L2: Unrelated planning artifacts modified in git (`architecture.md`, `wireframes-epic-14.md`) — outside story scope
- [x] [AI-Review][LOW] L3: ExceptionQueueRow uses `destructive` badge variant (red) for High priority — conflicts with non-punitive design principle [apps/client/src/components/shared/ExceptionQueueRow.tsx:7]

## Dev Notes

### Critical Context — What This Story Establishes

This is **Story 8a of 58** — the **design system and data abstraction foundation**. Every screen in Epics 2-13 consumes the components, types, and hooks established here. Story 1.8b (next) builds role-specific screens on top of this foundation.

**VLPRS is a government financial system for the Oyo State Accountant General's Office.** The AG's primary usage pattern is checking dashboard metrics on her phone during 30-second glances. The design must feel like a **modern fintech dashboard**, not a legacy government form.

**What this story produces:**

| Component | Purpose | Consumed By |
|---|---|---|
| `HeroMetricCard` | Dashboard headline number display | Executive Dashboard (1.8b), Epic 4 |
| `NairaDisplay` | Consistent Naira formatting | Every page showing money |
| `AttentionItemCard` | Non-punitive attention items | Executive Dashboard (1.8b), Epic 4 |
| `FileUploadZone` | CSV drag-drop upload | MDA Submission (1.8b), Epic 5 |
| `MigrationProgressCard` | MDA migration tracking | Operations Hub (1.8b), Epic 3 |
| `ExceptionQueueRow` | Exception queue display | Operations Hub (1.8b), Epic 7 |
| `Badge` (extended) | Status badges with non-punitive variants | Every list/table in the system |
| `formatters.ts` | Currency + date formatting | Every component showing money/dates |
| 9 data hooks | Mock-first data abstraction | Every screen, wired to real APIs later |
| Shared types | TypeScript contracts for all data | Frontend + backend (API contracts) |

**What previous stories created that this story builds on:**

| Component | Location | What Was Created | Story |
|---|---|---|---|
| `globals.css` @theme | `apps/client/src/styles/globals.css` | Oyo Crimson palette, teal, gold, surface colours, font declarations, spacing | 1.1 |
| `Button` component | `apps/client/src/components/ui/Button.tsx` | CVA variants (default/crimson, secondary/teal, outline, ghost, destructive) | 1.1 |
| `cn()` utility | `apps/client/src/lib/utils.ts` | clsx + tailwind-merge | 1.1 |
| `components.json` | `apps/client/components.json` | shadcn/ui config with `@` aliases, slate base colour | 1.1 |
| Shared types | `packages/shared/src/types/` | `User`, `ApiResponse<T>`, `ApiError`, `LoginRequest`, etc. | 1.1-1.2 |
| Shared constants | `packages/shared/src/constants/` | `ROLES`, `VOCABULARY` | 1.2-1.3 |
| Vite config | `apps/client/vite.config.ts` | `@` alias, port 5173, jsdom test env | 1.1 |
| TanStack Query setup | `apps/client/src/lib/queryClient.ts` | QueryClient with staleTime: 5min | 1.6 |
| Zustand auth store | `apps/client/src/stores/authStore.ts` | accessToken, user, setAuth, clearAuth | 1.6 |
| API client | `apps/client/src/lib/apiClient.ts` | Typed fetch wrapper with JWT + refresh | 1.6 |
| DashboardLayout | `apps/client/src/components/layout/` | Sidebar, MobileHeader, AuthGuard, Breadcrumb | 1.6 |
| Router | `apps/client/src/router.tsx` | Public/protected route groups, lazy loading | 1.6 |
| shadcn/ui components | `apps/client/src/components/ui/` | input, label, card, badge, sheet, dialog, separator, skeleton, sonner, form | 1.6 |

### What NOT To Do

1. **DO NOT use floating-point numbers for financial amounts** — All Naira amounts are `string` type in TypeScript (matches `NUMERIC(15,2)` in PostgreSQL). Use `formatNaira()` for display. Computation happens server-side with `decimal.js`.
2. **DO NOT use warning triangles (⚠) for variance/attention items** — ALWAYS use info circle (ℹ) from lucide-react in teal. The UX spec explicitly bans warning triangles for data variances.
3. **DO NOT use red (#DC2626) for data variances or attention items** — Red is reserved EXCLUSIVELY for destructive actions (delete, cancel). Use gold (#D4A017) for attention, teal (#0D7377) for info, grey (#6B7280) for variance backgrounds.
4. **DO NOT use crimson (#9C1E23) in data content areas** — Crimson lives ONLY in UI chrome (sidebar, header, primary buttons). Data content uses neutral colours.
5. **DO NOT store mock data in Zustand** — Mock data flows through TanStack Query hooks. Zustand is ONLY for ephemeral UI state (sidebar toggle, filter selections).
6. **DO NOT create screen layouts or page compositions** — That's Story 1.8b. This story creates ONLY reusable components, formatters, mock data, hooks, and types.
7. **DO NOT create the demo seed script or WIRING-MAP.md** — That's Story 1.8b.
8. **DO NOT create chart components (FundPoolChart, MdaComparisonChart)** — Those are page-specific to the Executive Dashboard and Operations Hub (Story 1.8b or later epics). Install `recharts` but don't build charts yet.
9. **DO NOT modify the router, layout, or any page components** — This story only adds new shared components and hooks.
10. **DO NOT create a separate `__tests__` directory** — Tests are co-located next to source files.
11. **DO NOT import from `date-fns/format`** — Import from `date-fns` top-level. Vite tree-shakes correctly: `import { format, parseISO } from 'date-fns'`.
12. **DO NOT use `@fontsource/inter` (non-variable)** — Use `@fontsource-variable/inter` for variable font support (single file for all weights).
13. **DO NOT create the Oyo State MDA list from memory** — Research actual Oyo State MDA names. If uncertain, use plausible Nigerian government ministry names and note them for client review.
14. **DO NOT use `isLoading`** from TanStack Query v5 — Use `isPending` (v5 renamed `isLoading` → `isPending` for the "no data yet" state).

### Component Location Strategy

```
apps/client/src/components/
├── ui/                           # shadcn/ui auto-generated (DO NOT manually create)
│   ├── Button.tsx                # EXISTING (Story 1.1)
│   ├── badge.tsx                 # MODIFY — add custom variants
│   ├── card.tsx                  # EXISTING or NEW via shadcn add
│   ├── skeleton.tsx              # EXISTING or NEW via shadcn add
│   └── ...
│
├── shared/                       # NEW — reusable across pages
│   ├── HeroMetricCard.tsx        # NEW
│   ├── HeroMetricCard.test.tsx   # NEW
│   ├── NairaDisplay.tsx          # NEW
│   ├── NairaDisplay.test.tsx     # NEW
│   ├── AttentionItemCard.tsx     # NEW
│   ├── AttentionItemCard.test.tsx # NEW
│   ├── FileUploadZone.tsx        # NEW
│   ├── FileUploadZone.test.tsx   # NEW
│   ├── MigrationProgressCard.tsx # NEW
│   ├── MigrationProgressCard.test.tsx # NEW
│   ├── ExceptionQueueRow.tsx     # NEW
│   └── ExceptionQueueRow.test.tsx # NEW
│
└── layout/                       # EXISTING (Story 1.6) — DO NOT MODIFY
    ├── AuthGuard.tsx
    ├── DashboardLayout.tsx
    ├── Sidebar.tsx
    └── ...
```

**Why `components/shared/` not `components/ui/`?**

The `ui/` directory is reserved for shadcn/ui auto-generated components (managed by `npx shadcn@latest add`). Custom VLPRS business components go in `shared/` to keep them separate and avoid merge conflicts when adding new shadcn components.

### Data Hooks Location Strategy

```
apps/client/src/hooks/
├── useSessionTimeout.ts          # EXISTING (Story 1.6) — DO NOT MODIFY
├── useDashboardData.ts           # NEW — useDashboardMetrics()
├── useDashboardData.test.ts      # NEW
├── useMdaData.ts                 # NEW — useMdaComplianceGrid(), useMdaDetail()
├── useMdaData.test.ts            # NEW
├── useAttentionItems.ts          # NEW — useAttentionItems()
├── useAttentionItems.test.ts     # NEW
├── useLoanData.ts                # NEW — useLoanDetail(), useLoanSearch()
├── useLoanData.test.ts           # NEW
├── useSubmissionData.ts          # NEW — useSubmissionHistory()
├── useSubmissionData.test.ts     # NEW
├── useMigrationData.ts           # NEW — useMigrationStatus()
├── useMigrationData.test.ts      # NEW
├── useExceptionData.ts           # NEW — useExceptionQueue()
└── useExceptionData.test.ts      # NEW
```

### Mock Data Hook Pattern — The Wiring Contract

Every hook follows this exact pattern. The **only change when wiring to real API** is the `queryFn`:

```typescript
// apps/client/src/hooks/useDashboardData.ts

import { useQuery } from '@tanstack/react-query';
import type { DashboardMetrics } from '@vlprs/shared';
import { MOCK_DASHBOARD_METRICS } from '@/mocks/dashboardMetrics';
// import { apiClient } from '@/lib/apiClient'; // Uncomment when wiring

/**
 * Fetches dashboard hero metrics.
 * @target GET /api/dashboard/metrics
 * @wire Sprint 5 (Epic 4: Executive Dashboard)
 */
export function useDashboardMetrics() {
  return useQuery<DashboardMetrics>({
    queryKey: ['dashboard', 'metrics'],
    queryFn: async () => {
      // MOCK: Replace with real API call in Sprint 5
      return MOCK_DASHBOARD_METRICS;

      // WIRE: Uncomment below when API is ready
      // return apiClient<DashboardMetrics>('/dashboard/metrics');
    },
    staleTime: 30_000, // 30 seconds for dashboard
  });
}
```

**Consumer components NEVER change when wiring:**

```tsx
// This component works identically with mock or real data
function DashboardHero() {
  const { data, isPending } = useDashboardMetrics();

  if (isPending) return <HeroMetricCardSkeleton />;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      <HeroMetricCard
        label="Active Loans"
        value={data.activeLoans}
        format="count"
      />
      <HeroMetricCard
        label="Total Exposure"
        value={data.totalExposure}
        format="currency"
      />
      {/* ... */}
    </div>
  );
}
```

### Testing TanStack Query Hooks

Hooks that use `useQuery` need a `QueryClientProvider` wrapper in tests:

```typescript
// apps/client/src/hooks/useDashboardData.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDashboardMetrics } from './useDashboardData';
import type { ReactNode } from 'react';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

describe('useDashboardMetrics', () => {
  it('returns mock dashboard metrics', async () => {
    const { result } = renderHook(() => useDashboardMetrics(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeDefined();
    expect(result.current.data!.activeLoans).toBe(2847);
    expect(typeof result.current.data!.totalExposure).toBe('string');
  });
});
```

### Count-Up Animation Pattern

```typescript
// apps/client/src/components/shared/HeroMetricCard.tsx
import { useEffect, useRef, useState } from 'react';

function useCountUp(target: number, duration = 200) {
  const [current, setCurrent] = useState(0);
  const prefersReducedMotion = useRef(
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    if (prefersReducedMotion.current) {
      setCurrent(target);
      return;
    }

    const start = performance.now();
    let rafId: number;

    function animate(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out: 1 - (1 - t)^3
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(target * eased));

      if (progress < 1) {
        rafId = requestAnimationFrame(animate);
      }
    }

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [target, duration]);

  return current;
}
```

### NairaDisplay — Aria Label Pattern

For screen reader accessibility, NairaDisplay should provide a human-readable `aria-label`:

```typescript
function numberToWords(amount: string): string {
  // Simple approach: use the formatted string in aria-label
  // Full number-to-words is over-engineering for MVP
  return `${formatNaira(amount)} Naira`;
}

// Usage:
<span
  className="font-mono tabular-nums"
  aria-label={numberToWords(amount)}
>
  {formatNaira(amount)}
</span>
```

**Simplified approach for MVP:** `aria-label="₦2,418,350,000.00"` — screen readers can parse the formatted number. Full "two billion four hundred..." conversion is over-engineering.

### Realistic Oyo State MDA Names

Use these actual Oyo State government MDAs for mock data (63 total needed):

**Core Ministries (sample):**
- Ministry of Finance
- Ministry of Education
- Ministry of Health
- Ministry of Works and Transport
- Ministry of Agriculture and Rural Development
- Ministry of Justice
- Ministry of Trade, Industry, Investment and Cooperatives
- Ministry of Information, Culture and Tourism
- Ministry of Environment
- Ministry of Women Affairs, Community Development and Social Welfare
- Ministry of Lands, Housing and Urban Development
- Ministry of Local Government and Chieftaincy Affairs
- Ministry of Budget and Economic Planning
- Ministry of Establishments and Training

**Agencies/Departments (sample):**
- Office of the Head of Service
- Bureau of Physical Planning and Development Control
- Oyo State Internal Revenue Service
- Oyo State Universal Basic Education Board
- Teaching Service Commission
- State Hospital Management Board
- Judicial Service Commission
- Civil Service Commission
- Local Government Service Commission

**Note:** Create a complete list of 63 in `apps/client/src/mocks/oyoMdas.ts`. If uncertain about specific names, use plausible variations and note them for client review in Story 1.8b.

### Financial Amount Magnitudes for Mock Data

Oyo State vehicle loan scheme realistic ranges:

| Metric | Mock Value | Rationale |
|---|---|---|
| Active Loans | 2,847 | ~45 per MDA average across 63 MDAs |
| Total Exposure | ₦2,418,350,000 | ~₦850K average per loan |
| Fund Available | ₦892,000,000 | ~37% of exposure as available funds |
| Monthly Recovery | ₦48,250,000 | ~2% of exposure per month |
| Individual Loan Range | ₦500,000 — ₦5,000,000 | 4 grade level tiers |
| Grade Level 1 (Junior) | ₦500,000 — ₦800,000 | Entry level |
| Grade Level 2 | ₦800,000 — ₦1,500,000 | Mid level |
| Grade Level 3 | ₦1,500,000 — ₦3,000,000 | Senior level |
| Grade Level 4 (Director) | ₦3,000,000 — ₦5,000,000 | Director level |

### Architecture Compliance

**Data Flow Pattern:**

```
Mock Data Files (src/mocks/)
  ↓
TanStack Query Hooks (src/hooks/)
  ↓ useQuery({ queryFn: () => mockData })
React Components (src/components/shared/)
  ↓ use typed props
Formatted Display (formatters.ts)

--- Sprint 5+ wire (change queryFn only) ---

API Client (src/lib/apiClient.ts)
  ↓ fetch('/api/dashboard/metrics')
TanStack Query Hooks (same hooks, same queryKey)
  ↓ useQuery({ queryFn: () => apiClient(...) })
React Components (ZERO changes)
  ↓
Formatted Display (ZERO changes)
```

**Non-Punitive Design Enforcement:**

| Element | Correct | Incorrect |
|---|---|---|
| Variance icon | Info circle (ℹ) in teal | Warning triangle (⚠) |
| Attention background | Amber/gold (#FDF8E8) | Red (#FEE2E2) |
| Variance background | Neutral grey (#F1F5F9) | Red or amber |
| Upload error header | "Upload needs attention" | "Upload failed" / "Error" |
| Missing submission | "Pending — Awaiting March 2026" | "Overdue — March 2026 missing" |
| Category badges | review (gold), info (teal), complete (green) | error (red), warning (amber) |
| Crimson usage | Sidebar, header, primary buttons ONLY | Never in data content areas |

### Library & Framework Requirements

**New dependencies to install:**

| Package | Version | Purpose | Notes |
|---|---|---|---|
| `recharts` | ^3.7.0 | Charts (installed now, used in 1.8b+) | ResponsiveContainer pattern |
| `date-fns` | ^4.1.0 | Date formatting (dd-MMM-yyyy) | ESM-first, tree-shakeable. v4 has built-in timezone support |
| `@fontsource-variable/inter` | ^5.1.1 | Self-hosted Inter variable font | Import in main.tsx BEFORE CSS |
| `@fontsource-variable/jetbrains-mono` | ^5.1.2 | Self-hosted JetBrains Mono | For NairaDisplay and table numbers |

**Already installed by Story 1.6 (DO NOT reinstall):**

| Package | Purpose |
|---|---|
| `@tanstack/react-query` | Server state (hooks) |
| `zustand` | Client state (UI only) |
| `lucide-react` | Icons (info circle, etc.) |
| `react-hook-form` + `@hookform/resolvers` | Forms |
| shadcn/ui components | UI primitives |

### Testing Requirements

**Unit Tests (co-located with source):**

1. **`badge.test.tsx`** — All 5 custom variants render with correct Tailwind classes
2. **`NairaDisplay.test.tsx`** — Format variants (hero/body/table/compact), zero amount, negative, aria-label
3. **`HeroMetricCard.test.tsx`** — Count-up animation (mock requestAnimationFrame), skeleton loading, click handler, all format variants, reduced motion
4. **`AttentionItemCard.test.tsx`** — Badge category variants, non-punitive text, info icon present (not warning), click handler
5. **`FileUploadZone.test.tsx`** — Drag events (dragover/dragleave/drop), file selection, error state text ("Upload needs attention" string match), template link
6. **`MigrationProgressCard.test.tsx`** — All 6 stages, progress indicator aria values, click handler
7. **`ExceptionQueueRow.test.tsx`** — Priority levels, category badges, resolved state (strikethrough), hover/selected
8. **`formatters.test.ts`** — Edge cases: "0", null, undefined, negative, large numbers, compact format, date format, invalid date
9. **Hook tests (1 per hook)** — Verify hook returns correct TypeScript shape via `renderHook` with QueryClientProvider wrapper

### File Structure — What This Story Creates

```
packages/shared/src/
├── types/
│   ├── api.ts                     # NO CHANGE
│   ├── auth.ts                    # NO CHANGE
│   ├── dashboard.ts               # NEW — DashboardMetrics, AttentionItem
│   ├── mda.ts                     # NEW — MdaComplianceRow, MdaSummary, MigrationMdaStatus
│   ├── loan.ts                    # NEW — LoanSummary, LoanSearchResult
│   ├── submission.ts              # NEW — SubmissionRecord
│   └── exception.ts               # NEW — ExceptionItem
├── constants/
│   ├── roles.ts                   # NO CHANGE
│   └── vocabulary.ts              # MODIFY — add UI_COPY constants
└── index.ts                       # MODIFY — export new types

apps/client/src/
├── main.tsx                       # MODIFY — add font imports
├── styles/
│   └── globals.css                # MODIFY — add non-punitive semantic tokens
├── components/
│   ├── ui/
│   │   ├── Button.tsx             # NO CHANGE
│   │   └── badge.tsx              # NEW or MODIFY — add custom variants
│   └── shared/
│       ├── HeroMetricCard.tsx     # NEW
│       ├── HeroMetricCard.test.tsx # NEW
│       ├── NairaDisplay.tsx       # NEW
│       ├── NairaDisplay.test.tsx  # NEW
│       ├── AttentionItemCard.tsx  # NEW
│       ├── AttentionItemCard.test.tsx # NEW
│       ├── FileUploadZone.tsx     # NEW
│       ├── FileUploadZone.test.tsx # NEW
│       ├── MigrationProgressCard.tsx # NEW
│       ├── MigrationProgressCard.test.tsx # NEW
│       ├── ExceptionQueueRow.tsx  # NEW
│       └── ExceptionQueueRow.test.tsx # NEW
├── hooks/
│   ├── useDashboardData.ts       # NEW
│   ├── useDashboardData.test.ts  # NEW
│   ├── useMdaData.ts             # NEW
│   ├── useMdaData.test.ts        # NEW
│   ├── useAttentionItems.ts      # NEW
│   ├── useAttentionItems.test.ts # NEW
│   ├── useLoanData.ts            # NEW
│   ├── useLoanData.test.ts       # NEW
│   ├── useSubmissionData.ts      # NEW
│   ├── useSubmissionData.test.ts # NEW
│   ├── useMigrationData.ts       # NEW
│   ├── useMigrationData.test.ts  # NEW
│   ├── useExceptionData.ts       # NEW
│   └── useExceptionData.test.ts  # NEW
├── lib/
│   ├── utils.ts                   # NO CHANGE
│   ├── formatters.ts              # NEW
│   └── formatters.test.ts         # NEW
└── mocks/
    ├── oyoMdas.ts                 # NEW — 63 MDA names + codes
    ├── dashboardMetrics.ts        # NEW
    ├── mdaComplianceGrid.ts       # NEW
    ├── attentionItems.ts          # NEW
    ├── mdaDetail.ts               # NEW
    ├── loanDetail.ts              # NEW
    ├── loanSearch.ts              # NEW
    ├── submissionHistory.ts       # NEW
    ├── migrationStatus.ts         # NEW
    └── exceptionQueue.ts          # NEW
```

**Files this story MUST NOT modify:**

```
apps/server/**                     # No server changes
apps/client/src/router.tsx         # No route changes
apps/client/src/App.tsx            # No app root changes
apps/client/src/components/layout/ # No layout changes
apps/client/src/stores/            # No store changes
apps/client/src/pages/             # No page changes (1.8b)
packages/shared/src/constants/roles.ts  # No role changes (vocabulary.ts IS modified — UI_COPY added)
packages/shared/src/validators/    # No validator changes
```

### Previous Story Intelligence

**From Story 1.1 (scaffold):**
1. Tailwind CSS v4 uses CSS-first config (`@theme` in globals.css) — NO `tailwind.config.js`
2. shadcn/ui configured with `components.json` — `@` aliases, slate base colour
3. `cn()` utility at `apps/client/src/lib/utils.ts` — use for all className composition
4. Tests co-located next to source files (not in `__tests__/`)
5. Vitest configured in `vite.config.ts` with `globals: true`, `environment: 'jsdom'`

**From Story 1.6 (frontend shell):**
1. TanStack Query `QueryClient` setup at `apps/client/src/lib/queryClient.ts` with `staleTime: 5min`
2. shadcn/ui components installed: input, label, card, badge, sheet, dialog, separator, skeleton, sonner, form
3. `lucide-react` installed — use for all icons (Info, AlertTriangle banned for variances)
4. Zustand auth store at `apps/client/src/stores/authStore.ts` — DO NOT put mock data here
5. API client at `apps/client/src/lib/apiClient.ts` — hooks will use this when wiring to real APIs

**From Story 1.7 (CI/CD):**
1. CI pipeline runs `pnpm lint && pnpm typecheck && pnpm test` — all must pass
2. Docker builds from the monorepo — shared package must build cleanly

### Latest Technology Intelligence (Feb 2026)

| Technology | Version | Key Notes |
|---|---|---|
| `recharts` | 3.7.0 | v3 removed `recharts-scale` dependency. Use `ResponsiveContainer` wrapper. Custom React components can render in SVG tree. |
| `date-fns` | 4.1.0 | ESM-first, built-in timezone support. Import from `date-fns` top-level (tree-shakes with Vite). Format: `format(parseISO(s), 'dd-MMM-yyyy')`. |
| `@tanstack/react-query` | 5.90.x | `isPending` (not `isLoading`). `gcTime` (not `cacheTime`). No `onSuccess`/`onError` callbacks. Single object options only. |
| `@fontsource-variable/inter` | 5.1.1 | Variable font — single file for all weights (100-900). Import in main.tsx JS before CSS. |
| `@fontsource-variable/jetbrains-mono` | 5.1.2 | Variable font for code/numbers. Import in main.tsx. |
| `zustand` | 5.0.10 | Use `create<T>()(...)` double-invocation pattern. No `createWithEqualityFn` needed for simple stores. |

### Scope Boundaries

**Explicitly IN scope:**
- Font loading (Inter variable + JetBrains Mono variable via @fontsource)
- Extended Badge variants (review, info, complete, pending, variance)
- Non-punitive semantic CSS tokens (variance-bg, variance-icon, attention-bg)
- 6 priority reusable components with full test coverage
- Currency + date formatters with comprehensive tests
- 9 TanStack Query mock data hooks
- 10 mock data files with realistic Oyo State data
- Shared TypeScript types for all mock data shapes
- 63 Oyo State MDA names list

**Explicitly NOT in scope (Story 1.8b):**
- Screen compositions (Executive Dashboard, Operations Hub, MDA Submission)
- Page components (DashboardPage, OperationsPage, SubmissionsPage content)
- Demo seed script (`pnpm seed:demo` enhancements)
- WIRING-MAP.md document
- Chart components (FundPoolChart, MdaComparisonChart) — install recharts but don't build charts
- Build status indicator
- Progressive drill-down wiring
- MDA detail page, Loan detail page layouts
- Router changes or new routes
- Global search bar (non-functional placeholder)

**Explicitly NOT in scope (later epics):**
- Real API integration (Sprint 2+ per wiring map)
- ComparisonPanel, ComputationTransparencyAccordion, NonPunitiveVarianceDisplay (Epic 3)
- SubmissionConfirmation (Epic 5)
- AutoStopCertificate (Epic 8)
- PreSubmissionChecklist, EmploymentEventForm (Epic 11)
- EarlyExitComputationCard (Epic 12)
- RetirementProfileCard, GratuityReceivableCard (Epic 10)
- StaffIdManager (Epic 13)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.8a: Design Foundation, Priority Components & Mock Data Layer]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.8b: Role-Specific Screens (dependency context)]
- [Source: _bmad-output/planning-artifacts/epics.md#17-Component Specification]
- [Source: _bmad-output/planning-artifacts/epics.md#9 Mock Data Hooks & Wiring Map]
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture]
- [Source: _bmad-output/planning-artifacts/architecture.md#Technical Stack — TanStack Query, Zustand, recharts, date-fns]
- [Source: _bmad-output/planning-artifacts/architecture.md#Custom Components Specification]
- [Source: _bmad-output/planning-artifacts/architecture.md#Mock-First Pattern]
- [Source: _bmad-output/planning-artifacts/architecture.md#Naming Conventions]
- [Source: _bmad-output/planning-artifacts/architecture.md#Shared Constants & Types]
- [Source: _bmad-output/planning-artifacts/architecture.md#Financial Number Formatting]
- [Source: _bmad-output/planning-artifacts/prd.md#FR32-FR36 Executive Dashboard]
- [Source: _bmad-output/planning-artifacts/prd.md#FR33 Attention Items]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR-PERF Dashboard <3s on 4G]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR-ACCESS WCAG 2.1 AA]
- [Source: _bmad-output/planning-artifacts/prd.md#AG 30-Second Glance Scenario]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Design Tokens — Colour System]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Typography System]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Component Specifications (A-N)]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Non-Punitive Vocabulary — UI Copy Guidelines]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Badge Variants — Status Badges]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Responsive Design — Breakpoints]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Accessibility — WCAG 2.1 AA]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Animation — Count-Up, Reduced Motion]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Empty States, Loading States, Error States]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Canonical Visual Reference — ux-design-directions.html]
- [Source: _bmad-output/implementation-artifacts/1-6-frontend-authentication-shell.md]
- [Source: _bmad-output/implementation-artifacts/1-7-cicd-pipeline-production-infrastructure.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Fixed timezone-sensitive tests (formatDateTime, MigrationProgressCard timestamp, ExceptionQueueRow timestamp) by using non-UTC timestamps in test expectations
- Fixed MigrationProgressCard badge test: used `getAllByText` to handle duplicate "validated" text in badge and stage description
- Removed unused lucide-react imports (CheckCircle2, Circle, Loader2, AlertCircle) from MigrationProgressCard.tsx

### Completion Notes List

- **Task 1**: Installed recharts ^3.7.0, date-fns ^4.1.0, @fontsource-variable/inter, @fontsource-variable/jetbrains-mono. All Story 1.6 deps verified present. Font imports added to main.tsx before CSS.
- **Task 2**: Extended globals.css with non-punitive semantic tokens (variance-bg, variance-icon, attention-bg, attention-text), status colours, green-50 token. Updated font declarations to reference variable font names. Added touch target sizing CSS for NFR-ACCESS-4.
- **Task 3**: Extended Badge component with 5 custom CVA variants (review/gold, info/teal, complete/green, pending/grey, variance/teal-border). Badge tests cover all variants.
- **Task 4**: Created formatters.ts with formatNaira, formatCompactNaira, formatDate, formatDateTime, formatCount. All financial amounts accept string type. Comprehensive edge case tests (27 tests).
- **Task 5**: Created NairaDisplay component with 4 variants (hero/body/table/compact), JetBrains Mono font, tabular-nums, aria-label. 9 tests.
- **Task 6**: Created HeroMetricCard with currency/count/percentage formats, useCountUp animation hook (200ms ease-out, respects prefers-reduced-motion), skeleton loading, trend indicators, keyboard accessibility. 12 tests.
- **Task 7**: Created AttentionItemCard with Info icon (never warning triangle), category badges, isNew teal border, empty state. 11 tests including non-punitive language enforcement.
- **Task 8**: Created FileUploadZone with drag-drop, 5 states (idle/dragover/uploading/success/error), "Upload needs attention" error text (never "failed"), template download link, mobile-responsive. 11 tests.
- **Task 9**: Created MigrationProgressCard with 6-stage progress indicator, ARIA progressbar, record counts, stage badges. 11 tests.
- **Task 10**: Created ExceptionQueueRow with priority-based left borders, category badges, resolved strikethrough state, empty state. 12 tests.
- **Task 11**: Created 5 type files in packages/shared (dashboard, mda, loan, submission, exception). Added UI_COPY to vocabulary.ts. All types exported from shared index.ts. Shared package builds cleanly.
- **Task 12**: Created 10 mock data files with 63 real Oyo State MDA names, realistic financial amounts as strings, deterministic data distributions. Each file has target endpoint and wire sprint comments.
- **Task 13**: Created 7 TanStack Query hooks (9 hook functions total) with correct queryKey patterns, staleTime 30s, typed returns. 7 test files with QueryClientProvider wrapper pattern. 14 hook tests.
- **Task 14**: Full test suite passes (141 client tests, 141 server tests, 12 shared tests, 2 testing tests). Typecheck clean. Lint clean (only pre-existing server warning). No AlertTriangle/AlertCircle imports in components. All 6 components + badge extension + formatters tested.

### Change Log

- 2026-02-21: Story 1.8a implemented — design foundation, 6 priority components, mock data service layer, shared types, TanStack Query hooks. All 14 tasks completed. 296 total tests passing across monorepo.
- 2026-02-22: Senior Developer AI Review — 9 issues found (1 HIGH, 5 MEDIUM, 3 LOW). All 9 fixed: added 2 missing loan mocks (H1), added internal dragover state to FileUploadZone (M1), fixed submission ref number format (M2), added missing submission records (M3), corrected migration stage distribution (M4), switched to UI_COPY constants (M5), updated File List (L1), noted unrelated artifact changes (L2), changed High priority badge from destructive to outline (L3). 143 client tests passing (+2 new dragover tests). Typecheck clean.

### File List

**New files:**
- apps/client/src/components/shared/NairaDisplay.tsx
- apps/client/src/components/shared/NairaDisplay.test.tsx
- apps/client/src/components/shared/HeroMetricCard.tsx
- apps/client/src/components/shared/HeroMetricCard.test.tsx
- apps/client/src/components/shared/AttentionItemCard.tsx
- apps/client/src/components/shared/AttentionItemCard.test.tsx
- apps/client/src/components/shared/FileUploadZone.tsx
- apps/client/src/components/shared/FileUploadZone.test.tsx
- apps/client/src/components/shared/MigrationProgressCard.tsx
- apps/client/src/components/shared/MigrationProgressCard.test.tsx
- apps/client/src/components/shared/ExceptionQueueRow.tsx
- apps/client/src/components/shared/ExceptionQueueRow.test.tsx
- apps/client/src/components/ui/badge.test.tsx
- apps/client/src/lib/formatters.ts
- apps/client/src/lib/formatters.test.ts
- apps/client/src/mocks/oyoMdas.ts
- apps/client/src/mocks/dashboardMetrics.ts
- apps/client/src/mocks/mdaComplianceGrid.ts
- apps/client/src/mocks/attentionItems.ts
- apps/client/src/mocks/mdaDetail.ts
- apps/client/src/mocks/loanDetail.ts
- apps/client/src/mocks/loanSearch.ts
- apps/client/src/mocks/submissionHistory.ts
- apps/client/src/mocks/migrationStatus.ts
- apps/client/src/mocks/exceptionQueue.ts
- apps/client/src/hooks/useDashboardData.ts
- apps/client/src/hooks/useDashboardData.test.tsx
- apps/client/src/hooks/useMdaData.ts
- apps/client/src/hooks/useMdaData.test.tsx
- apps/client/src/hooks/useAttentionItems.ts
- apps/client/src/hooks/useAttentionItems.test.tsx
- apps/client/src/hooks/useLoanData.ts
- apps/client/src/hooks/useLoanData.test.tsx
- apps/client/src/hooks/useSubmissionData.ts
- apps/client/src/hooks/useSubmissionData.test.tsx
- apps/client/src/hooks/useMigrationData.ts
- apps/client/src/hooks/useMigrationData.test.tsx
- apps/client/src/hooks/useExceptionData.ts
- apps/client/src/hooks/useExceptionData.test.tsx
- packages/shared/src/types/dashboard.ts
- packages/shared/src/types/mda.ts
- packages/shared/src/types/loan.ts
- packages/shared/src/types/submission.ts
- packages/shared/src/types/exception.ts

**Modified files:**
- apps/client/src/main.tsx (added font imports)
- apps/client/src/styles/globals.css (added semantic tokens, touch targets)
- apps/client/src/components/ui/badge.tsx (added 5 custom variants)
- apps/client/package.json (added recharts, date-fns, fontsource dependencies)
- packages/shared/src/constants/vocabulary.ts (added UI_COPY)
- packages/shared/src/index.ts (added type exports)
- pnpm-lock.yaml (updated from new dependency installs)
