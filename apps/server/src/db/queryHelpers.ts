import { and, eq, isNull, or } from 'drizzle-orm';
import { migrationRecords } from './schema';

/**
 * Filters migration_records to active (non-superseded) records.
 * Handles NULL status for backward compat with pre-7.0g records.
 *
 * Use this wherever you filter migration_records to exclude superseded ones.
 * Equivalent to: `deleted_at IS NULL AND (status IS NULL OR status = 'active')`
 */
export function isActiveRecord() {
  return and(
    isNull(migrationRecords.deletedAt),
    or(isNull(migrationRecords.recordStatus), eq(migrationRecords.recordStatus, 'active')),
  );
}
