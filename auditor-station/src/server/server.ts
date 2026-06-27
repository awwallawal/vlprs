/**
 * server/server.ts — the tiny local HTTP server (SQ2-5).
 *
 * Localhost only. Exposes the API the chat page (SQ2-6) will call. Streaming/UI come in SQ2-6;
 * here /api/ask returns JSON. The handler does the real work (auth → ask → audit).
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { handleAsk, type HandlerDeps } from "./handler.js";
import { getProvenance, provenanceBanner } from "./system-prompt.js";

function json(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(payload);
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

export function createStationServer(deps: HandlerDeps): Server {
  return createServer(async (req, res) => {
    try {
      if (req.method === "GET" && (req.url === "/api/health" || req.url === "/api/meta")) {
        const provenance = getProvenance(deps.db);
        return json(res, 200, { ok: true, provenance, banner: provenanceBanner(provenance) });
      }

      if (req.method === "POST" && req.url === "/api/ask") {
        const body = (await readBody(req)) as { question?: string; pin?: string };
        const result = await handleAsk(deps, { question: body.question ?? "", pin: body.pin });
        return json(res, result.ok ? 200 : 400, result);
      }

      json(res, 404, { ok: false, error: "Not found" });
    } catch (err) {
      json(res, 500, { ok: false, error: (err as Error).message });
    }
  });
}
