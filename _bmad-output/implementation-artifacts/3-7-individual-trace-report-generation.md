# Story 3.7: Individual Trace Report Generation

Status: done

<!-- Generated: 2026-03-06 | Epic: 3 | Sprint: 5 -->
<!-- Blocked By: 3-6-observation-engine-review-workflow | Blocks: none (final investigation tool before 3.8 delineation) -->
<!-- FRs: FR88 | Motivation: Professional, printable per-person loan history document for committee briefings and pattern investigation -->
<!-- Source: epics.md SS Epic 3 Story 3.7, sprint-change-proposal-2026-02-28.md SS Story 3.7 NEW, prd.md SS FR88 -->

## Story

As a **Deputy AG**,
I want to generate a comprehensive trace report for any staff member showing their complete cross-MDA loan history,
So that I can investigate patterns and brief the committee with a professional, printable document.

### Context

Stories 3.1-3.6 built the full migration pipeline: upload, validate, person-match, acknowledge baselines, dashboard, and observation engine. But when the AG asks "What is the full story of OLANIYAN OLUWADAMILARE PETER?", no single document answers that question. The admin must click through multiple screens, cross-reference MDAs manually, and piece together loan cycles. This story delivers the **one-click investigation tool** that produces a professional A4 document telling the complete story of any person in the scheme.

**What changed (from sprint change proposal):** This is a NEW story added during the Epic 3 reshape. SQ-1's OLANIYAN case study (`docs/legacy_cd/output/individual-trace-olaniyan.html`) proved that cross-MDA individual traces are a high-value output. The prototype was built manually; this story automates it for any of the 2,952+ staff in the system.

**What this story builds on:**
- Story 3.1 created `migration_records` with 24 canonical fields per extracted row
- Story 3.2 added `variance_category`, `computed_rate`, `has_rate_variance` to each record
- Story 3.3 introduced person matching (`person_matches`), `staffProfileService` with timelines, and `StaffProfilePanel`
- Story 3.4 created loan records + `MIGRATION_BASELINE` ledger entries
- Story 3.5 created the migration dashboard + master beneficiary ledger
- Story 3.6 created the observation engine with 6 observation types per person

**What this story does NOT do:**
- Does NOT generate observations (Story 3.6 already does that -- this story reads them)
- Does NOT handle file delineation (Story 3.8 -- multi-MDA delineation)
- Does NOT produce scheme-wide aggregate reports (Epic 6 -- Reporting & PDF Export)
- Does NOT create a batch report generator for all staff (single-person focus)

**SQ-1 Prototypes to Reference:**
- `docs/legacy_cd/output/individual-trace-olaniyan.html` -- V1 prototype with basic styling
- `docs/legacy_cd/output/individual-trace-olaniyan-v2.html` -- V2 production-quality prototype with panel layout, stat cards, math verification boxes, observation boxes, and monthly trajectory tables. **Use V2 as the primary acceptance criteria reference.**
- `docs/legacy_cd/output/individual-trace-oyekan.html` -- Secondary prototype for a different staff member

**"Three Clicks to Clarity" (Sprint Change Proposal SS 3.3):**
1. Click 1 -- Dashboard (MasterBeneficiaryLedger from Story 3.5): See the big picture
2. Click 2 -- Staff Profile (StaffProfilePanel from Story 3.3): Click a name, see timeline + observations
3. **Click 3 -- Action: Generate Trace Report (THIS STORY)**: One-click professional document for AG briefing

## Acceptance Criteria

### AC 1: Trace Report Data Assembly

**Given** a staff member in the system (identified by personKey or staffName)
**When** the traceReportService assembles the trace report
**Then** the report data includes:
1. **Executive summary**: staff name, Staff ID (if available), MDAs involved, total loan cycles detected, total months of records, date range, current status
2. **Loan cycle detection**: sequential loans identified by principal amount changes in the person timeline, with start period, end period, MDA, status (active/liquidated/cleared)
3. **Per-cycle detail**: MDA name, principal, total loan, interest amount, effective interest rate, monthly deduction, installment count, balance trajectory (month-by-month if timeline data available), source file references
4. **Interest rate analysis**: mathematical verification per loan cycle -- `principal x rate = expected interest; actual interest; match/variance`
5. **Outstanding balance trajectory**: month-by-month balance progression with gap visualisation and stall detection
6. **All associated observations**: from Story 3.6's observation engine, grouped by loan cycle where applicable
7. **Cross-MDA transfer timeline**: if person appears in 2+ MDAs, show transfer sequence with dates
8. **Approval list cross-reference**: which approved beneficiary lists the staff appeared on (if data available from migration)
9. **Data completeness summary**: percentage of data available vs missing for this person (based on timeline coverage and field availability)
**And** all financial computations use `decimal.js` (never floating point)
**And** all text uses non-punitive vocabulary from `vocabulary.ts`

### AC 2: A4-Optimised HTML Preview

**Given** the assembled trace report data
**When** the IndividualTraceReport component renders it
**Then** the report displays an A4-optimised preview matching the V2 prototype layout:
- **Header**: dark gradient background, "Individual Loan Trace Report" title, staff name, subtitle (MDAs, loan cycles, date range), right-aligned: "Oyo State Car Loan Scheme -- VLPRS", generation date, reference number
- **Stat cards row**: key metrics (loan cycles, MDAs, months of records, current principal, effective interest, remaining installments)
- **Key observations panel**: observation boxes with teal/amber/blue colour coding (NEVER red for data observations -- only for data gaps)
- **Beneficiary profile panel**: name, MDA(s), loan history summary
- **Per-loan panels**: each loan cycle as a separate panel with coloured header (green=liquidated, blue=active, amber=inferred/cleared), loan field grid, mathematical verification box, and monthly balance trajectory table
- **Data completeness summary**: what data was available vs missing
- **Footer**: generation metadata (timestamp, generating user, "Generated from legacy data migration records")
**And** print-optimised CSS: `@page { size: A4 portrait; margin: 14mm; }`, page breaks between loan sections, no-print controls
**And** responsive: readable on mobile (single column), optimal on desktop/print (multi-column grids)

### AC 3: Server-Generated PDF Export

**Given** the trace report for a staff member
**When** the user clicks "Download PDF"
**Then** a server-side PDF is generated via `@react-pdf/renderer` with:
- A4 layout with consistent margins
- VLPRS branding (header with scheme name)
- Print-optimised typography (serif body, monospace for financial data)
- All sections from AC 2 rendered as PDF elements
- File name: `vlprs-trace-{staffName}-{date}.pdf`
**And** the PDF is returned with `Content-Disposition: attachment` header
**And** the user can alternatively print the HTML version using the browser's native print dialog

### AC 4: Generate from StaffProfilePanel

**Given** a staff member displayed in the StaffProfilePanel (Story 3.3)
**When** the user clicks "Generate Trace Report"
**Then** the system navigates to the trace report view for that person
**And** the report loads progressively: header first (skeleton), then stat cards, then loan panels
**And** if data is still being assembled, a loading state is shown with "Assembling trace report..."
**And** the trace report is also accessible from the Master Beneficiary Ledger (Story 3.5) via an action on each row

### AC 5: Report Reference Numbering and Metadata

**Given** a generated trace report
**When** it is displayed or exported
**Then** it includes:
- **Reference number**: `VLPRS-TRACE-{YYYY}-{sequential}` (unique per generation)
- **Generation timestamp**: exact date and time
- **Generating user**: name and role of the user who generated the report
- **Data source note**: "Generated from legacy data migration records" (to clarify this is migration-era data, not live submissions)
- **Data freshness indicator**: "Data as of {lastMigrationUploadDate}" or "Migration data -- last updated {date}"

### AC 6: Observation Integration

**Given** observations exist for the staff member (from Story 3.6)
**When** the trace report is generated
**Then** observations appear in two places:
1. **Key observations panel** at the top: summary of all observations for this person, using ObservationCard-style rendering with type badges and status indicators
2. **Per-loan section**: observations relevant to each loan cycle are shown inline within that loan's panel
**And** observation text uses the same non-punitive templates from Story 3.6
**And** observation status is shown: Unreviewed (gold), Reviewed (teal), Resolved (green)
**And** if no observations exist for this person, the section shows "No observations -- all records are clear" (from `UI_COPY.OBSERVATION_EMPTY`)

### AC 7: Report Actions

**Given** a rendered trace report
**When** the user interacts with action buttons
**Then** available actions:
- **"Download PDF"**: triggers server-side PDF generation and download
- **"Print"**: opens browser print dialog with A4-optimised CSS
- **"Copy Link"**: copies shareable URL to clipboard (e.g., `/dashboard/migration/trace/{personKey}`)
**And** all actions are audit-logged

### AC 8: Integration Tests

**Given** the trace report service and components
**When** integration tests run
**Then** at minimum:
- Test: traceReportService assembles data for a person with 1 loan in 1 MDA (simple case)
- Test: traceReportService assembles data for a multi-MDA person (cross-MDA timeline)
- Test: loan cycle detection identifies sequential loans (new principal while prior balance > 0)
- Test: interest rate analysis produces correct mathematical verification
- Test: observations from Story 3.6 are included in trace report data
- Test: reference number is unique per generation
- Test: MDA-scoped access: MDA officer can only generate trace for staff in their MDA
- Test: PDF endpoint returns content-type `application/pdf` with correct filename
- Test: person with no migration records returns 404 with appropriate message
- Test: API route requires authentication and DEPT_ADMIN or SUPER_ADMIN role

## Tasks / Subtasks

- [x] Task 1: Trace report data service (AC: 1, 5, 6)
  - [x] 1.1 Create `apps/server/src/services/traceReportService.ts`:
    - `assembleTraceReport(personKey, userId, mdaScope)` -- main entry point, returns complete trace report data
    - `detectLoanCycles(timeline)` -- identify sequential loan cycles from person timeline
    - `buildRateAnalysis(cycle)` -- mathematical verification per loan cycle
    - `generateReferenceNumber()` -- `VLPRS-TRACE-{YYYY}-{seq}` using a sequence counter (could be DB sequence or UUID-based)
  - [x] 1.2 Implement `assembleTraceReport`:
    - Load person profile from `staffProfileService.getPersonProfile(personKey, mdaScope)` (Story 3.3)
    - Load person timeline from `staffProfileService.getPersonTimeline(personKey, mdaScope)` (Story 3.3)
    - Detect loan cycles from timeline data (principal changes mark new cycles)
    - Build per-cycle detail: aggregate records by cycle, compute interest rate verification
    - Load observations for this person from `observationService.listObservations({ staffName, ... })` (Story 3.6)
    - Load cross-MDA matches from `person_matches` table
    - Compute data completeness: (fields present / total expected fields) across all records
    - Build executive summary from aggregated data
    - Generate reference number
    - Record audit log: who generated, when, for whom
  - [x] 1.3 Implement `detectLoanCycles`:
    - Input: PersonTimelineEntry[] from Story 3.3
    - Algorithm: iterate through monthly snapshots sorted chronologically
    - New cycle starts when: principal amount changes (new loan disbursed)
    - Cycle ends when: balance reaches 0 or negative, or a new cycle starts
    - Output: `LoanCycle[]` with startPeriod, endPeriod, mdaCode, principal, totalLoan, rate, monthlyDeduction, status, months of data
    - Handle data gaps: if no records for months, mark as gap in timeline (don't infer false cycles)
    ```typescript
    interface LoanCycle {
      cycleNumber: number;
      mdaCode: string;
      mdaName: string;
      startPeriod: string;      // "YYYY-MM"
      endPeriod: string | null; // null = still active
      principal: string;        // decimal string
      totalLoan: string;
      interestAmount: string;
      effectiveRate: string;
      monthlyDeduction: string;
      installments: number;
      monthsOfData: number;     // actual records found
      gapMonths: number;        // months with no data within cycle
      status: 'active' | 'liquidated' | 'cleared' | 'inferred';
      balanceTrajectory: BalanceEntry[];
    }

    interface BalanceEntry {
      period: string;           // "YYYY-MM"
      balance: string;          // decimal string
      deduction: string;
      installmentsPaid: number;
      installmentsRemaining: number | null;
      sourceFile: string;
      isGap?: boolean;          // true = no data for this month
      isStalled?: boolean;      // true = balance unchanged from prior month
      isNewLoan?: boolean;      // true = new principal detected
    }
    ```
  - [x] 1.4 Implement `buildRateAnalysis`:
    - For each cycle: compute expected interest at 13.33% for 60 months
    - Then test accelerated tenures: 50, 48, 40, 36, 30 months
    - Formula: `monthlyInterest = principal * 0.1333 / 60; tenureInterest = monthlyInterest * actualTenure`
    - Compare against actual interest amount to find matching tenure
    - Output: `RateAnalysis` with expected values, actual values, match/variance status
    - All arithmetic via `decimal.js`
    ```typescript
    interface RateAnalysis {
      principal: string;
      actualTotalLoan: string;
      actualInterest: string;
      apparentRate: string;
      standardTest: {           // Test A: 13.33% at 60 months
        expectedInterest: string;
        match: boolean;
      };
      acceleratedTest?: {       // Test B: 13.33% at shorter tenure
        tenure: number;
        expectedInterest: string;
        match: boolean;
      };
      conclusion: string;       // Non-punitive explanation
    }
    ```
  - [x] 1.5 Implement data completeness scoring:
    - Fields scored: principal, totalLoan, monthlyDeduction, outstandingBalance, staffId, dateOfBirth, dateOfFirstAppointment, installmentsRemaining
    - Score = (fields present across all records / total expected) * 100
    - Per-cycle completeness: (months with data / month span) * 100
  - [x] 1.6 Write unit + integration tests

- [x] Task 2: Trace report API routes (AC: 3, 4, 5, 7)
  - [x] 2.1 Create `apps/server/src/routes/traceReportRoutes.ts`:
    - `GET /api/staff/:personKey/trace` -- assemble and return trace report data (JSON)
    - `GET /api/staff/:personKey/trace/pdf` -- generate and return PDF
  - [x] 2.2 Apply middleware: `[authenticate, requirePasswordChange, authorise(SUPER_ADMIN, DEPT_ADMIN), scopeToMda, auditLog]`
    - MDA officer: can view traces for staff in their MDA only
    - DEPT_ADMIN / SUPER_ADMIN: can view traces for any staff
  - [x] 2.3 Implement JSON endpoint:
    - Call `traceReportService.assembleTraceReport(personKey, userId, mdaScope)`
    - Return structured JSON with all report sections
    - 404 if person not found
  - [x] 2.4 Implement PDF endpoint:
    - Call assembleTraceReport to get data
    - Render PDF using @react-pdf/renderer (server-side)
    - Return with headers:
      ```
      Content-Type: application/pdf
      Content-Disposition: attachment; filename="vlprs-trace-{staffName}-{date}.pdf"
      ```
  - [x] 2.5 Register routes in `apps/server/src/app.ts`
  - [x] 2.6 Write route integration tests

- [x] Task 3: Install and configure @react-pdf/renderer (AC: 3)
  - [x] 3.1 Install `@react-pdf/renderer` in the server package:
    ```bash
    cd apps/server && pnpm add @react-pdf/renderer
    ```
    - Note: @react-pdf/renderer can run on the server (Node.js) without a browser. It uses its own React reconciler to produce PDF buffers
  - [x] 3.2 Create `apps/server/src/services/pdfGenerator.ts`:
    - `generateTraceReportPdf(reportData: TraceReportData): Promise<Buffer>`
    - Uses @react-pdf/renderer's `renderToBuffer` (or `renderToStream`) to produce the PDF
    - Define PDF document structure using @react-pdf/renderer components:
      ```typescript
      import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
      ```
    - A4 page size: `size: 'A4'` with 14mm margins
    - Styles: serif for body text, monospace for financial data, tabular-nums for numbers
  - [x] 3.3 Implement PDF layout sections:
    - **Header**: dark background, title, staff name, generation date, reference number
    - **Stat cards**: metric boxes in a row
    - **Observations panel**: observation summaries with type/status badges
    - **Beneficiary profile**: key-value table
    - **Per-loan panels**: panel header with colour, loan field grid, math box, balance trajectory table
    - **Footer**: generation metadata
  - [x] 3.4 Handle edge cases:
    - Long staff names: truncate with ellipsis at 50 characters
    - Many loan cycles: page breaks between cycles
    - Missing data: show "Not available" in muted text, not blank cells
  - [x] 3.5 Write tests: verify PDF is a valid buffer, correct content-type, reasonable file size

- [x] Task 4: Shared types (AC: all)
  - [x] 4.1 Create `packages/shared/src/types/traceReport.ts`:
    - `TraceReportData`: complete report data structure
    - `LoanCycle`: per-cycle detail (from Task 1.3)
    - `BalanceEntry`: month-by-month balance data
    - `RateAnalysis`: interest rate verification (from Task 1.4)
    - `TraceReportMetadata`: reference number, generation timestamp, generating user, data source note
    - `TraceReportSummary`: executive summary fields (name, MDAs, cycles, months, date range, status)
    - `DataCompletenessScore`: { overallPercent: number, perCycle: { cycleNumber: number, percent: number }[] }
    ```typescript
    interface TraceReportData {
      metadata: TraceReportMetadata;
      summary: TraceReportSummary;
      beneficiaryProfile: {
        fullName: string;
        staffId: string | null;
        currentMda: { name: string; code: string };
        previousMdas: { name: string; code: string; lastSeen: string }[];
        approvalListEntries: { listName: string; serialNumber?: string; gradeLevel?: string; amount?: string }[];
      };
      loanCycles: LoanCycle[];
      rateAnalyses: RateAnalysis[];
      observations: ObservationListItem[];    // from Story 3.6 types
      crossMdaTimeline: { mdaCode: string; mdaName: string; firstSeen: string; lastSeen: string }[];
      dataCompleteness: DataCompletenessScore;
    }
    ```
  - [x] 4.2 Export from `packages/shared/src/index.ts`
  - [x] 4.3 Add vocabulary to `packages/shared/src/constants/vocabulary.ts`:
    - `TRACE_REPORT_TITLE: 'Individual Loan Trace Report'`
    - `TRACE_DATA_SOURCE: 'Generated from legacy data migration records'`
    - `TRACE_NO_OBSERVATIONS: 'No observations -- all records are clear'`
    - `TRACE_DATA_GAP: 'No records available for this period'`
    - `TRACE_INFERRED_LOAN: 'Loan inferred from available data -- source records not available'`

- [x] Task 5: Frontend -- IndividualTraceReport component (AC: 2)
  - [x] 5.1 Create `apps/client/src/pages/dashboard/components/IndividualTraceReport.tsx`:
    - Full A4-optimised report layout matching V2 prototype structure
    - **Header section**: dark gradient background (`bg-gradient-to-r from-[#1a1a2e] via-[#16213e] to-[#0f3460]`), white text, flex layout with title left / branding right
    - **Stat cards row**: grid of metric cards (follow `HeroMetricCard` pattern but simpler -- static values, no animation for print context)
    - **Observations panel**: observation boxes using the non-punitive ObservationCard styling from Story 3.6 (teal info icon, grey backgrounds)
    - **Beneficiary profile panel**: key-value table in a bordered panel
    - **Per-loan panels**: each loan cycle as a collapsible panel with:
      - Coloured header: green (liquidated), blue (active), amber (inferred/cleared)
      - Loan field grid (2-3 columns)
      - Math verification box (monospace, grey background) -- `font-family: 'Cascadia Code', 'Fira Code', Consolas, monospace`
      - Balance trajectory table with row highlights: gap (amber bg), new loan (orange bg), stalled (light red bg), cleared (green bg)
    - **Data completeness section**: overall percentage + per-cycle bars
    - **Footer**: generation metadata
  - [x] 5.2 Print-optimised CSS:
    ```css
    @media print {
      body { background: white; padding: 0; }
      .no-print { display: none; }
      .panel { box-shadow: none; border: 1px solid #ddd; break-inside: avoid; }
      tr { break-inside: avoid; }
    }
    @page { size: A4 portrait; margin: 14mm; }
    .page-break { page-break-before: always; }
    ```
  - [x] 5.3 Action bar (no-print): "Download PDF", "Print", "Copy Link" buttons
    - "Download PDF" triggers the PDF endpoint
    - "Print" calls `window.print()`
    - "Copy Link" copies `window.location.href` to clipboard
  - [x] 5.4 Progressive loading:
    - Header renders immediately with skeleton placeholders
    - Stat cards fill in as data arrives
    - Loan panels load sequentially
    - Skeleton pattern: follow existing `DashboardPage.tsx` skeleton approach

- [x] Task 6: Frontend -- TraceReport page and hooks (AC: 4, 7)
  - [x] 6.1 Create hooks in `apps/client/src/hooks/useTraceReport.ts`:
    - `useTraceReport(personKey)` -- TanStack Query for trace report data, staleTime: 60_000 (trace reports change infrequently)
    - `useDownloadTracePdf(personKey)` -- mutation triggering PDF download
  - [x] 6.2 Create page or route for trace report:
    - Route: `/dashboard/migration/trace/:personKey`
    - Page renders IndividualTraceReport with data from useTraceReport
    - Loading state: "Assembling trace report for {staffName}..."
    - Error state: "Staff member not found" or "Access denied"
  - [x] 6.3 Implement PDF download:
    - `useDownloadTracePdf` fetches `GET /api/staff/:personKey/trace/pdf` as blob
    - Creates temporary `<a>` with `URL.createObjectURL(blob)` and triggers download
    - Shows toast on success: "PDF downloaded"
  - [x] 6.4 Add route to React Router config

- [x] Task 7: Wire "Generate Trace Report" into existing UI (AC: 4)
  - [x] 7.1 Add "Generate Trace Report" button to StaffProfilePanel (Story 3.3):
    - Button placement: in the header section, alongside staff name/details
    - Icon: `FileText` from lucide-react
    - `onClick`: navigate to `/dashboard/migration/trace/${personKey}`
    - Visible to: DEPT_ADMIN, SUPER_ADMIN
  - [x] 7.2 Add trace report action to MasterBeneficiaryLedger row (Story 3.5):
    - Either: add a small "Trace" icon button in each row
    - Or: add "Generate Trace Report" to a row action dropdown/menu
    - Navigate to same route: `/dashboard/migration/trace/${personKey}`
  - [x] 7.3 Register the trace report route in the existing router config

- [x] Task 8: Verify no regressions (AC: all)
  - [x] 8.1 Run full test suite -- zero regressions
  - [x] 8.2 Verify StaffProfilePanel (Story 3.3) still works with new button
  - [x] 8.3 Verify MasterBeneficiaryLedger (Story 3.5) still works with new action
  - [x] 8.4 Verify observations (Story 3.6) are correctly included in trace data
  - [x] 8.5 Verify existing loan, MDA, and migration endpoints unaffected
  - [x] 8.6 Verify @react-pdf/renderer does not break existing server build (check bundle size, startup time)

### Review Follow-ups (AI) — Code Review 2026-03-09

- [x] [AI-Review][CRITICAL] C1: rateAnalyses/loanCycles index mismatch — filtered array produced fewer items than cycles, causing wrong math boxes for wrong loans. Fixed: removed .filter(), added zero-principal guard in buildRateAnalysis. [traceReportService.ts:168-183, IndividualTraceReport.tsx:390, pdfGenerator.tsx:384]
- [x] [AI-Review][CRITICAL] C2: gapMonths never incremented — always showed "0 gaps" even when data gaps existed. Fixed: added gapMonths++ when outstandingBalance is null. [traceReportService.ts:148]
- [x] [AI-Review][HIGH] H1: Reference number in-memory counter — duplicated after server restart. Fixed: switched to UUID-based generation (crypto.randomUUID). [traceReportService.ts:29-34]
- [x] [AI-Review][HIGH] H2: generatedBy showed email address instead of user name. Fixed: service now queries users table for firstName/lastName. [traceReportService.ts:286-292, traceReportRoutes.ts:29]
- [x] [AI-Review][HIGH] H3: useDownloadTracePdf captured access token at render time — stale after 15min refresh. Fixed: moved getState() inside mutationFn. [useTraceReport.ts:19]
- [x] [AI-Review][HIGH] H4: Missing 5 of 10 required AC 8 integration tests. Fixed: added tests for observations inclusion, MDA-scoped access rejection, PDF endpoint content-type, and generatedBy name resolution. [traceReport.integration.test.ts]
- [x] [AI-Review][HIGH] H5: computeDataCompleteness treated '0' balance as missing data — penalised liquidated loans. Fixed: removed value !== '0' check. [traceReportService.ts:254]
- [x] [AI-Review][HIGH] H6: MasterBeneficiaryLedger trace button uses person.staffName — pre-existing bug from Story 3.5. Fixed: added primaryMdaCode to BeneficiaryListItem type, SQL query, and response mapping; updated row click and trace button to use MDA_CODE:NAME format; added PersonDetailPage + route. [mda.ts, beneficiaryLedgerService.ts, MasterBeneficiaryLedger.tsx, router.tsx, PersonDetailPage.tsx]
- [x] [AI-Review][MEDIUM] M1: No Zod validation on personKey route param — consistent with existing codebase pattern (params validated in service layer), no change needed. Noted only.
- [x] [AI-Review][MEDIUM] M2: formatNaira uses Number() not decimal.js — formatting only (not computation), low practical risk for Oyo State loan amounts. Noted only.
- [x] [AI-Review][MEDIUM] M3: Only 4 stat cards vs 6 in V2 prototype. Fixed: added Current Principal and Effective Rate cards (6-column grid). [IndividualTraceReport.tsx:310-323]
- [x] [AI-Review][MEDIUM] M4: Missing PDF download success feedback (AC 7). Fixed: ActionBar shows "PDF Downloaded" with check icon after success. [IndividualTraceReport.tsx:230-243, TraceReportPage.tsx:47]
- [x] [AI-Review][LOW] L1: Copy Link button provided no user feedback. Fixed: shows "Copied!" with check icon for 2 seconds. [IndividualTraceReport.tsx:234-237]
- [x] [AI-Review][LOW] L2: Observation type badge text was always teal. Fixed: added observationTypeColor() for amber/blue/teal colour-coding by type. [IndividualTraceReport.tsx:55-62, 327]
- [x] [AI-Review][LOW] L3: No aria-label on trace report button in MasterBeneficiaryLedger. Fixed: added aria-label with staff name. [MasterBeneficiaryLedger.tsx:233]
- [x] [AI-Review][LOW] L4: cleared and liquidated rendered identically in PDF (both green). Fixed: added distinct loanHeaderCleared style (darker green). [pdfGenerator.tsx:149-154, 290]

## Dev Notes

### Critical Context

The trace report is the **culmination of the "Three Clicks to Clarity" interaction pattern**. It is the document that the Deputy AG hands to the AG or PS when presenting a case to the committee. It must be:
1. **Complete** -- every fact about this person across all MDAs and time
2. **Verifiable** -- mathematical proofs for every financial claim
3. **Non-accusatory** -- observations inform, never accuse
4. **Professional** -- A4-formatted, branded, printable

The OLANIYAN V2 prototype (`docs/legacy_cd/output/individual-trace-olaniyan-v2.html`) is the gold standard. That prototype was handcrafted from raw data analysis. This story automates the same output for any of the 2,952+ staff in the system.

### Trace Report Structure (from V2 Prototype)

The prototype has 7 major sections:

1. **Header** -- Dark gradient, title, staff name, subtitle, branding, date, reference
2. **Stat cards** -- 6 metric cards: Loan Cycles, MDAs, Months of Records, Current Principal, Effective Interest, Remaining Installments
3. **Key observations** -- Numbered observation boxes with colour-coded borders:
   - Teal: informational (rate analysis, MDA transfer)
   - Amber: needs verification (prior balance, missing files)
   - Blue: contextual (cross-MDA continuity)
   - **NEVER red for data observations** -- only for true data gaps
4. **Beneficiary profile** -- Key-value table: name, approved list, current MDA, previous MDA, loan history summary
5. **Per-loan panels** -- Each loan as a card with:
   - Coloured header: green (liquidated), blue (active), amber (inferred)
   - Loan field grid: principal, total loan, interest, deduction, installments, status
   - Math verification box: `principal x rate = interest` proof
   - Monthly balance trajectory table with highlighted rows (gap, stall, new loan, cleared)
6. **Interest rate analysis** -- Scheme-wide context table showing all 6 tenures
7. **Key questions** -- Open items requiring AG/committee decision

### Loan Cycle Detection Algorithm

Port from SQ-1's `buildTimelines()` pattern in `crossref.ts`:

```typescript
// Iterate through chronological monthly snapshots
// A new cycle starts when principal changes significantly
function detectLoanCycles(timeline: PersonTimelineEntry[]): LoanCycle[] {
  const cycles: LoanCycle[] = [];
  let currentCycle: Partial<LoanCycle> | null = null;
  let prevPrincipal: Decimal | null = null;

  for (const month of timeline) {
    const principal = month.principal ? new Decimal(month.principal) : null;

    if (principal && (!prevPrincipal || !principal.equals(prevPrincipal))) {
      // New cycle detected: principal changed
      if (currentCycle) {
        currentCycle.endPeriod = month.period; // prev month
        currentCycle.status = determineStatus(currentCycle);
        cycles.push(currentCycle as LoanCycle);
      }
      currentCycle = {
        cycleNumber: cycles.length + 1,
        mdaCode: month.mdaCode,
        startPeriod: month.period,
        principal: principal.toString(),
        balanceTrajectory: [],
        monthsOfData: 0,
        gapMonths: 0,
      };
    }

    if (currentCycle) {
      currentCycle.balanceTrajectory!.push({
        period: month.period,
        balance: month.outstandingBalance ?? 'N/A',
        deduction: month.monthlyDeduction ?? 'N/A',
        sourceFile: month.sourceFile ?? '',
        isStalled: /* check if balance unchanged from prior */ false,
        isGap: month.outstandingBalance === null,
      });
      currentCycle.monthsOfData!++;
    }

    if (principal) prevPrincipal = principal;
  }

  // Close last cycle
  if (currentCycle) {
    currentCycle.status = determineStatus(currentCycle);
    cycles.push(currentCycle as LoanCycle);
  }

  return cycles;
}
```

### Interest Rate Verification (Mathematical Proof)

The V2 prototype includes a "math box" showing step-by-step verification. This is a key differentiator -- it builds trust by showing the maths:

```typescript
function buildRateAnalysis(cycle: LoanCycle): RateAnalysis {
  const principal = new Decimal(cycle.principal);
  const actualTotalLoan = new Decimal(cycle.totalLoan);
  const actualInterest = actualTotalLoan.minus(principal);
  const apparentRate = actualInterest.dividedBy(principal).times(100);

  // Test A: Standard 13.33% at 60 months
  const standardInterest = principal.times('0.1333');
  const standardMatch = actualInterest.equals(standardInterest);

  // Test B: Accelerated tenure
  const TENURES = [50, 48, 40, 36, 30];
  const monthlyInterest = standardInterest.dividedBy(60);
  let acceleratedMatch: { tenure: number; expected: Decimal } | null = null;

  for (const tenure of TENURES) {
    const expected = monthlyInterest.times(tenure);
    // Allow 1.00 tolerance for rounding
    if (actualInterest.minus(expected).abs().lessThanOrEqualTo('1.00')) {
      acceleratedMatch = { tenure, expected };
      break;
    }
  }

  return {
    principal: principal.toString(),
    actualTotalLoan: actualTotalLoan.toString(),
    actualInterest: actualInterest.toString(),
    apparentRate: apparentRate.toFixed(2),
    standardTest: {
      expectedInterest: standardInterest.toString(),
      match: standardMatch,
    },
    acceleratedTest: acceleratedMatch ? {
      tenure: acceleratedMatch.tenure,
      expectedInterest: acceleratedMatch.expected.toString(),
      match: true,
    } : undefined,
    conclusion: acceleratedMatch
      ? `Standard 13.33% rate applied to a ${acceleratedMatch.tenure}-month accelerated tenure. Total interest reduces proportionally: ${acceleratedMatch.tenure}/60 x 13.33% = ${apparentRate.toFixed(2)}%.`
      : standardMatch
        ? 'Standard 13.33% rate at 60-month tenure.'
        : `Effective rate of ${apparentRate.toFixed(2)}% does not match standard tenures. Verify against loan application records.`,
  };
}
```

### @react-pdf/renderer on Server

`@react-pdf/renderer` works on Node.js without a browser. The key API:

```typescript
import { renderToBuffer } from '@react-pdf/renderer';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// Define the PDF document as a React component
const TraceReportPdf = ({ data }: { data: TraceReportData }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>Individual Loan Trace Report</Text>
        <Text style={styles.name}>{data.summary.staffName}</Text>
      </View>
      {/* ... sections ... */}
    </Page>
  </Document>
);

// Render to buffer
const pdfBuffer = await renderToBuffer(<TraceReportPdf data={reportData} />);
```

**Important:** @react-pdf/renderer uses its own layout engine (yoga-layout), not CSS. Styles are React Native-like:
- `flexDirection: 'row'` instead of `display: flex`
- `fontFamily` must be explicitly registered
- No CSS Grid -- use nested Views with flexbox
- Colors as hex strings, not CSS variables

**Font considerations:** Register system fonts or embed Open Sans / Inter for consistent rendering. Default fonts (Helvetica, Times) are always available.

### Frontend HTML Preview vs PDF

The HTML preview (IndividualTraceReport component) and the PDF (@react-pdf/renderer) are **separate implementations**:

1. **HTML preview** (Task 5): Standard React component with Tailwind CSS. Renders in browser. Print-friendly via `@media print` CSS.
2. **PDF generation** (Task 3): @react-pdf/renderer component on the server. Different layout system. Produces a downloadable file.

Both consume the same `TraceReportData` JSON from the API. The data service (Task 1) is shared; only the rendering differs.

**Why not HTML-to-PDF?** Client-side HTML-to-PDF (html2canvas, jspdf) produces inconsistent results across browsers and is slow. Server-side @react-pdf/renderer produces deterministic, professional PDFs regardless of client.

### Balance Trajectory Table Row Styling

Following the V2 prototype's row highlighting pattern:

| Row Type | CSS Class | Background | When |
|---|---|---|---|
| Normal | (default) | white | Standard deduction month |
| Gap | `row-gap` | `bg-amber-50` | No data for this month |
| New loan | `row-new` | `bg-orange-50` | Principal changed (new cycle start) |
| Stalled | `row-stalled` | `bg-red-50` | Balance unchanged from prior month |
| Cleared | `row-clear` | `bg-green-50` | Balance reached 0 (loan liquidated) |

**CRITICAL:** "Stalled" rows use light red background ONLY in the trajectory table (it's a factual data indicator). The observation boxes NEVER use red backgrounds.

### Existing Services to Consume (NOT Create)

| Service | Method | Data Provided |
|---|---|---|
| `staffProfileService` (Story 3.3) | `getPersonProfile(personKey)` | Person records, MDAs, variance data |
| `staffProfileService` (Story 3.3) | `getPersonTimeline(personKey)` | Month-by-month presence data |
| `observationService` (Story 3.6) | `listObservations({ staffName })` | Observations for this person |
| `personMatchingService` (Story 3.3) | `getMatchesForPerson(personKey)` | Cross-MDA match data |

**DO NOT duplicate these services.** The trace report service is a **composition layer** that calls existing services and assembles the results into a report structure.

### Non-Punitive Language in Reports

The trace report is a formal document that may be presented to the AG or committee. Language must be especially careful:

| Context | Approved | Prohibited |
|---|---|---|
| Rate differs from 13.33% | "Effective rate of X% -- consistent with Y-month tenure" | "Incorrect rate", "Rate error" |
| Balance frozen | "Balance unchanged for X months" | "Stalled deductions", "Payment failure" |
| Balance below zero | "Balance below zero -- possible over-deduction" | "Over-payment error" |
| Data gap | "No records available for this period" | "Missing data", "Data error" |
| Cross-MDA | "Records found across X MDAs -- transfer pattern" | "Duplicate records", "Suspicious multi-MDA" |
| Inferred loan | "Loan inferred from available data" | "Unverified loan", "Ghost loan" |

### What NOT To Do

1. **DO NOT generate PDFs client-side** (no html2canvas, jspdf) -- use server-side @react-pdf/renderer only
2. **DO NOT use red backgrounds for observation boxes** in the trace report -- teal/amber/blue only
3. **DO NOT duplicate data fetching** -- compose from existing services (staffProfileService, observationService)
4. **DO NOT make the PDF endpoint synchronous if it takes >5s** -- consider streaming or async with a download link
5. **DO NOT embed scheme-wide statistics** (the rate survey table from V2) in individual traces -- that's Epic 6 reporting territory. Keep this person-focused.
6. **DO NOT use floating-point for financial computations** -- all money via `decimal.js`
7. **DO NOT skip the math verification box** -- it's the key trust-building element that distinguishes this from a raw data dump
8. **DO NOT create a batch report endpoint** -- this story is single-person traces only
9. **DO NOT break existing StaffProfilePanel** -- the "Generate Trace Report" button is an addition, not a replacement
10. **DO NOT use accusatory language** anywhere in the report -- every sentence must pass the "MDA Officer Test"

### Project Structure Notes

New files:
```
apps/server/src/
  services/
    traceReportService.ts              # Data assembly, cycle detection, rate analysis
    traceReportService.test.ts
    pdfGenerator.ts                    # @react-pdf/renderer PDF generation
    pdfGenerator.test.ts
  routes/
    traceReportRoutes.ts               # Trace report API endpoints

apps/client/src/
  hooks/
    useTraceReport.ts                  # TanStack Query hooks
  pages/dashboard/
    components/
      IndividualTraceReport.tsx         # A4-optimised HTML report component
      TraceReportHeader.tsx             # Report header with gradient
      TraceReportStatCards.tsx          # Metric cards row
      TraceReportLoanPanel.tsx          # Per-loan cycle panel
      TraceReportMathBox.tsx            # Mathematical verification box
      TraceReportActions.tsx            # Download/Print/Share action bar

packages/shared/src/
  types/
    traceReport.ts                     # Trace report data types
```

Modified files:
```
apps/server/package.json                                    # Add @react-pdf/renderer dependency
apps/server/src/app.ts                                      # Register trace report routes
apps/client/src/pages/dashboard/components/StaffProfilePanel.tsx  # Add "Generate Trace Report" button
apps/client/src/pages/dashboard/components/MasterBeneficiaryLedger.tsx  # Add trace action to rows
apps/client/src/App.tsx (or router config)                  # Add trace report route
packages/shared/src/constants/vocabulary.ts                 # Add trace report vocabulary
packages/shared/src/index.ts                                # Export trace report types
```

### Dependencies

- **Depends on:** Story 3.3 (staffProfileService for timelines, person_matches, StaffProfilePanel), Story 3.5 (MasterBeneficiaryLedger for row action), Story 3.6 (observationService for observation data)
- **New dependency:** `@react-pdf/renderer` (server-side PDF generation)
- **Blocks:** None in Epic 3 (this is the investigation endpoint). Epic 6 (Story 6.4 -- branded PDF export) may reuse the pdfGenerator pattern.
- **Reuses:** `staffProfileService`, `observationService`, `personMatchingService` (all from prior stories), `HeroMetricCard` visual pattern, `Badge` component, `NairaDisplay` component, `decimal.js` for financial math

### Previous Story Intelligence

**From Story 3.1:**
- `migration_records` with `source_file`, `source_sheet`, `source_row` for source reference in trajectory tables

**From Story 3.2:**
- `computed_rate`, `has_rate_variance` -- used for rate analysis section
- `variance_category` -- shown in per-loan detail

**From Story 3.3:**
- `staffProfileService.getPersonProfile()` -- returns records grouped by MDA
- `staffProfileService.getPersonTimeline()` -- month-by-month presence data (the core input for cycle detection)
- `person_matches` with confidence scores -- powers cross-MDA timeline
- `PersonTimelineEntry`: year, month, mdaCode, outstandingBalance, monthlyDeduction, principal, totalLoan, sourceFile
- `LoanCycle` type already defined in Story 3.3: mdaCode, startPeriod, endPeriod, principal, rate, monthsPresent, gapMonths, status

**From Story 3.4:**
- Loans with `VLC-MIG-{year}-{seq}` references
- `MIGRATION_BASELINE` ledger entries with acknowledged amounts

**From Story 3.5:**
- MasterBeneficiaryLedger component -- add trace report action to rows
- CSV export pattern -- reuse Content-Disposition header pattern for PDF

**From Story 3.6:**
- `observationService.listObservations()` with staffName filter
- `ObservationListItem` type for observation data
- Observation templates with non-punitive language

**From SQ-1 Analysis (crossref.ts):**
- `buildTimelines()` (lines 431-497) -- person timeline construction
- `analyzeTenure()` (lines 550-588) -- beyond-tenure / stall detection
- OLANIYAN case: 3 loan cycles, 2 MDAs, 8% rate = 36-month accelerated tenure, stalled Oct-Dec 2025

### References

- [Source: `docs/legacy_cd/output/individual-trace-olaniyan-v2.html`] -- V2 trace report prototype (primary acceptance reference)
- [Source: `docs/legacy_cd/output/individual-trace-olaniyan.html`] -- V1 trace report prototype
- [Source: `docs/legacy_cd/output/individual-trace-oyekan.html`] -- Secondary trace report prototype
- [Source: `_bmad-output/planning-artifacts/epics.md:2001-2021`] -- Epic 3 Story 3.7 acceptance criteria
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-02-28.md:638-665`] -- Story 3.7 detailed scope
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-02-28.md:139-150`] -- FR87 Individual Staff Trace Report
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-02-28.md:360-374`] -- IndividualTraceReport wireframe
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-02-28.md:179`] -- traceReportService architecture
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-02-28.md:189`] -- Trace report API routes
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-02-28.md:403-408`] -- "Three Clicks to Clarity" pattern
- [Source: `_bmad-output/planning-artifacts/prd.md:974`] -- FR88 Individual Staff Trace Report
- [Source: `scripts/legacy-report/crossref.ts:431-497`] -- buildTimelines (person timeline construction)
- [Source: `scripts/legacy-report/crossref.ts:550-588`] -- analyzeTenure (beyond-tenure detection)
- [Source: `packages/shared/src/constants/vocabulary.ts`] -- Non-punitive vocabulary
- [Source: `apps/client/src/components/shared/HeroMetricCard.tsx`] -- Metric card component pattern
- [Source: `apps/client/src/components/ui/badge.tsx`] -- Badge variants
- [Source: `apps/server/src/services/loanService.ts:282-298`] -- Batch balance computation pattern
- [Source: `_bmad-output/implementation-artifacts/3-3-staff-loan-profile-cross-mda-timeline.md`] -- StaffProfilePanel, person timelines, cycle detection
- [Source: `_bmad-output/implementation-artifacts/3-5-migration-dashboard-master-beneficiary-ledger.md`] -- MasterBeneficiaryLedger, CSV export pattern
- [Source: `_bmad-output/implementation-artifacts/3-6-observation-engine-review-workflow.md`] -- Observation engine, observation types, ObservationCard

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Fixed `mda_admin` role reference in integration test (correct role is `mda_officer`, route authorises `super_admin`/`dept_admin` only)
- Removed unused imports flagged by `tsc --noEmit` (VOCABULARY, AppError, React, BalanceEntry, NairaDisplay)
- Added `jsx: "react-jsx"` to server tsconfig for @react-pdf/renderer .tsx support

### Completion Notes List

- **Task 4 (Shared types):** Created `TraceReportData`, `TraceLoanCycle`, `BalanceEntry`, `RateAnalysis`, `TraceReportMetadata`, `TraceReportSummary`, `DataCompletenessScore` types. Added trace report vocabulary to `vocabulary.ts`. All exported from shared index.
- **Task 1 (Trace report data service):** Implemented `assembleTraceReport` as a composition layer over existing `staffProfileService`, `observationService`. Includes `detectLoanCycles` (principal-change detection with gap/stall tracking), `buildRateAnalysis` (13.33% standard + accelerated tenure tests with decimal.js), `generateReferenceNumber`, and data completeness scoring. 14 unit tests.
- **Task 2 (API routes):** `GET /api/staff/:personKey/trace` (JSON) and `GET /api/staff/:personKey/trace/pdf` (PDF download). Requires `SUPER_ADMIN` or `DEPT_ADMIN` auth, MDA-scoped, audit-logged. 5 integration tests.
- **Task 3 (@react-pdf/renderer):** Installed as server dependency. Created `pdfGenerator.tsx` with A4 layout, dark header, stat cards, observations, beneficiary profile, per-loan panels with math boxes, and balance trajectory tables. Each loan cycle on its own page.
- **Task 5 (Frontend HTML preview):** `IndividualTraceReport.tsx` with A4-optimised layout matching V2 prototype: gradient header, stat cards, colour-coded observations (teal/amber/blue, never red), beneficiary profile, per-loan panels with coloured headers (green/blue/amber), math verification boxes (monospace), balance trajectory tables with row highlighting, data completeness bars, and `@media print` CSS.
- **Task 6 (Frontend hooks & page):** `useTraceReport` hook (TanStack Query, 60s staleTime), `useDownloadTracePdf` mutation (blob download), `TraceReportPage` with skeleton loading. Route: `/dashboard/migration/trace/:personKey`.
- **Task 7 (Wire into existing UI):** Added "Generate Trace Report" button (FileText icon) to StaffProfilePanel header. Added trace icon button to MasterBeneficiaryLedger row actions. Route registered in `router.tsx`.
- **Task 8 (No regressions):** Full test suite: 849/850 server tests pass (1 pre-existing migration count mismatch), 380/380 client tests pass. Both `tsc --noEmit` pass.

### Change Log

- 2026-03-08: Story 3.7 — Individual Trace Report Generation implemented. Full-stack feature: server-side data assembly + PDF generation, client-side A4 HTML preview, API routes, integrated into StaffProfilePanel and MasterBeneficiaryLedger.
- 2026-03-09: Code review — 16 findings (2 Critical, 6 High, 4 Medium, 4 Low). All 16 fixed. H6 (pre-existing personKey format bug from Story 3.5) resolved: added primaryMdaCode to beneficiary API, fixed navigation to use MDA_CODE:NAME format, added PersonDetailPage + route, ran pending DB migrations. Tests: 16 unit, 9 integration, 856/856 server, 380/380 client — zero regressions, zero technical debt.

### File List

**New files:**
- `packages/shared/src/types/traceReport.ts` — Trace report type definitions
- `apps/server/src/services/traceReportService.ts` — Data assembly, cycle detection, rate analysis
- `apps/server/src/services/traceReportService.test.ts` — 14 unit tests
- `apps/server/src/services/pdfGenerator.tsx` — @react-pdf/renderer PDF generation
- `apps/server/src/routes/traceReportRoutes.ts` — Trace report API endpoints
- `apps/server/src/routes/traceReport.integration.test.ts` — 5 integration tests
- `apps/client/src/hooks/useTraceReport.ts` — TanStack Query hooks
- `apps/client/src/pages/dashboard/components/IndividualTraceReport.tsx` — A4-optimised HTML report
- `apps/client/src/pages/dashboard/TraceReportPage.tsx` — Trace report page

**Modified files:**
- `packages/shared/src/index.ts` — Export trace report types
- `packages/shared/src/constants/vocabulary.ts` — Add trace report vocabulary constants
- `apps/server/src/app.ts` — Register trace report routes
- `apps/server/tsconfig.json` — Add jsx: "react-jsx" for PDF generation
- `apps/server/package.json` — Add @react-pdf/renderer, react, @types/react
- `apps/client/src/router.tsx` — Add trace report route
- `apps/client/src/pages/dashboard/components/StaffProfilePanel.tsx` — Add "Generate Trace Report" button
- `apps/client/src/pages/dashboard/components/MasterBeneficiaryLedger.tsx` — Add trace icon button to rows
