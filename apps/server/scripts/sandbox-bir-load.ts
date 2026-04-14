/**
 * Sandbox BIR Batch Loader
 *
 * Loads all BIR monthly files into the sandbox database in chronological order.
 * Uses the same service functions as the UI upload flow.
 *
 * Usage: npx tsx scripts/sandbox-bir-load.ts
 */

import fs from 'fs';
import path from 'path';

// Override DATABASE_URL to point to sandbox BEFORE any app imports
process.env.DATABASE_URL = 'postgresql://vlprs:vlprs_dev@localhost:5433/vlprs_sandbox';
process.env.NODE_ENV = 'development';
process.env.JWT_SECRET = 'sandbox-test';

async function run() {
  // Dynamic imports after env override
  const { db } = await import('../src/db/index.ts');
  const { applyTriggers } = await import('../src/db/triggers.ts');
  const { sql, count } = await import('drizzle-orm');
  const { loans } = await import('../src/db/schema.ts');
  const migrationService = await import('../src/services/migrationService.ts');
  const baselineService = await import('../src/services/baselineService.ts');
  const validationService = await import('../src/services/migrationValidationService.ts');

  // Apply triggers
  await applyTriggers(db as any);
  console.log('Sandbox triggers applied.\n');

  // Find BIR files
  const carLoanDir = path.resolve(import.meta.dirname, '../../../docs/Car_Loan');
  const allFiles = fs.readdirSync(carLoanDir).filter(f => f.toUpperCase().startsWith('BIR') && f.endsWith('.xlsx'));

  // Parse date from filename
  const MONTHS: Record<string, number> = {
    JAN: 1, JANUARY: 1, FEB: 2, FEBRUARY: 2, MAR: 3, MARCH: 3,
    APR: 4, APRIL: 4, MAY: 5, JUNE: 6, JUL: 7, JULY: 7,
    AUG: 8, AUGUST: 8, SEP: 9, SEPT: 9, SEPTEMBER: 9,
    OCT: 10, OCTOBER: 10, NOV: 11, NOVEMBER: 11, DEC: 12, DECEMBER: 12,
  };

  interface FileEntry { filename: string; year: number; month: number; filepath: string }
  const entries: FileEntry[] = [];

  for (const f of allFiles) {
    const yearMatch = f.match(/(20\d{2})/);
    const monthMatch = f.toUpperCase().match(/(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER|SEPT|JAN|FEB|MAR|APR|AUG|SEP|OCT|NOV|DEC)/);
    if (yearMatch && monthMatch) {
      entries.push({
        filename: f,
        year: parseInt(yearMatch[1]),
        month: MONTHS[monthMatch[1]] ?? 0,
        filepath: path.join(carLoanDir, f),
      });
    } else {
      console.warn(`SKIP (no date): ${f}`);
    }
  }

  // Sort chronologically, deduplicate by period
  entries.sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);
  const seen = new Set<string>();
  const unique: FileEntry[] = [];
  for (const e of entries) {
    const key = `${e.year}-${String(e.month).padStart(2, '0')}`;
    if (seen.has(key)) {
      console.warn(`SKIP (dup ${key}): ${e.filename}`);
      continue;
    }
    seen.add(key);
    unique.push(e);
  }

  console.log(`${unique.length} unique BIR files to process (${entries.length - unique.length} dups skipped)\n`);

  // Get BIR MDA ID + admin user
  const birResult = await db.execute(sql`SELECT id FROM mdas WHERE code = 'BIR' LIMIT 1`);
  const birMdaId = (birResult.rows[0] as any)?.id;
  if (!birMdaId) { console.error('BIR MDA not found'); process.exit(1); }

  const userResult = await db.execute(sql`SELECT id FROM users WHERE role = 'super_admin' LIMIT 1`);
  const userId = (userResult.rows[0] as any)?.id;
  if (!userId) { console.error('Admin user not found'); process.exit(1); }

  const actingUser = { userId, role: 'super_admin' as const, mdaId: null };

  // Results tracking
  const results: Array<{
    period: string; filename: string; records: number;
    baselined: number; newLoans: number; linked: number;
    flagged: number; skipped: number; error: string | null; ms: number;
  }> = [];

  for (let i = 0; i < unique.length; i++) {
    const entry = unique[i];
    const period = `${entry.year}-${String(entry.month).padStart(2, '0')}`;
    const t0 = Date.now();
    process.stdout.write(`[${i + 1}/${unique.length}] ${period} ${entry.filename}... `);

    try {
      const fileBuffer = fs.readFileSync(entry.filepath);
      const fileSize = fileBuffer.length;

      // Step 1: Preview (creates upload record + detects sheets)
      const preview = await migrationService.previewUpload(fileBuffer, entry.filename, fileSize, birMdaId, userId, 'super_admin');
      const uploadId = preview.uploadId;

      // Step 2: Confirm mapping (auto-use detected mappings)
      const confirmedMappings = preview.sheets
        .filter(s => s.columnMappings.filter(m => m.suggestedField).length >= 4)
        .map(s => ({
          sheetName: s.sheetName,
          mappings: s.columnMappings.map(m => ({
            sourceIndex: m.sourceIndex,
            canonicalField: m.suggestedField,
          })),
        }));

      if (confirmedMappings.length === 0) {
        results.push({ period, filename: entry.filename, records: 0, baselined: 0, newLoans: 0, linked: 0, flagged: 0, skipped: 0, error: 'No mappable sheets', ms: Date.now() - t0 });
        console.log('NO MAPPABLE SHEETS');
        continue;
      }

      await migrationService.confirmMapping(uploadId, confirmedMappings, fileBuffer);

      // Step 3: Validate
      await validationService.validateUpload(uploadId, null);

      // Step 4: Baseline
      const br = await baselineService.createBatchBaseline(actingUser, uploadId, null);

      const totalRecs = br.autoBaselined.count + br.flaggedForReview.count + br.skippedRecords.length;
      const linked = br.autoBaselined.count - br.loansCreated;

      results.push({
        period, filename: entry.filename, records: totalRecs,
        baselined: br.autoBaselined.count, newLoans: br.loansCreated, linked,
        flagged: br.flaggedForReview.count, skipped: br.skippedRecords.length,
        error: null, ms: Date.now() - t0,
      });
      console.log(`OK — ${br.loansCreated} new, ${linked} linked, ${br.flaggedForReview.count} flagged (${Date.now() - t0}ms)`);
    } catch (err: any) {
      results.push({
        period, filename: entry.filename, records: 0, baselined: 0, newLoans: 0, linked: 0, flagged: 0, skipped: 0,
        error: (err.message ?? 'Unknown').slice(0, 200), ms: Date.now() - t0,
      });
      console.log(`ERROR: ${(err.message ?? '').slice(0, 120)}`);
    }
  }

  // ═══════════════════ SUMMARY ═══════════════════
  console.log('\n' + '='.repeat(100));
  console.log('SANDBOX BIR LOAD — FINAL SUMMARY');
  console.log('='.repeat(100));

  const [loanCount] = await db.select({ n: count() }).from(loans);
  const staffResult = await db.execute(sql`SELECT COUNT(DISTINCT staff_name)::int as n FROM loans`);

  const ok = results.filter(r => !r.error);
  const fail = results.filter(r => r.error);

  console.log(`\nFiles processed:  ${results.length}`);
  console.log(`Successful:       ${ok.length}`);
  console.log(`Failed:           ${fail.length}`);
  console.log(`Total loans:      ${(loanCount as any).n}`);
  console.log(`Distinct staff:   ${(staffResult.rows[0] as any).n}`);
  console.log(`Total baselined:  ${ok.reduce((s, r) => s + r.baselined, 0)}`);
  console.log(`Total new loans:  ${ok.reduce((s, r) => s + r.newLoans, 0)}`);
  console.log(`Total linked:     ${ok.reduce((s, r) => s + r.linked, 0)}`);
  console.log(`Total flagged:    ${ok.reduce((s, r) => s + r.flagged, 0)}`);

  if (fail.length > 0) {
    console.log('\n--- ERRORS ---');
    for (const f of fail) console.log(`  ${f.period} ${f.filename}: ${f.error}`);
  }

  console.log('\n--- PER-FILE ---');
  console.log('Period     | Recs | Based | New  | Link | Flag | Skip | Time   | Status');
  console.log('-'.repeat(95));
  for (const r of results) {
    const st = r.error ? `ERR: ${r.error.slice(0, 30)}` : 'OK';
    console.log(
      `${r.period.padEnd(10)} | ${String(r.records).padStart(4)} | ${String(r.baselined).padStart(5)} | ${String(r.newLoans).padStart(4)} | ${String(r.linked).padStart(4)} | ${String(r.flagged).padStart(4)} | ${String(r.skipped).padStart(4)} | ${String(r.ms).padStart(5)}ms | ${st}`
    );
  }

  console.log('\nDone.');
  process.exit(0);
}

run().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
