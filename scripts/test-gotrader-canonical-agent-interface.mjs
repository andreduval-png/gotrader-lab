import assert from "node:assert/strict";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  createAgentProjectionReader,
  evaluateProjectionFreshness,
  GOTRADER_AGENT_PROJECTION_CONTRACT,
  GOTRADER_AGENT_PROJECTION_VERSION,
  validateAgentProjection
} from "./gotrader-agent-projection-core.mjs";
import { discoverCertifiedProfiles } from "./gotrader-certified-profile-core.mjs";
import { GOTRADER_AGENT_PROVENANCE_CONTRACT } from "./gotrader-agent-provenance-core.mjs";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const testRoot = path.join(repoRoot, ".gotrader", `canonical-agent-interface-test-${Date.now()}`);
const authority = {
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
};

const reservePort = () => new Promise((resolve, reject) => {
  const server = net.createServer();
  server.on("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    server.close(() => resolve(port));
  });
});

const waitForHealth = async (endpoint, output) => {
  const deadline = Date.now() + 12_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${endpoint}/health`);
      if (response.ok) return;
    } catch {
      // Starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Sidecar did not start. ${output.join("")}`);
};

const port = await reservePort();
const endpoint = `http://127.0.0.1:${port}`;
const output = [];
let interfaceClient;
let memoryClient;
const child = spawn(process.execPath, [path.join(repoRoot, "scripts", "gbrain-local-sidecar.mjs")], {
  cwd: repoRoot,
  env: {
    ...process.env,
    GOTRADER_GBRAIN_PORT: String(port),
    GOTRADER_GBRAIN_DATA_DIR: path.join(testRoot, "sidecar"),
    GBRAIN_COMMAND: path.join(testRoot, "missing-gbrain")
  },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true
});
child.stdout.on("data", (chunk) => output.push(chunk.toString()));
child.stderr.on("data", (chunk) => output.push(chunk.toString()));

try {
  await waitForHealth(endpoint, output);
  const now = Date.now();
  const base = {
    contract: GOTRADER_AGENT_PROJECTION_CONTRACT,
    version: GOTRADER_AGENT_PROJECTION_VERSION,
    generatedAt: new Date(now).toISOString(),
    observedAt: new Date(now).toISOString(),
    identities: { cycleId: "cycle_fixture", sourceFingerprint: "source_fixture" },
    authority
  };
  const currentCycle = {
    ...base,
    projectionType: "current_cycle",
    payload: { cycleId: "cycle_fixture", status: "completed", blockers: [] }
  };
  assert.equal(validateAgentProjection(currentCycle, "current_cycle").valid, true);
  assert.equal(validateAgentProjection({ ...currentCycle, rawCandles: [] }, "current_cycle").valid, false);
  assert.equal(evaluateProjectionFreshness({ generatedAt: base.generatedAt, maxAgeMs: 1_000, now }).fresh, true);
  assert.equal(evaluateProjectionFreshness({ generatedAt: base.generatedAt, maxAgeMs: 1_000, now: now + 2_000 }).status, "stale");
  assert.equal(evaluateProjectionFreshness({ generatedAt: new Date(now + 60_000).toISOString(), maxAgeMs: 1_000, now }).status, "future");

  for (const [route, projection] of [
    ["current-cycle", currentCycle],
    ["results", { ...base, projectionType: "results", payload: { generatedAt: base.generatedAt, validation: { readinessState: "not_ready" } } }]
  ]) {
    const response = await fetch(`${endpoint}/v1/projections/${route}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(projection)
    });
    assert.equal(response.ok, true);
  }
  const reader = createAgentProjectionReader({ baseUrl: endpoint, now: () => now });
  const cycleResult = await reader.readCurrentCycle();
  const resultsResult = await reader.readResults();
  assert.equal(cycleResult.status, "available");
  assert.equal(resultsResult.status, "available");
  assert.equal(cycleResult.provenance.contract, GOTRADER_AGENT_PROVENANCE_CONTRACT);
  assert.deepEqual(cycleResult.authority, authority);

  const lrsRoot = path.join(testRoot, "lrs");
  const reportPath = path.join(lrsRoot, ".gotrader", "liquidity-reclaim-scalper-v1", "certified-baseline-v2", "baseline-report.json");
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify({
    schemaVersion: "gotrader-lrs-certified-descriptive-baseline-v1",
    strategyId: "liquidity_reclaim_scalper_v1",
    profileId: "liquidity_reclaim_scalper_v1_base_research",
    parameterHash: "sha256:parameter",
    certificateId: "sha256:certificate",
    datasetId: "sha256:dataset",
    reportId: "sha256:report",
    status: "passed",
    startUtc: "2024-08-01T00:00:00.000Z",
    endUtc: "2026-08-01T00:00:00.000Z",
    researchValidated: false,
    productionAdoptionAllowed: false,
    rawCandlesSerialized: false,
    mt5Contacted: false,
    authority,
    metrics: { records: 10, averageNetR: -0.2, netWinRate: 0.4, maxDrawdownR: 3, profitFactor: 0.8 }
  }));
  const discovery = await discoverCertifiedProfiles({ env: { GOTRADER_CERTIFIED_EVIDENCE_ROOTS: lrsRoot } });
  assert.equal(discovery.status, "available");
  assert.equal(discovery.profiles[0].profileId, "liquidity_reclaim_scalper_v1_base_research");
  assert.equal(discovery.profiles[0].proposalAllowed, false);
  assert.equal(discovery.profiles[0].researchValidated, false);
  assert.equal(discovery.provenance.contract, GOTRADER_AGENT_PROVENANCE_CONTRACT);

  const interfaceTransport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(repoRoot, "scripts", "gotrader-trade-proposal-mcp.mjs")],
    cwd: repoRoot,
    env: {
      ...process.env,
      GOTRADER_AGENT_INTERFACE_URL: endpoint,
      GOTRADER_CERTIFIED_EVIDENCE_ROOTS: lrsRoot,
      GOTRADER_REPO_ROOT: testRoot
    },
    stderr: "pipe"
  });
  interfaceClient = new Client({ name: "canonical-agent-interface-test", version: "1.0.0" });
  await interfaceClient.connect(interfaceTransport);
  const listed = await interfaceClient.listTools();
  for (const tool of [
    "gotrader_agent_interface_status",
    "gotrader_get_current_cycle",
    "gotrader_get_results",
    "gotrader_list_certified_profiles"
  ]) assert(listed.tools.some((item) => item.name === tool));
  const mcpCycle = await interfaceClient.callTool({ name: "gotrader_get_current_cycle", arguments: {} });
  const mcpResults = await interfaceClient.callTool({ name: "gotrader_get_results", arguments: {} });
  const mcpProfiles = await interfaceClient.callTool({ name: "gotrader_list_certified_profiles", arguments: {} });
  assert.equal(mcpCycle.isError, false);
  assert.equal(mcpResults.isError, false);
  assert.equal(mcpProfiles.structuredContent.profiles.some((profile) => profile.profileId === "liquidity_reclaim_scalper_v1_base_research"), true);

  const memoryTransport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(repoRoot, "scripts", "gotrader-research-memory-mcp.mjs")],
    cwd: repoRoot,
    env: { ...process.env, GOTRADER_GBRAIN_URL: endpoint },
    stderr: "pipe"
  });
  memoryClient = new Client({ name: "canonical-agent-memory-test", version: "1.0.0" });
  await memoryClient.connect(memoryTransport);
  const memoryStatus = await memoryClient.callTool({
    name: "gotrader_research_memory_status",
    arguments: { includeCounts: true }
  });
  assert.equal(memoryStatus.isError, false);
  assert.equal(memoryStatus.structuredContent.provenance.contract, GOTRADER_AGENT_PROVENANCE_CONTRACT);
  assert.equal(mcpCycle.structuredContent.provenance.contract, GOTRADER_AGENT_PROVENANCE_CONTRACT);
  assert.equal(memoryStatus.structuredContent.provenance.interface, mcpCycle.structuredContent.provenance.interface);

  console.log(JSON.stringify({
    status: "passed",
    projections: [cycleResult.status, resultsResult.status],
    certifiedProfiles: discovery.count,
    canonicalTools: listed.tools.length,
    memoryStatus: memoryStatus.structuredContent.status,
    provenanceContract: GOTRADER_AGENT_PROVENANCE_CONTRACT,
    authority
  }, null, 2));
} finally {
  await interfaceClient?.close();
  await memoryClient?.close();
  child.kill();
  await fs.rm(testRoot, { recursive: true, force: true });
}
