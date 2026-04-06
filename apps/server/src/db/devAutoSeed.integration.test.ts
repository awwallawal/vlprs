/**
 * Story 15.0d: devAutoSeed Integration Test
 *
 * Validates that devAutoSeed:
 *   1. Seeds 6 admin users when no loginable users exist
 *   2. Is idempotent (no duplicates on second run)
 *   3. Does NOT seed loans or scheme_config
 *   4. Assigns MDA IDs to officer accounts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { db } from './index';
import { users, loans, schemeConfig } from './schema';
import { seedReferenceMdas } from './seedReferenceMdas';
import { devAutoSeed } from './devAutoSeed';
import { resetDb } from '../test/resetDb';

describe('devAutoSeed', () => {
  beforeAll(async () => {
    await resetDb();
    await seedReferenceMdas();
  });

  afterAll(async () => {
    await resetDb();
  });

  it('seeds 6 admin users when no loginable users exist', async () => {
    await devAutoSeed();

    const activeUsers = await db
      .select({ email: users.email, role: users.role })
      .from(users)
      .where(eq(users.isActive, true));

    expect(activeUsers.length).toBe(6);
    expect(activeUsers.map((u) => u.email).sort()).toEqual([
      'admin@vlprs.oyo.gov.ng',
      'ag@vlprs.oyo.gov.ng',
      'bir.officer@oyo.gov.ng',
      'deputy.ag@vlprs.oyo.gov.ng',
      'education.officer@vlprs.oyo.gov.ng',
      'health.officer@vlprs.oyo.gov.ng',
    ]);
  });

  it('is idempotent — no duplicates on second run', async () => {
    await devAutoSeed();

    const activeUsers = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.isActive, true));

    expect(activeUsers.length).toBe(6);
  });

  it('does not seed loans or scheme_config', async () => {
    const loanRows = await db.select({ id: loans.id }).from(loans);
    expect(loanRows.length).toBe(0);

    const configRows = await db.select({ key: schemeConfig.key }).from(schemeConfig);
    expect(configRows.length).toBe(0);
  });

  it('assigns MDA IDs to officer accounts', async () => {
    const officers = await db
      .select({ email: users.email, mdaId: users.mdaId })
      .from(users)
      .where(eq(users.role, 'mda_officer'));

    expect(officers.length).toBe(3);
    for (const officer of officers) {
      expect(officer.mdaId).not.toBeNull();
    }
  });
});
