import type { AgentLayer, ICTConcept, ICTContext, MarketBias, ThesisInput } from "@/lib/types";
import type { MarketContext } from "@/lib/marketData";
import type { RegimeClassification } from "@/lib/regime";

export type InternalAgentId =
  | "ict-liquidity-agent"
  | "ict-structure-agent"
  | "grinch-htf-bias-agent"
  | "grinch-pd-array-hierarchy-agent"
  | "grinch-opening-price-equilibrium-agent"
  | "grinch-dealing-range-agent"
  | "grinch-market-cycle-agent"
  | "grinch-model-one-power-three-agent"
  | "grinch-reversal-profile-agent"
  | "grinch-consolidation-profile-agent"
  | "grinch-smt-intermarket-agent"
  | "grinch-time-price-alignment-agent"
  | "grinch-entry-confirmation-agent"
  | "session-timing-agent"
  | "risk-reward-agent"
  | "session-levels-agent"
  | "auction-volume-profile-agent"
  | "macro-event-risk-agent"
  | "composite-regime-agent"
  | "intermarket-confirmation-agent"
  | "positioning-gamma-agent"
  | "volatility-regime-agent"
  | "order-flow-agent"
  | "cio-agent";

export interface InternalAgentRunContext {
  input: ThesisInput;
  ictContext: ICTContext;
  marketContext: MarketContext;
  regimeClassification?: RegimeClassification;
}

export type InternalAgentEvidenceStatus = "verified" | "derived" | "limited" | "unavailable";

export type InternalAgentSynthesisRole = "vote" | "abstain" | "veto";

export interface InternalAgentRawOpinion {
  agentId: InternalAgentId;
  name: string;
  layer: AgentLayer;
  bias: MarketBias;
  confidence: number;
  weight: number;
  reasoning: string;
  supportingFactors: string[];
  warningFactors: string[];
  recommendation: string;
  ictTags: ICTConcept[];
}

export interface InternalAgentOpinion extends InternalAgentRawOpinion {
  configuredWeight: number;
  evidenceStatus: InternalAgentEvidenceStatus;
  synthesisRole: InternalAgentSynthesisRole;
  abstentionReason?: string;
}

export interface InternalAgentDefinition {
  agentId: Exclude<InternalAgentId, "cio-agent">;
  name: string;
  layer: AgentLayer;
  weight: number;
  run(context: InternalAgentRunContext): InternalAgentRawOpinion;
}

export interface CIOSynthesisResult {
  finalBias: MarketBias;
  confidence: number;
  thesisSummary: string;
  reasoningSummary: string;
  riskNotes: string;
  pricePlan?: {
    invalidationLevel: number;
    targetLiquidity: number;
    entryZone: [number, number];
    riskReward: number;
  };
  /** @deprecated Read pricePlan; absent means canonical price geometry is unavailable. */
  invalidationLevel?: number;
  /** @deprecated Read pricePlan; absent means canonical price geometry is unavailable. */
  targetLiquidity?: number;
  /** @deprecated Read pricePlan; absent means canonical price geometry is unavailable. */
  entryZone?: [number, number];
  /** @deprecated Read pricePlan; absent means canonical price geometry is unavailable. */
  riskReward?: number;
  activeAgentCount: number;
  abstainingAgentCount: number;
  evidenceCoverage: number;
  cioOpinion: InternalAgentOpinion;
}
