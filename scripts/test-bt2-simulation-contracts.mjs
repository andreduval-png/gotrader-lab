#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildOpportunity, fixtureIds, loadBt2Modules } from "./support/bt2-simulation-fixtures.mjs";

const root = path.resolve(".gotrader", "bt2-contract-tests");
fs.rmSync(root, { recursive: true, force: true });
const modules = await loadBt2Modules({ outRoot: path.join(root, "compiled") });
const opportunity = await buildOpportunity(modules);
const repeated = await buildOpportunity(modules);
assert.equal(opportunity.opportunityId, repeated.opportunityId);
assert.deepEqual(await modules.simulation.validateCanonicalOpportunity(opportunity), []);
assert.equal(opportunity.authority.executionAuthority, "none");
assert.equal(opportunity.capabilities.canCreateTradeIntent, false);
assert.equal(JSON.stringify(opportunity).includes("outcome"), false);

const changed = await buildOpportunity(modules, { targetPrices: Object.freeze([103]) });
assert.notEqual(changed.opportunityId, opportunity.opportunityId);
await assert.rejects(
  () => buildOpportunity(modules, { sourceCandleClosedAtUtc: "2026-01-05T14:35:00.000Z" }),
  /future_source_candle/
);
await assert.rejects(
  () => buildOpportunity(modules, { activatesAtUtc: "2026-01-05T14:29:00.000Z" }),
  /activation_before_decision/
);
await assert.rejects(
  () => buildOpportunity(modules, { stopPrice: 101 }),
  /stop_geometry_invalid/
);
await assert.rejects(
  () => buildOpportunity(modules, { blockers: Object.freeze(["fixture_block"]), eligible: true }),
  /eligibility_inconsistent/
);

const cost = await modules.simulation.buildSimulationCostModel({
  version: "1",
  pointSize: 0.01,
  spreadMode: "static",
  staticSpreadPoints: 2,
  slippagePoints: 1,
  commissionR: 0.01,
  swapR: 0
});
assert.match(cost.modelId, /^sha256:[0-9a-f]{64}$/);
await assert.rejects(
  () => modules.simulation.buildSimulationCostModel({
    version: "1", pointSize: 0, spreadMode: "none", slippagePoints: 0, commissionR: 0, swapR: 0
  }),
  /invalid/
);

const checkpoint = await modules.simulation.buildSimulationCheckpoint({
  experimentId: fixtureIds.experiment,
  nextOpportunityOrdinal: 1,
  committedRecordIds: Object.freeze([await modules.canonical.canonicalHash({ record: 1 })])
});
assert.match(checkpoint.checkpointId, /^sha256:[0-9a-f]{64}$/);

console.log(JSON.stringify({
  status: "passed",
  opportunityId: opportunity.opportunityId,
  identitySensitive: opportunity.opportunityId !== changed.opportunityId,
  futureSourceRejected: true,
  authority: opportunity.authority
}, null, 2));
