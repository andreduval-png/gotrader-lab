#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const cycle = read("src/lib/operatorConsole/operatorCycle.ts");
const snapshot = read("src/lib/operatorConsole/buildOperatorConsoleSnapshot.ts");
const activation = read("src/lib/ict-strategy-suite/ictActivateMarketPipeline.ts");
const view = read("src/components/operator/OperatorConsoleView.tsx");

assert.match(
  cycle,
  /canonicalSourceFingerprint\s*=\s*activation\.snapshot\.marketData\.activeResearchSource\.fingerprint/,
  "operator cycles must bind the canonical source fingerprint"
);
assert.match(cycle, /sourceFingerprint:\s*canonicalSourceFingerprint/);
assert.doesNotMatch(
  cycle,
  /stage:\s*"building_market_read"[\s\S]{0,300}sourceFingerprint:\s*activation\.source\.sourceFingerprint/,
  "the feed hash must not be stored as plan identity"
);
assert.match(cycle, /runLlmAdvisory:\s*false/, "the supervised operator path must remain deterministic and LLM-off");

assert.match(cycle, /OPERATOR_CYCLE_SESSION_STORAGE_KEY/);
assert.match(cycle, /sessionStorage\.setItem\(OPERATOR_CYCLE_SESSION_STORAGE_KEY, serialized\)/);
assert.match(cycle, /sessionRaw\s*\?\?\s*window\.localStorage\.getItem/);
assert.match(cycle, /localStorage\.setItem\(OPERATOR_CYCLE_STORAGE_KEY, serialized\);\s*\}\s*catch/s);
assert.match(cycle, /memoryState\s*=\s*compact/);

assert.match(activation, /latestSummaryMemory\s*=\s*summary/);
assert.match(activation, /return latestSummaryMemory/);
assert.match(activation, /dispatchEvent\(new CustomEvent\(ICT_ACTIVATE_MARKET_UPDATED_EVENT/);

assert.match(snapshot, /const canonicalGeometry = activation\?\.proposedGeometry/);
assert.match(snapshot, /projectCanonicalTradeGeometry\(canonicalGeometry\)/);
assert.match(snapshot, /signal = complete[\s\S]*canonicalProjection\?\.actionable/);
assert.doesNotMatch(snapshot, /proposedEntryPrice\s*\?\?|proposedStopLoss\s*\?\?|proposedTakeProfit\s*\?\?/);
assert.doesNotMatch(snapshot, /Math\.abs\([^\n]*(?:entry|stop|target)/);
assert.match(snapshot, /planIdentityStatus === "current"/);
assert.match(snapshot, /source_mismatch/);
assert.match(snapshot, /candidate_mismatch/);

assert.match(view, /Research trade plan/i);
assert.match(view, /researchPlan\.entryPrice/);
assert.match(view, /researchPlan\.stopLoss/);
assert.match(view, /researchPlan\.takeProfit/);
assert.match(view, /researchPlan\.riskReward/);

console.log(JSON.stringify({
  status: "passed",
  canonicalCycleIdentity: true,
  quotaSafeCycleState: true,
  inMemoryActivationSummary: true,
  canonicalGeometryOnly: true,
  executionAuthority: "none"
}, null, 2));
