<!-- Generated: 2026-02-24 | Epic: 2 | Sprint: 3 -->
<!-- Blocked By: 2-1 (loans table, loanStatusEnum), 2-2 (fn_prevent_modification trigger), 2-6 (loanRoutes.ts registered) | Blocks: none (Epic 2 terminal story) -->
<!-- FRs: FR14, FR15 | Motivation: Full audit trail for every loan status decision -->
<!-- Source: epics.md → Epic 2, Story 2.7 | prd.md → FR14, FR15 | architecture.md → State Machine, Transactional Atomicity -->

# Story 2.7: Loan Lifecycle States & Transitions

Status: ready-for-dev

## Story

As a **Department Admin**,
I want to track loan lifecycle states and record every transition with full audit trail,
so that the complete history of every loan decision is preserved.

## Acceptance Criteria

### AC 1: State Transition Recording (FR15)

**Given** a loan in status `APPROVED`
**When** a Department Admin calls `POST /api/loans/:loanId/transition` with `{ "toStatus": "ACTIVE", "reason": "Disbursement confirmed, payroll deductions begin March 2026" }`
**Then** the loan's `status` column is updated to `ACTIVE`
**And** a `loan_state_transitions` record is created with: `loanId`, `fromStatus: 'APPROVED'`, `toStatus: 'ACTIVE'`, `transitionedBy` (acting user ID), `reason`, `createdAt`
**And** both the status update and transition record are committed atomically (single DB transaction)
**And** the response includes the created transition record

### AC 2: Invalid Transition Rejection (FR14)

**Given** the valid transition map:
- `APPLIED` → `APPROVED`
- `APPROVED` → `ACTIVE`
- `ACTIVE` → `COMPLETED`, `TRANSFERRED`, or `WRITTEN_OFF`
- `COMPLETED`, `TRANSFERRED`, `WRITTEN_OFF` → (terminal — no transitions out)

**When** an invalid transition is attempted (e.g., `COMPLETED` → `APPLIED`, or `APPLIED` → `ACTIVE` skipping `APPROVED`)
**Then** the request is rejected with `400` and a message explaining which transitions are valid from the current status
**And** neither the loan status nor the transition table is modified
**And** a same-status transition (e.g., `ACTIVE` → `ACTIVE`) is also rejected

### AC 3: Transition History Endpoint

**Given** a loan with one or more recorded transitions
**When** `GET /api/loans/:loanId/transitions` is called
**Then** the complete transition history is returned in chronological order (oldest first)
**And** each entry includes: `id`, `fromStatus`, `toStatus`, `transitionedBy` (user ID), `transitionedByName` (user's full name via JOIN), `reason`, `createdAt`
**And** MDA scoping is enforced — `mda_officer` can only view transitions for loans in their MDA

## Tasks / Subtasks

- [ ] Task 1: Schema — `loan_state_transitions` table (AC: 1, 2)
  - [ ] 1.1 Add to `apps/server/src/db/schema.ts`: `loanStateTransitions` table with columns: `id` (UUIDv7 PK), `loanId` (UUID FK → loans.id, NOT NULL), `fromStatus` (loanStatusEnum, NOT NULL), `toStatus` (loanStatusEnum, NOT NULL), `transitionedBy` (UUID FK → users.id, NOT NULL), `reason` (text, NOT NULL), `createdAt` (timestamptz, NOT NULL, defaultNow). No `updatedAt` — append-only.
  - [ ] 1.2 Add indexes: `idx_loan_state_transitions_loan_id` on `loanId`, `idx_loan_state_transitions_created_at` on `createdAt`
  - [ ] 1.3 Add immutability trigger in `apps/server/src/db/triggers.ts`: `trg_loan_state_transitions_immutable` using existing `fn_prevent_modification()` function — same pattern as `trg_audit_log_immutable` and `trg_ledger_entries_immutable`
  - [ ] 1.4 Generate Drizzle migration: `npx drizzle-kit generate`

- [ ] Task 2: Valid transitions map & Zod validator (AC: 2)
  - [ ] 2.1 Add to `packages/shared/src/constants/loanTransitions.ts`: `VALID_TRANSITIONS` constant — `Record<LoanStatus, LoanStatus[]>` mapping each status to its allowed target statuses; `TERMINAL_STATUSES` set; `isValidTransition(from, to)` pure function
  - [ ] 2.2 Add to `packages/shared/src/validators/loanSchemas.ts`: `transitionLoanSchema` — `z.object({ toStatus: z.enum([...loanStatusValues]), reason: z.string().min(1, 'Reason is required').max(500) })`
  - [ ] 2.3 Export from `packages/shared/src/index.ts` barrel

- [ ] Task 3: Shared types & vocabulary (AC: 1, 3)
  - [ ] 3.1 Add to `packages/shared/src/types/loan.ts`: `LoanStateTransition` interface (`id`, `loanId`, `fromStatus`, `toStatus`, `transitionedBy`, `transitionedByName`, `reason`, `createdAt` — all strings); `TransitionLoanRequest` interface (`toStatus: LoanStatus`, `reason: string`)
  - [ ] 3.2 Add to `packages/shared/src/constants/vocabulary.ts`: `INVALID_TRANSITION: 'This status change is not permitted. Allowed transitions from the current status: {allowed}.'`, `TRANSITION_RECORDED: 'Loan status updated successfully.'`, `LOAN_ALREADY_IN_STATUS: 'The loan is already in the requested status.'`, `TERMINAL_STATUS: 'No further status changes are permitted for this loan.'`
  - [ ] 3.3 Export new types from barrel

- [ ] Task 4: Transition service (AC: 1, 2, 3)
  - [ ] 4.1 Create `apps/server/src/services/loanTransitionService.ts`
  - [ ] 4.2 Implement `transitionLoan(userId, loanId, toStatus, reason, mdaScope)`:
    - Wrap in `db.transaction(async (tx) => { ... })`
    - SELECT loan WHERE id = loanId (with MDA scope check)
    - Throw `AppError(404)` if not found, `AppError(403)` if MDA scope violation
    - Call `isValidTransition(loan.status, toStatus)` — throw `AppError(400, 'INVALID_TRANSITION', ...)` if invalid, listing allowed transitions in the error message
    - UPDATE loans SET status = toStatus, updatedAt = now()
    - INSERT INTO loan_state_transitions (loanId, fromStatus, toStatus, transitionedBy, reason)
    - Return the created transition record
  - [ ] 4.3 Implement `getTransitionHistory(loanId, mdaScope)`:
    - SELECT loan to verify exists + MDA scope check
    - SELECT transitions JOIN users (for transitionedByName = firstName + ' ' + lastName) WHERE loanId, ORDER BY createdAt ASC
    - Return array of `LoanStateTransition`

- [ ] Task 5: Routes & app registration (AC: 1, 2, 3)
  - [ ] 5.1 Add to existing `apps/server/src/routes/loanRoutes.ts` (do NOT create separate file — transitions are sub-resources of loans):
    - `POST /loans/:loanId/transition` — middleware: `[authenticate, requirePasswordChange, authorise(SUPER_ADMIN, DEPT_ADMIN), scopeToMda, validate(transitionLoanSchema), auditLog]` → call `transitionLoan()` → respond `{ success: true, data: transition }` with status 201
    - `GET /loans/:loanId/transitions` — middleware: `[authenticate, requirePasswordChange, authorise(SUPER_ADMIN, DEPT_ADMIN, MDA_OFFICER), scopeToMda, auditLog]` → call `getTransitionHistory()` → respond `{ success: true, data: transitions }`
  - [ ] 5.2 Note: `loanRoutes` is already registered in `app.ts` (from Story 2.6) — no app.ts change needed

- [ ] Task 6: Integration tests (AC: 1, 2, 3)
  - [ ] 6.1 Create `apps/server/src/services/loanTransitionService.integration.test.ts`
  - [ ] 6.2 Seed: 1 MDA, 1 super_admin user, 1 dept_admin user, 1 mda_officer user, 1 loan in APPLIED status
  - [ ] 6.3 Test valid transition chain: APPLIED → APPROVED → ACTIVE → COMPLETED — verify each transition creates a record, loan status updated
  - [ ] 6.4 Test invalid transitions: APPLIED → ACTIVE (skip), COMPLETED → APPLIED (terminal), ACTIVE → ACTIVE (same-status) — verify 400 response with descriptive message
  - [ ] 6.5 Test MDA scoping: mda_officer calls GET transitions for loan in their MDA → 200; for loan outside MDA → 403
  - [ ] 6.6 Test mda_officer cannot POST transition (only SUPER_ADMIN / DEPT_ADMIN) → 403
  - [ ] 6.7 Test transition history returns chronological order with user name
  - [ ] 6.8 Test atomicity: if transition INSERT fails somehow, loan status should NOT be updated (transaction rollback)
  - [ ] 6.9 Test immutability: attempt UPDATE/DELETE on loan_state_transitions → rejected by DB trigger
  - [ ] 6.10 Test 404: transition for non-existent loanId → 404

- [ ] Task 7: Unit tests for state machine (AC: 2)
  - [ ] 7.1 Create `packages/shared/src/constants/loanTransitions.test.ts`
  - [ ] 7.2 Test `isValidTransition()` for every (from, to) combination: 6×6 = 36 pairs — verify true for valid, false for invalid
  - [ ] 7.3 Test terminal statuses: COMPLETED, TRANSFERRED, WRITTEN_OFF have zero valid outgoing transitions
  - [ ] 7.4 Test self-transitions: every status → same status returns false

## Dev Notes

### State Machine Definition

The valid transition map is a pure constant — no DB access, no side effects:

```typescript
export const VALID_TRANSITIONS: Record<LoanStatus, LoanStatus[]> = {
  APPLIED:      ['APPROVED'],
  APPROVED:     ['ACTIVE'],
  ACTIVE:       ['COMPLETED', 'TRANSFERRED', 'WRITTEN_OFF'],
  COMPLETED:    [],   // terminal
  TRANSFERRED:  [],   // terminal
  WRITTEN_OFF:  [],   // terminal
};

export const TERMINAL_STATUSES = new Set<LoanStatus>(['COMPLETED', 'TRANSFERRED', 'WRITTEN_OFF']);

export function isValidTransition(from: LoanStatus, to: LoanStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
```

This goes in `packages/shared` so both server and client can import it for validation and UI conditional rendering (e.g., which transition buttons to show).

### Transaction Pattern — Atomic State Change

The transition MUST be atomic: loan status update + transition record creation in a single DB transaction. If either fails, both roll back.

```typescript
const transition = await db.transaction(async (tx) => {
  // 1. Read current loan (within transaction)
  const [loan] = await tx.select().from(loans).where(eq(loans.id, loanId));
  if (!loan) throw new AppError(404, 'LOAN_NOT_FOUND', VOCABULARY.LOAN_NOT_FOUND);

  // 2. MDA scope check
  if (mdaScope && loan.mdaId !== mdaScope) throw new AppError(403, ...);

  // 3a. Self-transition guard (before general validation — gives specific message)
  if (loan.status === toStatus) {
    throw new AppError(400, 'LOAN_ALREADY_IN_STATUS', VOCABULARY.LOAN_ALREADY_IN_STATUS);
  }

  // 3b. Validate transition
  if (!isValidTransition(loan.status, toStatus)) {
    const allowed = VALID_TRANSITIONS[loan.status];
    const msg = allowed.length === 0
      ? VOCABULARY.TERMINAL_STATUS
      : VOCABULARY.INVALID_TRANSITION.replace('{allowed}', allowed.join(', '));
    throw new AppError(400, 'INVALID_TRANSITION', msg);
  }

  // 4. Update loan status
  await tx.update(loans)
    .set({ status: toStatus, updatedAt: new Date() })
    .where(eq(loans.id, loanId));

  // 5. Insert transition record
  const [record] = await tx.insert(loanStateTransitions).values({
    loanId,
    fromStatus: loan.status,
    toStatus,
    transitionedBy: userId,
    reason,
  }).returning();

  return record;
});
```

### Immutability — 3-Layer Pattern (Same as Stories 2.2, 1.5)

`loan_state_transitions` is append-only. Apply the same immutability enforcement:

**Layer 1 (DB Trigger):** Reuse `fn_prevent_modification()`:
```sql
CREATE TRIGGER trg_loan_state_transitions_immutable
  BEFORE UPDATE OR DELETE ON loan_state_transitions
  FOR EACH ROW
  EXECUTE FUNCTION fn_prevent_modification();
```

**Layer 2 (ORM):** No `update()` or `delete()` methods exposed for this table. Service only uses `insert()` and `select()`.

**Layer 3 (API):** The route only defines `POST` (create) and `GET` (read). No `PUT`, `PATCH`, or `DELETE` endpoints for transitions.

### Transition History JOIN for User Name

The GET history endpoint JOINs with users to include the acting user's name:

```typescript
const transitions = await db
  .select({
    id: loanStateTransitions.id,
    loanId: loanStateTransitions.loanId,
    fromStatus: loanStateTransitions.fromStatus,
    toStatus: loanStateTransitions.toStatus,
    transitionedBy: loanStateTransitions.transitionedBy,
    transitionedByName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
    reason: loanStateTransitions.reason,
    createdAt: loanStateTransitions.createdAt,
  })
  .from(loanStateTransitions)
  .innerJoin(users, eq(loanStateTransitions.transitionedBy, users.id))
  .where(eq(loanStateTransitions.loanId, loanId))
  .orderBy(loanStateTransitions.createdAt);  // ASC — oldest first
```

### Role Permissions

- **POST /loans/:loanId/transition:** `SUPER_ADMIN` and `DEPT_ADMIN` only — `mda_officer` cannot change loan status (matches `loans:manage` permission)
- **GET /loans/:loanId/transitions:** All roles — `mda_officer` can read history but only for loans in their MDA (matches `loans:read` permission)

### Error Message Pattern — Non-Punitive

Invalid transition errors explain what IS allowed, not what went wrong:
- `"This status change is not permitted. Allowed transitions from the current status: COMPLETED, TRANSFERRED, WRITTEN_OFF."` (for ACTIVE loan)
- `"No further status changes are permitted for this loan."` (for terminal states)
- `"The loan is already in the requested status."` (if toStatus === currentStatus — catch this before checking VALID_TRANSITIONS since self-transition is always invalid)

### Existing Infrastructure (Do NOT Recreate)

| Component | Location | Status |
|-----------|----------|--------|
| `loanStatusEnum` (6 values) | `apps/server/src/db/schema.ts` | Exists (Story 2.1) |
| `loans.status` column | `apps/server/src/db/schema.ts` | Exists, default `'APPLIED'` |
| `idx_loans_status` index | `apps/server/src/db/schema.ts` | Exists |
| `fn_prevent_modification()` | `apps/server/src/db/triggers.ts` | Exists (reusable) |
| `loanRoutes.ts` | `apps/server/src/routes/loanRoutes.ts` | Exists (Story 2.6) |
| `loanService.ts` | `apps/server/src/services/loanService.ts` | Exists (Story 2.1/2.6) |
| `LoanStatus` type (UPPERCASE) | `packages/shared/src/types/loan.ts` | Exists (Story 2.6 aligned) |
| `Loan` interface | `packages/shared/src/types/loan.ts` | Exists |
| `AppError` class | `apps/server/src/lib/appError.ts` | Exists |
| `scopeToMda` middleware | `apps/server/src/middleware/scopeToMda.ts` | Exists |
| `withMdaScope()` utility | `apps/server/src/lib/mdaScope.ts` | Exists |
| `authenticate` / `authorise` | `apps/server/src/middleware/` | Exists |
| `auditLog` middleware | `apps/server/src/middleware/auditLog.ts` | Exists |
| `validate` middleware | `apps/server/src/middleware/validate.ts` | Exists |
| `loans:manage` permission | `packages/shared/src/constants/permissions.ts` | Exists (SUPER_ADMIN, DEPT_ADMIN) |
| User deactivate/reactivate pattern | `apps/server/src/services/userAdminService.ts` | Reference pattern |

### Dependencies on Prior Stories

- **Story 2.1** (loans table with `status` column and `loanStatusEnum`) — MUST be implemented first
- **Story 2.2** (immutability pattern: `fn_prevent_modification()` trigger function) — trigger reuse
- **Story 1.5** (audit log middleware) — auto-captures transition API calls
- **Story 2.6** (loanRoutes.ts exists, routes already registered in app.ts) — add transition endpoints to existing file

### What This Story Enables (Downstream)

- **Epic 8 (Auto-Stop):** Story 8.1 uses `ACTIVE` → `COMPLETED` transition when zero-balance detected
- **Epic 4 (Dashboard):** Status-based filtering and metrics in executive dashboard
- **Epic 7 (Exception Management):** Status-aware exception flagging
- **Story 2.6 detail endpoint:** Can include transition history in loan detail response (optional enhancement)

### Project Structure Notes

New files created by this story:
```
apps/server/src/
├── services/loanTransitionService.ts                     (NEW)
└── services/loanTransitionService.integration.test.ts    (NEW)

packages/shared/src/
├── constants/loanTransitions.ts                          (NEW)
└── constants/loanTransitions.test.ts                     (NEW)
```

Modified files:
```
apps/server/src/db/schema.ts              (add loanStateTransitions table)
apps/server/src/db/triggers.ts            (add trg_loan_state_transitions_immutable)
apps/server/src/routes/loanRoutes.ts      (add POST transition + GET transitions endpoints)
packages/shared/src/types/loan.ts         (add LoanStateTransition, TransitionLoanRequest)
packages/shared/src/validators/loanSchemas.ts  (add transitionLoanSchema)
packages/shared/src/constants/vocabulary.ts    (add transition vocabulary)
packages/shared/src/index.ts              (add exports)
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 2, Story 2.7]
- [Source: _bmad-output/planning-artifacts/prd.md — FR14, FR15]
- [Source: _bmad-output/planning-artifacts/architecture.md — State Machine, Audit Trail, Transactional Atomicity]
- [Source: apps/server/src/db/schema.ts — loanStatusEnum, loans table]
- [Source: apps/server/src/db/triggers.ts — fn_prevent_modification() reusable trigger]
- [Source: apps/server/src/services/userAdminService.ts — deactivateUser/reactivateUser state change pattern]
- [Source: apps/server/src/routes/userRoutes.ts — POST /users/:id/deactivate route pattern]
- [Source: apps/server/src/middleware/auditLog.ts — automatic audit capture]

## PM Validation Findings

**Validated:** 2026-02-25 | **Verdict:** PASS | **Findings:** 2 MEDIUM (resolved), 5 LOW

### Resolved (inline fixes applied)

1. **MEDIUM — Missing metadata header:** Added `<!-- Generated/Blocked By/FRs/Source -->` header comments for structural consistency with Stories 2.0–2.6.
2. **MEDIUM — Self-transition check absent from transaction code sample:** Dev Notes (line 213) recommended catching `toStatus === currentStatus` before `isValidTransition()` for the dedicated `LOAN_ALREADY_IN_STATUS` message, but the transaction code sample omitted this guard. Inserted `loan.status === toStatus` check as step 3a before step 3b (general validation).

### Noted (no action required)

3. **LOW — Missing "What NOT To Do" scope boundary section:** Stories 2.0–2.5 include explicit scope boundaries; Story 2.7 omits this. Scope is otherwise clear from context — not blocking.
4. **LOW — Commit Summary template added below** in Dev Agent Record for consistency with other stories.
5. **LOW (Positive) — Task 5.1 correctly references "Add to existing"** `loanRoutes.ts` — correct application of the pattern established during Story 2.6 validation.
6. **LOW (Positive) — Comprehensive unit test matrix:** Task 7.2 specifies all 36 (from, to) pairs for `isValidTransition()` — exhaustive coverage.
7. **LOW (Positive) — Downstream impact well documented:** "What This Story Enables" maps to Epics 4, 7, 8, and Story 2.6 enhancement.

---

## Dev Agent Record

### Agent Model Used

### Commit Summary

```
feat(loans): add loan lifecycle state machine and transition audit trail (Story 2.7)

- Add loan_state_transitions table with immutability trigger (3-layer pattern)
- Implement VALID_TRANSITIONS constant and isValidTransition() pure function
- Add transitionLoan() service with atomic transaction (status update + transition record)
- Add getTransitionHistory() with user name JOIN and MDA scoping
- POST /loans/:loanId/transition (SUPER_ADMIN, DEPT_ADMIN only)
- GET /loans/:loanId/transitions (all roles, MDA-scoped)
- Integration tests: valid chain, invalid transitions, MDA scoping, atomicity, immutability
- Unit tests: 36-pair exhaustive state machine validation

Implements: FR14, FR15
```

### Debug Log References

### Completion Notes List

### File List
