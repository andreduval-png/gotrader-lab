import { canonicalHash, canonicalSerialize } from "../../canonical/canonicalValueSerialization";
import { SIMULATION_AUTHORITY_NONE, SIMULATION_CAPABILITIES_DISABLED } from "../../backtestSimulation/simulationAuthority";
import type { SimulationStorageAdapter } from "../../backtestSimulation/simulationRepository";
import { LRS_BASE_PARAMETERS, buildLrsParameterHash } from "./liquidityReclaimScalperParameters";
import { LRS_R1_MAX_TRIAL_BUDGET, validateLrsR1TrialParameters } from "./liquidityReclaimScalperR1";
import type { LrsParameters } from "./liquidityReclaimScalperTypes";

export const LRS_R1_TRIAL_SCHEMA_VERSION = "gotrader-lrs-r1-trial-definition-v1" as const;
export const LRS_R1_EVENT_SCHEMA_VERSION = "gotrader-lrs-r1-trial-event-v1" as const;
export const LRS_R1_CHECKPOINT_SCHEMA_VERSION = "gotrader-lrs-r1-trial-checkpoint-v1" as const;
export const LRS_R1_ACCEPTED_PARAMETER_SCHEMA_ID = "sha256:dcb5ca7c7d181a81a8d347208d703224576ae3a26ed7b7ccaae4488c0dbcf137" as const;
export const LRS_R1_ACCEPTED_EXPERIMENT_FAMILY_ID = "sha256:e89903741561b76b56adc5feac12b311d7154036e7dff9f4c9cbf75afd405fed" as const;
export const LRS_R1_ACCEPTED_SAMPLING_PLAN_ID = "sha256:2218b36fae572a2411c35da3fae6788090d4b58a452ed1a9a5b2df65edab6476" as const;
export const LRS_R1_ACCEPTED_DATASET_ID = "sha256:aee24dc3d7e95759c0a58039c9a97985a63dd8014dd3ab9d9e843badeb09640d" as const;
export const LRS_R1_ACCEPTED_SOURCE_FINGERPRINT = "sha256:e164236affb51072322ce78bf297c03b3c403243e206a685b917792ac6db07bd" as const;
export const LRS_R1_GENERATOR_VERSION = "halton_low_discrepancy_v1" as const;
export const LRS_R1_SEED = 1729 as const;
export const LRS_R1_SEQUENCE_SKIP = 64 as const;

const primes = Object.freeze([2, 3, 5, 7, 11, 13, 17, 19]);
const choices = Object.freeze({
  entryModel: Object.freeze(["IFVG_PROXIMAL_EDGE", "IFVG_MIDPOINT", "DISPLACEMENT_RETRACE", "CONFIRMATION_CLOSE"] as const),
  entryRetracementRatio: Object.freeze([0.382, 0.5, 0.618] as const),
  stopModel: Object.freeze(["RAID_EXTREME", "RAID_EXTREME_BUFFER", "IFVG_INVALIDATION", "DISPLACEMENT_ORIGIN"] as const),
  stopBufferPoints: Object.freeze([0, 0.25, 0.5, 1] as const),
  targetModel: Object.freeze(["EXTERNAL_LIQUIDITY", "STANDARDIZED_R"] as const),
  standardizedRR: Object.freeze([1.5, 2, 2.5, 3, 4] as const),
  minimumTheoreticalRR: Object.freeze([null, 1.5, 2, 2.5, 3] as const),
  maximumSetupAgeBars: Object.freeze([12, 24, 48, 72] as const)
});

const radicalInverse = (index: number, base: number) => {
  let value = 0; let fraction = 1 / base; let remaining = index;
  while (remaining > 0) { value += fraction * (remaining % base); remaining = Math.floor(remaining / base); fraction /= base; }
  return value;
};
const choose = <T>(values: readonly T[], unit: number) => values[Math.min(values.length - 1, Math.floor(unit * values.length))];

export interface LrsR1TrialDefinition {
  readonly schemaVersion: typeof LRS_R1_TRIAL_SCHEMA_VERSION;
  readonly trialId: string;
  readonly ordinal: number;
  readonly sampleIndex: number;
  readonly parameterHash: string;
  readonly parameters: Readonly<LrsParameters>;
  readonly initialDisposition: "planned_unique" | "coalesced_duplicate";
  readonly duplicateOfTrialId?: string;
  readonly experimentFamilyId: typeof LRS_R1_ACCEPTED_EXPERIMENT_FAMILY_ID;
  readonly samplingPlanId: typeof LRS_R1_ACCEPTED_SAMPLING_PLAN_ID;
  readonly datasetId: typeof LRS_R1_ACCEPTED_DATASET_ID;
  readonly sourceFingerprint: typeof LRS_R1_ACCEPTED_SOURCE_FINGERPRINT;
  readonly authority: typeof SIMULATION_AUTHORITY_NONE;
  readonly capabilities: typeof SIMULATION_CAPABILITIES_DISABLED;
}

const parametersForOrdinal = (ordinal: number) => {
  if (!Number.isInteger(ordinal) || ordinal < 0 || ordinal >= LRS_R1_MAX_TRIAL_BUDGET) throw new Error("LRS R1 trial ordinal is outside the fixed budget.");
  const sampleIndex = LRS_R1_SEED + LRS_R1_SEQUENCE_SKIP + ordinal + 1;
  const unit = primes.map((prime) => radicalInverse(sampleIndex, prime));
  const entryModel = choose(choices.entryModel, unit[0]);
  const stopModel = choose(choices.stopModel, unit[2]);
  const targetModel = choose(choices.targetModel, unit[4]);
  return { sampleIndex, parameters: validateLrsR1TrialParameters({ ...LRS_BASE_PARAMETERS,
    entryModel, entryRetracementRatio: entryModel === "DISPLACEMENT_RETRACE" ? choose(choices.entryRetracementRatio, unit[1]) : 0.5,
    stopModel, stopBufferPoints: stopModel === "RAID_EXTREME_BUFFER" ? choose(choices.stopBufferPoints, unit[3]) : 0,
    targetModel, standardizedRR: targetModel === "STANDARDIZED_R" ? choose(choices.standardizedRR, unit[5]) : null,
    minimumTheoreticalRR: choose(choices.minimumTheoreticalRR, unit[6]), maximumSetupAgeBars: choose(choices.maximumSetupAgeBars, unit[7]) }) };
};

export async function buildLrsR1TrialDefinitions(): Promise<readonly Readonly<LrsR1TrialDefinition>[]> {
  const definitions: LrsR1TrialDefinition[] = []; const firstByParameterHash = new Map<string, string>();
  for (let ordinal = 0; ordinal < LRS_R1_MAX_TRIAL_BUDGET; ordinal += 1) {
    const { sampleIndex, parameters } = parametersForOrdinal(ordinal); const parameterHash = await buildLrsParameterHash(parameters);
    const duplicateOfTrialId = firstByParameterHash.get(parameterHash);
    const core = Object.freeze({ schemaVersion: LRS_R1_TRIAL_SCHEMA_VERSION, ordinal, sampleIndex, parameterHash, parameters,
      initialDisposition: duplicateOfTrialId ? "coalesced_duplicate" as const : "planned_unique" as const,
      ...(duplicateOfTrialId ? { duplicateOfTrialId } : {}), experimentFamilyId: LRS_R1_ACCEPTED_EXPERIMENT_FAMILY_ID,
      samplingPlanId: LRS_R1_ACCEPTED_SAMPLING_PLAN_ID, datasetId: LRS_R1_ACCEPTED_DATASET_ID,
      sourceFingerprint: LRS_R1_ACCEPTED_SOURCE_FINGERPRINT, authority: SIMULATION_AUTHORITY_NONE,
      capabilities: SIMULATION_CAPABILITIES_DISABLED });
    const trial = Object.freeze({ ...core, trialId: await canonicalHash(core) }); definitions.push(trial);
    if (!duplicateOfTrialId) firstByParameterHash.set(parameterHash, trial.trialId);
  }
  return Object.freeze(definitions);
}

export type LrsR1TrialDisposition = "attempted" | "rejected" | "canceled" | "failed" | "completed";
export interface LrsR1TrialEventInput {
  readonly trialId: string; readonly sequence: number; readonly disposition: LrsR1TrialDisposition;
  readonly recordedAtUtc: string; readonly reasonCodes: readonly string[]; readonly evidenceIds: readonly string[];
  readonly previousEventId?: string;
}
export async function buildLrsR1TrialEvent(input: Readonly<LrsR1TrialEventInput>) {
  if (!/^sha256:[0-9a-f]{64}$/.test(input.trialId)) throw new Error("LRS R1 trial event has an invalid trial identity.");
  if (!Number.isInteger(input.sequence) || input.sequence < 0) throw new Error("LRS R1 trial event sequence is invalid.");
  if (!Number.isFinite(Date.parse(input.recordedAtUtc))) throw new Error("LRS R1 trial event time is invalid.");
  if (input.previousEventId !== undefined && !/^sha256:[0-9a-f]{64}$/.test(input.previousEventId)) throw new Error("LRS R1 previous event identity is invalid.");
  const core = Object.freeze({ schemaVersion: LRS_R1_EVENT_SCHEMA_VERSION, trialId: input.trialId, sequence: input.sequence,
    disposition: input.disposition, recordedAtUtc: input.recordedAtUtc, reasonCodes: Object.freeze([...new Set(input.reasonCodes)].sort()),
    evidenceIds: Object.freeze([...new Set(input.evidenceIds)].sort()), ...(input.previousEventId ? { previousEventId: input.previousEventId } : {}),
    experimentFamilyId: LRS_R1_ACCEPTED_EXPERIMENT_FAMILY_ID, samplingPlanId: LRS_R1_ACCEPTED_SAMPLING_PLAN_ID,
    authority: SIMULATION_AUTHORITY_NONE, capabilities: SIMULATION_CAPABILITIES_DISABLED });
  return Object.freeze({ ...core, eventId: await canonicalHash(core) });
}

export interface LrsR1CheckpointInput {
  readonly nextTrialOrdinal: number; readonly orderedTrialIds: readonly string[]; readonly orderedEventIds: readonly string[];
  readonly controllerCommit: string;
}
export async function buildLrsR1Checkpoint(input: Readonly<LrsR1CheckpointInput>) {
  if (!Number.isInteger(input.nextTrialOrdinal) || input.nextTrialOrdinal < 0 || input.nextTrialOrdinal > LRS_R1_MAX_TRIAL_BUDGET) throw new Error("LRS R1 checkpoint ordinal is outside the fixed budget.");
  if (input.orderedTrialIds.length !== input.nextTrialOrdinal || new Set(input.orderedTrialIds).size !== input.orderedTrialIds.length) throw new Error("LRS R1 checkpoint trial lineage is inconsistent.");
  if (new Set(input.orderedEventIds).size !== input.orderedEventIds.length) throw new Error("LRS R1 checkpoint event lineage contains duplicates.");
  if (!/^[0-9a-f]{40}$/.test(input.controllerCommit)) throw new Error("LRS R1 checkpoint controller commit is invalid.");
  const core = Object.freeze({ schemaVersion: LRS_R1_CHECKPOINT_SCHEMA_VERSION, parameterSchemaId: LRS_R1_ACCEPTED_PARAMETER_SCHEMA_ID,
    experimentFamilyId: LRS_R1_ACCEPTED_EXPERIMENT_FAMILY_ID, samplingPlanId: LRS_R1_ACCEPTED_SAMPLING_PLAN_ID,
    datasetId: LRS_R1_ACCEPTED_DATASET_ID, sourceFingerprint: LRS_R1_ACCEPTED_SOURCE_FINGERPRINT,
    generatorVersion: LRS_R1_GENERATOR_VERSION, seed: LRS_R1_SEED, sequenceSkip: LRS_R1_SEQUENCE_SKIP,
    trialBudget: LRS_R1_MAX_TRIAL_BUDGET, nextTrialOrdinal: input.nextTrialOrdinal,
    orderedTrialIds: Object.freeze([...input.orderedTrialIds]), orderedEventIds: Object.freeze([...input.orderedEventIds]),
    controllerCommit: input.controllerCommit, executionAuthorized: false as const, authority: SIMULATION_AUTHORITY_NONE,
    capabilities: SIMULATION_CAPABILITIES_DISABLED });
  return Object.freeze({ ...core, checkpointId: await canonicalHash(core) });
}

export async function validateLrsR1Checkpoint(checkpoint: Readonly<Record<string, unknown>>) {
  const { checkpointId, ...core } = checkpoint;
  if (checkpoint.schemaVersion !== LRS_R1_CHECKPOINT_SCHEMA_VERSION || checkpoint.parameterSchemaId !== LRS_R1_ACCEPTED_PARAMETER_SCHEMA_ID ||
      checkpoint.experimentFamilyId !== LRS_R1_ACCEPTED_EXPERIMENT_FAMILY_ID || checkpoint.samplingPlanId !== LRS_R1_ACCEPTED_SAMPLING_PLAN_ID ||
      checkpoint.datasetId !== LRS_R1_ACCEPTED_DATASET_ID || checkpoint.sourceFingerprint !== LRS_R1_ACCEPTED_SOURCE_FINGERPRINT ||
      checkpoint.executionAuthorized !== false || !checkpointId || await canonicalHash(core) !== checkpointId) {
    throw new Error("LRS R1 checkpoint identity or integrity validation failed.");
  }
  return checkpoint;
}

const artifactPath = (kind: string, id: string) => `${kind}/${id.replace(":", "_")}.json`;
export class LrsR1TrialControlRepository {
  constructor(private readonly storage: Readonly<SimulationStorageAdapter>) {}
  private async writeImmutable(kind: string, id: string, artifact: Readonly<Record<string, unknown>>) {
    const path = artifactPath(kind, id); const serialized = `${canonicalSerialize(artifact)}\n`; const existing = await this.storage.readText(path);
    if (existing !== undefined && existing !== serialized) throw new Error(`Immutable LRS R1 artifact conflict: ${path}`);
    if (existing === undefined) await this.storage.writeTextAtomic(path, serialized);
  }
  writeTrial(trial: Readonly<LrsR1TrialDefinition>) { return this.writeImmutable("trials", trial.trialId, trial as unknown as Readonly<Record<string, unknown>>); }
  writeEvent(event: Readonly<Record<string, unknown>> & { readonly eventId: string }) { return this.writeImmutable("events", event.eventId, event); }
  async writeCheckpoint(input: Readonly<LrsR1CheckpointInput>) { const checkpoint = await buildLrsR1Checkpoint(input);
    await this.storage.writeTextAtomic("checkpoints/current.json", `${canonicalSerialize(checkpoint)}\n`); return checkpoint; }
  async readCheckpoint() { const text = await this.storage.readText("checkpoints/current.json");
    return text === undefined ? undefined : validateLrsR1Checkpoint(JSON.parse(text) as Record<string, unknown>); }
}
