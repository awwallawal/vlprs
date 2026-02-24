import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'node:crypto';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { sql } from 'drizzle-orm';
import { db } from './index';
import { baselineIfNeeded } from './migrate';
import { applyTriggers } from './triggers';

/**
 * Migration Baseline Integration Tests
 *
 * These tests verify the post-migration state of a real PostgreSQL database.
 * The CI pipeline runs `pnpm --filter server db:migrate` before tests execute,
 * so by test time the DB is already fully migrated. We verify the *result*.
 *
 * Coverage note: Only the "already-migrated DB" path of baselineIfNeeded() is
 * tested here. The fresh-DB, empty-table, and pre-existing-DB-without-tracking
 * paths cannot be safely tested without dropping migration state, which would
 * interfere with other integration tests. Those paths are covered by the
 * mock-based unit tests in migrate.test.ts.
 *
 * Pattern follows: apps/server/src/routes/auditLog.integration.test.ts
 */

const migrationsFolder = path.resolve(process.cwd(), 'drizzle');

describe('Migration Baseline Integration Tests', () => {
  // Warm up the DB connection (first query can be slow)
  beforeAll(async () => {
    await db.execute(sql`SELECT 1`);
  }, 15000);
  // --- Subtask 1.3: drizzle.__drizzle_migrations table exists in drizzle schema ---
  it('drizzle.__drizzle_migrations table exists in drizzle schema (not public)', async () => {
    const result = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations'
      ) AS "table_exists"
    `);
    expect(result.rows[0]?.table_exists).toBe(true);

    // Verify it is NOT in public schema
    const publicResult = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = '__drizzle_migrations'
      ) AS "table_exists"
    `);
    expect(publicResult.rows[0]?.table_exists).toBe(false);
  });

  // --- Subtask 1.2: already-migrated DB — baselineIfNeeded() is a no-op ---
  it('baselineIfNeeded() is a no-op on already-migrated DB', async () => {
    // Get record count before
    const before = await db.execute(sql`
      SELECT count(*)::int AS "count" FROM "drizzle"."__drizzle_migrations"
    `);
    const countBefore = Number(before.rows[0]?.count);
    expect(countBefore).toBeGreaterThan(0);

    // Call baselineIfNeeded — should return early without inserting
    await baselineIfNeeded(migrationsFolder);

    // Get record count after — should be unchanged
    const after = await db.execute(sql`
      SELECT count(*)::int AS "count" FROM "drizzle"."__drizzle_migrations"
    `);
    const countAfter = Number(after.rows[0]?.count);
    expect(countAfter).toBe(countBefore);
  });

  // --- Subtask 1.4: baseline record hash matches SHA-256 of first migration SQL ---
  it('baseline record hash matches SHA-256 of first migration SQL file', async () => {
    // Read journal to get first entry tag
    const journalPath = path.resolve(migrationsFolder, 'meta', '_journal.json');
    const journalRaw = await readFile(journalPath, 'utf-8');
    const journal = JSON.parse(journalRaw);
    const firstEntry = journal.entries[0];
    expect(firstEntry).toBeDefined();

    // Compute expected hash from SQL file
    const sqlPath = path.resolve(migrationsFolder, `${firstEntry.tag}.sql`);
    const sqlContent = await readFile(sqlPath, 'utf-8');
    const expectedHash = crypto.createHash('sha256').update(sqlContent).digest('hex');

    // Fetch the first migration record from tracking table
    const result = await db.execute(sql`
      SELECT hash FROM "drizzle"."__drizzle_migrations"
      ORDER BY id ASC
      LIMIT 1
    `);
    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.rows[0]?.hash).toBe(expectedHash);
  });

  // --- Subtask 1.5: migration count matches _journal.json entry count ---
  it('migration count in tracking table matches _journal.json entry count', async () => {
    // Read journal entry count
    const journalPath = path.resolve(migrationsFolder, 'meta', '_journal.json');
    const journalRaw = await readFile(journalPath, 'utf-8');
    const journal = JSON.parse(journalRaw);
    const expectedCount = journal.entries.length;

    // Count records in tracking table
    const result = await db.execute(sql`
      SELECT count(*)::int AS "count" FROM "drizzle"."__drizzle_migrations"
    `);
    const actualCount = Number(result.rows[0]?.count);
    expect(actualCount).toBe(expectedCount);
  });

  // --- Subtask 1.6: applyTriggers() creates function and trigger ---
  it('applyTriggers() creates fn_prevent_modification function and trg_audit_log_immutable trigger', async () => {
    // Verify the function exists
    const fnResult = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'fn_prevent_modification'
      ) AS "fn_exists"
    `);
    expect(fnResult.rows[0]?.fn_exists).toBe(true);

    // Verify the trigger exists on audit_log table
    const trgResult = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.triggers
        WHERE trigger_name = 'trg_audit_log_immutable'
          AND event_object_table = 'audit_log'
      ) AS "trg_exists"
    `);
    expect(trgResult.rows[0]?.trg_exists).toBe(true);
  });

  // --- Subtask 1.7: trigger idempotence — calling applyTriggers() twice does not error ---
  it('calling applyTriggers() twice does not error (idempotent)', async () => {
    const typedDb = db as Parameters<typeof applyTriggers>[0];
    // First call
    await expect(applyTriggers(typedDb)).resolves.not.toThrow();
    // Second call — should succeed without errors
    await expect(applyTriggers(typedDb)).resolves.not.toThrow();

    // Verify function and trigger still exist after repeated calls
    const fnResult = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'fn_prevent_modification'
      ) AS "fn_exists"
    `);
    expect(fnResult.rows[0]?.fn_exists).toBe(true);

    const trgResult = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.triggers
        WHERE trigger_name = 'trg_audit_log_immutable'
          AND event_object_table = 'audit_log'
      ) AS "trg_exists"
    `);
    expect(trgResult.rows[0]?.trg_exists).toBe(true);
  });
});
