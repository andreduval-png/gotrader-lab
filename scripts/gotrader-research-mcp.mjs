#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createGoTraderResearchMcpServer } from "./gotrader-research-mcp-server.mjs";

const server = createGoTraderResearchMcpServer();
await server.connect(new StdioServerTransport());
