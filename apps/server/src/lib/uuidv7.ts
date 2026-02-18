/**
 * UUIDv7 generator — time-sortable, no sequential ID leakage.
 * Used for all primary keys across the VLPRS system.
 *
 * Format: xxxxxxxx-xxxx-7xxx-yxxx-xxxxxxxxxxxx
 * - First 48 bits: Unix timestamp in milliseconds
 * - Version nibble: 7
 * - 12 bits: random
 * - Variant bits: 10
 * - 62 bits: random
 */
export function generateUuidv7(): string {
  const timestamp = Date.now();

  const timeBits = timestamp.toString(16).padStart(12, '0');

  const randomBytes = new Uint8Array(10);
  crypto.getRandomValues(randomBytes);

  const hex = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return [
    timeBits.slice(0, 8),
    timeBits.slice(8, 12),
    '7' + hex.slice(0, 3),
    ((parseInt(hex.slice(3, 5), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0') + hex.slice(5, 7),
    hex.slice(7, 19),
  ].join('-');
}
