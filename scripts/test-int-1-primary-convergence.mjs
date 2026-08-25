import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [
  constructionTests,
  geometryTests,
  noChaseTests,
  ifvgTests,
  currentOpportunity,
  activateMarket,
  operatorSnapshot,
  breadAndButter,
  oneShotOneKill,
  strategyRegistry,
  canonicalFactTests,
  causalityTests,
  mt5SafetyTests,
] = await Promise.all([
  read("scripts/test-ict-trade-construction.mjs"),
  read("scripts/test-trade-geometry.mjs"),
  read("scripts/test-trade-geometry-no-chase.mjs"),
  read("scripts/test-ict-ifvg.mjs"),
  read("src/lib/currentOpportunity/detectCurrentOpportunities.ts"),
  read("src/lib/ict-strategy-suite/ictActivateMarketPipeline.ts"),
  read("src/lib/operatorConsole/buildOperatorConsoleSnapshot.ts"),
  read("src/lib/ict-strategy-suite/ictPhase2BreadAndButter.ts"),
  read("src/lib/ict-strategy-suite/ictPhase2OneShotOneKill.ts"),
  read("src/lib/strategyLibrary/strategyRegistry.ts"),
  read("scripts/test-ict-canonical-facts.mjs"),
  read("scripts/test-trade-geometry-causality.mjs"),
  read("scripts/test-mt5-readonly-safety.mjs"),
]);

// A-C: the exact MNQ boundary, tiny stops, and low-RR geometry stay fail closed.
assert.match(constructionTests, /exactMinimumIndexStop/);
assert.match(constructionTests, /\[3\.999, 1\.29\]/);
assert.match(constructionTests, /rr_below_minimum/);
assert.match(geometryTests, /VALID_BELOW_RR_THRESHOLD/);

// D-F: missed entries and incomplete plans cannot acquire downstream geometry.
assert.match(noChaseTests, /ENTRY_MISSED/);
assert.match(ifvgTests, /STOP_DISTANCE_TOO_SMALL/);
assert.match(activateMarket, /proposedGeometry: matchingCandidate\?\.geometry/);
assert.doesNotMatch(operatorSnapshot, /currentPrice\s*\?\?|entryZone\?\.midpoint/);
assert.match(operatorSnapshot, /const canonicalGeometry = activation\?\.proposedGeometry/);
assert.match(currentOpportunity, /geometry\?\.geometryValid/);

// G-H: phase-2 candidates remain source blocked and cannot leak price levels.
assert.match(breadAndButter, /SOURCE_BLOCKED/);
assert.match(oneShotOneKill, /SOURCE_BLOCKED/);
assert.match(breadAndButter, /entryReference: undefined/);
assert.match(breadAndButter, /invalidation: undefined/);
assert.match(oneShotOneKill, /entryReference: undefined/);
assert.match(oneShotOneKill, /invalidation: undefined/);

// I: validated v3 and candidate v4 retain separate immutable runtime identities.
assert.match(strategyRegistry, /id: "ifvg_v3_base"/);
assert.match(strategyRegistry, /id: "ifvg_v4_forward_validation"/);
assert.match(currentOpportunity, /ifvg_fresh_retest_v3_research/);
assert.doesNotMatch(currentOpportunity, /ifvg_fresh_retest_v4_candidate/);

// J: canonical facts and geometry are protected by causality/future-extension tests.
assert.match(canonicalFactTests, /future|extension|prefix/i);
assert.match(causalityTests, /future|extension|prefix/i);

// Authority remains read-only with no broker mutation surface.
assert.match(mt5SafetyTests, /mt5ReadOnlyBlockedTools/);
assert.match(mt5SafetyTests, /brokerAuthority: "none"/);

console.log("INT-1 primary convergence contracts passed (A-J, authority none).");
