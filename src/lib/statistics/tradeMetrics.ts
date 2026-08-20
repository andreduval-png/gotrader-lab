/**
 * Canonical trade-outcome metrics shared by backtest, walk-forward, validation,
 * and readiness. Win rate uses resolved directional trades only; expired trades
 * are counted separately and are not wins.
 */

import type { SimulatedTradeRecord } from "@/lib/backtesting/backtestTypes";
import { computeEdgeStatistics, type EdgeStatistics } from "@/lib/statistics/edgeStatistics";

export type EdgeProvenance = "in_sample" | "out_of_sample";

export interface CanonicalTradeMetrics {
  totalTrades: number;
  directionalTrades: number;
  wins: number;
  losses: number;
  expired: number;
  unresolved: number;
  /** wins / (wins + losses); 0 when no resolved trades. */
  winRate: number;
  realizedR: number;
  averageR: number;
  /** Directional stop-hit losses. This is not causal false-positive attribution. */
  stopHitCount: number;
  /** Aggregate loss estimate. This can differ from observed stop hits in summary-only evidence. */
  estimatedLossCount: number;
  /** Losses linked to a qualified discriminating pre-entry cohort, when evaluated. */
  attributedAvoidableLossCount?: number;
  /** @deprecated Compatibility field. Zero unless qualified attribution is supplied elsewhere. */
  falsePositiveCount: number;
  edgeStatistics: EdgeStatistics;
  provenance: EdgeProvenance;
}

const round = (value: number, digits = 2) => Number(value.toFixed(digits));

export function summarizeTradeOutcomes(
  trades: SimulatedTradeRecord[],
  provenance: EdgeProvenance = "in_sample"
): CanonicalTradeMetrics {
  const directional = trades.filter((trade) => trade.bias !== "neutral");
  const wins = directional.filter((trade) => trade.outcome === "target_hit").length;
  const losses = directional.filter((trade) => trade.outcome === "stop_hit").length;
  const expired = directional.filter((trade) => trade.outcome === "expired").length;
  const unresolved = trades.filter((trade) => trade.outcome === "expired" || trade.outcome === "neutral").length;
  const resolved = wins + losses;
  const realizedR = trades.reduce((sum, trade) => sum + trade.rMultiple, 0);
  const rMultiples = directional.map((trade) => trade.rMultiple).filter((value) => Number.isFinite(value));

  return {
    totalTrades: trades.length,
    directionalTrades: directional.length,
    wins,
    losses,
    expired,
    unresolved,
    winRate: resolved > 0 ? wins / resolved : 0,
    realizedR: round(realizedR, 2),
    averageR: round(realizedR / Math.max(1, trades.length), 2),
    stopHitCount: losses,
    estimatedLossCount: losses,
    falsePositiveCount: 0,
    edgeStatistics: computeEdgeStatistics(rMultiples),
    provenance
  };
}

/** Directional stop-hit loss count. Expired outcomes are sample incompleteness. */
export const stopHitCountFromTrades = (trades: SimulatedTradeRecord[]) =>
  trades.filter((trade) => trade.bias !== "neutral" && trade.outcome === "stop_hit").length;

/** @deprecated Trade outcomes alone cannot establish false-positive attribution. */
export const falsePositiveCountFromTrades = (_trades: SimulatedTradeRecord[]) => 0;
