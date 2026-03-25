import { eq } from 'drizzle-orm';
import { db } from './index';
import { mdas, mdaAliases } from './schema';
import { generateUuidv7 } from '../lib/uuidv7';
import { MDA_LIST, MDA_ALIASES } from '@vlprs/shared';
import { logger } from '../lib/logger';

/**
 * Seeds MDA reference data (all environments — dev, test, production).
 *
 * MDAs are reference data, not demo data. This runs on every server startup
 * AFTER migrations, BEFORE dev auto-seed. Idempotent via ON CONFLICT DO NOTHING.
 */
export async function seedReferenceMdas(): Promise<void> {
  let mdaCount = 0;

  await db.transaction(async (tx) => {
    // 1. Seed all MDAs (idempotent via onConflictDoNothing on code)
    for (const mda of MDA_LIST) {
      const [record] = await tx
        .insert(mdas)
        .values({
          id: generateUuidv7(),
          name: mda.name,
          code: mda.code,
          abbreviation: mda.abbreviation,
        })
        .onConflictDoNothing({ target: mdas.code })
        .returning();
      if (record) mdaCount++;
    }

    // 2. Lookup all MDA IDs for alias seeding + parent relationship
    const allMdaRows = await tx.select().from(mdas);
    const mdaMap = new Map<string, string>();
    for (const m of allMdaRows) {
      mdaMap.set(m.code, m.id);
    }

    // 3. Seed MDA aliases (old codes → new canonical MDAs)
    for (const { oldCode, newCode } of MDA_ALIASES) {
      const mdaId = mdaMap.get(newCode);
      if (!mdaId) continue;
      await tx
        .insert(mdaAliases)
        .values({ id: generateUuidv7(), mdaId, alias: oldCode })
        .onConflictDoNothing();
    }

    // 3b. Seed CDU legacy naming variants (SQ-1 observed aliases)
    const cduMdaId = mdaMap.get('CDU');
    if (cduMdaId) {
      const cduAliases = ['COCOA DEVELOPMENT UNIT', 'OYO STATE COCOA DEVELOPMENT UNIT', 'COCOA', 'TCDU'];
      for (const alias of cduAliases) {
        await tx
          .insert(mdaAliases)
          .values({ id: generateUuidv7(), mdaId: cduMdaId, alias })
          .onConflictDoNothing();
      }
    }

    // 3c. Set CDU parent relationship (CDU is a sub-agency of Agriculture)
    const agricultureMdaId = mdaMap.get('AGRICULTURE');
    if (cduMdaId && agricultureMdaId) {
      await tx
        .update(mdas)
        .set({ parentMdaId: agricultureMdaId })
        .where(eq(mdas.id, cduMdaId));
    }
  });

  if (mdaCount > 0) {
    logger.info(`seedReferenceMdas: seeded ${mdaCount} new MDAs`);
  }
}
