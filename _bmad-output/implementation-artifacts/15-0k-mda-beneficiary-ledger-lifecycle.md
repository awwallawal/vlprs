# Story 15.0k: MDA Beneficiary Ledger with Lifecycle Awareness

Status: done

## Story

As an **MDA Officer**,
I want a beneficiary ledger scoped to my MDA showing active staff, completed loans (with certificate status), transferred-out staff (with destination MDA and date), and consecutive loan history,
So that I have a complete picture of every person who has ever had a loan through my MDA.

**Origin:** UAT Findings #35, #37 (Medium) from E8 retro. `beneficiaryLedgerService` already supports `withMdaScope`. Needs: lifecycle grouping (active/completed/transferred), transfer history section using `transfers` + `employment_events` tables.

**Priority:** MEDIUM — enriches MDA officer experience with loan lifecycle context.

## Acceptance Criteria

1. **Given** the MDA Beneficiary Ledger, **When** rendered for an MDA officer (or admin with MDA filter), **Then** each beneficiary row shows a lifecycle status badge: Active, Completed, Transferred Out, Transfer Pending, or Inactive (Retired/Deceased/Suspended/LWOP).

2. **Given** a beneficiary with a COMPLETED loan, **When** their row is displayed, **Then** it shows completion date and certificate status (Issued / Pending / Not Generated).

3. **Given** a beneficiary who transferred out, **When** the ledger renders, **Then** their row shows: "Transferred to [Destination MDA] on [date]" with transfer status (Pending/Completed). Transferred staff do NOT vanish — they appear in a "Transferred Out" section or with a filter toggle.

4. **Given** a beneficiary with consecutive loans (detected by observation engine), **When** their row is displayed, **Then** a "Consecutive Loan" flag/badge is visible.

5. **Given** the beneficiary ledger, **When** a "Status" filter is applied (Active / Completed / Transferred / All), **Then** the list filters by loan lifecycle status.

6. **Given** all existing beneficiary ledger tests, **When** the lifecycle enhancements are applied, **Then** all tests pass with zero regressions.

## Current State

### What Exists

| Component | File | Status |
|-----------|------|--------|
| `useBeneficiaryList(filters)` hook | `hooks/useBeneficiaryData.ts:26-32` | Working — paginated, MDA-scoped |
| `useBeneficiaryMetrics()` hook | `hooks/useBeneficiaryData.ts:35-41` | Working — metrics strip |
| `useExportBeneficiaries()` | `hooks/useBeneficiaryData.ts:44-62` | Working — CSV download |
| `listBeneficiaries()` service | `services/beneficiaryLedgerService.ts:41-264` | Working — `withMdaScope` applied |
| `MasterBeneficiaryLedger` component | `pages/dashboard/components/MasterBeneficiaryLedger.tsx` | Working — search, sort, paginate, export |
| `BeneficiaryListItem` type | `packages/shared/src/types/mda.ts:152-170` | Has staffName, staffId, loanCount, totalExposure, isMultiMda, observationCount |
| `transfers` table | `schema.ts:723-744` | Has outgoingMdaId, incomingMdaId, status (PENDING/COMPLETED) |
| `employment_events` table | `schema.ts:697-720` | Has TRANSFERRED_OUT/TRANSFERRED_IN event types |
| `loan_completions` table | `schema.ts:808-825` | Has completionDate per loan |
| `auto_stop_certificates` table | `schema.ts:827-858` | Has certificateId per loan |
| `detectConsecutiveLoan()` | `observationEngine.ts:607-692` | Generates consecutive_loan observations |
| Loan status enum | `schema.ts:84-89` | ACTIVE, COMPLETED, TRANSFERRED, TRANSFER_PENDING, RETIRED, etc. |

### What's Missing

| Gap | Type | Effort |
|-----|------|--------|
| Loan status on each beneficiary row | Backend service enhancement | Medium |
| Completion date + certificate status per loan | Backend JOIN | Medium |
| Transfer destination MDA + date | Backend JOIN (transfers + mdas) | Medium |
| Consecutive loan flag | Backend JOIN (observations) | Low |
| Status filter query param | Backend route + service | Low |
| Lifecycle badges on rows | Frontend component | Low |
| "Transferred Out" visibility | Frontend section/filter | Low |
| Status filter dropdown | Frontend component | Low |

## Tasks / Subtasks

- [x] Task 1: Extend `BeneficiaryListItem` type with lifecycle fields (AC: 1, 2, 3, 4)
  - [x] 1.1: In `packages/shared/src/types/mda.ts`, extend `BeneficiaryListItem` with 7 lifecycle fields + `BeneficiaryLoanStatus` and `CertificateStatus` types
  - [x] 1.2: Exported `BeneficiaryLoanStatus` and `CertificateStatus` from `packages/shared/src/index.ts`. Type extension compiles cleanly.
  - [x] 1.3: Implemented `deriveBeneficiaryLoanStatus()` with priority: ACTIVE > TRANSFER_PENDING > TRANSFERRED > COMPLETED > INACTIVE. Pre-active statuses (APPLIED, APPROVED) treated as ACTIVE.

- [x] Task 2: Enhance `listBeneficiaries()` service to include lifecycle data (AC: 1, 2, 3, 4)
  - [x] 2.1: Two-phase fetch: Phase 1 is existing paginated query, Phase 2 batch-fetches loan statuses, completions, certificates, transfers+mdas for the page of results
  - [x] 2.2: Batch-query observations table for `consecutive_loan` type, scoped to staff names in current page
  - [x] 2.3: `deriveBeneficiaryLoanStatus()` collapses 11 DB enum values to 5 display values using priority map
  - [x] 2.4: `completionDate` populated from `loan_completions`, formatted as ISO date string (date only)
  - [x] 2.5: `certificateStatus`: `'issued'` if certificate exists, `'pending'` if COMPLETED without cert, `null` otherwise
  - [x] 2.6: Transfer fields populated from `transfers` JOIN with `mdas` for destination name. Keyed by `staffId`.

- [x] Task 3: Add status filter to beneficiary endpoint (AC: 5)
  - [x] 3.1: Added `loanStatus` to `beneficiaryQuerySchema` in `packages/shared/src/validators/migrationSchemas.ts`. Route handler passes to service.
  - [x] 3.2: Status filter applied in `listBeneficiaries()`: ACTIVE → `IN ('ACTIVE', 'APPROVED', 'APPLIED')`, COMPLETED → `= 'COMPLETED'`, TRANSFERRED → `IN ('TRANSFERRED', 'TRANSFER_PENDING')`, ALL/absent → no filter

- [x] Task 4: Update frontend `MasterBeneficiaryLedger` component (AC: 1, 2, 3, 4, 5)
  - [x] 4.1: Status filter dropdown added to filter bar (All Staff / Active / Completed / Transferred)
  - [x] 4.2: `LifecycleBadge` component renders 5 variants: Active (green/complete), Completed (teal), Transferred (amber/review), Transfer Pending (amber outline), Inactive (gray/pending)
  - [x] 4.3: Consecutive loan badge shown inline with status badge
  - [x] 4.4: Certificate status shown as green CheckCircle (issued) or amber Clock (pending) icons
  - [x] 4.5: Transfer destination MDA + date shown below status badge for transferred rows
  - [x] 4.6: `loanStatus` filter passed to `useBeneficiaryList(filters)` hook

- [x] Task 5: Update hook to support status filter (AC: 5)
  - [x] 5.1: Added `loanStatus` to `BeneficiaryFilters` interface and `buildQueryString()` in `useBeneficiaryData.ts`

- [x] Task 6: Tests (AC: 6)
  - [x] 6.1: Integration test verifies all 3 lifecycle states (ACTIVE, COMPLETED, TRANSFERRED) with correct fields including completion date, certificate status, transfer destination, and consecutive loan flag
  - [x] 6.2: Integration tests verify status filter for ACTIVE (1 result), COMPLETED (1 result), TRANSFERRED (1 result), ALL (3 results)
  - [x] 6.3: Full test suite: 1052 unit tests pass, 628 integration tests pass — zero regressions

## Review Follow-ups (AI)

- [x] [AI-Review][HIGH] H1: Status filter operates at loan level (WHERE clause), not derived person-level lifecycle status — violates AC5. A person with ACTIVE+COMPLETED loans incorrectly appears under COMPLETED filter. Fix: use HAVING clause with bool_or() to filter by priority-derived lifecycle status. [`beneficiaryLedgerService.ts:102-109`]
- [x] [AI-Review][HIGH] H2: Phase 2a re-fetches loan statuses from loans table — redundant with Phase 1 loan details query. Fix: include `status` in Phase 1 query, remove Phase 2a entirely. [`beneficiaryLedgerService.ts:261-268`]
- [x] [AI-Review][MEDIUM] M1: CSV export doesn't include loanStatus filter — export route omits loanStatus param, export service ignores it. Fix: pass loanStatus in export route handler and add per-loan status filter in exportBeneficiariesCsv. [`migrationDashboardRoutes.ts:213-219`, `beneficiaryLedgerService.ts:484-627`]
- [x] [AI-Review][MEDIUM] M2: Phase 2 queries (completions, certificates, transfers, consecutive flags) run sequentially — 4 independent DB round-trips. Fix: wrap in Promise.all() for concurrent execution. [`beneficiaryLedgerService.ts:270-333`]
- [x] [AI-Review][MEDIUM] M3: allLoanIdsFlat duplicates groupLoanIds — same loan_ids parsed 3 times. Fix: reuse allLoanIds from Phase 1 for Phase 2 queries. [`beneficiaryLedgerService.ts:256-258`]
- [x] [AI-Review][LOW] L1: Unsafe cast of transfer.status as 'PENDING' | 'COMPLETED' — no runtime validation. Fix: validate before assigning. [`beneficiaryLedgerService.ts:394`]
- [x] [AI-Review][LOW] L2: LifecycleBadge switch has no default case — silent render failure if new status added. Fix: add default return null. [`MasterBeneficiaryLedger.tsx:14-27`]

## Dev Notes

### Backend Enhancement Strategy: Two-Phase Fetch

The current `listBeneficiaries()` groups by `(staffName, staffId)` and aggregates. Adding lifecycle data is best done in two phases:

1. **Phase 1:** Current query — get paginated person list with existing fields
2. **Phase 2:** For the page of results, batch-fetch:
   - All loans for these staff (with status)
   - LEFT JOIN `loan_completions` for completion dates
   - LEFT JOIN `auto_stop_certificates` for certificate status
   - LEFT JOIN `transfers` + `mdas` for transfer destination
   - Batch-query `observations` for consecutive_loan flags

This avoids a single massive query and follows the existing service pattern.

### Loan Status Priority for Multi-Loan Staff

A staff member may have multiple loans in different states. The displayed `loanStatus` should use the "most active" priority:

```
ACTIVE > TRANSFER_PENDING > TRANSFERRED > COMPLETED > INACTIVE
```

Example: Staff has 1 ACTIVE loan + 1 COMPLETED loan → shows as "Active" with badge, but the expanded/detail view would show both.

### Transfer Data Model

```
transfers table:
  outgoingMdaId  → originating MDA (where staff left)
  incomingMdaId  → destination MDA (where staff went, NULL if unclaimed)
  status         → PENDING (one-sided) or COMPLETED (both sides confirmed)
  createdAt      → transfer date
```

For MDA officer at originating MDA: show "Transferred to [incomingMda.name]" with status.
For MDA officer at destination MDA: staff appears as new (via TRANSFERRED_IN event).

### Files to Touch

| File | Action |
|------|--------|
| `packages/shared/src/types/mda.ts` | Extend `BeneficiaryListItem` with lifecycle fields |
| `apps/server/src/services/beneficiaryLedgerService.ts` | Add lifecycle JOINs + consecutive loan batch query |
| `apps/server/src/routes/migrationDashboardRoutes.ts` | Add `loanStatus` query param |
| `apps/client/src/hooks/useBeneficiaryData.ts` | Add `loanStatus` to filters |
| `apps/client/src/pages/dashboard/components/MasterBeneficiaryLedger.tsx` | Add status column, badges, filter, transfer display |

### Architecture Compliance

- **MDA scoping:** `withMdaScope()` already enforced — no changes needed
- **Non-punitive vocabulary:** Use "Inactive" not "Terminated". "Transfer Pending" not "Unconfirmed Transfer".
- **Every number is a doorway (Agreement #11):** Loan count badge should be clickable → staff trace report
- **Empty states are UX (Agreement #13):** "No transferred staff" when filter shows zero results

### References

- [Source: `_bmad-output/implementation-artifacts/epic-8-uat-findings-2026-04-06.md` — Findings #35, #37]
- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 15.0k specification, line ~3522]
- [Source: `apps/server/src/services/beneficiaryLedgerService.ts:41-264` — current service]
- [Source: `apps/server/src/db/schema.ts:723-744` — transfers table]
- [Source: `apps/server/src/db/schema.ts:808-825` — loan_completions table]
- [Source: `apps/server/src/db/schema.ts:84-89` — loan status enum]
- [Source: `apps/server/src/services/observationEngine.ts:607-692` — consecutive loan detection]
- [Source: `apps/client/src/pages/dashboard/components/MasterBeneficiaryLedger.tsx` — current UI]
- [Source: `packages/shared/src/types/mda.ts:152-170` — BeneficiaryListItem type]

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (1M context)

### Debug Log References
- Fixed unused `inArray` import (TS6133) — removed after switching to raw SQL `IN` clauses
- Transfer query initially matched on `staffNames` instead of `staffIds` — corrected to use `staff_id` column

### Completion Notes List
- Task 1: Extended `BeneficiaryListItem` with 7 lifecycle fields. Added `BeneficiaryLoanStatus` and `CertificateStatus` type aliases. Exported from shared package index.
- Task 2: Implemented two-phase fetch in `listBeneficiaries()`. Phase 2 batch-fetches: loan statuses, loan_completions, auto_stop_certificates, transfers+mdas, consecutive_loan observations. `deriveBeneficiaryLoanStatus()` collapses 11 DB enum values to 5 display values using priority map.
- Task 3: Added `loanStatus` to `beneficiaryQuerySchema` (Zod). Route handler passes filter to service. Service applies SQL conditions per status value.
- Task 4: Added `LifecycleBadge` component (5 variants). Status column with badge + consecutive flag + certificate icon + transfer destination. Status filter dropdown. Empty state messages per filter (Agreement #13).
- Task 5: Added `loanStatus` to `BeneficiaryFilters` interface and query string builder.
- Task 6: 5 integration tests covering lifecycle fields, all 4 filter values. Full suite: 1052 unit + 628 integration = 1680 tests, zero regressions.

### Change Log
- 2026-04-09: Story 15.0k implemented — MDA beneficiary ledger lifecycle awareness with status badges, certificate status, transfer destination, consecutive loan flag, and status filter
- 2026-04-09: Code review fixes — H1: HAVING-based lifecycle filter, H2: eliminated redundant status query, M1: export loanStatus support, M2: parallel Phase 2 queries, M3: removed duplicate ID parsing, L1: safe transfer status validation, L2: LifecycleBadge default case

### File List
- `packages/shared/src/types/mda.ts` — Extended `BeneficiaryListItem` with lifecycle fields, added `BeneficiaryLoanStatus` and `CertificateStatus` types
- `packages/shared/src/index.ts` — Added `BeneficiaryLoanStatus`, `CertificateStatus` exports
- `packages/shared/src/validators/migrationSchemas.ts` — Added `loanStatus` to `beneficiaryQuerySchema`
- `apps/server/src/services/beneficiaryLedgerService.ts` — Added lifecycle enrichment (Phase 2 batch fetch), status filter, `deriveBeneficiaryLoanStatus()`
- `apps/server/src/routes/migrationDashboardRoutes.ts` — Pass `loanStatus` filter to service
- `apps/client/src/hooks/useBeneficiaryData.ts` — Added `loanStatus` to filters interface and query string
- `apps/client/src/pages/dashboard/components/MasterBeneficiaryLedger.tsx` — Added `LifecycleBadge`, status column, filter dropdown, certificate icons, transfer display, empty state messages
- `apps/server/src/services/beneficiaryLedger.integration.test.ts` — NEW: 5 integration tests for lifecycle fields and status filter
