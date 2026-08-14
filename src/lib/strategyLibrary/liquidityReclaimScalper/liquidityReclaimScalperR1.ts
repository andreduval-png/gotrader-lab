import { canonicalHash, canonicalSerialize } from "../../canonical/canonicalValueSerialization";
import { SIMULATION_AUTHORITY_NONE, SIMULATION_CAPABILITIES_DISABLED } from "../../backtestSimulation/simulationAuthority";
import { LRS_BASE_PARAMETERS, buildLrsParameterHash, validateLrsParameters } from "./liquidityReclaimScalperParameters";
import { LRS_PROFILE_ID, LRS_STRATEGY_ID, type LrsParameters } from "./liquidityReclaimScalperTypes";

export const LRS_R1_PARAMETER_SCHEMA_VERSION = "gotrader-lrs-r1-parameter-schema-v1" as const;
export const LRS_R1_EXPERIMENT_FAMILY_VERSION = "gotrader-lrs-r1-experiment-family-v1" as const;
export const LRS_R1_SAMPLING_PLAN_VERSION = "gotrader-lrs-r1-sampling-plan-v1" as const;
export const LRS_R1_MAX_TRIAL_BUDGET = 128 as const;

type ParameterName = keyof LrsParameters;
type SweepAuthorization = "authorized" | "conditional" | "frozen_not_implemented";
export interface LrsR1ParameterDimension {
  readonly name: ParameterName;
  readonly source: "liquidityReclaimScalperParameters";
  readonly valueType: "enum" | "number" | "nullable_number" | "boolean" | "string" | "nullable_string";
  readonly allowedValues: readonly unknown[];
  readonly distribution: "categorical_uniform" | "ordered_discrete_uniform" | "fixed";
  readonly resolution: string;
  readonly defaultValue: unknown;
  readonly frozen: boolean;
  readonly causal: true;
  readonly identityBearing: true;
  readonly sweepAuthorization: SweepAuthorization;
  readonly condition?: string;
  readonly reason: string;
}

const dimension = (input: LrsR1ParameterDimension) => Object.freeze(input);
const fixed = (name: ParameterName, valueType: LrsR1ParameterDimension["valueType"], reason: string) => dimension({
  name, source: "liquidityReclaimScalperParameters", valueType, allowedValues: Object.freeze([LRS_BASE_PARAMETERS[name]]),
  distribution: "fixed", resolution: "exact", defaultValue: LRS_BASE_PARAMETERS[name], frozen: true, causal: true,
  identityBearing: true, sweepAuthorization: "frozen_not_implemented", reason
});
const sweep = (name: ParameterName, valueType: LrsR1ParameterDimension["valueType"], values: readonly unknown[],
  authorization: Extract<SweepAuthorization, "authorized" | "conditional">, condition: string | undefined, reason: string) => dimension({
  name, source: "liquidityReclaimScalperParameters", valueType, allowedValues: Object.freeze([...values]),
  distribution: valueType === "enum" ? "categorical_uniform" : "ordered_discrete_uniform", resolution: "explicit_values_only",
  defaultValue: LRS_BASE_PARAMETERS[name], frozen: false, causal: true, identityBearing: true,
  sweepAuthorization: authorization, ...(condition ? { condition } : {}), reason
});

export const LRS_R1_PARAMETER_SCHEMA: readonly Readonly<LrsR1ParameterDimension>[] = Object.freeze([
  fixed("contextTimeframe", "string", "The certified fact pipeline is frozen to 15m context."),
  fixed("structureTimeframe", "string", "The certified fact pipeline is frozen to 5m structure."),
  fixed("executionTimeframe", "string", "BT2 execution evidence is frozen to native 1m candles."),
  fixed("liquidityTargetType", "enum", "The detector does not yet distinguish target-type filtering."),
  fixed("raidLiquidityType", "enum", "The detector does not yet distinguish raid-liquidity filtering."),
  fixed("raidConfirmationMode", "enum", "The detector consumes canonical confirmed sweep facts without mode-specific filtering."),
  fixed("minimumRaidPenetration", "number", "Penetration units are not implemented by the detector."),
  fixed("displacementMode", "enum", "Only canonical displacement facts are implemented."),
  fixed("minimumDisplacement", "number", "Alternative displacement thresholds are not implemented."),
  fixed("ifvgRequired", "boolean", "The v1 strategy definition requires canonical IFVG evidence."),
  fixed("ifvgFreshnessRequirement", "enum", "Freshness variants are not yet enforced distinctly."),
  sweep("entryModel", "enum", ["IFVG_PROXIMAL_EDGE", "IFVG_MIDPOINT", "DISPLACEMENT_RETRACE", "CONFIRMATION_CLOSE"],
    "authorized", undefined, "All values have distinct causal entry geometry."),
  sweep("entryRetracementRatio", "number", [0.382, 0.5, 0.618], "conditional", "entryModel === DISPLACEMENT_RETRACE",
    "The value is active only for displacement-retracement entries."),
  sweep("stopModel", "enum", ["RAID_EXTREME", "RAID_EXTREME_BUFFER", "IFVG_INVALIDATION", "DISPLACEMENT_ORIGIN"],
    "authorized", undefined, "All values have distinct causal invalidation geometry."),
  sweep("stopBufferPoints", "number", [0, 0.25, 0.5, 1], "conditional", "stopModel === RAID_EXTREME_BUFFER",
    "Instrument price-point units are explicit and active only for buffered raid stops."),
  sweep("targetModel", "enum", ["EXTERNAL_LIQUIDITY", "STANDARDIZED_R"], "authorized", undefined,
    "Internal and structure labels are excluded because v1 does not implement distinct target selection for them."),
  sweep("standardizedRR", "nullable_number", [null, 1.5, 2, 2.5, 3, 4], "conditional", "targetModel === STANDARDIZED_R",
    "The value is active only for standardized-R targets."),
  fixed("sessionPolicy", "enum", "Session filtering is not implemented in the detector."),
  fixed("customSessionStart", "nullable_string", "Custom-session filtering is not implemented."),
  fixed("customSessionEnd", "nullable_string", "Custom-session filtering is not implemented."),
  fixed("biasModel", "enum", "Bias-model filtering is not implemented in the detector."),
  fixed("dealingRangeRequirement", "enum", "Dealing-range policy is not implemented as a detector gate."),
  sweep("minimumTheoreticalRR", "nullable_number", [null, 1.5, 2, 2.5, 3], "authorized", undefined,
    "The detector applies this causal geometry gate after constructing entry, stop, and target."),
  sweep("maximumSetupAgeBars", "number", [12, 24, 48, 72], "authorized", undefined,
    "The detector enforces this bounded causal sequence horizon."),
  fixed("maximumEntryWaitBars", "number", "The certified runner does not yet derive candidate expiry from this value.")
]);

const schemaNames = new Set(LRS_R1_PARAMETER_SCHEMA.map((item) => item.name));
if (schemaNames.size !== Object.keys(LRS_BASE_PARAMETERS).length || Object.keys(LRS_BASE_PARAMETERS).some((key) => !schemaNames.has(key as ParameterName))) {
  throw new Error("LRS R1 parameter schema does not cover the complete frozen parameter contract.");
}

const same = (left: unknown, right: unknown) => canonicalSerialize(left) === canonicalSerialize(right);
export function validateLrsR1TrialParameters(input: Readonly<LrsParameters>): Readonly<LrsParameters> {
  const parameters = validateLrsParameters(input);
  for (const descriptor of LRS_R1_PARAMETER_SCHEMA) {
    const value = parameters[descriptor.name];
    if (descriptor.frozen && !same(value, descriptor.defaultValue)) throw new Error(`LRS R1 parameter ${descriptor.name} is frozen.`);
    if (!descriptor.frozen && !descriptor.allowedValues.some((allowed) => same(allowed, value))) {
      throw new Error(`LRS R1 parameter ${descriptor.name} is outside the preregistered values.`);
    }
  }
  if (parameters.entryModel !== "DISPLACEMENT_RETRACE" && parameters.entryRetracementRatio !== LRS_BASE_PARAMETERS.entryRetracementRatio) {
    throw new Error("LRS R1 entryRetracementRatio must remain at baseline unless DISPLACEMENT_RETRACE is active.");
  }
  if (parameters.stopModel !== "RAID_EXTREME_BUFFER" && parameters.stopBufferPoints !== 0) {
    throw new Error("LRS R1 stopBufferPoints must be zero unless RAID_EXTREME_BUFFER is active.");
  }
  if (parameters.targetModel === "STANDARDIZED_R" && parameters.standardizedRR === null) {
    throw new Error("LRS R1 standardizedRR is required for STANDARDIZED_R.");
  }
  if (parameters.targetModel !== "STANDARDIZED_R" && parameters.standardizedRR !== null) {
    throw new Error("LRS R1 standardizedRR must be null unless STANDARDIZED_R is active.");
  }
  return Object.freeze({ ...parameters });
}

export interface LrsR1FamilyInput {
  readonly codeCommit: string;
  readonly baselineAcceptanceId: string;
  readonly baselineReportId: string;
  readonly baselineLedgerSealId: string;
  readonly datasetCertificateId: string;
  readonly datasetId: string;
  readonly sourceFingerprint: string;
  readonly startUtc: string;
  readonly endUtc: string;
  readonly timePolicyId: string;
}

const HASH = /^sha256:[0-9a-f]{40,64}$/;
const requireHash = (value: string, label: string) => { if (!HASH.test(value)) throw new Error(`LRS R1 ${label} is not an integrity identity.`); };
export async function buildLrsR1Preregistration(input: Readonly<LrsR1FamilyInput>) {
  for (const [label, value] of Object.entries(input)) {
    if (label.endsWith("Id") || label.endsWith("Fingerprint")) requireHash(value, label);
  }
  if (!/^[0-9a-f]{40}$/.test(input.codeCommit)) throw new Error("LRS R1 codeCommit must be an exact Git commit.");
  if (input.startUtc !== "2024-08-01T00:00:00.000Z" || input.endUtc !== "2026-08-01T00:00:00.000Z") {
    throw new Error("LRS R1 certified range is not the accepted two-year half-open interval.");
  }
  const baseParameterHash = await buildLrsParameterHash(LRS_BASE_PARAMETERS);
  const parameterSchemaId = await canonicalHash({ schemaVersion: LRS_R1_PARAMETER_SCHEMA_VERSION, dimensions: LRS_R1_PARAMETER_SCHEMA });
  const familyCore = Object.freeze({ schemaVersion: LRS_R1_EXPERIMENT_FAMILY_VERSION, strategyId: LRS_STRATEGY_ID,
    profileId: LRS_PROFILE_ID, baseParameterHash, parameterSchemaId, baselineAcceptanceId: input.baselineAcceptanceId,
    baselineReportId: input.baselineReportId, baselineLedgerSealId: input.baselineLedgerSealId,
    datasetCertificateId: input.datasetCertificateId, datasetId: input.datasetId, sourceFingerprint: input.sourceFingerprint,
    startUtc: input.startUtc, endUtc: input.endUtc, timePolicyId: input.timePolicyId, codeCommit: input.codeCommit,
    geometryPolicy: "native_lrs_v1", costPolicy: "bt2_stage2_observed_spread_v1",
    intrabarPolicy: "conservative_stop_first_v1", warmupPolicy: "certified_native_and_derived_context_v1",
    retentionPolicy: "retain_every_attempt_and_terminal_disposition_v1", nullFamily: "pending_later_r1_stage",
    coldInstrumentFamily: "pending_later_r1_stage", holdoutLifecycle: "sealed_not_consumed",
    researchValidated: false as const, productionAdoptionAllowed: false as const,
    authority: SIMULATION_AUTHORITY_NONE, capabilities: SIMULATION_CAPABILITIES_DISABLED });
  const experimentFamilyId = await canonicalHash(familyCore);
  const samplingCore = Object.freeze({ schemaVersion: LRS_R1_SAMPLING_PLAN_VERSION, experimentFamilyId,
    method: "halton_low_discrepancy_v1", seed: 1729, sequenceSkip: 64, trialBudget: LRS_R1_MAX_TRIAL_BUDGET,
    stoppingRule: "exact_fixed_budget_no_adaptive_extension", duplicatePolicy: "coalesce_identical_parameter_hash",
    checkpointPolicy: "atomic_every_completed_trial", trialLedgerPolicy: "append_only_all_dispositions",
    resourcePolicy: Object.freeze({ maximumConcurrentTrials: 1, maximumRssBytes: 1_073_741_824, maximumGovernedStorageBytes: 134_217_728 }),
    executionAuthorized: false as const, status: "preregistered_not_executable" as const });
  return Object.freeze({ parameterSchemaId, experimentFamily: Object.freeze({ ...familyCore, experimentFamilyId }),
    samplingPlan: Object.freeze({ ...samplingCore, samplingPlanId: await canonicalHash(samplingCore) }) });
}
