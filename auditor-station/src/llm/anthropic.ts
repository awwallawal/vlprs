/**
 * llm/anthropic.ts — cloud Claude brain (SQ-2, optional provider).
 *
 * Implements the same LlmClient contract as OllamaClient, so the tools, router, orchestrator,
 * server, audit, and web UI are all reused unchanged — only the brain differs. Default model is
 * Haiku 4.5 (cheapest/fastest; the deterministic tools do the work, the model just narrates).
 *
 * PII NOTE: this sends catalog data to the Anthropic API. Use ONLY with a DPA + Zero Data
 * Retention on the org (see GOVERNANCE.md). For a no-egress deployment, use OllamaClient.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { ChatMessage, ChatRequest, ChatResponse, LlmClient, ToolCall } from "./types.js";

export interface AnthropicConfig {
  /** Reads ANTHROPIC_API_KEY from env if omitted. */
  apiKey?: string;
  model?: string;
  maxTokens?: number;
}

/** Map our (Ollama-shaped) tool schemas to Anthropic's {name, description, input_schema}. */
export function toAnthropicTools(tools: unknown[] | undefined): unknown[] | undefined {
  if (!tools?.length) return undefined;
  return tools.map((t) => {
    const fn = (t as { function?: { name: string; description?: string; parameters?: unknown } }).function;
    return { name: fn?.name, description: fn?.description, input_schema: fn?.parameters ?? { type: "object", properties: {} } };
  });
}

/**
 * Translate our generic ChatMessage[] to Anthropic message params. Assistant tool calls become
 * `tool_use` blocks with synthetic ids (call_0…); the following role:"tool" messages become a
 * single user message of matching `tool_result` blocks. (Our flow has one tool-decision turn per
 * request, so the per-turn ids never collide.)
 */
export function toAnthropicMessages(messages: ChatMessage[]): unknown[] {
  const out: unknown[] = [];
  let lastToolIds: string[] = [];
  let toolResults: unknown[] = [];

  const flush = () => {
    if (toolResults.length) {
      out.push({ role: "user", content: toolResults });
      toolResults = [];
    }
  };

  for (const m of messages) {
    if (m.role === "tool") {
      const id = lastToolIds[toolResults.length] ?? `call_${toolResults.length}`;
      toolResults.push({ type: "tool_result", tool_use_id: id, content: m.content });
      continue;
    }
    flush();
    if (m.role === "assistant") {
      if (m.tool_calls?.length) {
        lastToolIds = m.tool_calls.map((_, i) => `call_${i}`);
        const blocks: unknown[] = [];
        if (m.content) blocks.push({ type: "text", text: m.content });
        m.tool_calls.forEach((tc, i) =>
          blocks.push({ type: "tool_use", id: `call_${i}`, name: tc.function.name, input: tc.function.arguments ?? {} }),
        );
        out.push({ role: "assistant", content: blocks });
      } else {
        out.push({ role: "assistant", content: m.content });
      }
    } else {
      out.push({ role: "user", content: m.content });
    }
  }
  flush();
  return out;
}

/** Extract narration text + tool calls from an Anthropic response's content blocks. */
export function fromAnthropicContent(content: unknown[]): { content: string; toolCalls: ToolCall[] } {
  let text = "";
  const toolCalls: ToolCall[] = [];
  for (const block of content) {
    const b = block as { type: string; text?: string; name?: string; input?: unknown };
    if (b.type === "text" && b.text) text += b.text;
    else if (b.type === "tool_use" && b.name) {
      toolCalls.push({ function: { name: b.name, arguments: (b.input as Record<string, unknown>) ?? {} } });
    }
  }
  return { content: text, toolCalls };
}

export class AnthropicClient implements LlmClient {
  private readonly client: Anthropic;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(cfg: AnthropicConfig = {}) {
    this.client = new Anthropic(cfg.apiKey ? { apiKey: cfg.apiKey } : {});
    this.model = cfg.model ?? "claude-haiku-4-5";
    this.maxTokens = cfg.maxTokens ?? 1024;
  }

  private system(req: ChatRequest) {
    // Cache the (stable) system prompt; harmless if below the model's cache minimum.
    return req.system
      ? [{ type: "text" as const, text: req.system, cache_control: { type: "ephemeral" as const } }]
      : undefined;
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const res = await this.client.messages.create({
      model: req.model ?? this.model,
      max_tokens: this.maxTokens,
      ...(this.system(req) ? { system: this.system(req) as Anthropic.TextBlockParam[] } : {}),
      messages: toAnthropicMessages(req.messages) as Anthropic.MessageParam[],
      ...(toAnthropicTools(req.tools) ? { tools: toAnthropicTools(req.tools) as Anthropic.Tool[] } : {}),
    });
    const { content, toolCalls } = fromAnthropicContent(res.content);
    return { content, toolCalls, raw: res };
  }

  async chatStream(req: ChatRequest, onText: (chunk: string) => void): Promise<ChatResponse> {
    const stream = this.client.messages.stream({
      model: req.model ?? this.model,
      max_tokens: this.maxTokens,
      ...(this.system(req) ? { system: this.system(req) as Anthropic.TextBlockParam[] } : {}),
      messages: toAnthropicMessages(req.messages) as Anthropic.MessageParam[],
      ...(toAnthropicTools(req.tools) ? { tools: toAnthropicTools(req.tools) as Anthropic.Tool[] } : {}),
    });
    stream.on("text", (t) => onText(t));
    const final = await stream.finalMessage();
    const { content, toolCalls } = fromAnthropicContent(final.content);
    return { content, toolCalls, raw: final };
  }
}
