#!/usr/bin/env node
import assert from "node:assert/strict";
import { input, loadIctI5 } from "./ict-i5-test-harness.mjs";
const ict = await loadIctI5();
const artifacts = [
  ict.evaluateNdogContext(input("NDOG", "GAP_UP")),
  ict.evaluateNwogContext(input("NWOG", "GAP_DOWN")),
  ict.evaluateTgifContext({ asOf: input().asOf, sourceFingerprint: "i5-fixture" })
];
const envelope = ict.buildIctI5CurrentReadEnvelope(input().asOf, artifacts);
assert.equal(envelope.projections.length, 3);
assert.deepEqual(envelope.currentOpportunityCandidates, []);
assert.equal(envelope.executionAllowed, false);
assert.match(envelope.projections[0].detail, /context only/);
assert.match(envelope.projections[2].detail, /Source semantics are incomplete/i);
assert.equal(ict.assertCompactIctI5Envelope(envelope).ok, true);
assert.deepEqual(ict.buildIctI5CurrentReadEnvelope(input().asOf, artifacts), envelope);
console.log("I5 deterministic Current Read tests passed");
