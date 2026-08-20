#!/usr/bin/env node
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import * as z from "zod/v4";
import { queryGbrainAdvisory } from "./gotrader-gbrain-mcp-client.mjs";

const token = "fake-gbrain-test-token-123456789";
const port = 18500 + Math.floor(Math.random() * 500);
const createFake = () => {
  const server = new McpServer({ name: "fake-gbrain", version: "1.0.0" });
  for (const name of ["gbrain_search", "gbrain_think"]) {
    server.registerTool(name, { inputSchema: { query: z.string(), context: z.record(z.string(), z.unknown()) } }, async ({ query, context }) => {
      const payload = { answer: `${name}:${query}`, citations: [{ evidenceId: context.evidenceId, retrievedAt: "2026-08-18T00:00:00.000Z", freshness: context.freshness }] };
      return { content: [{ type: "text", text: JSON.stringify(payload) }], structuredContent: payload };
    });
  }
  return server;
};
const http = createServer(async (req, res) => {
  if (req.headers.authorization !== `Bearer ${token}`) { res.writeHead(401).end(); return; }
  const chunks = []; for await (const chunk of req) chunks.push(chunk);
  const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : undefined;
  const server = createFake();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  await transport.handleRequest(req, res, body);
  res.on("close", () => { void transport.close(); void server.close(); });
});
await new Promise((resolve) => http.listen(port, "127.0.0.1", resolve));
try {
  const context = { evidenceId: "sha256:canonical", freshness: "fresh", activeProfile: { profileId: "v4" } };
  for (const mode of ["search", "think"]) {
    const response = await queryGbrainAdvisory({ mode, query: "review evidence", evidenceContext: context }, { env: { GOTRADER_GBRAIN_MCP_URL: `http://127.0.0.1:${port}/mcp`, GOTRADER_GBRAIN_MCP_TOKEN: token } });
    assert.equal(response.status, "available");
    assert.equal(response.advisoryOnly, true);
    assert.equal(response.citations[0].evidenceId, context.evidenceId);
    assert.equal(response.citations[0].freshness, "fresh");
  }
  assert.equal((await queryGbrainAdvisory({ mode: "search", query: "x", evidenceContext: context }, { env: {} })).status, "unavailable");
  assert.equal((await queryGbrainAdvisory({ mode: "search", query: "x", evidenceContext: context }, { env: { GOTRADER_GBRAIN_MCP_URL: "https://example.com/mcp", GOTRADER_GBRAIN_MCP_TOKEN: token } })).status, "blocked");
  console.log(JSON.stringify({ status: "passed", checks: ["search", "think", "citations", "freshness", "missing config fails closed", "non-loopback blocked", "advisory only"] }, null, 2));
} finally {
  await new Promise((resolve) => http.close(resolve));
}
