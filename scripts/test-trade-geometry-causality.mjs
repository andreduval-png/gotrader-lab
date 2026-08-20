#!/usr/bin/env node

import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import "./test-trade-geometry.mjs";

const runtimePath = path.join(process.cwd(), ".gotrader", "trade-geometry-test", "canonical", "canonicalTradeGeometry.mjs");
const { buildCanonicalTradeGeometry } = await import(`${pathToFileURL(runtimePath).href}?causality=${Date.now()}`);
const asOf = "2026-08-20T12:00:00.000Z";
const input = {
  strategyId: "ict_2022_model_v1",
  strategyVersion: "1.0.0",
  candidateId: "causal-fixture",
  direction: "LONG",
  entry: { model: "FVG_MIDPOINT", intendedPrice: 100, lifecycleStatus: "WAITING_FOR_ENTRY", validFrom: asOf },
  stop: { model: "RAID_EXTREME", price: 95, structuralInvalidation: true },
  targetCandidates: [{
    targetId: "primary-draw",
    type: "PRIMARY_DRAW_ON_LIQUIDITY",
    direction: "LONG",
    price: 110,
    validFrom: "2026-08-20T11:00:00.000Z",
    consumed: false
  }],
  targetPolicy: {
    policyId: "ict-2022.external-draw",
    policyVersion: "1.0.0",
    primaryTargetType: "PRIMARY_DRAW_ON_LIQUIDITY",
    primaryTargetId: "primary-draw",
    allowedFallbackTargetTypes: []
  },
  minimumRequiredRR: 2,
  sourceFingerprint: "causal-source-at-t",
  asOf
};

const original = buildCanonicalTradeGeometry(input);
const withFutureCandidate = buildCanonicalTradeGeometry({
  ...input,
  targetCandidates: [
    ...input.targetCandidates,
    {
      targetId: "future-nearer-target",
      type: "PRIMARY_DRAW_ON_LIQUIDITY",
      direction: "LONG",
      price: 105,
      validFrom: "2026-08-20T12:00:01.000Z",
      consumed: false
    }
  ]
});
assert.equal(withFutureCandidate.geometryId, original.geometryId);
assert.equal(withFutureCandidate.target.price, original.target.price);
assert.equal(withFutureCandidate.theoreticalRR, original.theoreticalRR);

console.log("trade geometry causality and future-extension tests passed");

