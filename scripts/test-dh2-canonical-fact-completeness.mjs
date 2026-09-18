#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const out = path.join(root, ".gotrader", `dh2-canonical-facts-${process.pid}`);

function compileDirectory(sourceDirectory, outputDirectory) {
  fs.mkdirSync(outputDirectory, { recursive: true });
  for (const name of fs.readdirSync(sourceDirectory)) {
    if (!name.endsWith(".ts")) continue;
    const sourcePath = path.join(sourceDirectory, name);
    const transpiled = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.ES2022,
        target: ts.ScriptTarget.ES2022,
        importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
        verbatimModuleSyntax: false
      },
      fileName: sourcePath
    }).outputText;
    const rewritten = transpiled
      .replace(/from\s+"@\/lib\/ictCanonical\/([^"]+)"/g, 'from "./$1.mjs"')
      .replace(/from\s+"@\/lib\/sessions\/([^"]+)"/g, 'from "../sessions/$1.mjs"')
      .replace(/from\s+"@\/lib\/sessions"/g, 'from "../sessions/index.mjs"');
    fs.writeFileSync(path.join(outputDirectory, name.replace(/\.ts$/, ".mjs")), rewritten, "utf8");
  }
}

fs.rmSync(out, { recursive: true, force: true });
compileDirectory(path.join(root, "src", "lib", "ictCanonical"), path.join(out, "ictCanonical"));
compileDirectory(path.join(root, "src", "lib", "sessions"), path.join(out, "sessions"));
const canonical = await import(`${pathToFileURL(path.join(out, "ictCanonical", "index.mjs")).href}?v=${Date.now()}`);

const at = (minute) => new Date(Date.UTC(2026, 2, 9, 14, minute)).toISOString();
const authority = canonical.CANONICAL_ICT_NONE_AUTHORITY;
const lineage = (id) => ({
  sourceCandleIds: [id],
  sourceFactIds: [],
  sourceFingerprint: "dh2-source",
  policyId: "dh2.fixture",
  policyVersion: "1.0.0"
});
const base = (factId, factType, minute = 0) => ({
  factId,
  factType,
  symbol: "MNQ",
  timeframe: "5m",
  occurredAt: at(minute),
  confirmedAt: at(minute),
  validFrom: at(minute),
  state: "ACTIVE",
  lineage: lineage(`c${minute}`),
  authority
});
const range = {
  ...base("range-a", "DEALING_RANGE"),
  dealingRangeId: "range-a",
  highSwingId: "high-a",
  lowSwingId: "low-a",
  highPrice: 110,
  lowPrice: 90,
  equilibrium: 100,
  context: "balanced_range"
};
const candle = (id, minute, close) => ({
  id,
  symbol: "MNQ",
  timeframe: "5m",
  timestamp: at(minute),
  open: close,
  high: close + 1,
  low: close - 1,
  close,
  volume: 1
});
const input = { candles: [candle("reference", 5, 100)], asOf: at(10), symbol: "MNQ", timeframe: "5m", sourceFingerprint: "dh2-source" };
const pd = (price, owningRange = range, overrides = {}) => canonical.buildCanonicalPdLocation({
  input,
  range: owningRange,
  price,
  referenceTime: at(10),
  referenceCandleId: "reference",
  ...overrides
});

assert.equal(pd(90).location, "DISCOUNT", "exact range low is discount");
assert.equal(pd(95).location, "DISCOUNT");
assert.equal(pd(100).location, "EQUILIBRIUM", "exact equilibrium is equilibrium");
assert.equal(pd(100.8).location, "EQUILIBRIUM", "equilibrium band boundary is inclusive");
assert.equal(pd(105).location, "PREMIUM");
assert.equal(pd(110).location, "PREMIUM", "exact range high is premium");
assert.equal(pd(89.99), undefined, "outside-low reference is unavailable");
assert.equal(pd(110.01), undefined, "outside-high reference is unavailable");
assert.equal(pd(100, { ...range, highPrice: 90 }), undefined, "invalid range is unavailable");
assert.equal(pd(100, { ...range, equilibrium: 101 }), undefined, "inconsistent equilibrium is unavailable");
assert.equal(pd(100, { ...range, validFrom: at(15) }), undefined, "future range is unavailable");
assert.equal(pd(100, range, { referenceTime: at(15) }), undefined, "future reference is unavailable");
assert.equal(pd(100, range, { referenceTime: at(-5) }), undefined, "reference before range confirmation is unavailable");
assert.equal(pd(Number.NaN), undefined);
assert.equal(pd(100, range, { equilibriumBandFraction: 0.51 }), undefined);
assert.equal(pd(100, { ...range, symbol: "ES" }), undefined, "range must belong to the requested instrument");
assert.equal(pd(100, { ...range, timeframe: "1h" }), undefined, "range must belong to the requested timeframe");

const deterministicPd = pd(95);
assert.equal(pd(95).factId, deterministicPd.factId);
assert.equal(deterministicPd.referenceTime, at(10));
assert.deepEqual(deterministicPd.lineage.sourceCandleIds, ["reference"]);
assert.match(deterministicPd.classificationPolicyId, /pd-location/);
const rangeBForPd = { ...range, factId: "range-b-pd", dealingRangeId: "range-b-pd", highSwingId: "high-b-pd", lowSwingId: "low-b-pd" };
assert.notEqual(pd(95, rangeBForPd).factId, deterministicPd.factId, "PD location identity cannot cross-bind ranges");

const liquidity = (id, liquidityClass, side, price, owningRange = range, status = "AVAILABLE") => ({
  ...base(id, "LIQUIDITY", 5),
  liquidityId: id,
  side,
  liquidityClass,
  sourceStructureIds: [id],
  ownerTimeframe: "5m",
  price,
  dealingRangeId: owningRange.dealingRangeId,
  status,
  ...(status === "CONSUMED" ? { consumedAt: at(8), consumingCandleId: "c8" } : {})
});
const internal = liquidity("internal-a", "INTERNAL", "BUY_SIDE_LIQUIDITY", 102);
const external = liquidity("external-a", "EXTERNAL", "BUY_SIDE_LIQUIDITY", 110);
const transition = (transitionType, direction, currentState, from, to) => canonical.createCanonicalIrlErlTransition({
  transitionType,
  direction,
  fromLiquidity: from,
  toLiquidity: to,
  dealingRange: range,
  startedAt: at(10),
  confirmedAt: at(15),
  currentState
});

for (const direction of ["bullish", "bearish"]) {
  for (const state of ["FORMING", "ACTIVE", "COMPLETED", "INVALIDATED"]) {
    const irlToErl = transition("IRL_TO_ERL_DELIVERY", direction, state, internal, external);
    const erlToIrl = transition("ERL_TO_IRL_DELIVERY", direction, state, external, internal);
    assert.equal(irlToErl.dealingRangeId, range.dealingRangeId);
    assert.equal(erlToIrl.dealingRangeId, range.dealingRangeId);
    assert.equal(irlToErl.currentState, state);
    assert.equal(erlToIrl.currentState, state);
    assert.equal(canonical.isCanonicalFactVisibleAt(irlToErl, at(14)), false, "future transition is hidden");
    assert.equal(canonical.isCanonicalFactVisibleAt(irlToErl, at(15)), true);
  }
}
const repeatedTransition = transition("IRL_TO_ERL_DELIVERY", "bullish", "ACTIVE", internal, external);
assert.equal(repeatedTransition.factId, transition("IRL_TO_ERL_DELIVERY", "bullish", "ACTIVE", internal, external).factId);

const rangeB = { ...range, factId: "range-b", dealingRangeId: "range-b", highSwingId: "high-b", lowSwingId: "low-b" };
const externalB = liquidity("external-b", "EXTERNAL", "BUY_SIDE_LIQUIDITY", 110, rangeB);
assert.throws(
  () => canonical.createCanonicalIrlErlTransition({ transitionType: "IRL_TO_ERL_DELIVERY", direction: "bullish", fromLiquidity: internal, toLiquidity: externalB, dealingRange: range, startedAt: at(10), confirmedAt: at(15), currentState: "ACTIVE" }),
  /canonical dealing range/,
  "range collision must fail closed"
);
assert.throws(
  () => canonical.createCanonicalIrlErlTransition({ transitionType: "IRL_TO_ERL_DELIVERY", direction: "bullish", fromLiquidity: internal, toLiquidity: external, dealingRange: range, startedAt: at(-5), confirmedAt: at(15), currentState: "ACTIVE" }),
  /timestamps must be causal/
);
const consumedExternal = liquidity("external-consumed", "EXTERNAL", "BUY_SIDE_LIQUIDITY", 110, range, "CONSUMED");
const consumedTransition = transition("IRL_TO_ERL_DELIVERY", "bullish", "COMPLETED", internal, consumedExternal);
assert.equal(consumedTransition.toLiquidityId, consumedExternal.liquidityId, "consumed objective identity is preserved");

const snapshotCandles = [
  candle("c0", 0, 100),
  { ...candle("c1", 5, 102), high: 106 },
  candle("c2", 10, 104),
  { ...candle("c3", 15, 101), low: 95 },
  candle("c4", 20, 97),
  candle("c5", 25, 99),
  { ...candle("c6", 30, 103), high: 108 },
  candle("c7", 35, 105),
  candle("c8", 40, 101),
  { ...candle("c9", 45, 96), low: 94 },
  candle("c10", 50, 98),
  candle("c11", 55, 100)
];
const snapshotInput = { candles: snapshotCandles, asOf: at(55), symbol: "MNQ", timeframe: "5m" };
const snapshot = canonical.buildCanonicalIctFactSnapshot(snapshotInput);
const futureExtended = canonical.buildCanonicalIctFactSnapshot({ ...snapshotInput, candles: [...snapshotCandles, candle("future", 60, 200)] });
assert.deepEqual(futureExtended, snapshot, "future candle append cannot alter fixed-asOf facts or diagnostics");
assert.equal(snapshot.diagnostics.transitions, 0, "no unsourced transition producer is active");
assert(snapshot.diagnostics.dependencyFailures.includes("IRL_ERL_TRANSITION:SOURCE_OR_SEMANTIC_BLOCKED"));
const noRangeSnapshot = canonical.buildCanonicalIctFactSnapshot({ candles: [candle("single", 0, 100)], asOf: at(0), symbol: "MNQ", timeframe: "5m" });
assert.equal(noRangeSnapshot.facts.some((fact) => fact.factType === "PD_LOCATION"), false, "missing canonical range cannot fabricate PD location");
assert(noRangeSnapshot.diagnostics.dependencyFailures.includes("PD_LOCATION:CANONICAL_DEALING_RANGE_UNAVAILABLE"));
const snapshotPd = snapshot.facts.find((fact) => fact.factType === "PD_LOCATION");
assert.ok(snapshotPd, "the production snapshot must actually produce PD location for this valid range");
assert.equal(snapshot.diagnostics.pdLocations, 1);
assert.equal(snapshotPd.lineage.sourceCandleIds.at(-1), "c11");
assert.equal(snapshotPd.factId, futureExtended.facts.find((fact) => fact.factType === "PD_LOCATION").factId);
const owningRange = snapshot.facts.find((fact) => fact.factType === "DEALING_RANGE");
assert.equal(snapshotPd.dealingRangeId, owningRange.dealingRangeId);
assert.ok(snapshotPd.lineage.sourceFactIds.includes(owningRange.factId));

console.log(JSON.stringify({
  status: "passed",
  pdBoundaries: 10,
  transitionContracts: 16,
  livePdProduced: Boolean(snapshotPd),
  liveTransitionProduced: false,
  transitionDependency: "SOURCE_OR_SEMANTIC_BLOCKED",
  authority
}, null, 2));
