import { useQuery } from '@tanstack/react-query';
import type { MigrationMdaStatus } from '@vlprs/shared';
import { MOCK_MIGRATION_STATUS } from '@/mocks/migrationStatus';

/**
 * Fetches migration status for all MDAs.
 * @target GET /api/migration/status
 * @wire Sprint 4 (Epic 3: Data Migration)
 */
export function useMigrationStatus() {
  return useQuery<MigrationMdaStatus[]>({
    queryKey: ['migration', 'status'],
    queryFn: async () => MOCK_MIGRATION_STATUS,
    staleTime: 30_000,
  });
}
