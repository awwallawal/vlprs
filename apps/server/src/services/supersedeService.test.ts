/**
 * supersedeService tests — Validates the supersede cascade:
 * upload marking, record status update, baseline annotations,
 * validation failures, and observation auto-resolution.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock db
vi.mock('../db/index', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
    transaction: vi.fn(),
  },
}));

vi.mock('../db/schema', () => ({
  migrationUploads: {
    id: 'migration_uploads.id',
    mdaId: 'migration_uploads.mda_id',
    filename: 'migration_uploads.filename',
    supersededBy: 'migration_uploads.superseded_by',
    supersededAt: 'migration_uploads.superseded_at',
    supersededReason: 'migration_uploads.superseded_reason',
    supersededByUserId: 'migration_uploads.superseded_by_user_id',
    updatedAt: 'migration_uploads.updated_at',
    deletedAt: 'migration_uploads.deleted_at',
  },
  migrationRecords: {
    id: 'migration_records.id',
    uploadId: 'migration_records.upload_id',
    recordStatus: 'migration_records.status',
    supersededAt: 'migration_records.superseded_at',
    isBaselineCreated: 'migration_records.is_baseline_created',
    loanId: 'migration_records.loan_id',
    deletedAt: 'migration_records.deleted_at',
  },
  ledgerEntries: {
    id: 'ledger_entries.id',
    loanId: 'ledger_entries.loan_id',
    entryType: 'ledger_entries.entry_type',
  },
  baselineAnnotations: {},
  observations: {
    id: 'observations.id',
    type: 'observations.type',
    uploadId: 'observations.upload_id',
    status: 'observations.status',
    resolutionNote: 'observations.resolution_note',
    resolvedAt: 'observations.resolved_at',
    resolvedBy: 'observations.resolved_by',
    updatedAt: 'observations.updated_at',
  },
}));

vi.mock('../lib/transaction', () => ({
  withTransaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
    return fn(mockTx);
  }),
}));

vi.mock('./observationEngine', () => ({
  generateObservations: vi.fn().mockResolvedValue({ generated: 0, skipped: 0, byType: {} }),
}));

import { supersedeUpload } from './supersedeService';
import { db } from '../db/index';
import { generateObservations } from './observationEngine';

type MockFn = ReturnType<typeof vi.fn>;
const mockDb = db as unknown as Record<'select' | 'update' | 'insert' | 'transaction', MockFn>;

// Mock transaction handle that mirrors db API
const mockTx = {
  update: vi.fn(),
  select: vi.fn(),
  insert: vi.fn(),
};

// ─── Mock Helpers ────────────────────────────────────────────────────

function mockChain(result: unknown) {
  const promise = Promise.resolve(result);
  const fns: MockFn[] = [];
  for (let i = 0; i < 12; i++) fns.push(vi.fn());
  const chain = {
    from: fns[0], where: fns[1], limit: fns[2], set: fns[3],
    values: fns[4], returning: fns[5], innerJoin: fns[6],
    leftJoin: fns[7], orderBy: fns[8], groupBy: fns[9],
    offset: fns[10], on: fns[11],
    then: promise.then.bind(promise),
  };
  for (const fn of fns) fn.mockReturnValue(chain);
  return chain;
}

const MDA_A = 'mda-aaaa';
const UPLOAD_OLD = 'upload-old';
const UPLOAD_NEW = 'upload-new';
const USER_ID = 'user-001';
const REASON = 'Newer file has corrected records from MDA';

// ─── Tests ───────────────────────────────────────────────────────────

describe('supersedeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('supersedeUpload', () => {
    function setupValidUploads() {
      // First select: superseded upload
      const selectChain1 = mockChain([{
        id: UPLOAD_OLD, mdaId: MDA_A, filename: 'old.xlsx', supersededBy: null,
      }]);
      // Second select: replacement upload
      const selectChain2 = mockChain([{
        id: UPLOAD_NEW, mdaId: MDA_A, filename: 'new.xlsx',
      }]);
      mockDb.select
        .mockReturnValueOnce(selectChain1)
        .mockReturnValueOnce(selectChain2);

      // Transaction mock: update upload, update records, select affected, select baselines, insert annotations
      const txUpdateChain1 = mockChain(undefined); // update upload
      const txUpdateChain2 = mockChain([{ id: 'rec-1' }, { id: 'rec-2' }]); // update records
      const txSelectChain1 = mockChain([{ loanId: 'loan-1' }]); // affected records with baselines
      const txSelectChain2 = mockChain([{ id: 'entry-1' }]); // baseline ledger entries
      const txInsertChain = mockChain(undefined); // insert annotations

      mockTx.update
        .mockReturnValueOnce(txUpdateChain1)
        .mockReturnValueOnce(txUpdateChain2);
      mockTx.select
        .mockReturnValueOnce(txSelectChain1)
        .mockReturnValueOnce(txSelectChain2);
      mockTx.insert.mockReturnValueOnce(txInsertChain);

      // Post-tx: observation auto-resolve
      const updateObsChain = mockChain(undefined);
      mockDb.update.mockReturnValueOnce(updateObsChain);
    }

    it('successfully supersedes an upload with full cascade', async () => {
      setupValidUploads();

      const result = await supersedeUpload(UPLOAD_OLD, UPLOAD_NEW, REASON, USER_ID);

      expect(result.supersededUploadId).toBe(UPLOAD_OLD);
      expect(result.replacementUploadId).toBe(UPLOAD_NEW);
      expect(result.recordsSuperseded).toBe(2);
      expect(result.baselinesAnnotated).toBe(1);
      expect(result.observationsRegenerated).toBe(true);

      // Verify observation engine re-ran for surviving upload
      expect(generateObservations).toHaveBeenCalledWith(UPLOAD_NEW, USER_ID);
    });

    it('rejects superseding an already-superseded upload', async () => {
      const selectChain = mockChain([{
        id: UPLOAD_OLD, mdaId: MDA_A, filename: 'old.xlsx', supersededBy: 'some-other-upload',
      }]);
      mockDb.select.mockReturnValueOnce(selectChain);

      await expect(
        supersedeUpload(UPLOAD_OLD, UPLOAD_NEW, REASON, USER_ID),
      ).rejects.toThrow('already been superseded');
    });

    it('rejects mismatched MDA between uploads', async () => {
      const selectChain1 = mockChain([{
        id: UPLOAD_OLD, mdaId: MDA_A, filename: 'old.xlsx', supersededBy: null,
      }]);
      const selectChain2 = mockChain([{
        id: UPLOAD_NEW, mdaId: 'mda-bbbb', filename: 'new.xlsx',
      }]);
      mockDb.select
        .mockReturnValueOnce(selectChain1)
        .mockReturnValueOnce(selectChain2);

      await expect(
        supersedeUpload(UPLOAD_OLD, UPLOAD_NEW, REASON, USER_ID),
      ).rejects.toThrow('same MDA');
    });

    it('rejects when superseded upload not found', async () => {
      const selectChain = mockChain([]);
      mockDb.select.mockReturnValueOnce(selectChain);

      await expect(
        supersedeUpload(UPLOAD_OLD, UPLOAD_NEW, REASON, USER_ID),
      ).rejects.toThrow('could not be found');
    });

    it('rejects when replacement upload not found', async () => {
      const selectChain1 = mockChain([{
        id: UPLOAD_OLD, mdaId: MDA_A, filename: 'old.xlsx', supersededBy: null,
      }]);
      const selectChain2 = mockChain([]);
      mockDb.select
        .mockReturnValueOnce(selectChain1)
        .mockReturnValueOnce(selectChain2);

      await expect(
        supersedeUpload(UPLOAD_OLD, UPLOAD_NEW, REASON, USER_ID),
      ).rejects.toThrow('replacement upload could not be found');
    });

    it('rejects self-supersession', async () => {
      const selectChain1 = mockChain([{
        id: UPLOAD_OLD, mdaId: MDA_A, filename: 'old.xlsx', supersededBy: null,
      }]);
      const selectChain2 = mockChain([{
        id: UPLOAD_OLD, mdaId: MDA_A, filename: 'old.xlsx',
      }]);
      mockDb.select
        .mockReturnValueOnce(selectChain1)
        .mockReturnValueOnce(selectChain2);

      await expect(
        supersedeUpload(UPLOAD_OLD, UPLOAD_OLD, REASON, USER_ID),
      ).rejects.toThrow('cannot supersede itself');
    });

    it('handles zero baselines gracefully', async () => {
      // Superseded + replacement valid
      const selectChain1 = mockChain([{
        id: UPLOAD_OLD, mdaId: MDA_A, filename: 'old.xlsx', supersededBy: null,
      }]);
      const selectChain2 = mockChain([{
        id: UPLOAD_NEW, mdaId: MDA_A, filename: 'new.xlsx',
      }]);
      mockDb.select
        .mockReturnValueOnce(selectChain1)
        .mockReturnValueOnce(selectChain2);

      // Tx: update upload, update records (3 records), no baselines
      const txUpdateChain1 = mockChain(undefined);
      const txUpdateChain2 = mockChain([{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }]);
      const txSelectChain1 = mockChain([]); // no affected baselines

      mockTx.update
        .mockReturnValueOnce(txUpdateChain1)
        .mockReturnValueOnce(txUpdateChain2);
      mockTx.select.mockReturnValueOnce(txSelectChain1);

      // Post-tx: observation resolve
      const updateObsChain = mockChain(undefined);
      mockDb.update.mockReturnValueOnce(updateObsChain);

      const result = await supersedeUpload(UPLOAD_OLD, UPLOAD_NEW, REASON, USER_ID);

      expect(result.recordsSuperseded).toBe(3);
      expect(result.baselinesAnnotated).toBe(0);
    });
  });
});
