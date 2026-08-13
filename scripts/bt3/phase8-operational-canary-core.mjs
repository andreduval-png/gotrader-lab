import crypto from "node:crypto";

export const CANARY_SCHEMA = "gotrader-bt3-phase8-operational-canary-v1";
export const MINIMUM_DURATION_MS = 4 * 60 * 60 * 1000;

const sortValue = (value) => {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortValue(value[key])]));
  }
  return value;
};

export const canonicalJson = (value) => JSON.stringify(sortValue(value));
export const canonicalHash = (value) => `sha256:${crypto.createHash("sha256").update(canonicalJson(value)).digest("hex")}`;

export function buildCanaryConfig(input) {
  const config = Object.freeze({
    schemaVersion: `${CANARY_SCHEMA}-config`,
    candidateHead: input.candidateHead,
    durationMs: input.durationMs ?? MINIMUM_DURATION_MS,
    sampleIntervalMs: input.sampleIntervalMs ?? 5 * 60 * 1000,
    maxSamples: input.maxSamples ?? 64,
    maxRssBytes: input.maxRssBytes ?? 1024 * 1024 * 1024,
    maxStorageBytes: input.maxStorageBytes ?? 128 * 1024 * 1024,
    maxConcurrency: 1,
    maxQueueDepth: 4,
    maxStagesPerRun: 2,
    maxRetries: 2,
    authority: Object.freeze({ executionAuthority: "none", brokerAuthority: "none", readinessOverrideAuthority: "none" }),
    externalContactAllowed: false,
    runtimeAdoptionAllowed: false,
  });
  if (!/^[0-9a-f]{40}$/.test(config.candidateHead)) throw new Error("candidate head is invalid");
  if (config.durationMs < MINIMUM_DURATION_MS) throw new Error("canary duration must be at least four hours");
  if (config.sampleIntervalMs < 60_000 || config.maxSamples < 48 || config.maxSamples > 288) throw new Error("canary sampling bounds are invalid");
  return Object.freeze({ ...config, configId: canonicalHash(config) });
}

export function sealCheckpoint(core) {
  const value = Object.freeze({ ...core, schemaVersion: `${CANARY_SCHEMA}-checkpoint`, integrityHash: canonicalHash({ ...core, schemaVersion: `${CANARY_SCHEMA}-checkpoint` }) });
  return value;
}

export function validateCheckpoint(value, config) {
  if (!value || value.schemaVersion !== `${CANARY_SCHEMA}-checkpoint` || value.configId !== config.configId || value.candidateHead !== config.candidateHead) return false;
  const { integrityHash, ...core } = value;
  return integrityHash === canonicalHash(core) && Number.isInteger(value.sequence) && value.sequence >= 0 && value.monotonicElapsedMs >= 0;
}

export function assessCanary(checkpoint, config) {
  const wallElapsedMs = Date.parse(checkpoint.observedAt) - Date.parse(checkpoint.startedAt);
  const expectedSamples = Math.floor(config.durationMs / config.sampleIntervalMs);
  const blockers = [
    ...(checkpoint.blockers ?? []),
    ...(checkpoint.monotonicElapsedMs < config.durationMs ? ["minimum_monotonic_duration_not_met"] : []),
    ...(wallElapsedMs < config.durationMs ? ["minimum_wall_duration_not_met"] : []),
    ...(checkpoint.sequence < expectedSamples ? ["minimum_sample_count_not_met"] : []),
    ...(!checkpoint.controlledCancellationObserved ? ["controlled_cancellation_not_observed"] : []),
    ...(!checkpoint.browserRestartObserved ? ["browser_restart_not_observed"] : []),
    ...(checkpoint.maxRssBytesObserved > config.maxRssBytes ? ["memory_bound_exceeded"] : []),
    ...(checkpoint.storageBytesObserved > config.maxStorageBytes ? ["storage_bound_exceeded"] : []),
    ...(checkpoint.unexpectedFailures !== 0 ? ["unexpected_failures_observed"] : []),
    ...(checkpoint.authority?.executionAuthority !== "none" || checkpoint.authority?.brokerAuthority !== "none" || checkpoint.authority?.readinessOverrideAuthority !== "none" ? ["authority_violation"] : []),
  ];
  return Object.freeze({
    status: blockers.length === 0 ? "passed" : "blocked",
    blockers: Object.freeze([...new Set(blockers)].sort()),
    wallElapsedMs,
    expectedSamples,
    healthy: blockers.length === 0,
    fresh: checkpoint.sequence >= expectedSamples,
  });
}

export function sealFinalReport(checkpoint, config) {
  if (!validateCheckpoint(checkpoint, config)) throw new Error("final checkpoint integrity is invalid");
  const assessment = assessCanary(checkpoint, config);
  const core = {
    schemaVersion: `${CANARY_SCHEMA}-report`,
    runId: checkpoint.runId,
    candidateHead: config.candidateHead,
    configId: config.configId,
    finalCheckpointHash: checkpoint.integrityHash,
    completedAt: checkpoint.observedAt,
    assessment,
    authority: checkpoint.authority,
    externalContactObserved: false,
    runtimeAdoptionObserved: false,
  };
  return Object.freeze({ ...core, reportId: canonicalHash(core) });
}

