import { canonicalHash } from "../../canonical/canonicalValueSerialization";
import { LRS_PARAMETER_SCHEMA_VERSION, LRS_PROFILE_ID, LRS_STRATEGY_ID, type LrsParameters, type LrsProfile } from "./liquidityReclaimScalperTypes";

export const LRS_BASE_PARAMETERS: Readonly<LrsParameters> = Object.freeze({ contextTimeframe: "15m", structureTimeframe: "5m",
  executionTimeframe: "1m", liquidityTargetType: "SESSION_HIGH_OR_LOW", raidLiquidityType: "SESSION_LIQUIDITY",
  raidConfirmationMode: "WICK_THROUGH", minimumRaidPenetration: 0, displacementMode: "CANONICAL_DISPLACEMENT_FACT",
  minimumDisplacement: 0, ifvgRequired: true, ifvgFreshnessRequirement: "FRESH_OR_TOUCHED",
  entryModel: "IFVG_PROXIMAL_EDGE", entryRetracementRatio: 0.5, stopModel: "RAID_EXTREME", stopBufferPoints: 0,
  targetModel: "EXTERNAL_LIQUIDITY", standardizedRR: null, sessionPolicy: "NO_SESSION_FILTER",
  customSessionStart: null, customSessionEnd: null, biasModel: "LIQUIDITY_OBJECTIVE_ONLY",
  dealingRangeRequirement: "PREFERRED", minimumTheoreticalRR: null, maximumSetupAgeBars: 48, maximumEntryWaitBars: 12 });

const keys = new Set(Object.keys(LRS_BASE_PARAMETERS));
const allowed = (value: unknown, values: readonly string[], label: string) => { if (!values.includes(String(value))) throw new Error(`LRS parameter ${label} is unsupported.`); };
const bounded = (value: unknown, min: number, max: number, label: string) => { if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) throw new Error(`LRS parameter ${label} is outside [${min}, ${max}].`); };
export function validateLrsParameters(input: Readonly<LrsParameters>): Readonly<LrsParameters> {
  for (const key of Object.keys(input)) if (!keys.has(key)) throw new Error(`LRS parameter ${key} is unknown.`);
  for (const key of keys) if (!(key in input)) throw new Error(`LRS parameter ${key} is missing.`);
  for (const [key, value] of [["contextTimeframe", input.contextTimeframe], ["structureTimeframe", input.structureTimeframe], ["executionTimeframe", input.executionTimeframe]] as const)
    if (!/^(1m|5m|15m|1h|4h|1d|1w)$/.test(value)) throw new Error(`LRS parameter ${key} is not canonical.`);
  if (new Set([input.contextTimeframe, input.structureTimeframe, input.executionTimeframe]).size !== 3) throw new Error("LRS timeframes must be distinct.");
  allowed(input.liquidityTargetType, ["PRIOR_SIGNIFICANT_SWING", "EQUAL_HIGHS_OR_LOWS", "SESSION_HIGH_OR_LOW"], "liquidityTargetType");
  allowed(input.raidLiquidityType, ["LOCAL_SWING", "EQUAL_HIGH_LOW", "SESSION_LIQUIDITY"], "raidLiquidityType");
  allowed(input.raidConfirmationMode, ["WICK_THROUGH", "CLOSE_THROUGH", "MINIMUM_PENETRATION"], "raidConfirmationMode");
  allowed(input.displacementMode, ["BODY_RATIO", "RANGE_NORMALIZED", "ATR_NORMALIZED", "CANONICAL_DISPLACEMENT_FACT"], "displacementMode");
  allowed(input.ifvgFreshnessRequirement, ["FRESH", "FRESH_OR_TOUCHED", "ANY_CANONICAL_ACTIVE"], "ifvgFreshnessRequirement");
  allowed(input.entryModel, ["IFVG_PROXIMAL_EDGE", "IFVG_MIDPOINT", "DISPLACEMENT_RETRACE", "CONFIRMATION_CLOSE"], "entryModel");
  allowed(input.stopModel, ["RAID_EXTREME", "RAID_EXTREME_BUFFER", "IFVG_INVALIDATION", "DISPLACEMENT_ORIGIN"], "stopModel");
  allowed(input.targetModel, ["EXTERNAL_LIQUIDITY", "INTERNAL_LIQUIDITY", "STRUCTURE_TARGET", "STANDARDIZED_R"], "targetModel");
  allowed(input.sessionPolicy, ["NEW_YORK_AM", "NEW_YORK_PM", "LONDON", "CUSTOM_WINDOW", "NO_SESSION_FILTER"], "sessionPolicy");
  allowed(input.biasModel, ["NONE", "LIQUIDITY_OBJECTIVE_ONLY", "CANONICAL_HTF_BIAS"], "biasModel");
  allowed(input.dealingRangeRequirement, ["REQUIRED", "PREFERRED", "DISABLED"], "dealingRangeRequirement");
  bounded(input.minimumRaidPenetration, 0, 1000, "minimumRaidPenetration"); bounded(input.minimumDisplacement, 0, 100, "minimumDisplacement");
  bounded(input.entryRetracementRatio, 0, 1, "entryRetracementRatio"); bounded(input.stopBufferPoints, 0, 10000, "stopBufferPoints");
  bounded(input.maximumSetupAgeBars, 1, 10000, "maximumSetupAgeBars"); bounded(input.maximumEntryWaitBars, 1, input.maximumSetupAgeBars, "maximumEntryWaitBars");
  if (input.standardizedRR !== null) bounded(input.standardizedRR, 0.1, 100, "standardizedRR");
  if (input.minimumTheoreticalRR !== null) bounded(input.minimumTheoreticalRR, 0, 100, "minimumTheoreticalRR");
  if (input.targetModel === "STANDARDIZED_R" && input.standardizedRR === null) throw new Error("LRS standardizedRR is required for STANDARDIZED_R.");
  if (input.sessionPolicy === "CUSTOM_WINDOW" && (!/^\d{2}:\d{2}$/.test(input.customSessionStart ?? "") || !/^\d{2}:\d{2}$/.test(input.customSessionEnd ?? ""))) throw new Error("LRS custom session requires HH:MM boundaries.");
  if (input.sessionPolicy !== "CUSTOM_WINDOW" && (input.customSessionStart !== null || input.customSessionEnd !== null)) throw new Error("LRS custom session times require CUSTOM_WINDOW.");
  if (typeof input.ifvgRequired !== "boolean") throw new Error("LRS ifvgRequired must be boolean.");
  return Object.freeze({ ...input });
}
export const buildLrsParameterHash = (parameters: Readonly<LrsParameters>) => canonicalHash({ schemaVersion: LRS_PARAMETER_SCHEMA_VERSION, strategyId: LRS_STRATEGY_ID, parameters: validateLrsParameters(parameters) });
export async function buildLrsBaseProfile(): Promise<Readonly<LrsProfile>> { const parameterHash = await buildLrsParameterHash(LRS_BASE_PARAMETERS);
  const core = Object.freeze({ profileId: LRS_PROFILE_ID, profileVersion: "v1" as const, classification: "experimental" as const,
    status: "research_only" as const, parameters: LRS_BASE_PARAMETERS, parameterHash, researchValidated: false as const, productionAdoptionAllowed: false as const });
  return Object.freeze({ ...core, profileHash: await canonicalHash(core) }); }
