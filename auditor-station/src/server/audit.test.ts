import { existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createAuditor } from "./audit.js";

const FILE = join(tmpdir(), `auditor-station-audit-test-${process.pid}.jsonl`);

afterEach(() => {
  if (existsSync(FILE)) rmSync(FILE, { force: true });
});

describe("Auditor", () => {
  it("appends entries as JSONL and reads them back", () => {
    const a = createAuditor(FILE);
    a.append({ ts: "t1", status: "success", question: "q1" });
    a.append({ ts: "t2", status: "blocked", question: "q2", error: "nope" });
    const all = a.readAll();
    expect(all).toHaveLength(2);
    expect(all[0]).toMatchObject({ ts: "t1", status: "success" });
    expect(all[1]).toMatchObject({ ts: "t2", status: "blocked", error: "nope" });
  });

  it("is append-only — a new entry never rewrites earlier lines", () => {
    const a = createAuditor(FILE);
    a.append({ ts: "t1", status: "success", question: "first" });
    const a2 = createAuditor(FILE); // re-open
    a2.append({ ts: "t2", status: "error", question: "second" });
    const lines = readFileSync(FILE, "utf8").trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]).question).toBe("first");
    expect(JSON.parse(lines[1]).question).toBe("second");
  });
});
