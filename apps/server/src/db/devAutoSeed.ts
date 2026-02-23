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
 * Also applies DB schema via drizzle-kit push if tables don't exist yet
 * (handles fresh Docker volumes after `docker compose down -v`).
 */
export async function devAutoSeed(): Promise<void> {
  // 1. Check if users table exists and has rows
  let tableExists = true;
  let userCount = 0;

  try {
    const result = await db.select({ count: sql<number>`count(*)` }).from(users);
    userCount = Number(result[0]?.count ?? 0);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // Table doesn't exist — need to push schema first
    if (msg.includes('does not exist') || msg.includes('relation')) {
      tableExists = false;
    } else {
      logger.error({ err: msg }, 'devAutoSeed: failed to check users table');
      return;
    }
  }

  // 2. Push schema if tables don't exist
  if (!tableExists) {
    logger.info('devAutoSeed: tables not found — pushing schema via drizzle-kit...');
    try {
      const { execSync } = await import('child_process');
      execSync('pnpm --filter server db:push', {
        stdio: 'inherit',
        cwd: process.cwd(),
      });
      logger.info('devAutoSeed: schema pushed successfully');
    } catch (pushErr) {
      logger.error({ err: pushErr }, 'devAutoSeed: schema push failed — run "pnpm --filter server db:push" manually');
      return;
    }
  }

  // 3. Seed if empty
  if (!tableExists || userCount === 0) {
    logger.info('devAutoSeed: users table is empty — seeding demo data...');
    try {
      const { runDemoSeed } = await import('./seed-demo');
      const { userCount: seeded, mdaCount } = await runDemoSeed();
      logger.info(`devAutoSeed: seeded ${seeded} users, ${mdaCount} MDAs`);
      logger.info('devAutoSeed: demo credentials — email: ag@vlprs.oyo.gov.ng, password: DemoPass1');
    } catch (seedErr) {
      logger.error({ err: seedErr }, 'devAutoSeed: seed failed — run "pnpm --filter server seed:demo" manually');
    }
  }
}
