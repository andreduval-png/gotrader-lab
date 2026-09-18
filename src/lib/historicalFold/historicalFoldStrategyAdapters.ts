import {
  evaluateIct2022Model,
  ICT_2022_MODEL_VERSION,
  ICT_2022_PROFILE_ID
} from "@/lib/ictI2/ict2022Model";
import { evaluateMarketMakerBuyModel } from "@/lib/ictI3/marketMakerBuyModel";
import { evaluateMarketMakerSellModel } from "@/lib/ictI3/marketMakerSellModel";
import { assessIctIfvgFreshRetestV3 } from "@/lib/ict-strategy-suite/ictIfvgFreshRetestV3";
import {
  evaluateIctSessionRaidReversal,
  LONDON_RAID_V1_STRATEGY_VERSION,
  LONDON_RAID_V1_TARGET_POLICY_ID,
  LONDON_RAID_V1_TARGET_POLICY_VERSION
} from "@/lib/ict-strategy-suite/ictSessionRaidReversal";
import type { CanonicalHistoricalFoldAdapter, HistoricalFoldDetectionContext } from "./historicalFoldTypes";
import { resolveHistoricalStrategyAdapter } from "@/lib/historicalGeometry";

const missingNarrative = (strategyId: string, context: HistoricalFoldDetectionContext) => ({
  candidateId: `${strategyId}|${context.sourceFingerprint}|${context.asOf}`,
  status: "NARRATIVE_DEPENDENCY_UNAVAILABLE",
  blockers: ["Frozen canonical narrative is required for this strategy owner at historical asOf."]
});

export const IFVG_V3_FOLD_ADAPTER: CanonicalHistoricalFoldAdapter = {
  adapterId: "gotrader.fold.ifvg-v3.control-owner-adapter",
  adapterVersion: "1.0.0",
  strategyId: "ifvg_fresh_retest_v3_research",
  strategyVersion: "v3",
  profileId: "ifvg_fresh_retest_v3_research",
  profileVersion: "v3",
  parameterHash: "ifvg-v3-frozen-profile-2026-07-14",
  requiredTimeframes: ["5m", "15m", "1h", "4h", "1d"],
  classification: "FOLD_RUNNER_COMPLETE",
  geometryPolicyId: "ifvg_fresh_retest_v3_research.native-liquidity-target",
  geometryPolicyVersion: "v3",
  sessionPolicyId: "ifvg-v3-session-policy.v1",
  detect(context) {
    const assessment = assessIctIfvgFreshRetestV3({
      candles: [...(context.candlesByTimeframe["5m"] ?? [])],
      contextCandles: {
        "15m": [...(context.candlesByTimeframe["15m"] ?? [])],
        "1h": [...(context.candlesByTimeframe["1h"] ?? [])],
        "4h": [...(context.candlesByTimeframe["4h"] ?? [])],
        "1d": [...(context.candlesByTimeframe["1d"] ?? [])]
      },
      sourceProvider: "canonical_research",
      sourceFingerprint: context.sourceFingerprint,
      requestedSymbol: "MNQ",
      brokerSymbol: "USTECH",
      timeframe: "5m",
      generatedAt: context.asOf
    });
    const candidate = assessment.candidate;
    return {
      candidateId: candidate.geometry?.candidateId ?? `${assessment.strategyId}|${candidate.retestCandle?.timestamp ?? context.asOf}`,
      status: assessment.eligible ? "eligible" : candidate.status,
      geometry: assessment.geometry,
      blockers: assessment.blockers
    };
  }
};

export const LONDON_RAID_FOLD_ADAPTER: CanonicalHistoricalFoldAdapter = {
  adapterId: "gotrader.fold.london-raid-v1.control-owner-adapter",
  adapterVersion: "1.1.0",
  strategyId: "nasdaq_london_raid_ny_reversal_v1",
  strategyVersion: LONDON_RAID_V1_STRATEGY_VERSION,
  profileId: "nasdaq_london_raid_ny_reversal_v1",
  profileVersion: "1.0.0",
  parameterHash: "london-raid-v1-session-policy",
  requiredTimeframes: ["5m", "15m"],
  classification: "FOLD_RUNNER_COMPLETE",
  geometryPolicyId: LONDON_RAID_V1_TARGET_POLICY_ID,
  geometryPolicyVersion: LONDON_RAID_V1_TARGET_POLICY_VERSION,
  sessionPolicyId: "london-new-york-session.v1",
  detect(context) {
    const candidate = evaluateIctSessionRaidReversal({
      candles5m: [...(context.candlesByTimeframe["5m"] ?? [])],
      candles15m: [...(context.candlesByTimeframe["15m"] ?? [])],
      sourceProvider: "canonical_research",
      sourceFingerprint: context.sourceFingerprint,
      requestedSymbol: "MNQ",
      brokerSymbol: "USTECH",
      primaryTimeframe: "5m",
      entryTimeframe: "15m",
      timingZone: "America/New_York",
      generatedAt: context.asOf
    });
    return {
      candidateId: candidate.geometry?.candidateId ?? candidate.narrativeId,
      status: candidate.status,
      geometry: candidate.geometry,
      blockers: candidate.blockers
    };
  }
};

export const ICT_2022_FOLD_ADAPTER: CanonicalHistoricalFoldAdapter = {
  adapterId: "gotrader.fold.ict-2022.control-owner-adapter",
  adapterVersion: "1.0.0",
  strategyId: "ict_2022_model_v1",
  strategyVersion: ICT_2022_MODEL_VERSION,
  profileId: ICT_2022_PROFILE_ID,
  profileVersion: "1.0.0",
  parameterHash: "ict-2022-v2-int3a-canonical",
  requiredTimeframes: ["1h", "15m", "5m"],
  classification: "FOLD_RUNNER_COMPLETE",
  geometryPolicyId: "gotrader.ict-2022.geometry.v1",
  geometryPolicyVersion: "1.0.0",
  sessionPolicyId: "ict-2022-new-york-session.v1",
  detect(context) {
    if (!context.narrative) return missingNarrative("ict_2022_model_v1", context);
    const candidate = evaluateIct2022Model({
      facts: context.canonicalFacts,
      candlesByTimeframe: context.candlesByTimeframe,
      asOf: context.asOf,
      sourceFingerprint: context.sourceFingerprint,
      narrative: context.narrative,
      symbol: "MNQ",
      timeframe: "5m"
    });
    return {
      candidateId: candidate.candidateId,
      status: candidate.state,
      geometry: candidate.canonicalGeometry,
      blockers: candidate.blockers,
      entryMissed: candidate.state === "ENTRY_MISSED",
      targetConsumed: candidate.state === "TARGET_CONSUMED"
    };
  }
};

const marketMakerAdapter = (side: "buy" | "sell"): CanonicalHistoricalFoldAdapter => {
  const strategyId = side === "buy" ? "ict_market_maker_buy_model_v1" : "ict_market_maker_sell_model_v1";
  const profileId = side === "buy" ? "ict_mmbm_base_research_v1" : "ict_mmsm_base_research_v1";
  return {
    adapterId: `gotrader.fold.${side === "buy" ? "mmbm" : "mmsm"}.control-owner-adapter`,
    adapterVersion: "1.0.0",
    strategyId,
    strategyVersion: "1.0.0",
    profileId,
    profileVersion: "1.0.0",
    parameterHash: "gotrader.ict.i3.market-maker.parameters.v1",
    requiredTimeframes: ["1h", "5m"],
    classification: "FOLD_RUNNER_COMPLETE",
    geometryPolicyId: "gotrader.ict.i3.market-maker.geometry.v1",
    geometryPolicyVersion: "1.0.0",
    sessionPolicyId: "market-maker-new-york-delivery.v1",
    detect(context) {
      if (!context.narrative) return missingNarrative(strategyId, context);
      const candidate = side === "buy"
        ? evaluateMarketMakerBuyModel({
          facts: context.canonicalFacts,
          candlesByTimeframe: context.candlesByTimeframe,
          asOf: context.asOf,
          sourceFingerprint: context.sourceFingerprint,
          narrative: context.narrative,
          dataset: context.dataset
        })
        : evaluateMarketMakerSellModel({
          facts: context.canonicalFacts,
          candlesByTimeframe: context.candlesByTimeframe,
          asOf: context.asOf,
          sourceFingerprint: context.sourceFingerprint,
          narrative: context.narrative,
          dataset: context.dataset
        });
      return {
        candidateId: candidate.candidateId,
        status: candidate.state,
        geometry: candidate.geometry,
        blockers: candidate.blockers,
        entryMissed: candidate.state === "ENTRY_MISSED",
        targetConsumed: candidate.state === "TARGET_CONSUMED" || candidate.state === "OBJECTIVE_REACHED"
      };
    }
  };
};

export const MMBM_FOLD_ADAPTER = marketMakerAdapter("buy");
export const MMSM_FOLD_ADAPTER = marketMakerAdapter("sell");

export const CANONICAL_HISTORICAL_FOLD_ADAPTERS = Object.freeze([
  IFVG_V3_FOLD_ADAPTER,
  ICT_2022_FOLD_ADAPTER,
  MMBM_FOLD_ADAPTER,
  MMSM_FOLD_ADAPTER,
  LONDON_RAID_FOLD_ADAPTER
]);

export const resolveCanonicalHistoricalFoldAdapter = (strategyId: string, profileId?: string) => {
  const adapter = CANONICAL_HISTORICAL_FOLD_ADAPTERS.find((item) =>
    item.strategyId === strategyId && (!profileId || item.profileId === profileId)
  );
  if (adapter?.classification === "FOLD_RUNNER_COMPLETE") return adapter;
  const historical = resolveHistoricalStrategyAdapter(strategyId, profileId);
  throw new Error(
    `AUTO_RESEARCH_FOLD_DISPATCH_BLOCKED: ${strategyId}/${profileId ?? "default"} ` +
    `is ${historical.classification === "SOURCE_BLOCKED" ? "SOURCE_BLOCKED" : "FOLD_RUNNER_ADAPTER_REQUIRED"}.`
  );
};
