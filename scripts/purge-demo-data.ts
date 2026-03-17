/**
 * Purge Demo Data Script (Story 11.0a, AC#4)
 *
 * Cleanly removes all fabricated financial records before real data is loaded.
 * Safety: requires --confirm flag to execute (dry-run by default).
 * Idempotent: safe to run multiple times.
 *
 * Usage:
 *   pnpm run purge-demo-data              # Dry-run — shows what WOULD be removed
 *   pnpm run purge-demo-data --confirm    # Execute purge
 */

import { sql } from 'drizzle-orm';
import { db } from '../apps/server/src/db/index';

const CONFIRM = process.argv.includes('--confirm');

// Allowlist of tables that can be truncated — used by countRows() safety guard
const FINANCIAL_TABLES = [
  'submission_rows',
  'mda_submissions',
  'observations',
  'exceptions',
  'deduplication_candidates',
  'person_matches',
  'migration_extra_fields',
  'migration_records',
  'migration_uploads',
  'loan_state_transitions',
  'ledger_entries',
  'temporal_corrections',
  'service_extensions',
  'loans',
  'refresh_tokens',
  'audit_log',
];

// Users to PRESERVE — all super_admin and dept_admin accounts survive purge.
// MDA officers are removed because they are either demo accounts or can be re-created.
// WARNING: Run purge BEFORE creating real MDA officer accounts via the API.
const PRESERVED_ROLES = ['super_admin', 'dept_admin'];

interface PurgeCount {
  table: string;
  count: number;
}

// Table names are hardcoded constants — never from user input.
// Using sql.raw is safe here since the caller only passes values from FINANCIAL_TABLES.
async function countRows(tableName: string): Promise<number> {
  if (!FINANCIAL_TABLES.includes(tableName)) throw new Error(`Unexpected table: ${tableName}`);
  const result = await db.execute(sql.raw(`SELECT COUNT(*)::int AS cnt FROM ${tableName}`));
  return (result.rows[0] as { cnt: number })?.cnt ?? 0;
}

async function countDemoUsers(): Promise<number> {
  const result = await db.execute(
    sql`SELECT COUNT(*)::int AS cnt FROM users WHERE role NOT IN (${sql.join(PRESERVED_ROLES.map(r => sql`${r}`), sql`, `)})`,
  );
  return (result.rows[0] as { cnt: number })?.cnt ?? 0;
}

async function dryRun(): Promise<void> {
  console.log('\n🔍 DRY RUN — showing what WOULD be removed:\n');

  const tables: PurgeCount[] = [
    { table: 'submission_rows', count: await countRows('submission_rows') },
    { table: 'mda_submissions', count: await countRows('mda_submissions') },
    { table: 'observations', count: await countRows('observations') },
    { table: 'exceptions', count: await countRows('exceptions') },
    { table: 'deduplication_candidates', count: await countRows('deduplication_candidates') },
    { table: 'person_matches', count: await countRows('person_matches') },
    { table: 'migration_extra_fields', count: await countRows('migration_extra_fields') },
    { table: 'migration_records', count: await countRows('migration_records') },
    { table: 'migration_uploads', count: await countRows('migration_uploads') },
    { table: 'loan_state_transitions', count: await countRows('loan_state_transitions') },
    { table: 'ledger_entries', count: await countRows('ledger_entries') },
    { table: 'temporal_corrections', count: await countRows('temporal_corrections') },
    { table: 'service_extensions', count: await countRows('service_extensions') },
    { table: 'loans', count: await countRows('loans') },
    { table: 'refresh_tokens', count: await countRows('refresh_tokens') },
    { table: 'audit_log', count: await countRows('audit_log') },
    { table: 'users (non-admin)', count: await countDemoUsers() },
  ];

  let totalRecords = 0;
  for (const { table, count } of tables) {
    const marker = count > 0 ? '✗' : '○';
    console.log(`  ${marker} ${table}: ${count} records`);
    totalRecords += count;
  }

  console.log('\n  PRESERVED:');
  console.log('  ✓ mdas (MDA registry — all 63 MDAs)');
  console.log('  ✓ mda_aliases (MDA code aliases)');
  console.log('  ✓ scheme_config (scheme fund total, etc.)');
  console.log(`  ✓ users with roles: ${PRESERVED_ROLES.join(', ')}`);
  console.log('  ⚠ WARNING: MDA officer accounts will be removed. Run purge BEFORE creating real officer accounts.');

  console.log(`\n  Total records to purge: ${totalRecords}`);
  console.log('\n  To execute, run: pnpm run purge-demo-data --confirm\n');
}

async function executePurge(): Promise<void> {
  console.log('\n🚀 EXECUTING PURGE — removing demo data...\n');

  const counts: PurgeCount[] = [];

  // Use a single TRUNCATE CASCADE for financial tables (fastest, respects FKs)
  // Then selective DELETE for users

  // 1. Truncate all financial + operational tables (CASCADE handles FK dependencies)
  for (const table of FINANCIAL_TABLES) {
    const before = await countRows(table);
    if (before > 0) {
      await db.execute(sql.raw(`TRUNCATE ${table} CASCADE`));
    }
    counts.push({ table, count: before });
  }

  // 2. Delete non-admin users (preserve super_admin and dept_admin accounts)
  const demoUserCount = await countDemoUsers();
  if (demoUserCount > 0) {
    await db.execute(
      sql`DELETE FROM users WHERE role NOT IN (${sql.join(PRESERVED_ROLES.map(r => sql`${r}`), sql`, `)})`,
    );
  }
  counts.push({ table: 'users (non-admin)', count: demoUserCount });

  // Print summary
  console.log('  Summary of removed records:');
  let totalRemoved = 0;
  for (const { table, count } of counts) {
    if (count > 0) {
      console.log(`    ✗ ${table}: ${count} records removed`);
      totalRemoved += count;
    }
  }

  if (totalRemoved === 0) {
    console.log('    (no demo data found — database is already clean)');
  }

  console.log('\n  PRESERVED:');
  console.log('  ✓ mdas (MDA registry)');
  console.log('  ✓ mda_aliases');
  console.log('  ✓ scheme_config');
  console.log(`  ✓ users with roles: ${PRESERVED_ROLES.join(', ')}`);
  console.log(`\n  Total records purged: ${totalRemoved}`);
  console.log('\n✅ Purge complete. Database is ready for real data.\n');
}

async function main() {
  try {
    if (CONFIRM) {
      await executePurge();
    } else {
      await dryRun();
    }
    process.exit(0);
  } catch (err) {
    console.error('Purge failed:', err);
    process.exit(1);
  }
}

main();
