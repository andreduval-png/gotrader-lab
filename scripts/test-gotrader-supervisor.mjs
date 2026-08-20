#!/usr/bin/env node

import assert from "node:assert/strict";
import {
  buildGoTraderSupervisorSnapshot,
  classifyGoTraderReadiness,
  findRecoverableServices,
  gotraderSupervisorAuthority,
  resolveGoTraderSupervisorOptions,
  shouldReplaceBlockedSupervisor
} from "./gotrader-supervisor-core.mjs";

const diagnostic = ({ id, status = "healthy", portOpen = true, trackedAlive = true, connectionStatus }) => ({
  id,
  status,
  port: { port: id === "app" ? 5173 : 7000, open: portOpen },
  tracked: { pid: 100, alive: trackedAlive },
  health: { ok: status === "healthy", status: 200, payloadSummary: { connectionStatus } }
});

const healthy = [
  diagnostic({ id: "app" }),
  diagnostic({ id: "mt5-upstream" }),
  diagnostic({ id: "mt5-wrapper", connectionStatus: "connected" }),
  diagnostic({ id: "llm-bridge" }),
  diagnostic({ id: "research-mcp" })
];

assert.deepEqual(classifyGoTraderReadiness(healthy), {
  status: "ready",
  blockers: [],
  warnings: [],
  ...gotraderSupervisorAuthority
});

const degraded = healthy.map((item) =>
  item.id === "llm-bridge" ? diagnostic({ id: "llm-bridge", status: "provider_config_missing" }) : item
);
assert.equal(classifyGoTraderReadiness(degraded).status, "degraded");
assert.ok(classifyGoTraderReadiness(degraded).warnings.includes("llm_provider_not_configured"));

const blocked = healthy.map((item) =>
  item.id === "app" ? diagnostic({ id: "app", status: "stopped", portOpen: false, trackedAlive: false }) : item
);
assert.equal(classifyGoTraderReadiness(blocked).status, "blocked");
assert.deepEqual(findRecoverableServices(blocked), ["app"]);

const stalled = healthy.map((item) =>
  item.id === "mt5-upstream"
    ? diagnostic({ id: "mt5-upstream", status: "tracked_process_running_health_failed", portOpen: false, trackedAlive: true })
    : item
);
assert.deepEqual(findRecoverableServices(stalled, undefined, { "mt5-upstream": 2 }, 3), []);
assert.deepEqual(findRecoverableServices(stalled, undefined, { "mt5-upstream": 3 }, 3), ["mt5-upstream"]);

const nowMs = Date.parse("2026-08-14T04:40:00.000Z");
assert.equal(shouldReplaceBlockedSupervisor({ status: "ready", recoveryAttempts: 3, updatedAt: "2026-08-14T04:39:00.000Z" }, { nowMs }), false);
assert.equal(shouldReplaceBlockedSupervisor({ status: "blocked", recoveryAttempts: 3, updatedAt: "2026-08-14T04:39:59.000Z" }, { nowMs }), true);
assert.equal(shouldReplaceBlockedSupervisor({ status: "blocked", recoveryAttempts: 1, updatedAt: "2026-08-14T04:38:00.000Z" }, { nowMs }), true);
assert.equal(shouldReplaceBlockedSupervisor({ status: "blocked", recoveryAttempts: 1, updatedAt: "2026-08-14T04:39:59.000Z" }, { nowMs }), false);

const options = resolveGoTraderSupervisorOptions({
  GOTRADER_OPEN_BROWSER: "false",
  GOTRADER_AUTO_LAUNCH_MT5: "false",
  GOTRADER_SUPERVISOR_INTERVAL_MS: "100"
});
assert.equal(options.openBrowser, false);
assert.equal(options.autoLaunchMt5, false);
assert.equal(options.healthIntervalMs, 5_000, "health interval must remain bounded");

const snapshot = buildGoTraderSupervisorSnapshot({
  pid: 42,
  startedAt: "2026-07-18T10:00:00.000Z",
  status: classifyGoTraderReadiness(healthy),
  diagnostics: healthy,
  recoveryAttempts: 0,
  mt5: { running: true, launched: true, terminalPath: "C:/Program Files/MetaTrader 5/terminal64.exe" }
});
assert.equal(snapshot.executionAuthority, "none");
assert.equal(snapshot.brokerAuthority, "none");
assert.equal(snapshot.readinessOverrideAuthority, "none");
assert.equal(JSON.stringify(snapshot).includes("password"), false);
assert.equal(JSON.stringify(snapshot).includes("terminal64.exe"), false, "state must not expose the terminal path");

console.log(
  JSON.stringify(
    {
      status: "passed",
      checks: [
        "healthy stack classifies ready",
        "optional advisory configuration classifies degraded",
        "stopped required service classifies blocked and recoverable",
        "tracked unhealthy service restarts only after bounded consecutive failures",
        "exhausted or stale blocked supervisor is replaced while healthy supervisor is preserved",
        "supervisor intervals are bounded",
        "snapshot excludes credentials and terminal path",
        "authority remains none/none/none"
      ],
      authority: gotraderSupervisorAuthority
    },
    null,
    2
  )
);
