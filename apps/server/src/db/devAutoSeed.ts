import { db } from './index';
import { users } from './schema';
import { sql } from 'drizzle-orm';
import { logger } from '../lib/logger';

/**
 * Auto-seeds the dev database when the users table is empty.
 *
 * Runs ONLY in development mode. Ensures `pnpm dev` always results in a
 * working login without needing a manual `pnpm seed:demo` step.
 *
 * Migrations guarantee tables exist before this function runs.
 */
export async function devAutoSeed(): Promise<void> {
  try {
    const result = await db.select({ count: sql<number>`count(*)` }).from(users);
    const userCount = Number(result[0]?.count ?? 0);

    if (userCount === 0) {
      logger.info('devAutoSeed: users table is empty — seeding demo data...');
      const { runDemoSeed } = await import('./seed-demo');
      const { userCount: seeded, mdaCount } = await runDemoSeed();
      logger.info(`devAutoSeed: seeded ${seeded} users, ${mdaCount} MDAs`);
      logger.info('devAutoSeed: demo credentials — email: ag@vlprs.oyo.gov.ng, password: DemoPass1');
    }
  } catch (seedErr) {
    logger.error({ err: seedErr }, 'devAutoSeed: failed — if tables are missing, check that migrations ran successfully. Manual seed: pnpm --filter server seed:demo');
  }
}
