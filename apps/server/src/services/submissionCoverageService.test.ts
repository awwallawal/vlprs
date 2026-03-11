import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSubmissionCoverage, getSubmissionHeatmap } from './submissionCoverageService';

// Mock mdaService to return test MDAs
vi.mock('./mdaService', () => ({
  listMdas: vi.fn().mockResolvedValue([
    { id: 'mda-1', code: 'OY-FIN', name: 'Ministry of Finance', abbreviation: 'FIN', isActive: true, parentMdaId: null, parentMdaCode: null },
    { id: 'mda-2', code: 'OY-EDU', name: 'Ministry of Education', abbreviation: 'EDU', isActive: true, parentMdaId: null, parentMdaCode: null },
    { id: 'mda-3', code: 'OY-HEA', name: 'Ministry of Health', abbreviation: 'HEA', isActive: true, parentMdaId: null, parentMdaCode: null },
  ]),
}));

describe('submissionCoverageService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSubmissionCoverage', () => {
    it('returns default coverage for all MDAs when no mdaId provided', async () => {
      const result = await getSubmissionCoverage();

      expect(result).toHaveLength(3);
      for (const item of result) {
        expect(item).toEqual({
          mdaId: expect.any(String),
          coveragePercent: null,
          isDark: false,
          stalenessMonths: null,
          lastSubmissionDate: null,
        });
      }
    });

    it('returns single MDA coverage when mdaId provided', async () => {
      const result = await getSubmissionCoverage('mda-1');

      expect(result).toHaveLength(1);
      expect(result[0].mdaId).toBe('mda-1');
      expect(result[0].coveragePercent).toBeNull();
      expect(result[0].isDark).toBe(false);
      expect(result[0].stalenessMonths).toBeNull();
      expect(result[0].lastSubmissionDate).toBeNull();
    });

    it('has correct shape for each coverage item', async () => {
      const result = await getSubmissionCoverage();

      for (const item of result) {
        expect(item).toHaveProperty('mdaId');
        expect(item).toHaveProperty('coveragePercent');
        expect(item).toHaveProperty('isDark');
        expect(item).toHaveProperty('stalenessMonths');
        expect(item).toHaveProperty('lastSubmissionDate');
      }
    });
  });

  describe('getSubmissionHeatmap', () => {
    it('returns heatmap rows for all MDAs with empty cells when no scope', async () => {
      const result = await getSubmissionHeatmap();

      expect(result).toHaveLength(3);
      for (const row of result) {
        expect(row.cells).toEqual([]);
        expect(row.complianceRate).toBe(0);
        expect(row).toHaveProperty('mdaId');
        expect(row).toHaveProperty('mdaName');
        expect(row).toHaveProperty('mdaCode');
      }
    });

    it('returns single MDA heatmap when mdaScope provided', async () => {
      const result = await getSubmissionHeatmap('mda-2');

      expect(result).toHaveLength(1);
      expect(result[0].mdaId).toBe('mda-2');
      expect(result[0].cells).toEqual([]);
    });

    it('returns rows with MdaHeatmapRow shape', async () => {
      const result = await getSubmissionHeatmap();

      for (const row of result) {
        expect(typeof row.mdaId).toBe('string');
        expect(typeof row.mdaName).toBe('string');
        expect(typeof row.mdaCode).toBe('string');
        expect(typeof row.complianceRate).toBe('number');
        expect(Array.isArray(row.cells)).toBe(true);
      }
    });
  });
});
