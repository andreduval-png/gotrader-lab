export type RuntimeServiceState =
  | "stopped"
  | "starting"
  | "healthy"
  | "degraded"
  | "stale"
  | "restarting"
  | "failed"
  | "blocked";

export interface AlwaysOnRuntimeAuthority {
  executionAuthority: "none";
  brokerAuthority: "none";
  readinessOverrideAuthority: "none";
}

export interface RuntimeRestartPolicy {
  enabled: boolean;
  maximumAttempts: number;
  windowMs: number;
  delaysMs: readonly number[];
}

export interface RuntimeHealthProbeDescriptor {
  probeId: string;
  kind: "process" | "health" | "transport" | "time_contract" | "quote" | "candles";
  url?: string;
  expectedServiceVersion?: string;
  restartRelevant: boolean;
}

export interface RuntimeServiceDescriptor {
  serviceId: string;
  displayName: string;
  command: string;
  args: readonly string[];
  scriptPath?: string;
  workingDirectory: string;
  runtime: "node" | "python" | "external";
  required: boolean;
  dependencies: readonly string[];
  expectedPorts: readonly number[];
  healthProbes: readonly RuntimeHealthProbeDescriptor[];
  restartPolicy: RuntimeRestartPolicy;
  authority: AlwaysOnRuntimeAuthority;
}

export interface RuntimeServiceStatus {
  serviceId: string;
  state: RuntimeServiceState;
  pid?: number;
  startedAt?: string;
  lastHeartbeatAt?: string;
  lastHealthyAt?: string;
  restartCount: number;
  ports: readonly {
    port: number;
    state: "free" | "owned" | "foreign" | "unknown";
    pid?: number;
  }[];
  probes: readonly {
    probeId: string;
    ok: boolean;
    status?: number | string;
    classification?: string;
    checkedAt: string;
  }[];
  blockers: readonly string[];
  warnings: readonly string[];
  authority: AlwaysOnRuntimeAuthority;
}

export interface GoTraderRuntimeStatus {
  runtimeId: string;
  profileId: "always_on_read_only";
  profileVersion: string;
  supervisorVersion: string;
  state: RuntimeServiceState;
  repositoryRoot: string;
  branch: string;
  headCommit: string;
  startedAt?: string;
  lastHealthyAt?: string;
  services: readonly RuntimeServiceStatus[];
  blockers: readonly string[];
  warnings: readonly string[];
  browserRequired: false;
  strategySchedulerEnabled: false;
  paperDemoEnabled: false;
  executionEnabled: false;
  aiSupervisorEnabled: false;
  productionAdoptionAllowed: false;
  authority: AlwaysOnRuntimeAuthority;
}
