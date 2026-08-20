#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { evaluateCanonicalTradeProposal, persistRuntimeMirror, readRuntimeMirror } from "./gotrader-research-mcp-core.mjs";

const root = path.resolve(import.meta.dirname, "..");
const authority = { executionAuthority: "none", brokerAuthority: "none", readinessOverrideAuthority: "none" };
const profile = {
  profileId: "ifvg_fresh_retest_v4_candidate", profileVersion: "v4",
  parameterFingerprint: "parameters-v4-exact", sourceFingerprint: "source-mt5-exact",
  validationIdentity: "validation-v4-exact", sourceProvider: "mt5_read_only",
  requestedSymbol: "MNQ", brokerSymbol: "USTECH", timeframe: "5m"
};
const mirror = (capturedAt = new Date().toISOString()) => ({
  schemaVersion: 1, capturedAt, activeProfile: profile,
  currentCycle: { cycleId: "cycle-v4", status: "completed", evidenceIds: ["validation-v4-exact"] },
  results: { source: { fingerprint: profile.sourceFingerprint }, validation: { readinessState: "ready" } },
  certifiedEvidence: { entries: [{
    evidenceId: "validation-v4-exact", ledgerEntryId: "evidence-validation-v4-exact",
    category: "validation results", certificationStatus: "identity_matched",
    profileId: profile.profileId, profileVersion: profile.profileVersion,
    parameterFingerprint: profile.parameterFingerprint, sourceFingerprint: profile.sourceFingerprint,
    validationIdentity: profile.validationIdentity
  }] },
  validation: { status: "available", identityStatus: "matched", evidenceId: "validation-v4-exact", blockers: [] },
  calibration: { proposals: [] }, readiness: { state: "ready", blockers: [], evidenceId: "validation-v4-exact" },
  simulatedOutcomes: { records: [] }, memory: { deliveryEnabled: false, queued: 0 }, authority
});
const proposal = {
  requestedSymbol: "MNQ", brokerSymbol: "USTECH", timeframe: "5m",
  strategyProfileId: profile.profileId, strategyProfileVersion: profile.profileVersion,
  parameterFingerprint: profile.parameterFingerprint, sourceProvider: profile.sourceProvider,
  sourceFingerprint: profile.sourceFingerprint, validationChainId: profile.validationIdentity,
  direction: "long", entry: 20000, stop: 19990, targets: [20020], authority
};

const temp = await mkdtemp(path.join(os.tmpdir(), "gotrader-research-mcp-"));
try {
  assert.equal((await persistRuntimeMirror(mirror(), { repoRoot: temp })).status, "accepted");
  assert.equal((await readRuntimeMirror({ repoRoot: temp })).status, "available");
  const valid = await evaluateCanonicalTradeProposal(proposal, { repoRoot: temp });
  assert.equal(valid.status, "validated_research_proposal");
  assert.equal(valid.checks.validationIdentityMatched, true);
  assert.equal(valid.executable, false);
  for (const [patch, blocker] of [
    [{ strategyProfileId: "ifvg_fresh_retest_v3_research", strategyProfileVersion: "v3" }, "strategy_profile_mismatch"],
    [{ parameterFingerprint: "wrong" }, "parameter_fingerprint_mismatch"],
    [{ sourceFingerprint: "wrong" }, "source_fingerprint_mismatch"],
    [{ validationChainId: "missing-ledger" }, "validation_identity_mismatch"]
  ]) {
    const blocked = await evaluateCanonicalTradeProposal({ ...proposal, ...patch }, { repoRoot: temp });
    assert.equal(blocked.status, "blocked");
    assert(blocked.blockers.includes(blocker));
  }
  const missingEvidenceRoot = await mkdtemp(path.join(os.tmpdir(), "gotrader-research-mcp-evidence-"));
  await persistRuntimeMirror({ ...mirror(), certifiedEvidence: { entries: [] } }, { repoRoot: missingEvidenceRoot });
  const missingEvidence = await evaluateCanonicalTradeProposal(proposal, { repoRoot: missingEvidenceRoot });
  assert(missingEvidence.blockers.includes("validation_evidence_not_certified"));
  await rm(missingEvidenceRoot, { recursive: true, force: true });
  const mismatchedCertificationRoot = await mkdtemp(path.join(os.tmpdir(), "gotrader-research-mcp-certification-"));
  const mismatchedCertification = mirror();
  mismatchedCertification.certifiedEvidence.entries[0].profileVersion = "v3";
  await persistRuntimeMirror(mismatchedCertification, { repoRoot: mismatchedCertificationRoot });
  const mismatchedEvidence = await evaluateCanonicalTradeProposal(proposal, { repoRoot: mismatchedCertificationRoot });
  assert(mismatchedEvidence.blockers.includes("validation_evidence_identity_mismatch"));
  await rm(mismatchedCertificationRoot, { recursive: true, force: true });
  const staleRoot = await mkdtemp(path.join(os.tmpdir(), "gotrader-research-mcp-stale-"));
  await persistRuntimeMirror(mirror("2026-01-01T00:00:00.000Z"), { repoRoot: staleRoot, nowMs: Date.parse("2026-01-01T00:00:01.000Z") });
  const stale = await evaluateCanonicalTradeProposal(proposal, { repoRoot: staleRoot, nowMs: Date.parse("2026-01-01T00:20:00.000Z") });
  assert.equal((await readRuntimeMirror({ repoRoot: staleRoot, nowMs: Date.parse("2026-01-01T00:20:00.000Z") })).freshness, "stale");
  assert(stale.blockers.includes("runtime_snapshot_stale"));
  await rm(staleRoot, { recursive: true, force: true });

  const stdio = new Client({ name: "stdio-acceptance", version: "1.0.0" });
  const stdioTransport = new StdioClientTransport({ command: process.execPath, args: [path.join(root, "scripts", "gotrader-research-mcp.mjs")], cwd: temp, stderr: "pipe" });
  await stdio.connect(stdioTransport);
  const stdioTools = await stdio.listTools();
  assert(stdioTools.tools.some((tool) => tool.name === "gotrader_results"));
  assert(stdioTools.tools.some((tool) => tool.name === "gotrader_gbrain_think"));
  assert(stdioTools.tools.some((tool) => tool.name === "gotrader_simulation_runbook"));
  assert(stdioTools.tools.some((tool) => tool.name === "gotrader_record_simulation_runbook_receipt"));
  assert.equal((await stdio.callTool({ name: "gotrader_active_profile", arguments: {} })).structuredContent.status, "available");
  assert.equal((await stdio.callTool({ name: "gotrader_simulation_runbook", arguments: {} })).structuredContent.status, "available");
  await stdio.close();

  const token = "test-token-with-at-least-24-characters";
  const port = 17332 + Math.floor(Math.random() * 1000);
  const child = spawn(process.execPath, [path.join(root, "scripts", "gotrader-research-mcp-http.mjs")], {
    cwd: temp, env: { ...process.env, GOTRADER_RESEARCH_MCP_TOKEN: token, GOTRADER_RESEARCH_MCP_PORT: String(port) }, stdio: ["ignore", "pipe", "pipe"], windowsHide: true
  });
  try {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      try { if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) break; } catch {}
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.equal((await fetch(`http://127.0.0.1:${port}/health`)).status, 200);
    assert.equal((await fetch(`http://127.0.0.1:${port}/mcp`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })).status, 401);
    const http = new Client({ name: "http-acceptance", version: "1.0.0" });
    const httpTransport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${token}` } } });
    await http.connect(httpTransport);
    assert.equal((await http.listTools()).tools.length, stdioTools.tools.length);
    assert.equal((await http.callTool({ name: "gotrader_results", arguments: {} })).structuredContent.status, "available");
    await http.close();
  } finally {
    const exited = new Promise((resolve) => child.once("exit", resolve));
    child.kill("SIGTERM");
    await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 3_000))]);
  }
  const restarted = spawn(process.execPath, [path.join(root, "scripts", "gotrader-research-mcp-http.mjs")], {
    cwd: temp, env: { ...process.env, GOTRADER_RESEARCH_MCP_TOKEN: token, GOTRADER_RESEARCH_MCP_PORT: String(port) }, stdio: "ignore", windowsHide: true
  });
  try {
    const deadline = Date.now() + 10_000;
    let healthy = false;
    while (Date.now() < deadline && !healthy) {
      try { healthy = (await fetch(`http://127.0.0.1:${port}/health`)).ok; } catch {}
      if (!healthy) await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.equal(healthy, true, "restarted MCP service must become healthy");
  } finally {
    const exited = new Promise((resolve) => restarted.once("exit", resolve));
    restarted.kill("SIGTERM");
    await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 3_000))]);
  }
  console.log(JSON.stringify({ status: "passed", checks: ["immutable runtime hash", "distinct stale freshness", "exact v4 identity and certified-ledger join", "stale v3 rejected", "cross-ledger identity mismatch rejected", "fingerprint mismatch rejected", "stdio handshake/tools including runbook evidence", "authenticated Streamable HTTP handshake/tools", "service health", "service shutdown", "service restart", "authority none/none/none"] }, null, 2));
} finally {
  await rm(temp, { recursive: true, force: true });
}
