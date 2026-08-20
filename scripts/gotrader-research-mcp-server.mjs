import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import {
  buildResearchMcpStatus,
  createDraftCalibrationIntent,
  evaluateCanonicalTradeProposal,
  GOTRADER_RESEARCH_MCP_AUTHORITY,
  readDraftCalibrationIntents,
  readMemoryDeliveryRequests,
  readRecentCanonicalProposals,
  readSimulationRunbookEvidence,
  readSurface,
  recordSimulationRunbookReceipt,
  requestMemoryDelivery
} from "./gotrader-research-mcp-core.mjs";
import { queryGbrainAdvisory } from "./gotrader-gbrain-mcp-client.mjs";

const result = (structuredContent, isError = false) => ({
  content: [{ type: "text", text: JSON.stringify(structuredContent, null, 2) }], structuredContent, isError
});

const surfaces = [
  ["gotrader_current_cycle", "current_cycle", "Read the exact current research cycle mirror."],
  ["gotrader_results", "results", "Read the canonical Results workspace snapshot."],
  ["gotrader_active_profile", "active_profile", "Read the exact active operator profile and fingerprints."],
  ["gotrader_certified_evidence", "certified_evidence", "Read compact certified evidence identities and status."],
  ["gotrader_validation_identity", "validation_identity", "Read validation identity and ledger linkage."],
  ["gotrader_calibration_proposals", "calibration_proposals", "Read operator-owned calibration proposal summaries."],
  ["gotrader_readiness", "readiness", "Read canonical readiness state and blockers."],
  ["gotrader_simulated_outcomes", "simulated_outcomes", "Read immutable simulated outcome summaries."],
  ["gotrader_memory_status", "memory_status", "Read research memory queue and operator delivery policy status."]
];

export const createGoTraderResearchMcpServer = ({ repoRoot = process.cwd() } = {}) => {
  const server = new McpServer({ name: "gotrader-research-mcp", version: "1.0.0" });
  server.registerTool("gotrader_status", { description: "Read protocol, runtime freshness, safety, and authority status.", inputSchema: {} }, async () => result(await buildResearchMcpStatus({ repoRoot })));
  for (const [name, surface, description] of surfaces) {
    server.registerTool(name, { description, inputSchema: {} }, async () => {
      const response = await readSurface(surface, { repoRoot });
      return result(response, response.status !== "available");
    });
  }
  server.registerTool("gotrader_validate_trade_proposal", {
    description: "Validate a research-only trade proposal against the current canonical GoTrader identities and ledgers. Never executes or routes an order.",
    inputSchema: { proposal: z.record(z.string(), z.unknown()) }
  }, async ({ proposal }) => {
    const response = await evaluateCanonicalTradeProposal(proposal, { repoRoot });
    return result(response, response.status !== "validated_research_proposal");
  });
  server.registerTool("gotrader_list_trade_proposals", {
    description: "List compact immutable proposal-validation receipts.", inputSchema: { limit: z.number().int().min(1).max(50).optional().default(20) }
  }, async ({ limit }) => result({ status: "available", proposals: await readRecentCanonicalProposals({ repoRoot, limit }), authority: GOTRADER_RESEARCH_MCP_AUTHORITY }));
  server.registerTool("gotrader_create_draft_calibration_intent", {
    description: "Create an approval-required draft calibration intent. This cannot apply or approve calibration.",
    inputSchema: { reason: z.string().min(1).max(500), proposedChanges: z.record(z.string(), z.unknown()).optional().default({}) }
  }, async (input) => {
    const response = await createDraftCalibrationIntent(input, { repoRoot });
    return result(response, response.status === "blocked");
  });
  server.registerTool("gotrader_list_draft_calibration_intents", {
    description: "List MCP-created draft calibration intents and rejection reasons.", inputSchema: { limit: z.number().int().min(1).max(50).optional().default(20) }
  }, async ({ limit }) => result({ status: "available", intents: await readDraftCalibrationIntents({ repoRoot, limit }), authority: GOTRADER_RESEARCH_MCP_AUTHORITY }));
  server.registerTool("gotrader_request_memory_delivery", {
    description: "Request local research-memory delivery. Delivery remains controlled by the existing operator-enabled policy.",
    inputSchema: { reason: z.string().max(300).optional().default("agent_requested_delivery") }
  }, async (input) => {
    const response = await requestMemoryDelivery(input, { repoRoot });
    return result(response, response.status.startsWith("blocked"));
  });
  server.registerTool("gotrader_list_memory_delivery_requests", {
    description: "List compact memory-delivery request receipts.", inputSchema: { limit: z.number().int().min(1).max(50).optional().default(20) }
  }, async ({ limit }) => result({ status: "available", requests: await readMemoryDeliveryRequests({ repoRoot, limit }), authority: GOTRADER_RESEARCH_MCP_AUTHORITY }));
  server.registerTool("gotrader_simulation_runbook", {
    description: "Read exact-cycle immutable simulation runbook evidence. Missing checks remain explicitly unavailable.",
    inputSchema: {}
  }, async () => {
    const response = await readSimulationRunbookEvidence({ repoRoot });
    return result(response, response.status !== "available");
  });
  server.registerTool("gotrader_record_simulation_runbook_receipt", {
    description: "Record an immutable handoff or scheduler simulation receipt for the exact active cycle. Never executes or contacts a broker.",
    inputSchema: {
      cycleId: z.string().min(1).max(200),
      receiptType: z.enum(["handoff", "scheduler"]),
      observedAt: z.string().min(1).max(80),
      schedulerInvocationId: z.string().max(300).optional(),
      handoffExported: z.boolean().optional(),
      savedLatestHandoff: z.boolean().optional(),
      readerConversionTested: z.boolean().optional(),
      schedulerOneCycleCompleted: z.boolean().optional(),
      brokerExecutionSkipped: z.boolean().optional(),
      positions: z.number().int().min(0).optional(),
      trades: z.number().int().min(0).optional(),
      shutdownComplete: z.boolean().optional(),
      detail: z.string().max(1000).optional()
    }
  }, async (input) => {
    const response = await recordSimulationRunbookReceipt(input, { repoRoot });
    return result(response, response.status !== "accepted");
  });
  server.registerTool("gotrader_gbrain_search", {
    description: "Request advisory-only loopback gbrain retrieval with current GoTrader evidence context.",
    inputSchema: { query: z.string().min(1).max(1000) }
  }, async ({ query }) => {
    const runtime = await readSurface("active_profile", { repoRoot });
    const response = await queryGbrainAdvisory({ mode: "search", query, evidenceContext: { evidenceId: runtime.evidenceId, freshness: runtime.freshness, activeProfile: runtime.activeProfile } });
    return result(response, response.status !== "available");
  });
  server.registerTool("gotrader_gbrain_think", {
    description: "Request advisory-only loopback gbrain reasoning with current GoTrader evidence context.",
    inputSchema: { query: z.string().min(1).max(1000) }
  }, async ({ query }) => {
    const runtime = await readSurface("active_profile", { repoRoot });
    const response = await queryGbrainAdvisory({ mode: "think", query, evidenceContext: { evidenceId: runtime.evidenceId, freshness: runtime.freshness, activeProfile: runtime.activeProfile } });
    return result(response, response.status !== "available");
  });
  return server;
};
