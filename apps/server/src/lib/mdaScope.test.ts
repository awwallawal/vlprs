import { describe, it, expect } from 'vitest';
import { SQL } from 'drizzle-orm';
import { withMdaScope } from './mdaScope';
import { users } from '../db/schema';

describe('withMdaScope', () => {
  it('returns undefined when mdaScope is null (no filter)', () => {
    const result = withMdaScope(users.mdaId, null);
    expect(result).toBeUndefined();
  });

  it('returns undefined when mdaScope is undefined (no filter)', () => {
    const result = withMdaScope(users.mdaId, undefined);
    expect(result).toBeUndefined();
  });

  it('returns a SQL expression when mdaScope is a string', () => {
    const result = withMdaScope(users.mdaId, 'mda-123');
    expect(result).toBeInstanceOf(SQL);
    // Verify the SQL contains the mda-123 value in its query chunks
    const hasValue = result!.queryChunks.some(
      (chunk) => typeof chunk === 'object' && 'value' in chunk && chunk.value === 'mda-123',
    );
    expect(hasValue).toBe(true);
  });

  it('returns a SQL expression for empty string (does not treat as null)', () => {
    const result = withMdaScope(users.mdaId, '');
    expect(result).toBeInstanceOf(SQL);
  });
});
