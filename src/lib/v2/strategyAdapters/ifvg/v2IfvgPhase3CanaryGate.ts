import { assertV2Authority, V2_AUTHORITY_NONE } from "../../authority/v2Authority";
import { canonicalHash } from "../../serialization/canonicalSerialization";
import {
  V2_IFVG_PHASE3_GATE_SCHEMA,
  V2_IFVG_PHASE3_GATE_VERSION,
  V2_IFVG_PHASE3_MIN_EXACT_LIVE_WINDOWS,
  V2_IFVG_PHASE3_MIN_LIVE_MARKET_DATES,
  V2_IFVG_V2_NEGATIVE_BASELINE_SHA256,
  V2_IFVG_V3_POSITIVE_BASELINE_SHA256,
  type V2IfvgPhase3CanaryGateInput,
  type V2IfvgPhase3CanaryGateResult,
  type V2IfvgPhase3ParityOutcome
} from "./v2IfvgPhase3CanaryTypes";

const forbiddenKey =
  /^(?:candles|rawCandles|rawRuntimeSnapshot|rawSnapshot|accountData|orderData|positionData|password|secret|apiKey|token|mt5Credentials|base64)$/i;

const findForbiddenPaths = (value: unknown, path = "input", found: string[] = []): string[] => {
  if (!value || typeof value !== "object") return found;
  if (Array.isArray(value)) {
    value.forEach((item, index) => findForbiddenPaths(item, `${path}[${index}]`, found));
    return found;
  }
  Object.entries(value as Record<string, unknown>).forEach(([key, nested]) => {
    const nestedPath = `${path}.${key}`;
    if (forbiddenKey.test(key)) found.push(nestedPath);
    findForbiddenPaths(nested, nestedPath, found);
  });
  return found;
};

const uniqueSorted = (values: readonly string[]) =>
  Object.freeze([...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right)));

const equal = (left: number, right: number) => Math.abs(left - right) < 1e-9;

const artifactIntegrityMatches = async (
  input: V2IfvgPhase3CanaryGateInput["positiveCanary"] |
    V2IfvgPhase3CanaryGateInput["negativeControl"]
) => {
  const { artifactId, ...artifactCore } = input;
  return artifactId === await canonicalHash(artifactCore);
};

const v3BaselinePreserved = (input: V2IfvgPhase3CanaryGateInput["positiveCanary"]) =>
  input.profileId === "ifvg_fresh_retest_v3_research" &&
  input.profileVersion === "v3" &&
  input.classification === "positive_canary" &&
  input.baselineSnapshotHash === V2_IFVG_V3_POSITIVE_BASELINE_SHA256 &&
  input.replay.completedResearchTrades === 172 &&
  equal(input.replay.targetFirstRate, 0.5523) &&
  equal(input.replay.averageR, 2.805) &&
  equal(input.replay.profitFactor, 5.979) &&
  equal(input.replay.maximumDrawdownR, 8.966) &&
  input.replay.uniqueTradingDates === 95 &&
  input.replay.positiveRollingWindows === 11 &&
  input.replay.totalRollingWindows === 11 &&
  input.oos.verdict === "passed" &&
  input.oos.windowsPassed === 2 &&
  input.oos.totalWindows === 2 &&
  input.oos.trades === 64 &&
  input.oos.uniqueDates === 34 &&
  equal(input.oos.averageR, 3.458) &&
  equal(input.oos.profitFactor, 8.081) &&
  equal(input.oos.additionalHalfRCostAverageR, 2.958) &&
  input.oos.authorityCreated === false &&
  input.promotionAllowed === false;

const v2NegativeControlPreserved = (input: V2IfvgPhase3CanaryGateInput["negativeControl"]) =>
  input.profileId === "ifvg_filtered_v2_research" &&
  input.profileVersion === "v2" &&
  input.classification === "negative_control" &&
  input.baselineSnapshotHash === V2_IFVG_V2_NEGATIVE_BASELINE_SHA256 &&
  input.replay.currentWindowCandidates === 16 &&
  equal(input.replay.currentWindowTargetFirstRate, 0.6875) &&
  input.replay.currentWindowUniqueDates === 15 &&
  input.replay.independentWindowCandidates === 6 &&
  equal(input.replay.independentWindowTargetFirstRate, 0.3333) &&
  equal(input.replay.independentWindowInvalidationFirstRate, 0.6667) &&
  input.oos.verdict === "insufficient_data" &&
  input.oos.independentBehavior === "degraded" &&
  input.oos.promotionAllowed === false &&
  input.promotionAllowed === false;

const weakestParity = (
  values: readonly V2IfvgPhase3ParityOutcome[]
): V2IfvgPhase3ParityOutcome =>
  values.includes("regression")
    ? "regression"
    : values.includes("insufficient_comparison_data")
      ? "insufficient_comparison_data"
      : "exact_parity";

export async function evaluateV2IfvgPhase3CanaryGate(
  input: Readonly<V2IfvgPhase3CanaryGateInput>
): Promise<Readonly<V2IfvgPhase3CanaryGateResult>> {
  assertV2Authority(input.positiveCanary.authority);
  assertV2Authority(input.negativeControl.authority);
  if (input.historicalEvidence) assertV2Authority(input.historicalEvidence.authority);
  if (input.liveShadow) assertV2Authority(input.liveShadow.authority);
  const evaluatedAt = new Date(input.evaluatedAtUtc);
  if (!Number.isFinite(evaluatedAt.valueOf())) throw new Error("IFVG Phase 3 gate time is invalid.");

  const forbiddenPaths = findForbiddenPaths(input);
  const [positiveArtifactIntegrity, negativeArtifactIntegrity] = await Promise.all([
    artifactIntegrityMatches(input.positiveCanary),
    artifactIntegrityMatches(input.negativeControl)
  ]);
  const positiveCanaryPreserved =
    positiveArtifactIntegrity && v3BaselinePreserved(input.positiveCanary);
  const negativeControlPreserved =
    negativeArtifactIntegrity && v2NegativeControlPreserved(input.negativeControl);
  const positiveHistoricalSourceFingerprint =
    input.positiveCanary.historicalSourceFingerprint;
  const negativeHistoricalSourceFingerprint =
    input.negativeControl.historicalSourceFingerprint;
  const validHistoricalSourceFingerprints =
    Boolean(
      positiveHistoricalSourceFingerprint &&
      /^sha256:[a-f0-9]{64}$/i.test(positiveHistoricalSourceFingerprint) &&
      negativeHistoricalSourceFingerprint &&
      /^sha256:[a-f0-9]{64}$/i.test(negativeHistoricalSourceFingerprint)
    );
  const historicalSourceIdentityMatches =
    validHistoricalSourceFingerprints &&
    positiveHistoricalSourceFingerprint === negativeHistoricalSourceFingerprint;
  const legacyIdentityMatchedResearchEvidence =
    input.positiveCanary.provenanceStatus === "identity_matched" &&
    input.negativeControl.provenanceStatus === "identity_matched" &&
    historicalSourceIdentityMatches;
  const historicalEvidenceValidated = Boolean(
    input.historicalEvidence &&
    input.historicalEvidence.validationStatus === "accepted" &&
    input.historicalEvidence.sourceIdentityMatches &&
    input.historicalEvidence.parameterIdentityMatches &&
    input.historicalEvidence.costModelIdentityMatches &&
    input.historicalEvidence.boundaryIdentityComplete &&
    input.historicalEvidence.metricsExact &&
    input.historicalEvidence.blockers.length === 0
  );
  const historicalEvidenceRegression =
    input.historicalEvidence?.validationStatus === "regression";
  const identityMatchedResearchEvidence =
    historicalEvidenceValidated || legacyIdentityMatchedResearchEvidence;
  const liveShadowReviewThresholdMet = Boolean(
    input.liveShadow &&
    input.liveShadow.validationStatus === "accepted" &&
    input.liveShadow.regressionCount === 0 &&
    input.liveShadow.insufficientComparisonCount === 0 &&
    input.liveShadow.exactParityCount >= V2_IFVG_PHASE3_MIN_EXACT_LIVE_WINDOWS &&
    input.liveShadow.distinctClosedWindowCount >= V2_IFVG_PHASE3_MIN_EXACT_LIVE_WINDOWS &&
    input.liveShadow.distinctMarketDateCount >= V2_IFVG_PHASE3_MIN_LIVE_MARKET_DATES &&
    input.liveShadow.statisticallyIndependentWindowClaimed === false
  );
  const researchLifecycleParity: V2IfvgPhase3ParityOutcome =
    !positiveCanaryPreserved || !negativeControlPreserved || historicalEvidenceRegression
      ? "regression"
      : identityMatchedResearchEvidence
        ? "exact_parity"
        : "insufficient_comparison_data";
  const liveShadowParity: V2IfvgPhase3ParityOutcome =
    input.liveShadow?.regressionCount
      ? "regression"
      : liveShadowReviewThresholdMet
        ? "exact_parity"
        : "insufficient_comparison_data";
  const deterministicParity = weakestParity([
    input.deterministicParity.detection,
    input.deterministicParity.geometry,
    input.deterministicParity.selection
  ]);
  const regression =
    forbiddenPaths.length > 0 ||
    deterministicParity === "regression" ||
    researchLifecycleParity === "regression" ||
    liveShadowParity === "regression";
  const insufficient =
    deterministicParity === "insufficient_comparison_data" ||
    researchLifecycleParity === "insufficient_comparison_data" ||
    liveShadowParity === "insufficient_comparison_data";
  const phase3CompletionReviewReady =
    input.canaryMode === "shadow" && !regression && !insufficient;
  const status = input.canaryMode === "disabled"
    ? "disabled" as const
    : regression
      ? "blocked_regression" as const
      : insufficient
        ? "blocked_insufficient_comparison_data" as const
        : "ready_for_completion_review" as const;
  const blockers = uniqueSorted([
    input.canaryMode === "disabled" ? "ifvg_phase3_canary_disabled" : "",
    ...forbiddenPaths.map((path) => `ifvg_phase3_forbidden_field:${path}`),
    input.deterministicParity.detection === "exact_parity" ? "" : "ifvg_v3_detection_parity_not_exact",
    input.deterministicParity.geometry === "exact_parity" ? "" : "ifvg_v3_geometry_parity_not_exact",
    input.deterministicParity.selection === "exact_parity" ? "" : "ifvg_v3_selection_parity_not_exact",
    positiveCanaryPreserved ? "" : "ifvg_v3_positive_canary_baseline_regression",
    negativeControlPreserved ? "" : "ifvg_v2_negative_control_regression",
    input.historicalEvidence ? "" : input.positiveCanary.provenanceStatus === "identity_matched"
      ? ""
      : "ifvg_v3_replay_oos_source_identity_missing",
    input.historicalEvidence ? "" : input.negativeControl.provenanceStatus === "identity_matched"
      ? ""
      : "ifvg_v2_replay_oos_source_identity_missing",
    !input.historicalEvidence &&
    input.positiveCanary.provenanceStatus === "identity_matched" &&
    input.negativeControl.provenanceStatus === "identity_matched" &&
    !validHistoricalSourceFingerprints
      ? "ifvg_phase3_replay_oos_source_identity_invalid"
      : "",
    !input.historicalEvidence &&
    validHistoricalSourceFingerprints && !historicalSourceIdentityMatches
      ? "ifvg_phase3_replay_oos_source_identity_mismatch"
      : "",
    ...(input.historicalEvidence?.blockers ?? []),
    input.historicalEvidence && !historicalEvidenceValidated &&
    input.historicalEvidence.blockers.length === 0
      ? "ifvg_phase3_historical_evidence_not_accepted"
      : "",
    input.liveShadow ? "" : "ifvg_v3_live_shadow_ledger_missing",
    input.liveShadow && input.liveShadow.regressionCount > 0
      ? "ifvg_v3_live_shadow_regression_present"
      : "",
    input.liveShadow &&
    input.liveShadow.exactParityCount < V2_IFVG_PHASE3_MIN_EXACT_LIVE_WINDOWS
      ? "ifvg_v3_live_shadow_exact_window_sample_too_small"
      : "",
    input.liveShadow &&
    input.liveShadow.distinctMarketDateCount < V2_IFVG_PHASE3_MIN_LIVE_MARKET_DATES
      ? "ifvg_v3_live_shadow_market_date_sample_too_small"
      : "",
    input.liveShadow && input.liveShadow.insufficientComparisonCount > 0
      ? "ifvg_v3_live_shadow_contains_insufficient_comparisons"
      : ""
  ]);
  const warnings = uniqueSorted([
    "Live closed-window parity observations are operational canaries, not statistically independent research evidence.",
    ...(input.historicalEvidence?.warnings ?? []),
    input.positiveCanary.replay.maximumDrawdownR > 4
      ? "The preserved IFVG v3 replay drawdown exceeds the current conservative research benchmark."
      : "",
    "A completion-review result does not authorize production adoption, evidence creation, readiness, or Phase 4."
  ]);
  const resultCore: Omit<V2IfvgPhase3CanaryGateResult, "gateId"> = {
    schemaVersion: V2_IFVG_PHASE3_GATE_SCHEMA,
    version: V2_IFVG_PHASE3_GATE_VERSION,
    evaluatedAtUtc: evaluatedAt.toISOString(),
    status,
    migrationMode: input.canaryMode === "disabled"
      ? "legacy_authoritative" as const
      : "shadow" as const,
    detectionParity: input.deterministicParity.detection,
    geometryParity: input.deterministicParity.geometry,
    selectionParity: input.deterministicParity.selection,
    researchLifecycleParity,
    liveShadowParity,
    positiveCanaryPreserved,
    negativeControlPreserved,
    historicalEvidenceValidated,
    identityMatchedResearchEvidence,
    liveShadowReviewThresholdMet,
    phase3CompletionReviewReady,
    phase4ImplementationAuthorized: false as const,
    productionAdoptionAllowed: false as const,
    canCreateValidationChainEntry: false as const,
    canCreateEvidence: false as const,
    statisticallyIndependentWindowClaimed: false as const,
    blockers,
    warnings,
    nextAction: phase3CompletionReviewReady
      ? "Request a human Phase 3 completion and rollback review; do not adopt production behavior."
      : input.canaryMode === "disabled"
        ? "Keep legacy IFVG v3 authoritative. Re-enable shadow collection only for an approved canary review."
        : !identityMatchedResearchEvidence
          ? "Regenerate replay and OOS artifacts with matching source, profile, parameter, and cost-model identity."
          : "Collect exact live shadow parity across additional closed windows and market dates.",
    rollbackAction:
      "Set V2_IFVG_LIVE_SHADOW_MODE=disabled and stop the collector; legacy IFVG v3 remains authoritative.",
    authority: V2_AUTHORITY_NONE
  };
  return Object.freeze({
    ...resultCore,
    gateId: await canonicalHash(resultCore)
  });
}
