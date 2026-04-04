import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/index', () => ({
  db: { execute: vi.fn() },
}));

import { db } from '../db/index';
import {
  getEffectiveEventFlags,
  getEffectiveEventFlag,
  getEffectiveEventFlagsByLoan,
} from './effectiveEventFlagHelper';

describe('effectiveEventFlagHelper', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('getEffectiveEventFlags', () => {
    it('returns empty Map when no submission row IDs provided', async () => {
      const result = await getEffectiveEventFlags([]);
      expect(result.size).toBe(0);
      expect(db.execute).not.toHaveBeenCalled();
    });

    it('returns empty Map when no corrections exist', async () => {
      (db.execute as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ rows: [] });
      const result = await getEffectiveEventFlags(['row-1', 'row-2']);
      expect(result.size).toBe(0);
    });

    it('returns corrected flag for a single correction', async () => {
      (db.execute as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        rows: [{ submission_row_id: 'row-1', new_event_flag: 'RETIREMENT' }],
      });
      const result = await getEffectiveEventFlags(['row-1']);
      expect(result.size).toBe(1);
      expect(result.get('row-1')).toBe('RETIREMENT');
    });

    it('returns latest correction when multiple exist for same row (DISTINCT ON)', async () => {
      // DB handles DISTINCT ON — returns only the latest correction per submission_row_id
      (db.execute as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        rows: [{ submission_row_id: 'row-1', new_event_flag: 'DEATH' }],
      });
      const result = await getEffectiveEventFlags(['row-1']);
      expect(result.get('row-1')).toBe('DEATH');
    });

    it('returns corrections for different rows independently', async () => {
      (db.execute as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        rows: [
          { submission_row_id: 'row-1', new_event_flag: 'RETIREMENT' },
          { submission_row_id: 'row-2', new_event_flag: 'TRANSFER_OUT' },
        ],
      });
      const result = await getEffectiveEventFlags(['row-1', 'row-2', 'row-3']);
      expect(result.size).toBe(2);
      expect(result.get('row-1')).toBe('RETIREMENT');
      expect(result.get('row-2')).toBe('TRANSFER_OUT');
      expect(result.has('row-3')).toBe(false);
    });
  });

  describe('getEffectiveEventFlag', () => {
    it('returns original flag when no correction exists', async () => {
      (db.execute as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ rows: [] });
      const result = await getEffectiveEventFlag('row-1', 'NONE');
      expect(result).toBe('NONE');
    });

    it('returns corrected flag when correction exists', async () => {
      (db.execute as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        rows: [{ submission_row_id: 'row-1', new_event_flag: 'RETIREMENT' }],
      });
      const result = await getEffectiveEventFlag('row-1', 'NONE');
      expect(result).toBe('RETIREMENT');
    });
  });

  describe('getEffectiveEventFlagsByLoan', () => {
    it('returns empty Map when no loan IDs provided', async () => {
      const result = await getEffectiveEventFlagsByLoan([]);
      expect(result.size).toBe(0);
      expect(db.execute).not.toHaveBeenCalled();
    });

    it('returns corrections keyed by loanId', async () => {
      (db.execute as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        rows: [{ loan_id: 'loan-1', new_event_flag: 'TRANSFER_OUT' }],
      });
      const result = await getEffectiveEventFlagsByLoan(['loan-1']);
      expect(result.size).toBe(1);
      expect(result.get('loan-1')).toBe('TRANSFER_OUT');
    });
  });
});
