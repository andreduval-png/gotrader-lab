#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const sourcePath = path.join(root, "src", "lib", "tradeGeometry", "targetSelection.ts");
const out = path.join(root, ".gotrader", "trade-geometry-test", "targetSelection.mjs");
fs.mkdirSync(path.dirname(out), { recursive: true });
const source = fs.readFileSync(sourcePath, "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 }
}).outputText;
fs.writeFileSync(out, transpiled, "utf8");
const { selectCanonicalTarget } = await import(`${pathToFileURL(out).href}?v=${Date.now()}`);

const asOf = "2026-08-20T12:00:00.000Z";
const candidate = (targetId, type, price, extra = {}) => ({
  targetId,
  type,
  direction: "LONG",
  price,
  consumed: false,
  validFrom: "2026-08-20T11:00:00.000Z",
  ...extra
});
const policy = {
  policyId: "fixture.external-draw",
  policyVersion: "1.0.0",
  primaryTargetType: "PRIMARY_DRAW_ON_LIQUIDITY",
  primaryTargetId: "primary",
  allowedFallbackTargetTypes: ["EXTERNAL_LIQUIDITY"]
};

const selected = selectCanonicalTarget({
  direction: "LONG",
  entryPrice: 100,
  stopPrice: 98,
  asOf,
  policy,
  candidates: [candidate("nearest", "NEAREST_DIRECTIONAL_LIQUIDITY", 101), candidate("primary", "PRIMARY_DRAW_ON_LIQUIDITY", 106)]
});
assert.equal(selected.selected?.targetId, "primary", "nearest liquidity must not replace the primary draw");
assert.equal(selected.selected?.availableRR, 3);

const consumed = selectCanonicalTarget({
  direction: "LONG",
  entryPrice: 100,
  stopPrice: 98,
  asOf,
  policy: { ...policy, allowedFallbackTargetTypes: [] },
  candidates: [candidate("primary", "PRIMARY_DRAW_ON_LIQUIDITY", 106, { consumed: true })]
});
assert.equal(consumed.failure, "TARGET_CONSUMED");

const future = selectCanonicalTarget({
  direction: "LONG",
  entryPrice: 100,
  stopPrice: 98,
  asOf,
  policy,
  candidates: [candidate("primary", "PRIMARY_DRAW_ON_LIQUIDITY", 106, { validFrom: "2026-08-20T12:00:01.000Z" })]
});
assert.equal(future.failure, "NO_VALID_TARGET", "future targets must be invisible at asOf");

const fallback = selectCanonicalTarget({
  direction: "LONG",
  entryPrice: 100,
  stopPrice: 98,
  asOf,
  policy,
  candidates: [candidate("external", "EXTERNAL_LIQUIDITY", 104)]
});
assert.equal(fallback.selectionRole, "EXPLICIT_FALLBACK");

const multiTarget = selectCanonicalTarget({
  direction: "LONG",
  entryPrice: 100,
  stopPrice: 98,
  asOf,
  policy: { ...policy, primaryTargetId: "primary" },
  candidates: [
    candidate("tp1", "INTERNAL_LIQUIDITY", 101),
    candidate("primary", "PRIMARY_DRAW_ON_LIQUIDITY", 106)
  ]
});
assert.equal(multiTarget.selected?.targetId, "primary", "partial TP1 must not replace the primary decision target");
assert.equal(multiTarget.selected?.availableRR, 3);

console.log("trade geometry target-selection tests passed");
