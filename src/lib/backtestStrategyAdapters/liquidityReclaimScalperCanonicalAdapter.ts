import { buildCanonicalOpportunity } from "../backtestSimulation/simulationContracts";
import type { CanonicalOpportunity } from "../backtestSimulation/simulationTypes";
import type { LrsCandidate } from "../strategyLibrary/liquidityReclaimScalper/liquidityReclaimScalperTypes";

export const LRS_BT2_ADAPTER_VERSION = "gotrader-lrs-bt2-adapter-v1";

export async function adaptLiquidityReclaimCandidateToBt2(input: {
  readonly candidate: Readonly<LrsCandidate>;
  readonly datasetId: string;
  readonly contextLineageRoot: string;
  readonly signalPrice: number;
}): Promise<Readonly<CanonicalOpportunity>> {
  const { candidate } = input;
  if (candidate.strategyId !== "liquidity_reclaim_scalper_v1" || candidate.profileId !== "liquidity_reclaim_scalper_v1_base_research") throw new Error("LRS BT2 adapter rejected strategy identity.");
  if (candidate.state !== "ENTRY_ELIGIBLE" || candidate.blockers.length || candidate.entryPrice === undefined || candidate.stopPrice === undefined || candidate.targetPrice === undefined || candidate.entryEligibleAt === undefined) throw new Error("LRS BT2 adapter requires blocker-free entry-eligible geometry.");
  const ordered = candidate.direction === "long"
    ? candidate.stopPrice < candidate.entryPrice && candidate.entryPrice < candidate.targetPrice
    : candidate.targetPrice < candidate.entryPrice && candidate.entryPrice < candidate.stopPrice;
  if (!ordered) throw new Error("LRS BT2 adapter rejected incoherent geometry.");
  return buildCanonicalOpportunity({ adapterVersion: LRS_BT2_ADAPTER_VERSION, datasetCertificateId: candidate.datasetCertificateId,
    datasetId: input.datasetId, strategyId: candidate.strategyId, profileVersion: candidate.profileVersion,
    parameterHash: candidate.parameterHash, requestedSymbol: candidate.requestedSymbol, brokerSymbol: candidate.brokerSymbol,
    timeframe: candidate.executionTimeframe, decisionAtUtc: candidate.entryEligibleAt, sourceCandleClosedAtUtc: candidate.entryEligibleAt,
    contextLineageRoot: input.contextLineageRoot, direction: candidate.direction,
    orderPolicy: candidate.entryModel === "CONFIRMATION_CLOSE" ? "market_at_next_open" : "limit_at_price",
    activatesAtUtc: candidate.entryEligibleAt, expiresAtUtc: candidate.expiresAt, signalPrice: input.signalPrice,
    entryPrice: candidate.entryPrice, stopPrice: candidate.stopPrice, targetPrices: Object.freeze([candidate.targetPrice]),
    eligible: true, blockers: Object.freeze([]) });
}
