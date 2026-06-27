import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildCatalogDb } from "../../scripts/build-catalog-db.js";
import { openCatalogReadonly, type DB } from "../lib/catalog-db.js";
import { ask } from "./ask.js";
import { StubLlmClient, proseResponse, toolCallResponse } from "./stub.js";

const FIXTURE = resolve(fileURLToPath(new URL("../../scripts/__fixtures__/catalog.sample.json", import.meta.url)));
const OUT = join(tmpdir(), "auditor-station-ask-test.db");

let db: DB;
beforeAll(() => {
  if (existsSync(OUT)) rmSync(OUT, { force: true });
  buildCatalogDb(FIXTURE, OUT);
  db = openCatalogReadonly(OUT);
});
afterAll(() => {
  db?.close();
  if (existsSync(OUT)) rmSync(OUT, { force: true });
});

describe("ask orchestrator", () => {
  it("model path: runs the model's tool call, then narrates, with citations", async () => {
    const client = new StubLlmClient([
      toolCallResponse("search_beneficiary", { name: "ALATISE FOLASADE" }),
      proseResponse("ALATISE FOLASADE appears in AANFE across 2019–2020."),
    ]);
    const r = await ask({ db, client, question: "Trace ALATISE FOLASADE" });
    expect(r.routedBy).toBe("model");
    expect(r.toolRuns).toHaveLength(1);
    expect(r.toolRuns[0].name).toBe("search_beneficiary");
    expect(r.answer).toMatch(/ALATISE/);
    expect(r.citations.length).toBeGreaterThan(0); // sourceFiles flowed through
  });

  it("router path: catches a non-tool-calling response and fires the right tool", async () => {
    // Model returns PROSE (no tool call) → router must pick query_catalog → narrate.
    const client = new StubLlmClient([
      proseResponse("Sure, let me think about who has a negative balance…"),
      proseResponse("These records show a balance below zero."),
    ]);
    const r = await ask({ db, client, question: "Which staff have a balance below zero?" });
    expect(r.routedBy).toBe("router");
    expect(r.toolRuns).toHaveLength(1);
    expect(r.toolRuns[0].name).toBe("query_catalog");
    expect(r.toolRuns[0].args).toMatchObject({ balanceBelowZero: true });
  });

  it("none path: no tool from model or router returns the prose with no tool runs", async () => {
    const client = new StubLlmClient([proseResponse("Hello! How can I help with the car-loan data?")]);
    const r = await ask({ db, client, question: "hello there" });
    expect(r.routedBy).toBe("none");
    expect(r.toolRuns).toHaveLength(0);
    expect(r.answer).toMatch(/Hello/);
  });

  it("streams the narration turn when onText is provided", async () => {
    const client = new StubLlmClient([
      toolCallResponse("get_mda_summary", { mda: "WORKS" }),
      proseResponse("WORKS has one beneficiary."),
    ]);
    const chunks: string[] = [];
    const r = await ask({ db, client, question: "Summary of WORKS", onText: (c) => chunks.push(c) });
    expect(chunks.join("")).toMatch(/WORKS/);
    expect(r.toolRuns[0].name).toBe("get_mda_summary");
  });

  it("passes the tool schemas to the model on the first turn", async () => {
    const client = new StubLlmClient([proseResponse("hi")]);
    await ask({ db, client, question: "anything" });
    const firstReq = client.requests[0];
    expect(Array.isArray(firstReq.tools)).toBe(true);
    expect((firstReq.tools as unknown[]).length).toBe(4);
  });
});
