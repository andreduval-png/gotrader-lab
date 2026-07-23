import type { AlwaysOnRuntimeAuthority } from "./alwaysOnRuntimeTypes";

export const alwaysOnRuntimeAuthority: AlwaysOnRuntimeAuthority = Object.freeze({
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
});

export const alwaysOnReadOnlyRuntimeProfile = Object.freeze({
  profileId: "always_on_read_only" as const,
  profileVersion: "track-a1-always-on-read-only-v1",
  requiredServiceIds: [
    "mt5_terminal",
    "mt5_readonly_upstream",
    "mt5_readonly_bridge"
  ] as const,
  optionalServiceIds: [] as const,
  browserRequired: false as const,
  strategySchedulerEnabled: false as const,
  paperDemoEnabled: false as const,
  executionEnabled: false as const,
  aiSupervisorEnabled: false as const,
  productionAdoptionAllowed: false as const,
  authority: alwaysOnRuntimeAuthority
});

export const alwaysOnReadOnlySchedulerRuntimeProfile = Object.freeze({
  profileId: "always_on_read_only_scheduler" as const,
  profileVersion: "track-a2-always-on-read-only-scheduler-v1",
  requiredServiceIds: [
    "mt5_terminal",
    "mt5_readonly_upstream",
    "mt5_readonly_bridge",
    "market_data_feed",
    "autonomous_cycle_scheduler"
  ] as const,
  optionalServiceIds: [] as const,
  browserRequired: false as const,
  continuousFeedEnabled: true as const,
  closedCandleSchedulerEnabled: true as const,
  strategySchedulerEnabled: false as const,
  enabledTaskTypes: [
    "runtime_health_snapshot",
    "current_market_snapshot"
  ] as const,
  paperDemoEnabled: false as const,
  executionEnabled: false as const,
  aiSupervisorEnabled: false as const,
  productionAdoptionAllowed: false as const,
  authority: alwaysOnRuntimeAuthority
});
