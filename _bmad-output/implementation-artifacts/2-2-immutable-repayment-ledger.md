# Story 2.2: Immutable Repayment Ledger

Status: ready-for-dev

<!-- Generated: 2026-02-24 | Epic: 2 | Sprint: 3 -->
<!-- Blocked By: 2-0 (CI infrastructure), 2-1 (loans table FK) | Blocks: 2-3, 2-4, 2-5, 2-6, 2-7 -->
<!-- FRs: FR11, NFR-SEC-5 | Enables: FR12 (implementation in Story 2.5) | Motivation: Banking-grade immutable financial records -->
<!-- Source: epics.md → Epic 2, Story 2.2 | architecture.md → Immutable Ledger section -->

## Story

As an **auditor**,
I want every repayment entry recorded in an immutable, append-only ledger that cannot be modified or deleted,
So that the financial record has banking-grade integrity and any balance is verifiable.

### Context

The repayment ledger is the financial foundation of VLPRS. Every downstream computation — outstanding balances (Story 2.5), repayment schedules (Story 2.3), accelerated payoffs (Story 2.4), early exits (Epic 12), and monthly submission comparisons (Epic 5) — derives from ledger entries. If any entry can be mutated, the entire system's integrity collapses. The architecture prescribes 3-layer immutability (DB trigger + ORM wrapper + API middleware) so that no single failure point compromises financial records.

## Acceptance Criteria

### AC 1: Ledger Entry Table & INSERT API

**Given** a `ledger_entries` table with UUIDv7 PK, columns: `loan_id` (FK), `staff_id`, `mda_id`, `entry_type` (PAYROLL, ADJUSTMENT, MIGRATION_BASELINE, WRITE_OFF), `amount` (NUMERIC 15,2), `principal_component` (NUMERIC 15,2), `interest_component` (NUMERIC 15,2), `period_month`, `period_year`, `payroll_batch_reference`, `source`, `posted_by` (FK users), `created_at`
**When** a ledger entry is inserted via `POST /api/ledger`
**Then** it is persisted with a UUIDv7 PK and immutable timestamp (FR11)
**And** `staff_id` and `mda_id` are auto-populated from the referenced loan record
**And** `posted_by` is set from the authenticated user's JWT `userId`
**And** the response returns the created entry with all fields

### AC 2: 3-Layer Immutability Enforcement

**Given** the 3-layer immutability enforcement
**When** any attempt is made to UPDATE or DELETE a ledger entry
**Then** **Layer 1 (DB):** PostgreSQL `BEFORE UPDATE OR DELETE` trigger raises an exception
**And** **Layer 2 (ORM):** Service-layer guard rejects `.update()` / `.delete()` on ledger tables before reaching the DB
**And** **Layer 3 (API):** Express middleware rejects `PUT`/`PATCH`/`DELETE` on `/api/ledger/*` routes with 405 Method Not Allowed (NFR-SEC-5)

### AC 3: Chronological Query & Ordering

**Given** the ledger_entries table
**When** entries are queried for a specific loan via `GET /api/ledger/:loanId`
**Then** they are returned in chronological order (UUIDv7 natural ordering) with all fields intact
**And** responses use the standard `{ success: true, data: [...] }` envelope
**And** MDA-scoped users can only query ledger entries for loans within their MDA

## Tasks / Subtasks

- [ ] Task 1: Add `ledger_entries` schema + Drizzle migration (AC: 1, 2)
  - [ ] 1.1 Add `entryTypeEnum` pgEnum to `apps/server/src/db/schema.ts`
  - [ ] 1.2 Add `ledgerEntries` table definition to schema.ts with all columns from AC 1
  - [ ] 1.3 Add `numeric` to the `drizzle-orm/pg-core` import if not already present (Story 2.1 should have added it)
  - [ ] 1.4 Generate Drizzle migration: `pnpm --filter server drizzle-kit generate`
  - [ ] 1.5 Extend `applyTriggers()` in `apps/server/src/db/triggers.ts` — add `trg_ledger_entries_immutable` trigger on `ledger_entries`
- [ ] Task 2: Add shared types, Zod validators, and vocabulary (AC: 1)
  - [ ] 2.1 Create `packages/shared/src/types/ledger.ts` — `LedgerEntryType`, `LedgerEntry` interface
  - [ ] 2.2 Create `packages/shared/src/validators/ledgerSchemas.ts` — `createLedgerEntrySchema` Zod validator
  - [ ] 2.3 Add ledger vocabulary entries to `packages/shared/src/constants/vocabulary.ts`
  - [ ] 2.4 Add exports to `packages/shared/src/index.ts`
- [ ] Task 3: Create ORM immutability guard (AC: 2, Layer 2)
  - [ ] 3.1 Create `apps/server/src/db/immutable.ts` — guard function + constrained ledger DB accessor
  - [ ] 3.2 Unit tests in `apps/server/src/db/immutable.test.ts`
- [ ] Task 4: Create API immutability middleware (AC: 2, Layer 3)
  - [ ] 4.1 Create `apps/server/src/middleware/immutableRoute.ts` — Express middleware rejecting PUT/PATCH/DELETE
  - [ ] 4.2 Unit tests in `apps/server/src/middleware/immutableRoute.test.ts`
- [ ] Task 5: Create ledger service (AC: 1, 3)
  - [ ] 5.1 Create `apps/server/src/services/ledgerService.ts` — `createEntry()` + `getEntriesByLoan()`
  - [ ] 5.2 Unit tests in `apps/server/src/services/ledgerService.test.ts`
- [ ] Task 6: Create ledger routes + register in app (AC: 1, 3)
  - [ ] 6.1 Create `apps/server/src/routes/ledgerRoutes.ts` — POST /api/ledger, GET /api/ledger/:loanId
  - [ ] 6.2 Apply `immutableRoute` middleware to reject PUT/PATCH/DELETE on all /ledger routes
  - [ ] 6.3 Register `ledgerRoutes` in `apps/server/src/app.ts`
- [ ] Task 7: Integration tests (AC: 1, 2, 3)
  - [ ] 7.1 Create `apps/server/src/routes/ledger.integration.test.ts`
  - [ ] 7.2 Test: POST /api/ledger persists entry with correct fields + auto-populated staff_id/mda_id
  - [ ] 7.3 Test: DB trigger rejects UPDATE on ledger_entries (same error pattern as auditLog)
  - [ ] 7.4 Test: DB trigger rejects DELETE on ledger_entries
  - [ ] 7.5 Test: GET /api/ledger/:loanId returns entries in chronological order
  - [ ] 7.6 Test: PUT/PATCH/DELETE on /api/ledger/* return 405 Method Not Allowed
  - [ ] 7.7 Test: MDA-scoped user cannot access ledger entries for loans in another MDA

## Dev Notes

### Critical Context

This story creates the **financial backbone** of VLPRS. Every subsequent story in Epic 2 (and Epics 3, 5, 10, 12) depends on `ledger_entries`. The 3-layer immutability defence is non-negotiable — if any layer is missing, the audit guarantee is broken.

**Money handling rule:** All money columns are `NUMERIC(15,2)` in PostgreSQL, returned as **strings** by Drizzle ORM, transmitted as **strings** in JSON API responses. NEVER use JavaScript `number` or `parseFloat()` for money. The computation engine (Story 2.3) will use `decimal.js` for arithmetic — this story only does INSERT and SELECT.

### What Already Exists

**`fn_prevent_modification()` function — ALREADY IN triggers.ts:**
```typescript
// Reusable immutability function (audit_log now, ledger_entries in Epic 2)
await db.execute(sql`
  CREATE OR REPLACE FUNCTION fn_prevent_modification()
  RETURNS TRIGGER AS $$
  BEGIN
    RAISE EXCEPTION 'Modifications to % are not allowed: % operation rejected',
      TG_TABLE_NAME, TG_OP
      USING ERRCODE = 'restrict_violation';
  END;
  $$ LANGUAGE plpgsql;
`);
```
The function is table-agnostic (uses `TG_TABLE_NAME`). **Do NOT recreate it** — just add a new `CREATE TRIGGER` statement for `ledger_entries`.

**Audit log immutability trigger pattern — ALREADY WORKING:**
The `trg_audit_log_immutable` trigger on `audit_log` is the exact pattern to replicate. Just add:
```typescript
await db.execute(sql`
  DROP TRIGGER IF EXISTS trg_ledger_entries_immutable ON ledger_entries;
  CREATE TRIGGER trg_ledger_entries_immutable
    BEFORE UPDATE OR DELETE ON ledger_entries
    FOR EACH ROW
    EXECUTE FUNCTION fn_prevent_modification();
`);
```

**Immutability test pattern — from `auditLog.integration.test.ts`:**
```typescript
try {
  await db.update(ledgerEntries).set({ amount: '9999.99' }).where(eq(ledgerEntries.id, entry.id));
  expect.fail('UPDATE should have been rejected by immutability trigger');
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  const cause = err instanceof Error && 'cause' in err
    ? String((err as Error & { cause: Error }).cause?.message ?? '') : '';
  const fullMsg = `${message} ${cause}`;
  expect(fullMsg).toMatch(/Modifications to ledger_entries are not allowed.*UPDATE operation rejected/);
}
```

**Middleware chain — from `userRoutes.ts`:**
```typescript
const adminAuth = [
  authenticate,
  requirePasswordChange,
  authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN),
];
```

**Route registration — from `app.ts` (line 37-39):**
```typescript
app.use('/api', healthRoutes);
app.use('/api', authRoutes);
app.use('/api', userRoutes);
// Add: app.use('/api', ledgerRoutes);
```

**Zod validation middleware — `validate.ts`:**
Parses `req.body` against a Zod schema, throws `AppError(400, 'VALIDATION_FAILED')` on failure.

**Response envelope — `ApiResponse<T>`:**
```typescript
res.status(201).json({ success: true, data: entry });
```

**Express 5 param helper — from `userRoutes.ts`:**
```typescript
function param(val: string | string[]): string {
  return Array.isArray(val) ? val[0] : val;
}
```

### Schema Design — `ledger_entries` Table

```typescript
// Add to schema.ts imports (if not already present from Story 2.1):
import { numeric } from 'drizzle-orm/pg-core';

export const entryTypeEnum = pgEnum('entry_type', [
  'PAYROLL', 'ADJUSTMENT', 'MIGRATION_BASELINE', 'WRITE_OFF',
]);

// ─── Ledger Entries (Story 2.2) ────────────────────────────────────
// Append-only, immutable financial ledger. No updated_at, no deleted_at.
// Immutability enforced by DB trigger (fn_prevent_modification).
export const ledgerEntries = pgTable(
  'ledger_entries',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUuidv7),
    loanId: uuid('loan_id').notNull().references(() => loans.id),
    staffId: varchar('staff_id', { length: 50 }).notNull(),
    mdaId: uuid('mda_id').notNull().references(() => mdas.id),
    entryType: entryTypeEnum('entry_type').notNull(),
    amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
    principalComponent: numeric('principal_component', { precision: 15, scale: 2 }).notNull(),
    interestComponent: numeric('interest_component', { precision: 15, scale: 2 }).notNull(),
    periodMonth: integer('period_month').notNull(),
    periodYear: integer('period_year').notNull(),
    payrollBatchReference: varchar('payroll_batch_reference', { length: 100 }),
    source: varchar('source', { length: 255 }),
    postedBy: uuid('posted_by').notNull().references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_ledger_entries_loan_id').on(table.loanId),
    index('idx_ledger_entries_mda_id').on(table.mdaId),
    index('idx_ledger_entries_staff_id').on(table.staffId),
    index('idx_ledger_entries_created_at').on(table.createdAt),
    index('idx_ledger_entries_period').on(table.periodYear, table.periodMonth),
  ],
);
```

**Key design decisions:**
- **No `updated_at` or `deleted_at`** — append-only table, same pattern as `audit_log`
- **`staff_id` and `mda_id` denormalized** — enables efficient MDA-scoped queries without joining through `loans`
- **`period_month` (1-12) + `period_year`** — identifies which payroll period the entry covers
- **`payroll_batch_reference`** — optional, links back to the MDA's payroll batch for reconciliation
- **`source`** — tracks data origin (e.g., "Monthly payroll deduction", "Migration import", "Manual adjustment")
- **Indexes** — `loan_id` (primary query), `mda_id` (MDA-scoped access), `staff_id` (staff search), `created_at` (time range), `(period_year, period_month)` (period-based queries)

### Shared Types — `packages/shared/src/types/ledger.ts`

```typescript
export type LedgerEntryType = 'PAYROLL' | 'ADJUSTMENT' | 'MIGRATION_BASELINE' | 'WRITE_OFF';

export interface LedgerEntry {
  id: string;
  loanId: string;
  staffId: string;
  mdaId: string;
  entryType: LedgerEntryType;
  amount: string;           // NUMERIC(15,2) → string, NEVER number
  principalComponent: string;
  interestComponent: string;
  periodMonth: number;
  periodYear: number;
  payrollBatchReference: string | null;
  source: string | null;
  postedBy: string;
  createdAt: string;        // ISO 8601 timestamp
}
```

### Zod Validator — `packages/shared/src/validators/ledgerSchemas.ts`

```typescript
import { z } from 'zod/v4';

export const createLedgerEntrySchema = z.object({
  loanId: z.string().uuid(),
  entryType: z.enum(['PAYROLL', 'ADJUSTMENT', 'MIGRATION_BASELINE', 'WRITE_OFF']),
  amount: z.string().regex(/^\d+\.\d{2}$/, 'Amount must be a decimal string with exactly 2 decimal places'),
  principalComponent: z.string().regex(/^\d+\.\d{2}$/, 'Must be a decimal string with exactly 2 decimal places'),
  interestComponent: z.string().regex(/^\d+\.\d{2}$/, 'Must be a decimal string with exactly 2 decimal places'),
  periodMonth: z.number().int().min(1).max(12),
  periodYear: z.number().int().min(2000).max(2100),
  payrollBatchReference: z.string().max(100).optional(),
  source: z.string().max(255).optional(),
});
```

**NOTE:** `loanId` is the only FK in the request body. `staff_id`, `mda_id`, and `posted_by` are auto-populated server-side.

### Vocabulary Additions — `packages/shared/src/constants/vocabulary.ts`

Add to the `VOCABULARY` object:
```typescript
// Ledger (Story 2.2)
LOAN_NOT_FOUND: 'The referenced loan record could not be found.',
LEDGER_IMMUTABLE: 'Financial records cannot be modified or deleted.',
LEDGER_METHOD_NOT_ALLOWED: 'This operation is not permitted on financial records.',
LEDGER_ENTRY_CREATED: 'Ledger entry recorded successfully.',
```

### ORM Immutability Guard — Layer 2

Create `apps/server/src/db/immutable.ts`:

```typescript
import { db } from './index';
import { ledgerEntries } from './schema';
import { eq, asc } from 'drizzle-orm';
import type { LedgerEntry } from '@vlprs/shared';

/**
 * Constrained DB accessor for ledger_entries.
 * ONLY exposes insert and select — no update or delete.
 * This is Layer 2 of the 3-layer immutability defence.
 */
export const ledgerDb = {
  async insert(values: typeof ledgerEntries.$inferInsert) {
    const [entry] = await db.insert(ledgerEntries).values(values).returning();
    return entry;
  },

  async selectByLoan(loanId: string) {
    return db
      .select()
      .from(ledgerEntries)
      .where(eq(ledgerEntries.loanId, loanId))
      .orderBy(asc(ledgerEntries.createdAt));
  },

  async selectByMdaAndLoan(mdaId: string, loanId: string) {
    return db
      .select()
      .from(ledgerEntries)
      .where(
        and(eq(ledgerEntries.loanId, loanId), eq(ledgerEntries.mdaId, mdaId))
      )
      .orderBy(asc(ledgerEntries.createdAt));
  },
};
```

Add `and` to drizzle-orm imports. The key point: **no `.update()` or `.delete()` methods exist on `ledgerDb`**. All ledger DB access MUST go through this module, never directly via `db.update(ledgerEntries)` or `db.delete(ledgerEntries)`.

**Unit test (`immutable.test.ts`):** Verify that `ledgerDb` has no `update` or `delete` properties:
```typescript
expect(ledgerDb).not.toHaveProperty('update');
expect(ledgerDb).not.toHaveProperty('delete');
```

### API Immutability Middleware — Layer 3

Create `apps/server/src/middleware/immutableRoute.ts`:

```typescript
import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/appError';
import { VOCABULARY } from '@vlprs/shared';

const BLOCKED_METHODS = new Set(['PUT', 'PATCH', 'DELETE']);

/**
 * Express middleware that rejects PUT, PATCH, DELETE on immutable resource routes.
 * Layer 3 of the 3-layer immutability defence.
 */
export function immutableRoute(req: Request, _res: Response, next: NextFunction): void {
  if (BLOCKED_METHODS.has(req.method)) {
    throw new AppError(405, 'METHOD_NOT_ALLOWED', VOCABULARY.LEDGER_METHOD_NOT_ALLOWED);
  }
  next();
}
```

Apply to the ledger router:
```typescript
router.use(immutableRoute);  // All /ledger/* routes reject PUT/PATCH/DELETE
```

### Ledger Service — `apps/server/src/services/ledgerService.ts`

```typescript
import { ledgerDb } from '../db/immutable';
import { db } from '../db/index';
import { loans } from '../db/schema';
import { eq } from 'drizzle-orm';
import { AppError } from '../lib/appError';
import { VOCABULARY } from '@vlprs/shared';

interface CreateEntryData {
  loanId: string;
  entryType: 'PAYROLL' | 'ADJUSTMENT' | 'MIGRATION_BASELINE' | 'WRITE_OFF';
  amount: string;
  principalComponent: string;
  interestComponent: string;
  periodMonth: number;
  periodYear: number;
  payrollBatchReference?: string;
  source?: string;
}

export async function createEntry(postedBy: string, data: CreateEntryData) {
  // Look up loan to auto-populate staff_id and mda_id
  const [loan] = await db.select().from(loans).where(eq(loans.id, data.loanId));
  if (!loan) {
    throw new AppError(404, 'LOAN_NOT_FOUND', VOCABULARY.LOAN_NOT_FOUND);
  }

  return ledgerDb.insert({
    loanId: data.loanId,
    staffId: loan.staffId,
    mdaId: loan.mdaId,
    entryType: data.entryType,
    amount: data.amount,
    principalComponent: data.principalComponent,
    interestComponent: data.interestComponent,
    periodMonth: data.periodMonth,
    periodYear: data.periodYear,
    payrollBatchReference: data.payrollBatchReference ?? null,
    source: data.source ?? null,
    postedBy,
  });
}

export async function getEntriesByLoan(loanId: string, mdaId?: string) {
  if (mdaId) {
    return ledgerDb.selectByMdaAndLoan(mdaId, loanId);
  }
  return ledgerDb.selectByLoan(loanId);
}
```

### Ledger Routes — `apps/server/src/routes/ledgerRoutes.ts`

```typescript
import { Router, type Request, type Response } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requirePasswordChange } from '../middleware/requirePasswordChange';
import { authorise } from '../middleware/authorise';
import { scopeToMda } from '../middleware/scopeToMda';
import { validate } from '../middleware/validate';
import { auditLog } from '../middleware/auditLog';
import { immutableRoute } from '../middleware/immutableRoute';
import { ROLES, createLedgerEntrySchema } from '@vlprs/shared';
import * as ledgerService from '../services/ledgerService';

const router = Router();

// Layer 3: Reject PUT/PATCH/DELETE on all /ledger routes
router.use('/ledger', immutableRoute);

// POST /api/ledger — Create ledger entry (admin only)
router.post(
  '/ledger',
  authenticate,
  requirePasswordChange,
  authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN),
  validate(createLedgerEntrySchema),
  auditLog,
  async (req: Request, res: Response) => {
    const entry = await ledgerService.createEntry(req.user!.userId, req.body);
    res.status(201).json({ success: true, data: entry });
  },
);

// GET /api/ledger/:loanId — Get ledger entries for a loan
router.get(
  '/ledger/:loanId',
  authenticate,
  requirePasswordChange,
  authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN, ROLES.MDA_OFFICER),
  scopeToMda,
  auditLog,
  async (req: Request, res: Response) => {
    const loanId = Array.isArray(req.params.loanId) ? req.params.loanId[0] : req.params.loanId;
    const mdaId = req.user!.role === 'mda_officer' ? req.user!.mdaId! : undefined;
    const entries = await ledgerService.getEntriesByLoan(loanId, mdaId);
    res.json({ success: true, data: entries });
  },
);

export default router;
```

### What NOT To Do

1. **DO NOT use `parseFloat()` or JavaScript `number` for money values** — all NUMERIC columns are strings end-to-end (DB → API → Frontend)
2. **DO NOT add `updated_at` or `deleted_at` to `ledger_entries`** — this is an append-only table, same pattern as `audit_log`
3. **DO NOT expose `.update()` or `.delete()` on `ledgerDb`** — the ORM wrapper is deliberately constrained
4. **DO NOT modify `fn_prevent_modification()`** — it's already table-agnostic (uses `TG_TABLE_NAME`), just add a new trigger
5. **DO NOT create a separate route for each HTTP method rejection** — use the `immutableRoute` middleware on the router to block all PUT/PATCH/DELETE at once
6. **DO NOT query `ledger_entries` directly via `db.select().from(ledgerEntries)`** — always go through `ledgerDb` in `immutable.ts` to enforce the Layer 2 constraint
7. **DO NOT add Swagger/OpenAPI annotations** — deferred per architecture doc, not in this story's scope
8. **DO NOT implement balance computation** — that is Story 2.5; this story is INSERT + SELECT only
9. **DO NOT implement the MDA submission workflow** — that is Epic 5; `POST /api/ledger` is the low-level INSERT endpoint
10. **DO NOT modify existing `migrate.test.ts`** — keep existing 14 mock-based unit tests; integration tests are in separate `*.integration.test.ts` files

### Integration Test Architecture

**File:** `apps/server/src/routes/ledger.integration.test.ts`

Follow the exact pattern from `auditLog.integration.test.ts`:
- Import real `db` from `../db/index`
- Import schema tables (`ledgerEntries`, `loans`, `mdas`, `users`)
- Use `sql` tagged templates for TRUNCATE between tests
- Create test data with real DB inserts (loan, MDA, user records)
- Use `supertest` for HTTP endpoint testing
- Wrap trigger-rejection tests in try/catch with error message regex matching

**Test data setup:**
```typescript
beforeAll(async () => {
  // TRUNCATE in dependency order (child tables first)
  await db.execute(sql`TRUNCATE ledger_entries, loans, users, mdas CASCADE`);

  // Insert test MDA
  await db.insert(mdas).values({ id: testMdaId, name: 'Test MDA', code: 'TEST' });

  // Insert test user
  await db.insert(users).values({
    id: testUserId, email: 'test@test.com', hashedPassword: 'hashed',
    firstName: 'Test', lastName: 'User', role: 'super_admin',
  });

  // Insert test loan (Story 2.1 schema)
  await db.insert(loans).values({
    id: testLoanId, staffId: 'STAFF-001', staffName: 'Test Staff',
    gradeLevel: 'GL-07', mdaId: testMdaId, principalAmount: '500000.00',
    interestRate: '4.000', tenureMonths: 48, monthlyDeductionAmount: '12500.00',
    approvalDate: new Date(), firstDeductionDate: new Date(),
    loanReference: 'VLC-2026-0001', status: 'ACTIVE',
  });
});
```

**Trigger rejection test pattern (exact error format):**
```
/Modifications to ledger_entries are not allowed.*UPDATE operation rejected/
/Modifications to ledger_entries are not allowed.*DELETE operation rejected/
```

### Project Structure Notes

All new files align with established project structure:

| File | Location | Convention |
|------|----------|------------|
| `ledger_entries` schema | `apps/server/src/db/schema.ts` | Co-located with all table definitions |
| `trg_ledger_entries_immutable` | `apps/server/src/db/triggers.ts` | Co-located with `trg_audit_log_immutable` |
| `immutable.ts` | `apps/server/src/db/immutable.ts` | DB-layer module in `db/` |
| `immutable.test.ts` | `apps/server/src/db/immutable.test.ts` | Co-located with source |
| `immutableRoute.ts` | `apps/server/src/middleware/immutableRoute.ts` | Middleware in `middleware/` |
| `immutableRoute.test.ts` | `apps/server/src/middleware/immutableRoute.test.ts` | Co-located with source |
| `ledgerService.ts` | `apps/server/src/services/ledgerService.ts` | Service in `services/` |
| `ledgerService.test.ts` | `apps/server/src/services/ledgerService.test.ts` | Co-located with source |
| `ledgerRoutes.ts` | `apps/server/src/routes/ledgerRoutes.ts` | Route in `routes/` |
| `ledger.integration.test.ts` | `apps/server/src/routes/ledger.integration.test.ts` | Co-located with route (same as auditLog pattern) |
| `ledger.ts` types | `packages/shared/src/types/ledger.ts` | Shared types in `types/` |
| `ledgerSchemas.ts` validator | `packages/shared/src/validators/ledgerSchemas.ts` | Shared validators in `validators/` |

### Dependencies

- **Depends on:** Story 2.0 (CI PostgreSQL infrastructure for integration tests), Story 2.1 (`loans` table FK, `mdas` expanded schema)
- **Can NOT parallel with:** Story 2.1 (schema dependency — `loans` table must exist before `ledger_entries` FK)
- **Must complete before:** Story 2.3 (computation engine reads ledger), Story 2.4 (accelerated repayment), Story 2.5 (balance computation), Story 2.6 (loan search), Story 2.7 (lifecycle states)
- **UAT checkpoint:** Schedule after this story per Story 2.0 AC 4 — ledger immutability verification

### Technical Stack for This Story

| Tool | Version | Purpose |
|------|---------|---------|
| Drizzle ORM | ^0.45.0 | Schema definition, migration, DB queries |
| PostgreSQL | 17-alpine | Database with trigger support |
| Vitest | Latest | Unit + integration tests |
| Zod | v4 | Request body validation |
| supertest | Latest | HTTP integration tests |

### References

- [Source: `apps/server/src/db/triggers.ts`] — `fn_prevent_modification()` reusable trigger function
- [Source: `apps/server/src/db/schema.ts`] — `audit_log` table pattern (append-only, no updated_at/deleted_at)
- [Source: `apps/server/src/routes/auditLog.integration.test.ts`] — Trigger rejection test pattern (try/catch, regex match)
- [Source: `apps/server/src/routes/userRoutes.ts`] — Route + middleware chain pattern
- [Source: `apps/server/src/services/userAdminService.ts`] — Service layer pattern (types, helpers, exports)
- [Source: `apps/server/src/middleware/validate.ts`] — Zod validation middleware
- [Source: `apps/server/src/app.ts` lines 37-39] — Route registration pattern
- [Source: `packages/shared/src/types/api.ts`] — `ApiResponse<T>` envelope type
- [Source: `packages/shared/src/constants/vocabulary.ts`] — Non-punitive vocabulary pattern
- [Source: `_bmad-output/planning-artifacts/epics.md` → Story 2.2] — BDD acceptance criteria, column list, entry types
- [Source: `_bmad-output/planning-artifacts/architecture.md` → Immutable Ledger] — 3-layer immutability design, data boundaries, service boundaries
- [Source: `_bmad-output/planning-artifacts/prd.md` → FR11, FR12, NFR-SEC-5] — Functional + security requirements
- [Source: `_bmad-output/implementation-artifacts/2-1-mda-registry-loan-master-records.md`] — `loans` table schema (FK dependency)
- [Source: `_bmad-output/implementation-artifacts/2-0-sprint-infrastructure-quality-gates.md`] — Integration test pattern documentation, UAT checkpoint template

## PM Validation Findings

**Validated:** 2026-02-24 | **Verdict:** Pass with 1 medium finding (resolved inline) | **Blocking issues:** None remaining

1. **[MEDIUM — Resolved] FR12 incorrectly listed as implemented by this story.** PRD FR12 ("reconstruct any loan balance at any point in time from the ledger history") is Story 2.5's scope. This story creates the ledger table FR12 depends on but does not implement balance reconstruction — confirmed by "What NOT To Do" item #8. **Fix applied:** Header changed to `FR11, NFR-SEC-5 | Enables: FR12 (implementation in Story 2.5)`.

2. **[LOW — Informational] AC 3 says "UUIDv7 natural ordering" but `ledgerDb.selectByLoan()` orders by `createdAt`.** Both produce identical chronological results since UUIDv7 embeds a millisecond timestamp. Ordering by `createdAt` is clearer in intent. No functional impact — dev should be aware of the difference.

3. **[LOW — Informational] `LOAN_NOT_FOUND` vocabulary already added in Story 2.1.** The vocabulary additions section lists it as new, but Story 2.1 Task 4.6 already adds this entry. Dev should skip the duplicate.

4. **[LOW — Design Note] No cross-field validation that `principalComponent + interestComponent = amount`.** Acceptable — `MIGRATION_BASELINE` entries may have different splitting rules, and the computation engine (Story 2.3) will produce correct splits for PAYROLL entries. No change needed.

5. **[LOW — Positive] Layer 2 constrained accessor is a better design than the architecture doc's "Drizzle query wrapper" suggestion.** Simpler, no Drizzle internals dependency, easier to test. AC wording already updated to match ("service-layer guard").

## Dev Agent Record

### Agent Model Used

(To be filled by dev agent)

### Debug Log References

### Completion Notes List

### Commit Summary

<!-- Convention: Fill this section when story reaches 'done' status -->
<!-- Format: Total commits | Files touched (new/modified) | Revert count | One-sentence narrative -->

### File List
