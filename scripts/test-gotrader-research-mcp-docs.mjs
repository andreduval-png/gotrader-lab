#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => readFile(path.join(root, file), "utf8");
const [architecture, mcp, stack, historical, adapter, compatibility, risk, paperGateway] = await Promise.all([
  read("ARCHITECTURE.md"), read("docs/gotrader-research-mcp.md"), read("docs/local-stack-manager.md"),
  read("docs/live-data-status-audit.md"), read("docs/tradingview-mcp-analysis-adapter.md"),
  read("docs/gotrader-trade-proposal-mcp.md"), read("docs/simulation-account-risk-control-plane.md"),
  read("docs/gotrader-paper-demo-gateway.md")
]);
assert(architecture.includes("Last updated: 2026-08-18"));
assert(architecture.includes("GoTrader now includes an agent-neutral first-party Research MCP"));
assert(mcp.includes("authenticated loopback Streamable HTTP"));
assert(mcp.includes("execution authority: `none`"));
assert(stack.includes("7332"));
assert(stack.includes("| GoTrader Research MCP | `npm.cmd run mcp:research:http` | `7332` |"));
assert(stack.indexOf("4. GoTrader Research MCP.") < stack.indexOf("5. GoTrader app/Vite."));
assert(historical.includes("Historical audit, superseded"));
assert(adapter.includes("polls read-only TradingView Desktop/CDP quote and candle data"));
assert(compatibility.includes("superseded on 2026-08-18"));
assert(compatibility.includes("No v3 allowlist remains"));
assert(!compatibility.includes("Allowlisted profile: `ifvg_fresh_retest_v3_research`"));
assert(risk.includes("canonical GoTrader Research MCP"));
assert(paperGateway.includes("legacy isolated experiment"));
assert(paperGateway.includes("does not start the former Paper-Demo gateway tool surface"));
assert(!stack.includes("future GoTrader MCP server"));
console.log(JSON.stringify({ status: "passed", checks: ["architecture current", "MCP transport documented", "supervisor service table and order current", "legacy Trade-Proposal MCP explicitly superseded", "historical audit marked superseded", "TradingView polling behavior current"] }, null, 2));
