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
});
