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
  loanEventFlagCorrections: {
    id: 'corrections.id', loanId: 'corrections.loan_id', staffId: 'corrections.staff_id',
    submissionRowId: 'corrections.submission_row_id',
    originalEventFlag: 'corrections.original_event_flag', newEventFlag: 'corrections.new_event_flag',
    correctionReason: 'corrections.correction_reason', correctedBy: 'corrections.corrected_by',
    createdAt: 'corrections.created_at',
  },
  users: { id: 'users.id', firstName: 'users.first_name', lastName: 'users.last_name' },
  employmentEvents: { id: 'ee.id', loanId: 'ee.loan_id', eventType: 'ee.event_type' },
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

import { correctEventFlag, getCorrections } from './eventFlagCorrectionService';

describe('eventFlagCorrectionService', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('correctEventFlag', () => {
    it('saves correction with both original and new values', async () => {
      const now = new Date();
      // loan lookup
      mockSelect.mockReturnValueOnce(mockChain([{ id: 'loan-1', mdaId: 'mda-1', staffId: 'STF001' }]));
      // insert correction
      mockInsert.mockReturnValueOnce(mockChain([{
        id: 'corr-1', loanId: 'loan-1', staffId: 'STF001', submissionRowId: null,
        originalEventFlag: 'NONE', newEventFlag: 'RETIREMENT',
        correctionReason: 'Staff retired but flag was not set', correctedBy: 'user-1', createdAt: now,
      }]));
      // user name
      mockSelect.mockReturnValueOnce(mockChain([{ firstName: 'Admin', lastName: 'User' }]));
      // employment event check — no existing
      mockSelect.mockReturnValueOnce(mockChain([]));

      const result = await correctEventFlag('loan-1', {
        originalEventFlag: 'NONE',
        newEventFlag: 'RETIREMENT',
        correctionReason: 'Staff retired but flag was not set',
      }, 'user-1', null);

      expect(result.originalEventFlag).toBe('NONE');
      expect(result.newEventFlag).toBe('RETIREMENT');
      expect(result.correctedBy.name).toBe('Admin User');
      expect(result.suggestCreateEvent).toBe(true);
      expect(result.suggestedEventType).toBe('RETIRED');
    });

    it('rejects self-correction (same flag)', async () => {
      mockSelect.mockReturnValueOnce(mockChain([{ id: 'loan-1', mdaId: 'mda-1', staffId: 'STF001' }]));

      await expect(correctEventFlag('loan-1', {
        originalEventFlag: 'RETIREMENT',
        newEventFlag: 'RETIREMENT',
        correctionReason: 'Some long enough reason here',
      }, 'user-1', null)).rejects.toThrow();
    });

    it('rejects correction reason under 10 chars', async () => {
      mockSelect.mockReturnValueOnce(mockChain([{ id: 'loan-1', mdaId: 'mda-1', staffId: 'STF001' }]));

      await expect(correctEventFlag('loan-1', {
        originalEventFlag: 'NONE',
        newEventFlag: 'RETIREMENT',
        correctionReason: 'Short',
      }, 'user-1', null)).rejects.toThrow();
    });

    it('enforces MDA scoping', async () => {
      mockSelect.mockReturnValueOnce(mockChain([{ id: 'loan-1', mdaId: 'mda-other', staffId: 'STF001' }]));

      await expect(correctEventFlag('loan-1', {
        originalEventFlag: 'NONE',
        newEventFlag: 'RETIREMENT',
        correctionReason: 'Staff retired but flag was not set',
      }, 'user-1', 'mda-mine')).rejects.toThrow('assigned MDA');
    });

    it('does not suggest event when matching employment event already exists', async () => {
      const now = new Date();
      mockSelect.mockReturnValueOnce(mockChain([{ id: 'loan-1', mdaId: 'mda-1', staffId: 'STF001' }]));
      mockInsert.mockReturnValueOnce(mockChain([{
        id: 'corr-2', loanId: 'loan-1', staffId: 'STF001', submissionRowId: null,
        originalEventFlag: 'NONE', newEventFlag: 'RETIREMENT',
        correctionReason: 'Staff retired but flag was not set', correctedBy: 'user-1', createdAt: now,
      }]));
      mockSelect.mockReturnValueOnce(mockChain([{ firstName: 'Admin', lastName: 'User' }]));
      // employment event EXISTS
      mockSelect.mockReturnValueOnce(mockChain([{ id: 'ee-1' }]));

      const result = await correctEventFlag('loan-1', {
        originalEventFlag: 'NONE',
        newEventFlag: 'RETIREMENT',
        correctionReason: 'Staff retired but flag was not set',
      }, 'user-1', null);

      expect(result.suggestCreateEvent).toBeUndefined();
      expect(result.suggestedEventType).toBeUndefined();
    });

    it('does not suggest event for NONE flag (no mapping)', async () => {
      const now = new Date();
      mockSelect.mockReturnValueOnce(mockChain([{ id: 'loan-1', mdaId: 'mda-1', staffId: 'STF001' }]));
      mockInsert.mockReturnValueOnce(mockChain([{
        id: 'corr-3', loanId: 'loan-1', staffId: 'STF001', submissionRowId: null,
        originalEventFlag: 'RETIREMENT', newEventFlag: 'NONE',
        correctionReason: 'Retirement flag was set in error', correctedBy: 'user-1', createdAt: now,
      }]));
      mockSelect.mockReturnValueOnce(mockChain([{ firstName: 'Admin', lastName: 'User' }]));

      const result = await correctEventFlag('loan-1', {
        originalEventFlag: 'RETIREMENT',
        newEventFlag: 'NONE',
        correctionReason: 'Retirement flag was set in error',
      }, 'user-1', null);

      expect(result.suggestCreateEvent).toBeUndefined();
    });

    it('throws 404 when loan not found', async () => {
      mockSelect.mockReturnValueOnce(mockChain([]));

      await expect(correctEventFlag('bad-id', {
        originalEventFlag: 'NONE',
        newEventFlag: 'RETIREMENT',
        correctionReason: 'Staff retired but flag was not set',
      }, 'user-1', null)).rejects.toThrow();
    });
  });

  describe('getCorrections', () => {
    it('returns corrections in reverse chronological order', async () => {
      const t1 = new Date('2026-03-20');
      const t2 = new Date('2026-03-25');

      mockSelect.mockReturnValueOnce(mockChain([{ id: 'loan-1', mdaId: 'mda-1', staffId: 'STF001' }]));
      mockSelect.mockReturnValueOnce(mockChain([
        { id: 'c2', loanId: 'loan-1', staffId: 'STF001', submissionRowId: null, originalEventFlag: 'NONE', newEventFlag: 'DEATH', correctionReason: 'Long reason text', correctedBy: 'u1', createdAt: t2, correctorFirstName: 'A', correctorLastName: 'B' },
        { id: 'c1', loanId: 'loan-1', staffId: 'STF001', submissionRowId: null, originalEventFlag: 'NONE', newEventFlag: 'RETIREMENT', correctionReason: 'Long reason text', correctedBy: 'u1', createdAt: t1, correctorFirstName: 'A', correctorLastName: 'B' },
      ]));

      const result = await getCorrections('loan-1', null);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('c2');
      expect(result[1].id).toBe('c1');
    });
  });
});
