import { eq, and, isNull, ilike, sql } from 'drizzle-orm';
import { db } from '../db/index';
import { mdas, mdaAliases } from '../db/schema';
import { AppError } from '../lib/appError';
import { withMdaScope } from '../lib/mdaScope';
import { VOCABULARY } from '@vlprs/shared';
import type { MdaListItem } from '@vlprs/shared';

// ─── Types ───────────────────────────────────────────────────────────

interface ListMdasFilters {
  isActive?: boolean;
  search?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────

/** Escape LIKE-pattern wildcards so user input is treated as literal text. */
function escapeLike(input: string): string {
  return input.replace(/[%_\\]/g, '\\$&');
}

// ─── Service Functions ──────────────────────────────────────────────

export async function listMdas(
  filters?: ListMdasFilters,
  mdaScope?: string | null,
): Promise<MdaListItem[]> {
  const conditions = [
    isNull(mdas.deletedAt),
    withMdaScope(mdas.id, mdaScope),
  ];

  if (filters?.isActive !== undefined) {
    conditions.push(eq(mdas.isActive, filters.isActive));
  } else {
    // Default: only active MDAs
    conditions.push(eq(mdas.isActive, true));
  }

  if (filters?.search) {
    conditions.push(
      ilike(mdas.name, `%${escapeLike(filters.search)}%`),
    );
  }

  const rows = await db
    .select({
      id: mdas.id,
      code: mdas.code,
      name: mdas.name,
      abbreviation: mdas.abbreviation,
      isActive: mdas.isActive,
    })
    .from(mdas)
    .where(and(...conditions))
    .orderBy(mdas.name);

  return rows;
}

export async function getMdaById(id: string): Promise<MdaListItem> {
  const [row] = await db
    .select({
      id: mdas.id,
      code: mdas.code,
      name: mdas.name,
      abbreviation: mdas.abbreviation,
      isActive: mdas.isActive,
    })
    .from(mdas)
    .where(and(eq(mdas.id, id), isNull(mdas.deletedAt)));

  if (!row) {
    throw new AppError(404, 'MDA_NOT_FOUND', VOCABULARY.MDA_NOT_FOUND);
  }

  return row;
}

/**
 * 4-Layer MDA alias matching algorithm.
 * Layer 1: Exact code match
 * Layer 2: Normalised name match (strip "Oyo State" / "Ministry of" prefixes)
 * Layer 3: Alias table lookup
 * Layer 4: Return null (fuzzy suggestion — UI concern for future stories)
 */
export async function resolveMdaByName(input: string): Promise<MdaListItem | null> {
  // Layer 1: Exact code match
  const [byCode] = await db
    .select({
      id: mdas.id,
      code: mdas.code,
      name: mdas.name,
      abbreviation: mdas.abbreviation,
      isActive: mdas.isActive,
    })
    .from(mdas)
    .where(and(eq(mdas.code, input.toUpperCase()), isNull(mdas.deletedAt)));

  if (byCode) return byCode;

  // Layer 2: Normalised name match
  const normalised = input
    .toLowerCase()
    .replace(/^oyo state\s*/i, '')
    .replace(/^ministry of\s*/i, '')
    .trim();

  const byName = await db
    .select({
      id: mdas.id,
      code: mdas.code,
      name: mdas.name,
      abbreviation: mdas.abbreviation,
      isActive: mdas.isActive,
    })
    .from(mdas)
    .where(and(
      ilike(mdas.name, `%${escapeLike(normalised)}%`),
      isNull(mdas.deletedAt),
    ));

  if (byName.length === 1) return byName[0];

  // Layer 3: Alias table lookup
  const [byAlias] = await db
    .select({
      id: mdas.id,
      code: mdas.code,
      name: mdas.name,
      abbreviation: mdas.abbreviation,
      isActive: mdas.isActive,
    })
    .from(mdas)
    .innerJoin(mdaAliases, eq(mdas.id, mdaAliases.mdaId))
    .where(eq(sql`LOWER(${mdaAliases.alias})`, input.toLowerCase()));

  if (byAlias) return byAlias;

  // Layer 4: Fuzzy suggestion — return null (UI concern)
  return null;
}
