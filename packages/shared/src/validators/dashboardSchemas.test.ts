import { describe, it, expect } from 'vitest';
import {
  complianceResponseSchema,
} from './dashboardSchemas';

describe('complianceResponseSchema', () => {
  const validRow = {
    mdaId: '01912345-6789-7abc-8def-0123456789ab',
    mdaCode: 'OY-FIN',
    mdaName: 'Ministry of Finance',
    status: 'pending' as const,
    lastSubmission: null,
    recordCount: 0,
    alignedCount: 0,
    varianceCount: 0,
    healthScore: 72.5,
    healthBand: 'healthy' as const,
    submissionCoveragePercent: null,
    isDark: false,
    stalenessMonths: null,
  };

  const validHeatmapRow = {
    mdaId: '01912345-6789-7abc-8def-0123456789ab',
    mdaName: 'Ministry of Finance',
    mdaCode: 'OY-FIN',
    complianceRate: 85,
    cells: [
      { month: '2025-04', status: 'on-time' as const },
      { month: '2025-05', status: 'grace-period' as const },
      { month: '2025-06', status: 'missing' as const },
      { month: '2026-03', status: 'current-pending' as const },
    ],
  };

  const validResponse = {
    rows: [validRow],
    heatmap: [validHeatmapRow],
    summary: {
      submitted: 45,
      pending: 10,
      overdue: 8,
      total: 63,
      deadlineDate: '2026-03-28T00:00:00.000Z',
      heatmapSummary: {
        onTime: 40,
        gracePeriod: 5,
        awaiting: 18,
      },
    },
  };

  it('validates a correct compliance response', () => {
    const result = complianceResponseSchema.safeParse(validResponse);
    expect(result.success).toBe(true);
  });

  it('validates all submission statuses', () => {
    for (const status of ['submitted', 'pending', 'overdue'] as const) {
      const row = { ...validRow, status };
      const response = { ...validResponse, rows: [row] };
      const result = complianceResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    }
  });

  it('validates all health bands', () => {
    for (const band of ['healthy', 'attention', 'for-review'] as const) {
      const row = { ...validRow, healthBand: band };
      const response = { ...validResponse, rows: [row] };
      const result = complianceResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    }
  });

  it('validates all heatmap cell statuses', () => {
    for (const status of ['on-time', 'grace-period', 'missing', 'current-pending'] as const) {
      const cell = { month: '2026-01', status };
      const heatmapRow = { ...validHeatmapRow, cells: [cell] };
      const response = { ...validResponse, heatmap: [heatmapRow] };
      const result = complianceResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    }
  });

  it('allows nullable submissionCoveragePercent and stalenessMonths', () => {
    const row = { ...validRow, submissionCoveragePercent: null, stalenessMonths: null };
    const response = { ...validResponse, rows: [row] };
    const result = complianceResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
  });

  it('allows numeric submissionCoveragePercent and stalenessMonths', () => {
    const row = { ...validRow, submissionCoveragePercent: 85.5, stalenessMonths: 3 };
    const response = { ...validResponse, rows: [row] };
    const result = complianceResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
  });

  it('allows empty heatmap array (pre-Epic 5)', () => {
    const response = { ...validResponse, heatmap: [] };
    const result = complianceResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
  });

  it('allows empty cells array in heatmap row', () => {
    const heatmapRow = { ...validHeatmapRow, cells: [] };
    const response = { ...validResponse, heatmap: [heatmapRow] };
    const result = complianceResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
  });

  it('rejects invalid health band', () => {
    const row = { ...validRow, healthBand: 'bad' };
    const response = { ...validResponse, rows: [row] };
    const result = complianceResponseSchema.safeParse(response);
    expect(result.success).toBe(false);
  });

  it('rejects invalid heatmap cell status', () => {
    const cell = { month: '2026-01', status: 'late' };
    const heatmapRow = { ...validHeatmapRow, cells: [cell] };
    const response = { ...validResponse, heatmap: [heatmapRow] };
    const result = complianceResponseSchema.safeParse(response);
    expect(result.success).toBe(false);
  });

  it('rejects missing summary fields', () => {
    const response = { ...validResponse, summary: { submitted: 45 } };
    const result = complianceResponseSchema.safeParse(response);
    expect(result.success).toBe(false);
  });

  it('validates row with submitted status and date', () => {
    const row = { ...validRow, status: 'submitted' as const, lastSubmission: '2026-03-15' };
    const response = { ...validResponse, rows: [row] };
    const result = complianceResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
  });
});
