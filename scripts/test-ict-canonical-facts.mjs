#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const out = path.join(root, ".gotrader", "ict-canonical-facts-test");

function compileDirectory(sourceDirectory, outputDirectory) {
  fs.mkdirSync(outputDirectory, { recursive: true });
  for (const name of fs.readdirSync(sourceDirectory)) {
    if (!name.endsWith(".ts")) continue;
    const sourcePath = path.join(sourceDirectory, name);
    const source = fs.readFileSync(sourcePath, "utf8");
    const transpiled = ts.transpileModule(source, {
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
const candle = (id, minute, open, high, low, close) => ({
  id,
  symbol: "NQ",
  timeframe: "5m",
  timestamp: new Date(Date.UTC(2026, 0, 5, 14, minute)).toISOString(),
  open,
  high,
  low,
  close,
  volume: 100
});

const candles = [
  candle("c0", 0, 100, 101, 99, 100),
  candle("c1", 5, 100, 103, 99.5, 102),
  candle("c2", 10, 102, 106, 101, 105),
  candle("c3", 15, 105, 104.5, 100, 101),
  candle("c4", 20, 101, 102, 96, 97),
  candle("c5", 25, 97, 100, 97, 99),
  candle("c6", 30, 100.5, 105, 100.2, 104),
  candle("c7", 35, 104, 108, 103, 107),
  candle("c8", 40, 107, 107.5, 101, 102),
  candle("c9", 45, 102, 103, 94, 95),
  candle("c10", 50, 95, 99, 94.5, 98),
  candle("c11", 55, 98, 104, 97, 103)
];
const asOf = candles.at(-1).timestamp;
const input = { candles, asOf, symbol: "NQ", timeframe: "5m" };

const swings = canonical.buildCanonicalSwings(input, 2);
assert(swings.length >= 2, "fixture must produce confirmed swings");
for (const swing of swings) {
  assert(Date.parse(swing.occurredAt) <= Date.parse(swing.confirmedAt));
  assert.equal(swing.confirmedAt, swing.validFrom);
  assert.equal(canonical.isCanonicalFactVisibleAt(swing, new Date(Date.parse(swing.validFrom) - 1).toISOString()), false);
}

const extended = [...candles, candle("future", 60, 103, 112, 102, 111)];
const originalSnapshot = canonical.buildCanonicalIctFactSnapshot(input);
const extensionSnapshot = canonical.buildCanonicalIctFactSnapshot({ ...input, candles: extended });
assert.deepEqual(extensionSnapshot, originalSnapshot, "future candles after asOf must not alter the snapshot");

const fvgs = canonical.buildCanonicalFvgs(input);
assert(fvgs.length > 0, "fixture must produce FVG facts");
const transitions = canonical.buildCanonicalFvgTransitions({ input, fvgs });
for (const transition of transitions) {
  assert(fvgs.some((fvg) => fvg.fvgId === transition.originFvgId));
  assert.notEqual(transition.proximalPrice, transition.distalPrice);
}

const displacements = canonical.buildCanonicalDisplacements(input, {
  policyId: "fixture.displacement",
  policyVersion: "1.0.0",
  bodyLookback: 2,
  minimumBodyMultiple: 1.15
});
const shifts = canonical.buildCanonicalMss({ input, swings, displacements });
const blocks = canonical.buildCanonicalBlocks({ input, structureShifts: shifts });
for (const block of blocks.filter((fact) => fact.blockType !== "ORDER_BLOCK")) {
  assert(block.originBlockId, "converted blocks must retain origin block lineage");
  assert(block.conversionEventId, "converted blocks must retain conversion event lineage");
}

const range = canonical.buildCanonicalDealingRange({ input, swings });
if (range) {
  const pd = canonical.buildCanonicalPdLocation({ input, range, price: candles.at(-1).close });
  assert.equal(pd.dealingRangeId, range.dealingRangeId);
  const ote = canonical.buildCanonicalOteZone(range, "bullish", canonical.LEGACY_OTE_FOUNDATION_POLICY);
  assert.equal(ote.dealingRangeId, range.dealingRangeId);
}

const sessions = canonical.buildCanonicalSessionWindows({
  symbol: "NQ",
  timeframe: "5m",
  validFrom: asOf,
  sourceFingerprint: originalSnapshot.sourceFingerprint
});
assert(sessions.some((fact) => fact.name === "London" && fact.timezone === "America/New_York"));
assert.equal(canonical.canonicalMacroPolicy.resolutionStatus, "UNRESOLVED");

const drawFixture = [
  { ...originalSnapshot.facts.find((fact) => fact.factType === "LIQUIDITY"), factId: "near", liquidityId: "near", factType: "LIQUIDITY", side: "BUY_SIDE_LIQUIDITY", liquidityClass: "SWING", ownerTimeframe: "1m", price: 104, status: "AVAILABLE" },
  { ...originalSnapshot.facts.find((fact) => fact.factType === "LIQUIDITY"), factId: "structural", liquidityId: "structural", factType: "LIQUIDITY", side: "BUY_SIDE_LIQUIDITY", liquidityClass: "EXTERNAL", ownerTimeframe: "1h", price: 110, status: "AVAILABLE" }
];
if (drawFixture.every((fact) => fact.symbol)) {
  const draw = canonical.selectCanonicalDrawOnLiquidity({ liquidity: drawFixture, currentPrice: 100, direction: "bullish", asOf, sourceFingerprint: originalSnapshot.sourceFingerprint });
  assert.equal(draw.targetLiquidityId, "structural");
  assert.equal(draw.nearestLiquidityId, "near");
}

for (const fact of originalSnapshot.facts) {
  assert.deepEqual(fact.authority, canonical.CANONICAL_ICT_NONE_AUTHORITY);
  assert(!("candles" in fact.lineage), "lineage must contain identifiers, not raw candle arrays");
  canonical.assertCanonicalFactCausality(fact);
}
assert.equal(canonical.CANONICAL_LEGACY_COMPATIBILITY.length, 6);
assert.deepEqual(canonical.CANONICAL_LEGACY_COMPATIBILITY.map((item) => item.strategy), [
  "IFVG", "Silver Bullet", "Turtle Soup", "CISD", "CMD", "Nasdaq London Raid"
]);

console.log(JSON.stringify({
  status: "passed",
  factCount: originalSnapshot.facts.length,
  swingCount: swings.length,
  fvgCount: fvgs.length,
  transitionCount: transitions.length,
  compatibilityFamilies: canonical.CANONICAL_LEGACY_COMPATIBILITY.length,
  authority: canonical.CANONICAL_ICT_NONE_AUTHORITY
}, null, 2));
