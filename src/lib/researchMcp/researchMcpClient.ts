import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { ResearchMcpRuntimeMirror, ResearchMcpToolResponse } from "./researchMcpTypes";
import type { SimulationRunbookCheckEvidence } from "@/lib/simulationRunbook";

const endpoint = "/gotrader-research-mcp/mcp";
const runtimeEndpoint = "/gotrader-research-mcp/runtime";

const structured = <T>(value: unknown): T => value as T;

export async function callGoTraderResearchMcp<T = unknown>(name: string, args: Record<string, unknown> = {}) {
  const client = new Client({ name: "gotrader-frontend", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(endpoint, window.location.origin));
  try {
    await client.connect(transport);
    const response = await client.callTool({ name, arguments: args });
    return structured<T>(response.structuredContent);
  } finally {
    await client.close().catch(() => undefined);
  }
}

export async function syncGoTraderResearchMcpRuntime(mirror: ResearchMcpRuntimeMirror) {
  const response = await fetch(runtimeEndpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(mirror)
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.blockers?.join(", ") || `Runtime sync failed (${response.status}).`);
  return payload as { status: "accepted"; evidenceId: string; capturedAt: string; receivedAt: string };
}

export const readMcpResults = () => callGoTraderResearchMcp<ResearchMcpToolResponse>("gotrader_results");
export const readMcpCurrentCycle = () => callGoTraderResearchMcp<ResearchMcpToolResponse>("gotrader_current_cycle");
export const readMcpStatus = () => callGoTraderResearchMcp<Record<string, unknown>>("gotrader_status");
export const readMcpSimulationRunbook = () => callGoTraderResearchMcp<{
  status: "available" | "blocked" | "unavailable";
  cycleId: string | null;
  evidenceId: string | null;
  records: SimulationRunbookCheckEvidence[];
  completedChecks: number;
  totalChecks: number;
  verifiedAt: string | null;
  blockers: string[];
}>("gotrader_simulation_runbook");
export const readMcpTradeProposals = () => callGoTraderResearchMcp<{
  status: "available";
  proposals: Array<{
    proposalId: string;
    createdAt: string;
    status: "validated_research_proposal" | "blocked";
    blockers: string[];
    compactProposal: { strategyProfileId?: string; strategyProfileVersion?: string };
    checks: { runtimeFreshness: string; profileIdentityMatched: boolean };
    ledgerReference?: string | null;
  }>;
}>("gotrader_list_trade_proposals", { limit: 10 });
