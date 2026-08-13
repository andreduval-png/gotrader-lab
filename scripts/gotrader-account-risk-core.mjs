import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export const ACCOUNT_RISK_POLICY_VERSION = "gotrader_simulation_account_risk_v1";
export const ACCOUNT_RISK_STATE_CONTRACT = "gotrader.simulation_account_risk_state";
export const ACCOUNT_RISK_COMMAND_CONTRACT = "gotrader.simulation_risk_command";
export const ACCOUNT_RISK_ACK_CONTRACT = "gotrader.simulation_risk_acknowledgement";
export const ACCOUNT_RISK_LEDGER_CONTRACT = "gotrader.simulation_risk_ledger_entry";
export const ACCOUNT_RISK_AUTHORITY = Object.freeze({
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
});

const DEFAULT_STATE_FILE = ".gotrader/simulation-account-risk-state.json";
const DEFAULT_LEDGER_FILE = ".gotrader/simulation-account-risk-ledger.jsonl";
const DEFAULT_TIME_ZONE = "America/New_York";
const DEFAULT_SNAPSHOT_MAX_AGE_MS = 30_000;

const finiteNumber = (value) => typeof value === "number" && Number.isFinite(value);
const finitePositive = (value) => finiteNumber(value) && value > 0;
const finiteNonNegative = (value) => finiteNumber(value) && value >= 0;
const round = (value, decimals = 4) => Number(Number(value).toFixed(decimals));
const unique = (values) => [...new Set(values.filter(Boolean))];
const compact = (value) => String(value ?? "").trim();
const stableValue = (value) => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableValue(value[key])])
  );
};
const stableJson = (value) => JSON.stringify(stableValue(value));
const sha256 = (value) => createHash("sha256").update(typeof value === "string" ? value : stableJson(value)).digest("hex");
const stableId = (prefix, ...parts) => `${prefix}_${sha256(parts.map(compact).join("|")).slice(0, 20)}`;

const authorityIsNone = (authority) =>
  authority?.executionAuthority === "none" &&
  authority?.brokerAuthority === "none" &&
  authority?.readinessOverrideAuthority === "none";

const dateForTimeZone = (timestamp, timeZone = DEFAULT_TIME_ZONE) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(timestamp));
  const value = (type) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${value("year")}-${value("month")}-${value("day")}`;
};

const resolveInsideRepo = (repoRoot, candidatePath) => {
  const resolved = path.resolve(repoRoot, candidatePath);
  const root = `${path.resolve(repoRoot)}${path.sep}`;
  if (resolved !== path.resolve(repoRoot) && !resolved.startsWith(root)) {
    throw new Error("Account-risk path escaped the repository root.");
  }
  return resolved;
};

const readJson = async (filePath) => {
  try {
    return JSON.parse((await readFile(filePath, "utf8")).replace(/^\uFEFF/, ""));
  } catch (error) {
    if (error?.code === "ENOENT") return undefined;
    throw error;
  }
};

const assertCompactRiskArtifact = (artifact, label) => {
  const serialized = JSON.stringify(artifact);
  if (
    /"(?:candles|rawCandles|rawSnapshot|rawRuntime|accountNumber|login|password|credentials|apiKey|secret|token|orders|positions|rawBrokerResponse)"\s*:/i.test(
      serialized
    )
  ) {
    throw new Error(`${label} rejected unsafe fields.`);
  }
  if (!authorityIsNone(artifact?.authority)) {
    throw new Error(`${label} authority must remain none/none/none.`);
  }
};

export const loadSimulationAccountRiskPolicy = (env = process.env) => {
  const number = (name, fallback = 0) => Number(env[name] ?? fallback);
  const integer = (name, fallback = 0) => Math.floor(number(name, fallback));
  const startingEquityUsd = number("GOTRADER_SIM_STARTING_EQUITY_USD");
  const maxDailyLossUsd = number("GOTRADER_SIM_MAX_DAILY_LOSS_USD");
  const maxOpenRiskUsd = number("GOTRADER_SIM_MAX_OPEN_RISK_USD");
  const maxRiskPerScenarioUsd = number("GOTRADER_SIM_MAX_RISK_PER_SCENARIO_USD");
  const maxConcurrentIntents = integer("GOTRADER_SIM_MAX_CONCURRENT_INTENTS");
  const pointValueUsdPerPriceUnit = number(
    "GOTRADER_SIM_POINT_VALUE_USD",
    number("GOTRADER_PAPER_POINT_VALUE_USD")
  );
  const volumeMin = number("GOTRADER_SIM_VOLUME_MIN", 1);
  const volumeMax = number("GOTRADER_SIM_VOLUME_MAX", integer("GOTRADER_PAPER_MAX_UNITS"));
  const volumeStep = number("GOTRADER_SIM_VOLUME_STEP", 1);
  const warningDrawdownRatio = number("GOTRADER_SIM_WARNING_DRAWDOWN_RATIO", 0.7);
  const preBreachDrawdownRatio = number("GOTRADER_SIM_PRE_BREACH_DRAWDOWN_RATIO", 0.9);
  const snapshotMaxAgeMs = Math.max(
    1_000,
    integer("GOTRADER_SIM_SNAPSHOT_MAX_AGE_MS", DEFAULT_SNAPSHOT_MAX_AGE_MS)
  );
  const configured =
    finitePositive(startingEquityUsd) &&
    finitePositive(maxDailyLossUsd) &&
    finitePositive(maxOpenRiskUsd) &&
    finitePositive(maxRiskPerScenarioUsd) &&
    maxConcurrentIntents > 0 &&
    finitePositive(pointValueUsdPerPriceUnit) &&
    finitePositive(volumeMin) &&
    finitePositive(volumeMax) &&
    volumeMax >= volumeMin &&
    finitePositive(volumeStep) &&
    warningDrawdownRatio > 0 &&
    warningDrawdownRatio < preBreachDrawdownRatio &&
    preBreachDrawdownRatio < 1;

  return {
    policyVersion: ACCOUNT_RISK_POLICY_VERSION,
    mode: "simulation",
    enabled: env.GOTRADER_SIM_RISK_GOVERNOR_ENABLED === "true",
    killSwitchActive: env.GOTRADER_SIM_RISK_KILL_SWITCH !== "false",
    configured,
    accountId: compact(env.GOTRADER_SIM_ACCOUNT_ID) || "primary_simulation",
    startingEquityUsd: finitePositive(startingEquityUsd) ? startingEquityUsd : 0,
    maxDailyLossUsd: finitePositive(maxDailyLossUsd) ? maxDailyLossUsd : 0,
    maxOpenRiskUsd: finitePositive(maxOpenRiskUsd) ? maxOpenRiskUsd : 0,
    maxRiskPerScenarioUsd: finitePositive(maxRiskPerScenarioUsd) ? maxRiskPerScenarioUsd : 0,
    maxConcurrentIntents: maxConcurrentIntents > 0 ? maxConcurrentIntents : 0,
    warningDrawdownRatio,
    preBreachDrawdownRatio,
    snapshotMaxAgeMs,
    dailyReset: {
      mode: "calendar_day_in_policy_timezone",
      timeZone: compact(env.GOTRADER_SIM_RISK_TIME_ZONE) || DEFAULT_TIME_ZONE
    },
    instrument: {
      sizingMode: "fixed_risk_stop_distance_preview",
      pointValueUsdPerPriceUnit: finitePositive(pointValueUsdPerPriceUnit) ? pointValueUsdPerPriceUnit : 0,
      volumeMin: finitePositive(volumeMin) ? volumeMin : 0,
      volumeMax: finitePositive(volumeMax) ? volumeMax : 0,
      volumeStep: finitePositive(volumeStep) ? volumeStep : 0,
      brokerRevalidationRequired: true
    },
    stateFile: compact(env.GOTRADER_SIM_RISK_STATE_FILE) || DEFAULT_STATE_FILE,
    ledgerFile: compact(env.GOTRADER_SIM_RISK_LEDGER_FILE) || DEFAULT_LEDGER_FILE,
    operatorConfigured: true,
    llmMayOverride: false,
    authority: ACCOUNT_RISK_AUTHORITY
  };
};

export const createInitialSimulationAccountRiskState = (
  policy,
  now = new Date().toISOString()
) => ({
  contract: ACCOUNT_RISK_STATE_CONTRACT,
  version: "1.0",
  policyVersion: ACCOUNT_RISK_POLICY_VERSION,
  accountId: policy.accountId,
  mode: "simulation",
  sessionDate: dateForTimeZone(now, policy.dailyReset.timeZone),
  simulatedBalanceUsd: round(policy.startingEquityUsd, 2),
  simulatedEquityUsd: round(policy.startingEquityUsd, 2),
  dailyStartingEquityUsd: round(policy.startingEquityUsd, 2),
  dailyPeakEquityUsd: round(policy.startingEquityUsd, 2),
  dailyRealizedPnlUsd: 0,
  simulatedUnrealizedPnlUsd: 0,
  openRiskUsd: 0,
  activeReservations: [],
  heartbeatAt: now,
  updatedAt: now,
  sequence: 0,
  riskState: "monitoring",
  authority: ACCOUNT_RISK_AUTHORITY
});

const normalizeRiskState = (state, policy, now) => {
  if (!state || state.accountId !== policy.accountId || state.mode !== "simulation" || !authorityIsNone(state.authority)) {
    return createInitialSimulationAccountRiskState(policy, now);
  }
  const activeReservations = Array.isArray(state.activeReservations)
    ? state.activeReservations.filter((item) => Date.parse(item.expiresAt ?? "") > Date.parse(now))
    : [];
  const openRiskUsd = round(activeReservations.reduce((sum, item) => sum + (finitePositive(item.riskUsd) ? item.riskUsd : 0), 0), 2);
  const sessionDate = dateForTimeZone(now, policy.dailyReset.timeZone);
  if (state.sessionDate !== sessionDate) {
    return {
      ...state,
      sessionDate,
      dailyStartingEquityUsd: round(state.simulatedEquityUsd, 2),
      dailyPeakEquityUsd: round(state.simulatedEquityUsd, 2),
      dailyRealizedPnlUsd: 0,
      activeReservations,
      openRiskUsd,
      updatedAt: now,
      riskState: "monitoring",
      authority: ACCOUNT_RISK_AUTHORITY
    };
  }
  return {
    ...state,
    activeReservations,
    openRiskUsd,
    dailyPeakEquityUsd: round(Math.max(state.dailyPeakEquityUsd ?? 0, state.simulatedEquityUsd ?? 0), 2),
    authority: ACCOUNT_RISK_AUTHORITY
  };
};

export const refreshSimulationAccountHeartbeat = (state, policy, now = new Date().toISOString()) => {
  const current = normalizeRiskState(state, policy, now);
  return {
    ...current,
    heartbeatAt: now,
    updatedAt: now,
    sequence: Math.max(0, Number(current.sequence) || 0) + 1,
    authority: ACCOUNT_RISK_AUTHORITY
  };
};

export const buildSimulationAccountSnapshot = (state, now = new Date().toISOString()) => ({
  snapshotId: stableId("sim_snapshot", state.accountId, state.sequence, state.heartbeatAt),
  accountId: state.accountId,
  mode: "simulation",
  capturedAt: now,
  heartbeatAt: state.heartbeatAt,
  sessionDate: state.sessionDate,
  simulatedBalanceUsd: state.simulatedBalanceUsd,
  simulatedEquityUsd: state.simulatedEquityUsd,
  dailyStartingEquityUsd: state.dailyStartingEquityUsd,
  dailyPeakEquityUsd: state.dailyPeakEquityUsd,
  dailyRealizedPnlUsd: state.dailyRealizedPnlUsd,
  simulatedUnrealizedPnlUsd: state.simulatedUnrealizedPnlUsd,
  openRiskUsd: state.openRiskUsd,
  activeIntentCount: state.activeReservations.length,
  sequence: state.sequence,
  source: "simulation_adapter",
  brokerDataIncluded: false,
  authority: ACCOUNT_RISK_AUTHORITY
});

const decimalPlacesForStep = (step) => {
  const text = String(step);
  return text.includes(".") ? Math.min(8, text.length - text.indexOf(".") - 1) : 0;
};

export const calculateSimulationRiskSizing = ({ entry, requestedRiskUsd, stop }, policy) => {
  const riskDistance = finiteNumber(entry) && finiteNumber(stop) ? Math.abs(entry - stop) : 0;
  const instrument = policy.instrument;
  const blockers = [];
  const warnings = [];
  if (!finitePositive(requestedRiskUsd)) blockers.push("requested_risk_not_positive");
  if (!finitePositive(riskDistance)) blockers.push("stop_distance_not_positive");
  if (!finitePositive(instrument.pointValueUsdPerPriceUnit)) blockers.push("point_value_not_configured");
  if (!finitePositive(instrument.volumeStep) || !finitePositive(instrument.volumeMin) || !finitePositive(instrument.volumeMax)) {
    blockers.push("simulation_volume_constraints_not_configured");
  }
  const approvedRiskBudgetUsd = Math.min(
    finitePositive(requestedRiskUsd) ? requestedRiskUsd : 0,
    finitePositive(policy.maxRiskPerScenarioUsd) ? policy.maxRiskPerScenarioUsd : 0
  );
  if (requestedRiskUsd > policy.maxRiskPerScenarioUsd) warnings.push("requested_risk_capped_to_scenario_limit");
  const riskPerVolumeUnitUsd = riskDistance * instrument.pointValueUsdPerPriceUnit;
  const rawVolume = finitePositive(riskPerVolumeUnitUsd) ? approvedRiskBudgetUsd / riskPerVolumeUnitUsd : 0;
  const steppedVolume = finitePositive(instrument.volumeStep)
    ? Math.floor((rawVolume + Number.EPSILON) / instrument.volumeStep) * instrument.volumeStep
    : 0;
  const volume = round(Math.min(instrument.volumeMax, steppedVolume), decimalPlacesForStep(instrument.volumeStep));
  if (blockers.length === 0 && volume < instrument.volumeMin) blockers.push("risk_budget_below_minimum_volume");
  const estimatedRiskUsd = round(volume * riskPerVolumeUnitUsd, 2);
  if (estimatedRiskUsd > approvedRiskBudgetUsd + 0.01) blockers.push("simulation_sizing_exceeds_approved_risk");
  return {
    status: blockers.length ? "blocked" : "simulation_preview_only",
    sizingMode: instrument.sizingMode,
    riskDistance: round(riskDistance),
    requestedRiskUsd: round(requestedRiskUsd || 0, 2),
    approvedRiskBudgetUsd: round(approvedRiskBudgetUsd, 2),
    pointValueUsdPerPriceUnit: instrument.pointValueUsdPerPriceUnit,
    rawVolume: round(rawVolume),
    simulationVolumePreview: blockers.length ? null : volume,
    estimatedRiskUsd: blockers.length ? null : estimatedRiskUsd,
    volumeMin: instrument.volumeMin,
    volumeMax: instrument.volumeMax,
    volumeStep: instrument.volumeStep,
    brokerRevalidationRequired: true,
    executable: false,
    blockers,
    warnings
  };
};

export const buildRiskEvaluationRequest = ({
  now = new Date().toISOString(),
  proposalEvaluation,
  requestedRiskUsd
}) => {
  const proposal = proposalEvaluation?.compactProposal;
  return {
    requestId: stableId("risk_request", proposalEvaluation?.proposalId, proposal?.validationChainId),
    createdAt: now,
    proposalId: proposalEvaluation?.proposalId,
    validationChainId: proposal?.validationChainId,
    strategyProfileId: proposal?.strategyProfileId,
    sourceProvider: proposal?.sourceProvider,
    sourceFingerprint: proposal?.sourceFingerprint,
    requestedSymbol: proposal?.requestedSymbol,
    brokerSymbol: proposal?.brokerSymbol,
    timeframe: proposal?.timeframe,
    direction: proposal?.direction,
    entry: proposal?.entry,
    stop: proposal?.stop,
    targets: Array.isArray(proposal?.targets) ? proposal.targets.slice(0, 4) : [],
    requestedRiskUsd,
    purpose: "simulation_risk_evaluation",
    brokerSubmissionRequested: false,
    authority: ACCOUNT_RISK_AUTHORITY
  };
};

const classifyDrawdownState = (drawdownRatio, policy) =>
  drawdownRatio >= 1
    ? "locked"
    : drawdownRatio >= policy.preBreachDrawdownRatio
      ? "pre_breach"
      : drawdownRatio >= policy.warningDrawdownRatio
        ? "warning"
        : "monitoring";

export const evaluateSimulationAccountRisk = ({
  now = new Date().toISOString(),
  policy,
  request,
  snapshot
}) => {
  const blockers = [];
  const warnings = [];
  const nowMs = Date.parse(now);
  const heartbeatMs = Date.parse(snapshot?.heartbeatAt ?? "");
  const heartbeatAgeMs = Number.isFinite(nowMs) && Number.isFinite(heartbeatMs) ? nowMs - heartbeatMs : Number.POSITIVE_INFINITY;
  if (!policy?.enabled) blockers.push("simulation_account_risk_governor_not_enabled");
  if (!policy?.configured) blockers.push("simulation_account_risk_policy_not_configured");
  if (policy?.killSwitchActive) blockers.push("simulation_account_risk_kill_switch_active");
  if (!request || !authorityIsNone(request.authority)) blockers.push("risk_request_authority_not_none");
  if (request?.brokerSubmissionRequested === true) blockers.push("broker_submission_not_allowed_from_risk_governor");
  if (!snapshot || snapshot.mode !== "simulation" || snapshot.accountId !== policy?.accountId) {
    blockers.push("simulation_account_snapshot_unavailable");
  }
  if (!snapshot || !authorityIsNone(snapshot.authority)) blockers.push("simulation_account_snapshot_authority_not_none");
  const snapshotNumbersValid =
    finitePositive(snapshot?.simulatedBalanceUsd) &&
    finiteNonNegative(snapshot?.simulatedEquityUsd) &&
    finitePositive(snapshot?.dailyStartingEquityUsd) &&
    finitePositive(snapshot?.dailyPeakEquityUsd) &&
    finiteNumber(snapshot?.dailyRealizedPnlUsd) &&
    finiteNumber(snapshot?.simulatedUnrealizedPnlUsd) &&
    finiteNonNegative(snapshot?.openRiskUsd) &&
    Number.isInteger(snapshot?.activeIntentCount) &&
    snapshot.activeIntentCount >= 0 &&
    Number.isInteger(snapshot?.sequence) &&
    snapshot.sequence >= 0;
  if (!snapshotNumbersValid) blockers.push("simulation_account_snapshot_invalid");
  if (!Number.isFinite(heartbeatAgeMs) || heartbeatAgeMs < 0 || heartbeatAgeMs > (policy?.snapshotMaxAgeMs ?? 0)) {
    blockers.push("simulation_account_snapshot_stale");
  }
  if (request?.sourceProvider !== "mt5_read_only" || !compact(request?.sourceFingerprint)) {
    blockers.push("canonical_mt5_source_identity_required");
  }
  if (!compact(request?.validationChainId) || !compact(request?.strategyProfileId)) {
    blockers.push("validated_profile_identity_required");
  }
  if (request?.direction !== "long" && request?.direction !== "short") blockers.push("direction_not_supported");
  const target = request?.targets?.[0];
  const geometryValid =
    finiteNumber(request?.entry) &&
    finiteNumber(request?.stop) &&
    finiteNumber(target) &&
    (request.direction === "long"
      ? request.stop < request.entry && request.entry < target
      : request.direction === "short"
        ? request.stop > request.entry && request.entry > target
        : false);
  if (!geometryValid) blockers.push("risk_request_geometry_invalid");

  const sizing = calculateSimulationRiskSizing(
    { entry: request?.entry, stop: request?.stop, requestedRiskUsd: Number(request?.requestedRiskUsd) },
    policy
  );
  blockers.push(...sizing.blockers);
  warnings.push(...sizing.warnings);

  const dailyPeakEquityUsd = Number(snapshot?.dailyPeakEquityUsd ?? 0);
  const simulatedEquityUsd = Number(snapshot?.simulatedEquityUsd ?? 0);
  const currentDrawdownUsd = round(Math.max(0, dailyPeakEquityUsd - simulatedEquityUsd), 2);
  const drawdownRatio = finitePositive(policy?.maxDailyLossUsd) ? currentDrawdownUsd / policy.maxDailyLossUsd : 1;
  const currentOpenRiskUsd = Number(snapshot?.openRiskUsd ?? 0);
  const activeIntentCount = Number(snapshot?.activeIntentCount ?? 0);
  const requestedRisk = Number(sizing.estimatedRiskUsd ?? 0);
  const projectedDailyRiskUsd = round(currentDrawdownUsd + requestedRisk, 2);
  const projectedOpenRiskUsd = round(currentOpenRiskUsd + requestedRisk, 2);

  if (currentDrawdownUsd >= (policy?.maxDailyLossUsd ?? 0)) blockers.push("simulation_daily_loss_limit_reached");
  if (projectedDailyRiskUsd > (policy?.maxDailyLossUsd ?? 0)) blockers.push("projected_daily_loss_limit_exceeded");
  if (currentOpenRiskUsd >= (policy?.maxOpenRiskUsd ?? 0)) blockers.push("simulation_open_risk_limit_reached");
  if (projectedOpenRiskUsd > (policy?.maxOpenRiskUsd ?? 0)) blockers.push("projected_open_risk_limit_exceeded");
  if (activeIntentCount >= (policy?.maxConcurrentIntents ?? 0)) blockers.push("simulation_concurrent_intent_limit_reached");

  const uniqueBlockers = unique(blockers);
  const unavailable = uniqueBlockers.some((item) => /not_enabled|not_configured|unavailable|authority_not_none|snapshot_invalid/.test(item));
  const stale = uniqueBlockers.includes("simulation_account_snapshot_stale");
  const hardLocked = uniqueBlockers.some((item) => /kill_switch|limit_reached|limit_exceeded/.test(item));
  const riskState = unavailable
    ? "unavailable"
    : stale
      ? "stale_data"
      : hardLocked
        ? "locked"
        : classifyDrawdownState(drawdownRatio, policy);
  if (riskState === "warning") warnings.push("simulation_account_drawdown_warning");
  if (riskState === "pre_breach") warnings.push("simulation_account_pre_breach_warning");

  const status = uniqueBlockers.length === 0 ? "approved_for_simulation" : "blocked";
  return {
    decisionId: stableId("account_risk_decision", request?.requestId, snapshot?.snapshotId, policy?.policyVersion),
    evaluatedAt: now,
    policyVersion: policy?.policyVersion ?? ACCOUNT_RISK_POLICY_VERSION,
    requestId: request?.requestId,
    accountId: policy?.accountId,
    evaluatedSnapshotId: snapshot?.snapshotId,
    evaluatedStateSequence: Number(snapshot?.sequence),
    status,
    riskState,
    sizing,
    metrics: {
      currentDrawdownUsd,
      drawdownRatio: round(drawdownRatio),
      currentOpenRiskUsd: round(currentOpenRiskUsd, 2),
      projectedOpenRiskUsd,
      projectedDailyRiskUsd,
      remainingDailyLossCapacityUsd: round(Math.max(0, (policy?.maxDailyLossUsd ?? 0) - currentDrawdownUsd), 2),
      remainingOpenRiskCapacityUsd: round(Math.max(0, (policy?.maxOpenRiskUsd ?? 0) - currentOpenRiskUsd), 2),
      activeIntentCount,
      maxConcurrentIntents: policy?.maxConcurrentIntents ?? 0,
      heartbeatAgeMs: Number.isFinite(heartbeatAgeMs) ? heartbeatAgeMs : null
    },
    blockers: uniqueBlockers,
    warnings: unique(warnings),
    nextAction:
      status === "approved_for_simulation"
        ? "Create an idempotent simulation risk reservation. MT5 must independently revalidate account mode, symbol metadata, volume, margin, and current broker state."
        : riskState === "stale_data"
          ? "Restore a fresh simulation-account heartbeat before reevaluating risk."
          : "Resolve account-risk policy or capacity blockers before creating a simulation reservation.",
    simulationOnly: true,
    brokerSubmissionAllowed: false,
    liveExecutionAllowed: false,
    mt5Requirements: {
      independentGatewayRequired: true,
      demoAccountRequired: true,
      liveAccountAllowed: false,
      recomputeVolumeFromTerminalSymbolMetadata: true,
      requireTickValue: true,
      requireTickSize: true,
      requireVolumeMinMaxStep: true,
      requireMarginCheck: true,
      requireProtectedStopAndTarget: true,
      requireFreshBrokerSnapshotAtDispatch: true,
      trustSimulationVolumePreview: false
    },
    authority: ACCOUNT_RISK_AUTHORITY
  };
};

export const createSimulationRiskCommand = ({
  decision,
  expiresAt,
  now = new Date().toISOString(),
  request
}) => {
  if (decision?.status !== "approved_for_simulation" || decision?.brokerSubmissionAllowed !== false) {
    throw new Error("An approved simulation-only risk decision is required.");
  }
  if (
    decision?.requestId !== request?.requestId ||
    !authorityIsNone(decision?.authority) ||
    !authorityIsNone(request?.authority) ||
    !Number.isInteger(decision?.evaluatedStateSequence) ||
    !finitePositive(decision?.sizing?.estimatedRiskUsd) ||
    !finitePositive(decision?.sizing?.simulationVolumePreview)
  ) {
    throw new Error("Risk decision and request identities or sizing are invalid.");
  }
  if (!Number.isFinite(Date.parse(now)) || !Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= Date.parse(now)) {
    throw new Error("Simulation risk command expiry must be after creation time.");
  }
  const command = {
    contract: ACCOUNT_RISK_COMMAND_CONTRACT,
    version: "1.0",
    commandId: stableId("simulation_risk_command", request.requestId, request.validationChainId),
    idempotencyKey: `${request.proposalId}:${request.validationChainId}`,
    createdAt: now,
    expiresAt,
    type: "reserve_simulation_risk",
    accountId: decision.accountId,
    proposalId: request.proposalId,
    validationChainId: request.validationChainId,
    strategyProfileId: request.strategyProfileId,
    requestedSymbol: request.requestedSymbol,
    brokerSymbol: request.brokerSymbol,
    direction: request.direction,
    riskDecisionId: decision.decisionId,
    riskPolicyVersion: decision.policyVersion,
    expectedStateSequence: decision.evaluatedStateSequence,
    approvedRiskUsd: decision.sizing.estimatedRiskUsd,
    simulationVolumePreview: decision.sizing.simulationVolumePreview,
    simulationOnly: true,
    brokerSubmissionAllowed: false,
    authority: ACCOUNT_RISK_AUTHORITY
  };
  assertCompactRiskArtifact(command, "Simulation risk command");
  return command;
};

export const executeSimulationRiskCommand = ({ command, now = new Date().toISOString(), policy, state }) => {
  assertCompactRiskArtifact(command, "Simulation risk command");
  const current = normalizeRiskState(state, policy, now);
  const existing = current.activeReservations.find(
    (item) => item.commandId === command.commandId || item.idempotencyKey === command.idempotencyKey
  );
  if (existing) {
    return {
      state: current,
      acknowledgement: {
        contract: ACCOUNT_RISK_ACK_CONTRACT,
        version: "1.0",
        acknowledgementId: stableId("simulation_risk_ack", command.commandId),
        commandId: command.commandId,
        acknowledgedAt: now,
        status: "duplicate_ignored",
        message: "Simulation risk was already reserved; duplicate command caused no state change.",
        brokerCallMade: false,
        authority: ACCOUNT_RISK_AUTHORITY
      }
    };
  }
  const blockers = [];
  const nowMs = Date.parse(now);
  const createdMs = Date.parse(command?.createdAt ?? "");
  const expiresMs = Date.parse(command?.expiresAt ?? "");
  if (!policy?.enabled) blockers.push("simulation_account_risk_governor_not_enabled");
  if (!policy?.configured) blockers.push("simulation_account_risk_policy_not_configured");
  if (policy?.killSwitchActive) blockers.push("simulation_account_risk_kill_switch_active");
  if (command?.accountId !== policy?.accountId) blockers.push("simulation_account_mismatch");
  if (command?.riskPolicyVersion !== policy?.policyVersion) blockers.push("simulation_risk_policy_mismatch");
  if (!Number.isFinite(nowMs) || !Number.isFinite(createdMs) || !Number.isFinite(expiresMs) || createdMs > nowMs || expiresMs <= nowMs) {
    blockers.push("simulation_risk_command_expired_or_invalid");
  }
  if (!Number.isInteger(command?.expectedStateSequence) || command.expectedStateSequence !== current.sequence) {
    blockers.push("simulation_risk_decision_stale");
  }
  if (!finitePositive(command?.approvedRiskUsd) || command.approvedRiskUsd > policy.maxRiskPerScenarioUsd) {
    blockers.push("simulation_risk_budget_invalid");
  }
  if (!finitePositive(command?.simulationVolumePreview)) blockers.push("simulation_volume_preview_invalid");
  const projectedOpenRiskUsd = round(current.openRiskUsd + (finitePositive(command?.approvedRiskUsd) ? command.approvedRiskUsd : 0), 2);
  if (projectedOpenRiskUsd > policy.maxOpenRiskUsd) blockers.push("projected_open_risk_limit_exceeded");
  if (current.activeReservations.length >= policy.maxConcurrentIntents) blockers.push("simulation_concurrent_intent_limit_reached");
  if (blockers.length) {
    return {
      state: current,
      acknowledgement: {
        contract: ACCOUNT_RISK_ACK_CONTRACT,
        version: "1.0",
        acknowledgementId: stableId("simulation_risk_rejection", command?.commandId, current.sequence),
        commandId: command?.commandId,
        acknowledgedAt: now,
        status: "reservation_rejected",
        message: "Simulation risk reservation was rejected because the evaluated decision is stale or current capacity is unavailable.",
        blockers: unique(blockers),
        brokerCallMade: false,
        authority: ACCOUNT_RISK_AUTHORITY
      }
    };
  }
  const reservation = {
    reservationId: stableId("simulation_risk_reservation", command.commandId),
    commandId: command.commandId,
    idempotencyKey: command.idempotencyKey,
    proposalId: command.proposalId,
    validationChainId: command.validationChainId,
    strategyProfileId: command.strategyProfileId,
    requestedSymbol: command.requestedSymbol,
    brokerSymbol: command.brokerSymbol,
    riskUsd: command.approvedRiskUsd,
    simulationVolumePreview: command.simulationVolumePreview,
    createdAt: now,
    expiresAt: command.expiresAt,
    status: "reserved"
  };
  const activeReservations = [reservation, ...current.activeReservations];
  const nextState = {
    ...current,
    activeReservations,
    openRiskUsd: round(activeReservations.reduce((sum, item) => sum + item.riskUsd, 0), 2),
    updatedAt: now,
    sequence: current.sequence + 1,
    authority: ACCOUNT_RISK_AUTHORITY
  };
  return {
    state: nextState,
    acknowledgement: {
      contract: ACCOUNT_RISK_ACK_CONTRACT,
      version: "1.0",
      acknowledgementId: stableId("simulation_risk_ack", command.commandId),
      commandId: command.commandId,
      acknowledgedAt: now,
      status: "simulation_risk_reserved",
      message: "Simulation-only risk reservation accepted. No broker call was made.",
      brokerCallMade: false,
      authority: ACCOUNT_RISK_AUTHORITY
    }
  };
};

export const settleSimulationRiskReservation = ({
  commandId,
  now = new Date().toISOString(),
  outcomeR,
  policy,
  state
}) => {
  const current = normalizeRiskState(state, policy, now);
  const reservation = current.activeReservations.find((item) => item.commandId === commandId);
  if (!reservation) {
    return {
      state: current,
      acknowledgement: {
        contract: ACCOUNT_RISK_ACK_CONTRACT,
        version: "1.0",
        acknowledgementId: stableId("simulation_risk_settlement", commandId),
        commandId,
        acknowledgedAt: now,
        status: "reservation_not_found",
        message: "No active simulation reservation matched the command.",
        brokerCallMade: false,
        authority: ACCOUNT_RISK_AUTHORITY
      }
    };
  }
  if (!finiteNumber(outcomeR)) throw new Error("Simulation settlement requires a finite R outcome.");
  const realizedPnlUsd = round(reservation.riskUsd * outcomeR, 2);
  const activeReservations = current.activeReservations.filter((item) => item.commandId !== commandId);
  const simulatedBalanceUsd = round(current.simulatedBalanceUsd + realizedPnlUsd, 2);
  const simulatedEquityUsd = round(current.simulatedEquityUsd + realizedPnlUsd, 2);
  const nextState = {
    ...current,
    simulatedBalanceUsd,
    simulatedEquityUsd,
    dailyPeakEquityUsd: round(Math.max(current.dailyPeakEquityUsd, simulatedEquityUsd), 2),
    dailyRealizedPnlUsd: round(current.dailyRealizedPnlUsd + realizedPnlUsd, 2),
    activeReservations,
    openRiskUsd: round(activeReservations.reduce((sum, item) => sum + item.riskUsd, 0), 2),
    updatedAt: now,
    sequence: current.sequence + 1,
    authority: ACCOUNT_RISK_AUTHORITY
  };
  return {
    state: nextState,
    acknowledgement: {
      contract: ACCOUNT_RISK_ACK_CONTRACT,
      version: "1.0",
      acknowledgementId: stableId("simulation_risk_settlement", commandId),
      commandId,
      acknowledgedAt: now,
      status: "simulation_outcome_recorded",
      outcomeR: round(outcomeR),
      realizedPnlUsd,
      message: "Compact simulation outcome recorded. No broker state was accessed or mutated.",
      brokerCallMade: false,
      authority: ACCOUNT_RISK_AUTHORITY
    }
  };
};

export const loadSimulationAccountRiskState = async ({
  now = new Date().toISOString(),
  policy,
  repoRoot = process.cwd()
}) => {
  const state = await readJson(resolveInsideRepo(repoRoot, policy.stateFile));
  return normalizeRiskState(state, policy, now);
};

export const saveSimulationAccountRiskState = async (state, { policy, repoRoot = process.cwd() }) => {
  assertCompactRiskArtifact(state, "Simulation account-risk state");
  const filePath = resolveInsideRepo(repoRoot, policy.stateFile);
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  await rename(temporaryPath, filePath);
  return filePath;
};

export const appendSimulationRiskLedger = async (
  { acknowledgement, command, decision, now = new Date().toISOString() },
  { policy, repoRoot = process.cwd() }
) => {
  const entry = {
    contract: ACCOUNT_RISK_LEDGER_CONTRACT,
    version: "1.0",
    eventId: stableId("simulation_risk_ledger", command.commandId),
    timestamp: now,
    command,
    acknowledgement,
    decision: {
      decisionId: decision.decisionId,
      status: decision.status,
      riskState: decision.riskState,
      approvedRiskUsd: decision.sizing.estimatedRiskUsd,
      simulationVolumePreview: decision.sizing.simulationVolumePreview,
      blockers: decision.blockers,
      warnings: decision.warnings
    },
    safety: {
      simulationOnly: true,
      brokerCallMade: false,
      rawCandlesIncluded: false,
      credentialsIncluded: false,
      brokerStateIncluded: false
    },
    authority: ACCOUNT_RISK_AUTHORITY
  };
  assertCompactRiskArtifact(entry, "Simulation risk ledger entry");
  const filePath = resolveInsideRepo(repoRoot, policy.ledgerFile);
  await mkdir(path.dirname(filePath), { recursive: true });
  let existing = "";
  try {
    existing = await readFile(filePath, "utf8");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  if (existing.includes(`"eventId":"${entry.eventId}"`) || existing.includes(`"eventId": "${entry.eventId}"`)) {
    return { entry, filePath, status: "already_recorded" };
  }
  await appendFile(filePath, `${JSON.stringify(entry)}\n`, "utf8");
  return { entry, filePath, status: "recorded" };
};

export const buildSimulationAccountRiskStatus = ({ policy, state }) => ({
  provider: "gotrader_simulation_account_risk_governor",
  stage: "simulation_only_account_risk",
  policyVersion: policy.policyVersion,
  enabled: policy.enabled,
  configured: policy.configured,
  killSwitchActive: policy.killSwitchActive,
  accountId: policy.accountId,
  riskState:
    !policy.enabled || !policy.configured
      ? "unavailable"
      : policy.killSwitchActive
        ? "locked"
        : state?.riskState ?? "unavailable",
  sessionDate: state?.sessionDate,
  simulatedEquityUsd: state?.simulatedEquityUsd,
  dailyPeakEquityUsd: state?.dailyPeakEquityUsd,
  dailyRealizedPnlUsd: state?.dailyRealizedPnlUsd,
  openRiskUsd: state?.openRiskUsd ?? 0,
  activeIntentCount: state?.activeReservations?.length ?? 0,
  limits: {
    maxDailyLossUsd: policy.maxDailyLossUsd,
    maxOpenRiskUsd: policy.maxOpenRiskUsd,
    maxRiskPerScenarioUsd: policy.maxRiskPerScenarioUsd,
    maxConcurrentIntents: policy.maxConcurrentIntents
  },
  dailyReset: policy.dailyReset,
  simulationOnly: true,
  brokerSubmissionAllowed: false,
  liveExecutionAllowed: false,
  mt5GatewayMustRevalidate: true,
  llmMayOverride: false,
  authority: ACCOUNT_RISK_AUTHORITY
});
