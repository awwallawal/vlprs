// Target: GET /api/migration/status
// Wire: Sprint 4 (Epic 3: Data Migration)
import type { MigrationMdaStatus, MigrationStage } from '@vlprs/shared';
import { OYO_MDAS } from './oyoMdas';

// Distribution per spec: 7 Pending, 10 Received, 20 Imported, 15 Validated, 3 Reconciled, 8 Certified = 63
const STAGE_DISTRIBUTION: MigrationStage[] = [
  ...Array<MigrationStage>(7).fill('pending'),
  ...Array<MigrationStage>(10).fill('received'),
  ...Array<MigrationStage>(20).fill('imported'),
  ...Array<MigrationStage>(15).fill('validated'),
  ...Array<MigrationStage>(3).fill('reconciled'),
  ...Array<MigrationStage>(8).fill('certified'),
];

export const MOCK_MIGRATION_STATUS: MigrationMdaStatus[] = OYO_MDAS.map((mda, i) => {
  const stage = STAGE_DISTRIBUTION[i];
  const clean = 20 + ((i * 11 + 7) % 60);
  const minor = Math.floor(clean * 0.08);
  const significant = Math.floor(clean * 0.03);
  const structural = Math.floor(clean * 0.01);
  return {
    mdaId: mda.mdaId,
    mdaName: mda.mdaName,
    mdaCode: mda.mdaCode,
    stage,
    recordCounts: { clean, minor, significant, structural },
    lastActivity: stage !== 'pending' ? '2026-02-10T12:00:00Z' : null,
  };
});
