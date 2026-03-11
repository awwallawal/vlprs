// Target: GET /api/dashboard/compliance
// Wire: Sprint 5 (Epic 4: Executive Dashboard)
import type { MdaComplianceRow, MdaHeatmapRow, HeatmapCell } from '@vlprs/shared';
import { OYO_MDAS } from './oyoMdas';

export const MOCK_MDA_COMPLIANCE: MdaComplianceRow[] = OYO_MDAS.map((mda, i) => {
  const recordCount = 20 + ((i * 7 + 13) % 80);
  const status = i < 45 ? 'submitted' as const : i < 55 ? 'pending' as const : 'overdue' as const;
  const varianceCount = status === 'submitted' ? Math.floor(recordCount * 0.05) : 0;
  // Health score: deterministic spread from 30-95 based on index
  const healthScore = 30 + ((i * 11 + 5) % 65);
  const healthBand = healthScore >= 70 ? 'healthy' as const : healthScore >= 40 ? 'attention' as const : 'for-review' as const;
  // Dark MDAs: indices 58, 60, 62 (3 MDAs with no submissions in 6+ months)
  const isDark = i === 58 || i === 60 || i === 62;
  const stalenessMonths = isDark ? 6 + (i % 4) : status === 'submitted' ? null : (i % 3 === 0 ? 2 + (i % 5) : null);
  return {
    mdaId: mda.mdaId,
    mdaCode: mda.mdaCode,
    mdaName: mda.mdaName,
    status,
    lastSubmission: status === 'submitted' ? '2026-02-15T09:30:00Z' : null,
    recordCount,
    alignedCount: recordCount - varianceCount,
    varianceCount,
    healthScore,
    healthBand,
    submissionCoveragePercent: status === 'submitted' ? 75 + (i % 25) : null,
    isDark,
    stalenessMonths,
  };
});

// Mock heatmap data: 12 months × 63 MDAs with realistic distribution
function generateMonthKeys(): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}

export const MOCK_MDA_HEATMAP: MdaHeatmapRow[] = OYO_MDAS.map((mda, i) => {
  const monthKeys = generateMonthKeys();
  const cells: HeatmapCell[] = monthKeys.map((month, m) => {
    const isCurrentMonth = m === monthKeys.length - 1;
    if (isCurrentMonth) {
      return { month, status: 'current-pending' as const };
    }
    // Deterministic: mostly on-time, some grace-period, a few missing
    const hash = (i * 13 + m * 7) % 20;
    if (hash < 14) return { month, status: 'on-time' as const };
    if (hash < 18) return { month, status: 'grace-period' as const };
    return { month, status: 'missing' as const };
  });

  const onTimeCount = cells.filter((c) => c.status === 'on-time').length;
  const totalMonths = cells.filter((c) => c.status !== 'current-pending').length;
  const complianceRate = totalMonths > 0 ? Math.round((onTimeCount / totalMonths) * 100) : 0;

  return {
    mdaId: mda.mdaId,
    mdaName: mda.mdaName,
    mdaCode: mda.mdaCode,
    complianceRate,
    cells,
  };
});
