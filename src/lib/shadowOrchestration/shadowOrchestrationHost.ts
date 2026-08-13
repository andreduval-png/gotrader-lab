import { runShadowOrchestration } from "./shadowOrchestrationEngine";
import {
  acquirePersistedShadowOrchestrationLease,
  loadShadowOrchestrationCancellation,
  loadShadowOrchestrationSnapshot,
  persistGuardedShadowOrchestrationSnapshot,
  persistShadowOrchestrationQuarantine,
  releasePersistedShadowOrchestrationLease,
  renewPersistedShadowOrchestrationLease,
  type ShadowOrchestrationSnapshot
} from "./shadowOrchestrationIndexedDb";
import type {
  ShadowOrchestrationCancellation,
  ShadowOrchestrationLease,
  ShadowResearchJob,
  ShadowStageHandler
} from "./shadowOrchestrationTypes";

export const SHADOW_HOST_VERSION = "gotrader-v2-bounded-shadow-host-v1" as const;

export interface BoundedShadowHostConfig {
  ownerId: string;
  maxConcurrency: number;
  maxStagesPerRun: number;
  leaseDurationMs: number;
  renewEveryStages: number;
}

export interface BoundedShadowHostDependencies {
  now: () => string;
  loadSnapshot: (logicalJobId: string) => Promise<Readonly<ShadowOrchestrationSnapshot> | undefined>;
  loadCancellation: (logicalJobId: string) => Promise<Readonly<ShadowOrchestrationCancellation> | undefined>;
  acquireLease: typeof acquirePersistedShadowOrchestrationLease;
  renewLease: typeof renewPersistedShadowOrchestrationLease;
  releaseLease: typeof releasePersistedShadowOrchestrationLease;
  persistSnapshot: typeof persistGuardedShadowOrchestrationSnapshot;
  quarantine: typeof persistShadowOrchestrationQuarantine;
}

export type BoundedShadowHostRunStatus =
  | "completed"
  | "interrupted"
  | "cancelled"
  | "lease_blocked"
  | "quarantined";

export interface BoundedShadowHostRunResult {
  hostVersion: typeof SHADOW_HOST_VERSION;
  status: BoundedShadowHostRunStatus;
  logicalJobId: string;
  ownerId: string;
  stagesProcessed: number;
  activeAtAdmission: number;
  checkpointId: string;
  leaseId: string;
  blocker?: string;
  released: boolean;
  shadowOnly: true;
  runtimeAdoptionAllowed: false;
}

const integerBetween = (value: number, minimum: number, maximum: number) =>
  Number.isInteger(value) && value >= minimum && value <= maximum;

export function validateBoundedShadowHostConfig(config: Readonly<BoundedShadowHostConfig>) {
  if (!config.ownerId.trim()) throw new Error("Bounded shadow host owner is required.");
  if (!integerBetween(config.maxConcurrency, 1, 4)) throw new Error("Bounded shadow host concurrency must be between 1 and 4.");
  if (!integerBetween(config.maxStagesPerRun, 1, 32)) throw new Error("Bounded shadow host stage budget must be between 1 and 32.");
  if (!integerBetween(config.leaseDurationMs, 1_000, 3_600_000)) throw new Error("Bounded shadow host lease duration is outside bounds.");
  if (!integerBetween(config.renewEveryStages, 1, config.maxStagesPerRun)) throw new Error("Bounded shadow host renewal boundary is outside the stage budget.");
  return true;
}

const defaultDependencies = (): BoundedShadowHostDependencies => ({
  now: () => new Date().toISOString(),
  loadSnapshot: loadShadowOrchestrationSnapshot,
  loadCancellation: loadShadowOrchestrationCancellation,
  acquireLease: acquirePersistedShadowOrchestrationLease,
  renewLease: renewPersistedShadowOrchestrationLease,
  releaseLease: releasePersistedShadowOrchestrationLease,
  persistSnapshot: persistGuardedShadowOrchestrationSnapshot,
  quarantine: persistShadowOrchestrationQuarantine
});

type HostState = "idle" | "running" | "stopping" | "stopped";

export class BoundedShadowOrchestrationHost {
  private state: HostState = "idle";
  private active = 0;
  private stopPromise: Promise<void> | undefined;
  private resolveStop: (() => void) | undefined;

  constructor(
    readonly config: Readonly<BoundedShadowHostConfig>,
    private readonly dependencies: Readonly<BoundedShadowHostDependencies> = defaultDependencies()
  ) {
    validateBoundedShadowHostConfig(config);
  }

  getState() { return this.state; }
  getActiveCount() { return this.active; }

  start() {
    if (this.state !== "idle") throw new Error("Bounded shadow host can only start once.");
    this.state = "running";
  }

  stop() {
    if (this.state === "idle") {
      this.state = "stopped";
      return Promise.resolve();
    }
    if (this.state === "stopped") return Promise.resolve();
    if (this.state === "stopping") return this.stopPromise!;
    this.state = "stopping";
    if (this.active === 0) {
      this.state = "stopped";
      return Promise.resolve();
    }
    this.stopPromise = new Promise<void>((resolve) => { this.resolveStop = resolve; });
    return this.stopPromise;
  }

  async run(input: Readonly<{
    job: Readonly<ShadowResearchJob>;
    handlers: Readonly<Record<string, ShadowStageHandler>>;
  }>): Promise<Readonly<BoundedShadowHostRunResult>> {
    if (this.state !== "running") throw new Error("Bounded shadow host is not accepting work.");
    if (this.active >= this.config.maxConcurrency) throw new Error("Bounded shadow host concurrency limit reached.");
    this.active += 1;
    const activeAtAdmission = this.active;
    let proof: Readonly<ShadowOrchestrationLease> | undefined;
    let released = false;
    let result: Omit<BoundedShadowHostRunResult, "released"> | undefined;
    try {
      const acquired = await this.dependencies.acquireLease({
        logicalJobId: input.job.logicalJobId,
        ownerId: this.config.ownerId,
        acquiredAt: this.dependencies.now(),
        durationMs: this.config.leaseDurationMs
      });
      if (acquired.status === "blocked") {
        return Object.freeze({
          hostVersion: SHADOW_HOST_VERSION,
          status: "lease_blocked",
          logicalJobId: input.job.logicalJobId,
          ownerId: this.config.ownerId,
          stagesProcessed: 0,
          activeAtAdmission,
          checkpointId: "",
          leaseId: acquired.lease.leaseId,
          blocker: acquired.blocker,
          released: false,
          shadowOnly: true,
          runtimeAdoptionAllowed: false
        });
      }
      proof = acquired.lease;
      let snapshot = await this.dependencies.loadSnapshot(input.job.logicalJobId);
      if (snapshot && snapshot.job.logicalJobId !== input.job.logicalJobId) throw new Error("Bounded shadow host recovery job mismatch.");
      let stagesProcessed = 0;

      while (stagesProcessed < this.config.maxStagesPerRun) {
        const checkpoint = snapshot?.checkpoint;
        if (checkpoint?.terminalStatus !== undefined) {
          result = this.result("completed", input.job.logicalJobId, stagesProcessed, activeAtAdmission, checkpoint.checkpointId, proof.leaseId);
          break;
        }
        const cancellation = await this.dependencies.loadCancellation(input.job.logicalJobId);
        if (cancellation) {
          result = this.result("cancelled", input.job.logicalJobId, stagesProcessed, activeAtAdmission, checkpoint?.checkpointId ?? "", proof.leaseId, "shadow_job_cancelled");
          break;
        }
        if (stagesProcessed > 0 && stagesProcessed % this.config.renewEveryStages === 0) {
          try {
            proof = await this.dependencies.renewLease({
              logicalJobId: input.job.logicalJobId,
              ownerId: this.config.ownerId,
              renewedAt: this.dependencies.now(),
              durationMs: this.config.leaseDurationMs
            });
          } catch {
            const quarantine = await this.dependencies.quarantine({
              proof,
              ownerId: this.config.ownerId,
              attemptedAction: "checkpoint_advance",
              blocker: "shadow_host_lease_renewal_rejected",
              quarantinedAt: this.dependencies.now()
            });
            result = this.result("quarantined", input.job.logicalJobId, stagesProcessed, activeAtAdmission, checkpoint?.checkpointId ?? "", proof.leaseId, quarantine.evidence.blocker);
            break;
          }
        }
        const currentCount = checkpoint?.nextStageOrdinal ?? 0;
        const execution = await runShadowOrchestration({
          job: input.job,
          handlers: input.handlers,
          ...(snapshot ? { checkpoint: snapshot.checkpoint, priorArtifacts: snapshot.artifacts } : {}),
          interruptAfterStages: Math.min(currentCount + 1, input.job.stages.length)
        });
        const candidate: ShadowOrchestrationSnapshot = execution.interrupted
          ? { job: input.job, checkpoint: execution.checkpoint, artifacts: execution.artifacts }
          : { job: input.job, checkpoint: execution.checkpoint, artifacts: execution.artifacts, seal: execution.seal, projection: execution.projection };
        const persisted = await this.dependencies.persistSnapshot(candidate, {
          proof,
          ownerId: this.config.ownerId,
          at: this.dependencies.now(),
          attemptedAction: execution.interrupted ? "checkpoint_advance" : "terminal_seal"
        });
        if (persisted.status === "quarantined") {
          result = this.result("quarantined", input.job.logicalJobId, stagesProcessed, activeAtAdmission, checkpoint?.checkpointId ?? "", proof.leaseId, persisted.blocker);
          break;
        }
        snapshot = candidate;
        stagesProcessed += 1;
        if (!execution.interrupted) {
          result = this.result("completed", input.job.logicalJobId, stagesProcessed, activeAtAdmission, execution.checkpoint.checkpointId, proof.leaseId);
          break;
        }
      }
      result ??= this.result("interrupted", input.job.logicalJobId, this.config.maxStagesPerRun, activeAtAdmission, snapshot?.checkpoint.checkpointId ?? "", proof.leaseId, "shadow_host_stage_budget_exhausted");
    } finally {
      if (proof) {
        try {
          const release = await this.dependencies.releaseLease(input.job.logicalJobId, this.config.ownerId, this.dependencies.now());
          released = release.status === "released";
        } catch {
          released = false;
        }
      }
      this.active -= 1;
      this.finishDrainIfNeeded();
    }
    return Object.freeze({ ...result!, released });
  }

  private result(
    status: BoundedShadowHostRunStatus,
    logicalJobId: string,
    stagesProcessed: number,
    activeAtAdmission: number,
    checkpointId: string,
    leaseId: string,
    blocker?: string
  ): Omit<BoundedShadowHostRunResult, "released"> {
    return {
      hostVersion: SHADOW_HOST_VERSION,
      status,
      logicalJobId,
      ownerId: this.config.ownerId,
      stagesProcessed,
      activeAtAdmission,
      checkpointId,
      leaseId,
      ...(blocker ? { blocker } : {}),
      shadowOnly: true,
      runtimeAdoptionAllowed: false
    };
  }

  private finishDrainIfNeeded() {
    if (this.state !== "stopping" || this.active !== 0) return;
    this.state = "stopped";
    this.resolveStop?.();
    this.resolveStop = undefined;
  }
}
