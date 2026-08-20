import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const loopbackHosts = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);

export const queryGbrainAdvisory = async ({ mode, query, evidenceContext }, { env = process.env } = {}) => {
  const configured = String(env.GOTRADER_GBRAIN_MCP_URL ?? "").trim();
  if (!configured) return { status: "unavailable", blockers: ["gbrain_mcp_not_configured"], advisoryOnly: true };
  let url;
  try { url = new URL(configured); } catch { return { status: "blocked", blockers: ["gbrain_mcp_url_invalid"], advisoryOnly: true }; }
  if (!loopbackHosts.has(url.hostname)) return { status: "blocked", blockers: ["gbrain_mcp_loopback_required"], advisoryOnly: true };
  const token = String(env.GOTRADER_GBRAIN_MCP_TOKEN ?? "");
  if (!token) return { status: "blocked", blockers: ["gbrain_mcp_token_missing"], advisoryOnly: true };
  const client = new Client({ name: "gotrader-research-mcp-gbrain-sidecar", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(url, { requestInit: { headers: { Authorization: `Bearer ${token}` } } });
  try {
    await client.connect(transport);
    const tool = mode === "think" ? "gbrain_think" : "gbrain_search";
    const response = await client.callTool({ name: tool, arguments: { query, context: evidenceContext } });
    const structured = response.structuredContent ?? { text: response.content?.find((item) => item.type === "text")?.text ?? "" };
    return {
      status: response.isError ? "blocked" : "available", mode, retrievedAt: new Date().toISOString(),
      evidenceContext, citations: Array.isArray(structured.citations) ? structured.citations : [],
      response: structured, advisoryOnly: true, evidenceAuthority: "none", calibrationAuthority: "none",
      blockers: response.isError ? ["gbrain_tool_failed"] : []
    };
  } catch (error) {
    return { status: "blocked", blockers: ["gbrain_mcp_unreachable"], detail: error instanceof Error ? error.message : String(error), advisoryOnly: true };
  } finally {
    await client.close().catch(() => undefined);
  }
};
