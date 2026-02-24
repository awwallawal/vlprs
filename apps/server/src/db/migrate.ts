import path from 'node:path';
import crypto from 'node:crypto';
import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { sql } from 'drizzle-orm';
import { db } from './index';
import { applyTriggers } from './triggers';
import { logger } from '../lib/logger';

export async function runMigrations(): Promise<void> {
  const migrationsFolder = path.resolve(process.cwd(), 'drizzle');

  // Verify migration folder exists before proceeding
  try {
    await access(migrationsFolder);
  } catch {
    throw new Error(`Migration folder not found at ${migrationsFolder} — check Dockerfile COPY step or working directory`);
  }

  // 1. Baseline: detect pre-existing DB without migration tracking
  await baselineIfNeeded(migrationsFolder);

  // 2. Run pending migrations
  await migrate(db, { migrationsFolder });
  logger.info('Migrations applied successfully');

  // 3. Apply triggers (idempotent — safe every startup)
  await applyTriggers(db);
  logger.info('Triggers applied successfully');
}

export async function baselineIfNeeded(migrationsFolder: string): Promise<void> {
  // Drizzle ORM stores migration tracking in the "drizzle" schema, not "public".
  // We must match this exactly or migrate() won't see our baseline record.

  // Check if the "drizzle" schema tracking table exists AND has records.
  // The table may exist but be empty if a previous deployment failed mid-migration.
  const trackingResult = await db.execute(sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations'
    ) AS "table_exists"
  `);

  if (trackingResult.rows[0]?.table_exists) {
    // Table exists — check if it has any records
    const recordCount = await db.execute(sql`
      SELECT count(*)::int AS "count" FROM "drizzle"."__drizzle_migrations"
    `);
    if (Number(recordCount.rows[0]?.count) > 0) {
      return; // Already initialized with records — nothing to do
    }
    // Table exists but is empty (previous failed deployment). Fall through to insert baseline.
  }

  // Check if users table exists (pre-existing production DB indicator)
  const usersResult = await db.execute(sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'users'
    ) AS "exists"
  `);

  if (!usersResult.rows[0]?.exists) {
    return; // Fresh DB — migrate() will handle everything
  }

  // Pre-existing DB without migration tracking
  logger.info('Baseline: existing database detected — marking migration 0000 as applied');

  // Read journal and SQL files first (before starting transaction)
  const journalPath = path.resolve(migrationsFolder, 'meta', '_journal.json');
  try {
    await access(journalPath);
  } catch {
    throw new Error(`Migration journal not found at ${journalPath} — ensure drizzle/ folder is included in the build`);
  }
  const journalRaw = await readFile(journalPath, 'utf-8');
  const journal = JSON.parse(journalRaw);
  const entry = journal.entries[0];

  if (!entry) {
    throw new Error('No migrations found in journal — expected at least 0000');
  }

  if (!entry.tag || entry.when == null) {
    throw new Error('Malformed migration journal entry — missing tag or when field');
  }

  // Compute hash the same way Drizzle does (SHA-256 of raw SQL content)
  const sqlPath = path.resolve(migrationsFolder, `${entry.tag}.sql`);
  try {
    await access(sqlPath);
  } catch {
    throw new Error(`Baseline migration SQL not found at ${sqlPath} — ensure drizzle/ folder is included in the build`);
  }
  const sqlContent = await readFile(sqlPath, 'utf-8');
  const hash = crypto.createHash('sha256').update(sqlContent).digest('hex');

  // Create schema and tracking table matching Drizzle's internal convention,
  // then insert baseline atomically (prevents inconsistent state on crash)
  await db.transaction(async (tx) => {
    await tx.execute(sql`CREATE SCHEMA IF NOT EXISTS "drizzle"`);

    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )
    `);

    await tx.execute(
      sql`INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at)
          SELECT ${hash}, ${entry.when}
          WHERE NOT EXISTS (SELECT 1 FROM "drizzle"."__drizzle_migrations" WHERE hash = ${hash})`
    );
  });

  // Clean up stale tracking table in public schema if it exists (from a prior buggy baseline)
  await db.execute(sql`DROP TABLE IF EXISTS "public"."__drizzle_migrations"`);

  logger.info('Baseline applied — migration 0000 marked as already applied');
}

// CLI entry point: pnpm --filter server db:migrate
const __filename = fileURLToPath(import.meta.url);
if (path.resolve(process.argv[1] ?? '') === path.resolve(__filename)) {
  runMigrations()
    .then(async () => {
      await db.$client.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('Migration failed:', err);
      try { await db.$client.end(); } catch { /* ignore cleanup errors */ }
      process.exit(1);
    });
}
