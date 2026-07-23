import { assertV2Authority } from "../authority/v2Authority";
import { normalizeV2Timeframe } from "../candles/v2Timeframe";
import { v2SourceIdentityMatches } from "../identity/v2Identity";
import type {
  V2ContextBuildRequest,
  V2ContextEligibilityResult,
  V2ContextStatus
} from "./v2ContextTypes";
import { v2ContextWindowTimeframe } from "./v2ContextIdentity";

const unique = (values: readonly string[]) => Object.freeze([...new Set(values)]);
const validIsoMs = (value: string) => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export function evaluateV2ContextEligibility(
  request: V2ContextBuildRequest
): Readonly<V2ContextEligibilityResult> {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const staleWindows: string[] = [];
  const preVerificationWindows: string[] = [];
  const timeContractBlockers: string[] = [];
  const unsupportedPolicyRequests: string[] = [];
  const asOfMs = validIsoMs(request.asOfMarketTime);
  if (asOfMs === undefined) blockers.push("context_as_of_market_time_invalid");
  if (!request.requestedSymbol.trim()) blockers.push("requested_symbol_missing");
  if (!request.brokerSymbol.trim()) blockers.push("broker_symbol_missing");
  if (request.requestedSymbol !== request.source.requestedSymbol) blockers.push("requested_symbol_identity_mismatch");
  if (request.brokerSymbol !== request.source.brokerSymbol) blockers.push("broker_symbol_identity_mismatch");
  if (request.source.marketDataAccess !== "read_only") blockers.push("read_only_source_required");
  if (!request.windows.length) blockers.push("context_windows_missing");
  (request.requestedFactFamilies ?? []).forEach((family) => {
    if (family !== "session" && family !== "opening_price") {
      unsupportedPolicyRequests.push(`unsupported_fact_family:${String(family)}`);
    }
  });

  const required = [...new Set(request.requiredTimeframes.map(normalizeV2Timeframe))];
  const seen = new Set<string>();
  let futureCandleAttempts = 0;
  let comparisonEligible = true;

  request.windows.forEach((window) => {
    const timeframe = v2ContextWindowTimeframe(window);
    if (seen.has(timeframe)) blockers.push(`duplicate_timeframe_window:${timeframe}`);
    seen.add(timeframe);
    if (!v2SourceIdentityMatches(window.identity.source, request.source)) blockers.push(`source_identity_mismatch:${timeframe}`);
    try {
      assertV2Authority(window.capability.authority);
    } catch {
      blockers.push(`authority_invalid:${timeframe}`);
    }
    if (window.capability.marketDataAccess !== "read_only") blockers.push(`read_only_capability_required:${timeframe}`);
    if (window.diagnostics.status === "blocked") blockers.push(`data_quality_blocked:${timeframe}`);
    if (window.diagnostics.status === "degraded") warnings.push(`data_quality_degraded:${timeframe}`);
    if (window.diagnostics.stale) staleWindows.push(timeframe);
    futureCandleAttempts += window.diagnostics.futureTimestampCount;
    if (!window.candles.length) blockers.push(`closed_candles_missing:${timeframe}`);
    if (asOfMs !== undefined && window.candles.some((candle) => Date.parse(candle.closeTime) > asOfMs)) {
      futureCandleAttempts += 1;
    }

    if (request.purpose === "current_live_shadow") {
      if (request.source.sourceKind !== "mt5_read_only") blockers.push("current_live_shadow_requires_mt5_read_only");
      const eligibility = window.timeEligibility;
      if (!eligibility?.currentLiveEligible) blockers.push(`current_live_time_unverified:${timeframe}`);
      timeContractBlockers.push(...(eligibility?.blockers ?? []));
      const validUntilMs = validIsoMs(eligibility?.currentLiveValidUntilUtc ?? "");
      if (asOfMs !== undefined && (validUntilMs === undefined || asOfMs > validUntilMs)) {
        staleWindows.push(timeframe);
        blockers.push(`current_live_verification_expired:${timeframe}`);
      }
      if (!eligibility?.historicalEligible) {
        const regimeStartMs = validIsoMs(eligibility?.offsetRegimeStartUtc ?? "");
        const windowStartMs = validIsoMs(window.identity.dataWindowStart);
        if (regimeStartMs === undefined || windowStartMs === undefined || windowStartMs < regimeStartMs) {
          preVerificationWindows.push(timeframe);
          blockers.push(`window_precedes_verified_offset_regime:${timeframe}`);
        }
      }
    } else if (request.source.sourceKind === "mock_sample") {
      comparisonEligible = false;
      warnings.push("mock_fixture_not_authoritative_for_legacy_comparison");
    }
  });

  const missingTimeframes = required.filter((timeframe) => !seen.has(timeframe));
  blockers.push(...missingTimeframes.map((timeframe) => `required_timeframe_missing:${timeframe}`));
  blockers.push(...unsupportedPolicyRequests);
  if (futureCandleAttempts) blockers.push("future_candle_attempted");
  if (staleWindows.length) blockers.push("stale_context_window");

  const compactBlockers = unique(blockers);
  const compactWarnings = unique(warnings);
  const status: V2ContextStatus = compactBlockers.length ? "blocked" : compactWarnings.length ? "degraded" : "eligible";
  return Object.freeze({
    status,
    missingTimeframes: Object.freeze(missingTimeframes),
    staleWindows: unique(staleWindows),
    preVerificationWindows: unique(preVerificationWindows),
    futureCandleAttempts,
    unsupportedPolicyRequests: unique(unsupportedPolicyRequests),
    timeContractBlockers: unique(timeContractBlockers),
    warnings: compactWarnings,
    blockers: compactBlockers,
    comparisonEligible: comparisonEligible && status !== "blocked",
    factEngineStatus: "not_implemented_phase_2a0",
    eligibleWindowCount: request.windows.filter((window) => window.diagnostics.status !== "blocked").length
  });
}
