import { assertV2Authority, V2_AUTHORITY_NONE } from "../../authority/v2Authority";
import { v2SourceIdentityMatches } from "../../identity/v2Identity";
import { canonicalHash } from "../../serialization/canonicalSerialization";
import { compareLegacyAndV2IfvgV3Selection } from "./v2IfvgV3SelectionComparison";
import { selectV2IfvgV3ShadowCandidate } from "./v2IfvgV3SelectionAdapter";
import {
  V2_IFVG_V3_LIVE_SHADOW_SCHEMA,
  V2_IFVG_V3_LIVE_SHADOW_VERSION,
  type V2IfvgV3LiveShadowCollectorInput,
  type V2IfvgV3LiveShadowObservation,
  type V2IfvgV3LiveShadowParitySummary,
  type V2IfvgV3LiveShadowSourceSummary
} from "./v2IfvgV3LiveShadowTypes";

const uniqueSorted = (values: readonly string[]) =>
  Object.freeze([...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right)));

const validIso = (value: string | undefined) => {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : undefined;
};

const newYorkDate = (value: string) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
};

export async function collectV2IfvgV3LiveShadowObservation({
  context,
  primaryWindow,
  legacyObservation,
  collectedAtUtc
}: V2IfvgV3LiveShadowCollectorInput): Promise<Readonly<V2IfvgV3LiveShadowObservation>> {
  assertV2Authority(context.authority);
  assertV2Authority(primaryWindow.capability.authority);
  if (legacyObservation) assertV2Authority(legacyObservation.authority);

  const source = context.identity.source;
  const primarySource = primaryWindow.identity.source;
  const collectedAt = validIso(collectedAtUtc) ?? new Date().toISOString();
  const lastClosedCandleTime = primaryWindow.candles.length
    ? validIso(primaryWindow.identity.lastClosedCandle) ??
      validIso(primaryWindow.candles.at(-1)?.closeTime)
    : undefined;
  const windowReferenceTime = lastClosedCandleTime ??
    validIso(context.identity.asOfMarketTime) ??
    collectedAt;
  const blockers = uniqueSorted([
    source.sourceKind === "mt5_read_only" ? "" : "live_shadow_requires_mt5_read_only",
    source.provider === "mt5_read_only" ? "" : "live_shadow_provider_mismatch",
    source.marketDataAccess === "read_only" ? "" : "live_shadow_requires_read_only_source",
    context.identity.purpose === "current_live_shadow" ? "" : "live_shadow_context_purpose_required",
    v2SourceIdentityMatches(primarySource, source) ? "" : "live_shadow_primary_source_identity_mismatch",
    primaryWindow.timeEligibility?.currentLiveEligible === true
      ? ""
      : "live_shadow_current_time_eligibility_missing",
    context.diagnostics.comparisonEligible ? "" : "live_shadow_context_comparison_ineligible",
    context.diagnostics.status === "blocked" ? "live_shadow_context_blocked" : "",
    primaryWindow.diagnostics.status === "blocked" ? "live_shadow_primary_window_blocked" : "",
    primaryWindow.diagnostics.stale ? "live_shadow_primary_window_stale" : "",
    primaryWindow.candles.length ? "" : "live_shadow_primary_window_empty",
    legacyObservation ? "" : "live_shadow_legacy_observation_missing",
    lastClosedCandleTime ? "" : "live_shadow_last_closed_candle_missing"
  ]);
  const warnings = uniqueSorted([
    ...context.diagnostics.warnings,
    ...primaryWindow.diagnostics.warnings,
    ...(primaryWindow.timeEligibility?.warnings ?? [])
  ]);
  const distinctClosedWindowKey = await canonicalHash({
    profileId: "ifvg_fresh_retest_v3_research",
    requestedSymbol: source.requestedSymbol,
    brokerSymbol: source.brokerSymbol,
    timeframe: Object.keys(primaryWindow.identity.candleCountByTimeframe)[0] ?? "5m",
    sourceFingerprint: source.sourceFingerprint,
    primaryWindowIdentityHash: primaryWindow.identity.identityHash,
    lastClosedCandleTime: lastClosedCandleTime ?? "unavailable"
  });
  const sourceSummary: Readonly<V2IfvgV3LiveShadowSourceSummary> = Object.freeze({
    provider: "mt5_read_only",
    requestedSymbol: source.requestedSymbol,
    brokerSymbol: source.brokerSymbol,
    timeframe: Object.keys(primaryWindow.identity.candleCountByTimeframe)[0] ?? "5m",
    sourceFingerprint: source.sourceFingerprint,
    primaryWindowIdentityHash: primaryWindow.identity.identityHash,
    contextArtifactId: context.contextArtifactId,
    windowReferenceTime,
    ...(lastClosedCandleTime ? { lastClosedCandleTime } : {}),
    distinctClosedWindowKey,
    marketDateNewYork: newYorkDate(windowReferenceTime)
  });

  let parity: Readonly<V2IfvgV3LiveShadowParitySummary> | undefined;
  if (!blockers.length && legacyObservation) {
    const v2 = await selectV2IfvgV3ShadowCandidate({ context, primaryWindow });
    const comparison = await compareLegacyAndV2IfvgV3Selection({
      legacy: legacyObservation,
      v2
    });
    parity = Object.freeze({
      outcome: comparison.outcome,
      legacySelectionState: comparison.legacySelectionState,
      v2SelectionState: comparison.v2SelectionState,
      ...(comparison.legacySelectedCandidateId
        ? { legacySelectedCandidateId: comparison.legacySelectedCandidateId }
        : {}),
      ...(comparison.v2SelectedCandidateId
        ? { v2SelectedCandidateId: comparison.v2SelectedCandidateId }
        : {}),
      selectedCandidateIdentityParityAchieved: comparison.selectedCandidateIdentityParityAchieved,
      selectedCandidateBlockerParityAchieved: comparison.selectedCandidateBlockerParityAchieved,
      htfAlignmentParityAchieved: comparison.htfAlignmentParityAchieved,
      volumeBlockerParityAchieved: comparison.volumeBlockerParityAchieved,
      sessionContextParityAchieved: comparison.sessionContextParityAchieved,
      selectedCandidateRankingParityAchieved: comparison.selectedCandidateRankingParityAchieved,
      differences: comparison.differences,
      limitations: comparison.limitations
    });
  }
  const status = blockers.length
    ? "blocked_context" as const
    : parity?.outcome === "exact_parity"
      ? "exact_parity" as const
      : parity?.outcome === "regression"
        ? "regression" as const
        : "insufficient_comparison_data" as const;
  const observationCore: Omit<V2IfvgV3LiveShadowObservation, "observationId"> = {
    schemaId: V2_IFVG_V3_LIVE_SHADOW_SCHEMA,
    version: V2_IFVG_V3_LIVE_SHADOW_VERSION,
    collectedAtUtc: collectedAt,
    source: sourceSummary,
    status,
    ...(parity ? { parity } : {}),
    contextStatus: context.diagnostics.status,
    blockers,
    warnings,
    statisticallyIndependentWindowClaimed: false as const,
    fullCandidateSetOrderingParityAchieved: false as const,
    fullStrategyParityClaimed: false as const,
    canCreateValidationChainEntry: false as const,
    productionAdoptionAllowed: false as const,
    researchOnly: true as const,
    shadowOnly: true as const,
    authority: V2_AUTHORITY_NONE
  };

  return Object.freeze({
    ...observationCore,
    observationId: await canonicalHash({
      schemaId: V2_IFVG_V3_LIVE_SHADOW_SCHEMA,
      version: V2_IFVG_V3_LIVE_SHADOW_VERSION,
      source: sourceSummary,
      status,
      parity: parity ?? null,
      blockers
    })
  });
}
