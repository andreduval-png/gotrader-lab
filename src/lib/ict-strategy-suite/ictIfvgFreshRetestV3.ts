import { evaluateIctIfvg } from "./ictIfvg";
import type { IctIfvgCandidate, IctIfvgInput } from "./ictIfvgTypes";
import type { CanonicalTradeGeometry } from "@/lib/tradeGeometry";
import { adaptIfvgNativeGeometry } from "./ictDetectorCanonicalGeometry";

const authority = {
  executionAuthority: "none" as const,
  brokerAuthority: "none" as const,
  readinessOverrideAuthority: "none" as const
};

const sortedInputCandles = (input: IctIfvgInput) =>
  input.candles
    .filter((candle) => Number.isFinite(Date.parse(candle.timestamp)))
    .sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp));

const signalAgeBars = (input: IctIfvgInput, candidate: IctIfvgCandidate) => {
  const timestamp = candidate.retestCandle?.timestamp;
  if (!timestamp) return undefined;
  const sorted = sortedInputCandles(input);
  const index = sorted.findIndex((candle) => candle.timestamp === timestamp);
  return index < 0 ? undefined : sorted.length - 1 - index;
};

const cleanRetest = (candidate: IctIfvgCandidate) => {
  const retest = candidate.retestCandle;
  const bounds = candidate.ifvgBounds;
  if (!retest || !bounds || candidate.side === "flat") return false;
  return candidate.side === "long"
    ? retest.low <= bounds.midpoint && retest.low >= bounds.low && retest.close >= bounds.midpoint
    : retest.high >= bounds.midpoint && retest.high <= bounds.high && retest.close <= bounds.midpoint;
};

export interface IctIfvgFreshRetestV3Assessment {
  strategyId: "ifvg_fresh_retest_v3_research";
  candidate: IctIfvgCandidate;
  cleanRetest: boolean;
  signalAgeBars?: number;
  signalFresh: boolean;
  eligible: boolean;
  blockers: string[];
  geometry?: CanonicalTradeGeometry;
  researchOnly: true;
  authority: typeof authority;
}

export interface IctIfvgFreshRetestV3CompactAssessment {
  strategyId: "ifvg_fresh_retest_v3_research";
  candidateId: string;
  generatedAt: string;
  candidateDetectedAt: string;
  entryIntentCreatedAt?: string;
  currentMarketTimestamp?: string;
  entryMissedAt?: string;
  requestedSymbol?: string;
  brokerSymbol?: string;
  sourceProvider?: string;
  sourceFingerprint?: string;
  timeframe: string;
  contextTimeframes: string[];
  side: IctIfvgCandidate["side"];
  baseStatus: IctIfvgCandidate["status"];
  inversionDetected: boolean;
  cleanRetest: boolean;
  signalAgeBars?: number;
  signalFresh: boolean;
  entryLifecycleStatus: IctIfvgCandidate["entryLifecycleStatus"];
  geometryEligible: boolean;
  actionable: boolean;
  geometryPolicyId: IctIfvgCandidate["geometryPolicyId"];
  stopSource?: IctIfvgCandidate["stopSource"];
  stopDistance?: number;
  eligible: boolean;
  entry?: number;
  invalidation?: number;
  target?: number;
  rr?: number;
  geometry?: CanonicalTradeGeometry;
  ifvgBounds?: { low: number; high: number };
  blockers: string[];
  missingConditions: string[];
  nextAction: string;
  canCreateValidationChainEntry: boolean;
  researchOnly: true;
  authority: typeof authority;
}

/**
 * Causal IFVG baseline: the base detector must be validation-eligible and its
 * clean retest must be the latest closed candle. No post-entry confirmation is
 * used. This remains research-only until independent replay gates pass.
 */
export const assessIctIfvgFreshRetestV3 = (
  input: IctIfvgInput,
  detected: IctIfvgCandidate = evaluateIctIfvg(input)
): IctIfvgFreshRetestV3Assessment => {
  const isClean = cleanRetest(detected);
  const ageBars = signalAgeBars(input, detected);
  const isFresh = ageBars === 0;
  const blockers = [
    ...detected.blockers,
    detected.canCreateValidationChainEntry ? undefined : "base_ifvg_not_validation_eligible",
    isClean ? undefined : "clean_retest_required",
    isFresh ? undefined : "stale_retest_signal"
  ].filter((item): item is string => Boolean(item));
  const geometry = adaptIfvgNativeGeometry({
    candidate: detected,
    strategyId: "ifvg_fresh_retest_v3_research",
    strategyVersion: "v3",
    profileId: "ifvg_fresh_retest_v3_research",
    profileVersion: "v3",
    researchOnly: blockers.length > 0
  });

  return {
    strategyId: "ifvg_fresh_retest_v3_research",
    candidate: detected,
    cleanRetest: isClean,
    signalAgeBars: ageBars,
    signalFresh: isFresh,
    eligible: blockers.length === 0,
    blockers,
    geometry,
    researchOnly: true,
    authority
  };
};

export const compactIctIfvgFreshRetestV3Assessment = (
  assessment: IctIfvgFreshRetestV3Assessment
): IctIfvgFreshRetestV3CompactAssessment => {
  const candidate = assessment.candidate;
  const nextAction = assessment.eligible
    ? "Queue replay validation for IFVG fresh-retest v3; recognition is not evidence."
    : candidate.entryLifecycleStatus === "entry_missed"
      ? "The retracement-limit entry was missed; do not chase or resurrect this candidate."
      : candidate.blockers.includes("STOP_DISTANCE_TOO_SMALL")
        ? "Keep the IFVG as research context only; its source-native stop is below the symbol-policy minimum."
    : !candidate.inversionCandle
      ? "Wait for a fully inverted, unused FVG."
      : !assessment.cleanRetest
        ? "Wait for a clean return into the inverted FVG."
        : !assessment.signalFresh
          ? "The prior retest is stale; wait for a new fresh IFVG retest."
          : "Resolve the deterministic IFVG blockers before replay validation.";

  return {
    strategyId: assessment.strategyId,
    candidateId: candidate.candidateId,
    generatedAt: candidate.generatedAt,
    candidateDetectedAt: candidate.candidateDetectedAt,
    entryIntentCreatedAt: candidate.entryIntentCreatedAt,
    currentMarketTimestamp: candidate.currentMarketTimestamp,
    entryMissedAt: candidate.entryMissedAt,
    requestedSymbol: candidate.requestedSymbol,
    brokerSymbol: candidate.brokerSymbol,
    sourceProvider: candidate.sourceProvider,
    sourceFingerprint: candidate.sourceFingerprint,
    timeframe: candidate.timeframe,
    contextTimeframes: [...candidate.contextTimeframes],
    side: candidate.side,
    baseStatus: candidate.status,
    inversionDetected: Boolean(candidate.inversionCandle),
    cleanRetest: assessment.cleanRetest,
    signalAgeBars: assessment.signalAgeBars,
    signalFresh: assessment.signalFresh,
    entryLifecycleStatus: candidate.entryLifecycleStatus,
    geometryEligible: candidate.geometryEligible,
    actionable: Boolean(assessment.eligible && assessment.geometry?.actionable),
    geometryPolicyId: candidate.geometryPolicyId,
    stopSource: candidate.stopSource,
    stopDistance: candidate.stopDistance,
    eligible: assessment.eligible,
    entry: candidate.entry,
    invalidation: candidate.stop,
    target: candidate.target,
    rr: candidate.rr,
    geometry: assessment.geometry,
    ifvgBounds: candidate.ifvgBounds
      ? { low: candidate.ifvgBounds.low, high: candidate.ifvgBounds.high }
      : undefined,
    blockers: Array.from(new Set(assessment.blockers)).slice(0, 8),
    missingConditions: Array.from(new Set(candidate.missingConditions)).slice(0, 8),
    nextAction,
    canCreateValidationChainEntry: assessment.eligible,
    researchOnly: true,
    authority
  };
};
