import crypto from "node:crypto";
import {
  continuousFeedAuthority,
  continuousFeedCapability,
  stableHash
} from "./gotrader-continuous-feed-core.mjs";

export const AUTONOMOUS_SCHEDULER_SERVICE_VERSION =
  "gotrader-autonomous-scheduler-v1";

export function buildSchedulerTaskRegistry({
  enableShadowContext = false
} = {}) {
  return Object.freeze([
  Object.freeze({
    taskType: "runtime_health_snapshot",
    taskVersion: "1.0.0",
    enabled: true,
    triggerEvent: "candle_closed",
    requiredTimeframes: Object.freeze([]),
    timeoutMs: 2_000,
    concurrencyPolicy: "one_per_task_type",
    retryLimit: 1,
    ...continuousFeedAuthority
  }),
  Object.freeze({
    taskType: "current_market_snapshot",
    taskVersion: "1.0.0",
    enabled: true,
    triggerEvent: "candle_closed",
    requiredTimeframes: Object.freeze([]),
    timeoutMs: 2_000,
    concurrencyPolicy: "one_per_task_type",
    retryLimit: 1,
    ...continuousFeedAuthority
  }),
  Object.freeze({
    taskType: "shadow_context_refresh",
    taskVersion: "2.0.0",
    enabled: enableShadowContext,
    triggerEvent: "candle_closed",
    requiredTimeframes: Object.freeze(["5m"]),
    inputTimeframes: Object.freeze(["5m", "15m", "1h", "4h", "1d"]),
    requiredRequestedSymbol: "MNQ",
    requiredBrokerSymbol: "USTECH",
    timeoutMs: 5_000,
    concurrencyPolicy: "one_per_task_type",
    retryLimit: 1,
    ...(enableShadowContext
      ? {}
      : { disabledReason: "verified_time_operational_gate_not_passed" }),
    ...continuousFeedAuthority
  }),
  Object.freeze({
    taskType: "shadow_ifvg_comparison",
    taskVersion: "1.0.0",
    enabled: false,
    triggerEvent: "candle_closed",
    requiredTimeframes: Object.freeze(["5m"]),
    timeoutMs: 5_000,
    concurrencyPolicy: "one_per_task_type",
    retryLimit: 0,
    disabledReason: "phase3_completion_gate_not_passed",
    ...continuousFeedAuthority
  })
  ]);
}

export const schedulerTaskRegistry = buildSchedulerTaskRegistry();

export const disabledSchedulerCapabilities = Object.freeze([
  "trade_intent_generation",
  "paper_order_creation",
  "broker_execution",
  "readiness_promotion",
  "evidence_creation",
  "profile_mutation",
  "autonomous_calibration_apply",
  "deep_replay",
  "walk_forward",
  "oos",
  "monte_carlo"
]);

export function validateSchedulerTaskRegistry(registry = schedulerTaskRegistry) {
  const errors = [];
  const ids = new Set();
  for (const task of registry) {
    if (!task?.taskType || ids.has(task.taskType)) {
      errors.push("duplicate_or_missing_task_type");
    }
    ids.add(task?.taskType);
    if (task?.triggerEvent !== "candle_closed") {
      errors.push(`${task?.taskType ?? "unknown"}_trigger_not_allowlisted`);
    }
    if (
      task?.executionAuthority !== "none" ||
      task?.brokerAuthority !== "none" ||
      task?.readinessOverrideAuthority !== "none"
    ) {
      errors.push(`${task?.taskType ?? "unknown"}_authority_not_none`);
    }
    if (disabledSchedulerCapabilities.includes(task?.taskType) && task?.enabled) {
      errors.push(`${task.taskType}_must_be_disabled`);
    }
    if (task?.taskType === "shadow_ifvg_comparison" && task?.enabled) {
      errors.push("shadow_ifvg_comparison_must_remain_disabled");
    }
    if (
      task?.taskType === "shadow_context_refresh" &&
      task?.enabled &&
      (
        task.requiredRequestedSymbol !== "MNQ" ||
        task.requiredBrokerSymbol !== "USTECH" ||
        task.requiredTimeframes.length !== 1 ||
        task.requiredTimeframes[0] !== "5m"
      )
    ) {
      errors.push("shadow_context_refresh_trigger_scope_invalid");
    }
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}

const boundedUnique = (values, maximum) =>
  [...new Set(values.filter(Boolean))].slice(-Math.max(1, maximum));

const taskCycleId = (task, event) =>
  `cycle_${crypto
    .createHash("sha256")
    .update(`${task.taskType}|${task.taskVersion}|${event.eventId}`)
    .digest("hex")}`;

const runWithTimeout = async (operation, milliseconds) => {
  let timeout;
  try {
    return await Promise.race([
      operation,
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error("task_timeout")), milliseconds);
      })
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
};

const defaultTaskHandler = async ({ task, event, feedStatus }) => ({
  outputArtifactIds: [
    `artifact_${stableHash({
      taskType: task.taskType,
      taskVersion: task.taskVersion,
      eventId: event.eventId,
      sourceIdentity: event.sourceIdentity,
      feedState: feedStatus?.state ?? "unknown"
    })}`
  ],
  warnings: feedStatus?.warnings ?? []
});

export function createAutonomousSchedulerEngine({
  checkpoint,
  registry = schedulerTaskRegistry,
  handlers = {},
  maximumProcessedEvents = 10_000,
  maximumTaskRuns = 20_000,
  maximumArtifacts = 1_000,
  maximumQueueDepth = 100
} = {}) {
  const validation = validateSchedulerTaskRegistry(registry);
  if (!validation.valid) {
    throw new Error(`Invalid scheduler registry: ${validation.errors.join(",")}`);
  }
  const processedEventIds = new Set(checkpoint?.processedEventIds ?? []);
  const completedTaskRunIds = new Set(checkpoint?.completedTaskRunIds ?? []);
  let lastProcessedSequence = Number(checkpoint?.lastProcessedSequence ?? 0);
  let paused = checkpoint?.paused === true;
  let cancelled = false;
  let droppedEventCount = Number(checkpoint?.droppedEventCount ?? 0);
  let coalescedEventCount = Number(checkpoint?.coalescedEventCount ?? 0);
  let completedCycleCount = Number(checkpoint?.completedCycleCount ?? 0);
  let failedCycleCount = Number(checkpoint?.failedCycleCount ?? 0);
  let lastCycleOutcome = checkpoint?.lastCycleOutcome;
  const artifacts = [];
  const activeTaskTypes = new Set();

  const checkpointSnapshot = () => ({
    version: 1,
    lastProcessedSequence,
    processedEventIds: boundedUnique(
      [...processedEventIds],
      maximumProcessedEvents
    ),
    completedTaskRunIds: boundedUnique(
      [...completedTaskRunIds],
      maximumTaskRuns
    ),
    paused,
    droppedEventCount,
    coalescedEventCount,
    completedCycleCount,
    failedCycleCount,
    lastCycleOutcome,
    checkpointedAt: new Date().toISOString(),
    ...continuousFeedAuthority
  });

  const status = () => ({
    serviceVersion: AUTONOMOUS_SCHEDULER_SERVICE_VERSION,
    state: paused ? "paused" : cancelled ? "stopping" : "running",
    queueDepth: 0,
    activeTasks: [...activeTaskTypes],
    enabledTaskTypes: registry.filter((task) => task.enabled).map((task) => task.taskType),
    disabledTaskTypes: registry.filter((task) => !task.enabled).map((task) => task.taskType),
    lastProcessedSequence,
    completedCycleCount,
    failedCycleCount,
    droppedEventCount,
    coalescedEventCount,
    lastCycleOutcome,
    productionAdoptionAllowed: false,
    ...continuousFeedCapability,
    ...continuousFeedAuthority
  });

  const processEvents = async (inputEvents, { feedStatus } = {}) => {
    if (paused || cancelled) {
      return {
        artifacts: [],
        checkpoint: checkpointSnapshot(),
        status: status()
      };
    }
    const uniqueById = new Map();
    for (const event of inputEvents ?? []) {
      if (!event?.eventId || processedEventIds.has(event.eventId)) continue;
      if (uniqueById.has(event.eventId)) {
        coalescedEventCount += 1;
        continue;
      }
      uniqueById.set(event.eventId, event);
    }
    let queue = [...uniqueById.values()].sort(
      (left, right) => Number(left.sequence ?? 0) - Number(right.sequence ?? 0)
    );
    if (queue.length > maximumQueueDepth) {
      droppedEventCount += queue.length - maximumQueueDepth;
      queue = queue.slice(-maximumQueueDepth);
    }

    const newArtifacts = [];
    for (const event of queue) {
      if (cancelled) break;
      if (event.type !== "candle_closed") {
        processedEventIds.add(event.eventId);
        lastProcessedSequence = Math.max(
          lastProcessedSequence,
          Number(event.sequence ?? 0)
        );
        continue;
      }
      for (const task of registry.filter((candidate) => candidate.enabled)) {
        if (
          task.requiredTimeframes.length &&
          !task.requiredTimeframes.includes(event.timeframe)
        ) {
          continue;
        }
        if (
          task.requiredRequestedSymbol &&
          task.requiredRequestedSymbol !== event.requestedSymbol
        ) {
          continue;
        }
        if (
          task.requiredBrokerSymbol &&
          task.requiredBrokerSymbol !== event.brokerSymbol
        ) {
          continue;
        }
        const cycleId = taskCycleId(task, event);
        if (completedTaskRunIds.has(cycleId)) continue;
        if (activeTaskTypes.has(task.taskType)) {
          coalescedEventCount += 1;
          continue;
        }
        const startedAt = new Date().toISOString();
        let artifact;
        let attempt = 0;
        activeTaskTypes.add(task.taskType);
        while (attempt <= task.retryLimit && !artifact) {
          attempt += 1;
          try {
            const handler = handlers[task.taskType] ?? defaultTaskHandler;
            const result = await runWithTimeout(
              Promise.resolve(handler({ task, event, feedStatus, attempt })),
              task.timeoutMs
            );
            const resultStatus = ["completed", "blocked", "cancelled"].includes(
              result?.status
            )
              ? result.status
              : "completed";
            artifact = {
              cycleId,
              triggerEventId: event.eventId,
              taskType: task.taskType,
              startedAt,
              completedAt: new Date().toISOString(),
              status: resultStatus,
              sourceIdentity: event.sourceIdentity,
              sourceFingerprint: event.sourceFingerprint,
              requestedSymbol: event.requestedSymbol,
              brokerSymbol: event.brokerSymbol,
              timeframe: event.timeframe,
              observedMarketTime: event.observedMarketTime,
              blockers: Array.isArray(result?.blockers) ? result.blockers : [],
              warnings: Array.isArray(result?.warnings) ? result.warnings : [],
              outputArtifactIds: Array.isArray(result?.outputArtifactIds)
                ? result.outputArtifactIds
                : [],
              ...(result?.resultArtifact
                ? { resultArtifact: result.resultArtifact }
                : {}),
              productionAdoptionAllowed: false,
              ...continuousFeedAuthority
            };
          } catch (error) {
            if (attempt > task.retryLimit) {
              artifact = {
                cycleId,
                triggerEventId: event.eventId,
                taskType: task.taskType,
                startedAt,
                completedAt: new Date().toISOString(),
                status: cancelled ? "cancelled" : "failed",
                sourceIdentity: event.sourceIdentity,
                sourceFingerprint: event.sourceFingerprint,
                requestedSymbol: event.requestedSymbol,
                brokerSymbol: event.brokerSymbol,
                timeframe: event.timeframe,
                observedMarketTime: event.observedMarketTime,
                blockers: [
                  error instanceof Error ? error.message : String(error)
                ],
                warnings: [],
                outputArtifactIds: [],
                productionAdoptionAllowed: false,
                ...continuousFeedAuthority
              };
            }
          }
        }
        activeTaskTypes.delete(task.taskType);
        completedTaskRunIds.add(cycleId);
        if (artifact.status === "completed") completedCycleCount += 1;
        else failedCycleCount += 1;
        lastCycleOutcome = {
          cycleId,
          taskType: task.taskType,
          status: artifact.status,
          completedAt: artifact.completedAt
        };
        newArtifacts.push(artifact);
      }
      processedEventIds.add(event.eventId);
      lastProcessedSequence = Math.max(
        lastProcessedSequence,
        Number(event.sequence ?? 0)
      );
    }
    artifacts.push(...newArtifacts);
    if (artifacts.length > maximumArtifacts) {
      artifacts.splice(0, artifacts.length - maximumArtifacts);
    }
    return {
      artifacts: newArtifacts,
      checkpoint: checkpointSnapshot(),
      status: status()
    };
  };

  return {
    processEvents,
    checkpoint: checkpointSnapshot,
    status,
    artifacts: () => artifacts.map((artifact) => ({ ...artifact })),
    pause() {
      paused = true;
    },
    resume() {
      paused = false;
    },
    cancel() {
      cancelled = true;
    }
  };
}
