import {
  buildCanonicalIctFactSnapshot,
  buildCanonicalSessionWindows,
  selectCanonicalDrawOnLiquidity,
  type CanonicalDirection,
  type CanonicalIctFact,
  type CanonicalLiquidityFact
} from "@/lib/ictCanonical";
import { evaluateIct2022Model } from "@/lib/ictI2/ict2022Model";
import { buildIctCoreCandidateCollection } from "@/lib/ictI2/ictI2Collection";
import { evaluateIctJudasSwing } from "@/lib/ictI2/ictJudasSwingModel";
import { evaluateIctPowerOfThree } from "@/lib/ictI2/ictPowerOfThreeModel";
import type { IctCoreCandidateCollection, IctCoreDetectionInput, IctHierarchicalNarrative, IctRoleDirection } from "@/lib/ictI2/ictI2Types";
import type { Candle, FuturesSymbol, Timeframe } from "@/lib/types";

const ROLE_TIMEFRAMES = { structural: "1h", intermediate: "15m", execution: "5m" } as const;

const latestDirection = (facts: readonly CanonicalIctFact[], timeframe: Timeframe): IctRoleDirection => {
  const directional = facts
    .filter((fact) => fact.timeframe === timeframe && (fact.factType === "MSS" || fact.factType === "DISPLACEMENT"))
    .sort((left, right) => Date.parse(right.validFrom) - Date.parse(left.validFrom));
  return (directional[0] as { direction?: CanonicalDirection } | undefined)?.direction ?? "unavailable";
};

export const buildIctHierarchicalNarrative = (facts: readonly CanonicalIctFact[]): IctHierarchicalNarrative => {
  const structural = latestDirection(facts, ROLE_TIMEFRAMES.structural);
  return {
    structural,
    intermediate: latestDirection(facts, ROLE_TIMEFRAMES.intermediate),
    execution: latestDirection(facts, ROLE_TIMEFRAMES.execution),
    liquidityPath: structural === "bullish" ? "buyside" : structural === "bearish" ? "sellside" : structural === "neutral" ? "balanced" : "unavailable",
    structuralTimeframe: ROLE_TIMEFRAMES.structural,
    intermediateTimeframe: ROLE_TIMEFRAMES.intermediate,
    executionTimeframe: ROLE_TIMEFRAMES.execution,
    policyId: "gotrader.ict.c1-1.hierarchical-roles.v1",
    policyVersion: "1.0.0"
  };
};

export const buildIctCanonicalRuntimeInput = ({
  candlesByTimeframe,
  symbol,
  asOf,
  sourceFingerprint
}: {
  candlesByTimeframe: Readonly<Partial<Record<Timeframe, readonly Candle[]>>>;
  symbol: FuturesSymbol;
  asOf: string;
  sourceFingerprint: string;
}): IctCoreDetectionInput => {
  const facts = Object.entries(candlesByTimeframe).flatMap(([timeframe, candles]) =>
    candles?.length
      ? buildCanonicalIctFactSnapshot({ candles, asOf, symbol, timeframe: timeframe as Timeframe, sourceFingerprint }).facts
      : []
  );
  const narrative = buildIctHierarchicalNarrative(facts);
  const executionCandles = candlesByTimeframe[ROLE_TIMEFRAMES.execution] ?? [];
  const currentPrice = executionCandles.filter((candle) => Date.parse(candle.timestamp) <= Date.parse(asOf)).at(-1)?.close;
  const liquidity = facts.filter((fact): fact is CanonicalLiquidityFact => fact.factType === "LIQUIDITY");
  const draw = currentPrice && (narrative.structural === "bullish" || narrative.structural === "bearish")
    ? selectCanonicalDrawOnLiquidity({ liquidity, currentPrice, direction: narrative.structural, asOf, sourceFingerprint })
    : undefined;
  const sessionFacts = buildCanonicalSessionWindows({ symbol, timeframe: ROLE_TIMEFRAMES.execution, validFrom: asOf, sourceFingerprint });
  const allFacts = [...facts, ...(draw ? [draw] : []), ...sessionFacts];
  return {
    facts: allFacts,
    candlesByTimeframe,
    asOf,
    sourceFingerprint,
    narrative,
    symbol,
    timeframe: ROLE_TIMEFRAMES.execution
  } as const;
};

export const evaluateIctCoreRuntimeCandidates = (input: IctCoreDetectionInput): IctCoreCandidateCollection =>
  buildIctCoreCandidateCollection({
    generatedAt: input.asOf,
    sourceFingerprint: input.sourceFingerprint,
    candidates: [evaluateIct2022Model(input), evaluateIctPowerOfThree(input), evaluateIctJudasSwing(input)]
  });

export const buildIctCoreRuntimeCandidates = (request: Parameters<typeof buildIctCanonicalRuntimeInput>[0]) =>
  evaluateIctCoreRuntimeCandidates(buildIctCanonicalRuntimeInput(request));

