import type { AlwaysOnRuntimeAuthority } from "../alwaysOnRuntimeTypes";

export type RuntimeSchedulerTaskType =
  | "runtime_health_snapshot"
  | "current_market_snapshot"
  | "shadow_context_refresh"
  | "shadow_ifvg_comparison";

export interface RuntimeSchedulerTaskDescriptor extends AlwaysOnRuntimeAuthority {
  taskType: RuntimeSchedulerTaskType;
  taskVersion: string;
  enabled: boolean;
  triggerEvent: "candle_closed";
  requiredTimeframes: readonly string[];
  timeoutMs: number;
  concurrencyPolicy: "one_per_task_type";
  retryLimit: number;
  disabledReason?: string;
}

export interface AutonomousCycleArtifact extends AlwaysOnRuntimeAuthority {
  cycleId: string;
  triggerEventId: string;
  taskType: RuntimeSchedulerTaskType;
  startedAt: string;
  completedAt?: string;
  status: "completed" | "skipped" | "blocked" | "failed" | "cancelled";
  sourceIdentity: string;
  sourceFingerprint: string;
  requestedSymbol: string;
  brokerSymbol: string;
  timeframe?: string;
  observedMarketTime: string;
  blockers: readonly string[];
  warnings: readonly string[];
  outputArtifactIds: readonly string[];
  productionAdoptionAllowed: false;
}
