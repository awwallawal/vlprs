/**
 * server/audit.ts — local, append-only audit log (SQ2-5).
 *
 * Every question is recorded — successes, blocked (auth) attempts, and errors — to a local
 * JSONL file under audit/ (gitignored, PII). Append-only: we only ever append a line, never
 * rewrite. This is the station's accountability trail; it never leaves the machine.
 */

import { appendFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";

export type AuditStatus = "success" | "blocked" | "error";

export interface AuditEntry {
  ts: string;
  status: AuditStatus;
  question: string;
  answer?: string;
  tools?: { name: string; args: unknown }[];
  routedBy?: string;
  citations?: string[];
  model?: string;
  /** Non-punitive rewrites applied to the answer, if any. */
  violations?: { term: string; suggestion: string }[];
  error?: string;
}

export class Auditor {
  constructor(private readonly file: string) {
    mkdirSync(dirname(file), { recursive: true });
  }

  append(entry: AuditEntry): void {
    appendFileSync(this.file, JSON.stringify(entry) + "\n", "utf8");
  }

  /** Read all entries back (for tests / local review). */
  readAll(): AuditEntry[] {
    if (!existsSync(this.file)) return [];
    return readFileSync(this.file, "utf8")
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l) as AuditEntry);
  }
}

export function createAuditor(file: string): Auditor {
  return new Auditor(file);
}
