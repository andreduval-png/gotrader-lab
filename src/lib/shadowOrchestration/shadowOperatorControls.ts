import { canonicalHash, V2_CANONICAL_HASH_VERSION } from "../canonical/canonicalValueSerialization";
import type { ShadowDispatchReceipt, ShadowScheduleQueueEntry } from "./shadowScheduler";
import type { ShadowOrchestrationCancellation, ShadowOrchestrationLease, ShadowOrchestrationQuarantine, ShadowOrchestrationCheckpoint, ShadowOperatorProjection, ShadowTerminalSeal } from "./shadowOrchestrationTypes";

export const SHADOW_OPERATOR_SNAPSHOT_SCHEMA = "gotrader-v2-shadow-operator-snapshot-v1" as const;
export const SHADOW_OPERATOR_COMMAND_SCHEMA = "gotrader-v2-shadow-operator-command-v1" as const;
export const SHADOW_OPERATOR_COMMAND_RECEIPT_SCHEMA = "gotrader-v2-shadow-operator-command-receipt-v1" as const;
export type ShadowOperatorCommandAction = "inspect" | "tick" | "pause" | "resume" | "stop" | "cancel";

const HASH = /^sha256:[0-9a-f]{64}$/;
const OWNER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const canonicalTime = (value: string) => Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const without = <T extends Record<string, unknown>>(value: T, key: keyof T) => { const copy = { ...value }; delete copy[key]; return copy; };

export interface ShadowOperatorSnapshot {
  schemaVersion: typeof SHADOW_OPERATOR_SNAPSHOT_SCHEMA;
  hashVersion: typeof V2_CANONICAL_HASH_VERSION;
  logicalJobId: string;
  observedAt: string;
  evidenceUpdatedAt: string;
  freshness: "fresh" | "stale" | "unavailable";
  schedulerState: "idle" | "running" | "paused" | "stopped" | "unavailable";
  queueDepth: number;
  queuedResourceUnits: number;
  activeLeaseId: string;
  activeOwnerId: string;
  cancellationId: string;
  quarantineCount: number;
  checkpointId: string;
  completedStageCount: number;
  totalStageCount: number;
  terminalSealId: string;
  terminalProjectionId: string;
  dispatchReceiptCount: number;
  latestDispatchReceiptId: string;
  blockers: readonly string[];
  shadowOnly: true;
  runtimeAdoptionAllowed: false;
  snapshotId: string;
}

export interface ShadowOperatorCommand {
  schemaVersion: typeof SHADOW_OPERATOR_COMMAND_SCHEMA;
  hashVersion: typeof V2_CANONICAL_HASH_VERSION;
  action: ShadowOperatorCommandAction;
  logicalJobId: string;
  operatorId: string;
  expectedLeaseId: string;
  requestedAt: string;
  reason: string;
  confirmationToken: string;
  shadowOnly: true;
  runtimeAdoptionAllowed: false;
  commandId: string;
}

export interface ShadowOperatorCommandReceipt {
  schemaVersion: typeof SHADOW_OPERATOR_COMMAND_RECEIPT_SCHEMA;
  hashVersion: typeof V2_CANONICAL_HASH_VERSION;
  commandId: string;
  logicalJobId: string;
  action: ShadowOperatorCommandAction;
  completedAt: string;
  status: "succeeded" | "rejected";
  resultIdentity: string;
  blocker: string;
  shadowOnly: true;
  runtimeAdoptionAllowed: false;
  receiptId: string;
}

export async function buildShadowOperatorSnapshot(input: Readonly<{
  logicalJobId: string; observedAt: string; evidenceUpdatedAt?: string; staleAfterMs: number;
  schedulerState?: ShadowOperatorSnapshot["schedulerState"];
  queue?: readonly Readonly<ShadowScheduleQueueEntry>[]; receipts?: readonly Readonly<ShadowDispatchReceipt>[];
  lease?: Readonly<ShadowOrchestrationLease>; cancellation?: Readonly<ShadowOrchestrationCancellation>;
  quarantines?: readonly Readonly<ShadowOrchestrationQuarantine>[]; checkpoint?: Readonly<ShadowOrchestrationCheckpoint>;
  seal?: Readonly<ShadowTerminalSeal>; projection?: Readonly<ShadowOperatorProjection>; blockers?: readonly string[];
}>) {
  if (!HASH.test(input.logicalJobId) || !canonicalTime(input.observedAt) || !Number.isInteger(input.staleAfterMs) || input.staleAfterMs < 1) throw new Error("Shadow operator snapshot input is invalid.");
  const queue = (input.queue ?? []).filter((entry) => entry.logicalJobId === input.logicalJobId && entry.status === "queued");
  const receipts = (input.receipts ?? []).filter((entry) => entry.logicalJobId === input.logicalJobId).sort((a, b) => a.dispatchedAt.localeCompare(b.dispatchedAt) || a.receiptId.localeCompare(b.receiptId));
  const evidenceUpdatedAt = input.evidenceUpdatedAt ?? "";
  const age = evidenceUpdatedAt ? Date.parse(input.observedAt) - Date.parse(evidenceUpdatedAt) : Number.POSITIVE_INFINITY;
  const freshness = !evidenceUpdatedAt ? "unavailable" : age >= 0 && age <= input.staleAfterMs ? "fresh" : "stale";
  const leaseActive = input.lease?.status === "active" && Date.parse(input.lease.expiresAt) > Date.parse(input.observedAt);
  const blockers = [...new Set([...(input.blockers ?? []), ...(!leaseActive && input.lease ? ["shadow_operator_lease_inactive"] : []), ...(freshness === "stale" ? ["shadow_operator_evidence_stale"] : []), ...(freshness === "unavailable" ? ["shadow_operator_evidence_unavailable"] : [])])].sort();
  const core = Object.freeze({ schemaVersion: SHADOW_OPERATOR_SNAPSHOT_SCHEMA, hashVersion: V2_CANONICAL_HASH_VERSION,
    logicalJobId: input.logicalJobId, observedAt: input.observedAt, evidenceUpdatedAt, freshness,
    schedulerState: input.schedulerState ?? "unavailable", queueDepth: queue.length,
    queuedResourceUnits: queue.reduce((sum, item) => sum + item.estimatedResourceUnits, 0),
    activeLeaseId: leaseActive ? input.lease!.leaseId : "", activeOwnerId: leaseActive ? input.lease!.ownerId : "",
    cancellationId: input.cancellation?.cancellationId ?? "", quarantineCount: input.quarantines?.length ?? 0,
    checkpointId: input.checkpoint?.checkpointId ?? "", completedStageCount: input.checkpoint?.orderedStageArtifactIds.length ?? 0,
    totalStageCount: input.projection?.totalStageCount ?? input.checkpoint?.nextStageOrdinal ?? 0,
    terminalSealId: input.seal?.terminalSealId ?? "", terminalProjectionId: input.projection?.projectionId ?? "",
    dispatchReceiptCount: receipts.length, latestDispatchReceiptId: receipts.at(-1)?.receiptId ?? "", blockers: Object.freeze(blockers),
    shadowOnly: true as const, runtimeAdoptionAllowed: false as const });
  return Object.freeze({ ...core, snapshotId: await canonicalHash(core) }) as Readonly<ShadowOperatorSnapshot>;
}

export async function validateShadowOperatorSnapshot(value: Readonly<ShadowOperatorSnapshot>) {
  return value.schemaVersion === SHADOW_OPERATOR_SNAPSHOT_SCHEMA && value.hashVersion === V2_CANONICAL_HASH_VERSION && HASH.test(value.logicalJobId) && HASH.test(value.snapshotId) && canonicalTime(value.observedAt) &&
    value.shadowOnly === true && value.runtimeAdoptionAllowed === false && await canonicalHash(without(value as unknown as Record<string, unknown>, "snapshotId")) === value.snapshotId;
}

export const shadowOperatorConfirmationToken = (action: "stop" | "cancel", logicalJobId: string, expectedLeaseId: string) => `confirm:${action}:${logicalJobId}:${expectedLeaseId}`;

export async function buildShadowOperatorCommand(input: Readonly<{ action: ShadowOperatorCommandAction; logicalJobId: string; operatorId: string; expectedLeaseId?: string; requestedAt: string; reason?: string; confirmationToken?: string }>) {
  if (!HASH.test(input.logicalJobId) || !OWNER.test(input.operatorId) || !canonicalTime(input.requestedAt) || (input.expectedLeaseId && !HASH.test(input.expectedLeaseId))) throw new Error("Shadow operator command input is invalid.");
  if (input.action === "cancel" && input.confirmationToken !== shadowOperatorConfirmationToken("cancel", input.logicalJobId, input.expectedLeaseId ?? "")) throw new Error("Shadow operator cancellation confirmation is invalid.");
  if (input.action === "stop" && input.confirmationToken !== shadowOperatorConfirmationToken("stop", input.logicalJobId, input.expectedLeaseId ?? "")) throw new Error("Shadow operator stop confirmation is invalid.");
  const core = Object.freeze({ schemaVersion: SHADOW_OPERATOR_COMMAND_SCHEMA, hashVersion: V2_CANONICAL_HASH_VERSION, action: input.action,
    logicalJobId: input.logicalJobId, operatorId: input.operatorId, expectedLeaseId: input.expectedLeaseId ?? "", requestedAt: input.requestedAt,
    reason: input.reason ?? "", confirmationToken: input.confirmationToken ?? "", shadowOnly: true as const, runtimeAdoptionAllowed: false as const });
  return Object.freeze({ ...core, commandId: await canonicalHash(core) }) as Readonly<ShadowOperatorCommand>;
}

export async function validateShadowOperatorCommand(value: Readonly<ShadowOperatorCommand>) {
  const destructiveConfirmationValid = value.action === "cancel" || value.action === "stop"
    ? value.confirmationToken === shadowOperatorConfirmationToken(value.action, value.logicalJobId, value.expectedLeaseId)
    : value.confirmationToken === "";
  return value.schemaVersion === SHADOW_OPERATOR_COMMAND_SCHEMA && value.hashVersion === V2_CANONICAL_HASH_VERSION &&
    ["inspect", "tick", "pause", "resume", "stop", "cancel"].includes(value.action) && HASH.test(value.commandId) &&
    HASH.test(value.logicalJobId) && (!value.expectedLeaseId || HASH.test(value.expectedLeaseId)) && OWNER.test(value.operatorId) &&
    canonicalTime(value.requestedAt) && destructiveConfirmationValid && value.shadowOnly && !value.runtimeAdoptionAllowed &&
    await canonicalHash(without(value as unknown as Record<string, unknown>, "commandId")) === value.commandId;
}

export async function validateShadowOperatorCommandReceipt(value: Readonly<ShadowOperatorCommandReceipt>) {
  return value.schemaVersion === SHADOW_OPERATOR_COMMAND_RECEIPT_SCHEMA && value.hashVersion === V2_CANONICAL_HASH_VERSION &&
    HASH.test(value.commandId) && HASH.test(value.logicalJobId) && HASH.test(value.receiptId) && canonicalTime(value.completedAt) &&
    ["inspect", "tick", "pause", "resume", "stop", "cancel"].includes(value.action) && ["succeeded", "rejected"].includes(value.status) &&
    (!value.resultIdentity || HASH.test(value.resultIdentity)) && value.shadowOnly && !value.runtimeAdoptionAllowed &&
    await canonicalHash(without(value as unknown as Record<string, unknown>, "receiptId")) === value.receiptId;
}

export interface ShadowOperatorCommandRepository {
  claim(command: Readonly<ShadowOperatorCommand>): Promise<"claimed" | "in_progress" | Readonly<ShadowOperatorCommandReceipt>>;
  complete(command: Readonly<ShadowOperatorCommand>, receipt: Readonly<ShadowOperatorCommandReceipt>): Promise<void>;
}

export class InMemoryShadowOperatorCommandRepository implements ShadowOperatorCommandRepository {
  readonly claims = new Map<string, Readonly<ShadowOperatorCommand>>(); readonly receipts = new Map<string, Readonly<ShadowOperatorCommandReceipt>>();
  async claim(command: Readonly<ShadowOperatorCommand>) { const receipt = this.receipts.get(command.commandId); if (receipt) return receipt; if (this.claims.has(command.commandId)) return "in_progress" as const; this.claims.set(command.commandId, command); return "claimed" as const; }
  async complete(command: Readonly<ShadowOperatorCommand>, receipt: Readonly<ShadowOperatorCommandReceipt>) { if (!await validateShadowOperatorCommandReceipt(receipt) || receipt.commandId !== command.commandId || !this.claims.has(command.commandId) || this.receipts.has(command.commandId)) throw new Error("Shadow operator command completion conflict."); this.receipts.set(command.commandId, receipt); }
}

async function buildReceipt(command: Readonly<ShadowOperatorCommand>, completedAt: string, status: ShadowOperatorCommandReceipt["status"], resultIdentity: string, blocker: string) {
  const core = Object.freeze({ schemaVersion: SHADOW_OPERATOR_COMMAND_RECEIPT_SCHEMA, hashVersion: V2_CANONICAL_HASH_VERSION, commandId: command.commandId,
    logicalJobId: command.logicalJobId, action: command.action, completedAt, status, resultIdentity, blocker, shadowOnly: true as const, runtimeAdoptionAllowed: false as const });
  return Object.freeze({ ...core, receiptId: await canonicalHash(core) }) as Readonly<ShadowOperatorCommandReceipt>;
}

export class ManualShadowOperatorController {
  constructor(private readonly repository: ShadowOperatorCommandRepository, private readonly handlers: Readonly<Record<ShadowOperatorCommandAction, (command: Readonly<ShadowOperatorCommand>) => Promise<Readonly<{ resultIdentity?: string; blocker?: string }>> | Readonly<{ resultIdentity?: string; blocker?: string }>>>) {}
  async execute(command: Readonly<ShadowOperatorCommand>, completedAt: string) {
    if (!await validateShadowOperatorCommand(command) || !canonicalTime(completedAt) || Date.parse(completedAt) < Date.parse(command.requestedAt)) throw new Error("Shadow operator command execution input is invalid.");
    const claim = await this.repository.claim(command); if (claim !== "claimed") return Object.freeze({ status: typeof claim === "string" ? claim : "coalesced" as const, ...(typeof claim === "string" ? {} : { receipt: claim }) });
    let result: Readonly<{ resultIdentity?: string; blocker?: string }>;
    try { const handler = this.handlers[command.action]; if (!handler) throw new Error("shadow_operator_command_handler_unavailable"); result = await handler(command); } catch (error) { result = { blocker: error instanceof Error ? error.message : "shadow_operator_command_failed" }; }
    const receipt = await buildReceipt(command, completedAt, result.blocker ? "rejected" : "succeeded", result.resultIdentity ?? "", result.blocker ?? "");
    await this.repository.complete(command, receipt); return Object.freeze({ status: receipt.status, receipt });
  }
}
