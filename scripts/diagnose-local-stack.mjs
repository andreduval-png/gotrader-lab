#!/usr/bin/env node

import {
  compactDiagnostic,
  diagnoseService,
  isTruthyEnv,
  loadStackState,
  mt5UpstreamEnvStatus,
  mt5TerminalPath,
  serviceDefinitions,
  stackStatePath
} from "./local-stack-utils.mjs";

const state = await loadStackState();
const envStatus = mt5UpstreamEnvStatus();
const tradingViewEnabled = isTruthyEnv(process.env.ENABLE_TRADINGVIEW_MCP);
const diagnostics = [];

for (const service of serviceDefinitions) {
  diagnostics.push(await diagnoseService(service, state));
}

const requiredFailures = diagnostics.filter((diagnostic) => {
  const service = serviceDefinitions.find((item) => item.id === diagnostic.id);
  return service?.required && diagnostic.status !== "healthy";
});

const optionalNotes = [
  diagnostics.find((item) => item.id === "mt5-upstream")?.status !== "healthy"
    ? "MT5 read-only upstream is offline. Open and log in to MT5 Desktop, then run npm.cmd run start:local-stack. Credentials are not required by the read-only terminal-session service."
    : undefined,
  !tradingViewEnabled
    ? "TradingView MCP is optional and disabled by default. Set ENABLE_TRADINGVIEW_MCP=true to include it."
    : undefined,
  diagnostics.find((item) => item.id === "llm-bridge")?.status === "provider_config_missing"
    ? "LLM bridge is online, but OPENAI_API_KEY is not configured. Add it to ignored .env.local or the shell environment, then restart the local stack."
    : undefined,
  diagnostics.find((item) => item.id === "gbrain-sidecar")?.status !== "healthy"
    ? "gbrain research memory is optional and offline. Native IndexedDB evidence remains authoritative; restart the local stack to restore durable sidecar synchronization."
    : diagnostics.find((item) => item.id === "gbrain-sidecar")?.health?.payloadSummary?.gbrainInitialized !== true
      ? "gbrain sidecar durable spool is active, but the optional PGLite index is not initialized."
      : undefined
].filter(Boolean);

const llmProviderMissing = diagnostics.find((item) => item.id === "llm-bridge")?.status === "provider_config_missing";

const summary = {
  status: requiredFailures.length ? "degraded" : "healthy_or_optional_only",
  stateFile: stackStatePath,
  trackedServices: state.services.map((service) => ({
    id: service.id,
    pid: service.pid,
    startedAt: service.startedAt,
    command: service.command,
    logFile: service.logFile
  })),
  env: {
    mt5TerminalPath: envStatus.terminalPath || mt5TerminalPath,
    mt5ConnectionMode: envStatus.mode,
    mt5RequiredVariablesPresent: envStatus.present,
    mt5OptionalCredentialVariablesMissing: envStatus.missing,
    enableTradingViewMcp: tradingViewEnabled
  },
  services: diagnostics.map(compactDiagnostic),
  optionalNotes,
  nextRecommendedAction: requiredFailures.length
    ? llmProviderMissing
      ? "Configure OPENAI_API_KEY outside version control, run npm.cmd run restart:local-stack, then rerun npm.cmd run diagnose:local-stack."
      : "Run npm.cmd run start:local-stack, then rerun npm.cmd run diagnose:local-stack. If ports are occupied by untracked processes, inspect them before stopping anything."
    : "Core local stack checks are healthy or only optional services are offline."
};

console.log("GoTrader local stack diagnostic");
for (const service of diagnostics) {
  const compact = compactDiagnostic(service);
  console.log(
    [
      `${service.label}: ${compact.status}`,
      `port ${compact.port} ${compact.portOpen ? "open" : "closed"}`,
      compact.trackedPid ? `tracked PID ${compact.trackedPid} (${compact.trackedAlive ? "alive" : "stopped"})` : "untracked",
      compact.healthOk ? "health ok" : `health failed${compact.healthError ? `: ${compact.healthError}` : ""}`
    ].join(" | ")
  );
}
for (const note of optionalNotes) {
  console.log(`Note: ${note}`);
}
console.log(JSON.stringify(summary, null, 2));

process.exitCode = 0;
