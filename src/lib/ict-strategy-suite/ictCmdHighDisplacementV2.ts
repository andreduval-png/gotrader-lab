import type { Candle } from "../types";
import { buildIctSessionNarrative } from "./ictSessionNarrative";
import {
  detectDisplacement,
  detectFairValueGap,
  detectLiquidityPools,
  findNearestDrawOnLiquidity,
  normalizeCandles
} from "./ictStrategySuiteHelpers";
import type {
  IctCmdHighDisplacementV2Candidate,
  IctCmdHighDisplacementV2Evidence,
  IctCmdHighDisplacementV2Input,
  IctCmdHighDisplacementV2Status
} from "./ictCmdHighDisplacementV2Types";

export const ICT_CMD_HIGH_DISPLACEMENT_V2_AUTHORITY = {
  executionAuthority: "none" as const,
  brokerAuthority: "none" as const,
  readinessOverrideAuthority: "none" as const
};

const safety = {
  rawCandlesExcluded: true as const,
  rawSnapshotsExcluded: true as const,
  accountDataExcluded: true as const,
  orderDataExcluded: true as const,
  positionDataExcluded: true as const,
  secretsExcluded: true as const
};

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const round = (value: number, digits = 4) => Number(value.toFixed(digits));
const unique = (values: string[]) => Array.from(new Set(values));
const mockSource = (sourceProvider: string) => /mock|sample|fixture|demo/i.test(sourceProvider);
const sellsideLiquidityTypes = new Set([
  "previous_day_low",
  "previous_week_low",
  "previous_month_low",
  "equal_lows",
  "old_swing_low",
  "session_low",
  "central_bank_dealers_range_low"
]);

const statusFor = (blockers: string[]): IctCmdHighDisplacementV2Status => {
  const first = blockers[0] ?? "";
  if (/source/i.test(first)) return "blocked_source";
  if (/timeframe/i.test(first)) return "blocked_timeframe";
  if (/model/i.test(first)) return "blocked_model";
  if (/direction|short/i.test(first)) return "blocked_direction";
  if (/FVG/i.test(first)) return "blocked_fvg";
  if (/stale|fresh/i.test(first)) return "blocked_stale_signal";
  if (/displacement/i.test(first)) return "blocked_displacement";
  if (/target/i.test(first)) return "blocked_target";
  if (/invalidation|stop/i.test(first)) return "blocked_invalidation";
  if (/RR|reward/i.test(first)) return "blocked_rr";
  return blockers.length ? "needs_more_data" : "candidate";
};

export const assessIctCmdHighDisplacementV2Evidence = (
  evidence: IctCmdHighDisplacementV2Evidence
): IctCmdHighDisplacementV2Candidate => {
  const blockers: string[] = [];
  const warnings: string[] = [];
  if (mockSource(evidence.sourceProvider)) blockers.push("Mock/sample source is not eligible.");
  if (!evidence.sourceFingerprint || evidence.sourceFingerprint === "missing") blockers.push("Source fingerprint is missing.");
  if (evidence.timeframe.toLowerCase() !== "5m") blockers.push("CMD high-displacement v2 requires the 5m timeframe.");
  if (evidence.modelProfile !== "consolidation_manipulation_distribution" || evidence.modelState !== "confirmed") {
    blockers.push("Confirmed consolidation-manipulation-distribution model is missing.");
  }
  if (evidence.modelDirection !== "bearish" || evidence.side !== "short") blockers.push("CMD v2 is short-only and requires bearish model direction.");
  if (evidence.displacementDirection !== "bearish") blockers.push("Bearish displacement is missing.");
  if (!finite(evidence.displacementAgeBars) || evidence.displacementAgeBars > 2) blockers.push("Displacement signal is stale; a fresh signal within two bars is required.");
  if (!finite(evidence.displacementScore) || evidence.displacementScore < 1.25) blockers.push("Signal-time displacement score is below 1.25.");
  if (!evidence.fvgPresentAtSignal || !finite(evidence.fvgAgeBars) || evidence.fvgAgeBars > 6) blockers.push("Fresh bearish FVG evidence is missing at signal time.");
  if (!evidence.externalLiquidityTargetPresent || !finite(evidence.target)) blockers.push("External liquidity target is missing.");
  if (!finite(evidence.stop)) blockers.push("Structural invalidation is missing.");
  if (!finite(evidence.entry)) blockers.push("Entry reference is missing.");
  if (finite(evidence.entry) && finite(evidence.stop) && finite(evidence.target)) {
    if (!(evidence.stop > evidence.entry && evidence.target < evidence.entry)) blockers.push("Short entry, target, and invalidation price order is invalid.");
  }
  if (!finite(evidence.rr) || evidence.rr < 2) blockers.push("Planned RR is below 2.0.");
  if (finite(evidence.rr) && evidence.rr > 20) blockers.push("Planned RR exceeds the research sanity cap of 20R.");
  if (evidence.externalLiquidityTargetPresent && !evidence.externalLiquidityTargetType) {
    warnings.push("External target type is unavailable; retain replay-required status.");
  }
  warnings.push("HTF alignment is not inferred by this 5m detector and must be evaluated as a separate validation dimension.");

  const compactBlockers = unique(blockers);
  const eligible = compactBlockers.length === 0;
  return {
    strategyId: "cmd_high_displacement_v2_research",
    status: eligible ? "candidate" : statusFor(compactBlockers),
    eligible,
    researchOnly: true,
    side: eligible ? "short" : evidence.side,
    requestedSymbol: evidence.requestedSymbol,
    brokerSymbol: evidence.brokerSymbol,
    timeframe: evidence.timeframe,
    sourceFingerprint: evidence.sourceFingerprint,
    signalTime: evidence.signalTime,
    entry: evidence.entry,
    stop: evidence.stop,
    target: evidence.target,
    rr: evidence.rr,
    displacementScore: evidence.displacementScore,
    displacementAgeBars: evidence.displacementAgeBars,
    fvgPresentAtSignal: evidence.fvgPresentAtSignal,
    externalLiquidityTargetPresent: evidence.externalLiquidityTargetPresent,
    externalLiquidityTargetType: evidence.externalLiquidityTargetType,
    blockers: compactBlockers,
    warnings: unique(warnings),
    summary: eligible
      ? `CMD high-displacement v2 short research candidate: ${evidence.rr?.toFixed(2) ?? "n/a"}R; deterministic replay required.`
      : `CMD high-displacement v2 blocked: ${compactBlockers[0] ?? "insufficient compact evidence"}.`,
    nextAction: eligible
      ? "Run causal replay, modeled-cost, rolling-window, and walk-forward validation; do not promote automatically."
      : compactBlockers[0] ?? "Wait for complete compact CMD evidence.",
    authority: ICT_CMD_HIGH_DISPLACEMENT_V2_AUTHORITY,
    safety
  };
};

const ageBarsFor = (candles: Candle[], timestamp?: string) => {
  if (!timestamp) return undefined;
  const index = candles.findIndex((candle) => candle.timestamp === timestamp);
  return index < 0 ? undefined : candles.length - 1 - index;
};

const nearestValid = (values: Array<number | undefined>, predicate: (value: number) => boolean, entry: number) =>
  values
    .filter((value): value is number => finite(value) && predicate(value))
    .sort((left, right) => Math.abs(left - entry) - Math.abs(right - entry))[0];

export const assessIctCmdHighDisplacementV2 = (
  input: IctCmdHighDisplacementV2Input
): IctCmdHighDisplacementV2Candidate => {
  const normalized = normalizeCandles(input.candles as Candle[]);
  const latest = normalized.at(-1);
  const brokerSymbol = input.brokerSymbol ?? latest?.symbol ?? input.requestedSymbol;
  const fingerprint = input.sourceFingerprint ?? (
    normalized.length
      ? `${input.sourceProvider}|${input.requestedSymbol}|${brokerSymbol}|${input.timeframe}|${normalized.length}|${normalized[0].timestamp}|${latest?.timestamp}`
      : "missing"
  );
  if (!latest || normalized.length < 80) {
    return assessIctCmdHighDisplacementV2Evidence({
      requestedSymbol: input.requestedSymbol,
      brokerSymbol,
      timeframe: input.timeframe,
      sourceProvider: input.sourceProvider,
      sourceFingerprint: fingerprint,
      side: "flat",
      fvgPresentAtSignal: false,
      externalLiquidityTargetPresent: false
    });
  }

  // Only recent structure can qualify as a fresh trigger. Keeping these scans
  // bounded also makes deep-history replay linear instead of repeatedly
  // searching the full context window for a signal that would be stale anyway.
  const displacement = detectDisplacement(normalized.slice(-40));
  const fvg = detectFairValueGap(normalized.slice(-12));
  const displacementAgeBars = ageBarsFor(normalized, displacement?.candleTime);
  const fvgAgeBars = ageBarsFor(normalized, fvg?.createdAt);
  const plausibleSignal =
    displacement?.direction === "bearish" &&
    finite(displacementAgeBars) && displacementAgeBars <= 2 &&
    fvg?.direction === "bearish" &&
    finite(fvgAgeBars) && fvgAgeBars <= 6;
  const narrative = plausibleSignal
    ? buildIctSessionNarrative(normalized.slice(-2500), {
        requestedSymbol: input.requestedSymbol,
        brokerSymbol,
        primaryTimeframe: input.timeframe,
        requestedLookbackDays: input.requestedLookbackDays ?? 90,
        availableLookbackDays: input.availableLookbackDays,
        depthSource: "current_window"
      })
    : undefined;

  const entry = latest.close;
  const pools = plausibleSignal
    ? detectLiquidityPools(normalized.slice(-600)).filter(
        (pool) => !pool.swept && sellsideLiquidityTypes.has(pool.type)
      )
    : [];
  const draw = findNearestDrawOnLiquidity(pools, entry, "bearish");
  const discountFvgTarget =
    narrative?.fvgTarget?.detected && narrative.fvgTarget.direction === "discount"
      ? narrative.fvgTarget.midpoint ?? narrative.fvgTarget.low
      : undefined;
  const target = nearestValid([draw?.price, discountFvgTarget], (value) => value < entry, entry);
  const asia = narrative?.ranges.find((range) => range.session === "asia");
  const london = narrative?.ranges.find((range) => range.session === "london");
  const sweepHighs = (narrative?.events ?? [])
    .filter((event) => ["buyside_sweep", "london_swept_asia_high", "ny_open_consolidation_high_sweep"].includes(event.eventType))
    .map((event) => event.high ?? event.price);
  const stop = nearestValid(
    [
      narrative?.mitigationContext?.zoneHigh,
      asia?.high,
      london?.high,
      narrative?.activeDealingRange?.high,
      ...sweepHighs
    ],
    (value) => value > entry,
    entry
  );
  const risk = finite(stop) ? stop - entry : undefined;
  const reward = finite(target) ? entry - target : undefined;
  const rr = finite(risk) && risk > 0 && finite(reward) && reward > 0 ? round(reward / risk) : undefined;
  const impulseRange = displacement ? Math.abs(displacement.impulseHigh - displacement.impulseLow) : undefined;
  const displacementScore = finite(impulseRange) && finite(risk) && risk > 0 ? round(impulseRange / risk) : undefined;

  return assessIctCmdHighDisplacementV2Evidence({
    requestedSymbol: input.requestedSymbol,
    brokerSymbol,
    timeframe: input.timeframe,
    sourceProvider: input.sourceProvider,
    sourceFingerprint: fingerprint,
    signalTime: latest.timestamp,
    modelProfile: narrative?.profile,
    modelState: narrative?.primaryModelDetection?.modelState,
    modelDirection: narrative?.primaryModelDetection?.modelDirection,
    side: narrative?.directionalRead === "bearish" ? "short" : "flat",
    displacementDirection: displacement?.direction,
    displacementAgeBars,
    displacementScore,
    fvgPresentAtSignal: fvg?.direction === "bearish",
    fvgAgeBars,
    externalLiquidityTargetPresent: finite(target),
    externalLiquidityTargetType: finite(draw?.price) ? draw?.type : finite(discountFvgTarget) ? "discount_fvg_target" : undefined,
    entry,
    stop,
    target,
    rr
  });
};

export const assertIctCmdHighDisplacementV2IsCompact = (payload: unknown) => {
  const serialized = JSON.stringify(payload);
  return {
    ok:
      !/"(raw)?candles"\s*:|"rawSnapshot"\s*:|"screenshots?"\s*:|"base64"\s*:/i.test(serialized) &&
      !/"(password|secret|api[_-]?key|token|mt5Credentials?)"\s*:/i.test(serialized) &&
      !/"(account|orders?|positions?)"\s*:/i.test(serialized) &&
      /"executionAuthority"\s*:\s*"none"/.test(serialized) &&
      /"brokerAuthority"\s*:\s*"none"/.test(serialized) &&
      /"readinessOverrideAuthority"\s*:\s*"none"/.test(serialized),
    serializedBytes: serialized.length
  };
};
