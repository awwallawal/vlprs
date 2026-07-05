/**
 * llm/stub.ts — scripted LLM client for unit tests (SQ2-4).
 *
 * Replays a queue of canned ChatResponses so the orchestrator can be tested without a live
 * Ollama. Records the requests it received for assertions.
 */

import type { ChatRequest, ChatResponse, LlmClient } from "./types.js";

export function toolCallResponse(name: string, args: Record<string, unknown>, content = ""): ChatResponse {
  return { content, toolCalls: [{ function: { name, arguments: args } }] };
}

export function proseResponse(content: string): ChatResponse {
  return { content, toolCalls: [] };
}

export class StubLlmClient implements LlmClient {
  readonly requests: ChatRequest[] = [];
  private readonly queue: (ChatResponse | Error)[];

  // A scripted Error in the queue is thrown when reached (simulates e.g. Ollama rejecting tools).
  constructor(scripted: (ChatResponse | Error)[]) {
    this.queue = [...scripted];
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    this.requests.push(req);
    const next = this.queue.shift();
    if (next === undefined) throw new Error("StubLlmClient: no scripted response left");
    if (next instanceof Error) throw next;
    return next;
  }

  async chatStream(req: ChatRequest, onText: (chunk: string) => void): Promise<ChatResponse> {
    const r = await this.chat(req);
    if (r.content) onText(r.content);
    return r;
  }
}
