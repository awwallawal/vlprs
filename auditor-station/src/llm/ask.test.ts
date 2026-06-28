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

  it("falls back to the router when the model rejects the tools array (non-tool model)", async () => {
    const client = new StubLlmClient([
      new Error("llama3:8b does not support tools"), // first turn (with tools) → Ollama rejects
      proseResponse("I will describe what I can."), // retry without tools → prose
      proseResponse("These records show a balance below zero."), // narration
    ]);
    const r = await ask({ db, client, question: "Which staff have a balance below zero?" });
    expect(r.routedBy).toBe("router");
    expect(r.toolRuns[0].name).toBe("query_catalog");
    expect(Array.isArray(client.requests[0].tools)).toBe(true); // first attempt sent tools
    expect(client.requests[1].tools).toBeUndefined(); // retry sent none
  });

  it("rethrows a non-tools error (e.g. Ollama down)", async () => {
    const client = new StubLlmClient([new Error("fetch failed")]);
    await expect(ask({ db, client, question: "anything" })).rejects.toThrow(/fetch failed/);
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

  it("deterministic mode: no LLM call at all — router picks the tool, answer is the summary", async () => {
    const client = new StubLlmClient([]); // must never be called
    const r = await ask({ db, client, question: "Summary of WORKS", deterministic: true });
    expect(client.requests).toHaveLength(0);
    expect(r.routedBy).toBe("router");
    expect(r.toolRuns[0].name).toBe("get_mda_summary");
    expect(r.answer).toMatch(/WORKS/);
  });

  it("narrate:false — one LLM call (tool decision), then answer from the tool summary", async () => {
    const client = new StubLlmClient([toolCallResponse("get_mda_summary", { mda: "WORKS" })]);
    const r = await ask({ db, client, question: "Summary of WORKS", narrate: false });
    expect(client.requests).toHaveLength(1); // no narration turn
    expect(r.routedBy).toBe("model");
    expect(r.answer).toMatch(/WORKS/);
  });

  it("passes the tool schemas to the model on the first turn", async () => {
    const client = new StubLlmClient([proseResponse("hi")]);
    await ask({ db, client, question: "anything" });
    const firstReq = client.requests[0];
    expect(Array.isArray(firstReq.tools)).toBe(true);
    expect((firstReq.tools as unknown[]).length).toBe(4);
  });
});
