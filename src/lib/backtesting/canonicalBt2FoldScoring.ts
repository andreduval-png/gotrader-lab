import type { CanonicalHistoricalGeometryEnvelope } from "@/lib/historicalGeometry";
import type { CanonicalBt2FoldOutcome } from "@/lib/historicalFold/historicalFoldTypes";
import type { Candle } from "@/lib/types";

const round = (value: number, digits = 6) => Number(value.toFixed(digits));
const touched = (candle: Candle, price: number) => candle.low <= price && candle.high >= price;

export const scoreCanonicalHistoricalGeometryWithBt2 = ({
  geometry,
  candles,
  decisionIndex,
  maxBarsToResolveTrade,
  tickSize,
  spreadTicks,
  slippageTicks,
  commissionTicks
}: {
  geometry: CanonicalHistoricalGeometryEnvelope;
  candles: readonly Candle[];
  decisionIndex: number;
  maxBarsToResolveTrade: number;
  tickSize: number;
  spreadTicks: number;
  slippageTicks: number;
  commissionTicks: number;
}): CanonicalBt2FoldOutcome => {
  if (!Number.isSafeInteger(decisionIndex) || decisionIndex < 0 || decisionIndex >= candles.length ||
    !Number.isSafeInteger(maxBarsToResolveTrade) || maxBarsToResolveTrade < 1 ||
    !Number.isFinite(tickSize) || tickSize <= 0 ||
    [spreadTicks, slippageTicks, commissionTicks].some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error("BT2_CANONICAL_INVALID_SCORING_INPUT");
  }
  const direction = geometry.direction === "LONG" ? 1 : -1;
  const endIndex = Math.min(candles.length - 1, decisionIndex + maxBarsToResolveTrade);
  // A historical touch is not a fill receipt. Only post-decision bars can fill.
  let entryIndex: number | undefined;
  let exitPrice: number | undefined;
  let exitIndex = endIndex;
  let outcome: CanonicalBt2FoldOutcome["outcome"] = "expired";
  let sameBarAmbiguous = false;

  for (let index = decisionIndex + 1; index <= endIndex; index += 1) {
    const candle = candles[index];
    if (!candle) continue;
    if (entryIndex === undefined) {
      if (!touched(candle, geometry.intendedEntry)) continue;
      entryIndex = index;
    }
    const stopHit = direction === 1 ? candle.low <= geometry.intendedStop : candle.high >= geometry.intendedStop;
    const targetHit = direction === 1 ? candle.high >= geometry.intendedTarget : candle.low <= geometry.intendedTarget;
    if (stopHit || targetHit) {
      sameBarAmbiguous = stopHit && targetHit;
      outcome = stopHit ? "stop_hit" : "target_hit";
      const stopGap = entryIndex < index && direction * (candle.open - geometry.intendedStop) < 0;
      exitPrice = stopHit ? (stopGap ? candle.open : geometry.intendedStop) : geometry.intendedTarget;
      exitIndex = index;
      break;
    }
  }

  if (entryIndex === undefined) outcome = "entry_not_retraced";
  const risk = Math.abs(geometry.intendedEntry - geometry.intendedStop);
  if (!(risk > 0)) throw new Error("BT2_CANONICAL_GEOMETRY_INVALID_RISK");
  const costPrice = (spreadTicks + slippageTicks + commissionTicks) * tickSize;
  const costR = costPrice / risk;
  const terminalClose = candles[exitIndex]?.close ?? geometry.intendedEntry;
  const markR = direction * (terminalClose - geometry.intendedEntry) / risk;
  const realizedR = exitPrice === undefined ? 0 : direction * (exitPrice - geometry.intendedEntry) / risk - costR;
  return {
    geometryId: geometry.geometryId,
    canonicalGeometryParityHash: geometry.canonicalGeometryParityHash,
    entryIndex,
    exitIndex,
    openedAt: entryIndex === undefined ? undefined : candles[entryIndex]?.timestamp,
    resolvedAt: candles[exitIndex]?.timestamp ?? geometry.asOf,
    outcome,
    theoreticalRR: round(geometry.theoreticalRR),
    realizedR: round(realizedR),
    unrealizedR: outcome === "expired" ? round(markR - costR) : undefined,
    targetHit: outcome === "target_hit",
    stopHit: outcome === "stop_hit",
    sameBarAmbiguous,
    costR: round(costR)
  };
};
