/**
 * Sandbox MDA Batch Loader (generalized)
 *
 * Loads monthly files for a given MDA into the sandbox database in chronological order.
 *
 * Usage:
 *   MDA_CODE=BIR FILE_FILTER=BIR npx tsx scripts/sandbox-mda-load.ts
 *   MDA_CODE="SPORTS COUNCIL" FILE_FILTER=SPORTS_COUNCIL npx tsx scripts/sandbox-mda-load.ts
 */

import fs from 'fs';
import path from 'path';

process.env.DATABASE_URL = 'postgresql://vlprs:vlprs_dev@localhost:5433/vlprs_sandbox';
process.env.NODE_ENV = 'development';
process.env.JWT_SECRET = 'sandbox-test';

const MDA_CODE = process.env.MDA_CODE ?? 'BIR';
const FILE_FILTER = process.env.FILE_FILTER ?? 'BIR';

async function run() {
  const { db } = await import('../src/db/index.ts');
  const { applyTriggers } = await import('../src/db/triggers.ts');
  const { sql } = await import('drizzle-orm');
  const migrationService = await import('../src/services/migrationService.ts');
  const baselineService = await import('../src/services/baselineService.ts');
  const validationService = await import('../src/services/migrationValidationService.ts');

  await applyTriggers(db as any);
  console.log(`Sandbox loader — MDA: ${MDA_CODE}, Filter: ${FILE_FILTER}\n`);

  const carLoanDir = path.resolve(import.meta.dirname, '../../../docs/Car_Loan');
  const allFiles = fs.readdirSync(carLoanDir).filter(f => f.toUpperCase().includes(FILE_FILTER.toUpperCase()) && f.endsWith('.xlsx'));

  const MONTHS: Record<string, number> = {
    JAN: 1, JANUARY: 1, FEB: 2, FEBRUARY: 2, MAR: 3, MARCH: 3, MACH: 3,
    APR: 4, APRIL: 4, MAY: 5, JUNE: 6, JUL: 7, JULY: 7,
    AUG: 8, AUGUST: 8, SEP: 9, SEPT: 9, SEPTEMBER: 9,
    OCT: 10, OCTOBER: 10, NOV: 11, NOVEMBER: 11, DEC: 12, DECEMBER: 12,
  };

  interface FileEntry { filename: string; year: number; month: number; filepath: string }
  const entries: FileEntry[] = [];

  for (const f of allFiles) {
    const yearMatch = f.match(/(20\d{2})/);
    const monthMatch = f.toUpperCase().match(/(JANUARY|FEBRUARY|MARCH|MACH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER|SEPT|JAN|FEB|MAR|APR|AUG|SEP|OCT|NOV|DEC)/);
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

  console.log(`${unique.length} unique ${MDA_CODE} files to process (${entries.length - unique.length} dups skipped)\n`);

  const mdaResult = await db.execute(sql`SELECT id FROM mdas WHERE code = ${MDA_CODE} LIMIT 1`);
  const mdaId = (mdaResult.rows[0] as any)?.id;
  if (!mdaId) { console.error(`MDA code "${MDA_CODE}" not found`); process.exit(1); }

  const userResult = await db.execute(sql`SELECT id FROM users WHERE role = 'super_admin' LIMIT 1`);
  const userId = (userResult.rows[0] as any)?.id;
  if (!userId) { console.error('Admin user not found'); process.exit(1); }

  const actingUser = { userId, role: 'super_admin' as const, mdaId: null };

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

      const preview = await migrationService.previewUpload(fileBuffer, entry.filename, fileSize, mdaId, userId, 'super_admin');
      const uploadId = preview.uploadId;

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
      await validationService.validateUpload(uploadId, null);
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

  console.log('\n' + '='.repeat(100));
  console.log(`SANDBOX ${MDA_CODE} LOAD — FINAL SUMMARY`);
  console.log('='.repeat(100));

  const loanResult = await db.execute(sql`SELECT COUNT(*)::int as n, COUNT(*) FILTER (WHERE status = 'ACTIVE')::int as active, COUNT(*) FILTER (WHERE status = 'COMPLETED')::int as completed FROM loans WHERE mda_id = ${mdaId}`);
  const staffResult = await db.execute(sql`SELECT COUNT(DISTINCT staff_name)::int as n FROM loans WHERE mda_id = ${mdaId}`);

  const ok = results.filter(r => !r.error);
  const fail = results.filter(r => r.error);

  console.log(`\nFiles processed:    ${results.length}`);
  console.log(`Successful:         ${ok.length}`);
  console.log(`Failed:             ${fail.length}`);
  console.log(`Total ${MDA_CODE} loans: ${(loanResult.rows[0] as any).n}`);
  console.log(`  ACTIVE:           ${(loanResult.rows[0] as any).active}`);
  console.log(`  COMPLETED:        ${(loanResult.rows[0] as any).completed}`);
  console.log(`Distinct staff:     ${(staffResult.rows[0] as any).n}`);
  console.log(`Total baselined:    ${ok.reduce((s, r) => s + r.baselined, 0)}`);
  console.log(`Total new loans:    ${ok.reduce((s, r) => s + r.newLoans, 0)}`);
  console.log(`Total linked:       ${ok.reduce((s, r) => s + r.linked, 0)}`);
  console.log(`Total flagged:      ${ok.reduce((s, r) => s + r.flagged, 0)}`);

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
