/**
 * llm/types.ts — the LLM transport contract (SQ2-4).
 *
 * `LlmClient` abstracts Ollama so the orchestrator and tests don't depend on a live server.
 * The real client (ollama.ts) talks to localhost:11434; the stub (stub.ts) replays scripted
 * responses. Only local Ollama is ever a real implementation — no online provider, ever.
 */

export type Role = "system" | "user" | "assistant" | "tool";

export interface ToolCall {
  function: { name: string; arguments: Record<string, unknown> };
}

export interface ChatMessage {
  role: Role;
  content: string;
  /** Present on assistant turns that requested tools. */
  tool_calls?: ToolCall[];
  /** Present on tool-result turns (which tool produced this content). */
  tool_name?: string;
}

export interface ChatRequest {
  model?: string;
  /** Prepended as a system message. */
  system?: string;
  messages: ChatMessage[];
  /** Ollama `tools` array (from ollamaToolSchemas()). */
  tools?: unknown[];
  /** Ollama options passthrough (temperature, num_ctx, …). */
  options?: Record<string, unknown>;
}

export interface ChatResponse {
  content: string;
  toolCalls: ToolCall[];
  /** Ollama perf counters, when available. */
  evalCount?: number;
  evalDuration?: number;
  raw?: unknown;
}

export interface LlmClient {
  /** Single non-streaming round (used for the tool-decision turn). */
  chat(req: ChatRequest): Promise<ChatResponse>;
  /** Optional streaming round (text chunks via onText); used for narration in the server/UI. */
  chatStream?(req: ChatRequest, onText: (chunk: string) => void): Promise<ChatResponse>;
}
