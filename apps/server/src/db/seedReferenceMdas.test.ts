import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockInsert, mockSelect, mockUpdate } = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockSelect: vi.fn(),
  mockUpdate: vi.fn(),
}));

const mockTx = {
  insert: mockInsert,
  select: mockSelect,
  update: mockUpdate,
};

vi.mock('./index', () => ({
  db: {
    transaction: vi.fn((fn: (tx: typeof mockTx) => Promise<void>) => fn(mockTx)),
  },
}));

vi.mock('./schema', () => ({
  mdas: { code: 'mdas.code', id: 'mdas.id' },
  mdaAliases: {},
}));

function mockChain(result: unknown) {
  const promise = Promise.resolve(result);
  const fns = Array.from({ length: 12 }, () => vi.fn());
  const chain = {
    from: fns[0], where: fns[1], limit: fns[2], values: fns[3],
    returning: fns[4], onConflictDoNothing: fns[5], onConflictDoUpdate: fns[6],
    set: fns[7],
    then: promise.then.bind(promise), catch: promise.catch.bind(promise),
  };
  fns.forEach((fn) => fn.mockReturnValue(chain));
  return chain;
}

import { seedReferenceMdas } from './seedReferenceMdas';

describe('seedReferenceMdas', () => {
  beforeEach(() => vi.clearAllMocks());

  it('inserts MDAs from MDA_LIST with onConflictDoNothing', async () => {
    // Every insert returns a record (first run — all new)
    mockInsert.mockReturnValue(mockChain([{ id: 'mda-1' }]));
    // select().from(mdas) returns lookup rows
    mockSelect.mockReturnValue(
      mockChain([
        { id: 'mda-cdu', code: 'CDU' },
        { id: 'mda-agr', code: 'AGRICULTURE' },
      ]),
    );
    // update for CDU parent
    mockUpdate.mockReturnValue(mockChain(undefined));

    await seedReferenceMdas();

    // insert was called for MDAs + aliases + CDU aliases
    expect(mockInsert).toHaveBeenCalled();
    // select was called to build lookup map
    expect(mockSelect).toHaveBeenCalled();
    // update was called for CDU parent relationship
    expect(mockUpdate).toHaveBeenCalled();
  });

  it('is idempotent — no errors on second call', async () => {
    // Second run: onConflictDoNothing returns empty (no new records)
    mockInsert.mockReturnValue(mockChain([]));
    mockSelect.mockReturnValue(
      mockChain([
        { id: 'mda-cdu', code: 'CDU' },
        { id: 'mda-agr', code: 'AGRICULTURE' },
      ]),
    );
    mockUpdate.mockReturnValue(mockChain(undefined));

    await expect(seedReferenceMdas()).resolves.not.toThrow();
  });
});
