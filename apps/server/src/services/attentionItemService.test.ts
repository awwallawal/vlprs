import { describe, it, expect } from 'vitest';
import { buildPerMdaItems, formatAmount } from './attentionItemService';

describe('attentionItemService', () => {
  describe('buildPerMdaItems', () => {
    const descFn = (row: { affected_count: number }) =>
      `${row.affected_count} loans affected`;
    const drillFn = (row: { mda_id: string }) =>
      `/dashboard/loans?filter=test&mda=${row.mda_id}`;
    const allDrill = '/dashboard/loans?filter=test';

    it('returns empty array for empty input', () => {
      const result = buildPerMdaItems([], 'zero_deduction', 'review', 10, descFn, drillFn, allDrill);
      expect(result).toEqual([]);
    });

    it('returns 1 item for 1 MDA', () => {
      const rows = [{ mda_id: 'mda-1', mda_name: 'Ministry A', affected_count: 5 }];
      const result = buildPerMdaItems(rows, 'zero_deduction', 'review', 10, descFn, drillFn, allDrill);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('zero_deduction');
      expect(result[0].category).toBe('review');
      expect(result[0].priority).toBe(10);
      expect(result[0].mdaName).toBe('Ministry A');
      expect(result[0].description).toBe('5 loans affected');
      expect(result[0].drillDownUrl).toBe('/dashboard/loans?filter=test&mda=mda-1');
      expect(result[0].count).toBe(5);
      expect(result[0].hasMore).toBeUndefined();
    });

    it('returns 3 items for exactly 3 MDAs with no hasMore', () => {
      const rows = [
        { mda_id: 'mda-1', mda_name: 'Ministry A', affected_count: 10 },
        { mda_id: 'mda-2', mda_name: 'Ministry B', affected_count: 7 },
        { mda_id: 'mda-3', mda_name: 'Ministry C', affected_count: 3 },
      ];
      const result = buildPerMdaItems(rows, 'zero_deduction', 'review', 10, descFn, drillFn, allDrill);

      expect(result).toHaveLength(3);
      expect(result[0].mdaName).toBe('Ministry A');
      expect(result[1].mdaName).toBe('Ministry B');
      expect(result[2].mdaName).toBe('Ministry C');
      // No hasMore since exactly 3
      expect(result[2].hasMore).toBeUndefined();
      expect(result[2].drillDownUrl).toBe('/dashboard/loans?filter=test&mda=mda-3');
    });

    it('returns 3 items with hasMore for >3 MDAs', () => {
      const rows = [
        { mda_id: 'mda-1', mda_name: 'Ministry A', affected_count: 10 },
        { mda_id: 'mda-2', mda_name: 'Ministry B', affected_count: 7 },
        { mda_id: 'mda-3', mda_name: 'Ministry C', affected_count: 5 },
        { mda_id: 'mda-4', mda_name: 'Ministry D', affected_count: 3 },
        { mda_id: 'mda-5', mda_name: 'Ministry E', affected_count: 1 },
      ];
      const result = buildPerMdaItems(rows, 'post_retirement_active', 'review', 20, descFn, drillFn, allDrill);

      expect(result).toHaveLength(3);

      // First two have per-MDA drill-down
      expect(result[0].drillDownUrl).toBe('/dashboard/loans?filter=test&mda=mda-1');
      expect(result[1].drillDownUrl).toBe('/dashboard/loans?filter=test&mda=mda-2');

      // Third has "and N more" pattern
      expect(result[2].hasMore).toBe(2);
      expect(result[2].description).toContain('and 2 more MDAs');
      expect(result[2].drillDownUrl).toBe('/dashboard/loans?filter=test');
    });

    it('uses singular "MDA" when hasMore is 1', () => {
      const rows = [
        { mda_id: 'mda-1', mda_name: 'Ministry A', affected_count: 10 },
        { mda_id: 'mda-2', mda_name: 'Ministry B', affected_count: 7 },
        { mda_id: 'mda-3', mda_name: 'Ministry C', affected_count: 5 },
        { mda_id: 'mda-4', mda_name: 'Ministry D', affected_count: 3 },
      ];
      const result = buildPerMdaItems(rows, 'zero_deduction', 'review', 10, descFn, drillFn, allDrill);

      expect(result[2].hasMore).toBe(1);
      expect(result[2].description).toContain('and 1 more MDA');
      expect(result[2].description).not.toContain('MDAs');
    });

    it('sets all items to the same priority', () => {
      const rows = [
        { mda_id: 'mda-1', mda_name: 'Ministry A', affected_count: 10 },
        { mda_id: 'mda-2', mda_name: 'Ministry B', affected_count: 7 },
      ];
      const result = buildPerMdaItems(rows, 'zero_deduction', 'review', 10, descFn, drillFn, allDrill);
      expect(result[0].priority).toBe(10);
      expect(result[1].priority).toBe(10);
    });

    it('generates unique IDs for each item', () => {
      const rows = [
        { mda_id: 'mda-1', mda_name: 'Ministry A', affected_count: 10 },
        { mda_id: 'mda-2', mda_name: 'Ministry B', affected_count: 7 },
      ];
      const result = buildPerMdaItems(rows, 'zero_deduction', 'review', 10, descFn, drillFn, allDrill);
      expect(result[0].id).not.toBe(result[1].id);
    });

    it('sets timestamp to current ISO 8601 format', () => {
      const rows = [{ mda_id: 'mda-1', mda_name: 'Ministry A', affected_count: 5 }];
      const result = buildPerMdaItems(rows, 'zero_deduction', 'review', 10, descFn, drillFn, allDrill);
      expect(result[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('formatAmount', () => {
    it('formats zero', () => {
      expect(formatAmount('0.00')).toBe('0.00');
    });

    it('formats large numbers with commas', () => {
      const result = formatAmount('45000000.00');
      expect(result).toContain('45');
      expect(result).toContain('000');
      expect(result).toContain('.00');
    });

    it('preserves 2 decimal places', () => {
      const result = formatAmount('1234.50');
      expect(result).toContain('.50');
    });

    it('handles NaN gracefully', () => {
      expect(formatAmount('invalid')).toBe('invalid');
    });
  });
});
