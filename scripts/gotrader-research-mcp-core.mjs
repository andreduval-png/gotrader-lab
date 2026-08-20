import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";

export const GOTRADER_RESEARCH_MCP_POLICY_VERSION = "gotrader_research_mcp_v1";
export const GOTRADER_RESEARCH_MCP_AUTHORITY = Object.freeze({
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
});
export const GOTRADER_RESEARCH_MCP_MAX_SNAPSHOT_BYTES = 2_000_000;
export const GOTRADER_RESEARCH_MCP_MAX_AGE_MS = 15 * 60 * 1000;

const forbiddenKeys = new Set([
  "account", "accountbalance", "apikey", "brokermutation", "candles", "credentials",
  "executionrequest", "execute", "orders", "password", "positions", "rawcandles",
  "rawruntime", "rawsnapshot", "secret", "token"
]);
const compactKey = (value) => String(value ?? "").replace(/[^a-z0-9]/gi, "").toLowerCase();
const finite = (value) => typeof value === "number" && Number.isFinite(value);
const unique = (values) => [...new Set(values.filter(Boolean))];
const stableValue = (value) => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
};
export const canonicalJson = (value) => JSON.stringify(stableValue(value));
export const sha256Id = (value) => `sha256:${createHash("sha256").update(canonicalJson(value)).digest("hex")}`;

const runtimePaths = (repoRoot = process.cwd()) => ({
  dir: path.join(repoRoot, ".gotrader", "research-mcp"),
  latest: path.join(repoRoot, ".gotrader", "research-mcp", "runtime-latest.json"),
  history: path.join(repoRoot, ".gotrader", "research-mcp", "runtime-history.jsonl"),
  proposals: path.join(repoRoot, ".gotrader", "research-mcp", "trade-proposals.jsonl"),
  calibration: path.join(repoRoot, ".gotrader", "research-mcp", "calibration-intents.jsonl"),
  memory: path.join(repoRoot, ".gotrader", "research-mcp", "memory-delivery-requests.jsonl"),
  runbookEvidence: path.join(repoRoot, ".gotrader", "research-mcp", "simulation-runbook-evidence.jsonl"),
  runbookReceipts: path.join(repoRoot, ".gotrader", "research-mcp", "simulation-runbook-receipts.jsonl")
});

const runbookCheckIds = Object.freeze([
  "aiLabThesisGenerated", "handoffExported", "savedLatestHandoff", "readerConversionTested",
  "schedulerOneCycleCompleted", "signalLogged", "brokerExecutionSkipped", "positionsZero",
  "tradesZero", "shutdownComplete"
]);
const researchCycleChecks = new Set(["aiLabThesisGenerated", "signalLogged"]);
const handoffChecks = new Set(["handoffExported", "savedLatestHandoff", "readerConversionTested"]);
const schedulerChecks = new Set([
  "schedulerOneCycleCompleted", "brokerExecutionSkipped", "positionsZero", "tradesZero", "shutdownComplete"
]);

export const scanForForbiddenRuntimeContent = (value, prefix = "snapshot") => {
  const blockers = [];
  const visit = (item, itemPath) => {
    if (Array.isArray(item)) {
      item.forEach((entry, index) => visit(entry, `${itemPath}[${index}]`));
      return;
    }
    if (!item || typeof item !== "object") return;
    for (const [key, nested] of Object.entries(item)) {
      const normalized = compactKey(key);
      if (forbiddenKeys.has(normalized) || /(?:password|credential|secret|apikey|accesstoken|refreshtoken)/.test(normalized)) {
        blockers.push(`${itemPath}.${key}`);
      } else {
        visit(nested, `${itemPath}.${key}`);
      }
    }
  };
  visit(value, prefix);
  return unique(blockers);
};

const requiredIdentityFields = [
  "profileId", "profileVersion", "parameterFingerprint", "sourceFingerprint", "validationIdentity"
];

export const validateRuntimeMirror = (snapshot, { nowMs = Date.now() } = {}) => {
  const blockers = [];
  const bytes = Buffer.byteLength(JSON.stringify(snapshot ?? null));
  if (!snapshot || typeof snapshot !== "object") blockers.push("snapshot_required");
  if (snapshot?.schemaVersion !== 1) blockers.push("unsupported_snapshot_schema");
  if (bytes > GOTRADER_RESEARCH_MCP_MAX_SNAPSHOT_BYTES) blockers.push("snapshot_too_large");
  const forbidden = scanForForbiddenRuntimeContent(snapshot);
  if (forbidden.length) blockers.push("forbidden_runtime_content");
  const capturedMs = Date.parse(snapshot?.capturedAt ?? "");
  if (!Number.isFinite(capturedMs)) blockers.push("captured_at_required");
  if (Number.isFinite(capturedMs) && capturedMs > nowMs + 60_000) blockers.push("snapshot_timestamp_in_future");
  for (const field of requiredIdentityFields) {
    if (!String(snapshot?.activeProfile?.[field] ?? "").trim()) blockers.push(`active_${field}_required`);
  }
  for (const [key, expected] of Object.entries(GOTRADER_RESEARCH_MCP_AUTHORITY)) {
    if (snapshot?.authority?.[key] !== expected) blockers.push(`${key}_must_be_none`);
  }
  return { valid: blockers.length === 0, blockers: unique(blockers), forbiddenFields: forbidden, bytes };
};

export const persistRuntimeMirror = async (snapshot, { repoRoot = process.cwd(), nowMs = Date.now() } = {}) => {
  const validation = validateRuntimeMirror(snapshot, { nowMs });
  if (!validation.valid) return { status: "blocked", ...validation, authority: GOTRADER_RESEARCH_MCP_AUTHORITY };
  const paths = runtimePaths(repoRoot);
  await mkdir(paths.dir, { recursive: true });
  const evidenceId = sha256Id(snapshot);
  const record = { ...snapshot, evidenceId, receivedAt: new Date(nowMs).toISOString() };
  const temporary = `${paths.latest}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  await rename(temporary, paths.latest);
  await appendFile(paths.history, `${JSON.stringify({ evidenceId, capturedAt: record.capturedAt, receivedAt: record.receivedAt, activeProfile: record.activeProfile })}\n`, "utf8");
  await appendDerivedRunbookEvidence(record, { repoRoot, nowMs });
  return { status: "accepted", evidenceId, capturedAt: record.capturedAt, receivedAt: record.receivedAt, bytes: validation.bytes, authority: GOTRADER_RESEARCH_MCP_AUTHORITY };
};

export const readRuntimeMirror = async ({ repoRoot = process.cwd(), nowMs = Date.now() } = {}) => {
  const paths = runtimePaths(repoRoot);
  try {
    const snapshot = JSON.parse(await readFile(paths.latest, "utf8"));
    const validation = validateRuntimeMirror(snapshot, { nowMs });
    const capturedMs = Date.parse(snapshot.capturedAt ?? "");
    const ageMs = Number.isFinite(capturedMs) ? Math.max(0, nowMs - capturedMs) : null;
    const freshness = ageMs !== null && ageMs <= GOTRADER_RESEARCH_MCP_MAX_AGE_MS ? "fresh" : "stale";
    const integrityValid = snapshot.evidenceId === sha256Id(Object.fromEntries(Object.entries(snapshot).filter(([key]) => !["evidenceId", "receivedAt"].includes(key))));
    const blockers = [...validation.blockers];
    if (!integrityValid) blockers.push("runtime_evidence_hash_mismatch");
    if (freshness === "stale") blockers.push("runtime_snapshot_stale");
    return { status: blockers.length ? "blocked" : "available", freshness, ageMs, blockers: unique(blockers), snapshot, authority: GOTRADER_RESEARCH_MCP_AUTHORITY };
  } catch {
    return { status: "unavailable", freshness: "unavailable", ageMs: null, blockers: ["runtime_snapshot_missing"], snapshot: null, authority: GOTRADER_RESEARCH_MCP_AUTHORITY };
  }
};

const appendLedger = async (file, record) => {
  await mkdir(path.dirname(file), { recursive: true });
  await appendFile(file, `${JSON.stringify(record)}\n`, "utf8");
};
const readLedger = async (file, limit = 20) => {
  try {
    return (await readFile(file, "utf8")).split(/\r?\n/).filter(Boolean).slice(-limit).reverse().map((line) => JSON.parse(line));
  } catch {
    return [];
  }
};

const readLedgerChronological = async (file) => {
  try {
    return (await readFile(file, "utf8")).split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  } catch {
    return [];
  }
};

const runbookIdentityFrom = (runtime) => ({
  profileId: runtime.activeProfile.profileId,
  profileVersion: runtime.activeProfile.profileVersion,
  parameterFingerprint: runtime.activeProfile.parameterFingerprint,
  sourceFingerprint: runtime.activeProfile.sourceFingerprint,
  validationIdentity: runtime.activeProfile.validationIdentity
});

const runbookRecordPayload = (record) => Object.fromEntries(
  Object.entries(record).filter(([key]) => key !== "evidenceId")
);

const appendRunbookChecks = async ({ cycleId, checkIds, source, sourceEvidenceId, observedAt, detail, runtime }, { repoRoot, nowMs }) => {
  const paths = runtimePaths(repoRoot);
  const existing = await readLedgerChronological(paths.runbookEvidence);
  let previousEvidenceId = existing.at(-1)?.evidenceId ?? null;
  const identity = runbookIdentityFrom(runtime);
  const appended = [];
  for (const checkId of checkIds) {
    if (!runbookCheckIds.includes(checkId)) continue;
    const duplicate = existing.find((entry) =>
      entry.cycleId === cycleId && entry.checkId === checkId && entry.sourceEvidenceId === sourceEvidenceId
    );
    if (duplicate) {
      appended.push(duplicate);
      previousEvidenceId = existing.at(-1)?.evidenceId ?? previousEvidenceId;
      continue;
    }
    const record = {
      schemaVersion: 1,
      checkId,
      cycleId,
      recordedAt: new Date(nowMs).toISOString(),
      observedAt,
      source,
      sourceEvidenceId,
      previousEvidenceId,
      ...identity,
      detail: String(detail ?? "").slice(0, 1000),
      authority: GOTRADER_RESEARCH_MCP_AUTHORITY
    };
    record.evidenceId = sha256Id(record);
    await appendLedger(paths.runbookEvidence, record);
    existing.push(record);
    appended.push(record);
    previousEvidenceId = record.evidenceId;
  }
  return appended;
};

async function appendDerivedRunbookEvidence(runtime, { repoRoot, nowMs }) {
  const cycle = runtime?.currentCycle;
  const cycleId = String(cycle?.cycleId ?? "").trim();
  const sourceEvidenceId = runtime?.evidenceId;
  if (!cycleId || !/^sha256:[a-f0-9]{64}$/i.test(sourceEvidenceId ?? "")) return [];
  if (!String(cycle?.status ?? "").startsWith("completed")) return [];
  const checks = [];
  if (cycle?.thesis) checks.push("aiLabThesisGenerated");
  if (cycle?.thesis && cycle?.status) checks.push("signalLogged");
  if (!checks.length) return [];
  return appendRunbookChecks({
    cycleId,
    checkIds: checks.filter((checkId) => researchCycleChecks.has(checkId)),
    source: "research_cycle_artifact",
    sourceEvidenceId,
    observedAt: cycle.completedAt ?? runtime.capturedAt,
    detail: "Derived from an integrity-accepted GoTrader runtime mirror for the exact completed research cycle.",
    runtime
  }, { repoRoot, nowMs });
}

export const recordSimulationRunbookReceipt = async (input = {}, { repoRoot = process.cwd(), nowMs = Date.now() } = {}) => {
  const runtimeResult = await readRuntimeMirror({ repoRoot, nowMs });
  const runtime = runtimeResult.snapshot;
  const blockers = [...runtimeResult.blockers];
  const cycleId = String(input.cycleId ?? "").trim();
  const activeCycleId = String(runtime?.currentCycle?.cycleId ?? "").trim();
  const receiptType = input.receiptType;
  const observedAt = String(input.observedAt ?? "");
  const observedMs = Date.parse(observedAt);
  if (!cycleId) blockers.push("runbook_cycle_id_required");
  if (!activeCycleId || cycleId !== activeCycleId) blockers.push("runbook_cycle_identity_mismatch");
  if (!Number.isFinite(observedMs)) blockers.push("runbook_observed_at_required");
  if (Number.isFinite(observedMs) && observedMs > nowMs + 60_000) blockers.push("runbook_observed_at_in_future");
  let checkIds = [];
  if (receiptType === "handoff") {
    if (input.handoffExported !== true) blockers.push("handoff_export_not_verified");
    if (input.savedLatestHandoff !== true) blockers.push("latest_handoff_not_verified");
    if (input.readerConversionTested !== true) blockers.push("reader_conversion_not_verified");
    checkIds = [...handoffChecks];
  } else if (receiptType === "scheduler") {
    if (!String(input.schedulerInvocationId ?? "").trim()) blockers.push("scheduler_invocation_id_required");
    if (input.schedulerOneCycleCompleted !== true) blockers.push("scheduler_cycle_not_completed");
    if (input.brokerExecutionSkipped !== true) blockers.push("broker_execution_not_skipped");
    if (input.positions !== 0) blockers.push("positions_not_zero");
    if (input.trades !== 0) blockers.push("trades_not_zero");
    if (input.shutdownComplete !== true) blockers.push("scheduler_shutdown_incomplete");
    checkIds = [...schedulerChecks];
  } else {
    blockers.push("runbook_receipt_type_invalid");
  }
  const receiptPayload = {
    schemaVersion: 1,
    cycleId,
    receiptType,
    observedAt,
    schedulerInvocationId: input.schedulerInvocationId ?? null,
    handoffExported: input.handoffExported ?? null,
    savedLatestHandoff: input.savedLatestHandoff ?? null,
    readerConversionTested: input.readerConversionTested ?? null,
    schedulerOneCycleCompleted: input.schedulerOneCycleCompleted ?? null,
    brokerExecutionSkipped: input.brokerExecutionSkipped ?? null,
    positions: input.positions ?? null,
    trades: input.trades ?? null,
    shutdownComplete: input.shutdownComplete ?? null,
    detail: String(input.detail ?? "").slice(0, 1000),
    activeProfile: runtime?.activeProfile ?? null,
    runtimeEvidenceId: runtime?.evidenceId ?? null,
    recordedAt: new Date(nowMs).toISOString(),
    authority: GOTRADER_RESEARCH_MCP_AUTHORITY
  };
  const receiptId = sha256Id(receiptPayload);
  const receipt = { ...receiptPayload, receiptId, status: blockers.length ? "blocked" : "accepted", blockers: unique(blockers) };
  await appendLedger(runtimePaths(repoRoot).runbookReceipts, receipt);
  if (blockers.length) return receipt;
  const records = await appendRunbookChecks({
    cycleId,
    checkIds,
    source: receiptType === "handoff" ? "handoff_receipt" : "scheduler_receipt",
    sourceEvidenceId: receiptId,
    observedAt,
    detail: receiptPayload.detail || `${receiptType} receipt accepted for exact-cycle simulation verification.`,
    runtime
  }, { repoRoot, nowMs });
  return { ...receipt, records };
};

export const readSimulationRunbookEvidence = async ({ repoRoot = process.cwd(), nowMs = Date.now() } = {}) => {
  const runtimeResult = await readRuntimeMirror({ repoRoot, nowMs });
  if (runtimeResult.status !== "available") {
    return {
      status: runtimeResult.status,
      cycleId: runtimeResult.snapshot?.currentCycle?.cycleId ?? null,
      evidenceId: null,
      records: [],
      completedChecks: 0,
      totalChecks: runbookCheckIds.length,
      verifiedAt: null,
      blockers: runtimeResult.blockers,
      authority: GOTRADER_RESEARCH_MCP_AUTHORITY
    };
  }
  const all = await readLedgerChronological(runtimePaths(repoRoot).runbookEvidence);
  const integrityBlockers = [];
  let expectedPrevious = null;
  for (const record of all) {
    if (record.previousEvidenceId !== expectedPrevious) integrityBlockers.push("runbook_evidence_chain_broken");
    if (record.evidenceId !== sha256Id(runbookRecordPayload(record))) integrityBlockers.push("runbook_evidence_hash_mismatch");
    expectedPrevious = record.evidenceId;
  }
  const cycleId = String(runtimeResult.snapshot.currentCycle?.cycleId ?? "");
  const identity = runbookIdentityFrom(runtimeResult.snapshot);
  const matchesIdentity = (record) => Object.entries(identity).every(([key, value]) => record[key] === value);
  const latestByCheck = new Map();
  for (const record of all) {
    if (record.cycleId === cycleId && matchesIdentity(record)) latestByCheck.set(record.checkId, record);
  }
  const records = runbookCheckIds.map((checkId) => latestByCheck.get(checkId)).filter(Boolean);
  const missingChecks = runbookCheckIds.filter((checkId) => !latestByCheck.has(checkId));
  const evidenceId = records.length ? sha256Id(records.map((record) => record.evidenceId)) : null;
  return {
    status: integrityBlockers.length ? "blocked" : "available",
    cycleId,
    evidenceId,
    records,
    completedChecks: records.length,
    totalChecks: runbookCheckIds.length,
    verifiedAt: records.length === runbookCheckIds.length
      ? records.map((record) => record.recordedAt).sort().at(-1)
      : null,
    blockers: unique([...integrityBlockers, ...missingChecks.map((checkId) => `runbook_evidence_missing:${checkId}`)]),
    authority: GOTRADER_RESEARCH_MCP_AUTHORITY
  };
};

const identityBlockers = (proposal, active) => {
  const checks = [
    ["strategyProfileId", "profileId", "strategy_profile_mismatch"],
    ["strategyProfileVersion", "profileVersion", "strategy_profile_version_mismatch"],
    ["parameterFingerprint", "parameterFingerprint", "parameter_fingerprint_mismatch"],
    ["sourceFingerprint", "sourceFingerprint", "source_fingerprint_mismatch"],
    ["validationChainId", "validationIdentity", "validation_identity_mismatch"]
  ];
  return checks.filter(([left, right]) => !proposal?.[left] || proposal[left] !== active?.[right]).map(([, , blocker]) => blocker);
};

export const evaluateCanonicalTradeProposal = async (proposal, { repoRoot = process.cwd(), nowMs = Date.now() } = {}) => {
  const runtime = await readRuntimeMirror({ repoRoot, nowMs });
  const blockers = [...runtime.blockers];
  const blockedFields = scanForForbiddenRuntimeContent(proposal, "proposal");
  if (blockedFields.length) blockers.push("unsafe_or_forbidden_payload");
  if (proposal?.autoApplyAllowed === true) blockers.push("auto_apply_not_allowed");
  for (const [key, expected] of Object.entries(GOTRADER_RESEARCH_MCP_AUTHORITY)) {
    if (proposal?.authority?.[key] !== undefined && proposal.authority[key] !== expected) blockers.push(`${key}_must_be_none`);
  }
  const active = runtime.snapshot?.activeProfile;
  blockers.push(...identityBlockers(proposal, active));
  if (proposal?.sourceProvider !== active?.sourceProvider) blockers.push("source_provider_mismatch");
  if (String(proposal?.requestedSymbol ?? "").toUpperCase() !== String(active?.requestedSymbol ?? "").toUpperCase()) blockers.push("requested_symbol_mismatch");
  if (String(proposal?.brokerSymbol ?? "").toUpperCase() !== String(active?.brokerSymbol ?? "").toUpperCase()) blockers.push("broker_symbol_mismatch");
  if (String(proposal?.timeframe ?? "").toLowerCase() !== String(active?.timeframe ?? "").toLowerCase()) blockers.push("timeframe_mismatch");
  if (runtime.snapshot?.validation?.identityStatus !== "matched") blockers.push("canonical_validation_identity_not_matched");
  if (runtime.snapshot?.validation?.status !== "available") blockers.push("canonical_validation_unavailable");
  if (runtime.snapshot?.validation?.evidenceId !== active?.validationIdentity) blockers.push("validation_ledger_identity_mismatch");
  const certifiedValidation = (runtime.snapshot?.certifiedEvidence?.entries ?? []).find(
    (entry) => entry?.evidenceId === active?.validationIdentity
  );
  if (!certifiedValidation) {
    blockers.push("validation_evidence_not_certified");
  } else {
    const certificationMatched =
      certifiedValidation.certificationStatus === "identity_matched" &&
      certifiedValidation.category === "validation results" &&
      Boolean(certifiedValidation.ledgerEntryId) &&
      certifiedValidation.profileId === active?.profileId &&
      certifiedValidation.profileVersion === active?.profileVersion &&
      certifiedValidation.parameterFingerprint === active?.parameterFingerprint &&
      certifiedValidation.sourceFingerprint === active?.sourceFingerprint &&
      certifiedValidation.validationIdentity === active?.validationIdentity;
    if (!certificationMatched) blockers.push("validation_evidence_identity_mismatch");
  }
  if (runtime.snapshot?.readiness?.state !== "ready") blockers.push("readiness_not_ready");
  const direction = proposal?.direction;
  const entry = proposal?.entry;
  const stop = proposal?.stop;
  const targets = Array.isArray(proposal?.targets) ? proposal.targets.filter(finite).slice(0, 4) : [];
  if (!['long', 'short'].includes(direction)) blockers.push("direction_invalid");
  if (!finite(entry) || !finite(stop) || targets.length === 0) blockers.push("price_geometry_incomplete");
  let rr = null;
  if (finite(entry) && finite(stop) && targets.length && ['long', 'short'].includes(direction)) {
    const geometryValid = direction === "long" ? stop < entry && entry < targets[0] : stop > entry && entry > targets[0];
    if (!geometryValid) blockers.push("invalid_price_order");
    rr = Math.abs(targets[0] - entry) / Math.abs(entry - stop);
    if (!finite(rr) || rr < 2) blockers.push("minimum_rr_not_met");
  }
  const uniqueBlockers = unique(blockers);
  const createdAt = new Date(nowMs).toISOString();
  const compactProposal = {
    requestedSymbol: proposal?.requestedSymbol ?? null,
    brokerSymbol: proposal?.brokerSymbol ?? null,
    timeframe: proposal?.timeframe ?? null,
    strategyProfileId: proposal?.strategyProfileId ?? null,
    strategyProfileVersion: proposal?.strategyProfileVersion ?? null,
    parameterFingerprint: proposal?.parameterFingerprint ?? null,
    direction: ['long', 'short'].includes(direction) ? direction : "invalid",
    entry: finite(entry) ? entry : null,
    stop: finite(stop) ? stop : null,
    targets,
    sourceProvider: proposal?.sourceProvider ?? null,
    sourceFingerprint: proposal?.sourceFingerprint ?? null,
    validationChainId: proposal?.validationChainId ?? null
  };
  const proposalId = sha256Id({ createdAt, compactProposal, runtimeEvidenceId: runtime.snapshot?.evidenceId ?? null });
  const result = {
    proposalId,
    createdAt,
    policyVersion: GOTRADER_RESEARCH_MCP_POLICY_VERSION,
    status: uniqueBlockers.length ? "blocked" : "validated_research_proposal",
    compactProposal,
    blockers: uniqueBlockers,
    blockedFields,
    checks: {
      runtimeFreshness: runtime.freshness,
      runtimeEvidenceId: runtime.snapshot?.evidenceId ?? null,
      profileIdentityMatched: !uniqueBlockers.some((item) => item.includes("profile") || item.includes("fingerprint")),
      validationIdentityMatched: !uniqueBlockers.includes("validation_identity_mismatch") && !uniqueBlockers.includes("canonical_validation_identity_not_matched"),
      readinessPassed: runtime.snapshot?.readiness?.state === "ready",
      geometryValid: !uniqueBlockers.includes("invalid_price_order"),
      rr: finite(rr) ? Number(rr.toFixed(4)) : null,
      minimumRr: 2
    },
    ledgerReference: runtime.snapshot?.validation?.evidenceId ?? runtime.snapshot?.evidenceId ?? null,
    executable: false,
    autoApplyAllowed: false,
    authority: GOTRADER_RESEARCH_MCP_AUTHORITY
  };
  await appendLedger(runtimePaths(repoRoot).proposals, result);
  return result;
};

export const readRecentCanonicalProposals = ({ repoRoot = process.cwd(), limit = 20 } = {}) => readLedger(runtimePaths(repoRoot).proposals, limit);

export const createDraftCalibrationIntent = async (input = {}, { repoRoot = process.cwd(), nowMs = Date.now() } = {}) => {
  const runtime = await readRuntimeMirror({ repoRoot, nowMs });
  const blockers = [...runtime.blockers];
  if (!String(input.reason ?? "").trim()) blockers.push("calibration_reason_required");
  const record = {
    intentId: randomUUID(),
    createdAt: new Date(nowMs).toISOString(),
    status: blockers.length ? "blocked" : "draft",
    reason: String(input.reason ?? "").slice(0, 500),
    proposedChanges: input.proposedChanges && typeof input.proposedChanges === "object" ? input.proposedChanges : {},
    activeProfile: runtime.snapshot?.activeProfile ?? null,
    runtimeEvidenceId: runtime.snapshot?.evidenceId ?? null,
    blockers: unique(blockers),
    approvalRequired: true,
    autoApplyAllowed: false,
    authority: GOTRADER_RESEARCH_MCP_AUTHORITY
  };
  await appendLedger(runtimePaths(repoRoot).calibration, record);
  return record;
};
export const readDraftCalibrationIntents = ({ repoRoot = process.cwd(), limit = 20 } = {}) => readLedger(runtimePaths(repoRoot).calibration, limit);

export const requestMemoryDelivery = async ({ reason = "agent_requested_delivery" } = {}, { repoRoot = process.cwd(), nowMs = Date.now() } = {}) => {
  const runtime = await readRuntimeMirror({ repoRoot, nowMs });
  const enabled = runtime.snapshot?.memory?.deliveryEnabled === true;
  const record = {
    requestId: randomUUID(), requestedAt: new Date(nowMs).toISOString(),
    status: enabled ? "operator_policy_enabled_request_queued" : "blocked_operator_policy_disabled",
    reason: String(reason).slice(0, 300), runtimeEvidenceId: runtime.snapshot?.evidenceId ?? null,
    deliveryPerformed: false, remoteOverrideAllowed: false,
    blockers: enabled ? [] : ["operator_memory_delivery_policy_disabled"],
    authority: GOTRADER_RESEARCH_MCP_AUTHORITY
  };
  await appendLedger(runtimePaths(repoRoot).memory, record);
  return record;
};
export const readMemoryDeliveryRequests = ({ repoRoot = process.cwd(), limit = 20 } = {}) => readLedger(runtimePaths(repoRoot).memory, limit);

export const readSurface = async (surface, options = {}) => {
  const runtime = await readRuntimeMirror(options);
  if (runtime.status !== "available") return { status: runtime.status, surface, freshness: runtime.freshness, blockers: runtime.blockers, evidenceId: runtime.snapshot?.evidenceId ?? null, authority: GOTRADER_RESEARCH_MCP_AUTHORITY };
  const map = {
    current_cycle: runtime.snapshot.currentCycle,
    results: runtime.snapshot.results,
    active_profile: runtime.snapshot.activeProfile,
    certified_evidence: runtime.snapshot.certifiedEvidence,
    validation_identity: runtime.snapshot.validation,
    calibration_proposals: runtime.snapshot.calibration,
    readiness: runtime.snapshot.readiness,
    simulated_outcomes: runtime.snapshot.simulatedOutcomes,
    memory_status: runtime.snapshot.memory
  };
  const data = map[surface];
  if (data === undefined || data === null) return { status: "unavailable", surface, freshness: runtime.freshness, blockers: [`${surface}_missing`], evidenceId: runtime.snapshot.evidenceId, authority: GOTRADER_RESEARCH_MCP_AUTHORITY };
  return { status: "available", surface, freshness: runtime.freshness, capturedAt: runtime.snapshot.capturedAt, evidenceId: runtime.snapshot.evidenceId, activeProfile: runtime.snapshot.activeProfile, data, authority: GOTRADER_RESEARCH_MCP_AUTHORITY };
};

export const buildResearchMcpStatus = async (options = {}) => {
  const runtime = await readRuntimeMirror(options);
  return {
    service: "gotrader-research-mcp", protocol: "mcp", policyVersion: GOTRADER_RESEARCH_MCP_POLICY_VERSION,
    runtimeStatus: runtime.status, freshness: runtime.freshness, blockers: runtime.blockers,
    evidenceId: runtime.snapshot?.evidenceId ?? null,
    transports: ["stdio", "streamable_http"],
    capabilities: ["canonical_reads", "proposal_validation", "draft_calibration", "memory_delivery_requests", "simulation_runbook_evidence", "advisory_gbrain"],
    executionAllowed: false, brokerAccessAllowed: false, autoApplyAllowed: false,
    authority: GOTRADER_RESEARCH_MCP_AUTHORITY
  };
};
