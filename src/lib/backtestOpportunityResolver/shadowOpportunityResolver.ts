import { canonicalHash } from "../canonical/canonicalValueSerialization";
import { validateCanonicalOpportunity } from "../backtestSimulation/simulationContracts";
import { SIMULATION_AUTHORITY_NONE, SIMULATION_CAPABILITIES_DISABLED } from "../backtestSimulation/simulationAuthority";
import type { CanonicalOpportunity, SimulationDirection } from "../backtestSimulation/simulationTypes";

export type OpportunityEvidenceFamily = "imbalance" | "liquidity_reversal" | "session_model" | "delivery_state";
export type ShadowResolutionState = "no_active" | "single" | "same_family_overlap" |
  "cross_family_confluence" | "cross_family_conflict" | "mixed";

export interface ShadowOpportunityCandidate {
  readonly evidenceFamily: OpportunityEvidenceFamily;
  readonly opportunity: Readonly<CanonicalOpportunity>;
}

export interface ShadowResolutionFamilyGroup {
  readonly evidenceFamily: OpportunityEvidenceFamily;
  readonly opportunityIds: readonly string[];
  readonly directions: readonly SimulationDirection[];
}

export interface ShadowOpportunityResolutionCore {
  readonly schemaVersion: "gotrader-bt3-shadow-opportunity-resolution-v1";
  readonly resolverVersion: "bt3-evidence-family-shadow-resolver-v1";
  readonly observedAtUtc: string;
  readonly requestedSymbol: string;
  readonly brokerSymbol: string;
  readonly state: ShadowResolutionState;
  readonly directionalState: "none" | "single" | "aligned" | "conflicted";
  readonly activeOpportunityIds: readonly string[];
  readonly inactiveOpportunityIds: readonly string[];
  readonly familyGroups: readonly Readonly<ShadowResolutionFamilyGroup>[];
  readonly activeDirections: readonly SimulationDirection[];
  readonly currentLiveResolutionAuthoritative: true;
  readonly shadowSelectionAllowed: false;
  readonly authority: Readonly<typeof SIMULATION_AUTHORITY_NONE>;
  readonly capabilities: Readonly<typeof SIMULATION_CAPABILITIES_DISABLED>;
}

export interface ShadowOpportunityResolution extends ShadowOpportunityResolutionCore {
  readonly resolutionId: string;
}

const familyOrder: readonly OpportunityEvidenceFamily[] = ["delivery_state", "imbalance", "liquidity_reversal", "session_model"];
const unique = <T extends string>(values: readonly T[]) => [...new Set(values)].sort() as T[];

const assertInput = async (observedAtUtc: string, candidates: readonly Readonly<ShadowOpportunityCandidate>[]) => {
  if (!Number.isFinite(Date.parse(observedAtUtc))) throw new Error("BT3 shadow resolver observation time is invalid.");
  if (!candidates.length) throw new Error("BT3 shadow resolver requires at least one candidate.");
  if (new Set(candidates.map(({ opportunity }) => opportunity.opportunityId)).size !== candidates.length) {
    throw new Error("BT3 shadow resolver candidate identities must be unique.");
  }
  for (const candidate of candidates) {
    if (!familyOrder.includes(candidate.evidenceFamily)) throw new Error("BT3 shadow resolver evidence family is unsupported.");
    const blockers = await validateCanonicalOpportunity(candidate.opportunity);
    if (blockers.length) throw new Error(`BT3 shadow resolver canonical opportunity is invalid: ${blockers.join(", ")}`);
  }
  const requestedSymbols = unique(candidates.map(({ opportunity }) => opportunity.requestedSymbol));
  const brokerSymbols = unique(candidates.map(({ opportunity }) => opportunity.brokerSymbol));
  if (requestedSymbols.length !== 1 || brokerSymbols.length !== 1) {
    throw new Error("BT3 shadow resolver candidates must share one symbol scope.");
  }
};

const stateFor = (groups: readonly ShadowResolutionFamilyGroup[], directions: readonly SimulationDirection[], activeCount: number): ShadowResolutionState => {
  if (activeCount === 0) return "no_active";
  if (activeCount === 1) return "single";
  if (groups.length === 1) return "same_family_overlap";
  if (directions.length === 1) return "cross_family_confluence";
  return groups.some((group) => group.opportunityIds.length > 1) ? "mixed" : "cross_family_conflict";
};

export async function resolveShadowOpportunities(input: {
  readonly observedAtUtc: string;
  readonly candidates: readonly Readonly<ShadowOpportunityCandidate>[];
}): Promise<Readonly<ShadowOpportunityResolution>> {
  await assertInput(input.observedAtUtc, input.candidates);
  const observedAt = Date.parse(input.observedAtUtc);
  const ordered = [...input.candidates].sort((left, right) =>
    left.opportunity.opportunityId.localeCompare(right.opportunity.opportunityId));
  const active = ordered.filter(({ opportunity }) => opportunity.eligible &&
    Date.parse(opportunity.activatesAtUtc) <= observedAt && observedAt < Date.parse(opportunity.expiresAtUtc));
  const inactive = ordered.filter((candidate) => !active.includes(candidate));
  const familyGroups = familyOrder.map((evidenceFamily) => {
    const members = active.filter((candidate) => candidate.evidenceFamily === evidenceFamily);
    return members.length ? Object.freeze({ evidenceFamily,
      opportunityIds: Object.freeze(members.map(({ opportunity }) => opportunity.opportunityId).sort()),
      directions: Object.freeze(unique(members.map(({ opportunity }) => opportunity.direction))) }) : undefined;
  }).filter((group): group is Readonly<ShadowResolutionFamilyGroup> => Boolean(group));
  const activeDirections = unique(active.map(({ opportunity }) => opportunity.direction));
  const state = stateFor(familyGroups, activeDirections, active.length);
  const directionalState = activeDirections.length === 0 ? "none" : active.length === 1 ? "single" :
    activeDirections.length === 1 ? "aligned" : "conflicted";
  const core: Readonly<ShadowOpportunityResolutionCore> = Object.freeze({
    schemaVersion: "gotrader-bt3-shadow-opportunity-resolution-v1",
    resolverVersion: "bt3-evidence-family-shadow-resolver-v1",
    observedAtUtc: new Date(observedAt).toISOString(),
    requestedSymbol: ordered[0].opportunity.requestedSymbol,
    brokerSymbol: ordered[0].opportunity.brokerSymbol,
    state,
    directionalState,
    activeOpportunityIds: Object.freeze(active.map(({ opportunity }) => opportunity.opportunityId)),
    inactiveOpportunityIds: Object.freeze(inactive.map(({ opportunity }) => opportunity.opportunityId)),
    familyGroups: Object.freeze(familyGroups),
    activeDirections: Object.freeze(activeDirections),
    currentLiveResolutionAuthoritative: true,
    shadowSelectionAllowed: false,
    authority: SIMULATION_AUTHORITY_NONE,
    capabilities: SIMULATION_CAPABILITIES_DISABLED
  });
  return Object.freeze({ ...core, resolutionId: await canonicalHash(core) });
}

export async function validateShadowOpportunityResolution(resolution: Readonly<ShadowOpportunityResolution>) {
  const { resolutionId, ...core } = resolution;
  const blockers: string[] = [];
  if (await canonicalHash(core) !== resolutionId) blockers.push("bt3_shadow_resolution_id_invalid");
  if (!resolution.currentLiveResolutionAuthoritative || resolution.shadowSelectionAllowed) blockers.push("bt3_shadow_resolution_authority_drift");
  if (new Set([...resolution.activeOpportunityIds, ...resolution.inactiveOpportunityIds]).size !==
      resolution.activeOpportunityIds.length + resolution.inactiveOpportunityIds.length) blockers.push("bt3_shadow_resolution_membership_overlap");
  return Object.freeze(blockers.sort());
}
