import crypto from "node:crypto";

export const CURRENT_LIVE_TIME_VERIFICATION_SCHEMA =
  "gotrader-current-live-time-verification-v1";
export const CURRENT_LIVE_TIME_VERIFICATION_VERSION = "1.0.0";
export const CURRENT_LIVE_FRESH_MS = 120_000;
export const CURRENT_LIVE_EXPIRES_MS = 180_000;

export const currentLiveVerificationAuthority = Object.freeze({
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
});

const forbiddenKeyPattern =
  /(account|balance|position|order|deal|credential|password|secret|token|api.?key|rawcandles?|candles|screenshot|base64)/i;

const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalize(value[key])])
  );
};

export const canonicalHash = (value) =>
  `sha256:${crypto
    .createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex")}`;

const unique = (values) => [...new Set(values.filter(Boolean))];

const proofStateAt = ({ generatedAtUtc, nowUtc = new Date().toISOString() }) => {
  const generatedMs = Date.parse(generatedAtUtc ?? "");
  const nowMs = Date.parse(nowUtc);
  if (!Number.isFinite(generatedMs) || !Number.isFinite(nowMs) || nowMs < generatedMs - 5_000) {
    return { state: "conflicting", ageSeconds: undefined };
  }
  const ageMs = Math.max(0, nowMs - generatedMs);
  if (ageMs <= CURRENT_LIVE_FRESH_MS) {
    return { state: "fresh", ageSeconds: Math.round(ageMs / 1_000) };
  }
  if (ageMs <= CURRENT_LIVE_EXPIRES_MS) {
    return { state: "expiring", ageSeconds: Math.round(ageMs / 1_000) };
  }
  return { state: "stale", ageSeconds: Math.round(ageMs / 1_000) };
};

const compactContract = (contract) => ({
  contractId: contract?.contractId,
  contractVersion: contract?.version,
  verificationArtifactId: contract?.timeVerificationArtifactId,
  verificationScope: contract?.timeVerificationScope,
  verificationStatus: contract?.verificationStatus,
  providerTimeBasis: contract?.providerTimeBasis,
  terminalBasisClassification: contract?.terminalBasisClassification,
  observedOffsetMinutes:
    contract?.terminalObservedOffsetMinutes ?? contract?.observedOffsetMinutes,
  terminalClockClassificationVersion: contract?.terminalClockClassificationVersion,
  terminalProbeObservationId: contract?.terminalProbeObservationId,
  terminalProbeInstanceId: contract?.terminalProbeInstanceId,
  terminalProbeFingerprint: contract?.terminalProbeFingerprint,
  quoteObservationFingerprint: contract?.quoteObservationFingerprint,
  candleObservationFingerprint: contract?.candleObservationFingerprint,
  generatedAtUtc:
    contract?.timeVerificationGeneratedAtUtc ?? contract?.terminalProbeCapturedAt,
  expiresAtUtc: contract?.timeVerificationExpiresAtUtc,
  proofState: contract?.timeVerificationProofState,
  currentLiveTimeBasisVerified: contract?.currentLiveTimeBasisVerified === true,
  historicalDstPolicyVerified: contract?.historicalDstPolicyVerified === true,
  readOnly: contract?.readOnly === true,
  marketDataOnly: contract?.marketDataOnly === true,
  sourceMethod: contract?.sourceMethod
});

export function compareCurrentLiveContractSurfaces({
  upstream,
  bridge,
  nowUtc = new Date().toISOString()
}) {
  const blockers = [];
  const upstreamCompact = compactContract(upstream);
  const bridgeCompact = compactContract(bridge);
  const requiredAgreementFields = [
    "contractId",
    "contractVersion",
    "verificationArtifactId",
    "verificationScope",
    "providerTimeBasis",
    "terminalBasisClassification",
    "observedOffsetMinutes",
    "terminalClockClassificationVersion",
    "terminalProbeObservationId",
    "terminalProbeInstanceId",
    "generatedAtUtc",
    "expiresAtUtc",
    "currentLiveTimeBasisVerified",
    "historicalDstPolicyVerified"
  ];
  for (const field of requiredAgreementFields) {
    if (upstreamCompact[field] !== bridgeCompact[field]) {
      blockers.push(`upstream_bridge_${field}_mismatch`);
    }
  }
  if (!upstreamCompact.verificationArtifactId) blockers.push("verification_artifact_id_missing");
  if (upstreamCompact.verificationScope !== "current_live") {
    blockers.push("verification_scope_not_current_live");
  }
  if (!upstreamCompact.currentLiveTimeBasisVerified) {
    blockers.push("current_live_time_basis_not_verified");
  }
  if (upstreamCompact.historicalDstPolicyVerified) {
    blockers.push("historical_verification_must_remain_false");
  }
  if (!upstreamCompact.readOnly || !upstreamCompact.marketDataOnly) {
    blockers.push("time_contract_read_only_boundary_invalid");
  }
  const proof = proofStateAt({
    generatedAtUtc: upstreamCompact.generatedAtUtc,
    nowUtc
  });
  if (proof.state !== "fresh") blockers.push(`current_live_proof_${proof.state}`);
  if (
    upstreamCompact.proofState &&
    upstreamCompact.proofState !== proof.state
  ) {
    blockers.push("time_contract_proof_state_mismatch");
  }
  if (
    String(bridgeCompact.sourceMethod ?? "").startsWith("contract_stub:") ||
    String(upstreamCompact.sourceMethod ?? "").startsWith("contract_stub:")
  ) {
    blockers.push("time_contract_stub_returned");
  }
  return Object.freeze({
    status: blockers.length ? "blocked" : "accepted",
    blockers: Object.freeze(unique(blockers)),
    proofState: proof.state,
    proofAgeSeconds: proof.ageSeconds,
    upstream: Object.freeze(upstreamCompact),
    bridge: Object.freeze(bridgeCompact),
    authority: currentLiveVerificationAuthority
  });
}

const validateDirectProbeAgreement = ({
  directProbe,
  agreement,
  requestedSymbol,
  brokerSymbol,
  requireDirectProbe
}) => {
  if (!requireDirectProbe) return [];
  const blockers = [];
  if (directProbe?.status !== "complete") {
    blockers.push(
      `direct_terminal_probe_${String(
        directProbe?.reason ?? directProbe?.status ?? "missing"
      )}`
    );
    return blockers;
  }
  if (directProbe?.probeMode !== "persistent_ea") {
    blockers.push("direct_terminal_probe_not_persistent");
  }
  if (directProbe?.probeVersion !== "1.1.0") {
    blockers.push("direct_terminal_probe_version_invalid");
  }
  if (directProbe?.probeState !== "fresh") {
    blockers.push(`direct_terminal_probe_${directProbe?.probeState ?? "invalid"}`);
  }
  if (directProbe?.terminalConnected !== true) {
    blockers.push("direct_terminal_probe_disconnected");
  }
  if (directProbe?.observationId !== agreement.upstream.terminalProbeObservationId) {
    blockers.push("direct_upstream_probe_observation_mismatch");
  }
  if (directProbe?.probeInstanceId !== agreement.upstream.terminalProbeInstanceId) {
    blockers.push("direct_upstream_probe_instance_mismatch");
  }
  if (
    Date.parse(directProbe?.terminalProbeCapturedAt ?? "") !==
    Date.parse(agreement.upstream.generatedAtUtc ?? "")
  ) {
    blockers.push("direct_upstream_probe_generated_time_mismatch");
  }
  if (
    directProbe?.terminalClockClassificationVersion !==
    agreement.upstream.terminalClockClassificationVersion
  ) {
    blockers.push("direct_upstream_classifier_version_mismatch");
  }
  if (
    directProbe?.observedOffsetMinutes !==
    agreement.upstream.observedOffsetMinutes
  ) {
    blockers.push("direct_upstream_observed_offset_mismatch");
  }
  if (
    directProbe?.providerTimeBasis &&
    directProbe.providerTimeBasis !==
      agreement.upstream.terminalBasisClassification
  ) {
    blockers.push("direct_upstream_provider_basis_mismatch");
  }
  if (
    String(directProbe?.symbol ?? brokerSymbol).toUpperCase() !==
    String(brokerSymbol).toUpperCase()
  ) {
    blockers.push("direct_terminal_probe_symbol_mismatch");
  }
  if (!requestedSymbol || !brokerSymbol) {
    blockers.push("verification_symbol_identity_missing");
  }
  return unique(blockers);
};

export function buildCurrentLiveVerificationArtifact({
  upstream,
  bridge,
  directProbe,
  requestedSymbol = "MNQ",
  brokerSymbol = "USTECH",
  nowUtc = new Date().toISOString(),
  requireDirectProbe = false,
  continuityStartedAtUtc,
  renewalSequence
}) {
  const agreement = compareCurrentLiveContractSurfaces({
    upstream,
    bridge,
    nowUtc
  });
  const generatedAtUtc =
    agreement.upstream.generatedAtUtc ?? directProbe?.terminalProbeCapturedAt ?? nowUtc;
  const generatedMs = Date.parse(generatedAtUtc);
  const expiresAtUtc = Number.isFinite(generatedMs)
    ? new Date(generatedMs + CURRENT_LIVE_EXPIRES_MS).toISOString()
    : nowUtc;
  const directBlockers = validateDirectProbeAgreement({
    directProbe,
    agreement,
    requestedSymbol,
    brokerSymbol,
    requireDirectProbe
  });
  const validationBlockers = unique([
    ...agreement.blockers,
    ...directBlockers
  ]);
  const validationStatus = validationBlockers.length ? "blocked" : "accepted";
  const core = {
    schemaVersion: CURRENT_LIVE_TIME_VERIFICATION_SCHEMA,
    version: CURRENT_LIVE_TIME_VERIFICATION_VERSION,
    generatedAtUtc,
    expiresAtUtc,
    verificationScope: "current_live",
    requestedSymbol,
    brokerSymbol,
    providerTimeBasis: agreement.upstream.providerTimeBasis ?? "unknown",
    observedOffsetMinutes: agreement.upstream.observedOffsetMinutes,
    terminalClockClassificationVersion:
      agreement.upstream.terminalClockClassificationVersion ?? "unknown",
    terminalProbeFingerprint:
      agreement.upstream.terminalProbeFingerprint ??
      canonicalHash({
        observationId: directProbe?.observationId,
        probeInstanceId: directProbe?.probeInstanceId,
        capturedAt: directProbe?.terminalProbeCapturedAt
      }),
    probeObservationId:
      directProbe?.observationId ?? agreement.upstream.terminalProbeObservationId,
    probeInstanceFingerprint:
      directProbe?.probeInstanceId ?? agreement.upstream.terminalProbeInstanceId,
    probeVersion: directProbe?.probeVersion,
    probeMode: directProbe?.probeMode,
    probeState: directProbe?.probeState,
    terminalConnected: directProbe?.terminalConnected,
    quoteObservationFingerprint:
      agreement.upstream.quoteObservationFingerprint ??
      canonicalHash({
        quoteObservedAt: directProbe?.quoteObservedAt,
        quoteBasis: directProbe?.pythonTransportBasis
      }),
    candleObservationFingerprint:
      agreement.upstream.candleObservationFingerprint,
    upstreamContractArtifactId: agreement.upstream.verificationArtifactId,
    bridgeContractArtifactId: agreement.bridge.verificationArtifactId,
    currentLiveTimeBasisVerified: validationStatus === "accepted",
    historicalDstPolicyVerified: false,
    proofState: agreement.proofState,
    validationStatus,
    blockers: Object.freeze(validationBlockers),
    warnings: Object.freeze(
      validationStatus === "accepted"
        ? ["Historical DST policy remains independently unverified."]
        : []
    ),
    ...(continuityStartedAtUtc ? { continuityStartedAtUtc } : {}),
    ...(Number.isInteger(renewalSequence) ? { renewalSequence } : {}),
    rawProbePersisted: false,
    rawCandlesPersisted: false,
    productionAdoptionAllowed: false,
    authority: currentLiveVerificationAuthority
  };
  return Object.freeze({
    ...core,
    artifactId: canonicalHash(core)
  });
}

export function assertCompactTimeVerificationArtifact(artifact) {
  const errors = [];
  const visit = (value, path = "") => {
    if (!value || typeof value !== "object") return;
    for (const [key, nested] of Object.entries(value)) {
      const nestedPath = path ? `${path}.${key}` : key;
      if (
        forbiddenKeyPattern.test(key) &&
        key !== "rawProbePersisted" &&
        key !== "rawCandlesPersisted"
      ) {
        errors.push(`forbidden_field:${nestedPath}`);
      }
      visit(nested, nestedPath);
    }
  };
  visit(artifact);
  if (
    artifact?.authority?.executionAuthority !== "none" ||
    artifact?.authority?.brokerAuthority !== "none" ||
    artifact?.authority?.readinessOverrideAuthority !== "none"
  ) {
    errors.push("authority_not_none");
  }
  if (artifact?.historicalDstPolicyVerified !== false) {
    errors.push("historical_verification_not_false");
  }
  if (artifact?.rawProbePersisted !== false || artifact?.rawCandlesPersisted !== false) {
    errors.push("raw_payload_persistence_not_false");
  }
  if (
    artifact?.validationStatus === "accepted" &&
    artifact?.terminalConnected === false
  ) {
    errors.push("accepted_artifact_terminal_disconnected");
  }
  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(unique(errors))
  });
}
