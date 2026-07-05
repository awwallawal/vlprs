# Drizzle ORM Migration Reference — VLPRS

## How Drizzle Migrations Work

### Core Mechanism

Drizzle tracks applied migrations in `drizzle.__drizzle_migrations` (note: `drizzle` schema, not `public`).

```
drizzle.__drizzle_migrations
├── id         SERIAL PRIMARY KEY
├── hash       TEXT NOT NULL        ← sha256 of the .sql file content
└── created_at BIGINT               ← epoch ms from _journal.json `when` field
```

### Execution Flow (`migrate()`)

1. Read `drizzle/meta/_journal.json` → ordered list of migration entries
2. For each entry, compute `sha256(readFileSync('drizzle/<tag>.sql'))`
3. Compare against tracking table rows **in order by id**
4. `hash matches` → skip (already applied)
5. `hash mismatch or row missing` → EXECUTE the SQL
6. All pending migrations run in a **single transaction** — one failure rolls back everything

### Key Files

```
apps/server/
├── drizzle/
│   ├── 0000_greedy_molten_man.sql      ← migration SQL files
│   ├── 0001_funny_butterfly.sql
│   ├── ...
│   └── meta/
│       ├── _journal.json               ← ordered index (idx, when, tag)
│       ├── 0000_snapshot.json           ← schema snapshot per migration
│       └── ...                          ← snapshots chain via id→prevId
├── src/db/
│   ├── schema.ts                       ← Drizzle schema definition (source of truth)
│   ├── migrate.ts                      ← runMigrations() + baselineIfNeeded()
│   ├── migrate.test.ts                 ← unit tests (mock-based)
│   └── migrate.integration.test.ts     ← integration tests (live DB)
└── drizzle.config.ts                   ← drizzle-kit config
```

### Snapshot Chain Integrity

Each snapshot has `id` and `prevId`. They must form a chain:
```
0000: prevId=00000000
0001: prevId=<0000.id>
0002: prevId=<0001.id>
...
```

### Baseline System

`baselineIfNeeded()` handles pre-existing databases that were set up before migration tracking existed. It detects if `users` table exists but `drizzle.__drizzle_migrations` is empty, and inserts a baseline record for migration 0000.

---

## Database Connection

```
DATABASE_URL=postgresql://vlprs:vlprs_dev@localhost:5433/vlprs_dev
```

Set in `apps/server/.env` (loaded by Drizzle config and app).

---

## Common Commands

### Generate a new migration (after schema.ts changes)

```bash
cd apps/server
pnpm drizzle-kit generate
```

This diffs the current `schema.ts` against the latest snapshot and produces:
- A new `NNNN_<name>.sql` file
- A new `meta/NNNN_snapshot.json`
- An updated `meta/_journal.json` entry

### Apply pending migrations

```bash
cd apps/server
pnpm tsx src/db/migrate.ts
```

### Push schema directly (no migration file — dev only)

```bash
cd apps/server
pnpm drizzle-kit push
```

**Warning:** `push` applies changes directly without creating migration files. Use only for quick iteration, never in CI/production.

### Open Drizzle Studio (DB browser)

```bash
cd apps/server
pnpm drizzle-kit studio
```

---

## Diagnostic Commands

### Check tracking table state

```js
// Save as check-migrations.mjs, run with: node check-migrations.mjs
import pg from 'pg';
import { readFileSync } from 'fs';
import { createHash } from 'crypto';

const pool = new pg.Pool({ connectionString: 'postgresql://vlprs:vlprs_dev@localhost:5433/vlprs_dev' });

const tracked = await pool.query('SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id');
const journal = JSON.parse(readFileSync('./drizzle/meta/_journal.json', 'utf8'));

console.log(`DB has ${tracked.rows.length} tracked, journal has ${journal.entries.length} entries\n`);

for (let i = 0; i < Math.max(journal.entries.length, tracked.rows.length); i++) {
  const entry = journal.entries[i];
  const dbRow = tracked.rows[i];

  if (!entry && dbRow) {
    console.log(`[${i}] ORPHAN in DB (no journal entry)`);
    continue;
  }
  if (entry && !dbRow) {
    console.log(`[${i}] ${entry.tag} — PENDING (not in DB)`);
    continue;
  }

  const sql = readFileSync('./drizzle/' + entry.tag + '.sql', 'utf8');
  const expectedHash = createHash('sha256').update(sql).digest('hex');
  const hashOk = dbRow.hash === expectedHash;
  const tsOk = String(dbRow.created_at) === String(entry.when);

  let status = hashOk ? 'OK' : `HASH MISMATCH (db=${dbRow.hash.substring(0,16)}... file=${expectedHash.substring(0,16)}...)`;
  if (!tsOk) status += ` TS MISMATCH (db=${dbRow.created_at} journal=${entry.when})`;
  console.log(`[${i}] ${entry.tag} — ${status}`);
}

await pool.end();
```

### Check snapshot chain

```js
// Inline: run from apps/server/
node -e "
const { readFileSync } = require('fs');
for (let i = 0; i <= 7; i++) {
  const snap = JSON.parse(readFileSync('./drizzle/meta/' + String(i).padStart(4, '0') + '_snapshot.json', 'utf8'));
  console.log(i + ': id=' + snap.id.substring(0,8) + ' prevId=' + snap.prevId.substring(0,8));
}
"
```

### Check if specific tables exist

```js
// Save as .mjs, run with node
import pg from 'pg';
const pool = new pg.Pool({ connectionString: 'postgresql://vlprs:vlprs_dev@localhost:5433/vlprs_dev' });
const tables = ['migration_uploads', 'migration_records', 'migration_extra_fields'];
for (const t of tables) {
  const r = await pool.query(`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '${t}') as exists`);
  console.log(`${t}: ${r.rows[0].exists}`);
}
await pool.end();
```

---

## The 0006 Hash Mismatch Incident (Story 3.0b → 3.1)

### What happened

During Story 3.0b, `drizzle-kit generate` was run **twice** for migration 0006:

| Step | Time | Event |
|------|------|-------|
| 1 | 06:55 UTC | First generate → **2-statement** SQL (ADD COLUMN + ADD CONSTRAINT). Applied to DB. Tracking hash: `b08fbf63...` |
| 2 | ~08:30 UTC | Code review recommended adding an index on `parent_mda_id` |
| 3 | 08:44 UTC | Second generate → **3-statement** SQL (ADD COLUMN + ADD CONSTRAINT + CREATE INDEX). **Overwrote** the same 0006 file. New hash: `2b67e221...` |
| 4 | 09:08 UTC | 3-statement version committed to git |

The index was applied to the DB separately, but the **tracking table hash was never updated** — it still held the 2-statement hash.

### How it manifested

When Story 3.1 added migration 0007 and ran `runMigrations()`:
```
Drizzle: tracking[6].hash (b08fbf63) !== sha256(0006.sql) (2b67e221)
Drizzle: "migration 0006 needs to run"
→ ALTER TABLE mdas ADD COLUMN parent_mda_id uuid
→ ERROR: column "parent_mda_id" already exists
→ Transaction rollback
→ Migration 0007 also never applied
```

### Fix applied

Updated tracking table to match current file:

```sql
-- Fix the hash and timestamp for migration 0006
UPDATE drizzle.__drizzle_migrations
SET hash = '2b67e221af28efd5d9bcddfa1b21363b57b5839ac1c382d53cf86a65d9a60a96',
    created_at = 1772786679692
WHERE id = 7;  -- 7th row = migration index 6 (1-based id)
```

After fix, `runMigrations()` succeeds cleanly.

### How to fix a hash mismatch (general procedure)

1. Run the diagnostic script above to identify which migration has the mismatch
2. Verify the DB already has the objects the SQL would create:
   ```sql
   SELECT column_name FROM information_schema.columns WHERE table_name = '<table>';
   ```
3. Compute the correct hash:
   ```js
   const { createHash } = require('crypto');
   const { readFileSync } = require('fs');
   const sql = readFileSync('./drizzle/<tag>.sql', 'utf8');
   console.log(createHash('sha256').update(sql).digest('hex'));
   ```
4. Update the tracking table:
   ```sql
   UPDATE drizzle.__drizzle_migrations
   SET hash = '<correct_hash>', created_at = <journal_when_value>
   WHERE id = <row_id>;
   ```
5. Verify: run `pnpm tsx src/db/migrate.ts` — should succeed with no errors

### How to apply a pending migration manually

If Drizzle's migrator is blocked but you need to apply a new migration:

```js
// Save as apply-migration.mjs
import pg from 'pg';
import { readFileSync } from 'fs';
import { createHash } from 'crypto';

const MIGRATION_TAG = '0007_spicy_marauders';  // ← change this
const JOURNAL_WHEN = 1772794072987;             // ← from _journal.json

const pool = new pg.Pool({ connectionString: 'postgresql://vlprs:vlprs_dev@localhost:5433/vlprs_dev' });
const client = await pool.connect();

try {
  const sqlContent = readFileSync(`./drizzle/${MIGRATION_TAG}.sql`, 'utf8');
  const statements = sqlContent.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean);
  const hash = createHash('sha256').update(sqlContent).digest('hex');

  await client.query('BEGIN');
  for (const stmt of statements) {
    console.log(`Running: ${stmt.substring(0, 60)}...`);
    await client.query(stmt);
  }
  await client.query(
    'INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)',
    [hash, JOURNAL_WHEN]
  );
  await client.query('COMMIT');
  console.log('Migration applied and tracked.');
} catch (e) {
  await client.query('ROLLBACK');
  console.error('Failed:', e.message);
} finally {
  client.release();
  await pool.end();
}
```

---

## Prevention Rules

1. **NEVER re-run `drizzle-kit generate` for an already-applied migration.** Once a migration SQL is applied to any database, that file is immutable. If you need additional changes, generate a NEW migration.

2. **After code review changes to schema.ts**, generate a **new** migration — don't overwrite the existing one.

3. **Don't mix `drizzle-kit push` and `drizzle-kit generate`** in the same workflow. Push doesn't create migration files, so the tracking table diverges from the filesystem.

4. **Always verify after applying**: run `pnpm tsx src/db/migrate.ts` to confirm the migrator sees everything as applied.

5. **Run the integration test** after any migration work:
   ```bash
   pnpm vitest run src/db/migrate.integration.test.ts
   ```
   The test `migration count in tracking table matches _journal.json entry count` catches mismatches.

6. **Windows `autocrlf` warning**: Git's `core.autocrlf=true` (default on Windows) converts LF→CRLF on checkout. Drizzle hashes the file as-is from disk. If a file was committed with LF but checked out with CRLF, the hash will differ. The `.gitattributes` should ensure SQL files use consistent line endings. Current project has `core.autocrlf=true`.

---

## Integration Test Coverage

`apps/server/src/db/migrate.integration.test.ts` validates:
- Tracking table exists in `drizzle` schema (not `public`)
- `baselineIfNeeded()` is idempotent
- Baseline hash matches SHA-256 of first migration SQL
- **Migration count matches journal entry count** ← catches the exact issue we hit
- `applyTriggers()` creates function + trigger
- `applyTriggers()` is idempotent (safe to call twice)
