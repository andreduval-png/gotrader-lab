#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const out = path.join(root, ".gotrader", `int-3c-context-runtime-${process.pid}`);
fs.rmSync(out, { recursive: true, force: true });

for (const directory of ["ictCanonical", "tradeGeometry", "ictI2", "ictI3", "ictI4", "sessions", "ictI5", "ictContextRuntime"]) {
  const sourceDirectory = path.join(root, "src", "lib", directory);
  const outputDirectory = path.join(out, directory);
  fs.mkdirSync(outputDirectory, { recursive: true });
  for (const name of fs.readdirSync(sourceDirectory).filter((file) => file.endsWith(".ts"))) {
    const source = fs.readFileSync(path.join(sourceDirectory, name), "utf8");
    const output = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022, importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove },
      fileName: name
    }).outputText
      .replace(/from\s+"@\/lib\/(ictCanonical|tradeGeometry|ictI2|ictI3|ictI4|sessions|ictI5|ictContextRuntime)"/g, 'from "../$1/index.mjs"')
      .replace(/from\s+"@\/lib\/(ictCanonical|tradeGeometry|ictI2|ictI3|ictI4|sessions|ictI5|ictContextRuntime)\/([^"]+)"/g, 'from "../$1/$2.mjs"');
    fs.writeFileSync(path.join(outputDirectory, name.replace(/\.ts$/, ".mjs")), output, "utf8");
  }
}

const runtime = await import(`${pathToFileURL(path.join(out, "ictContextRuntime", "index.mjs")).href}?v=${Date.now()}`);
const authority = {
  executionAuthority: "none", brokerAuthority: "none", readinessOverrideAuthority: "none",
  productionAdoptionAllowed: false, canCreateEvidence: false, canApproveReadiness: false,
  canApplyCalibration: false, canCreateTradeIntent: false
};
const at = (minute) => new Date(Date.UTC(2026, 7, 17, 13, minute)).toISOString();
const base = (factId, factType, minute, direction = "bullish") => ({
  factId, factType, symbol: "NQ", timeframe: "5m", occurredAt: at(minute), confirmedAt: at(minute), validFrom: at(minute),
  state: "ACTIVE", direction,
  lineage: { sourceCandleIds: [`c${minute}`], sourceFactIds: [], sourceFingerprint: "int3c-fixture", policyId: "fixture", policyVersion: "1" },
  authority
});
const gap = (gapType, id, minute, identity) => ({
  ...base(id, "OPENING_GAP", minute), gapId: id, gapType, priorReferencePrice: 100, newOpenPrice: 110,
  gapLow: 100, gapHigh: 110, midpoint: 105, marketDateOrWeekIdentity: identity,
  calendarPolicyId: "fixture-calendar", timeAuthorityId: "gotrader.sessions.iana-america-new-york"
});
const evidence = (gapType, id, boundaryKind = gapType === "NDOG" ? "DAY_ROLLOVER" : "WEEK_REOPEN") => ({
  evidenceId: `evidence-${id}`, boundaryKind, calendarStatus: "VERIFIED", sourceContinuity: "VERIFIED",
  openingReferenceAvailable: true, holidayStatus: "REGULAR", calendarPolicyId: "fixture-calendar",
  timeAuthorityId: "gotrader.sessions.iana-america-new-york"
});
const facts = [
  { ...base("breaker", "BLOCK", 1), blockId: "breaker", blockType: "BREAKER_BLOCK", originCandleIds: ["c0"], proximalPrice: 102, distalPrice: 98, midpoint: 100 },
  { ...base("fvg", "FVG", 2), fvgId: "fvg", proximalPrice: 101, distalPrice: 99, midpoint: 100, originCandleIds: ["c1", "c2", "c3"], fvgState: "OPEN", filledPercentage: 0 },
  { ...base("range", "DEALING_RANGE", 1), dealingRangeId: "range", highSwingId: "high", lowSwingId: "low", highPrice: 110, lowPrice: 90, equilibrium: 100, context: "bullish_range" },
  { ...base("ote", "OTE_ZONE", 2), oteZoneId: "ote", dealingRangeId: "range", proximalPrice: 97.6, distalPrice: 94.2, retracementPolicyId: "gotrader.canonical.ote.legacy-foundation", retracementFractions: [0.62, 0.79] },
  { ...base("origin", "LIQUIDITY", 1), liquidityId: "origin", side: "SELL_SIDE_LIQUIDITY", liquidityClass: "INTERNAL", sourceStructureIds: ["s1"], ownerTimeframe: "1h", price: 95, dealingRangeId: "range", status: "AVAILABLE" },
  { ...base("objective", "LIQUIDITY", 1), liquidityId: "objective", side: "BUY_SIDE_LIQUIDITY", liquidityClass: "EXTERNAL", sourceStructureIds: ["s2"], ownerTimeframe: "1h", price: 110, dealingRangeId: "range", status: "AVAILABLE" },
  { ...base("delivery", "IRL_ERL_TRANSITION", 3), transitionId: "delivery", transitionType: "IRL_TO_ERL_DELIVERY", direction: "bullish", fromLiquidityId: "origin", toLiquidityId: "objective", dealingRangeId: "range", startedAt: at(2), currentState: "ACTIVE" },
  { ...base("pd-array", "PD_ARRAY", 2), pdArrayId: "pd-array", pdArrayType: "FVG", direction: "bullish", priceRange: [99, 101], sourceFactId: "fvg" },
  gap("NDOG", "ndog-1", 4, "2026-08-17"),
  gap("NWOG", "nwog-1", 4, "2026-08-10"),
  gap("NWOG", "nwog-2", 5, "2026-08-17")
];
const openingGapEvidence = Object.fromEntries(facts.filter((fact) => fact.factType === "OPENING_GAP").map((fact) => [fact.gapId, evidence(fact.gapType, fact.gapId)]));
const narrative = {
  structural: "bullish", intermediate: "bullish", execution: "bullish", liquidityPath: "buyside",
  structuralTimeframe: "1h", intermediateTimeframe: "15m", executionTimeframe: "5m",
  policyId: "gotrader.ict.c1-1.hierarchical-roles.v1", policyVersion: "1.0.0"
};
const snapshot = runtime.buildIctRuntimeContextSnapshot({
  facts, asOf: at(10), sourceFingerprint: "int3c-fixture", narrative,
  observedPrice: 96, observedAt: at(8), openingGapEvidence
});
assert.equal(runtime.assertIctRuntimeContextSnapshot(snapshot).ok, true);
assert.equal(snapshot.counts.executableStrategiesAdded, 0);
assert.equal(snapshot.candidateCount, 0);
assert.equal(snapshot.authority.executionAuthority, "none");
assert.equal(snapshot.items.filter((item) => item.artifactId.includes("nwog")).length, 2);
assert.equal(snapshot.items.find((item) => item.artifactId.includes("unicorn"))?.state, "SOURCE_BLOCKED");
assert.equal(snapshot.items.find((item) => item.artifactId.includes("ote"))?.state, "ZONE_REACHED");
assert.equal(snapshot.items.find((item) => item.artifactId.includes("irl-to-erl"))?.state, "DELIVERY_ACTIVE");
assert.equal(snapshot.items.find((item) => item.artifactId.includes("tgif"))?.sourceBlocked, undefined);
assert.equal(snapshot.items.find((item) => item.artifactId.includes("tgif"))?.sourceStatus, "blocked_source_semantics");
assert.doesNotMatch(JSON.stringify(snapshot), /"(entry|stop|target|riskReward|canonicalGeometry|proposedGeometry)"\s*:/i);

const maintenanceGap = facts.find((fact) => fact.factId === "ndog-1");
const maintenance = runtime.buildIctRuntimeContextSnapshot({
  facts: [maintenanceGap], asOf: at(10), sourceFingerprint: "int3c-fixture", narrative,
  openingGapEvidence: { "ndog-1": evidence("NDOG", "ndog-1", "MAINTENANCE") }
});
assert.equal(maintenance.items.find((item) => item.artifactId.includes("ndog"))?.state, "SOURCE_BLOCKED");

const futureFacts = [...facts, { ...facts[1], factId: "future-fvg", fvgId: "future-fvg", validFrom: at(20), confirmedAt: at(20) }];
const futureSnapshot = runtime.buildIctRuntimeContextSnapshot({ facts: futureFacts, asOf: at(10), sourceFingerprint: "int3c-fixture", narrative, observedPrice: 96, observedAt: at(8), openingGapEvidence });
assert.equal(
  futureSnapshot.items.find((item) => item.artifactId.includes("unicorn"))?.contextId,
  snapshot.items.find((item) => item.artifactId.includes("unicorn"))?.contextId
);

console.log(JSON.stringify({
  status: "passed",
  items: snapshot.items.length,
  counts: snapshot.counts,
  multipleNwogContexts: 2,
  candidateCount: snapshot.candidateCount,
  geometryKeysPresent: false,
  futureInvariant: true,
  authority: "none/none/none"
}, null, 2));
