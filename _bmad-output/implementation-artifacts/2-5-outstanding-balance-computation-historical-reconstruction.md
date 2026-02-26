# Story 2.5: Outstanding Balance Computation & Historical Reconstruction

Status: done

<!-- Generated: 2026-02-24 | Epic: 2 | Sprint: 3 -->
<!-- Blocked By: 2-2 (ledger table + accessor), 2-3 (computation engine), 2-4 (last-payment adjustment) | Blocks: 2-6, 2-7, Epic 4, Epic 8 -->
<!-- FRs: FR6, FR12 | Motivation: Balances always computed from ledger, never stored — auditor-verifiable -->
<!-- Source: epics.md → Epic 2, Story 2.5 | architecture.md → Computed Views, Service Boundaries -->

## Story

As an **auditor**,
I want loan balances computed from the immutable ledger (never stored) and reconstructable at any point in time,
So that I can verify any balance by tracing it back to source entries.

### Context

This is the core architectural principle of VLPRS: **balances are computed, not stored**. There is no `balance` column on the `loans` table. Every time a balance is needed — dashboard metrics, loan detail, search results, auto-stop detection, early exit payoff — it is derived by summing ledger entries against the loan's total. Historical reconstruction enables auditors to verify what the balance was at any past date. The computation engine (Stories 2.3/2.4) provides the expected total; the ledger (Story 2.2) provides the actual payments; this story computes the difference.

## Acceptance Criteria

### AC 1: Current Outstanding Balance

**Given** a loan with ledger entries
**When** `GET /api/loans/:loanId/balance` is called
**Then** the outstanding balance is computed by summing all ledger entries against the expected total — not retrieved from a stored field (FR6)
**And** the response includes: computed balance, total principal paid, total interest paid, installments completed, installments remaining

### AC 2: Historical Balance Reconstruction

**Given** a loan with ledger entries spanning multiple months
**When** `GET /api/loans/:loanId/balance?asOf=2025-06-30` is called with a historical date
**Then** the balance is reconstructed using only ledger entries with `created_at` up to that date (FR12)
**And** the computation produces the same result regardless of when it is run (deterministic)

### AC 3: Derivation Chain for Audit Traceability

**Given** any computed balance
**When** an auditor traces the computation
**Then** a complete derivation chain is available: the balance response includes total loan, sum of entries, entry count, and formula used
**And** the individual ledger entries are retrievable via `GET /api/ledger/:loanId` (Story 2.2)

## Tasks / Subtasks

- [x] Task 1: Add shared types for balance computation (AC: 1, 2, 3)
  - [x] 1.1 Create `packages/shared/src/types/balance.ts` — `BalanceResult` interface
  - [x] 1.2 Export from `packages/shared/src/index.ts`
- [x] Task 2: Add balance computation to computation engine (AC: 1, 2)
  - [x] 2.1 Add `computeBalanceFromEntries()` pure function to `apps/server/src/services/computationEngine.ts`
  - [x] 2.2 Function takes loan params + entries array, returns `BalanceResult`
  - [x] 2.3 All arithmetic via `decimal.js` — sum entries, subtract from total loan
- [x] Task 3: Extend ledger accessor with historical query (AC: 2)
  - [x] 3.1 Add `selectByLoanAsOf(loanId, asOfDate)` method to `ledgerDb` in `apps/server/src/db/immutable.ts`
  - [x] 3.2 Filter: `WHERE loan_id = ? AND created_at <= ?` ordered by `created_at` ascending
- [x] Task 4: Create balance service (AC: 1, 2, 3)
  - [x] 4.1 Create `apps/server/src/services/balanceService.ts`
  - [x] 4.2 `getOutstandingBalance(loanId, asOf?)` — fetches loan + entries, calls `computeBalanceFromEntries()`
  - [x] 4.3 Validate loan exists, throw `AppError(404)` if not found
- [x] Task 5: Create balance route + register (AC: 1, 2, 3)
  - [x] 5.1 Create `apps/server/src/routes/balanceRoutes.ts` — `GET /api/loans/:loanId/balance`
  - [x] 5.2 Parse optional `?asOf=YYYY-MM-DD` query parameter with Zod date validation
  - [x] 5.3 MDA scoping: `mda_officer` can only query balance for loans in their MDA
  - [x] 5.4 Register in `apps/server/src/app.ts`
  - [x] 5.5 Add vocabulary entries to `packages/shared/src/constants/vocabulary.ts`
- [x] Task 6: Unit tests — computation function (AC: 1, 2, 3)
  - [x] 6.1 Add tests to `apps/server/src/services/computationEngine.test.ts`
  - [x] 6.2 Test: zero entries → balance = totalLoan (no payments made)
  - [x] 6.3 Test: partial entries (e.g., 30 of 60) → correct remaining balance
  - [x] 6.4 Test: all entries → balance = ₦0.00 (fully paid)
  - [x] 6.5 Test: subset of entries (historical) → correct balance at that point
  - [x] 6.6 Test: determinism — same inputs produce identical output
  - [x] 6.7 Test: all money values are strings with exactly 2 decimal places
- [x] Task 7: Integration tests (AC: 1, 2, 3)
  - [x] 7.1 Create `apps/server/src/routes/balance.integration.test.ts`
  - [x] 7.2 Test: GET /api/loans/:loanId/balance with seeded entries returns correct computed balance
  - [x] 7.3 Test: GET /api/loans/:loanId/balance?asOf= with historical date returns only-up-to-date balance
  - [x] 7.4 Test: MDA-scoped user cannot access balance for loans in another MDA
  - [x] 7.5 Test: loan with no entries returns totalLoan as balance

### Review Follow-ups (AI)

- [x] [AI-Review][HIGH] Balance service bypasses `loanService.getLoanById()` — raw `db.select()` + manual MDA check returns 403 (leaks loan existence), inconsistent with schedule/loan routes that return 404 via `withMdaScope()` [balanceService.ts:10]
- [x] [AI-Review][HIGH] `computeBalanceFromEntries()` has zero input validation — sibling functions (`computeRepaymentSchedule`, `autoSplitDeduction`) both validate all params; this one accepts invalid inputs silently [computationEngine.ts:158]
- [x] [AI-Review][MEDIUM] Task 5.2 claims "Zod date validation" but used manual `new Date()` + `isNaN()` — `new Date('2025')` or `new Date('2025-02-30')` accepted as valid; replaced with Zod regex schema [balanceRoutes.ts:28]
- [x] [AI-Review][MEDIUM] `balanceService.test.ts` listed in Project Structure Notes but never created — removed misleading reference; service logic covered by integration tests [story:421]
- [x] [AI-Review][MEDIUM] No guard against negative computed balance — added `isAnomaly` flag to `derivation` object when `computedBalance < 0` [computationEngine.ts:184]
- [x] [AI-Review][MEDIUM] `new_read.txt` untracked junk file in repo — deleted [git status]
- [x] [AI-Review][LOW] `sprint-status.yaml` modified in git but not in story File List — added to File List [story File List]
- [x] [AI-Review][LOW] `LedgerEntryForBalance` interface defined locally in server, not in shared types — moved to `packages/shared/src/types/balance.ts` and exported [computationEngine.ts:147]

## Dev Notes

### Critical Context — "Balances Are Computed, Not Stored"

There is **no `balance` or `outstanding_balance` column** anywhere in the database. The `loans` table stores principal, interest rate, and tenure — the expected totals. The `ledger_entries` table stores actual payments. The balance is always: `totalLoan - sum(payments)`.

This is an architectural invariant, not a performance trade-off. It guarantees:
1. No stale balance data (always fresh computation)
2. Full audit traceability (balance = f(ledger entries))
3. No way to manually edit a balance (no column to edit)
4. Historical reconstruction for free (filter entries by date)

### Balance Computation Formula

```
Outstanding Balance = Total Loan - Total Amount Paid
                    = (Principal + Total Interest) - sum(ledger_entries.amount)

Where:
  Total Interest     = Principal × Interest Rate / 100    (flat-rate)
  Total Loan         = Principal + Total Interest
  Total Amount Paid  = sum of all ledger_entries.amount for this loan
  Principal Paid     = sum of all ledger_entries.principal_component
  Interest Paid      = sum of all ledger_entries.interest_component
  Installments Done  = count of PAYROLL-type entries
  Installments Left  = tenure_months - installments_done
```

For **historical reconstruction** (`asOf` parameter): the sums only include entries where `created_at <= asOfDate`.

### What Already Exists

**Ledger accessor — `ledgerDb` in `apps/server/src/db/immutable.ts` (Story 2.2):**
```typescript
export const ledgerDb = {
  async insert(values) { ... },
  async selectByLoan(loanId: string) {
    return db.select().from(ledgerEntries)
      .where(eq(ledgerEntries.loanId, loanId))
      .orderBy(asc(ledgerEntries.createdAt));
  },
  async selectByMdaAndLoan(mdaId: string, loanId: string) { ... },
};
```
Story 2.5 adds `selectByLoanAsOf()` to this accessor.

**Computation engine — `computationEngine.ts` (Stories 2.3/2.4):**
- `computeRepaymentSchedule(params)` — returns `RepaymentSchedule` with `totalLoan`, `totalInterest`
- `autoSplitDeduction(amount, params)` — splits deduction into components
- `Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP })` — already configured

**Loans table schema (Story 2.1):**
```typescript
principalAmount: numeric('principal_amount', { precision: 15, scale: 2 }),
interestRate: numeric('interest_rate', { precision: 5, scale: 3 }),
tenureMonths: integer('tenure_months'),
moratoriumMonths: integer('moratorium_months'),
```

**Existing shared types — `LoanSummary` already has `outstandingBalance: string` field.**
This field exists in the type but is not yet populated. Story 2.6 (Loan Search) will call the balance service to populate it.

### Shared Types — `packages/shared/src/types/balance.ts`

```typescript
/** Result of an outstanding balance computation */
export interface BalanceResult {
  computedBalance: string;        // totalLoan - sum(amounts), NUMERIC as string
  totalPrincipalPaid: string;     // sum(principal_component)
  totalInterestPaid: string;      // sum(interest_component)
  totalAmountPaid: string;        // sum(amount)
  principalRemaining: string;     // principal - totalPrincipalPaid
  interestRemaining: string;      // totalInterest - totalInterestPaid
  installmentsCompleted: number;  // count of PAYROLL entries
  installmentsRemaining: number;  // tenureMonths - installmentsCompleted
  entryCount: number;             // total ledger entries used in computation
  asOfDate: string | null;        // null = current, ISO date string = historical
  derivation: {
    formula: string;              // "totalLoan - sum(entries.amount)"
    totalLoan: string;
    entriesSum: string;
  };
}
```

### Computation Engine Addition — `computeBalanceFromEntries()`

Add to `apps/server/src/services/computationEngine.ts`:

```typescript
import type { BalanceResult } from '@vlprs/shared';

interface LedgerEntryForBalance {
  amount: string;
  principalComponent: string;
  interestComponent: string;
  entryType: string;
}

/**
 * Compute outstanding balance from loan parameters and ledger entries.
 * Pure function — no DB access. All arithmetic via decimal.js.
 */
export function computeBalanceFromEntries(
  principalAmount: string,
  interestRate: string,
  tenureMonths: number,
  entries: LedgerEntryForBalance[],
  asOfDate: string | null,
): BalanceResult {
  const principal = new Decimal(principalAmount);
  const rate = new Decimal(interestRate);
  const totalInterest = principal.mul(rate).div(100);
  const totalLoan = principal.plus(totalInterest);

  let totalAmountPaid = new Decimal('0');
  let totalPrincipalPaid = new Decimal('0');
  let totalInterestPaid = new Decimal('0');
  let payrollCount = 0;

  for (const entry of entries) {
    totalAmountPaid = totalAmountPaid.plus(new Decimal(entry.amount));
    totalPrincipalPaid = totalPrincipalPaid.plus(new Decimal(entry.principalComponent));
    totalInterestPaid = totalInterestPaid.plus(new Decimal(entry.interestComponent));
    if (entry.entryType === 'PAYROLL') {
      payrollCount++;
    }
  }

  const computedBalance = totalLoan.minus(totalAmountPaid);
  const principalRemaining = principal.minus(totalPrincipalPaid);
  const interestRemaining = totalInterest.minus(totalInterestPaid);

  return {
    computedBalance: computedBalance.toFixed(2),
    totalPrincipalPaid: totalPrincipalPaid.toFixed(2),
    totalInterestPaid: totalInterestPaid.toFixed(2),
    totalAmountPaid: totalAmountPaid.toFixed(2),
    principalRemaining: principalRemaining.toFixed(2),
    interestRemaining: interestRemaining.toFixed(2),
    installmentsCompleted: payrollCount,
    installmentsRemaining: Math.max(0, tenureMonths - payrollCount),
    entryCount: entries.length,
    asOfDate,
    derivation: {
      formula: 'totalLoan - sum(entries.amount)',
      totalLoan: totalLoan.toFixed(2),
      entriesSum: totalAmountPaid.toFixed(2),
    },
  };
}
```

**Key design decisions:**
- Pure function — receives data, returns result. No DB access (architecture mandate).
- Counts only `PAYROLL` entries for `installmentsCompleted`. `ADJUSTMENT`, `MIGRATION_BASELINE`, and `WRITE_OFF` entries affect the balance but are not installments.
- `installmentsRemaining` never goes below 0 (a fully-paid loan has 0 remaining).
- `derivation` field enables audit traceability — the auditor sees exactly what values produced the result.

### Ledger Accessor Extension — `selectByLoanAsOf()`

Add to `ledgerDb` in `apps/server/src/db/immutable.ts`:

```typescript
import { lte } from 'drizzle-orm';

async selectByLoanAsOf(loanId: string, asOf: Date) {
  return db
    .select()
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.loanId, loanId),
        lte(ledgerEntries.createdAt, asOf),
      )
    )
    .orderBy(asc(ledgerEntries.createdAt));
},
```

### Balance Service — `apps/server/src/services/balanceService.ts`

```typescript
import { db } from '../db/index';
import { loans } from '../db/schema';
import { ledgerDb } from '../db/immutable';
import { eq } from 'drizzle-orm';
import { AppError } from '../lib/appError';
import { VOCABULARY } from '@vlprs/shared';
import { computeBalanceFromEntries } from './computationEngine';

export async function getOutstandingBalance(loanId: string, asOf?: Date, mdaId?: string) {
  const [loan] = await db.select().from(loans).where(eq(loans.id, loanId));
  if (!loan) {
    throw new AppError(404, 'LOAN_NOT_FOUND', VOCABULARY.LOAN_NOT_FOUND);
  }
  // MDA scoping: reject if mda_officer's MDA doesn't match loan's MDA
  if (mdaId && loan.mdaId !== mdaId) {
    throw new AppError(403, 'MDA_ACCESS_DENIED', VOCABULARY.MDA_ACCESS_DENIED);
  }

  const entries = asOf
    ? await ledgerDb.selectByLoanAsOf(loanId, asOf)
    : await ledgerDb.selectByLoan(loanId);

  return computeBalanceFromEntries(
    loan.principalAmount,
    loan.interestRate,
    loan.tenureMonths,
    entries,
    asOf ? asOf.toISOString().split('T')[0] : null,
  );
}
```

### Balance Route — `apps/server/src/routes/balanceRoutes.ts`

```typescript
import { Router, type Request, type Response } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requirePasswordChange } from '../middleware/requirePasswordChange';
import { authorise } from '../middleware/authorise';
import { scopeToMda } from '../middleware/scopeToMda';
import { auditLog } from '../middleware/auditLog';
import { ROLES } from '@vlprs/shared';
import * as balanceService from '../services/balanceService';

const router = Router();

router.get(
  '/loans/:loanId/balance',
  authenticate,
  requirePasswordChange,
  authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN, ROLES.MDA_OFFICER),
  scopeToMda,
  auditLog,
  async (req: Request, res: Response) => {
    const loanId = Array.isArray(req.params.loanId) ? req.params.loanId[0] : req.params.loanId;
    // Parse optional asOf query param
    let asOf: Date | undefined;
    if (req.query.asOf) {
      const parsed = new Date(req.query.asOf as string);
      if (isNaN(parsed.getTime())) {
        throw new AppError(400, 'VALIDATION_FAILED', 'asOf must be a valid date (YYYY-MM-DD)');
      }
      // Set to end of day to include all entries on that date
      parsed.setUTCHours(23, 59, 59, 999);
      asOf = parsed;
    }
    // MDA scoping: mda_officer can only query balance for loans in their MDA
    const mdaId = req.user!.role === 'mda_officer' ? req.user!.mdaId! : undefined;
    const result = await balanceService.getOutstandingBalance(loanId, asOf, mdaId);
    res.json({ success: true, data: result });
  },
);

export default router;
```

**MDA scoping:** The route passes `mdaId` to the balance service for MDA officers (same pattern as Story 2.2's ledger route and Story 2.3's schedule route). The service must verify `loan.mdaId === mdaId` before computing.

Register in `app.ts`:
```typescript
import balanceRoutes from './routes/balanceRoutes';
app.use('/api', balanceRoutes);
```

### Vocabulary Additions

Add to `packages/shared/src/constants/vocabulary.ts`:
```typescript
// Balance (Story 2.5)
BALANCE_COMPUTED: 'Balance computed from ledger entries.',
INVALID_AS_OF_DATE: 'The provided date is not valid. Use YYYY-MM-DD format.',
```

### What NOT To Do

1. **DO NOT add a `balance` or `outstanding_balance` column to the `loans` table** — balances are ALWAYS computed from ledger entries (architectural invariant)
2. **DO NOT cache balance results** — no Redis, no materialised views for MVP; PostgreSQL query performance is sufficient for 3,100 beneficiaries / ~189K ledger rows
3. **DO NOT use `Number` or `parseFloat()` for summing ledger entries** — all arithmetic via `decimal.js`
4. **DO NOT access the database from `computeBalanceFromEntries()`** — it is a pure function; the service layer fetches data and passes it in
5. **DO NOT implement dashboard aggregate metrics** — Epic 4 will aggregate balance computations across loans; this story is single-loan balance only
6. **DO NOT implement auto-stop detection (zero balance trigger)** — that is Epic 8; this story just computes the balance
7. **DO NOT duplicate the ledger query endpoint** — `GET /api/ledger/:loanId` (Story 2.2) returns raw entries; `GET /api/loans/:loanId/balance` returns the computed result; together they form the derivation chain
8. **DO NOT modify the computation engine's `computeRepaymentSchedule()` function** — balance computation is a separate function that sums actual entries, not projected schedule rows

### Integration Test Architecture

**File:** `apps/server/src/routes/balance.integration.test.ts`

Follow the established pattern from `auditLog.integration.test.ts` and `ledger.integration.test.ts`:

```typescript
beforeAll(async () => {
  await db.execute(sql`TRUNCATE ledger_entries, loans, users, mdas CASCADE`);

  // Seed test MDA, user, loan
  await db.insert(mdas).values({ id: testMdaId, name: 'Test MDA', code: 'TEST' });
  await db.insert(users).values({
    id: testUserId, email: 'test@test.com', hashedPassword: 'hashed',
    firstName: 'Test', lastName: 'User', role: 'super_admin',
  });
  await db.insert(loans).values({
    id: testLoanId, staffId: 'STAFF-001', staffName: 'Test Staff',
    gradeLevel: 'GL-07', mdaId: testMdaId, principalAmount: '250000.00',
    interestRate: '13.330', tenureMonths: 60, monthlyDeductionAmount: '4722.08',
    approvalDate: new Date(), firstDeductionDate: new Date(),
    loanReference: 'VLC-2026-0001', status: 'ACTIVE',
  });

  // Seed 30 PAYROLL entries (half paid)
  for (let i = 0; i < 30; i++) {
    await db.insert(ledgerEntries).values({
      loanId: testLoanId, staffId: 'STAFF-001', mdaId: testMdaId,
      entryType: 'PAYROLL', amount: '4722.08',
      principalComponent: '4166.67', interestComponent: '555.41',
      periodMonth: ((i % 12) + 1), periodYear: 2025,
      postedBy: testUserId,
      createdAt: new Date(2025, i % 12, 15), // spread across months
    });
  }
});
```

**Test scenarios:**
1. **Current balance (30/60 paid):** `computedBalance = 283325.00 - (30 × 4722.08) = 283325.00 - 141662.40 = 141662.60`
2. **Historical balance (`asOf=2025-06-30`):** Only entries up to June 2025
3. **No entries:** Balance = totalLoan (`283325.00`)
4. **Fully paid (60 entries):** Balance ≈ `0.00` (exact zero with last-payment adjustment entries)

### Project Structure Notes

| File | Location | Change Type |
|------|----------|-------------|
| `balance.ts` types | `packages/shared/src/types/balance.ts` | **New** |
| `index.ts` | `packages/shared/src/index.ts` | **Modify** — add export |
| `computationEngine.ts` | `apps/server/src/services/computationEngine.ts` | **Modify** — add `computeBalanceFromEntries()` |
| `computationEngine.test.ts` | `apps/server/src/services/computationEngine.test.ts` | **Modify** — add balance tests |
| `immutable.ts` | `apps/server/src/db/immutable.ts` | **Modify** — add `selectByLoanAsOf()` |
| `balanceService.ts` | `apps/server/src/services/balanceService.ts` | **New** |
| `balanceRoutes.ts` | `apps/server/src/routes/balanceRoutes.ts` | **New** |
| `balance.integration.test.ts` | `apps/server/src/routes/balance.integration.test.ts` | **New** |
| `app.ts` | `apps/server/src/app.ts` | **Modify** — register route |
| `vocabulary.ts` | `packages/shared/src/constants/vocabulary.ts` | **Modify** — add entries |

### Dependencies

- **Depends on:** Story 2.2 (ledger table + `ledgerDb` accessor), Story 2.3 (computation engine + `decimal.js` config), Story 2.4 (last-payment adjustment — guarantees ₦0.00 closure for fully-paid loans)
- **Blocks:** Story 2.6 (loan search returns `outstandingBalance`), Story 2.7 (lifecycle transitions may check balance), Epic 4 (dashboard aggregates balance across loans), Epic 8 (auto-stop detects zero balance)
- **Can parallel with:** Nothing — depends on 2.2, 2.3, 2.4

### Technical Stack for This Story

| Tool | Version | Purpose |
|------|---------|---------|
| `decimal.js` | ^10.5.0 | Balance summation arithmetic |
| Drizzle ORM | ^0.45.0 | Ledger entry queries, `lte()` for historical filter |
| Vitest | Latest | Unit + integration tests |
| supertest | ^7.1.0 | HTTP integration tests |

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` → Story 2.5] — BDD acceptance criteria, FR6, FR12
- [Source: `_bmad-output/planning-artifacts/architecture.md` → Computed Views] — "balances derived from ledger entries, never stored as mutable state"
- [Source: `_bmad-output/planning-artifacts/architecture.md` → Service Boundaries] — `computationEngine` owns balance derivation, calls only `decimal.js`, never DB
- [Source: `_bmad-output/planning-artifacts/architecture.md` → Caching] — "No cache layer for MVP — PostgreSQL query optimisation only"
- [Source: `_bmad-output/planning-artifacts/prd.md` → FR6] — "compute outstanding balances from the immutable repayment ledger (derived, never stored)"
- [Source: `_bmad-output/planning-artifacts/prd.md` → FR12] — "reconstruct any loan balance at any point in time from the ledger history"
- [Source: `_bmad-output/planning-artifacts/prd.md` → Journey 10 (Auditor)] — Full computation chain visibility, independent verification to kobo
- [Source: `_bmad-output/implementation-artifacts/2-2-immutable-repayment-ledger.md`] — `ledgerDb` accessor, `ledgerEntries` schema, entry types
- [Source: `_bmad-output/implementation-artifacts/2-3-loan-repayment-schedule-computation.md`] — `ComputationParams`, flat-rate model, `decimal.js` config
- [Source: `_bmad-output/implementation-artifacts/2-4-accelerated-repayment-last-payment-adjustment-auto-split.md`] — Last-payment adjustment (₦0.00 closure guarantee)
- [Source: `_bmad-output/implementation-artifacts/2-1-mda-registry-loan-master-records.md`] — `loans` table schema
- [Source: `packages/shared/src/types/loan.ts`] — `LoanSummary.outstandingBalance` field (exists but not yet populated)
- [Source: `packages/shared/src/types/dashboard.ts`] — `DashboardMetrics.totalExposure` (future consumer of balance computation)

## PM Validation Findings

**Validated:** 2026-02-24 | **Verdict:** Pass with 1 medium finding (resolved inline) | **Blocking issues:** None remaining

1. **[MEDIUM — Resolved] MDA scoping not enforced at loan level in balance route.** The route applied `scopeToMda` middleware but the handler didn't verify `loan.mdaId === req.user.mdaId` for MDA officers — an MDA officer could query balances for any loan by ID. Story 2.3's schedule route and Story 2.2's ledger route both enforce this check. **Fix applied:** Route handler now passes `mdaId` to the balance service; service checks `loan.mdaId !== mdaId` and throws `AppError(403, 'MDA_ACCESS_DENIED')`. Route code block, service code block, and MDA scoping note all updated.

2. **[LOW — Timezone Note] `asOf` date uses end-of-day UTC, not WAT.** `parsed.setUTCHours(23, 59, 59, 999)` means "as of June 30" includes entries up to 00:59:59 WAT on July 1. Negligible practical impact — financial entries are posted during business hours (8am-6pm WAT). Dev should document this behaviour.

3. **[LOW — Test Note] "Fully paid" integration test needs last-payment adjusted entry.** The test setup seeds uniform entries at ₦4,722.08 each. For the 60-entry fully-paid scenario, entry #60 must use the adjusted amount (₦4,722.28 for 250K/13.33%/60mo) to achieve exact ₦0.00 balance. Dev should handle this when implementing the fully-paid test case.

4. **[LOW — Positive] `installmentsCompleted` counts only PAYROLL entries.** Correctly distinguishes regular installments from ADJUSTMENT, MIGRATION_BASELINE, and WRITE_OFF entries. Good design.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

No debug issues encountered. All implementations followed existing codebase patterns. Type-check and full test suite passed on first run.

### Completion Notes List

- **Task 1:** Created `BalanceResult` interface in `packages/shared/src/types/balance.ts` with all required fields: computedBalance, totalPrincipalPaid, totalInterestPaid, totalAmountPaid, principalRemaining, interestRemaining, installmentsCompleted, installmentsRemaining, entryCount, asOfDate, and derivation chain. Exported from shared index.
- **Task 2:** Added `computeBalanceFromEntries()` pure function to computation engine. Takes loan params + entries array, returns `BalanceResult`. All arithmetic via `decimal.js`. Counts only PAYROLL entries for installmentsCompleted. `installmentsRemaining` clamped to 0 minimum.
- **Task 3:** Extended `ledgerDb` accessor with `selectByLoanAsOf(loanId, asOf)` method using `lte(createdAt, asOf)` filter, ordered by `createdAt` ascending. Imported `lte` from drizzle-orm.
- **Task 4:** Created balance service with `getOutstandingBalance(loanId, asOf?, mdaId?)`. Validates loan existence (404), enforces MDA scoping (403), delegates to pure computation function.
- **Task 5:** Created `balanceRoutes.ts` with `GET /api/loans/:loanId/balance`. Middleware chain: authenticate → requirePasswordChange → authorise → scopeToMda → auditLog. Parses optional `?asOf=YYYY-MM-DD` with end-of-day UTC for inclusive date filtering. Registered in `app.ts`. Added `BALANCE_COMPUTED` and `INVALID_AS_OF_DATE` vocabulary entries.
- **Task 6:** Added 12 unit tests for `computeBalanceFromEntries()`: zero entries, partial (30/60), fully paid with last-payment adjustment, historical subset, determinism, 2-decimal format verification, ADJUSTMENT entry handling, installmentsRemaining floor at 0, and all 4 tier configs closing at 0.00.
- **Task 7:** Added 9 integration tests: current balance with 30 seeded entries, response envelope, historical balance with asOf filter, invalid asOf date (400), MDA officer access (own MDA), MDA officer denied (other MDA's loan → 403), no entries = totalLoan, 404 for non-existent loan, 401 without auth.
- **Timezone note (PM finding #2):** `asOf` date uses end-of-day UTC (`23:59:59.999`). Entries posted during WAT business hours are correctly included. Documented in route handler comment.
- **Full regression suite:** 386 tests pass across 35 test files, zero regressions.

### Commit Summary

<!-- Convention: Fill this section when story reaches 'done' status -->
<!-- Format: Total commits | Files touched (new/modified) | Revert count | One-sentence narrative -->

### File List

| File | Change | Description |
|------|--------|-------------|
| `packages/shared/src/types/balance.ts` | **New** | `BalanceResult` interface for balance computation results |
| `packages/shared/src/index.ts` | Modified | Added `BalanceResult` type export |
| `packages/shared/src/constants/vocabulary.ts` | Modified | Added `BALANCE_COMPUTED` and `INVALID_AS_OF_DATE` entries |
| `apps/server/src/services/computationEngine.ts` | Modified | Added `computeBalanceFromEntries()` pure function + `LedgerEntryForBalance` interface |
| `apps/server/src/db/immutable.ts` | Modified | Added `selectByLoanAsOf()` method to `ledgerDb` accessor |
| `apps/server/src/services/balanceService.ts` | **New** | Balance service with `getOutstandingBalance()` — loan lookup, MDA scoping, delegation to pure computation |
| `apps/server/src/routes/balanceRoutes.ts` | **New** | `GET /api/loans/:loanId/balance` route with auth, MDA scoping, optional `?asOf` query |
| `apps/server/src/app.ts` | Modified | Registered `balanceRoutes` at `/api` prefix |
| `apps/server/src/services/computationEngine.test.ts` | Modified | Added 12 unit tests for `computeBalanceFromEntries()` |
| `apps/server/src/routes/balance.integration.test.ts` | **New** | 9 integration tests for balance endpoint (current, historical, MDA scoping, errors) |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | Modified | Sprint tracking status update for Story 2.5 |

### Change Log

- **2026-02-26:** Story 2.5 implemented — outstanding balance computation and historical reconstruction. Added `BalanceResult` shared type, `computeBalanceFromEntries()` pure function, `selectByLoanAsOf()` ledger accessor, balance service with MDA scoping, `GET /api/loans/:loanId/balance` route with optional `?asOf` query parameter. 12 unit tests + 9 integration tests added. Full suite: 386 tests pass, 0 regressions.
- **2026-02-26 (Code Review):** Adversarial review found 8 issues (2H, 4M, 2L) — all fixed. H1: Refactored balance service to use `loanService.getLoanById()` with query-level MDA scoping (404 instead of 403, consistent with peer routes). H2: Added input validation to `computeBalanceFromEntries()` matching sibling functions. M1: Replaced manual date parsing with Zod regex schema. M2: Removed misleading `balanceService.test.ts` from Project Structure Notes. M3: Added `isAnomaly` flag to derivation for negative balance detection. M4: Deleted junk `new_read.txt`. L1: Added `sprint-status.yaml` to File List. L2: Moved `LedgerEntryForBalance` to shared types. +5 new tests (3 validation, 2 anomaly). Full suite: 391 tests pass, 0 regressions.
