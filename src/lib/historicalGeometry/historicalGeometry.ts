import { canonicalFingerprint } from "@/lib/ictCanonical/canonicalIctIdentity";
import type {
  CanonicalTargetType,
  CanonicalTradeGeometry,
  EntryLifecycleStatus,
  TradeGeometryStatus
} from "@/lib/tradeGeometry";

export const CANONICAL_HISTORICAL_GEOMETRY_SCHEMA = "gotrader.historical-geometry.v2" as const;

export type HistoricalValidationClassification =
  | "CANONICAL_AUTHORITATIVE_RESEARCH"
  | "LEGACY_DIAGNOSTIC"
  | "SOURCE_BLOCKED"
  | "INVALID";

export interface CanonicalHistoricalGeometryEnvelope {
  schemaVersion: typeof CANONICAL_HISTORICAL_GEOMETRY_SCHEMA;
  canonicalGeometryParityHash: string;
  geometryVersion: string;
  geometryId: string;
  logicalGeometryKey: string;
  strategyId: string;
  strategyVersion: string;
  profileId?: string;
  profileVersion?: string;
  parameterHash?: string;
  sessionPolicyId: string;
  candidateId: string;
  geometryPolicyId: string;
  geometryPolicyVersion: string;
  direction: CanonicalTradeGeometry["direction"];
  intendedEntry: number;
  intendedStop: number;
  intendedTarget: number;
  primaryTarget: {
    targetId: string;
    targetType: CanonicalTargetType;
    price: number;
  };
  intermediateTargets: HistoricalIntermediateTarget[];
  intermediateTargetsStatus: "DECLARED_BY_STRATEGY" | "NOT_DECLARED_BY_CANONICAL_GEOMETRY";
  theoreticalRR: number;
  minimumRequiredRR?: number;
  geometryStatus: TradeGeometryStatus;
  entryLifecycleStatus: EntryLifecycleStatus;
  actionable: boolean;
  blockers: string[];
  warnings: string[];
  actionabilityClass: "ACTIONABLE" | "RESEARCH_ONLY" | "NON_ACTIONABLE";
  supportingFactIds: string[];
  sourceFingerprint: string;
  datasetId?: string;
  datasetCertificateId?: string;
  costModelId: string;
  fillModelId: string;
  asOf: string;
  authority: {
    executionAuthority: "none";
    brokerAuthority: "none";
    readinessOverrideAuthority: "none";
    canCreateEvidence: false;
    canApproveReadiness: false;
    canCreateTradeIntent: false;
  };
}

export interface HistoricalIntermediateTarget {
  targetId: string;
  targetType: CanonicalTargetType;
  price: number;
  sourceFactId?: string;
}

export interface HistoricalValidationAuthority {
  classification: HistoricalValidationClassification;
  authoritative: boolean;
  reason: string;
  geometrySchema: typeof CANONICAL_HISTORICAL_GEOMETRY_SCHEMA;
  geometryParityRequired: boolean;
  certifiedDatasetBound: boolean;
  canSupportReadiness: boolean;
  canCreateEvidence: false;
  canApproveReadiness: false;
  executionAuthority: "none";
  brokerAuthority: "none";
  readinessOverrideAuthority: "none";
}

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

const parityMaterial = (envelope: Omit<CanonicalHistoricalGeometryEnvelope, "canonicalGeometryParityHash" | "authority">) => ({
  schemaVersion: envelope.schemaVersion,
  geometryVersion: envelope.geometryVersion,
  geometryId: envelope.geometryId,
  logicalGeometryKey: envelope.logicalGeometryKey,
  strategyId: envelope.strategyId,
  strategyVersion: envelope.strategyVersion,
  profileId: envelope.profileId,
  profileVersion: envelope.profileVersion,
  parameterHash: envelope.parameterHash,
  sessionPolicyId: envelope.sessionPolicyId,
  candidateId: envelope.candidateId,
  geometryPolicyId: envelope.geometryPolicyId,
  geometryPolicyVersion: envelope.geometryPolicyVersion,
  direction: envelope.direction,
  intendedEntry: envelope.intendedEntry,
  intendedStop: envelope.intendedStop,
  intendedTarget: envelope.intendedTarget,
  primaryTarget: envelope.primaryTarget,
  intermediateTargets: envelope.intermediateTargets,
  intermediateTargetsStatus: envelope.intermediateTargetsStatus,
  theoreticalRR: envelope.theoreticalRR,
  minimumRequiredRR: envelope.minimumRequiredRR,
  geometryStatus: envelope.geometryStatus,
  entryLifecycleStatus: envelope.entryLifecycleStatus,
  actionable: envelope.actionable,
  blockers: envelope.blockers,
  warnings: envelope.warnings,
  actionabilityClass: envelope.actionabilityClass,
  supportingFactIds: envelope.supportingFactIds,
  sourceFingerprint: envelope.sourceFingerprint,
  datasetId: envelope.datasetId,
  datasetCertificateId: envelope.datasetCertificateId,
  costModelId: envelope.costModelId,
  fillModelId: envelope.fillModelId,
  asOf: envelope.asOf
});

export const buildCanonicalHistoricalGeometryEnvelope = ({
  geometry,
  sourceFingerprint,
  datasetId,
  datasetCertificateId,
  costModelId,
  fillModelId,
  sessionPolicyId,
  asOf,
  intermediateTargets = []
}: {
  geometry: CanonicalTradeGeometry;
  sourceFingerprint: string;
  datasetId?: string;
  datasetCertificateId?: string;
  costModelId: string;
  fillModelId: string;
  sessionPolicyId: string;
  asOf: string;
  intermediateTargets?: readonly HistoricalIntermediateTarget[];
}): CanonicalHistoricalGeometryEnvelope => {
  if (!geometry.geometryValid || !geometry.target || !finite(geometry.theoreticalRR)) {
    throw new Error("CANONICAL_GEOMETRY_PARITY_FAILURE: complete valid canonical geometry is required.");
  }
  if (geometry.sourceFingerprint !== sourceFingerprint) {
    throw new Error("CANONICAL_GEOMETRY_PARITY_FAILURE: source fingerprint diverged from frozen geometry.");
  }
  if (!Number.isFinite(Date.parse(asOf))) {
    throw new Error("CANONICAL_GEOMETRY_PARITY_FAILURE: historical asOf is invalid.");
  }
  const validFrom = geometry.entry.validFrom ? Date.parse(geometry.entry.validFrom) : undefined;
  if (validFrom !== undefined && Number.isFinite(validFrom) && validFrom > Date.parse(asOf)) {
    throw new Error("CANONICAL_GEOMETRY_PARITY_FAILURE: entry intent was not knowable at historical asOf.");
  }
  const normalizedIntermediateTargets = intermediateTargets.map((target) => ({ ...target }));
  if (normalizedIntermediateTargets.some((target) =>
    !target.targetId || !finite(target.price) || target.targetId === geometry.target?.targetId
  )) {
    throw new Error("CANONICAL_GEOMETRY_PARITY_FAILURE: intermediate target identity is invalid.");
  }
  const supportingFactIds = Array.from(new Set([
    geometry.entry.sourceFactId,
    geometry.stop.sourceFactId,
    geometry.target.sourceFactId
  ].filter((value): value is string => Boolean(value)))).sort();
  const base = {
    schemaVersion: CANONICAL_HISTORICAL_GEOMETRY_SCHEMA,
    geometryVersion: geometry.geometryVersion,
    geometryId: geometry.geometryId,
    logicalGeometryKey: geometry.logicalGeometryKey,
    strategyId: geometry.strategyId,
    strategyVersion: geometry.strategyVersion,
    profileId: geometry.profileId,
    profileVersion: geometry.profileVersion,
    parameterHash: geometry.parameterHash,
    sessionPolicyId,
    candidateId: geometry.candidateId,
    geometryPolicyId: geometry.targetPolicy.policyId,
    geometryPolicyVersion: geometry.targetPolicy.policyVersion,
    direction: geometry.direction,
    intendedEntry: geometry.entry.intendedPrice,
    intendedStop: geometry.stop.price,
    intendedTarget: geometry.target.price,
    primaryTarget: {
      targetId: geometry.target.targetId,
      targetType: geometry.target.targetType,
      price: geometry.target.price
    },
    intermediateTargets: normalizedIntermediateTargets,
    intermediateTargetsStatus: normalizedIntermediateTargets.length
      ? "DECLARED_BY_STRATEGY" as const
      : "NOT_DECLARED_BY_CANONICAL_GEOMETRY" as const,
    theoreticalRR: geometry.theoreticalRR,
    minimumRequiredRR: geometry.minimumRequiredRR,
    geometryStatus: geometry.status,
    entryLifecycleStatus: geometry.entry.lifecycleStatus,
    actionable: geometry.actionable,
    blockers: [...geometry.blockers],
    warnings: [...geometry.warnings],
    actionabilityClass: geometry.actionable
      ? "ACTIONABLE" as const
      : geometry.status === "VALID_RESEARCH_ONLY"
        ? "RESEARCH_ONLY" as const
        : "NON_ACTIONABLE" as const,
    supportingFactIds,
    sourceFingerprint,
    datasetId,
    datasetCertificateId,
    costModelId,
    fillModelId,
    asOf
  } satisfies Omit<CanonicalHistoricalGeometryEnvelope, "canonicalGeometryParityHash" | "authority">;
  return {
    ...base,
    canonicalGeometryParityHash: canonicalFingerprint(parityMaterial(base)),
    authority: {
      executionAuthority: "none",
      brokerAuthority: "none",
      readinessOverrideAuthority: "none",
      canCreateEvidence: false,
      canApproveReadiness: false,
      canCreateTradeIntent: false
    }
  };
};

export const assertCanonicalHistoricalGeometryParity = (
  envelope: CanonicalHistoricalGeometryEnvelope,
  geometry: CanonicalTradeGeometry
) => {
  const rebuilt = buildCanonicalHistoricalGeometryEnvelope({
    geometry,
    sourceFingerprint: envelope.sourceFingerprint,
    datasetId: envelope.datasetId,
    datasetCertificateId: envelope.datasetCertificateId,
    costModelId: envelope.costModelId,
    fillModelId: envelope.fillModelId,
    sessionPolicyId: envelope.sessionPolicyId,
    asOf: envelope.asOf,
    intermediateTargets: envelope.intermediateTargets
  });
  if (
    rebuilt.canonicalGeometryParityHash !== envelope.canonicalGeometryParityHash ||
    rebuilt.geometryId !== envelope.geometryId ||
    rebuilt.intendedEntry !== envelope.intendedEntry ||
    rebuilt.intendedStop !== envelope.intendedStop ||
    rebuilt.intendedTarget !== envelope.intendedTarget ||
    rebuilt.theoreticalRR !== envelope.theoreticalRR ||
    rebuilt.geometryStatus !== envelope.geometryStatus ||
    rebuilt.entryLifecycleStatus !== envelope.entryLifecycleStatus ||
    rebuilt.actionable !== envelope.actionable
  ) {
    throw new Error("CANONICAL_GEOMETRY_PARITY_FAILURE: historical intended geometry changed.");
  }
  return envelope;
};

export const historicalValidationAuthority = (
  classification: HistoricalValidationClassification,
  reason: string,
  options: { certifiedDatasetBound?: boolean } = {}
): HistoricalValidationAuthority => ({
  classification,
  authoritative: classification === "CANONICAL_AUTHORITATIVE_RESEARCH",
  reason,
  geometrySchema: CANONICAL_HISTORICAL_GEOMETRY_SCHEMA,
  geometryParityRequired: classification === "CANONICAL_AUTHORITATIVE_RESEARCH",
  certifiedDatasetBound: options.certifiedDatasetBound === true,
  canSupportReadiness:
    classification === "CANONICAL_AUTHORITATIVE_RESEARCH" && options.certifiedDatasetBound === true,
  canCreateEvidence: false,
  canApproveReadiness: false,
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
});
