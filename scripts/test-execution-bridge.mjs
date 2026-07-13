import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
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
const architecture = await read("ARCHITECTURE.md");
const localStackUtils = await read("scripts/local-stack-utils.mjs");
const localStackStart = await read("scripts/start-local-stack.mjs");
const performance = await read("src/components/performance/PerformanceView.tsx");
const runtimeTypes = await read("src/lib/runtime/researchRuntimeTypes.ts");
const runtimeResolver = await read("src/lib/runtime/resolveResearchRuntimeSnapshot.ts");
const agentIndex = await read("src/lib/agents/index.ts");
const brokerRouter = await read("src/lib/brokers/brokerRouter.ts");
const brokerTypes = await read("src/lib/brokers/brokerTypes.ts");
const autonomyPolicy = await read("src/lib/autonomousResearch/autonomySafetyPolicy.ts");
const autonomyTypes = await read("src/lib/autonomousResearch/autonomySafetyTypes.ts");
const autonomyLoop = await read("src/lib/autonomousResearch/runAutonomousResearchLoop.ts");
const selfImprovement = await read("src/components/self-improvement/SelfImprovementView.tsx");
const selfImprovementIndex = await read("src/lib/selfImprovement/index.ts");
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

const activeExecutionSurfaces = [
  architecture,
  localStackUtils,
  localStackStart,
  performance,
  runtimeTypes,
  runtimeResolver,
  agentIndex,
  brokerRouter,
  brokerTypes
].join("\n");
assert.doesNotMatch(activeExecutionSurfaces, /@\/lib\/execution|demo_auto|live_gated|demo_live_journal/i);
assert.doesNotMatch(localStackUtils, /mt5-execution-bridge|7342/i);
assert.doesNotMatch(localStackStart, /ENABLE_MT5_EXECUTION_BRIDGE|mt5:execution-bridge/i);
assert.doesNotMatch(architecture, /staged execution|demo\/live journal|execution bridge on port 7342/i);

const executionLibraryFiles = await readdir(new URL("src/lib/execution/", root)).catch((error) => {
  if (error?.code === "ENOENT") return [];
  throw error;
});
assert.deepEqual(executionLibraryFiles, [], "The unfinished execution library must remain quarantined.");

assert.match(autonomyPolicy, /autoApplyEnabled:\s*false/);
assert.match(autonomyPolicy, /autoApplyAllowed:\s*false/);
assert.match(autonomyTypes, /autoApplyEnabled:\s*false/);
assert.match(autonomyLoop, /autoApplyPolicyEnabled:\s*false/);
assert.doesNotMatch(`${autonomyPolicy}\n${autonomyLoop}`, /autoApply(?:Enabled|PolicyEnabled):\s*true/);
assert.doesNotMatch(
  `${selfImprovement}\n${selfImprovementIndex}`,
  /applyEmpiricalCalibrationWinner|Apply Winning Thresholds|runEmpiricalThresholdCalibration/
);

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
