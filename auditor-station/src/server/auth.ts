/**
 * server/auth.ts — optional local-auth (PIN) gate (SQ2-5).
 *
 * Minimal by design: a single shared launch PIN for the trusted laptop. If no PIN is
 * configured, the station is open (BitLocker is the real at-rest control). When a PIN is set,
 * every request must present a matching one. Richer per-user roles are out of scope for the
 * standalone quick win.
 */

import { timingSafeEqual } from "node:crypto";
import type { StationConfig } from "./config.js";

export interface AuthResult {
  ok: boolean;
  error?: string;
}

/** Constant-time string compare so a wrong PIN leaks nothing via response timing. */
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false; // length is not secret enough to matter here
  return timingSafeEqual(ba, bb);
}

export function checkPin(config: Pick<StationConfig, "pin">, provided?: string): AuthResult {
  if (!config.pin) return { ok: true };
  if (provided && safeEqual(provided, config.pin)) return { ok: true };
  return { ok: false, error: "This station is locked. Enter the access PIN to continue." };
}
