import { canonicalHash } from "../canonical/canonicalValueSerialization";
import {
  CANONICAL_RESEARCH_AUTHORITY_NONE,
  CANONICAL_RESEARCH_CAPABILITIES_DISABLED
} from "../canonicalResearch/authority/canonicalResearchAuthority";
import {
  CANONICAL_LINEAGE_EDGE_SCHEMA_VERSION,
  CANONICAL_LINEAGE_GRAPH_SCHEMA_VERSION,
  CANONICAL_LINEAGE_NODE_REFERENCE_SCHEMA_VERSION,
  type CanonicalLineageEdge,
  type CanonicalLineageNodeIdentityCore,
  type CanonicalLineageNodeReference
} from "../canonicalResearch/contracts/canonicalLineageTypes";
import {
  deriveCanonicalLineageEdgeIdentity,
  deriveCanonicalLineageNodeKey
} from "../canonicalResearch/identity/canonicalResearchIdentity";
import type { HistoricalDatasetManifest } from "./historicalDatasetTypes";

export async function buildHistoricalDatasetLineageNode(
  manifest: Readonly<HistoricalDatasetManifest>
): Promise<Readonly<CanonicalLineageNodeReference>> {
  const identity: CanonicalLineageNodeIdentityCore = Object.freeze({
    graphSchemaVersion: CANONICAL_LINEAGE_GRAPH_SCHEMA_VERSION,
    ownerNamespace: "gotrader-historical-dataset",
    nodeType: "historical_dataset_manifest",
    canonicalArtifactId: manifest.datasetId
  });
  return Object.freeze({
    ...identity,
    nodeReferenceSchemaVersion: CANONICAL_LINEAGE_NODE_REFERENCE_SCHEMA_VERSION,
    lineageNodeKey: await deriveCanonicalLineageNodeKey(identity),
    nodeClass: "external_authoritative",
    ownerContractVersion: manifest.version,
    ownerPayloadHash: await canonicalHash(manifest),
    lifecycleStatus: manifest.blockers.length ? "sealed_blocked" : "sealed",
    retentionClass: "strong_external_historical",
    integrityStatus: manifest.blockers.length ? "blocked" : "verified",
    identityMetadata: Object.freeze({
      providerId: manifest.providerId,
      providerVersion: manifest.providerVersion,
      sourceFingerprint: manifest.sourceFingerprint,
      requestedSymbol: manifest.requestedSymbol,
      brokerSymbol: manifest.brokerSymbol,
      startUtc: manifest.startUtc,
      endUtc: manifest.endUtc,
      datasetChecksum: manifest.datasetChecksum,
      normalizationVersion: manifest.normalizationVersion,
      timeAuthorityId: manifest.timeAuthorityId,
      symbolSpecId: manifest.symbolSpecId,
      calendarId: manifest.calendarId,
      integrityStatus: manifest.integrityStatus,
      historicalTimeVerified: manifest.historicalTimeVerified,
      historicalDstVerified: manifest.historicalDstVerified,
      authoritativeScope: manifest.authoritativeScope
    }),
    authority: CANONICAL_RESEARCH_AUTHORITY_NONE,
    capabilities: CANONICAL_RESEARCH_CAPABILITIES_DISABLED
  });
}

export async function buildHistoricalDatasetParentEdges(input: {
  readonly child: Readonly<HistoricalDatasetManifest>;
  readonly parents: readonly Readonly<HistoricalDatasetManifest>[];
}): Promise<readonly Readonly<CanonicalLineageEdge>[]> {
  const childNode = await buildHistoricalDatasetLineageNode(input.child);
  const edges: CanonicalLineageEdge[] = [];
  const expectedParents = new Set(input.child.parentDatasetIds);
  if (expectedParents.size !== input.parents.length) {
    throw new Error("Historical lineage parent manifest count does not match the child identity.");
  }
  for (const [ordinal, parent] of [...input.parents]
    .sort((left, right) => left.datasetId.localeCompare(right.datasetId))
    .entries()) {
    if (!expectedParents.has(parent.datasetId)) {
      throw new Error("Historical lineage parent manifest is not declared by the child dataset.");
    }
    const parentNode = await buildHistoricalDatasetLineageNode(parent);
    const integrityStatus = parent.blockers.length || input.child.blockers.length ? "blocked" as const : "verified" as const;
    const core: Omit<CanonicalLineageEdge, "edgeId" | "payloadHash"> = Object.freeze({
      graphSchemaVersion: CANONICAL_LINEAGE_GRAPH_SCHEMA_VERSION,
      edgeSchemaVersion: CANONICAL_LINEAGE_EDGE_SCHEMA_VERSION,
      relationshipType: "derived_into",
      relationshipVersion: "gotrader-bt1-dataset-derivation-v1",
      parentNodeKey: parentNode.lineageNodeKey,
      childNodeKey: childNode.lineageNodeKey,
      creationStageId: input.child.requestId,
      ordinal,
      identityMetadata: Object.freeze({
        parentDatasetId: parent.datasetId,
        childDatasetId: input.child.datasetId
      }),
      relationshipCategory: "required_causal",
      integrityStatus,
      authority: CANONICAL_RESEARCH_AUTHORITY_NONE,
      capabilities: CANONICAL_RESEARCH_CAPABILITIES_DISABLED
    });
    const identity = await deriveCanonicalLineageEdgeIdentity(core);
    edges.push(Object.freeze({ ...core, ...identity }));
  }
  return Object.freeze(edges);
}
