import type { SimulationAuthority } from "@/lib/backtestSimulation/simulationAuthority";
import type { SimulationCapabilities } from "@/lib/backtestSimulation/simulationTypes";

export const LRS_STRATEGY_ID = "liquidity_reclaim_scalper_v1" as const;
export const LRS_PROFILE_ID = "liquidity_reclaim_scalper_v1_base_research" as const;
export const LRS_STRATEGY_VERSION = "v1" as const;
export const LRS_PARAMETER_SCHEMA_VERSION = "gotrader-lrs-parameters-v1" as const;
export const LRS_CANDIDATE_SCHEMA_VERSION = "gotrader-lrs-candidate-v1" as const;

export type LrsDirection = "long" | "short";
export type LrsSetupState = "SEARCHING" | "LIQUIDITY_OBJECTIVE_IDENTIFIED" | "WAITING_FOR_RAID" |
  "RAID_CONFIRMED" | "DISPLACEMENT_CONFIRMED" | "IFVG_RECLAIMED" | "WAITING_FOR_ENTRY" |
  "ENTRY_ELIGIBLE" | "ACTIVE" | "TARGET_REACHED" | "INVALIDATED" | "NO_FILL" |
  "TARGET_CONSUMED" | "SESSION_EXPIRED" | "SETUP_EXPIRED" | "SOURCE_BLOCKED" | "CONTEXT_INVALIDATED";
export type LrsBlocker = "external_liquidity_missing" | "external_liquidity_consumed" | "raid_missing" |
  "raid_invalid" | "displacement_missing" | "displacement_wrong_direction" | "ifvg_missing" |
  "ifvg_not_reclaimed" | "ifvg_stale" | "entry_not_reached" | "entry_expired" |
  "structural_invalidation" | "session_expired" | "insufficient_context" | "source_blocked" |
  "dataset_unverified" | "geometry_invalid" | "minimum_rr_not_met";
export type LrsEntryModel = "IFVG_PROXIMAL_EDGE" | "IFVG_MIDPOINT" | "DISPLACEMENT_RETRACE" | "CONFIRMATION_CLOSE";
export type LrsStopModel = "RAID_EXTREME" | "RAID_EXTREME_BUFFER" | "IFVG_INVALIDATION" | "DISPLACEMENT_ORIGIN";
export type LrsTargetModel = "EXTERNAL_LIQUIDITY" | "INTERNAL_LIQUIDITY" | "STRUCTURE_TARGET" | "STANDARDIZED_R";
export type LrsSessionPolicy = "NEW_YORK_AM" | "NEW_YORK_PM" | "LONDON" | "CUSTOM_WINDOW" | "NO_SESSION_FILTER";

export interface LrsParameters {
  readonly contextTimeframe: string; readonly structureTimeframe: string; readonly executionTimeframe: string;
  readonly liquidityTargetType: "PRIOR_SIGNIFICANT_SWING" | "EQUAL_HIGHS_OR_LOWS" | "SESSION_HIGH_OR_LOW";
  readonly raidLiquidityType: "LOCAL_SWING" | "EQUAL_HIGH_LOW" | "SESSION_LIQUIDITY";
  readonly raidConfirmationMode: "WICK_THROUGH" | "CLOSE_THROUGH" | "MINIMUM_PENETRATION";
  readonly minimumRaidPenetration: number;
  readonly displacementMode: "BODY_RATIO" | "RANGE_NORMALIZED" | "ATR_NORMALIZED" | "CANONICAL_DISPLACEMENT_FACT";
  readonly minimumDisplacement: number; readonly ifvgRequired: boolean;
  readonly ifvgFreshnessRequirement: "FRESH" | "FRESH_OR_TOUCHED" | "ANY_CANONICAL_ACTIVE";
  readonly entryModel: LrsEntryModel; readonly entryRetracementRatio: number;
  readonly stopModel: LrsStopModel; readonly stopBufferPoints: number;
  readonly targetModel: LrsTargetModel; readonly standardizedRR: number | null;
  readonly sessionPolicy: LrsSessionPolicy; readonly customSessionStart: string | null; readonly customSessionEnd: string | null;
  readonly biasModel: "NONE" | "LIQUIDITY_OBJECTIVE_ONLY" | "CANONICAL_HTF_BIAS";
  readonly dealingRangeRequirement: "REQUIRED" | "PREFERRED" | "DISABLED";
  readonly minimumTheoreticalRR: number | null; readonly maximumSetupAgeBars: number; readonly maximumEntryWaitBars: number;
}

export interface LrsProfile {
  readonly profileId: typeof LRS_PROFILE_ID; readonly profileVersion: "v1"; readonly classification: "experimental";
  readonly status: "research_only"; readonly parameters: Readonly<LrsParameters>; readonly parameterHash: string;
  readonly profileHash: string; readonly researchValidated: false; readonly productionAdoptionAllowed: false;
}
export interface LrsTransition { readonly transitionId: string; readonly previousState: LrsSetupState; readonly nextState: LrsSetupState;
  readonly marketTime: string; readonly triggerFactIds: readonly string[]; readonly blockers: readonly LrsBlocker[]; }
export interface LrsCandidate {
  readonly schemaVersion: typeof LRS_CANDIDATE_SCHEMA_VERSION; readonly strategyId: typeof LRS_STRATEGY_ID;
  readonly strategyVersion: typeof LRS_STRATEGY_VERSION; readonly candidateId: string; readonly direction: LrsDirection;
  readonly state: LrsSetupState; readonly requestedSymbol: string; readonly brokerSymbol: string;
  readonly contextTimeframe: string; readonly structureTimeframe: string; readonly executionTimeframe: string;
  readonly triggerCandleId: string; readonly liquidityObjectiveId?: string; readonly raidEventId?: string;
  readonly displacementFactId?: string; readonly ifvgId?: string; readonly dealingRangeId?: string;
  readonly entryModel: LrsEntryModel; readonly entryPrice?: number; readonly stopModel: LrsStopModel;
  readonly stopPrice?: number; readonly targetModel: LrsTargetModel; readonly targetPrice?: number;
  readonly theoreticalRR?: number; readonly setupCreatedAt: string; readonly entryEligibleAt?: string;
  readonly expiresAt: string; readonly supportingFactIds: readonly string[]; readonly blockers: readonly LrsBlocker[];
  readonly transitions: readonly Readonly<LrsTransition>[]; readonly explanation: string; readonly profileId: typeof LRS_PROFILE_ID;
  readonly profileVersion: "v1"; readonly parameterHash: string; readonly sourceFingerprint: string;
  readonly datasetCertificateId: string; readonly authority: Readonly<SimulationAuthority>;
  readonly capabilities: Readonly<SimulationCapabilities>;
}
