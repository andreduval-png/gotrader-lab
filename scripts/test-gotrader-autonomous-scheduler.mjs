#!/usr/bin/env node

import assert from "node:assert/strict";
import {
  createAutonomousSchedulerEngine,
  disabledSchedulerCapabilities,
  schedulerTaskRegistry,
  validateSchedulerTaskRegistry
} from "./gotrader-autonomous-scheduler-core.mjs";
import { continuousFeedAuthority } from "./gotrader-continuous-feed-core.mjs";

const closeEvent = (sequence = 1, eventId = `close-${sequence}`) => ({
  eventId,
  sequence,
  type: "candle_closed",
  sourceIdentity: "sha256:source",
  sourceFingerprint: "sha256:source",
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  timeframe: "5m",
  observedMarketTime: "2026-07-23T10:05:00.000Z",
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
});

assert.deepEqual(validateSchedulerTaskRegistry(), { valid: true, errors: [] });
assert.deepEqual(
  schedulerTaskRegistry.filter((task) => task.enabled).map((task) => task.taskType),
  ["runtime_health_snapshot", "current_market_snapshot"]
);
assert.equal(
  disabledSchedulerCapabilities.includes("broker_execution"),
  true
);

const engine = createAutonomousSchedulerEngine();
const ignored = await engine.processEvents([
  { ...closeEvent(), eventId: "forming-1", type: "forming_candle_updated" }
]);
assert.equal(ignored.artifacts.length, 0);

const first = await engine.processEvents([closeEvent()]);
assert.equal(first.artifacts.length, 2);
assert.equal(first.artifacts.every((artifact) => artifact.status === "completed"), true);
assert.equal(first.artifacts.every((artifact) => artifact.productionAdoptionAllowed === false), true);
assert.equal(first.artifacts.every((artifact) => artifact.requestedSymbol === "MNQ"), true);
assert.equal(JSON.stringify(first).includes("\"candles\":["), false);

const duplicate = await engine.processEvents([closeEvent()]);
assert.equal(duplicate.artifacts.length, 0);
const restarted = createAutonomousSchedulerEngine({ checkpoint: first.checkpoint });
const restartDuplicate = await restarted.processEvents([closeEvent()]);
assert.equal(restartDuplicate.artifacts.length, 0);

restarted.pause();
const paused = await restarted.processEvents([closeEvent(2)]);
assert.equal(paused.artifacts.length, 0);
assert.equal(paused.status.state, "paused");
restarted.resume();
const resumed = await restarted.processEvents([closeEvent(2)]);
assert.equal(resumed.artifacts.length, 2);

const timeoutRegistry = [
  {
    ...schedulerTaskRegistry[0],
    timeoutMs: 5,
    retryLimit: 0
  }
];
const timeoutEngine = createAutonomousSchedulerEngine({
  registry: timeoutRegistry,
  handlers: {
    runtime_health_snapshot: () =>
      new Promise((resolve) => setTimeout(() => resolve({}), 50))
  }
});
const timedOut = await timeoutEngine.processEvents([closeEvent()]);
assert.equal(timedOut.artifacts[0].status, "failed");
assert.deepEqual(timedOut.artifacts[0].blockers, ["task_timeout"]);

const boundedEngine = createAutonomousSchedulerEngine({ maximumQueueDepth: 1 });
const bounded = await boundedEngine.processEvents([closeEvent(1), closeEvent(2)]);
assert.equal(bounded.artifacts.length, 2);
assert.equal(bounded.status.droppedEventCount, 1);

let retryAttempts = 0;
const retryEngine = createAutonomousSchedulerEngine({
  registry: [schedulerTaskRegistry[0]],
  handlers: {
    runtime_health_snapshot: () => {
      retryAttempts += 1;
      if (retryAttempts === 1) throw new Error("fixture_retry");
      return { outputArtifactIds: ["retry-recovered"] };
    }
  }
});
const retried = await retryEngine.processEvents([closeEvent()]);
assert.equal(retried.artifacts[0].status, "completed");
assert.equal(retryAttempts, 2);

const cancelledEngine = createAutonomousSchedulerEngine();
cancelledEngine.cancel();
const cancelled = await cancelledEngine.processEvents([closeEvent()]);
assert.equal(cancelled.artifacts.length, 0);
assert.equal(cancelled.status.state, "stopping");

const serialized = JSON.stringify({
  registry: schedulerTaskRegistry,
  status: engine.status(),
  artifacts: first.artifacts
});
for (const forbidden of [
  "placeOrder",
  "buyMarket",
  "sellMarket",
  "accountMutation",
  "positionMutation",
  "\"candles\":["
]) {
  assert.equal(serialized.includes(forbidden), false);
}
assert.deepEqual(
  {
    executionAuthority: first.artifacts[0].executionAuthority,
    brokerAuthority: first.artifacts[0].brokerAuthority,
    readinessOverrideAuthority: first.artifacts[0].readinessOverrideAuthority
  },
  continuousFeedAuthority
);

console.log(
  JSON.stringify(
    {
      status: "passed",
      enabledTasks: schedulerTaskRegistry.filter((task) => task.enabled).map((task) => task.taskType),
      effectivelyOnceArtifacts: true,
      restartReconciliation: true,
      pauseResume: true,
      timeoutBounded: true,
      rawCandlesPersisted: false,
      productionAdoptionAllowed: false,
      ...continuousFeedAuthority
    },
    null,
    2
  )
);
