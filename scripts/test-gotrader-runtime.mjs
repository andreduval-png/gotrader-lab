#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildAlwaysOnReadOnlyProfile,
  buildProcessFingerprint,
  classifyProbe,
  classifyProcessOwnership,
  classifyRuntimeState,
  compactRuntimeStatus,
  redactRuntimeText,
  registerRestartAttempt,
  runtimeAuthority,
  serviceShutdownOrder,
  serviceStartupOrder,
  validateRuntimeProfile
} from "./gotrader-runtime-core.mjs";
import {
  acquireRuntimeLock,
  appendRuntimeLog,
  buildRuntimePaths,
  collectServiceStatus,
  ensureRuntimePaths,
  inspectServicePortOwnership,
  readJsonFile,
  releaseRuntimeLock,
  rotateRuntimeLog,
  sleep,
  startManagedService,
  stopManagedService,
  waitForServiceHealth,
  writeJsonAtomic
} from "./gotrader-runtime-io.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const fixtureScript = path.join(scriptDir, "gotrader-runtime-test-service.mjs");
const results = [];

const test = async (name, fn) => {
  await fn();
  results.push({ name, status: "passed" });
  console.log(`PASS ${name}`);
};

const freePort = () =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : undefined;
      server.close(() => resolve(port));
    });
  });

const waitForPortState = async (port, expectedOpen) => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const open = await new Promise((resolve) => {
      const socket = net.createConnection({ host: "127.0.0.1", port });
      socket.once("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.once("error", () => resolve(false));
      socket.setTimeout(300, () => {
        socket.destroy();
        resolve(false);
      });
    });
    if (open === expectedOpen) return;
    await sleep(100);
  }
  throw new Error(`Port ${port} did not become ${expectedOpen ? "open" : "closed"}.`);
};

const makeFixtureService = ({ serviceId, port, dependencies = [] }) => ({
  serviceId,
  displayName: serviceId,
  command: process.execPath,
  args: [fixtureScript, "--port", String(port)],
  scriptPath: fixtureScript,
  workingDirectory: repoRoot,
  runtime: "node",
  required: true,
  dependencies,
  expectedPorts: [port],
  identityTokens: [fixtureScript, "--port", String(port)],
  environment: {},
  healthProbes: [
    {
      probeId: `${serviceId}_health`,
      kind: "health",
      url: `http://127.0.0.1:${port}/health`,
      restartRelevant: true
    },
    {
      probeId: `${serviceId}_transport`,
      kind: "transport",
      url: `http://127.0.0.1:${port}/status`,
      restartRelevant: false
    }
  ],
  restartPolicy: {
    enabled: true,
    maximumAttempts: 5,
    windowMs: 600_000,
    delaysMs: [1, 2, 5, 30]
  },
  authority: runtimeAuthority
});

const repositoryIdentity = {
  repositoryRoot: repoRoot,
  branch: "codex/gotrader-infrastructure-track-a1",
  headCommit: "test-head"
};

await test("registry is read-only, strategy-neutral, and profile-validated", async () => {
  const profile = buildAlwaysOnReadOnlyProfile({ repoRoot });
  assert.deepEqual(validateRuntimeProfile(profile), { valid: true, errors: [] });
  assert.deepEqual(
    profile.services.map((service) => service.serviceId),
    ["mt5_terminal", "mt5_readonly_upstream", "mt5_readonly_bridge"]
  );
  assert.equal(profile.browserRequired, false);
  assert.equal(profile.strategySchedulerEnabled, false);
  assert.equal(profile.paperDemoEnabled, false);
  assert.equal(profile.executionEnabled, false);
  assert.equal(profile.productionAdoptionAllowed, false);
  assert.deepEqual(profile.authority, runtimeAuthority);
});

await test("absolute path enforcement and dependency ordering fail closed", async () => {
  const profile = buildAlwaysOnReadOnlyProfile({ repoRoot });
  const invalid = {
    ...profile,
    services: [
      { ...profile.services[0], workingDirectory: "." },
      ...profile.services.slice(1)
    ]
  };
  assert.equal(validateRuntimeProfile(invalid).valid, false);
  assert.deepEqual(
    serviceStartupOrder(profile).map((service) => service.serviceId),
    ["mt5_terminal", "mt5_readonly_upstream", "mt5_readonly_bridge"]
  );
  assert.deepEqual(
    serviceShutdownOrder(profile).map((service) => service.serviceId),
    ["mt5_readonly_bridge", "mt5_readonly_upstream"]
  );
});

await test("process fingerprint binds service to branch, HEAD, and worktree", async () => {
  const service = buildAlwaysOnReadOnlyProfile({ repoRoot }).services[1];
  const first = buildProcessFingerprint({ service, ...repositoryIdentity });
  const second = buildProcessFingerprint({
    service,
    ...repositoryIdentity,
    headCommit: "different-head"
  });
  assert.notEqual(first, second);
  assert.equal(first.length, 64);
});

await test("port ownership accepts exact worktree and blocks foreign or unknown owners", async () => {
  const service = makeFixtureService({ serviceId: "fixture", port: 18_081 });
  const exact = classifyProcessOwnership({
    service,
    repositoryRoot: repoRoot,
    processInfo: {
      pid: 101,
      executablePath: process.execPath,
      commandLine: `"${process.execPath}" "${fixtureScript}" --port 18081`
    }
  });
  assert.equal(exact.status, "owned_current_worktree");
  const foreign = classifyProcessOwnership({
    service,
    repositoryRoot: repoRoot,
    processInfo: {
      pid: 102,
      executablePath: process.execPath,
      commandLine: `"${process.execPath}" "C:/other-worktree/scripts/gotrader-runtime-test-service.mjs" --port 18081`
    }
  });
  assert.equal(foreign.status, "blocked_foreign_worktree");
  const unknown = classifyProcessOwnership({
    service,
    repositoryRoot: repoRoot,
    processInfo: {
      pid: 103,
      executablePath: process.execPath,
      commandLine: `"${process.execPath}" -e "server.listen(18081)"`
    }
  });
  assert.equal(unknown.status, "blocked_unknown_owner");
});

await test("health semantics separate transport health from time and market-data warnings", async () => {
  const time = classifyProbe({
    descriptor: { probeId: "time", kind: "time_contract", restartRelevant: false },
    result: {
      ok: true,
      status: 200,
      payload: { verificationStatus: "observed_candidate", providerTimeBasis: "unknown" }
    }
  });
  assert.equal(time.classification, "available_unverified");
  assert.equal(time.restartRelevant, false);
  const quote = classifyProbe({
    descriptor: { probeId: "quote", kind: "quote", restartRelevant: false },
    result: { ok: true, status: 200, payload: { connectionStatus: "disconnected" } }
  });
  assert.equal(quote.classification, "quote_unavailable");
  const health = classifyProbe({
    descriptor: { probeId: "health", kind: "health", restartRelevant: true },
    result: { ok: false, status: "error" }
  });
  assert.equal(health.classification, "transport_unavailable");
  assert.equal(health.restartRelevant, true);
  const staleVersion = classifyProbe({
    descriptor: {
      probeId: "versioned_health",
      kind: "health",
      expectedServiceVersion: "expected-v2",
      restartRelevant: true
    },
    result: {
      ok: true,
      status: 200,
      payload: { serviceVersion: "stale-v1" }
    }
  });
  assert.equal(staleVersion.ok, false);
  assert.equal(staleVersion.classification, "stale_service_version");
  assert.deepEqual(staleVersion.warnings, ["service_version_mismatch"]);
});

await test("restart budget is bounded and cannot spin indefinitely", async () => {
  const policy = {
    enabled: true,
    maximumAttempts: 5,
    windowMs: 600_000,
    delaysMs: [1_000, 2_000, 5_000, 30_000]
  };
  let attempts = [];
  for (let index = 0; index < 5; index += 1) {
    const decision = registerRestartAttempt({
      attempts,
      policy,
      nowMs: 100_000 + index
    });
    assert.equal(decision.allowed, true);
    attempts = decision.attempts;
  }
  const blocked = registerRestartAttempt({ attempts, policy, nowMs: 100_006 });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.blocker, "restart_budget_exhausted");
});

await test("runtime logs redact secrets and retain no raw market arrays", async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "gotrader-runtime-log-"));
  const paths = buildRuntimePaths(temporary, "always_on_read_only");
  await appendRuntimeLog(paths, "redaction_test", {
    token: "should-not-appear",
    message: "Authorization=private-value",
    candleCount: 2,
    rawCandlesPersisted: false
  });
  const text = await fs.readFile(path.join(paths.logsRoot, "supervisor.log"), "utf8");
  assert.equal(text.includes("should-not-appear"), false);
  assert.equal(text.includes("private-value"), false);
  assert.equal(text.includes("[redacted]"), true);
  assert.equal(text.includes("\"candles\":["), false);
  assert.equal(redactRuntimeText("password=abc token:xyz").includes("abc"), false);
  const rotationFile = path.join(paths.logsRoot, "rotation.log");
  await fs.writeFile(rotationFile, "0123456789abcdef", "utf8");
  await rotateRuntimeLog(rotationFile, { maximumBytes: 8, retainedFiles: 2 });
  assert.equal(await fs.readFile(`${rotationFile}.1`, "utf8"), "0123456789abcdef");
  await fs.rm(temporary, { recursive: true, force: true });
});

await test("worktree-scoped lock is atomic and stale locks recover safely", async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "gotrader-runtime-lock-"));
  const paths = buildRuntimePaths(temporary, "always_on_read_only");
  const first = await acquireRuntimeLock({ paths, repositoryIdentity });
  assert.equal(first.acquired, true);
  const second = await acquireRuntimeLock({ paths, repositoryIdentity });
  assert.equal(second.acquired, false);
  await releaseRuntimeLock(paths);
  await ensureRuntimePaths(paths);
  await writeJsonAtomic(paths.lockFile, { pid: 999_999_999 });
  const recovered = await acquireRuntimeLock({ paths, repositoryIdentity });
  assert.equal(recovered.acquired, true);
  assert.equal(recovered.staleRecovered, true);
  await releaseRuntimeLock(paths);
  await fs.rm(temporary, { recursive: true, force: true });
});

await test("isolated services start, identify, recover, and stop on test ports", async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "gotrader-runtime-integration-"));
  const paths = buildRuntimePaths(temporary, "always_on_read_only");
  const upstreamPort = await freePort();
  const bridgePort = await freePort();
  const upstream = makeFixtureService({
    serviceId: "fixture_upstream",
    port: upstreamPort
  });
  const bridge = makeFixtureService({
    serviceId: "fixture_bridge",
    port: bridgePort,
    dependencies: ["fixture_upstream"]
  });

  const upstreamRecord = await startManagedService({
    service: upstream,
    paths,
    repositoryIdentity
  });
  assert.equal((await waitForServiceHealth(upstream, 5_000)).ok, true);
  const bridgeRecord = await startManagedService({
    service: bridge,
    paths,
    repositoryIdentity
  });
  assert.equal((await waitForServiceHealth(bridge, 5_000)).ok, true);
  await waitForPortState(upstreamPort, true);
  await waitForPortState(bridgePort, true);

  const ownership = await inspectServicePortOwnership({
    service: bridge,
    repositoryRoot: repoRoot
  });
  assert.equal(ownership[0].status, "owned_current_worktree");
  const bridgeStatus = await collectServiceStatus({
    service: bridge,
    paths,
    repositoryRoot: repoRoot
  });
  assert.equal(bridgeStatus.state, "healthy");
  assert.equal(bridgeStatus.pid, bridgeRecord.pid);

  assert.equal(
    (
      await stopManagedService({
        service: bridge,
        paths,
        repositoryRoot: repoRoot
      })
    ).stopped,
    true
  );
  await waitForPortState(bridgePort, false);
  const restarted = await startManagedService({
    service: bridge,
    paths,
    repositoryIdentity
  });
  assert.notEqual(restarted.pid, bridgeRecord.pid);
  assert.equal((await waitForServiceHealth(bridge, 5_000)).ok, true);

  await stopManagedService({ service: bridge, paths, repositoryRoot: repoRoot });
  await stopManagedService({ service: upstream, paths, repositoryRoot: repoRoot });
  await waitForPortState(bridgePort, false);
  await waitForPortState(upstreamPort, false);
  assert.equal(upstreamRecord.authority.executionAuthority, "none");
  await fs.rm(temporary, { recursive: true, force: true });
});

await test("unknown occupied test port is blocked and never adopted", async () => {
  const port = await freePort();
  const unknown = spawn(
    process.execPath,
    [
      "-e",
      `require('http').createServer((q,s)=>s.end('unknown')).listen(${port},'127.0.0.1')`
    ],
    { detached: false, stdio: "ignore", windowsHide: true }
  );
  await waitForPortState(port, true);
  const service = makeFixtureService({ serviceId: "expected_fixture", port });
  const ownership = await inspectServicePortOwnership({
    service,
    repositoryRoot: repoRoot
  });
  assert.equal(ownership[0].status, "blocked_unknown_owner");
  unknown.kill();
  await waitForPortState(port, false);
});

await test("runtime status cannot grant authority or production adoption", async () => {
  const profile = buildAlwaysOnReadOnlyProfile({ repoRoot });
  const services = profile.services.map((service) => ({
    serviceId: service.serviceId,
    state: "healthy",
    blockers: [],
    warnings: [],
    authority: runtimeAuthority
  }));
  const classification = classifyRuntimeState({ profile, serviceStatuses: services });
  const status = compactRuntimeStatus({
    runtimeId: "test-runtime",
    repositoryIdentity,
    profile,
    state: classification.state,
    serviceStatuses: services,
    blockers: classification.blockers,
    warnings: classification.warnings
  });
  assert.equal(status.productionAdoptionAllowed, false);
  assert.equal(status.strategySchedulerEnabled, false);
  assert.equal(status.executionEnabled, false);
  assert.deepEqual(status.authority, runtimeAuthority);
  assert.equal(JSON.stringify(status).includes("\"candles\":["), false);
});

await test("runtime implementation imports no strategy or research modules", async () => {
  const files = [
    "scripts/gotrader-runtime-core.mjs",
    "scripts/gotrader-runtime-io.mjs",
    "scripts/gotrader-runtime-supervisor.mjs",
    "scripts/gotrader-runtime-control.mjs",
    "src/lib/alwaysOnRuntime/alwaysOnRuntimeTypes.ts",
    "src/lib/alwaysOnRuntime/alwaysOnRuntimeProfile.ts"
  ];
  const forbidden =
    /from\s+["'][^"']*(ict-strategy|strategyLibrary|currentOpportunity|researchCycle|validationChain|paperDemo|execution|openclaw)/i;
  for (const file of files) {
    const source = await fs.readFile(path.join(repoRoot, file), "utf8");
    assert.equal(forbidden.test(source), false, `${file} imports a forbidden subsystem.`);
  }
});

console.log(
  JSON.stringify(
    {
      status: "passed",
      testCount: results.length,
      results,
      authority: runtimeAuthority,
      rawCandlesPersisted: false,
      strategySchedulerEnabled: false,
      executionEnabled: false,
      productionAdoptionAllowed: false
    },
    null,
    2
  )
);
