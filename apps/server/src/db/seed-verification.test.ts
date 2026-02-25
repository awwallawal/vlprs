import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sql } from 'drizzle-orm';
import { db } from './index';
import { mdas } from './schema';
import { runDemoSeed } from './seed-demo';

/**
 * Seed verification test (Task 8.5):
 * Verifies all 63 MDAs from the authoritative docs/mdas_list.txt
 * match the seed data actually persisted to the database.
 */

interface AuthoritativeEntry {
  name: string;
  code: string;
}

function parseAuthoritativeList(filePath: string): AuthoritativeEntry[] {
  const raw = readFileSync(filePath, 'utf-8');
  const entries: AuthoritativeEntry[] = [];

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Format: "1. Full Official Name - CODE"
    const match = trimmed.match(/^\d+\.\s+(.+?)\s+-\s+(.+?)\s*$/);
    if (match) {
      // Normalise known typos from source file (e.g., "FInance" → "Finance", "COrporation" → "Corporation")
      const name = match[1]
        .replace(/FInance/, 'Finance')
        .replace(/COrporation/, 'Corporation')
        .replace(/Ageency/, 'Agency');
      entries.push({ name, code: match[2].trim() });
    }
  }

  return entries;
}

describe('Seed verification: MDAs match authoritative list', () => {
  const authListPath = resolve(__dirname, '../../../../docs/mdas_list.txt');
  let authEntries: AuthoritativeEntry[];

  beforeAll(async () => {
    authEntries = parseAuthoritativeList(authListPath);
    await db.execute(sql`TRUNCATE audit_log, refresh_tokens, users, loans, mdas CASCADE`);
    await runDemoSeed();
  });

  afterAll(async () => {
    await db.execute(sql`TRUNCATE audit_log, refresh_tokens, users, loans, mdas CASCADE`);
  });

  it('authoritative list contains exactly 63 entries', () => {
    expect(authEntries.length).toBe(63);
  });

  it('seed produces exactly 63 MDAs in the database', async () => {
    const rows = await db.select({ code: mdas.code }).from(mdas);
    expect(rows.length).toBe(63);
  });

  it('every authoritative code exists in seeded data', async () => {
    const rows = await db.select({ code: mdas.code, name: mdas.name }).from(mdas);
    const seededCodes = new Set(rows.map((r) => r.code));

    const missing = authEntries.filter((entry) => !seededCodes.has(entry.code));
    expect(missing).toEqual([]);
  });

  it('every authoritative name matches seeded name', async () => {
    const rows = await db.select({ code: mdas.code, name: mdas.name }).from(mdas);
    const seededByCode = new Map(rows.map((r) => [r.code, r.name]));

    const mismatches: Array<{ code: string; expected: string; actual: string | undefined }> = [];
    for (const entry of authEntries) {
      const seededName = seededByCode.get(entry.code);
      if (seededName !== entry.name) {
        mismatches.push({ code: entry.code, expected: entry.name, actual: seededName });
      }
    }

    expect(mismatches).toEqual([]);
  });

  it('every seeded MDA has a non-empty abbreviation', async () => {
    const rows = await db
      .select({ code: mdas.code, abbreviation: mdas.abbreviation })
      .from(mdas);

    const emptyAbbreviations = rows.filter((r) => !r.abbreviation || r.abbreviation.trim() === '');
    expect(emptyAbbreviations).toEqual([]);
  });

  it('key MDA codes match expected abbreviations', async () => {
    const rows = await db
      .select({ code: mdas.code, abbreviation: mdas.abbreviation })
      .from(mdas);
    const byCode = new Map(rows.map((r) => [r.code, r.abbreviation]));

    // Official acronyms retained as-is
    expect(byCode.get('OYSHMB')).toBe('OYSHMB');
    expect(byCode.get('BCOS')).toBe('BCOS');
    expect(byCode.get('TESCOM')).toBe('TESCOM');
    expect(byCode.get('SUBEB')).toBe('SUBEB');
    expect(byCode.get('BIR')).toBe('BIR');

    // Descriptive Title Case
    expect(byCode.get('FINANCE')).toBe('Finance');
    expect(byCode.get('HEALTH')).toBe('Health');
    expect(byCode.get('EDUCATION')).toBe('Education');
    expect(byCode.get('SPORTS COUNCIL')).toBe('Sports Council');
  });
});
