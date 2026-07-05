/**
 * server/index.ts — public surface of the server layer (SQ2-5).
 */

export { loadConfig } from "./config.js";
export type { StationConfig } from "./config.js";
export { checkPin } from "./auth.js";
export type { AuthResult } from "./auth.js";
export { Auditor, createAuditor } from "./audit.js";
export type { AuditEntry, AuditStatus } from "./audit.js";
export { buildSystemPrompt, getProvenance, provenanceBanner } from "./system-prompt.js";
export type { Provenance } from "./system-prompt.js";
export { handleAsk } from "./handler.js";
export type { AskInput, AskOutput, HandlerDeps } from "./handler.js";
export { createStationServer } from "./server.js";
export { openConfiguredCatalog } from "./db-open.js";
export type { OpenedCatalog } from "./db-open.js";
