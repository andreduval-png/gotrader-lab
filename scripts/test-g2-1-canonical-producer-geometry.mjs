#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const out = path.join(root, ".gotrader", "g2-1-canonical-producer-test");
const files = [
  ["src/lib/ictCanonical/canonicalIctIdentity.ts", "canonicalIctIdentity.mjs"],
  ["src/lib/ictCanonical/canonicalIctTypes.ts", "canonicalIctTypes.mjs"],
  ["src/lib/tradeGeometry/tradeGeometryTypes.ts", "tradeGeometryTypes.mjs"],
  ["src/lib/tradeGeometry/targetSelection.ts", "targetSelection.mjs"],
  ["src/lib/tradeGeometry/canonicalTradeGeometry.ts", "canonicalTradeGeometry.mjs"],
  ["src/lib/ict-strategy-suite/ictDetectorCanonicalGeometry.ts", "ictDetectorCanonicalGeometry.mjs"]
];

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const [sourceName, outputName] of files) {
  const source = fs.readFileSync(path.join(root, sourceName), "utf8");
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022, importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove }
  }).outputText
    .replace(/from\s+["']@\/lib\/ictCanonical\/canonicalIctIdentity["']/g, 'from "./canonicalIctIdentity.mjs"')
    .replace(/from\s+["']@\/lib\/ictCanonical\/canonicalIctTypes["']/g, 'from "./canonicalIctTypes.mjs"')
    .replace(/from\s+["']@\/lib\/tradeGeometry\/targetSelection["']/g, 'from "./targetSelection.mjs"')
    .replace(/from\s+["']@\/lib\/tradeGeometry\/tradeGeometryTypes["']/g, 'from "./tradeGeometryTypes.mjs"')
    .replace(/from\s+["']@\/lib\/tradeGeometry\/canonicalTradeGeometry["']/g, 'from "./canonicalTradeGeometry.mjs"')
    .replace(/from\s+["']@\/lib\/tradeGeometry["']/g, 'from "./tradeGeometry.mjs"')
    .replace(/from\s+["']\.\/([^"']+)["']/g, (_match, name) => `from "./${name.endsWith(".mjs") ? name : `${name}.mjs`}"`);
  fs.writeFileSync(path.join(out, outputName), js);
}

const { adaptCisdNativeGeometry } = await import(pathToFileURL(path.join(out, "ictDetectorCanonicalGeometry.mjs")));
const candidate = (stop) => ({
  strategyId: "cisd_v1",
  generatedAt: "2026-08-21T16:00:00.000Z",
  status: "candidate",
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  sourceFingerprint: "canonical-source-fixture",
  timeframe: "5m",
  side: "short",
  entry: 29382.43,
  stop,
  target: 29370.43,
  blockers: [],
  missingConditions: []
});

assert.equal(
  adaptCisdNativeGeometry(candidate(29383.43), true),
  undefined,
  "a one-point MNQ stop must fail closed at the producer adapter"
);

const accepted = adaptCisdNativeGeometry(candidate(29384.43), true);
assert.ok(accepted, "a source-native two-point MNQ stop should reach canonical validation");
assert.equal(accepted.entry.intendedPrice, 29382.43);
assert.equal(accepted.stop.price, 29384.43);
assert.equal(accepted.target?.price, 29370.43);
assert.equal(accepted.riskDistance, 2);
assert.equal(accepted.theoreticalRR, 6);
assert.equal(accepted.geometryValid, true);
assert.equal(accepted.actionable, false, "research geometry remains non-executable by design");
assert.equal(accepted.status, "VALID_RESEARCH_ONLY");
assert.equal(accepted.authority.execution, "none");

const downstreamFiles = [
  "src/lib/currentOpportunity/detectCurrentOpportunities.ts",
  "src/lib/ict-strategy-suite/ictCurrentRead.ts",
  "src/lib/ict-strategy-suite/ictSignalContract.ts",
  "src/lib/ict-strategy-suite/ictActivateMarketPipeline.ts",
  "src/lib/operatorConsole/buildOperatorConsoleSnapshot.ts"
];
const downstream = Object.fromEntries(
  downstreamFiles.map((file) => [file, fs.readFileSync(path.join(root, file), "utf8")])
);

for (const [file, source] of Object.entries(downstream)) {
  assert.doesNotMatch(source, /current-opportunity-shadow-v1/, `${file} must not retain the shadow geometry constructor`);
}
assert.doesNotMatch(
  downstream["src/lib/currentOpportunity/detectCurrentOpportunities.ts"],
  /buildCanonicalTradeGeometry|buildIctTradeConstruction|evaluateMarketRelativeGeometry/,
  "Current Opportunity must consume canonical geometry without constructing it"
);
assert.doesNotMatch(
  downstream["src/lib/ict-strategy-suite/ictCurrentRead.ts"],
  /buildCanonicalTradeGeometry|buildIctTradeConstruction/,
  "Current Read must not construct geometry"
);
assert.doesNotMatch(
  downstream["src/lib/ict-strategy-suite/ictSignalContract.ts"],
  /Math\.abs\([^\n]*(?:target|entry|stop)|buildCanonicalTradeGeometry|buildIctTradeConstruction/,
  "Signal Contract must not reconstruct R:R or geometry"
);
assert.doesNotMatch(
  downstream["src/lib/operatorConsole/buildOperatorConsoleSnapshot.ts"],
  /proposedEntryPrice\s*\?\?|proposedStopLoss\s*\?\?|proposedTakeProfit\s*\?\?|zone_midpoint|compatibility_projection|reproducedRiskReward/,
  "Operator Console must not fall back to reconstructed plan prices or R:R"
);
assert.match(
  downstream["src/lib/ict-strategy-suite/ictActivateMarketPipeline.ts"],
  /proposedGeometry:\s*matchingCandidate\?\.geometry/,
  "Activate Market must persist the detector-owned canonical geometry"
);

console.log("G2.1 canonical producer geometry regression passed.");
console.log(JSON.stringify({
  rejectedStopDistance: 1,
  acceptedStopDistance: accepted.riskDistance,
  acceptedRR: accepted.theoreticalRR,
  downstreamConstructors: 0
}, null, 2));
