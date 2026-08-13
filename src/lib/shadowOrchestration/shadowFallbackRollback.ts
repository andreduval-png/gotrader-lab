import { canonicalHash, V2_CANONICAL_HASH_VERSION } from "../canonical/canonicalValueSerialization";
import { validateShadowCheckpoint } from "./shadowOrchestrationEngine";
import type { ShadowOrchestrationCheckpoint } from "./shadowOrchestrationTypes";

export const SHADOW_ROLLBACK_PREVIEW_SCHEMA = "gotrader-v2-shadow-rollback-preview-v1" as const;
export const SHADOW_ROLLBACK_RECEIPT_SCHEMA = "gotrader-v2-shadow-rollback-receipt-v1" as const;
const HASH = /^sha256:[0-9a-f]{64}$/; const OWNER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const canonicalTime = (value: string) => Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const without = <T extends Record<string, unknown>>(value: T, key: keyof T) => { const copy = { ...value }; delete copy[key]; return copy; };

export interface ShadowRollbackPreview {
  schemaVersion: typeof SHADOW_ROLLBACK_PREVIEW_SCHEMA; hashVersion: typeof V2_CANONICAL_HASH_VERSION;
  logicalJobId: string; expectedCurrentCheckpointId: string; targetCheckpointId: string;
  targetHeartbeatSequence: number; rollbackDepth: number; ownerId: string; expectedLeaseId: string;
  observedAt: string; preservedCheckpointCount: number; preservedArtifactCount: number;
  targetTerminalSealId: string; targetProjectionId: string; confirmationToken: string;
  shadowOnly: true; legacyResearchCycleAuthoritative: true; runtimeAdoptionAllowed: false; previewId: string;
}
export interface ShadowRollbackReceipt {
  schemaVersion: typeof SHADOW_ROLLBACK_RECEIPT_SCHEMA; hashVersion: typeof V2_CANONICAL_HASH_VERSION;
  previewId: string; logicalJobId: string; previousCheckpointId: string; targetCheckpointId: string;
  ownerId: string; leaseId: string; appliedAt: string; status: "applied";
  shadowOnly: true; legacyResearchCycleAuthoritative: true; runtimeAdoptionAllowed: false; receiptId: string;
}
export const shadowRollbackConfirmationToken = (logicalJobId: string, current: string, target: string, leaseId: string) => `confirm:rollback:${logicalJobId}:${current}:${target}:${leaseId}`;

export async function buildShadowRollbackPreview(input: Readonly<{ logicalJobId: string; currentCheckpointId: string; targetCheckpointId: string; checkpoints: readonly Readonly<ShadowOrchestrationCheckpoint>[]; ownerId: string; expectedLeaseId: string; observedAt: string; maxDepth: number; preservedArtifactCount: number; targetTerminalSealId?: string; targetProjectionId?: string }>) {
  if (!HASH.test(input.logicalJobId) || !HASH.test(input.currentCheckpointId) || !HASH.test(input.targetCheckpointId) || !HASH.test(input.expectedLeaseId) || !OWNER.test(input.ownerId) || !canonicalTime(input.observedAt) || !Number.isInteger(input.maxDepth) || input.maxDepth < 1 || input.maxDepth > 32 || !Number.isInteger(input.preservedArtifactCount) || input.preservedArtifactCount < 0) throw new Error("Shadow rollback preview input is invalid.");
  const byId = new Map(input.checkpoints.map((value) => [value.checkpointId, value]));
  for (const checkpoint of input.checkpoints) if (!await validateShadowCheckpoint(checkpoint) || checkpoint.logicalJobId !== input.logicalJobId) throw new Error("Shadow rollback checkpoint evidence is invalid.");
  let cursor = byId.get(input.currentCheckpointId); if (!cursor) throw new Error("Shadow rollback current checkpoint is unavailable.");
  let depth = 0; while (cursor.checkpointId !== input.targetCheckpointId && depth < input.maxDepth) { cursor = byId.get(cursor.previousCheckpointId); depth += 1; if (!cursor) throw new Error("Shadow rollback target is not a preserved ancestor."); }
  if (cursor.checkpointId !== input.targetCheckpointId || depth < 1) throw new Error(depth < 1 ? "Shadow rollback target must precede current head." : "Shadow rollback depth exceeds bound.");
  const sealId = input.targetTerminalSealId ?? ""; const projectionId = input.targetProjectionId ?? "";
  if (Boolean(sealId) !== Boolean(projectionId) || (sealId && (!HASH.test(sealId) || !HASH.test(projectionId) || cursor.terminalStatus === undefined)) || (!sealId && cursor.terminalStatus !== undefined)) throw new Error("Shadow rollback terminal evidence is incomplete.");
  const confirmationToken = shadowRollbackConfirmationToken(input.logicalJobId, input.currentCheckpointId, input.targetCheckpointId, input.expectedLeaseId);
  const core = Object.freeze({ schemaVersion: SHADOW_ROLLBACK_PREVIEW_SCHEMA, hashVersion: V2_CANONICAL_HASH_VERSION, logicalJobId: input.logicalJobId, expectedCurrentCheckpointId: input.currentCheckpointId, targetCheckpointId: input.targetCheckpointId, targetHeartbeatSequence: cursor.heartbeatSequence, rollbackDepth: depth, ownerId: input.ownerId, expectedLeaseId: input.expectedLeaseId, observedAt: input.observedAt, preservedCheckpointCount: input.checkpoints.length, preservedArtifactCount: input.preservedArtifactCount, targetTerminalSealId: sealId, targetProjectionId: projectionId, confirmationToken, shadowOnly: true as const, legacyResearchCycleAuthoritative: true as const, runtimeAdoptionAllowed: false as const });
  return Object.freeze({ ...core, previewId: await canonicalHash(core) }) as Readonly<ShadowRollbackPreview>;
}
export async function validateShadowRollbackPreview(value: Readonly<ShadowRollbackPreview>) { return value.schemaVersion === SHADOW_ROLLBACK_PREVIEW_SCHEMA && value.hashVersion === V2_CANONICAL_HASH_VERSION && HASH.test(value.previewId) && value.confirmationToken === shadowRollbackConfirmationToken(value.logicalJobId, value.expectedCurrentCheckpointId, value.targetCheckpointId, value.expectedLeaseId) && value.rollbackDepth >= 1 && value.rollbackDepth <= 32 && value.shadowOnly && value.legacyResearchCycleAuthoritative && !value.runtimeAdoptionAllowed && await canonicalHash(without(value as unknown as Record<string, unknown>, "previewId")) === value.previewId; }
export async function buildShadowRollbackReceipt(preview: Readonly<ShadowRollbackPreview>, appliedAt: string) { if (!await validateShadowRollbackPreview(preview) || !canonicalTime(appliedAt) || Date.parse(appliedAt) < Date.parse(preview.observedAt)) throw new Error("Shadow rollback receipt input is invalid."); const core = Object.freeze({ schemaVersion: SHADOW_ROLLBACK_RECEIPT_SCHEMA, hashVersion: V2_CANONICAL_HASH_VERSION, previewId: preview.previewId, logicalJobId: preview.logicalJobId, previousCheckpointId: preview.expectedCurrentCheckpointId, targetCheckpointId: preview.targetCheckpointId, ownerId: preview.ownerId, leaseId: preview.expectedLeaseId, appliedAt, status: "applied" as const, shadowOnly: true as const, legacyResearchCycleAuthoritative: true as const, runtimeAdoptionAllowed: false as const }); return Object.freeze({ ...core, receiptId: await canonicalHash(core) }) as Readonly<ShadowRollbackReceipt>; }
export async function validateShadowRollbackReceipt(value: Readonly<ShadowRollbackReceipt>) { return value.schemaVersion === SHADOW_ROLLBACK_RECEIPT_SCHEMA && value.hashVersion === V2_CANONICAL_HASH_VERSION && HASH.test(value.receiptId) && HASH.test(value.previewId) && canonicalTime(value.appliedAt) && value.status === "applied" && value.shadowOnly && value.legacyResearchCycleAuthoritative && !value.runtimeAdoptionAllowed && await canonicalHash(without(value as unknown as Record<string, unknown>, "receiptId")) === value.receiptId; }
