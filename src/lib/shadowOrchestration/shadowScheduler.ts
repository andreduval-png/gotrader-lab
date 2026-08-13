import { canonicalHash, V2_CANONICAL_HASH_VERSION } from "../canonical/canonicalValueSerialization";
import type { BoundedShadowHostRunResult } from "./shadowOrchestrationHost";
import type { ShadowResearchJob, ShadowStageHandler } from "./shadowOrchestrationTypes";

export const SHADOW_SCHEDULE_SCHEMA = "gotrader-v2-shadow-schedule-v1" as const;
export const SHADOW_QUEUE_SCHEMA = "gotrader-v2-shadow-schedule-queue-v1" as const;
export const SHADOW_DISPATCH_RECEIPT_SCHEMA = "gotrader-v2-shadow-dispatch-receipt-v1" as const;

export interface ShadowScheduleDefinition {
  schemaVersion: typeof SHADOW_SCHEDULE_SCHEMA;
  hashVersion: typeof V2_CANONICAL_HASH_VERSION;
  logicalJobId: string;
  anchorAt: string;
  intervalMs: number;
  maxAttempts: number;
  estimatedResourceUnits: number;
  shadowOnly: true;
  automaticStartupAllowed: false;
  scheduleId: string;
}

export interface ShadowScheduleQueueEntry {
  schemaVersion: typeof SHADOW_QUEUE_SCHEMA;
  hashVersion: typeof V2_CANONICAL_HASH_VERSION;
  scheduleId: string;
  logicalJobId: string;
  dueAt: string;
  attemptNumber: number;
  estimatedResourceUnits: number;
  status: "queued" | "settled";
  previousReceiptId: string;
  queueId: string;
}

export interface ShadowDispatchReceipt {
  schemaVersion: typeof SHADOW_DISPATCH_RECEIPT_SCHEMA;
  hashVersion: typeof V2_CANONICAL_HASH_VERSION;
  scheduleId: string;
  queueId: string;
  logicalJobId: string;
  attemptNumber: number;
  dispatchedAt: string;
  resultStatus: BoundedShadowHostRunResult["status"];
  blocker: string;
  checkpointId: string;
  leaseId: string;
  stagesProcessed: number;
  shadowOnly: true;
  runtimeAdoptionAllowed: false;
  receiptId: string;
}

export interface ShadowSchedulerRepository {
  admit(entry: Readonly<ShadowScheduleQueueEntry>, maxQueueDepth: number): Promise<"admitted" | "coalesced" | "queue_full">;
  queued(limit: number): Promise<readonly Readonly<ShadowScheduleQueueEntry>[]>;
  settle(entry: Readonly<ShadowScheduleQueueEntry>, receipt: Readonly<ShadowDispatchReceipt>, retry?: Readonly<ShadowScheduleQueueEntry>): Promise<void>;
  compactSettled(retainCount: number): Promise<number>;
}

export interface ShadowSchedulerConfig {
  maxQueueDepth: number;
  maxDispatchPerTick: number;
  maxResourceUnitsPerTick: number;
  retainSettledQueueEntries: number;
}

const HASH = /^sha256:[0-9a-f]{64}$/;
const validDate = (value: string) => Number.isFinite(Date.parse(value));
const integer = (value: number, minimum: number, maximum: number) => Number.isInteger(value) && value >= minimum && value <= maximum;
const without = <T extends Record<string, unknown>>(value: T, key: keyof T) => { const copy = { ...value }; delete copy[key]; return copy; };

export async function validateShadowScheduleDefinition(value: Readonly<ShadowScheduleDefinition>) {
  return value.schemaVersion === SHADOW_SCHEDULE_SCHEMA && value.hashVersion === V2_CANONICAL_HASH_VERSION &&
    HASH.test(value.logicalJobId) && HASH.test(value.scheduleId) && validDate(value.anchorAt) &&
    integer(value.intervalMs, 1_000, 31_536_000_000) && integer(value.maxAttempts, 1, 3) &&
    integer(value.estimatedResourceUnits, 1, 10_000) && value.shadowOnly === true &&
    value.automaticStartupAllowed === false && await canonicalHash(without(value as unknown as Record<string, unknown>, "scheduleId")) === value.scheduleId;
}

export async function validateShadowScheduleQueueEntry(value: Readonly<ShadowScheduleQueueEntry>) {
  const identity = without(without(value as unknown as Record<string, unknown>, "queueId"), "status");
  return value.schemaVersion === SHADOW_QUEUE_SCHEMA && value.hashVersion === V2_CANONICAL_HASH_VERSION &&
    HASH.test(value.scheduleId) && HASH.test(value.logicalJobId) && HASH.test(value.queueId) && validDate(value.dueAt) &&
    integer(value.attemptNumber, 1, 3) && integer(value.estimatedResourceUnits, 1, 10_000) &&
    ["queued", "settled"].includes(value.status) && (!value.previousReceiptId || HASH.test(value.previousReceiptId)) &&
    await canonicalHash(identity) === value.queueId;
}

export async function validateShadowDispatchReceipt(value: Readonly<ShadowDispatchReceipt>) {
  return value.schemaVersion === SHADOW_DISPATCH_RECEIPT_SCHEMA && value.hashVersion === V2_CANONICAL_HASH_VERSION &&
    HASH.test(value.scheduleId) && HASH.test(value.queueId) && HASH.test(value.logicalJobId) && HASH.test(value.receiptId) &&
    validDate(value.dispatchedAt) && integer(value.attemptNumber, 1, 3) && integer(value.stagesProcessed, 0, 32) &&
    value.shadowOnly === true && value.runtimeAdoptionAllowed === false &&
    await canonicalHash(without(value as unknown as Record<string, unknown>, "receiptId")) === value.receiptId;
}

export function validateShadowSchedulerConfig(config: Readonly<ShadowSchedulerConfig>) {
  if (!integer(config.maxQueueDepth, 1, 256)) throw new Error("Shadow scheduler queue depth is outside bounds.");
  if (!integer(config.maxDispatchPerTick, 1, 16)) throw new Error("Shadow scheduler dispatch budget is outside bounds.");
  if (!integer(config.maxResourceUnitsPerTick, 1, 10_000)) throw new Error("Shadow scheduler resource budget is outside bounds.");
  if (!integer(config.retainSettledQueueEntries, 0, 1_000)) throw new Error("Shadow scheduler retention count is outside bounds.");
  return true;
}

export async function buildShadowScheduleDefinition(input: Readonly<{
  logicalJobId: string;
  anchorAt: string;
  intervalMs: number;
  maxAttempts: number;
  estimatedResourceUnits: number;
}>) {
  if (!HASH.test(input.logicalJobId) || !validDate(input.anchorAt)) throw new Error("Shadow schedule identity or anchor is invalid.");
  if (!integer(input.intervalMs, 1_000, 31_536_000_000)) throw new Error("Shadow schedule interval is outside bounds.");
  if (!integer(input.maxAttempts, 1, 3)) throw new Error("Shadow schedule attempt limit is outside bounds.");
  if (!integer(input.estimatedResourceUnits, 1, 10_000)) throw new Error("Shadow schedule resource estimate is outside bounds.");
  const core = Object.freeze({ schemaVersion: SHADOW_SCHEDULE_SCHEMA, hashVersion: V2_CANONICAL_HASH_VERSION, ...input,
    shadowOnly: true as const, automaticStartupAllowed: false as const });
  return Object.freeze({ ...core, scheduleId: await canonicalHash(core) }) as Readonly<ShadowScheduleDefinition>;
}

export function resolveShadowScheduleDueAt(schedule: Readonly<ShadowScheduleDefinition>, evaluatedAt: string) {
  const anchor = Date.parse(schedule.anchorAt);
  const evaluated = Date.parse(evaluatedAt);
  if (!Number.isFinite(evaluated)) throw new Error("Shadow schedule evaluation time is invalid.");
  if (evaluated < anchor) return undefined;
  return new Date(anchor + Math.floor((evaluated - anchor) / schedule.intervalMs) * schedule.intervalMs).toISOString();
}

export async function buildShadowScheduleQueueEntry(schedule: Readonly<ShadowScheduleDefinition>, dueAt: string, attemptNumber = 1, previousReceiptId = "") {
  if (!validDate(dueAt) || !integer(attemptNumber, 1, schedule.maxAttempts)) throw new Error("Shadow queue attempt is invalid.");
  if (previousReceiptId && !HASH.test(previousReceiptId)) throw new Error("Shadow queue retry receipt is invalid.");
  const identity = Object.freeze({ schemaVersion: SHADOW_QUEUE_SCHEMA, hashVersion: V2_CANONICAL_HASH_VERSION,
    scheduleId: schedule.scheduleId, logicalJobId: schedule.logicalJobId, dueAt, attemptNumber,
    estimatedResourceUnits: schedule.estimatedResourceUnits, previousReceiptId });
  return Object.freeze({ ...identity, status: "queued" as const, queueId: await canonicalHash(identity) }) as Readonly<ShadowScheduleQueueEntry>;
}

const settledEntry = (entry: Readonly<ShadowScheduleQueueEntry>) => Object.freeze({ ...entry, status: "settled" as const });

export async function buildShadowDispatchReceipt(entry: Readonly<ShadowScheduleQueueEntry>, result: Readonly<BoundedShadowHostRunResult>, dispatchedAt: string) {
  if (!validDate(dispatchedAt) || result.logicalJobId !== entry.logicalJobId) throw new Error("Shadow dispatch receipt input mismatch.");
  const core = Object.freeze({ schemaVersion: SHADOW_DISPATCH_RECEIPT_SCHEMA, hashVersion: V2_CANONICAL_HASH_VERSION,
    scheduleId: entry.scheduleId, queueId: entry.queueId, logicalJobId: entry.logicalJobId,
    attemptNumber: entry.attemptNumber, dispatchedAt, resultStatus: result.status,
    blocker: result.blocker ?? "", checkpointId: result.checkpointId, leaseId: result.leaseId,
    stagesProcessed: result.stagesProcessed, shadowOnly: true as const, runtimeAdoptionAllowed: false as const });
  return Object.freeze({ ...core, receiptId: await canonicalHash(core) }) as Readonly<ShadowDispatchReceipt>;
}

export class InMemoryShadowSchedulerRepository implements ShadowSchedulerRepository {
  readonly entries = new Map<string, Readonly<ShadowScheduleQueueEntry>>();
  readonly receipts = new Map<string, Readonly<ShadowDispatchReceipt>>();
  async admit(entry: Readonly<ShadowScheduleQueueEntry>, maxQueueDepth: number) {
    if (!await validateShadowScheduleQueueEntry(entry)) throw new Error("Shadow scheduler queue identity rejected.");
    if (this.entries.has(entry.queueId)) return "coalesced" as const;
    if ([...this.entries.values()].some((item) => item.status === "queued" && item.logicalJobId === entry.logicalJobId && item.dueAt === entry.dueAt)) return "coalesced" as const;
    if ([...this.entries.values()].filter((item) => item.status === "queued").length >= maxQueueDepth) return "queue_full" as const;
    this.entries.set(entry.queueId, entry); return "admitted" as const;
  }
  async queued(limit: number) { return [...this.entries.values()].filter((item) => item.status === "queued").sort((a, b) => a.dueAt.localeCompare(b.dueAt) || a.queueId.localeCompare(b.queueId)).slice(0, limit); }
  async settle(entry: Readonly<ShadowScheduleQueueEntry>, receipt: Readonly<ShadowDispatchReceipt>, retry?: Readonly<ShadowScheduleQueueEntry>) {
    if (!await validateShadowScheduleQueueEntry(entry) || !await validateShadowDispatchReceipt(receipt) || (retry && !await validateShadowScheduleQueueEntry(retry))) throw new Error("Shadow scheduler settlement identity rejected.");
    if (this.receipts.has(receipt.receiptId)) throw new Error("Shadow dispatch receipt conflict.");
    this.entries.set(entry.queueId, settledEntry(entry)); this.receipts.set(receipt.receiptId, receipt);
    if (retry) this.entries.set(retry.queueId, retry);
  }
  async compactSettled(retainCount: number) {
    const settled = [...this.entries.values()].filter((item) => item.status === "settled").sort((a, b) => b.dueAt.localeCompare(a.dueAt) || b.queueId.localeCompare(a.queueId));
    settled.slice(retainCount).forEach((entry) => this.entries.delete(entry.queueId));
    return Math.max(0, settled.length - retainCount);
  }
}

type SchedulerState = "idle" | "running" | "paused" | "stopped";

export class ManualShadowScheduler {
  private state: SchedulerState = "idle";
  constructor(readonly config: Readonly<ShadowSchedulerConfig>, private readonly repository: ShadowSchedulerRepository) { validateShadowSchedulerConfig(config); }
  getState() { return this.state; }
  start() { if (this.state !== "idle") throw new Error("Shadow scheduler can only start once."); this.state = "running"; }
  pause() { if (this.state !== "running") throw new Error("Shadow scheduler can only pause while running."); this.state = "paused"; }
  resume() { if (this.state !== "paused") throw new Error("Shadow scheduler can only resume while paused."); this.state = "running"; }
  stop() { this.state = "stopped"; }

  async tick(input: Readonly<{
    evaluatedAt: string;
    schedules: readonly Readonly<ShadowScheduleDefinition>[];
    jobs: Readonly<Record<string, Readonly<{ job: Readonly<ShadowResearchJob>; handlers: Readonly<Record<string, ShadowStageHandler>> }>>>;
    run: (input: Readonly<{ job: Readonly<ShadowResearchJob>; handlers: Readonly<Record<string, ShadowStageHandler>> }>) => Promise<Readonly<BoundedShadowHostRunResult>>;
  }>) {
    if (this.state !== "running") throw new Error("Shadow scheduler is not running.");
    const admission = [];
    for (const schedule of [...input.schedules].sort((a, b) => a.scheduleId.localeCompare(b.scheduleId))) {
      const dueAt = resolveShadowScheduleDueAt(schedule, input.evaluatedAt);
      if (!dueAt) continue;
      const entry = await buildShadowScheduleQueueEntry(schedule, dueAt);
      admission.push(await this.repository.admit(entry, this.config.maxQueueDepth));
    }
    const available = await this.repository.queued(this.config.maxDispatchPerTick);
    const dispatched = [];
    let resources = 0;
    for (const entry of available) {
      if (resources + entry.estimatedResourceUnits > this.config.maxResourceUnitsPerTick) break;
      const registration = input.jobs[entry.logicalJobId];
      if (!registration) continue;
      resources += entry.estimatedResourceUnits;
      const result = await input.run(registration);
      const receipt = await buildShadowDispatchReceipt(entry, result, input.evaluatedAt);
      const retryable = ["lease_blocked", "quarantined"].includes(result.status) && entry.attemptNumber < input.schedules.find((item) => item.scheduleId === entry.scheduleId)!.maxAttempts;
      const retry = retryable ? await buildShadowScheduleQueueEntry(input.schedules.find((item) => item.scheduleId === entry.scheduleId)!, entry.dueAt, entry.attemptNumber + 1, receipt.receiptId) : undefined;
      await this.repository.settle(entry, receipt, retry);
      dispatched.push(receipt);
    }
    const compacted = await this.repository.compactSettled(this.config.retainSettledQueueEntries);
    return Object.freeze({ admission: Object.freeze(admission), dispatched: Object.freeze(dispatched), resourceUnits: resources, compacted });
  }
}
