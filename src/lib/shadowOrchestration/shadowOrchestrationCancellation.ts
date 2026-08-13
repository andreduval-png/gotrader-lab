import { canonicalHash, V2_CANONICAL_HASH_VERSION } from "../canonical/canonicalValueSerialization";
import {
  SHADOW_CANCELLATION_SCHEMA,
  SHADOW_ORCHESTRATION_AUTHORITY,
  SHADOW_QUARANTINE_SCHEMA,
  type ShadowOrchestrationCancellation,
  type ShadowOrchestrationLease,
  type ShadowOrchestrationQuarantine
} from "./shadowOrchestrationTypes";
import { assertCurrentShadowLease, validateShadowOrchestrationLease } from "./shadowOrchestrationLease";

const HASH = /^sha256:[0-9a-f]{64}$/;
const OWNER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const REASON = /^[A-Za-z0-9][A-Za-z0-9._: -]{0,255}$/;
const canonicalTime = (value: string) => Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;

export async function buildShadowOrchestrationCancellation(input: Readonly<{
  current: Readonly<ShadowOrchestrationLease>;
  proof: Readonly<ShadowOrchestrationLease>;
  ownerId: string;
  requestedAt: string;
  reason: string;
}>) {
  await assertCurrentShadowLease({ proof: input.proof, current: input.current, ownerId: input.ownerId, at: input.requestedAt });
  if (!REASON.test(input.reason)) throw new Error("Shadow cancellation reason is invalid.");
  const core = Object.freeze({
    schemaVersion: SHADOW_CANCELLATION_SCHEMA,
    cancellationVersion: "v1" as const,
    hashVersion: V2_CANONICAL_HASH_VERSION,
    logicalJobId: input.current.logicalJobId,
    leaseId: input.current.leaseId,
    ownerId: input.ownerId,
    leaseEpoch: input.current.epoch,
    requestedAt: input.requestedAt,
    reason: input.reason,
    shadowOnly: true as const,
    runtimeAdoptionAllowed: false as const,
    authority: SHADOW_ORCHESTRATION_AUTHORITY
  });
  return Object.freeze({ ...core, cancellationId: await canonicalHash(core) }) as Readonly<ShadowOrchestrationCancellation>;
}

export async function validateShadowOrchestrationCancellation(value: Readonly<ShadowOrchestrationCancellation>) {
  if (value.schemaVersion !== SHADOW_CANCELLATION_SCHEMA || value.cancellationVersion !== "v1" ||
      value.hashVersion !== V2_CANONICAL_HASH_VERSION || !HASH.test(value.logicalJobId) || !HASH.test(value.leaseId) ||
      !HASH.test(value.cancellationId) || !OWNER.test(value.ownerId) || !Number.isInteger(value.leaseEpoch) || value.leaseEpoch < 1 ||
      !canonicalTime(value.requestedAt) || !REASON.test(value.reason) || value.shadowOnly !== true ||
      value.runtimeAdoptionAllowed !== false || value.authority.executionAuthority !== "none" ||
      value.authority.brokerAuthority !== "none" || value.authority.readinessOverrideAuthority !== "none") return false;
  const { cancellationId: _id, ...core } = value;
  return await canonicalHash(core) === value.cancellationId;
}

export async function buildShadowOrchestrationQuarantine(input: Readonly<{
  proof: Readonly<ShadowOrchestrationLease>;
  current?: Readonly<ShadowOrchestrationLease>;
  ownerId: string;
  attemptedAction: ShadowOrchestrationQuarantine["attemptedAction"];
  blocker: string;
  quarantinedAt: string;
}>) {
  if (!await validateShadowOrchestrationLease(input.proof) || (input.current && !await validateShadowOrchestrationLease(input.current)) ||
      !OWNER.test(input.ownerId) || !REASON.test(input.blocker) || !canonicalTime(input.quarantinedAt)) {
    throw new Error("Shadow quarantine evidence input is invalid.");
  }
  const core = Object.freeze({
    schemaVersion: SHADOW_QUARANTINE_SCHEMA,
    quarantineVersion: "v1" as const,
    hashVersion: V2_CANONICAL_HASH_VERSION,
    logicalJobId: input.proof.logicalJobId,
    rejectedLeaseId: input.proof.leaseId,
    currentLeaseId: input.current?.leaseId ?? input.proof.leaseId,
    ownerId: input.ownerId,
    attemptedAction: input.attemptedAction,
    blocker: input.blocker,
    quarantinedAt: input.quarantinedAt,
    shadowOnly: true as const,
    runtimeAdoptionAllowed: false as const,
    authority: SHADOW_ORCHESTRATION_AUTHORITY
  });
  return Object.freeze({ ...core, quarantineId: await canonicalHash(core) }) as Readonly<ShadowOrchestrationQuarantine>;
}

export async function validateShadowOrchestrationQuarantine(value: Readonly<ShadowOrchestrationQuarantine>) {
  if (value.schemaVersion !== SHADOW_QUARANTINE_SCHEMA || value.quarantineVersion !== "v1" ||
      value.hashVersion !== V2_CANONICAL_HASH_VERSION || !HASH.test(value.logicalJobId) || !HASH.test(value.rejectedLeaseId) ||
      !HASH.test(value.currentLeaseId) || !HASH.test(value.quarantineId) || !OWNER.test(value.ownerId) ||
      !["checkpoint_advance", "terminal_seal", "cancellation"].includes(value.attemptedAction) || !REASON.test(value.blocker) ||
      !canonicalTime(value.quarantinedAt) || value.shadowOnly !== true || value.runtimeAdoptionAllowed !== false ||
      value.authority.executionAuthority !== "none" || value.authority.brokerAuthority !== "none" ||
      value.authority.readinessOverrideAuthority !== "none") return false;
  const { quarantineId: _id, ...core } = value;
  return await canonicalHash(core) === value.quarantineId;
}
