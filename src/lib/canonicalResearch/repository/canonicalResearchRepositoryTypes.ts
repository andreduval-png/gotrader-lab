import type {
  CanonicalResearchJobCheckpoint,
  CanonicalResearchJobIdentity,
  CanonicalResearchJobRequest,
  CanonicalResearchProjection,
  CanonicalResearchResultArtifact,
  CanonicalResearchStageArtifact
} from "../contracts/canonicalResearchTypes";
import type {
  CanonicalLineageEdge,
  CanonicalLineageNodeReference
} from "../contracts/canonicalLineageTypes";

export const CANONICAL_RESEARCH_REPOSITORY_SCHEMA_VERSION =
  "gotrader-b1-local-repository-v1";

export interface CanonicalResearchStorageAdapter {
  readonly readText: (relativePath: string) => Promise<string | undefined>;
  readonly writeTextAtomic: (
    relativePath: string,
    value: string
  ) => Promise<void>;
  readonly listFiles: (relativePath: string) => Promise<readonly string[]>;
  readonly removeFile: (relativePath: string) => Promise<void>;
}

export interface CanonicalResearchRepositoryOptions {
  readonly storage: CanonicalResearchStorageAdapter;
  readonly profileId: string;
  readonly maxArtifactBytes?: number;
  readonly maxLogicalJobs?: number;
  readonly atomicWriteRetries?: number;
  readonly now?: () => string;
}

export interface CanonicalResearchRepositoryEnvelope<T> {
  readonly repositorySchemaVersion: typeof CANONICAL_RESEARCH_REPOSITORY_SCHEMA_VERSION;
  readonly profileId: string;
  readonly artifactKind: CanonicalResearchArtifactKind;
  readonly integrityHash: string;
  readonly payload: T;
}

export type CanonicalResearchArtifactKind =
  | "request"
  | "stage"
  | "result"
  | "checkpoint"
  | "projection"
  | "node"
  | "relationship"
  | "quarantine";

export interface CanonicalResearchStoredRequest {
  readonly identity: CanonicalResearchJobIdentity;
  readonly request: CanonicalResearchJobRequest;
}

export interface CanonicalResearchQuarantineRecord {
  readonly quarantineId: string;
  readonly recordedAt: string;
  readonly artifactKind: CanonicalResearchArtifactKind;
  readonly logicalJobId?: string;
  readonly artifactId?: string;
  readonly expectedPayloadHash?: string;
  readonly receivedPayloadHash?: string;
  readonly blockers: readonly string[];
  readonly authority: {
    readonly executionAuthority: "none";
    readonly brokerAuthority: "none";
    readonly readinessOverrideAuthority: "none";
  };
}

export type CanonicalResearchRepositoryPayload =
  | CanonicalResearchStoredRequest
  | CanonicalResearchStageArtifact
  | CanonicalResearchResultArtifact
  | CanonicalResearchJobCheckpoint
  | CanonicalResearchProjection
  | CanonicalLineageNodeReference
  | CanonicalLineageEdge
  | CanonicalResearchQuarantineRecord;

export interface CanonicalResearchRequestAdmission {
  readonly accepted: boolean;
  readonly disposition:
    | "created"
    | "coalesced"
    | "quarantined_conflict"
    | "blocked_capacity";
  readonly identity: CanonicalResearchJobIdentity;
  readonly blockers: readonly string[];
}
