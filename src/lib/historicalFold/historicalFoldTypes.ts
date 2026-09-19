import type { CanonicalIctFact } from "@/lib/ictCanonical/canonicalIctTypes";
import type { IctHierarchicalNarrative } from "@/lib/ictI2/ictI2Types";
import type { CanonicalHistoricalGeometryEnvelope } from "@/lib/historicalGeometry";
import type { CanonicalTradeGeometry } from "@/lib/tradeGeometry";
import type { Candle, Timeframe } from "@/lib/types";

export type HistoricalFoldRunnerClassification =
  | "FOLD_RUNNER_COMPLETE"
  | "FOLD_RUNNER_ADAPTER_REQUIRED"
  | "SOURCE_BLOCKED"
  | "RESEARCH_ONLY"
  | "NON_EXECUTABLE";

export type HistoricalFoldPartition = "train" | "validation" | "oos";

export interface HistoricalFoldInterval {
  startInclusive: string;
  endExclusive: string;
}

export interface HistoricalFoldDefinition {
  experimentFamilyId: string;
  trialId: string;
  foldId: string;
  partition: HistoricalFoldPartition;
  train?: HistoricalFoldInterval;
  validation?: HistoricalFoldInterval;
  oos?: HistoricalFoldInterval;
  run: HistoricalFoldInterval;
}

export interface HistoricalFoldDatasetIdentity {
  datasetId: string;
  datasetCertificateId: string;
  datasetChecksum: string;
  sourceFingerprint: string;
}

export interface HistoricalFoldDetectionContext {
  asOf: string;
  sourceFingerprint: string;
  candlesByTimeframe: Readonly<Partial<Record<Timeframe, readonly Candle[]>>>;
  canonicalFacts: readonly CanonicalIctFact[];
  narrative?: IctHierarchicalNarrative;
  dataset: HistoricalFoldDatasetIdentity;
}

export interface HistoricalFoldDetection {
  candidateId: string;
  status: string;
  geometry?: CanonicalTradeGeometry;
  blockers: readonly string[];
  entryMissed?: boolean;
  targetConsumed?: boolean;
}

export interface CanonicalHistoricalFoldAdapter {
  adapterId: string;
  adapterVersion: string;
  strategyId: string;
  strategyVersion: string;
  profileId?: string;
  profileVersion?: string;
  parameterHash: string;
  requiredTimeframes: readonly Timeframe[];
  classification: HistoricalFoldRunnerClassification;
  geometryPolicyId: string;
  geometryPolicyVersion: string;
  sessionPolicyId: string;
  detect(context: HistoricalFoldDetectionContext): HistoricalFoldDetection;
}

export interface CanonicalBt2FoldOutcome {
  geometryId: string;
  canonicalGeometryParityHash: string;
  entryIndex?: number;
  exitIndex: number;
  openedAt?: string;
  resolvedAt: string;
  outcome: "target_hit" | "stop_hit" | "expired" | "entry_not_retraced";
  theoreticalRR: number;
  realizedR: number;
  unrealizedR?: number;
  targetHit: boolean;
  stopHit: boolean;
  sameBarAmbiguous: boolean;
  costR: number;
}

export interface HistoricalFoldCheckpoint {
  schemaVersion: "gotrader.historical-fold-checkpoint.v2";
  checkpointHash: string;
  foldIdentityHash: string;
  identity: {
    strategyId: string;
    strategyVersion: string;
    adapterId: string;
    adapterVersion: string;
    geometryPolicyId: string;
    geometryPolicyVersion: string;
    sessionPolicyId: string;
    parameterHash: string;
    datasetId: string;
    datasetCertificateId: string;
    sourceFingerprint: string;
    partition: HistoricalFoldPartition;
    range: HistoricalFoldInterval;
  };
  nextPosition: number;
  processedAsOf: string[];
  detections: HistoricalFoldDetectionRecord[];
  outcomes: CanonicalBt2FoldOutcome[];
  geometryEnvelopes: CanonicalHistoricalGeometryEnvelope[];
}

export interface HistoricalFoldDetectionRecord {
  asOf: string;
  narrativeIdentity: string;
  narrative: IctHierarchicalNarrative;
  contextDiagnostics: {
    factCounts: Record<string, number>;
    draws: { factId: string; targetClass: string; direction: string; available: boolean; consumed: boolean }[];
  };
  candidateId: string;
  status: string;
  geometryId?: string;
  geometryStatus?: CanonicalTradeGeometry["status"];
  blockers: string[];
  entryMissed: boolean;
  targetConsumed: boolean;
}

export interface CanonicalHistoricalFoldResult {
  schemaVersion: "gotrader.canonical-historical-fold-result.v2";
  resultIdentityHash: string;
  foldIdentityHash: string;
  runnerId: "gotrader.canonical-historical-fold-runner";
  runnerVersion: "2.0.0";
  bt2Version: "gotrader.bt2.canonical-fold-scoring.v2";
  canonicalGeometryVersion: string;
  experimentFamilyId: string;
  configurationId: string;
  trialId: string;
  foldId: string;
  partition: HistoricalFoldPartition;
  strategyId: string;
  strategyVersion: string;
  profileId?: string;
  profileVersion?: string;
  parameterHash: string;
  geometryPolicyId: string;
  geometryPolicyVersion: string;
  sessionPolicyId: string;
  datasetId: string;
  datasetCertificateId: string;
  datasetChecksum: string;
  sourceFingerprint: string;
  proxyNotice: "Historical source is USTECH proxy research data for MNQ-style research. It is not CME MNQ futures truth.";
  costModelId: string;
  fillModelId: string;
  randomSeed?: number;
  runInterval: HistoricalFoldInterval;
  classification: HistoricalFoldRunnerClassification;
  counts: {
    evaluated: number;
    // Unique geometry-backed candidate identities, not diagnostic evaluations.
    candidates: number;
    geometryComplete: number;
    sourceBlocked: number;
    belowRR: number;
    entryMissed: number;
    entryNotRetraced: number;
    targetConsumed: number;
    expired: number;
    eligible: number;
    fillAttempted: number;
    fills: number;
    completedTrades: number;
  };
  metrics: {
    wins: number;
    losses: number;
    unresolved: number;
    grossRealizedR: number;
    netRealizedR: number;
    averageNetR: number | null;
    winRate: number | null;
  };
  detections: HistoricalFoldDetectionRecord[];
  outcomes: CanonicalBt2FoldOutcome[];
  geometryEnvelopes: CanonicalHistoricalGeometryEnvelope[];
  researchValidated: false;
  authority: {
    executionAuthority: "none";
    brokerAuthority: "none";
    readinessOverrideAuthority: "none";
    canPromote: false;
  };
}

export interface RunCanonicalHistoricalFoldInput {
  fold: HistoricalFoldDefinition;
  configurationId: string;
  adapter: CanonicalHistoricalFoldAdapter;
  dataset: HistoricalFoldDatasetIdentity;
  candlesByTimeframe: Readonly<Partial<Record<Timeframe, readonly Candle[]>>>;
  primaryTimeframe: Timeframe;
  evaluationTimes?: readonly string[];
  costModelId: string;
  fillModelId: string;
  randomSeed?: number;
  tickSize: number;
  spreadTicks: number;
  slippageTicks: number;
  commissionTicks: number;
  maxBarsToResolveTrade: number;
  narrativeAt?: (asOf: string) => IctHierarchicalNarrative | undefined;
  resumeFrom?: HistoricalFoldCheckpoint;
  checkpointEvery?: number;
  onCheckpoint?: (checkpoint: HistoricalFoldCheckpoint) => void;
}
