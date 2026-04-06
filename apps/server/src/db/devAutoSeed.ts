import { db } from './index';
import { users, mdas } from './schema';
import { sql, eq } from 'drizzle-orm';
import { hashPassword } from '../lib/password';
import { generateUuidv7 } from '../lib/uuidv7';
import { logger } from '../lib/logger';

/**
 * Auto-seeds the dev database with admin user accounts ONLY when no loginable users exist.
 *
 * Runs ONLY in development mode. Ensures `pnpm dev` always results in a
 * working login without needing a manual `pnpm seed:demo` step.
 *
 * Story 15.0d: Separated from full demo seed to prevent fake financial data
 * from overwriting real uploads on Docker volume reset.
 *
 * For demo loans + scheme config, run `pnpm seed:demo` explicitly.
 *
 * The check uses `is_active = true` so the non-loginable system@vlprs.local
 * service account (seeded by seedReferenceMdas) does not suppress auto-seed.
 *
 * Precondition: seedReferenceMdas() must have run first (startup ordering in index.ts).
 */
export async function devAutoSeed(): Promise<void> {
  try {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.isActive, true));
    const loginableCount = Number(result[0]?.count ?? 0);

    if (loginableCount > 0) return;

    const password = process.env.DEMO_SEED_PASSWORD || 'DemoPass1';
    const hashed = await hashPassword(password);

    // Resolve MDA IDs for officer accounts (MDAs seeded by seedReferenceMdas on startup)
    const mdaRows = await db.select({ id: mdas.id, code: mdas.code }).from(mdas);
    const mdaMap = new Map(mdaRows.map(m => [m.code, m.id]));

    for (const code of ['HEALTH', 'EDUCATION', 'BIR']) {
      if (!mdaMap.has(code)) {
        logger.warn({ code }, 'devAutoSeed: MDA code not found — officer account will have no MDA assignment');
      }
    }

    const ADMIN_USERS = [
      { email: 'ag@vlprs.oyo.gov.ng', firstName: 'Accountant', lastName: 'General', role: 'super_admin' as const, mdaId: null },
      { email: 'deputy.ag@vlprs.oyo.gov.ng', firstName: 'Deputy', lastName: 'AG', role: 'super_admin' as const, mdaId: null },
      { email: 'admin@vlprs.oyo.gov.ng', firstName: 'Department', lastName: 'Admin', role: 'dept_admin' as const, mdaId: null },
      { email: 'health.officer@vlprs.oyo.gov.ng', firstName: 'Health', lastName: 'Officer', role: 'mda_officer' as const, mdaId: mdaMap.get('HEALTH') ?? null },
      { email: 'education.officer@vlprs.oyo.gov.ng', firstName: 'Education', lastName: 'Officer', role: 'mda_officer' as const, mdaId: mdaMap.get('EDUCATION') ?? null },
      { email: 'bir.officer@oyo.gov.ng', firstName: 'BIR', lastName: 'Officer', role: 'mda_officer' as const, mdaId: mdaMap.get('BIR') ?? null },
    ];

    let seeded = 0;
    for (const user of ADMIN_USERS) {
      const [record] = await db
        .insert(users)
        .values({
          id: generateUuidv7(),
          email: user.email,
          hashedPassword: hashed,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          mdaId: user.mdaId,
        })
        .onConflictDoNothing({ target: users.email })
        .returning();
      if (record) seeded++;
    }

    logger.info(`devAutoSeed: seeded ${seeded} admin users (no demo loans)`);
    logger.info(`devAutoSeed: credentials — AG: ag@vlprs.oyo.gov.ng, password: ${password}`);
  } catch (seedErr) {
    logger.error({ err: seedErr }, 'devAutoSeed: failed — if tables are missing, check that migrations ran successfully. Manual seed: pnpm --filter server seed:demo');
  }
}
