import type { IctSmtSignal } from "@/lib/ict-strategy-suite/ictIndexSmtTypes";
import type { IctCoreStateTransition, IctHierarchicalNarrative } from "@/lib/ictI2/ictI2Types";
import type {
  CanonicalIctAuthority,
  CanonicalIctFact,
  CanonicalPdArrayType
} from "@/lib/ictCanonical/canonicalIctTypes";
import type { CanonicalTradeGeometry, StrategyGeometryIntent } from "@/lib/tradeGeometry";
import type { Candle, FuturesSymbol, Timeframe } from "@/lib/types";

export type IctI3RuleClassification =
  | "SOURCE_DEFINED"
  | "CANONICAL_GOTRADER_RULE"
  | "RESEARCH_PARAMETER"
  | "UNRESOLVED";

export interface IctI3SourceRule {
  ruleId: string;
  classification: IctI3RuleClassification;
  behavior: string;
  material: boolean;
  resolution: string;
}

export type MarketMakerDirection = "BULLISH" | "BEARISH";

export type MmxmDeliveryDirection =
  | "BULLISH_DELIVERY"
  | "BEARISH_DELIVERY"
  | "TRANSITIONING_BULLISH"
  | "TRANSITIONING_BEARISH"
  | "BALANCED"
  | "UNRESOLVED";

export type MmxmPhase =
  | "SEARCHING"
  | "RANGE_CONTEXT_ESTABLISHED"
  | "LIQUIDITY_ENGINEERING_FORMING"
  | "LIQUIDITY_EVENT_CONFIRMED"
  | "DELIVERY_SEQUENCE_FORMING"
  | "DELIVERY_SEQUENCE_CONFIRMED"
  | "PD_ARRAY_REPRICE_FORMING"
  | "ENTRY_ELIGIBLE"
  | "ACTIVE_DELIVERY"
  | "OBJECTIVE_REACHED"
  | "INVALIDATED"
  | "ENTRY_MISSED"
  | "SETUP_EXPIRED"
  | "SOURCE_BLOCKED"
  | "NO_VALID_TARGET"
  | "TARGET_CONSUMED"
  | "GEOMETRY_NON_ACTIONABLE";

export interface MmxmDeliveryContext {
  frameworkId: "gotrader.ict.i3.mmxm-delivery-framework.v1";
  classification: "framework_context";
  phase: MmxmPhase;
  deliveryDirection: MmxmDeliveryDirection;
  dealingRangeId?: string;
  liquidityEventId?: string;
  liquidityClass?: string;
  liquidityOwnerTimeframe?: Timeframe;
  liquidityConsumedAt?: string;
  sequenceId?: string;
  displacementId?: string;
  transitionId?: string;
  transitionType?: "IRL_TO_ERL_DELIVERY" | "ERL_TO_IRL_DELIVERY";
  pdArrayId?: string;
  objectiveLiquidityId?: string;
  supportingFactIds: readonly string[];
  blockers: readonly string[];
  authority: CanonicalIctAuthority;
}

export interface MarketMakerModelParameters {
  structuralTimeframe: "1h" | "4h";
  setupTimeframe: "5m" | "15m";
  executionTimeframe: "1m" | "5m";
  dealingRangePolicy: "ACTIVE_CANONICAL_RANGE";
  premiumDiscountPolicy: "REQUIRED" | "PREFERRED" | "DISABLED";
  displacementPolicy: "REQUIRED";
  mssPolicy: "OPTIONAL" | "REQUIRED";
  eligiblePdArrayTypes: readonly CanonicalPdArrayType[];
  entryMode: "PD_ARRAY_MIDPOINT" | "PD_ARRAY_PROXIMAL";
  stopMode: "LIQUIDITY_ENGINEERING_EXTREME";
  targetMode: "OPPOSITE_EXTERNAL_LIQUIDITY";
  smtPolicy: "OPTIONAL";
  opposingSmtBehavior: "BLOCK" | "WARN";
  maximumSetupAgeMinutes: number;
  minimumRR: number;
}

export interface IctI3DetectionInput {
  facts: readonly CanonicalIctFact[];
  candlesByTimeframe: Readonly<Partial<Record<Timeframe, readonly Candle[]>>>;
  asOf: string;
  sourceFingerprint: string;
  narrative: IctHierarchicalNarrative;
  smt?: Pick<IctSmtSignal, "divergenceType" | "confirmsCandidate" | "rejectsCandidate" | "reason">;
  dataset?: {
    datasetCertificateId: string;
    datasetId: string;
    datasetChecksum: string;
  };
}

export interface MarketMakerModelCandidate {
  candidateId: string;
  strategyId: "ict_market_maker_buy_model_v1" | "ict_market_maker_sell_model_v1";
  strategyVersion: "1.0.0";
  profileId: "ict_mmbm_base_research_v1" | "ict_mmsm_base_research_v1";
  parameterHash: string;
  sourceFingerprint: string;
  datasetCertificateId?: string;
  symbol?: FuturesSymbol;
  timeframe?: Timeframe;
  marketTimestamp: string;
  direction: "long" | "short";
  state: MmxmPhase;
  deliverySequence: MarketMakerDeliverySequence;
  context: MmxmDeliveryContext;
  supportingFactIds: readonly string[];
  transitions: readonly IctCoreStateTransition<MmxmPhase>[];
  geometry?: CanonicalTradeGeometry;
  geometryIntent?: StrategyGeometryIntent;
  blockers: readonly string[];
  warnings: readonly string[];
  authority: CanonicalIctAuthority;
  researchValidated: false;
  productionAdoptionAllowed: false;
}

export interface MarketMakerCandidateCollection {
  version: "gotrader.ict-market-maker-candidates.v1";
  generatedAt: string;
  sourceFingerprint: string;
  frameworks: readonly MmxmDeliveryContext[];
  candidates: readonly MarketMakerModelCandidate[];
  researchValidated: false;
  authority: CanonicalIctAuthority;
}

export interface IctI3CurrentReadProjection {
  strategyId: MarketMakerModelCandidate["strategyId"] | "mmxm_delivery_framework_v1";
  state: string;
  headline: string;
  detail: string;
  dealingRangeId?: string;
  liquidityEventId?: string;
  transitionId?: string;
  pdArrayId?: string;
  objectiveLiquidityId?: string;
  geometry?: CanonicalTradeGeometry;
  blockers: readonly string[];
  authority: CanonicalIctAuthority;
  researchValidated: false;
}

export interface IctI3RegistryEntry {
  modelId: string;
  version: "1.0.0";
  displayName: string;
  classification: "FRAMEWORK_CONTEXT" | "ACTIVE_RESEARCH";
  executable: boolean;
  runtimeClassification: "FRAMEWORK_CONTEXT_ONLY" | "LIVE_FACT_COMPLETENESS_UNVERIFIED" | "LIVE_FACT_COMPLETE_EXECUTABLE_OWNER";
  researchValidated: false;
}

export type MarketMakerDeliverySequenceStatus =
  | "QUALIFIED"
  | "WAITING_FOR_RANGE"
  | "PD_LOCATION_INVALID"
  | "WAITING_FOR_LIQUIDITY_EVENT"
  | "WAITING_FOR_DISPLACEMENT"
  | "WAITING_FOR_PD_ARRAY"
  | "PD_ARRAY_RANGE_INVALID"
  | "OBJECTIVE_UNAVAILABLE"
  | "SEQUENCE_ORDER_INVALID"
  | "SOURCE_BLOCKED";

export interface MarketMakerDeliverySequence {
  schemaId: "gotrader.ict.i3.market-maker-delivery-sequence";
  schemaVersion: "1.0.0";
  sequenceId: string;
  strategyFamily: "MARKET_MAKER";
  direction: MarketMakerDirection;
  sourceFingerprint: string;
  dealingRangeId?: string;
  pdLocationFactId?: string;
  engineeringLiquidityId?: string;
  displacementId?: string;
  pdArrayId?: string;
  objectiveLiquidityId?: string;
  orderedTimestamps: {
    rangeValidFrom?: string;
    pdLocationValidFrom?: string;
    liquidityConsumedAt?: string;
    displacementValidFrom?: string;
    pdArrayValidFrom?: string;
    objectiveValidFrom?: string;
  };
  status: MarketMakerDeliverySequenceStatus;
  blockers: readonly string[];
  supportingFactIds: readonly string[];
  asOf: string;
  policyId: "gotrader.ict.i3.market-maker-delivery-sequence";
  policyVersion: "1.0.0";
}
