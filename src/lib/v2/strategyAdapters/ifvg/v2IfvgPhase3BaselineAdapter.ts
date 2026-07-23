import type { GoldenBaselineFixture } from "../../../v2Baseline/baselineTypes";
import { assertV2Authority, V2_AUTHORITY_NONE } from "../../authority/v2Authority";
import { canonicalHash } from "../../serialization/canonicalSerialization";
import {
  V2_IFVG_PHASE3_LIFECYCLE_SCHEMA,
  V2_IFVG_PHASE3_LIFECYCLE_VERSION,
  type V2IfvgPhase3ResearchLifecycleArtifact,
  type V2IfvgV2ResearchLifecycleArtifact,
  type V2IfvgV2OosSummary,
  type V2IfvgV2ReplaySummary,
  type V2IfvgV3ResearchLifecycleArtifact,
  type V2IfvgV3OosSummary,
  type V2IfvgV3ReplaySummary
} from "./v2IfvgPhase3CanaryTypes";

const numberField = (value: unknown, name: string) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`IFVG Phase 3 baseline field ${name} is invalid.`);
  }
  return value;
};

const booleanField = (value: unknown, name: string) => {
  if (typeof value !== "boolean") {
    throw new Error(`IFVG Phase 3 baseline field ${name} is invalid.`);
  }
  return value;
};

const textField = (value: unknown, name: string) => {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`IFVG Phase 3 baseline field ${name} is invalid.`);
  }
  return value;
};

const buildV3Replay = (input: Record<string, unknown>): Readonly<V2IfvgV3ReplaySummary> =>
  Object.freeze({
    completedResearchTrades: numberField(input.completedResearchTrades, "completedResearchTrades"),
    targetFirstRate: numberField(input.targetFirstRate, "targetFirstRate"),
    averageR: numberField(input.averageR, "averageR"),
    profitFactor: numberField(input.profitFactor, "profitFactor"),
    maximumDrawdownR: numberField(input.maximumDrawdownR, "maximumDrawdownR"),
    uniqueTradingDates: numberField(input.uniqueTradingDates, "uniqueTradingDates"),
    positiveRollingWindows: numberField(input.positiveRollingWindows, "positiveRollingWindows"),
    totalRollingWindows: numberField(input.totalRollingWindows, "totalRollingWindows")
  });

const buildV3Oos = (input: Record<string, unknown>): Readonly<V2IfvgV3OosSummary> => {
  if (input.verdict !== "passed") throw new Error("IFVG v3 frozen OOS verdict drifted.");
  if (booleanField(input.authorityCreated, "authorityCreated") !== false) {
    throw new Error("IFVG v3 frozen OOS artifact attempted to create authority.");
  }
  return Object.freeze({
    verdict: "passed" as const,
    windowsPassed: numberField(input.windowsPassed, "windowsPassed"),
    totalWindows: numberField(input.totalWindows, "totalWindows"),
    trades: numberField(input.trades, "trades"),
    uniqueDates: numberField(input.uniqueDates, "uniqueDates"),
    averageR: numberField(input.averageR, "averageR"),
    profitFactor: numberField(input.profitFactor, "profitFactor"),
    additionalHalfRCostAverageR: numberField(
      input.additionalHalfRCostAverageR,
      "additionalHalfRCostAverageR"
    ),
    authorityCreated: false as const
  });
};

const buildV2Replay = (input: Record<string, unknown>): Readonly<V2IfvgV2ReplaySummary> =>
  Object.freeze({
    currentWindowCandidates: numberField(input.currentWindowCandidates, "currentWindowCandidates"),
    currentWindowTargetFirstRate: numberField(
      input.currentWindowTargetFirstRate,
      "currentWindowTargetFirstRate"
    ),
    currentWindowUniqueDates: numberField(input.currentWindowUniqueDates, "currentWindowUniqueDates"),
    independentWindowCandidates: numberField(
      input.independentWindowCandidates,
      "independentWindowCandidates"
    ),
    independentWindowTargetFirstRate: numberField(
      input.independentWindowTargetFirstRate,
      "independentWindowTargetFirstRate"
    ),
    independentWindowInvalidationFirstRate: numberField(
      input.independentWindowInvalidationFirstRate,
      "independentWindowInvalidationFirstRate"
    )
  });

const buildV2Oos = (input: Record<string, unknown>): Readonly<V2IfvgV2OosSummary> => {
  if (
    input.verdict !== "insufficient_data" ||
    input.independentBehavior !== "degraded" ||
    input.promotionAllowed !== false
  ) {
    throw new Error("IFVG v2 negative-control OOS behavior drifted.");
  }
  return Object.freeze({
    verdict: "insufficient_data" as const,
    independentBehavior: "degraded" as const,
    promotionAllowed: false as const
  });
};

export async function buildV2IfvgPhase3ResearchLifecycleArtifactFromBaseline({
  fixture,
  baselineSnapshotHash,
  historicalSourceFingerprint
}: {
  fixture: Readonly<GoldenBaselineFixture>;
  baselineSnapshotHash: string;
  historicalSourceFingerprint?: string;
}): Promise<Readonly<V2IfvgPhase3ResearchLifecycleArtifact>> {
  assertV2Authority(fixture.authority);
  if (!/^[a-f0-9]{64}$/i.test(baselineSnapshotHash)) {
    throw new Error("IFVG Phase 3 baseline snapshot hash is invalid.");
  }
  const replay = fixture.expectedReplaySummary;
  const oos = fixture.expectedOosSummary;
  if (!replay || !oos) throw new Error("IFVG Phase 3 baseline lifecycle summaries are missing.");
  const profileId = fixture.identity.strategyId;
  const parameterFingerprint = textField(
    fixture.identity.parameterFingerprint,
    "parameterFingerprint"
  );
  const costModel = textField(fixture.identity.costModel, "costModel");
  const detectionFixtureSourceFingerprint = textField(
    fixture.identity.sourceFingerprint,
    "sourceFingerprint"
  );
  if (
    historicalSourceFingerprint &&
    !/^sha256:[a-f0-9]{64}$/i.test(historicalSourceFingerprint)
  ) {
    throw new Error("IFVG Phase 3 historical source fingerprint is invalid.");
  }
  const provenanceStatus = historicalSourceFingerprint
    ? "identity_matched" as const
    : "legacy_audit_missing_source_identity" as const;
  const shared = {
    schemaVersion: V2_IFVG_PHASE3_LIFECYCLE_SCHEMA,
    version: V2_IFVG_PHASE3_LIFECYCLE_VERSION,
    baselineSnapshotHash: baselineSnapshotHash.toLowerCase(),
    detectionFixtureSourceFingerprint,
    ...(historicalSourceFingerprint ? { historicalSourceFingerprint } : {}),
    parameterFingerprint,
    costModel,
    provenanceStatus,
    promotionAllowed: false as const,
    canCreateEvidence: false as const,
    statisticallyIndependentWindowClaimed: false as const,
    researchOnly: true as const,
    shadowOnly: true as const,
    authority: V2_AUTHORITY_NONE
  } as const;
  if (profileId === "ifvg_fresh_retest_v3_research") {
    const artifactCore = {
      ...shared,
      profileId: "ifvg_fresh_retest_v3_research" as const,
      profileVersion: "v3" as const,
      classification: "positive_canary" as const,
      replay: buildV3Replay(replay),
      oos: buildV3Oos(oos)
    };
    const artifact: V2IfvgV3ResearchLifecycleArtifact = {
      ...artifactCore,
      artifactId: await canonicalHash(artifactCore)
    };
    return Object.freeze(artifact);
  }
  if (profileId === "ifvg_filtered_v2_research") {
    const artifactCore = {
      ...shared,
      profileId: "ifvg_filtered_v2_research" as const,
      profileVersion: "v2" as const,
      classification: "negative_control" as const,
      replay: buildV2Replay(replay),
      oos: buildV2Oos(oos)
    };
    const artifact: V2IfvgV2ResearchLifecycleArtifact = {
      ...artifactCore,
      artifactId: await canonicalHash(artifactCore)
    };
    return Object.freeze(artifact);
  }
  throw new Error(`Unsupported IFVG Phase 3 profile: ${profileId}`);
}
