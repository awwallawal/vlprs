import { createHash } from 'node:crypto';

/**
 * Recursively sorts all object keys for deterministic serialization.
 * Arrays are preserved in order; primitives returned as-is.
 */
function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return Object.keys(obj)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortKeysDeep(obj[key]);
        return acc;
      }, {});
  }
  return value;
}

/**
 * Computes a SHA-256 hex digest of the given request body.
 * Uses recursively sorted keys for deterministic output regardless of property order at any depth.
 * Returns null for empty/undefined/null bodies.
 */
export function hashBody(body: unknown): string | null {
  if (body === undefined || body === null) return null;
  if (typeof body === 'object' && Object.keys(body as object).length === 0) return null;

  const serialized = JSON.stringify(sortKeysDeep(body));

  return createHash('sha256')
    .update(serialized, 'utf8')
    .digest('hex');
}
