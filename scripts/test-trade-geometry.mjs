#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const out = path.join(root, ".gotrader", "trade-geometry-test", "canonical");
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const compile = (sourcePath, outputName) => {
  const source = fs.readFileSync(sourcePath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 }
  }).outputText
    .replace(
      /import \{ CANONICAL_ICT_NONE_AUTHORITY \} from "@\/lib\/ictCanonical\/canonicalIctTypes";/g,
      'const CANONICAL_ICT_NONE_AUTHORITY = { execution: "none", broker: "none", production: "none" };'
    )
    .replace(/from "@\/lib\/ictCanonical\/canonicalIctIdentity"/g, 'from "./canonicalIctIdentity.mjs"')
    .replace(/from "@\/lib\/tradeGeometry\/targetSelection"/g, 'from "./targetSelection.mjs"')
    .replace(/from "@\/lib\/tradeGeometry\/tradeGeometryTypes"/g, 'from "./tradeGeometryTypes.mjs"');
  fs.writeFileSync(path.join(out, outputName), transpiled, "utf8");
};

compile(path.join(root, "src/lib/ictCanonical/canonicalIctIdentity.ts"), "canonicalIctIdentity.mjs");
compile(path.join(root, "src/lib/tradeGeometry/tradeGeometryTypes.ts"), "tradeGeometryTypes.mjs");
compile(path.join(root, "src/lib/tradeGeometry/targetSelection.ts"), "targetSelection.mjs");
compile(path.join(root, "src/lib/tradeGeometry/canonicalTradeGeometry.ts"), "canonicalTradeGeometry.mjs");

const geometry = await import(`${pathToFileURL(path.join(out, "canonicalTradeGeometry.mjs")).href}?v=${Date.now()}`);
const asOf = "2026-08-20T12:00:00.000Z";
const base = {
  strategyId: "order_block_retracement",
  strategyVersion: "1.0.0",
  candidateId: "fixture-a",
  direction: "LONG",
  entry: { model: "OB_MIDPOINT", intendedPrice: 100, lifecycleStatus: "ENTRY_AVAILABLE" },
  stop: { model: "OB_INVALIDATION", price: 96, structuralInvalidation: true },
  targetCandidates: [{ targetId: "draw", type: "DRAW_ON_LIQUIDITY", direction: "LONG", price: 103, consumed: false }],
  targetPolicy: {
    policyId: "order-block.native-draw",
    policyVersion: "1.0.0",
    primaryTargetType: "DRAW_ON_LIQUIDITY",
    primaryTargetId: "draw",
    allowedFallbackTargetTypes: []
  },
  minimumRequiredRR: 2,
  sourceFingerprint: "fixture-source",
  asOf
};

const below = geometry.buildCanonicalTradeGeometry(base);
assert.equal(below.geometryValid, true);
assert.equal(below.actionable, false);
assert.equal(below.status, "VALID_BELOW_RR_THRESHOLD");
assert.equal(below.theoreticalRR, 0.75);
assert.equal(geometry.projectCanonicalTradeGeometry(below).displayKind, "RESEARCH_GEOMETRY");

const actionable = geometry.buildCanonicalTradeGeometry({
  ...base,
  candidateId: "fixture-actionable",
  targetCandidates: [{ ...base.targetCandidates[0], price: 108 }]
});
assert.equal(actionable.status, "VALID_ACTIONABLE");
assert.equal(actionable.actionable, true);
assert.equal(actionable.theoreticalRR, 2);

const invalidDirection = geometry.buildCanonicalTradeGeometry({
  ...base,
  candidateId: "fixture-e",
  direction: "SHORT",
  stop: { ...base.stop, price: 104 },
  targetCandidates: [{ ...base.targetCandidates[0], direction: "SHORT", price: 102 }]
});
assert.equal(invalidDirection.status, "GEOMETRY_DIRECTION_INVALID");

const precise = geometry.buildCanonicalTradeGeometry({
  ...base,
  candidateId: "fixture-precision",
  stop: { ...base.stop, price: 99 },
  targetCandidates: [{ ...base.targetCandidates[0], price: 101.995 }]
});
assert(Math.abs(precise.theoreticalRR - 1.995) < 1e-12);
assert.equal(precise.actionable, false, "threshold comparison must use full precision before display rounding");

const zeroRisk = geometry.buildCanonicalTradeGeometry({ ...base, candidateId: "zero-risk", stop: { ...base.stop, price: 100 } });
assert.equal(zeroRisk.status, "GEOMETRY_DIRECTION_INVALID");

assert.equal(typeof actionable.geometryId, "string");
assert.equal(Object.isFrozen(actionable), true);

const changed = geometry.buildCanonicalTradeGeometry({ ...base, targetCandidates: [{ ...base.targetCandidates[0], price: 104 }] });
assert.equal(geometry.geometryPayloadConflicts(below, changed), true);
assert.equal(geometry.geometryPayloadConflicts(below, actionable), false, "different candidates are not payload conflicts");

console.log("canonical trade geometry tests passed");
