import { canonicalFingerprint } from "@/lib/ictCanonical/canonicalIctIdentity";
import {
  buildCanonicalTradeGeometry
} from "@/lib/tradeGeometry/canonicalTradeGeometry";
import type { CanonicalTradeGeometry, TradeDirection } from "@/lib/tradeGeometry/tradeGeometryTypes";
import type { IctCisdCandidate } from "./ictCisdTypes";
import type { IctIfvgCandidate } from "./ictIfvgTypes";
import type { IctSessionRaidReversalNarrative } from "./ictSessionRaidReversalTypes";
import type { IctSilverBulletCandidate } from "./ictSilverBulletTypes";
import type { IctTurtleSoupCandidate } from "./ictTurtleSoupTypes";

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value > 0;
const directionFor = (side: "long" | "short"): TradeDirection => side === "long" ? "LONG" : "SHORT";

type NativeGeometryCandidate = {
  side: string;
  entry?: number;
  stop?: number;
  target?: number;
  sourceFingerprint?: string;
  requestedSymbol?: string;
  brokerSymbol?: string;
};

const complete = (candidate: NativeGeometryCandidate) =>
  (candidate.side === "long" || candidate.side === "short") &&
  finite(candidate.entry) &&
  finite(candidate.stop) &&
  finite(candidate.target) &&
  Boolean(candidate.sourceFingerprint);

const nativeRiskAccepted = (candidate: NativeGeometryCandidate) => {
  if (!complete(candidate)) return false;
  const riskDistance = candidate.side === "long"
    ? candidate.entry! - candidate.stop!
    : candidate.stop! - candidate.entry!;
  const rewardDistance = candidate.side === "long"
    ? candidate.target! - candidate.entry!
    : candidate.entry! - candidate.target!;
  if (!(riskDistance > 0) || !(rewardDistance > 0)) return false;
  const symbol = `${candidate.requestedSymbol ?? ""} ${candidate.brokerSymbol ?? ""}`.toUpperCase();
  if (/MNQ|USTECH|US100|(?:^|\s)NQ(?:\s|$)/.test(symbol)) {
    return riskDistance >= 2 && riskDistance <= 50;
  }
  return true;
};

const ifvgNativeRiskAccepted = (candidate: IctIfvgCandidate) => {
  if (!complete(candidate)) return false;
  const riskDistance = candidate.side === "long"
    ? candidate.entry! - candidate.stop!
    : candidate.stop! - candidate.entry!;
  if (!(riskDistance > 0)) return false;
  const symbol = `${candidate.requestedSymbol ?? ""} ${candidate.brokerSymbol ?? ""}`.toUpperCase();
  return !/MNQ|USTECH|US100|(?:^|\s)NQ(?:\s|$)/.test(symbol) || riskDistance >= 4;
};

export const adaptIfvgNativeGeometry = ({
  candidate,
  strategyId,
  strategyVersion,
  profileId,
  profileVersion,
  researchOnly
}: {
  candidate: IctIfvgCandidate;
  strategyId: "ifvg_v1" | "ifvg_filtered_v2_research" | "ifvg_fresh_retest_v3_research" | "ifvg_fresh_retest_v4_candidate";
  strategyVersion: string;
  profileId?: string;
  profileVersion?: string;
  researchOnly: boolean;
}): CanonicalTradeGeometry | undefined => {
  if (!ifvgNativeRiskAccepted(candidate)) return undefined;
  const direction = directionFor(candidate.side as "long" | "short");
  const targetId = canonicalFingerprint({
    strategyId,
    sourceFingerprint: candidate.sourceFingerprint,
    targetType: candidate.liquidityTarget?.type,
    targetPrice: candidate.target,
    targetSource: candidate.liquidityTarget?.source
  });
  const candidateId = candidate.candidateId;
  return buildCanonicalTradeGeometry({
    strategyId,
    strategyVersion,
    profileId,
    profileVersion,
    candidateId,
    direction,
    entry: {
      model: "IFVG_NATIVE_MIDPOINT_RETEST",
      intendedPrice: candidate.entry!,
      sourceFactId: candidate.retestCandle?.timestamp,
      ownerTimeframe: candidate.timeframe,
      validFrom: candidate.retestCandle?.timestamp,
      lifecycleStatus: candidate.entryLifecycleStatus === "entry_missed"
        ? "ENTRY_MISSED"
        : "ENTRY_TOUCHED_NOT_FILLED"
    },
    stop: {
      model: "IFVG_NATIVE_FULL_GAP_INVALIDATION",
      price: candidate.stop!,
      sourceFactId: candidate.originalFvgCandle?.timestamp,
      ownerTimeframe: candidate.timeframe,
      structuralInvalidation: !candidate.tradeConstruction?.blockers.some((blocker) =>
        ["stop_too_tight", "stop_too_wide", "stop_not_beyond_structure", "invalid_price_order"].includes(blocker)
      ),
      bufferPolicyId: "ifvg.native-gap-buffer",
      bufferPolicyVersion: strategyVersion
    },
    targetCandidates: [{
      targetId,
      type: "EXTERNAL_LIQUIDITY",
      direction,
      price: candidate.target!,
      sourceFactId: candidate.liquidityTarget
        ? `${candidate.liquidityTarget.type}:${candidate.liquidityTarget.source}`
        : undefined,
      ownerTimeframe: candidate.timeframe,
      validFrom: candidate.retestCandle?.timestamp,
      consumed: false,
      internalExternalClass: "EXTERNAL"
    }],
    targetPolicy: {
      policyId: `${strategyId}.native-liquidity-target`,
      policyVersion: strategyVersion,
      primaryTargetType: "EXTERNAL_LIQUIDITY",
      primaryTargetId: targetId,
      allowedFallbackTargetTypes: []
    },
    minimumRequiredRR: 2,
    sourceFingerprint: candidate.sourceFingerprint!,
    asOf: candidate.generatedAt,
    researchOnly
  });
};

export const adaptSilverBulletNativeGeometry = (
  candidate: IctSilverBulletCandidate,
  researchOnly: boolean
): CanonicalTradeGeometry | undefined => {
  if (!nativeRiskAccepted(candidate)) return undefined;
  const direction = directionFor(candidate.side as "long" | "short");
  const candidateId = canonicalFingerprint({
    strategyId: candidate.strategyId,
    sourceFingerprint: candidate.sourceFingerprint,
    sweep: candidate.sweep?.candleTimestamp,
    fvg: candidate.fvg?.createdAt,
    retest: candidate.returnToFvgTimestamp
  });
  const targetId = canonicalFingerprint({ candidateId, target: candidate.target, role: "silver-bullet-native-target" });
  return buildCanonicalTradeGeometry({
    strategyId: candidate.strategyId,
    strategyVersion: candidate.strategyId === "silver_bullet_v1" ? "1.0.0" : "2.0.0",
    candidateId,
    direction,
    entry: {
      model: "SILVER_BULLET_NATIVE_FVG_MIDPOINT",
      intendedPrice: candidate.entry!,
      sourceFactId: candidate.fvg?.createdAt,
      ownerTimeframe: candidate.timeframe,
      validFrom: candidate.returnToFvgTimestamp,
      lifecycleStatus: "ENTRY_TOUCHED_NOT_FILLED"
    },
    stop: {
      model: "SILVER_BULLET_NATIVE_SWEEP_OR_FVG_EXTREME",
      price: candidate.stop!,
      sourceFactId: candidate.sweep?.candleTimestamp,
      ownerTimeframe: candidate.timeframe,
      structuralInvalidation: !candidate.blockers.some((blocker) => /tiny|stop|invalid_price_order/i.test(blocker))
    },
    targetCandidates: [{
      targetId,
      type: candidate.side === "long" ? "SESSION_HIGH" : "SESSION_LOW",
      direction,
      price: candidate.target!,
      ownerTimeframe: candidate.timeframe,
      validFrom: candidate.returnToFvgTimestamp,
      consumed: false,
      internalExternalClass: "EXTERNAL"
    }],
    targetPolicy: {
      policyId: `${candidate.strategyId}.native-session-liquidity`,
      policyVersion: candidate.strategyId === "silver_bullet_v1" ? "1.0.0" : "2.0.0",
      primaryTargetType: candidate.side === "long" ? "SESSION_HIGH" : "SESSION_LOW",
      primaryTargetId: targetId,
      allowedFallbackTargetTypes: []
    },
    minimumRequiredRR: 2,
    sourceFingerprint: candidate.sourceFingerprint!,
    asOf: candidate.generatedAt,
    researchOnly
  });
};

export const adaptTurtleSoupNativeGeometry = (
  candidate: IctTurtleSoupCandidate,
  researchOnly: boolean
): CanonicalTradeGeometry | undefined => {
  if (!nativeRiskAccepted(candidate)) return undefined;
  const direction = directionFor(candidate.side as "long" | "short");
  const candidateId = canonicalFingerprint({
    strategyId: candidate.strategyId,
    sourceFingerprint: candidate.sourceFingerprint,
    sweep: candidate.sweep?.timestamp,
    mss: candidate.marketStructureShift?.timestamp,
    entry: candidate.entry
  });
  const targetType = "RANGE_BOUNDARY" as const;
  const targetId = canonicalFingerprint({ candidateId, target: candidate.target, role: "turtle-soup-opposite-range" });
  return buildCanonicalTradeGeometry({
    strategyId: candidate.strategyId,
    strategyVersion: "1.0.0",
    candidateId,
    direction,
    entry: {
      model: "TURTLE_SOUP_NATIVE_MSS_RETEST",
      intendedPrice: candidate.entry!,
      sourceFactId: candidate.marketStructureShift?.timestamp,
      ownerTimeframe: candidate.entryTimeframe,
      validFrom: candidate.rejectionTimestamp,
      lifecycleStatus: "ENTRY_TOUCHED_NOT_FILLED"
    },
    stop: {
      model: "TURTLE_SOUP_NATIVE_SWEEP_WICK",
      price: candidate.stop!,
      sourceFactId: candidate.sweep?.timestamp,
      ownerTimeframe: candidate.entryTimeframe,
      structuralInvalidation: true
    },
    targetCandidates: [{
      targetId,
      type: targetType,
      direction,
      price: candidate.target!,
      sourceFactId: candidate.side === "long" ? "setup-range-high" : "setup-range-low",
      ownerTimeframe: candidate.setupTimeframe,
      validFrom: candidate.rejectionTimestamp,
      consumed: false,
      internalExternalClass: "EXTERNAL"
    }],
    targetPolicy: {
      policyId: "turtle_soup_v1.native-opposite-range-boundary",
      policyVersion: "1.0.0",
      primaryTargetType: targetType,
      primaryTargetId: targetId,
      allowedFallbackTargetTypes: []
    },
    minimumRequiredRR: 2.5,
    sourceFingerprint: candidate.sourceFingerprint!,
    asOf: candidate.generatedAt,
    researchOnly
  });
};

export const adaptCisdNativeGeometry = (
  candidate: IctCisdCandidate,
  researchOnly: boolean
): CanonicalTradeGeometry | undefined => {
  if (!nativeRiskAccepted(candidate)) return undefined;
  const direction = directionFor(candidate.side as "long" | "short");
  const candidateId = canonicalFingerprint({
    strategyId: candidate.strategyId,
    sourceFingerprint: candidate.sourceFingerprint,
    cisd: candidate.cisdCandle?.timestamp,
    retest: candidate.retestTimestamp
  });
  const targetId = canonicalFingerprint({ candidateId, target: candidate.target, role: "cisd-opposing-liquidity" });
  return buildCanonicalTradeGeometry({
    strategyId: candidate.strategyId,
    strategyVersion: "1.0.0",
    candidateId,
    direction,
    entry: {
      model: "CISD_NATIVE_BODY_MIDPOINT_RETEST",
      intendedPrice: candidate.entry!,
      sourceFactId: candidate.cisdCandle?.timestamp,
      ownerTimeframe: candidate.timeframe,
      validFrom: candidate.retestTimestamp,
      lifecycleStatus: "ENTRY_TOUCHED_NOT_FILLED"
    },
    stop: {
      model: "CISD_NATIVE_SHIFT_CANDLE_EXTREME",
      price: candidate.stop!,
      sourceFactId: candidate.cisdCandle?.timestamp,
      ownerTimeframe: candidate.timeframe,
      structuralInvalidation: true
    },
    targetCandidates: [{
      targetId,
      type: candidate.side === "long" ? "SWING_HIGH" : "SWING_LOW",
      direction,
      price: candidate.target!,
      ownerTimeframe: candidate.timeframe,
      validFrom: candidate.retestTimestamp,
      consumed: false,
      internalExternalClass: "EXTERNAL"
    }],
    targetPolicy: {
      policyId: "cisd_v1.native-opposing-liquidity",
      policyVersion: "1.0.0",
      primaryTargetType: candidate.side === "long" ? "SWING_HIGH" : "SWING_LOW",
      primaryTargetId: targetId,
      allowedFallbackTargetTypes: []
    },
    minimumRequiredRR: 2,
    sourceFingerprint: candidate.sourceFingerprint!,
    asOf: candidate.generatedAt,
    researchOnly
  });
};

export const adaptSessionRaidNativeGeometry = ({
  narrative,
  strategyId,
  strategyVersion,
  profileId,
  researchOnly
}: {
  narrative: IctSessionRaidReversalNarrative;
  strategyId: "nasdaq_london_raid_ny_reversal_v1" | "nasdaq_london_raid_ny_reversal_v2_filtered_research";
  strategyVersion: string;
  profileId?: string;
  researchOnly: boolean;
}): CanonicalTradeGeometry | undefined => {
  const candidate = {
    side: narrative.side === "short" ? "short" : "flat",
    entry: narrative.entry,
    stop: narrative.invalidation,
    target: narrative.target,
    sourceFingerprint: narrative.sourceFingerprint,
    requestedSymbol: narrative.requestedSymbol,
    brokerSymbol: narrative.brokerSymbol
  };
  if (!nativeRiskAccepted(candidate)) return undefined;
  const candidateId = canonicalFingerprint({
    strategyId,
    sourceFingerprint: narrative.sourceFingerprint,
    tradingDate: narrative.tradingDate,
    raid: narrative.steps.find((step) => step.step === "ny_london_high_raid")?.timestamp,
    retrace: narrative.steps.find((step) => step.step === "fvg_retrace")?.timestamp
  });
  const targetId = canonicalFingerprint({ candidateId, target: narrative.target, role: "session-raid-sellside" });
  return buildCanonicalTradeGeometry({
    strategyId,
    strategyVersion,
    profileId,
    profileVersion: profileId ? strategyVersion : undefined,
    candidateId,
    direction: "SHORT",
    entry: {
      model: "SESSION_RAID_NATIVE_FVG_RETRACE",
      intendedPrice: narrative.entry!,
      sourceFactId: narrative.fairValueGap?.createdAt,
      ownerTimeframe: narrative.entryTimeframe,
      validFrom: narrative.steps.find((step) => step.step === "fvg_retrace")?.timestamp,
      lifecycleStatus: "ENTRY_TOUCHED_NOT_FILLED"
    },
    stop: {
      model: "SESSION_RAID_NATIVE_RAID_EXTREME_BUFFER",
      price: narrative.invalidation!,
      sourceFactId: narrative.steps.find((step) => step.step === "ny_london_high_raid")?.timestamp,
      ownerTimeframe: narrative.primaryTimeframe,
      structuralInvalidation: !narrative.tradeConstructionBlockers.some((blocker) =>
        ["stop_too_tight", "stop_too_wide", "stop_not_beyond_structure", "invalid_price_order"].includes(blocker)
      )
    },
    targetCandidates: [{
      targetId,
      type: "EXTERNAL_LIQUIDITY",
      direction: "SHORT",
      price: narrative.target!,
      sourceFactId: narrative.referenceLevels.sellSideLiquidityTargets[0]?.source,
      ownerTimeframe: narrative.primaryTimeframe,
      validFrom: narrative.steps.find((step) => step.step === "fvg_retrace")?.timestamp,
      consumed: false,
      internalExternalClass: "EXTERNAL"
    }],
    targetPolicy: {
      policyId: `${strategyId}.native-sellside-liquidity`,
      policyVersion: strategyVersion,
      primaryTargetType: "EXTERNAL_LIQUIDITY",
      primaryTargetId: targetId,
      allowedFallbackTargetTypes: []
    },
    minimumRequiredRR: 2,
    sourceFingerprint: narrative.sourceFingerprint!,
    asOf: narrative.steps.find((step) => step.step === "fvg_retrace")?.timestamp ?? narrative.tradingDate ?? new Date(0).toISOString(),
    researchOnly
  });
};
