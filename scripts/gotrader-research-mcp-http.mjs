#!/usr/bin/env node
import { timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createGoTraderResearchMcpServer } from "./gotrader-research-mcp-server.mjs";
import { GOTRADER_RESEARCH_MCP_AUTHORITY, persistRuntimeMirror } from "./gotrader-research-mcp-core.mjs";

const host = "127.0.0.1";
const port = Number(process.env.GOTRADER_RESEARCH_MCP_PORT || 7332);
const token = String(process.env.GOTRADER_RESEARCH_MCP_TOKEN || "");
if (token.length < 24) throw new Error("GOTRADER_RESEARCH_MCP_TOKEN must contain at least 24 characters.");
const authorized = (req) => {
  const supplied = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const left = Buffer.from(supplied); const right = Buffer.from(token);
  return left.length === right.length && timingSafeEqual(left, right);
};
const sendJson = (res, status, payload) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(payload));
};
const parseBody = async (req) => {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 2_100_000) throw new Error("request_too_large");
    chunks.push(chunk);
  }
  if (!chunks.length) return undefined;
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
};

const httpServer = createServer(async (req, res) => {
  const origin = String(req.headers.origin || "");
  if (/^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/.test(origin)) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Headers", "authorization,content-type,mcp-protocol-version,mcp-session-id");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
  const url = new URL(req.url || "/", `http://${host}:${port}`);
  if (req.method === "GET" && url.pathname === "/health") {
    sendJson(res, 200, { status: "healthy", service: "gotrader-research-mcp", transport: "streamable_http", authenticated: true, authority: GOTRADER_RESEARCH_MCP_AUTHORITY });
    return;
  }
  if (!authorized(req)) { sendJson(res, 401, { status: "unauthorized" }); return; }
  let body;
  try { body = await parseBody(req); } catch (error) { sendJson(res, error?.message === "request_too_large" ? 413 : 400, { status: "blocked", blocker: error?.message ?? "invalid_json" }); return; }
  if (req.method === "POST" && url.pathname === "/runtime") {
    const response = await persistRuntimeMirror(body);
    sendJson(res, response.status === "accepted" ? 202 : 422, response);
    return;
  }
  if (url.pathname !== "/mcp") { sendJson(res, 404, { status: "not_found" }); return; }
  const server = createGoTraderResearchMcpServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
  } catch (error) {
    if (!res.headersSent) sendJson(res, 500, { jsonrpc: "2.0", id: null, error: { code: -32603, message: "Internal MCP error" } });
  } finally {
    res.on("close", () => { void transport.close(); void server.close(); });
  }
});
httpServer.listen(port, host, () => console.log(`GoTrader Research MCP listening on http://${host}:${port}/mcp`));
const shutdown = () => httpServer.close(() => process.exit(0));
process.on("SIGINT", shutdown); process.on("SIGTERM", shutdown);
