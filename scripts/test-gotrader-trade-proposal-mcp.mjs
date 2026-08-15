import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import {
  appendTradeProposalAudit,
  buildTradeProposalControlPlaneStatus,
  evaluateTradeProposal,
  scanTradeProposalForForbiddenContent,
  TRADE_PROPOSAL_MCP_ALLOWED_PROFILES
} from "./gotrader-trade-proposal-core.mjs";
import { loadAuthoritativeMcpContext } from "./gotrader-mcp-context-core.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const tempRoot = await mkdtemp(path.join(os.tmpdir(), "gotrader-mcp-hardening-"));
const runtimeDir = path.join(tempRoot, ".gotrader");
await mkdir(runtimeDir, { recursive: true });

const authorityNone = {
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
};
const fingerprint = "mt5_read_only|MNQ|USTECH|5m|34989|start|1|end|2";
const validationReport = {
  status: "completed",
  source: {
    provider: "mt5_read_only",
    requestedSymbol: "MNQ",
    brokerSymbol: "USTECH",
    timeframe: "5m",
    fingerprint,
    normalizedCandleCount: 34_989,
    firstTimestamp: "2026-01-01T00:00:00.000Z",
    lastTimestamp: "2026-06-30T23:55:00.000Z",
    safetyAuthority: authorityNone
  },
  candidates: [
    {
      candidateId: "ifvg_v3_candidate_test",
      candidateFamily: "ifvg_fresh_retest_v3_research",
      validationReadinessStatus: "paper_demo_candidate",
      walkForwardVerdict: "passed",
      temporalRobustness: {
        summary: { trades: 172, uniqueTradingDates: 95 },
        rolling: { activeWindows: 11, positiveWindows: 11 },
        monteCarlo: { robustness: "strong" }
      },
      safetyAuthority: authorityNone
    }
  ],
  safetyAuthority: authorityNone
};
const forwardReport = {
  profileId: "ifvg_fresh_retest_v3_research",
  completedForwardOutcomes: 40,
  independentDates: 20,
  forwardWindows: 2,
  reassessmentEligible: true,
  recommendation: "reassess_for_paper_demo",
  authority: authorityNone
};
await writeFile(
  path.join(runtimeDir, "ifvg-v3-profile-oos.json"),
  JSON.stringify(validationReport),
  "utf8"
);
await writeFile(
  path.join(runtimeDir, "ifvg-v3-forward-evidence.json"),
  JSON.stringify(forwardReport),
  "utf8"
);

const authoritativeContext = await loadAuthoritativeMcpContext({
  allowedProfiles: TRADE_PROPOSAL_MCP_ALLOWED_PROFILES,
  repoRoot: tempRoot
});
assert.equal(authoritativeContext.status, "available");
assert.equal(authoritativeContext.source.fingerprint, fingerprint);
assert.match(authoritativeContext.profiles[0].validationChainId, /^validation_binding_v1_/);
assert.deepEqual(authoritativeContext.authority, authorityNone);
assert.equal(JSON.stringify(authoritativeContext).includes('"candles"'), false);
const staleContext = await loadAuthoritativeMcpContext({
  allowedProfiles: TRADE_PROPOSAL_MCP_ALLOWED_PROFILES,
  repoRoot: tempRoot,
  now: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString()
});
assert.equal(staleContext.status, "stale");
assert.equal(staleContext.freshness.fresh, false);
assert(staleContext.blockers.includes("authoritative_validation_stale"));

const safeProposal = {
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  timeframe: "5m",
  strategyProfileId: "ifvg_fresh_retest_v3_research",
  direction: "short",
  entry: 28570,
  stop: 28600,
  targets: [28510, 28460],
  rationale: "IFVG fresh retest research hypothesis.",
  autoApplyAllowed: false,
  authority: authorityNone
};
const baseOptions = {
  authoritativeContext,
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
};

const safe = evaluateTradeProposal(safeProposal, baseOptions);
assert.equal(safe.status, "queued_for_deterministic_validation");
assert.equal(safe.deterministicChecks.validationContext, "authoritative_match");
assert.equal(safe.compactProposal.sourceFingerprint, fingerprint);
assert.equal(
  safe.compactProposal.validationChainId,
  authoritativeContext.profiles[0].validationChainId
);
assert.equal(safe.sizingPreview.status, "blocked_policy_not_configured");
assert.equal(safe.brokerGateway.submissionAttempted, false);
assert.deepEqual(safe.authority, authorityNone);

const missingEvidence = evaluateTradeProposal(safeProposal);
assert.equal(missingEvidence.status, "blocked");
assert(missingEvidence.blockers.includes("authoritative_context_required"));

const mismatchedFingerprint = evaluateTradeProposal(
  { ...safeProposal, sourceFingerprint: `${fingerprint}_stale` },
  baseOptions
);
assert.equal(mismatchedFingerprint.status, "blocked");
assert(mismatchedFingerprint.blockers.includes("claimed_source_fingerprint_mismatch"));

const mismatchedChain = evaluateTradeProposal(
  { ...safeProposal, validationChainId: "validation_binding_v1_stale_reference" },
  baseOptions
);
assert.equal(mismatchedChain.status, "blocked");
assert(mismatchedChain.blockers.includes("claimed_validation_chain_mismatch"));

const sized = evaluateTradeProposal(safeProposal, {
  ...baseOptions,
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
  const blocked = evaluateTradeProposal({ ...safeProposal, ...unsafePatch }, baseOptions);
  assert.equal(blocked.status, "blocked", `Unsafe patch should be blocked: ${JSON.stringify(unsafePatch)}`);
  assert.equal(blocked.brokerGateway.submissionAttempted, false);
  assert.deepEqual(blocked.authority, authorityNone);
}

const invalidGeometry = evaluateTradeProposal({ ...safeProposal, stop: 28500 }, baseOptions);
assert.equal(invalidGeometry.status, "blocked");
assert(invalidGeometry.blockers.includes("invalid_price_order"));

const lowRr = evaluateTradeProposal({ ...safeProposal, targets: [28530] }, baseOptions);
assert.equal(lowRr.status, "blocked");
assert(lowRr.blockers.includes("minimum_rr_not_met"));

assert.equal(scanTradeProposalForForbiddenContent(safeProposal).length, 0);
const serializedSafe = JSON.stringify(safe);
for (const forbidden of ["rawCandles", "accountData", "orders", "positions", "apiKey"]) {
  assert(!serializedSafe.includes(forbidden), `Compact evaluation must exclude ${forbidden}.`);
}

await Promise.all(
  Array.from({ length: 24 }, (_, index) =>
    appendTradeProposalAudit(
      {
        ...safe,
        proposalId: `concurrent_proposal_${index}`,
        audit: {
          agentId: `agent_${index % 3}`,
          sessionId: `session_${index % 3}`,
          correlationId: `correlation_${index}`,
          transport: "stdio"
        }
      },
      { repoRoot: tempRoot }
    )
  )
);
const ledgerLines = (await readFile(path.join(runtimeDir, "mcp-trade-proposals.jsonl"), "utf8"))
  .trim()
  .split(/\r?\n/);
assert.equal(ledgerLines.length, 24);
assert.equal(ledgerLines.every((line) => Boolean(JSON.parse(line).proposalId)), true);

const status = buildTradeProposalControlPlaneStatus({ authoritativeContext });
assert.equal(status.stage, "research_validation");
assert.equal(status.authoritativeContext.validationIdentityBound, true);
assert.deepEqual(status.authority, authorityNone);

const client = new Client({ name: "gotrader-trade-proposal-test", version: "1.0.0" });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [path.join(root, "scripts", "gotrader-trade-proposal-mcp.mjs")],
  cwd: tempRoot,
  env: {
    ...process.env,
    GOTRADER_MCP_AGENT_ID: "test_codex_agent",
    GOTRADER_REPO_ROOT: tempRoot
  },
  stderr: "pipe"
});

try {
  await client.connect(transport);
  const listed = await client.listTools();
  const toolNames = listed.tools.map((tool) => tool.name).sort();
  assert.deepEqual(toolNames, [
    "gotrader_agent_interface_status",
    "gotrader_control_plane_status",
    "gotrader_get_current_cycle",
    "gotrader_get_current_research_context",
    "gotrader_get_results",
    "gotrader_get_validation_chain",
    "gotrader_list_certified_profiles",
    "gotrader_list_eligible_profiles",
    "gotrader_list_mt5_demo_receipts",
    "gotrader_list_paper_demo_receipts",
    "gotrader_list_recent_trade_proposals",
    "gotrader_paper_demo_gateway_status",
    "gotrader_prepare_paper_demo_simulation",
    "gotrader_propose_trade_evaluation"
  ]);
  assert(toolNames.every((name) => !/(order|position|account|execute|broker_mutation)/i.test(name)));

  const contextCall = await client.callTool({
    name: "gotrader_get_current_research_context",
    arguments: {}
  });
  assert.equal(contextCall.structuredContent.status, "available");
  assert.equal(contextCall.structuredContent.source.fingerprint, fingerprint);

  const chainCall = await client.callTool({
    name: "gotrader_get_validation_chain",
    arguments: { strategyProfileId: "ifvg_fresh_retest_v3_research" }
  });
  assert.equal(chainCall.structuredContent.status, "resolved");

  const proposalCall = await client.callTool({
    name: "gotrader_propose_trade_evaluation",
    arguments: { proposal: safeProposal }
  });
  assert.equal(proposalCall.isError, false);
  assert.equal(proposalCall.structuredContent.status, "queued_for_deterministic_validation");
  assert.equal(proposalCall.structuredContent.audit.agentId, "test_codex_agent");
  assert.equal(proposalCall.structuredContent.compactProposal.sourceFingerprint, fingerprint);
  assert.deepEqual(proposalCall.structuredContent.authority, authorityNone);

  const staleCall = await client.callTool({
    name: "gotrader_propose_trade_evaluation",
    arguments: { proposal: { ...safeProposal, sourceFingerprint: `${fingerprint}_stale` } }
  });
  assert.equal(staleCall.isError, true);
  assert(staleCall.structuredContent.blockers.includes("claimed_source_fingerprint_mismatch"));

  const unsafeCall = await client.callTool({
    name: "gotrader_propose_trade_evaluation",
    arguments: { proposal: { ...safeProposal, account: { balance: 100_000 } } }
  });
  assert.equal(unsafeCall.isError, true);
} finally {
  await client.close();
  await rm(tempRoot, { recursive: true, force: true });
}

console.log(
  JSON.stringify(
    {
      status: "passed",
      authoritativeIdentityBound: true,
      concurrentAuditWrites: ledgerLines.length,
      tools: 14,
      safeProposalStatus: safe.status,
      brokerSubmissionAttempted: false,
      authority: authorityNone
    },
    null,
    2
  )
);
