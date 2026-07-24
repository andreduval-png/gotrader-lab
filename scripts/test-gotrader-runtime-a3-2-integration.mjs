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

const root = await fs.mkdtemp(
  path.join(os.tmpdir(), "gotrader-a3-2-integration-")
);
const dependencies = await loadShadowContextDependencies({
  repoRoot: path.resolve("."),
  outRoot: path.join(root, "compiled")
});
const asOf = "2026-07-23T14:05:00.000Z";
const asOfMs = Date.parse(asOf);
const durationByTimeframe = {
  "5m": 5 * 60_000,
  "15m": 15 * 60_000,
  "1h": 60 * 60_000,
  "4h": 4 * 60 * 60_000,
  "1d": 24 * 60 * 60_000
};
const windows = Object.fromEntries(
  Object.entries(durationByTimeframe).map(([timeframe, durationMs]) => {
    const candles = Array.from({ length: 8 }, (_, index) => {
      const closeMs = asOfMs - (7 - index) * durationMs;
      const openMs = closeMs - durationMs;
      return {
        candleOpenTime: new Date(openMs).toISOString(),
        candleCloseTime: new Date(closeMs).toISOString(),
        open: 20_000 + index,
        high: 20_020 + index,
        low: 19_980 + index,
        close: 20_010 + index,
        tickVolume: 100 + index
      };
    });
    return [timeframe, candles];
  })
);
const controller = await createShadowContextController({
  contextRoot: path.join(root, "context"),
  dependencies,
  fetchWindows: async () => ({
    requestedSymbol: "MNQ",
    brokerSymbol: "USTECH",
    asOf,
    windows,
    timeContract: {
      version: "mt5-time-contract-v2",
      eligible: true,
      verificationArtifactId: "sha256:a3-2-proof",
      verificationProofState: "fresh",
      verificationGeneratedAtUtc: "2026-07-23T14:04:30.000Z",
      verificationExpiresAtUtc: "2026-07-23T14:07:30.000Z",
      offsetRegimeStartUtc: "2026-07-23T14:00:00.000Z",
      terminalClockClassificationVersion: "1.0.0",
      providerTimeBasis: "verified_trade_server_wall_clock",
      observedOffsetMinutes: -240
    },
    hydration: {
      status: "ready",
      hydrationFingerprint: "sha256:a3-2-hydration",
      boundedHistoricalContextEligible: true,
      historicalEligible: false,
      historicalDstPolicyVerified: false,
      rawCandlesPersisted: false
    },
    sourceProvider: "mt5_read_only",
    rawCandlesPersisted: false,
    ...shadowContextAuthority
  })
});
const event = {
  eventId: "a3-2-verified-close",
  type: "candle_closed",
  sourceProvider: "mt5_read_only",
  sourceIdentity: "sha256:a3-2-source",
  sourceFingerprint: "sha256:a3-2-source",
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  timeframe: "5m",
  observedMarketTime: asOf,
  receivedAt: "2026-07-23T14:05:01.000Z",
  timeVerificationArtifactId: "sha256:a3-2-proof",
  ...shadowContextAuthority
};
const result = await controller.handler({
  event,
  task: {
    taskType: "shadow_context_refresh",
    taskVersion: "2.0.0"
  }
});
assert.equal(result.status, "completed", result.blockers?.join(","));
assert.equal(result.resultArtifact.rawCandlesPersisted, false);
assert.equal(result.resultArtifact.evidenceCreated, false);
assert.equal(result.resultArtifact.canCreateEvidence, false);
assert.equal(result.resultArtifact.productionAdoptionAllowed, false);
assert.deepEqual(
  {
    executionAuthority: result.resultArtifact.executionAuthority,
    brokerAuthority: result.resultArtifact.brokerAuthority,
    readinessOverrideAuthority: result.resultArtifact.readinessOverrideAuthority
  },
  shadowContextAuthority
);
const persisted = await fs.readFile(
  path.join(root, "context", "artifacts.json"),
  "utf8"
);
assert.equal(persisted.includes("\"candles\":"), false);
assert.equal(persisted.includes("\"facts\":"), false);

console.log(
  JSON.stringify(
    {
      status: "passed",
      boundedHistoricalContextAccepted: true,
      completedContextCycleCount: controller.status().completedCount,
      historicalEligible: false,
      historicalDstPolicyVerified: false,
      rawCandlesPersisted: false,
      strategyExecuted: false,
      evidenceCreated: false,
      productionAdoptionAllowed: false,
      ...shadowContextAuthority
    },
    null,
    2
  )
);
