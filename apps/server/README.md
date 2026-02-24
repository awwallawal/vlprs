# VLPRS Server

Express + Drizzle ORM + PostgreSQL 17 API server.

## Integration Testing

### CI Setup

The GitHub Actions CI pipeline (`.github/workflows/ci.yml`) provisions a **PostgreSQL 17-alpine** service container automatically:

- **Service:** `postgres:17-alpine` with health checks
- **Env:** `DATABASE_URL=postgresql://vlprs_test:vlprs_test@localhost:5432/vlprs_test`
- **Migrations:** Applied via `pnpm --filter server db:migrate` before tests run
- **No separate test config** — integration tests run alongside unit tests via `pnpm test`

### Running Integration Tests Locally

1. Start the dev database:
   ```bash
   docker compose -f compose.dev.yaml up db -d
   ```

2. Ensure your `.env` has the correct `DATABASE_URL` (default: `postgresql://vlprs:vlprs_dev@localhost:5433/vlprs_dev`).

3. Apply migrations:
   ```bash
   pnpm --filter server db:migrate
   ```

4. Run all tests (unit + integration):
   ```bash
   pnpm --filter server test
   ```

5. Run only integration tests:
   ```bash
   pnpm --filter server test -- --run src/db/migrate.integration.test.ts
   pnpm --filter server test -- --run src/routes/auditLog.integration.test.ts
   ```

### Naming Convention

| Pattern | Type | Database |
|---------|------|----------|
| `*.test.ts` | Unit test | Mocked — no real DB |
| `*.integration.test.ts` | Integration test | Real PostgreSQL required |

### Writing Integration Tests

Follow the established pattern from `src/routes/auditLog.integration.test.ts`:

```typescript
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { db } from '../db/index';  // Real DB, not mocked

// Warm up connection (first query can be slow)
beforeAll(async () => {
  await db.execute(sql`SELECT 1`);
}, 15000);

// Clean state between tests
beforeEach(async () => {
  await db.execute(sql`TRUNCATE my_table CASCADE`);
});

// Cleanup after all tests
afterAll(async () => {
  await db.execute(sql`TRUNCATE my_table CASCADE`);
});

describe('My Integration Tests', () => {
  it('verifies something against real DB', async () => {
    // Use real db, sql tagged templates, actual inserts/selects
    const result = await db.execute(sql`SELECT count(*)::int AS "count" FROM my_table`);
    expect(Number(result.rows[0]?.count)).toBe(0);
  });
});
```

**Key patterns:**
- Import real `db` from `../db/index` — never mock it
- Use `sql` tagged templates for raw queries
- Use `TRUNCATE ... CASCADE` for cleanup between tests
- Use `beforeAll` with timeout for connection warmup
- Vitest config (`vitest.config.ts`) has `fileParallelism: false` — tests run sequentially, so cleanup is reliable

### Vitest Configuration

`apps/server/vitest.config.ts`:
- `globals: true` — vitest globals are auto-available, but explicit imports are the project convention for clarity
- `fileParallelism: false` — prevents DB state conflicts between test files
- No separate config for integration tests — the `*.integration.test.ts` naming convention is sufficient
