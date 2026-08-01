import { canonicalHash } from "../../v2/serialization/canonicalSerialization";
import {
  CANONICAL_RESEARCH_AUTHORITY_NONE,
  CANONICAL_RESEARCH_CAPABILITIES_DISABLED
} from "../authority/canonicalResearchAuthority";
import {
  CANONICAL_RESEARCH_CHECKPOINT_SCHEMA_VERSION,
  CANONICAL_RESEARCH_PROJECTION_SCHEMA_VERSION,
  CANONICAL_RESEARCH_RESULT_SCHEMA_VERSION,
  CANONICAL_RESEARCH_STAGE_SCHEMA_VERSION,
  type CanonicalResearchJobCheckpoint,
  type CanonicalResearchJobIdentity,
  type CanonicalResearchJobRequest,
  type CanonicalResearchProjection,
  type CanonicalResearchResultArtifact,
  type CanonicalResearchStageArtifact,
  type CanonicalResearchStageName
} from "../contracts/canonicalResearchTypes";
import {
  CANONICAL_LINEAGE_EDGE_SCHEMA_VERSION,
  CANONICAL_LINEAGE_GRAPH_SCHEMA_VERSION,
  CANONICAL_LINEAGE_NODE_REFERENCE_SCHEMA_VERSION,
  type CanonicalLineageEdge,
  type CanonicalLineageNodeReference,
  type CanonicalLineageNodeType
} from "../contracts/canonicalLineageTypes";
import { validateCanonicalResearchSeal } from "../contracts/canonicalResearchValidation";
import {
  createCanonicalResearchResultArtifact,
  createCanonicalResearchStageArtifact
} from "../identity/canonicalResearchArtifactIdentity";
import {
  deriveCanonicalLineageEdgeIdentity,
  deriveCanonicalLineageNodeKey
} from "../identity/canonicalResearchIdentity";
import { CanonicalResearchFileRepository } from "../repository/canonicalResearchFileRepository";

const B1_1_CONTEXT_STAGE_SEQUENCE = Object.freeze<readonly CanonicalResearchStageName[]>([
  "job_admission",
  "input_verification",
  "context_rebuild",
  "context_identity_verification",
  "result_validation",
  "result_seal",
  "projection_update"
]);

export interface CanonicalResearchEngineOptions {
  readonly repository: CanonicalResearchFileRepository;
  readonly leaseOwner: string;
  readonly leaseDurationMs?: number;
  readonly now?: () => string;
  readonly afterStage?: (
    artifact: CanonicalResearchStageArtifact,
    engine: CanonicalResearchEngine
  ) => void | Promise<void>;
}

export interface CanonicalResearchEngineRunResult {
  readonly status:
    | "completed"
    | "blocked"
    | "cancelled"
    | "expired";
  readonly identity: CanonicalResearchJobIdentity;
  readonly admissionDisposition: string;
  readonly resumed: boolean;
  readonly checkpoint: CanonicalResearchJobCheckpoint;
  readonly result?: CanonicalResearchResultArtifact;
  readonly blockers: readonly string[];
}

const stageIndex = (stage: CanonicalResearchStageName | "queued") =>
  stage === "queued" ? -1 : B1_1_CONTEXT_STAGE_SEQUENCE.indexOf(stage);

const nextStageAfter = (stage: CanonicalResearchStageName | "queued") =>
  B1_1_CONTEXT_STAGE_SEQUENCE[stageIndex(stage) + 1];

const contextIdentityMatchesArtifact = (request: CanonicalResearchJobRequest) =>
  request.contextArtifactId.replace(/^v2-context:/, "sha256:") ===
  request.contextIdentity;

export class CanonicalResearchEngine {
  readonly #repository: CanonicalResearchFileRepository;
  readonly #leaseOwner: string;
  readonly #leaseDurationMs: number;
  readonly #now: () => string;
  readonly #afterStage?: CanonicalResearchEngineOptions["afterStage"];

  constructor(options: CanonicalResearchEngineOptions) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(options.leaseOwner)) {
      throw new Error("Canonical research lease owner is invalid.");
    }
    this.#repository = options.repository;
    this.#leaseOwner = options.leaseOwner;
    this.#leaseDurationMs = options.leaseDurationMs ?? 60_000;
    this.#now = options.now ?? (() => new Date().toISOString());
    this.#afterStage = options.afterStage;
  }

  async run(input: unknown): Promise<CanonicalResearchEngineRunResult> {
    const admission = await this.#repository.admitRequest(input);
    const { identity } = admission;
    if (!admission.accepted) {
      const checkpoint = this.#checkpoint({
        logicalJobId: identity.logicalJobId,
        status: "blocked",
        currentStage: "job_admission",
        completedStageArtifactIds: [],
        retryCount: 0,
        blocker: admission.blockers[0],
        nextAction: "Review the quarantined request conflict before resubmission."
      });
      return Object.freeze({
        status: "blocked",
        identity,
        admissionDisposition: admission.disposition,
        resumed: false,
        checkpoint,
        blockers: admission.blockers
      });
    }

    const request = admission.identity.identityCore.jobType === "context_lineage"
      ? (input as CanonicalResearchJobRequest)
      : undefined;
    if (!request || request.jobType !== "context_lineage") {
      const checkpoint = this.#checkpoint({
        logicalJobId: identity.logicalJobId,
        status: "blocked",
        currentStage: "job_admission",
        completedStageArtifactIds: [],
        retryCount: 0,
        blocker: "job_type_not_enabled_b1_1",
        nextAction: "Use the fixture-only context-lineage job until a later milestone is authorized."
      });
      await this.#repository.saveCheckpoint(checkpoint);
      return Object.freeze({
        status: "blocked",
        identity,
        admissionDisposition: admission.disposition,
        resumed: false,
        checkpoint,
        blockers: Object.freeze(["job_type_not_enabled_b1_1"])
      });
    }

    const existingResult = await this.#repository.loadResult(identity.logicalJobId);
    if (existingResult) {
      const stages = await this.#repository.loadStages(identity.logicalJobId);
      const resultSealStage = stages
        .filter((stage) => stage.stageName === "result_seal")
        .sort((left, right) => right.attemptNumber - left.attemptNumber)[0];
      if (resultSealStage) {
        await this.#ensureLineage(
          request ?? (input as CanonicalResearchJobRequest),
          existingResult,
          resultSealStage.stageArtifactId
        );
      }
      const checkpoint = await this.rebuildCheckpoint(identity.logicalJobId);
      return Object.freeze({
        status: "completed",
        identity,
        admissionDisposition: admission.disposition,
        resumed: true,
        checkpoint,
        result: existingResult,
        blockers: Object.freeze([])
      });
    }

    let checkpoint =
      (await this.#repository.loadCheckpoint(identity.logicalJobId)) ??
      (await this.rebuildCheckpoint(identity.logicalJobId));
    const resumableExpiredLease =
      checkpoint.status === "expired" &&
      [
        "job_lease_expired_before_seal",
        "job_foreign_lease_before_seal"
      ].includes(checkpoint.blocker ?? "");
    if (
      ["cancelled", "blocked", "failed", "expired"].includes(
        checkpoint.status
      ) &&
      !resumableExpiredLease
    ) {
      return Object.freeze({
        status:
          checkpoint.status === "cancelled"
            ? "cancelled"
            : checkpoint.status === "expired"
              ? "expired"
              : "blocked",
        identity,
        admissionDisposition: admission.disposition,
        resumed: checkpoint.completedStageArtifactIds.length > 0,
        checkpoint,
        blockers: Object.freeze(checkpoint.blocker ? [checkpoint.blocker] : [])
      });
    }

    const leaseAt = this.#now();
    if (
      checkpoint.leaseOwner &&
      checkpoint.leaseOwner !== this.#leaseOwner &&
      checkpoint.leaseExpiresAt &&
      Date.parse(checkpoint.leaseExpiresAt) >= Date.parse(leaseAt)
    ) {
      return Object.freeze({
        status: "blocked",
        identity,
        admissionDisposition: admission.disposition,
        resumed: checkpoint.completedStageArtifactIds.length > 0,
        checkpoint,
        blockers: Object.freeze(["job_lease_held_by_other_worker"])
      });
    }

    const existingStages = await this.#repository.loadStages(identity.logicalJobId);
    const completedByName = new Map<
      CanonicalResearchStageName,
      CanonicalResearchStageArtifact
    >();
    for (const stage of existingStages) {
      const current = completedByName.get(stage.stageName);
      if (!current || stage.attemptNumber > current.attemptNumber) {
        completedByName.set(stage.stageName, stage);
      }
    }
    if (!existingResult) {
      completedByName.delete("result_seal");
      completedByName.delete("projection_update");
    }
    const attemptNumber =
      existingStages.reduce(
        (maximum, stage) => Math.max(maximum, stage.attemptNumber),
        0
      ) + 1;
    const attemptId = `b1-attempt:${(await canonicalHash({
      logicalJobId: identity.logicalJobId,
      leaseOwner: this.#leaseOwner,
      attemptNumber,
      leaseAt
    })).slice("sha256:".length)}`;
    const leaseExpiresAt = new Date(
      Date.parse(leaseAt) + this.#leaseDurationMs
    ).toISOString();
    checkpoint = this.#checkpoint({
      ...checkpoint,
      status: "running",
      retryCount: Math.max(0, attemptNumber - 1),
      leaseOwner: this.#leaseOwner,
      leaseExpiresAt,
      lastHeartbeatAt: leaseAt,
      nextAction: "Continue the first incomplete deterministic stage."
    });
    await this.#repository.saveCheckpoint(checkpoint);

    let previousStageArtifactId =
      existingStages
        .slice()
        .sort((left, right) => stageIndex(left.stageName) - stageIndex(right.stageName))
        .at(-1)?.stageArtifactId ?? `b1-genesis:${identity.logicalJobId}`;
    let result: CanonicalResearchResultArtifact | undefined;
    const resumed = existingStages.length > 0;

    for (const stageName of B1_1_CONTEXT_STAGE_SEQUENCE) {
      if (completedByName.has(stageName)) continue;

      const latest = await this.#repository.loadCheckpoint(identity.logicalJobId);
      if (latest?.status === "cancelled") {
        return Object.freeze({
          status: "cancelled",
          identity,
          admissionDisposition: admission.disposition,
          resumed,
          checkpoint: latest,
          blockers: Object.freeze(["job_cancelled_before_stage"])
        });
      }

      const startedAt = this.#now();
      const stageOutcome = this.#runContextStage(stageName, request);
      const completedAt = this.#now();
      const stageArtifact = await createCanonicalResearchStageArtifact({
        schemaVersion: CANONICAL_RESEARCH_STAGE_SCHEMA_VERSION,
        stageName,
        stageVersion: "gotrader-b1-1-fixture-context-lineage-v1",
        logicalJobId: identity.logicalJobId,
        attemptId,
        attemptNumber,
        inputArtifactIds: Object.freeze([
          identity.logicalJobId,
          request.contextArtifactId,
          request.contextIdentity
        ]),
        previousStageArtifactId,
        startedAt,
        completedAt,
        status: stageOutcome.blockers.length > 0 ? "blocked" : "completed",
        outputSummary: Object.freeze(stageOutcome.outputSummary),
        blockers: Object.freeze(stageOutcome.blockers),
        warnings: Object.freeze([]),
        policyVersions: Object.freeze({
          admission: "live_admission_v1",
          context: "live_context_v1",
          safety: "gotrader-b1-authority-matrix-v1",
          seal: "artifact_seal_v1"
        }),
        authority: CANONICAL_RESEARCH_AUTHORITY_NONE,
        capabilities: CANONICAL_RESEARCH_CAPABILITIES_DISABLED
      });
      await this.#repository.appendStage(stageArtifact);
      completedByName.set(stageName, stageArtifact);
      previousStageArtifactId = stageArtifact.stageArtifactId;

      checkpoint = this.#checkpoint({
        logicalJobId: identity.logicalJobId,
        status: stageArtifact.status === "blocked" ? "blocked" : "running",
        currentStage: stageName,
        completedStageArtifactIds: [...completedByName.values()]
          .sort((left, right) => stageIndex(left.stageName) - stageIndex(right.stageName))
          .map((stage) => stage.stageArtifactId),
        pendingNextStage: nextStageAfter(stageName),
        retryCount: Math.max(0, attemptNumber - 1),
        leaseOwner: this.#leaseOwner,
        leaseExpiresAt,
        lastHeartbeatAt: completedAt,
        blocker: stageArtifact.blockers[0],
        nextAction:
          stageArtifact.status === "blocked"
            ? "Resolve the deterministic context-lineage blocker."
            : "Continue the next deterministic stage."
      });
      await this.#repository.saveCheckpoint(checkpoint);
      if (this.#afterStage) await this.#afterStage(stageArtifact, this);

      if (stageArtifact.status === "blocked") {
        return Object.freeze({
          status: "blocked",
          identity,
          admissionDisposition: admission.disposition,
          resumed,
          checkpoint,
          blockers: stageArtifact.blockers
        });
      }

      if (stageName === "result_seal") {
        const latestBeforeSeal =
          (await this.#repository.loadCheckpoint(identity.logicalJobId)) ?? checkpoint;
        const sealAt = this.#now();
        const seal = validateCanonicalResearchSeal(latestBeforeSeal, sealAt);
        if (!seal.allowed || latestBeforeSeal.leaseOwner !== this.#leaseOwner) {
          const blockers = sortedUnique([
            ...seal.blockers,
            ...(latestBeforeSeal.leaseOwner !== this.#leaseOwner
              ? ["job_foreign_lease_before_seal"]
              : [])
          ]);
          checkpoint = this.#checkpoint({
            ...latestBeforeSeal,
            status: latestBeforeSeal.status === "cancelled" ? "cancelled" : "expired",
            blocker: blockers[0],
            nextAction: "Acquire a fresh lease and resume from immutable stages."
          });
          await this.#repository.saveCheckpoint(checkpoint);
          return Object.freeze({
            status: checkpoint.status === "cancelled" ? "cancelled" : "expired",
            identity,
            admissionDisposition: admission.disposition,
            resumed,
            checkpoint,
            blockers: Object.freeze(blockers)
          });
        }
        const contextNodeKey = await canonicalHash({
          graphSchemaVersion: CANONICAL_LINEAGE_GRAPH_SCHEMA_VERSION,
          ownerNamespace: "gotrader.v2.context",
          nodeType: "canonical_context",
          canonicalArtifactId: request.contextArtifactId
        });
        result = await createCanonicalResearchResultArtifact({
          schemaVersion: CANONICAL_RESEARCH_RESULT_SCHEMA_VERSION,
          identity,
          classification: "context_lineage_verified",
          sealedAt: sealAt,
          causalTimestamps: Object.freeze({
            requestedAt: request.requestedAt,
            sealedAt: sealAt
          }),
          diagnostics: Object.freeze(["fixture_context_identity_verified"]),
          blockers: Object.freeze([]),
          sourceLineageNodeKeys: Object.freeze([]),
          contextLineageNodeKeys: Object.freeze([contextNodeKey]),
          shadowOnly: true,
          canCreateEvidence: false,
          readinessChanged: false,
          productionAdoptionAllowed: false,
          authority: CANONICAL_RESEARCH_AUTHORITY_NONE,
          capabilities: CANONICAL_RESEARCH_CAPABILITIES_DISABLED
        });
        await this.#repository.appendResult(result);
        await this.#ensureLineage(request, result, stageArtifact.stageArtifactId);
      }

      if (stageName === "projection_update" && result) {
        await this.#repository.saveProjection(
          this.#completedProjection(
            result,
            checkpoint.completedStageArtifactIds
          )
        );
      }
    }

    checkpoint = this.#checkpoint({
      logicalJobId: identity.logicalJobId,
      status: "completed",
      currentStage: "projection_update",
      completedStageArtifactIds: [...completedByName.values()]
        .sort((left, right) => stageIndex(left.stageName) - stageIndex(right.stageName))
        .map((stage) => stage.stageArtifactId),
      retryCount: Math.max(0, attemptNumber - 1),
      nextAction: "Retain compact shadow lineage for audit; no downstream action is authorized."
    });
    await this.#repository.saveCheckpoint(checkpoint);
    if (result) {
      await this.#repository.saveProjection(
        this.#completedProjection(result, checkpoint.completedStageArtifactIds)
      );
    }
    return Object.freeze({
      status: "completed",
      identity,
      admissionDisposition: admission.disposition,
      resumed,
      checkpoint,
      result,
      blockers: Object.freeze([])
    });
  }

  async cancelJob(logicalJobId: string, cancelledAt = this.#now()) {
    const checkpoint =
      (await this.#repository.loadCheckpoint(logicalJobId)) ??
      (await this.rebuildCheckpoint(logicalJobId));
    const cancelled = this.#checkpoint({
      ...checkpoint,
      status: "cancelled",
      cancelRequestedAt: cancelledAt,
      blocker: "job_cancelled_by_operator",
      nextAction: "Create a new logical request if research should be reconsidered."
    });
    await this.#repository.saveCheckpoint(cancelled);
    return cancelled;
  }

  async rebuildCheckpoint(logicalJobId: string) {
    const [stages, result] = await Promise.all([
      this.#repository.loadStages(logicalJobId),
      this.#repository.loadResult(logicalJobId)
    ]);
    const stageByName = new Map<
      CanonicalResearchStageName,
      CanonicalResearchStageArtifact
    >();
    for (const stage of stages) {
      const current = stageByName.get(stage.stageName);
      if (!current || stage.attemptNumber > current.attemptNumber) {
        stageByName.set(stage.stageName, stage);
      }
    }
    const orderedStages = [...stageByName.values()].sort(
      (left, right) => stageIndex(left.stageName) - stageIndex(right.stageName)
    );
    const lastStage = orderedStages.at(-1);
    const checkpoint = this.#checkpoint({
      logicalJobId,
      status: result ? "completed" : "queued",
      currentStage: lastStage?.stageName ?? "queued",
      completedStageArtifactIds: orderedStages.map(
        (stage) => stage.stageArtifactId
      ),
      pendingNextStage: result
        ? undefined
        : nextStageAfter(lastStage?.stageName ?? "queued"),
      retryCount: Math.max(
        0,
        ...orderedStages.map((stage) => stage.attemptNumber - 1)
      ),
      nextAction: result
        ? "Checkpoint rebuilt from sealed immutable result and stages."
        : "Checkpoint rebuilt; acquire a new lease and resume."
    });
    await this.#repository.saveCheckpoint(checkpoint);
    if (result) {
      await this.#repository.saveProjection(
        this.#completedProjection(result, checkpoint.completedStageArtifactIds)
      );
    }
    return checkpoint;
  }

  async #ensureLineage(
    request: CanonicalResearchJobRequest,
    result: CanonicalResearchResultArtifact,
    creationStageId: string
  ) {
    const requestNode = await this.#lineageNode({
      ownerNamespace: "gotrader.b1.research",
      nodeType: "research_request",
      canonicalArtifactId: result.identity.logicalJobId,
      ownerPayloadHash: result.identity.payloadHash,
      sealedAt: request.requestedAt
    });
    const contextNode = await this.#lineageNode({
      ownerNamespace: "gotrader.v2.context",
      nodeType: "canonical_context",
      canonicalArtifactId: request.contextArtifactId,
      ownerPayloadHash: request.contextIdentity,
      sealedAt: request.requestedAt,
      nodeClass: "external_authoritative"
    });
    const resultNode = await this.#lineageNode({
      ownerNamespace: "gotrader.b1.research",
      nodeType: "research_result",
      canonicalArtifactId: result.resultArtifactId,
      ownerPayloadHash: result.payloadHash,
      sealedAt: result.sealedAt
    });
    for (const node of [requestNode, contextNode, resultNode]) {
      await this.#repository.appendLineageNode(node);
    }
    await this.#repository.appendRelationship(
      await this.#lineageEdge({
        relationshipType: "consumed_by",
        relationshipCategory: "required_causal",
        parentNodeKey: contextNode.lineageNodeKey,
        childNodeKey: requestNode.lineageNodeKey,
        creationStageId,
        logicalJobId: result.identity.logicalJobId
      })
    );
    await this.#repository.appendRelationship(
      await this.#lineageEdge({
        relationshipType: "produced",
        relationshipCategory: "required_causal",
        parentNodeKey: requestNode.lineageNodeKey,
        childNodeKey: resultNode.lineageNodeKey,
        creationStageId,
        logicalJobId: result.identity.logicalJobId
      })
    );
  }

  async #lineageNode(input: {
    readonly ownerNamespace: string;
    readonly nodeType: CanonicalLineageNodeType;
    readonly canonicalArtifactId: string;
    readonly ownerPayloadHash: string;
    readonly sealedAt: string;
    readonly nodeClass?: CanonicalLineageNodeReference["nodeClass"];
  }): Promise<CanonicalLineageNodeReference> {
    const identity = {
      graphSchemaVersion: CANONICAL_LINEAGE_GRAPH_SCHEMA_VERSION,
      ownerNamespace: input.ownerNamespace,
      nodeType: input.nodeType,
      canonicalArtifactId: input.canonicalArtifactId
    } as const;
    return Object.freeze({
      nodeReferenceSchemaVersion:
        CANONICAL_LINEAGE_NODE_REFERENCE_SCHEMA_VERSION,
      ...identity,
      lineageNodeKey: await deriveCanonicalLineageNodeKey(identity),
      nodeClass: input.nodeClass ?? "owned_immutable",
      ownerContractVersion: "gotrader-b1-1-fixture-context-lineage-v1",
      ownerPayloadHash: input.ownerPayloadHash,
      lifecycleStatus: "sealed",
      retentionClass: "b1_fixture_audit",
      integrityStatus: "verified",
      sealedAt: input.sealedAt,
      authority: CANONICAL_RESEARCH_AUTHORITY_NONE,
      capabilities: CANONICAL_RESEARCH_CAPABILITIES_DISABLED
    });
  }

  async #lineageEdge(input: {
    readonly relationshipType: CanonicalLineageEdge["relationshipType"];
    readonly relationshipCategory: CanonicalLineageEdge["relationshipCategory"];
    readonly parentNodeKey: string;
    readonly childNodeKey: string;
    readonly creationStageId: string;
    readonly logicalJobId: string;
  }): Promise<CanonicalLineageEdge> {
    const core: Omit<CanonicalLineageEdge, "edgeId" | "payloadHash"> = {
      graphSchemaVersion: CANONICAL_LINEAGE_GRAPH_SCHEMA_VERSION,
      edgeSchemaVersion: CANONICAL_LINEAGE_EDGE_SCHEMA_VERSION,
      relationshipType: input.relationshipType,
      relationshipVersion: "gotrader-b1-lineage-relationship-v1",
      parentNodeKey: input.parentNodeKey,
      childNodeKey: input.childNodeKey,
      creationStageId: input.creationStageId,
      identityMetadata: Object.freeze({ logicalJobId: input.logicalJobId }),
      relationshipCategory: input.relationshipCategory,
      integrityStatus: "verified" as const,
      authority: CANONICAL_RESEARCH_AUTHORITY_NONE,
      capabilities: CANONICAL_RESEARCH_CAPABILITIES_DISABLED
    };
    const identity = await deriveCanonicalLineageEdgeIdentity(core);
    return Object.freeze({ ...core, ...identity });
  }

  #completedProjection(
    result: CanonicalResearchResultArtifact,
    stageArtifactIds: readonly string[]
  ): CanonicalResearchProjection {
    return Object.freeze({
      schemaVersion: CANONICAL_RESEARCH_PROJECTION_SCHEMA_VERSION,
      logicalJobId: result.identity.logicalJobId,
      status: "completed",
      currentStage: "projection_update",
      sourceStatus: "available",
      resultClassification: result.classification,
      blockers: Object.freeze([]),
      nextAction:
        "B1.1 fixture-only context lineage is complete; no promotion is permitted.",
      artifactIds: Object.freeze([
        ...new Set([...stageArtifactIds, result.resultArtifactId])
      ]),
      freshness: "fresh",
      shadowOnly: true,
      authority: CANONICAL_RESEARCH_AUTHORITY_NONE,
      capabilities: CANONICAL_RESEARCH_CAPABILITIES_DISABLED
    });
  }

  #runContextStage(
    stageName: CanonicalResearchStageName,
    request: CanonicalResearchJobRequest
  ) {
    if (
      stageName === "context_identity_verification" &&
      !contextIdentityMatchesArtifact(request)
    ) {
      return {
        outputSummary: { contextIdentityMatch: false },
        blockers: ["context_identity_mismatch"]
      };
    }
    const summaries: Record<
      CanonicalResearchStageName,
      Readonly<Record<string, string | boolean>>
    > = {
      job_admission: { requestAccepted: true },
      input_verification: { compactInputVerified: true },
      context_rebuild: {
        contextArtifactId: request.contextArtifactId,
        boundedFixtureHandler: true
      },
      context_identity_verification: { contextIdentityMatch: true },
      adapter_detection: { adapterEnabled: false },
      result_validation: { classificationValidated: true },
      result_seal: { sealBoundaryChecked: true },
      projection_update: { compactProjectionBuilt: true }
    };
    return { outputSummary: summaries[stageName], blockers: [] };
  }

  #checkpoint(
    input: Omit<
      CanonicalResearchJobCheckpoint,
      "schemaVersion" | "authority" | "capabilities"
    >
  ): CanonicalResearchJobCheckpoint {
    const {
      pendingNextStage,
      cancelRequestedAt,
      leaseOwner,
      leaseExpiresAt,
      lastHeartbeatAt,
      blocker,
      ...required
    } = input;
    return Object.freeze({
      schemaVersion: CANONICAL_RESEARCH_CHECKPOINT_SCHEMA_VERSION,
      ...required,
      completedStageArtifactIds: Object.freeze([
        ...input.completedStageArtifactIds
      ]),
      ...(pendingNextStage ? { pendingNextStage } : {}),
      ...(cancelRequestedAt ? { cancelRequestedAt } : {}),
      ...(leaseOwner ? { leaseOwner } : {}),
      ...(leaseExpiresAt ? { leaseExpiresAt } : {}),
      ...(lastHeartbeatAt ? { lastHeartbeatAt } : {}),
      ...(blocker ? { blocker } : {}),
      authority: CANONICAL_RESEARCH_AUTHORITY_NONE,
      capabilities: CANONICAL_RESEARCH_CAPABILITIES_DISABLED
    });
  }
}

const sortedUnique = (values: readonly string[]) =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right));

export const CANONICAL_RESEARCH_B1_1_BOUNDARY = Object.freeze({
  stageSequence: B1_1_CONTEXT_STAGE_SEQUENCE,
  fixtureOnly: true,
  runtimeIntegrationAllowed: false,
  schedulerRegistrationAllowed: false,
  liveEventConsumptionAllowed: false,
  strategyExecutionAllowed: false,
  evidenceCreationAllowed: false,
  readinessChangeAllowed: false,
  memoryProjectionAllowed: false,
  brokerAccessAllowed: false,
  productionAdoptionAllowed: false,
  authority: CANONICAL_RESEARCH_AUTHORITY_NONE,
  capabilities: CANONICAL_RESEARCH_CAPABILITIES_DISABLED
});
