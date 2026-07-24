import crypto from "node:crypto";
import path from "node:path";

export const runtimeAuthority = Object.freeze({
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
});

export const ALWAYS_ON_READ_ONLY_PROFILE_ID = "always_on_read_only";
export const ALWAYS_ON_READ_ONLY_PROFILE_VERSION = "track-a1-always-on-read-only-v1";
export const ALWAYS_ON_READ_ONLY_SCHEDULER_PROFILE_ID = "always_on_read_only_scheduler";
export const ALWAYS_ON_READ_ONLY_SCHEDULER_PROFILE_VERSION =
  "track-a2-always-on-read-only-scheduler-v1";
export const ALWAYS_ON_SHADOW_CONTEXT_PROFILE_ID = "always_on_shadow_context";
export const ALWAYS_ON_SHADOW_CONTEXT_PROFILE_VERSION =
  "track-a3-verified-time-shadow-context-v1";
export const ALWAYS_ON_SHADOW_CONTEXT_VERIFIED_PROFILE_ID =
  "always_on_shadow_context_verified";
export const ALWAYS_ON_SHADOW_CONTEXT_VERIFIED_PROFILE_VERSION =
  "track-a3-1-persistent-verified-time-shadow-context-v1";
export const ALWAYS_ON_SHADOW_CONTEXT_OPERATIONAL_PROFILE_ID =
  "always_on_shadow_context_operational";
export const ALWAYS_ON_SHADOW_CONTEXT_OPERATIONAL_PROFILE_VERSION =
  "track-a3-2-market-aware-hydrated-shadow-context-v1";
export const GOTRADER_RUNTIME_SUPERVISOR_VERSION = "gotrader-runtime-supervisor-v1.1";

export const runtimeServiceStates = Object.freeze([
  "stopped",
  "starting",
  "healthy",
  "degraded",
  "stale",
  "restarting",
  "failed",
  "blocked"
]);

const immutableRestartPolicy = Object.freeze({
  enabled: true,
  maximumAttempts: 5,
  windowMs: 10 * 60 * 1000,
  delaysMs: Object.freeze([1_000, 2_000, 5_000, 30_000])
});

const externalRestartPolicy = Object.freeze({
  enabled: false,
  maximumAttempts: 0,
  windowMs: 10 * 60 * 1000,
  delaysMs: Object.freeze([])
});

const boundedInteger = (value, fallback, minimum, maximum) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
};

const normalizedPath = (value) =>
  path.resolve(String(value ?? "")).replaceAll("\\", "/").toLowerCase();

const normalizedCommandLine = (value) =>
  String(value ?? "").replaceAll("\\", "/").replace(/\s+/g, " ").trim().toLowerCase();

const canonicalJson = (value) => JSON.stringify(value, Object.keys(value).sort());

export function buildAlwaysOnReadOnlyProfile({
  repoRoot,
  env = process.env,
  nodeExecutable = process.execPath
}) {
  const root = path.resolve(repoRoot);
  const host = env.GOTRADER_RUNTIME_HOST || "127.0.0.1";
  const upstreamPort = boundedInteger(env.GOTRADER_RUNTIME_UPSTREAM_PORT, 8000, 1, 65_535);
  const bridgePort = boundedInteger(env.GOTRADER_RUNTIME_BRIDGE_PORT, 7341, 1, 65_535);
  const terminalPath = path.resolve(env.MT5_PATH || "C:/Program Files/MetaTrader 5/terminal64.exe");
  const pythonExecutable = env.PYTHON || "python";
  const upstreamScript = path.join(root, "scripts", "mt5-readonly-upstream.py");
  const bridgeScript = path.join(root, "scripts", "start-mt5-readonly-bridge.mjs");
  const upstreamUrl = `http://${host}:${upstreamPort}`;
  const bridgeUrl = `http://${host}:${bridgePort}`;

  const common = {
    workingDirectory: root,
    required: true,
    authority: runtimeAuthority
  };

  return Object.freeze({
    profileId: ALWAYS_ON_READ_ONLY_PROFILE_ID,
    profileVersion: ALWAYS_ON_READ_ONLY_PROFILE_VERSION,
    browserRequired: false,
    strategySchedulerEnabled: false,
    paperDemoEnabled: false,
    executionEnabled: false,
    aiSupervisorEnabled: false,
    productionAdoptionAllowed: false,
    authority: runtimeAuthority,
    services: Object.freeze([
      Object.freeze({
        ...common,
        serviceId: "mt5_terminal",
        displayName: "MetaTrader 5 Desktop",
        command: terminalPath,
        args: Object.freeze([]),
        scriptPath: terminalPath,
        runtime: "external",
        dependencies: Object.freeze([]),
        expectedPorts: Object.freeze([]),
        identityTokens: Object.freeze([terminalPath]),
        healthProbes: Object.freeze([
          Object.freeze({
            probeId: "mt5_process",
            kind: "process",
            restartRelevant: false
          })
        ]),
        restartPolicy: externalRestartPolicy
      }),
      Object.freeze({
        ...common,
        serviceId: "mt5_readonly_upstream",
        displayName: "MT5 read-only Python upstream",
        command: pythonExecutable,
        args: Object.freeze([
          upstreamScript,
          "--path",
          terminalPath,
          "--host",
          host,
          "--port",
          String(upstreamPort)
        ]),
        scriptPath: upstreamScript,
        runtime: "python",
        dependencies: Object.freeze(["mt5_terminal"]),
        expectedPorts: Object.freeze([upstreamPort]),
        identityTokens: Object.freeze([upstreamScript, "--port", String(upstreamPort)]),
        environment: Object.freeze({}),
        healthProbes: Object.freeze([
          Object.freeze({
            probeId: "upstream_health",
            kind: "health",
            url: `${upstreamUrl}/health`,
            expectedServiceVersion: "gotrader-mt5-readonly-upstream-v1.1",
            restartRelevant: true
          }),
          Object.freeze({
            probeId: "upstream_transport",
            kind: "transport",
            url: `${upstreamUrl}/status`,
            restartRelevant: false
          }),
          Object.freeze({
            probeId: "upstream_time_contract",
            kind: "time_contract",
            url: `${upstreamUrl}/time-contract?symbol_name=USTECH`,
            restartRelevant: false
          })
        ]),
        restartPolicy: immutableRestartPolicy
      }),
      Object.freeze({
        ...common,
        serviceId: "mt5_readonly_bridge",
        displayName: "GoTrader MT5 read-only bridge",
        command: nodeExecutable,
        args: Object.freeze([bridgeScript]),
        scriptPath: bridgeScript,
        runtime: "node",
        dependencies: Object.freeze(["mt5_readonly_upstream"]),
        expectedPorts: Object.freeze([bridgePort]),
        identityTokens: Object.freeze([bridgeScript]),
        environment: Object.freeze({
          MT5_READONLY_BRIDGE_HOST: host,
          MT5_READONLY_BRIDGE_PORT: String(bridgePort),
          MT5_READONLY_UPSTREAM_BASE_URL: upstreamUrl
        }),
        healthProbes: Object.freeze([
          Object.freeze({
            probeId: "bridge_health",
            kind: "health",
            url: `${bridgeUrl}/health`,
            expectedServiceVersion: "gotrader-mt5-readonly-wrapper-v1.1",
            restartRelevant: true
          }),
          Object.freeze({
            probeId: "bridge_transport",
            kind: "transport",
            url: `${bridgeUrl}/status`,
            restartRelevant: false
          }),
          Object.freeze({
            probeId: "bridge_time_contract",
            kind: "time_contract",
            url: `${bridgeUrl}/time-contract?symbol=USTECH`,
            restartRelevant: false
          }),
          Object.freeze({
            probeId: "bridge_quote",
            kind: "quote",
            url: `${bridgeUrl}/quote?requestedSymbol=MNQ&symbol=USTECH`,
            restartRelevant: false
          }),
          Object.freeze({
            probeId: "bridge_candles",
            kind: "candles",
            url: `${bridgeUrl}/candles?requestedSymbol=MNQ&symbol=USTECH&timeframe=5m&limit=2`,
            restartRelevant: false
          })
        ]),
        restartPolicy: immutableRestartPolicy
      })
    ])
  });
}

export function buildAlwaysOnReadOnlySchedulerProfile({
  repoRoot,
  env = process.env,
  nodeExecutable = process.execPath
}) {
  const base = buildAlwaysOnReadOnlyProfile({ repoRoot, env, nodeExecutable });
  const root = path.resolve(repoRoot);
  const host = env.GOTRADER_RUNTIME_HOST || "127.0.0.1";
  const bridgePort = boundedInteger(env.GOTRADER_RUNTIME_BRIDGE_PORT, 7341, 1, 65_535);
  const feedPort = boundedInteger(env.GOTRADER_RUNTIME_FEED_PORT, 7343, 1, 65_535);
  const schedulerPort = boundedInteger(env.GOTRADER_RUNTIME_SCHEDULER_PORT, 7344, 1, 65_535);
  const bridgeUrl = `http://${host}:${bridgePort}`;
  const feedUrl = `http://${host}:${feedPort}`;
  const feedScript = path.join(root, "scripts", "gotrader-continuous-feed.mjs");
  const schedulerScript = path.join(root, "scripts", "gotrader-autonomous-scheduler.mjs");
  const common = {
    workingDirectory: root,
    required: true,
    authority: runtimeAuthority
  };
  const managedRestartPolicy = immutableRestartPolicy;

  return Object.freeze({
    ...base,
    profileId: ALWAYS_ON_READ_ONLY_SCHEDULER_PROFILE_ID,
    profileVersion: ALWAYS_ON_READ_ONLY_SCHEDULER_PROFILE_VERSION,
    continuousFeedEnabled: true,
    closedCandleSchedulerEnabled: true,
    strategySchedulerEnabled: false,
    enabledTaskTypes: Object.freeze([
      "runtime_health_snapshot",
      "current_market_snapshot"
    ]),
    services: Object.freeze([
      ...base.services,
      Object.freeze({
        ...common,
        serviceId: "market_data_feed",
        displayName: "GoTrader continuous read-only market-data feed",
        command: nodeExecutable,
        args: Object.freeze(["--max-old-space-size=256", feedScript]),
        scriptPath: feedScript,
        runtime: "node",
        dependencies: Object.freeze(["mt5_readonly_bridge"]),
        expectedPorts: Object.freeze([feedPort]),
        identityTokens: Object.freeze([feedScript]),
        environment: Object.freeze({
          GOTRADER_RUNTIME_PROFILE_ID: ALWAYS_ON_READ_ONLY_SCHEDULER_PROFILE_ID,
          GOTRADER_FEED_HOST: host,
          GOTRADER_FEED_PORT: String(feedPort),
          GOTRADER_FEED_BRIDGE_URL: bridgeUrl
        }),
        healthProbes: Object.freeze([
          Object.freeze({
            probeId: "feed_health",
            kind: "health",
            url: `${feedUrl}/health`,
            expectedServiceVersion: "gotrader-continuous-feed-v1",
            restartRelevant: true
          }),
          Object.freeze({
            probeId: "feed_transport",
            kind: "transport",
            url: `${feedUrl}/status`,
            restartRelevant: false
          })
        ]),
        restartPolicy: managedRestartPolicy
      }),
      Object.freeze({
        ...common,
        serviceId: "autonomous_cycle_scheduler",
        displayName: "GoTrader read-only closed-candle scheduler",
        command: nodeExecutable,
        args: Object.freeze(["--max-old-space-size=256", schedulerScript]),
        scriptPath: schedulerScript,
        runtime: "node",
        dependencies: Object.freeze(["market_data_feed"]),
        expectedPorts: Object.freeze([schedulerPort]),
        identityTokens: Object.freeze([schedulerScript]),
        environment: Object.freeze({
          GOTRADER_RUNTIME_PROFILE_ID: ALWAYS_ON_READ_ONLY_SCHEDULER_PROFILE_ID,
          GOTRADER_SCHEDULER_HOST: host,
          GOTRADER_SCHEDULER_PORT: String(schedulerPort),
          GOTRADER_SCHEDULER_FEED_URL: feedUrl
        }),
        healthProbes: Object.freeze([
          Object.freeze({
            probeId: "scheduler_health",
            kind: "health",
            url: `http://${host}:${schedulerPort}/health`,
            expectedServiceVersion: "gotrader-autonomous-scheduler-v1",
            restartRelevant: true
          }),
          Object.freeze({
            probeId: "scheduler_transport",
            kind: "transport",
            url: `http://${host}:${schedulerPort}/status`,
            restartRelevant: false
          })
        ]),
        restartPolicy: managedRestartPolicy
      })
    ])
  });
}

export function buildRuntimeProfile({
  profileId = ALWAYS_ON_READ_ONLY_PROFILE_ID,
  ...options
}) {
  if (profileId === ALWAYS_ON_READ_ONLY_PROFILE_ID) {
    return buildAlwaysOnReadOnlyProfile(options);
  }
  if (profileId === ALWAYS_ON_READ_ONLY_SCHEDULER_PROFILE_ID) {
    return buildAlwaysOnReadOnlySchedulerProfile(options);
  }
  if (profileId === ALWAYS_ON_SHADOW_CONTEXT_PROFILE_ID) {
    const base = buildAlwaysOnReadOnlySchedulerProfile(options);
    return Object.freeze({
      ...base,
      profileId: ALWAYS_ON_SHADOW_CONTEXT_PROFILE_ID,
      profileVersion: ALWAYS_ON_SHADOW_CONTEXT_PROFILE_VERSION,
      timeVerificationEnabled: true,
      shadowContextEnabled: true,
      enabledTaskTypes: Object.freeze([
        "runtime_health_snapshot",
        "current_market_snapshot",
        "shadow_context_refresh"
      ]),
      services: Object.freeze(
        base.services.map((service) =>
          ["market_data_feed", "autonomous_cycle_scheduler"].includes(
            service.serviceId
          )
            ? Object.freeze({
                ...service,
                environment: Object.freeze({
                  ...service.environment,
                  GOTRADER_RUNTIME_PROFILE_ID:
                    ALWAYS_ON_SHADOW_CONTEXT_PROFILE_ID
                })
              })
            : service
        )
      )
    });
  }
  if (profileId === ALWAYS_ON_SHADOW_CONTEXT_VERIFIED_PROFILE_ID) {
    const base = buildAlwaysOnReadOnlySchedulerProfile(options);
    const root = path.resolve(options.repoRoot);
    const env = options.env ?? process.env;
    const host = env.GOTRADER_RUNTIME_HOST || "127.0.0.1";
    const upstreamPort = boundedInteger(
      env.GOTRADER_RUNTIME_UPSTREAM_PORT,
      8000,
      1,
      65_535
    );
    const bridgePort = boundedInteger(
      env.GOTRADER_RUNTIME_BRIDGE_PORT,
      7341,
      1,
      65_535
    );
    const verifierPort = boundedInteger(
      env.GOTRADER_RUNTIME_TIME_VERIFIER_PORT,
      7345,
      1,
      65_535
    );
    const verifierScript = path.join(
      root,
      "scripts",
      "gotrader-current-live-time-verifier.mjs"
    );
    const verifierUrl = `http://${host}:${verifierPort}`;
    const verifierService = Object.freeze({
      workingDirectory: root,
      required: true,
      authority: runtimeAuthority,
      serviceId: "current_live_time_verifier",
      displayName: "GoTrader current-live MT5 time verifier",
      command: options.nodeExecutable ?? process.execPath,
      args: Object.freeze(["--max-old-space-size=128", verifierScript]),
      scriptPath: verifierScript,
      runtime: "node",
      dependencies: Object.freeze(["mt5_readonly_bridge"]),
      expectedPorts: Object.freeze([verifierPort]),
      identityTokens: Object.freeze([verifierScript]),
      environment: Object.freeze({
        GOTRADER_RUNTIME_PROFILE_ID:
          ALWAYS_ON_SHADOW_CONTEXT_VERIFIED_PROFILE_ID,
        GOTRADER_TIME_VERIFIER_HOST: host,
        GOTRADER_TIME_VERIFIER_PORT: String(verifierPort),
        MT5_READONLY_UPSTREAM_BASE_URL: `http://${host}:${upstreamPort}`,
        MT5_READONLY_BRIDGE_URL: `http://${host}:${bridgePort}`
      }),
      healthProbes: Object.freeze([
        Object.freeze({
          probeId: "time_verifier_health",
          kind: "health",
          url: `${verifierUrl}/health`,
          expectedServiceVersion: "gotrader-current-live-time-verifier-v1",
          restartRelevant: true
        }),
        Object.freeze({
          probeId: "time_verifier_status",
          kind: "transport",
          url: `${verifierUrl}/status`,
          restartRelevant: false
        })
      ]),
      restartPolicy: immutableRestartPolicy
    });
    const services = [];
    for (const service of base.services) {
      if (service.serviceId === "market_data_feed") {
        services.push(verifierService);
        services.push(
          Object.freeze({
            ...service,
            dependencies: Object.freeze(["current_live_time_verifier"]),
            environment: Object.freeze({
              ...service.environment,
              GOTRADER_RUNTIME_PROFILE_ID:
                ALWAYS_ON_SHADOW_CONTEXT_VERIFIED_PROFILE_ID
            })
          })
        );
      } else if (service.serviceId === "autonomous_cycle_scheduler") {
        services.push(
          Object.freeze({
            ...service,
            environment: Object.freeze({
              ...service.environment,
              GOTRADER_RUNTIME_PROFILE_ID:
                ALWAYS_ON_SHADOW_CONTEXT_VERIFIED_PROFILE_ID
            })
          })
        );
      } else {
        services.push(service);
      }
    }
    return Object.freeze({
      ...base,
      profileId: ALWAYS_ON_SHADOW_CONTEXT_VERIFIED_PROFILE_ID,
      profileVersion: ALWAYS_ON_SHADOW_CONTEXT_VERIFIED_PROFILE_VERSION,
      timeVerificationEnabled: true,
      persistentTimeVerifierEnabled: true,
      shadowContextEnabled: true,
      enabledTaskTypes: Object.freeze([
        "runtime_health_snapshot",
        "current_market_snapshot",
        "shadow_context_refresh"
      ]),
      services: Object.freeze(services)
    });
  }
  if (profileId === ALWAYS_ON_SHADOW_CONTEXT_OPERATIONAL_PROFILE_ID) {
    const base = buildRuntimeProfile({
      ...options,
      profileId: ALWAYS_ON_SHADOW_CONTEXT_VERIFIED_PROFILE_ID
    });
    return Object.freeze({
      ...base,
      profileId: ALWAYS_ON_SHADOW_CONTEXT_OPERATIONAL_PROFILE_ID,
      profileVersion: ALWAYS_ON_SHADOW_CONTEXT_OPERATIONAL_PROFILE_VERSION,
      operationalMarketStateEnabled: true,
      historicalContextHydrationEnabled: true,
      services: Object.freeze(
        base.services.map((service) =>
          [
            "current_live_time_verifier",
            "market_data_feed",
            "autonomous_cycle_scheduler"
          ].includes(service.serviceId)
            ? Object.freeze({
                ...service,
                environment: Object.freeze({
                  ...service.environment,
                  GOTRADER_RUNTIME_PROFILE_ID:
                    ALWAYS_ON_SHADOW_CONTEXT_OPERATIONAL_PROFILE_ID
                })
              })
            : service
        )
      )
    });
  }
  throw new Error(`Runtime profile is not allowlisted: ${profileId}.`);
}

export function validateRuntimeProfile(profile) {
  const errors = [];
  const allowedProfileIds = new Set([
    ALWAYS_ON_READ_ONLY_PROFILE_ID,
    ALWAYS_ON_READ_ONLY_SCHEDULER_PROFILE_ID,
    ALWAYS_ON_SHADOW_CONTEXT_PROFILE_ID,
    ALWAYS_ON_SHADOW_CONTEXT_VERIFIED_PROFILE_ID,
    ALWAYS_ON_SHADOW_CONTEXT_OPERATIONAL_PROFILE_ID
  ]);
  if (!allowedProfileIds.has(profile?.profileId)) {
    errors.push("runtime_profile_not_allowlisted");
  }
  if (profile?.productionAdoptionAllowed !== false) errors.push("production_adoption_must_be_false");
  if (profile?.strategySchedulerEnabled !== false) errors.push("strategy_scheduler_must_be_disabled");
  if (profile?.paperDemoEnabled !== false) errors.push("paper_demo_must_be_disabled");
  if (profile?.executionEnabled !== false) errors.push("execution_must_be_disabled");
  if (profile?.aiSupervisorEnabled !== false) errors.push("ai_supervisor_must_be_disabled");

  const ids = new Set();
  for (const service of profile?.services ?? []) {
    if (!service?.serviceId || ids.has(service.serviceId)) errors.push("duplicate_or_missing_service_id");
    ids.add(service?.serviceId);
    if (!path.isAbsolute(service?.workingDirectory ?? "")) {
      errors.push(`${service?.serviceId ?? "unknown"}_working_directory_not_absolute`);
    }
    if (!path.isAbsolute(service?.scriptPath ?? "")) {
      errors.push(`${service?.serviceId ?? "unknown"}_script_path_not_absolute`);
    }
    if (
      service?.authority?.executionAuthority !== "none" ||
      service?.authority?.brokerAuthority !== "none" ||
      service?.authority?.readinessOverrideAuthority !== "none"
    ) {
      errors.push(`${service?.serviceId ?? "unknown"}_authority_not_none`);
    }
    const unsafeText = [
      service?.serviceId,
      service?.displayName,
      service?.command,
      ...(service?.args ?? [])
    ]
      .join(" ")
      .toLowerCase();
    if (/\b(order|position|account|deal|execute|trade gateway|paper demo)\b/.test(unsafeText)) {
      errors.push(`${service?.serviceId ?? "unknown"}_unsafe_service_scope`);
    }
  }

  if (
    [
      ALWAYS_ON_READ_ONLY_SCHEDULER_PROFILE_ID,
      ALWAYS_ON_SHADOW_CONTEXT_PROFILE_ID,
      ALWAYS_ON_SHADOW_CONTEXT_VERIFIED_PROFILE_ID,
      ALWAYS_ON_SHADOW_CONTEXT_OPERATIONAL_PROFILE_ID
    ].includes(profile?.profileId) &&
    (profile?.continuousFeedEnabled !== true || profile?.closedCandleSchedulerEnabled !== true)
  ) {
    errors.push("scheduler_profile_services_must_be_enabled");
  }
  const expected = [
    "mt5_terminal",
    "mt5_readonly_upstream",
    "mt5_readonly_bridge",
    ...([
      ALWAYS_ON_READ_ONLY_SCHEDULER_PROFILE_ID,
      ALWAYS_ON_SHADOW_CONTEXT_PROFILE_ID,
      ALWAYS_ON_SHADOW_CONTEXT_VERIFIED_PROFILE_ID,
      ALWAYS_ON_SHADOW_CONTEXT_OPERATIONAL_PROFILE_ID
    ].includes(profile?.profileId)
      ? ["market_data_feed", "autonomous_cycle_scheduler"]
      : [])
  ];
  if (
    [
      ALWAYS_ON_SHADOW_CONTEXT_VERIFIED_PROFILE_ID,
      ALWAYS_ON_SHADOW_CONTEXT_OPERATIONAL_PROFILE_ID
    ].includes(profile?.profileId)
  ) {
    expected.splice(
      expected.indexOf("market_data_feed"),
      0,
      "current_live_time_verifier"
    );
  }
  for (const id of expected) {
    if (!ids.has(id)) errors.push(`${id}_missing`);
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}

export function serviceStartupOrder(profile) {
  const services = new Map((profile?.services ?? []).map((service) => [service.serviceId, service]));
  const visited = new Set();
  const active = new Set();
  const result = [];

  const visit = (service) => {
    if (visited.has(service.serviceId)) return;
    if (active.has(service.serviceId)) throw new Error(`Runtime service dependency cycle at ${service.serviceId}.`);
    active.add(service.serviceId);
    for (const dependencyId of service.dependencies ?? []) {
      const dependency = services.get(dependencyId);
      if (!dependency) throw new Error(`Missing dependency ${dependencyId} for ${service.serviceId}.`);
      visit(dependency);
    }
    active.delete(service.serviceId);
    visited.add(service.serviceId);
    result.push(service);
  };

  for (const service of profile?.services ?? []) visit(service);
  return result;
}

export function serviceShutdownOrder(profile) {
  return serviceStartupOrder(profile)
    .filter((service) => service.runtime !== "external")
    .reverse();
}

export function isPathWithinWorktree(targetPath, repoRoot) {
  const relative = path.relative(path.resolve(repoRoot), path.resolve(targetPath));
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

export function buildProcessFingerprint({
  service,
  repositoryRoot,
  branch,
  headCommit
}) {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        serviceId: service.serviceId,
        command: service.command,
        args: service.args,
        scriptPath: normalizedPath(service.scriptPath),
        workingDirectory: normalizedPath(service.workingDirectory),
        repositoryRoot: normalizedPath(repositoryRoot),
        branch,
        headCommit
      })
    )
    .digest("hex");
}

export function classifyProcessOwnership({ processInfo, service, repositoryRoot }) {
  if (!processInfo?.pid) return { status: "free" };
  const commandLine = normalizedCommandLine(processInfo.commandLine);
  const executablePath = normalizedPath(processInfo.executablePath || "");
  const expectedScript = normalizedPath(service.scriptPath);
  const expectedRoot = normalizedPath(repositoryRoot);
  const expectedTokens = service.identityTokens.map((token) =>
    path.isAbsolute(String(token)) ? normalizedPath(token) : String(token).toLowerCase()
  );
  const exactScript = commandLine.includes(expectedScript) || executablePath === expectedScript;
  const allTokens = expectedTokens.every((token) => commandLine.includes(token) || executablePath === token);
  const knownScriptName = commandLine.includes(path.basename(expectedScript).toLowerCase());
  const currentWorktree = commandLine.includes(expectedRoot) || executablePath.startsWith(expectedRoot);

  if (exactScript && allTokens && (service.runtime === "external" || currentWorktree)) {
    return { status: "owned_current_worktree", pid: processInfo.pid };
  }
  if (knownScriptName && !currentWorktree) {
    return {
      status: "blocked_foreign_worktree",
      pid: processInfo.pid,
      reason: "service_script_owned_by_different_worktree"
    };
  }
  return {
    status: "blocked_unknown_owner",
    pid: processInfo.pid,
    reason: "port_owned_by_unapproved_process"
  };
}

export function classifyProbe({ descriptor, result, now = new Date().toISOString() }) {
  const payload = result?.payload && typeof result.payload === "object" ? result.payload : {};
  const connectionStatus = String(
    payload.connectionStatus ??
      payload.status ??
      payload.bridgeStatus ??
      payload.state ??
      ""
  ).toLowerCase();
  const versionMatches =
    !descriptor.expectedServiceVersion ||
    payload.serviceVersion === descriptor.expectedServiceVersion;
  const effectiveOk = Boolean(result?.ok && versionMatches);
  let classification = effectiveOk
    ? "healthy"
    : result?.ok
      ? "stale_service_version"
      : "transport_unavailable";
  const warnings = [];
  if (result?.ok && !versionMatches) warnings.push("service_version_mismatch");

  if (effectiveOk && descriptor.kind === "time_contract") {
    const verified =
      payload.verificationStatus === "verified" &&
      payload.providerTimeBasis &&
      payload.providerTimeBasis !== "unknown";
    classification = verified ? "verified" : "available_unverified";
    if (!verified) warnings.push("historical_time_contract_not_verified");
  } else if (effectiveOk && descriptor.kind === "quote") {
    classification = ["connected", "live", "healthy"].includes(connectionStatus)
      ? "fresh_or_market_quiet"
      : "quote_unavailable";
    if (classification !== "fresh_or_market_quiet") warnings.push("quote_unavailable");
  } else if (effectiveOk && descriptor.kind === "candles") {
    const count = Number(
      payload.candleCount ??
        payload.returnedCount ??
        payload.candles?.length ??
        (Array.isArray(payload) ? payload.length : 0)
    );
    classification = count > 0 ? "available" : "candle_data_unavailable";
    if (count <= 0) warnings.push("candle_data_unavailable");
  } else if (effectiveOk && descriptor.kind === "transport") {
    classification = [
      "degraded",
      "planned",
      "unavailable",
      "disconnected",
      "blocked",
      "stale"
    ].includes(connectionStatus)
      ? "degraded"
      : "healthy";
    if (classification === "degraded") warnings.push("market_data_transport_degraded");
  }

  return {
    probeId: descriptor.probeId,
    kind: descriptor.kind,
    ok: effectiveOk,
    status: result?.status,
    classification,
    checkedAt: now,
    restartRelevant: descriptor.restartRelevant,
    warnings
  };
}

export function classifyRuntimeState({ profile, serviceStatuses }) {
  const blockers = [];
  const warnings = [];
  let state = "healthy";
  const byId = new Map(serviceStatuses.map((status) => [status.serviceId, status]));

  for (const service of profile.services) {
    const status = byId.get(service.serviceId);
    if (!status) {
      blockers.push(`${service.serviceId}_status_missing`);
      state = "blocked";
      continue;
    }
    blockers.push(...(status.blockers ?? []));
    warnings.push(...(status.warnings ?? []));
    if (["blocked", "failed", "stopped"].includes(status.state) && service.required) {
      state = "blocked";
    } else if (state !== "blocked" && ["degraded", "stale", "restarting"].includes(status.state)) {
      state = "degraded";
    }
  }

  return {
    state,
    blockers: [...new Set(blockers)],
    warnings: [...new Set(warnings)]
  };
}

export function registerRestartAttempt({
  attempts = [],
  policy = immutableRestartPolicy,
  nowMs = Date.now()
}) {
  const recent = attempts.filter((timestamp) => nowMs - Number(timestamp) <= policy.windowMs);
  if (!policy.enabled || recent.length >= policy.maximumAttempts) {
    return {
      allowed: false,
      blocker: "restart_budget_exhausted",
      attempts: recent,
      delayMs: 0
    };
  }
  const delayIndex = Math.min(recent.length, policy.delaysMs.length - 1);
  return {
    allowed: true,
    attempts: [...recent, nowMs],
    delayMs: policy.delaysMs[delayIndex] ?? 0
  };
}

export function redactRuntimeText(value) {
  return String(value ?? "")
    .replace(
      /\b(password|token|secret|api[_-]?key|authorization|login)\b\s*[:=]\s*([^\s,;]+)/gi,
      "$1=[redacted]"
    )
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]");
}

export function compactRuntimeStatus({
  runtimeId,
  repositoryIdentity,
  profile,
  state,
  startedAt,
  lastHealthyAt,
  serviceStatuses,
  blockers,
  warnings
}) {
  return {
    runtimeId,
    profileId: profile.profileId,
    profileVersion: profile.profileVersion,
    supervisorVersion: GOTRADER_RUNTIME_SUPERVISOR_VERSION,
    state,
    repositoryRoot: repositoryIdentity.repositoryRoot,
    branch: repositoryIdentity.branch,
    headCommit: repositoryIdentity.headCommit,
    startedAt,
    lastHealthyAt,
    services: serviceStatuses,
    blockers: [...new Set(blockers)],
    warnings: [...new Set(warnings)],
    browserRequired: false,
    continuousFeedEnabled: profile.continuousFeedEnabled === true,
    closedCandleSchedulerEnabled: profile.closedCandleSchedulerEnabled === true,
    strategySchedulerEnabled: false,
    paperDemoEnabled: false,
    executionEnabled: false,
    aiSupervisorEnabled: false,
    productionAdoptionAllowed: false,
    authority: runtimeAuthority
  };
}

export function stableStatusHash(value) {
  return crypto.createHash("sha256").update(canonicalJson(value)).digest("hex");
}
