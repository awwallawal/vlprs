/**
 * server/auth.ts — optional local-auth (PIN) gate (SQ2-5).
 *
 * Minimal by design: a single shared launch PIN for the trusted laptop. If no PIN is
 * configured, the station is open (BitLocker is the real at-rest control). When a PIN is set,
 * every request must present a matching one. Richer per-user roles are out of scope for the
 * standalone quick win.
 */

import type { StationConfig } from "./config.js";

export interface AuthResult {
  ok: boolean;
  error?: string;
}

export function checkPin(config: Pick<StationConfig, "pin">, provided?: string): AuthResult {
  if (!config.pin) return { ok: true };
  if (provided && provided === config.pin) return { ok: true };
  return { ok: false, error: "This station is locked. Enter the access PIN to continue." };
}
