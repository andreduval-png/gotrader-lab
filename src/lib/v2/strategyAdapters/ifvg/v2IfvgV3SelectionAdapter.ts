import { assertV2Authority, V2_AUTHORITY_NONE } from "../../authority/v2Authority";
import type { V2CanonicalCandle, V2CanonicalCandleWindow } from "../../candles/v2CandleTypes";
import type {
  V2CanonicalMarketState,
  V2FactEnvelope,
  V2HigherTimeframeBiasFactPayload
} from "../../context/v2ContextTypes";
import { canonicalHash } from "../../serialization/canonicalSerialization";
import { projectV2IfvgV3GeometryShadow } from "./v2IfvgV3GeometryAdapter";
import type { V2IfvgV3GeometryArtifact } from "./v2IfvgV3GeometryTypes";
import {
  V2_IFVG_V3_SELECTION_ADAPTER_ID,
  V2_IFVG_V3_SELECTION_ADAPTER_VERSION,
  V2_IFVG_V3_SELECTION_ARTIFACT_SCHEMA_VERSION,
  V2_IFVG_V3_SELECTION_INPUT_CONTRACT_VERSION,
  type V2IfvgV3RankedCandidate,
  type V2IfvgV3SelectionCanaryInput,
  type V2IfvgV3SelectionHtfAlignment,
  type V2IfvgV3SelectionResult,
  type V2IfvgV3SelectionSessionContext,
  type V2IfvgV3SelectionVolumeContext
} from "./v2IfvgV3SelectionTypes";
import {
  V2_IFVG_V3_PROFILE_ID,
  V2_IFVG_V3_STRATEGY_ID
} from "./v2IfvgV3Types";

type HtfFact = Readonly<
  V2FactEnvelope<"higher_timeframe_bias", V2HigherTimeframeBiasFactPayload>
>;

const HTF_TIMEFRAMES = Object.freeze(["15m", "1h", "4h", "1d"] as const);
const RANKING_EXCLUDED_BLOCKERS = new Set(["clean_retest_required", "stale_retest_signal"]);

const nyFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false
});

const uniqueSorted = (values: readonly string[]) =>
  Object.freeze([...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right)));

const rounded = (value: number, decimals = 4) => Number(value.toFixed(decimals));

const positiveAverage = (values: readonly (number | undefined)[]) => {
  const positive = values.filter((value): value is number =>
    typeof value === "number" && Number.isFinite(value) && value > 0
  );
  return positive.length
    ? positive.reduce((total, value) => total + value, 0) / positive.length
    : undefined;
};

const findCandleIndex = (
  window: Readonly<V2CanonicalCandleWindow>,
  closeTime: string | undefined
) => closeTime ? window.candles.findIndex((candle) => candle.closeTime === closeTime) : -1;

const directionForFact = (fact: HtfFact | undefined) => {
  if (!fact || !fact.payload.complete || fact.payload.direction === "insufficient_data") return "unknown";
  return fact.payload.direction === "neutral" ? "mixed" : fact.payload.direction;
};

const resolveHtfAlignment = (
  context: Readonly<V2CanonicalMarketState>,
  side: "long" | "short"
): {
  alignment: V2IfvgV3SelectionHtfAlignment;
  directions: readonly string[];
} => {
  const expected = side === "long" ? "bullish" : "bearish";
  const rows = HTF_TIMEFRAMES.map((timeframe) => {
    const fact = context.facts.find((candidate): candidate is HtfFact =>
      candidate.kind === "higher_timeframe_bias" &&
      candidate.payload.timeframe === timeframe
    );
    return [timeframe, directionForFact(fact)] as const;
  });
  const available = rows.filter(([, direction]) => direction !== "unknown");
  const directions = Object.freeze(rows.map(([timeframe, direction]) => `${timeframe}:${direction}`));
  if (!available.length) return { alignment: "unavailable", directions };
  const aligned = available.filter(([, direction]) => direction === expected).length;
  const against = available.filter(([, direction]) =>
    side === "long" ? direction === "bearish" : direction === "bullish"
  ).length;
  if (aligned > 0 && against === 0) return { alignment: "aligned", directions };
  if (against > aligned) return { alignment: "against_htf", directions };
  return { alignment: "mixed", directions };
};

const resolveVolumeContext = (
  window: Readonly<V2CanonicalCandleWindow>,
  inversionTime: string
): Readonly<V2IfvgV3SelectionVolumeContext> => {
  const inversionIndex = findCandleIndex(window, inversionTime);
  const inversion = inversionIndex >= 0 ? window.candles[inversionIndex] : undefined;
  const baseline = inversionIndex >= 0
    ? positiveAverage(window.candles
        .slice(Math.max(0, inversionIndex - 24), inversionIndex)
        .map((candle) => candle.volume))
    : undefined;
  const current = inversion?.volume;
  const lowVolume = Boolean(
    baseline &&
    current &&
    Number.isFinite(current) &&
    current < baseline * 0.35
  );
  return Object.freeze({
    ...(current !== undefined ? { inversionVolume: current } : {}),
    ...(baseline !== undefined ? { baselineVolume: rounded(baseline) } : {}),
    ...(baseline && current ? { volumeRatio: rounded(current / baseline) } : {}),
    lowVolume,
    policy: "inversion_vs_prior_24_positive_volume_35pct" as const
  });
};

const resolveSessionContext = (
  candle: Readonly<V2CanonicalCandle> | undefined
): Readonly<V2IfvgV3SelectionSessionContext> | undefined => {
  if (!candle) return undefined;
  const parts = Object.fromEntries(
    nyFormatter.formatToParts(new Date(candle.openTime)).map((part) => [part.type, part.value])
  ) as Record<string, string>;
  const hour = Number(parts.hour === "24" ? "0" : parts.hour);
  const minute = Number(parts.minute ?? "0");
  const localTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  const clockMinute = hour * 60 + minute;
  if (clockMinute >= 180 && clockMinute < 300) {
    return Object.freeze({
      id: "london_open" as const,
      label: "London open IFVG window",
      localTime,
      timingZone: "America/New_York" as const,
      preferredWindow: true
    });
  }
  if (clockMinute >= 570 && clockMinute < 660) {
    return Object.freeze({
      id: "new_york_open" as const,
      label: "New York open IFVG window",
      localTime,
      timingZone: "America/New_York" as const,
      preferredWindow: true
    });
  }
  if (clockMinute >= 570 && clockMinute < 960) {
    return Object.freeze({
      id: "rth" as const,
      label: "RTH non-open IFVG window",
      localTime,
      timingZone: "America/New_York" as const,
      preferredWindow: false
    });
  }
  return Object.freeze({
    id: "outside_rth" as const,
    label: "Outside RTH",
    localTime,
    timingZone: "America/New_York" as const,
    preferredWindow: false
  });
};

const normalizedRankingBlockers = (
  geometry: Readonly<V2IfvgV3GeometryArtifact>,
  htfAlignment: V2IfvgV3SelectionHtfAlignment,
  volumeContext: Readonly<V2IfvgV3SelectionVolumeContext>
) => uniqueSorted([
  ...geometry.blockerIds.filter((blocker) => !RANKING_EXCLUDED_BLOCKERS.has(blocker)),
  geometry.targetReference ? undefined : "liquidity_target_missing",
  htfAlignment === "against_htf" ? "against_htf" : undefined,
  volumeContext.lowVolume ? "low_volume_inversion" : undefined
].filter((item): item is string => Boolean(item)));

const buildCandidate = (
  context: Readonly<V2CanonicalMarketState>,
  primaryWindow: Readonly<V2CanonicalCandleWindow>,
  geometry: Readonly<V2IfvgV3GeometryArtifact>,
  discoveryIndex: number
): Omit<V2IfvgV3RankedCandidate, "rank" | "selected"> => {
  const htf = resolveHtfAlignment(context, geometry.direction);
  const volumeContext = resolveVolumeContext(primaryWindow, geometry.inversionTime);
  const retestIndex = findCandleIndex(primaryWindow, geometry.retest?.candleCloseTime);
  const inversionIndex = findCandleIndex(primaryWindow, geometry.inversionTime);
  const recencyIndex = retestIndex >= 0 ? retestIndex : inversionIndex;
  const sessionCandle = primaryWindow.candles[retestIndex >= 0 ? retestIndex : inversionIndex];
  const sessionContext = resolveSessionContext(sessionCandle);
  const rankingBlockerIds = normalizedRankingBlockers(geometry, htf.alignment, volumeContext);
  const outerBlockers = geometry.blockerIds.filter((blocker) => RANKING_EXCLUDED_BLOCKERS.has(blocker));
  const finalBlockerIds = uniqueSorted([...rankingBlockerIds, ...outerBlockers]);
  const warningIds = uniqueSorted([
    ...geometry.warningIds,
    htf.alignment === "unavailable" ? "htf_context_unavailable_manual_review" : undefined,
    htf.alignment === "mixed" ? "htf_context_mixed_replay_required" : undefined
  ].filter((item): item is string => Boolean(item)));

  return {
    normalizedCandidateId: geometry.normalizedCandidateId,
    geometryArtifactId: geometry.artifactId,
    direction: geometry.direction,
    rankKey: Object.freeze({
      readyRank: rankingBlockerIds.length === 0 ? 1 as const : 0 as const,
      blockerCount: rankingBlockerIds.length,
      recencyIndex,
      discoveryIndex
    }),
    baseSelectionReady: rankingBlockerIds.length === 0,
    htfAlignment: htf.alignment,
    htfDirections: htf.directions,
    volumeContext,
    ...(sessionContext ? { sessionContext } : {}),
    rankingBlockerIds,
    finalBlockerIds,
    warningIds,
    canCreateValidationChainEntry: false as const,
    researchOnly: true as const,
    shadowOnly: true as const,
    authority: V2_AUTHORITY_NONE
  };
};

const rankCandidates = (
  candidates: readonly Omit<V2IfvgV3RankedCandidate, "rank" | "selected">[]
) => [...candidates].sort((left, right) => {
  if (left.rankKey.readyRank !== right.rankKey.readyRank) {
    return right.rankKey.readyRank - left.rankKey.readyRank;
  }
  if (left.rankKey.blockerCount !== right.rankKey.blockerCount) {
    return left.rankKey.blockerCount - right.rankKey.blockerCount;
  }
  if (left.rankKey.recencyIndex !== right.rankKey.recencyIndex) {
    return right.rankKey.recencyIndex - left.rankKey.recencyIndex;
  }
  return left.rankKey.discoveryIndex - right.rankKey.discoveryIndex;
});

const sameRankKey = (
  left: Omit<V2IfvgV3RankedCandidate, "rank" | "selected"> | undefined,
  right: Omit<V2IfvgV3RankedCandidate, "rank" | "selected"> | undefined
) => Boolean(
  left &&
  right &&
  left.rankKey.readyRank === right.rankKey.readyRank &&
  left.rankKey.blockerCount === right.rankKey.blockerCount &&
  left.rankKey.recencyIndex === right.rankKey.recencyIndex &&
  left.rankKey.discoveryIndex === right.rankKey.discoveryIndex
);

export const selectV2IfvgV3ShadowCandidate = async ({
  context,
  primaryWindow
}: V2IfvgV3SelectionCanaryInput): Promise<Readonly<V2IfvgV3SelectionResult>> => {
  assertV2Authority(context.authority);
  assertV2Authority(primaryWindow.capability.authority);
  const geometryResult = await projectV2IfvgV3GeometryShadow({ context, primaryWindow });
  const inputBlockers = uniqueSorted([
    geometryResult.diagnostics.status === "blocked" ? "geometry_projection_blocked" : undefined,
    context.identity.source.sourceKind === "mock_sample" ? "mock_sample_source_not_eligible" : undefined,
    geometryResult.sourceFingerprint === context.identity.source.sourceFingerprint
      ? undefined
      : "source_fingerprint_mismatch",
    geometryResult.primaryWindowIdentityHash === primaryWindow.identity.identityHash
      ? undefined
      : "primary_window_identity_mismatch"
  ].filter((item): item is string => Boolean(item)));
  const ranked = rankCandidates(
    geometryResult.artifacts.map((geometry, discoveryIndex) =>
      buildCandidate(context, primaryWindow, geometry, discoveryIndex)
    )
  );
  const ambiguous = sameRankKey(ranked[0], ranked[1]);
  const selected = inputBlockers.length === 0 && !ambiguous ? ranked[0] : undefined;
  const candidates = Object.freeze(ranked.map((candidate, index) => Object.freeze({
    ...candidate,
    selected: candidate.normalizedCandidateId === selected?.normalizedCandidateId,
    rank: index + 1
  })));
  const selectionState = inputBlockers.length
    ? "blocked" as const
    : ambiguous
      ? "ambiguous" as const
      : selected
        ? "selected" as const
        : geometryResult.diagnostics.status === "insufficient_data"
          ? "insufficient_data" as const
          : "no_candidate" as const;
  const diagnostics = Object.freeze({
    status: inputBlockers.length || ambiguous
      ? "blocked" as const
      : geometryResult.diagnostics.status === "insufficient_data"
        ? "insufficient_data" as const
        : "eligible" as const,
    blockers: uniqueSorted([
      ...inputBlockers,
      ambiguous ? "ambiguous_candidate_ranking" : undefined
    ].filter((item): item is string => Boolean(item))),
    warnings: uniqueSorted([
      ...geometryResult.diagnostics.warnings,
      ...candidates.flatMap((candidate) => candidate.warningIds)
    ]),
    limitations: uniqueSorted([
      "legacy_full_candidate_set_ordering_not_publicly_observable",
      "v2_htf_bias_fact_policy_must_match_selected_legacy_outcome",
      "replay_evidence_readiness_deferred"
    ])
  });
  const artifactCore: Omit<V2IfvgV3SelectionResult, "selectionArtifactId"> = {
    schemaVersion: V2_IFVG_V3_SELECTION_ARTIFACT_SCHEMA_VERSION,
    strategyId: V2_IFVG_V3_STRATEGY_ID,
    profileId: V2_IFVG_V3_PROFILE_ID,
    adapterId: V2_IFVG_V3_SELECTION_ADAPTER_ID,
    adapterVersion: V2_IFVG_V3_SELECTION_ADAPTER_VERSION,
    inputContractVersion: V2_IFVG_V3_SELECTION_INPUT_CONTRACT_VERSION,
    sourceFingerprint: context.identity.source.sourceFingerprint,
    contextArtifactId: context.contextArtifactId,
    primaryWindowIdentityHash: primaryWindow.identity.identityHash,
    selectionState,
    ...(selected ? { selectedCandidateId: selected.normalizedCandidateId } : {}),
    candidates,
    diagnostics,
    selectedCandidateRankingMigrated: true as const,
    fullCandidateSetOrderingObservable: false as const,
    fullStrategyParityClaimed: false as const,
    productionAdoptionAllowed: false as const,
    shadowOnly: true as const,
    authority: V2_AUTHORITY_NONE
  };

  return Object.freeze({
    ...artifactCore,
    selectionArtifactId: await canonicalHash({
      artifactType: "ifvg-v3-selection-shadow",
      adapterVersion: V2_IFVG_V3_SELECTION_ADAPTER_VERSION,
      contextArtifactId: context.contextArtifactId,
      primaryWindowIdentityHash: primaryWindow.identity.identityHash,
      selectionState,
      ...(selected ? { selectedCandidateId: selected.normalizedCandidateId } : {}),
      candidates
    })
  });
};
