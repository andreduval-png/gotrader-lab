import type {
  CanonicalResearchAuthority,
  CanonicalResearchCapabilities,
  CanonicalResearchCompactValue
} from "./canonicalResearchTypes";

export const CANONICAL_LINEAGE_GRAPH_SCHEMA_VERSION =
  "gotrader-b1-canonical-lineage-graph-v1";
export const CANONICAL_LINEAGE_NODE_REFERENCE_SCHEMA_VERSION =
  "gotrader-b1-lineage-node-reference-v1";
export const CANONICAL_LINEAGE_EDGE_SCHEMA_VERSION =
  "gotrader-b1-lineage-edge-v1";

export type CanonicalLineageNodeClass =
  | "owned_immutable"
  | "external_authoritative"
  | "derived_advisory"
  | "operational_materialization"
  | "control_retention";

export type CanonicalLineageNodeType =
  | "verified_close"
  | "canonical_candle_window"
  | "canonical_context"
  | "historical_dataset_manifest"
  | "strategy_profile"
  | "parameter_set"
  | "cost_model"
  | "policy_contract"
  | "evidence_gate_receipt"
  | "replay_result"
  | "oos_result"
  | "robustness_result"
  | "native_evidence"
  | "control_request"
  | "research_request"
  | "research_stage"
  | "research_result"
  | "historical_validation_result"
  | "memory_document"
  | "gbrain_receipt"
  | "advisory_review"
  | "hypothesis"
  | "checkpoint"
  | "operator_projection"
  | "quarantine_record"
  | "tombstone"
  | "archive_manifest"
  | "compatibility_mapping_record";

export type CanonicalLineageIntegrityStatus =
  | "verified"
  | "unresolved"
  | "blocked"
  | "quarantined"
  | "archived"
  | "tombstoned";

export type CanonicalLineageRelationshipType =
  | "triggered"
  | "window_constituent_of"
  | "derived_into"
  | "consumed_by"
  | "precedes"
  | "produced"
  | "validated_by"
  | "sealed_as"
  | "replayed_as"
  | "evaluated_oos_as"
  | "stress_tested_as"
  | "submitted_to_evidence_gate"
  | "accepted_as_evidence"
  | "indexed_as"
  | "cited_by"
  | "proposed_as"
  | "admitted_as"
  | "projects_as"
  | "superseded_by"
  | "quarantined_by"
  | "archived_by"
  | "tombstoned_by"
  | "compatibility_maps_to";

export type CanonicalLineageRelationshipCategory =
  | "required_causal"
  | "validation"
  | "evidence_boundary"
  | "advisory"
  | "operational_projection"
  | "supersession"
  | "retention"
  | "compatibility";

export interface CanonicalLineageNodeIdentityCore {
  readonly graphSchemaVersion: typeof CANONICAL_LINEAGE_GRAPH_SCHEMA_VERSION;
  readonly ownerNamespace: string;
  readonly nodeType: CanonicalLineageNodeType;
  readonly canonicalArtifactId: string;
}

export interface CanonicalLineageNodeReference
  extends CanonicalLineageNodeIdentityCore {
  readonly nodeReferenceSchemaVersion: typeof CANONICAL_LINEAGE_NODE_REFERENCE_SCHEMA_VERSION;
  readonly lineageNodeKey: string;
  readonly nodeClass: CanonicalLineageNodeClass;
  readonly ownerContractVersion: string;
  readonly ownerPayloadHash?: string;
  readonly lifecycleStatus: string;
  readonly retentionClass: string;
  readonly integrityStatus: CanonicalLineageIntegrityStatus;
  readonly sealedAt?: string;
  readonly identityMetadata?: Readonly<
    Record<string, CanonicalResearchCompactValue>
  >;
  readonly authority: CanonicalResearchAuthority;
  readonly capabilities: CanonicalResearchCapabilities;
}

export interface CanonicalLineageEdgeIdentityCore {
  readonly graphSchemaVersion: typeof CANONICAL_LINEAGE_GRAPH_SCHEMA_VERSION;
  readonly edgeSchemaVersion: typeof CANONICAL_LINEAGE_EDGE_SCHEMA_VERSION;
  readonly relationshipType: CanonicalLineageRelationshipType;
  readonly relationshipVersion: string;
  readonly parentNodeKey: string;
  readonly childNodeKey: string;
  readonly creationStageId: string;
  readonly ordinal?: number;
  readonly identityMetadata: Readonly<
    Record<string, CanonicalResearchCompactValue>
  >;
}

export interface CanonicalLineageEdge
  extends CanonicalLineageEdgeIdentityCore {
  readonly edgeId: string;
  readonly relationshipCategory: CanonicalLineageRelationshipCategory;
  readonly payloadHash: string;
  readonly integrityStatus: Exclude<
    CanonicalLineageIntegrityStatus,
    "tombstoned"
  >;
  readonly authority: CanonicalResearchAuthority;
  readonly capabilities: CanonicalResearchCapabilities;
}
