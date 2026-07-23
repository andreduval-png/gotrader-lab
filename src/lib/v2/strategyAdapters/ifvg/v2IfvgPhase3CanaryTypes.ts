import type { V2Authority } from "../../authority/v2Authority";

export const V2_IFVG_PHASE3_LIFECYCLE_SCHEMA = "gotrader-v2-ifvg-phase3-research-lifecycle-artifact";
export const V2_IFVG_PHASE3_LIFECYCLE_VERSION = "phase-3e-lifecycle-v1";
export const V2_IFVG_PHASE3_GATE_SCHEMA = "gotrader-v2-ifvg-phase3-canary-gate";
export const V2_IFVG_PHASE3_GATE_VERSION = "phase-3e-canary-gate-v1";
export const V2_IFVG_V3_POSITIVE_BASELINE_SHA256 =
  "1661113c11dccbb53516a5b42ba1dc70a9dbb4f5e7d33f4f03fb01e79116951a";
export const V2_IFVG_V2_NEGATIVE_BASELINE_SHA256 =
  "3dcf4a0a0be9689031d42f4ec11ea6813b26c2314f830ea9f5a6f29001479224";
export const V2_IFVG_PHASE3_MIN_EXACT_LIVE_WINDOWS = 3;
export const V2_IFVG_PHASE3_MIN_LIVE_MARKET_DATES = 2;

export type V2IfvgPhase3CanaryMode = "disabled" | "shadow";
export type V2IfvgPhase3ParityOutcome =
  | "exact_parity"
  | "regression"
  | "insufficient_comparison_data";
export type V2IfvgPhase3GateStatus =
  | "disabled"
  | "blocked_regression"
  | "blocked_insufficient_comparison_data"
  | "ready_for_completion_review";

export interface V2IfvgV3ReplaySummary {
  completedResearchTrades: number;
  targetFirstRate: number;
  averageR: number;
  profitFactor: number;
  maximumDrawdownR: number;
  uniqueTradingDates: number;
  positiveRollingWindows: number;
  totalRollingWindows: number;
}

export interface V2IfvgV3OosSummary {
  verdict: "passed";
  windowsPassed: number;
  totalWindows: number;
  trades: number;
  uniqueDates: number;
  averageR: number;
  profitFactor: number;
  additionalHalfRCostAverageR: number;
  authorityCreated: false;
}

export interface V2IfvgV2ReplaySummary {
  currentWindowCandidates: number;
  currentWindowTargetFirstRate: number;
  currentWindowUniqueDates: number;
  independentWindowCandidates: number;
  independentWindowTargetFirstRate: number;
  independentWindowInvalidationFirstRate: number;
}

export interface V2IfvgV2OosSummary {
  verdict: "insufficient_data";
  independentBehavior: "degraded";
  promotionAllowed: false;
}

interface V2IfvgPhase3ResearchLifecycleArtifactBase {
  schemaVersion: typeof V2_IFVG_PHASE3_LIFECYCLE_SCHEMA;
  version: typeof V2_IFVG_PHASE3_LIFECYCLE_VERSION;
  artifactId: string;
  baselineSnapshotHash: string;
  detectionFixtureSourceFingerprint: string;
  historicalSourceFingerprint?: string;
  parameterFingerprint: string;
  costModel: string;
  provenanceStatus: "identity_matched" | "legacy_audit_missing_source_identity";
  promotionAllowed: false;
  canCreateEvidence: false;
  statisticallyIndependentWindowClaimed: false;
  researchOnly: true;
  shadowOnly: true;
  authority: Readonly<V2Authority>;
}

export interface V2IfvgV3ResearchLifecycleArtifact
  extends V2IfvgPhase3ResearchLifecycleArtifactBase {
  profileId: "ifvg_fresh_retest_v3_research";
  profileVersion: "v3";
  classification: "positive_canary";
  replay: Readonly<V2IfvgV3ReplaySummary>;
  oos: Readonly<V2IfvgV3OosSummary>;
}

export interface V2IfvgV2ResearchLifecycleArtifact
  extends V2IfvgPhase3ResearchLifecycleArtifactBase {
  profileId: "ifvg_filtered_v2_research";
  profileVersion: "v2";
  classification: "negative_control";
  replay: Readonly<V2IfvgV2ReplaySummary>;
  oos: Readonly<V2IfvgV2OosSummary>;
}

export type V2IfvgPhase3ResearchLifecycleArtifact =
  | V2IfvgV3ResearchLifecycleArtifact
  | V2IfvgV2ResearchLifecycleArtifact;

export interface V2IfvgPhase3DeterministicParity {
  detection: V2IfvgPhase3ParityOutcome;
  geometry: V2IfvgPhase3ParityOutcome;
  selection: V2IfvgPhase3ParityOutcome;
}

export interface V2IfvgPhase3LiveShadowSummary {
  validationStatus: "accepted";
  exactParityCount: number;
  regressionCount: number;
  insufficientComparisonCount: number;
  distinctClosedWindowCount: number;
  distinctMarketDateCount: number;
  statisticallyIndependentWindowClaimed: false;
  authority: Readonly<V2Authority>;
}

export interface V2IfvgPhase3CanaryGateInput {
  canaryMode: V2IfvgPhase3CanaryMode;
  evaluatedAtUtc: string;
  deterministicParity: Readonly<V2IfvgPhase3DeterministicParity>;
  positiveCanary: Readonly<V2IfvgV3ResearchLifecycleArtifact>;
  negativeControl: Readonly<V2IfvgV2ResearchLifecycleArtifact>;
  liveShadow?: Readonly<V2IfvgPhase3LiveShadowSummary>;
}

export interface V2IfvgPhase3CanaryGateResult {
  schemaVersion: typeof V2_IFVG_PHASE3_GATE_SCHEMA;
  version: typeof V2_IFVG_PHASE3_GATE_VERSION;
  gateId: string;
  evaluatedAtUtc: string;
  status: V2IfvgPhase3GateStatus;
  migrationMode: "legacy_authoritative" | "shadow";
  detectionParity: V2IfvgPhase3ParityOutcome;
  geometryParity: V2IfvgPhase3ParityOutcome;
  selectionParity: V2IfvgPhase3ParityOutcome;
  researchLifecycleParity: V2IfvgPhase3ParityOutcome;
  liveShadowParity: V2IfvgPhase3ParityOutcome;
  positiveCanaryPreserved: boolean;
  negativeControlPreserved: boolean;
  identityMatchedResearchEvidence: boolean;
  liveShadowReviewThresholdMet: boolean;
  phase3CompletionReviewReady: boolean;
  phase4ImplementationAuthorized: false;
  productionAdoptionAllowed: false;
  canCreateValidationChainEntry: false;
  canCreateEvidence: false;
  statisticallyIndependentWindowClaimed: false;
  blockers: readonly string[];
  warnings: readonly string[];
  nextAction: string;
  rollbackAction: string;
  authority: Readonly<V2Authority>;
}
