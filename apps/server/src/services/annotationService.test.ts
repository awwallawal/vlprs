import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSelect, mockInsert } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
}));

vi.mock('../db/index', () => ({
  db: { select: mockSelect, insert: mockInsert },
}));

vi.mock('../db/schema', () => ({
  loans: { id: 'loans.id', mdaId: 'loans.mda_id', staffId: 'loans.staff_id' },
  loanAnnotations: {
    id: 'loan_annotations.id',
    loanId: 'loan_annotations.loan_id',
    content: 'loan_annotations.content',
    createdBy: 'loan_annotations.created_by',
    createdAt: 'loan_annotations.created_at',
  },
  users: { id: 'users.id', firstName: 'users.first_name', lastName: 'users.last_name' },
}));

function mockChain(result: unknown) {
  const promise = Promise.resolve(result);
  const fns = Array.from({ length: 12 }, () => vi.fn());
  const chain = {
    from: fns[0], where: fns[1], limit: fns[2], innerJoin: fns[3],
    orderBy: fns[4], values: fns[5], returning: fns[6], leftJoin: fns[7],
    then: promise.then.bind(promise), catch: promise.catch.bind(promise),
  };
  fns.forEach((fn) => fn.mockReturnValue(chain));
  return chain;
}

import { addAnnotation, getAnnotations } from './annotationService';

describe('annotationService', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('addAnnotation', () => {
    it('creates annotation and returns with author name', async () => {
      const now = new Date();
      // 1st select: loan lookup
      mockSelect.mockReturnValueOnce(
        mockChain([{ id: 'loan-1', mdaId: 'mda-1' }]),
      );
      // insert: annotation
      mockInsert.mockReturnValueOnce(
        mockChain([{ id: 'ann-1', loanId: 'loan-1', content: 'Test note', createdBy: 'user-1', createdAt: now }]),
      );
      // 2nd select: user name
      mockSelect.mockReturnValueOnce(
        mockChain([{ firstName: 'John', lastName: 'Doe' }]),
      );

      const result = await addAnnotation('loan-1', 'Test note', 'user-1', null);

      expect(result.id).toBe('ann-1');
      expect(result.content).toBe('Test note');
      expect(result.createdBy.name).toBe('John Doe');
      expect(result.createdAt).toBe(now.toISOString());
    });

    it('throws 404 when loan not found', async () => {
      mockSelect.mockReturnValueOnce(mockChain([]));

      await expect(addAnnotation('bad-id', 'Note', 'user-1', null))
        .rejects.toThrow();
    });

    it('throws 403 when MDA scope violated', async () => {
      mockSelect.mockReturnValueOnce(
        mockChain([{ id: 'loan-1', mdaId: 'mda-other' }]),
      );

      await expect(addAnnotation('loan-1', 'Note', 'user-1', 'mda-mine'))
        .rejects.toThrow('assigned MDA');
    });

    it('allows SUPER_ADMIN (null scope) to annotate any loan', async () => {
      const now = new Date();
      mockSelect.mockReturnValueOnce(
        mockChain([{ id: 'loan-1', mdaId: 'mda-other' }]),
      );
      mockInsert.mockReturnValueOnce(
        mockChain([{ id: 'ann-2', loanId: 'loan-1', content: 'Admin note', createdBy: 'admin-1', createdAt: now }]),
      );
      mockSelect.mockReturnValueOnce(
        mockChain([{ firstName: 'Admin', lastName: 'User' }]),
      );

      const result = await addAnnotation('loan-1', 'Admin note', 'admin-1', null);
      expect(result.id).toBe('ann-2');
    });
  });

  describe('getAnnotations', () => {
    it('returns annotations in reverse chronological order', async () => {
      const t1 = new Date('2026-03-20');
      const t2 = new Date('2026-03-25');

      // loan lookup
      mockSelect.mockReturnValueOnce(
        mockChain([{ id: 'loan-1', mdaId: 'mda-1' }]),
      );
      // annotations query (already ordered by service)
      mockSelect.mockReturnValueOnce(
        mockChain([
          { id: 'a2', loanId: 'loan-1', content: 'Newer', createdBy: 'u1', createdAt: t2, authorFirstName: 'A', authorLastName: 'B' },
          { id: 'a1', loanId: 'loan-1', content: 'Older', createdBy: 'u1', createdAt: t1, authorFirstName: 'A', authorLastName: 'B' },
        ]),
      );

      const result = await getAnnotations('loan-1', null);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('a2');
      expect(result[1].id).toBe('a1');
    });
  });
});
