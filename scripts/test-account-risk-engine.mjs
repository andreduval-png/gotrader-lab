import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  appendSimulationRiskLedger,
  buildRiskEvaluationRequest,
  buildSimulationAccountRiskStatus,
  buildSimulationAccountSnapshot,
  createInitialSimulationAccountRiskState,
  createSimulationRiskCommand,
  evaluateSimulationAccountRisk,
  executeSimulationRiskCommand,
  loadSimulationAccountRiskPolicy,
  loadSimulationAccountRiskState,
  refreshSimulationAccountHeartbeat,
  saveSimulationAccountRiskState,
  settleSimulationRiskReservation
} from "./gotrader-account-risk-core.mjs";

const authorityNone = {
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
};
const now = "2026-07-18T14:03:00.000Z";
const env = {
  GOTRADER_SIM_RISK_GOVERNOR_ENABLED: "true",
  GOTRADER_SIM_RISK_KILL_SWITCH: "false",
  GOTRADER_SIM_ACCOUNT_ID: "risk-engine-test",
  GOTRADER_SIM_STARTING_EQUITY_USD: "50000",
  GOTRADER_SIM_MAX_DAILY_LOSS_USD: "4000",
  GOTRADER_SIM_MAX_OPEN_RISK_USD: "1000",
  GOTRADER_SIM_MAX_RISK_PER_SCENARIO_USD: "300",
  GOTRADER_SIM_MAX_CONCURRENT_INTENTS: "3",
  GOTRADER_SIM_POINT_VALUE_USD: "2",
  GOTRADER_SIM_VOLUME_MIN: "1",
  GOTRADER_SIM_VOLUME_MAX: "5",
  GOTRADER_SIM_VOLUME_STEP: "1"
};
const policy = loadSimulationAccountRiskPolicy(env);
assert.equal(policy.enabled, true);
assert.equal(policy.killSwitchActive, false);
assert.equal(policy.configured, true);

const defaultPolicy = loadSimulationAccountRiskPolicy({});
assert.equal(defaultPolicy.enabled, false);
assert.equal(defaultPolicy.killSwitchActive, true);
assert.equal(defaultPolicy.configured, false);
assert.deepEqual(defaultPolicy.authority, authorityNone);

const proposalEvaluation = {
  proposalId: "proposal_ifvg_v3_test",
  compactProposal: {
    validationChainId: "validation_ifvg_v3_test",
    strategyProfileId: "ifvg_fresh_retest_v3_research",
    sourceProvider: "mt5_read_only",
    sourceFingerprint: "mt5_read_only|MNQ|USTECH|5m|1000|start|1|end|2",
    requestedSymbol: "MNQ",
    brokerSymbol: "USTECH",
    timeframe: "5m",
    direction: "short",
    entry: 28570,
    stop: 28600,
    targets: [28510]
  }
};
const request = buildRiskEvaluationRequest({
  now,
  proposalEvaluation,
  requestedRiskUsd: 300
});
const state = refreshSimulationAccountHeartbeat(
  createInitialSimulationAccountRiskState(policy, now),
  policy,
  now
);
const snapshot = buildSimulationAccountSnapshot(state, now);
const approved = evaluateSimulationAccountRisk({ now, policy, request, snapshot });
assert.equal(approved.status, "approved_for_simulation");
assert.equal(approved.riskState, "monitoring");
assert.equal(approved.sizing.simulationVolumePreview, 5);
assert.equal(approved.sizing.estimatedRiskUsd, 300);
assert.equal(approved.sizing.executable, false);
assert.equal(approved.brokerSubmissionAllowed, false);
assert.equal(approved.mt5Requirements.recomputeVolumeFromTerminalSymbolMetadata, true);
assert.equal(approved.mt5Requirements.trustSimulationVolumePreview, false);
assert.deepEqual(approved.authority, authorityNone);

const warningSnapshot = {
  ...snapshot,
  simulatedEquityUsd: 47000,
  dailyPeakEquityUsd: 50000
};
const warningDecision = evaluateSimulationAccountRisk({ now, policy, request, snapshot: warningSnapshot });
assert.equal(warningDecision.status, "approved_for_simulation");
assert.equal(warningDecision.riskState, "warning");

const preBreachSnapshot = {
  ...snapshot,
  simulatedEquityUsd: 46300,
  dailyPeakEquityUsd: 50000
};
const preBreachDecision = evaluateSimulationAccountRisk({ now, policy, request, snapshot: preBreachSnapshot });
assert.equal(preBreachDecision.status, "approved_for_simulation");
assert.equal(preBreachDecision.riskState, "pre_breach");

const lockedSnapshot = {
  ...snapshot,
  simulatedEquityUsd: 46000,
  dailyPeakEquityUsd: 50000
};
const lockedDecision = evaluateSimulationAccountRisk({ now, policy, request, snapshot: lockedSnapshot });
assert.equal(lockedDecision.status, "blocked");
assert.equal(lockedDecision.riskState, "locked");
assert(lockedDecision.blockers.includes("simulation_daily_loss_limit_reached"));

const staleSnapshot = {
  ...snapshot,
  heartbeatAt: "2026-07-18T14:00:00.000Z"
};
const staleDecision = evaluateSimulationAccountRisk({ now, policy, request, snapshot: staleSnapshot });
assert.equal(staleDecision.status, "blocked");
assert.equal(staleDecision.riskState, "stale_data");
assert(staleDecision.blockers.includes("simulation_account_snapshot_stale"));

const corruptDecision = evaluateSimulationAccountRisk({
  now,
  policy,
  request,
  snapshot: { ...snapshot, openRiskUsd: -1 }
});
assert.equal(corruptDecision.status, "blocked");
assert.equal(corruptDecision.riskState, "unavailable");
assert(corruptDecision.blockers.includes("simulation_account_snapshot_invalid"));

const command = createSimulationRiskCommand({
  decision: approved,
  expiresAt: "2026-07-18T14:08:00.000Z",
  now,
  request
});
const reserved = executeSimulationRiskCommand({ command, now, policy, state });
assert.equal(reserved.acknowledgement.status, "simulation_risk_reserved");
assert.equal(reserved.acknowledgement.brokerCallMade, false);
assert.equal(reserved.state.openRiskUsd, 300);
assert.equal(reserved.state.activeReservations.length, 1);

const secondRequest = {
  ...request,
  requestId: `${request.requestId}_second`,
  proposalId: `${request.proposalId}_second`
};
const secondDecision = evaluateSimulationAccountRisk({ now, policy, request: secondRequest, snapshot });
const staleSecondCommand = createSimulationRiskCommand({
  decision: secondDecision,
  expiresAt: "2026-07-18T14:08:00.000Z",
  now,
  request: secondRequest
});
const staleReservation = executeSimulationRiskCommand({ command: staleSecondCommand, now, policy, state: reserved.state });
assert.equal(staleReservation.acknowledgement.status, "reservation_rejected");
assert(staleReservation.acknowledgement.blockers.includes("simulation_risk_decision_stale"));
assert.equal(staleReservation.state.openRiskUsd, 300);

const expiredCommand = { ...command, commandId: `${command.commandId}_expired`, idempotencyKey: `${command.idempotencyKey}_expired`, expiresAt: now };
const expiredReservation = executeSimulationRiskCommand({ command: expiredCommand, now, policy, state });
assert.equal(expiredReservation.acknowledgement.status, "reservation_rejected");
assert(expiredReservation.acknowledgement.blockers.includes("simulation_risk_command_expired_or_invalid"));

const duplicate = executeSimulationRiskCommand({ command, now, policy, state: reserved.state });
assert.equal(duplicate.acknowledgement.status, "duplicate_ignored");
assert.equal(duplicate.state.activeReservations.length, 1);

const settled = settleSimulationRiskReservation({
  commandId: command.commandId,
  now: "2026-07-18T14:05:00.000Z",
  outcomeR: -1,
  policy,
  state: reserved.state
});
assert.equal(settled.acknowledgement.status, "simulation_outcome_recorded");
assert.equal(settled.acknowledgement.realizedPnlUsd, -300);
assert.equal(settled.state.openRiskUsd, 0);
assert.equal(settled.state.simulatedEquityUsd, 49700);
assert.equal(settled.acknowledgement.brokerCallMade, false);

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "gotrader-account-risk-"));
await saveSimulationAccountRiskState(reserved.state, { policy, repoRoot: tempRoot });
const loaded = await loadSimulationAccountRiskState({ now, policy, repoRoot: tempRoot });
assert.equal(loaded.activeReservations.length, 1);
const ledgerResult = await appendSimulationRiskLedger(
  { acknowledgement: reserved.acknowledgement, command, decision: approved, now },
  { policy, repoRoot: tempRoot }
);
assert.equal(ledgerResult.status, "recorded");
const duplicateLedger = await appendSimulationRiskLedger(
  { acknowledgement: reserved.acknowledgement, command, decision: approved, now },
  { policy, repoRoot: tempRoot }
);
assert.equal(duplicateLedger.status, "already_recorded");
const ledgerText = await readFile(path.join(tempRoot, policy.ledgerFile), "utf8");
assert.equal(ledgerText.trim().split(/\r?\n/).length, 1);
assert(!/"(?:candles|rawCandles|account|accounts|orders|positions|password|secret|token)"\s*:/.test(ledgerText));

const status = buildSimulationAccountRiskStatus({ policy, state: reserved.state });
assert.equal(status.simulationOnly, true);
assert.equal(status.brokerSubmissionAllowed, false);
assert.equal(status.liveExecutionAllowed, false);
assert.equal(status.mt5GatewayMustRevalidate, true);
assert.equal(status.llmMayOverride, false);
assert.deepEqual(status.authority, authorityNone);

console.log(JSON.stringify({
  status: "passed",
  defaultEnabled: defaultPolicy.enabled,
  defaultKillSwitchActive: defaultPolicy.killSwitchActive,
  approvedStatus: approved.status,
  warningState: warningDecision.riskState,
  preBreachState: preBreachDecision.riskState,
  lockedState: lockedDecision.riskState,
  staleState: staleDecision.riskState,
  simulationVolumePreview: approved.sizing.simulationVolumePreview,
  mt5MustRecomputeVolume: approved.mt5Requirements.recomputeVolumeFromTerminalSymbolMetadata,
  brokerCallMade: false,
  authority: authorityNone
}, null, 2));
