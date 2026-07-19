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
import {
  buildPaperDemoGatewayStatus,
  preparePaperDemoSimulation,
  readRecentMt5DemoReceipts,
  readRecentPaperDemoReceipts
} from "./gotrader-paper-demo-gateway-core.mjs";

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
    const result = await preparePaperDemoSimulation(proposalId);
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
console.error("GoTrader trade-proposal MCP running on stdio; execution authority none.");

const shutdown = async () => {
  await server.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
