import { canonicalHash } from "../../v2/serialization/canonicalSerialization";
import type {
  CanonicalResearchProjection,
  CanonicalResearchResultArtifact,
  CanonicalResearchStageArtifact
} from "../contracts/canonicalResearchTypes";

export type CanonicalResearchStageArtifactCore = Omit<
  CanonicalResearchStageArtifact,
  "stageArtifactId" | "payloadHash"
>;

export async function createCanonicalResearchStageArtifact(
  core: CanonicalResearchStageArtifactCore
): Promise<CanonicalResearchStageArtifact> {
  const payloadHash = await canonicalHash(core);
  const stageArtifactId = await canonicalHash({
    logicalJobId: core.logicalJobId,
    stageName: core.stageName,
    stageVersion: core.stageVersion,
    attemptNumber: core.attemptNumber,
    inputArtifactIds: core.inputArtifactIds,
    previousStageArtifactId: core.previousStageArtifactId,
    payloadHash
  });
  return Object.freeze({ ...core, stageArtifactId, payloadHash });
}

export async function verifyCanonicalResearchStageArtifact(
  artifact: CanonicalResearchStageArtifact
) {
  const { stageArtifactId, payloadHash, ...core } = artifact;
  const expected = await createCanonicalResearchStageArtifact(core);
  return Object.freeze({
    valid:
      expected.stageArtifactId === stageArtifactId &&
      expected.payloadHash === payloadHash,
    expectedStageArtifactId: expected.stageArtifactId,
    expectedPayloadHash: expected.payloadHash
  });
}

export type CanonicalResearchResultArtifactCore = Omit<
  CanonicalResearchResultArtifact,
  "resultArtifactId" | "payloadHash"
>;

export async function createCanonicalResearchResultArtifact(
  core: CanonicalResearchResultArtifactCore
): Promise<CanonicalResearchResultArtifact> {
  const payloadHash = await canonicalHash(core);
  const resultArtifactId = await canonicalHash({
    logicalJobId: core.identity.logicalJobId,
    classification: core.classification,
    payloadHash
  });
  return Object.freeze({ ...core, resultArtifactId, payloadHash });
}

export async function verifyCanonicalResearchResultArtifact(
  artifact: CanonicalResearchResultArtifact
) {
  const { resultArtifactId, payloadHash, ...core } = artifact;
  const expected = await createCanonicalResearchResultArtifact(core);
  return Object.freeze({
    valid:
      expected.resultArtifactId === resultArtifactId &&
      expected.payloadHash === payloadHash,
    expectedResultArtifactId: expected.resultArtifactId,
    expectedPayloadHash: expected.payloadHash
  });
}

export async function deriveCanonicalResearchProjectionIntegrity(
  projection: CanonicalResearchProjection
) {
  return canonicalHash(projection);
}
