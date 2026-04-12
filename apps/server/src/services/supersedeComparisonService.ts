/**
 * supersedeComparisonService — Read-only record-level diff between two uploads.
 *
 * Story 15.0n: Shows admins what actually changes before they commit a
 * supersede. Counts unchanged/modified/new/removed records and surfaces
 * field-level diffs for modified records so the data replacement is
 * informed, not blind.
 *
 * The comparison is read-only — it does NOT modify any data. Actual
 * supersession still flows through supersedeService.supersedeUpload().
 *
 * Matching strategy (same as cross-MDA dedup + within-file dedup):
 *   Primary: normalizeName(staffName) — honorific-stripped, whitespace-normalized
 *   Secondary: employeeNo (exact) — tiebreaker for identical-name collisions
 */

import { and, eq, isNull, inArray } from 'drizzle-orm';
import { db } from '../db/index';
import { migrationUploads, migrationRecords } from '../db/schema';
import { withMdaScope } from '../lib/mdaScope';
import { normalizeName } from '../migration/nameMatch';
import { AppError } from '../lib/appError';
import type {
  SupersedeComparisonResult,
  ModifiedRecordDiff,
  FieldChange,
} from '@vlprs/shared';

/**
 * Narrow projection for comparison queries — only the columns needed for
 * matching and field-level diff.  Avoids selecting all ~30 columns.
 */
const COMPARISON_SELECT = {
  staffName: migrationRecords.staffName,
  employeeNo: migrationRecords.employeeNo,
  principal: migrationRecords.principal,
  totalLoan: migrationRecords.totalLoan,
  monthlyDeduction: migrationRecords.monthlyDeduction,
  outstandingBalance: migrationRecords.outstandingBalance,
  installmentCount: migrationRecords.installmentCount,
  installmentsPaid: migrationRecords.installmentsPaid,
  installmentsOutstanding: migrationRecords.installmentsOutstanding,
  gradeLevel: migrationRecords.gradeLevel,
} as const;

type RecordRow = {
  staffName: string;
  employeeNo: string | null;
  principal: string | null;
  totalLoan: string | null;
  monthlyDeduction: string | null;
  outstandingBalance: string | null;
  installmentCount: number | null;
  installmentsPaid: number | null;
  installmentsOutstanding: number | null;
  gradeLevel: string | null;
};

/**
 * Fields we compare between matched records. Structured + declarative so
 * it's easy to add/remove comparison fields without changing diff logic.
 *
 * Number-typed fields (installmentCount/installmentsPaid/installmentsOutstanding)
 * are stringified so FieldChange can stay string-based end-to-end.
 */
const COMPARISON_FIELDS = [
  'principal',
  'totalLoan',
  'monthlyDeduction',
  'outstandingBalance',
  'installmentCount',
  'installmentsPaid',
  'installmentsOutstanding',
  'gradeLevel',
] as const;

type ComparisonField = (typeof COMPARISON_FIELDS)[number];

function getField(record: RecordRow, field: ComparisonField): string | null {
  const raw = record[field];
  if (raw === null || raw === undefined) return null;
  return String(raw);
}

/**
 * Composite match key: normalized name + employeeNo (or '' when missing).
 * Two records from the same MDA with the same normalized name AND same
 * employeeNo are the same person; adding employeeNo breaks ties when two
 * different people share an identical normalized name.
 */
function matchKey(record: RecordRow): string {
  const nameKey = normalizeName(record.staffName);
  const empKey = record.employeeNo ?? '';
  return `${nameKey}|${empKey}`;
}

/**
 * Compare two uploads and return a record-level diff.
 *
 * Read-only: no data is modified.
 * MDA-scoped: MDA officers only see comparisons for their own uploads;
 * admins see all.
 */
export async function compareUploads(
  oldUploadId: string,
  newUploadId: string,
  mdaScope: string | null | undefined,
): Promise<SupersedeComparisonResult> {
  if (oldUploadId === newUploadId) {
    throw new AppError(
      400,
      'SELF_COMPARE',
      'An upload cannot be compared against itself.',
    );
  }

  // Verify both uploads exist and are within MDA scope. This prevents an
  // MDA officer from probing the diff of an upload outside their MDA.
  const uploadRows = await db
    .select({
      id: migrationUploads.id,
      mdaId: migrationUploads.mdaId,
    })
    .from(migrationUploads)
    .where(
      and(
        inArray(migrationUploads.id, [oldUploadId, newUploadId]),
        isNull(migrationUploads.deletedAt),
        withMdaScope(migrationUploads.mdaId, mdaScope),
      ),
    );

  const foundIds = new Set(uploadRows.map((u) => u.id));
  if (!foundIds.has(oldUploadId) || !foundIds.has(newUploadId)) {
    throw new AppError(
      404,
      'UPLOAD_NOT_FOUND',
      'One or both uploads could not be found for comparison.',
    );
  }

  // Load active (non-deleted) records for both uploads — narrow projection.
  const [oldRecords, newRecords] = await Promise.all([
    db
      .select(COMPARISON_SELECT)
      .from(migrationRecords)
      .where(
        and(
          eq(migrationRecords.uploadId, oldUploadId),
          isNull(migrationRecords.deletedAt),
        ),
      ),
    db
      .select(COMPARISON_SELECT)
      .from(migrationRecords)
      .where(
        and(
          eq(migrationRecords.uploadId, newUploadId),
          isNull(migrationRecords.deletedAt),
        ),
      ),
  ]);

  // Bucket records by composite match key. Duplicate keys within a single
  // upload collapse into a single representative — the first occurrence —
  // so duplicate-within-file cases don't distort the diff.
  const oldByKey = new Map<string, RecordRow>();
  for (const rec of oldRecords) {
    const key = matchKey(rec);
    if (!oldByKey.has(key)) oldByKey.set(key, rec);
  }

  const newByKey = new Map<string, RecordRow>();
  for (const rec of newRecords) {
    const key = matchKey(rec);
    if (!newByKey.has(key)) newByKey.set(key, rec);
  }

  let unchanged = 0;
  let modified = 0;
  const modifiedDetails: ModifiedRecordDiff[] = [];

  for (const [key, oldRec] of oldByKey) {
    const newRec = newByKey.get(key);
    if (!newRec) continue; // removed — counted below

    const changes: FieldChange[] = [];
    for (const field of COMPARISON_FIELDS) {
      const oldValue = getField(oldRec, field);
      const newValue = getField(newRec, field);
      if (oldValue !== newValue) {
        changes.push({ field, oldValue, newValue });
      }
    }

    if (changes.length === 0) {
      unchanged += 1;
    } else {
      modified += 1;
      modifiedDetails.push({
        staffName: newRec.staffName,
        staffId: newRec.employeeNo,
        changes,
      });
    }
  }

  // Collect removed and new record details for drill-down (review finding L1).
  const removedDetails: Array<{ staffName: string; staffId: string | null }> = [];
  for (const [key, oldRec] of oldByKey) {
    if (!newByKey.has(key)) {
      removedDetails.push({ staffName: oldRec.staffName, staffId: oldRec.employeeNo });
    }
  }

  const newDetailsList: Array<{ staffName: string; staffId: string | null }> = [];
  for (const [key, newRec] of newByKey) {
    if (!oldByKey.has(key)) {
      newDetailsList.push({ staffName: newRec.staffName, staffId: newRec.employeeNo });
    }
  }

  // Sort all detail arrays by name for deterministic output (stable UI + test).
  modifiedDetails.sort((a, b) => a.staffName.localeCompare(b.staffName));
  removedDetails.sort((a, b) => a.staffName.localeCompare(b.staffName));
  newDetailsList.sort((a, b) => a.staffName.localeCompare(b.staffName));

  return {
    unchanged,
    modified,
    newRecords: newDetailsList.length,
    removed: removedDetails.length,
    modifiedDetails,
    newDetails: newDetailsList,
    removedDetails,
  };
}
