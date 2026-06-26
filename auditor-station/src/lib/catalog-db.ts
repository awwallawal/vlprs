/**
 * catalog-db.ts — SQLite schema + access layer for the snapshotted catalog.
 *
 * The catalog DB is a frozen, read-only snapshot of the deduplicated car-loan corpus
 * (`catalog.json` from the SQ-1 engine), built by `scripts/build-catalog-db.ts`. The
 * station opens it READ-ONLY at runtime — the model and tools can never mutate it.
 */

import Database from "better-sqlite3";

/** Read-only-friendly alias for the better-sqlite3 Database instance type. */
type DB = Database.Database;

/** Bump when the table shape changes; the build records it in `meta`. */
export const SCHEMA_VERSION = 1;

/** Shape of a record as it appears in catalog.json (period nested, numerics nullable). */
export interface RawCatalogRecord {
  name: string;
  mda: string | null;
  mdaName: string | null;
  principal: number | null;
  totalLoan: number | null;
  interest: number | null;
  outstandingBalance: number | null;
  monthlyDeduction: number | null;
  installmentCount: number | null;
  installmentsPaid: number | null;
  installmentsRemaining: number | null;
  period: { year: number | null; month: number | null } | null;
  sourceFile: string | null;
  sheet: string | null;
  employeeNo: string | null;
  gradeLevel: string | null;
  bank: string | null;
  startDate: string | null;
  endDate: string | null;
  remarks: string | null;
}

/** Shape of catalog.json itself. */
export interface CatalogFile {
  generated: string;
  totalFiles: number;
  totalRecords: number;
  totalBeforeDedup: number;
  duplicatesRemoved: number;
  records: RawCatalogRecord[];
}

/** A row as stored in the DB (period flattened, name keys added). */
export interface CatalogRow {
  id: number;
  name: string;
  normalizedName: string;
  canonicalName: string;
  mda: string | null;
  mdaName: string | null;
  principal: number | null;
  totalLoan: number | null;
  interest: number | null;
  outstandingBalance: number | null;
  monthlyDeduction: number | null;
  installmentCount: number | null;
  installmentsPaid: number | null;
  installmentsRemaining: number | null;
  year: number | null;
  month: number | null;
  sourceFile: string | null;
  sheet: string | null;
  employeeNo: string | null;
  gradeLevel: string | null;
  bank: string | null;
  startDate: string | null;
  endDate: string | null;
  remarks: string | null;
}

/** Ordered column list — the single source of truth for the insert statement. */
export const RECORD_COLUMNS = [
  "name", "normalizedName", "canonicalName",
  "mda", "mdaName",
  "principal", "totalLoan", "interest", "outstandingBalance", "monthlyDeduction",
  "installmentCount", "installmentsPaid", "installmentsRemaining",
  "year", "month",
  "sourceFile", "sheet", "employeeNo", "gradeLevel", "bank",
  "startDate", "endDate", "remarks",
] as const;

/** DDL run by the build. Keep column order in sync with RECORD_COLUMNS. */
export const SCHEMA_SQL = `
CREATE TABLE records (
  id                    INTEGER PRIMARY KEY,
  name                  TEXT NOT NULL,
  normalizedName        TEXT NOT NULL,
  canonicalName         TEXT NOT NULL,
  mda                   TEXT,
  mdaName               TEXT,
  principal             REAL,
  totalLoan             REAL,
  interest              REAL,
  outstandingBalance    REAL,
  monthlyDeduction      REAL,
  installmentCount      INTEGER,
  installmentsPaid      INTEGER,
  installmentsRemaining INTEGER,
  year                  INTEGER,
  month                 INTEGER,
  sourceFile            TEXT,
  sheet                 TEXT,
  employeeNo            TEXT,
  gradeLevel            TEXT,
  bank                  TEXT,
  startDate             TEXT,
  endDate               TEXT,
  remarks               TEXT
);

CREATE INDEX idx_records_normalizedName ON records (normalizedName);
CREATE INDEX idx_records_canonicalName  ON records (canonicalName);
CREATE INDEX idx_records_mda            ON records (mda);
CREATE INDEX idx_records_year_month     ON records (year, month);
CREATE INDEX idx_records_outstanding    ON records (outstandingBalance);

CREATE TABLE meta (
  key   TEXT PRIMARY KEY,
  value TEXT
);
`;

/** Provenance + integrity facts written to the `meta` table at build time. */
export interface CatalogMeta {
  catalogSha256: string;
  builtAt: string;
  recordCount: number;
  schemaVersion: number;
  sourceFile: string;
  sourceGenerated: string;
  totalFiles: number;
  duplicatesRemoved: number;
}

/**
 * Open the catalog DB **read-only**. This is the only open path the runtime/tools use —
 * any attempt to write throws (SQLITE_READONLY). The file must already exist.
 */
export function openCatalogReadonly(path: string): DB {
  return new Database(path, { readonly: true, fileMustExist: true });
}

/** Read all meta rows into a typed object. */
export function readMeta(db: DB): Partial<CatalogMeta> {
  const rows = db.prepare("SELECT key, value FROM meta").all() as { key: string; value: string }[];
  const out: Record<string, string | number> = {};
  for (const { key, value } of rows) {
    out[key] = /^\d+$/.test(value) ? Number(value) : value;
  }
  return out as unknown as Partial<CatalogMeta>;
}

export type { DB };
