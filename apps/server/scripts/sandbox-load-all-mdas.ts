/**
 * Sandbox All MDA Batch Loader
 *
 * Iterates all MDAs that have files in docs/Car_Loan, runs the migration
 * pipeline for each, and produces a cross-MDA summary report.
 *
 * Uses the legacy engine's catalog to identify which files belong to which MDA.
 *
 * Usage: pnpm --filter server exec tsx scripts/sandbox-load-all-mdas.ts
 */

import fs from 'fs';
import path from 'path';

process.env.DATABASE_URL = 'postgresql://vlprs:vlprs_dev@localhost:5433/vlprs_sandbox';
process.env.NODE_ENV = 'development';
process.env.JWT_SECRET = 'sandbox-test';

interface CatalogRecord {
  mda: string;        // resolved MDA code
  mdaName: string;
  sourceFile: string;
  period: { year: number; month: number };
}

interface MdaFileGroup {
  mdaCode: string;
  files: Array<{ filename: string; year: number; month: number; filepath: string }>;
}

async function run() {
  const { db } = await import('../src/db/index.ts');
  const { applyTriggers } = await import('../src/db/triggers.ts');
  const { sql, count } = await import('drizzle-orm');
  const { loans } = await import('../src/db/schema.ts');
  const migrationService = await import('../src/services/migrationService.ts');
  const baselineService = await import('../src/services/baselineService.ts');
  const validationService = await import('../src/services/migrationValidationService.ts');

  await applyTriggers(db as any);
  console.log('Sandbox triggers applied.\n');

  // Load catalog from legacy engine
  const catalogPath = path.resolve(import.meta.dirname, '../../../docs/Car_Loan/analysis/foundation/catalog.json');
  if (!fs.existsSync(catalogPath)) {
    console.error('Catalog not found at', catalogPath);
    console.error('Run the legacy engine first: scripts/legacy-report/car-loan-parse.ts');
    process.exit(1);
  }

  console.log('Loading catalog...');
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
  const records: CatalogRecord[] = catalog.records ?? [];
  console.log(`Catalog has ${records.length} records\n`);

  // Group files by MDA
  const carLoanDir = path.resolve(import.meta.dirname, '../../../docs/Car_Loan');
  const mdaGroups = new Map<string, MdaFileGroup>();

  for (const rec of records) {
    if (!rec.mda || !rec.sourceFile || !rec.period?.year || !rec.period?.month) continue;
    if (!mdaGroups.has(rec.mda)) {
      mdaGroups.set(rec.mda, { mdaCode: rec.mda, files: [] });
    }
    const group = mdaGroups.get(rec.mda)!;
    const filepath = path.join(carLoanDir, rec.sourceFile);
    if (!fs.existsSync(filepath)) continue;

    // Deduplicate by file (catalog has multiple records per file)
    if (!group.files.some(f => f.filename === rec.sourceFile)) {
      group.files.push({
        filename: rec.sourceFile,
        year: rec.period.year,
        month: rec.period.month,
        filepath,
      });
    }
  }

  console.log(`Identified ${mdaGroups.size} MDAs with files\n`);

  // Look up MDA IDs from sandbox database
  const mdaResult = await db.execute(sql`SELECT id, code FROM mdas`);
  const mdaCodeToId = new Map<string, string>();
  for (const r of mdaResult.rows as Array<{ id: string; code: string }>) {
    mdaCodeToId.set(r.code, r.id);
  }

  // Get admin user
  const userResult = await db.execute(sql`SELECT id FROM users WHERE role = 'super_admin' LIMIT 1`);
  const userId = (userResult.rows[0] as any)?.id;
  const actingUser = { userId, role: 'super_admin' as const, mdaId: null };

  interface MdaSummary {
    mdaCode: string;
    filesProcessed: number;
    filesSucceeded: number;
    filesFailed: number;
    loansCreated: number;
    loansLinked: number;
    flagged: number;
    skippedRecords: number;
    completed: number;
    overdeductions: number;
    errors: string[];
  }

  const results: MdaSummary[] = [];

  // Sort MDAs to put BIR first (already validated)
  const orderedMdas = Array.from(mdaGroups.values()).sort((a, b) => {
    if (a.mdaCode === 'BIR') return -1;
    if (b.mdaCode === 'BIR') return 1;
    return a.mdaCode.localeCompare(b.mdaCode);
  });

  for (const group of orderedMdas) {
    const mdaId = mdaCodeToId.get(group.mdaCode);
    if (!mdaId) {
      console.log(`SKIP ${group.mdaCode} — not in MDA registry`);
      continue;
    }

    const summary: MdaSummary = {
      mdaCode: group.mdaCode,
      filesProcessed: 0, filesSucceeded: 0, filesFailed: 0,
      loansCreated: 0, loansLinked: 0, flagged: 0, skippedRecords: 0,
      completed: 0, overdeductions: 0, errors: [],
    };

    // Sort files chronologically + dedupe by period
    const sorted = group.files.slice().sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);
    const seen = new Set<string>();
    const unique = sorted.filter(f => {
      const key = `${f.year}-${String(f.month).padStart(2, '0')}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log(`\n[${group.mdaCode}] ${unique.length} files`);

    for (const file of unique) {
      summary.filesProcessed++;
      try {
        const fileBuffer = fs.readFileSync(file.filepath);
        const preview = await migrationService.previewUpload(fileBuffer, file.filename, fileBuffer.length, mdaId, userId, 'super_admin');
        const uploadId = preview.uploadId;

        const confirmedMappings = preview.sheets
          .filter(s => s.columnMappings.filter(m => m.suggestedField).length >= 4)
          .map(s => ({
            sheetName: s.sheetName,
            mappings: s.columnMappings.map(m => ({ sourceIndex: m.sourceIndex, canonicalField: m.suggestedField })),
          }));

        if (confirmedMappings.length === 0) {
          summary.filesFailed++;
          summary.errors.push(`${file.filename}: No mappable sheets`);
          continue;
        }

        await migrationService.confirmMapping(uploadId, confirmedMappings, fileBuffer);
        await validationService.validateUpload(uploadId, null);
        const br = await baselineService.createBatchBaseline(actingUser, uploadId, null);

        summary.filesSucceeded++;
        summary.loansCreated += br.loansCreated;
        summary.loansLinked += (br.autoBaselined.count - br.loansCreated);
        summary.flagged += br.flaggedForReview.count;
        summary.skippedRecords += br.skippedRecords.length;
      } catch (err: any) {
        summary.filesFailed++;
        summary.errors.push(`${file.filename}: ${(err.message ?? '').slice(0, 100)}`);
      }
    }

    // Get final stats for this MDA
    const statsResult = await db.execute(sql`
      SELECT
        COUNT(*)::int as loans,
        COUNT(*) FILTER (WHERE status = 'COMPLETED')::int as completed
      FROM loans WHERE mda_id = ${mdaId}
    `);
    const stats = statsResult.rows[0] as any;
    summary.completed = stats.completed;

    const overdeductionResult = await db.execute(sql`
      SELECT COUNT(*)::int as cnt FROM observations
      WHERE mda_id = ${mdaId} AND type = 'post_completion_deduction'
    `);
    summary.overdeductions = (overdeductionResult.rows[0] as any).cnt;

    results.push(summary);
    console.log(`  ${summary.filesSucceeded}/${summary.filesProcessed} OK | ${summary.loansCreated} loans | ${summary.completed} completed | ${summary.flagged} flagged | ${summary.overdeductions} overdeductions`);
  }

  // Final cross-MDA summary
  console.log('\n' + '='.repeat(120));
  console.log('CROSS-MDA SANDBOX LOAD — FINAL SUMMARY');
  console.log('='.repeat(120));

  const [totalLoans] = await db.select({ n: count() }).from(loans);
  const totalActive = await db.execute(sql`SELECT COUNT(*)::int as n FROM loans WHERE status = 'ACTIVE'`);
  const totalCompleted = await db.execute(sql`SELECT COUNT(*)::int as n FROM loans WHERE status = 'COMPLETED'`);
  const obsTotal = await db.execute(sql`SELECT type, COUNT(*)::int as n FROM observations GROUP BY type ORDER BY n DESC`);

  console.log(`\nTotal MDAs processed:    ${results.length}`);
  console.log(`Total loans created:     ${(totalLoans as any).n}`);
  console.log(`  ACTIVE:                ${(totalActive.rows[0] as any).n}`);
  console.log(`  COMPLETED:             ${(totalCompleted.rows[0] as any).n}`);

  console.log(`\nObservations by type:`);
  for (const row of obsTotal.rows as Array<{ type: string; n: number }>) {
    console.log(`  ${row.type.padEnd(30)} ${row.n}`);
  }

  console.log('\nPER-MDA RESULTS:');
  console.log('MDA Code                | Files  | OK   | Fail | Loans | Active | Compl | Linked | Flagged | Overded | Errors');
  console.log('-'.repeat(120));
  for (const r of results.sort((a, b) => b.filesProcessed - a.filesProcessed)) {
    console.log(
      `${r.mdaCode.padEnd(23)} | ${String(r.filesProcessed).padStart(6)} | ${String(r.filesSucceeded).padStart(4)} | ${String(r.filesFailed).padStart(4)} | ${String(r.loansCreated).padStart(5)} | ${String(r.loansCreated - r.completed).padStart(6)} | ${String(r.completed).padStart(5)} | ${String(r.loansLinked).padStart(6)} | ${String(r.flagged).padStart(7)} | ${String(r.overdeductions).padStart(7)} | ${r.errors.length}`
    );
  }

  // Surface error patterns
  const allErrors = results.flatMap(r => r.errors.map(e => ({ mda: r.mdaCode, err: e })));
  if (allErrors.length > 0) {
    console.log(`\n${allErrors.length} ERRORS (first 30):`);
    for (const e of allErrors.slice(0, 30)) {
      console.log(`  [${e.mda}] ${e.err}`);
    }
  }

  console.log('\nDone.');
  process.exit(0);
}

run().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
