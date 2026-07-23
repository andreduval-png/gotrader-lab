#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileTypescriptModules } from "./v2-baseline/compile-typescript-modules.mjs";

const workspace = process.cwd();
const outRoot = path.join(workspace, ".gotrader", "v2-session-opening-facts-test");
const sourceFiles = [
  "src/lib/v2/authority/v2Authority.ts",
  "src/lib/v2/serialization/canonicalSerialization.ts",
  "src/lib/v2/identity/v2IdentityTypes.ts",
  "src/lib/v2/identity/v2Identity.ts",
  "src/lib/v2/time/v2TimeNormalizationTypes.ts",
  "src/lib/v2/time/v2Mt5TerminalClockTypes.ts",
  "src/lib/v2/time/v2Mt5UpstreamTimeContractTypes.ts",
  "src/lib/v2/candles/v2CandleTypes.ts",
  "src/lib/v2/candles/v2Timeframe.ts",
  "src/lib/v2/candles/v2CandleValidation.ts",
  "src/lib/v2/candles/v2CandleWindowBuilder.ts",
  "src/lib/v2/candles/v2StaticCandleRepository.ts",
  "src/lib/v2/context/v2ContextTypes.ts",
  "src/lib/v2/context/v2ContextIdentity.ts",
  "src/lib/v2/context/v2ContextEligibility.ts",
  "src/lib/v2/context/v2SessionOpeningFactEngine.ts",
  "src/lib/v2/context/v2ContextBuilder.ts"
].map((file) => path.join(workspace, file));

compileTypescriptModules({ files: sourceFiles, outRoot });
const load = (name) => import(pathToFileURL(path.join(outRoot, `${name}.mjs`)).href);
const identityModule = await load("v2Identity");
const repositoryModule = await load("v2StaticCandleRepository");
const contextModule = await load("v2ContextBuilder");
const contextTypes = await load("v2ContextTypes");

const authority = Object.freeze({
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
});
const makeCandles = ({ start, end, minutes = 5, omit = [] }) => {
  const omitted = new Set(omit.map((value) => Date.parse(value)));
  const candles = [];
  let index = 0;
  for (let timestamp = Date.parse(start); timestamp < Date.parse(end); timestamp += minutes * 60_000) {
    if (omitted.has(timestamp)) continue;
    const open = 20_000 + index;
    candles.push(Object.freeze({
      timestamp: new Date(timestamp).toISOString(),
      open,
      high: open + 8,
      low: open - 5,
      close: open + 3,
      volume: 100 + index,
      closed: true
    }));
    index += 1;
  }
  return Object.freeze(candles);
};

const source = identityModule.createV2SourceIdentity({
  sourceId: "fixture:USTECH:5m:phase2a3",
  provider: "imported_historical",
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  sourceFingerprint: "phase2a3-session-opening-fixture",
  sourceKind: "imported_historical"
});
const fullCandles = makeCandles({
  start: "2026-07-12T22:00:00.000Z",
  end: "2026-07-13T20:00:00.000Z"
});

const windowFor = async ({ candles = fullCandles, timeframe = "5m", asOf = "2026-07-13T20:00:00.000Z" } = {}) => {
  const repository = repositoryModule.createV2StaticCandleRepository({
    adapterId: "phase2a3-fixture-adapter",
    asOf: () => asOf,
    loadSource: async () => ({
      identity: source,
      timeframe,
      candles,
      closurePolicy: "historical_dataset"
    })
  });
  return repository.getWindow({
    source,
    timeframe,
    limit: 500,
    closedOnly: true,
    purpose: "context_shadow"
  });
};

const fullWindow = await windowFor();
const request = {
  source,
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  asOfMarketTime: "2026-07-13T20:00:00.000Z",
  requiredTimeframes: ["5m"],
  windows: [fullWindow],
  purpose: "deterministic_fixture",
  requestedFactFamilies: ["session", "opening_price"],
  builtAt: "2026-07-13T20:00:01.000Z"
};
const context = await contextModule.buildV2CanonicalMarketContext(request);
assert.equal(context.diagnostics.status, "eligible");
assert.equal(context.diagnostics.factEngineStatus, "session_opening_price_phase_2a3");
assert.equal(context.facts.length, 8);
assert.deepEqual(context.identity.requestedFactFamilies, ["opening_price", "session"]);
assert.deepEqual(context.identity.factPolicyVersions, [
  contextTypes.V2_CONTEXT_OPENING_PRICE_FACT_POLICY_VERSION,
  contextTypes.V2_CONTEXT_SESSION_FACT_POLICY_VERSION
]);

const sessions = context.facts.filter((fact) => fact.kind === "session");
assert.deepEqual(sessions.map((fact) => fact.payload.sessionType), [
  "asia",
  "london",
  "new_york_am",
  "new_york_lunch",
  "new_york_pm"
]);
assert.ok(sessions.every((fact) => fact.payload.complete === true));
assert.ok(sessions.every((fact) => fact.quality.status === "eligible"));
const asia = sessions.find((fact) => fact.payload.sessionType === "asia");
assert.equal(asia.payload.startUtc, "2026-07-13T00:00:00.000Z");
assert.equal(asia.payload.endUtc, "2026-07-13T04:00:00.000Z");
const nyAm = sessions.find((fact) => fact.payload.sessionType === "new_york_am");
assert.equal(nyAm.payload.startUtc, "2026-07-13T13:30:00.000Z");
assert.equal(nyAm.payload.endUtc, "2026-07-13T16:00:00.000Z");

const openings = context.facts.filter((fact) => fact.kind === "opening_price");
assert.deepEqual(openings.map((fact) => fact.payload.openingType), ["sunday", "new_york_midnight", "new_york_0930"]);
assert.equal(openings.find((fact) => fact.payload.openingType === "sunday").payload.boundaryUtc, "2026-07-12T22:00:00.000Z");
assert.equal(openings.find((fact) => fact.payload.openingType === "new_york_midnight").payload.boundaryUtc, "2026-07-13T04:00:00.000Z");
assert.equal(openings.find((fact) => fact.payload.openingType === "new_york_0930").payload.boundaryUtc, "2026-07-13T13:30:00.000Z");
assert.ok(openings.every((fact) => fact.payload.derivationQuality === "exact_candle_open"));

const rebuilt = await contextModule.buildV2CanonicalMarketContext({ ...request, builtAt: "2026-07-13T20:01:00.000Z" });
assert.equal(rebuilt.contextArtifactId, context.contextArtifactId);
assert.deepEqual(rebuilt.facts.map((fact) => fact.factId), context.facts.map((fact) => fact.factId));

const legacyNoFacts = await contextModule.buildV2CanonicalMarketContext({
  ...request,
  requestedFactFamilies: undefined
});
assert.equal(legacyNoFacts.facts.length, 0);
assert.equal(legacyNoFacts.diagnostics.factEngineStatus, "not_implemented_phase_2a0");

const partialCandles = Object.freeze(fullCandles.filter((candle) => Date.parse(candle.timestamp) < Date.parse("2026-07-13T14:00:00.000Z")));
const partialWindow = await windowFor({ candles: partialCandles, asOf: "2026-07-13T14:00:00.000Z" });
const partial = await contextModule.buildV2CanonicalMarketContext({
  ...request,
  asOfMarketTime: "2026-07-13T14:00:00.000Z",
  windows: [partialWindow]
});
assert.equal(partial.diagnostics.status, "degraded");
assert.ok(partial.diagnostics.warnings.includes("session_fact_incomplete:new_york_am"));
assert.equal(partial.facts.find((fact) => fact.kind === "session" && fact.payload.sessionType === "new_york_am").payload.complete, false);

const missingMidnightCandles = makeCandles({
  start: "2026-07-12T22:00:00.000Z",
  end: "2026-07-13T20:00:00.000Z",
  omit: ["2026-07-13T04:00:00.000Z"]
});
const missingMidnightWindow = await windowFor({ candles: missingMidnightCandles });
const missingMidnight = await contextModule.buildV2CanonicalMarketContext({ ...request, windows: [missingMidnightWindow] });
assert.equal(missingMidnight.diagnostics.status, "degraded");
assert.ok(missingMidnight.diagnostics.warnings.includes("opening_price_unavailable:new_york_midnight"));
assert.equal(missingMidnight.facts.some((fact) => fact.kind === "opening_price" && fact.payload.openingType === "new_york_midnight"), false);

const winterCandles = makeCandles({
  start: "2026-01-11T23:00:00.000Z",
  end: "2026-01-12T21:00:00.000Z"
});
const winterWindow = await windowFor({ candles: winterCandles, asOf: "2026-01-12T21:00:00.000Z" });
const winter = await contextModule.buildV2CanonicalMarketContext({
  ...request,
  asOfMarketTime: "2026-01-12T21:00:00.000Z",
  windows: [winterWindow]
});
assert.equal(winter.facts.find((fact) => fact.kind === "opening_price" && fact.payload.openingType === "sunday").payload.boundaryUtc, "2026-01-11T23:00:00.000Z");
assert.equal(winter.facts.find((fact) => fact.kind === "opening_price" && fact.payload.openingType === "new_york_midnight").payload.boundaryUtc, "2026-01-12T05:00:00.000Z");
assert.equal(winter.facts.find((fact) => fact.kind === "opening_price" && fact.payload.openingType === "new_york_0930").payload.boundaryUtc, "2026-01-12T14:30:00.000Z");

const fifteenMinuteCandles = makeCandles({
  start: "2026-07-12T22:00:00.000Z",
  end: "2026-07-13T20:00:00.000Z",
  minutes: 15
});
const fifteenMinuteWindow = await windowFor({ candles: fifteenMinuteCandles, timeframe: "15m" });
const wrongTimeframe = await contextModule.buildV2CanonicalMarketContext({
  ...request,
  requiredTimeframes: ["15m"],
  windows: [fifteenMinuteWindow]
});
assert.equal(wrongTimeframe.diagnostics.status, "blocked");
assert.ok(wrongTimeframe.diagnostics.blockers.includes("session_opening_fact_engine_requires_eligible_5m_window"));
assert.equal(wrongTimeframe.facts.length, 0);

const serialized = JSON.stringify(context);
assert.doesNotMatch(serialized, /"candles"\s*:/i);
assert.doesNotMatch(serialized, /rawServer|rawProvider|timeCurrentRaw|accountData|orderData|positionData|password|secret|apiKey|token/i);
assert.deepEqual(context.authority, authority);
assert.ok(context.facts.every((fact) => JSON.stringify(fact.authority) === JSON.stringify(authority)));

const productionAdoptions = [];
const scan = (directory) => {
  if (directory === path.join(workspace, "src", "lib", "v2")) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) scan(fullPath);
    else if (/\.(?:ts|tsx)$/.test(entry.name) && /buildV2SessionOpeningFacts|V2_CONTEXT_SESSION_FACT_POLICY_VERSION/.test(fs.readFileSync(fullPath, "utf8"))) {
      productionAdoptions.push(fullPath);
    }
  }
};
scan(path.join(workspace, "src"));
assert.deepEqual(productionAdoptions, []);

console.log(JSON.stringify({
  status: "passed",
  completeSessionFacts: sessions.length,
  exactOpeningPriceFacts: openings.length,
  daylightSavingBoundaries: {
    summerMidnightUtc: "2026-07-13T04:00:00.000Z",
    winterMidnightUtc: "2026-01-12T05:00:00.000Z"
  },
  strictMissingBoundaryFallbackUsed: false,
  partialSessionDegraded: partial.diagnostics.status === "degraded",
  nonFiveMinuteInputBlocked: wrongTimeframe.diagnostics.status === "blocked",
  rawCandleArraysSerialized: false,
  productionAdoptions: productionAdoptions.length,
  shadowOnly: context.shadowOnly,
  authority
}, null, 2));
