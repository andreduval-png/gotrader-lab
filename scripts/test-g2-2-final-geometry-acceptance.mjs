#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const inventoryPath = "docs/gotrader-geometry/g2-2/g2-2-producer-inventory.json";
const inventorySource = read(inventoryPath);
const inventory = JSON.parse(inventorySource);
const entries = inventory.entries;
const count = (classification) => entries.filter((entry) => entry.classification === classification).length;

assert.equal(entries.length, 23, "G2.2 must classify exactly 23 producer entries");
assert.equal(new Set(entries.map((entry) => entry.name)).size, 23, "producer names must be unique");
assert.equal(count("CANONICAL_DIRECT"), 5);
assert.equal(count("CANONICAL_LOSSLESS_ADAPTER"), 10);
assert.equal(count("SOURCE_BLOCKED"), 5);
assert.equal(count("RESEARCH_ONLY"), 0, "research-only is a capability, not a competing ownership classification");
assert.equal(count("NON_EXECUTABLE"), 3);
assert.equal(count("LEGACY_ACTIONABLE_NUMERIC"), 0);

const adapters = read("src/lib/ict-strategy-suite/ictDetectorCanonicalGeometry.ts");
for (const price of ["candidate.entry!", "candidate.stop!", "candidate.target!"]) {
  assert.match(adapters, new RegExp(price.replace(/[.!]/g, "\\$&")), `adapters must wrap native ${price}`);
}
assert.doesNotMatch(adapters, /target\s*=\s*entry\s*[+-]|stop\s*=\s*entry\s*[+-]/i);
assert.match(adapters, /MNQ\|USTECH\|US100/);
assert.match(adapters, /riskDistance\s*>=\s*2\s*&&\s*riskDistance\s*<=\s*50/);

const canonical = read("src/lib/tradeGeometry/canonicalTradeGeometry.ts");
assert.doesNotMatch(canonical, /currentPrice|recentBar|nearest.*(?:target|stop)/i);
assert.doesNotMatch(canonical, /target\s*=\s*entry\s*[+-]|stop\s*=\s*entry\s*[+-]/i);
assert.match(canonical, /directionalRiskDistance/);
assert.match(canonical, /directionalRewardDistance/);
assert.match(canonical, /VALID_BELOW_RR_THRESHOLD/);
assert.match(canonical, /ENTRY_MISSED/);
assert.match(canonical, /TARGET_CONSUMED|selectCanonicalTarget/);

const targets = read("src/lib/tradeGeometry/targetSelection.ts");
assert.doesNotMatch(targets, /sort\([^\n]*(?:reward|risk|rr)|requiredRR[^\n]*(?:find|sort|filter)/i);
assert.match(targets, /primaryTargetId/);
assert.match(targets, /allowedFallbackTargetTypes/);

const blockedChecks = [
  ["src/lib/ict-strategy-suite/ictPhase2BreadAndButter.ts", /status:\s*"SOURCE_BLOCKED"/, /entryZone:\s*undefined/, /invalidation:\s*undefined/, /target:\s*undefined/, /rrEstimate:\s*undefined/],
  ["src/lib/ict-strategy-suite/ictPhase2OneShotOneKill.ts", /status:\s*"SOURCE_BLOCKED"/, /entryZone:\s*undefined/, /invalidation:\s*undefined/, /target:\s*undefined/, /rrEstimate:\s*undefined/]
];
for (const [file, ...patterns] of blockedChecks) {
  const source = read(file);
  for (const pattern of patterns) assert.match(source, pattern, `${file} must preserve ${pattern}`);
}

const downstream = {
  currentRead: read("src/lib/ict-strategy-suite/ictCurrentRead.ts"),
  currentOpportunity: read("src/lib/currentOpportunity/detectCurrentOpportunities.ts"),
  signalContract: read("src/lib/ict-strategy-suite/ictSignalContract.ts"),
  activateMarket: read("src/lib/ict-strategy-suite/ictActivateMarketPipeline.ts"),
  operatorConsole: read("src/lib/operatorConsole/buildOperatorConsoleSnapshot.ts")
};
for (const [name, source] of Object.entries(downstream)) {
  assert.doesNotMatch(source, /current-opportunity-shadow-v1/, `${name} must not retain shadow geometry`);
  assert.doesNotMatch(source, /buildIctTradeConstruction|evaluateMarketRelativeGeometry/, `${name} must not use legacy construction`);
}
assert.doesNotMatch(downstream.currentRead, /buildCanonicalTradeGeometry/);
assert.doesNotMatch(downstream.currentOpportunity, /buildCanonicalTradeGeometry/);
assert.doesNotMatch(downstream.signalContract, /buildCanonicalTradeGeometry|Math\.abs\([^\n]*(?:entry|stop|target)/);
assert.doesNotMatch(downstream.operatorConsole, /buildCanonicalTradeGeometry|proposedEntryPrice\s*\?\?|proposedStopLoss\s*\?\?|proposedTakeProfit\s*\?\?/);
assert.match(downstream.currentOpportunity, /projectCanonicalTradeGeometry\(geometry\)/);
assert.match(downstream.currentOpportunity, /entry:\s*publishGeometry\s*\?\s*geometryProjection\?\.intendedEntry\s*:\s*undefined/);
assert.match(downstream.signalContract, /entryReference:\s*canonicalConflict\s*\?\s*undefined\s*:\s*currentRead\.canonicalGeometry\?\.entry\.intendedPrice/);
assert.match(downstream.signalContract, /rrEstimate:\s*canonicalConflict\s*\?\s*undefined\s*:\s*currentRead\.canonicalGeometry\?\.theoreticalRR/);
assert.match(downstream.signalContract, /canonicalConflict\s*\?\s*"flat"\s*:\s*currentRead\.side/);
assert.match(downstream.activateMarket, /proposedGeometry:\s*matchingCandidate\?\.geometry/);
assert.match(downstream.operatorConsole, /projectCanonicalTradeGeometry\(canonicalGeometry\)/);

const mcpCore = read("scripts/gotrader-research-mcp-core.mjs");
assert.match(mcpCore, /rr\s*=\s*Math\.abs\(targets\[0\]\s*-\s*entry\)\s*\/\s*Math\.abs\(entry\s*-\s*stop\)/);
for (const source of Object.values(downstream)) {
  assert.doesNotMatch(source, /gotrader-research-mcp-core|evaluateCanonicalTradeProposal/);
}
for (const source of Object.values(downstream)) assert.doesNotMatch(source, /ictTradeConstruction/);

const forbiddenActionablePatterns = [
  /target\s*=\s*entry\s*[+-]\s*risk\s*\*/i,
  /stop\s*=\s*entry\s*[+-]\s*reward\s*\//i,
  /currentPrice\s*as\s*fallback\s*entry/i,
  /nearest-liquidity primary target/i
];
for (const [name, source] of Object.entries(downstream)) {
  for (const pattern of forbiddenActionablePatterns) assert.doesNotMatch(source, pattern, `${name} contains forbidden construction ${pattern}`);
}

const inventoryHash = crypto.createHash("sha256").update(inventorySource.replace(/\r\n/g, "\n")).digest("hex");
console.log("G2.2 final geometry architecture certification passed.");
console.log(JSON.stringify({
  producerEntries: entries.length,
  canonicalDirect: count("CANONICAL_DIRECT"),
  canonicalLosslessAdapters: count("CANONICAL_LOSSLESS_ADAPTER"),
  sourceBlocked: count("SOURCE_BLOCKED"),
  researchOnlyOwnershipClass: count("RESEARCH_ONLY"),
  nonExecutable: count("NON_EXECUTABLE"),
  actionableLegacyNumeric: count("LEGACY_ACTIONABLE_NUMERIC"),
  downstreamActionableConstructors: 0,
  inventoryHash
}, null, 2));
