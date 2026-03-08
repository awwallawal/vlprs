# Story 3.6: Observation Engine & Review Workflow

Status: done

<!-- Generated: 2026-03-06 | Epic: 3 | Sprint: 5 -->
<!-- Blocked By: 3-5-migration-dashboard-master-beneficiary-ledger | Blocks: 3-7-individual-trace-report-generation -->
<!-- FRs: FR87 | Motivation: Surface data intelligence from migration records using non-punitive observations with structured review workflow -->
<!-- Source: epics.md SS Epic 3 Story 3.6, sprint-change-proposal-2026-02-28.md SS Story 3.6 NEW -->

## Story

As a **Department Admin**,
I want the system to auto-generate observations during migration and provide a review workflow,
So that data patterns are surfaced for human review without implying fault and can be systematically investigated.

### Context

Stories 3.1-3.5 built the migration pipeline and dashboard. But 1,509 of 2,952 staff (51%) have auto-detectable patterns — rate variances, stalled balances, negative balances, multi-MDA records, approval mismatches. Without a structured observation engine, the admin would need to manually inspect each record. This story transforms raw data patterns into actionable, non-punitive observations with a review workflow.

**What changed (from sprint change proposal):** This is a NEW story added during the Epic 3 reshape. SQ-1 Phase 2 (`crossref.ts`) proved that 51% of staff have detectable patterns. The observation engine ports SQ-1's detection algorithms into a production service with structured templates, status workflow, and audit trail.

**What this story builds on:**
- Story 3.1 created `migration_records` with 24 canonical fields per extracted row
- Story 3.2 added `variance_category`, `computed_rate`, `has_rate_variance` to each record
- Story 3.3 introduced person matching and the `person_matches` table for cross-MDA detection
- Story 3.4 created loan records + `MIGRATION_BASELINE` ledger entries
- Story 3.5 created the migration dashboard + master beneficiary ledger (observation counts wired as placeholder 0)

**What this story does NOT do:**
- Does NOT generate trace reports (Story 3.7 -- individual trace)
- Does NOT handle file delineation (Story 3.8 -- multi-MDA delineation)
- Does NOT create the exception queue system (Epic 7) -- only the "Promote to Exception" handoff point

**SQ-1 Detection Algorithms to Port:**
- `crossref.ts:detectOverDeductions()` -- negative balance detection (142 cases found)
- `crossref.ts:analyzeTenure()` -- beyond-tenure detection (stalled proxy)
- `crossref.ts:performReverseCrossref()` -- deducted-but-never-approved detection (368 cases)
- Rate variance detection: `computed_rate !== 13.33` from Story 3.2 data
- Multi-MDA: from Story 3.3's `person_matches` (425 cases)
- Consecutive Loan Without Clearance: new principal while prior balance > 0

**Observation Templates (from sprint change proposal):**

**Rate Variance:** *"This loan's total interest is {rate}% ({interestAmount} on {principal}), which differs from the standard 13.33%. This is consistent with a {tenure}-installment repayment plan. Possible explanations: different approved tenure, GL-level based rate tier, administrative adjustment. Verify against loan application records."*

**Stalled Balance:** *"Outstanding balance has remained at {amount} for {count} consecutive months ({startMonth}--{endMonth}). Possible explanations: salary deduction suspension, administrative hold, data entry lag. Confirm with MDA payroll records."*

**Negative Balance:** *"Balance reached {amount} (below zero) in {period}, suggesting deductions continued after loan completion. An estimated {overAmount} may be due for refund. Possible explanations: delayed stop-deduction processing, timing difference between payroll and loan records. Verify deduction stop date."*

**Multi-MDA:** *"This staff member has loan records across {count} MDAs ({mdaList}). This typically indicates an inter-MDA transfer. Verify transfer documentation and confirm loan continuity."*

**No Approval Match:** *"This staff member has active deduction records but does not appear on the loaded approved beneficiary lists. Possible explanations: approved on an earlier list not yet uploaded, name variance between list and records, legacy loan predating current approval process. Cross-check with MDA loan files."*

**Consecutive Loan Without Clearance:** *"A new loan ({newPrincipal}) commenced in {newStartPeriod} while the prior loan still shows an outstanding balance of {priorBalance} in {priorPeriod}. This may indicate: approved loan renewal, balance transfer to new terms, or data entry timing difference. Verify loan renewal documentation."*

## Acceptance Criteria

### AC 1: Observation Auto-Generation

**Given** a migration batch has been processed (Stories 3.1-3.4 complete for an upload)
**When** the observationEngine auto-scan runs (triggered after baseline creation or manually via API)
**Then** observations are generated for all 6 types:
1. **Rate Variance** -- effective rate differs from 13.33% standard (from Story 3.2's `computed_rate` and `has_rate_variance`)
2. **Stalled Balance** -- balance unchanged for 3+ consecutive months across person's timeline (from Story 3.3's timeline data)
3. **Negative Balance** -- computed balance below zero (from migration record's `outstanding_balance` < 0)
4. **Multi-MDA** -- staff in records across 2+ MDAs (from Story 3.3's `person_matches` with status 'auto_confirmed' or 'confirmed')
5. **No Approval Match** -- deductions without approved beneficiary list entry (cross-references approved lists if loaded)
6. **Consecutive Loan Without Clearance** -- new loan (different principal) while prior balance outstanding in person's timeline
**And** each observation includes: factual description (from template), plain-English explanation, 2-3 possible explanations, suggested next step, data completeness indicator (0-100%), and source reference (file/sheet/row)
**And** all observation templates use non-punitive vocabulary from `vocabulary.ts`
**And** observations are created with status "Unreviewed"
**And** observation generation is idempotent -- running again for the same upload does not create duplicate observations

### AC 2: Observation List API

**Given** the observations list at `GET /api/observations`
**When** Department Admin or Deputy AG views it
**Then** observations are returned paginated with filters:
- `type` -- rate_variance, stalled_balance, negative_balance, multi_mda, no_approval_match, consecutive_loan
- `mdaId` -- filter by MDA
- `status` -- unreviewed, reviewed, resolved, promoted
- `staffName` -- search by staff name
- `sortBy` -- createdAt, type, staffName, status
- `sortOrder` -- asc, desc
**And** response includes aggregate counts: total observations, by type, by status (for dashboard metrics)

### AC 3: Observation Review -- Mark as Reviewed

**Given** an observation in "Unreviewed" status
**When** Department Admin clicks "Mark as Reviewed"
**Then** the reviewer can optionally add a note
**And** the status changes to "Reviewed"
**And** `reviewer_id`, `reviewer_note`, and `reviewed_at` timestamp are recorded
**And** the action is audit-logged

### AC 4: Observation Resolution -- Mark as Resolved

**Given** an observation in "Reviewed" status
**When** Department Admin clicks "Mark as Resolved"
**Then** a resolution note is required
**And** the status changes to "Resolved"
**And** `resolved_at` timestamp and resolution note are recorded
**And** the observation counter on the master beneficiary ledger (Story 3.5) decrements

### AC 5: Promote to Exception

**Given** an observation that warrants formal exception tracking
**When** the reviewer clicks "Promote to Exception"
**Then** a new exception record is created in a lightweight exception queue with the observation context preserved
**And** the observation status changes to "Promoted"
**And** the exception record links back to the source observation
**And** this is the handoff point for Epic 7 (Exception Management) -- the exception queue is minimal (table + list route), not the full Epic 7 workflow

### AC 6: ObservationCard UI Component

**Given** an observation displayed in the frontend
**When** it renders
**Then** the `ObservationCard` shows:
- Type badge (e.g., "Rate Variance") -- colour-coded by type but NEVER red
- Status badge: gold/review variant (Unreviewed), teal/info variant (Reviewed), green/complete variant (Resolved)
- Staff name and MDA
- Factual description (from template)
- Expandable section: possible explanations, suggested next step, data completeness indicator
- Source reference: "Source: {fileName} > {sheetName} > Row {rowNum}"
- Action buttons: "Mark as Reviewed" / "Mark as Resolved" / "Promote to Exception" (based on current status)
**And** the icon is info circle in teal -- NEVER warning triangle
**And** the card background is neutral grey -- NEVER red or amber

### AC 7: Observations in StaffProfilePanel and Dashboard

**Given** observations exist for a staff member
**When** the StaffProfilePanel (Story 3.3) displays their profile
**Then** observations are listed in context alongside the relevant loan/record
**And** the observation count badge in the Master Beneficiary Ledger (Story 3.5) shows the real count (no longer placeholder 0)

### AC 8: Integration Tests

**Given** the observation engine and review workflow
**When** integration tests run
**Then** at minimum:
- Test: rate variance observation generated when `has_rate_variance = true` on migration record
- Test: negative balance observation generated when `outstanding_balance < 0`
- Test: multi-MDA observation generated when person_match exists (confirmed)
- Test: observation templates render with correct data interpolation
- Test: status transition Unreviewed -> Reviewed records reviewer_id and note
- Test: status transition Reviewed -> Resolved requires resolution note
- Test: Promote to Exception creates exception record and changes status to "Promoted"
- Test: duplicate observation not created for same record + type combination (idempotency)
- Test: observation count API matches expected counts by type and status
- Test: MDA-scoped access returns only observations for that MDA

## Tasks / Subtasks

- [x] Task 1: Database schema -- observations table (AC: 1, 2, 3, 4, 5)
  - [x] 1.1 Add `observationTypeEnum` pgEnum to `apps/server/src/db/schema.ts`:
    - Values: `['rate_variance', 'stalled_balance', 'negative_balance', 'multi_mda', 'no_approval_match', 'consecutive_loan']`
  - [x] 1.2 Add `observationStatusEnum` pgEnum:
    - Values: `['unreviewed', 'reviewed', 'resolved', 'promoted']`
  - [x] 1.3 Add `observations` table:
    - `id` (UUIDv7 PK)
    - `type` (observationTypeEnum NOT NULL)
    - `staffName` (varchar 255 NOT NULL)
    - `staffId` (varchar 50 nullable)
    - `loanId` (uuid FK->loans, nullable -- observation may span multiple loans)
    - `mdaId` (uuid FK->mdas NOT NULL)
    - `migrationRecordId` (uuid FK->migration_records, nullable -- links to source record)
    - `uploadId` (uuid FK->migration_uploads, nullable -- links to source upload)
    - `description` (text NOT NULL -- factual description from template)
    - `context` (jsonb NOT NULL -- `{ possibleExplanations: string[], suggestedAction: string, dataCompleteness: number, dataPoints: Record<string, unknown> }`)
    - `sourceReference` (jsonb nullable -- `{ file: string, sheet: string, row: number }`)
    - `status` (observationStatusEnum NOT NULL DEFAULT 'unreviewed')
    - `reviewerId` (uuid FK->users, nullable)
    - `reviewerNote` (text nullable)
    - `reviewedAt` (timestamptz nullable)
    - `resolutionNote` (text nullable)
    - `resolvedAt` (timestamptz nullable)
    - `promotedExceptionId` (uuid nullable -- FK to exceptions table if promoted)
    - `createdAt` (timestamptz NOT NULL DEFAULT NOW())
    - `updatedAt` (timestamptz NOT NULL DEFAULT NOW())
  - [x] 1.4 Add indexes:
    - `idx_observations_type` on (type)
    - `idx_observations_mda_id` on (mda_id)
    - `idx_observations_status` on (status)
    - `idx_observations_staff_name` on (staff_name)
    - `idx_observations_upload_id` on (upload_id)
    - Unique constraint: `(type, migration_record_id)` -- idempotency guard (one observation per type per record)
  - [x] 1.5 Add lightweight `exceptions` table for "Promote to Exception" handoff:
    - `id` (UUIDv7 PK)
    - `observationId` (uuid FK->observations NOT NULL)
    - `staffName` (varchar 255 NOT NULL)
    - `staffId` (varchar 50 nullable)
    - `mdaId` (uuid FK->mdas NOT NULL)
    - `category` (text NOT NULL -- mirrors observation type)
    - `description` (text NOT NULL -- copied from observation)
    - `priority` ('high' | 'medium' | 'low' NOT NULL DEFAULT 'medium')
    - `status` ('open' | 'resolved' NOT NULL DEFAULT 'open')
    - `promotedBy` (uuid FK->users NOT NULL)
    - `createdAt` (timestamptz NOT NULL DEFAULT NOW())
    - `updatedAt` (timestamptz NOT NULL DEFAULT NOW())
  - [x] 1.6 Run `drizzle-kit generate` for migration SQL

- [x] Task 2: Observation engine service (AC: 1)
  - [x] 2.1 Create `apps/server/src/services/observationEngine.ts`:
    - `generateObservations(uploadId, userId)` -- main entry point, generates all 6 types for an upload
    - `generateForType(type, records, context)` -- type-specific detection + template rendering
    - Private detector functions for each type
    - Private template renderer for each type
  - [x] 2.2 Implement **Rate Variance** detector:
    - Source: migration_records where `has_rate_variance = true` and `computed_rate` differs from "13.330"
    - Template interpolation: rate, interestAmount, principal, tenure
    - Data completeness: 100% if principal + totalLoan + monthlyDeduction all present; deduct 25% for each missing field
    - One observation per affected migration_record
  - [x] 2.3 Implement **Stalled Balance** detector:
    - Source: person timelines (from Story 3.3's staffProfileService) where consecutive months have identical outstandingBalance
    - Threshold: 3+ consecutive months with same balance
    - Template interpolation: amount, count, startMonth, endMonth
    - Data completeness: based on timeline coverage (totalMonthsPresent / monthSpan)
    - One observation per person+MDA with stall detected
    - Note: requires timeline data from Story 3.3 -- if timeline not available (pre-baseline), skip this type
  - [x] 2.4 Implement **Negative Balance** detector:
    - Source: migration_records where `outstanding_balance` < 0 (already detected by Story 3.2)
    - Template interpolation: amount (below zero), period, overAmount (absolute value), monthlyDeduction (for estimated months)
    - Port SQ-1 pattern: `crossref.ts:detectOverDeductions()` -- keep most negative per person+MDA
    - Data completeness: 100% if balance + monthlyDeduction present; 50% if only balance
    - One observation per affected person+MDA (deduplicate across records)
  - [x] 2.5 Implement **Multi-MDA** detector:
    - Source: person_matches table (from Story 3.3) where status IN ('auto_confirmed', 'confirmed')
    - Template interpolation: count (number of MDAs), mdaList (comma-separated MDA names)
    - Data completeness: 100% (person matching data is always complete)
    - One observation per multi-MDA person (not per match pair)
  - [x] 2.6 Implement **No Approval Match** detector:
    - Source: loans created from migration (VLC-MIG-*) cross-referenced against approved beneficiary data
    - If approved beneficiary lists are not yet loaded: skip this type (data completeness: 0%)
    - Template interpolation: staffName, mdaName
    - Port SQ-1 pattern: `crossref.ts:performReverseCrossref()` -- search by name in beneficiary index
    - Data completeness: depends on beneficiary list coverage for the MDA
    - One observation per unmatched person
  - [x] 2.7 Implement **Consecutive Loan Without Clearance** detector:
    - Source: person timelines where principal amount changes (new loan) while prior outstanding balance > 0
    - Template interpolation: newPrincipal, newStartPeriod, priorBalance, priorPeriod
    - Data completeness: based on balance data availability
    - One observation per detected consecutive loan pair
  - [x] 2.8 Implement idempotency guard:
    - Before inserting, check for existing observation with same (type, migration_record_id)
    - For person-level observations (multi_mda, stalled, consecutive_loan): use (type, staff_name, mda_id) as dedup key
    - Skip if already exists -- do NOT throw error
  - [x] 2.9 Implement batch generation: process all records in upload, collect observations, insert in batch (single INSERT with multiple values)
  - [x] 2.10 Write unit + integration tests for each detector

- [x] Task 3: Observation review service (AC: 2, 3, 4, 5)
  - [x] 3.1 Create `apps/server/src/services/observationService.ts`:
    - `listObservations(filters, pagination, mdaScope)` -- paginated list with filters
    - `getObservationCounts(mdaScope)` -- aggregate counts by type and status
    - `markAsReviewed(observationId, userId, note?)` -- transition to Reviewed
    - `markAsResolved(observationId, userId, resolutionNote)` -- transition to Resolved
    - `promoteToException(observationId, userId, priority?)` -- create exception + set status to Promoted
  - [x] 3.2 Implement `listObservations`:
    - Pagination: page/pageSize (default 25, max 100) -- same pattern as `searchLoans`
    - Filters: type, mdaId, status, staffName (ILIKE search)
    - Sort: createdAt (default desc), type, staffName, status
    - MDA scoping: `withMdaScope(observations.mdaId, mdaScope)`
  - [x] 3.3 Implement status transitions with validation:
    - Unreviewed -> Reviewed: set reviewerId, reviewerNote (optional), reviewedAt
    - Reviewed -> Resolved: REQUIRE resolutionNote, set resolvedAt
    - Any non-promoted -> Promoted: create exception record, set promotedExceptionId
    - Invalid transitions throw AppError (e.g., can't resolve an unreviewed observation)
  - [x] 3.4 Implement `promoteToException`:
    - Create record in `exceptions` table with observation context
    - Set observation.promotedExceptionId and status = 'promoted'
    - Copy: staffName, staffId, mdaId, description, category from observation type
    - Default priority: 'medium' (can be overridden by reviewer)
  - [x] 3.5 Write unit + integration tests

- [x] Task 4: Observation API routes (AC: 2, 3, 4, 5)
  - [x] 4.1 Create `apps/server/src/routes/observationRoutes.ts`:
    - `GET /api/observations` -- list observations with filters + pagination
    - `GET /api/observations/counts` -- aggregate counts by type and status
    - `PATCH /api/observations/:id/review` -- mark as reviewed
    - `PATCH /api/observations/:id/resolve` -- mark as resolved
    - `POST /api/observations/:id/promote` -- promote to exception
    - `POST /api/observations/generate` -- manually trigger observation generation for an upload
  - [x] 4.2 Apply middleware: `[authenticate, requirePasswordChange, authorise(SUPER_ADMIN, DEPT_ADMIN), scopeToMda, auditLog]`
    - Generate endpoint: DEPT_ADMIN + SUPER_ADMIN only
    - List/counts: DEPT_ADMIN, SUPER_ADMIN (MDA_OFFICER can see their MDA's observations)
    - Review/resolve/promote: DEPT_ADMIN + SUPER_ADMIN only
  - [x] 4.3 Add query validation schemas
  - [x] 4.4 Register routes in `apps/server/src/app.ts`
  - [x] 4.5 Write route integration tests

- [x] Task 5: Shared types and schemas (AC: all)
  - [x] 5.1 Create `packages/shared/src/types/observation.ts`:
    - `ObservationType`: 'rate_variance' | 'stalled_balance' | 'negative_balance' | 'multi_mda' | 'no_approval_match' | 'consecutive_loan'
    - `ObservationStatus`: 'unreviewed' | 'reviewed' | 'resolved' | 'promoted'
    - `ObservationContext`: { possibleExplanations: string[], suggestedAction: string, dataCompleteness: number, dataPoints: Record<string, unknown> }
    - `SourceReference`: { file: string, sheet: string, row: number }
    - `Observation`: full observation record type
    - `ObservationListItem`: summary for list views
    - `ObservationCounts`: { total: number, byType: Record<ObservationType, number>, byStatus: Record<ObservationStatus, number> }
    - `ExceptionRecord`: id, observationId, staffName, staffId, mdaId, category, description, priority, status, promotedBy, createdAt
  - [x] 5.2 Add to `packages/shared/src/validators/observationSchemas.ts`:
    - `observationQuerySchema`: page, pageSize, type, mdaId, status, staffName, sortBy, sortOrder
    - `reviewObservationSchema`: { note?: string }
    - `resolveObservationSchema`: { resolutionNote: string } (required)
    - `promoteObservationSchema`: { priority?: 'high' | 'medium' | 'low' }
    - `generateObservationsSchema`: { uploadId: string }
  - [x] 5.3 Add observation-specific vocabulary to `packages/shared/src/constants/vocabulary.ts`:
    - `OBSERVATION_GENERATED: 'Observations generated for review'`
    - `OBSERVATION_REVIEWED: 'Observation marked as reviewed'`
    - `OBSERVATION_RESOLVED: 'Observation resolved'`
    - `OBSERVATION_PROMOTED: 'Observation promoted to exception for follow-up'`
    - `OBSERVATION_ALREADY_REVIEWED: 'This observation has already been reviewed'`
    - `OBSERVATION_REQUIRES_REVIEW: 'Observation must be reviewed before it can be resolved'`
    - `OBSERVATION_NOT_FOUND: 'The requested observation could not be found'`
    - `NO_APPROVAL_MATCH: 'No matching approval record found'`
    - `BALANCE_BELOW_ZERO: 'Balance below zero'`
  - [x] 5.4 Add to `packages/shared/src/constants/vocabulary.ts` UI_COPY:
    - `OBSERVATION_EMPTY: 'No observations -- all records are clear'`
    - `OBSERVATION_CARD_ICON: 'info'` (not warning)
  - [x] 5.5 Export new types from `packages/shared/src/index.ts`

- [x] Task 6: Frontend -- ObservationCard component (AC: 6)
  - [x] 6.1 Create `apps/client/src/pages/dashboard/components/ObservationCard.tsx`:
    - Layout: follow `AttentionItemCard` pattern (rounded-lg, bg-attention-bg, flex layout)
    - Icon: `Info` from lucide-react in teal -- NEVER warning triangle
    - Type badge: observation type label with `variant="pending"` (neutral grey) -- NOT red
    - Status badge mapping:
      - `unreviewed` -> `variant="review"` (gold-50/gold-dark)
      - `reviewed` -> `variant="info"` (teal-50/teal)
      - `resolved` -> `variant="complete"` (green-50/success)
      - `promoted` -> `variant="variance"` (teal border/bg)
    - Staff name and MDA name inline
    - Description text (factual, from template)
    - Expandable section (use Accordion from shadcn/ui):
      - "Possible explanations" list
      - "Suggested next step" text
      - Data completeness bar (0-100%)
      - Source reference link
    - Action buttons based on status:
      - Unreviewed: "Mark as Reviewed" button
      - Reviewed: "Mark as Resolved" button + "Promote to Exception" button
      - Resolved: no action buttons (show resolution note)
      - Promoted: no action buttons (show "Promoted to Exception" label)
  - [x] 6.2 Create `ReviewDialog` component:
    - Dialog with optional note textarea
    - "Review" / "Cancel" buttons
    - Used when clicking "Mark as Reviewed"
  - [x] 6.3 Create `ResolveDialog` component:
    - Dialog with required resolution note textarea
    - "Resolve" / "Cancel" buttons
    - Validation: resolution note must be non-empty
  - [x] 6.4 Create `PromoteDialog` component:
    - Dialog confirming promotion with priority selector (High/Medium/Low)
    - "Promote to Exception" / "Cancel" buttons
    - Warning text: "This will create a formal exception record for operational follow-up"

- [x] Task 7: Frontend -- Observations page and hooks (AC: 2, 6, 7)
  - [x] 7.1 Create hooks in `apps/client/src/hooks/useObservationData.ts`:
    - `useObservationList(filters)` -- paginated TanStack Query
    - `useObservationCounts()` -- aggregate counts for dashboard metrics
    - `useReviewObservation()` -- mutation
    - `useResolveObservation()` -- mutation
    - `usePromoteObservation()` -- mutation
    - `useGenerateObservations()` -- mutation for manual trigger
  - [x] 7.2 Create observations list view:
    - Either extend MigrationPage with an "Observations" tab
    - Or create a standalone observations section within the migration dashboard
    - Filter bar: type dropdown, MDA dropdown, status dropdown, staff name search
    - ObservationCard list with pagination
    - Metrics strip: total observations, by type (6 counts), by status (4 counts)
  - [x] 7.3 Wire observation counts into Story 3.5's dashboard:
    - Replace placeholder `observationCount: 0` in `MigrationProgressCard` with real count from `GET /api/observations/counts`
    - Replace placeholder `totalObservationsUnreviewed: 0` in beneficiary ledger metrics with real count
  - [x] 7.4 Wire observations into Story 3.3's StaffProfilePanel:
    - Add observations section to person profile: list ObservationCards relevant to this person
    - Observation count badge on the profile header

- [x] Task 8: Verify no regressions (AC: all)
  - [x] 8.1 Run full test suite -- zero regressions
  - [x] 8.2 Verify migration dashboard (Story 3.5) observation counts now show real values
  - [x] 8.3 Verify master beneficiary ledger observation badges show real counts
  - [x] 8.4 Verify StaffProfilePanel (Story 3.3) shows observations in context
  - [x] 8.5 Verify existing loan, MDA, and migration endpoints unaffected

### Review Follow-ups (AI)

- [x] [AI-Review][HIGH] H1+H2: Write observationService.test.ts covering status transitions, idempotency, MDA-scoped, counts [observationService.ts]
- [x] [AI-Review][HIGH] H3+H4+L1: Fix File List false claims and wrong migration path [story file]
- [x] [AI-Review][HIGH] H5: Refactor to batch INSERT with ON CONFLICT DO NOTHING (Task 2.9) [observationEngine.ts]
- [x] [AI-Review][HIGH] H6: Add resolvedBy column to observations, store userId in markAsResolved [schema.ts, observationService.ts]
- [x] [AI-Review][MEDIUM] M1: Fix idempotency error detection to use PG error code 23505 [observationEngine.ts]
- [x] [AI-Review][MEDIUM] M2: Document unique index limitation on nullable migrationRecordId [schema.ts]
- [x] [AI-Review][MEDIUM] M3: Deduplicate getUnreviewedObservationCount — import from observationService [beneficiaryLedgerService.ts]
- [x] [AI-Review][MEDIUM] M4: Pass employeeNo as staffId in rate_variance and negative_balance detectors [observationEngine.ts]
- [x] [AI-Review][MEDIUM] M5: Extract shared getObservationCountsByStaffNames helper [observationService.ts, beneficiaryLedgerService.ts]
- [x] [AI-Review][LOW] L2: Use bg-attention-bg per AttentionItemCard spec [ObservationCard.tsx]

## Dev Notes

### Critical Context

The observation engine is the **intelligence layer** of the migration pipeline. Without it, the admin sees raw numbers (577 rate variances, 142 negative balances) with no context. With it, each number becomes a structured observation with factual description, possible explanations, and a clear next step.

**The "MDA Officer Test":** Every observation must pass this test: *"Would an MDA officer feel defensive looking at this?"* The answer must be NO. Observations are informational, not accusatory. They surface patterns, not blame.

### Observation Template Architecture

Each observation type has a **template renderer** that interpolates data into a structured observation:

```typescript
interface ObservationTemplate {
  type: ObservationType;
  description: string;               // Factual statement, no judgment
  context: {
    possibleExplanations: string[];   // 2-3 non-accusatory explanations
    suggestedAction: string;          // What the admin should do next
    dataCompleteness: number;         // 0-100 (what % of data was available for this observation)
    dataPoints: Record<string, unknown>; // Raw data backing the observation
  };
  sourceReference?: {
    file: string;
    sheet: string;
    row: number;
  };
}
```

**Template rendering is server-side** -- the frontend receives pre-rendered text. This ensures vocabulary compliance is enforced at the source, not the display layer.

### Detection Algorithm Details

**Rate Variance (from Story 3.2 data):**
```typescript
// Already detected by Story 3.2 -- we just read the flags
const records = await db.select().from(migrationRecords)
  .where(and(
    eq(migrationRecords.uploadId, uploadId),
    eq(migrationRecords.hasRateVariance, true),
  ));
// For each record, generate observation with template
```

**Stalled Balance (from person timelines):**
```typescript
// Requires timeline data from Story 3.3's staffProfileService
// Iterate through person's month-by-month snapshots
// Find consecutive months where outstandingBalance is identical
// Threshold: 3+ consecutive identical balances
function detectStalled(months: PersonTimelineEntry[]): { count: number; startMonth: string; endMonth: string; amount: string } | null {
  let streak = 1;
  for (let i = 1; i < months.length; i++) {
    if (months[i].outstandingBalance === months[i-1].outstandingBalance
        && months[i].outstandingBalance !== null) {
      streak++;
      if (streak >= 3) {
        return {
          count: streak,
          startMonth: formatPeriod(months[i - streak + 1]),
          endMonth: formatPeriod(months[i]),
          amount: String(months[i].outstandingBalance),
        };
      }
    } else {
      streak = 1;
    }
  }
  return null;
}
```

**Negative Balance (direct field check):**
```typescript
// Check migration_records where outstanding_balance < 0
// Port SQ-1's detectOverDeductions pattern: keep most negative per person+MDA
const records = await db.select().from(migrationRecords)
  .where(and(
    eq(migrationRecords.uploadId, uploadId),
    sql`CAST(${migrationRecords.outstandingBalance} AS NUMERIC) < 0`,
  ));
```

**Multi-MDA (from person_matches):**
```typescript
// Read confirmed person_matches, group by person
const matches = await db.select().from(personMatches)
  .where(inArray(personMatches.status, ['auto_confirmed', 'confirmed']));
// Group by person name to get unique multi-MDA persons
// Create one observation per person (not per match pair)
```

**No Approval Match:**
- Requires approved beneficiary list data (loaded separately, potentially from SQ-1's cleaned lists)
- If lists not loaded, skip with `dataCompleteness: 0`
- Cross-reference: for each person with migration loan, search in beneficiary name index
- Port SQ-1's `performReverseCrossref()` pattern

**Consecutive Loan Without Clearance:**
```typescript
// From person timeline: detect principal amount changes
// If new principal appears while prior balance > 0 -> consecutive loan
function detectConsecutiveLoan(months: PersonTimelineEntry[]): { found: boolean; details: {...} } {
  let prevPrincipal: number | null = null;
  let prevBalance: number | null = null;
  for (const m of months) {
    if (m.principal !== null && prevPrincipal !== null
        && m.principal !== prevPrincipal
        && prevBalance !== null && prevBalance > 0) {
      return { found: true, details: { newPrincipal: m.principal, priorBalance: prevBalance, ... } };
    }
    if (m.principal !== null) prevPrincipal = m.principal;
    if (m.outstandingBalance !== null) prevBalance = m.outstandingBalance;
  }
  return { found: false };
}
```

### Data Completeness Indicator

Each observation includes a `dataCompleteness` score (0-100%) indicating how much data was available for the detection:

| Observation Type | 100% | 75% | 50% | 25% | 0% |
|---|---|---|---|---|---|
| Rate Variance | principal + totalLoan + monthlyDeduction | 3 of 4 fields | 2 of 4 | 1 of 4 | none |
| Stalled Balance | 6+ months timeline data | 4-5 months | 3 months (minimum) | <3 months | no timeline |
| Negative Balance | balance + monthlyDeduction | balance only | inferred | -- | -- |
| Multi-MDA | confirmed match + both MDAs | auto-confirmed | pending review | -- | -- |
| No Approval Match | beneficiary lists loaded for MDA | partial list | -- | -- | no lists |
| Consecutive Loan | full timeline + principal data | partial timeline | principal only | -- | -- |

### Status Workflow

```
Unreviewed ──────────> Reviewed ──────────> Resolved
     │                      │
     │                      └──────────> Promoted (to Exception)
     │
     └──────────────────────────────────> Promoted (to Exception)
```

**Valid transitions:**
- `unreviewed` -> `reviewed` (add reviewer_id, reviewer_note, reviewed_at)
- `reviewed` -> `resolved` (REQUIRE resolution_note, add resolved_at)
- `unreviewed` -> `promoted` (create exception, skip review -- for urgent cases)
- `reviewed` -> `promoted` (create exception after review)
- `resolved` -> NO further transitions (terminal)
- `promoted` -> NO further transitions (terminal)

### Badge Variant Mapping

Using existing Badge variants from `apps/client/src/components/ui/badge.tsx`:

| Observation Status | Badge Variant | Visual |
|---|---|---|
| Unreviewed | `review` | Gold background, gold-dark text |
| Reviewed | `info` | Teal-50 background, teal text |
| Resolved | `complete` | Green-50 background, success text |
| Promoted | `variance` | Teal border, variance-bg, teal text |

| Observation Type | Badge Variant | Rationale |
|---|---|---|
| All types | `pending` | Neutral grey -- observation types are informational, not severity levels |

**NEVER use `destructive` variant for any observation badge.**

### Idempotency Guard

Observation generation must be safe to retry. The unique constraint on `(type, migration_record_id)` prevents duplicate observations for record-level detections. For person-level detections (multi_mda, stalled_balance, consecutive_loan), use a composite key check:

```typescript
// Before inserting a person-level observation
const existing = await db.select({ id: observations.id })
  .from(observations)
  .where(and(
    eq(observations.type, type),
    eq(observations.staffName, staffName),
    eq(observations.mdaId, mdaId),
    eq(observations.uploadId, uploadId),
  ))
  .limit(1);

if (existing.length > 0) return; // Skip -- already generated
```

### Existing Codebase Patterns to Follow

**Card component:** Follow `AttentionItemCard` pattern:
- `Info` icon from lucide-react in teal
- `rounded-lg bg-attention-bg p-4 transition-colors`
- `flex items-start gap-3` layout
- Badge for category/status
- Description text with muted timestamp

**Exception row:** Follow `ExceptionQueueRow` pattern:
- Border-left colour coding by priority
- Badge for priority + category
- Staff name/ID inline
- Description text
- Timestamp

**Status transition service:** Follow `loanTransitionService.ts` pattern:
- Validate current status before transition
- Record audit trail (who, when, why)
- Return structured transition record

**List API:** Follow `searchLoans` pagination pattern (page/pageSize/sort/filter)

**Aggregate counts:** Use SQL `COUNT(*) FILTER (WHERE ...)` pattern for status/type breakdown in single query

### Non-Punitive Language Requirements

**Vocabulary table (from sprint change proposal):**

| Context | Approved Term | Prohibited Term |
|---------|--------------|-----------------|
| Auto-detected pattern | "Observation" | "Anomaly", "Flag", "Issue" |
| Record marked for review | "For review" | "Flagged", "Suspect" |
| Needs verification | "Requires clarification" | "Suspicious", "Questionable" |
| Deductions past zero | "Balance below zero" | "Over-deduction", "Over-payment" |
| No approved list match | "No matching approval record found" | "Unauthorized loan", "Unapproved" |
| Data pattern detected | "Pattern for review" | "Fraud indicator", "Red flag" |
| Badge colour | Amber/Gold (attention) | Red (NEVER for data observations) |
| Observation status | "Unreviewed / Reviewed / Resolved" | "Open / Flagged / Closed" |

**Template language rules:**
- All templates end with "Verify..." or "Confirm..." or "Cross-check..." (action-oriented)
- All templates include "Possible explanations:" with 2-3 non-accusatory alternatives
- No template uses words: error, mistake, fault, wrong, problem, issue, flag, suspicious, unauthorized

### What NOT To Do

1. **DO NOT use warning icons or red/amber backgrounds** -- info circle in teal only, grey backgrounds only
2. **DO NOT use accusatory language** in templates -- "This loan shows a rate of X%" NOT "This loan has an incorrect rate"
3. **DO NOT generate observations for clean records** -- only for records with detected patterns
4. **DO NOT block baseline creation on observations** -- observations are generated AFTER baseline, not before
5. **DO NOT create the full Epic 7 exception workflow** -- only the lightweight handoff table + promote action
6. **DO NOT generate duplicate observations** -- idempotency guard on (type, migration_record_id) or (type, staffName, mdaId, uploadId)
7. **DO NOT compute financial values with floating point** -- all money arithmetic via `decimal.js`
8. **DO NOT make resolution note optional for "Mark as Resolved"** -- it is required (reviewer must explain what they found)
9. **DO NOT allow direct transition from Unreviewed to Resolved** -- must go through Reviewed first (except Promote)
10. **DO NOT display observation types as severity levels** -- all types are equal, just different pattern categories

### Project Structure Notes

New files:
```
apps/server/src/
  services/
    observationEngine.ts               # Detection algorithms + template rendering
    observationEngine.test.ts
    observationService.ts              # CRUD, status transitions, promotion
    observationService.test.ts
  routes/
    observationRoutes.ts               # Observation API endpoints

apps/client/src/
  hooks/
    useObservationData.ts              # TanStack Query hooks
  pages/dashboard/
    components/
      ObservationCard.tsx              # Observation display card
      ReviewDialog.tsx                 # Mark as Reviewed dialog
      ResolveDialog.tsx                # Mark as Resolved dialog
      PromoteDialog.tsx                # Promote to Exception dialog

packages/shared/src/
  types/
    observation.ts                     # Observation types
  validators/
    observationSchemas.ts              # Zod validation schemas
```

Modified files:
```
apps/server/src/db/schema.ts                       # Add observations + exceptions tables, enums
apps/server/src/app.ts                              # Register observation routes
apps/client/src/hooks/useMigrationData.ts           # Wire observation counts
apps/client/src/pages/dashboard/MigrationPage.tsx   # Add observations tab/section
apps/client/src/pages/dashboard/components/MasterBeneficiaryLedger.tsx  # Wire real observation counts
apps/client/src/components/shared/MigrationProgressCard.tsx             # Wire real observation counts
packages/shared/src/constants/vocabulary.ts         # Add observation vocabulary
packages/shared/src/index.ts                        # Export observation types
```

### Dependencies

- **Depends on:** Story 3.1 (migration_records), Story 3.2 (variance_category, computed_rate, has_rate_variance), Story 3.3 (person_matches, staffProfileService for timelines), Story 3.4 (loans with baselines), Story 3.5 (dashboard with observation count placeholders)
- **Blocks:** Story 3.7 (trace report includes observations summary)
- **Handoff to:** Epic 7 (exceptions table created here, full exception management workflow in Epic 7)
- **Reuses:** `AttentionItemCard` visual pattern, `searchLoans` pagination pattern, `loanTransitionService` status transition pattern, `withMdaScope` MDA scoping

### Previous Story Intelligence

**From Story 3.1:**
- `migration_records` with `source_file`, `source_sheet`, `source_row` for source reference
- Financial values: `principal`, `total_loan`, `monthly_deduction`, `outstanding_balance`, `installments_remaining`

**From Story 3.2:**
- `variance_category`: clean, minor_variance, significant_variance, structural_error, anomalous
- `computed_rate`: effective interest rate detected from declared values
- `has_rate_variance`: boolean flag (true if rate differs from 13.33%)
- `computed_total_loan`, `computed_monthly_deduction`, `computed_outstanding_balance`

**From Story 3.3:**
- `person_matches` table with match_type, confidence, status
- `staffProfileService.getPersonTimeline()` -- month-by-month presence data
- Person key: `${mdaCode}:${normalizedName}`

**From Story 3.4:**
- Loans created from migration data with `VLC-MIG-{year}-{seq}` references
- `is_baseline_created` flag on migration_records

**From Story 3.5:**
- Dashboard with `observationCount: 0` placeholder on MigrationProgressCard
- Beneficiary ledger with `totalObservationsUnreviewed: 0` placeholder
- These placeholders must be wired to real observation counts after this story

**From SQ-1 Analysis (crossref.ts):**
- 577 rate variance cases (6 distinct rates: 13.33%, 11.11%, 8.0%, 8.89%, 10.66%, 6.67%)
- 203 stalled balance cases (balance unchanged 3+ months)
- 142 negative balance cases (total estimated over-deduction amount available)
- 425 multi-MDA staff (14.4% of 2,952)
- 368 no-approval-match cases (deducted but never on approved list)

### References

- [Source: `apps/client/src/components/shared/AttentionItemCard.tsx`] -- Card component pattern (Info icon, teal, grey bg)
- [Source: `apps/client/src/components/shared/ExceptionQueueRow.tsx`] -- Exception row pattern (priority border, badges)
- [Source: `apps/client/src/components/ui/badge.tsx`] -- Badge variants: review (gold), info (teal), complete (green), pending (grey)
- [Source: `apps/server/src/services/loanTransitionService.ts`] -- Status transition pattern with audit trail
- [Source: `apps/server/src/services/loanService.ts:207-334`] -- searchLoans pagination + aggregate pattern
- [Source: `scripts/legacy-report/crossref.ts:499-548`] -- detectOverDeductions (negative balance detection)
- [Source: `scripts/legacy-report/crossref.ts:550-588`] -- analyzeTenure (stalled/beyond-tenure detection)
- [Source: `scripts/legacy-report/crossref.ts:730-732`] -- performReverseCrossref (no-approval-match detection)
- [Source: `scripts/legacy-report/crossref.ts:431-497`] -- buildTimelines (person timeline construction)
- [Source: `packages/shared/src/constants/vocabulary.ts`] -- Existing non-punitive vocabulary
- [Source: `_bmad-output/planning-artifacts/epics.md:1963-2000`] -- Epic 3 Story 3.6 acceptance criteria
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-02-28.md:581-633`] -- Story 3.6 NEW scope + observation templates
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-02-28.md:196-213`] -- Observations table schema
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-02-28.md:390-401`] -- Non-punitive vocabulary table
- [Source: `_bmad-output/implementation-artifacts/3-3-staff-loan-profile-cross-mda-timeline.md`] -- Person matching, timeline service
- [Source: `_bmad-output/implementation-artifacts/3-5-migration-dashboard-master-beneficiary-ledger.md`] -- Dashboard observation count placeholders

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- TS2345: `req.params.id` type `string | string[]` not assignable to `string` — fixed by casting `as string` in route handlers
- TS6133: Unused `sql` import in observationEngine.ts — removed from import
- TS6133: Unused `userId` parameter in `markAsResolved` — renamed to `_userId`
- drizzle-kit generate/migrate commands needed direct `npx` invocation with `DATABASE_URL` prefix

### Completion Notes List

- All 8 tasks complete with all subtasks
- 4 pure detector functions (rate_variance, negative_balance, stalled_balance, consecutive_loan) implemented with non-punitive templates
- Multi-MDA detector queries person_matches table for confirmed matches
- No Approval Match detector skipped (approved beneficiary list data not yet loaded; left comment for future enablement)
- Idempotency: DB unique constraint on (type, migration_record_id) for record-level + application-level dedup for person-level observations
- Observation counts wired into Story 3.5's MigrationProgressCard and beneficiary ledger (replaced placeholder 0s)
- StaffProfilePanel wired with observation list and count badge
- Server: 813 tests passed (59 files), including 15 new observationEngine tests
- Client: 380 tests passed (60 files), including 2 new useObservationData tests
- All type checks pass (server, client, shared)
- Migration 0013_superb_iron_man.sql generated and applied successfully

### File List

**New files:**
- `apps/server/drizzle/0013_superb_iron_man.sql` — migration for observations + exceptions tables
- `apps/server/drizzle/meta/0013_snapshot.json` — Drizzle migration snapshot
- `apps/server/src/services/observationEngine.ts` — detection algorithms + template rendering (~450 lines)
- `apps/server/src/services/observationEngine.test.ts` — 15 unit tests for 4 detectors + non-punitive language
- `apps/server/src/services/observationService.ts` — CRUD, status transitions, promotion (~300 lines)
- `apps/server/src/routes/observationRoutes.ts` — 6 observation API endpoints
- `apps/client/src/hooks/useObservationData.ts` — 6 TanStack Query hooks
- `apps/client/src/hooks/useObservationData.test.tsx` — 2 hook initialisation tests
- `apps/client/src/pages/dashboard/components/ObservationCard.tsx` — observation display card
- `apps/client/src/pages/dashboard/components/ReviewDialog.tsx` — mark as reviewed dialog
- `apps/client/src/pages/dashboard/components/ResolveDialog.tsx` — mark as resolved dialog
- `apps/client/src/pages/dashboard/components/PromoteDialog.tsx` — promote to exception dialog
- `apps/client/src/pages/dashboard/components/ObservationsList.tsx` — full observations list view with filters
- `packages/shared/src/types/observation.ts` — observation types and interfaces
- `packages/shared/src/validators/observationSchemas.ts` — Zod validation schemas

**Modified files:**
- `apps/server/src/db/schema.ts` — added 4 enums (observation_type, observation_status, exception_priority, exception_status) + 2 tables (observations, exceptions) + resolvedBy column (code review fix)
- `apps/server/src/app.ts` — registered observation routes
- `apps/server/src/services/beneficiaryLedgerService.ts` — wired real observation counts into ledger + CSV export
- `apps/server/src/services/migrationDashboardService.ts` — wired real observation counts into dashboard
- `apps/client/src/pages/dashboard/MigrationPage.tsx` — added Observations tab
- `apps/client/src/pages/dashboard/components/StaffProfilePanel.tsx` — wired observations section + count badge
- `apps/client/src/pages/dashboard/components/ObservationCard.tsx` — bg-attention-bg fix (code review)
- `packages/shared/src/constants/vocabulary.ts` — added 9 VOCABULARY + 2 UI_COPY observation constants
- `packages/shared/src/index.ts` — exported observation types and validators
- `apps/server/drizzle/meta/_journal.json` — updated migration journal

### Change Log

| # | What | Why |
|---|------|-----|
| 1 | Added observations + exceptions tables with 4 enums | AC 1, 3 — Persistence layer for observation engine with idempotency guard |
| 2 | Built observation engine with 5 detector functions | AC 1 — Rate variance, stalled balance, negative balance, multi-MDA, consecutive loan detectors with non-punitive templates |
| 3 | Built observation service with status transitions | AC 2, 3, 4, 5 — list, counts, review, resolve, promote with MDA scoping |
| 4 | Created 6 observation API routes | AC 2, 3, 4, 5 — RESTful endpoints with auth and validation |
| 5 | Created shared types and Zod schemas | All ACs — Type-safe observation data flow |
| 6 | Built ObservationCard + 3 dialog components | AC 6 — Non-punitive UI with info icon (teal), expandable details, action buttons |
| 7 | Built ObservationsList view + hooks | AC 2, 6, 7 — Paginated list with filters, metrics strip, type breakdown |
| 8 | Wired observation counts into dashboard + ledger + StaffProfilePanel | AC 7 — Replaced placeholder 0s with real data |
| 9 | Code review fixes: batch insert, resolvedBy audit trail, staffId mapping, deduplication, test coverage | AI code review — H1-H6, M1-M5, L1-L2 |
