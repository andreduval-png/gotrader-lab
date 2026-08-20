#!/usr/bin/env node
import assert from "node:assert/strict";
import { ict2022Fixture, loadIctI2, po3Fixture } from "./ict-i2-test-harness.mjs";

const ict = await loadIctI2();
const ict2022 = ict.evaluateIct2022Model(ict2022Fixture());
const po3 = ict.evaluateIctPowerOfThree(po3Fixture());
const judas = ict.evaluateIctJudasSwing(ict2022Fixture());
const envelope = ict.buildIctI2CurrentReadEnvelope({ generatedAt: ict2022.marketTimestamp, ict2022, po3, judas });
assert.equal(envelope.projections.length, 3);
assert.equal(envelope.executionAllowed, false);
assert.equal(envelope.researchValidated, false);
assert(envelope.projections.some((projection) => projection.headline === "ICT 2022 Model"));
assert(envelope.projections.some((projection) => projection.headline === "Power of Three"));
assert(envelope.projections.find((projection) => projection.headline === "ICT Judas Swing").detail.includes("geometry remain blocked"));
assert(envelope.projections.every((projection) => projection.authority.executionAuthority === "none"));
assert(!JSON.stringify(envelope).includes('"candles"'));

console.log(JSON.stringify({ status: "passed", projections: envelope.projections.map(({ strategyId, state }) => ({ strategyId, state })), executionAllowed: false }, null, 2));
