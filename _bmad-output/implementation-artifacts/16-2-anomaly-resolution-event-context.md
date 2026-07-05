# Story 16.2: Anomaly Resolution & Event Context

Status: ready-for-dev

## Story

As the **MDA Accounting Officer / Department Admin**,
I want to review cross-month findings and mark them as expected or resolved with explanations,
so that the system distinguishes between genuine issues and legitimate data changes, maintaining an audit trail of all review decisions.

**Origin:** Discovery spike 16.0 (2026-04-02). Modelled after Story 8.0j's mandatory-reason correction pattern.

**Dependencies:** Story 16.1 (cross-month diffing engine must exist first).

## Acceptance Criteria

### AC1: Finding Detail View

**Given** a cross-month finding is opened,
**Then** the detail shows: staff name/ID, MDA, finding type with non-punitive label, severity badge, previous month values vs current month values (side-by-side), auto-linked employment event (if any) with explanation text, and current review status.

### AC2: "Mark Expected" with Mandatory Explanation

**Given** a finding where the change is legitimate (e.g. staff retired, deduction amount corrected by MDA),
**When** the reviewer clicks "Mark Expected",
**Then** a mandatory explanation field (min 10 chars) is required. On save: status → `expected`, `reviewed_by` = userId, `reviewed_at` = now, `resolution_note` = explanation.

### AC3: "Mark Resolved" with Resolution Note

**Given** a finding that requires follow-up action (e.g. MDA contacted, data to be corrected in next submission),
**When** the reviewer clicks "Mark Resolved",
**Then** a mandatory resolution note (min 10 chars) is required. On save: status → `resolved`, `reviewed_by`, `reviewed_at`, `resolution_note` set.

### AC4: Bulk Mark by Type + MDA

**Given** multiple findings of the same type for the same MDA (e.g. 20 disappearing beneficiaries all explained by a retirement batch),
**When** the reviewer selects multiple findings and clicks "Mark All Expected" or "Mark All Resolved",
**Then** a single explanation/note is applied to all selected findings in one transaction.

### AC5: Auto-Resolution on Event Filing

**Given** an unreviewed `disappearing_beneficiary` finding for staff X,
**When** an employment event (RETIRED, TRANSFERRED_OUT, DECEASED, DISMISSED, LWOP_START) is subsequently filed for staff X,
**Then** the finding is auto-updated: status → `expected`, `auto_linked_event_id` set, `auto_explanation` updated, `resolution_note` = "Auto-resolved: {eventType} event filed on {date}".

### AC6: MDA-Scoped Access

**Given** an MDA_OFFICER (`mda_officer` role) reviewing findings,
**Then** they see only findings for their assigned MDA (via `scopeToMda`). DEPT_ADMIN and SUPER_ADMIN see all MDAs.

### AC7: Resolution Audit Trail

**Given** any status change on a finding,
**Then** `reviewed_by` (userId), `reviewed_at` (timestamp), `resolution_note` are immutably recorded. The finding's previous status is preserved in context (the `updated_at` timestamp shows when status last changed).

## Tasks / Subtasks

- [ ] **Task 1 — Resolution Service** (AC: 2,3,4,5,7)
  - [ ] 1.1 Create `apps/server/src/services/crossMonthResolutionService.ts`
  - [ ] 1.2 `markExpected(findingId, explanation, userId, mdaScope)` — validates min 10 chars, updates status/reviewedBy/reviewedAt/resolutionNote in transaction with row lock
  - [ ] 1.3 `markResolved(findingId, resolutionNote, userId, mdaScope)` — same pattern as markExpected but status = 'resolved'
  - [ ] 1.4 `bulkMarkExpected(findingIds, explanation, userId, mdaScope)` — single transaction, validates all findings belong to same MDA (if MDA_OFFICER), updates all
  - [ ] 1.5 `bulkMarkResolved(findingIds, resolutionNote, userId, mdaScope)` — same pattern

- [ ] **Task 2 — Finding Detail Endpoint** (AC: 1,6)
  - [ ] 2.1 `getFindingDetail(findingId, mdaScope)` — returns full finding with joined staff name, MDA name, event details
  - [ ] 2.2 Include previous_value and current_value JSONBs parsed for display
  - [ ] 2.3 Include auto-linked event details (event type, effective date, filed by)
  - [ ] 2.4 MDA scope enforcement: MDA_OFFICER can only access own-MDA findings

- [ ] **Task 3 — Auto-Resolution Hook** (AC: 5)
  - [ ] 3.1 **Hook point 1:** In `apps/server/src/services/employmentEventService.ts` → `createEmploymentEvent()` (insert at ~line 111). After the event is successfully created inside the transaction, add a post-commit hook (or after-transaction call) to trigger auto-resolution.
  - [ ] 3.2 **Hook point 2:** In `employmentEventService.ts` → `claimTransferIn()` (insert at ~line 299). Same auto-resolution call after the TRANSFERRED_IN event is created.
  - [ ] 3.3 **NOT needed:** The reconciliation engine (`reconciliationEngine.ts`) only UPDATES existing events' `reconciliationStatus` — it does NOT create new events. No hook needed there.
  - [ ] 3.4 **NOT needed:** `confirmTransfer()` completes a transfer but does not create a new employment event — it updates the transfer record. Auto-resolution fires on event creation only.
  - [ ] 3.5 Query `cross_month_findings` for unreviewed `disappearing_beneficiary` findings matching the `staff_id + mda_id`
  - [ ] 3.6 For each match: set status = 'expected', `auto_linked_event_id`, `auto_explanation`, `resolution_note` = "Auto-resolved: {eventType} event filed on {date}"
  - [ ] 3.7 Awaited-but-failure-safe pattern — event filing succeeds even if auto-resolution fails:
    ```typescript
    try {
      await autoResolveCrossMonthFindings(staffId, mdaId, eventId, eventType, effectiveDate);
    } catch (err) {
      logger.warn({ err, staffId }, 'Cross-month auto-resolution failed (non-blocking)');
    }
    ```

- [ ] **Task 4 — API Routes** (AC: 1,2,3,4,6)
  - [ ] 4.1 `GET /api/cross-month/findings/:findingId` — finding detail (reviewAuth: SUPER_ADMIN, DEPT_ADMIN, MDA_OFFICER)
  - [ ] 4.2 `PATCH /api/cross-month/findings/:findingId/mark-expected` — mark expected with explanation (reviewAuth)
  - [ ] 4.3 `PATCH /api/cross-month/findings/:findingId/mark-resolved` — mark resolved with note (reviewAuth)
  - [ ] 4.4 `POST /api/cross-month/findings/bulk-mark` — bulk mark expected/resolved (reviewAuth)
  - [ ] 4.5 Zod request validation: `markExpectedSchema` (explanation min 10 chars), `markResolvedSchema` (note min 10 chars), `bulkMarkSchema` (findingIds array + explanation/note)

- [ ] **Task 5 — Shared Types & Schemas** (AC: all)
  - [ ] 5.1 Add `MarkExpectedRequest`, `MarkResolvedRequest`, `BulkMarkRequest` types
  - [ ] 5.2 Add `FindingDetailResponse` type with joined event and staff data
  - [ ] 5.3 Add Zod schemas for request validation

- [ ] **Task 6 — Frontend Hooks** (AC: all)
  - [ ] 6.1 `useFindingDetail(findingId)` query
  - [ ] 6.2 `useMarkExpected()` mutation
  - [ ] 6.3 `useMarkResolved()` mutation
  - [ ] 6.4 `useBulkMark()` mutation
  - [ ] 6.5 Invalidation: refetch findings list + detail + attention items on mutation success

- [ ] **Task 7 — FindingDetailDrawer Component** (AC: 1,2,3)
  - [ ] 7.1 Create `apps/client/src/pages/dashboard/components/FindingDetailDrawer.tsx` — shadcn Sheet (right-side drawer, matching RecordDetailDrawer pattern)
  - [ ] 7.2 Header: finding type badge (non-punitive label), severity badge (amber/teal), status badge
  - [ ] 7.3 Personnel section: staff name, staff ID, MDA, grade (if available from submission row)
  - [ ] 7.4 Comparison section: side-by-side previous month vs current month values (amountDeducted, eventFlag, month)
  - [ ] 7.5 Auto-explanation section: if auto-linked event, show event type + effective date + explanation text in teal info box
  - [ ] 7.6 Action buttons: "Mark Expected" → opens explanation textarea, "Mark Resolved" → opens resolution note textarea
  - [ ] 7.7 Review history section: if already reviewed, show who/when/note (read-only)

- [ ] **Task 8 — Bulk Action UI** (AC: 4)
  - [ ] 8.1 Checkbox selection on findings list (from Story 16.3, but the mutation logic lives here)
  - [ ] 8.2 "Mark Selected as Expected" / "Mark Selected as Resolved" buttons (visible when ≥1 selected)
  - [ ] 8.3 Single explanation/note dialog for bulk action
  - [ ] 8.4 Success toast with count of findings updated

- [ ] **Task 9 — Integration Tests** (AC: 1,2,3,4,5,6,7)
  - [ ] 9.1 Test markExpected: verify status change, audit trail fields set, min 10 char validation
  - [ ] 9.2 Test markResolved: same pattern
  - [ ] 9.3 Test bulk mark: multiple findings updated in single transaction
  - [ ] 9.4 Test auto-resolution: file employment event → verify matching finding auto-resolved
  - [ ] 9.5 Test MDA scoping: MDA_OFFICER cannot mark findings outside own MDA

- [ ] **Task 10 — Vocabulary Constants** (AC: all)
  - [ ] 10.1 Add resolution action labels to `packages/shared/src/constants/vocabulary.ts`:
    - `CROSS_MONTH_MARK_EXPECTED`: "Mark Expected" (not "Dismiss" or "Ignore")
    - `CROSS_MONTH_MARK_RESOLVED`: "Mark Resolved" (not "Close" or "Fix")
    - `CROSS_MONTH_EXPLANATION_PLACEHOLDER`: "Explain why this change is expected..."
    - `CROSS_MONTH_RESOLUTION_PLACEHOLDER`: "Describe the resolution..."
    - `CROSS_MONTH_AUTO_RESOLVED`: "Auto-resolved: {eventType} event filed on {date}"
  - [ ] 10.2 Add status badge labels:
    - `CROSS_MONTH_STATUS_UNREVIEWED`: "Unreviewed"
    - `CROSS_MONTH_STATUS_EXPECTED`: "Expected"
    - `CROSS_MONTH_STATUS_RESOLVED`: "Resolved"
  - [ ] 10.3 Import and use these constants in service + UI — never hardcode label strings

- [ ] **Task 11 — Unit Tests** (AC: 2,3,5)
  - [ ] 11.1 Test explanation validation (min 10 chars, required)
  - [ ] 11.2 Test auto-resolution matching logic (staff_id + mda_id + unreviewed status)
  - [ ] 11.3 Test bulk mark input validation (all findingIds must exist, same MDA for MDA_OFFICER)

## Dev Notes

### Prep Story Context (15.0a–15.0n)

- **15.0n:** Correction reason is now mandatory for ALL record corrections (not just flagged). If 16.2's resolution workflow includes record corrections, enforce the same `correctionReason: z.string().min(10)` pattern.
- **15.0g:** MDA Review tab auto-selects for MDA officers via `?tab=mda-review` URL param. If 16.2 adds a cross-month findings tab, support the same `?tab=` pattern for deep-linking.

### Resolution vs Observation Review Pattern

The resolution workflow is modelled after the existing `observations` review pattern but simplified:
- Observations have 4 statuses: unreviewed → reviewed → resolved → promoted
- Cross-month findings have 3 statuses: unreviewed → expected / resolved
- "Expected" = change is legitimate, no action needed (analogous to observation "reviewed")
- "Resolved" = change required follow-up that is now complete (analogous to observation "resolved")
- No "promoted" concept — cross-month findings don't promote to exceptions

### Auto-Resolution Hook Points

Two event creation paths in `apps/server/src/services/employmentEventService.ts`:

1. **`createEmploymentEvent()`** (~line 111) — manual filing via API. Event is inserted inside a `withTransaction()` block. Add the auto-resolution call AFTER the transaction commits successfully (not inside it, to avoid coupling the cross-month resolution with event creation atomicity).

2. **`claimTransferIn()`** (~line 299) — transfer claim. Creates a `TRANSFERRED_IN` event. Same pattern — hook after transaction.

Both paths have `staffId`, `mdaId`, `eventType`, `effectiveDate` available. The auto-resolution is awaited-but-failure-safe (event filing succeeds even if auto-resolution fails).

### MDA Scope Enforcement

Reuse the existing `reviewAuth` pattern from Story 8.0j:
```typescript
const reviewAuth = [authenticate, requirePasswordChange, authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN, ROLES.MDA_OFFICER), scopeToMda];
```

In service functions, always filter by `mdaScope`:
```typescript
if (mdaScope) {
  conditions.push(eq(crossMonthFindings.mdaId, mdaScope));
}
```

### Mandatory Explanation Pattern

Same pattern as Story 8.0j's mandatory correction reason:
- Zod schema: `z.string().min(10, 'Explanation must be at least 10 characters')`
- Frontend: textarea with character count, disabled submit button until ≥10 chars
- Non-punitive placeholder: "Explain why this change is expected…" or "Describe the resolution…"

### Transaction Scope

- Individual mark: transaction wraps row lock + status update (single query)
- Bulk mark: transaction wraps all updates (batch update with `IN` clause)
- Auto-resolution: runs outside event filing transaction (awaited-but-failure-safe — event filing succeeds even if auto-resolution fails)

### Non-Punitive Vocabulary

- "Mark Expected" not "Dismiss" or "Ignore"
- "Mark Resolved" not "Close" or "Fix"
- "Explanation" not "Justification"
- "Resolution note" not "Fix description"
- Status badges: teal for "Expected", teal for "Resolved", amber for "Unreviewed"

### Project Structure Notes

- New service: `apps/server/src/services/crossMonthResolutionService.ts` (resolution + auto-resolution logic)
- New routes: `apps/server/src/routes/crossMonthRoutes.ts` (findings detail + mark expected/resolved + bulk mark)
- New shared types: extend `packages/shared/src/types/crossMonth.ts` (add request/response types for resolution)
- New shared schemas: extend `packages/shared/src/validators/crossMonthSchemas.ts` (Zod schemas for resolution requests)
- New component: `apps/client/src/pages/dashboard/components/FindingDetailDrawer.tsx` (shadcn Sheet)
- New hooks: `apps/client/src/hooks/useCrossMonthFindings.ts` (query + mutations)
- Hooks into: `apps/server/src/services/employmentEventService.ts` (two auto-resolution hooks)

### Status Transition Simplicity

Observations enforce multi-step transitions: `unreviewed → reviewed → resolved → promoted` (must go through each step in order — `observationService.ts` rejects out-of-order transitions). Cross-month findings are simpler — **single-step from unreviewed to either terminal state:**
- `unreviewed → expected` (legitimate change)
- `unreviewed → resolved` (follow-up completed)

Both are terminal. No "promoted" concept. Do NOT implement transition guards beyond checking current status is `unreviewed`.

### References

All line numbers below are approximate — parallel stories modify these files. Use `grep` to locate targets at implementation time.

- [Source: apps/server/src/services/observationService.ts] — Observation review pattern: `markAsReviewed()` (~line 200), `markAsResolved()` (~line 235). Status enforcement pattern to follow (but simpler — see O1 note above).
- [Source: apps/server/src/services/employmentEventService.ts] — Two event creation paths: `createEmploymentEvent()` (~line 111), `claimTransferIn()` (~line 299). Grep for `insert(employmentEvents)` to find exact locations.
- [Source: apps/server/src/db/schema.ts] — `employment_events` table (grep for `employmentEvents`), `observation_status` enum (grep for `observationStatusEnum`)
- [Source: apps/server/src/middleware/scopeToMda.ts] — MDA data isolation
- [Source: apps/server/src/routes/observationRoutes.ts] — `viewAuth` middleware chain (~line 29): exact pattern for cross-month resolution auth
- [Source: Story 8.0j — AC3,AC4] — Mandatory explanation pattern (min 10 chars, `correction_reason`)
- [Source: Story 16.1] — `cross_month_findings` table schema and finding types
- [Source: apps/client/src/pages/dashboard/components/RecordDetailDrawer.tsx] — Drawer component pattern (shadcn Sheet, right-side)

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
