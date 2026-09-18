import {
  canonicalLiveResearchCoverage,
  canonicalResearchCoverageRegistry,
  RESEARCH_COVERAGE_AUTHORITY
} from "./canonicalResearchCoverageRegistry";
import type { CanonicalResearchCoverageSnapshot } from "./researchCoverageTypes";
import { RESEARCH_COVERAGE_CONTRACT_VERSION } from "./researchCoverageTypes";

export interface BuildResearchCoverageSnapshotInput {
  cycleId: string;
  asOf: string;
  livePlanStatus: CanonicalResearchCoverageSnapshot["livePlanStatus"];
  livePlanReason: string;
  evidenceIdsByStrategy?: Readonly<Record<string, readonly string[]>>;
  timings?: Readonly<Record<string, number>>;
}

export const buildCanonicalResearchCoverageSnapshot = (
  input: BuildResearchCoverageSnapshotInput
): CanonicalResearchCoverageSnapshot => {
  const ownerResearchStatuses = canonicalResearchCoverageRegistry.map((contract) => ({
    strategyId: contract.ownerStrategyId,
    strategyVersion: contract.ownerStrategyVersion,
    researchProfileId: contract.researchProfileId,
    runtimeAdmissionStatus: contract.runtimeAdmissionStatus,
    tacticalStatus: contract.tacticalResearchPolicy.status,
    validationStatus: contract.historicalValidationPolicy.status,
    walkForwardStatus: contract.walkForwardPolicy.status,
    oosStatus: contract.oosPolicy.status,
    readinessStatus: contract.readinessPolicy.status,
    blockers: contract.blockers,
    evidenceIds: input.evidenceIdsByStrategy?.[contract.ownerStrategyId] ?? []
  }));
  const liveOwners = canonicalLiveResearchCoverage();
  const blockedOwners = liveOwners
    .filter((contract) => !contract.historicalValidationPolicy.supported || !contract.readinessPolicy.supported)
    .map((contract) => contract.ownerStrategyId);
  const availableValidation = liveOwners.filter((contract) => contract.historicalValidationPolicy.supported).length;
  const availableReadiness = liveOwners.filter((contract) => contract.readinessPolicy.supported).length;

  return Object.freeze({
    contractVersion: RESEARCH_COVERAGE_CONTRACT_VERSION,
    cycleId: input.cycleId,
    asOf: input.asOf,
    livePlanStatus: input.livePlanStatus,
    livePlanReason: input.livePlanReason,
    ownerResearchStatuses: Object.freeze(ownerResearchStatuses),
    blockedOwners: Object.freeze(blockedOwners),
    researchOnlyStrategies: Object.freeze(canonicalResearchCoverageRegistry.filter((entry) => entry.runtimeAdmissionStatus === "RESEARCH_ONLY").map((entry) => entry.ownerStrategyId)),
    validationStatus: availableValidation === liveOwners.length ? "AVAILABLE" : availableValidation ? "PARTIAL" : "BLOCKED",
    readinessStatus: availableReadiness === liveOwners.length ? "AVAILABLE" : availableReadiness ? "PARTIAL" : "BLOCKED",
    timings: Object.freeze({ ...(input.timings ?? {}) }),
    authority: RESEARCH_COVERAGE_AUTHORITY
  });
};
