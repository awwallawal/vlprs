/**
 * observationService tests — Status transitions, error handling, promotion, counts.
 * Covers AC 8 test requirements: status transitions, resolution note required,
 * promote creates exception, count API, invalid transition rejection.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/index', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('../db/schema', () => ({
  observations: {
    id: 'observations.id',
    type: 'observations.type',
    staffName: 'observations.staff_name',
    staffId: 'observations.staff_id',
    mdaId: 'observations.mda_id',
    description: 'observations.description',
    context: 'observations.context',
    sourceReference: 'observations.source_reference',
    status: 'observations.status',
    reviewerId: 'observations.reviewer_id',
    reviewerNote: 'observations.reviewer_note',
    reviewedAt: 'observations.reviewed_at',
    resolutionNote: 'observations.resolution_note',
    resolvedAt: 'observations.resolved_at',
    resolvedBy: 'observations.resolved_by',
    promotedExceptionId: 'observations.promoted_exception_id',
    createdAt: 'observations.created_at',
    updatedAt: 'observations.updated_at',
    uploadId: 'observations.upload_id',
  },
  exceptions: {
    id: 'exceptions.id',
    observationId: 'exceptions.observation_id',
    staffName: 'exceptions.staff_name',
    staffId: 'exceptions.staff_id',
    mdaId: 'exceptions.mda_id',
    category: 'exceptions.category',
    description: 'exceptions.description',
    priority: 'exceptions.priority',
    promotedBy: 'exceptions.promoted_by',
  },
  mdas: {
    id: 'mdas.id',
    name: 'mdas.name',
  },
}));

vi.mock('../lib/mdaScope', () => ({
  withMdaScope: vi.fn().mockReturnValue(null),
}));

import {
  markAsReviewed,
  markAsResolved,
  promoteToException,
  getObservationCounts,
} from './observationService';
import { db } from '../db/index';

// ─── Mock Helpers ────────────────────────────────────────────────────

/** Creates a thenable chain mock that resolves to `result` when awaited. */
function mockChain(result: unknown) {
  const promise = Promise.resolve(result);
  const chain: Record<string, any> = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.leftJoin = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.offset = vi.fn().mockReturnValue(chain);
  chain.groupBy = vi.fn().mockReturnValue(chain);
  chain.set = vi.fn().mockReturnValue(chain);
  chain.values = vi.fn().mockReturnValue(chain);
  chain.returning = vi.fn().mockReturnValue(chain);
  chain.then = promise.then.bind(promise);
  chain.catch = promise.catch.bind(promise);
  return chain;
}

// ─── markAsReviewed ──────────────────────────────────────────────────

describe('observationService — markAsReviewed', () => {
  beforeEach(() => vi.clearAllMocks());

  it('transitions unreviewed → reviewed, records reviewerId and note', async () => {
    (db.select as any).mockReturnValueOnce(
      mockChain([{ id: 'obs1', status: 'unreviewed' }]),
    );
    const updateChain = mockChain(undefined);
    (db.update as any).mockReturnValueOnce(updateChain);

    await markAsReviewed('obs1', 'user1', 'Checked the records');

    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'reviewed',
        reviewerId: 'user1',
        reviewerNote: 'Checked the records',
      }),
    );
  });

  it('records reviewedAt timestamp', async () => {
    (db.select as any).mockReturnValueOnce(
      mockChain([{ id: 'obs1', status: 'unreviewed' }]),
    );
    const updateChain = mockChain(undefined);
    (db.update as any).mockReturnValueOnce(updateChain);

    await markAsReviewed('obs1', 'user1');

    const setArg = (updateChain.set as any).mock.calls[0][0];
    expect(setArg.reviewedAt).toBeInstanceOf(Date);
  });

  it('allows note to be omitted', async () => {
    (db.select as any).mockReturnValueOnce(
      mockChain([{ id: 'obs1', status: 'unreviewed' }]),
    );
    const updateChain = mockChain(undefined);
    (db.update as any).mockReturnValueOnce(updateChain);

    await markAsReviewed('obs1', 'user1');

    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        reviewerNote: null,
      }),
    );
  });

  it('throws 404 when observation not found', async () => {
    (db.select as any).mockReturnValueOnce(mockChain([]));

    await expect(markAsReviewed('missing', 'user1')).rejects.toThrow(
      'The requested observation could not be found',
    );
  });

  it('throws 400 when already reviewed', async () => {
    (db.select as any).mockReturnValueOnce(
      mockChain([{ id: 'obs1', status: 'reviewed' }]),
    );

    await expect(markAsReviewed('obs1', 'user1')).rejects.toThrow(
      'This observation has already been reviewed',
    );
  });

  it('rejects transition from resolved status', async () => {
    (db.select as any).mockReturnValueOnce(
      mockChain([{ id: 'obs1', status: 'resolved' }]),
    );

    await expect(markAsReviewed('obs1', 'user1')).rejects.toThrow(
      /Cannot mark as reviewed/,
    );
  });

  it('rejects transition from promoted status', async () => {
    (db.select as any).mockReturnValueOnce(
      mockChain([{ id: 'obs1', status: 'promoted' }]),
    );

    await expect(markAsReviewed('obs1', 'user1')).rejects.toThrow(
      /Cannot mark as reviewed/,
    );
  });
});

// ─── markAsResolved ──────────────────────────────────────────────────

describe('observationService — markAsResolved', () => {
  beforeEach(() => vi.clearAllMocks());

  it('transitions reviewed → resolved with resolution note and resolvedBy', async () => {
    (db.select as any).mockReturnValueOnce(
      mockChain([{ id: 'obs1', status: 'reviewed' }]),
    );
    const updateChain = mockChain(undefined);
    (db.update as any).mockReturnValueOnce(updateChain);

    await markAsResolved('obs1', 'user1', 'Confirmed with MDA payroll');

    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'resolved',
        resolutionNote: 'Confirmed with MDA payroll',
        resolvedBy: 'user1',
      }),
    );
  });

  it('records resolvedAt timestamp', async () => {
    (db.select as any).mockReturnValueOnce(
      mockChain([{ id: 'obs1', status: 'reviewed' }]),
    );
    const updateChain = mockChain(undefined);
    (db.update as any).mockReturnValueOnce(updateChain);

    await markAsResolved('obs1', 'user1', 'Done');

    const setArg = (updateChain.set as any).mock.calls[0][0];
    expect(setArg.resolvedAt).toBeInstanceOf(Date);
  });

  it('rejects transition from unreviewed (must review first)', async () => {
    (db.select as any).mockReturnValueOnce(
      mockChain([{ id: 'obs1', status: 'unreviewed' }]),
    );

    await expect(
      markAsResolved('obs1', 'user1', 'note'),
    ).rejects.toThrow('Observation must be reviewed before it can be resolved');
  });

  it('throws 404 when observation not found', async () => {
    (db.select as any).mockReturnValueOnce(mockChain([]));

    await expect(
      markAsResolved('missing', 'user1', 'note'),
    ).rejects.toThrow('The requested observation could not be found');
  });
});

// ─── promoteToException ──────────────────────────────────────────────

describe('observationService — promoteToException', () => {
  beforeEach(() => vi.clearAllMocks());

  const sampleObs = {
    id: 'obs1',
    status: 'unreviewed',
    type: 'rate_variance',
    staffName: 'BELLO AMINAT',
    staffId: null,
    mdaId: 'mda1',
    description: 'Rate variance detected',
  };

  it('creates exception record and sets status to promoted', async () => {
    (db.select as any).mockReturnValueOnce(mockChain([sampleObs]));
    const insertChain = mockChain([{ id: 'exc1' }]);
    (db.insert as any).mockReturnValueOnce(insertChain);
    const updateChain = mockChain(undefined);
    (db.update as any).mockReturnValueOnce(updateChain);

    const result = await promoteToException('obs1', 'user1', 'high');

    expect(result).toEqual({ exceptionId: 'exc1' });

    expect(insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        observationId: 'obs1',
        staffName: 'BELLO AMINAT',
        category: 'rate_variance',
        priority: 'high',
        promotedBy: 'user1',
      }),
    );

    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'promoted',
        promotedExceptionId: 'exc1',
      }),
    );
  });

  it('allows promotion from reviewed status', async () => {
    (db.select as any).mockReturnValueOnce(
      mockChain([{ ...sampleObs, status: 'reviewed' }]),
    );
    (db.insert as any).mockReturnValueOnce(mockChain([{ id: 'exc2' }]));
    (db.update as any).mockReturnValueOnce(mockChain(undefined));

    const result = await promoteToException('obs1', 'user1');
    expect(result).toEqual({ exceptionId: 'exc2' });
  });

  it('defaults priority to medium when not specified', async () => {
    (db.select as any).mockReturnValueOnce(mockChain([sampleObs]));
    const insertChain = mockChain([{ id: 'exc3' }]);
    (db.insert as any).mockReturnValueOnce(insertChain);
    (db.update as any).mockReturnValueOnce(mockChain(undefined));

    await promoteToException('obs1', 'user1');

    expect(insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({ priority: 'medium' }),
    );
  });

  it('rejects promotion of resolved observation', async () => {
    (db.select as any).mockReturnValueOnce(
      mockChain([{ ...sampleObs, status: 'resolved' }]),
    );

    await expect(promoteToException('obs1', 'user1')).rejects.toThrow(
      /Cannot promote observation with status "resolved"/,
    );
  });

  it('rejects promotion of already promoted observation', async () => {
    (db.select as any).mockReturnValueOnce(
      mockChain([{ ...sampleObs, status: 'promoted' }]),
    );

    await expect(promoteToException('obs1', 'user1')).rejects.toThrow(
      /Cannot promote observation with status "promoted"/,
    );
  });

  it('throws 404 when observation not found', async () => {
    (db.select as any).mockReturnValueOnce(mockChain([]));

    await expect(promoteToException('missing', 'user1')).rejects.toThrow(
      'The requested observation could not be found',
    );
  });
});

// ─── getObservationCounts ────────────────────────────────────────────

describe('observationService — getObservationCounts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns counts grouped by type and status', async () => {
    (db.select as any).mockReturnValueOnce(
      mockChain([{
        total: 100,
        rateVariance: '50',
        stalledBalance: '10',
        negativeBalance: '20',
        multiMda: '15',
        noApprovalMatch: '0',
        consecutiveLoan: '5',
        unreviewed: '60',
        reviewed: '25',
        resolved: '10',
        promoted: '5',
      }]),
    );

    const counts = await getObservationCounts();

    expect(counts.total).toBe(100);
    expect(counts.byType.rate_variance).toBe(50);
    expect(counts.byType.stalled_balance).toBe(10);
    expect(counts.byType.negative_balance).toBe(20);
    expect(counts.byType.multi_mda).toBe(15);
    expect(counts.byType.no_approval_match).toBe(0);
    expect(counts.byType.consecutive_loan).toBe(5);
    expect(counts.byStatus.unreviewed).toBe(60);
    expect(counts.byStatus.reviewed).toBe(25);
    expect(counts.byStatus.resolved).toBe(10);
    expect(counts.byStatus.promoted).toBe(5);
  });
});
