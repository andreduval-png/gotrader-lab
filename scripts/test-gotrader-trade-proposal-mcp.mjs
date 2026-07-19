import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  buildTradeProposalControlPlaneStatus,
  evaluateTradeProposal,
  scanTradeProposalForForbiddenContent
} from "./gotrader-trade-proposal-core.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const authorityNone = {
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
};
const safeProposal = {
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  timeframe: "5m",
  strategyProfileId: "ifvg_fresh_retest_v3_research",
  direction: "short",
  entry: 28570,
  stop: 28600,
  targets: [28510, 28460],
  sourceProvider: "mt5_read_only",
  sourceFingerprint: "mt5_ustech_5m_test_fingerprint",
  validationChainId: "validation_chain_test",
  rationale: "IFVG fresh retest research hypothesis.",
  autoApplyAllowed: false,
  authority: authorityNone
};

const safe = evaluateTradeProposal(safeProposal, {
  sizingPolicy: {
    mode: "paper_preview",
    configured: false,
    riskBudgetUsd: 0,
    pointValueUsd: 0,
    maxUnits: 0,
    operatorConfigured: true,
    llmMayOverride: false
  },
  now: "2026-07-18T00:00:00.000Z"
});
assert.equal(safe.status, "queued_for_deterministic_validation");
assert.equal(safe.deterministicChecks.rr, 2);
assert.equal(safe.sizingPreview.status, "blocked_policy_not_configured");
assert.equal(safe.sizingPreview.paperUnitsPreview, null);
assert.equal(safe.brokerGateway.submissionAttempted, false);
assert.deepEqual(safe.authority, authorityNone);

const sized = evaluateTradeProposal(safeProposal, {
  sizingPolicy: {
    mode: "paper_preview",
    configured: true,
    riskBudgetUsd: 300,
    pointValueUsd: 2,
    maxUnits: 5,
    operatorConfigured: true,
    llmMayOverride: false
  }
});
assert.equal(sized.sizingPreview.status, "paper_preview_only");
assert.equal(sized.sizingPreview.paperUnitsPreview, 5);
assert.equal(sized.sizingPreview.executable, false);
assert.equal(sized.liveExecutionAllowed, false);

for (const unsafePatch of [
  { rawCandles: [{ open: 1, high: 2, low: 0, close: 1.5 }] },
  { accountData: { balance: 50_000 } },
  { orders: [{ id: "order" }] },
  { positions: [{ id: "position" }] },
  { apiKey: "secret" },
  { rationale: "Place order now" },
  { autoApplyAllowed: true },
  { authority: { ...authorityNone, executionAuthority: "live" } }
]) {
  const blocked = evaluateTradeProposal({ ...safeProposal, ...unsafePatch });
  assert.equal(blocked.status, "blocked", `Unsafe patch should be blocked: ${JSON.stringify(unsafePatch)}`);
  assert.equal(blocked.brokerGateway.submissionAttempted, false);
  assert.deepEqual(blocked.authority, authorityNone);
}

const invalidGeometry = evaluateTradeProposal({ ...safeProposal, stop: 28500 });
assert.equal(invalidGeometry.status, "blocked");
assert(invalidGeometry.blockers.includes("invalid_price_order"));

const lowRr = evaluateTradeProposal({ ...safeProposal, targets: [28530] });
assert.equal(lowRr.status, "blocked");
assert(lowRr.blockers.includes("minimum_rr_not_met"));

const missingChain = evaluateTradeProposal({ ...safeProposal, validationChainId: "" });
assert.equal(missingChain.status, "blocked");
assert(missingChain.blockers.includes("validation_chain_reference_required"));

const unknownProfile = evaluateTradeProposal({ ...safeProposal, strategyProfileId: "new_unvalidated_profile" });
assert.equal(unknownProfile.status, "blocked");
assert(unknownProfile.blockers.includes("strategy_profile_not_allowlisted"));

assert.equal(scanTradeProposalForForbiddenContent(safeProposal).length, 0);
const serializedSafe = JSON.stringify(safe);
for (const forbidden of ["rawCandles", "accountData", "orders", "positions", "apiKey"]) {
  assert(!serializedSafe.includes(forbidden), `Compact evaluation must exclude ${forbidden}.`);
}

const status = buildTradeProposalControlPlaneStatus();
assert.equal(status.stage, "research_validation");
assert.deepEqual(status.authority, authorityNone);
assert(status.brokerGatewayRole.includes("disabled_by_default"));
assert(status.brokerGatewayRole.includes("independent_mt5_demo_gateway"));

const client = new Client({ name: "gotrader-trade-proposal-test", version: "1.0.0" });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [path.join(root, "scripts", "gotrader-trade-proposal-mcp.mjs")],
  cwd: root,
  stderr: "pipe"
});

try {
  await client.connect(transport);
  const listed = await client.listTools();
  const toolNames = listed.tools.map((tool) => tool.name).sort();
  assert.deepEqual(toolNames, [
    "gotrader_control_plane_status",
    "gotrader_list_mt5_demo_receipts",
    "gotrader_list_paper_demo_receipts",
    "gotrader_list_recent_trade_proposals",
    "gotrader_paper_demo_gateway_status",
    "gotrader_prepare_paper_demo_simulation",
    "gotrader_propose_trade_evaluation"
  ]);
  assert(toolNames.every((name) => !/(order|position|account|execute|broker_mutation)/i.test(name)));

  const statusCall = await client.callTool({ name: "gotrader_control_plane_status", arguments: {} });
  assert.equal(statusCall.structuredContent.authority.executionAuthority, "none");
  assert.equal(statusCall.structuredContent.authority.brokerAuthority, "none");

  const proposalCall = await client.callTool({
    name: "gotrader_propose_trade_evaluation",
    arguments: { proposal: safeProposal }
  });
  assert.equal(proposalCall.isError, false);
  assert.equal(proposalCall.structuredContent.status, "queued_for_deterministic_validation");
  assert.equal(proposalCall.structuredContent.brokerGateway.submissionAttempted, false);
  assert.deepEqual(proposalCall.structuredContent.authority, authorityNone);

  const unsafeCall = await client.callTool({
    name: "gotrader_propose_trade_evaluation",
    arguments: { proposal: { ...safeProposal, account: { balance: 100_000 } } }
  });
  assert.equal(unsafeCall.isError, true);
  assert.equal(unsafeCall.structuredContent.status, "blocked");
  assert(unsafeCall.structuredContent.blockedFields.some((field) => field.includes("account")));
} finally {
  await client.close();
}

console.log(
  JSON.stringify(
    {
      status: "passed",
      tools: [
        "gotrader_control_plane_status",
        "gotrader_propose_trade_evaluation",
        "gotrader_list_recent_trade_proposals",
        "gotrader_list_mt5_demo_receipts",
        "gotrader_list_paper_demo_receipts",
        "gotrader_paper_demo_gateway_status",
        "gotrader_prepare_paper_demo_simulation"
      ],
      safeProposalStatus: safe.status,
      sizingDefault: safe.sizingPreview.status,
      configuredSizing: sized.sizingPreview.status,
      brokerSubmissionAttempted: false,
      authority: authorityNone
    },
    null,
    2
  )
);
