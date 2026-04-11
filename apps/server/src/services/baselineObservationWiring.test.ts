/**
 * Story 15.0b: Observation Auto-Generation After Baseline — Wiring Tests
 *
 * Verifies that generateObservations() is called as a fire-and-forget
 * side effect after each of the three baseline paths:
 *   1. createBatchBaseline() — batch baseline for clean/minor records
 *   2. createBaseline() — single-record baseline from Record Detail drawer
 *   3. baselineReviewedRecords() — Stage 3 baseline of MDA-reviewed records
 *
 * Pattern: autoStopCertificateWiring.test.ts — real DB + mocked side-effect service.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { db } from '../db';
import { users, mdas, migrationUploads, migrationRecords } from '../db/schema';
import { generateUuidv7 } from '../lib/uuidv7';
import { hashPassword } from '../lib/password';
import { resetDb } from '../test/resetDb';

// Mock observation engine — spy on wiring.
// Story 15.0m: assertNoWithinFileDuplicates() in baselineService reads
// findWithinFileDuplicateGroups() from this module, so the mock must export
// it too. These wiring tests use records that never duplicate on
// staffName+period, so returning [] keeps the guard a no-op and preserves
// the existing wiring assertions (the detector itself has its own suite).
vi.mock('./observationEngine', () => ({
  generateObservations: vi.fn().mockResolvedValue({ generated: 5, skipped: 0, byType: {} }),
  findWithinFileDuplicateGroups: vi.fn().mockReturnValue([]),
  generateWithinFileDuplicateObservations: vi.fn().mockResolvedValue({ generated: 0, skipped: 0 }),
}));

// Mock auto-stop service to avoid side effects
vi.mock('./autoStopService', () => ({
  checkAndTriggerAutoStop: vi.fn().mockResolvedValue(undefined),
}));

import { generateObservations } from './observationEngine';
import { createBatchBaseline, createBaseline } from './baselineService';
import { baselineReviewedRecords } from './mdaReviewService';

/** Flush fire-and-forget promise chains (mock-resolved promises settle on next tick) */
const flushPromises = () => new Promise((r) => setTimeout(r, 0));

// ─── Fixtures ──────────────────────────────────────────────────────

const adminUserId = generateUuidv7();
const officerUserId = generateUuidv7();
const mdaId = generateUuidv7();
const uploadId = generateUuidv7();

// Records for batch baseline test
const recClean1 = generateUuidv7();
const recClean2 = generateUuidv7();

// Record for single baseline test (separate upload)
const singleUploadId = generateUuidv7();
const recSingle = generateUuidv7();

// Records for reviewed baseline test (separate upload)
const reviewedUploadId = generateUuidv7();
const recReviewed1 = generateUuidv7();
const recReviewed2 = generateUuidv7();

const baseRecord = {
  sheetName: 'Sheet1',
  era: 2024,
  periodYear: 2026,
  periodMonth: 3,
  sourceFile: 'test-obs-wiring.xlsx',
  sourceSheet: 'Sheet1',
  principal: '100000.00',
  totalLoan: '113330.00',
  monthlyDeduction: '3148.06',
  outstandingBalance: '50000.00',
  installmentCount: 36,
  installmentsPaid: 20,
  installmentsOutstanding: 16,
  computedRate: '13.330',
  computedTotalLoan: '113330.00',
  computedMonthlyDeduction: '3148.06',
  computedOutstandingBalance: '50000.00',
  schemeExpectedTotalLoan: '113330.00',
  schemeExpectedMonthlyDeduction: '3148.06',
  schemeExpectedTotalInterest: '13330.00',
};

// ─── Setup ─────────────────────────────────────────────────────────

beforeAll(async () => {
  await resetDb();

  // Create MDA
  await db.insert(mdas).values({
    id: mdaId,
    name: 'Observation Wiring Test MDA',
    code: 'OBS-WIRE',
    abbreviation: 'OBSWIRE',
    isActive: true,
  });

  // Create users
  const hashed = await hashPassword('Password1!');
  await db.insert(users).values([
    {
      id: adminUserId,
      email: 'admin-obs-wire@vlprs.test',
      hashedPassword: hashed,
      firstName: 'Admin',
      lastName: 'ObsWire',
      role: 'dept_admin',
      mustChangePassword: false,
      isActive: true,
    },
    {
      id: officerUserId,
      email: 'officer-obs-wire@vlprs.test',
      hashedPassword: hashed,
      firstName: 'Officer',
      lastName: 'ObsWire',
      role: 'mda_officer',
      mdaId,
      mustChangePassword: false,
      isActive: true,
    },
  ]);

  // Upload 1: For batch baseline test
  await db.insert(migrationUploads).values({
    id: uploadId,
    mdaId,
    uploadedBy: adminUserId,
    filename: 'obs-wiring-batch.xlsx',
    fileSizeBytes: 5000,
    status: 'validated',
  });

  await db.insert(migrationRecords).values([
    { id: recClean1, ...baseRecord, uploadId, mdaId, rowNumber: 1, sourceRow: 1, staffName: 'Batch Staff A', employeeNo: 'OY/OBS/001', varianceCategory: 'clean', varianceAmount: '0.00' },
    { id: recClean2, ...baseRecord, uploadId, mdaId, rowNumber: 2, sourceRow: 2, staffName: 'Batch Staff B', employeeNo: 'OY/OBS/002', varianceCategory: 'clean', varianceAmount: '0.00' },
  ]);

  // Upload 2: For single-record baseline test
  await db.insert(migrationUploads).values({
    id: singleUploadId,
    mdaId,
    uploadedBy: adminUserId,
    filename: 'obs-wiring-single.xlsx',
    fileSizeBytes: 5000,
    status: 'validated',
  });

  await db.insert(migrationRecords).values({
    id: recSingle,
    ...baseRecord,
    uploadId: singleUploadId,
    mdaId,
    rowNumber: 1,
    sourceRow: 1,
    staffName: 'Single Staff C',
    employeeNo: 'OY/OBS/003',
    varianceCategory: 'clean',
    varianceAmount: '0.00',
  });

  // Upload 3: For reviewed-records baseline test
  await db.insert(migrationUploads).values({
    id: reviewedUploadId,
    mdaId,
    uploadedBy: adminUserId,
    filename: 'obs-wiring-reviewed.xlsx',
    fileSizeBytes: 5000,
    status: 'validated',
  });

  const now = new Date();
  const deadline = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  await db.insert(migrationRecords).values([
    {
      id: recReviewed1,
      ...baseRecord,
      uploadId: reviewedUploadId,
      mdaId,
      rowNumber: 1,
      sourceRow: 1,
      staffName: 'Reviewed Staff D',
      employeeNo: 'OY/OBS/004',
      varianceCategory: 'significant_variance',
      varianceAmount: '5000.00',
      flaggedForReviewAt: now,
      reviewWindowDeadline: deadline,
      correctedBy: officerUserId,
      correctedAt: now,
      correctionReason: 'Values verified against source documents for wiring test',
    },
    {
      id: recReviewed2,
      ...baseRecord,
      uploadId: reviewedUploadId,
      mdaId,
      rowNumber: 2,
      sourceRow: 2,
      staffName: 'Reviewed Staff E',
      employeeNo: 'OY/OBS/005',
      varianceCategory: 'significant_variance',
      varianceAmount: '6000.00',
      flaggedForReviewAt: now,
      reviewWindowDeadline: deadline,
      correctedBy: officerUserId,
      correctedAt: now,
      correctionReason: 'Values verified against source documents for wiring test',
    },
  ]);
});

afterAll(async () => {
  await resetDb();
});

// ─── Test: createBatchBaseline → generateObservations (AC 1, 4, 5) ─

describe('createBatchBaseline → generateObservations wiring', () => {
  it('fires generateObservations after batch baseline completes', async () => {
    vi.mocked(generateObservations).mockClear();

    const actingUser = { userId: adminUserId, role: 'dept_admin', mdaId: null };
    const result = await createBatchBaseline(actingUser, uploadId, null);

    expect(result.loansCreated).toBeGreaterThanOrEqual(1);

    // Fire-and-forget runs on the microtask queue — flush it
    await flushPromises();

    expect(generateObservations).toHaveBeenCalledTimes(1);
    expect(generateObservations).toHaveBeenCalledWith(uploadId, adminUserId);
  });
});

describe('createBatchBaseline skips generateObservations when zero records baselined', () => {
  it('does NOT fire generateObservations when all records are already baselined', async () => {
    vi.mocked(generateObservations).mockClear();

    // Same upload as above — records were already baselined in the previous test
    const actingUser = { userId: adminUserId, role: 'dept_admin', mdaId: null };
    const result = await createBatchBaseline(actingUser, uploadId, null);

    expect(result.loansCreated).toBe(0);

    await flushPromises();

    expect(generateObservations).not.toHaveBeenCalled();
  });
});

// ─── Test: createBaseline → generateObservations (AC 2, 4, 5) ─────

describe('createBaseline → generateObservations wiring', () => {
  it('fires generateObservations for single-record baseline', async () => {
    vi.mocked(generateObservations).mockClear();

    const actingUser = { userId: adminUserId, role: 'dept_admin', mdaId: null };
    const result = await createBaseline(actingUser, singleUploadId, recSingle, null);

    expect(result.loanId).toBeTruthy();

    await flushPromises();

    expect(generateObservations).toHaveBeenCalledTimes(1);
    expect(generateObservations).toHaveBeenCalledWith(singleUploadId, adminUserId);
  });

  it('does NOT fire generateObservations when skipObservationGeneration is true', async () => {
    // Need a fresh record for this test
    const skipUploadId = generateUuidv7();
    const skipRecordId = generateUuidv7();

    await db.insert(migrationUploads).values({
      id: skipUploadId,
      mdaId,
      uploadedBy: adminUserId,
      filename: 'obs-wiring-skip.xlsx',
      fileSizeBytes: 5000,
      status: 'validated',
    });

    await db.insert(migrationRecords).values({
      id: skipRecordId,
      ...baseRecord,
      uploadId: skipUploadId,
      mdaId,
      rowNumber: 1,
      sourceRow: 1,
      staffName: 'Skip Staff F',
      employeeNo: 'OY/OBS/006',
      varianceCategory: 'clean',
      varianceAmount: '0.00',
    });

    vi.mocked(generateObservations).mockClear();

    const actingUser = { userId: adminUserId, role: 'dept_admin', mdaId: null };
    await createBaseline(actingUser, skipUploadId, skipRecordId, null, { skipObservationGeneration: true });

    await flushPromises();

    expect(generateObservations).not.toHaveBeenCalled();
  });
});

// ─── Test: baselineReviewedRecords → generateObservations (AC 3) ──

describe('baselineReviewedRecords → generateObservations wiring', () => {
  it('fires generateObservations exactly once after looping all reviewed records', { timeout: 60_000 }, async () => {
    vi.mocked(generateObservations).mockClear();

    const result = await baselineReviewedRecords(reviewedUploadId, null, adminUserId, 'dept_admin');

    expect(result.baselinedCount).toBeGreaterThanOrEqual(1);

    await flushPromises();

    // Must be called exactly once (not once per record)
    expect(generateObservations).toHaveBeenCalledTimes(1);
    expect(generateObservations).toHaveBeenCalledWith(reviewedUploadId, adminUserId);
  });
});

// ─── Test: Fire-and-forget resilience (AC 5) ─────────────────────

describe('Observation generation failure does not block baseline', () => {
  it('baseline succeeds even when generateObservations throws', async () => {
    // Make observation generation throw
    vi.mocked(generateObservations).mockRejectedValueOnce(new Error('DB connection lost'));

    // Need a fresh upload/record
    const failUploadId = generateUuidv7();
    const failRecordId = generateUuidv7();

    await db.insert(migrationUploads).values({
      id: failUploadId,
      mdaId,
      uploadedBy: adminUserId,
      filename: 'obs-wiring-fail.xlsx',
      fileSizeBytes: 5000,
      status: 'validated',
    });

    await db.insert(migrationRecords).values({
      id: failRecordId,
      ...baseRecord,
      uploadId: failUploadId,
      mdaId,
      rowNumber: 1,
      sourceRow: 1,
      staffName: 'Fail Staff G',
      employeeNo: 'OY/OBS/007',
      varianceCategory: 'clean',
      varianceAmount: '0.00',
    });

    const actingUser = { userId: adminUserId, role: 'dept_admin', mdaId: null };
    const result = await createBaseline(actingUser, failUploadId, failRecordId, null);

    // Baseline succeeds despite observation failure
    expect(result.loanId).toBeTruthy();
    expect(result.loanReference).toMatch(/^VLC-MIG-/);

    await flushPromises();
  });
});
