import { canonicalHash, V2_CANONICAL_HASH_VERSION } from "../canonical/canonicalValueSerialization";
import {
  SHADOW_LEASE_SCHEMA,
  SHADOW_ORCHESTRATION_AUTHORITY,
  type ShadowOrchestrationLease
} from "./shadowOrchestrationTypes";

const HASH = /^sha256:[0-9a-f]{64}$/;
const OWNER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const GENESIS = "sha256:0000000000000000000000000000000000000000000000000000000000000000";
const canonicalTime = (value: string) => Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;

const buildLease = async (input: Omit<ShadowOrchestrationLease,
  "schemaVersion" | "leaseVersion" | "hashVersion" | "shadowOnly" | "runtimeAdoptionAllowed" | "authority" | "leaseId">) => {
  const core = Object.freeze({
    schemaVersion: SHADOW_LEASE_SCHEMA,
    leaseVersion: "v1" as const,
    hashVersion: V2_CANONICAL_HASH_VERSION,
    ...input,
    shadowOnly: true as const,
    runtimeAdoptionAllowed: false as const,
    authority: SHADOW_ORCHESTRATION_AUTHORITY
  });
  return Object.freeze({ ...core, leaseId: await canonicalHash(core) }) as Readonly<ShadowOrchestrationLease>;
};

export async function validateShadowOrchestrationLease(lease: Readonly<ShadowOrchestrationLease>) {
  if (lease.schemaVersion !== SHADOW_LEASE_SCHEMA || lease.leaseVersion !== "v1" ||
      lease.hashVersion !== V2_CANONICAL_HASH_VERSION || lease.shadowOnly !== true ||
      lease.runtimeAdoptionAllowed !== false || lease.authority.executionAuthority !== "none" ||
      lease.authority.brokerAuthority !== "none" || lease.authority.readinessOverrideAuthority !== "none" ||
      !HASH.test(lease.logicalJobId) || !HASH.test(lease.previousLeaseId) || !HASH.test(lease.leaseId) ||
      !OWNER.test(lease.ownerId) || !Number.isInteger(lease.epoch) || lease.epoch < 1 ||
      !canonicalTime(lease.acquiredAt) || !canonicalTime(lease.expiresAt) ||
      Date.parse(lease.expiresAt) <= Date.parse(lease.acquiredAt) || !["active", "released"].includes(lease.status) ||
      (lease.status === "active" && lease.releasedAt !== undefined) ||
      (lease.status === "released" && (!lease.releasedAt || !canonicalTime(lease.releasedAt)))) return false;
  const { leaseId: _leaseId, ...core } = lease;
  return await canonicalHash(core) === lease.leaseId;
}

const assertRequest = (logicalJobId: string, ownerId: string, at: string) => {
  if (!HASH.test(logicalJobId)) throw new Error("Shadow lease logical job identity is invalid.");
  if (!OWNER.test(ownerId)) throw new Error("Shadow lease owner identity is invalid.");
  if (!canonicalTime(at)) throw new Error("Shadow lease time is invalid.");
};

export async function acquireShadowOrchestrationLease(input: Readonly<{
  logicalJobId: string;
  ownerId: string;
  acquiredAt: string;
  durationMs: number;
  current?: Readonly<ShadowOrchestrationLease>;
}>) {
  assertRequest(input.logicalJobId, input.ownerId, input.acquiredAt);
  if (!Number.isInteger(input.durationMs) || input.durationMs < 1_000 || input.durationMs > 3_600_000) {
    throw new Error("Shadow lease duration is outside the bounded range.");
  }
  const current = input.current;
  if (current && (!await validateShadowOrchestrationLease(current) || current.logicalJobId !== input.logicalJobId)) {
    throw new Error("Shadow lease head is invalid.");
  }
  if (current?.status === "active" && Date.parse(current.expiresAt) >= Date.parse(input.acquiredAt)) {
    if (current.ownerId !== input.ownerId) return Object.freeze({ status: "blocked" as const, blocker: "shadow_lease_held_by_foreign_owner" as const, lease: current });
    return Object.freeze({ status: "coalesced" as const, lease: current });
  }
  const lease = await buildLease({
    logicalJobId: input.logicalJobId,
    ownerId: input.ownerId,
    epoch: (current?.epoch ?? 0) + 1,
    acquiredAt: input.acquiredAt,
    expiresAt: new Date(Date.parse(input.acquiredAt) + input.durationMs).toISOString(),
    previousLeaseId: current?.leaseId ?? GENESIS,
    status: "active"
  });
  return Object.freeze({ status: current ? "taken_over" as const : "acquired" as const, lease });
}

export async function renewShadowOrchestrationLease(input: Readonly<{
  current: Readonly<ShadowOrchestrationLease>;
  ownerId: string;
  renewedAt: string;
  durationMs: number;
}>) {
  assertRequest(input.current.logicalJobId, input.ownerId, input.renewedAt);
  if (!await validateShadowOrchestrationLease(input.current)) throw new Error("Shadow lease head is invalid.");
  if (input.current.status !== "active" || input.current.ownerId !== input.ownerId) throw new Error("Shadow lease renewal rejects a foreign or released lease.");
  if (Date.parse(input.renewedAt) > Date.parse(input.current.expiresAt)) throw new Error("Shadow lease renewal rejects an expired lease.");
  if (!Number.isInteger(input.durationMs) || input.durationMs < 1_000 || input.durationMs > 3_600_000) throw new Error("Shadow lease duration is outside the bounded range.");
  return buildLease({
    logicalJobId: input.current.logicalJobId,
    ownerId: input.ownerId,
    epoch: input.current.epoch + 1,
    acquiredAt: input.renewedAt,
    expiresAt: new Date(Date.parse(input.renewedAt) + input.durationMs).toISOString(),
    previousLeaseId: input.current.leaseId,
    status: "active"
  });
}

export async function releaseShadowOrchestrationLease(current: Readonly<ShadowOrchestrationLease>, ownerId: string, releasedAt: string) {
  assertRequest(current.logicalJobId, ownerId, releasedAt);
  if (!await validateShadowOrchestrationLease(current)) throw new Error("Shadow lease head is invalid.");
  if (current.status === "released") {
    if (current.ownerId !== ownerId) throw new Error("Shadow lease release rejects a foreign owner.");
    return current;
  }
  if (current.ownerId !== ownerId) throw new Error("Shadow lease release rejects a foreign owner.");
  return buildLease({
    logicalJobId: current.logicalJobId,
    ownerId,
    epoch: current.epoch,
    acquiredAt: current.acquiredAt,
    expiresAt: current.expiresAt,
    previousLeaseId: current.leaseId,
    status: "released",
    releasedAt
  });
}

export async function assertCurrentShadowLease(input: Readonly<{
  proof: Readonly<ShadowOrchestrationLease>;
  current?: Readonly<ShadowOrchestrationLease>;
  ownerId: string;
  at: string;
}>) {
  assertRequest(input.proof.logicalJobId, input.ownerId, input.at);
  if (!input.current || !await validateShadowOrchestrationLease(input.current) || !await validateShadowOrchestrationLease(input.proof)) {
    throw new Error("Shadow lease proof is missing or invalid.");
  }
  if (input.current.leaseId !== input.proof.leaseId || input.current.ownerId !== input.ownerId || input.current.status !== "active") {
    throw new Error("Shadow lease proof is stale, foreign, or released.");
  }
  if (Date.parse(input.at) > Date.parse(input.current.expiresAt)) throw new Error("Shadow lease proof is expired.");
  return true;
}

export class InMemoryShadowLeaseCoordinator {
  readonly #heads = new Map<string, Readonly<ShadowOrchestrationLease>>();
  async acquire(input: Omit<Parameters<typeof acquireShadowOrchestrationLease>[0], "current">) {
    const result = await acquireShadowOrchestrationLease({ ...input, current: this.#heads.get(input.logicalJobId) });
    if (result.status !== "blocked") this.#heads.set(input.logicalJobId, result.lease);
    return result;
  }
  async renew(input: Omit<Parameters<typeof renewShadowOrchestrationLease>[0], "current"> & { logicalJobId: string }) {
    const current = this.#heads.get(input.logicalJobId);
    if (!current) throw new Error("Shadow lease renewal requires a current lease.");
    const lease = await renewShadowOrchestrationLease({ current, ownerId: input.ownerId, renewedAt: input.renewedAt, durationMs: input.durationMs });
    this.#heads.set(input.logicalJobId, lease);
    return lease;
  }
  async release(logicalJobId: string, ownerId: string, releasedAt: string) {
    const current = this.#heads.get(logicalJobId);
    if (!current) throw new Error("Shadow lease release requires a current lease.");
    const lease = await releaseShadowOrchestrationLease(current, ownerId, releasedAt);
    this.#heads.set(logicalJobId, lease);
    return lease;
  }
  read(logicalJobId: string) { return this.#heads.get(logicalJobId); }
}
