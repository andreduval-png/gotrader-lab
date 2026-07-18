#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v4";
import {
  appendTradeProposalAudit,
  buildTradeProposalControlPlaneStatus,
  evaluateTradeProposal,
  readRecentTradeProposalAudits
} from "./gotrader-trade-proposal-core.mjs";

const server = new McpServer({
  name: "gotrader-trade-proposal-control-plane",
  version: "1.0.0"
});

const asToolResult = (structuredContent, isError = false) => ({
  content: [{ type: "text", text: JSON.stringify(structuredContent, null, 2) }],
  structuredContent,
  isError
});

server.registerTool(
  "gotrader_control_plane_status",
  {
    description:
      "Read the fail-closed GoTrader LLM proposal control-plane status. This tool cannot access accounts, orders, positions, or brokers.",
    inputSchema: {}
  },
  async () => asToolResult(buildTradeProposalControlPlaneStatus())
);

server.registerTool(
  "gotrader_propose_trade_evaluation",
  {
    description:
      "Submit a compact research trade proposal for deterministic GoTrader validation. It queues no broker order and grants no execution authority.",
    inputSchema: {
      proposal: z.record(z.string(), z.unknown()).describe(
        "Compact proposal containing requestedSymbol, brokerSymbol, timeframe, strategyProfileId, direction, entry, stop, targets, sourceProvider, sourceFingerprint, and validationChainId."
      )
    }
  },
  async ({ proposal }) => {
    const evaluation = evaluateTradeProposal(proposal);
    await appendTradeProposalAudit(evaluation);
    return asToolResult(evaluation, evaluation.status === "blocked");
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

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("GoTrader trade-proposal MCP running on stdio; execution authority none.");

const shutdown = async () => {
  await server.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
