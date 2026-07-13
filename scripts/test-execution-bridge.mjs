import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

const authorityNone = {
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
};

const findFreePort = () =>
  new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" && address ? address.port : 0;
      probe.close((error) => (error ? reject(error) : resolve(port)));
    });
  });

const waitForBridge = (child) =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Disabled bridge did not start in time.")), 5_000);
    const onData = (chunk) => {
      const text = String(chunk);
      if (text.includes("disabled safety stub listening")) {
        clearTimeout(timeout);
        child.stdout.off("data", onData);
        resolve();
      }
    };
    child.stdout.on("data", onData);
    child.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Disabled bridge exited before readiness with code ${code}.`));
    });
  });

const app = await read("src/App.tsx");
const shell = await read("src/components/AppShell.tsx");
const dashboard = await read("src/components/dashboard/MissionControlShell.tsx");
const dashboardOverview = await read("src/components/dashboard/DashboardCommandOverview.tsx");
const smokeScript = await read("scripts/smoke-routes.mjs");
const smokeSpec = await read("tests/smoke/routes.spec.ts");
const disabledNotice = await read("src/components/execution/ExecuteHubView.tsx");
const bridgeSource = await read("scripts/start-mt5-execution-bridge.mjs");
const packageJson = JSON.parse(await read("package.json"));

assert.doesNotMatch(app, /path=["']\/execute["']/i, "The app must not route /execute.");
assert.doesNotMatch(`${shell}\n${dashboard}\n${dashboardOverview}`, /(?:to|href)=["']\/execute["']/i);
assert.doesNotMatch(`${smokeScript}\n${smokeSpec}`, /["']\/execute["']/i, "Smoke routes must omit /execute.");

const enablingScripts = Object.entries(packageJson.scripts ?? {}).filter(
  ([name, command]) => /execution/i.test(name) || /start-mt5-execution-bridge/i.test(String(command))
);
assert.deepEqual(enablingScripts, [], "package.json must not expose execution bridge commands.");

assert.match(disabledNotice, /Execution is disabled/);
assert.match(disabledNotice, /Execution authority[\s\S]*none/);
assert.match(disabledNotice, /Broker authority[\s\S]*none/);
assert.match(disabledNotice, /Readiness override[\s\S]*none/);
assert.doesNotMatch(bridgeSource, /order_send|positions_get|orders_get|account_info|MetaTrader5/i);

const port = await findFreePort();
const bridgeUrl = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, [fileURLToPath(new URL("scripts/start-mt5-execution-bridge.mjs", root))], {
  cwd: fileURLToPath(root),
  env: { ...process.env, MT5_EXECUTION_BRIDGE_PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"]
});

try {
  await waitForBridge(child);

  const healthResponse = await fetch(`${bridgeUrl}/health`, { cache: "no-store" });
  const health = await healthResponse.json();
  assert.equal(healthResponse.status, 200);
  assert.equal(health.service, "mt5_execution_bridge_disabled");
  assert.equal(health.stage, "research");
  assert.equal(health.killSwitchActive, true);
  assert.deepEqual(
    {
      executionAuthority: health.executionAuthority,
      brokerAuthority: health.brokerAuthority,
      readinessOverrideAuthority: health.readinessOverrideAuthority
    },
    authorityNone
  );

  for (const path of ["/execute/intent", "/execute/kill-switch", "/account", "/orders", "/positions"]) {
    const response = await fetch(`${bridgeUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestedAction: "blocked_by_design" })
    });
    const payload = await response.json();
    assert.equal(response.status, 403, `${path} must fail closed.`);
    assert.equal(payload.ok, false);
    assert.equal(payload.status, "blocked");
    assert.deepEqual(
      {
        executionAuthority: payload.executionAuthority,
        brokerAuthority: payload.brokerAuthority,
        readinessOverrideAuthority: payload.readinessOverrideAuthority
      },
      authorityNone
    );
  }
} finally {
  child.kill();
}

process.stdout.write(
  `${JSON.stringify(
    {
      status: "passed",
      routeAvailable: false,
      executionBridge: "disabled_403_stub",
      stage: "research",
      authority: authorityNone,
      accountOrderPositionMutation: false
    },
    null,
    2
  )}\n`
);
