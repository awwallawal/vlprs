import { describe, expect, it } from "vitest";
import { auditToCsv } from "./audit-export.js";
import type { AuditEntry } from "./audit.js";

describe("auditToCsv", () => {
  it("renders a header and a row", () => {
    const entries: AuditEntry[] = [
      {
        ts: "2026-06-26T00:00:00.000Z",
        status: "success",
        question: "Trace BADMUS",
        routedBy: "model",
        model: "qwen2.5:7b",
        tools: [{ name: "search_beneficiary", args: {} }],
        citations: ["a.xlsx", "b.xlsx"],
      },
    ];
    const csv = auditToCsv(entries);
    const lines = csv.trim().split("\r\n");
    expect(lines[0]).toBe("ts,status,question,routedBy,model,tools,citations,violations,answer,error");
    expect(lines[1]).toContain("search_beneficiary");
    expect(lines[1]).toContain("a.xlsx; b.xlsx");
  });

  it("escapes commas, quotes, and newlines", () => {
    const entries: AuditEntry[] = [
      { ts: "t", status: "success", question: 'has "quote", comma', answer: "line1\nline2" },
    ];
    const row = auditToCsv(entries).trim().split("\r\n")[1];
    expect(row).toContain('"has ""quote"", comma"');
    expect(row).toContain('"line1\nline2"');
  });

  it("records non-punitive rewrites", () => {
    const entries: AuditEntry[] = [
      { ts: "t", status: "success", question: "q", violations: [{ term: "anomaly", suggestion: "observation" }] },
    ];
    expect(auditToCsv(entries)).toContain("anomaly->observation");
  });
});
