import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildCatalogDb } from "../../scripts/build-catalog-db.js";
import { openCatalogReadonly, type DB } from "../lib/catalog-db.js";
import { StubLlmClient, proseResponse, toolCallResponse } from "../llm/stub.js";
import { loadConfig, type StationConfig } from "./config.js";
import { createAuditor, type Auditor } from "./audit.js";
import { handleAsk } from "./handler.js";

const FIXTURE = resolve(fileURLToPath(new URL("../../scripts/__fixtures__/catalog.sample.json", import.meta.url)));
const DBOUT = join(tmpdir(), "auditor-station-handler-test.db");
const AUDIT = join(tmpdir(), `auditor-station-handler-audit-${process.pid}.jsonl`);
const NOW = "2026-06-26T00:00:00.000Z";

let db: DB;
let config: StationConfig;
let auditor: Auditor;

beforeAll(() => {
  if (existsSync(DBOUT)) rmSync(DBOUT, { force: true });
  buildCatalogDb(FIXTURE, DBOUT);
  db = openCatalogReadonly(DBOUT);
  config = loadConfig(tmpdir(), { dbPath: DBOUT, auditFile: AUDIT });
});
afterAll(() => {
  db?.close();
  if (existsSync(DBOUT)) rmSync(DBOUT, { force: true });
});
beforeEach(() => {
  if (existsSync(AUDIT)) rmSync(AUDIT, { force: true });
  auditor = createAuditor(AUDIT);
});

describe("handleAsk", () => {
  it("success: answers, cites, and writes a success audit entry", async () => {
    const client = new StubLlmClient([
      toolCallResponse("search_beneficiary", { name: "ALATISE FOLASADE" }),
      proseResponse("ALATISE FOLASADE appears in AANFE."),
    ]);
    const out = await handleAsk({ db, client, config, auditor, now: () => NOW }, { question: "Trace ALATISE FOLASADE" });

    expect(out.ok).toBe(true);
    expect(out.answer).toMatch(/ALATISE/);
    expect(out.citations?.length).toBeGreaterThan(0);
    expect(out.banner).toMatch(/non-authoritative/i);

    const log = auditor.readAll();
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ status: "success", ts: NOW, model: config.model });
    expect(log[0].tools?.[0].name).toBe("search_beneficiary");
  });

  it("blocked: wrong PIN is rejected, audited, and never reaches the model", async () => {
    const pinned = { ...config, pin: "1234" };
    const client = new StubLlmClient([]); // would throw if called
    const out = await handleAsk({ db, client, config: pinned, auditor, now: () => NOW }, { question: "Trace ALATISE", pin: "0000" });

    expect(out.ok).toBe(false);
    expect(out.error).toMatch(/locked|pin/i);
    expect(client.requests).toHaveLength(0); // model never invoked
    expect(auditor.readAll()[0]).toMatchObject({ status: "blocked", ts: NOW });
  });

  it("open station (no PIN) answers without a PIN", async () => {
    const client = new StubLlmClient([toolCallResponse("get_mda_summary", { mda: "WORKS" }), proseResponse("WORKS summary.")]);
    const out = await handleAsk({ db, client, config, auditor, now: () => NOW }, { question: "Summary of WORKS" });
    expect(out.ok).toBe(true);
  });

  it("empty question is rejected and audited as error", async () => {
    const client = new StubLlmClient([]);
    const out = await handleAsk({ db, client, config, auditor, now: () => NOW }, { question: "   " });
    expect(out.ok).toBe(false);
    expect(auditor.readAll()[0].status).toBe("error");
  });

  it("LLM failure is caught and audited as error", async () => {
    const client = new StubLlmClient([]); // first chat() throws "no scripted response left"
    const out = await handleAsk({ db, client, config, auditor, now: () => NOW }, { question: "Trace ALATISE" });
    expect(out.ok).toBe(false);
    expect(out.error).toMatch(/could not complete/i);
    expect(auditor.readAll()[0].status).toBe("error");
  });

  it("sanitizes punitive language from the answer and records the rewrite", async () => {
    const client = new StubLlmClient([
      toolCallResponse("query_catalog", { balanceBelowZero: true }),
      proseResponse("This is an anomaly that should be flagged."),
    ]);
    const out = await handleAsk({ db, client, config, auditor, now: () => NOW }, { question: "Any issues?" });
    expect(out.answer).toBe("This is an observation that should be marked for review.");
    expect(out.answer).not.toMatch(/anomaly|flagged/i);
    expect(out.violations?.length).toBe(2);
    expect(auditor.readAll()[0].violations).toHaveLength(2); // model's slip is on record
  });

  it("surfaces provenance with the answer", async () => {
    const client = new StubLlmClient([proseResponse("hi")]);
    const out = await handleAsk({ db, client, config, auditor, now: () => NOW }, { question: "hello" });
    expect(out.provenance.recordCount).toBe(4);
    expect(out.provenance.mdaCount).toBe(3);
    expect(out.provenance.shortSha).toHaveLength(12);
  });
});
