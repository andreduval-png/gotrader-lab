export type IctCmdHighDisplacementV2Status =
  | "candidate"
  | "blocked_source"
  | "blocked_timeframe"
  | "blocked_model"
  | "blocked_direction"
  | "blocked_displacement"
  | "blocked_stale_signal"
  | "blocked_fvg"
  | "blocked_target"
  | "blocked_invalidation"
  | "blocked_rr"
  | "needs_more_data";

export interface IctCmdHighDisplacementV2Authority {
  executionAuthority: "none";
  brokerAuthority: "none";
  readinessOverrideAuthority: "none";
}

export interface IctCmdHighDisplacementV2Evidence {
  requestedSymbol: string;
  brokerSymbol: string;
  timeframe: string;
  sourceProvider: string;
  sourceFingerprint: string;
  signalTime?: string;
  modelProfile?: string;
  modelState?: string;
  modelDirection?: string;
  side: "short" | "flat";
  displacementDirection?: string;
  displacementAgeBars?: number;
  displacementScore?: number;
  fvgPresentAtSignal: boolean;
  fvgAgeBars?: number;
  externalLiquidityTargetPresent: boolean;
  externalLiquidityTargetType?: string;
  entry?: number;
  stop?: number;
  target?: number;
  rr?: number;
}

export interface IctCmdHighDisplacementV2Candidate {
  strategyId: "cmd_high_displacement_v2_research";
  status: IctCmdHighDisplacementV2Status;
  eligible: boolean;
  researchOnly: true;
  side: "short" | "flat";
  requestedSymbol: string;
  brokerSymbol: string;
  timeframe: string;
  sourceFingerprint: string;
  signalTime?: string;
  entry?: number;
  stop?: number;
  target?: number;
  rr?: number;
  displacementScore?: number;
  displacementAgeBars?: number;
  fvgPresentAtSignal: boolean;
  externalLiquidityTargetPresent: boolean;
  externalLiquidityTargetType?: string;
  blockers: string[];
  warnings: string[];
  summary: string;
  nextAction: string;
  authority: IctCmdHighDisplacementV2Authority;
  safety: {
    rawCandlesExcluded: true;
    rawSnapshotsExcluded: true;
    accountDataExcluded: true;
    orderDataExcluded: true;
    positionDataExcluded: true;
    secretsExcluded: true;
  };
}

export interface IctCmdHighDisplacementV2Input {
  candles: Candle[];
  requestedSymbol: string;
  brokerSymbol?: string;
  timeframe: string;
  sourceProvider: string;
  sourceFingerprint?: string;
  requestedLookbackDays?: number;
  availableLookbackDays?: number;
}
import type { Candle } from "../types";
