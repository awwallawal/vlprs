import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { type AddressInfo } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildCatalogDb } from "../../scripts/build-catalog-db.js";
import { openCatalogReadonly, type DB } from "../lib/catalog-db.js";
import { StubLlmClient, proseResponse, toolCallResponse } from "../llm/stub.js";
import { loadConfig } from "./config.js";
import { createAuditor } from "./audit.js";
import { createStationServer } from "./server.js";

const FIXTURE = resolve(fileURLToPath(new URL("../../scripts/__fixtures__/catalog.sample.json", import.meta.url)));
const DBOUT = join(tmpdir(), "auditor-station-server-test.db");
const AUDIT = join(tmpdir(), `auditor-station-server-audit-${process.pid}.jsonl`);

let db: DB;
let baseUrl: string;
let server: ReturnType<typeof createStationServer>;

beforeAll(async () => {
  if (existsSync(DBOUT)) rmSync(DBOUT, { force: true });
  if (existsSync(AUDIT)) rmSync(AUDIT, { force: true });
  buildCatalogDb(FIXTURE, DBOUT);
  db = openCatalogReadonly(DBOUT);
  const config = loadConfig(tmpdir(), { dbPath: DBOUT, auditFile: AUDIT });
  const client = new StubLlmClient([
    toolCallResponse("get_mda_summary", { mda: "WORKS" }),
    proseResponse("WORKS has one beneficiary."),
  ]);
  server = createStationServer({ db, client, config, auditor: createAuditor(AUDIT) });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  db?.close();
  if (existsSync(DBOUT)) rmSync(DBOUT, { force: true });
  if (existsSync(AUDIT)) rmSync(AUDIT, { force: true });
});

describe("station HTTP server", () => {
  it("GET /api/health returns provenance", async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; provenance: { recordCount: number } };
    expect(body.ok).toBe(true);
    expect(body.provenance.recordCount).toBe(4);
  });

  it("POST /api/ask returns a cited answer", async () => {
    const res = await fetch(`${baseUrl}/api/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "Summary of WORKS" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; answer: string; banner: string };
    expect(body.ok).toBe(true);
    expect(body.answer).toMatch(/WORKS/);
    expect(body.banner).toMatch(/non-authoritative/i);
  });

  it("unknown route 404s", async () => {
    const res = await fetch(`${baseUrl}/nope`);
    expect(res.status).toBe(404);
  });

  it("serves the chat page at /", async () => {
    const res = await fetch(`${baseUrl}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/html/);
    expect(await res.text()).toMatch(/Auditor Station/);
  });

  it("POST /api/ask/stream emits tool + done SSE events", async () => {
    // New stub for this request (the beforeAll one was consumed).
    const config = loadConfig(tmpdir(), { dbPath: DBOUT, auditFile: AUDIT });
    const client = new StubLlmClient([
      toolCallResponse("get_mda_summary", { mda: "WORKS" }),
      proseResponse("WORKS has one beneficiary."),
    ]);
    const s = createStationServer({ db, client, config, auditor: createAuditor(AUDIT) });
    await new Promise<void>((r) => s.listen(0, "127.0.0.1", () => r()));
    const port = (s.address() as AddressInfo).port;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/ask/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: "Summary of WORKS" }),
      });
      expect(res.headers.get("content-type")).toMatch(/text\/event-stream/);
      const text = await res.text();
      const events = text
        .split("\n\n")
        .map((b) => b.split("\n").find((l) => l.startsWith("data: ")))
        .filter((l): l is string => Boolean(l))
        .map((l) => JSON.parse(l.slice(6)));
      const types = events.map((e) => e.type);
      expect(types).toContain("tool");
      expect(types).toContain("done");
      const done = events.find((e) => e.type === "done");
      expect(done.answer).toMatch(/WORKS/);
      expect(done.banner).toMatch(/non-authoritative/i);
    } finally {
      await new Promise<void>((r) => s.close(() => r()));
    }
  });
});
