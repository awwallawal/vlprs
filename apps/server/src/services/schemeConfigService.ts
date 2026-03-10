import { db } from '../db';
import { schemeConfig } from '../db/schema';
import { eq } from 'drizzle-orm';

/**
 * Get a scheme configuration value by key.
 * Returns null if key doesn't exist or value is null.
 */
export async function getSchemeConfig(key: string): Promise<string | null> {
  const [result] = await db
    .select({ value: schemeConfig.value })
    .from(schemeConfig)
    .where(eq(schemeConfig.key, key));

  return result?.value ?? null;
}

/**
 * Set a scheme configuration value.
 * Atomic upsert: inserts if key doesn't exist, updates if it does.
 * Uses onConflictDoUpdate to avoid TOCTOU race conditions.
 */
export async function setSchemeConfig(
  key: string,
  value: string,
  updatedBy: string,
): Promise<void> {
  await db
    .insert(schemeConfig)
    .values({ key, value, updatedBy })
    .onConflictDoUpdate({
      target: schemeConfig.key,
      set: { value, updatedBy, updatedAt: new Date() },
    });
}
