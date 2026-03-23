/**
 * exceptionService tests — Flag lifecycle, list with filters, MDA scoping,
 * resolution, counts, and auto-promoted exception handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/index', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(),
  },
}));

vi.mock('../db/schema', () => ({
  observations: {
    id: 'observations.id',
    type: 'observations.type',
    staffName: 'observations.staff_name',
    staffId: 'observations.staff_id',
    loanId: 'observations.loan_id',
    mdaId: 'observations.mda_id',
    description: 'observations.description',
    context: 'observations.context',
    sourceReference: 'observations.source_reference',
    status: 'observations.status',
    promotedExceptionId: 'observations.promoted_exception_id',
    updatedAt: 'observations.updated_at',
    resolvedBy: 'observations.resolved_by',
    resolvedAt: 'observations.resolved_at',
    resolutionNote: 'observations.resolution_note',
    createdAt: 'observations.created_at',
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
    status: 'exceptions.status',
    promotedBy: 'exceptions.promoted_by',
    resolvedBy: 'exceptions.resolved_by',
    resolvedAt: 'exceptions.resolved_at',
    resolutionNote: 'exceptions.resolution_note',
    actionTaken: 'exceptions.action_taken',
    loanId: 'exceptions.loan_id',
    flagNotes: 'exceptions.flag_notes',
    createdAt: 'exceptions.created_at',
    updatedAt: 'exceptions.updated_at',
  },
  loans: {
    id: 'loans.id',
    staffName: 'loans.staff_name',
    staffId: 'loans.staff_id',
    mdaId: 'loans.mda_id',
    loanReference: 'loans.loan_reference',
    principalAmount: 'loans.principal_amount',
    status: 'loans.status',
  },
  mdas: {
    id: 'mdas.id',
    name: 'mdas.name',
  },
  users: {
    id: 'users.id',
    email: 'users.email',
  },
  auditLog: {
    action: 'audit_log.action',
    userId: 'audit_log.user_id',
    email: 'audit_log.email',
    createdAt: 'audit_log.created_at',
    resource: 'audit_log.resource',
  },
}));

vi.mock('../lib/mdaScope', () => ({
  withMdaScope: vi.fn().mockReturnValue(null),
}));

vi.mock('../lib/transaction', () => ({
  withTransaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
    const mockTx = {
      insert: vi.fn(),
      update: vi.fn(),
    };

    // Set up insert chain for observation
    const obsInsertChain = mockChainTx([{ id: 'obs-new' }]);
    const excInsertChain = mockChainTx([{ id: 'exc-new' }]);
    const updateChain = mockChainTx(undefined);

    let insertCallCount = 0;
    mockTx.insert.mockImplementation(() => {
      insertCallCount++;
      return insertCallCount === 1 ? obsInsertChain : excInsertChain;
    });
    mockTx.update.mockReturnValue(updateChain);

    return fn(mockTx);
  }),
}));

vi.mock('./balanceService', () => ({
  getOutstandingBalance: vi.fn().mockResolvedValue({ computedBalance: '50000.00' }),
}));

import {
  flagLoanAsException,
  listExceptions,
  getExceptionDetail,
  resolveException,
  getExceptionCounts,
} from './exceptionService';
import { db } from '../db/index';

type MockFn = ReturnType<typeof vi.fn>;
const mockDb = db as unknown as Record<'select' | 'insert' | 'update' | 'transaction', MockFn>;

// ─── Mock Helpers ────────────────────────────────────────────────────

function mockChain(result: unknown) {
  const promise = Promise.resolve(result);
  const fns = [vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn()];
  const chain = {
    from: fns[0], where: fns[1], limit: fns[2], leftJoin: fns[3], orderBy: fns[4],
    offset: fns[5], groupBy: fns[6], set: fns[7], values: fns[8], returning: fns[9],
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
  };
  fns.forEach(fn => fn.mockReturnValue(chain));
  return chain;
}

function mockChainTx(result: unknown) {
  const promise = Promise.resolve(result);
  const fns = [vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn()];
  const chain = {
    from: fns[0], where: fns[1], limit: fns[2], leftJoin: fns[3], orderBy: fns[4],
    offset: fns[5], groupBy: fns[6], set: fns[7], values: fns[8], returning: fns[9],
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
  };
  fns.forEach(fn => fn.mockReturnValue(chain));
  return chain;
}

// ─── flagLoanAsException ─────────────────────────────────────────────

describe('exceptionService — flagLoanAsException', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates observation + exception in single transaction', async () => {
    // Mock loan lookup
    mockDb.select.mockReturnValueOnce(
      mockChain([{ id: 'loan1', staffName: 'Akin Balogun', staffId: 'OY123', mdaId: 'mda1' }]),
    );

    const result = await flagLoanAsException('loan1', 'user1', null, {
      priority: 'high',
      category: 'over_deduction',
      notes: 'Staff deducted more than scheduled amount',
    });

    expect(result).toHaveProperty('exceptionId');
    expect(result).toHaveProperty('observationId');
  });

  it('rejects when loan not found', async () => {
    mockDb.select.mockReturnValueOnce(mockChain([]));

    await expect(
      flagLoanAsException('nonexistent', 'user1', null, {
        priority: 'medium',
        category: 'inactive',
        notes: 'No deductions for this loan',
      }),
    ).rejects.toThrow('The specified loan could not be found');
  });

  it('enforces MDA scoping — rejects cross-MDA flag', async () => {
    mockDb.select.mockReturnValueOnce(
      mockChain([{ id: 'loan1', staffName: 'Test', staffId: 'T1', mdaId: 'mda-A' }]),
    );

    await expect(
      flagLoanAsException('loan1', 'user1', 'mda-B', {
        priority: 'low',
        category: 'data_mismatch',
        notes: 'This loan is not in my MDA scope',
      }),
    ).rejects.toThrow('You can only flag exceptions for loans in your assigned MDA');
  });
});

// ─── listExceptions ──────────────────────────────────────────────────

describe('exceptionService — listExceptions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns exceptions sorted by priority then date', async () => {
    const now = new Date();
    // Count query
    mockDb.select.mockReturnValueOnce(mockChain([{ total: 2 }]));
    // Data query
    mockDb.select.mockReturnValueOnce(
      mockChain([
        { id: 'e1', priority: 'high', category: 'over_deduction', staffId: 'S1', staffName: 'A', mdaId: 'm1', mdaName: 'MDA1', description: 'Desc1', createdAt: now, status: 'open', resolvedAt: null, loanId: 'l1', observationId: 'o1', flagNotes: 'notes1' },
        { id: 'e2', priority: 'medium', category: 'inactive', staffId: 'S2', staffName: 'B', mdaId: 'm1', mdaName: 'MDA1', description: 'Desc2', createdAt: now, status: 'open', resolvedAt: null, loanId: null, observationId: 'o2', flagNotes: null },
      ]),
    );

    const result = await listExceptions({}, null);
    expect(result.data).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.data[0].id).toBe('e1');
    expect(result.data[0].priority).toBe('high');
  });

  it('applies status filter', async () => {
    mockDb.select.mockReturnValueOnce(mockChain([{ total: 0 }]));
    mockDb.select.mockReturnValueOnce(mockChain([]));

    const result = await listExceptions({ status: 'resolved' }, null);
    expect(result.data).toHaveLength(0);
  });

  it('applies category and priority filters', async () => {
    mockDb.select.mockReturnValueOnce(mockChain([{ total: 1 }]));
    mockDb.select.mockReturnValueOnce(
      mockChain([
        { id: 'e3', priority: 'high', category: 'ghost_deduction', staffId: 'S3', staffName: 'C', mdaId: 'm2', mdaName: 'MDA2', description: 'Ghost', createdAt: new Date(), status: 'open', resolvedAt: null, loanId: null, observationId: 'o3', flagNotes: null },
      ]),
    );

    const result = await listExceptions({ category: 'ghost_deduction', priority: 'high' }, null);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].category).toBe('ghost_deduction');
  });
});

// ─── resolveException ────────────────────────────────────────────────

describe('exceptionService — resolveException', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sets all resolution fields on exception and observation', async () => {
    // Mock exception lookup
    mockDb.select.mockReturnValueOnce(
      mockChain([{ id: 'exc1', status: 'open', mdaId: 'mda1', observationId: 'obs1' }]),
    );

    // Mock withTransaction to capture the tx operations
    const { withTransaction } = await import('../lib/transaction');
    const mockWithTx = withTransaction as MockFn;
    mockWithTx.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
      const updateChain = mockChainTx(undefined);
      const txMock = { update: vi.fn().mockReturnValue(updateChain) };
      return fn(txMock);
    });

    const result = await resolveException('exc1', 'user2', null, {
      resolutionNote: 'Verified against payroll records',
      actionTaken: 'verified_correct',
    });

    expect(result.status).toBe('resolved');
  });

  it('rejects resolution of already-resolved exception', async () => {
    mockDb.select.mockReturnValueOnce(
      mockChain([{ id: 'exc2', status: 'resolved', mdaId: 'mda1', observationId: 'obs2' }]),
    );

    await expect(
      resolveException('exc2', 'user1', null, {
        resolutionNote: 'Trying to re-resolve',
        actionTaken: 'no_action_required',
      }),
    ).rejects.toThrow('This exception has already been resolved');
  });

  it('rejects when exception not found', async () => {
    mockDb.select.mockReturnValueOnce(mockChain([]));

    await expect(
      resolveException('nonexistent', 'user1', null, {
        resolutionNote: 'Does not exist',
        actionTaken: 'no_action_required',
      }),
    ).rejects.toThrow('The requested exception could not be found');
  });
});

// ─── getExceptionCounts ──────────────────────────────────────────────

describe('exceptionService — getExceptionCounts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns correct breakdown by priority', async () => {
    mockDb.select.mockReturnValueOnce(
      mockChain([
        { priority: 'high', cnt: 3 },
        { priority: 'medium', cnt: 7 },
        { priority: 'low', cnt: 2 },
      ]),
    );

    const result = await getExceptionCounts(null);
    expect(result.high).toBe(3);
    expect(result.medium).toBe(7);
    expect(result.low).toBe(2);
    expect(result.total).toBe(12);
  });

  it('returns zeros when no open exceptions', async () => {
    mockDb.select.mockReturnValueOnce(mockChain([]));

    const result = await getExceptionCounts(null);
    expect(result.high).toBe(0);
    expect(result.medium).toBe(0);
    expect(result.low).toBe(0);
    expect(result.total).toBe(0);
  });
});

// ─── getExceptionDetail ──────────────────────────────────────────────

describe('exceptionService — getExceptionDetail', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns full exception detail with joined data', async () => {
    const now = new Date();
    // Main exception query (with joined user, observation, mda)
    mockDb.select.mockReturnValueOnce(
      mockChain([{
        id: 'exc-d1', priority: 'high', category: 'over_deduction', description: 'Test',
        status: 'open', flagNotes: 'Some notes', promotedBy: 'u1', createdAt: now,
        resolvedBy: null, resolvedAt: null, resolutionNote: null, actionTaken: null,
        loanId: null, observationId: 'obs-d1', staffName: 'Staff', staffId: 'S1',
        mdaId: 'mda-d1', mdaName: 'Works',
        promoterEmail: 'admin@gov.ng', resolverEmail: null,
        obsId: 'obs-d1', obsType: 'manual_exception', obsDescription: 'Obs desc',
        obsStatus: 'promoted', obsContext: { dataCompleteness: 1 }, obsCreatedAt: now,
      }]),
    );
    // Audit trail query
    mockDb.select.mockReturnValueOnce(mockChain([]));

    const result = await getExceptionDetail('exc-d1', null);
    expect(result.id).toBe('exc-d1');
    expect(result.promotedByName).toBe('admin@gov.ng');
    expect(result.observation.type).toBe('manual_exception');
    expect(result.loan).toBeNull();
  });

  it('rejects when exception not found', async () => {
    mockDb.select.mockReturnValueOnce(mockChain([]));

    await expect(getExceptionDetail('nonexistent', null)).rejects.toThrow(
      'The requested exception could not be found',
    );
  });

  it('enforces MDA scoping — rejects cross-MDA access', async () => {
    const now = new Date();
    mockDb.select.mockReturnValueOnce(
      mockChain([{
        id: 'exc-scope', priority: 'medium', category: 'inactive', description: 'Test',
        status: 'open', flagNotes: null, promotedBy: 'u1', createdAt: now,
        resolvedBy: null, resolvedAt: null, resolutionNote: null, actionTaken: null,
        loanId: null, observationId: 'obs-s1', staffName: 'Staff', staffId: 'S1',
        mdaId: 'mda-A', mdaName: 'MDA A',
        promoterEmail: 'admin@gov.ng', resolverEmail: null,
        obsId: 'obs-s1', obsType: 'manual_exception', obsDescription: 'Desc',
        obsStatus: 'promoted', obsContext: {}, obsCreatedAt: now,
      }]),
    );

    await expect(getExceptionDetail('exc-scope', 'mda-B')).rejects.toThrow(
      'You do not have access to this exception',
    );
  });
});

// ─── Integration: flag + resolve lifecycle ───────────────────────────

describe('exceptionService — flag + resolve lifecycle', () => {
  beforeEach(() => vi.clearAllMocks());

  it('flag creates exception, resolve marks it as resolved', async () => {
    // Step 1: Flag
    mockDb.select.mockReturnValueOnce(
      mockChain([{ id: 'loan-lifecycle', staffName: 'Test User', staffId: 'LC1', mdaId: 'mda-lc' }]),
    );

    const flagResult = await flagLoanAsException('loan-lifecycle', 'user-a', null, {
      priority: 'high',
      category: 'under_deduction',
      notes: 'Deduction amount is lower than expected schedule',
    });

    expect(flagResult.exceptionId).toBeDefined();

    // Step 2: Resolve — mock the exception lookup with the flagged exception
    mockDb.select.mockReturnValueOnce(
      mockChain([{ id: flagResult.exceptionId, status: 'open', mdaId: 'mda-lc', observationId: flagResult.observationId }]),
    );

    const { withTransaction } = await import('../lib/transaction');
    (withTransaction as MockFn).mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
      const updateChain = mockChainTx(undefined);
      const txMock = { update: vi.fn().mockReturnValue(updateChain) };
      return fn(txMock);
    });

    const resolveResult = await resolveException(flagResult.exceptionId, 'user-b', null, {
      resolutionNote: 'Confirmed deduction shortfall, adjusted record',
      actionTaken: 'adjusted_record',
    });

    expect(resolveResult.status).toBe('resolved');
  });
});
