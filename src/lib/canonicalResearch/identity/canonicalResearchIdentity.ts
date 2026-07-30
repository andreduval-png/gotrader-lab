import {
  canonicalHash,
  V2_CANONICAL_HASH_VERSION
} from "../../v2/serialization/canonicalSerialization";
import {
  CANONICAL_RESEARCH_JOB_SCHEMA_VERSION,
  type CanonicalResearchDuplicateResult,
  type CanonicalResearchJobIdentity,
  type CanonicalResearchJobIdentityCore,
  type CanonicalResearchJobRequest
} from "../contracts/canonicalResearchTypes";
import {
  CANONICAL_LINEAGE_EDGE_SCHEMA_VERSION,
  CANONICAL_LINEAGE_GRAPH_SCHEMA_VERSION,
  type CanonicalLineageEdge,
  type CanonicalLineageEdgeIdentityCore,
  type CanonicalLineageNodeIdentityCore,
  type CanonicalLineageNodeReference
} from "../contracts/canonicalLineageTypes";
import { validateCanonicalResearchJobRequest } from "../contracts/canonicalResearchValidation";
import { validateCanonicalResearchBoundary } from "../authority/canonicalResearchAuthority";

const identityFields = [
  "jobType",
  "jobVersion",
  "triggerEventId",
  "triggerCandleIdentity",
  "requestedSymbol",
  "brokerSymbol",
  "primaryTimeframe",
  "contextArtifactId",
  "contextIdentity",
  "strategyId",
  "profileId",
  "profileVersion",
  "parameterHash",
  "costModelId",
  "requiredFacts",
  "requiredTimeframes",
  "sourceFingerprint",
  "timeContractId",
  "schemaVersions"
] as const;

export class CanonicalResearchValidationError extends Error {
  readonly blockers: readonly string[];

  constructor(blockers: readonly string[]) {
    super(`Canonical research request blocked: ${blockers.join(", ")}`);
    this.name = "CanonicalResearchValidationError";
    this.blockers = Object.freeze([...blockers]);
  }
}

export const createCanonicalResearchIdentityCore = (
  request: CanonicalResearchJobRequest
): CanonicalResearchJobIdentityCore =>
  Object.freeze(
    Object.fromEntries(
      identityFields
        .filter((field) => request[field] !== undefined)
        .map((field) => [field, request[field]])
    ) as unknown as CanonicalResearchJobIdentityCore
  );

export async function deriveCanonicalResearchJobIdentity(
  input: unknown
): Promise<CanonicalResearchJobIdentity> {
  const validation = validateCanonicalResearchJobRequest(input);
  if (!validation.accepted) {
    throw new CanonicalResearchValidationError(validation.blockers);
  }

  const identityCore = createCanonicalResearchIdentityCore(validation.request);
  const [logicalJobId, payloadHash] = await Promise.all([
    canonicalHash(identityCore),
    canonicalHash(validation.request)
  ]);
  return Object.freeze({
    schemaVersion: CANONICAL_RESEARCH_JOB_SCHEMA_VERSION,
    hashVersion: V2_CANONICAL_HASH_VERSION,
    logicalJobId,
    payloadHash,
    identityCore
  });
}

export async function compareCanonicalResearchRequests(
  left: unknown,
  right: unknown
): Promise<CanonicalResearchDuplicateResult> {
  const [leftIdentity, rightIdentity] = await Promise.all([
    deriveCanonicalResearchJobIdentity(left),
    deriveCanonicalResearchJobIdentity(right)
  ]);

  if (leftIdentity.logicalJobId !== rightIdentity.logicalJobId) {
    return Object.freeze({
      disposition: "different_logical_job",
      logicalJobId: rightIdentity.logicalJobId,
      payloadHash: rightIdentity.payloadHash
    });
  }
  if (leftIdentity.payloadHash === rightIdentity.payloadHash) {
    return Object.freeze({
      disposition: "coalesce_idempotently",
      logicalJobId: rightIdentity.logicalJobId,
      payloadHash: rightIdentity.payloadHash
    });
  }
  return Object.freeze({
    disposition: "quarantine_payload_conflict",
    blocker: "logical_job_payload_conflict",
    logicalJobId: rightIdentity.logicalJobId,
    payloadHash: rightIdentity.payloadHash
  });
}

export async function deriveCanonicalLineageNodeKey(
  input: CanonicalLineageNodeIdentityCore
) {
  return canonicalHash(input);
}

export async function deriveCanonicalLineageEdgeIdentity(
  input: Omit<CanonicalLineageEdge, "edgeId" | "payloadHash">
): Promise<Pick<CanonicalLineageEdge, "edgeId" | "payloadHash">> {
  const boundaryBlockers = validateCanonicalResearchBoundary(input);
  if (boundaryBlockers.length > 0) {
    throw new CanonicalResearchValidationError(boundaryBlockers);
  }
  if (input.parentNodeKey === input.childNodeKey) {
    throw new CanonicalResearchValidationError(["lineage_self_edge_forbidden"]);
  }

  const identityCore: CanonicalLineageEdgeIdentityCore = Object.freeze({
    graphSchemaVersion: CANONICAL_LINEAGE_GRAPH_SCHEMA_VERSION,
    edgeSchemaVersion: CANONICAL_LINEAGE_EDGE_SCHEMA_VERSION,
    relationshipType: input.relationshipType,
    relationshipVersion: input.relationshipVersion,
    parentNodeKey: input.parentNodeKey,
    childNodeKey: input.childNodeKey,
    creationStageId: input.creationStageId,
    ...(input.ordinal === undefined ? {} : { ordinal: input.ordinal }),
    identityMetadata: input.identityMetadata
  });
  const edgeId = await canonicalHash(identityCore);
  const payloadHash = await canonicalHash({ ...input, edgeId });
  return Object.freeze({ edgeId, payloadHash });
}

export async function verifyCanonicalLineageNodeReference(
  input: Omit<CanonicalLineageNodeReference, "lineageNodeKey">
) {
  const boundaryBlockers = validateCanonicalResearchBoundary(input);
  if (boundaryBlockers.length > 0) {
    throw new CanonicalResearchValidationError(boundaryBlockers);
  }
  return deriveCanonicalLineageNodeKey({
    graphSchemaVersion: input.graphSchemaVersion,
    ownerNamespace: input.ownerNamespace,
    nodeType: input.nodeType,
    canonicalArtifactId: input.canonicalArtifactId
  });
}
