# Story 8.1: Zero-Balance Detection & Auto-Stop Trigger

Status: ready-for-dev

## Story

As the **system**,
I want to detect when a loan balance reaches zero after processing a deduction,
So that the auto-stop process is triggered immediately and no further deductions occur.

**Origin:** Epic 8 core story — FR7. The system's foundational promise: "never be over-deducted again."

**Dependencies:** All prep stories 8.0a–8.0i must be complete. Clean-room UAT checkpoint must pass before starting 8.1.

## Acceptance Criteria

1. **Given** a PAYROLL ledger entry is inserted for an active loan, **When** the computed outstanding balance (totalLoan - sum of all ledger entries) reaches ≤ ₦0.00, **Then** the system automatically transitions the loan status from `ACTIVE` to `COMPLETED` via `transitionLoan()` with reason "Auto-stop: zero balance detected", and records the completion timestamp.

2. **Given** the last-payment adjustment method, **When** the final deduction brings the balance to exactly ₦0.00, **Then** the system correctly identifies completion even when the final payment amount differs from the regular monthly schedule amount.

3. **Given** a loan that is already `COMPLETED`, **When** a submission row declares a deduction for that staff member + loan, **Then** the system flags it as a post-completion deduction observation (type: `post_completion_deduction`) with the amount and period, and creates an attention item: "X staff have deductions declared after loan completion."

4. **Given** a background detection scan runs, **When** it finds active loans where the computed balance from existing ledger entries is ≤ 0 (e.g., from migration baselines that already show full repayment), **Then** it transitions those loans to COMPLETED and logs each as an auto-stop trigger.

5. **Given** the auto-stop trigger fires, **When** the loan transitions to COMPLETED, **Then** a `loan_completions` record is created with: loanId, completionDate, finalBalance, totalPaid, totalInterestPaid, triggerSource ('ledger_entry' or 'background_scan'), and the triggering ledger entry ID (if applicable).

6. **Given** the auto-stop process, **When** a loan is marked COMPLETED, **Then** the dashboard hero metric "Active Loans" decreases by 1, the "Completion Rate" increases, and a new attention item appears: "Auto-Stop: [staffName]'s loan completed — certificate pending."

7. **Given** a loan with `limitedComputation = true` (zero-principal anomaly from migration), **When** the background scan runs, **Then** it excludes these loans from auto-stop detection (they have artificial zero balances that don't represent real completion).

## Tasks / Subtasks

- [ ] Task 1: Create `loan_completions` table (AC: 5)
  - [ ] 1.1: Add `loanCompletions` table to `apps/server/src/db/schema.ts`:
    ```typescript
    export const loanCompletions = pgTable('loan_completions', {
      id: uuid('id').primaryKey().$defaultFn(generateUuidv7),
      loanId: uuid('loan_id').notNull().references(() => loans.id),
      completionDate: timestamp('completion_date', { withTimezone: true }).notNull(),
      finalBalance: numeric('final_balance', { precision: 15, scale: 2 }).notNull(),
      totalPaid: numeric('total_paid', { precision: 15, scale: 2 }).notNull(),
      totalPrincipalPaid: numeric('total_principal_paid', { precision: 15, scale: 2 }).notNull(),
      totalInterestPaid: numeric('total_interest_paid', { precision: 15, scale: 2 }).notNull(),
      triggerSource: varchar('trigger_source', { length: 50 }).notNull(), // 'ledger_entry' | 'background_scan' | 'manual'
      triggerLedgerEntryId: uuid('trigger_ledger_entry_id').references(() => ledgerEntries.id),
      createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    }, (table) => [
      uniqueIndex('idx_loan_completions_loan_id').on(table.loanId),
      index('idx_loan_completions_completion_date').on(table.completionDate),
    ]);
    ```
  - [ ] 1.2: Run `drizzle-kit generate` to create a NEW migration
  - [ ] 1.3: Verify migration applies cleanly
  - [ ] 1.4: Add `loan_completions` to `resetDb.ts` explicit table list

- [ ] Task 2: Create auto-stop detection service (AC: 1, 2, 4, 7)
  - [ ] 2.1: Create `apps/server/src/services/autoStopService.ts` with:
    ```typescript
    export async function detectAndTriggerAutoStop(
      options?: { triggerSource?: 'ledger_entry' | 'background_scan'; triggerLedgerEntryId?: string }
    ): Promise<AutoStopResult[]>
    ```
  - [ ] 2.2: Query for auto-stop candidates:
    ```sql
    SELECT l.id, l.staff_name, l.staff_id, l.principal_amount, l.interest_rate, l.tenure_months,
           l.limited_computation, l.mda_id,
           COALESCE(SUM(le.amount), 0) as total_paid
    FROM loans l
    LEFT JOIN ledger_entries le ON le.loan_id = l.id
    WHERE l.status = 'ACTIVE'
      AND l.limited_computation = false  -- exclude zero-principal anomalies (AC: 7)
    GROUP BY l.id
    HAVING (l.principal_amount + l.principal_amount * l.interest_rate / 100) - COALESCE(SUM(le.amount), 0) <= 0
    ```
  - [ ] 2.3: For each candidate, **verify with `computeBalanceForLoan()`** before triggering — the candidate SQL (Task 2.2) is a fast pre-filter but doesn't handle edge cases (moratorium, auto-split, Decimal precision). Only proceed if `computeBalanceForLoan()` confirms balance ≤ 0. Then in a transaction:
    - Call `transitionLoan(systemUserId, loanId, 'COMPLETED', 'Auto-stop: zero balance detected', null)` — pass `mdaScope: null` for system-initiated transitions
    - Insert into `loan_completions` with all fields
    - Log completion: `logger.info({ loanId, staffName, finalBalance, totalPaid }, 'Auto-stop triggered')`
  - [ ] 2.4: Return `AutoStopResult[]` with: loanId, staffName, completionDate, finalBalance, totalPaid
  - [ ] 2.5: Handle edge case: if `transitionLoan()` fails (e.g., loan already completed by a concurrent process), catch and log, don't fail the batch
  - [ ] 2.6: Unit test in `apps/server/src/services/autoStopService.test.ts` (**new file**): loan with balance exactly 0 → triggers auto-stop
  - [ ] 2.7: Unit test in same file: loan with balance slightly below 0 (rounding) → triggers auto-stop
  - [ ] 2.8: Unit test in same file: loan with balance > 0 → NOT triggered
  - [ ] 2.9: Unit test in same file: loan with `limitedComputation = true` → excluded
  - [ ] 2.10: Unit test in same file: already COMPLETED loan → not in candidates (WHERE status = 'ACTIVE')

- [ ] Task 3: Create inline trigger after ledger entry insertion (AC: 1, 2)
  - [ ] 3.1: Create `checkAndTriggerAutoStop(loanId, ledgerEntryId)` function in `autoStopService.ts`:
    - Fetch loan (verify status = ACTIVE, limitedComputation = false)
    - Call `computeBalanceForLoan()` for this specific loan
    - If balance ≤ 0: trigger auto-stop for this loan only (same logic as Task 2.3)
    - Return `{ triggered: boolean, completionRecord?: LoanCompletion }`
  - [ ] 3.2: Integrate into ledger entry insertion points — call AFTER transaction commits (NOT inside `tx`):
    - `baselineService.ts` `createBaseline()` — after the `await db.transaction(...)` returns (line 350 is the ledger insert INSIDE tx — do NOT call there). Add `checkAndTriggerAutoStop(result.loanId, result.ledgerEntryId)` after the transaction's return value is received
    - `baselineService.ts` `createBatchBaseline()` — after the batch transaction commits (line ~505), call `checkAndTriggerAutoStop()` for EACH loan that received a ledger entry in the batch
    - Any future PAYROLL entry insertion point — document the integration hook
  - [ ] 3.3: The check must run OUTSIDE the ledger insert transaction (the ledger entry must be committed before balance is checked) — use `setImmediate` or call after transaction commit
  - [ ] 3.4: Unit test in same file: MIGRATION_BASELINE entry that makes balance ≤ 0 → triggers auto-stop
  - [ ] 3.5: Unit test in same file: MIGRATION_BASELINE entry with remaining balance > 0 → no trigger

- [ ] Task 4: Create background scan scheduler (AC: 4)
  - [ ] 4.1: Add `startAutoStopScheduler()` in `autoStopService.ts`, following the `inactiveLoanDetector.ts` pattern:
    - **Interval:** 6 hours (same cadence as inactive loan detector)
    - **Startup delay:** 3 minutes
    - **Logic:** call `detectAndTriggerAutoStop({ triggerSource: 'background_scan' })`
    - Skip in test environment
  - [ ] 4.2: Add `stopAutoStopScheduler()` for cleanup
  - [ ] 4.3: Register `startAutoStopScheduler()` in `apps/server/src/index.ts` alongside existing schedulers
  - [ ] 4.4: Unit test: scheduler invokes detection on interval

- [ ] Task 5: Add post-completion deduction detection (AC: 3)
  - [ ] 5.1: Create `detectPostCompletionDeductions(submissionId)` in `autoStopService.ts`:
    - Join `submission_rows` with `loans` on staffId
    - Find rows where the matched loan has `status = 'COMPLETED'` and `amountDeducted > 0`
    - For each match, create an observation:
      - type: `post_completion_deduction` (new observation type)
      - description: "Deduction of ₦X declared for [staffName] in [period], but loan was completed on [completionDate]. This deduction should cease."
      - context: `{ amount, period, completionDate, loanReference }`
  - [ ] 5.2: Add `post_completion_deduction` to the observation type enum in `apps/server/src/db/schema.ts` (alongside existing types: rate_variance, stalled_balance, etc.)
  - [ ] 5.3: Run `drizzle-kit generate` for the enum change (new migration)
  - [ ] 5.4: Add `POST_COMPLETION_DEDUCTION` entry to `OBSERVATION_HELP` in `packages/shared/src/constants/metricGlossary.ts`:
    ```typescript
    post_completion_deduction: {
      label: 'Post-Completion Deduction',
      description: 'A deduction was declared for a staff member whose loan has already been fully repaid.',
      derivedFrom: 'Cross-reference of submission rows against loans with COMPLETED status.',
      guidance: 'Notify the MDA to cease deductions immediately. Issue Auto-Stop Certificate if not already generated.',
    },
    ```
  - [ ] 5.5: Wire `detectPostCompletionDeductions()` into the submission processing flow — call after `processSubmissionRows()` in `submissionService.ts` (fire-and-forget, don't block submission confirmation)
  - [ ] 5.6: Integration test in `apps/server/src/routes/autoStop.integration.test.ts` (**new file**): submission with deduction for completed loan → observation created
  - [ ] 5.7: Integration test in same file: submission with deduction for active loan → no observation

- [ ] Task 6: Implement auto-stop attention item (AC: 6)
  - [ ] 6.1: Replace the stub in `apps/server/src/services/attentionItemService.ts` (lines 460-463) with real detection:
    ```typescript
    async function detectPendingAutoStop(mdaScope?: string | null): Promise<AttentionItem[]> {
      // Query loan_completions WHERE certificate not yet generated
      // (certificate generation is Story 8.2 — for now, ALL completions are "pending certificate")
      // Group by MDA, return attention items
    }
    ```
  - [ ] 6.2: Also add attention item for post-completion deductions:
    ```typescript
    // "X staff have deductions declared after loan completion"
    ```
  - [ ] 6.3: Add `pending_auto_stop` and `post_completion_deduction` to attention item type handling in the dashboard
  - [ ] 6.4: Add MetricHelp entries for these attention types in `metricGlossary.ts`

- [ ] Task 7: Create system user for automated transitions (AC: 1, 4)
  - [ ] 7.1: `transitionLoan()` requires a `userId`. For automated transitions, use a system user:
    - Check if a system user already exists (search for "SYSTEM", "system_user", "automated" in seed data)
    - If not: create a `SYSTEM_AUTO_STOP` constant user ID in `packages/shared/src/constants/`
    - Seed the system user in the startup seed script (role: SUPER_ADMIN or a new SYSTEM role)
  - [ ] 7.2: The transition audit trail should clearly show "System (Auto-Stop)" as the actor, not a real user

- [ ] Task 8: API endpoint for manual trigger (AC: 4)
  - [ ] 8.1: Add `POST /api/auto-stop/scan` endpoint (SUPER_ADMIN only) that calls `detectAndTriggerAutoStop({ triggerSource: 'manual' })` and returns results
  - [ ] 8.2: This allows the AG to manually trigger a scan during UAT or after bulk imports
  - [ ] 8.3: Add route file: `apps/server/src/routes/autoStopRoutes.ts`

- [ ] Task 9: Full regression and verification (AC: all)
  - [ ] 9.1: Run `pnpm typecheck` — zero errors
  - [ ] 9.2: Run `pnpm test` — zero regressions
  - [ ] 9.3: Run `pnpm lint` — zero new warnings
  - [ ] 9.4: Integration test: create loan → create baseline that makes balance 0 → verify loan transitions to COMPLETED → verify loan_completions record → verify attention item appears
  - [ ] 9.5: Integration test: submit deduction for completed loan → verify post_completion_deduction observation created

## Dev Notes

### This Is the System's Core Promise

From the product brief: "The guarantee that no government worker will ever again be over-deducted." The auto-stop mechanism is the single most important feature in VLPRS. Story 8.1 is the detection and trigger; Story 8.2 generates the certificate; Story 8.3 sends notifications.

### How Loan Balance Is Currently Computed

**File:** `apps/server/src/services/computationEngine.ts` (lines 343-421; `computeBalanceFromEntries()` is the lower-level function at lines 274-332)

```
totalLoan = principalAmount + (principalAmount × interestRate / 100)
computedBalance = totalLoan - sum(ledger_entries.amount)
```

Balance is clamped to ≥ 0 (line 395). The `computeBalanceForLoan()` function returns a full `BalanceResult` with principal/interest breakdown, installments completed, and derivation audit chain.

### Current Ledger Entry Sources

| Entry Type | Source | When Created |
|---|---|---|
| `MIGRATION_BASELINE` | `baselineService.createBaseline()` | When migration record is baselined |
| `PAYROLL` | Not yet implemented | Future: when monthly submission deductions are posted |
| `ADJUSTMENT` | Not yet implemented | Future: manual adjustments |
| `WRITE_OFF` | Not yet implemented | Future: write-off processing |

**Critical:** Currently only MIGRATION_BASELINE entries exist. A loan can reach zero balance through migration alone if the baseline amount equals the total loan (all deductions already paid before system go-live).

### Detection Strategy: Two Complementary Mechanisms

1. **Inline trigger** — called after each ledger entry insertion. Catches completions immediately when a new entry brings balance to zero.
2. **Background scan** — runs every 6 hours. Catches loans that reached zero balance through batch operations, migration baselines, or entries created through direct DB operations.

Both use the same core detection logic but differ in trigger source tracking.

### Transition to COMPLETED

**Existing infrastructure:**
- `ACTIVE → COMPLETED` is a valid transition (`loanTransitions.ts` line 10)
- `transitionLoan()` function handles the transition atomically with audit trail (`loanTransitionService.ts` lines 91-103)
- `COMPLETED` is a terminal status — no further transitions possible

**What this story adds:**
- Automated calling of `transitionLoan()` when balance reaches zero
- `loan_completions` record capturing financial summary at completion time
- System user as actor (not a human user)

### limitedComputation Flag

Some migration records have zero principal (data anomaly). These loans have `limitedComputation = true` on the loans table. Their computed balance is artificially zero — this does NOT represent real completion. Story 8.1 MUST exclude these from auto-stop detection.

**File:** `apps/server/src/db/schema.ts` — `loans` table has `limitedComputation` boolean column.
**File:** `computationEngine.ts` line 357-360 — `computeBalanceForLoan()` returns `{ computedBalance: '0.00' }` for limited computation loans.

### Post-Completion Deduction Detection

When a loan is COMPLETED but an MDA still declares deductions for that staff member in monthly submissions, this story creates observations. This is the preventive layer — catching over-deductions before they happen (in the legacy world, deductions continued silently).

The observation type `post_completion_deduction` is new. It follows the existing observation engine pattern but is triggered from submission processing, not migration validation.

### System User for Automated Transitions

`transitionLoan()` requires a `userId` for the audit trail. Options:
1. **Dedicated system user** — create a user record with a known UUID, e.g., `00000000-0000-0000-0000-000000000001`, role SUPER_ADMIN, name "System (Auto-Stop)"
2. **Use existing seed** — check if a system/seed user already exists

The transition reason column (varchar 1000) should clearly indicate automation: "Auto-stop: zero balance detected (background scan)" or "Auto-stop: zero balance detected (ledger entry [entryId])".

### Inline Trigger: After Transaction Commit

The inline trigger (`checkAndTriggerAutoStop`) must run AFTER the ledger entry transaction commits. If called inside the ledger insert transaction:
- The new entry isn't visible to the balance computation (same transaction hasn't committed)
- A failure in auto-stop would roll back the ledger entry

Use `setImmediate()` or call after the `await tx.commit()` returns:
```typescript
// In baselineService.ts, after the transaction:
const result = await db.transaction(async (tx) => {
  // ... insert ledger entry, link loan, etc.
  return { loanId, ledgerEntryId };
});
// AFTER transaction commits:
await checkAndTriggerAutoStop(result.loanId, result.ledgerEntryId);
```

### Observation Type Addition

Adding `post_completion_deduction` to the `observationTypeEnum` requires a Drizzle migration (it's a PostgreSQL enum). Pattern:
```sql
ALTER TYPE observation_type ADD VALUE 'post_completion_deduction';
```

Also add the compile-time enforcement entry in `OBSERVATION_HELP` (metricGlossary.ts) — Story 7.2a established that every observation type must have a matching MetricHelp entry or the build fails.

### What This Story Does NOT Build

- **Auto-Stop Certificate** — Story 8.2 (PDF generation, QR code, verification endpoint)
- **Dual Notification** — Story 8.3 (email to beneficiary + MDA officer)
- **PAYROLL ledger entry creation** from monthly submissions — future enhancement. Story 8.1 works with whatever entries exist (currently MIGRATION_BASELINE only)
- **Beneficiary-facing completion view** — future phase

### File Locations

| What | Path | Key Lines |
|---|---|---|
| Balance computation | `apps/server/src/services/computationEngine.ts` | 343-421 (computeBalanceForLoan — note: lines 274-332 are the separate `computeBalanceFromEntries()` function) |
| Balance service | `apps/server/src/services/balanceService.ts` | 10-41 (getOutstandingBalance) |
| Loan transition service | `apps/server/src/services/loanTransitionService.ts` | 91-103 (transitionLoan) |
| Valid transitions | `packages/shared/src/constants/loanTransitions.ts` | 7-28 (VALID_TRANSITIONS) |
| Loan status enum | `apps/server/src/db/schema.ts` | 86-89 |
| Ledger entries table | `apps/server/src/db/schema.ts` | 145-170 |
| Entry type enum | `apps/server/src/db/schema.ts` | 71-72 |
| Observation type enum | `apps/server/src/db/schema.ts` | Find observationTypeEnum |
| Attention item stub | `apps/server/src/services/attentionItemService.ts` | 460-463 (detectPendingAutoStop) |
| Baseline service (inline hook) | `apps/server/src/services/baselineService.ts` | 350 (after ledger insert) |
| Scheduler pattern | `apps/server/src/services/inactiveLoanDetector.ts` | 314-327 |
| Server startup | `apps/server/src/index.ts` | Scheduler registration |
| Metric glossary | `packages/shared/src/constants/metricGlossary.ts` | OBSERVATION_HELP section |
| Auto-split deduction | `apps/server/src/services/computationEngine.ts` | 107-146 |
| Submission service | `apps/server/src/services/submissionService.ts` | 301-518 (processSubmissionRows) |
| resetDb | `apps/server/src/test/resetDb.ts` | Add loan_completions |

### Non-Punitive Vocabulary

- "Auto-stop triggered" (not "Loan terminated")
- "Loan completed" (positive event, not negative)
- "Post-completion deduction" (neutral observation, not "Over-deduction error")
- "Certificate pending" (action needed, not "Certificate missing")
- "Balance below zero" (not "Over-deduction") — per vocabulary.ts

### Testing Standards

- Co-located tests: `autoStopService.test.ts`
- Integration tests in `autoStopRoutes.integration.test.ts`
- Vitest framework
- Financial assertions via Decimal.js string comparison
- Test edge cases: exactly zero, slightly negative (rounding), large negative (bulk repayment)

### Team Agreements Applicable

- **Extend, don't fork** — use existing `transitionLoan()`, `computeBalanceForLoan()`, observation engine patterns
- **Transaction scope** — document clearly: ledger entry committed BEFORE auto-stop check runs
- **N+1 query budget** — background scan uses single aggregation query, not per-loan balance computation
- **Zero-debt-forward** — auto-stop detection must work from day one, even if only migration baselines exist

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.1 — Zero-Balance Detection]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.2 — Certificate Generation (downstream)]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.3 — Dual Notification (downstream)]
- [Source: apps/server/src/services/computationEngine.ts:343-421 — computeBalanceForLoan (274-332 is computeBalanceFromEntries)]
- [Source: apps/server/src/services/computationEngine.ts:107-146 — autoSplitDeduction]
- [Source: apps/server/src/services/loanTransitionService.ts:91-103 — transitionLoan]
- [Source: packages/shared/src/constants/loanTransitions.ts:7-28 — VALID_TRANSITIONS]
- [Source: apps/server/src/services/attentionItemService.ts:460-463 — detectPendingAutoStop stub]
- [Source: apps/server/src/services/baselineService.ts:350 — ledger entry insertion point]
- [Source: apps/server/src/services/inactiveLoanDetector.ts:314-327 — scheduler pattern]
- [Source: apps/server/src/db/schema.ts:86-89 — loanStatusEnum including COMPLETED]
- [Source: apps/server/src/db/schema.ts:145-170 — ledgerEntries table]
- [Source: _bmad-output/planning-artifacts/product-brief-vlprs-2026-02-13.md — "never be over-deducted again"]

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
