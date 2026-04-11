import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { sql, eq } from 'drizzle-orm';
import { db } from '../db/index';
import {
  mdas,
  users,
  migrationUploads,
  migrationRecords,
  mdaSubmissions,
  submissionRows,
  observations,
} from '../db/schema';
import { generateUuidv7 } from '../lib/uuidv7';
import { resetDb } from '../test/resetDb';
import { generateObservations } from './observationEngine';

let testMdaId: string;
let testUserId: string;

beforeAll(async () => {
  await resetDb();

  // Seed test MDA
  testMdaId = generateUuidv7();
  await db.insert(mdas).values({
    id: testMdaId,
    name: 'Observation Engine Test MDA',
    code: 'OET',
    abbreviation: 'OE Test',
  });

  // Seed test user
  testUserId = generateUuidv7();
  await db.insert(users).values({
    id: testUserId,
    email: 'oe-admin@test.com',
    hashedPassword: 'hashed',
    firstName: 'OE',
    lastName: 'Admin',
    role: 'super_admin',
  });
});

beforeEach(async () => {
  // Clean observations and migration data between tests (keep MDAs + users)
  await db.execute(sql`TRUNCATE
    observations,
    migration_extra_fields,
    migration_records,
    migration_uploads,
    submission_rows,
    mda_submissions
  CASCADE`);
});

afterAll(async () => {
  await resetDb();
});

// ─── Helper: create a completed upload with records ──────────────

async function seedUploadWithRecords(
  opts: {
    uploadId?: string;
    mdaId?: string;
    periodYear?: number;
    periodMonth?: number;
    records: Array<{
      staffName: string;
      employeeNo?: string | null;
      principal?: string;
      outstandingBalance?: string;
      gradeLevel?: string | null;
    }>;
  },
) {
  const uploadId = opts.uploadId ?? generateUuidv7();
  const mdaId = opts.mdaId ?? testMdaId;
  const periodYear = opts.periodYear ?? 2024;
  const periodMonth = opts.periodMonth ?? 8;

  await db.insert(migrationUploads).values({
    id: uploadId,
    mdaId,
    uploadedBy: testUserId,
    filename: 'test-file.xlsx',
    fileSizeBytes: 1024,
    sheetCount: 1,
    totalRecords: opts.records.length,
    status: 'completed',
  });

  for (let i = 0; i < opts.records.length; i++) {
    const r = opts.records[i];
    await db.insert(migrationRecords).values({
      uploadId,
      mdaId,
      sheetName: 'Sheet1',
      rowNumber: i + 2,
      era: 3,
      periodYear,
      periodMonth,
      staffName: r.staffName,
      employeeNo: r.employeeNo ?? null,
      principal: r.principal ?? '200000.00',
      totalLoan: '226660.00',
      outstandingBalance: r.outstandingBalance ?? '100000.00',
      monthlyDeduction: '5000.00',
      gradeLevel: r.gradeLevel ?? null,
      hasRateVariance: false,
      computedRate: '13.33',
      sourceFile: 'test-file.xlsx',
      sourceSheet: 'Sheet1',
      sourceRow: i + 2,
    });
  }

  return uploadId;
}

// ─── Helper: create a confirmed submission with staff rows ───────

async function seedSubmission(
  mdaId: string,
  staffIds: string[],
  opts?: { source?: string },
) {
  const submissionId = generateUuidv7();
  await db.insert(mdaSubmissions).values({
    id: submissionId,
    mdaId,
    uploadedBy: testUserId,
    period: '2024-08',
    referenceNumber: `REF-${submissionId.slice(0, 8)}`,
    status: 'confirmed',
    recordCount: staffIds.length,
    source: opts?.source ?? 'csv',
  });

  for (let i = 0; i < staffIds.length; i++) {
    await db.insert(submissionRows).values({
      submissionId,
      rowNumber: i + 1,
      staffId: staffIds[i],
      month: '2024-08',
      amountDeducted: '5000.00',
      payrollBatchReference: 'BATCH-001',
      mdaCode: 'OET',
      eventFlag: 'NONE',
    });
  }

  return submissionId;
}

// ─── detectNoApprovalMatch ───────────────────────────────────────

describe('observationEngine integration — detectNoApprovalMatch', () => {
  it('generates observation for staff with no matching submission', async () => {
    // Seed 3 migration records: EMP001, EMP002, EMP003
    const uploadId = await seedUploadWithRecords({
      records: [
        { staffName: 'BELLO AMINAT', employeeNo: 'EMP001' },
        { staffName: 'OJO ADEBAYO', employeeNo: 'EMP002' },
        { staffName: 'ADESINA FOLAKE', employeeNo: 'EMP003' },
      ],
    });

    // Seed a confirmed submission with only EMP001 and EMP002
    await seedSubmission(testMdaId, ['EMP001', 'EMP002']);

    const result = await generateObservations(uploadId, testUserId);

    // EMP003 has no matching submission → should generate no_approval_match
    const noApprovalObs = await db
      .select()
      .from(observations)
      .where(eq(observations.type, 'no_approval_match'));

    expect(noApprovalObs).toHaveLength(1);
    expect(noApprovalObs[0].staffName).toBe('ADESINA FOLAKE');
    expect(result.byType.no_approval_match).toBe(1);
  });

  it('skips detector entirely when MDA has no confirmed submissions', async () => {
    const uploadId = await seedUploadWithRecords({
      records: [
        { staffName: 'BELLO AMINAT', employeeNo: 'EMP001' },
      ],
    });

    // No submissions seeded for this MDA
    const result = await generateObservations(uploadId, testUserId);

    const noApprovalObs = await db
      .select()
      .from(observations)
      .where(eq(observations.type, 'no_approval_match'));

    expect(noApprovalObs).toHaveLength(0);
    expect(result.byType.no_approval_match ?? 0).toBe(0);
  });

  it('does not flag staff who appear in confirmed submissions', async () => {
    const uploadId = await seedUploadWithRecords({
      records: [
        { staffName: 'BELLO AMINAT', employeeNo: 'EMP001' },
        { staffName: 'OJO ADEBAYO', employeeNo: 'EMP002' },
      ],
    });

    // All staff have submissions
    await seedSubmission(testMdaId, ['EMP001', 'EMP002']);

    await generateObservations(uploadId, testUserId);

    const noApprovalObs = await db
      .select()
      .from(observations)
      .where(eq(observations.type, 'no_approval_match'));

    expect(noApprovalObs).toHaveLength(0);
  });

  it('ignores historical submissions when matching', async () => {
    const uploadId = await seedUploadWithRecords({
      records: [
        { staffName: 'BELLO AMINAT', employeeNo: 'EMP001' },
      ],
    });

    // Seed a historical submission (should be ignored by the detector)
    await seedSubmission(testMdaId, ['EMP001'], { source: 'historical' });

    await generateObservations(uploadId, testUserId);

    // Historical submissions don't count — no reference data → detector skipped
    const noApprovalObs = await db
      .select()
      .from(observations)
      .where(eq(observations.type, 'no_approval_match'));

    expect(noApprovalObs).toHaveLength(0);
  });

  it('reports 50% completeness with 1-2 submissions, 100% with 3+', async () => {
    const uploadId = await seedUploadWithRecords({
      records: [
        { staffName: 'NO MATCH', employeeNo: 'EMP999' },
      ],
    });

    // Only 1 submission → 50% completeness
    await seedSubmission(testMdaId, ['EMP001']);

    await generateObservations(uploadId, testUserId);

    const obs = await db
      .select()
      .from(observations)
      .where(eq(observations.type, 'no_approval_match'));

    expect(obs).toHaveLength(1);
    const context = obs[0].context as { dataCompleteness: number };
    expect(context.dataCompleteness).toBe(50);
  });
});

// ─── detectPeriodOverlap ─────────────────────────────────────────

describe('observationEngine integration — detectPeriodOverlap', () => {
  it('generates observation when two uploads share the same period+MDA', async () => {
    // Upload 1: completed, period 2024-08
    await seedUploadWithRecords({
      periodYear: 2024,
      periodMonth: 8,
      records: [
        { staffName: 'RECORD A' },
        { staffName: 'RECORD B' },
      ],
    });

    // Upload 2: completed, SAME period 2024-08, same MDA
    const upload2Id = await seedUploadWithRecords({
      periodYear: 2024,
      periodMonth: 8,
      records: [
        { staffName: 'RECORD C' },
        { staffName: 'RECORD D' },
        { staffName: 'RECORD E' },
      ],
    });

    // Run observations on upload 2
    const result = await generateObservations(upload2Id, testUserId);

    const overlapObs = await db
      .select()
      .from(observations)
      .where(eq(observations.type, 'period_overlap'));

    expect(overlapObs).toHaveLength(1);
    expect(overlapObs[0].description).toContain('2024-08');
    expect(overlapObs[0].description).toContain('Observation Engine Test MDA');
    expect(result.byType.period_overlap).toBe(1);

    // Verify context includes record counts
    const context = overlapObs[0].context as { dataPoints: { existingRecordCount: number; currentRecordCount: number } };
    expect(context.dataPoints.existingRecordCount).toBe(2);
    expect(context.dataPoints.currentRecordCount).toBe(3);
  });

  it('does not generate observation when periods differ', async () => {
    // Upload 1: period 2024-07
    await seedUploadWithRecords({
      periodYear: 2024,
      periodMonth: 7,
      records: [{ staffName: 'RECORD A' }],
    });

    // Upload 2: period 2024-08 — different period
    const upload2Id = await seedUploadWithRecords({
      periodYear: 2024,
      periodMonth: 8,
      records: [{ staffName: 'RECORD B' }],
    });

    await generateObservations(upload2Id, testUserId);

    const overlapObs = await db
      .select()
      .from(observations)
      .where(eq(observations.type, 'period_overlap'));

    expect(overlapObs).toHaveLength(0);
  });

  it('does not generate observation for a single upload (no overlap)', async () => {
    const uploadId = await seedUploadWithRecords({
      periodYear: 2024,
      periodMonth: 8,
      records: [{ staffName: 'RECORD A' }],
    });

    await generateObservations(uploadId, testUserId);

    const overlapObs = await db
      .select()
      .from(observations)
      .where(eq(observations.type, 'period_overlap'));

    expect(overlapObs).toHaveLength(0);
  });

  it('is idempotent — running twice does not create duplicates', async () => {
    await seedUploadWithRecords({
      periodYear: 2024,
      periodMonth: 8,
      records: [{ staffName: 'RECORD A' }],
    });

    const upload2Id = await seedUploadWithRecords({
      periodYear: 2024,
      periodMonth: 8,
      records: [{ staffName: 'RECORD B' }],
    });

    // Run twice
    await generateObservations(upload2Id, testUserId);
    await generateObservations(upload2Id, testUserId);

    const overlapObs = await db
      .select()
      .from(observations)
      .where(eq(observations.type, 'period_overlap'));

    // Should still be just 1, not 2
    expect(overlapObs).toHaveLength(1);
  });
});

// ─── detectWithinFileDuplicates (Story 15.0m) ─────────────────────

describe('observationEngine integration — detectWithinFileDuplicates', () => {
  it('generates an observation when same staff + period appears twice in upload', async () => {
    const uploadId = await seedUploadWithRecords({
      periodYear: 2024,
      periodMonth: 8,
      records: [
        { staffName: 'ADEBAYO OLUSEGUN', employeeNo: 'EMP-DUP-1' },
        { staffName: 'Adebayo Olusegun', employeeNo: 'EMP-DUP-1' },
      ],
    });

    const result = await generateObservations(uploadId, testUserId);

    const dupObs = await db
      .select()
      .from(observations)
      .where(eq(observations.type, 'within_file_duplicate'));

    expect(dupObs).toHaveLength(1);
    expect(dupObs[0].staffName).toBe('ADEBAYO OLUSEGUN');
    expect(dupObs[0].description).toContain('2 times');
    expect(dupObs[0].description).toContain('2024-08');
    expect(result.byType.within_file_duplicate).toBe(1);
  });

  it('generates no observation when no duplicates exist in the upload', async () => {
    const uploadId = await seedUploadWithRecords({
      periodYear: 2024,
      periodMonth: 8,
      records: [
        { staffName: 'BELLO AMINAT', employeeNo: 'EMP-A' },
        { staffName: 'OJO ADEBAYO', employeeNo: 'EMP-B' },
      ],
    });

    await generateObservations(uploadId, testUserId);

    const dupObs = await db
      .select()
      .from(observations)
      .where(eq(observations.type, 'within_file_duplicate'));

    expect(dupObs).toHaveLength(0);
  });

  it('is idempotent — running twice does not create a second observation', async () => {
    const uploadId = await seedUploadWithRecords({
      periodYear: 2024,
      periodMonth: 8,
      records: [
        { staffName: 'ADEBAYO OLUSEGUN', employeeNo: 'EMP-DUP-1' },
        { staffName: 'ADEBAYO OLUSEGUN', employeeNo: 'EMP-DUP-1' },
      ],
    });

    await generateObservations(uploadId, testUserId);
    await generateObservations(uploadId, testUserId);

    const dupObs = await db
      .select()
      .from(observations)
      .where(eq(observations.type, 'within_file_duplicate'));

    expect(dupObs).toHaveLength(1);
  });
});
