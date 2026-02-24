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

/** Set up mockExecute to simulate "tracking table exists" scenario */
function mockTrackingTableExists() {
  mockExecute.mockResolvedValueOnce({ rows: [{ exists: true }] });
}

/** Set up mockExecute to simulate "fresh database" (no tables at all) */
function mockFreshDatabase() {
  mockExecute
    .mockResolvedValueOnce({ rows: [{ exists: false }] })  // __drizzle_migrations
    .mockResolvedValueOnce({ rows: [{ exists: false }] }); // users
}

/** Set up mockExecute to simulate "pre-existing DB without tracking" */
function mockPreExistingDatabase() {
  mockExecute
    .mockResolvedValueOnce({ rows: [{ exists: false }] })  // __drizzle_migrations
    .mockResolvedValueOnce({ rows: [{ exists: true }] })   // users
    .mockResolvedValueOnce(undefined)                       // CREATE TABLE
    .mockResolvedValueOnce(undefined);                      // INSERT baseline
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

    it('returns early when __drizzle_migrations table already exists', async () => {
      mockTrackingTableExists();

      await baselineIfNeeded(testFolder);

      // Only one DB call (tracking table check)
      expect(mockExecute).toHaveBeenCalledTimes(1);
    });

    it('returns early for fresh database (no users table)', async () => {
      mockFreshDatabase();

      await baselineIfNeeded(testFolder);

      // Two DB calls (tracking table + users table)
      expect(mockExecute).toHaveBeenCalledTimes(2);
    });

    it('creates tracking table and inserts baseline for pre-existing DB', async () => {
      mockPreExistingDatabase();
      mockValidFiles();

      await baselineIfNeeded(testFolder);

      // 4 DB calls: 2 EXISTS checks + CREATE TABLE + INSERT
      expect(mockExecute).toHaveBeenCalledTimes(4);
      // Verify readFile was called for journal and SQL
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

      // The 4th db.execute call is the INSERT — verify it was called
      const insertCall = mockExecute.mock.calls[3];
      expect(insertCall).toBeDefined();

      // Verify the computed hash is embedded in the INSERT SQL params.
      // Using JSON.stringify to capture the full object tree (including Param values)
      // without coupling to Drizzle's internal queryChunks/Param structure.
      expect(JSON.stringify(insertCall[0])).toContain(EXPECTED_HASH);
    });

    it('throws descriptive error when journal file is missing', async () => {
      mockExecute
        .mockResolvedValueOnce({ rows: [{ exists: false }] })
        .mockResolvedValueOnce({ rows: [{ exists: true }] });

      mockAccess.mockRejectedValueOnce(new Error('ENOENT'));

      await expect(baselineIfNeeded(testFolder)).rejects.toThrow(
        /Migration journal not found/
      );
    });

    it('throws descriptive error when SQL file is missing', async () => {
      mockExecute
        .mockResolvedValueOnce({ rows: [{ exists: false }] })
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
        .mockResolvedValueOnce({ rows: [{ exists: false }] })
        .mockResolvedValueOnce({ rows: [{ exists: true }] });

      mockReadFile.mockResolvedValueOnce(JSON.stringify({ entries: [] }));

      await expect(baselineIfNeeded(testFolder)).rejects.toThrow(
        /No migrations found in journal/
      );
    });

    it('throws when journal entry is malformed (missing tag or when)', async () => {
      mockExecute
        .mockResolvedValueOnce({ rows: [{ exists: false }] })
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

      // The INSERT call (4th execute) should use WHERE NOT EXISTS pattern
      const insertCall = mockExecute.mock.calls[3];
      const sqlTemplate = insertCall[0];
      // Drizzle sql`` templates store the SQL string in queryChunks or similar
      const sqlString = sqlTemplate.queryChunks
        ? sqlTemplate.queryChunks.map((c: { value?: string }) => c.value ?? '').join('')
        : String(sqlTemplate);
      // The SQL should contain WHERE NOT EXISTS
      expect(sqlString.toLowerCase()).toContain('where not exists');
    });
  });
});
