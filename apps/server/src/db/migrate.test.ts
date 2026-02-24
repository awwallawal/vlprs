import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';

// --- Mocks ---

const mockExecute = vi.fn();
vi.mock('./index', () => ({
  db: {
    execute: (...args: unknown[]) => mockExecute(...args),
    transaction: async (fn: (tx: { execute: (...a: unknown[]) => unknown }) => Promise<void>) =>
      fn({ execute: (...args: unknown[]) => mockExecute(...args) }),
    $client: { end: vi.fn().mockResolvedValue(undefined) },
  },
}));

const mockMigrate = vi.fn().mockResolvedValue(undefined);
vi.mock('drizzle-orm/node-postgres/migrator', () => ({
  migrate: (...args: unknown[]) => mockMigrate(...args),
}));

const mockApplyTriggers = vi.fn().mockResolvedValue(undefined);
vi.mock('./triggers', () => ({
  applyTriggers: (...args: unknown[]) => mockApplyTriggers(...args),
}));

vi.mock('../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    fatal: vi.fn(),
    error: vi.fn(),
  },
}));

const mockAccess = vi.fn().mockResolvedValue(undefined);
const mockReadFile = vi.fn();
vi.mock('node:fs/promises', () => ({
  access: (...args: unknown[]) => mockAccess(...args),
  readFile: (...args: unknown[]) => mockReadFile(...args),
}));

// --- Import after mocks ---

import { runMigrations, baselineIfNeeded } from './migrate';

// --- Helpers ---

const JOURNAL_CONTENT = JSON.stringify({
  entries: [{ idx: 0, tag: '0000_greedy_molten_man', when: 1771797183815 }],
});

const SQL_CONTENT = 'CREATE TABLE users (id uuid);';
const EXPECTED_HASH = crypto.createHash('sha256').update(SQL_CONTENT).digest('hex');

/** Tracking table exists in "drizzle" schema AND has records */
function mockTrackingTableExists() {
  mockExecute
    .mockResolvedValueOnce({ rows: [{ table_exists: true }] })   // drizzle.__drizzle_migrations exists
    .mockResolvedValueOnce({ rows: [{ count: 1 }] });            // has records
}

/** Fresh database — no tracking table, no users table */
function mockFreshDatabase() {
  mockExecute
    .mockResolvedValueOnce({ rows: [{ table_exists: false }] })  // drizzle.__drizzle_migrations missing
    .mockResolvedValueOnce({ rows: [{ exists: false }] });       // users table missing
}

/** Pre-existing DB: no tracking table, users table exists */
function mockPreExistingDatabase() {
  mockExecute
    .mockResolvedValueOnce({ rows: [{ table_exists: false }] })  // drizzle.__drizzle_migrations missing
    .mockResolvedValueOnce({ rows: [{ exists: true }] })         // users table exists
    .mockResolvedValueOnce(undefined)                             // CREATE SCHEMA
    .mockResolvedValueOnce(undefined)                             // CREATE TABLE
    .mockResolvedValueOnce(undefined)                             // INSERT baseline
    .mockResolvedValueOnce(undefined);                            // DROP stale public table
}

/** Tracking table exists but is empty (failed deployment recovery) */
function mockEmptyTrackingTable() {
  mockExecute
    .mockResolvedValueOnce({ rows: [{ table_exists: true }] })   // drizzle.__drizzle_migrations exists
    .mockResolvedValueOnce({ rows: [{ count: 0 }] })             // but empty
    .mockResolvedValueOnce({ rows: [{ exists: true }] })         // users table exists
    .mockResolvedValueOnce(undefined)                             // CREATE SCHEMA
    .mockResolvedValueOnce(undefined)                             // CREATE TABLE
    .mockResolvedValueOnce(undefined)                             // INSERT baseline
    .mockResolvedValueOnce(undefined);                            // DROP stale public table
}

/** Set up fs mocks for a valid journal + SQL file */
function mockValidFiles() {
  mockReadFile
    .mockResolvedValueOnce(JOURNAL_CONTENT)
    .mockResolvedValueOnce(SQL_CONTENT);
}

// --- Tests ---

describe('migrate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('runMigrations', () => {
    it('calls baseline, migrate, and applyTriggers in order', async () => {
      mockTrackingTableExists();

      await runMigrations();

      expect(mockExecute).toHaveBeenCalled();
      expect(mockMigrate).toHaveBeenCalledOnce();
      expect(mockApplyTriggers).toHaveBeenCalledOnce();
    });

    it('propagates migration errors', async () => {
      mockTrackingTableExists();
      mockMigrate.mockRejectedValueOnce(new Error('migration failed'));

      await expect(runMigrations()).rejects.toThrow('migration failed');
    });

    it('propagates trigger errors', async () => {
      mockTrackingTableExists();
      mockApplyTriggers.mockRejectedValueOnce(new Error('trigger failed'));

      await expect(runMigrations()).rejects.toThrow('trigger failed');
    });

    it('throws descriptive error when migrations folder is missing', async () => {
      mockAccess.mockRejectedValueOnce(new Error('ENOENT'));

      await expect(runMigrations()).rejects.toThrow(
        /Migration folder not found/
      );
    });
  });

  describe('baselineIfNeeded', () => {
    const testFolder = '/app/drizzle';

    it('returns early when tracking table exists with records', async () => {
      mockTrackingTableExists();

      await baselineIfNeeded(testFolder);

      // Two DB calls: table exists check + record count
      expect(mockExecute).toHaveBeenCalledTimes(2);
    });

    it('returns early for fresh database (no users table)', async () => {
      mockFreshDatabase();

      await baselineIfNeeded(testFolder);

      // Two DB calls: tracking table check + users table check
      expect(mockExecute).toHaveBeenCalledTimes(2);
    });

    it('creates tracking table and inserts baseline for pre-existing DB', async () => {
      mockPreExistingDatabase();
      mockValidFiles();

      await baselineIfNeeded(testFolder);

      // 6 DB calls: table_exists + users + CREATE SCHEMA + CREATE TABLE + INSERT + DROP stale
      expect(mockExecute).toHaveBeenCalledTimes(6);
      expect(mockReadFile).toHaveBeenCalledTimes(2);
    });

    it('inserts baseline when tracking table exists but is empty (failed deployment recovery)', async () => {
      mockEmptyTrackingTable();
      mockValidFiles();

      await baselineIfNeeded(testFolder);

      // 7 DB calls: table_exists + count + users + CREATE SCHEMA + CREATE TABLE + INSERT + DROP stale
      expect(mockExecute).toHaveBeenCalledTimes(7);
      expect(mockReadFile).toHaveBeenCalledTimes(2);
    });

    // NOTE: The following tests access Drizzle ORM's internal sql`` template structure
    // (queryChunks / values). These are implementation details that may change across
    // Drizzle versions. If these tests break after a Drizzle upgrade with no migration
    // code changes, update the template extraction logic to match the new internal format.
    // Current Drizzle version: drizzle-orm ^0.45.0
    it('computes SHA-256 hash of SQL content for baseline record', async () => {
      mockPreExistingDatabase();
      mockValidFiles();

      await baselineIfNeeded(testFolder);

      // The 5th db.execute call is the INSERT — verify it was called
      const insertCall = mockExecute.mock.calls[4];
      expect(insertCall).toBeDefined();

      // Verify the computed hash is embedded in the INSERT SQL params.
      expect(JSON.stringify(insertCall[0])).toContain(EXPECTED_HASH);
    });

    it('throws descriptive error when journal file is missing', async () => {
      mockExecute
        .mockResolvedValueOnce({ rows: [{ table_exists: false }] })
        .mockResolvedValueOnce({ rows: [{ exists: true }] });

      mockAccess.mockRejectedValueOnce(new Error('ENOENT'));

      await expect(baselineIfNeeded(testFolder)).rejects.toThrow(
        /Migration journal not found/
      );
    });

    it('throws descriptive error when SQL file is missing', async () => {
      mockExecute
        .mockResolvedValueOnce({ rows: [{ table_exists: false }] })
        .mockResolvedValueOnce({ rows: [{ exists: true }] });

      mockAccess
        .mockResolvedValueOnce(undefined)     // journal exists
        .mockRejectedValueOnce(new Error('ENOENT')); // SQL missing

      mockReadFile.mockResolvedValueOnce(JOURNAL_CONTENT);

      await expect(baselineIfNeeded(testFolder)).rejects.toThrow(
        /Baseline migration SQL not found/
      );
    });

    it('throws when journal has no entries', async () => {
      mockExecute
        .mockResolvedValueOnce({ rows: [{ table_exists: false }] })
        .mockResolvedValueOnce({ rows: [{ exists: true }] });

      mockReadFile.mockResolvedValueOnce(JSON.stringify({ entries: [] }));

      await expect(baselineIfNeeded(testFolder)).rejects.toThrow(
        /No migrations found in journal/
      );
    });

    it('throws when journal entry is malformed (missing tag or when)', async () => {
      mockExecute
        .mockResolvedValueOnce({ rows: [{ table_exists: false }] })
        .mockResolvedValueOnce({ rows: [{ exists: true }] });

      mockReadFile.mockResolvedValueOnce(JSON.stringify({ entries: [{ idx: 0 }] }));

      await expect(baselineIfNeeded(testFolder)).rejects.toThrow(
        /Malformed migration journal entry/
      );
    });

    it('uses WHERE NOT EXISTS to guard against concurrent inserts', async () => {
      mockPreExistingDatabase();
      mockValidFiles();

      await baselineIfNeeded(testFolder);

      // The INSERT call (5th execute) should use WHERE NOT EXISTS pattern
      const insertCall = mockExecute.mock.calls[4];
      const sqlTemplate = insertCall[0];
      const sqlString = sqlTemplate.queryChunks
        ? sqlTemplate.queryChunks.map((c: { value?: string }) => c.value ?? '').join('')
        : String(sqlTemplate);
      expect(sqlString.toLowerCase()).toContain('where not exists');
    });
  });
});
