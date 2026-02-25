/**
 * Safely extract a single param string.
 * Express 5 route params can be string | string[].
 */
export function param(val: string | string[]): string {
  return Array.isArray(val) ? val[0] : val;
}
