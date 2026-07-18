export type DetectorProfileWalkForwardVerdict =
  | "passed"
  | "failed"
  | "insufficient_data"
  | "blocked_source"
  | "forward_evidence_required";

export interface DetectorProfileTradeOutcome {
  openedAt: string;
  rMultiple: number;
  outcome: "target_hit" | "stop_hit" | "expired" | "neutral";
}

export interface DetectorProfileWalkForwardWindow {
  windowIndex: number;
  from: string;
  to: string;
  priorTradeCount: number;
  oosTrades: number;
  uniqueTradingDates: number;
  targetFirst: number;
  invalidationFirst: number;
  stalled: number;
  winRate: number;
  averageR: number;
  profitFactor: number;
  maxDrawdownR: number;
  expectancyLower95: number;
  expectancyUpper95: number;
  edgeVerdict: string;
  passed: boolean;
  failReasons: string[];
}

export interface DetectorProfileWalkForwardResult {
  profileId: string;
  generatedAt: string;
  method: "frozen_profile_chronological_holdout";
  verdict: DetectorProfileWalkForwardVerdict;
  sourceProvider: string;
  sourceFingerprint: string;
  sourceStart: string;
  sourceEnd: string;
  provenance: ValidationProvenanceIdentity;
  developmentEnd: string;
  holdoutFraction: number;
  windowDays: number;
  oosWindowCount: number;
  oosWindowsPassed: number;
  oosWindowPassRate: number;
  totalOosTrades: number;
  uniqueOosTradingDates: number;
  largestSingleDateShare: number;
  pooledOos: {
    averageR: number;
    profitFactor: number;
    maxDrawdownR: number;
    expectancyLower95: number;
    expectancyUpper95: number;
    edgeVerdict: string;
  };
  additionalCost05R: {
    averageR: number;
    profitFactor: number;
    expectancyLower95: number;
    expectancyUpper95: number;
    edgeVerdict: string;
  };
  windows: DetectorProfileWalkForwardWindow[];
  blockers: string[];
  warnings: string[];
  nextAction: string;
  authority: {
    executionAuthority: "none";
    brokerAuthority: "none";
    readinessOverrideAuthority: "none";
  };
  safety: {
    rawCandlesExcluded: true;
    accountDataExcluded: true;
    orderDataExcluded: true;
    positionDataExcluded: true;
    readinessPromotionAllowed: false;
  };
}

export interface DetectorProfileWalkForwardInput {
  profileId: string;
  sourceProvider: string;
  sourceFingerprint: string;
  sourceStart: string;
  sourceEnd: string;
  proposalId?: string;
  candidateId?: string;
  requestedSymbol?: string;
  brokerSymbol?: string;
  timeframe?: string;
  parameterFingerprint?: string;
  detectorProfileFingerprint?: string;
  validationRunId?: string;
  trades: DetectorProfileTradeOutcome[];
  holdoutFraction?: number;
  windowDays?: number;
  minimumOosWindows?: number;
  minimumOosTrades?: number;
  minimumTradesPerWindow?: number;
  minimumUniqueDates?: number;
  minimumWindowPassRate?: number;
  maximumSingleDateShare?: number;
}
import type { ValidationProvenanceIdentity } from "@/lib/validationProvenance";
