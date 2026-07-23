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
  observedOffsetMinutes:
    contract?.terminalObservedOffsetMinutes ?? contract?.observedOffsetMinutes,
  terminalClockClassificationVersion: contract?.terminalClockClassificationVersion,
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
    "observedOffsetMinutes",
    "terminalClockClassificationVersion",
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

export function buildCurrentLiveVerificationArtifact({
  upstream,
  bridge,
  directProbe,
  requestedSymbol = "MNQ",
  brokerSymbol = "USTECH",
  nowUtc = new Date().toISOString()
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
    currentLiveTimeBasisVerified: agreement.status === "accepted",
    historicalDstPolicyVerified: false,
    proofState: agreement.proofState,
    validationStatus: agreement.status,
    blockers: agreement.blockers,
    warnings: Object.freeze(
      agreement.status === "accepted"
        ? ["Historical DST policy remains independently unverified."]
        : []
    ),
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
  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(unique(errors))
  });
}
