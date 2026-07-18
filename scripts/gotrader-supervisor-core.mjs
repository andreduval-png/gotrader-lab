const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const FALSE_VALUES = new Set(["0", "false", "no", "off"]);

export const gotraderSupervisorAuthority = Object.freeze({
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
});

export const gotraderCoreServiceIds = Object.freeze([
  "mt5-upstream",
  "mt5-wrapper",
  "llm-bridge",
  "app"
]);

const boundedNumber = (value, fallback, minimum, maximum) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
};

const booleanOption = (value, fallback) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  return fallback;
};

export function resolveGoTraderSupervisorOptions(env = process.env) {
  return {
    dashboardUrl: env.GOTRADER_DASHBOARD_URL || "http://127.0.0.1:5173/dashboard",
    healthIntervalMs: boundedNumber(env.GOTRADER_SUPERVISOR_INTERVAL_MS, 15_000, 5_000, 300_000),
    startupTimeoutMs: boundedNumber(env.GOTRADER_STARTUP_TIMEOUT_MS, 45_000, 5_000, 300_000),
    recoveryCooldownMs: boundedNumber(env.GOTRADER_RECOVERY_COOLDOWN_MS, 30_000, 5_000, 300_000),
    maxRecoveryAttempts: boundedNumber(env.GOTRADER_MAX_RECOVERY_ATTEMPTS, 3, 0, 20),
    unhealthyRestartThreshold: boundedNumber(env.GOTRADER_UNHEALTHY_RESTART_THRESHOLD, 3, 2, 20),
    openBrowser: booleanOption(env.GOTRADER_OPEN_BROWSER, true),
    autoLaunchMt5: booleanOption(env.GOTRADER_AUTO_LAUNCH_MT5, true)
  };
}

const diagnosticById = (diagnostics) => new Map(diagnostics.map((item) => [item.id, item]));

export function classifyGoTraderReadiness(diagnostics = []) {
  const byId = diagnosticById(diagnostics);
  const blockers = [];
  const warnings = [];

  for (const id of ["app", "mt5-wrapper"]) {
    const diagnostic = byId.get(id);
    if (!diagnostic || diagnostic.status !== "healthy") {
      blockers.push(`${id}_unavailable`);
    }
  }

  const upstream = byId.get("mt5-upstream");
  if (!upstream || upstream.status !== "healthy") {
    warnings.push("mt5_upstream_unavailable");
  }

  const wrapper = byId.get("mt5-wrapper");
  const wrapperConnection = wrapper?.health?.payloadSummary?.connectionStatus;
  if (["degraded", "planned", "unavailable", "disconnected"].includes(wrapperConnection)) {
    warnings.push(`mt5_wrapper_${wrapperConnection}`);
  }

  const llm = byId.get("llm-bridge");
  if (!llm || llm.status !== "healthy") {
    warnings.push(
      llm?.status === "provider_config_missing"
        ? "llm_provider_not_configured"
        : "llm_advisory_unavailable"
    );
  }

  return {
    status: blockers.length ? "blocked" : warnings.length ? "degraded" : "ready",
    blockers: [...new Set(blockers)],
    warnings: [...new Set(warnings)],
    ...gotraderSupervisorAuthority
  };
}

export function findRecoverableServices(
  diagnostics = [],
  enabledServiceIds = gotraderCoreServiceIds,
  failureCounts = {},
  unhealthyRestartThreshold = 3
) {
  const enabled = new Set(enabledServiceIds);
  return diagnostics
    .filter((diagnostic) => enabled.has(diagnostic.id))
    .filter(
      (diagnostic) =>
        (diagnostic.status === "stopped" &&
          diagnostic.port?.open !== true &&
          diagnostic.tracked?.alive !== true) ||
        (diagnostic.tracked?.alive === true &&
          diagnostic.health?.ok !== true &&
          Number(failureCounts[diagnostic.id] ?? 0) >= unhealthyRestartThreshold)
    )
    .map((diagnostic) => diagnostic.id);
}

export function compactSupervisorDiagnostics(diagnostics = []) {
  return diagnostics.map((diagnostic) => ({
    id: diagnostic.id,
    status: diagnostic.status,
    port: diagnostic.port?.port,
    portOpen: Boolean(diagnostic.port?.open),
    trackedPid: diagnostic.tracked?.pid,
    trackedAlive: Boolean(diagnostic.tracked?.alive),
    healthOk: Boolean(diagnostic.health?.ok),
    healthStatus: diagnostic.health?.status,
    connectionStatus: diagnostic.health?.payloadSummary?.connectionStatus
  }));
}

export function buildGoTraderSupervisorSnapshot({
  pid,
  startedAt,
  status,
  diagnostics,
  recoveryAttempts,
  lastRecoveryAt,
  lastError,
  mt5
}) {
  return {
    version: 1,
    pid,
    startedAt,
    updatedAt: new Date().toISOString(),
    status: status.status,
    blockers: status.blockers,
    warnings: status.warnings,
    recoveryAttempts,
    lastRecoveryAt,
    lastError,
    mt5: mt5
      ? {
          running: Boolean(mt5.running),
          launched: Boolean(mt5.launched),
          terminalPathConfigured: Boolean(mt5.terminalPath)
        }
      : undefined,
    services: compactSupervisorDiagnostics(diagnostics),
    ...gotraderSupervisorAuthority
  };
}
