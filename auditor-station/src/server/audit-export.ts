/**
 * server/audit-export.ts — export the local audit log to CSV (SQ2-8).
 *
 * The audit log is JSONL for append-only integrity; this renders it to a flat CSV the AG office
 * can open in Excel for review. Pure function (testable); the script writes it to disk.
 */

import type { AuditEntry } from "./audit.js";

const COLUMNS = [
  "ts", "status", "question", "routedBy", "model", "tools", "citations", "violations", "answer", "error",
] as const;

function csvCell(value: unknown): string {
  if (value === undefined || value === null) return "";
  const s = typeof value === "string" ? value : JSON.stringify(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function auditToCsv(entries: AuditEntry[]): string {
  const head = COLUMNS.join(",");
  const rows = entries.map((e) =>
    [
      e.ts,
      e.status,
      e.question,
      e.routedBy ?? "",
      e.model ?? "",
      (e.tools ?? []).map((t) => t.name).join("; "),
      (e.citations ?? []).join("; "),
      (e.violations ?? []).map((v) => `${v.term}->${v.suggestion}`).join("; "),
      e.answer ?? "",
      e.error ?? "",
    ].map(csvCell).join(","),
  );
  return [head, ...rows].join("\r\n") + "\r\n";
}
