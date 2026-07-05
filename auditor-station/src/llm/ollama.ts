/**
 * llm/ollama.ts — the real local-Ollama client (SQ2-4).
 *
 * Talks to POST {baseUrl}/api/chat. Default model is the Gate-0 pin (qwen2.5:7b). Supports a
 * non-streaming round (for the tool-decision turn) and a streaming round (for narration).
 * PII never leaves the machine: baseUrl is localhost only by design.
 */

import { MODEL } from "../station.js";
import type { ChatMessage, ChatRequest, ChatResponse, LlmClient, ToolCall } from "./types.js";

export interface OllamaConfig {
  baseUrl?: string;
  model?: string;
  /** Keep the model resident between calls so the cold load is paid once. */
  keepAlive?: string;
  /** Cap tokens generated per turn — bounds worst-case latency on CPU. Default 512. */
  numPredict?: number;
  /** Low temperature for stable tool-calling + concise narration. Default 0.2. */
  temperature?: number;
}

function buildMessages(req: ChatRequest) {
  const sys: ChatMessage[] = req.system ? [{ role: "system", content: req.system }] : [];
  const msgs: ChatMessage[] = [...sys, ...req.messages];
  return msgs.map((m) => ({
    role: m.role,
    content: m.content,
    ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}),
    ...(m.tool_name ? { tool_name: m.tool_name } : {}),
  }));
}

function extractToolCalls(message: unknown): ToolCall[] {
  const tc = (message as { tool_calls?: unknown[] })?.tool_calls;
  if (!Array.isArray(tc)) return [];
  return tc
    .map((c) => {
      const fn = (c as { function?: { name?: string; arguments?: unknown } }).function;
      if (!fn?.name) return null;
      // Ollama returns arguments as an object (sometimes a JSON string).
      let args: Record<string, unknown> = {};
      if (typeof fn.arguments === "string") {
        try { args = JSON.parse(fn.arguments); } catch { args = {}; }
      } else if (fn.arguments && typeof fn.arguments === "object") {
        args = fn.arguments as Record<string, unknown>;
      }
      return { function: { name: fn.name, arguments: args } };
    })
    .filter((x): x is ToolCall => x !== null);
}

export class OllamaClient implements LlmClient {
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly keepAlive: string;
  private readonly numPredict: number;
  private readonly temperature: number;

  constructor(cfg: OllamaConfig = {}) {
    this.baseUrl = (cfg.baseUrl ?? "http://localhost:11434").replace(/\/$/, "");
    this.model = cfg.model ?? MODEL.default;
    this.keepAlive = cfg.keepAlive ?? "30m";
    this.numPredict = cfg.numPredict ?? 512;
    this.temperature = cfg.temperature ?? 0.2;
  }

  private body(req: ChatRequest, stream: boolean) {
    return JSON.stringify({
      model: req.model ?? this.model,
      stream,
      keep_alive: this.keepAlive,
      messages: buildMessages(req),
      ...(req.tools?.length ? { tools: req.tools } : {}),
      options: { temperature: this.temperature, num_predict: this.numPredict, ...(req.options ?? {}) },
    });
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: this.body(req, false),
    });
    if (!res.ok) throw new Error(`Ollama /api/chat ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as {
      message?: { content?: string };
      eval_count?: number;
      eval_duration?: number;
    };
    return {
      content: data.message?.content ?? "",
      toolCalls: extractToolCalls(data.message),
      evalCount: data.eval_count,
      evalDuration: data.eval_duration,
      raw: data,
    };
  }

  async chatStream(req: ChatRequest, onText: (chunk: string) => void): Promise<ChatResponse> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: this.body(req, true),
    });
    if (!res.ok || !res.body) throw new Error(`Ollama /api/chat ${res.status}: ${await res.text()}`);

    const decoder = new TextDecoder();
    let buffer = "";
    let content = "";
    let toolCalls: ToolCall[] = [];
    let evalCount: number | undefined;
    let evalDuration: number | undefined;

    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
      buffer += decoder.decode(chunk, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        const obj = JSON.parse(line) as {
          message?: { content?: string };
          done?: boolean;
          eval_count?: number;
          eval_duration?: number;
        };
        const piece = obj.message?.content ?? "";
        if (piece) { content += piece; onText(piece); }
        const tc = extractToolCalls(obj.message);
        if (tc.length) toolCalls = tc;
        if (obj.done) { evalCount = obj.eval_count; evalDuration = obj.eval_duration; }
      }
    }
    return { content, toolCalls, evalCount, evalDuration };
  }
}
