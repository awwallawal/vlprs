/**
 * server/server.ts — the tiny local HTTP server (SQ2-5/SQ2-6).
 *
 * Localhost only. Serves the plain chat page (web/) and the API:
 *   GET  /                 → chat page
 *   GET  /api/health|/api/meta → provenance
 *   POST /api/ask          → JSON answer (sanitized, cited)
 *   POST /api/ask/stream   → Server-Sent Events: tool progress, text chunks, done
 */

import { readFileSync, existsSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { handleAsk, type HandlerDeps } from "./handler.js";
import { getProvenance, provenanceBanner } from "./system-prompt.js";

const WEB_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../web");
const STATIC: Record<string, { file: string; type: string }> = {
  "/": { file: "index.html", type: "text/html; charset=utf-8" },
  "/index.html": { file: "index.html", type: "text/html; charset=utf-8" },
  "/app.js": { file: "app.js", type: "text/javascript; charset=utf-8" },
  "/style.css": { file: "style.css", type: "text/css; charset=utf-8" },
};

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<{ question?: string; pin?: string }> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function serveStatic(res: ServerResponse, url: string): boolean {
  const entry = STATIC[url];
  if (!entry) return false;
  const path = resolve(WEB_DIR, entry.file);
  if (!existsSync(path)) return false;
  res.writeHead(200, { "Content-Type": entry.type });
  res.end(readFileSync(path));
  return true;
}

export function createStationServer(deps: HandlerDeps): Server {
  return createServer(async (req, res) => {
    try {
      const url = (req.url ?? "").split("?")[0];

      if (req.method === "GET" && serveStatic(res, url)) return;

      if (req.method === "GET" && (url === "/api/health" || url === "/api/meta")) {
        const provenance = getProvenance(deps.db);
        return json(res, 200, { ok: true, provenance, banner: provenanceBanner(provenance) });
      }

      if (req.method === "POST" && url === "/api/ask") {
        const body = await readBody(req);
        const result = await handleAsk(deps, { question: body.question ?? "", pin: body.pin });
        return json(res, result.ok ? 200 : 400, result);
      }

      if (req.method === "POST" && url === "/api/ask/stream") {
        const body = await readBody(req);
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });
        const send = (obj: unknown) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
        const out = await handleAsk(deps, {
          question: body.question ?? "",
          pin: body.pin,
          onText: (chunk) => send({ type: "text", chunk }),
          onTool: (name) => send({ type: "tool", name }),
        });
        if (out.ok) {
          send({
            type: "done",
            answer: out.answer, // sanitized (authoritative final text to render)
            citations: out.citations,
            banner: out.banner,
            routedBy: out.routedBy,
            violations: out.violations,
          });
        } else {
          send({ type: "error", error: out.error });
        }
        return res.end();
      }

      json(res, 404, { ok: false, error: "Not found" });
    } catch (err) {
      if (!res.headersSent) json(res, 500, { ok: false, error: (err as Error).message });
      else res.end();
    }
  });
}
