import {
  canonicalHash,
  canonicalSerialize
} from "../../v2/serialization/canonicalSerialization";
import {
  CANONICAL_RESEARCH_AUTHORITY_NONE,
  CANONICAL_RESEARCH_CAPABILITIES_DISABLED,
  validateCanonicalResearchBoundary
} from "../authority/canonicalResearchAuthority";
import type {
  CanonicalResearchJobCheckpoint,
  CanonicalResearchProjection,
  CanonicalResearchResultArtifact,
  CanonicalResearchStageArtifact
} from "../contracts/canonicalResearchTypes";
import type {
  CanonicalLineageEdge,
  CanonicalLineageNodeReference
} from "../contracts/canonicalLineageTypes";
import { validateCanonicalResearchJobRequest } from "../contracts/canonicalResearchValidation";
import {
  deriveCanonicalResearchJobIdentity,
  deriveCanonicalLineageEdgeIdentity,
  verifyCanonicalLineageNodeReference,
  CanonicalResearchValidationError
} from "../identity/canonicalResearchIdentity";
import {
  verifyCanonicalResearchResultArtifact,
  verifyCanonicalResearchStageArtifact
} from "../identity/canonicalResearchArtifactIdentity";
import {
  CANONICAL_RESEARCH_REPOSITORY_SCHEMA_VERSION,
  type CanonicalResearchArtifactKind,
  type CanonicalResearchQuarantineRecord,
  type CanonicalResearchRepositoryEnvelope,
  type CanonicalResearchRepositoryOptions,
  type CanonicalResearchRepositoryPayload,
  type CanonicalResearchRequestAdmission,
  type CanonicalResearchStoredRequest
} from "./canonicalResearchRepositoryTypes";

const hashPattern = /^sha256:[0-9a-f]{64}$/;
const retryableStorageCodes = new Set(["EAGAIN", "EBUSY", "EPERM"]);
const textEncoder = new TextEncoder();

const toFileKey = (identity: string) => {
  if (!hashPattern.test(identity)) {
    throw new CanonicalResearchRepositoryError(["invalid_repository_identity"]);
  }
  return identity.replace(":", "_");
};

const sortedUnique = (values: readonly string[]) =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right));

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const artifactPath = (
  kind: CanonicalResearchArtifactKind,
  identity: string,
  logicalJobId?: string
) => {
  const key = toFileKey(identity);
  if (kind === "stage") {
    if (!logicalJobId) {
      throw new CanonicalResearchRepositoryError(["missing_stage_job_identity"]);
    }
    return `stages/${toFileKey(logicalJobId)}/${key}.json`;
  }
  const directory = `${kind}s`;
  return `${directory}/${key}.json`;
};

export class CanonicalResearchRepositoryError extends Error {
  readonly blockers: readonly string[];

  constructor(blockers: readonly string[]) {
    const normalized = sortedUnique(blockers);
    super(`Canonical research repository blocked: ${normalized.join(", ")}`);
    this.name = "CanonicalResearchRepositoryError";
    this.blockers = Object.freeze(normalized);
  }
}

export class CanonicalResearchFileRepository {
  readonly #options: Required<
    Pick<
      CanonicalResearchRepositoryOptions,
      "maxArtifactBytes" | "maxLogicalJobs" | "atomicWriteRetries" | "now"
    >
  > &
    Pick<CanonicalResearchRepositoryOptions, "storage" | "profileId">;

  constructor(options: CanonicalResearchRepositoryOptions) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/.test(options.profileId)) {
      throw new CanonicalResearchRepositoryError(["invalid_repository_profile"]);
    }
    this.#options = {
      storage: options.storage,
      profileId: options.profileId,
      maxArtifactBytes: options.maxArtifactBytes ?? 64 * 1024,
      maxLogicalJobs: options.maxLogicalJobs ?? 100,
      atomicWriteRetries: options.atomicWriteRetries ?? 1,
      now: options.now ?? (() => new Date().toISOString())
    };
  }

  async admitRequest(input: unknown): Promise<CanonicalResearchRequestAdmission> {
    const validation = validateCanonicalResearchJobRequest(input);
    if (!validation.accepted) {
      throw new CanonicalResearchValidationError(validation.blockers);
    }
    const identity = await deriveCanonicalResearchJobIdentity(validation.request);
    const path = artifactPath("request", identity.logicalJobId);
    const existing = await this.#readEnvelope<CanonicalResearchStoredRequest>(
      path,
      "request"
    );
    if (existing) {
      if (existing.payload.identity.payloadHash === identity.payloadHash) {
        return Object.freeze({
          accepted: true,
          disposition: "coalesced",
          identity,
          blockers: Object.freeze([])
        });
      }
      await this.#quarantine({
        artifactKind: "request",
        logicalJobId: identity.logicalJobId,
        expectedPayloadHash: existing.payload.identity.payloadHash,
        receivedPayloadHash: identity.payloadHash,
        blockers: ["logical_job_payload_conflict"]
      });
      return Object.freeze({
        accepted: false,
        disposition: "quarantined_conflict",
        identity,
        blockers: Object.freeze(["logical_job_payload_conflict"])
      });
    }

    const requestFiles = await this.#options.storage.listFiles("requests");
    if (requestFiles.length >= this.#options.maxLogicalJobs) {
      return Object.freeze({
        accepted: false,
        disposition: "blocked_capacity",
        identity,
        blockers: Object.freeze(["repository_job_limit_reached"])
      });
    }

    await this.#writeImmutable(path, "request", {
      identity,
      request: validation.request
    });
    return Object.freeze({
      accepted: true,
      disposition: "created",
      identity,
      blockers: Object.freeze([])
    });
  }

  async appendStage(artifact: CanonicalResearchStageArtifact) {
    this.#assertBoundary(artifact);
    const verification = await verifyCanonicalResearchStageArtifact(artifact);
    if (!verification.valid) {
      throw new CanonicalResearchRepositoryError(["stage_artifact_hash_mismatch"]);
    }
    return this.#writeImmutable(
      artifactPath("stage", artifact.stageArtifactId, artifact.logicalJobId),
      "stage",
      artifact
    );
  }

  async appendResult(artifact: CanonicalResearchResultArtifact) {
    this.#assertBoundary(artifact);
    const verification = await verifyCanonicalResearchResultArtifact(artifact);
    if (!verification.valid) {
      throw new CanonicalResearchRepositoryError(["result_artifact_hash_mismatch"]);
    }
    return this.#writeImmutable(
      artifactPath("result", artifact.identity.logicalJobId),
      "result",
      artifact
    );
  }

  async appendLineageNode(node: CanonicalLineageNodeReference) {
    this.#assertBoundary(node);
    const { lineageNodeKey, ...core } = node;
    const expectedNodeKey = await verifyCanonicalLineageNodeReference(core);
    if (expectedNodeKey !== lineageNodeKey) {
      throw new CanonicalResearchRepositoryError([
        "lineage_node_identity_mismatch"
      ]);
    }
    return this.#writeImmutable(
      artifactPath("node", lineageNodeKey),
      "node",
      node
    );
  }

  async appendRelationship(edge: CanonicalLineageEdge) {
    this.#assertBoundary(edge);
    const { edgeId, payloadHash, ...core } = edge;
    const expected = await deriveCanonicalLineageEdgeIdentity(core);
    if (expected.edgeId !== edgeId || expected.payloadHash !== payloadHash) {
      throw new CanonicalResearchRepositoryError([
        "lineage_relationship_identity_mismatch"
      ]);
    }
    return this.#writeImmutable(
      artifactPath("relationship", edgeId),
      "relationship",
      edge
    );
  }

  async saveCheckpoint(checkpoint: CanonicalResearchJobCheckpoint) {
    this.#assertBoundary(checkpoint);
    await this.#writeMutable(
      artifactPath("checkpoint", checkpoint.logicalJobId),
      "checkpoint",
      checkpoint
    );
  }

  async saveProjection(projection: CanonicalResearchProjection) {
    this.#assertBoundary(projection);
    await this.#writeMutable(
      artifactPath("projection", projection.logicalJobId),
      "projection",
      projection
    );
  }

  async loadCheckpoint(logicalJobId: string) {
    return (
      await this.#readEnvelope<CanonicalResearchJobCheckpoint>(
        artifactPath("checkpoint", logicalJobId),
        "checkpoint"
      )
    )?.payload;
  }

  async loadResult(logicalJobId: string) {
    const envelope = await this.#readEnvelope<CanonicalResearchResultArtifact>(
      artifactPath("result", logicalJobId),
      "result"
    );
    if (!envelope) return undefined;
    const verification = await verifyCanonicalResearchResultArtifact(
      envelope.payload
    );
    if (!verification.valid) {
      await this.#quarantine({
        artifactKind: "result",
        logicalJobId,
        artifactId: envelope.payload.resultArtifactId,
        expectedPayloadHash: verification.expectedPayloadHash,
        receivedPayloadHash: envelope.payload.payloadHash,
        blockers: ["result_artifact_hash_mismatch"]
      });
      throw new CanonicalResearchRepositoryError(["result_artifact_hash_mismatch"]);
    }
    return envelope.payload;
  }

  async loadProjection(logicalJobId: string) {
    return (
      await this.#readEnvelope<CanonicalResearchProjection>(
        artifactPath("projection", logicalJobId),
        "projection"
      )
    )?.payload;
  }

  async loadLineageNodes() {
    return this.#loadDirectory<CanonicalLineageNodeReference>("nodes", "node");
  }

  async loadRelationships() {
    return this.#loadDirectory<CanonicalLineageEdge>(
      "relationships",
      "relationship"
    );
  }

  async loadStages(logicalJobId: string) {
    const directory = `stages/${toFileKey(logicalJobId)}`;
    const files = await this.#options.storage.listFiles(directory);
    const stages: CanonicalResearchStageArtifact[] = [];
    for (const file of [...files].sort()) {
      const envelope = await this.#readEnvelope<CanonicalResearchStageArtifact>(
        `${directory}/${file}`,
        "stage"
      );
      if (!envelope) continue;
      const verification = await verifyCanonicalResearchStageArtifact(
        envelope.payload
      );
      if (!verification.valid) {
        await this.#quarantine({
          artifactKind: "stage",
          logicalJobId,
          artifactId: envelope.payload.stageArtifactId,
          expectedPayloadHash: verification.expectedPayloadHash,
          receivedPayloadHash: envelope.payload.payloadHash,
          blockers: ["stage_artifact_hash_mismatch"]
        });
        throw new CanonicalResearchRepositoryError(["stage_artifact_hash_mismatch"]);
      }
      stages.push(envelope.payload);
    }
    return Object.freeze(stages);
  }

  async removeCheckpointForRecoveryTest(logicalJobId: string) {
    await this.#options.storage.removeFile(
      artifactPath("checkpoint", logicalJobId)
    );
  }

  async removeProjectionForRecoveryTest(logicalJobId: string) {
    await this.#options.storage.removeFile(
      artifactPath("projection", logicalJobId)
    );
  }

  async listQuarantineRecords() {
    const files = await this.#options.storage.listFiles("quarantines");
    const records: CanonicalResearchQuarantineRecord[] = [];
    for (const file of [...files].sort()) {
      const envelope = await this.#readEnvelope<CanonicalResearchQuarantineRecord>(
        `quarantines/${file}`,
        "quarantine",
        false
      );
      if (envelope) records.push(envelope.payload);
    }
    return Object.freeze(records);
  }

  async #writeImmutable<T extends CanonicalResearchRepositoryPayload>(
    path: string,
    kind: CanonicalResearchArtifactKind,
    payload: T
  ) {
    const existing = await this.#readEnvelope<T>(
      path,
      kind,
      kind !== "quarantine"
    );
    const envelope = await this.#createEnvelope(kind, payload);
    if (existing) {
      if (existing.integrityHash === envelope.integrityHash) {
        return Object.freeze({ disposition: "coalesced" as const });
      }
      await this.#quarantine({
        artifactKind: kind,
        logicalJobId: this.#logicalJobIdOf(payload),
        artifactId: this.#artifactIdOf(payload),
        expectedPayloadHash: existing.integrityHash,
        receivedPayloadHash: envelope.integrityHash,
        blockers: ["immutable_artifact_payload_conflict"]
      });
      throw new CanonicalResearchRepositoryError([
        "immutable_artifact_payload_conflict"
      ]);
    }
    await this.#writeEnvelope(path, envelope);
    return Object.freeze({ disposition: "created" as const });
  }

  async #loadDirectory<T extends CanonicalResearchRepositoryPayload>(
    directory: string,
    kind: CanonicalResearchArtifactKind
  ) {
    const files = await this.#options.storage.listFiles(directory);
    const payloads: T[] = [];
    for (const file of [...files].sort()) {
      const envelope = await this.#readEnvelope<T>(
        `${directory}/${file}`,
        kind
      );
      if (envelope) payloads.push(envelope.payload);
    }
    return Object.freeze(payloads);
  }

  async #writeMutable<T extends CanonicalResearchRepositoryPayload>(
    path: string,
    kind: CanonicalResearchArtifactKind,
    payload: T
  ) {
    const envelope = await this.#createEnvelope(kind, payload);
    await this.#writeEnvelope(path, envelope);
  }

  async #createEnvelope<T extends CanonicalResearchRepositoryPayload>(
    artifactKind: CanonicalResearchArtifactKind,
    payload: T
  ): Promise<CanonicalResearchRepositoryEnvelope<T>> {
    const integrityHash = await canonicalHash(payload);
    return Object.freeze({
      repositorySchemaVersion: CANONICAL_RESEARCH_REPOSITORY_SCHEMA_VERSION,
      profileId: this.#options.profileId,
      artifactKind,
      integrityHash,
      payload
    });
  }

  async #writeEnvelope<T>(
    path: string,
    envelope: CanonicalResearchRepositoryEnvelope<T>
  ) {
    const serialized = canonicalSerialize(envelope);
    if (textEncoder.encode(serialized).byteLength > this.#options.maxArtifactBytes) {
      throw new CanonicalResearchRepositoryError(["repository_artifact_too_large"]);
    }
    let attempt = 0;
    for (;;) {
      try {
        await this.#options.storage.writeTextAtomic(path, serialized);
        return;
      } catch (error) {
        const code =
          error && typeof error === "object" && "code" in error
            ? (error as { readonly code?: unknown }).code
            : undefined;
        if (
          typeof code !== "string" ||
          !retryableStorageCodes.has(code) ||
          attempt >= this.#options.atomicWriteRetries
        ) {
          throw error;
        }
        attempt += 1;
      }
    }
  }

  async #readEnvelope<T>(
    path: string,
    expectedKind: CanonicalResearchArtifactKind,
    quarantineCorruption = true
  ): Promise<CanonicalResearchRepositoryEnvelope<T> | undefined> {
    const raw = await this.#options.storage.readText(path);
    if (raw === undefined) return undefined;
    if (textEncoder.encode(raw).byteLength > this.#options.maxArtifactBytes) {
      throw new CanonicalResearchRepositoryError(["repository_artifact_too_large"]);
    }
    let envelope: CanonicalResearchRepositoryEnvelope<T>;
    try {
      envelope = JSON.parse(raw) as CanonicalResearchRepositoryEnvelope<T>;
    } catch {
      if (quarantineCorruption) {
        await this.#quarantine({
          artifactKind: expectedKind,
          blockers: ["repository_artifact_invalid_json"]
        });
      }
      throw new CanonicalResearchRepositoryError([
        "repository_artifact_invalid_json"
      ]);
    }
    if (
      envelope.repositorySchemaVersion !==
        CANONICAL_RESEARCH_REPOSITORY_SCHEMA_VERSION ||
      envelope.profileId !== this.#options.profileId ||
      envelope.artifactKind !== expectedKind
    ) {
      throw new CanonicalResearchRepositoryError([
        "repository_artifact_envelope_mismatch"
      ]);
    }
    const expectedHash = await canonicalHash(envelope.payload);
    if (expectedHash !== envelope.integrityHash) {
      if (quarantineCorruption) {
        await this.#quarantine({
          artifactKind: expectedKind,
          expectedPayloadHash: expectedHash,
          receivedPayloadHash: envelope.integrityHash,
          blockers: ["repository_artifact_integrity_mismatch"]
        });
      }
      throw new CanonicalResearchRepositoryError([
        "repository_artifact_integrity_mismatch"
      ]);
    }
    return envelope;
  }

  async #quarantine(
    input: Omit<CanonicalResearchQuarantineRecord, "quarantineId" | "recordedAt" | "authority">
  ) {
    const recordedAt = this.#options.now();
    const core = {
      recordedAt,
      artifactKind: input.artifactKind,
      ...(input.logicalJobId ? { logicalJobId: input.logicalJobId } : {}),
      ...(input.artifactId ? { artifactId: input.artifactId } : {}),
      ...(input.expectedPayloadHash
        ? { expectedPayloadHash: input.expectedPayloadHash }
        : {}),
      ...(input.receivedPayloadHash
        ? { receivedPayloadHash: input.receivedPayloadHash }
        : {}),
      blockers: sortedUnique(input.blockers),
      authority: CANONICAL_RESEARCH_AUTHORITY_NONE
    };
    const quarantineId = await canonicalHash(core);
    const record: CanonicalResearchQuarantineRecord = Object.freeze({
      quarantineId,
      ...core
    });
    await this.#writeMutable(
      artifactPath("quarantine", quarantineId),
      "quarantine",
      record
    );
  }

  #assertBoundary(value: {
    readonly authority?: unknown;
    readonly capabilities?: unknown;
  }) {
    const blockers = validateCanonicalResearchBoundary(value);
    if (blockers.length > 0) {
      throw new CanonicalResearchRepositoryError(blockers);
    }
  }

  #logicalJobIdOf(payload: CanonicalResearchRepositoryPayload) {
    if ("logicalJobId" in payload && typeof payload.logicalJobId === "string") {
      return payload.logicalJobId;
    }
    if ("identity" in payload && isPlainObject(payload.identity)) {
      const value = payload.identity.logicalJobId;
      return typeof value === "string" ? value : undefined;
    }
    return undefined;
  }

  #artifactIdOf(payload: CanonicalResearchRepositoryPayload) {
    if ("stageArtifactId" in payload) return payload.stageArtifactId;
    if ("resultArtifactId" in payload) return payload.resultArtifactId;
    if ("quarantineId" in payload) return payload.quarantineId;
    if ("lineageNodeKey" in payload) return payload.lineageNodeKey;
    if ("edgeId" in payload) return payload.edgeId;
    return undefined;
  }
}

export const CANONICAL_RESEARCH_REPOSITORY_BOUNDARY = Object.freeze({
  authority: CANONICAL_RESEARCH_AUTHORITY_NONE,
  capabilities: CANONICAL_RESEARCH_CAPABILITIES_DISABLED,
  runtimeIntegrationAllowed: false,
  schedulerRegistrationAllowed: false,
  evidenceCreationAllowed: false,
  readinessChangeAllowed: false,
  productionAdoptionAllowed: false
});
