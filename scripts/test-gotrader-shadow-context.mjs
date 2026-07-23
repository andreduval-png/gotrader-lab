#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  createShadowContextController,
  loadShadowContextDependencies,
  shadowContextAuthority
} from "./gotrader-shadow-context-core.mjs";
import {
  buildSchedulerTaskRegistry,
  createAutonomousSchedulerEngine
} from "./gotrader-autonomous-scheduler-core.mjs";

const root = await fs.mkdtemp(path.join(os.tmpdir(), "gotrader-a3-context-"));
const event = {
  eventId: "close-a3-1",
  type: "candle_closed",
  sourceProvider: "mt5_read_only",
  sourceIdentity: "sha256:source",
  sourceFingerprint: "sha256:source",
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  timeframe: "5m",
  observedMarketTime: "2026-07-23T14:05:00.000Z",
  receivedAt: "2026-07-23T14:05:01.000Z",
  timeVerificationArtifactId: "sha256:proof",
  ...shadowContextAuthority
};
const task = {
  taskType: "shadow_context_refresh",
  taskVersion: "2.0.0"
};
const candle = {
  candleOpenTime: "2026-07-23T14:00:00.000Z",
  candleCloseTime: "2026-07-23T14:05:00.000Z",
  open: 100,
  high: 102,
  low: 99,
  close: 101
};
const capturedTimeEligibility = [];
const controller = await createShadowContextController({
  contextRoot: root,
  fetchWindows: async () => ({
    timeContract: {
      version: "v2",
      eligible: true,
      verificationArtifactId: "sha256:proof",
      verificationProofState: "fresh",
      verificationGeneratedAtUtc: "2026-07-23T14:04:00.000Z",
      verificationExpiresAtUtc: "2026-07-23T14:07:00.000Z",
      offsetRegimeStartUtc: "2026-07-23T12:00:00.000Z"
    },
    windows: Object.fromEntries(
      ["5m", "15m", "1h", "4h", "1d"].map((timeframe) => [
        timeframe,
        [candle]
      ])
    )
  }),
  dependencies: {
    createSourceIdentity: (source) => ({ ...source, marketDataAccess: "read_only" }),
    buildCanonicalWindow: async ({ query, sourceTimeEligibility }) => {
      capturedTimeEligibility.push(sourceTimeEligibility);
      return {
        identity: {
          identityHash: `sha256:${query.timeframe}`,
          candleCountByTimeframe: { [query.timeframe]: 1 }
        },
        candles: [candle]
      };
    },
    buildCanonicalContext: async () => ({
      contextArtifactId: "v2-context:fixture",
      contextSchemaVersion: "fixture-schema",
      contextPolicyVersion: "fixture-policy",
      sessionCalendarVersion: "fixture-calendar",
      facts: [{ kind: "session" }, { kind: "opening_price" }],
      diagnostics: {
        status: "eligible",
        blockers: [],
        warnings: [],
        comparisonEligible: true
      }
    })
  }
});

const first = await controller.handler({ event, task });
assert.equal(first.status, "completed");
assert.equal(first.resultArtifact.factCount, 2);
assert.equal(first.resultArtifact.rawCandlesPersisted, false);
assert.equal(first.resultArtifact.evidenceCreated, false);
assert.equal(
  capturedTimeEligibility.every(
    (item) =>
      item.offsetRegimeStartUtc === "2026-07-23T12:00:00.000Z"
  ),
  true
);
assert.deepEqual(
  {
    executionAuthority: first.resultArtifact.executionAuthority,
    brokerAuthority: first.resultArtifact.brokerAuthority,
    readinessOverrideAuthority: first.resultArtifact.readinessOverrideAuthority
  },
  shadowContextAuthority
);
const duplicate = await controller.handler({ event, task });
assert.equal(duplicate.outputArtifactIds[0], first.resultArtifact.artifactId);
assert.equal(controller.artifacts().length, 1);

const serialized = await fs.readFile(path.join(root, "artifacts.json"), "utf8");
assert.equal(serialized.includes("\"candles\":"), false);
assert.equal(serialized.includes("\"facts\":"), false);
assert.equal(serialized.includes("placeOrder"), false);
const coreSource = await fs.readFile(
  new URL("./gotrader-shadow-context-core.mjs", import.meta.url),
  "utf8"
);
const importSurface = coreSource
  .split(/\r?\n/)
  .filter((line) => line.trim().startsWith("import "))
  .join("\n");
for (const forbiddenImport of [
  "ictIfvg",
  "strategyAdapters",
  "tradeConstruction",
  "paperDemo",
  "walkForward",
  "readiness"
]) {
  assert.equal(importSurface.includes(forbiddenImport), false);
}

const missingProof = await controller.handler({
  event: { ...event, eventId: "close-a3-2", timeVerificationArtifactId: undefined },
  task
});
assert.equal(missingProof.status, "blocked");
assert.equal(
  missingProof.blockers.includes("time_verification_artifact_missing"),
  true
);

const insufficientRoot = await fs.mkdtemp(
  path.join(os.tmpdir(), "gotrader-a3-context-insufficient-")
);
const insufficientController = await createShadowContextController({
  contextRoot: insufficientRoot,
  fetchWindows: async () => ({
    timeContract: {
      version: "v2",
      eligible: true,
      verificationArtifactId: "sha256:proof",
      verificationProofState: "fresh",
      verificationGeneratedAtUtc: "2026-07-23T14:04:00.000Z",
      verificationExpiresAtUtc: "2026-07-23T14:07:00.000Z",
      offsetRegimeStartUtc: "2026-07-23T14:00:00.000Z"
    },
    windows: {
      "5m": [candle],
      "15m": [candle],
      "1h": [candle],
      "4h": [],
      "1d": []
    }
  }),
  dependencies: {
    createSourceIdentity: (source) => source,
    buildCanonicalWindow: async ({ query }) => ({
      identity: {
        identityHash: `sha256:${query.timeframe}`,
        candleCountByTimeframe: { [query.timeframe]: 1 }
      },
      candles: [candle]
    }),
    buildCanonicalContext: async () => {
      throw new Error("Context builder must not run with incomplete windows.");
    }
  }
});
const insufficient = await insufficientController.handler({
  event: { ...event, eventId: "close-a3-insufficient" },
  task
});
assert.equal(insufficient.status, "blocked");
assert.ok(insufficient.blockers.includes("insufficient_context_window:4h"));
assert.ok(insufficient.blockers.includes("insufficient_context_window:1d"));

const registry = buildSchedulerTaskRegistry({ enableShadowContext: true });
assert.equal(
  registry.find((item) => item.taskType === "shadow_context_refresh").enabled,
  true
);
assert.equal(
  registry.find((item) => item.taskType === "shadow_ifvg_comparison").enabled,
  false
);
const scheduler = createAutonomousSchedulerEngine({
  registry,
  handlers: { shadow_context_refresh: controller.handler }
});
const ignored = await scheduler.processEvents([
  { ...event, eventId: "quote-a3", sequence: 1, type: "quote_updated" },
  {
    ...event,
    eventId: "forming-a3",
    sequence: 2,
    type: "forming_candle_updated"
  }
]);
assert.equal(ignored.artifacts.length, 0);

const actualRoot = await fs.mkdtemp(
  path.join(os.tmpdir(), "gotrader-a3-context-actual-")
);
const actualDependencies = await loadShadowContextDependencies({
  repoRoot: path.resolve("."),
  outRoot: path.join(actualRoot, "compiled")
});
const actualController = await createShadowContextController({
  contextRoot: path.join(actualRoot, "context"),
  dependencies: actualDependencies,
  fetchWindows: async () => ({
    timeContract: {
      version: "v2",
      eligible: true,
      verificationArtifactId: "sha256:proof",
      verificationProofState: "fresh",
      verificationGeneratedAtUtc: "2026-07-23T14:04:00.000Z",
      verificationExpiresAtUtc: "2026-07-23T14:07:00.000Z",
      terminalClockClassificationVersion: "fixture-v1"
    },
    windows: Object.fromEntries(
      ["5m", "15m", "1h", "4h", "1d"].map((timeframe) => [
        timeframe,
        [candle]
      ])
    )
  })
});
const actual = await actualController.handler({
  event: { ...event, eventId: "close-a3-actual" },
  task
});
assert.equal(["completed", "blocked"].includes(actual.status), true);
assert.equal(actual.resultArtifact.rawCandlesPersisted, false);
assert.equal(actual.resultArtifact.canCreateEvidence, false);

console.log(
  JSON.stringify(
    {
      status: "passed",
      effectivelyOnce: true,
      compactArtifactOnly: true,
      noEvidenceCreated: true,
      strategyNeutral: true,
      missingProofBlocked: true,
      nonCloseEventsIgnored: true,
      canonicalContextBuilderInvoked: true,
      productionAdoptionAllowed: false,
      ...shadowContextAuthority
    },
    null,
    2
  )
);
