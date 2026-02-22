// Target: GET /api/dashboard/compliance
// Wire: Sprint 5 (Epic 4: Executive Dashboard)
import type { MdaComplianceRow } from '@vlprs/shared';
import { OYO_MDAS } from './oyoMdas';

export const MOCK_MDA_COMPLIANCE: MdaComplianceRow[] = OYO_MDAS.map((mda, i) => {
  const recordCount = 20 + ((i * 7 + 13) % 80);
  const status = i < 45 ? 'submitted' as const : i < 55 ? 'pending' as const : 'overdue' as const;
  const varianceCount = status === 'submitted' ? Math.floor(recordCount * 0.05) : 0;
  return {
    mdaId: mda.mdaId,
    mdaCode: mda.mdaCode,
    mdaName: mda.mdaName,
    status,
    lastSubmission: status === 'submitted' ? '2026-02-15T09:30:00Z' : null,
    recordCount,
    alignedCount: recordCount - varianceCount,
    varianceCount,
  };
});
