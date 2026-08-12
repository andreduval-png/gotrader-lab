import { canonicalHash } from "../canonical/canonicalValueSerialization";
import {
  SIMULATION_AUTHORITY_NONE,
  SIMULATION_CAPABILITIES_DISABLED,
  assertSimulationAuthority
} from "./simulationAuthority";
import type {
  CanonicalOpportunity,
  CanonicalOpportunityCore,
  SimulationCheckpoint,
  SimulationCheckpointCore,
  SimulationCostModel,
  TradeLedgerSeal,
  TradeLedgerSealCore,
  TradeSimulationRecord,
  TradeSimulationRecordCore
} from "./simulationTypes";

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/;
const isoTime = (value: string) => Number.isFinite(Date.parse(value));
const unique = (values: readonly string[]) => [...new Set(values.filter(Boolean))].sort();

export async function buildSimulationCostModel(
  input: Omit<SimulationCostModel, "modelId">
): Promise<Readonly<SimulationCostModel>> {
  const core = Object.freeze({ ...input });
  if (!core.version || !Number.isFinite(core.pointSize) || core.pointSize <= 0 ||
      !Number.isFinite(core.slippagePoints) || core.slippagePoints < 0 ||
      !Number.isFinite(core.commissionR) || core.commissionR < 0 ||
      !Number.isFinite(core.swapR) || core.swapR < 0 ||
      core.spreadMode === "static" && (!Number.isFinite(core.staticSpreadPoints) || core.staticSpreadPoints! < 0)) {
    throw new Error("Simulation cost model is invalid.");
  }
  return Object.freeze({ ...core, modelId: await canonicalHash(core) });
}

const authorityAndCapabilitiesValid = (value: {
  authority: unknown;
  capabilities?: unknown;
}) => {
  try {
    assertSimulationAuthority(value.authority);
  } catch {
    return false;
  }
  return value.capabilities === undefined ||
    JSON.stringify(value.capabilities) === JSON.stringify(SIMULATION_CAPABILITIES_DISABLED);
};

export function validateCanonicalOpportunityCore(core: Readonly<CanonicalOpportunityCore>) {
  const blockers: string[] = [];
  for (const [label, value] of Object.entries({
    datasetCertificateId: core.datasetCertificateId,
    datasetId: core.datasetId,
    parameterHash: core.parameterHash,
    contextLineageRoot: core.contextLineageRoot
  })) if (!HASH_PATTERN.test(value)) blockers.push(`bt2_opportunity_${label}_invalid`);
  for (const [label, value] of Object.entries({
    decisionAtUtc: core.decisionAtUtc,
    sourceCandleClosedAtUtc: core.sourceCandleClosedAtUtc,
    activatesAtUtc: core.activatesAtUtc,
    expiresAtUtc: core.expiresAtUtc
  })) if (!isoTime(value)) blockers.push(`bt2_opportunity_${label}_invalid`);
  if (isoTime(core.sourceCandleClosedAtUtc) && isoTime(core.decisionAtUtc) &&
      Date.parse(core.sourceCandleClosedAtUtc) > Date.parse(core.decisionAtUtc)) {
    blockers.push("bt2_opportunity_future_source_candle");
  }
  if (isoTime(core.activatesAtUtc) && isoTime(core.decisionAtUtc) &&
      Date.parse(core.activatesAtUtc) < Date.parse(core.decisionAtUtc)) {
    blockers.push("bt2_opportunity_activation_before_decision");
  }
  if (isoTime(core.expiresAtUtc) && isoTime(core.activatesAtUtc) &&
      Date.parse(core.expiresAtUtc) <= Date.parse(core.activatesAtUtc)) {
    blockers.push("bt2_opportunity_expiry_not_after_activation");
  }
  const prices = [core.signalPrice, core.entryPrice, core.stopPrice, ...core.targetPrices];
  if (prices.some((value) => !Number.isFinite(value) || value <= 0)) blockers.push("bt2_opportunity_price_invalid");
  if (!core.targetPrices.length) blockers.push("bt2_opportunity_target_missing");
  if (core.direction === "long" && !(core.stopPrice < core.entryPrice) ||
      core.direction === "short" && !(core.stopPrice > core.entryPrice)) {
    blockers.push("bt2_opportunity_stop_geometry_invalid");
  }
  if (core.targetPrices.some((target) => core.direction === "long" ? target <= core.entryPrice : target >= core.entryPrice)) {
    blockers.push("bt2_opportunity_target_geometry_invalid");
  }
  if (core.eligible !== (core.blockers.length === 0)) blockers.push("bt2_opportunity_eligibility_inconsistent");
  if (!authorityAndCapabilitiesValid(core)) blockers.push("bt2_opportunity_authority_invalid");
  return unique(blockers);
}

export async function buildCanonicalOpportunity(
  input: Omit<CanonicalOpportunityCore, "schemaVersion" | "geometryMode" | "authority" | "capabilities">
): Promise<Readonly<CanonicalOpportunity>> {
  const core = Object.freeze({
    ...input,
    targetPrices: Object.freeze([...input.targetPrices]),
    blockers: Object.freeze(unique(input.blockers)),
    schemaVersion: "gotrader-canonical-opportunity-bt2-v1" as const,
    geometryMode: "native_strategy_geometry" as const,
    authority: SIMULATION_AUTHORITY_NONE,
    capabilities: SIMULATION_CAPABILITIES_DISABLED
  });
  const blockers = validateCanonicalOpportunityCore(core);
  if (blockers.length) throw new Error(`Canonical opportunity rejected: ${blockers.join(", ")}`);
  return Object.freeze({ ...core, opportunityId: await canonicalHash(core) });
}

export async function validateCanonicalOpportunity(opportunity: Readonly<CanonicalOpportunity>) {
  const { opportunityId, ...core } = opportunity;
  return unique([
    ...validateCanonicalOpportunityCore(core),
    ...(HASH_PATTERN.test(opportunityId) && await canonicalHash(core) === opportunityId
      ? [] : ["bt2_opportunity_id_invalid"])
  ]);
}

export async function buildTradeSimulationRecord(
  input: Omit<TradeSimulationRecordCore, "schemaVersion" | "engineVersion" | "authority" | "capabilities">
): Promise<Readonly<TradeSimulationRecord>> {
  const core = Object.freeze({
    ...input,
    transitions: Object.freeze(input.transitions.map((item) => Object.freeze({ ...item }))),
    blockers: Object.freeze(unique(input.blockers)),
    schemaVersion: "gotrader-trade-simulation-record-bt2-v1" as const,
    engineVersion: "bt2-pure-simulator-v1" as const,
    authority: SIMULATION_AUTHORITY_NONE,
    capabilities: SIMULATION_CAPABILITIES_DISABLED
  });
  if (!HASH_PATTERN.test(core.opportunityId) || !HASH_PATTERN.test(core.datasetCertificateId) ||
      !HASH_PATTERN.test(core.datasetId) || !HASH_PATTERN.test(core.costModelId)) {
    throw new Error("Trade simulation record has an invalid parent identity.");
  }
  return Object.freeze({ ...core, recordId: await canonicalHash(core) });
}

export async function buildSimulationCheckpoint(
  input: Omit<SimulationCheckpointCore, "schemaVersion" | "authority">
): Promise<Readonly<SimulationCheckpoint>> {
  const core = Object.freeze({
    ...input,
    committedRecordIds: Object.freeze([...input.committedRecordIds]),
    schemaVersion: "gotrader-simulation-checkpoint-bt2-v1" as const,
    authority: SIMULATION_AUTHORITY_NONE
  });
  if (!Number.isSafeInteger(core.nextOpportunityOrdinal) || core.nextOpportunityOrdinal < 0 ||
      core.committedRecordIds.some((id) => !HASH_PATTERN.test(id))) {
    throw new Error("Simulation checkpoint is invalid.");
  }
  return Object.freeze({ ...core, checkpointId: await canonicalHash(core) });
}

export async function validateSimulationCheckpoint(checkpoint: Readonly<SimulationCheckpoint>) {
  const { checkpointId, ...core } = checkpoint;
  return unique([
    ...(!Number.isSafeInteger(core.nextOpportunityOrdinal) || core.nextOpportunityOrdinal < 0
      ? ["bt2_checkpoint_ordinal_invalid"] : []),
    ...(core.committedRecordIds.some((id) => !HASH_PATTERN.test(id))
      ? ["bt2_checkpoint_record_id_invalid"] : []),
    ...(!authorityAndCapabilitiesValid(core) ? ["bt2_checkpoint_authority_invalid"] : []),
    ...(HASH_PATTERN.test(checkpointId) && await canonicalHash(core) === checkpointId
      ? [] : ["bt2_checkpoint_id_invalid"])
  ]);
}

export async function buildTradeLedgerSeal(
  input: Omit<TradeLedgerSealCore, "schemaVersion" | "authority" | "capabilities">
): Promise<Readonly<TradeLedgerSeal>> {
  const orderedRecordIds = Object.freeze([...input.orderedRecordIds]);
  if (orderedRecordIds.some((id) => !HASH_PATTERN.test(id))) throw new Error("Trade ledger contains an invalid record ID.");
  if (new Set(orderedRecordIds).size !== orderedRecordIds.length) throw new Error("Trade ledger contains duplicate record IDs.");
  const core = Object.freeze({
    ...input,
    orderedRecordIds,
    checkpointLineage: Object.freeze([...input.checkpointLineage]),
    schemaVersion: "gotrader-trade-ledger-seal-bt2-v1" as const,
    authority: SIMULATION_AUTHORITY_NONE,
    capabilities: SIMULATION_CAPABILITIES_DISABLED
  });
  return Object.freeze({ ...core, ledgerSealId: await canonicalHash(core) });
}
