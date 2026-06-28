import { describe, expect, it } from "vitest";
import { fromAnthropicContent, toAnthropicMessages, toAnthropicTools } from "./anthropic.js";
import { ollamaToolSchemas } from "../tools/index.js";
import type { ChatMessage } from "./types.js";

describe("toAnthropicTools", () => {
  it("maps Ollama function schemas to Anthropic {name, input_schema}", () => {
    const mapped = toAnthropicTools(ollamaToolSchemas()) as { name: string; input_schema: unknown }[];
    expect(mapped).toHaveLength(4);
    expect(mapped.map((t) => t.name)).toContain("search_beneficiary");
    expect(mapped[0]).toHaveProperty("input_schema.type", "object");
    expect(mapped[0]).not.toHaveProperty("function");
  });
  it("returns undefined for no tools", () => {
    expect(toAnthropicTools(undefined)).toBeUndefined();
    expect(toAnthropicTools([])).toBeUndefined();
  });
});

describe("toAnthropicMessages", () => {
  it("passes a plain user turn through", () => {
    expect(toAnthropicMessages([{ role: "user", content: "trace X" }])).toEqual([
      { role: "user", content: "trace X" },
    ]);
  });

  it("converts assistant tool_calls + tool results into tool_use / tool_result with matching ids", () => {
    const msgs: ChatMessage[] = [
      { role: "user", content: "Summary of WORKS" },
      { role: "assistant", content: "", tool_calls: [{ function: { name: "get_mda_summary", arguments: { mda: "WORKS" } } }] },
      { role: "tool", tool_name: "get_mda_summary", content: '{"summary":"WORKS ..."}' },
    ];
    const out = toAnthropicMessages(msgs) as any[];
    expect(out).toHaveLength(3);
    // assistant turn → tool_use block with id call_0
    expect(out[1].role).toBe("assistant");
    expect(out[1].content[0]).toMatchObject({ type: "tool_use", id: "call_0", name: "get_mda_summary", input: { mda: "WORKS" } });
    // tool turn → user message with a matching tool_result
    expect(out[2].role).toBe("user");
    expect(out[2].content[0]).toMatchObject({ type: "tool_result", tool_use_id: "call_0" });
  });
});

describe("fromAnthropicContent", () => {
  it("splits text and tool_use blocks", () => {
    const { content, toolCalls } = fromAnthropicContent([
      { type: "text", text: "Let me look." },
      { type: "tool_use", id: "x", name: "search_beneficiary", input: { name: "BADMUS" } },
    ]);
    expect(content).toBe("Let me look.");
    expect(toolCalls).toEqual([{ function: { name: "search_beneficiary", arguments: { name: "BADMUS" } } }]);
  });
  it("concatenates multiple text blocks, no tools", () => {
    const { content, toolCalls } = fromAnthropicContent([
      { type: "text", text: "A" },
      { type: "text", text: "B" },
    ]);
    expect(content).toBe("AB");
    expect(toolCalls).toHaveLength(0);
  });
});
