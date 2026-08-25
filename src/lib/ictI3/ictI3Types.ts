import type { IctSmtSignal } from "@/lib/ict-strategy-suite/ictIndexSmtTypes";
import type { IctI2DatasetIdentity, IctI2NarrativeContext, IctI2StateTransition } from "@/lib/ictI2/ictI2Types";
import type {
  CanonicalIctAuthority,
  CanonicalIctFact,
  CanonicalPdArrayType
} from "@/lib/ictCanonical/canonicalIctTypes";
import type { CanonicalTradeGeometry } from "@/lib/tradeGeometry";
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
  | "DELIVERY_TRANSITION_FORMING"
  | "DELIVERY_TRANSITION_CONFIRMED"
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
  transitionPolicy: "ERL_TO_IRL_DELIVERY";
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
  narrative: IctI2NarrativeContext;
  smt?: Pick<IctSmtSignal, "divergenceType" | "confirmsCandidate" | "rejectsCandidate" | "reason">;
  dataset?: IctI2DatasetIdentity;
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
  context: MmxmDeliveryContext;
  supportingFactIds: readonly string[];
  transitions: readonly IctI2StateTransition<MmxmPhase>[];
  geometry?: CanonicalTradeGeometry;
  blockers: readonly string[];
  warnings: readonly string[];
  authority: CanonicalIctAuthority;
  researchValidated: false;
  productionAdoptionAllowed: false;
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
  researchValidated: false;
}
