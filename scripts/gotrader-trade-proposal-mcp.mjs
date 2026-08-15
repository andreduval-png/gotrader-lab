#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v4";
import {
  appendTradeProposalAudit,
  buildTradeProposalControlPlaneStatus,
  evaluateTradeProposal,
  readRecentTradeProposalAudits,
  TRADE_PROPOSAL_MCP_ALLOWED_PROFILES,
  TRADE_PROPOSAL_MCP_AUTHORITY
} from "./gotrader-trade-proposal-core.mjs";
import {
  buildPaperDemoGatewayStatus,
  preparePaperDemoSimulation,
  readRecentMt5DemoReceipts,
  readRecentPaperDemoReceipts
} from "./gotrader-paper-demo-gateway-core.mjs";
import { withFileLock } from "./gotrader-file-lock.mjs";
import {
  findAuthoritativeProfile,
  loadAuthoritativeMcpContext
} from "./gotrader-mcp-context-core.mjs";
import { createAgentProjectionReader } from "./gotrader-agent-projection-core.mjs";
import { discoverCertifiedProfiles } from "./gotrader-certified-profile-core.mjs";
import {
  GOTRADER_AGENT_INTERFACE,
  withAgentProvenance
} from "./gotrader-agent-provenance-core.mjs";

const scriptRepoRoot = fileURLToPath(new URL("../", import.meta.url));
const repoRoot = path.resolve(process.env.GOTRADER_REPO_ROOT || scriptRepoRoot);
const sessionId = `mcp_session_${randomUUID()}`;
const agentId = String(process.env.GOTRADER_MCP_AGENT_ID || "local_stdio_agent").slice(0, 80);
const loadContext = () =>
  loadAuthoritativeMcpContext({
    allowedProfiles: TRADE_PROPOSAL_MCP_ALLOWED_PROFILES,
    repoRoot
  });
const projectionReader = createAgentProjectionReader();

const server = new McpServer({
  name: "gotrader-canonical-agent-interface",
  version: "2.0.0"
});

const asToolResult = (structuredContent, isError = false, toolName = "gotrader_compatibility_tool") => {
  const contentWithProvenance = structuredContent?.provenance
    ? structuredContent
    : withAgentProvenance(structuredContent, {
        toolName,
        evidenceClass: "historical_certified_evidence",
        source: "gotrader_server_owned_context",
        sourceUpdatedAt: structuredContent?.generatedAt,
        freshness: structuredContent?.freshness ?? { status: "not_applicable", fresh: false }
      });
  return {
  content: [{ type: "text", text: JSON.stringify(contentWithProvenance, null, 2) }],
  structuredContent: contentWithProvenance,
  isError
  };
};

server.registerTool(
  "gotrader_agent_interface_status",
  {
    description:
      "Read the canonical, client-agnostic GoTrader agent interface status and immutable authority boundary.",
    inputSchema: {}
  },
  async () => {
    const [context, currentCycle, results, certified] = await Promise.all([
      loadContext(),
      projectionReader.readCurrentCycle(),
      projectionReader.readResults(),
      discoverCertifiedProfiles()
    ]);
    return asToolResult(withAgentProvenance({
      status: "available",
      interface: GOTRADER_AGENT_INTERFACE,
      clientAgnostic: true,
      capabilities: {
        currentCycleRead: currentCycle.status,
        resultsRead: results.status,
        certifiedProfileDiscovery: certified.status,
        validationContext: context.status,
        proposalEvaluation: "fail_closed",
        researchMemory: "separate_advisory_mcp"
      },
      blockers: [...(currentCycle.blockers ?? []), ...(results.blockers ?? [])]
    }, {
      toolName: "gotrader_agent_interface_status",
      evidenceClass: "fresh_operational_projection",
      source: "gotrader_canonical_agent_interface",
      freshness: { status: "mixed", fresh: currentCycle.status === "available" && results.status === "available" }
    }));
  }
);

server.registerTool(
  "gotrader_get_current_cycle",
  {
    description:
      "Read the latest compact browser-published research cycle. Stale, future-dated, absent, or unsafe projections fail closed.",
    inputSchema: {}
  },
  async () => {
    const result = await projectionReader.readCurrentCycle();
    return asToolResult(result, result.status !== "available", "gotrader_get_current_cycle");
  }
);

server.registerTool(
  "gotrader_get_results",
  {
    description:
      "Read the latest compact Results workspace projection from GoTrader's browser source of truth. Raw candles and broker state are excluded.",
    inputSchema: {}
  },
  async () => {
    const result = await projectionReader.readResults();
    return asToolResult(result, result.status !== "available", "gotrader_get_results");
  }
);

server.registerTool(
  "gotrader_list_certified_profiles",
  {
    description:
      "Discover compact certificate-bound historical strategy profiles, including Liquidity Reclaim Scalper. Discovery never grants proposal, readiness, or execution authority.",
    inputSchema: {}
  },
  async () => {
    const [discovered, context] = await Promise.all([discoverCertifiedProfiles(), loadContext()]);
    const ifvgProfiles = context.profiles.map((profile) => ({
      ...profile,
      evidenceClass: "historical_certified_evidence",
      proposalAllowed: context.status === "available",
      researchValidated: false,
      productionAdoptionAllowed: false
    }));
    const result = {
      ...discovered,
      status: discovered.profiles.length || ifvgProfiles.length ? "available" : "unavailable",
      profiles: [...ifvgProfiles, ...discovered.profiles],
      count: ifvgProfiles.length + discovered.profiles.length,
      blockers: discovered.profiles.length || ifvgProfiles.length ? [] : discovered.blockers
    };
    return asToolResult(result, result.status !== "available", "gotrader_list_certified_profiles");
  }
);

server.registerTool(
  "gotrader_control_plane_status",
  {
    description:
      "Read the fail-closed GoTrader LLM proposal control-plane status. This tool cannot access accounts, orders, positions, or brokers.",
    inputSchema: {}
  },
  async () => {
    const authoritativeContext = await loadContext();
    return asToolResult(buildTradeProposalControlPlaneStatus({ authoritativeContext }));
  }
);

server.registerTool(
  "gotrader_propose_trade_evaluation",
  {
    description:
      "Submit a compact research trade proposal for deterministic GoTrader validation. It queues no broker order and grants no execution authority.",
    inputSchema: {
      proposal: z
        .object({
          requestedSymbol: z.string().min(1).max(24),
          brokerSymbol: z.string().min(1).max(64),
          timeframe: z.string().min(1).max(16),
          strategyProfileId: z.string().min(1).max(120),
          direction: z.enum(["long", "short"]),
          entry: z.number().finite(),
          stop: z.number().finite(),
          targets: z.array(z.number().finite()).min(1).max(4),
          rationale: z.string().max(1_000).optional(),
          sourceProvider: z.literal("mt5_read_only").optional(),
          sourceFingerprint: z.string().min(8).max(512).optional(),
          validationChainId: z.string().min(8).max(160).optional(),
          autoApplyAllowed: z.literal(false).optional(),
          authority: z
            .object({
              executionAuthority: z.literal("none"),
              brokerAuthority: z.literal("none"),
              readinessOverrideAuthority: z.literal("none")
            })
            .strict()
            .optional()
        })
        .strict()
        .describe(
          "Compact research proposal. Source fingerprint and validation identity are resolved by GoTrader; optional claimed values must match exactly."
        )
    }
  },
  async ({ proposal }) => {
    const authoritativeContext = await loadContext();
    const evaluation = evaluateTradeProposal(proposal, {
      actor: {
        agentId,
        correlationId: `mcp_request_${randomUUID()}`,
        sessionId
      },
      authoritativeContext
    });
    await appendTradeProposalAudit(evaluation, { repoRoot });
    return asToolResult(evaluation, evaluation.status === "blocked");
  }
);

server.registerTool(
  "gotrader_get_current_research_context",
  {
    description:
      "Read GoTrader-owned compact MT5 research identity and validation summaries. No candles, broker records, credentials, accounts, orders, or positions are returned.",
    inputSchema: {}
  },
  async () => asToolResult(await loadContext())
);

server.registerTool(
  "gotrader_list_eligible_profiles",
  {
    description:
      "List allowlisted research profiles and their deterministic evidence status. Listing a profile does not grant Paper-Demo or execution readiness.",
    inputSchema: {}
  },
  async () => {
    const context = await loadContext();
    return asToolResult({
      profiles: TRADE_PROPOSAL_MCP_ALLOWED_PROFILES.map((profileId) => ({
        profileId,
        evidence: findAuthoritativeProfile(context, profileId),
        proposalAllowed: Boolean(findAuthoritativeProfile(context, profileId)),
        executionAllowed: false
      })),
      authority: TRADE_PROPOSAL_MCP_AUTHORITY
    });
  }
);

server.registerTool(
  "gotrader_get_validation_chain",
  {
    description:
      "Resolve a server-owned validation binding for an allowlisted research profile. The binding is compact evidence identity, not readiness or execution authority.",
    inputSchema: {
      strategyProfileId: z.string().min(1).max(120)
    }
  },
  async ({ strategyProfileId }) => {
    const context = await loadContext();
    const profile = findAuthoritativeProfile(context, strategyProfileId);
    return asToolResult(
      {
        status: profile ? "resolved" : "not_found",
        profile,
        source: context.source,
        authority: TRADE_PROPOSAL_MCP_AUTHORITY
      },
      !profile
    );
  }
);

server.registerTool(
  "gotrader_list_recent_trade_proposals",
  {
    description:
      "List recent compact MCP proposal audit entries. Entries contain no candles, credentials, account, order, or position data.",
    inputSchema: {
      limit: z.number().int().min(1).max(20).optional().default(10)
    }
  },
  async ({ limit }) => {
    const proposals = await readRecentTradeProposalAudits({ limit });
    return asToolResult({ proposals, count: proposals.length });
  }
);

server.registerTool(
  "gotrader_paper_demo_gateway_status",
  {
    description:
      "Read the opt-in Paper-Demo and MT5 demo-handoff status. The MCP cannot call MT5 or grant authority; the independent gateway must verify every queued demo request.",
    inputSchema: {}
  },
  async () => asToolResult(await buildPaperDemoGatewayStatus())
);

server.registerTool(
  "gotrader_prepare_paper_demo_simulation",
  {
    description:
      "Prepare an already validated proposal for paper review. A separate explicit policy may also queue an immutable MT5 demo handoff; this MCP never calls MT5 or permits live execution.",
    inputSchema: {
      proposalId: z.string().min(1).describe("GoTrader MCP proposal identifier to review.")
    }
  },
  async ({ proposalId }) => {
    const lockPath = path.join(repoRoot, ".gotrader", "locks", "paper-demo-preparation.lock");
    const result = await withFileLock(lockPath, () =>
      preparePaperDemoSimulation(proposalId, { repoRoot })
    );
    return asToolResult(result, result.status === "blocked");
  }
);

server.registerTool(
  "gotrader_list_mt5_demo_receipts",
  {
    description:
      "List compact status receipts from the independent MT5 demo gateway. Receipts exclude credentials, balances, raw broker responses, candles, account records, and broker state lists.",
    inputSchema: {
      limit: z.number().int().min(1).max(20).optional().default(10)
    }
  },
  async ({ limit }) => {
    const receipts = await readRecentMt5DemoReceipts({ limit });
    return asToolResult({ receipts, count: receipts.length });
  }
);

server.registerTool(
  "gotrader_list_paper_demo_receipts",
  {
    description:
      "List compact receipts from the independent paper-only gateway. Receipts contain no candles, credentials, account data, broker orders, or positions.",
    inputSchema: {
      limit: z.number().int().min(1).max(20).optional().default(10)
    }
  },
  async ({ limit }) => {
    const receipts = await readRecentPaperDemoReceipts({ limit });
    return asToolResult({ receipts, count: receipts.length });
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("GoTrader canonical agent interface running on stdio; client agnostic; authority none/none/none.");

const shutdown = async () => {
  await server.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
