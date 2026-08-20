import assert from "node:assert/strict";
import { appendFile, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  persistRuntimeMirror,
  readSimulationRunbookEvidence,
  recordSimulationRunbookReceipt
} from "./gotrader-research-mcp-core.mjs";

const authority = {
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
};
const activeProfile = {
  profileId: "ifvg_fresh_retest_v4_research",
  profileVersion: "v4",
  parameterFingerprint: "params-v4",
  sourceFingerprint: "source-v4",
  validationIdentity: "validation-v4",
  sourceProvider: "mt5_read_only",
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  timeframe: "5m"
};
const mirror = (cycleId, capturedAt) => ({
  schemaVersion: 1,
  capturedAt,
  activeProfile,
  currentCycle: {
    cycleId,
    status: "completed",
    completedAt: capturedAt,
    thesis: { signal: "BUY" },
    evidenceIds: ["validation-v4"]
  },
  results: {},
  certifiedEvidence: { entries: [] },
  validation: { status: "available", identityStatus: "matched", evidenceId: "validation-v4" },
  calibration: { proposals: [] },
  readiness: { state: "Not Ready", blockers: ["runbook-complete"] },
  simulatedOutcomes: { records: [] },
  memory: { deliveryEnabled: false, queued: 0 },
  authority
});

const root = await mkdtemp(path.join(os.tmpdir(), "gotrader-runbook-evidence-"));
try {
  const firstNow = Date.parse("2026-08-18T12:00:00.000Z");
  assert.equal((await persistRuntimeMirror(mirror("cycle-1", "2026-08-18T11:59:59.000Z"), { repoRoot: root, nowMs: firstNow })).status, "accepted");
  let state = await readSimulationRunbookEvidence({ repoRoot: root, nowMs: firstNow });
  assert.equal(state.status, "available");
  assert.equal(state.completedChecks, 2);
  assert(state.blockers.includes("runbook_evidence_missing:positionsZero"));

  const wrongCycle = await recordSimulationRunbookReceipt({
    cycleId: "cycle-old",
    receiptType: "handoff",
    observedAt: "2026-08-18T11:59:58.000Z",
    handoffExported: true,
    savedLatestHandoff: true,
    readerConversionTested: true
  }, { repoRoot: root, nowMs: firstNow });
  assert.equal(wrongCycle.status, "blocked");
  assert(wrongCycle.blockers.includes("runbook_cycle_identity_mismatch"));

  assert.equal((await recordSimulationRunbookReceipt({
    cycleId: "cycle-1",
    receiptType: "handoff",
    observedAt: "2026-08-18T11:59:58.000Z",
    handoffExported: true,
    savedLatestHandoff: true,
    readerConversionTested: true,
    detail: "Reader accepted the exact exported handoff."
  }, { repoRoot: root, nowMs: firstNow })).status, "accepted");

  const nonzero = await recordSimulationRunbookReceipt({
    cycleId: "cycle-1",
    receiptType: "scheduler",
    observedAt: "2026-08-18T11:59:59.000Z",
    schedulerInvocationId: "scheduler-1",
    schedulerOneCycleCompleted: true,
    brokerExecutionSkipped: true,
    positions: 1,
    trades: 0,
    shutdownComplete: true
  }, { repoRoot: root, nowMs: firstNow });
  assert.equal(nonzero.status, "blocked");
  assert(nonzero.blockers.includes("positions_not_zero"));
  state = await readSimulationRunbookEvidence({ repoRoot: root, nowMs: firstNow });
  assert.equal(state.completedChecks, 5, "a rejected scheduler receipt must not certify any scheduler check");

  assert.equal((await recordSimulationRunbookReceipt({
    cycleId: "cycle-1",
    receiptType: "scheduler",
    observedAt: "2026-08-18T11:59:59.000Z",
    schedulerInvocationId: "scheduler-2",
    schedulerOneCycleCompleted: true,
    brokerExecutionSkipped: true,
    positions: 0,
    trades: 0,
    shutdownComplete: true
  }, { repoRoot: root, nowMs: firstNow })).status, "accepted");
  state = await readSimulationRunbookEvidence({ repoRoot: root, nowMs: firstNow });
  assert.equal(state.completedChecks, 10);
  assert.equal(typeof state.verifiedAt, "string");

  const secondNow = Date.parse("2026-08-18T12:01:00.000Z");
  await persistRuntimeMirror(mirror("cycle-2", "2026-08-18T12:00:59.000Z"), { repoRoot: root, nowMs: secondNow });
  state = await readSimulationRunbookEvidence({ repoRoot: root, nowMs: secondNow });
  assert.equal(state.cycleId, "cycle-2");
  assert.equal(state.completedChecks, 2, "evidence from a prior cycle must not carry forward");
  assert.equal(state.verifiedAt, null);

  await appendFile(path.join(root, ".gotrader", "research-mcp", "simulation-runbook-evidence.jsonl"), `${JSON.stringify({ evidenceId: "sha256:bad", previousEvidenceId: null })}\n`, "utf8");
  state = await readSimulationRunbookEvidence({ repoRoot: root, nowMs: secondNow });
  assert.equal(state.status, "blocked");
  assert(state.blockers.includes("runbook_evidence_hash_mismatch"));
  assert(state.blockers.includes("runbook_evidence_chain_broken"));

  console.log(JSON.stringify({
    status: "passed",
    checks: [
      "research artifacts derive only two checks",
      "cycle identity mismatch rejected",
      "nonzero observations reject scheduler receipt",
      "accepted handoff and scheduler receipts complete 10/10",
      "prior-cycle evidence does not carry forward",
      "hash-chain tampering blocks canonical state"
    ]
  }, null, 2));
} finally {
  await rm(root, { recursive: true, force: true });
}
