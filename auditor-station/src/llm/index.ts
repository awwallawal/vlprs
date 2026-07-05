/**
 * llm/index.ts — public surface of the LLM layer (SQ2-4).
 */

export { ask, DEFAULT_SYSTEM } from "./ask.js";
export type { AskOptions, AskResult, ToolRun } from "./ask.js";
export { OllamaClient } from "./ollama.js";
export type { OllamaConfig } from "./ollama.js";
export { AnthropicClient } from "./anthropic.js";
export type { AnthropicConfig } from "./anthropic.js";
export { routeToTool } from "./router.js";
export type { RoutedCall } from "./router.js";
export { StubLlmClient, proseResponse, toolCallResponse } from "./stub.js";
export type { ChatMessage, ChatRequest, ChatResponse, LlmClient, ToolCall } from "./types.js";
